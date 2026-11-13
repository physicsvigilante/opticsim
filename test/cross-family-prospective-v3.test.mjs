import {test} from 'node:test';
import assert from 'node:assert/strict';
import {manifestSnapshot,physicalSignatures,scoreAuthoring} from '../evaluation/cross-family-prospective-v3/replay.mjs';
import {planProblem} from '../src/problem-workflow.js';
const {prompts,attempts,reference}=manifestSnapshot();
test('cross-family prospectively frozen prompts, attempts and post-seal reference are immutable and ordered',()=>{
 assert.equal(prompts.cases.length,12);assert.equal(attempts.attempts.length,12);
 assert.equal(reference.cases.length,12);
 assert.equal(reference.firstAttemptsFreezeCommit,attempts.promptFreezeCommit==='08518e49cea9a27e9e73965a9954618ac9517b26'?'ab792a3923da13f956eded1fa364d8089875bb21':null);
 assert.deepEqual(prompts.cases.map(x=>x.id),reference.cases.map(x=>x.id));
});
test('oracle controls are supported in the existing physical contract without inventing geometry',()=>{
 for(const spec of reference.cases.filter(x=>x.classification==='supported')){
  const row=attempts.attempts.find(x=>x.id===spec.id);
  const scene=planProblem(row.response);
  assert.equal(scene.preparation?.status,'fully-specified',spec.id);
  assert.equal(scene.native.canRun,true,spec.id);
  assert.ok(scene.scene,spec.id);
  assert.deepEqual(physicalSignatures(spec.expectedPhysical,{validateSupported:true}),
   physicalSignatures(row.response.physical,{validateSupported:true}),spec.id);
 }
});
test('four distinct negative controls remain blocked or invalid without a native run',()=>{
 for(const spec of reference.cases.filter(x=>x.classification!=='supported')){
  const row=attempts.attempts.find(x=>x.id===spec.id);
  const plan=planProblem(row.response);
  assert.equal(plan.native.canRun,false,spec.id);
  assert.equal(plan.scene===null,spec.id!=='N03',spec.id);
  assert.equal(plan.results[0].status,spec.expectedFirstStatus,spec.id);
 }
});
test('physical fidelity is measured separately from native success and requested kind fidelity',()=>{
 const referenceRow=reference.cases.find(x=>x.id==='P01');
 const original=structuredClone(attempts.attempts.find(x=>x.id==='P01'));
 const status={status:'native-ready',native:{canRun:true},results:[]};
 const complete={report:{results:[{status:'available'},{status:'available'}],
  coverage:{available:2,requested:2},native:{status:'completed'},
  dispatch:{nativeCalls:1,repairs:0,externalModelCalls:0},targetBindings:[]}};
 const correct=scoreAuthoring(referenceRow,original,status,complete);
 assert.equal(correct.physicalFidelity,true);assert.equal(correct.kindFidelity,true);
 original.response.physical.components.find(c=>c.type==='ideal-lens').parameters.focalLength=8;
 const wrong=scoreAuthoring(referenceRow,original,status,complete);
 assert.equal(wrong.physicalFidelity,false);
 assert.equal(wrong.nativeComplete,true,'A native-completed but physically wrong scene is NOT a faithful authoring attempt');
 original.response.requests[0].kind='unsupported-result';
 const kinds=scoreAuthoring(referenceRow,original,status,complete);
 assert.equal(kinds.kindFidelity,false);
});
test('negative unsupported original operation is not silently substituted',()=>{
 const spec=reference.cases.find(x=>x.id==='N02');
 const attempt=attempts.attempts.find(x=>x.id==='N02');
 const plan=planProblem(attempt.response);
 assert.equal(plan.results[0].reasonCode,'UNSUPPORTED_QUANTITY');
 assert.equal(plan.native.canRun,false);
});
