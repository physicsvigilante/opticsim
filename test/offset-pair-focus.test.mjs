import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/offset-pair-focus-a35.json');
function run(k,q){
  const p=JSON.parse(input);
  Object.assign(p.physical,{gapOverFrontFocalLength:k,rearOverFrontFocalLength:q});
  return planProblem(p).results[0];
}
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9,JSON.stringify({a,b}));
test('A35 source-faithful coefficient pair through byte-bound public workflow',async()=>{
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  const freeze=JSON.parse(bytes('../evaluation/offset-lens-parallel-focus-v1/frozen.json'));
  assert.equal(freeze.sha256,atlas.cases.find(c=>c.id==='A35').imageSha256);
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'offset-pair-focus-')),'a35');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');assert.equal(report.portable.status,'not-created');
  const r=report.results[0];assert.equal(r.status,'conditional');assert.equal(r.value.state,'downstream');
  near(r.value.xOverFrontFocalLength,5);near(r.value.transverseOffsetCoefficient,2);
});
test('shared matrix agrees with independent affine propagation from signed incident heights',()=>{
  for(const k of [.25,1,2,3,7])for(const q of [-3,-1,.5,1,2,5]){
    const v=run(k,q).value;
    for(const h of [-.08,.03,.09]){
      const atRear=h-k*h,slope=-h-(atRear-.013)/q;
      if(v.state==='afocal'){near(slope,.013/q);continue;}
      near(atRear+(v.xOverFrontFocalLength-k)*slope,.013*v.transverseOffsetCoefficient);
    }
  }
});
test('exact finite plane and afocal limits remain distinct from unresolved near cancellations',()=>{
  assert.equal(run(1.5,.5).value.state,'afocal');
  assert.equal(run(1.5+1e-14,.5).status,'numerically-indeterminate');
  assert.equal(run(1,2).value.state,'at-second-lens');assert.equal(run(2,2).value.xOverFrontFocalLength,0);
  assert.equal(run(2,2+1e-14).status,'numerically-indeterminate');
  assert.equal(run(0,1).value,null);assert.equal(run(1,0).value,null);
  const p=JSON.parse(input);p.physical.rearLensId=p.physical.frontLensId;
  assert.equal(planProblem(p).results[0].value,null);
});
