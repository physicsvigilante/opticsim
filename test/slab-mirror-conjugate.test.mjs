import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/slab-mirror-conjugate-a12.json');
const protocol=JSON.parse(bytes('../evaluation/slab-mirror-conjugate-v1/frozen.json'));
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10,JSON.stringify({a,b}));
function plan(c){
  const p=JSON.parse(input);
  Object.assign(p.physical,{lengthUnit:'mm',mirrorRadius:c.radius,objectDistance:c.objectDistance,
    plate:{thickness:c.thickness,exteriorIndex:c.outside,glassIndex:c.inside,
      placement:c.near===undefined?{kind:'between-centre-and-object'}:{kind:'explicit-near-face',nearDistance:c.near}}});
  return planProblem(p).results[0];
}
test('A12 public comparison returns signed shift and size ratio without exact slab placement',async()=>{
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'slab-mirror-conjugate-')),'a12');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  const r=report.results[0];assert.equal(r.status,'conditional');
  near(r.value.positionChange,5/9);near(r.value.sizeRatio,10/9);
  near(r.value.bare.magnification,-1/2);near(r.value.inserted.magnification,-5/9);
  assert.equal(r.value.lengthUnit,'cm');
});
test('first passage gives the correct physical conjugate inside or beyond the slab',()=>{
  for(const c of protocol.cases.slice(0,3)){
    const v=plan(c).value;
    near(v.bare.signedDistance,150);near(v.inserted.signedDistance,c.expectedInserted);
    near(v.inserted.magnification,-5/9);
  }
  assert.equal(plan(protocol.cases[1]).value.inserted.state,'real-in-plate');
  assert.equal(plan(protocol.cases[2]).value.inserted.state,'real-beyond-plate');
});
test('exact afocal, virtual, original interface and unresolved boundaries remain distinct',()=>{
  const c=protocol.cases[3];
  assert.equal(plan(c).value.inserted.state,'afocal');
  assert.equal(plan({...c,objectDistance:120+1e-11}).status,'numerically-indeterminate');
  const v=plan({...c,objectDistance:115}).value;
  assert.equal(v.inserted.state,'virtual-behind-mirror');
  near(v.inserted.signedDistance,-1900);
  const placement={...protocol.cases[1],inside:1};
  assert.equal(plan({...placement,near:150}).value.inserted.state,'at-near-face');
  assert.equal(plan({...placement,near:90}).value.inserted.state,'at-far-face');
  assert.equal(plan({...placement,near:150-1e-10}).status,'numerically-indeterminate');
  assert.equal(plan({...placement,near:40}).value.positionChange,0);
  assert.equal(plan({...placement,near:40}).value.sizeRatio,1);
  assert.equal(plan({...placement,near:240}).value,null);
});
