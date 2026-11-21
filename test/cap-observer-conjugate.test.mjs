import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/cap-observer-a27.json');
const scenario=()=>JSON.parse(input);
const run=p=>planProblem(p).results[0];
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-11,JSON.stringify({a,b}));
test('A27 signed position and observer distance through the public workflow',async()=>{
  const frozen=JSON.parse(bytes('../evaluation/finite-circular-cap-v1/frozen.json'));
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  assert.equal(frozen.sha256,atlas.cases.find(c=>c.id==='A27').imageSha256);
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'cap-observer-')),'a27');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  const v=report.results[0].value;
  near(v.distanceFromObserver,230/31);near(v.apparentPositionFromBase,18/31);
  near(v.signedImageDistanceFromPole,-75/31);
});
test('interior probe, equal materials and true hemisphere retain independent reference distances',()=>{
  const p=scenario();
  p.physical.object={kind:'interior-axial-point',depthFromBase:.1};
  let r=run(p).value;
  near(r.signedImageDistanceFromPole,1/(.6/5-1.6/2.9));
  near(r.distanceFromObserver,8-r.apparentPositionFromBase);
  p.physical.interiorIndex=1;r=run(p).value;
  near(r.apparentPositionFromBase,.1);near(r.distanceFromObserver,7.9);
  p.physical.interiorIndex=1.6;p.physical.capHeight=5;p.physical.object={kind:'base-contact-limit'};
  r=run(p).value;assert.equal(r.apparentPositionFromBase,0);near(r.distanceFromObserver,8);
});
test('invalid observer or point and unresolved material contrast withhold the requested coordinate',()=>{
  for(const change of [f=>f.observerDistanceFromBase=3,f=>f.capHeight=6,f=>delete f.exteriorIndex,
    f=>f.object={kind:'interior-axial-point',depthFromBase:0},f=>f.object={kind:'base-contact-limit',depthFromBase:.3}]){
    const p=scenario();change(p.physical);assert.equal(run(p).value,null);
  }
  const p=scenario();p.physical.interiorIndex=1+Number.EPSILON;
  assert.equal(run(p).status,'numerically-indeterminate');
});
