// Synthetic convex finite glass integration controls, not original-question answers.
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
const folder=resolve(root,'test-artifacts/llm-authoring/polygon-glass');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/glass-polygon.json')));
const polygon=input=>input.physical.components.find(c=>c.type==='glass-polygon').parameters;
const source=input=>input.physical.components.find(c=>c.type==='point-source');
function noDetector(input){
 input.physical.components=input.physical.components.filter(c=>c.type!=='ray-detector');
 input.requests=input.requests.filter(r=>r.componentId!=='D1');
}
mkdirSync(folder,{recursive:true});
const report={format:'opticsim-polygon-glass-acceptance-v1',cases:[],browserBundles:{},sourceQuestionsRead:0,externalModelCalls:0,repairs:0};
async function run(name,edit,status,exitCode){
 const input=structuredClone(fixture);input.physical.title='Synthetic polygon glass · '+name;edit(input);
 if(polygon(input).partialReflection===true)
  input.interpretation.assumptions[2]='partialReflection=true explicitly requests native Fresnel partial reflection; weak-branch/depth truncation can make the run incomplete.';
 let calls=0;
 const result=await runProblemEvidence({inputBytes:Buffer.from(JSON.stringify(input,null,2)+'\n'),
  outputPath:resolve(folder,name),execute:doc=>{calls++;return evaluateDocument(doc,core);}});
 assert.equal(result.report.native.status,status,JSON.stringify(result.report));
 assert.equal(result.exitCode,exitCode,JSON.stringify(result.report));
 assert.equal(calls,result.report.dispatch.nativeCalls);
 assert.equal(result.report.dispatch.repairs,0);
 assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const path=resolve(folder,name,'qualified-scene.json');report.browserBundles[name]=path;
  const saved=await parseQualifiedBundle(readFileSync(path,'utf8'));
  assert.equal(saved.scene.schemaVersion,9);
  assert.deepEqual(saved.qualification.interpretation,input.interpretation);
 }
 report.cases.push({name,native:result.report.native,coverage:result.report.coverage,
  results:result.report.results,inputSha256:result.report.inputSha256,exitCode});
 return result;
}
await run('oblique',()=>{},'completed',0);
await run('inside-source',r=>{noDetector(r);source(r).parameters.x=3;source(r).parameters.y=0;},'completed',0);
await run('reversed',r=>{noDetector(r);source(r).parameters.x=24;source(r).parameters.y=0;source(r).emission.directionDeg=180;},'completed',0);
await run('immersed',r=>{polygon(r).insideIndex=2;polygon(r).outsideIndex=1.5;},'completed',0);
await run('matched-indices',r=>{polygon(r).outsideIndex=1.5;polygon(r).partialReflection=true;},'completed',0);
await run('upper-face-tir',r=>{noDetector(r);source(r).parameters.x=3;source(r).parameters.y=6;source(r).emission.directionDeg=25;},'completed',0);
await run('outside-tir',r=>{noDetector(r);polygon(r).insideIndex=1;polygon(r).outsideIndex=1.5;
 source(r).parameters.x=-1;source(r).parameters.y=5;source(r).emission.directionDeg=60;
 r.requests.push({id:'transmission',kind:'interface-transmission-angle',componentId:'G1'});},'completed',2);
await run('miss',r=>{noDetector(r);source(r).parameters.y=15;},'completed',2);
await run('full-fresnel',r=>{polygon(r).partialReflection=true;},'incomplete',2);
await run('low-depth',r=>{r.physical.runPolicy='preview-v1';},'completed',0); // scene budget changes are tested separately
const missing=await run('missing-outside-index',r=>{delete polygon(r).outsideIndex;},'not-run',2);
assert.equal(missing.report.preparation.status,'needs-information');
assert.equal(missing.report.portable.status,'not-created');
await run('nonconvex',r=>{polygon(r).x3=4;polygon(r).y3=0;},'not-run',2);
await run('invalid-index',r=>{polygon(r).insideIndex=.5;},'not-run',1);
const baseline=await parseQualifiedBundle(readFileSync(report.browserBundles.oblique,'utf8'));
const sweep=await runParameterSweep(baseline,{
 format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
 parameter:{id:'G1',section:'parameters',key:'x3',unit:'cm'},values:[12,13,0],
 observables:[{id:'faces',kind:'interface-face-events',componentId:'G1'}]},
 {execute:doc=>evaluateDocument(doc,core)});
assert.equal(sweep.samples.length,3);
assert.equal(sweep.samples[2].status,'invalid-input');
writeFileSync(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n');
report.sweep={samples:3,invalidSamplesRetained:1};report.status='pass';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(report,null,2)+'\n');
console.log('Polygon glass acceptance PASS: '+report.cases.length+' synthetic cases; three immutable vertex sweep samples.');
