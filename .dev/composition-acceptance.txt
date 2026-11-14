// Synthetic composition checks through the EXISTING unified execution pipeline.
// No textbook interpretation, provider call, numerical repair or ray routing.
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
const folder=resolve(root,'test-artifacts/llm-authoring/finite-composition');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/finite-dielectric-composition.json')));
const part=(i,id)=>i.physical.components.find(c=>c.id===id);
mkdirSync(folder,{recursive:true});
const record={format:'opticsim-finite-composition-acceptance-v1',status:'pending',syntheticCases:[],
 browserBundles:{},sourceImagesRead:0,solutionsRead:false,modelCalls:0,repairs:0};
async function run(name,mutate,expectedStatus,expectedExit){
 const i=structuredClone(fixture);i.physical.title='Synthetic finite composition: '+name;mutate(i);
 if(part(i,'G1').parameters.partialReflection===true)i.interpretation.assumptions[2]=
  'partialReflection=true requests native Fresnel reflections; weak-branch/depth truncation remains incomplete.';
 const raw=Buffer.from(JSON.stringify(i,null,2)+'\n');let calls=0;
 const result=await runProblemEvidence({inputBytes:raw,outputPath:resolve(folder,name),
  execute:scene=>{calls++;return evaluateDocument(scene,core);}});
 assert.equal(result.report.native.status,expectedStatus,name+': '+JSON.stringify(result.report.native));
 assert.equal(result.exitCode,expectedExit,name+': '+JSON.stringify(result.report.results));
 assert.equal(calls,result.report.dispatch.nativeCalls);assert.equal(result.report.dispatch.repairs,0);
 assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const file=resolve(folder,name,'qualified-scene.json'),b=await parseQualifiedBundle(readFileSync(file,'utf8'));
  assert.equal(b.scene.schemaVersion,10);assert.deepEqual(b.qualification.interpretation,i.interpretation);
  record.browserBundles[name]=file;
 }
 record.syntheticCases.push({name,native:result.report.native,results:result.report.results,
  inputSha256:result.report.inputSha256,exitCode:result.exitCode});return result;
}
const normal=await run('normal',()=>{},'completed',0);
assert.equal(normal.report.results[0].value,4);assert.equal(normal.report.results[2].value,1);
assert.equal(normal.report.results[3].value,2);assert.equal(normal.report.results[4].value,0);
await run('oblique',i=>{part(i,'S1').parameters.y=-15;part(i,'S1').emission.directionDeg=10;},'completed',0);
const miss=await run('mirror-miss',i=>{part(i,'M1').parameters.y=100;},'completed',0);
assert.equal(miss.report.results[0].value,2);assert.equal(miss.report.results[2].value,0);assert.equal(miss.report.results[3].value,1);
await run('tilted-mirror',i=>{part(i,'M1').parameters.orientationDeg=80;},'completed',0);
await run('inside-source',i=>{part(i,'S1').parameters.x=10;},'completed',0);
await run('immersed',i=>{Object.assign(part(i,'G1').parameters,{insideIndex:2,outsideIndex:1.33});},'completed',0);
await run('matched-indices',i=>{Object.assign(part(i,'G1').parameters,{outsideIndex:1.5,partialReflection:true});},'completed',0);
await run('no-detector',i=>{i.physical.components=i.physical.components.filter(c=>c.id!=='D1');i.requests=i.requests.filter(r=>r.componentId!=='D1');},'completed',0);
const tir=await run('outside-tir',i=>{
 Object.assign(part(i,'G1').parameters,{insideIndex:1,outsideIndex:1.5});
 part(i,'S1').parameters.y=-40*Math.tan(50*Math.PI/180);part(i,'S1').emission.directionDeg=50;
 Object.assign(part(i,'D1').parameters,{x:-20,length:60});
 i.requests.push({id:'transmission',kind:'interface-transmission-angle',componentId:'G1'});
},'completed',2);
assert.equal(tir.report.results.at(-1).status,'unavailable');assert.equal(tir.report.results.at(-1).value,null);
for(const [name,mutate] of [
 ['full-fresnel',i=>{part(i,'G1').parameters.partialReflection=true;}],
 ['two-detectors',i=>{i.physical.components.push({id:'D2',type:'ray-detector',parameters:{x:-20,y:0,orientationDeg:90,length:40}});}]
]){const result=await run(name,mutate,'incomplete',2);assert.ok(result.report.results.every(r=>r.status==='suppressed'&&r.value===null));}
await run('inside-mirror',i=>{part(i,'M1').parameters.x=10;},'not-run',2);
await run('crossed-detector',i=>{Object.assign(part(i,'D1').parameters,{x:60,y:5,orientationDeg:0,length:40});},'not-run',2);
const missing=await run('missing-index',i=>{delete part(i,'G1').parameters.outsideIndex;},'not-run',2);
assert.equal(missing.report.preparation.status,'needs-information');assert.equal(missing.report.portable.status,'not-created');
await run('invalid-index',i=>{part(i,'G1').parameters.insideIndex=0;},'not-run',1);
const baseline=await parseQualifiedBundle(readFileSync(record.browserBundles.normal,'utf8')),before=structuredClone(baseline);
const sweep=await runParameterSweep(baseline,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
 parameter:{id:'M1',section:'parameters',key:'x',unit:'mm'},values:[60,80,10],observables:fixture.requests},
 {execute:scene=>evaluateDocument(scene,core)});
assert.equal(sweep.completedSamples,2);assert.equal(sweep.samples[2].status,'invalid-input');assert.deepEqual(baseline,before);
writeFileSync(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n',{flag:'wx'});
record.sweep={samples:3,retainedInvalid:1};record.status='passed';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log('Finite dielectric composition acceptance PASS: '+record.syntheticCases.length+' synthetic cases; 3 immutable sweep samples.');
