// Explicit synthetic controls. No source question images, Solutions, LLM calls
// or repairs. Real native executions through the unchanged unified dispatcher.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=resolve(root,'test-artifacts/llm-authoring/circular-dielectric');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/circular-dielectric.json')));
const hash=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(folder,{recursive:true});
const report={format:'opticsim-circular-dielectric-acceptance-v1',status:'running',
 upstreamCommit:'811f508d2b070898c241a568b0c167dcb8645251',cases:[],browserBundles:{},
 sourceQuestionsRead:0,externalModelCalls:0,repairs:0,independentAccuracyScore:null};
async function run(name,edit,status,exitCode){
 const input=structuredClone(fixture);input.physical.title='Synthetic circular dielectric · '+name;
 edit(input);
 // Each synthetic variant declares its own chosen policy BEFORE capture.
 // These are fixture inputs, not edits to an original problem interpretation.
 const fresnel=input.physical.components.find(c=>c.type==='circular-dielectric').parameters.partialReflection;
 if(fresnel===true)input.interpretation.assumptions[2]='partialReflection=true requests native Fresnel partial reflections and total internal reflection; any truncated ray energy remains incomplete.';
 const bytes=Buffer.from(JSON.stringify(input,null,2)+'\n');
 let calls=0;
 const result=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(folder,name),
  execute:doc=>{calls++;return evaluateDocument(doc,core);}});
 assert.equal(result.report.inputSha256,hash(bytes));assert.equal(result.exitCode,exitCode,JSON.stringify(result.report));
 assert.equal(result.report.native.status,status);assert.equal(result.report.dispatch.repairs,0);
 assert.equal(result.report.dispatch.externalModelCalls,0);assert.equal(calls,result.report.dispatch.nativeCalls);
 if(result.report.portable.status==='created'){
  report.browserBundles[name]=resolve(folder,name,'qualified-scene.json');
  const saved=await parseQualifiedBundle(readFileSync(report.browserBundles[name],'utf8'));
  assert.equal(saved.scene.schemaVersion,7);assert.deepEqual(saved.qualification.interpretation,input.interpretation);
 }
 report.cases.push({name,inputSha256:hash(bytes),native:result.report.native,coverage:result.report.coverage,
  results:result.report.results,dispatch:result.report.dispatch});
 return result;
}
const c=input=>input.physical.components.find(c=>c.id==='G1').parameters;
const s=input=>input.physical.components.find(c=>c.id==='S1');
const noDetector=input=>{
 input.physical.components=input.physical.components.filter(c=>c.type!=='ray-detector');
 input.requests=input.requests.filter(r=>r.componentId!=='D1');
};
await run('oblique',()=>{},'completed',0);
await run('normal',p=>{s(p).parameters.y=0;},'completed',0);
await run('inside',p=>{noDetector(p);s(p).parameters.x=0;},'completed',0);
await run('reversed',p=>{noDetector(p);s(p).parameters.x=30;s(p).emission.directionDeg=180;},'completed',0);
await run('immersed',p=>{c(p).insideIndex=2;c(p).outsideIndex=1.5;},'completed',0);
await run('matched-indices',p=>{c(p).insideIndex=1;c(p).partialReflection=true;},'completed',0);
await run('outside-tir',p=>{noDetector(p);s(p).parameters.y=8;c(p).insideIndex=1;c(p).outsideIndex=1.5;
 p.requests.push({id:'tir-count',kind:'interface-tir-count',componentId:'G1'});},'completed',2);
await run('miss',p=>{noDetector(p);s(p).parameters.y=15;},'completed',2);
await run('full-fresnel',p=>{c(p).partialReflection=true;},'incomplete',2);
await run('trapped-tir',p=>{noDetector(p);s(p).parameters.x=0;s(p).parameters.y=8;},'incomplete',2);
const missing=await run('missing-outside-index',p=>{delete c(p).outsideIndex;},'not-run',2);
assert.equal(missing.report.preparation.status,'needs-information');assert.equal(missing.report.portable.status,'not-created');
const invalid=await run('invalid-radius',p=>{c(p).radius=-10;},'not-run',1);
assert.equal(invalid.report.preparation.status,'invalid-input');
const baseline=await parseQualifiedBundle(readFileSync(report.browserBundles.oblique,'utf8'));
const sweep=await runParameterSweep(baseline,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
 parameter:{id:'G1',section:'parameters',key:'radius',unit:'cm'},values:[10,8,-1],
 observables:[{id:'entry',kind:'interface-transmission-angle',componentId:'G1'}]},
 {execute:doc=>evaluateDocument(doc,core)});
assert.equal(sweep.samples.length,3);assert.equal(sweep.samples[2].status,'invalid-input');
assert.ok(sweep.samples[0].requestedResults.results[0].value!==sweep.samples[1].requestedResults.results[0].value);
writeFileSync(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n',{flag:'wx'});
report.status='pass';report.sweep={samples:3,invalidSamplesRetained:1};
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Circular dielectric acceptance PASS: '+report.cases.length+' synthetic inputs; 3 immutable sweep samples; no Solutions/model calls.');
