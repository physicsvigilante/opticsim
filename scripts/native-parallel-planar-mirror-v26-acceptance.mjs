// End-to-end public v26 authoring and evidence: exact JSON -> canonical
// v26 -> pinned native PhyDemo -> opt-in observables -> qualified export.
// No custom ray router, source-based image, power or original JEE answer.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'test-artifacts/llm-authoring/native-parallel-planar-mirror-v26');
if(existsSync(out))throw Error('Refuse to overwrite prior v26 native authoring evidence');
mkdirSync(out,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/native-parallel-planar-mirror-v26.json'),'utf8'));
const part=(r,id)=>r.physical.components.find(c=>c.id===id).parameters;
const record={format:'opticsim-v26-native-beam-planar-mirror-public-acceptance-v1',
 sourceBase:'34a85e21985d13b4663473c20d7adc1d93fc4953',
 pinnedNative:'811f508d2b070898c241a568b0c167dcb8645251',
 status:'running',cases:[],originalSourceQuestionSolved:false,
 independentPhysicsReviewComplete:false,noRaySynthesis:true,externalModelCalls:0};
async function run(name,edit=()=>{}){
 const input=structuredClone(fixture);
 input.physical.title='Finite native Beam + planar mirror return · '+name;
 edit(input);
 const bytes=Buffer.from(JSON.stringify(input,null,2)+'\n');
 let actualNativeCalls=0;
 const response=await runProblemEvidence({inputBytes:bytes,
  outputPath:resolve(out,name),execute:(doc,requests)=>{
   actualNativeCalls++;return evaluateDocument(doc,core,requests);
  }});
 const report=response.report;
 assert.equal(report.dispatch.nativeCalls,actualNativeCalls);
 assert.equal(report.dispatch.externalModelCalls,0);
 assert.equal(report.dispatch.repairs,0);
 if(report.portable?.status==='created'){
  const bundle=await parseQualifiedBundle(readFileSync(resolve(out,name,'qualified-scene.json'),'utf8'));
  assert.equal(bundle.scene.schemaVersion,26);
  assert.equal(bundle.scene.physics.model,'native-parallel-planar-mirror-tracing');
  assert.equal(bundle.scene.upstreamCommit,record.pinnedNative);
  assert.equal(bundle.scene.physics.components.filter(c=>c.type==='parallel-beam').length,1);
  assert.equal(bundle.scene.physics.components.filter(c=>c.type==='plane-mirror').length,1);
  assert.equal(bundle.scene.physics.components.filter(c=>c.type==='planar-interface').length,1);
  assert.deepEqual(bundle.qualification.interpretation,input.interpretation);
  assert.equal(Object.hasOwn(bundle,'results'),false);
 }
 record.cases.push({name,inputSha256:report.inputSha256,status:report.native.status,
  exitCode:response.exitCode,dispatch:report.dispatch,portable:report.portable,
  preparation:report.preparation,observables:report.results});
 return {report,exitCode:response.exitCode};
}
const good=await run('baseline');
assert.equal(good.exitCode,0);
assert.equal(good.report.native.status,'completed');
assert.deepEqual(good.report.results.map(x=>x.value),[8,16,
 good.report.results[2].value,8,16,good.report.results[5].value]);
assert.equal(good.report.results[5].value.length,16);
assert.ok(good.report.results.every(x=>x.status==='qualified'));
const half=await run('beam-width-20',r=>{
 part(r,'B1').width=20;
 r.interpretation.assumptions.push('Synthetic source width reduced; native Beam must really emit four parallel samples.');
});
assert.equal(half.exitCode,0);
assert.deepEqual([0,1,3,4].map(i=>half.report.results[i].value),[4,8,4,8]);
const material=await run('index-1point8',r=>{
 part(r,'I1').positiveIndex=1.8;
 r.interpretation.assumptions.push('An explicitly changed second-medium index retraces genuine native refractions.');
});
assert.equal(material.exitCode,0);assert.equal(material.report.results[3].value,8);
const excluded=await run('clipped-mirror-refused',r=>part(r,'M1').length=72);
assert.notEqual(excluded.exitCode,0);
assert.equal(excluded.report.dispatch.nativeCalls,0);
assert.equal(excluded.report.native.status,'not-run');
const fresnel=await run('fresnel-on-refused',r=>part(r,'I1').partialReflection=true);
assert.notEqual(fresnel.exitCode,0);
assert.equal(fresnel.report.dispatch.nativeCalls,0);
const missing=await run('missing-exterior-index',r=>delete part(r,'I1').negativeIndex);
assert.notEqual(missing.exitCode,0);
assert.equal(missing.report.dispatch.nativeCalls,0);
const tilt=await run('mirror-tilt-refused',r=>part(r,'M1').orientationDeg=60);
assert.notEqual(tilt.exitCode,0);assert.equal(tilt.report.dispatch.nativeCalls,0);
record.status='passed';record.counts={planned:7,attempted:7,nativeComplete:3,refusedBeforeNative:4};
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log('NATIVE_BEAM_PLANAR_MIRROR_V26_PUBLIC '+JSON.stringify({
 status:'passed',nativeComplete:3,refusedBeforeNative:4,
 emitted:8,interfaceHits:16,mirrorReflections:8,detectorCrossings:16,
 originalJeeQuestionSolved:false,pinnedNative:true,fullFresnelCertified:false
}));
