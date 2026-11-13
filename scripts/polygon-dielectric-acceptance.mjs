// Prospective synthetic four-vertex glass controls, not textbook question answers.
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
const folder=resolve(root,'test-artifacts/llm-authoring/polygon-dielectric');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/polygon-dielectric.json')));
const p=i=>i.physical.components.find(c=>c.type==='polygon-dielectric').parameters;
const source=i=>i.physical.components.find(c=>c.type==='point-source');
const withoutDetector=i=>{i.physical.components=i.physical.components.filter(c=>c.type!=='ray-detector');i.requests=i.requests.filter(q=>q.componentId!=='D1');};
mkdirSync(folder,{recursive:true});
const record={format:'opticsim-polygon-acceptance-v1',status:'pending',syntheticCases:[],
 browserBundles:{},sourceImagesRead:0,solutionsRead:false,modelCalls:0,repairs:0};
async function run(name,mutate,expectedStatus,expectedExit){
 const i=structuredClone(fixture);i.physical.title='Synthetic convex glass block · '+name;mutate(i);
 if(p(i).partialReflection===true)i.interpretation.assumptions[2]='partialReflection=true requests native Fresnel reflections; numerical weak-branch loss may make results incomplete.';
 const raw=Buffer.from(JSON.stringify(i,null,2)+'\n');let calls=0;
 const result=await runProblemEvidence({inputBytes:raw,outputPath:resolve(folder,name),
  execute:scene=>{calls++;return evaluateDocument(scene,core);}});
 assert.equal(result.report.native.status,expectedStatus,name+': '+JSON.stringify(result.report.native));
 assert.equal(result.exitCode,expectedExit,name+': '+JSON.stringify(result.report.results));
 assert.equal(calls,result.report.dispatch.nativeCalls);
 assert.equal(result.report.dispatch.repairs,0);assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const file=resolve(folder,name,'qualified-scene.json');
  const b=await parseQualifiedBundle(readFileSync(file,'utf8'));
  assert.equal(b.scene.schemaVersion,9);
  assert.deepEqual(b.qualification.interpretation,i.interpretation);
  record.browserBundles[name]=file;
 }
 record.syntheticCases.push({name,native:result.report.native,coverage:result.report.coverage,
  results:result.report.results,inputSha256:result.report.inputSha256,exitCode:result.exitCode});
 return result;
}
const oblique=await run('normal',()=>{},'completed',0);
assert.equal(oblique.report.results[0].value,2);
assert.equal(oblique.report.results[1].value['face-12'].interactions,1);
assert.equal(oblique.report.results[1].value['face-34'].interactions,1);
assert.equal(oblique.report.results[3].value,1);
await run('inside',i=>{source(i).parameters.x=7;},'completed',0);
await run('immersed',i=>{p(i).insideIndex=2;p(i).outsideIndex=1.5;},'completed',0);
await run('matched-indices',i=>{p(i).outsideIndex=1.5;p(i).partialReflection=true;},'completed',0);
const miss=await run('miss',i=>{withoutDetector(i);source(i).parameters.y=20;},'completed',2);
assert.equal(miss.report.results[0].value,0);
await run('inside-tir',i=>{withoutDetector(i);source(i).parameters.x=7;source(i).parameters.y=0;source(i).emission.directionDeg=50;},'completed',0);
const outside=await run('outside-tir',i=>{withoutDetector(i);p(i).insideIndex=1;p(i).outsideIndex=1.5;
 source(i).parameters.x=-1;source(i).parameters.y=-1;source(i).emission.directionDeg=60;
 i.requests.push({id:'transmission',kind:'interface-transmission-angle',componentId:'G1'});},'completed',2);
assert.equal(outside.report.results.at(-1).status,'unavailable');
await run('full-fresnel',i=>{p(i).partialReflection=true;},'incomplete',2);
const missing=await run('missing-index',i=>{delete p(i).outsideIndex;},'not-run',2);
assert.equal(missing.report.preparation.status,'needs-information');
assert.equal(missing.report.portable.status,'not-created');
await run('concave',i=>{p(i).x4=5;p(i).y4=0;},'not-run',2);
await run('bow-tie',i=>{const a=p(i);[a.x3,a.x4]=[a.x4,a.x3];[a.y3,a.y4]=[a.y4,a.y3];},'not-run',2);
await run('invalid-index',i=>{p(i).insideIndex=0;},'not-run',1);
const baseline=await parseQualifiedBundle(readFileSync(record.browserBundles.normal,'utf8'));
const sweep=await runParameterSweep(baseline,{format:'opticsim-parameter-sweep-v1',
 expectedSceneSha256:baseline.sceneSha256,parameter:{id:'G1',section:'parameters',key:'x3',unit:'cm'},
 values:[15,17,0],observables:[{id:'faces',kind:'interface-face-events',componentId:'G1'}]},
 {execute:scene=>evaluateDocument(scene,core)});
assert.equal(sweep.samples.length,3);
assert.equal(sweep.samples[2].status,'invalid-input');
assert.notDeepEqual(sweep.samples[0].requestedResults.results[0].value,
 sweep.samples[1].requestedResults.results[0].value);
writeFileSync(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n',{flag:'wx'});
record.sweep={samples:3,retainedInvalid:1};record.status='passed';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log('Polygon dielectric native acceptance PASS: '+record.syntheticCases.length+' synthetic cases; 3 immutable sweep samples.');
