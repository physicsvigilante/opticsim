import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planProblem} from '../src/problem-workflow.js';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const example=()=>read('../examples/lens-mirror-parallel-return.json');
const controls=read('../evaluation/lens-mirror-parallel-return-v1/frozen.json').syntheticUnequal;
const run=p=>planProblem(p).results[0];

test('Problem 012 admits two parallel return spacings with opposite lens heights',()=>{
  const result=run(example());
  assert.equal(result.status,'conditional');
  assert.equal(result.nativeObservation,false);
  assert.equal(result.value.returnedImage,'at-infinity');
  assert.deepEqual(result.value.placements.map(p=>[p.gap,p.returnHeightScale]),[[1,-1],[2,1]]);
});
test('unequal geometry agrees with sequential paraxial propagation in each declared unit',()=>{
  for(const [unit,scale] of [['mm',1],['cm',10],['m',1000]]){
    const p=example(), f=p.physical;
    f.lengthUnit=unit;
    f.lens.focalLength=controls.focalLengthMm/scale;
    f.mirror.radiusMagnitude=controls.mirrorRadiusMm/scale;
    const results=run(p).value.placements;
    const verify=(gap,height,finalSlope)=>{
      const slope=-1/controls.focalLengthMm;
      const mirrorHeight=1+gap*slope;
      const reflected=slope-2*mirrorHeight/controls.mirrorRadiusMm;
      const returnHeight=mirrorHeight+gap*reflected;
      assert.ok(Math.abs(returnHeight-height)<1e-12);
      assert.ok(Math.abs(reflected-returnHeight/controls.focalLengthMm-finalSlope)<1e-14);
    };
    for(const [i,item] of results.entries()){
      assert.equal(item.gap*scale,controls.expectedParallelGapsMm[i]);
      verify(item.gap*scale,item.returnHeightScale,0);
    }
    verify(controls.intermediateGapMm,controls.intermediateHeightScale,controls.intermediateSlopePerMm);
  }
});
test('retains both placements across input limits and rejects unsupported incidence and missing radius',()=>{
  const p=example(),f=p.physical;
  f.lengthUnit='mm';
  f.lens.focalLength=10000;
  f.mirror.radiusMagnitude=10000;
  assert.deepEqual(run(p).value.placements.map(x=>x.gap),[10000,20000]);
  f.incidence='finite-object';
  assert.equal(run(p).status,'unavailable');
  f.incidence='collimated-along-axis';
  delete f.mirror.radiusMagnitude;
  assert.equal(run(p).status,'needs-information');
});
