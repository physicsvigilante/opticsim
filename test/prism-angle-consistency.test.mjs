import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {analyzePrismAngleQuery,PRISM_FACTS_FORMAT,PRISM_QUERY_FORMAT} from '../src/prism-angle-queries.js';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

// Frozen review counterexamples. Only analytical requests are exercised here;
// these numbers do not supply a native scene, ray route or measurement.
const facts=()=>({format:PRISM_FACTS_FORMAT,model:'homogeneous-prism',
 branch:'direct-two-face-transmission',apexAngleDeg:60,
 incidenceAngleDeg:27.920491372617853,outsideIndex:1,insideIndex:1.5000000001,
 deviationDeg:57.910491372617855,deviationConvention:'signed'});
const forward=f=>analyzePrismAngleQuery(f,{format:PRISM_QUERY_FORMAT,kind:'prism-transmission-angles'});
const inverse=f=>analyzePrismAngleQuery(f,{format:PRISM_QUERY_FORMAT,kind:'prism-index-from-deviation'});
const atBoundary=n=>({...facts(),incidenceAngleDeg:27.920490121849472,
 deviationDeg:57.91969012184947,insideIndex:n});
const request=f=>({format:'opticsim-problem-v1',physical:f,
 requests:[{id:'index',kind:'prism-index-from-deviation'}]});

test('a close supplied index cannot bypass the measured-deviation consistency check',()=>{
 for(const convention of ['signed','magnitude']){
  const f={...facts(),deviationConvention:convention},before=structuredClone(f);
  const direct=forward(f);assert.equal(direct.status,'unavailable');
  assert.equal(direct.reasonCode,'INCONSISTENT_PRISM_FACTS');
  const inferred=inverse(f);assert.equal(inferred.status,'unavailable');
  assert.equal(inferred.value,null);assert.equal(inferred.candidates.length,0);
  assert.equal(inferred.branches[0].reasonCode,'INCONSISTENT_PRISM_FACTS');
  assert.deepEqual(f,before);
 }
});

test('a supplied index preserves its TIR or critical uncertainty instead of borrowing candidate transmission',()=>{
 for(const [n,status,code] of [[1.50000000014,'unavailable','TOTAL_INTERNAL_REFLECTION'],
  [1.5000000001069325,'numerically-indeterminate','NEAR_CRITICAL_NUMERIC']]){
  const f=atBoundary(n),direct=forward(f);assert.equal(direct.status,status);assert.equal(direct.reasonCode,code);
  const inferred=inverse(f);assert.equal(inferred.status,status);assert.equal(inferred.value,null);
  assert.equal(inferred.candidates.length,0);assert.equal(inferred.branches[0].reasonCode,code);
  assert.equal(inferred.branches[0].boundary,'exit');assert.equal(inferred.native.status,'not-run');
 }
});

test('consistent supplied facts and genuinely unknown index still retain their admitted solutions',()=>{
 const exact={...facts(),insideIndex:1.5},unknown=structuredClone(exact);delete unknown.insideIndex;
 for(const f of [exact,unknown]){
  const r=inverse(f);assert.equal(r.status,'conditional');assert.ok(Math.abs(r.value.insideIndex-1.5)<1e-12);
  assert.equal(r.nativePathVerified,false);assert.equal(r.native.status,'not-run');
 }
});

test('ordinary magnitude disambiguation still checks every known material constraint',()=>{
 const f={...facts(),apexAngleDeg:40,incidenceAngleDeg:30,outsideIndex:1.5,
  insideIndex:1.6750760457803364,deviationDeg:5,deviationConvention:'magnitude'};
 const result=inverse(f);assert.equal(result.status,'conditional');assert.equal(result.candidates.length,1);
 assert.ok(Math.abs(result.value.signedDeviationDeg-5)<1e-8);
 const unresolved=structuredClone(f);delete unresolved.insideIndex;
 assert.equal(inverse(unresolved).status,'multiple-solutions');
});

test('public planning and saved evidence cannot certify the inconsistent inverse or start native work',async()=>{
 mkdirSync('test-artifacts/llm-authoring',{recursive:true});
 const root=mkdtempSync(resolve('test-artifacts/llm-authoring/prism-consistency-'));
 let nativeCalls=0;
 for(const [id,f,status] of [['angle',facts(),'unavailable'],
  ['tir',atBoundary(1.50000000014),'unavailable'],
  ['critical',atBoundary(1.5000000001069325),'numerically-indeterminate']]){
  const p=request(f),before=structuredClone(p),plan=planProblem(p);
  assert.equal(plan.results[0].status,status);assert.equal(plan.results[0].value,null);
  assert.equal(plan.scene,null);assert.equal(plan.native.canRun,false);
  assert.notEqual(plan.methodSuitability.entries[0].readiness,'conditional-result');
  const bytes=Buffer.from(JSON.stringify(p)),out=resolve(root,id);
  const result=await runProblemEvidence({inputBytes:bytes,outputPath:out,
   execute:()=>{nativeCalls++;throw Error('Unexpected native execution');}});
  assert.equal(result.exitCode,2);assert.equal(result.report.results[0].status,status);
  assert.equal(result.report.results[0].value,null);assert.equal(result.report.dispatch.nativeCalls,0);
  assert.equal(result.report.native.status,'not-run');assert.equal(result.report.portable.status,'not-created');
  assert.deepEqual(readFileSync(resolve(out,'input.json')),bytes);
  assert.equal(existsSync(resolve(out,'qualified-scene.json')),false);assert.deepEqual(p,before);
 }
 assert.equal(nativeCalls,0);
});
