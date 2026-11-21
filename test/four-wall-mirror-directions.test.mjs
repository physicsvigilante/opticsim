import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';

const bytes=p=>readFileSync(new URL(p,import.meta.url));
const input=bytes('../examples/four-wall-mirror-a04.json');
const frozen=JSON.parse(bytes('../evaluation/four-wall-mirror-directions-v1/frozen.json'));
const original=()=>JSON.parse(input);
const numeric=(width,height,from,to)=>{
  const p=original();
  p.physical.geometry={kind:'numeric-rectangle',lengthUnit:'mm',width,height,from,to};
  return p;
};
const result=p=>planProblem(p).results[0];
test('A04 symbolic directions and provenance through the public workflow',async()=>{
  const atlas=JSON.parse(bytes('../evaluation/optical-systems-atlas-v1/review.json'));
  assert.equal(atlas.cases.find(c=>c.id==='A04').imageSha256,frozen.sha256);
  const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
  const outputPath=join(mkdtempSync(join(root,'four-wall-mirror-query-')),'a04');
  const {report}=await runProblemEvidence({inputBytes:input,outputPath});
  assert.equal(report.native.status,'not-run');
  const v=report.results[0].value;
  assert.equal(v.kind,'symbolic-directions');assert.equal(v.branches.length,4);
  assert.equal(v.branches[0].forwardVector.x,'Bx-Ax - 2W');assert.equal(v.branches[3].forwardVector.y,'By-Ay + 2H');
});
test('numeric unfoldings match native directions, orders and reflected boundary geometry',()=>{
  const p=numeric(300,180,{x:55,y:140},{x:200,y:60});
  const v=result(p).value;
  for(const [i,c] of frozen.nativeControls.forward.entries()){
    const b=v.branches[i],n=Math.hypot(...c.vector);
    assert.equal(b.status,'conditional');assert.deepEqual(b.forward.wallOrder,c.walls);
    assert.deepEqual(b.reverse.wallOrder,[...c.walls].reverse());
    assert.ok(Math.abs(b.forward.x-c.vector[0]/n)<1e-12&&Math.abs(b.forward.y-c.vector[1]/n)<1e-12);
    for(const hit of b.reflectionPoints){
      if(hit.wall==='left'||hit.wall==='right')assert.equal(hit.x,hit.wall==='left'?0:300);
      else assert.equal(hit.y,hit.wall==='bottom'?0:180);
    }
    const opposite=numeric(300,180,{x:200,y:60},{x:55,y:140});
    const match=result(opposite).value.branches.find(r=>r.signs[0]===-b.signs[0]&&r.signs[1]===-b.signs[1]);
    assert.deepEqual(match.forward,b.reverse);
    assert.deepEqual(match.reflectionPoints,[...b.reflectionPoints].reverse());
  }
});
test('exact and near corner contacts differ from unqualified geometry',()=>{
  const p=numeric(200,200,{x:50,y:50},{x:150,y:150});
  assert.deepEqual(result(p).value.branches.map(b=>b.reasonCode),['CORNER_CONTACT',undefined,undefined,'CORNER_CONTACT']);
  p.physical.geometry.to.y+=1e-9;
  const partial=result(p);
  assert.equal(partial.status,'partially-indeterminate');
  assert.equal(partial.value.branches[0].reasonCode,'NEAR_CORNER_CONTACT');
  const unresolved=result(numeric(200,200,{x:100,y:100},{x:100+1e-10,y:100+2e-10}));
  assert.equal(unresolved.status,'numerically-indeterminate');
  assert.ok(unresolved.value.branches.every(b=>b.status==='numerically-indeterminate'));
  p.physical.geometry.to.x=200;
  assert.equal(result(p).value,null);
});

test('fractional rectangle coordinates remain exactly on the named reflecting planes',()=>{
  const width=37.21,height=26.37;
  const p=numeric(width,height,{x:2.017,y:4.013},{x:12.345,y:5.33});
  const {value}=result(p);
  for(const branch of value.branches){
    assert.equal(branch.status,'conditional');
    for(const {wall,x,y} of branch.reflectionPoints){
      if(wall==='left'||wall==='right'){
        assert.equal(x,wall==='left'?0:width);
        assert.ok(y>0&&y<height);
      }else{
        assert.equal(y,wall==='bottom'?0:height);
        assert.ok(x>0&&x<width);
      }
    }
  }
});

test('rounded directions and reported contact coordinates cannot bypass the exact corner band',()=>{
  const witnesses=[
    numeric(90.31,90.31,{x:18.062,y:18.062},{x:27.093,y:27.092999976293616}),
    numeric(100,100,{x:21,y:24},{x:28.999999999999996,y:24.101265796455678})
  ];
  for(const p of witnesses){
    const {value}=result(p),candidate=value.branches.find(b=>b.signs.every(s=>s===1));
    assert.equal(candidate.status,'numerically-indeterminate');
    assert.equal(candidate.reasonCode,'NEAR_CORNER_CONTACT');
    assert.equal(candidate.forward,undefined);
    assert.equal(candidate.reflectionPoints,undefined);
  }
});
