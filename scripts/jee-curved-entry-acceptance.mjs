// Public JEE-v24 source -> canonical -> genuine native PhyDemo -> bound readings.
// These are deliberately authored synthetic controls, not original J15 success.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=resolve(root,'test-artifacts/llm-authoring/jee-curved-entry-v24');
if(existsSync(folder))throw Error('Never overwrite genuine native v24 authoring evidence');
mkdirSync(folder,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixed=JSON.parse(readFileSync(resolve(root,'examples/jee-curved-entry-v24.json'),'utf8'));
const par=(r,id)=>r.physical.components.find(c=>c.id===id).parameters;
const report={format:'opticsim-jee-curved-entry-v24-public-acceptance-v1',status:'running',
 cases:[],originalQuestionSolved:false,sourceProblemsRead:0,sourceSolutionsRead:0,
 externalModelCalls:0,independentPhysicsReview:false,nativeImageDetected:false};
async function run(name,modify=()=>{}){
 const req=structuredClone(fixed);
 req.physical.title+=' · '+name;modify(req);
 const inputBytes=Buffer.from(JSON.stringify(req,null,2)+'\n');
 let calls=0;
 const r=await runProblemEvidence({inputBytes,outputPath:resolve(folder,name),
   execute:(d,requests)=>{calls++;return evaluateDocument(d,core,requests);}});
 const s=r.report;
 assert.equal(s.dispatch.nativeCalls,calls);
 assert.equal(s.dispatch.repairs,0);
 assert.equal(s.dispatch.externalModelCalls,0);
 if(s.portable?.status==='created'){
  const b=await parseQualifiedBundle(readFileSync(resolve(folder,name,'qualified-scene.json'),'utf8'));
  assert.equal(b.scene.schemaVersion,24);
  assert.equal(b.scene.physics.model,'native-curved-entry-observation-tracing');
  assert.deepEqual(b.qualification.interpretation,req.interpretation);
  assert.equal(Object.hasOwn(b,'results'),false,'Portable scene cannot embed past native results');
 }
 report.cases.push({name,inputSha256:s.inputSha256,exitCode:r.exitCode,
  native:s.native,readings:s.results,dispatch:s.dispatch,portable:s.portable});
 return {summary:s,exitCode:r.exitCode};
}
const baseline=await run('baseline');
assert.equal(baseline.exitCode,0);
assert.equal(baseline.summary.native.status,'completed');
const by=id=>baseline.summary.results.find(r=>r.id===id);
assert.equal(by('emitted').value,1);
assert.equal(by('interfaces').value,1);
assert.equal(by('faces').value['face-arc'].interactions,1);
assert.equal(by('faces').value['face-flat'].interactions,0);
assert.equal(by('absorptions').value,1);
assert.equal(by('near-count').value,1);
assert.equal(by('far-count').value,1);
assert.equal(by('near-hits').value.length,1);
assert.equal(by('far-hits').value.length,1);
assert.equal(by('first').value.from,'outside');
assert.equal(by('first').value.outcome,'transmission');
for(const id of ['left-negative-height','translated','rescaled']){
 const result=await run(id,r=>{
  if(id==='left-negative-height')par(r,'S1').y=-1;
  if(id==='translated')for(const c of r.physical.components){
   c.parameters.x+=120;
   if('y' in c.parameters)c.parameters.y+=75;
  }
  if(id==='rescaled')for(const c of r.physical.components)
   for(const k of ['x','y','radius','length'])if(Object.hasOwn(c.parameters,k))
    c.parameters[k]*=1.2;
  r.interpretation.assumptions.push('This is a separately declared synthetic transform, not an additional JEE source fact.');
 });
 assert.equal(result.exitCode,0,id);
 assert.equal(result.summary.native.status,'completed',id);
 assert.equal(result.summary.results.find(r=>r.id==='interfaces').value,1);
 assert.equal(result.summary.results.find(r=>r.id==='absorptions').value,1);
}
for(const [id,modify] of [
 ['missing-exterior',r=>delete par(r,'G1').outsideIndex],
 ['missing-absorber',r=>r.physical.components=r.physical.components.filter(c=>c.id!=='A1')],
 ['crossed-internal-surfaces',r=>par(r,'A1').x=60],
 ['incorrect-illumination',r=>r.physical.components.find(c=>c.id==='S1').emission.directionDeg=0],
 ['forbidden-fresnel-branching',r=>par(r,'G1').partialReflection=true],
 ['detector-outside-glass',r=>par(r,'D1').x=110],
 ['second-dielectric',r=>r.physical.components.push({...r.physical.components.find(c=>c.id==='G1'),id:'G2'})]
]){
 const r=await run(id,modify);
 assert.equal(r.summary.native.status,'not-run',id);
 assert.equal(r.summary.dispatch.nativeCalls,0,id);
 assert.notEqual(r.exitCode,0,id);
}
report.status='passed';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('JEE_CURVED_ENTRY_PUBLIC_ACCEPTANCE '+JSON.stringify({
 status:'passed',cases:11,nativeComplete:4,refusedBeforeNative:7,
 pinnedNative:true,flatBoundaryRetained:true,internalAbsorption:true,
 sourceSolutionsRead:0,independentPhysicsReview:false,originalQuestionSolved:false,
 nativeImageDetected:false}));
