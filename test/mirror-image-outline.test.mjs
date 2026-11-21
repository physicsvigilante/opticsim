import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/mirror-outline-a09.json');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10);
const numeric=()=>{
  const p=JSON.parse(input);
  p.physical.geometry={kind:'ordered-convex-polygon',lengthUnit:'mm',focalLength:100,
    vertices:[{id:'A',distance:330,height:0},{id:'B',distance:330,height:1},
      {id:'E',distance:280,height:2},{id:'D',distance:280,height:0}]};
  return p;
};
test('A09 qualitative answer through the byte-bound public workflow',async()=>{
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  const frozen=JSON.parse(bytes('../evaluation/mirror-image-outline-v1/frozen.json'));
  assert.equal(frozen.sha256,atlas.cases.find(c=>c.id==='A09').imageSha256);
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'mirror-outline-query-')),'a09');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  const v=report.results[0].value;
  assert.equal(v.kind,'inverted-trapezoid');assert.deepEqual(v.orderedVertexIds,['A','B','E','D']);
  assert.deepEqual(v.belowAxisVertexIds,['B','E']);assert.equal(v.fartherImageBaseId,'D');
  assert.deepEqual(v.tallerImageSide,['E','D']);
});
test('numeric outlines preserve identities and projective straight-edge geometry',()=>{
  const p=numeric(),v=planProblem(p).results[0].value.vertices;
  for(const [i,o] of p.physical.geometry.vertices.entries()){
    assert.equal(v[i].id,o.id);
    near(v[i].distance,100*o.distance/(o.distance-100));
    near(v[i].height,-100*o.height/(o.distance-100));
  }
  assert.ok(v[3].distance>v[0].distance&&v[2].height<v[1].height);
  p.physical.geometry.vertices.reverse();
  assert.deepEqual(planProblem(p).results[0].value.vertices,[...v].reverse());
});
test('near focus, crossed outlines and malformed physical facts fail closed',()=>{
  for(const edit of [
    g=>g.vertices[0].distance=99,g=>g.vertices[0].id='B',
    g=>[g.vertices[1],g.vertices[2]]=[g.vertices[2],g.vertices[1]],
    g=>g.vertices[0].height=.9999999999999,
    g=>{g.vertices[2].distance=g.vertices[3].distance=100+1e-12;}
  ]){
    const p=numeric();edit(p.physical.geometry);assert.equal(planProblem(p).results[0].value,null);
  }
});
test('resolved near-focus offsets survive subtraction, while rounded microscopic geometry is withheld',()=>{
  const p=numeric(),g=p.physical.geometry;
  g.focalLength=1400;
  g.vertices=[{id:'A',distance:1402.0000000000007,height:0},
    {id:'B',distance:1402.000000000001,height:1.5916157281020816e-10},
    {id:'C',distance:1402.0000000000011,height:0}];
  const v=planProblem(p).results[0].value.vertices;
  assert.ok(v[0].distance>v[1].distance&&v[1].distance>v[2].distance);
  const span=v[0].distance-v[2].distance;
  assert.ok(Math.abs((v[0].distance-v[1].distance)/span-.5)<.005);
  g.focalLength=1;
  g.vertices=[{id:'A',distance:9000,height:0},{id:'B',distance:9000.000000003,height:8e-13},
    {id:'C',distance:9000.00000003,height:0}];
  const r=planProblem(p).results[0];
  assert.equal(r.status,'numerically-indeterminate');
  assert.equal(r.value,null);
});
test('exactly horizontal projected edges can keep equal represented heights',()=>{
  const p=numeric();
  p.physical.geometry.vertices=[{id:'A',distance:300,height:4},
    {id:'B',distance:200,height:2},{id:'C',distance:250,height:-1}];
  const v=planProblem(p).results[0].value.vertices;
  assert.equal(v[0].height,-2);
  assert.equal(v[1].height,-2);
});
