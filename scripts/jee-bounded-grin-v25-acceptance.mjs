// JEE-adjacent v25 bounded native GRIN public-acceptance candidate.
// All physical setups are synthetic; nothing is inferred from frozen J09.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=resolve(root,'test-artifacts/llm-authoring/jee-bounded-grin-v25');
if(existsSync(folder))throw Error('Never overwrite v25 GRIN native evidence');
mkdirSync(folder,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixed=JSON.parse(readFileSync(resolve(root,'examples/jee-bounded-grin-v25.json'),'utf8'));
const param=(req,id)=>req.physical.components.find(c=>c.id===id).parameters;
const report={format:'opticsim-jee-bounded-grin-v25-public-acceptance-v1',
 status:'running',cases:[],originalJeeQuestionSolved:false,sourceProblemsRead:0,
 sourceSolutionsRead:0,externalModelCalls:0,independentPhysicsReview:false,
 nativeImageDetected:false,globalEulerErrorBoundCertified:false};
async function run(name,change=()=>{}){
 const req=structuredClone(fixed);
 req.physical.title+=' / '+name;
 change(req);
 const raw=Buffer.from(JSON.stringify(req,null,2)+'\n','utf8');
 let nativeCalls=0;
 const outcome=await runProblemEvidence({inputBytes:raw,outputPath:resolve(folder,name),
  execute:(document,requests)=>{nativeCalls++;return evaluateDocument(document,core,requests);}});
 const s=outcome.report;
 assert.equal(s.dispatch.nativeCalls,nativeCalls);
 assert.equal(s.dispatch.externalModelCalls,0);
 assert.equal(s.dispatch.repairs,0);
 if(s.portable?.status==='created'){
  const bundle=await parseQualifiedBundle(readFileSync(resolve(folder,name,'qualified-scene.json'),'utf8'));
  assert.equal(bundle.scene.schemaVersion,25);
  assert.equal(bundle.scene.physics.model,'native-bounded-grin-tracing');
  assert.deepEqual(bundle.qualification.interpretation,req.interpretation);
  assert.equal(Object.hasOwn(bundle,'results'),false,'Old native evidence is not portable');
 }
 report.cases.push({name,originalInputSha256:s.inputSha256,exitCode:outcome.exitCode,
  native:s.native,dispatch:s.dispatch,results:s.results,portable:s.portable});
 return {s,code:outcome.exitCode};
}
const baseline=await run('baseline');
assert.equal(baseline.code,0,JSON.stringify(baseline.s.issues));
assert.equal(baseline.s.native.status,'completed',JSON.stringify(baseline.s.native));
assert.equal(baseline.s.results.find(x=>x.id==='emitted').value,1);
assert.equal(baseline.s.results.find(x=>x.id==='crossings').value,1);
assert.equal(baseline.s.results.find(x=>x.id==='hit-events').value.length,1);
const initialHit=baseline.s.results.find(x=>x.id==='hit-events').value;
for(const [label,change] of [
 ['source-shift',r=>param(r,'S1').x=.2],
 ['world-translation',r=>{
  param(r,'S1').x+=100;param(r,'S1').y+=50;
  param(r,'G1').leftX+=100;param(r,'G1').axisY+=50;
  param(r,'D1').x+=100;param(r,'D1').y+=50;
 }],
 ['narrower-glass',r=>{param(r,'G1').spanX=.8;param(r,'D1').x=1; }],
 ['shallower-edge',r=>{param(r,'G1').upHeight=.75;param(r,'G1').downHeight=.3;}]
]){
 const out=await run(label,change);
 assert.equal(out.code,0,label);
 assert.equal(out.s.native.status,'completed',label);
 assert.equal(out.s.results.find(x=>x.id==='emitted').value,1,label);
 assert.equal(out.s.results.find(x=>x.id==='crossings').value,1,label);
 assert.equal(out.s.results.find(x=>x.id==='hit-events').value.length,1,label);
 if(label==='source-shift')
  assert.notDeepEqual(out.s.results.find(x=>x.id==='hit-events').value,initialHit,
   'Changed physical source x must produce different native hit');
}
for(const [name,change] of [
 ['missing-index-fact',r=>delete param(r,'G1').outsideIndex],
 ['forbidden-arbitrary-equation',r=>{param(r,'G1').refIndexFn='sqrt(y)';}],
 ['out-of-domain-index',r=>{param(r,'G1').indexSquaredAtAxis=1;}],
 ['wrong-gradient-scale',r=>{param(r,'G1').gradientLength=2;}],
 ['wrong-fresnel',r=>{param(r,'G1').partialReflection=true;}],
 ['off-axis-launch',r=>{param(r,'S1').y=.02;}],
 ['grazing-launch',r=>{r.physical.components.find(c=>c.id==='S1').emission.directionDeg=90;}],
 ['bad-detector',r=>{param(r,'D1').x=1.05;}],
 ['foreign-budget',r=>{r.physical.runPolicy='native-deep-v17';}],
 ['extra-object',r=>{r.physical.components.push({
   id:'M1',type:'plane-mirror',parameters:{x:5,y:0,orientationDeg:90,length:5}
 });}]
]){
 const out=await run(name,change);
 assert.notEqual(out.code,0,name);
 assert.equal(out.s.native.status,'not-run',name+' must refuse before native execution');
 assert.equal(out.s.dispatch.nativeCalls,0,name);
}
report.status='passed';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('JEE_BOUNDED_GRIN_V25_PUBLIC_ACCEPTANCE '+JSON.stringify({
 status:'passed',cases:15,nativeComplete:5,refusedBeforeNative:10,
 sourceSolutionsRead:0,independentPhysicsReview:false,
 nativeImageDetected:false,globalEulerErrorBoundCertified:false}));
