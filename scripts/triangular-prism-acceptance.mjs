// Fully specified synthetic controls, not original-question or LLM accuracy claims.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
const root=fileURLToPath(new URL('../',import.meta.url)),folder=resolve(root,'test-artifacts/llm-authoring/triangular-prism');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/triangular-prism.json')));
const p=input=>input.physical.components.find(c=>c.type==='triangular-prism').parameters;
const s=input=>input.physical.components.find(c=>c.type==='point-source');
const noDetector=input=>{input.physical.components=input.physical.components.filter(c=>c.type!=='ray-detector');input.requests=input.requests.filter(r=>r.componentId!=='D1');};
mkdirSync(folder,{recursive:true});
const report={format:'opticsim-prism-acceptance-v1',cases:[],browserBundles:{},sourceQuestionsRead:0,externalModelCalls:0,repairs:0};
async function run(name,edit,status,exitCode){
 const input=structuredClone(fixture);input.physical.title='Synthetic triangular prism · '+name;edit(input);
 if(p(input).partialReflection===true)input.interpretation.assumptions[2]='partialReflection=true explicitly requests native Fresnel reflection; lost weak branches or depth-limited energy make the run incomplete.';
 let calls=0;
 const result=await runProblemEvidence({inputBytes:Buffer.from(JSON.stringify(input,null,2)+'\n'),outputPath:resolve(folder,name),execute:doc=>{calls++;return evaluateDocument(doc,core);}});
 assert.equal(result.report.native.status,status,JSON.stringify(result.report));assert.equal(result.exitCode,exitCode,JSON.stringify(result.report));
 assert.equal(calls,result.report.dispatch.nativeCalls);assert.equal(result.report.dispatch.repairs,0);assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const path=resolve(folder,name,'qualified-scene.json');report.browserBundles[name]=path;
  const saved=await parseQualifiedBundle(readFileSync(path,'utf8'));assert.equal(saved.scene.schemaVersion,8);
  assert.deepEqual(saved.qualification.interpretation,input.interpretation);
 }
 report.cases.push({name,native:result.report.native,coverage:result.report.coverage,results:result.report.results,inputSha256:result.report.inputSha256,exitCode});
 return result;
}
await run('oblique',()=>{},'completed',0);
await run('inside-source',r=>{noDetector(r);s(r).parameters.x=2;},'completed',0);
await run('immersed',r=>{p(r).insideIndex=2;p(r).outsideIndex=1.5;},'completed',0);
await run('matched-indices',r=>{p(r).outsideIndex=1.5;p(r).partialReflection=true;},'completed',0);
await run('right-angle-tir',r=>{noDetector(r);p(r).x3=20;},'completed',0);
await run('outside-tir',r=>{noDetector(r);p(r).insideIndex=1;p(r).outsideIndex=1.5;s(r).parameters.x=-1;s(r).parameters.y=-1;s(r).emission.directionDeg=60;
 r.requests.push({id:'transmission',kind:'interface-transmission-angle',componentId:'P1'});},'completed',2);
await run('miss',r=>{noDetector(r);s(r).parameters.y=15;},'completed',2);
await run('full-fresnel',r=>{p(r).partialReflection=true;},'incomplete',2);
const missing=await run('missing-outside-index',r=>{delete p(r).outsideIndex;},'not-run',2);
assert.equal(missing.report.preparation.status,'needs-information');assert.equal(missing.report.portable.status,'not-created');
await run('collinear',r=>{p(r).x3=0;},'not-run',2);
await run('invalid-index',r=>{p(r).insideIndex=0;},'not-run',1);
const baseline=await parseQualifiedBundle(readFileSync(report.browserBundles.oblique,'utf8'));
const sweep=await runParameterSweep(baseline,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
 parameter:{id:'P1',section:'parameters',key:'x3',unit:'cm'},values:[11.547005383792516,13,0],
 observables:[{id:'faces',kind:'interface-face-events',componentId:'P1'}]}, {execute:doc=>evaluateDocument(doc,core)});
assert.equal(sweep.samples[2].status,'invalid-input');assert.equal(sweep.samples.length,3);
assert.notDeepEqual(sweep.samples[0].requestedResults.results[0].value,sweep.samples[1].requestedResults.results[0].value);
writeFileSync(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n',{flag:'wx'});
report.sweep={samples:3,invalidSamplesRetained:1};report.status='pass';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Triangular prism acceptance PASS: '+report.cases.length+' synthetic cases; 3 immutable vertex sweep samples.');
