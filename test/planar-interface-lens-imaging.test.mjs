import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planProblem} from '../src/problem-workflow.js';
const example=()=>JSON.parse(readFileSync(new URL('../examples/layer-index-from-lens-images.json',import.meta.url)));
const frozen=JSON.parse(readFileSync(new URL('../evaluation/planar-interface-lens-conjugate-v1/frozen.json',import.meta.url)));
const run=p=>planProblem(p).results[0];
test('empty and filled image observations recover the source index and virtual control',()=>{
  for(const trial of frozen.cases)for(const [unit,scale] of [['cm',10],['mm',1],['m',1000]]){
    const p=example(), f=p.physical;
    Object.assign(f,{lengthUnit:unit,objectLensDistance:trial.objectLensMm/scale,layerDepth:trial.depthMm/scale,
      dryImageDistance:trial.dryImageMm/scale,filledImageDistance:trial.wetImageMm/scale});
    const result=run(p);
    assert.equal(result.nativeObservation,false);
    assert.ok(Math.abs(result.value.layerIndex-trial.insideIndex)<1e-12);
    delete f.filledImageDistance;
    f.layerIndex=trial.insideIndex;
    p.requests[0].kind='layer-lens-image-distance';
    assert.ok(Math.abs(run(p).value.signedImageDistance*scale-trial.wetImageMm)<1e-9);
  }
});
test('collimated, near-collimated and matched configurations retain distinct results',()=>{
  const p=example(),f=p.physical;
  delete f.filledImageDistance;
  Object.assign(f,{lengthUnit:'mm',objectLensDistance:30,layerDepth:20,dryImageDistance:60,layerIndex:2});
  p.requests[0].kind='layer-lens-image-distance';
  assert.equal(run(p).value.state,'at-infinity');
  f.layerIndex=2.000000000001;
  assert.equal(run(p).status,'numerically-indeterminate');
  f.layerIndex=1;
  assert.equal(run(p).value.signedImageDistance,60);
});
test('retain missing material facts, insufficient gap, and incompatible image observations',()=>{
  const p=example(), f=p.physical;
  f.filledImageDistance=10;
  assert.equal(run(p).reasonCode,'NO_ADMISSIBLE_LAYER_INDEX');
  f.layerDepth=f.objectLensDistance;
  assert.equal(run(p).status,'unavailable');
  delete f.exteriorIndex;
  assert.equal(run(p).status,'needs-information');
});
