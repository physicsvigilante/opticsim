import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/mirror-plane-port-a28.json');
const frozen=JSON.parse(bytes('../evaluation/silvered-curved-conjugates-v1/frozen.json'));
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10,JSON.stringify({a,b}));
const request=()=>JSON.parse(input);
test('A28 public report preserves the finite direct depth and the afocal reflected branch',async()=>{
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'mirror-plane-port-')),'a28');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  near(report.results[0].value.signedDepth,10/3);
  assert.deepEqual(report.results[1].value,{state:'afocal',signedDepth:null,lengthUnit:'cm'});
});
test('signed transmitted conjugates include real, virtual and coincident branches',()=>{
  for(const c of frozen.controls.slice(1,4)){
    const p=request();
    Object.assign(p.physical,{lengthUnit:'mm',poleDepth:c.poleMm,curvatureRadius:c.radiusMm,
      objectDepth:c.depthMm,interiorIndex:c.inside,exteriorIndex:c.outside});
    const [first,second]=planProblem(p).results;
    near(first.value.signedDepth,c.directMm);
    near(second.value.signedDepth,c.returnMm);
    assert.equal(second.value.state,c.returnMm>0?'virtual-into-body':'real-in-exterior');
  }
});
test('exact plane focus, nearby uncertain return and unsupported contact are distinct',()=>{
  const p=request();
  Object.assign(p.physical,{poleDepth:12,objectDepth:8,curvatureRadius:6});
  let [first,second]=planProblem(p).results;
  assert.equal(second.value.state,'at-exit-plane');assert.equal(second.value.signedDepth,0);
  p.physical.curvatureRadius+=1e-12;
  [first,second]=planProblem(p).results;
  assert.equal(first.status,'conditional');assert.equal(second.status,'numerically-indeterminate');
  p.physical.objectDepth=12;
  assert.ok(planProblem(p).results.every(r=>r.value===null));
});
