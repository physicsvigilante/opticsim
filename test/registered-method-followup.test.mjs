import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runRegisteredMethodFollowup} from '../evaluation/registered-method-followup-v1/replay.mjs';
const data=JSON.parse(readFileSync(new URL('../evaluation/registered-method-followup-v1/decisions.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
let executed;
const run=()=>executed??=runRegisteredMethodFollowup({outputPath:resolve('test-artifacts/llm-authoring/registered-followup-test-'+randomUUID())});

test('follow-up selects registered methods without solved focal inputs or invented native optics',()=>{
 assert.equal(data.independentEvaluation,false);assert.equal(data.blindEvaluation,false);
 assert.equal(data.newFirstAttemptEvaluation,false);
 assert.equal(data.cases.length,7);
 for(const c of data.cases.filter(c=>c.request)){
  assert.equal(c.request.illustration,false);assert.equal(c.request.verifyNative,false);
  assert.equal(c.request.physical.format,'opticsim-reduced-inverse-facts-v1');
  assert.equal(Object.hasOwn(c.request.physical,'focalLength'),false);
  assert.equal(Object.hasOwn(c.request.physical,'components'),false);
  const p=planProblem(c.request);assert.equal(p.scene,null);assert.equal(p.native.canRun,false);
  assert.equal(p.methodSuitability.entries[0].registered,true);
 }
 assert.deepEqual(data.cases.filter(c=>c.origin==='exposed-original').map(c=>c.sourceCase),['R01','R03','R08']);
 const lens=data.cases.find(c=>c.id==='F03').request.physical;
 assert.ok(lens.observations.every(o=>Object.hasOwn(o,'absoluteMagnification')&&!Object.hasOwn(o,'imageOrientation')));
});

test('existing registered methods return actual answers for the three explicitly reauthored originals',async()=>{
 const {report}=await run();
 const [a,b,c]=report.cases.slice(0,3).map(c=>c.result);
 assert.ok([a,b,c].every(r=>r.status==='conditional'&&r.nativeObservation===false));
 near(a.value.reflectionPoint.x,4);near(a.value.reflectionPoint.y,0);
 near(a.value.distanceFromProjectionA,4);near(a.value.distanceFromProjectionB,16);
 near(b.value.focalLength,10/3);near(b.value.signedRadiusOfCurvature,20/3);
 assert.equal(b.value.opticalClassification,'concave');
 near(b.value.observations[0].imageDistance,-10);
 near(c.value.focalLength,12);
 assert.deepEqual(c.value.observations.map(o=>o.signedMagnification),[-3,3]);
 assert.equal(report.counts.originalFollowupConditionalResults,3);
 assert.equal(report.counts.originalFollowupRequests,3);
 assert.equal(report.nativeCalls,0);assert.equal(report.externalModelCalls,0);
 assert.equal(report.accuracyScore,null);
});

test('information-loss variants and unsupported scope judgments are never pooled as solved originals',async()=>{
 const {report}=await run(),byId=id=>report.cases.find(c=>c.id===id);
 assert.equal(byId('F04').status,'multiple-solutions');assert.equal(byId('F04').result.value,null);
 assert.deepEqual(byId('F04').result.candidates.map(c=>c.focalLength),[12,24]);
 assert.equal(byId('F05').status,'needs-information');assert.equal(byId('F05').result.reasonCode,'MISSING_FACTS');
 assert.equal(byId('F05').result.value,null);
 for(const id of ['F06','F07']){
  assert.equal(byId(id).status,'not-submitted');assert.equal(byId(id).result,null);
  assert.equal(byId(id).assessment,'same-assistant-scope-judgment-not-engine-result');
 }
 assert.deepEqual(report.counts,{originalFollowupRequests:3,originalFollowupConditionalResults:3,
  syntheticVariants:2,ambiguousVariants:1,missingFactVariants:1,authorScopeDecisionsWithoutExecution:2});
});

test('follow-up preserves input hashes and historical records, and refuses reused evidence directories',async()=>{
 const paths=Object.keys(data.sourceGitBlobs);
 const before=paths.map(p=>sha(readFileSync(p)));
 const {report,output}=await run();
 assert.equal(report.originalFirstAttemptsModified,false);
 const stored=JSON.parse(readFileSync(resolve(output,'report.json')));
 assert.deepEqual(stored,report);
 for(const c of report.cases.filter(c=>c.result)){
  assert.equal(sha(readFileSync(resolve(output,c.id,'input.json'))),c.inputSha256);
  const actual=JSON.parse(readFileSync(resolve(output,c.id,'report.json')));
  assert.deepEqual(actual.results[0],c.result);assert.equal(actual.dispatch.nativeCalls,0);
 }
 await assert.rejects(runRegisteredMethodFollowup({outputPath:output}),/already exists/i);
 assert.deepEqual(paths.map(p=>sha(readFileSync(p))),before);
});
