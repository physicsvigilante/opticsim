import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const example=id=>JSON.parse(bytes('../examples/semicircular-interval-'+id+'.json'));
const result=p=>planProblem(p).results[0];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,JSON.stringify({a,b}));
test('A14 and A20 public evidence preserves source and separates intervals from native traces',async()=>{
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  const study=JSON.parse(bytes('../evaluation/semicircular-boundary-intervals-v1/frozen.json'));
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const out=mkdtempSync(join(root,'boundary-intervals-'));
  for(const c of study.cases){
    assert.equal(c.sha256,atlas.cases.find(a=>a.id===c.id).imageSha256);
    const id=c.id.toLowerCase(),inputBytes=bytes('../examples/semicircular-interval-'+id+'.json');
    const {report}=await runProblemEvidence({inputBytes,outputPath:join(out,id)});
    assert.equal(report.native.status,'not-run');assert.equal(report.results[0].status,'conditional');
    const v=report.results[0].value;
    if(c.id==='A14'){
      // Closed-form reduction for this source ratio.
      near(v.firstIncidenceRadiusOverBeamRadius,4/(2*Math.sqrt(6)+1));
      near(v.lowerOverR,-v.upperOverR);
    }else{
      near(v.strictTransmission.upper,Math.sqrt(2/3));near(v.signedInteriorAngleDeg,30);
      assert.equal(v.strictTransmission.open,true);
      near(v.criticalAbsoluteEntryOffsetOverR,v.strictTransmission.upper);
    }
  }
});
test('signed meridional interval, incidence reversal and full open diameter',()=>{
  const p=example('a14');p.physical.geometry='meridional-half-disk';
  p.physical.launch={kind:'meridional-parallel-interval',lowerOverR:-.4,upperOverR:-.1};
  const a=result(p).value;assert.ok(a.lowerOverR<a.upperOverR&&a.upperOverR<0);
  assert.equal(a.firstIncidenceRadiusOverBeamRadius,undefined);
  const q=example('a20');q.physical.launch.angleFromFlatNormalDeg=-45;
  near(result(q).value.signedInteriorAngleDeg,-30);
  q.physical.glassIndex=1.05;
  assert.deepEqual(result(q).value.strictTransmission,{lower:-1,upper:1,open:true});
  assert.equal(result(q).value.criticalAbsoluteEntryOffsetOverR,null);
  q.physical.glassIndex=Math.sqrt(1.5);assert.equal(result(q).status,'numerically-indeterminate');
});
test('invalid illumination, missing facts and mismatched requests withhold the analytical interval',()=>{
  for(const edit of [f=>f.geometry='meridional-half-disk',f=>f.glassIndex=1.61,
    f=>f.launch.radiusOverGlassRadius=.501,f=>f.launch.radiusOverGlassRadius=0,
    f=>delete f.exteriorIndex,f=>f.launch={kind:'parallel-at-flat-face',angleFromFlatNormalDeg:0}]){
    const p=example('a14');edit(p.physical);assert.equal(result(p).value,null);
  }
  const q=example('a20');q.physical.glassIndex=1+Number.EPSILON;
  assert.equal(result(q).status,'numerically-indeterminate');
  const mixed=JSON.parse(bytes('../examples/curved-entry-beam-v30.json'));
  mixed.requests.push({...example('a14').requests[0],id:'analytical'});
  const plan=planProblem(mixed);assert.equal(plan.native.canRun,true);
  assert.equal(plan.results[1].reasonCode,'UNSUPPORTED_FACTS');
});
