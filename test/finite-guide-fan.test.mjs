import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
import {parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/finite-guide-fan-v36.json',import.meta.url)));
const original=()=>structuredClone(fixture.physical);
const run=(doc,runner=core)=>evaluateDocument(doc,runner,fixture.requests).summary;
const counts={emitted:5,directFarFace:0,guidedFarFace:3,sideLeak:2};

test('v36 preserves native exit classes even if all five rays reach the downstream detector',async()=>{
  for(const [heading,dx,dy,orientation] of [[65,0,0,90],[-66.2,320,-450,-90],[65,-9000,9500,90]]){
    const p=original(),[source,glass,detector]=p.components;
    source.emission.directionDeg=heading;
    detector.parameters.orientationDeg=orientation;
    for(const component of [source,detector]){component.parameters.x+=dx;component.parameters.y+=dy;}
    for(let i=1;i<=4;i++){glass.parameters['x'+i]+=dx;glass.parameters['y'+i]+=dy;}
    const doc=prepareScene(p).document;
    assert.equal(doc.schemaVersion,36);
    assert.deepEqual(parseSave(serializeSave(doc)),doc);
    assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['AngleSource','Glass','Detector']);
    const summary=run(doc);
    assert.equal(summary.observations?.v36GuideFanVerified,true,summary.native.error??summary.native.errors.join(','));
    const {results}=await evaluateObservables(doc,fixture.requests,summary);
    assert.deepEqual(results.map(r=>r.value),[counts,10,5]);
    assert.equal(Math.sign(summary.observations.detectorsById.D.signedPower),-Math.sign(orientation));
  }
});

test('v36 distinguishes direct exits and withholds a critical sampled wall encounter',async()=>{
  const p=original(),[source,glass,detector]=p.components;
  source.emission.directionDeg=1;
  source.emission.angleDeg=14;
  p.rayDensity=.2;
  glass.parameters.x2=glass.parameters.x3=35;
  glass.parameters.y1=glass.parameters.y2=-17.5;
  glass.parameters.y3=glass.parameters.y4=17.5;
  detector.parameters.x=45;
  let doc=prepareScene(p).document,summary=run(doc);
  assert.equal(summary.observations?.v36GuideFanVerified,true);
  const {results}=await evaluateObservables(doc,fixture.requests,summary);
  assert.deepEqual(results.map(r=>r.value),[{emitted:4,directFarFace:4,guidedFarFace:0,sideLeak:0},0,4]);
  const critical=original();
  critical.components[0].emission.directionDeg=Math.asin(Math.sqrt(1.36**2-1))*180/Math.PI-15;
  doc=prepareScene(critical).document;summary=run(doc);
  assert.equal(summary.observations,null);
  assert.match(summary.native.errors.join(','),/near-critical guide encounter/);
  assert.ok((await evaluateObservables(doc,fixture.requests,summary)).results.every(r=>r.value===null));
});

test('v36 withholds lost paths, changed detector power and stale proof',async()=>{
  const doc=prepareScene(original()).document,valid=run(doc);
  delete valid.observations.v36GuideFanVerified;
  assert.ok((await evaluateObservables(doc,fixture.requests,valid)).results.every(r=>r.status==='suppressed'));
  const missing={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('G')].checkRayIntersects=()=>undefined;
    return loaded;
  }};
  assert.equal(run(doc,missing).observations,null);
  const displaced={...core,Simulator:class extends core.Simulator{
    emit(event,...args){
      if(event==='simulationComplete')this.scene.objs.find(o=>o.constructor.type==='Detector').power+=1;
      return super.emit(event,...args);
    }
  }};
  assert.equal(run(doc,displaced).observations,null);
  doc.simulation.processedRayLimit=1;
  const stopped=run(doc);
  assert.equal(stopped.native.status,'stopped');
  assert.equal(stopped.observations,null);
});

test('v36 distinguishes finite detector misses from omitted hits and numerical endpoints',async()=>{
  const p=original(),doc=prepareScene(p).document,detector=p.components[2].parameters;
  const hitRequests=[...fixture.requests,{id:'positions',kind:'detector-hit-events',componentId:'D'}];
  const events=evaluateDocument(doc,core,hitRequests).summary.observations.detectorHitEventsById.D.events;
  detector.y=events[0].pointMm.y+detector.length/2;
  const nearEnd=run(prepareScene(p).document);
  assert.equal(nearEnd.observations,null);
  assert.match(nearEnd.native.errors.join(','),/ambiguous downstream detector endpoint/);
  const omitted={...core,loadDocument(...args){
    const loaded=core.loadDocument(...args);
    loaded.scene.objs[loaded.idMap.get('D')].checkRayIntersects=()=>undefined;
    return loaded;
  }};
  assert.equal(run(doc,omitted).observations,null);
  detector.y=400;
  const missed=prepareScene(p).document;
  const {results}=await evaluateObservables(missed,fixture.requests,run(missed));
  assert.deepEqual(results.map(r=>r.value),[counts,10,0]);
});

test('v36 rejects unsupported material, finite geometry and legacy authoring',()=>{
  for(const edit of [
    p=>delete p.model,
    p=>p.components[1].parameters.partialReflection=true,
    p=>p.components[1].parameters.outsideIndex=1.1,
    p=>p.components[1].parameters.y2=-9,
    p=>p.components[0].parameters.x=-5,
    p=>p.components[0].emission.mode='full-circle',
    p=>p.components[2].parameters.x=80,
    p=>p.rayDensity=.05
  ]){
    const p=original();edit(p);assert.throws(()=>prepareScene(p));
  }
});
