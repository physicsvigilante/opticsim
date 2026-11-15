// Normal public authoring, qualification and native execution. No test-only
// assembly bypass, native replacement, expected-result injection or solver.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync,lstatSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle,createQualifiedBundle} from '../src/qualification.js';
import {prepareQualifiedStructure} from '../src/qualified-structure.js';
import {evaluateObservables} from '../src/observables.js';
import {inspectExternalSurfaceScene} from '../test/helpers/external-surface-inspection.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),parent=resolve(root,'test-artifacts/llm-authoring');
const folder=resolve(root,process.argv[2]||'test-artifacts/llm-authoring/external-blocker-composition');
if(!relative(parent,folder)||relative(parent,folder).startsWith('..'))throw Error('Use a fresh subdirectory under test-artifacts/llm-authoring');
for(let p=folder;;p=dirname(p)){
 if(existsSync(p)&&lstatSync(p).isSymbolicLink())throw Error('Evidence path must not traverse a symlink');
 if(p===root.replace(/[\\/]$/,''))break;
 if(p===dirname(p))throw Error('Evidence path escaped workspace');
}
if(existsSync(folder))throw Error('Evidence directory already exists; do not overwrite it');
mkdirSync(folder,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixtures=['external-blocker-composition','external-blocker-return'].map(name=>JSON.parse(readFileSync(resolve(root,'examples/'+name+'.json'))));
const part=(i,id)=>i.physical.components.find(c=>c.id===id),byKind=(r,kind)=>r.report.results.find(v=>v.kind===kind);
const record={format:'opticsim-external-blocker-acceptance-v1',status:'pending',syntheticCases:[],browserBundles:{},
 sourceImagesRead:0,solutionsRead:false,modelCalls:0,repairs:0};
const save=(name,data)=>writeFileSync(resolve(folder,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
async function run(name,which,mutate,expectedStatus,expectedExit){
 const i=structuredClone(fixtures[which]);i.physical.title='Synthetic external surface: '+name;mutate(i);
 if(i.physical.components.some(c=>c.parameters.partialReflection===true))i.interpretation.assumptions.push(
  'This explicitly requested variant enables Fresnel reflections; incomplete branch evidence is not accepted.');
 let calls=0;const result=await runProblemEvidence({inputBytes:Buffer.from(JSON.stringify(i,null,2)+'\n'),outputPath:resolve(folder,name),
  execute:d=>{calls++;return evaluateDocument(d,core);}});
 const entry={name,expectedStatus,expectedExit,native:result.report.native,results:result.report.results,
  inputSha256:result.report.inputSha256,exitCode:result.exitCode};record.syntheticCases.push(entry);
 assert.equal(result.report.native.status,expectedStatus,name+' native status');assert.equal(result.exitCode,expectedExit,name+' exit');
 assert.equal(calls,result.report.dispatch.nativeCalls);assert.equal(result.report.dispatch.repairs,0);assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const file=resolve(folder,name,'qualified-scene.json'),b=await parseQualifiedBundle(readFileSync(file,'utf8'));
  assert.equal(b.scene.schemaVersion,13);assert.deepEqual(b.qualification.interpretation,i.interpretation);
  record.browserBundles[name]=file;
  if(expectedStatus==='completed'){
   const checked=inspectExternalSurfaceScene(b.scene);assert.equal(checked.status,'completed');
   save(name+'/physical-checks.json',checked);entry.independentlyExpressedEncounterChecks=checked.checked;
  }
 }
 return result;
}
try{
 for(const [which,prefix,expectedGlass] of [[0,'prism',2],[1,'return',4]]){
  const normal=await run(prefix+'-blocked',which,()=>{},'completed',0);
  assert.equal(byKind(normal,'interface-interactions').value,expectedGlass);
  assert.equal(byKind(normal,'blocker-absorptions').value,1);assert.equal(byKind(normal,'detector-crossings').value,0);
  const miss=await run(prefix+'-miss',which,i=>Object.assign(part(i,'B1').parameters,{y:100,length:20}),'completed',0);
  assert.equal(byKind(miss,'blocker-absorptions').value,0);assert.equal(byKind(miss,'detector-crossings').value,1);
 }
 await run('inside-source',0,i=>{Object.assign(part(i,'S1').parameters,{x:10,y:8});part(i,'S1').emission.directionDeg=0;},'completed',0);
 const first=await run('blocker-first',1,i=>{part(i,'S1').emission.directionDeg=180;},'completed',0);
 assert.equal(byKind(first,'interface-interactions').value,0);assert.equal(byKind(first,'blocker-absorptions').value,1);
 await run('matched-index',1,i=>{Object.assign(part(i,'G1').parameters,{outsideIndex:1.5,partialReflection:true});},'completed',0);
 const tir=await run('outside-tir',1,i=>{
  Object.assign(part(i,'G1').parameters,{insideIndex:1,outsideIndex:1.5});part(i,'S1').parameters.y=-40*Math.tan(50*Math.PI/180);
  part(i,'S1').emission.directionDeg=50;part(i,'B1').parameters.y=100;
  i.requests.push({id:'transmission',kind:'interface-transmission-angle',componentId:'G1'});
 },'completed',2);assert.equal(tir.report.results.at(-1).status,'unavailable');assert.equal(tir.report.results.at(-1).value,null);
 const addDetector=i=>{i.physical.components.push({id:'D2',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:30}});};
 await run('exactly-eight',1,addDetector,'completed',0);
 for(const [name,mutate] of [['ninth-interaction',i=>{addDetector(i);part(i,'D1').parameters.x=-50;}],
  ['full-fresnel',i=>{part(i,'G1').parameters.partialReflection=true;}]]){
  const r=await run(name,1,mutate,'incomplete',2);assert.ok(r.report.results.every(v=>v.status==='suppressed'&&v.value===null));
 }
 for(const [name,which,mutate] of [
  ['inside-blocker',0,i=>{part(i,'B1').parameters.x=5;}],
  ['unproved-long-segment',0,i=>{part(i,'B1').parameters.length=160;}],
  ['near-face',1,i=>{Object.assign(part(i,'B1').parameters,{x:20.009,y:0,orientationDeg:90,length:20});}],
  ['shared-detector',1,i=>{Object.assign(part(i,'B1').parameters,part(i,'D1').parameters);}],
  ['source-on-support',1,i=>{part(i,'S1').parameters.x=-75;}],
  ['second-blocker',1,i=>{i.physical.components.push({...structuredClone(part(i,'B1')),id:'B2'});}],
  ['second-mirror',1,i=>{i.physical.components.push({...structuredClone(part(i,'M1')),id:'M2'});}]
 ])await run(name,which,mutate,'not-run',2);
 const missing=await run('missing-orientation',0,i=>{delete part(i,'B1').parameters.orientationDeg;},'not-run',2);
 assert.equal(missing.report.preparation.status,'needs-information');
 const b=await parseQualifiedBundle(readFileSync(record.browserBundles['prism-blocked'],'utf8')),before=structuredClone(b);
 const patch=operations=>({format:'opticsim-component-revision-v1',expectedSha256:b.sceneSha256,operations});
 const removed=await prepareQualifiedStructure(b,patch([{op:'remove',id:'B1'}]));
 const clear=await createQualifiedBundle(removed.document,removed.qualification,removed.observables);
 save('removed-blocker.qualified.json',clear);record.browserBundles.removed=resolve(folder,'removed-blocker.qualified.json');
 const clearRun=evaluateDocument(clear.scene,core);assert.equal(clearRun.summary.executionPassed,true);
 const values=await evaluateObservables(clear.scene,clear.observables,clearRun.summary);
 assert.equal(values.results.find(r=>r.kind==='blocker-absorptions').status,'unavailable');
 assert.equal(values.results.find(r=>r.kind==='detector-crossings').value,1);
 const replacement={...structuredClone(fixtures[0].physical.components.find(c=>c.id==='B1')),id:'Bnew'};
 const changed=await prepareQualifiedStructure(clear,{format:patch([]).format,expectedSha256:clear.sceneSha256,
  operations:[{op:'add',lengthUnit:'mm',component:replacement}]});
 const saved=await createQualifiedBundle(changed.document,changed.qualification,[...changed.observables,{id:'new-absorption',kind:'blocker-absorptions',componentId:'Bnew'}]);
 save('replacement-blocker.qualified.json',saved);record.browserBundles.replacement=resolve(folder,'replacement-blocker.qualified.json');
 const result=await evaluateObservables(saved.scene,saved.observables,evaluateDocument(saved.scene,core).summary);
 assert.equal(result.results.find(r=>r.componentId==='B1').status,'unavailable');assert.equal(result.results.at(-1).value,1);assert.deepEqual(b,before);
 save('structural-evidence.json',{clear:values,replacement:result,baselineUnchanged:true});
 record.structuralBranches={removed:'completed; removed observation unavailable',replacement:'completed; new ID separately observed'};
 record.status='passed';
}finally{save('acceptance.json',record);}
console.log('External opaque surfaces: '+record.syntheticCases.length+' cases matched their expected outcomes; two qualified structural branches. Evidence: '+folder);
