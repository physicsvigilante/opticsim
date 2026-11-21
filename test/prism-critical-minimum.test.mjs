import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/prism-angular-limits-a22.json');
const rad=Math.PI/180;
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10,JSON.stringify({a,b}));
test('A22 public requests verify the limiting index and symmetric incidence under explicit exterior',async()=>{
  const frozen=JSON.parse(bytes('../evaluation/prism-critical-minimum-v1/frozen.json'));
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  assert.equal(frozen.sha256,atlas.cases.find(c=>c.id==='A22').imageSha256);
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'prism-limits-')),'a22');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  const [index,min]=report.results;
  near(index.value.insideIndex,Math.sqrt(5));assert.equal(index.value.boundary,'critical-limit');
  near(min.value.incidenceAngleDeg,Math.asin(Math.sqrt(5)*Math.sin(22.5*rad))/rad);
});
test('common exterior changes absolute but not relative inferred index',()=>{
  const p=JSON.parse(input);p.physical.outsideIndex=1.4;
  const [index,min]=planProblem(p).results;
  near(index.value.insideIndex,1.4*Math.sqrt(5));near(index.value.relativeIndex,Math.sqrt(5));
  const i=min.value.incidenceAngleDeg;
  near(min.value.minimumDeviationDeg,2*i-45);
  for(const first of [19,21,24,26]){
    const second=45-first;
    const deviation=(Math.asin(Math.sqrt(5)*Math.sin(first*rad))+Math.asin(Math.sqrt(5)*Math.sin(second*rad)))/rad-45;
    if(Number.isFinite(deviation))assert.ok(deviation>min.value.minimumDeviationDeg);
  }
});
test('missing facts, critical symmetry and no strict direct branch remain distinct',()=>{
  const p=JSON.parse(input);
  const min=()=>planProblem(p).results[1];
  p.physical.material={kind:'known-index',insideIndex:2};
  p.physical.apexAngleDeg=60;assert.equal(min().status,'numerically-indeterminate');
  p.physical.material.insideIndex=2.1;assert.equal(min().reasonCode,'NO_STRICT_DIRECT_BRANCH');
  p.physical.material.insideIndex=1.5;assert.equal(min().status,'conditional');
  delete p.physical.outsideIndex;assert.equal(min().status,'needs-information');
});
