import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planProblem} from '../src/problem-workflow.js';

const read=name=>JSON.parse(readFileSync(new URL('../examples/'+name+'.json',import.meta.url)));
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,JSON.stringify({actual:a,expected:b}));

test('A38 source alone leaves equal-gain swap unresolved without invented distances',()=>{
  const plan=planProblem(read('two-lens-swap-a38'));
  assert.equal(plan.results[0].status,'needs-information');
  assert.equal(plan.results[0].value,null);
  const explicit=read('two-lens-finite-viewing');
  explicit.physical.eyeDistanceFromEyepiece=25;
  const other=planProblem(explicit).results[1];
  assert.equal(other.status,'conditional');
  close(other.value.swapped.lensPlaneSeparation,125.1764705882353);
});

test('finite viewing and lens exchange agree with the explicit controls in mm and m',()=>{
  for(const scale of [1,1000]){
    const p=read('two-lens-finite-viewing'),f=p.physical;
    f.lengthUnit=scale===1?'mm':'m';
    for(const lens of [f.objective,f.eyepiece])lens.focalLength/=scale;
    for(const key of ['lensPlaneSeparation','objectDistanceFromObjective','eyeDistanceFromEyepiece'])f[key]/=scale;
    const [before,swap]=planProblem(p).results;
    assert.equal(before.status,'conditional');
    assert.equal(swap.status,'conditional');
    assert.deepEqual(before.value.initial,swap.value.initial);
    assert.equal(swap.nativeObservation,false);
    const {initial,swapped}=swap.value;
    assert.deepEqual([swapped.objectiveId,swapped.eyepieceId],[initial.eyepieceId,initial.objectiveId]);
    close(initial.signedAngularGain,174/137);
    close(swapped.signedAngularGain,initial.signedAngularGain);
    close(swapped.lensPlaneSeparation*scale,26000/101);
    close(initial.signedVirtualDistanceFromEye*scale,-1370);
    close(swapped.signedVirtualDistanceFromEye*scale,-1309.399684044243);
  }
});

test('finite-viewing keeps the sign of an inverted virtual image and withholds other branches',()=>{
  const p=read('two-lens-finite-viewing'),f=p.physical;
  f.objectDistanceFromObjective=80;
  assert.ok(planProblem(p).results.every(r=>r.status==='numerically-indeterminate'));
  f.objectDistanceFromObjective=81;
  assert.ok(planProblem(p).results.every(r=>r.status==='unavailable'));
  Object.assign(f,{objectDistanceFromObjective:100,lensPlaneSeparation:110});
  f.objective.focalLength=50;
  f.eyepiece.focalLength=25;
  const gain=planProblem(p).results[0].value.initial;
  close(gain.signedAngularGain,-6.5);
  close(gain.signedVirtualDistanceFromEye,-200/3);
  delete f.swapPolicy;
  assert.equal(planProblem(p).results[1].status,'needs-information');
});

test('exactly parallel equal-gain relations classify no solution and no unique separation',()=>{
  const p=read('two-lens-finite-viewing'),f=p.physical;
  f.objective.focalLength=3;
  f.eyepiece.focalLength=4;
  Object.assign(f,{objectDistanceFromObjective:6,eyeDistanceFromEyepiece:2,lensPlaneSeparation:7});
  assert.equal(planProblem(p).results[0].status,'conditional');
  assert.equal(planProblem(p).results[1].reasonCode,'NO_EQUAL_GAIN_SEPARATION');
  f.eyepiece.focalLength=5;
  Object.assign(f,{objectDistanceFromObjective:4,eyeDistanceFromEyepiece:4,lensPlaneSeparation:13});
  assert.equal(planProblem(p).results[0].status,'conditional');
  assert.equal(planProblem(p).results[1].reasonCode,'NO_FINITE_VIRTUAL_SWAP');
  f.objective.focalLength=f.eyepiece.focalLength=12;
  Object.assign(f,{objectDistanceFromObjective:30,eyeDistanceFromEyepiece:10,lensPlaneSeparation:25});
  close(planProblem(p).results[0].value.initial.signedAngularGain,-4);
  assert.equal(planProblem(p).results[1].reasonCode,'SEPARATION_NOT_IDENTIFIED');
});
