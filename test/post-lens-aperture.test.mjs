import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave,validate} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-post-lens-aperture-v28.json',import.meta.url)));
const protocol=JSON.parse(readFileSync(new URL('../research/native-post-lens-aperture/frozen-protocol.json',import.meta.url)));
function setup(c={}) {
  const p=structuredClone(fixture.physical);
  const [beam,stop,lens,detector]=p.components.map(c=>c.parameters);
  lens.focalLength=c.focalLength??lens.focalLength;
  lens.apertureHeight=c.lensHeight??lens.apertureHeight;
  stop.x=c.stopX??stop.x;stop.length=c.length??stop.length;
  stop.openingLength=c.openingLength??stop.openingLength;
  for(const item of [beam,stop,lens,detector])item.x+=c.translateX??0;
  return {p,beam,stop,lens,detector};
}
for(const c of protocol.cases)test('public v28 '+c.id,async()=>{
  const {p}=setup(c);
  if(['endpoint','finite-lens-miss'].includes(c.withhold)){
    assert.throws(()=>prepareScene(p),/endpoint|lens rim/);
    return;
  }
  const doc=prepareScene(p).document;
  Object.assign(doc.simulation,{rayDensity:c.density??.2,maxRayDepth:c.maxRayDepth??8,processedRayLimit:c.processedRayLimit??10000});
  assert.equal(doc.schemaVersion,28);
  assert.deepEqual(parseSave(serializeSave(doc)),doc);
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  const {results}=await evaluateObservables(doc,fixture.requests,summary);
  if(c.withhold){
    assert.equal(summary.native.status,c.withhold);
    assert.equal(summary.observations,null);
    assert.ok(results.every(r=>r.status==='suppressed'));
  }else{
    assert.equal(summary.observations?.v28EndpointsVerified,true,JSON.stringify(summary.native));
    assert.deepEqual(results.slice(0,3).map(r=>r.value),[c.expectedAbsorbed+c.expectedDetector,c.expectedAbsorbed,c.expectedDetector]);
    assert.equal(results[3].value.length,c.expectedDetector);
  }
});
test('historical default stays v19; schema 28 requires its own finite geometry and fresh evidence',async()=>{
  const {p}=setup();
  delete p.model;assert.throws(()=>prepareScene(p),/downstream/);
  p.components[1].parameters.x=-50;
  assert.equal(prepareScene(p).document.schemaVersion,19);
  for(const edit of [
    o=>o.detector.y=7.5+o.detector.length/2,
    o=>o.stop.openingLength=12.501,
    o=>o.stop.x=.9999,o=>o.detector.x=o.stop.x+.99,
    o=>o.beam.directionDeg=180,o=>o.beam.brightness=.9,
    o=>o.stop.orientationDeg=89,o=>o.p.components.push({...o.p.components[3],id:'D2'}),
    o=>delete o.lens.focalLength,o=>o.p.model='unknown']){
    const o=setup();edit(o);assert.throws(()=>prepareScene(o.p));
  }
  const doc=prepareScene(setup().p).document;
  doc.simulation.rayDensity=.2125;assert.throws(()=>validate(doc),/unambiguous/);
  doc.simulation.rayDensity=.2;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  delete summary.observations.v28EndpointsVerified;
  summary.observations.v27EndpointsVerified=true;
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.status==='suppressed'));
});
test('zero detectors, finite detector misses, overflowing positions and loss of runtime evidence',async()=>{
  const no=setup();no.p.components.pop();
  const req=fixture.requests.slice(0,2);
  assert.equal(evaluateDocument(prepareScene(no.p).document,core,req).summary.observations.v28EndpointsVerified,true);
  const miss=setup();miss.detector.y=500;
  const doc=prepareScene(miss.p).document;
  const {summary}=evaluateDocument(doc,core,fixture.requests);
  assert.equal(summary.observations.detectorsById.D1.crossings,0);
  const disturbed={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    const obj=loaded.scene.objs[loaded.idMap.get('A1')];
    obj.onRayIncident=()=>({isAbsorbed:true}); // test-only missing callback
    return loaded;
  }};
  assert.equal(evaluateDocument(doc,disturbed,fixture.requests).summary.observations,null);
  const dense=setup({stopX:100});
  const full=prepareScene(dense.p).document;full.simulation.rayDensity=1;
  const ev=evaluateDocument(full,core,fixture.requests);
  const {results}=await evaluateObservables(full,fixture.requests,ev.summary);
  assert.equal(results[2].value,40);assert.equal(results[3].value,null);
});
