// Deliberately synthetic authoring controls, NOT a model accuracy trial.
// Freeze the physical request corpus as data and use the normal dispatcher.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {planProblem} from '../src/problem-workflow.js';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const matrix=JSON.parse(readFileSync(new URL('../evaluation/general-composition-v1/cases.json',import.meta.url)));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const byId=id=>matrix.cases.find(c=>c.id===id);
const count=(report,id)=>report.results.find(r=>r.id===id)?.value;
test('generality matrix records all authored cases and does not present itself as model accuracy',()=>{
 assert.equal(matrix.format,'opticsim-synthetic-composition-matrix-v1');
 assert.equal(matrix.pinnedPhyDemoCommit,'811f508d2b070898c241a568b0c167dcb8645251');
 assert.equal(matrix.cases.length,21);
 assert.equal(new Set(matrix.cases.map(c=>c.id)).size,21);
 assert.equal(matrix.cases.filter(c=>c.expected.nativeCalls===1).length,13);
 assert.equal(matrix.cases.filter(c=>c.expected.nativeCalls===0).length,8);
 assert.match(matrix.origin,/NOT an independent model evaluation/);
 for(const c of matrix.cases){
  assert.equal(c.input.format,'opticsim-problem-v1');
  assert.equal(c.input.illustration,false);
  assert.equal(c.input.verifyNative,false);
  assert.ok(c.input.physical.components.every(x=>x.id&&x.type&&x.parameters));
  assert.ok(c.input.interpretation.unknowns.some(x=>x.includes('original-question accuracy')));
 }
});
test('one unchanged dispatcher can prepare and execute mixed native scene composition',async()=>{
 for(const c of matrix.cases.filter(x=>x.expected.exitCode===0)){
  const bytes=JSON.stringify(c.input),plan=planProblem(c.input);
  assert.equal(JSON.stringify(c.input),bytes,c.id+': request not immutable');
  assert.equal(plan.native.canRun,true,c.id);
  assert.equal(plan.scene.physics.model,'general-component-tracing',c.id);
  assert.equal(plan.scene.schemaVersion,4,c.id);
  assert.deepEqual(plan.scene.physics.components.map(x=>x.type),c.input.physical.components.map(x=>x.type),c.id);
  const run=evaluateDocument(plan.scene,core).summary;
  assert.equal(run.executionPassed,true,c.id);
  assert.ok(['completed','completed-with-warnings'].includes(run.native.status),c.id+': '+run.native.status);
  assert.deepEqual(run.native.errors,[],c.id);
  const result=await evaluateObservables(plan.scene,plan.nativeRequests,run);
  assert.ok(result.results.every(r=>['available','qualified'].includes(r.status)),c.id+': '+JSON.stringify(result.results));
  if(c.expected.emitted!==undefined)assert.equal(run.native.emitted,c.expected.emitted,c.id);
  if(c.expected.bindings!==undefined)assert.equal(plan.targetBindings.length,c.expected.bindings,c.id);
  if(c.expected.partiallyAbsorbed){
    const absorbed=result.results.find(r=>r.kind==='blocker-absorptions'&&r.componentId==='B1')?.value;
    assert.ok(absorbed>0&&absorbed<run.native.emitted,c.id);
  }
  if(c.expected.absorbed!==undefined)assert.equal(result.results.find(r=>r.id==='absorbed')?.value,c.expected.absorbed,c.id);
  if(c.expected.crossings!==undefined)assert.equal(result.results.find(r=>r.id==='crossings')?.value,c.expected.crossings,c.id);
  assert.equal(result.questionSupport,'not-assessed-by-engine');
 }
});
test('refusal, no guessed target, and no invented image are distinct outcomes',async()=>{
 for(const c of matrix.cases.filter(x=>x.expected.exitCode!==0)){
  const before=JSON.stringify(c.input),plan=planProblem(c.input);
  assert.equal(JSON.stringify(c.input),before,c.id);
  assert.equal(plan.native.canRun,c.expected.nativeCalls===1,c.id);
  if(c.expected.reasonCode){
    assert.equal(plan.results[0].reasonCode,c.expected.reasonCode,c.id);
    assert.equal(plan.results[0].value,null,c.id);
  }
  if(c.expected.nativeCalls===0)continue;
  const run=evaluateDocument(plan.scene,core).summary;
  const measured=await evaluateObservables(plan.scene,plan.nativeRequests,run);
  assert.equal(measured.results[0].status,c.expected.resultStatus,c.id);
  assert.equal(measured.results[0].value,null,c.id);
 }
});
test('different explicit source positions and unit conversions preserve the same native physics',()=>{
 const plain=byId('opaque-line'),unit=byId('unit-cm-equivalent'),shift=byId('translated-line');
 const original=prepareScene(plain.input.physical).document;
 const cm=prepareScene(unit.input.physical).document;
 const translated=prepareScene(shift.input.physical).document;
 assert.deepEqual(cm.physics,original.physics,'explicit centimetres normalize to identical mm physical data');
 const o=evaluateDocument(original,core).summary,u=evaluateDocument(cm,core).summary,t=evaluateDocument(translated,core).summary;
 const signature=s=>[s.native.emitted,s.observations.blockersById.B1.absorptions,s.observations.detectorsById.D1.crossings];
 assert.deepEqual(signature(o),signature(u));
 assert.deepEqual(signature(o),signature(t),'rigid translation conserves finite sampled intersections');
 assert.notEqual(serializeSave(translated),serializeSave(original),'translation is a real physical edit');
});
test('the dispatcher snapshots requests, not caller-owned future edits',()=>{
 const c=byId('circle-in-aperture-gap');
 const input=structuredClone(c.input),prior=JSON.stringify(input),planned=planProblem(input);
 const sceneBytes=serializeSave(planned.scene),bindings=structuredClone(planned.nativeRequests);
 input.physical.components.find(x=>x.id==='B1').parameters.openingLength=79;
 input.requests[0].componentId='bogus';
 assert.equal(serializeSave(planned.scene),sceneBytes);
 assert.deepEqual(planned.nativeRequests,bindings);
 assert.notEqual(JSON.stringify(input),prior);
 const native=evaluateDocument(planned.scene,core).summary;
 assert.equal(native.executionPassed,true);
});
test('atomic geometry revisions cannot silently move a stop into collision or erase its opening',()=>{
 const doc=prepareScene(byId('finite-aperture').input.physical).document;
 assert.throws(()=>reviseScene(doc,{changes:[{id:'B1',section:'parameters',key:'openingLength',value:79,unit:'mm'}]}));
 assert.throws(()=>reviseScene(doc,{changes:[{id:'B1',section:'parameters',key:'x',value:100,unit:'mm'}]}));
 assert.equal(doc.physics.components.find(c=>c.id==='B1').parameters.openingLength,30);
});
