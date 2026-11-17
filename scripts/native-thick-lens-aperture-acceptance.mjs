// Public problem-workflow native acceptance for isolated v18 composition.
// Uses frozen input bytes, the real pinned-native evaluator, and a fresh
// evidence directory; no custom ray solver, repairs, inferred image or route.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'test-artifacts/llm-authoring/native-thick-lens-aperture-v18');
if(existsSync(output))throw Error('Evidence directory exists; never overwrite earlier run evidence');
mkdirSync(output,{recursive:true});
const fixture=JSON.parse(readFileSync(resolve(root,'examples/native-thick-lens-aperture-v18.json'),'utf8'));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const comp=(x,id)=>x.physical.components.find(c=>c.id===id);
const record={format:'opticsim-native-thick-lens-aperture-acceptance-v1',status:'running',
  syntheticCases:[],originalProblemsRead:0,externalModelCalls:0,repairAttempts:0};
async function run(name,mutate,status,code){
  const input=structuredClone(fixture);
  mutate(input);
  input.physical.title='Native v18 test '+name;
  const bytes=Buffer.from(JSON.stringify(input,null,2)+'\n');
  let calls=0;
  const outcome=await runProblemEvidence({
    inputBytes:bytes,outputPath:resolve(output,name),
    execute:(scene,requests)=>{calls++;return evaluateDocument(scene,core,requests);}
  });
  const report=outcome.report;
  assert.equal(report.native.status,status,name+': '+JSON.stringify(report.native));
  assert.equal(outcome.exitCode,code,name+': '+JSON.stringify(report.results));
  assert.equal(calls,report.dispatch?.nativeCalls??0);
  assert.equal(report.dispatch?.repairs??0,0);
  assert.equal(report.dispatch?.externalModelCalls??0,0);
  const entry={name,native:report.native,results:report.results,exitCode:outcome.exitCode,
    inputSha256:report.inputSha256,sceneSha256:report.portable?.sceneSha256??null};
  record.syntheticCases.push(entry);
  if(report.portable.status==='created'){
    const bundle=await parseQualifiedBundle(readFileSync(resolve(output,name,'qualified-scene.json'),'utf8'));
    assert.equal(bundle.scene.schemaVersion,18);
    assert.equal(bundle.scene.simulation.maxRayDepth,
      input.physical.runPolicy==='preview-v1'?8:16);
    assert.deepEqual(bundle.qualification.interpretation,input.interpretation);
  }
  return report;
}
const base=await run('clear-opening',()=>{},'completed',0);
assert.deepEqual(base.results.filter(x=>typeof x.value==='number').map(x=>x.value),[4,4,1,2,0]);
const blocked=await run('opaque-arm',i=>{comp(i,'A1').parameters.y=30;},'completed',0);
assert.deepEqual(blocked.results.filter(x=>typeof x.value==='number').map(x=>x.value),[0,0,0,0,1]);
const missed=await run('all-objects-missed',i=>{comp(i,'S1').emission.directionDeg=80;},'completed',0);
assert.deepEqual(missed.results.filter(x=>typeof x.value==='number').map(x=>x.value),[0,0,0,0,0]);
const preview=await run('depth8-incomplete',i=>{i.physical.runPolicy='preview-v1';},'incomplete',2);
assert.ok(preview.results.every(x=>x.value===null&&x.status==='suppressed'));
const fresnel=await run('full-fresnel-incomplete',i=>{
  comp(i,'L1').parameters.partialReflection=true;comp(i,'L2').parameters.partialReflection=true;
  i.interpretation.assumptions.push('Explicit full Fresnel branching may be depth-truncated and must be withheld.');
},'incomplete',2);
assert.ok(fresnel.results.every(x=>x.value===null&&x.status==='suppressed'));
const invalid=await run('aperture-inside-glass',i=>{comp(i,'A1').parameters.x=0;},'not-run',2);
assert.equal(invalid.dispatch.nativeCalls,0);
record.status='passed';
writeFileSync(resolve(output,'acceptance.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log('V18_PUBLIC_NATIVE_ACCEPTANCE '+JSON.stringify({cases:record.syntheticCases.length,
  names:record.syntheticCases.map(x=>x.name),status:record.status,physicsIndependent:false}));
