import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem,resultCoverage} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/axial-mirror-oscillation-a08.json');
const original=()=>JSON.parse(input);
const r=p=>planProblem(p).results[0];
test('A08 public report keeps the coincidence phases and the exact focal state',async()=>{
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  const frozen=JSON.parse(bytes('../evaluation/axial-mirror-oscillation-v1/frozen.json'));
  assert.equal(frozen.sha256,atlas.cases.find(c=>c.id==='A08').imageSha256);
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'axial-mirror-oscillation-')),'a08');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  const v=report.results[0].value;
  assert.deepEqual(v.coincidenceEvents.phases,[.25,.75]);
  assert.deepEqual(v.focalEvents.phases,[.5]);
  assert.deepEqual(v.samples.map(s=>s.signedImageDistanceOverFocalLength),[1.5,2,null,2]);
  assert.deepEqual(v.samples.map(s=>s.lateralMagnification),[-.5,-1,null,-1]);
  assert.equal(v.samples[2].state,'afocal');
});
test('real/virtual crossings use separate finite and unresolved phase outputs',()=>{
  const p=original();Object.assign(p.physical,{meanDistanceOverFocalLength:1.2,amplitudeOverFocalLength:.5});
  const law=r(p).value;
  assert.equal(law.focalEvents.state,'finite-set');assert.equal(law.coincidenceEvents.state,'none');
  assert.equal(law.samples[0].state,'finite-real');assert.equal(law.samples[2].state,'finite-virtual');
  p.physical.samplePhases=law.focalEvents.phases;
  const partial=r(p);
  assert.ok(partial.value.samples.every(s=>s.state==='numerically-indeterminate'));
  assert.equal(partial.status,'partially-indeterminate');
  assert.equal(resultCoverage([partial]).available,0);
  p.physical.meanDistanceOverFocalLength=1.5+1e-12;
  assert.equal(r(p).value.focalEvents.state,'numerically-indeterminate');
});
test('constant and nonphysical cycles remain distinct',()=>{
  const p=original();Object.assign(p.physical,{meanDistanceOverFocalLength:1,amplitudeOverFocalLength:0,samplePhases:[.19]});
  assert.equal(r(p).value.focalEvents.state,'all-phases');assert.equal(r(p).value.samples[0].state,'afocal');
  p.physical.meanDistanceOverFocalLength=2;assert.equal(r(p).value.coincidenceEvents.state,'all-phases');
  p.physical.amplitudeOverFocalLength=3;assert.equal(r(p).value,null);
});
