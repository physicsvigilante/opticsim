import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {analyzeThreeFacePrismBound,threeFacePrismCapabilities,
 THREE_FACE_PRISM_QUERY_FORMAT,ThreeFacePrismQueryError}
 from '../src/three-face-prism-tir-bound.js';
import {runThreeFacePrismBoundEvidence}
 from '../scripts/three-face-prism-bound-query.mjs';

const source=JSON.parse(readFileSync(new URL('../examples/jee-j13-reflected-prism-bound-v1.json',import.meta.url),'utf8'));
const frozen=JSON.parse(readFileSync(new URL('../research/jee-j13-reflected-prism-native-v1/frozen-protocol.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(source);
const near=(a,b,e=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=e,
 String(a)+' differs from '+String(b)+' by '+String(e));
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const error=code=>e=>e instanceof ThreeFacePrismQueryError&&e.code===code;

test('J13 source-fact policy and native research protocol were frozen before implementation',()=>{
 assert.equal(frozen.status,'pre-execution-frozen');
 assert.equal(frozen.source.caseId,'J13');
 assert.equal(frozen.source.solutionsRead,false);
 assert.equal(frozen.studyCases.length,9);
 assert.equal(frozen.independentReference.wordSlightlyHasNoNumericalTolerance,true);
 assert.equal(frozen.independentReference.exteriorIndexUnknownMeansNoAbsoluteGlassIndex,true);
 assert.equal(frozen.independentReference.nInequality.includes('sqrt(7/3)'),true);
 assert.deepEqual(frozen.independentReference.thresholdRelativeIndex,Math.sqrt(7/3));
 assert.equal(source.format,THREE_FACE_PRISM_QUERY_FORMAT);
});

test('original J13 30 degree emergence gives signed 30 degree incidence and only strict material inequality',()=>{
 const original=copy(),before=structuredClone(original);
 const x=analyzeThreeFacePrismBound(original);
 assert.deepEqual(original,before);
 assert.equal(x.status,'conditional');
 assert.equal(x.sourceFacts.outsideIndex,null);
 assert.equal(x.sourceFacts.candidateInsideIndex,null);
 near(x.value.conditionalIncidentAngleDeg,30);
 near(x.value.relativeIndexLowerBoundExclusive,Math.sqrt(7/3),1e-14);
 assert.equal(x.value.uniqueIndexInferred,false);
 assert.equal(x.value.criticalEqualityExcluded,true);
 assert.equal(x.value.qualitativeSlightlyDoesNotSpecifyMargin,true);
 assert.equal(x.value.outsideIndex,null);
 assert.equal(x.value.insideIndexLowerBoundExclusive,null);
 assert.equal(x.value.candidate,null);
 assert.equal(x.native.status,'not-run');
 assert.equal(x.native.nativeFaceSequenceVerified,false);
 assert.equal(x.value.originalJeeQuestionSolved,false);
});

test('independent equilateral Snell threshold identity holds for several non-J13 emergence angles',()=>{
 for(const e of [.1,1,5,10,20,30]){
  const b=analyzeThreeFacePrismBound({...copy(),emergenceAngleDeg:e});
  assert.equal(b.status,'conditional');
  const mcrit=b.value.relativeIndexLowerBoundExclusive;
  const s=Math.sin(rad(e));
  near(mcrit*mcrit,4*(1+s+s*s)/3,1e-12);
  const r=deg(Math.asin(s/mcrit));
  const criticalProduct=mcrit*Math.sin(rad(60-r));
  near(criticalProduct,1,5e-14);
  const candidate=mcrit+.02;
  const q=analyzeThreeFacePrismBound({...copy(),emergenceAngleDeg:e,
   outsideIndex:1,candidateInsideIndex:candidate});
  assert.equal(q.status,'conditional');
  assert.equal(q.value.candidate.candidateStrictTIRConsistent,true);
  near(q.value.conditionalIncidentAngleDeg,e);
  near(Math.asin((candidate*Math.sin(rad(Math.asin(s/candidate)*180/Math.PI))))*180/Math.PI,e,1e-10);
 }
});

test('outside index is never defaulted; explicit exterior converts only a strict lower bound',()=>{
 const sourceOnly=analyzeThreeFacePrismBound(copy());
 assert.equal(sourceOnly.value.insideIndexLowerBoundExclusive,null);
 for(const outside of [1,1.33,2,2.5]){
  const q=analyzeThreeFacePrismBound({...copy(),outsideIndex:outside});
  assert.equal(q.status,'conditional');
  near(q.value.outsideIndex,outside);
  near(q.value.insideIndexLowerBoundExclusive,outside*Math.sqrt(7/3));
  assert.equal(q.value.uniqueIndexInferred,false);
 }
 const noInterval=analyzeThreeFacePrismBound({...copy(),outsideIndex:3});
 assert.equal(noInterval.status,'unavailable');
 assert.equal(noInterval.reasonCode,'NO_BOUNDED_ABSOLUTE_INDEX_INTERVAL');
 assert.equal(noInterval.value,null);
});

test('candidate index is separate, not inferred from a qualitative slightly-above-critical statement',()=>{
 for(const [n,status,reason] of [
  [1.6,'conditional',null],
  [1.5,'unavailable','CANDIDATE_BELOW_CRITICAL'],
  [1,'unavailable','INTERIOR_NOT_HIGHER_INDEX'],
  [Math.sqrt(7/3),'numerically-indeterminate','CANDIDATE_NEAR_CRITICAL'],
  [Math.sqrt(7/3)+1e-8,'numerically-indeterminate','CANDIDATE_NEAR_CRITICAL'],
  [Math.sqrt(7/3)-1e-8,'numerically-indeterminate','CANDIDATE_NEAR_CRITICAL'],
  [Math.sqrt(7/3)+.0001,'conditional',null]
 ]){
  const q=analyzeThreeFacePrismBound({...copy(),outsideIndex:1,candidateInsideIndex:n});
  assert.equal(q.status,status,'candidate '+n);
  assert.equal(q.reasonCode,reason);
  if(status==='conditional'){
   assert.ok(q.value.candidate.criticalSineMargin>1e-5);
   assert.equal(q.value.candidate.finiteNativeThreeFaceRouteCertified,false);
  }else assert.equal(q.value,null);
  assert.equal(q.native.status,'not-run');
 }
 const normalized=analyzeThreeFacePrismBound({...copy(),outsideIndex:1.5,candidateInsideIndex:2.4});
 assert.equal(normalized.status,'conditional');
 near(normalized.value.candidate.relativeIndex,1.6);
});

test('non-equilateral, equality, face-reordered, unphysical indices and invalid JSON types fail closed',()=>{
 for(const field of ['format','kind','model','branchConvention','angleUnit','emergenceAngleDeg',
  'criticalRelation']){
  const q=copy();delete q[field];
  assert.throws(()=>analyzeThreeFacePrismBound(q),error('MISSING_FACTS'));
 }
 for(const q of [
  {...copy(),criticalRelation:'at-critical'},
  {...copy(),criticalRelation:'approximately-critical'},
  {...copy(),model:'arbitrary-triangle'},
  {...copy(),branchConvention:'AB-entry-BC-reflection-AC-exit'},
  {...copy(),angleUnit:'radians'},
  {...copy(),emergenceAngleDeg:90},
  {...copy(),emergenceAngleDeg:45},
  {...copy(),emergenceAngleDeg:0},
  {...copy(),emergenceAngleDeg:-30},
  {...copy(),emergenceAngleDeg:'30'},
  {...copy(),emergenceAngleDeg:NaN},
  {...copy(),outsideIndex:0.999},
  {...copy(),outsideIndex:null},
  {...copy(),outsideIndex:Infinity},
  {...copy(),candidateInsideIndex:1.6},
  {...copy(),outsideIndex:1,candidateInsideIndex:4.1},
  {...copy(),outsideIndex:1,candidateInsideIndex:'1.6'},
  {...copy(),refractiveIndex:Math.sqrt(7/3)},
  {...copy(),sourceX:-100},
  {...copy(),detectorCrossings:2},
  {...copy(),native:true},
  null,[],0,{},'{}'
 ])assert.throws(()=>analyzeThreeFacePrismBound(q));
});

test('capabilities accurately disclose a relative open bound, not a unique solution or native run',()=>{
 const caps=threeFacePrismCapabilities();
 assert.equal(caps.format,THREE_FACE_PRISM_QUERY_FORMAT);
 assert.equal(caps.branchConvention,source.branchConvention);
 assert.equal(caps.criticalRelation,'strictly-above');
 assert.deepEqual(caps.optionalFields,['outsideIndex','candidateInsideIndex']);
 assert.match(caps.native,/not-run/);
 assert.ok(caps.relationships.some(x=>x.includes('sqrt(7/3)')));
 assert.ok(caps.limitations.some(x=>x.includes('J14')));
});

test('standalone evidence CLI never invokes native and preserves exact raw input across conditional/refusal/malformed',()=>{
 const input=Buffer.from(JSON.stringify(copy(),null,2)+'\n');
 const dir=resolve('test-artifacts/llm-authoring/j13-three-face-'+randomUUID());
 const a=runThreeFacePrismBoundEvidence({queryBytes:input,outputPath:dir});
 assert.equal(a.status,'conditional');assert.equal(a.exitCode,0);
 assert.deepEqual(readFileSync(resolve(dir,'input.json')),input);
 const hash=createHash('sha256').update(input).digest('hex');
 assert.equal(a.report.originalInputSha256,hash);
 const saved=JSON.parse(readFileSync(resolve(dir,'analytical-result.json')));
 assert.equal(saved.originalInputSha256,hash);
 assert.equal(saved.result.native.status,'not-run');
 for(const name of ['native-summary.json','qualified-scene.json','scene.ray-optics-2d.json'])
  assert.equal(existsSync(resolve(dir,name)),false);
 assert.throws(()=>runThreeFacePrismBoundEvidence({queryBytes:input,outputPath:dir}));
 const ineligible=Buffer.from(JSON.stringify({...copy(),outsideIndex:1,candidateInsideIndex:1.5}));
 const noDir=resolve('test-artifacts/llm-authoring/j13-three-face-'+randomUUID());
 const no=runThreeFacePrismBoundEvidence({queryBytes:ineligible,outputPath:noDir});
 assert.equal(no.status,'unavailable');assert.equal(no.exitCode,0);
 assert.equal(no.report.result.value,null);
 assert.deepEqual(readFileSync(resolve(noDir,'input.json')),ineligible);
 const invalid=Buffer.from('{"format":}');
 const badDir=resolve('test-artifacts/llm-authoring/j13-three-face-'+randomUUID());
 const rejected=runThreeFacePrismBoundEvidence({queryBytes:invalid,outputPath:badDir});
 assert.equal(rejected.status,'rejected');assert.equal(rejected.exitCode,1);
 assert.equal(rejected.report.native.status,'not-run');
 assert.equal(existsSync(resolve(badDir,'analytical-result.json')),false);
 assert.deepEqual(readFileSync(resolve(badDir,'input.json')),invalid);
 const caps=JSON.parse(execFileSync(process.execPath,[
  fileURLToPath(new URL('../scripts/three-face-prism-bound-query.mjs',import.meta.url)),
  'capabilities'],{encoding:'utf8'}));
 assert.equal(caps.model,source.model);
});
