import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {planProblem} from '../src/problem-workflow.js';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/graded-slab-a15.json');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10,JSON.stringify({a,b}));
function numeric(){
  const p=JSON.parse(input);delete p.physical.geometryScale;
  Object.assign(p.physical,{lengthUnit:'mm',gradientLength:1,thickness:.3});
  return p;
}
const run=p=>planProblem(p).results[0];
test('A15 public symbolic path and first far-face position retain the exact critical limit',async()=>{
  const frozen=JSON.parse(bytes('../evaluation/graded-slab-first-passage-v1/frozen.json'));
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  assert.equal(frozen.sha256,atlas.cases.find(c=>c.id==='A15').imageSha256);
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'graded-slab-symbolic-')),'a15');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  const v=report.results[0].value;
  assert.equal(v.trajectory.quadraticCoefficient,.25);
  assert.equal(v.firstFarFacePoint.xOverGradientLength.coefficient,2);
  assert.equal(v.firstFarFacePoint.yOverGradientLength.kind,'thickness-ratio');
  assert.equal(v.emergence.state,'exact-critical-limit');
});
test('finite inward entry and normal special case agree at the first far face',()=>{
  for(const theta of [0,20,60,80]){
    const p=numeric(),rad=Math.PI/180;
    p.physical.entry={kind:'finite-incidence',angleFromNormalDeg:theta};
    const v=run(p).value;
    if(theta===0){assert.equal(v.trajectory.kind,'normal');assert.equal(v.firstFarFacePoint.x,0);}
    else{
      const q=Math.sin(theta*rad),b=Math.cos(theta*rad);
      near(v.firstFarFacePoint.x,2*q*(Math.sqrt(b*b+.3)-b));
      const x=v.firstFarFacePoint.x;
      near((v.trajectory.linearCoefficient+v.trajectory.quadraticCoefficientPerLengthUnit*x)*x,.3);
    }
    near(v.emergence.angleFromNormalDeg,theta);
  }
});
test('different exterior indices distinguish exit TIR, matching and uncertain incidence',()=>{
  const p=numeric();p.physical.entryIndex=1.25;p.physical.baseIndexSquared=1.5625;
  let v=run(p).value;
  assert.equal(v.emergence.state,'total-internal-reflection');near(v.firstFarFacePoint.x,2*1.25*Math.sqrt(.3));
  p.physical.exitIndex=Math.sqrt(1.8625);v=run(p).value;
  near(v.emergence.angleFromNormalDeg,Math.asin(1.25/Math.sqrt(1.8625))*180/Math.PI);
  p.physical.exitIndex=1.25+1e-13;assert.equal(run(p).value.emergence.state,'near-critical-unresolved');
  p.physical.baseIndexSquared=1.5625+1e-13;assert.equal(run(p).status,'numerically-indeterminate');
  p.physical.baseIndexSquared=1.3;assert.equal(run(p).reasonCode,'NO_INWARD_ENTRY');
});
