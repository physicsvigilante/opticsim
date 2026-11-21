import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {qualifyRunnerSummary} from '../src/native-observations.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url)));
const fixture=read('../examples/native-refractive-fan-v29.json');
const protocol=read('../research/refractive-fan-j11/frozen-protocol.json');
for(const c of protocol.cases)test('public v29 '+c.id,async()=>{
  const p=structuredClone(fixture.physical);
  Object.assign(p.components[0].emission,{directionDeg:90-c.axisIncidenceDeg,angleDeg:c.coneDeg});
  p.rayDensity=c.density;
  if(c.caseWitness==='withheld'){
    assert.throws(()=>prepareScene(p),/Near-critical/);
    return;
  }
  const doc=prepareScene(p).document;
  assert.deepEqual(parseSave(serializeSave(doc)),doc);
  assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['AngleSource','PlaneGlass']);
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  const {results}=await evaluateObservables(doc,fixture.requests,summary);
  assert.equal(summary.observations?.v29FanVerified,true);
  assert.deepEqual(results.map(r=>r.value),[c.expected.length,c.expected.length,c.expected.filter(x=>x==='TIR').length]);
});
test('historical selection and bounded geometry, material and numerical input',()=>{
  const p=structuredClone(fixture.physical);
  delete p.model;delete p.rayDensity;
  assert.throws(()=>prepareScene(p),/single-ray|emission/);
  p.components[0].emission.mode='single-ray';
  assert.equal(prepareScene(p).document.schemaVersion,5);
  p.rayDensity=.08;assert.throws(()=>prepareScene(p),/rayDensity/);
  for(const mutate of [
    p=>p.components.push({...p.components[1],id:'I2'}), p=>p.components.pop(),
    p=>p.components[0].parameters.y=-.99,p=>p.components[1].parameters.normalDeg=89,
    p=>p.components[1].parameters.partialReflection=true,p=>delete p.components[1].parameters.negativeIndex,
    p=>p.components[0].emission.directionDeg=0,p=>p.components[0].parameters.brightness=.081,
    p=>p.rayDensity=NaN,p=>p.rayDensity=.047,
    p=>{p.rayDensity=1;Object.assign(p.components[0].emission,{angleDeg:150,directionDeg:90});}
  ]){
    const candidate=structuredClone(fixture.physical);mutate(candidate);assert.throws(()=>prepareScene(candidate));
  }
});
test('a missing callback, terminal stop or absent v29 evidence withholds all readings',async()=>{
  const doc=prepareScene(fixture.physical).document;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  delete summary.observations.v29FanVerified;
  summary.observations.v28EndpointsVerified=true;
  assert.equal(qualifyRunnerSummary(doc,summary).observations,null);
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.status==='suppressed'));
  const disturbed={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('I')].onRayIncident=()=>({isAbsorbed:true});
    return loaded;
  }};
  assert.equal(evaluateDocument(doc,disturbed,fixture.requests).summary.observations,null);
  doc.simulation.processedRayLimit=1;
  assert.equal(evaluateDocument(doc,core,fixture.requests).summary.observations,null);
});
