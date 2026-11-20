import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {analyzeTwoBranchPrismInverse,twoBranchPrismInverseCapabilities,
 TWO_BRANCH_PRISM_QUERY_FORMAT,TwoBranchPrismInverseError}
 from '../src/prism-two-branch-inverse.js';
import {runPrismTwoBranchInverseEvidence}
 from '../scripts/prism-two-branch-inverse-query.mjs';

const example=JSON.parse(readFileSync(new URL('../examples/jee-j14-prism-two-branch-inverse-v1.json',import.meta.url),'utf8'));
const frozen=JSON.parse(readFileSync(new URL('../evaluation/jee-j14-prism-two-branch-inverse-v1/frozen-protocol.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(example);
const close=(a,b,e=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=e,
 String(a)+' != '+String(b)+' tolerance '+String(e));
const failure=(code)=>e=>e instanceof TwoBranchPrismInverseError&&e.code===code;
const rad=d=>d*Math.PI/180;
const deg=r=>r*180/Math.PI;

test('J14 frozen source and model protocol are not changed by implementation',()=>{
 assert.equal(frozen.status,'frozen-before-model-or-tests');
 assert.equal(frozen.productionBaseline,'bcf0151c004c94e179adb5ccc47e8d5f9851f23f');
 assert.equal(frozen.source.case,'J14');
 assert.equal(frozen.source.originalProblemPath,'08_Ray_Optics_Explanations/05_Prism/Problems/015.png');
 assert.equal(frozen.source.solutionsRead,false);
 assert.equal(frozen.source.sourceArchiveSha256,'03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939');
 assert.equal(frozen.fixedQuery.format,TWO_BRANCH_PRISM_QUERY_FORMAT);
 assert.deepEqual(example,frozen.fixedQuery);
 assert.deepEqual(frozen.expectedFirstOrder,{
  relativeIndex:2,apexAngleDeg:1,returnedFirstOrderDeg:4,
  transmittedFirstOrderDeg:1,absoluteInsideIndexIfExteriorOne:2,
  originalExteriorIndexKnown:false,nativeStatus:'not-run'
 });
 assert.equal(frozen.proposedQualification.maxExactVsFirstOrderResidualDeg,.05);
});
test('J14 1 degree forward and 4 degree return give A=1 and relative index=2 without assuming air',()=>{
 const input=copy(),prior=structuredClone(input);
 const actual=analyzeTwoBranchPrismInverse(input);
 assert.deepEqual(input,prior);
 assert.equal(actual.status,'conditional');assert.equal(actual.reasonCode,null);
 close(actual.value.apexAngleDeg,1);close(actual.value.relativeIndex,2);
 close(actual.value.firstOrderPredictedTransmittedDeg,1);
 close(actual.value.firstOrderPredictedReturnedDeg,4);
 assert.equal(actual.value.insideIndex,null);
 assert.equal(actual.value.outsideIndex,null);
 assert.equal(actual.value.absoluteInsideIndexAvailable,false);
 assert.equal(actual.native.status,'not-run');
 assert.equal(actual.native.observations,null);
 assert.equal(actual.native.branchCompletenessCertified,false);
 assert.equal(actual.value.nativeTwoBranchVerified,false);
 assert.equal(actual.value.fullPhysicalQuestionSolved,false);
 const trig=actual.value.exactSnellForwardWitness;
 close(trig.predictedTransmittedDeviationDeg,deg(Math.asin(2*Math.sin(rad(1))))-1,1e-12);
 close(trig.predictedReturnedDeviationDeg,deg(Math.asin(2*Math.sin(rad(2)))),1e-12);
 assert.ok(trig.maximumAbsoluteResidualDeg>0&&trig.maximumAbsoluteResidualDeg<.003);
 assert.equal(trig.witnessOnlyNotNativeOrExactInverse,true);
});
test('absolute index requires explicitly supplied exterior material; out-of-bounds interior stays unavailable',()=>{
 const unknown=analyzeTwoBranchPrismInverse(copy());
 assert.equal(unknown.value.insideIndex,null);
 for(const [outside,inside] of [[1,2],[1.25,2.5],[1.5,3],[2,4]]){
  const q={...copy(),outsideIndex:outside},before=structuredClone(q);
  const answer=analyzeTwoBranchPrismInverse(q);
  assert.deepEqual(q,before);assert.equal(answer.status,'conditional');
  close(answer.value.relativeIndex,2);close(answer.value.insideIndex,inside);
  close(answer.value.outsideIndex,outside);
  assert.equal(answer.value.absoluteInsideIndexAvailable,true);
 }
 const impossible=analyzeTwoBranchPrismInverse({...copy(),outsideIndex:3});
 assert.equal(impossible.status,'unavailable');
 assert.equal(impossible.reasonCode,'ABSOLUTE_INDEX_OUTSIDE_QUALIFIED_DOMAIN');
 assert.equal(impossible.value,null);assert.equal(impossible.native.status,'not-run');
});
test('independent scalar and exact angular references agree across a bounded family',()=>{
 let checked=0;
 for(const A of [.2,.5,1,1.5,2])for(const n of [1.1,1.25,1.5,2,2.5,3]){
  const T=(n-1)*A,R=2*n*A;
  if(R>10||T>10)continue;
  const out=analyzeTwoBranchPrismInverse({...copy(),
   transmittedDeviationDeg:T,returnedDeviationDeg:R});
  assert.equal(out.status,'conditional',JSON.stringify({A,n,T,R,why:out.reasonCode}));
  close(out.value.apexAngleDeg,A,1e-12);close(out.value.relativeIndex,n,1e-10);
  const exactT=deg(Math.asin(n*Math.sin(rad(A))))-A;
  const exactR=deg(Math.asin(n*Math.sin(rad(2*A))));
  close(out.value.exactSnellForwardWitness.predictedTransmittedDeviationDeg,exactT,1e-11);
  close(out.value.exactSnellForwardWitness.predictedReturnedDeviationDeg,exactR,1e-11);
  assert.ok(Math.max(Math.abs(exactT-T),Math.abs(exactR-R))<=.05);
  checked++;
 }
 assert.ok(checked>=20);
});
test('incompatible, zero-apex and near-singular branches never publish a finite solution',()=>{
 for(const [T,R,reason] of [
  [2,4,'DEGENERATE_ZERO_APEX'],
  [3,4,'NO_ADMISSIBLE_POSITIVE_APEX'],
  [1,1,'NO_ADMISSIBLE_POSITIVE_APEX']]){
  const r=analyzeTwoBranchPrismInverse({...copy(),
   transmittedDeviationDeg:T,returnedDeviationDeg:R});
  assert.equal(r.status,'unavailable');assert.equal(r.reasonCode,reason);
  assert.equal(r.value,null);
 }
 const near=analyzeTwoBranchPrismInverse({...copy(),transmittedDeviationDeg:1.99999999});
 assert.equal(near.status,'numerically-indeterminate');
 assert.equal(near.reasonCode,'NEAR_ZERO_APEX_OR_INDEX_SINGULARITY');
 assert.equal(near.value,null);
});
test('zero, negative, tiny, large and excessive relative-index values explicitly refuse',()=>{
 for(const change of [
  {transmittedDeviationDeg:0},{returnedDeviationDeg:0},
  {transmittedDeviationDeg:-1},{returnedDeviationDeg:-1}]){
  const r=analyzeTwoBranchPrismInverse({...copy(),...change});
  assert.equal(r.status,'unavailable');
  assert.equal(r.reasonCode,'NO_POSITIVE_TWO_BRANCH_DEVIATIONS');
 }
 for(const change of [{transmittedDeviationDeg:1e-10},{returnedDeviationDeg:1e-10}]){
  const r=analyzeTwoBranchPrismInverse({...copy(),...change});
  assert.equal(r.status,'numerically-indeterminate');
  assert.equal(r.reasonCode,'UNRESOLVED_SMALL_DEVIATION');
 }
 for(const [change,reason] of [
  [{transmittedDeviationDeg:5,returnedDeviationDeg:20},'OUTSIDE_SMALL_ANGLE_INPUT_BOUNDS'],
  [{transmittedDeviationDeg:4,returnedDeviationDeg:10},'OUTSIDE_QUALIFIED_FIRST_ORDER_DOMAIN']]){
  const r=analyzeTwoBranchPrismInverse({...copy(),...change});
  assert.equal(r.status,'unavailable');assert.equal(r.reasonCode,reason);
  assert.equal(r.native.status,'not-run');
 }
 const valid=analyzeTwoBranchPrismInverse({...copy(),transmittedDeviationDeg:1,returnedDeviationDeg:10});
 assert.equal(valid.status,'conditional');
});
test('strict format, branch, units and numeric types refuse fabricated physics',()=>{
 for(const key of ['format','kind','model','branchConvention','angleUnit',
  'transmittedDeviationDeg','returnedDeviationDeg']){
  const q=copy();delete q[key];
  assert.throws(()=>analyzeTwoBranchPrismInverse(q),failure('MISSING_FACTS'));
 }
 for(const q of [
  {...copy(),model:'exact-fresnel-ray-tracer'},
  {...copy(),branchConvention:'reflected-at-first-face-only'},
  {...copy(),angleUnit:'radians'},
  {...copy(),format:'opticsim-prism-angle-query-v1'},
  {...copy(),kind:'prism-index-from-deviation'},
  {...copy(),outsideIndex:'1'},
  {...copy(),outsideIndex:null},
  {...copy(),outsideIndex:0.9},
  {...copy(),outsideIndex:4.1},
  {...copy(),outsideIndex:Infinity},
  {...copy(),transmittedDeviationDeg:'1'},
  {...copy(),transmittedDeviationDeg:null},
  {...copy(),returnedDeviationDeg:NaN},
  {...copy(),sourceBrightness:.08},
  {...copy(),secondFaceReflectance:.02},
  {...copy(),outsideMedium:'air'},
  {...copy(),partialReflection:true},
  {...copy(),rayPath:['transmit','reflect','return']},
  {...copy(),detectedImage:true},
  {...copy(),questionSolved:true},
  null,[],{},0,'{}'
 ])assert.throws(()=>analyzeTwoBranchPrismInverse(q));
});
test('capabilities state exact model and no native Fresnel qualification',()=>{
 const caps=twoBranchPrismInverseCapabilities();
 assert.equal(caps.model,example.model);
 assert.equal(caps.branchConvention,example.branchConvention);
 assert.equal(caps.angleUnit,'deg');
 assert.deepEqual(caps.optionalFields,['outsideIndex']);
 assert.match(caps.native,/not-run/);
 assert.ok(caps.limitations.some(x=>x.includes('Fresnel')));
 assert.equal(caps.numericalPolicy.maxExactVsFirstOrderResidualDeg,.05);
});
test('CLI preserves original bytes, evidence SHA, no-native result and distinct refusals',()=>{
 const valid=Buffer.from(JSON.stringify(copy(),null,2)+'\n');
 const dir=resolve('test-artifacts/llm-authoring/prism-two-branch-'+randomUUID());
 const answered=runPrismTwoBranchInverseEvidence({queryBytes:valid,outputPath:dir});
 assert.equal(answered.status,'conditional');assert.equal(answered.exitCode,0);
 assert.deepEqual(readFileSync(resolve(dir,'input.json')),valid);
 const sha=createHash('sha256').update(valid).digest('hex');
 assert.equal(answered.report.originalInputSha256,sha);
 const saved=JSON.parse(readFileSync(resolve(dir,'analytical-result.json')));
 assert.equal(saved.originalInputSha256,sha);
 assert.equal(saved.result.value.apexAngleDeg,1);
 assert.equal(saved.native.status,'not-run');
 for(const path of ['scene.ray-optics-2d.json','qualified-scene.json','native-summary.json']){
  assert.equal(existsSync(resolve(dir,path)),false);
 }
 assert.throws(()=>runPrismTwoBranchInverseEvidence({queryBytes:valid,outputPath:dir}));
 const noInput=Buffer.from(JSON.stringify({...copy(),transmittedDeviationDeg:3}));
 const noDir=resolve('test-artifacts/llm-authoring/prism-two-branch-'+randomUUID());
 const no=runPrismTwoBranchInverseEvidence({queryBytes:noInput,outputPath:noDir});
 assert.equal(no.status,'unavailable');assert.equal(no.exitCode,0);
 assert.equal(no.report.result.value,null);
 assert.deepEqual(readFileSync(resolve(noDir,'input.json')),noInput);
 const broken=Buffer.from('{"format":}');
 const rejectDir=resolve('test-artifacts/llm-authoring/prism-two-branch-'+randomUUID());
 const rejected=runPrismTwoBranchInverseEvidence({queryBytes:broken,outputPath:rejectDir});
 assert.equal(rejected.status,'rejected');assert.equal(rejected.exitCode,1);
 assert.equal(rejected.report.native.status,'not-run');
 assert.equal(existsSync(resolve(rejectDir,'analytical-result.json')),false);
 assert.deepEqual(readFileSync(resolve(rejectDir,'input.json')),broken);
 const caps=JSON.parse(execFileSync(process.execPath,[
  fileURLToPath(new URL('../scripts/prism-two-branch-inverse-query.mjs',import.meta.url)),
  'capabilities'],{encoding:'utf8'}));
 assert.equal(caps.model,example.model);assert.equal(caps.kinds[0],example.kind);
});
test('J14 first-order capability never silently solves J13 or full native Fresnel-on propagation',()=>{
 const result=analyzeTwoBranchPrismInverse(copy());
 assert.ok(result.limitations.some(s=>s.includes('J13')));
 assert.ok(result.limitations.some(s=>s.includes('truncat')));
 assert.equal(result.native.branchCompletenessCertified,false);
 assert.equal(result.value.nativeTwoBranchVerified,false);
 const no=analyzeTwoBranchPrismInverse({...copy(),outsideIndex:4});
 assert.equal(no.status,'unavailable');assert.equal(no.native.status,'not-run');
});
