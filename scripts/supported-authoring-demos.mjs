// Replays sealed synthetic requests through the real qualified CLI.
// No model calls, supplied answers, native routing, or request repair occurs.
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
import {assertSupportedOutcome} from '../evaluation/supported-demos-v1/check-results.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const inputPath='evaluation/supported-demos-v1/first-attempt.json';
export const sealedBlob='3f26818e36f440b528d1821245e71feb9eb9b5c6';
const hash=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const json=(value)=>JSON.stringify(value,null,2)+'\n';
const gitBlob=(bytes)=>createHash('sha1').update(Buffer.concat([
  Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
export function loadAttempts(){
  const bytes=readFileSync(resolve(root,inputPath));
  assert.equal(gitBlob(bytes),sealedBlob,'Frozen first attempts changed; record new attempts separately');
  return {bytes,manifest:JSON.parse(bytes.toString('utf8'))};
}
export function authoringBurden(c,document){
  const values=c.request.components.flatMap(x=>[
    ...Object.values(x.parameters),...Object.values(x.emission||{})]);
  return {components:c.request.components.length,physicalValues:values.length,
    numericPhysicalValues:values.filter(x=>typeof x==='number').length,
    requestedResults:c.observables.length,changedFields:c.revisionChanges.length,
    compactRequestBytes:Buffer.byteLength(JSON.stringify(c.request)),
    compactCanonicalBytes:Buffer.byteLength(JSON.stringify(document)),
    correctiveRequestEdits:0,requestedExperimentRevisions:1,
    resultValuesAuthored:0,sourceSidecarFiles:3,
    note:'Field and byte counts are descriptive, not token usage, time savings or an accuracy estimate.'};
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length>1)throw Error('Usage: node scripts/supported-authoring-demos.mjs [fresh-output-directory]');
  const {bytes,manifest}=loadAttempts();
  const outer=reserveAuthoringOutput(args[0]||resolve(root,'test-artifacts/llm-authoring/supported-demos'),root);
  const out=outer.directory;
  const rel=path=>relative(out,path).replaceAll('\\','/');
  const save=(path,value)=>{writeEvidence(path,json(value));return path;};
  const write=(folder,name,value)=>save(resolve(folder,name),value);
  const report={format:'opticsim-supported-demo-report-v1',status:'running',
    sealedCommit:'46bcf57fcbd8a5e2015f6fc3e59458a603584f29',sealedBlob,
    firstAttemptsSha256:hash(bytes),runtime:process.version,
    independentModelEvaluation:false,originalQuestionImagesUsed:false,
    evidenceMeaning:'Synthetic supported workflow demonstrations; author interpretation is not independently adjudicated.',
    cases:[],negativeControls:[],cliCalls:[]};
  try{report.gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}
  catch{report.gitHead=null;}
  writeEvidence(resolve(out,'first-attempt.json'),bytes);
  const cli=(label,args,expectedStatus=0)=>{
    const start=performance.now();
    const p=spawnSync(process.execPath,['scripts/qualified-scene.mjs',...args],
      {cwd:root,encoding:'utf8',maxBuffer:4*1024*1024,timeout:120000});
    const elapsedMs=Math.round(performance.now()-start);
    const raw=resolve(out,label+'.stdout.json');writeEvidence(raw,p.stdout||'');
    report.cliCalls.push({label,exitCode:p.status,elapsedMs,rawStdout:rel(raw),
      timingMeaning:'Whole CLI wall time, including native rebuild; not LLM time.'});
    assert.equal(p.error,undefined,p.error?.message);
    assert.equal(p.status,expectedStatus,p.stderr||p.stdout);
    return JSON.parse(p.stdout);
  };
  try{
    for(const c of manifest.cases){
      const folder=resolve(out,c.id);mkdirSync(folder);
      writeEvidence(resolve(folder,'prompt.txt'),c.prompt+'\n');
      writeEvidence(resolve(folder,'revision-prompt.txt'),c.revisionPrompt+'\n');
      const input=write(folder,'request.json',c.request),observables=write(folder,'observables.json',c.observables),
        interpretation=write(folder,'interpretation.json',c.interpretation);
      const first=cli(c.id+'-initial',['create',input,'--observables',observables,
        '--interpretation',interpretation,'--out',resolve(folder,'initial')]);
      assert.equal(first.problem.status,'fully-specified');
      assert.deepEqual(first.problem.appliedChoices,[]);
      assert.deepEqual(readFileSync(first.outputs.input),readFileSync(input));
      const bundle=await parseQualifiedBundle(readFileSync(first.outputs.bundle,'utf8'));
      // Hash injection is mechanical, not a second authoring attempt.
      const patch=write(folder,'changes.json',{expectedSha256:bundle.sceneSha256,changes:c.revisionChanges});
      const revised=cli(c.id+'-revised',['revise',first.outputs.bundle,patch,
        '--out',resolve(folder,'revised')]);
      const next=await parseQualifiedBundle(readFileSync(revised.outputs.bundle,'utf8'));
      assert.deepEqual(next.qualification.origin,bundle.qualification.origin);
      assert.deepEqual(next.qualification.assumptions,bundle.qualification.assumptions);
      assert.deepEqual(next.qualification.interpretation,bundle.qualification.interpretation);
      assert.equal(next.qualification.edits.length,1);
      assert.equal(next.qualification.edits[0].kind,'physics');
      assert.equal(next.qualification.edits[0].changes.length,1);
      assert.equal(revised.parentIntegritySha256,bundle.integritySha256);
      for(const [phase,run,b] of [['initial',first,bundle],['revised',revised,next]]){
        assert.equal(run.executionPassed,true);assert.equal(run.native.status,'completed');
        assert.deepEqual(run.native.warnings,[]);assert.equal(run.native.truncation,0);
        assert.equal(run.canonicalSha256,b.sceneSha256);
        assertSupportedOutcome(c.id,phase,b.scene,run);
      }
      report.cases.push({id:c.id,promptSha256:hash(c.prompt+'\n'),
        requestSha256:hash(readFileSync(input)),firstAttemptAccepted:true,
        inputCorrectionCount:0,burden:authoringBurden(c,bundle.scene),
        initial:{bundle:rel(first.outputs.bundle),report:rel(first.outputs.report),
          canonicalSha256:first.canonicalSha256,native:first.native,results:first.requestedResults.results},
        revised:{bundle:rel(revised.outputs.bundle),report:rel(revised.outputs.report),
          canonicalSha256:revised.canonicalSha256,native:revised.native,results:revised.requestedResults.results}});
    }
    const controls=resolve(out,'controls');mkdirSync(controls);
    const c=manifest.cases[0],missing=structuredClone(c.request);
    delete missing.components.find(x=>x.id==='L1').parameters.focalLength;
    const blockedDir=resolve(controls,'missing');
    const blocked=cli('missing-focal-length',['create',write(controls,'missing.request.json',missing),
      '--out',blockedDir],1);
    assert.equal(blocked.problem.status,'needs-information');assert.equal(blocked.native.status,'not-run');
    assert.ok(blocked.problem.issues.some(x=>x.path.endsWith('focalLength')));
    for(const name of ['scene.ray-optics-2d.json','qualified-scene.json'])assert.equal(existsSync(resolve(blockedDir,name)),false);
    report.negativeControls.push({id:'missing-focal-length',preparation:blocked.problem.status,
      native:blocked.native.status,report:rel(blocked.outputs.report),result:'pass'});
    const query=manifest.negativeControls.find(x=>x.id==='unsupported-quantity').observable;
    const unsupported=cli('unsupported-quantity',['create',write(controls,'complete.request.json',c.request),
      '--observables',write(controls,'unsupported.observables.json',[query]),'--out',resolve(controls,'unsupported')]);
    assert.equal(unsupported.executionPassed,true);
    assert.equal(unsupported.requestedResults.results[0].status,'unavailable');
    assert.equal(unsupported.requestedResults.results[0].value,null);
    report.negativeControls.push({id:'unsupported-quantity',native:unsupported.native.status,
      requestedResult:unsupported.requestedResults.results[0],report:rel(unsupported.outputs.report),result:'pass'});
    assert.equal(gitBlob(readFileSync(resolve(root,inputPath))),sealedBlob);
    report.status='pass';
    writeEvidence(resolve(out,'OPEN-ME.md'),[
      '# Supported Opticsim demonstrations',
      'Open each initial/qualified-scene.json in the Opticsim browser using Open scene / qualified package.',
      'The corresponding revised package changes one physical parameter and retains the origin and edit history.',
      'Lens image positions are conditional analytical predictions, not independently detected image points.',
      'Mirror/detector results are native sampled observations; relative power is not watts.',
      'Original prompts, sealed inputs, reports, controls, and measured authoring fields are included.',
      'For a wider view of outgoing rays, reduce browser zoom; camera changes do not change apparatus.',
      ...report.cases.flatMap(c=>['',c.id, 'Initial: '+c.initial.bundle,'Revised: '+c.revised.bundle]),
      '', 'These are synthetic development examples, not an independent LLM benchmark.'
    ].join('\n')+'\n');
    console.log('Supported demos PASS: 3 unchanged first requests, 3 physical revisions, 2 negative controls. Evidence: '+out);
  }catch(error){report.status='failed';report.error=error.message;throw error;}
  finally{writeEvidence(outer.report,json(report));}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
