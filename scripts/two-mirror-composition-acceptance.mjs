// End-to-end synthetic systems using the existing qualified native pipeline.
// Expected rejections/incomplete runs are retained, never counted as ray successes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
import {createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {prepareQualifiedStructure} from '../src/qualified-structure.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.argv.length>3)throw Error('Usage: node scripts/two-mirror-composition-acceptance.mjs [fresh-evidence-directory]');
const output=reserveAuthoringOutput(process.argv[2]||'test-artifacts/llm-authoring/two-mirror-composition',root);
const folder=output.directory,core=createRequire(import.meta.url)('../dist/test-core.cjs');
const raw=readFileSync(resolve(root,'examples/finite-glass-two-mirrors.json'));
const fixture=JSON.parse(raw),part=(i,id)=>i.physical.components.find(c=>c.id===id);
writeEvidence(output.input,raw);
const record={format:'opticsim-two-mirror-composition-acceptance-v1',status:'pending',syntheticCases:[],
 browserBundles:{},sourceImagesRead:0,solutionsRead:false,externalModelCalls:0,repairs:0};
async function run(name,mutate,status,exit){
 const input=structuredClone(fixture);input.physical.title='Synthetic two-mirror composition: '+name;mutate(input);
 if(part(input,'G1').parameters.partialReflection)input.interpretation.assumptions[2]=
  'partialReflection=true requests native Fresnel reflections; truncation remains incomplete.';
 const result=await runProblemEvidence({inputBytes:Buffer.from(JSON.stringify(input,null,2)+'\n'),outputPath:resolve(folder,name),
  execute:scene=>evaluateDocument(scene,core)});
 record.syntheticCases.push({name,native:result.report.native,preparation:result.report.preparation,results:result.report.results,
  inputSha256:result.report.inputSha256,exitCode:result.exitCode});
 assert.equal(result.report.native.status,status,name);assert.equal(result.exitCode,exit,name);
 assert.equal(result.report.dispatch.repairs,0);assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const file=resolve(folder,name,'qualified-scene.json'),b=await parseQualifiedBundle(readFileSync(file,'utf8'));
  assert.equal(b.scene.schemaVersion,11);assert.deepEqual(b.qualification.interpretation,input.interpretation);
  record.browserBundles[name]=file;
 }return result;
}
try{
 const normal=await run('normal',()=>{},'completed',0);
 assert.equal(normal.report.results[0].value,4);assert.equal(normal.report.results[2].value,1);
 assert.equal(normal.report.results[3].value,1);assert.equal(normal.report.results[4].value,1);
 await run('oblique',i=>{part(i,'S1').emission.directionDeg=3;},'completed',0);
 await run('reverse',i=>{part(i,'S1').parameters.y=20;part(i,'D1').parameters.y=0;},'completed',0);
 await run('inside-source',i=>{part(i,'S1').parameters.x=10;},'completed',0);
 for(const [name,mutate,m1] of [
  ['first-miss',i=>{part(i,'M1').parameters.y=-60;},0],
  ['second-miss',i=>{part(i,'M2').parameters.x=100;},1]
 ]){const miss=await run(name,mutate,'completed',0);assert.equal(miss.report.results[0].value,2);
  assert.equal(miss.report.results[2].value,m1);assert.equal(miss.report.results[3].value,0);assert.equal(miss.report.results[4].value,0);
 }
 await run('matched-indices',i=>{Object.assign(part(i,'G1').parameters,{outsideIndex:1.5,partialReflection:true});},'completed',0);
 await run('no-detector',i=>{i.physical.components=i.physical.components.filter(c=>c.id!=='D1');i.requests=i.requests.filter(r=>r.componentId!=='D1');},'completed',0);
 const tir=await run('outside-tir',i=>{Object.assign(part(i,'G1').parameters,{insideIndex:1,outsideIndex:1.5});
  part(i,'S1').parameters.y=-40*Math.tan(50*Math.PI/180);part(i,'S1').emission.directionDeg=50;
  i.requests.push({id:'transmission',kind:'interface-transmission-angle',componentId:'G1'});
 },'completed',2);assert.equal(tir.report.results.at(-1).status,'unavailable');assert.equal(tir.report.results.at(-1).value,null);
 for(const [name,mutate] of [
  ['full-fresnel',i=>{part(i,'G1').parameters.partialReflection=true;}],
  ['two-detectors',i=>{i.physical.components.push({id:'D2',type:'ray-detector',parameters:{x:40,y:10,orientationDeg:90,length:40}});} ],
  ['trapped-loop',i=>{Object.assign(part(i,'M1').parameters,{orientationDeg:90,length:30});Object.assign(part(i,'M2').parameters,{x:-60,y:0,orientationDeg:90,length:30});}]
 ]){const out=await run(name,mutate,'incomplete',2);assert.ok(out.report.results.every(r=>r.status==='suppressed'&&r.value===null));}
 const corner=await run('reflected-corner',i=>{part(i,'M2').parameters.y=30;},'failed',2);
 assert.ok(corner.report.results.every(r=>r.status==='suppressed'&&r.value===null));
 await run('inside-second-mirror',i=>{part(i,'M2').parameters.x=10;},'not-run',2);
 await run('crossed-mirrors',i=>{part(i,'M2').parameters.y=0;},'not-run',2);
 const missing=await run('missing-mirror-angle',i=>{delete part(i,'M2').parameters.orientationDeg;},'not-run',2);
 assert.equal(missing.report.preparation.status,'needs-information');
 await run('third-mirror',i=>{i.physical.components.push({...structuredClone(part(i,'M2')),id:'M3'});},'not-run',2);
 await run('invalid-index',i=>{part(i,'G1').parameters.insideIndex=0;},'not-run',1);
 const baseline=await parseQualifiedBundle(readFileSync(record.browserBundles.normal,'utf8')),before=structuredClone(baseline);
 const sweep=await runParameterSweep(baseline,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
  parameter:{id:'M2',section:'parameters',key:'x',unit:'mm'},values:[60,100,10],observables:fixture.requests},
  {execute:scene=>evaluateDocument(scene,core)});
 assert.equal(sweep.completedSamples,2);assert.equal(sweep.samples[2].status,'invalid-input');assert.deepEqual(baseline,before);
 writeEvidence(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n');record.sweep={samples:3,retainedInvalid:1};
 const removed=await prepareQualifiedStructure(baseline,{format:'opticsim-component-revision-v1',expectedSha256:baseline.sceneSha256,operations:[{op:'remove',id:'M2'}]});
 const one=await createQualifiedBundle(removed.document,removed.qualification,removed.observables);
 assert.equal(one.scene.schemaVersion,11);assert.equal(evaluateDocument(one.scene,core).summary.executionPassed,true);
 const restored=await prepareQualifiedStructure(one,{format:'opticsim-component-revision-v1',expectedSha256:one.sceneSha256,
  operations:[{op:'add',lengthUnit:'mm',component:{...structuredClone(part(fixture,'M2')),id:'M3'}}]});
 // Explicit new observation: the removed M2 request stays unbound, not renamed.
 const two=await createQualifiedBundle(restored.document,restored.qualification,[...restored.observables,{id:'mirror-3',kind:'mirror-reflections',componentId:'M3'}]);
 assert.equal(evaluateDocument(two.scene,core).summary.observations.reflectionsById.M3,1);
 for(const [name,bundle] of [['one-mirror',one],['new-mirror-id',two]]){
  const file=resolve(folder,name+'-qualified.json');writeEvidence(file,JSON.stringify(bundle,null,2)+'\n');record.browserBundles[name]=file;
 }
 record.status='passed';
} catch(error){record.status='failed';record.error=error.stack;throw error;}
finally{writeEvidence(output.report,JSON.stringify(record,null,2)+'\n');}
console.log('Two-mirror composition acceptance PASS: '+record.syntheticCases.length+' expected-outcome cases; 3 sweep samples; qualified one/two-mirror lineage.');
