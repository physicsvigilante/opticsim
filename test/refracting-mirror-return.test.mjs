import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planProblem} from '../src/problem-workflow.js';

const example = name => JSON.parse(readFileSync(new URL('../examples/'+name+'.json',import.meta.url)));
const frozen = JSON.parse(readFileSync(new URL('../evaluation/refracting-face-mirror-return-study-v1/frozen.json',import.meta.url)));
const run = p => planProblem(p).results[0];
test('conditional source examples give 15 cm of converging power-equivalent focus and 12.5 cm real self-conjugacy',()=>{
  const p = example('refracting-mirror-return-focus'), a = run(p);
  assert.equal(a.status,'conditional');
  assert.equal(a.nativeObservation,false);
  assert.equal(a.value.equivalentPowerAction,'converging');
  assert.equal(a.value.frontFocusState,'real-return-focus');
  assert.equal(a.value.signedFrontFocusDistance,15);
  assert.equal(a.value.effectiveFocalLength,15);
  assert.deepEqual(run(example('refracting-mirror-self-conjugate')).value.objectDistances,[12.5]);
  delete p.physical.exteriorIndex;
  assert.equal(run(p).status,'needs-information');
});
test('finite separation matches the independent frozen native control predictions',()=>{
  for (const trial of frozen.cases) {
    const p = example(trial.id==='collimated-reflection'?'refracting-mirror-return-focus':'refracting-mirror-self-conjugate');
    p.physical.lengthUnit='mm';
    p.physical.geometry={kind:'signed-poles',frontSignedRadius:trial.radiusMm,mirrorSignedRadius:-trial.radiusMm,poleSeparation:20};
    const result=run(p);
    assert.equal(result.status,'conditional');
    const value=result.value;
    const distance=value.objectDistances?.[0]??value.signedFrontFocusDistance;
    assert.ok(Math.abs(distance+trial.expectedAxisXmm)<1e-10);
    if (value.effectiveFocalLength) assert.notEqual(value.effectiveFocalLength,distance);
  }
});
test('plane, convex and matched-index mirror limits and invalid placements',()=>{
  const p=example('refracting-mirror-self-conjugate'), f=p.physical, g=f.geometry;
  f.interiorIndex=1;
  g.frontSignedRadius='infinity';
  g.mirrorSignedRadius=25;
  assert.deepEqual(run(p).value.objectDistances,[]);
  p.requests[0].kind='refracting-mirror-return-focus';
  assert.equal(run(p).value.effectiveFocalLength,-12.5);
  g.mirrorSignedRadius='infinity';
  assert.equal(run(p).value.equivalentPowerAction,'afocal');
  assert.equal(run(p).value.frontFocusState,'at-infinity');
  g.poleSeparation=-2;
  assert.equal(run(p).status,'unavailable');
});

test('a focusing front face and plane mirror retain both positive object placements and the finite afocal branch',()=>{
  const p=example('refracting-mirror-self-conjugate');
  p.physical.lengthUnit='mm';
  p.physical.geometry={kind:'signed-poles',frontSignedRadius:10,mirrorSignedRadius:'infinity',poleSeparation:60};
  assert.deepEqual(run(p).value.objectDistances,[20,40]);
  p.physical.geometry.poleSeparation=30;
  assert.deepEqual(run(p).value.objectDistances,[20]);
  p.physical.geometry.poleSeparation=30.00000000001;
  assert.equal(run(p).status,'numerically-indeterminate');
});

test('positive equivalent power can have a virtual front focus for separated poles',()=>{
  const p=example('refracting-mirror-return-focus');
  p.physical.lengthUnit='mm';
  p.physical.geometry={kind:'signed-poles',frontSignedRadius:10,mirrorSignedRadius:'infinity',poleSeparation:22.5};
  const separated=run(p).value;
  assert.equal(separated.equivalentPowerAction,'converging');
  assert.equal(separated.effectiveFocalLength,40);
  assert.equal(separated.frontFocusState,'virtual-return-focus');
  assert.equal(separated.signedFrontFocusDistance,-20);
  p.physical.geometry.poleSeparation=15;
  assert.equal(run(p).value.frontFocusState,'at-front-pole');
});
