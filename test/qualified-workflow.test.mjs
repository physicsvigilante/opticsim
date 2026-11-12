import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables,validateObservables} from '../src/observables.js';
import {initialQualification,recordQualifiedEdit,qualificationSummary,
  createQualifiedBundle,verifyQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {sceneHash} from '../src/qualified-utils.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const request=()=>({lengthUnit:'cm',components:[
  {id:'S1',type:'point-source',parameters:{x:-30,y:1}},
  {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:10}}
]});
const image=[{id:'image',kind:'ideal-image',componentId:'S1'}];
const seed=()=>{
  const input=request(),p=resolveProblemRequest(input,{illustration:true}),doc=p.prepared.document;
  const qualification=initialQualification(doc,p,{inputSha256:createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    interpretation:{requestedResult:'Illustrate conditional ideal image',assumptions:['Representative luminous point, not an extended-object claim.']}});
  return {doc,qualification};
};

test('qualified results reuse lens analysis only after validating the exact arrangement',async()=>{
  const {doc}=seed(),original=structuredClone(doc),run=evaluateDocument(doc,core);
  const report=await evaluateObservables(doc,image,run.summary),r=report.results[0];
  assert.equal(r.status,'conditional');assert.equal(r.method,'existing-analytical-model');
  assert.equal(r.value.x,150);assert.equal(r.value.magnification,-.5);
  assert.equal(r.nativeImageDetected,false);assert.ok(r.assumptions.length>0);
  assert.equal(doc.physics.model,'general-component-tracing');assert.deepEqual(doc,original);
  assert.equal(run.summary.analysis.status,'unavailable');
});

test('results suppress stale, stopped and incomplete native evidence',async()=>{
  const {doc}=seed(),run=evaluateDocument(doc,core);
  for(const bad of [{...run.summary,canonicalSha256:'0'.repeat(64)},
    {...run.summary,executionPassed:false,native:{status:'stopped',warnings:[]}},null]){
    assert.equal((await evaluateObservables(doc,image,bad)).results[0].status,'suppressed');
  }
  const changed=structuredClone(doc);changed.physics.components[1].parameters.focalLength=200;
  assert.equal((await evaluateObservables(changed,image,run.summary)).results[0].status,'suppressed');
});

test('unsupported quantities, missing IDs and multi-source images are explicit unavailable results',async()=>{
  const {doc}=seed();doc.physics.components.push({id:'S2',type:'point-source',parameters:{x:-320,y:20,brightness:.08},emission:{mode:'full-circle',directionDeg:0,angleDeg:30}});
  const run=evaluateDocument(doc,core);
  const results=(await evaluateObservables(doc,[...image,
    {id:'unknown',kind:'material-index'},{id:'wrong',kind:'detector-crossings',componentId:'L1'}],run.summary)).results;
  assert.ok(results.every(r=>r.status==='unavailable'&&r.value===null));
});

test('native observables use actual component readings and never invent missing data',async()=>{
  const req={lengthUnit:'cm',components:[
    {id:'S1',type:'point-source',parameters:{x:-20,y:0,brightness:.08},emission:{mode:'directional',directionDeg:0,angleDeg:10}},
    {id:'D1',type:'ray-detector',parameters:{x:10,y:0,orientationDeg:90,length:10}}]};
  const doc=prepareScene(req).document,run=evaluateDocument(doc,core),queries=[
    {id:'emit',kind:'source-emissions',componentId:'S1'},
    {id:'cross',kind:'detector-crossings',componentId:'D1'},
    {id:'power',kind:'detector-signed-power',componentId:'D1'}];
  const r=(await evaluateObservables(doc,queries,run.summary)).results;
  assert.ok(r.every(x=>x.status==='available'));assert.ok(r[1].value>0);
  assert.equal(r[1].value,run.summary.observations.detectorsById.D1.crossings);
  assert.match(r[2].unit,/not watts/);
  const missing={...run.summary,observations:null};
  assert.ok((await evaluateObservables(doc,queries,missing)).results.every(x=>x.status==='unavailable'));
});

test('qualification bundle survives round trip and rejects scene or metadata tampering',async()=>{
  const {doc,qualification}=seed(),bundle=await createQualifiedBundle(doc,qualification,image);
  assert.deepEqual(await parseQualifiedBundle(JSON.stringify(bundle)),bundle);
  assert.equal(bundle.sceneSha256,await sceneHash(doc));
  for(const change of [b=>b.scene.physics.components[1].parameters.focalLength=200,
    b=>b.qualification.assumptions[0].value=.5,b=>b.observables[0].kind='material-index']){
    const bad=structuredClone(bundle);change(bad);await assert.rejects(verifyQualifiedBundle(bad),/integrity mismatch/);
  }
});

test('physical edits preserve prior assumptions and record changed values without upgrading origin claims',async()=>{
  const {doc,qualification}=seed(),next=structuredClone(doc);
  next.physics.components[1].parameters.apertureHeight=200;
  const revised=recordQualifiedEdit(doc,next,qualification);
  assert.equal(revised.origin.preparationStatus,'illustrative');
  assert.deepEqual(revised.assumptions,qualification.assumptions);
  assert.equal(revised.edits[0].kind,'physics');
  const summary=qualificationSummary(next,revised);
  assert.equal(summary.status,'revised');assert.equal(summary.physicsEdited,true);
  assert.equal(summary.assumptions.find(a=>a.key==='apertureHeight').changed,true);
  const bundle=await createQualifiedBundle(next,revised,image);await verifyQualifiedBundle(bundle);
  assert.equal(qualification.edits.length,0);
});

test('presentation changes remain presentation changes and raw scenes have unknown provenance',()=>{
  const {doc,qualification}=seed(),next=structuredClone(doc);next.presentation.grid=true;
  const q=recordQualifiedEdit(doc,next,qualification);
  assert.equal(q.edits[0].kind,'presentation');assert.equal(qualificationSummary(next,q).physicsEdited,false);
  assert.equal(qualificationSummary(doc,null).status,'unknown');
});

test('observable and interpretation metadata are bounded data, never executable instructions',async()=>{
  assert.throws(()=>validateObservables([...image,...image]),/Duplicate/);
  assert.throws(()=>validateObservables([{id:'x',kind:'ideal-image',script:'run'}]),/fields/);
  const {doc,qualification}=seed();
  const bad=structuredClone(qualification);bad.interpretation={assumptions:['x'.repeat(1300)]};
  await assert.rejects(createQualifiedBundle(doc,bad,image),/bounded/);
  await assert.rejects(parseQualifiedBundle('x'.repeat(1024*1024+1)),/1 MB/);
});
