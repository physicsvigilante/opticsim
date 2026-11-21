import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planProblem} from '../src/problem-workflow.js';
import {analyzeSurfaceConjugate, CONJUGATE_FACTS, CONJUGATE_QUERY} from '../src/refracting-surface-conjugate.js';

const frozen = JSON.parse(readFileSync(new URL('../evaluation/thick-lens-finite-conjugate-study-v1/frozen.json', import.meta.url)));
const face = (id, x, signedRadius, transmittedIndex) => ({id, x, signedRadius, transmittedIndex});
const query = {format: CONJUGATE_QUERY, kind: 'refracting-surface-conjugate'};
test('problem workflow qualifies only complete separated surfaces and withholds near collimation', () => {
  const problem = JSON.parse(readFileSync(new URL('../examples/refracting-surface-conjugate.json', import.meta.url)));
  const run = () => planProblem(problem).results[0];
  assert.equal(run().nativeObservation, false);
  assert.ok(Math.abs(run().value.signedDistanceFromLastPole-36.25286507359877)<1e-10);
  const surface = face('front', 0, 50, 1.5);
  problem.physical = facts(-100.0000000001, [surface]);
  assert.equal(run().status, 'numerically-indeterminate');
  delete surface.transmittedIndex;
  assert.equal(run().status, 'needs-information');
  surface.transmittedIndex = 1.5;
  problem.physical.surfaces.push({...surface, x: 50});
  assert.equal(run().status, 'invalid-input');
  problem.physical.surfaces[1] = {...surface, id: 'rear', x: -10};
  assert.equal(run().status, 'unavailable');
});
function facts(objectX, surfaces, extra = {}) {
  return {format: CONJUGATE_FACTS, model: 'coaxial-paraxial-positive-x', lengthUnit: 'mm',
    entranceIndex: 1, objectX, surfaces, ...extra};
}

test('one planar refraction gives the virtual apparent depth seen from the transmitted medium', () => {
  const result = analyzeSurfaceConjugate(facts(-90, [face('waterToAir', 0, 'infinity', 1)], {entranceIndex: 1.5}), query);
  assert.equal(result.value.signedDistanceFromLastPole, -60);
  assert.equal(result.value.transverseMagnification, 1);
  assert.equal(Object.hasOwn(result.value, 'imageHeight'), false);
});

test('an exact focal object yields collimated output and a second plane can coincide with a finite conjugate', () => {
  const first = face('front', 0, 50, 1.5);
  assert.equal(analyzeSurfaceConjugate(facts(-100, [first]), query).value.state, 'at-infinity');
  const atRear = analyzeSurfaceConjugate(facts(-200, [first, face('rear', 300, 'infinity', 1)], {objectHeight: 2}), query);
  assert.equal(atRear.value.state, 'at-last-pole');
  assert.equal(atRear.value.imageHeight, -2);
});

for (const trial of frozen.trials) test('frozen thick-lens conjugate ' + trial.id, () => {
  const surfaces = trial.lensIds.flatMap(id => {
    const lens = frozen.lenses[id];
    return [face(id+'Front', lens.x-lens.centerThickness/2, lens.frontRadius, lens.insideIndex),
      face(id+'Rear', lens.x+lens.centerThickness/2, -lens.backRadius, lens.outsideIndex)];
  });
  const result = analyzeSurfaceConjugate(facts(surfaces[0].x-trial.objectDistanceFromFrontMm, surfaces), query);
  assert.equal(result.status, 'conditional');
  assert.ok(Math.abs(result.value.signedDistanceFromLastPole-trial.signedImageDistanceMm)<1e-10);
  assert.ok(Math.abs(result.value.transverseMagnification-trial.magnification)<1e-12);
  assert.equal(result.value.referenceFaceId, surfaces.at(-1).id);
});
