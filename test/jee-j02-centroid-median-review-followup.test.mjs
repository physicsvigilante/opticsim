// Nonblocking Chat B follow-up on reviewed J02 PR #191.
// Extra numeric regression for exactly symmetric and near-symmetric objects.
// Not a change to the reviewed optics, formal-orbit implementation or policy.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeMirrorFormalOrbit} from '../src/mirror-reflection-orbit.js';
const base=JSON.parse(readFileSync(new URL('../examples/jee-j02-three-mirror-synthetic-points-v1.json',import.meta.url),'utf8'));
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t);
test('equilateral centroid and median sources retain a nonzero formal translation, not a native visible-image count',()=>{
 const v=base.vertices,A=v[0],B=v[1],C=v[2],
  centroid={x:(A.x+B.x+C.x)/3,y:(A.y+B.y+C.y)/3};
 const sourceChoices=[
  centroid,{x:centroid.x+1e-5,y:centroid.y},
  {x:centroid.x,y:centroid.y+1e-5},
  {x:centroid.x+5,y:0},{x:centroid.x,y:10}
 ];
 for(const source of sourceChoices){
  const q={...base,source,maxReflectionOrder:8},original=structuredClone(q);
  const r=analyzeMirrorFormalOrbit(q);
  assert.deepEqual(q,original);
  assert.equal(r.status,'conditional-formal-orbit');
  assert.equal(r.value.formalOrbitCardinality,'unbounded');
  assert.equal(r.value.translationProof.infinitelyManyDistinctFormalPositions,true);
  const t=r.value.translationProof.verifiedTranslationVectorMm;
  near(t.x,70*Math.sqrt(3),1e-6);near(t.y,210,1e-6);
  near(r.value.translationProof.verifiedTranslationLengthMm,140*Math.sqrt(3),1e-6);
  assert.ok(r.value.finiteDepthUniquePositionCount>0);
  assert.ok(r.value.finiteDepthFormalImagePositions.every(x=>x.firstDepth>=1&&x.firstDepth<=8));
  assert.equal(r.native.status,'not-run');
  assert.equal(r.value.completeVisibleImageCount,false);
  assert.equal(r.value.physicalVisibleImageCount,null);
  assert.equal(r.originalQuestionSolved,false);
 }
});
