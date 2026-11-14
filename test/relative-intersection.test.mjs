import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relativeLineIntersection,relativePlaneCandidate,cancellationCounterexample} from '../scripts/relative-intersection-candidate.mjs';
import {exactLineReference} from '../scripts/exact-line-reference.mjs';
const line=(x1,y1,x2,y2)=>({p1:{x:x1,y:y1},p2:{x:x2,y:y2}});
const squared=(p,q)=>(p.x-q.x)**2+(p.y-q.y)**2;
test('relative formula puts the recorded critical rehit below the unchanged native cutoff',()=>{
  const ray=line(143.79314228623798,-99.99999999999999,144.79314228623798,-100.0000000349463),
    boundary=line(0,-100,-100,-100),original=structuredClone({ray,boundary});
  const p=relativePlaneCandidate(ray,boundary),ref=exactLineReference(ray,boundary,1e-12);
  assert.equal(ref.beyondCutoff,false);assert.ok(squared(p,ray.p1)<1e-12);
  assert.ok(Math.abs(Math.sqrt(squared(p,ray.p1))-Math.sqrt(ref.distanceSquared.approx))<1e-13);
  assert.deepEqual({ray,boundary},original);
});
test('ordinary intersections survive translation, scale, axis exchange and boundary reversal',()=>{
  for(const scale of [.1,1,10])for(const offset of [0,1000,-1000])for(const swap of [false,true]){
    const p=(x,y)=>swap?{x:offset+scale*y,y:offset+scale*x}:{x:offset+scale*x,y:offset+scale*y};
    const a={p1:p(0,0),p2:p(3,2)},b={p1:p(0,1),p2:p(4,1)};
    for(const boundary of [b,{p1:b.p2,p2:b.p1}]){
      const hit=relativeLineIntersection(a,boundary),expected=p(1.5,1);
      assert.ok(Math.hypot(hit.x-expected.x,hit.y-expected.y)<1e-10);
    }
  }
});
test('close future intersections are not suppressed by a new epsilon',()=>{
  for(const distance of [5e-7,2e-6,.01,.02]){
    const ray=line(0,0,1,0),boundary=line(distance,-1,distance,1);
    const hit=relativePlaneCandidate(ray,boundary);
    assert.equal(hit.x,distance);
    assert.equal(squared(hit,ray.p1)>1e-12,exactLineReference(ray,boundary,1e-12).beyondCutoff);
  }
  assert.equal(relativePlaneCandidate(line(0,0,1,0),line(-1,-1,-1,1)),null);
});
test('parallel, coincident, malformed and degenerate lines are explicit',()=>{
  assert.equal(relativeLineIntersection(line(0,0,1,0),line(0,1,1,1)),null);
  assert.equal(relativeLineIntersection(line(0,0,1,0),line(2,0,3,0)),null);
  assert.throws(()=>relativeLineIntersection(line(0,0,0,0),line(0,1,1,1)),/Degenerate/);
  assert.throws(()=>relativeLineIntersection(line(0,0,NaN,1),line(0,1,1,1)),/Finite/);
});
test('known determinant cancellation blocks a claim of general robustness',()=>{
  const {ray,boundary}=cancellationCounterexample(),ref=exactLineReference(ray,boundary,1e-12);
  assert.equal(ref.kind,'unique');assert.equal(ref.forward,true);assert.equal(ref.beyondCutoff,true);
  assert.equal(relativePlaneCandidate(ray,boundary),null);
  // Passing this test records a known candidate limitation, NOT a repaired ray.
});
