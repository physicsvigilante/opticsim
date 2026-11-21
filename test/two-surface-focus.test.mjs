import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const example=n=>JSON.parse(bytes('../examples/two-surface-focus-'+n+'.json'));
const run=p=>planProblem(p).results[0];
test('source-bound A29 and asymmetric example through public CLI',async()=>{
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  const protocol=JSON.parse(bytes('../evaluation/two-surface-paraxial-focus-v1/frozen-protocol.json'));
  assert.equal(atlas.cases.find(c=>c.id==='A29').imageSha256,protocol.source.imageSha256);
  const base='test-artifacts/llm-authoring';mkdirSync(base,{recursive:true});const out=mkdtempSync(join(base,'two-surface-query-'));
  for(const n of ['a29','asymmetric']){
    const {report}=await runProblemEvidence({inputBytes:bytes('../examples/two-surface-focus-'+n+'.json'),outputPath:join(out,n)});
    const r=report.results[0];assert.equal(r.status,'conditional');assert.equal(report.native.status,'not-run');
    assert.equal(report.portable.status,'not-created');
    if(n==='a29')assert.equal(r.value.forNonUnitRatio.signedDistanceFromRearPoleOverR,'(2-m)/(2*(m-1))');
    else{assert.ok(Math.abs(r.value.signedBackFocalDistance-2720/29)<1e-12);assert.ok(Math.abs(r.value.systemPowerD-29000/2880)<1e-12);}
  }
});
test('normalized complete sphere and general signed-surface composition agree',()=>{
  for(const m of [.5,.8,1,1.25,1.5,2,2.5,3.8]){
    const p=example('a29');p.physical.geometry={kind:'sphere',materialBasis:'relative-index',coreToExteriorRatio:m};
    const r=run(p).value;
    if(m===1){assert.equal(r.state,'afocal');assert.equal(r.signedDistanceFromCentreOverR,null);continue;}
    assert.ok(Math.abs(r.signedDistanceFromCentreOverR-m/(2*(m-1)))<1e-12);
    assert.ok(Math.abs(r.signedDistanceFromRearPoleOverR-(2-m)/(2*(m-1)))<1e-12);
    if(m===2)assert.equal(r.state,'at-rear-pole');
    const q=example('asymmetric'),g=q.physical.geometry;
    g.entranceIndex=g.exitIndex=m<1?2:1;g.coreIndex=g.entranceIndex*m;
    for(const [unit,R] of [['mm',100],['cm',10],['m',.1]]){
      g.lengthUnit=unit;g.front.signedRadius=R;g.rear.signedRadius=-R;g.axialThickness=2*R;
      const v=run(q).value;assert.equal(v.state,r.state);assert.ok(Math.abs(v.signedBackFocalDistance/R-r.signedDistanceFromRearPoleOverR)<1e-12);
    }
  }
});
test('exact zero system power, near cancellation and bounded refusals',()=>{
  const q=example('asymmetric'),g=q.physical.geometry;
  g.coreIndex=2;g.front.signedRadius=10;g.rear.signedRadius=-10;g.axialThickness=40;
  assert.equal(run(q).value.state,'afocal');g.axialThickness+=1e-12;assert.equal(run(q).status,'numerically-indeterminate');
  g.axialThickness=20+1e-12;assert.equal(run(q).status,'numerically-indeterminate');
  g.coreIndex=1+Number.EPSILON;assert.equal(run(q).status,'numerically-indeterminate');
  for(const mutate of [g=>delete g.exitIndex,g=>g.front.id=g.rear.id,g=>g.axialThickness=-1,g=>g.front.signedRadius='10',
    g=>g.rear.signedRadius=0,g=>g.entranceIndex=.99,g=>g.lengthUnit='other',g=>g.direction=1]){
    const p=example('asymmetric');mutate(p.physical.geometry);assert.equal(run(p).value,null);
  }
});
