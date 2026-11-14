import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exactLineReference} from '../scripts/exact-line-reference.mjs';
const line=(x1,y1,x2,y2)=>({p1:{x:x1,y:y1},p2:{x:x2,y:y2}});
test('exact reference gives an independently known rational intersection',()=>{
  const r=exactLineReference(line(1,2,4,2),line(7,5,7,9),1);
  assert.equal(r.t.numerator,'2');assert.equal(r.t.denominator,'1');
  assert.equal(r.distanceSquared.numerator,'36');assert.equal(r.distanceSquared.denominator,'1');
  assert.equal(r.point.x.approx,7);assert.equal(r.point.y.approx,2);assert.equal(r.beyondCutoff,true);
});
test('exact reference distinguishes behind-ray, cutoff equality, and true future hits',()=>{
  assert.equal(exactLineReference(line(1,2,-2,2),line(7,5,7,9),1).forward,false);
  assert.equal(exactLineReference(line(1,2,4,2),line(7,5,7,9),36).beyondCutoff,false);
  assert.equal(exactLineReference(line(1,2,4,2),line(7,5,7,9),35).beyondCutoff,true);
});
test('exact reference distinguishes parallel from coincident lines',()=>{
  assert.equal(exactLineReference(line(0,0,1,0),line(0,1,2,1),0).kind,'parallel');
  assert.equal(exactLineReference(line(0,0,1,0),line(2,0,3,0),0).kind,'coincident');
});
test('exact reference preserves a known scaled, translated and quarter-turned intersection',()=>{
  const transform=l=>Object.fromEntries(Object.entries(l).map(([k,p])=>[k,{x:250-2*p.y,y:-75+2*p.x}]));
  const r=exactLineReference(transform(line(1,2,4,2)),transform(line(7,5,7,9)),4);
  assert.equal(r.t.approx,2);assert.equal(r.distanceSquared.approx,144);
  assert.equal(r.point.x.approx,246);assert.equal(r.point.y.approx,-61);
});
test('one-ulp off-plane start and near-tangent direction are not rounded onto the boundary',()=>{
  const start=100-2**-46,step=2**-25;
  const r=exactLineReference(line(0,start,1,start+step),line(-100,100,100,100),1e-12);
  assert.equal(r.t.numerator,'1');assert.equal(r.t.denominator,String(2**21));
  assert.equal(r.forward,true);assert.equal(r.beyondCutoff,false);
  assert.equal(r.point.y.approx,100);
});
test('invalid numbers and degenerate lines are not silently repaired',()=>{
  for(const x of [NaN,Infinity,-Infinity])assert.throws(()=>exactLineReference(line(0,0,x,1),line(1,0,1,2),0));
  assert.throws(()=>exactLineReference(line(0,0,0,0),line(1,0,1,2),0));
  assert.throws(()=>exactLineReference(line(0,0,1,0),line(1,0,1,2),-1));
});
