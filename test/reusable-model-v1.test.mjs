import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {validate} from '../src/contract.js';
import {initialQualification,createQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {compareScenario,runExploration,PLAN_BLOB} from '../evaluation/reusable-model-v1/run.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const gitBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const plan=JSON.parse(read('evaluation/reusable-model-v1/plan.json'));
const prior=JSON.parse(read('evaluation/teaching-fidelity-v1/plan.json'));
const source=JSON.parse(read('scenes/single-lens-detector.json'));
const original=()=>prepareScene(structuredClone(prior.initialRequest)).document;
const q=()=>createQualifiedBundle(original(),initialQualification(original(),null,{inputSha256:'a'.repeat(64),interpretation:null}),prior.observables);
const get=(id)=>plan.investigations.find(p=>p.id===id);
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
 const bad=plan.negativeControls.find(c=>c.id==='invalid-focal-zero');
 assert.throws(()=>reviseScene(base,{changes:bad.changes}),/focalLength/);
 assert.deepEqual(base,old);
});
test('the currently targeted revision API deliberately does NOT implement structural component append',()=>{
 const base=original(),old=structuredClone(base),p=get('extra-detector');
 assert.throws(()=>reviseScene(base,{changes:[{id:p.component.id,section:'parameters',key:'x',value:p.component.parameters.x}]}),/No component has that stable ID/);
 const next=structuredClone(base);next.physics.components.push(structuredClone(p.component));
 validate(next);
 assert.equal(next.physics.components.length,base.physics.components.length+1);
 const seen=new Set(next.physics.components.map(c=>c.id));assert.equal(seen.size,next.physics.components.length);
 const bad=structuredClone(base);bad.physics.components.push(structuredClone(plan.negativeControls.at(-1).component));
 assert.throws(()=>validate(bad),/detector|intersection|overlap|clearance|intersect/i);
 assert.deepEqual(base,old);
});
test('sampling and camera proposals preserve physical facts, but have distinct effects and edit categories',async()=>{
 const base=original(),old=structuredClone(base);
 const num=structuredClone(base);num.simulation.rayDensity=get('density-025').rayDensity;validate(num);
 const camera=structuredClone(base);camera.presentation.view.zoom=get('camera-only').zoom;validate(camera);
 assert.deepEqual(num.physics,base.physics);assert.deepEqual(camera.physics,base.physics);
 assert.deepEqual(camera.simulation,base.simulation);
 const bundle=await q(),nq=recordQualifiedEdit(base,num,bundle.qualification),pq=recordQualifiedEdit(base,camera,bundle.qualification);
 assert.deepEqual(nq.edits.map(x=>x.kind),['numerics']);
 assert.deepEqual(pq.edits.map(x=>x.kind),['presentation']);
 assert.deepEqual(base,old);
});
test('comparison must not mislabel zero, sampling changes or new target as a verified physical effect',()=>{
 const doc=original(),second=structuredClone(doc);second.simulation.rayDensity=.25;
 const base={doc,bundle:{sceneSha256:'a'.repeat(64)},results:{results:[
  {id:'zero',kind:'detector-crossings',componentId:'detector-1',status:'available',method:'native-observation',unit:'sampled crossings',value:0},
  {id:'image',kind:'ideal-image',componentId:'source-1',status:'conditional',method:'existing-analytical-model',unit:'mm; magnification dimensionless',value:{x:150}},
  {id:'unknown',kind:'refractive-index',componentId:'lens-1',status:'unavailable',method:null,unit:null,value:null}]}};
 const next={...base,doc:second,bundle:{sceneSha256:'b'.repeat(64)},results:{results:[
  {id:'zero',kind:'detector-crossings',componentId:'detector-1',status:'available',method:'native-observation',unit:'sampled crossings',value:0},
  {id:'image',kind:'ideal-image',componentId:'source-1',status:'conditional',method:'existing-analytical-model',unit:'mm; magnification dimensionless',value:{x:150}},
  {id:'unknown',kind:'refractive-index',componentId:'lens-1',status:'unavailable',method:null,unit:null,value:null},
  {id:'new-target',kind:'detector-crossings',componentId:'detector-2',status:'available',method:'native-observation',unit:'sampled crossings',value:7}
 ]}};
 const comp=compareScenario(base,next);
 assert.deepEqual(comp.entries.map(x=>x.comparison),['not-comparable','conditional-ideal-comparison','not-comparable','not-comparable']);
 assert.match(comp.entries[0].reason,/different numerical policies/);
 assert.match(comp.entries[2].reason,/unavailable/);
 assert.match(comp.entries[3].reason,/No exact named request/);
 const same=compareScenario(base,{...next,doc:structuredClone(doc)});
 assert.equal(same.entries[0].comparison,'sampled-native-comparison'); // zero is a valid observed result.
});
test('bounded scenario replay preserves one baseline, rejects invalid branches and never interprets sampling as illumination',async()=>{
 const out=resolve('test-artifacts/llm-authoring/reusable-model-test-'+randomUUID());
 const report=await runExploration({outputPath:out});
 assert.equal(report.status,'checks-passed');
 assert.equal(report.scenarios.length,7);
 assert.equal(report.rejections.length,2);
 assert.deepEqual(report.nativeCalls,{scenario:7,sweep:3,negative:0});
 assert.ok(report.checkCounts.passed>=35);
 assert.equal(report.sweep.completedSamples,3);
 assert.equal(report.sweep.failedSamples,1);
 assert.equal(report.sweep.samples[3].status,'invalid-input');
 assert.equal(report.sweep.plot[3].y,null);
 assert.ok(report.scenarios.every(x=>x.executionPassed===true));
 assert.equal(new Set(report.scenarios.map(x=>x.sourceGiven)).size,2);
 assert.equal(report.scenarios.find(x=>x.id==='readouts-only').sceneSha256,report.scenarios[0].sceneSha256);
 assert.equal(report.scenarios.find(x=>x.id==='density-025').measurements.emissionsById['source-1'].emitted,125);
 assert.ok(report.comparisons.find(x=>x.id==='extra-detector').entries.some(x=>x.id==='second-detector-crossings'&&x.comparison==='not-comparable'));
 assert.ok(report.comparisons.find(x=>x.id==='density-025').entries.some(x=>x.kind==='detector-crossings'&&x.comparison==='not-comparable'));
 assert.ok(existsSync(resolve(out,'baseline-qualified.json')));
 assert.ok(existsSync(resolve(out,'report.json')));
 assert.ok(existsSync(resolve(out,'extra-detector/qualified-scene.json')));
 assert.ok(existsSync(resolve(out,'sweep-004/result.json')));
 assert.deepEqual(plan.investigations.map(x=>x.id),report.scenarios.map(x=>x.id));
 assert.equal(report.sourceInterpretationAccuracy,'not-assessed; already exposed full fixture');
 assert.equal(report.educationalUsefulness,'not-assessed-by-teachers');
});
