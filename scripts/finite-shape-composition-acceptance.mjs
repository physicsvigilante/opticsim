// Synthetic end-to-end controls through the existing qualified/native pipeline.
// Rejected and incomplete outcomes are retained, never counted as complete rays.
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
import {evaluateObservables} from '../src/observables.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.argv.length>3)throw Error('Usage: node scripts/finite-shape-composition-acceptance.mjs [fresh-evidence-directory]');
const output=reserveAuthoringOutput(process.argv[2]||'test-artifacts/llm-authoring/finite-shape-composition',root);
const folder=output.directory,core=createRequire(import.meta.url)('../dist/test-core.cjs');
const raw=readFileSync(resolve(root,'examples/prism-mirror-composition.json')),fixture=JSON.parse(raw);
const c=(i,id)=>i.physical.components.find(c=>c.id===id),p=(i,id)=>c(i,id).parameters;
const detector={id:'D2',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:60}};
writeEvidence(output.input,raw);
const record={format:'opticsim-finite-shape-composition-acceptance-v1',status:'pending',syntheticCases:[],browserBundles:{},
 sourceImagesRead:0,solutionsRead:false,externalModelCalls:0,repairs:0};
async function run(name,mutate,status,exit){
 const input=structuredClone(fixture);input.physical.title='Synthetic prism composition: '+name;mutate(input);
 if(p(input,'P1').partialReflection)input.interpretation.assumptions[2]='partialReflection=true requests native Fresnel branches; truncated execution remains incomplete.';
 const result=await runProblemEvidence({inputBytes:Buffer.from(JSON.stringify(input,null,2)+'\n'),outputPath:resolve(folder,name),execute:d=>evaluateDocument(d,core)});
 record.syntheticCases.push({name,native:result.report.native,preparation:result.report.preparation,results:result.report.results,
  inputSha256:result.report.inputSha256,exitCode:result.exitCode});
 assert.equal(result.report.native.status,status,name);assert.equal(result.exitCode,exit,name);
 assert.equal(result.report.dispatch.repairs,0);assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const file=resolve(folder,name,'qualified-scene.json'),b=await parseQualifiedBundle(readFileSync(file,'utf8'));
  assert.equal(b.scene.schemaVersion,12);assert.deepEqual(b.qualification.interpretation,input.interpretation);record.browserBundles[name]=file;
 }return result;
}
try{
 const normal=await run('normal',()=>{},'completed',0);
 assert.equal(normal.report.results[0].value,4);assert.equal(normal.report.results[2].value,1);assert.equal(normal.report.results[3].value,1);
 await run('oblique',i=>c(i,'S1').emission.directionDeg=2,'completed',0);
 const miss=await run('mirror-miss',i=>p(i,'M1').y=100,'completed',0);
 assert.equal(miss.report.results[0].value,2);assert.equal(miss.report.results[2].value,0);assert.equal(miss.report.results[3].value,0);
 await run('glass-miss',i=>c(i,'S1').emission.directionDeg=180,'completed',0);
 const inside=await run('inside-source',i=>p(i,'S1').x=5,'completed',0);assert.equal(inside.report.results[0].value,3);
 await run('reverse',i=>{p(i,'S1').y=-10;p(i,'D1').y=10;},'completed',0);
 const two=await run('two-mirrors',i=>{i.physical.components.push({id:'M2',type:'plane-mirror',parameters:{x:-60,y:-8,orientationDeg:45,length:10}});
  i.requests.push({id:'second-mirror',kind:'mirror-reflections',componentId:'M2'});},'completed',0);assert.equal(two.report.results.at(-1).value,1);
 await run('matched-indices',i=>{Object.assign(p(i,'P1'),{outsideIndex:1.5,partialReflection:true});},'completed',0);
 const tir=await run('outside-tir',i=>{Object.assign(p(i,'P1'),{insideIndex:1,outsideIndex:1.5});
  p(i,'S1').y=10-40*Math.tan(50*Math.PI/180);c(i,'S1').emission.directionDeg=50;
  i.requests.push({id:'transmission',kind:'interface-transmission-angle',componentId:'P1'});},'completed',2);
 assert.equal(tir.report.results.at(-1).status,'unavailable');assert.equal(tir.report.results.at(-1).value,null);
 await run('internal-tir',i=>{p(i,'P1').x3=100;p(i,'M1').x=200;},'completed',0);
 await run('eight-interactions',i=>i.physical.components.push(structuredClone(detector)),'completed',0);
 for(const [name,mutate] of [['full-fresnel',i=>p(i,'P1').partialReflection=true],
  ['nine-interactions',i=>{i.physical.components.push(structuredClone(detector));p(i,'D1').y=0;p(i,'D1').length=60;}]]){
  const out=await run(name,mutate,'incomplete',2);assert.ok(out.report.results.every(r=>r.status==='suppressed'&&r.value===null));
 }
 const slope=Math.tan(Math.atan2(2,5)-Math.asin(1.5*2/Math.sqrt(29)));
 const corner=await run('reflected-corner',i=>p(i,'M1').x=(36-10/slope)/2,'failed',2);
 assert.ok(corner.report.results.every(r=>r.status==='suppressed'&&r.value===null));
 await run('inside-mirror',i=>p(i,'M1').x=5,'not-run',2);
 await run('degenerate-prism',i=>p(i,'P1').x3=0,'not-run',2);
 const quadrilateral={id:'G1',type:'polygon-dielectric',parameters:{x1:0,y1:-50,x2:0,y2:50,x3:20,y3:50,x4:20,y4:-50,insideIndex:1.5,outsideIndex:1,partialReflection:false}};
 await run('second-region',i=>i.physical.components.push(structuredClone(quadrilateral)),'not-run',2);
 const missing=await run('missing-mirror-angle',i=>{delete p(i,'M1').orientationDeg;},'not-run',2);
 assert.equal(missing.report.preparation.status,'needs-information');
 await run('missing-outside-index',i=>{delete p(i,'P1').outsideIndex;},'not-run',2);
 await run('invalid-index',i=>p(i,'P1').insideIndex=0,'not-run',1);
 const baseline=await parseQualifiedBundle(readFileSync(record.browserBundles.normal,'utf8')),before=structuredClone(baseline);
 const sweep=await runParameterSweep(baseline,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
  parameter:{id:'M1',section:'parameters',key:'x',unit:'mm'},values:[60,100,5],observables:fixture.requests},{execute:d=>evaluateDocument(d,core)});
 assert.equal(sweep.completedSamples,2);assert.equal(sweep.samples[2].status,'invalid-input');assert.deepEqual(baseline,before);
 writeEvidence(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n');record.sweep={samples:3,retainedInvalid:1};
 const replaced=await prepareQualifiedStructure(baseline,{format:'opticsim-component-revision-v1',expectedSha256:baseline.sceneSha256,
  operations:[{op:'remove',id:'P1'},{op:'add',lengthUnit:'mm',component:quadrilateral}]});
 const newBundle=await createQualifiedBundle(replaced.document,replaced.qualification,[...replaced.observables,
  {id:'quadrilateral',kind:'interface-interactions',componentId:'G1'},{id:'quad-faces',kind:'interface-face-events',componentId:'G1'}]);
 const execution=evaluateDocument(newBundle.scene,core),results=await evaluateObservables(newBundle.scene,newBundle.observables,execution.summary);
 assert.equal(newBundle.scene.schemaVersion,12);assert.equal(execution.summary.executionPassed,true);
 assert.equal(results.results[0].status,'unavailable');assert.equal(results.results.at(-2).value,4);
 const file=resolve(folder,'quadrilateral-branch-qualified.json');writeEvidence(file,JSON.stringify(newBundle,null,2)+'\n');
 await parseQualifiedBundle(readFileSync(file,'utf8'));record.browserBundles['quadrilateral-branch']=file;
 record.shapeBranch={schemaVersion:12,originalTarget:'unavailable',newRegionInteractions:4};record.status='passed';
}catch(error){record.status='failed';record.error=error.stack;throw error;}
finally{writeEvidence(output.report,JSON.stringify(record,null,2)+'\n');}
console.log('Finite-shape composition acceptance PASS: '+record.syntheticCases.length+' expected-outcome cases, 3 sweep samples and qualified shape replacement.');
