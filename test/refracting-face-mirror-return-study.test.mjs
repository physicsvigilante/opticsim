import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const core = createRequire(import.meta.url)('../dist/test-core.cjs');
const protocol = JSON.parse(readFileSync(new URL('../evaluation/refracting-face-mirror-return-study-v1/frozen.json', import.meta.url)));
const geometry = protocol.syntheticNativeGeometry;
const root = 'test-artifacts/llm-authoring';
mkdirSync(root, {recursive:true});
const records = mkdtempSync(join(root, 'refracting-face-mirror-return-'));
const point = (x,y) => ({x,y:-y});
const slope = ray => (ray.p1.y-ray.p2.y)/(ray.p2.x-ray.p1.x);

function trace(trial, height, launchSlope, withMirror) {
  const radius = trial.radiusMm, aperture = geometry.mirrorSemiHeightMm;
  const mirrorX = geometry.mirrorPoleXmm, detectorX = geometry.detectorXmm;
  const sag = aperture**2/(radius + Math.sqrt(radius**2-aperture**2));
  const source = {type:'SingleRay', brightness:geometry.brightness, p1:point(trial.sourceXmm,height),
    p2:point(trial.sourceXmm+10,height+10*launchSlope)};
  const glass = {type:'CircleGlass', p1:point(radius,0), p2:point(0,0),
    refIndex:geometry.insideIndex/geometry.outsideIndex, partialReflect:false};
  const mirror = {type:'ArcMirror', p1:point(mirrorX-sag,-aperture),
    p2:point(mirrorX-sag,aperture), p3:point(mirrorX,0)};
  const detector = {type:'Detector', p1:point(detectorX,-geometry.detectorSemiHeightMm),
    p2:point(detectorX,geometry.detectorSemiHeightMm), irradMap:false};
  const objs = [source, glass, ...(withMirror ? [mirror] : []), detector];
  const scene = core.loadNative({version:5, width:1200, height:700, origin:{x:250,y:350},
    scale:1, mode:'rays', lengthScale:1, rayModeDensity:0.1, maxRayDepth:geometry.maxRayDepth, objs});
  const callbacks = [], labels = withMirror ? ['glass','mirror','detector'] : ['glass','detector'];
  let emittedRay, starts = 0;
  const emitter = scene.objs[0], start = emitter.onSimulationStart;
  emitter.onSimulationStart = function(...args) {
    const result = start.apply(this,args);
    starts++;
    assert.equal(result.newRays.length,1);
    emittedRay = result.newRays[0];
    return result;
  };
  for (const [i,label] of labels.entries()) {
    const object = scene.objs[i+1], incident = object.onRayIncident;
    object.onRayIncident = function(ray,index,hit,...args) {
      assert.equal(ray,emittedRay);
      const before = {slope:slope(ray), sign:Math.sign(ray.p2.x-ray.p1.x)};
      const x = hit.x, y = -hit.y;
      const result = incident.call(this,ray,index,hit,...args);
      assert.ok(!result?.newRays?.length && !result?.isAbsorbed && !result?.isUndefinedBehavior);
      callbacks.push({label,x,y,before,after:{slope:slope(ray), sign:Math.sign(ray.p2.x-ray.p1.x)}});
      return result;
    };
  }
  let terminal;
  const sim = new core.Simulator(scene,null,null,null,null,null,false,1000);
  for (const event of ['simulationComplete','simulationStop']) sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics = core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  assert.equal(core.classifyRun(terminal,diagnostics),'completed');
  assert.equal(starts,1);
  return {height,launchSlope,withMirror,callbacks,diagnostics};
}

for (const trial of protocol.cases) test('pinned refracting face and immersed mirror '+trial.id, () => {
  const evidence = [], intercepts = [];
  for (const height of trial.heightsMm) for (const launchSlope of trial.slopes) {
    const observed = trace(trial,height,launchSlope,true);
    assert.deepEqual(observed.callbacks.map(c=>c.label),protocol.acceptance.requiredCallbackOrder);
    const [incoming,front,reflection,exit,returning] = observed.callbacks;
    assert.deepEqual([incoming,front,reflection,exit,returning].map(c=>[c.before.sign,c.after.sign]),
      [[1,1],[1,1],[1,-1],[-1,-1],[-1,-1]]);
    assert.ok(front.x < 0.01 && exit.x < 0.01);
    assert.ok(Math.abs(reflection.x-geometry.mirrorPoleXmm)<0.01 && Math.abs(reflection.y)<geometry.mirrorSemiHeightMm);
    assert.ok(Math.abs(returning.x-geometry.detectorXmm)<1e-8 && Math.abs(returning.before.slope)>1e-5);
    const axisX = returning.x-returning.y/returning.before.slope;
    assert.ok(Math.abs(axisX-trial.expectedAxisXmm)<protocol.acceptance.maxAxisResidualMm, String(axisX));
    intercepts.push(axisX);
    const control = trace(trial,height,launchSlope,false);
    assert.deepEqual(control.callbacks.map(c=>c.label),['detector','glass','glass']);
    assert.ok(control.callbacks.every(c=>c.after.sign===1));
    evidence.push({observed,axisX,control});
  }
  assert.equal(intercepts.length,2);
  assert.ok(Math.abs(intercepts[0]-intercepts[1])<protocol.acceptance.maxMirrorSymmetryResidualMm);
  writeFileSync(join(records,trial.id+'.json'),JSON.stringify(evidence,null,2),{flag:'wx'});
});
