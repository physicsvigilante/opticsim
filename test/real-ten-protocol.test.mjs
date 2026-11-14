import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadTrial,summarizeTrial,ROOT,FIRST_FREEZE} from '../evaluation/real-ten-v1/protocol.mjs';
import {readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
import {sha256} from '../evaluation/real-ten-v1/protocol.mjs';
import {planProblem} from '../src/problem-workflow.js';
import {analyzeCurvedMirrorQuery,CURVED_QUERY_FORMAT} from '../src/curved-mirror-queries.js';
test('original ten selection and first attempts are frozen before solution review, with all cases retained',()=>{
 const {selection,first,review}=loadTrial();
 assert.equal(selection.cases.length,10);assert.equal(first.cases.length,10);assert.equal(review.cases.length,10);
 assert.equal(review.solutionTransfer.verifiedFirstAttemptFreeze,FIRST_FREEZE);
 assert.equal(first.solutionsOpened,false);assert.equal(review.solutionsOpenedAfterFreeze,true);
 assert.equal(first.independentModel,false);assert.equal(review.independentAccuracy,null);
 assert.ok(!existsSync(resolve(ROOT,'.github/workflows/real-ten-source-transfer.yml')));
});
test('all ten problem-image hashes match exact selected members of the pinned user archive',()=>{
 const {selection,first}=loadTrial(),archive=readFileSync(resolve(ROOT,selection.archiveFile));
 assert.equal(sha256(archive),selection.archiveSha256);
 for(let i=0;i<10;i++)assert.equal(sha256(readProblemPng(archive,selection.cases[i].problemPath)),first.cases[i].problemSha256,first.cases[i].id);
});
test('unregistered original-question requests remain unavailable without invented native scenes',()=>{
 const {first}=loadTrial();let requests=0;
 for(const c of first.cases){
  const original=JSON.stringify(c.engineRequest),plan=planProblem(c.engineRequest);
  assert.equal(plan.native.canRun,false,c.id);assert.equal(plan.scene,null,c.id);
  assert.ok(plan.results.every(r=>r.status==='unavailable'&&r.reasonCode==='UNSUPPORTED_QUANTITY'&&r.value===null),c.id);
  assert.equal(JSON.stringify(c.engineRequest),original);requests+=plan.results.length;
 }
 assert.equal(requests,13);
});
test('manual inverse R03 has only a separately labelled forward analytical check',()=>{
 const {first}=loadTrial(),c=first.cases.find(x=>x.id==='R03'),r=c.derivedVerification.request;
 const result=analyzeCurvedMirrorQuery(r.physical,{format:CURVED_QUERY_FORMAT,kind:'curved-mirror-image'});
 assert.equal(result.status,'conditional');assert.equal(result.native.status,'not-run');
 assert.ok(Math.abs(result.value.imageDistance+10)<1e-10);assert.ok(Math.abs(result.value.magnification-4)<1e-10);
 assert.equal(planProblem(c.engineRequest).native.canRun,false);
});
test('source discrepancy and approximation corrections are separate from unchanged first answers',()=>{
 const {first,review}=loadTrial(),ring=review.cases.find(x=>x.id==='R05'),dispersion=review.cases.find(x=>x.id==='R10');
 assert.equal(ring.assessment,'source-conflict');assert.equal(ring.problemHeightCm,2);assert.equal(ring.solutionHeightCm,200);
 assert.equal(first.cases.find(x=>x.id==='R05').manualAnswer.value.shadowRadiusCm,15+2*4/3);
 assert.equal(ring.solutionConsistentShadowRadiusCm,15+200*4/3);
 assert.equal(dispersion.assessment,'approximation-convention');
 assert.ok(Math.abs(dispersion.keyGeometricMeanApproximation-.032/Math.sqrt(.968))<1e-12);
 assert.equal(review.cases.filter(x=>x.assessment==='agrees').length,7);
 assert.equal(review.cases.find(x=>x.id==='R06').assessment,'conditional-agreement');
});
test('derived checks and manual agreements never increase original engine coverage denominators',()=>{
 const {review}=loadTrial();
 const record={report:{coverage:{requested:2,available:0,status:'none-available'},dispatch:{nativeCalls:0},native:{status:'not-run'},portable:{status:'not-created'}}};
 const derived={report:{coverage:{requested:1,available:1,status:'all-requested-quantities-available'},dispatch:{nativeCalls:0},native:{status:'not-run'}}};
 const counts=summarizeTrial([record],[derived],review);
 assert.equal(counts.originalQuestions,1);assert.equal(counts.originalResultRequests,2);assert.equal(counts.originalResultsAvailable,0);
 assert.equal(counts.originalQuestionsFullyAvailable,0);assert.equal(counts.derivedAnalyticalChecks,1);assert.equal(counts.originalNativeCalls,0);
 assert.equal(counts.independentModelAccuracy,null);
});
