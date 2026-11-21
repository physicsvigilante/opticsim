// Public JSON -> versioned v27 -> real unchanged pinned PhyDemo -> qualified
// portable scene and genuine native interface/mirror/detector observations.
// No native object is added through a raw research bypass in this acceptance.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'test-artifacts/llm-authoring/native-two-plane-mirror-v27');
if(existsSync(out))throw Error('Do not overwrite prior v27 native public evidence');
mkdirSync(out,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const input=JSON.parse(readFileSync(resolve(root,'examples/native-parallel-two-plane-mirror-v27.json'),'utf8'));
const component=(r,id)=>r.physical.components.find(x=>x.id===id).parameters;
const report={
 format:'opticsim-native-two-plane-slab-mirror-public-acceptance-v1',
 pin:'811f508d2b070898c241a568b0c167dcb8645251',
 baseline:'4f81a1625cc45ce731d3ee0e286ff3173f72f4fe',
 cases:[],status:'running',sourceSolutionsRead:false,
 originalJeeQuestionSolved:false,nativeImageDetected:false,externalModelCalls:0
};
async function run(name,edit=()=>{}){
 const r=structuredClone(input);
 r.physical.title='Finite slab/mirror native Beam v27 · '+name;
 edit(r);
 let nativeCalls=0;
 const raw=Buffer.from(JSON.stringify(r,null,2)+'\n');
 const actual=await runProblemEvidence({inputBytes:raw,
  outputPath:resolve(out,name),execute:(doc,requests)=>{
   nativeCalls++;return evaluateDocument(doc,core,requests);
  }});
 const summary=actual.report;
 assert.equal(summary.dispatch.nativeCalls,nativeCalls);
 assert.equal(summary.dispatch.externalModelCalls,0);
 assert.equal(summary.dispatch.repairs,0);
 if(summary.portable?.status==='created'){
  const p=await parseQualifiedBundle(readFileSync(resolve(out,name,'qualified-scene.json'),'utf8'));
  assert.equal(p.scene.schemaVersion,27);
  assert.equal(p.scene.physics.model,'native-parallel-slab-mirror-tracing');
  assert.equal(p.scene.upstreamCommit,report.pin);
  assert.deepEqual(p.scene.physics.components.map(x=>x.type),
   ['parallel-beam','planar-interface','planar-interface','plane-mirror','ray-detector']);
  assert.deepEqual(p.qualification.interpretation,r.interpretation);
  assert.equal(Object.hasOwn(p,'results'),false);
 }
 report.cases.push({name,status:summary.native.status,nativeCalls,
  inputSha256:summary.inputSha256,exitCode:actual.exitCode,
  preparation:summary.preparation,portable:summary.portable,
  observables:summary.results});
 return actual;
}
const baseline=await run('baseline-separated-mirror');
assert.equal(baseline.exitCode,0);
assert.equal(baseline.report.native.status,'completed');
assert.deepEqual([0,1,3,4,5].map(i=>baseline.report.results[i].value),[8,16,16,8,16]);
assert.equal(baseline.report.results[6].value.length,16);
assert.ok(baseline.report.results.every(x=>x.status==='qualified'));
const half=await run('width20',r=>{
 component(r,'B1').width=20;
 r.interpretation.assumptions.push('Finite native Beam width explicitly narrowed to emit four true samples.');
});
assert.equal(half.exitCode,0);
assert.deepEqual([0,1,3,4,5].map(i=>half.report.results[i].value),[4,8,8,4,8]);
const refract=await run('slab-index-1point8',r=>{
 component(r,'I1').positiveIndex=1.8;
 component(r,'I2').negativeIndex=1.8;
 r.interpretation.assumptions.push('Two genuine refracting surface material parameters changed together, preserving one uniform slab.');
});
assert.equal(refract.exitCode,0);
assert.deepEqual([0,1,3,4,5].map(i=>refract.report.results[i].value),[8,16,16,8,16]);
const gap=await run('mirror-gap-40mm',r=>{
 component(r,'M1').x=100;
 r.interpretation.assumptions.push('Finite Mirror moved to a larger explicit 40mm third-medium gap.');
});
assert.equal(gap.exitCode,0);
assert.equal(gap.report.results[5].value,16);
const contact=await run('coincident-second-interface-refused',r=>component(r,'M1').x=60);
assert.notEqual(contact.exitCode,0);
assert.equal(contact.report.native.status,'not-run');
assert.equal(contact.report.dispatch.nativeCalls,0);
const close=await run('near-contact-refused',r=>component(r,'M1').x=60.005);
assert.notEqual(close.exitCode,0);assert.equal(close.report.dispatch.nativeCalls,0);
const fresnel=await run('fresnel-second-refused',r=>component(r,'I2').partialReflection=true);
assert.notEqual(fresnel.exitCode,0);assert.equal(fresnel.report.dispatch.nativeCalls,0);
const inconsistent=await run('wrong-third-medium-refused',r=>component(r,'I2').positiveIndex=1.2);
assert.notEqual(inconsistent.exitCode,0);assert.equal(inconsistent.report.dispatch.nativeCalls,0);
const sourceUnknown=await run('missing-exterior-index-refused',r=>delete component(r,'I1').negativeIndex);
assert.notEqual(sourceUnknown.exitCode,0);assert.equal(sourceUnknown.report.dispatch.nativeCalls,0);
report.status='passed';
report.counts={planned:9,attempted:9,realNativeCompleted:4,rejectedBeforeNative:5};
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('NATIVE_TWO_PLANE_SLAB_MIRROR_V27_PUBLIC '+JSON.stringify({
 status:'passed',actualCompleted:4,refusedBeforeNative:5,
 actualBaseline:{emitted:8,front:16,rear:16,mirror:8,detector:16},
 noDirectContactClaim:true,originalJeeQuestionSolved:false
}));
