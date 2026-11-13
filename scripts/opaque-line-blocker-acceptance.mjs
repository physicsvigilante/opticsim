// Explicit synthetic source -> native absorber -> detector. No continuous-visibility claim.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=resolve(root,'test-artifacts/llm-authoring/opaque-line-blocker');
mkdirSync(folder,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/blocker-detector.json')));
const blocker=i=>i.physical.components.find(c=>c.type==='line-blocker').parameters;
const report={format:'opticsim-opaque-line-blocker-acceptance-v1',cases:[],browserBundles:{},sourceProblemsRead:0,externalModelCalls:0,repairs:0};
async function run(name,edit,status,exitCode){
 const i=structuredClone(fixture);i.physical.title='Synthetic opaque stop: '+name;edit(i);
 const raw=Buffer.from(JSON.stringify(i,null,2)+'\n');let calls=0;
 const result=await runProblemEvidence({inputBytes:raw,outputPath:resolve(folder,name),
  execute:scene=>{calls++;return evaluateDocument(scene,core);}});
 assert.equal(result.report.native.status,status,name+': '+JSON.stringify(result.report.native));
 assert.equal(result.exitCode,exitCode,name+': '+JSON.stringify(result.report.results));
 assert.equal(calls,result.report.dispatch.nativeCalls);
 assert.equal(result.report.dispatch.repairs,0);assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const path=resolve(folder,name,'qualified-scene.json');
  const q=await parseQualifiedBundle(readFileSync(path,'utf8'));
  assert.equal(q.scene.schemaVersion,4);
  assert.deepEqual(q.qualification.interpretation,i.interpretation);
  report.browserBundles[name]=path;
 }
 report.cases.push({name,native:result.report.native,results:result.report.results,
  coverage:result.report.coverage,inputSha256:result.report.inputSha256,exitCode});
 return result;
}
const blocked=await run('blocked',()=>{},'completed',0);
assert.equal(blocked.report.results[0].value,6);
assert.equal(blocked.report.results[2].value,0);
const clear=await run('clear',i=>{blocker(i).y=100;},'completed',0);
assert.equal(clear.report.results[0].value,0);
assert.equal(clear.report.results[2].value,4);
await run('thin',i=>{blocker(i).length=5;},'completed',0);
await run('dense',i=>{i.physical.runPolicy='dense-v1';},'completed',0);
await run('wide-cone',i=>{i.physical.components[0].emission.angleDeg=180;},'completed',0);
const intersect=await run('intersecting-detector',i=>{blocker(i).x=100;},'not-run',2);
assert.equal(intersect.report.dispatch.nativeCalls,0);
await run('missing-length',i=>{delete blocker(i).length;},'not-run',2);
await run('invalid-length',i=>{blocker(i).length=0;},'not-run',1);
const baseline=await parseQualifiedBundle(readFileSync(report.browserBundles.blocked,'utf8'));
const sweep=await runParameterSweep(baseline,{
 format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
 parameter:{id:'B1',section:'parameters',key:'x',unit:'mm'},values:[0,40,100],
 observables:[{id:'abs',kind:'blocker-absorptions',componentId:'B1'},
  {id:'cross',kind:'detector-crossings',componentId:'D1'}]},
 {execute:scene=>evaluateDocument(scene,core)});
assert.equal(sweep.samples.length,3);assert.equal(sweep.samples[2].status,'invalid-input');
assert.ok(sweep.samples[0].requestedResults.results[0].value>0);
writeFileSync(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n');
report.sweep={samples:3,invalidRetained:1};report.status='passed';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(report,null,2)+'\n');
console.log('Opaque line stop acceptance PASS: '+report.cases.length+' cases, 3 immutable samples.');
