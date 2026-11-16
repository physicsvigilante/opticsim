// Test-only three-family teaching evidence. Existing native/authoring/qualified APIs;
// no new ray solver, optical model, source interpretation or teacher score.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {validate,serializeSave,UPSTREAM} from '../../src/contract.js';
import {reviseScene} from '../../src/authoring.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {evaluateObservables} from '../../src/observables.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,
 parseQualifiedBundle} from '../../src/qualification.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const planPath=resolve(root,'evaluation/teaching-cross-family-v1/PLAN.json');
const planBytes=readFileSync(planPath),plan=JSON.parse(planBytes);
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const json=o=>JSON.stringify(o,null,2)+'\n';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const baseline='50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518';
assert.equal(plan.sourceMain,baseline);
assert.equal(plan.nativePin,UPSTREAM);
assert.ok(process.version.startsWith('v24.'),'Supported Node 24 required');
assert.deepEqual(plan.cases.map(x=>x.id),['lens','mirror','glass']);
assert.equal(plan.humanReview.initialTeacherParticipants,0);
assert.equal(plan.humanReview.initialStudentParticipants,0);

const out=resolve(root,process.env.OPTICSIM_CROSS_FAMILY_OUTPUT||
 'test-artifacts/llm-authoring/teaching-cross-family-v1');
const permitted=resolve(root,'test-artifacts/llm-authoring');
assert.ok(out.startsWith(permitted+'/')&&!out.includes('..'),'Must retain evidence inside ignored research directory');
mkdirSync(permitted,{recursive:true});
mkdirSync(out); // Exclusive: NEVER overwrite first attempts, even if earlier check failed.
const write=(p,x)=>writeFileSync(join(out,p),typeof x==='string'||Buffer.isBuffer(x)?x:json(x),{flag:'wx'});
write('PLAN.json',planBytes);
const report={
 format:'opticsim-teaching-cross-family-evidence-v1',status:'running',
 planSha256:sha(planBytes),sourceMain:baseline,nativePin:UPSTREAM,
 executionCommit:process.env.GITHUB_SHA||'local',githubRunId:process.env.GITHUB_RUN_ID||null,
 node:process.version,
 evidenceOrigin:'Three already-exposed pinned repository fixtures, not unfamiliar problems',
 noExternalLLMCalls:true,independentModelEvaluation:false,
 teacherParticipants:0,studentParticipants:0,
 humanTeacherFeedback:'not-assessed',classroomLearningEffectiveness:'not-assessed',
 exactNativePathCertified:false,physicalInterpretationIndependentlyCertified:false,
 originalTextbookAnswerRequested:false,
 checks:[],cases:[],
 dimensions:{
  interpretationFidelity:{status:'source-field-preservation-only',unseenModelAuthoring:'not-tested'},
  physicalAndNumericalCorrectness:{status:'pending-software-checks',notRealWorldCertified:true},
  simulationCoverage:{status:'pending-software-checks'},
  educationalUsefulness:{status:'not-assessed-by-teachers',browserAffordances:'pending'},
  textbookAnswerCompleteness:{status:'not-requested'}
 },
 limitations:[
  'Source fixture field fidelity is not interpretation of an unseen question.',
  'A completed native trace is not a universal physically correct ray-path certificate.',
  'A conditional analytical image is never native image detection.',
  'Counts/relative power are sampled native observations, never continuous illumination or watts.',
  'Finite-hit diagnostic is advisory only, UNKNOWN is not clean, and no Stage-2 withholding is imposed.',
  'Teacher/student usefulness has no participant evidence until people complete the worksheet.'
 ]
};
const check=(name,passed,details=null)=>{
 report.checks.push({name,passed:!!passed,...(details?{details}:{} )});
};
const records=new Map();
const sceneReqs=plan.cases.flatMap(c=>c.requests.map(r=>({...r,caseId:c.id})));
assert.equal(sceneReqs.length,15,'Unexpected three-case observable fixture design');
// Store complete evidence for every attempted native run, including honest failed runs.
async function execute(c,kind,doc,requests,q,classification){
 const label=c.id+'/'+kind;
 const dir=join(out,c.id,kind);mkdirSync(dir,{recursive:true});
 const save=(name,value)=>writeFileSync(join(dir,name),typeof value==='string'||Buffer.isBuffer(value)?value:json(value),{flag:'wx'});
 const before=serializeSave(doc),sourceSha=sha(before);
 save('scene.json',before);save('requests.json',requests);save('provenance.json',{classification,originalSource:c.path,sourceBlob:c.gitBlob,
  baselineOriginalSha256:records.get(c.id)?.sourceSha256??null,currentSceneSha256:sourceSha});
 const native=evaluateDocument(doc,core,requests);
 const results=await evaluateObservables(doc,requests,native.summary);
 const bundle=await createQualifiedBundle(doc,q,requests);
 const opened=await parseQualifiedBundle(json(bundle));
 const row={
  id:label,sourcePath:c.path,caseId:c.id,variant:kind,
  sceneSha256:sourceSha,sourceBlob:c.gitBlob,sourceFileSha256:records.get(c.id)?.sourceSha256??null,
  native:{status:native.summary.native.status,error:native.summary.native.error,
   warnings:native.summary.native.warnings,truncation:native.summary.native.truncation,
   errors:native.summary.native.errors,processed:native.summary.native.processed,
   undefinedBehavior:native.summary.native.undefinedBehavior},
  executionPassed:native.summary.executionPassed,
  results:results.results.map(({id,kind,status,method,unit,value,reason,reasonCode,limitation,nativeImageDetected,warnings})=>
   ({id,kind,status,method,unit,value,reason,reasonCode,limitation,nativeImageDetected,warnings})),
  qualifiedPackage:c.id+'/'+kind+'/qualified-scene.json',
  originalInputSha256:q.origin.inputSha256,
  editKinds:bundle.qualification.edits.map(x=>x.kind)
 };
 report.cases.push(row);
 save('native-execution.json',native);save('requested-results.json',results);
 save('qualified-scene.json',bundle);
 check(label+': input unchanged by native and result evaluation',serializeSave(doc)===before);
 check(label+': qualified import round-trip retains original scene/request/history',
  equal(opened.scene,doc)&&equal(opened.observables,requests)&&equal(opened.qualification,q));
 check(label+': native execution completed with current qualification and no native error',
  native.summary.executionPassed&&native.summary.native.status==='completed'&&
  native.summary.native.errors.length===0&&native.summary.native.truncation===0,row.native);
 check(label+': requested result count equals authored request count',results.results.length===requests.length);
 records.set(label,{doc,native,results,bundle,row});
 return {doc,native,results,bundle,row};
}
try{
 for(const c of plan.cases){
  const sourcePath=resolve(root,c.path),sourceBytes=readFileSync(sourcePath);
  assert.equal(gitBlob(sourceBytes),c.gitBlob,'Pinned source fixture changed: '+c.path);
  const source=JSON.parse(sourceBytes);
  validate(source);
  assert.equal(source.physics.model,c.model,'Model no longer matches frozen scene: '+c.id);
  assert.equal(source.physics.lengthUnit,'mm');
  assert.equal(source.physics.coordinates,'x-right-y-up');
  assert.equal(source.upstreamCommit,UPSTREAM);
  const originalSourceSha=sha(sourceBytes);
  mkdirSync(join(out,c.id));
  write(c.id+'/original-source.json',sourceBytes);
  records.set(c.id,{sourceSha256:originalSourceSha});
  const interpretation={
   source:{caseId:'cross-family-'+c.id,path:c.path,sha256:originalSourceSha},
   requestedResult:'Inspect and explore original '+c.id+' source scene; requested results are not an answer key.',
   stated:['All physical fields and stable IDs are copied from the pinned exposed fixture '+c.path+'.',
    'Native counts are finite sampled observations; coordinate convention is x-right/y-up and units mm.'],
   derived:[],
   assumptions:['The native physical model is exactly the one declared by this synthetic fixture.',
    'Any what-if branch changes one explicitly teacher-proposed physical parameter, not the original given.'],
   unknowns:['No source-textbook interpretation or independently certified optical path is established.',
    'No human teacher or student usability effectiveness has been assessed.']
  };
  const q=initialQualification(source,null,{inputSha256:originalSourceSha,interpretation});
  const originalCanonical=serializeSave(source);
  const noAnswer=await execute(c,'scene-only',source,[],q,'original fixture, no answer target');
  const base=await execute(c,'baseline',source,c.requests,q,'original fixture with separately selected passive readouts');
  check(c.id+': no-answer native execution has no dummy readout and identical canonical source hash',
   noAnswer.results.results.length===0&&noAnswer.row.sceneSha256===base.row.sceneSha256);
  // Never claim that opt-in diagnostics are observationally neutral.
  if(c.id!=='glass')check(c.id+': passive result selection did not change ordinary source/native counts',
   equal(noAnswer.native.summary.observations,base.native.summary.observations));
  else check('glass: finite diagnostic capture remains opt-in and cannot certify native ray routing',
   base.row.results.find(x=>x.kind==='finite-hit-numerical-diagnostic')?.method?.startsWith('advisory-')===true);
  const revision=reviseScene(source,{changes:c.whatIf.changes}).document;
  validate(revision);
  const q2=recordQualifiedEdit(source,revision,q);
  const changed=await execute(c,'what-if',revision,c.requests,q2,c.whatIf.classification);
  const field=c.whatIf.changes[0];
  check(c.id+': what-if is an exact single-field physical revision with stable component ID',
   q2.edits.length===1&&q2.edits[0].kind==='physics'&&q2.edits[0].changes.length===1&&
   revision.physics.components.find(x=>x.id===field.id)?.[field.section]?.[field.key]===field.value);
  check(c.id+': teacher intervention keeps source input and numerical settings unchanged',
   equal(source.simulation,revision.simulation)&&
   q2.origin.inputSha256===base.bundle.qualification.origin.inputSha256&&
   equal(source.physics.components.map(x=>x.id),revision.physics.components.map(x=>x.id))&&
   serializeSave(source)===originalCanonical);
  check(c.id+': native evidence is bound to variant instead of reused from baseline',
   changed.row.sceneSha256!==base.row.sceneSha256&&
   changed.native.summary.canonicalSha256===changed.row.sceneSha256);
  check(c.id+': all source truth is preserved in portable what-if qualification',
   changed.bundle.qualification.interpretation.source.sha256===originalSourceSha&&
   changed.bundle.qualification.edits.length===1&&
   changed.bundle.qualification.edits[0].kind==='physics');
  const checkResults=results=>results.results.map(r=>r.kind+':'+r.status);
  if(c.id==='lens'||c.id==='mirror'){
   check(c.id+': ideal image is explicitly conditional and never native image detection',
    [base,changed].every(t=>t.results.results.find(x=>x.kind==='ideal-image')?.status==='conditional'&&
      t.results.results.find(x=>x.kind==='ideal-image')?.nativeImageDetected===false),
    {baseline:checkResults(base.results),whatIf:checkResults(changed.results)});
  }else{
   check('glass: unsupported ideal-image request remains explicitly unavailable',
    [base,changed].every(t=>{const r=t.results.results.find(x=>x.kind==='ideal-image');
      return r?.status==='unavailable'&&r.value===null&&r.method===null;}));
   check('glass: finite-hit advisory remains separate and noncertifying',
    [base,changed].every(t=>{const r=t.results.results.find(x=>x.kind==='finite-hit-numerical-diagnostic');
      return r?.status==='advisory'&&r?.value?.advisory===true&&
       r?.value?.nativeMeasurementQualificationUnchanged===true&&
       r?.limitation?.includes('Does NOT change canonical native status');}),
    {baseline:checkResults(base.results),whatIf:checkResults(changed.results)});
   check('glass: native face events are not whole source-to-face ray histories',
    [base,changed].every(t=>t.results.results.find(x=>x.kind==='interface-face-events')?.limitation?.includes('not source attribution')));
  }
  for(const t of [base,changed]){
   for(const r of t.results.results.filter(r=>['source-emissions','mirror-reflections','detector-crossings','detector-signed-power'].includes(r.kind))){
    check(t.row.id+': '+r.kind+' is native sampled evidence, not a continuous optical image',
     ['available','qualified'].includes(r.status)&&r.method==='native-observation'&&
     typeof r.value==='number'&&Number.isFinite(r.value));
   }
  }
 }
 report.dimensions.physicalAndNumericalCorrectness.status=
  report.checks.every(x=>x.passed)?'software-native-checks-passed':'software-native-check-failed';
 report.dimensions.simulationCoverage.status=report.checks.every(x=>x.passed)?
  'three-registered-families-exercised':'coverage-check-failed';
 report.status=report.checks.every(x=>x.passed)?'checks-passed':'checks-failed';
}catch(e){report.status='checks-failed';report.error={message:e.message,stack:e.stack};process.exitCode=1;}
finally{
 const sourcePaths=['src/contract.js','src/adapter.js','src/authoring.js',
  'src/observables.js','src/qualification.js','scripts/author-scene.mjs','upstream-pin.json'];
 report.productionSourceSha256=Object.fromEntries(sourcePaths.map(p=>[p,sha(readFileSync(resolve(root,p)))]));
 write('report.json',report);
 write('summary.md','# Three-family teaching evidence — software pilot only\n\n'+
  '| Case | Variant | Native state | Native readout statuses |\n| --- | --- | --- | --- |\n'+
  report.cases.map(r=>'| '+r.caseId+' | '+r.variant+' | '+r.native.status+' | '+r.results.map(x=>x.kind+': '+x.status).join('; ')+' |').join('\n')+
  '\n\nTeacher/student effectiveness: **NOT ASSESSED** (zero participants). Native samples, conditional analysis and unavailable/advisory are not interchangeable.\n');
 console.log('CROSS_FAMILY_TEACHING '+JSON.stringify({status:report.status,
  cases:report.cases.length,checks:report.checks.length,passed:report.checks.filter(x=>x.passed).length,
  teacherParticipants:0,studentParticipants:0,error:report.error?.message}));
 if(report.status!=='checks-passed')process.exitCode=1;
}
