// Synthetic, public JEE-style v23 LLM authoring → pinned native → portable
// qualified export. Not an original JEE J15/J16 solution or guessed image.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=resolve(root,'test-artifacts/llm-authoring/jee-circle-beam-v23');
if(existsSync(dir))throw Error('Never overwrite an earlier v23 public native evidence trial');
mkdirSync(dir,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const base=JSON.parse(readFileSync(resolve(root,'examples/jee-circle-beam-v23.json'),'utf8'));
const par=(r,id)=>r.physical.components.find(c=>c.id===id).parameters;
const report={format:'opticsim-jee-circle-beam-v23-public-acceptance-v1',status:'running',
 cases:[],sourceProblemsRead:0,sourceSolutionsRead:0,originalJEEQuestionSolved:false,
 externalModelCalls:0,independentlyExecutedPhysics:false};
async function run(name,modify=()=>{}){
 const req=structuredClone(base);req.physical.title='JEE circle Beam v23 · '+name;
 modify(req);
 const bytes=Buffer.from(JSON.stringify(req,null,2)+'\n');
 let nativeCalls=0;
 const completed=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(dir,name),
  execute:(doc,requests)=>{nativeCalls++;return evaluateDocument(doc,core,requests);}});
 const x=completed.report;
 assert.equal(x.dispatch.nativeCalls,nativeCalls);
 assert.equal(x.dispatch.repairs,0);
 assert.equal(x.dispatch.externalModelCalls,0);
 if(x.portable?.status==='created'){
  const packageData=await parseQualifiedBundle(readFileSync(resolve(dir,name,'qualified-scene.json'),'utf8'));
  assert.equal(packageData.scene.schemaVersion,23);
  assert.equal(packageData.scene.physics.model,'native-parallel-circle-tracing');
  assert.deepEqual(packageData.qualification.interpretation,req.interpretation);
  assert.equal(Object.hasOwn(packageData,'results'),false,
    'portable qualified scene must never embed stale native observations');
 }
 report.cases.push({name,inputSha256:x.inputSha256,native:x.native,
  preparation:x.preparation,results:x.results,portable:x.portable,
  exitCode:completed.exitCode});
 return {summary:x,exitCode:completed.exitCode};
}
const baseline=await run('native-forward');
assert.equal(baseline.exitCode,0);
assert.equal(baseline.summary.native.status,'completed');
assert.deepEqual([baseline.summary.results[0].value,baseline.summary.results[1].value,
 baseline.summary.results[4].value],[4,8,4]);
assert.equal(baseline.summary.results[5].value.length,4);
const reverse=await run('native-reverse',r=>{
 par(r,'B1').x=160;par(r,'B1').directionDeg=180;par(r,'D1').x=-260;
 r.interpretation.assumptions.push('Synthetic control reverses the entire propagation direction and detector side explicitly.');
});
assert.equal(reverse.exitCode,0);assert.equal(reverse.summary.native.status,'completed');
assert.deepEqual([reverse.summary.results[0].value,reverse.summary.results[1].value,
 reverse.summary.results[4].value],[4,8,4]);
const bubble=await run('lower-index-region',r=>{
 par(r,'G1').insideIndex=1;par(r,'G1').outsideIndex=1.5;
 r.interpretation.assumptions.push('Synthetic two-boundary bubble-like control uses explicit index 1 inside, 1.5 outside; no 3D apparent depth inferred.');
});
assert.equal(bubble.exitCode,0);assert.equal(bubble.summary.native.status,'completed');
assert.deepEqual([bubble.summary.results[0].value,bubble.summary.results[1].value,
 bubble.summary.results[4].value],[4,8,4]);
const radius=await run('smaller-radius',r=>{
 par(r,'G1').radius=80;
 r.interpretation.assumptions.push('Synthetic circle-radius sensitivity control chooses an explicit 80 mm radius.');
});
assert.equal(radius.exitCode,0);assert.equal(radius.summary.native.status,'completed');
assert.deepEqual([radius.summary.results[0].value,radius.summary.results[1].value,
 radius.summary.results[4].value],[4,8,4]);
const nearTangent=await run('refused-tangent',r=>par(r,'B1').y=90);
assert.notEqual(nearTangent.exitCode,0);
assert.equal(nearTangent.summary.native.status,'not-run');
assert.equal(nearTangent.summary.dispatch.nativeCalls,0);
const noIndex=await run('refused-unknown-index',r=>delete par(r,'G1').outsideIndex);
assert.notEqual(noIndex.exitCode,0);
assert.equal(noIndex.summary.native.status,'not-run');
assert.equal(noIndex.summary.dispatch.nativeCalls,0);
const fresnel=await run('refused-fresnel-on',r=>par(r,'G1').partialReflection=true);
assert.notEqual(fresnel.exitCode,0);
assert.equal(fresnel.summary.native.status,'not-run');
assert.equal(fresnel.summary.dispatch.nativeCalls,0);
const inside=await run('refused-inside-source',r=>par(r,'B1').x=0);
assert.notEqual(inside.exitCode,0);
assert.equal(inside.summary.native.status,'not-run');
assert.equal(inside.summary.dispatch.nativeCalls,0);
report.status='passed';report.counts={planned:8,attempted:8,
 actualNativeComplete:4,refusedBeforeNative:4};
writeFileSync(resolve(dir,'acceptance.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('JEE_CIRCLE_BEAM_PUBLIC_ACCEPTANCE '+JSON.stringify({
 status:'passed',cases:8,nativeComplete:4,refusedBeforeNative:4,
 pinnedPhyDemo:true,sourceSolutionsRead:0,externalModelCalls:0,
 originalQuestionSolved:false}));
