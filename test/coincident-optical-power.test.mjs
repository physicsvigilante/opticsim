import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {validate} from '../src/contract.js';

const bytes=path=>readFileSync(new URL(path,import.meta.url));
const json=path=>JSON.parse(bytes(path));
const example=id=>json('../examples/optical-power-'+id+'.json');
const run=p=>planProblem(p).results[0];
test('frozen source inputs execute through public evidence workflow',async()=>{
  const protocol=bytes('../evaluation/coincident-power-v1/frozen-protocol.json');
  assert.equal(createHash('sha256').update(protocol).digest('hex'),'420a37d5c9c7166e590174f31922951d9b5ebb7deae25bed4ba64dd98f50cb92');
  const atlas=json('../evaluation/optical-systems-atlas-v1/review.json');
  const base='test-artifacts/llm-authoring';mkdirSync(base,{recursive:true});
  const dir=mkdtempSync(join(base,'coincident-power-'));
  const values=[];
  for(const {id,sha256} of JSON.parse(protocol).cases){
    assert.equal(atlas.cases.find(c=>c.id===id).imageSha256,sha256);
    const {report}=await runProblemEvidence({inputBytes:bytes('../examples/optical-power-'+id.toLowerCase()+'.json'),
      outputPath:join(dir,id)});
    assert.equal(report.native.status,'not-run');assert.equal(report.portable.status,'not-created');
    assert.equal(report.results[0].status,'conditional');values.push(report.results[0].value);
  }
  assert.equal(values[0].powerD,10);assert.equal(values[0].focalLength.signedDistanceM,.1);
  assert.deepEqual([values[1].initialD,values[1].finalD,values[1].fixedOutgoingD,values[1].changeD],[20,24,60,4]);
  assert.equal(values[2].requiredD,-.5);
});
test('signed conjugates, exact zero, and near cancellation',()=>{
  const p=example('a32');p.physical.elements=[{id:'A',powerD:4}];
  p.requests[0].kind='outgoing-vergence';p.physical.condition={kind:'forward',incoming:{signedDistanceM:-.5}};
  assert.equal(run(p).value.image.signedDistanceM,.5);
  p.physical.condition.incoming={signedDistanceM:.5};assert.equal(run(p).value.outgoingD,6);
  p.physical.condition.incoming={signedDistanceM:-.25};assert.equal(run(p).value.image.kind,'at-infinity');
  p.physical.condition.incoming={signedDistanceM:-.25+1e-14};assert.equal(run(p).status,'numerically-indeterminate');
  delete p.physical.condition;p.requests[0].kind='contact-equivalent-power';
  p.physical.elements.push({id:'B',powerD:-4});assert.equal(run(p).value.focalLength.kind,'at-infinity');
  p.physical.elements=[{id:'A',focalLengthM:.1},{id:'B',powerD:-10}];
  assert.equal(run(p).status,'numerically-indeterminate','rounded reciprocal cancellation is not exact on the input binary64 values');
  p.physical.elements[1]={id:'B',focalLengthM:-.1};assert.equal(run(p).value.powerD,0);
});
test('invalid or missing conditions, planes, IDs and distances remain unresolved',()=>{
  for(const mutate of [p=>delete p.physical.referencePlane,p=>p.physical.referencePlane='spectacles-at-12-mm',
    p=>p.physical.elements[1].id='cornea',p=>p.physical.condition.adjustId='other',p=>p.physical.condition.finalIncoming={signedDistanceM:0},
    p=>delete p.physical.condition.kind,p=>p.physical.elements[0].x=0,p=>p.physical.elements[0].focalLengthM=.025]){
    const p=example('a36');mutate(p);assert.equal(run(p).value,null);
  }
  const p=example('a37');p.physical.elements.push({id:'other',unknown:true});assert.equal(run(p).value,null);
});
test('native single equivalent lens corroborates collimated focus; native contact still rejected',()=>{
  const old=json('../test/fixtures/multilens-extreme.json');
  old.physics.components[2].parameters.x=old.physics.components[1].parameters.x;
  assert.throws(()=>validate(old),/separation/);
  const power=run(example('a32')).value;
  const physical=json('../examples/native-post-lens-aperture-v28.json').physical;
  delete physical.model;
  physical.components=physical.components.filter(c=>c.type!=='finite-aperture');
  const detector=physical.components.find(c=>c.type==='ray-detector');
  detector.parameters.x=power.focalLength.signedDistanceM*1000;
  const doc=prepareScene(physical).document;
  const requests=[{id:'focusSamples',kind:'detector-hit-events',componentId:detector.id}];
  const core=createRequire(import.meta.url)('../dist/test-core.cjs');
  const {summary}=evaluateDocument(doc,core,requests);
  assert.equal(summary.native.status,'completed');assert.deepEqual(summary.native.warnings,[]);
  const sample=summary.observations.detectorHitEventsById[detector.id];
  assert.equal(sample.status,'complete');
  const hits=sample.events;
  assert.ok(hits.length>=2);assert.equal(hits.length,summary.native.emitted);
  for(const hit of hits)assert.ok(Math.abs(hit.pointMm.y)<1e-7);
});
