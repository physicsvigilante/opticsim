// Synthetic 2D circle stop -> native CircleBlocker -> passive detector.
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
const folder=resolve(root,'test-artifacts/llm-authoring/opaque-circle-blocker');
mkdirSync(folder,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/circle-blocker-detector.json')));
const stop=i=>i.physical.components.find(c=>c.type==='circle-blocker').parameters;
const report={format:'opticsim-opaque-circle-blocker-acceptance-v1',cases:[],
 browserBundles:{},sourceProblemsRead:0,externalModelCalls:0,repairs:0};
async function execute(name,edit,status,exitCode){
 const i=structuredClone(fixture);i.physical.title='Synthetic circle stop: '+name;edit(i);
 const raw=Buffer.from(JSON.stringify(i,null,2)+'\n');let calls=0;
 const result=await runProblemEvidence({inputBytes:raw,outputPath:resolve(folder,name),
  execute:scene=>{calls++;return evaluateDocument(scene,core);}});
 assert.equal(result.report.native.status,status,name+': '+JSON.stringify(result.report.native));
 assert.equal(result.exitCode,exitCode,name+': '+JSON.stringify(result.report.results));
 assert.equal(calls,result.report.dispatch.nativeCalls);
 assert.equal(result.report.dispatch.repairs,0);
 assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const file=resolve(folder,name,'qualified-scene.json');
  const q=await parseQualifiedBundle(readFileSync(file,'utf8'));
  assert.equal(q.scene.schemaVersion,4);
  assert.deepEqual(q.qualification.interpretation,i.interpretation);
  report.browserBundles[name]=file;
 }
 report.cases.push({name,native:result.report.native,results:result.report.results,
  coverage:result.report.coverage,inputSha256:result.report.inputSha256,exitCode});
 return result;
}
const blocked=await execute('blocked',()=>{},'completed',0);
assert.equal(blocked.report.results[0].value,6);
assert.equal(blocked.report.results[2].value,0);
const cleared=await execute('clear',i=>{stop(i).y=100;},'completed',0);
assert.equal(cleared.report.results[0].value,0);
assert.equal(cleared.report.results[2].value,4);
const thin=await execute('small-radius',i=>{stop(i).radius=10;},'completed',0);
assert.ok(thin.report.results[0].value>0&&thin.report.results[0].value<6);
const dense=await execute('dense',i=>{i.physical.runPolicy='dense-v1';},'completed',0);
assert.equal(dense.report.results[0].value,28);
await execute('wide-cone',i=>{i.physical.components[0].emission.angleDeg=180;},'completed',0);
const tangent=await execute('tangent-detector',i=>{i.physical.components[2].parameters.x=40;},'not-run',2);
assert.equal(tangent.report.dispatch.nativeCalls,0);
const source=await execute('source-inside',i=>{stop(i).x=-200;},'not-run',2);
assert.equal(source.report.dispatch.nativeCalls,0);
await execute('missing-radius',i=>{delete stop(i).radius;},'not-run',2);
await execute('invalid-radius',i=>{stop(i).radius=0;},'not-run',1);
const baseline=await parseQualifiedBundle(readFileSync(report.browserBundles.blocked,'utf8'));
const sweep=await runParameterSweep(baseline,{
 format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
 parameter:{id:'B1',section:'parameters',key:'radius',unit:'mm'},values:[40,10,1,0],
 observables:[{id:'abs',kind:'blocker-absorptions',componentId:'B1'},
  {id:'cross',kind:'detector-crossings',componentId:'D1'}]},
 {execute:scene=>evaluateDocument(scene,core)});
assert.equal(sweep.samples.length,4);
assert.equal(sweep.samples[3].status,'invalid-input');
assert.ok(sweep.samples[0].requestedResults.results[0].value>0);
writeFileSync(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n');
report.sweep={samples:4,invalidRetained:1};report.status='passed';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(report,null,2)+'\n');
console.log('Opaque circle blocker acceptance PASS: '+report.cases.length+' cases, 4 immutable radius samples.');
