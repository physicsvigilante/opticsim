import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem,resultCoverage} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/mirror-magnification-a07.json');
const original=()=>JSON.parse(input);
const result=p=>planProblem(p).results[0];
test('A07 preserves both real-object branches through the public workflow',async()=>{
  const frozen=JSON.parse(bytes('../evaluation/mirror-magnification-inverse-v1/frozen.json'));
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  assert.equal(frozen.sha256,atlas.cases.find(c=>c.id==='A07').imageSha256);
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'mirror-magnification-query-')),'a07');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  const v=report.results[0].value.candidates;
  assert.deepEqual(v.map(r=>[r.objectDistance,r.signedImageDistance,r.orientation]),[[7.5,-30,'upright'],[12.5,50,'inverted']]);
});
test('signed magnification isolates one branch and magnitude one does not admit object contact',()=>{
  const p=original();p.physical.target={kind:'signed',value:-4};
  assert.deepEqual(result(p).value.candidates.map(r=>r.objectDistance),[12.5]);
  p.physical.target={kind:'magnitude',value:1};
  assert.equal(result(p).branches[0].reasonCode,'OBJECT_ON_POLE');
  assert.deepEqual(result(p).value.candidates.map(r=>r.objectDistance),[20]);
  p.physical.target={kind:'magnitude',value:1+Number.EPSILON};
  const partial=result(p);
  assert.equal(partial.status,'partially-indeterminate');
  assert.equal(partial.branches[0].status,'numerically-indeterminate');
  assert.equal(partial.value.candidates.length,1);
  assert.equal(resultCoverage([partial]).available,0);
});
test('convex mirror from a real object supports only upright diminished images',()=>{
  const p=original();p.physical.focalLength=-10;p.physical.target.value=.5;
  const r=result(p);
  assert.deepEqual(r.value.candidates.map(v=>[v.objectDistance,v.signedImageDistance]),[[10,-5]]);
  assert.equal(r.branches[1].reasonCode,'VIRTUAL_OBJECT_REQUIRED');
  p.physical.target.value=2;assert.equal(result(p).status,'unavailable');
  p.physical.target.value=-2;assert.equal(result(p).status,'invalid-input');
  delete p.physical.focalLength;assert.equal(result(p).status,'needs-information');
});
