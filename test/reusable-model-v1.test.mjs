import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {validate} from '../src/contract.js';
import {initialQualification,createQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {compareScenario,runExploration,PLAN_BLOB} from '../evaluation/reusable-model-v1/run.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const gitBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const plan=JSON.parse(read('evaluation/reusable-model-v1/plan.json'));
const prior=JSON.parse(read('evaluation/teaching-fidelity-v1/plan.json'));
const source=JSON.parse(read('scenes/single-lens-detector.json'));
const original=()=>prepareScene(structuredClone(prior.initialRequest)).document;
const q=()=>createQualifiedBundle(original(),initialQualification(original(),null,{inputSha256:'a'.repeat(64),interpretation:null}),prior.observables);
const get=id=>plan.investigations.find(p=>p.id===id);
async function evidence(doc=original(),requests=prior.observables){
 const bundle=await createQualifiedBundle(doc,initialQualification(doc,null,{inputSha256:'a'.repeat(64),interpretation:null}),requests);
 const execution=evaluateDocument(doc,core),results=await evaluateObservables(doc,requests,execution.summary);
 return {doc,bundle,execution,results};
}
test('scenario plan was sealed before execution and uses exact prior authored source',()=>{
 assert.equal(gitBlob(read('evaluation/reusable-model-v1/plan.json')),PLAN_BLOB);
 assert.equal(gitBlob(read(plan.source.path)),plan.source.gitBlob);
 assert.equal(gitBlob(read(plan.source.originalAuthoringPlan)),plan.source.originalAuthoringPlanBlob);
 assert.equal(plan.independentReview.externalModelCalls,0);
 assert.deepEqual(original().physics.components,source.physics.components);
 assert.deepEqual(original().simulation,source.simulation);
 assert.equal(plan.investigations.length,7);assert.equal(plan.negativeControls.length,2);
 assert.equal(plan.sweep.values.at(-1),0);
});
test('lens and source revisions remain atomic, versioned and cannot mutate immutable source',()=>{
 const base=original(),old=structuredClone(base);
 for(const id of ['focal-150','source-shift']){
  const doc=reviseScene(base,{changes:get(id).changes}).document;
  assert.equal(doc.physics.components.length,old.physics.components.length);
  assert.deepEqual(doc.simulation,base.simulation);
  const component=get(id).changes[0].id;
  assert.equal(doc.physics.components.find(c=>c.id===component).parameters[get(id).changes[0].key],get(id).changes[0].value);
  assert.deepEqual(base,old);
 }
 assert.throws(()=>reviseScene(base,{changes:plan.negativeControls.find(c=>c.id==='invalid-focal-zero').changes}),/focalLength/);
 assert.deepEqual(base,old);
});
test('the targeted field revision API does NOT implement structural component append',()=>{
 const base=original(),old=structuredClone(base),p=get('extra-detector');
 assert.throws(()=>reviseScene(base,{changes:[{id:p.component.id,section:'parameters',key:'x',value:p.component.parameters.x}]}),/No component has that stable ID/);
 const next=structuredClone(base);next.physics.components.push(structuredClone(p.component));validate(next);
 assert.equal(next.physics.components.length,base.physics.components.length+1);
 assert.equal(new Set(next.physics.components.map(c=>c.id)).size,next.physics.components.length);
 const bad=structuredClone(base);bad.physics.components.push(structuredClone(plan.negativeControls.at(-1).component));
 assert.throws(()=>validate(bad),/detector|intersection|overlap|clearance|intersect/i);
 assert.deepEqual(base,old);
});
test('sampling and camera proposals preserve physical facts with distinct edit categories',async()=>{
 const base=original(),old=structuredClone(base);
 const num=structuredClone(base);num.simulation.rayDensity=get('density-025').rayDensity;validate(num);
 const camera=structuredClone(base);camera.presentation.view.zoom=get('camera-only').zoom;validate(camera);
 assert.deepEqual(num.physics,base.physics);assert.deepEqual(camera.physics,base.physics);
 assert.deepEqual(camera.simulation,base.simulation);
 const bundle=await q();
 assert.deepEqual(recordQualifiedEdit(base,num,bundle.qualification).edits.map(x=>x.kind),['numerics']);
 assert.deepEqual(recordQualifiedEdit(base,camera,bundle.qualification).edits.map(x=>x.kind),['presentation']);
 assert.deepEqual(base,old);
});
test('accepted-looking labels without qualified native evidence never establish comparability',async()=>{
 const fake={doc:original(),bundle:{sceneSha256:'a'.repeat(64)},results:{results:[
  {id:'zero',kind:'detector-crossings',componentId:'detector-1',status:'available',method:'native-observation',unit:'sampled crossings',value:0},
  {id:'image',kind:'ideal-image',componentId:'source-1',status:'conditional',method:'existing-analytical-model',unit:'mm',value:{x:150}}
 ]}};
 const comp=await compareScenario(fake,fake);
 assert.equal(comp.evidenceChecks.baseline.accepted,false);
 assert.ok(comp.entries.every(x=>x.comparison==='not-comparable'));
});
test('current matching native evidence accepts valid zero and retains conditional/native distinction',async()=>{
 const doc=original();doc.physics.components.find(c=>c.id==='source-1').emission={mode:'directional',directionDeg:180,angleDeg:10};
 const a=await evidence(doc),r=a.results.results.find(x=>x.id==='crossings');
 assert.equal(r.status,'available');assert.equal(r.value,0);
 const comp=await compareScenario(a,a);
 assert.equal(comp.evidenceChecks.baseline.accepted,true);
 assert.equal(comp.entries.find(x=>x.id==='crossings').comparison,'sampled-native-comparison');
});
test('stale scene execution, incomplete native status and edited result values all block comparison',async()=>{
 const a=await evidence();
 const edits=[b=>b.execution.summary.canonicalSha256='f'.repeat(64),
  b=>b.execution.summary.native.status='incomplete',b=>b.execution.summary.executionPassed=false,
  b=>b.execution.summary.native.truncation=1,b=>b.results.results[1].value++,
  b=>b.doc.physics.components[0].parameters.x-=1,b=>b.bundle.qualification.origin.inputSha256='b'.repeat(64)];
 for(const edit of edits){const b=structuredClone(a);edit(b);const comp=await compareScenario(a,b);
  assert.equal(comp.evidenceChecks.scenario.accepted,false);
  assert.ok(comp.entries.every(e=>e.comparison==='not-comparable'));
 }
});
test('different sampling and clipping at equal sampling never become an unqualified physical-count comparison',async()=>{
 const a=await evidence(),doc=original();doc.simulation.rayDensity=.25;
 const b=await evidence(doc),mixed=await compareScenario(a,b);
 assert.equal(mixed.evidenceChecks.scenario.accepted,true);
 assert.equal(mixed.entries.find(x=>x.kind==='ideal-image').comparison,'conditional-ideal-comparison');
 assert.equal(mixed.entries.find(x=>x.kind==='detector-crossings').comparison,'not-comparable');
 const equalClipped=await compareScenario(b,b);
 assert.equal(equalClipped.sameNumerics,true);
 assert.equal(equalClipped.entries.find(x=>x.kind==='detector-signed-power').comparison,'not-comparable');
 assert.equal(equalClipped.entries.find(x=>x.kind==='source-emissions').conditions.unclippedWarningFreeSamples,false);
});
test('new named target and changed declared assumptions are not silently treated as the baseline',async()=>{
 const a=await evidence(),doc=original();doc.physics.components.push(structuredClone(get('extra-detector').component));
 const b=await evidence(doc,[...prior.observables,get('extra-detector').requested]);
 const comp=await compareScenario(a,b);
 assert.equal(comp.entries.at(-1).comparison,'not-comparable');
 assert.match(comp.entries.at(-1).reason,/No exact named request/);
 const c=structuredClone(a),cq=structuredClone(c.bundle.qualification);
 cq.interpretation={assumptions:['A newly adopted, different physical assumption.']};
 c.bundle=await createQualifiedBundle(c.doc,cq,c.bundle.observables);
 const changed=await compareScenario(a,c);
 assert.equal(changed.evidenceChecks.scenario.accepted,true);
 assert.ok(changed.entries.every(e=>e.comparison==='not-comparable'));
});
test('comparison snapshots caller state before asynchronous verification',async()=>{
 const a=await evidence(),b=structuredClone(a),pending=compareScenario(a,b);
 b.doc.physics.components[0].parameters.x=999;
 b.results.results[1].value=100000;
 const comp=await pending;
 assert.equal(comp.evidenceChecks.scenario.accepted,true);
 assert.equal(comp.entries.find(x=>x.kind==='source-emissions').comparison,'sampled-native-comparison');
});
test('bounded replay preserves baseline, rejects invalid branches and refuses sampling-as-illumination claims',async()=>{
 const out=resolve('test-artifacts/llm-authoring/reusable-model-test-'+randomUUID());
 const report=await runExploration({outputPath:out});
 assert.equal(report.status,'checks-passed');assert.equal(report.scenarios.length,7);assert.equal(report.rejections.length,2);
 assert.deepEqual(report.nativeCalls,{scenario:7,sweep:3,negative:0});assert.ok(report.checkCounts.passed>=45);
 assert.equal(report.sweep.completedSamples,3);assert.equal(report.sweep.failedSamples,1);
 assert.equal(report.sweep.samples[3].status,'invalid-input');assert.equal(report.sweep.plot[3].y,null);
 assert.ok(report.scenarios.every(x=>x.executionPassed===true));
 assert.equal(new Set(report.scenarios.map(x=>x.sourceGiven)).size,2);
 assert.equal(report.scenarios.find(x=>x.id==='readouts-only').sceneSha256,report.scenarios[0].sceneSha256);
 assert.equal(report.scenarios.find(x=>x.id==='density-025').measurements.emissionsById['source-1'].emitted,125);
 assert.ok(report.comparisons.every(x=>x.evidenceChecks.baseline.accepted&&x.evidenceChecks.scenario.accepted));
 assert.ok(report.comparisons.find(x=>x.id==='extra-detector').entries.some(x=>x.id==='second-detector-crossings'&&x.comparison==='not-comparable'));
 assert.ok(report.comparisons.find(x=>x.id==='density-025').entries.some(x=>x.kind==='detector-crossings'&&x.comparison==='not-comparable'));
 for(const path of ['baseline-qualified.json','report.json','extra-detector/qualified-scene.json','sweep-004/result.json'])assert.ok(existsSync(resolve(out,path)));
 assert.deepEqual(plan.investigations.map(x=>x.id),report.scenarios.map(x=>x.id));
 assert.equal(report.sourceInterpretationAccuracy,'not-assessed; already exposed full fixture');
 assert.equal(report.educationalUsefulness,'not-assessed-by-teachers');
 await assert.rejects(runExploration({outputPath:out}),/exist|fresh|empty/i);
});
