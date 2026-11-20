import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {
 analyzeMirrorFormalOrbit,mirrorOrbitCapabilities,
 MIRROR_ORBIT_QUERY_FORMAT,MirrorOrbitQueryError
} from '../src/mirror-reflection-orbit.js';
import {runMirrorFormalOrbitEvidence} from '../scripts/mirror-reflection-orbit-query.mjs';
const proto=JSON.parse(readFileSync(new URL('../research/jee-j02-mirror-orbits-v1/frozen-protocol.json',import.meta.url),'utf8'));
const structural=JSON.parse(readFileSync(new URL('../examples/jee-j02-three-mirror-formal-orbit-v1.json',import.meta.url),'utf8'));
const sample=JSON.parse(readFileSync(new URL('../examples/jee-j02-three-mirror-synthetic-points-v1.json',import.meta.url),'utf8'));
const near=(a,b,tol=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,
 String(a)+' differs from '+String(b)+' by more than '+String(tol));
const nearPoint=(p,q,tol=1e-6)=>{near(p.x,q.x,tol);near(p.y,q.y,tol);};
const reflect=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,qx=p.x-a.x,qy=p.y-a.y,
  t=(qx*dx+qy*dy)/(dx*dx+dy*dy);
 return {x:2*(a.x+t*dx)-p.x,y:2*(a.y+t*dy)-p.y};
};
const word=(point,vertices,ids)=>{
 let p=point;
 for(const id of ids){
  const lookup={AB:[0,1],BC:[1,2],CA:[2,0]}[id];
  p=reflect(p,vertices[lookup[0]],vertices[lookup[1]]);
 }
 return p;
};

test('frozen J02 source facts are distinct from a complete image-visibility claim',()=>{
 assert.equal(proto.status,'pre-execution-frozen-research');
 assert.equal(proto.productionBaseline,'a4f8502ec4b9c900079ac40b35d102cb36fccb93');
 assert.equal(proto.originalSource.solutionsRead,false);
 assert.equal(proto.originalSource.sourceSuccessClaim,false);
 assert.equal(proto.originalSource.problemPath,'08_Ray_Optics_Explanations/01_Reflection_at_Plane_Surfaces/Problems/008.png');
 assert.equal(proto.mathematicalWitness.repetitionGivesUnboundedOrbit,true);
 assert.equal(proto.conceptualSplit.actualFiniteMirrors.includes('not certify actual visible images'),true);
 assert.equal(proto.mathematicalWitness.orderedReflectionWord.join(','),
  'AB,BC,AB,CA');
 assert.equal(structural.format,MIRROR_ORBIT_QUERY_FORMAT);
});
test('J02 source-only structure proves unbounded FORMAL orbit without making up source coordinates or visible count',()=>{
 const inp=structuredClone(structural),prior=structuredClone(inp);
 const r=analyzeMirrorFormalOrbit(inp);
 assert.deepEqual(inp,prior);
 assert.equal(r.status,'conditional-formal-orbit');
 assert.equal(r.value.formalOrbitCardinality,'unbounded');
 assert.equal(r.value.numberOfVisibleImagesCertified,false);
 assert.equal(r.value.physicalVisibleImageCount,null);
 assert.equal(r.value.nonzeroTranslationProvenForEquilateralTriangle,true);
 assert.deepEqual(r.value.constructiveWord,['AB','BC','AB','CA']);
 assert.equal(r.native.status,'not-run');
 assert.equal(r.native.actualVisibleImagesCertified,undefined);
 assert.equal(r.native.observerVisibilityCertified,false);
 assert.equal(r.originalQuestionSolved,false);
 assert.equal('sourceMm' in r.value,false);
 assert.equal('finiteDepthFormalImagePositions' in r.value,false);
});
test('numeric equilateral research control gets exact independent four-reflection nonzero translation',()=>{
 const r=analyzeMirrorFormalOrbit(sample),v=r.value;
 assert.equal(r.status,'conditional-formal-orbit');
 assert.equal(v.authoredGeometryNotOriginalSource,true);
 assert.equal(v.maxReflectionOrder,5);
 near(v.sideLengthMm,140,1e-11);
 near(v.translationProof.verifiedTranslationVectorMm.x,70*Math.sqrt(3),1e-9);
 near(v.translationProof.verifiedTranslationVectorMm.y,210,1e-9);
 near(v.translationProof.verifiedTranslationLengthMm,140*Math.sqrt(3),1e-9);
 assert.equal(v.translationProof.infinitelyManyDistinctFormalPositions,true);
 const p=sample.source,verts=sample.vertices,wordList=['AB','BC','AB','CA'];
 const translated=word(p,verts,wordList);
 const shift={x:translated.x-p.x,y:translated.y-p.y};
 nearPoint(shift,v.translationProof.verifiedTranslationVectorMm);
 const alt={x:p.x+23.5,y:p.y-19};
 const altTranslated=word(alt,verts,wordList);
 nearPoint({x:altTranslated.x-alt.x,y:altTranslated.y-alt.y},shift);
 let moved=p;
 for(let k=1;k<=6;k++){
  moved=word(moved,verts,wordList);
  nearPoint(moved,{x:p.x+k*shift.x,y:p.y+k*shift.y},1e-7);
 }
 assert.ok(v.finiteDepthFormalImagePositions.some(x=>
  Math.hypot(x.point.x-translated.x,x.point.y-translated.y)<1e-7));
 assert.equal(v.completeVisibleImageCount,false);
 assert.equal(r.native.status,'not-run');
});
test('finite-depth points grow with admitted reflection order but are NEVER total image count',()=>{
 let last=0;
 for(const maxReflectionOrder of [0,1,2,3,4,5,6,7,8]){
  const r=analyzeMirrorFormalOrbit({...sample,maxReflectionOrder}),v=r.value;
  assert.equal(v.countsByFirstDepth.length,maxReflectionOrder+1);
  assert.equal(v.countsByFirstDepth[0].newPositions,1);
  assert.equal(v.finiteDepthUniquePositionCount,
   v.finiteDepthFormalImagePositions.length);
  assert.ok(v.finiteDepthUniquePositionCount>=last);
  if(maxReflectionOrder>0)assert.ok(v.finiteDepthUniquePositionCount>0);
  assert.equal(v.numberOfVisibleImagesCertified,false);
  assert.equal(v.formalOrbitCardinality,'unbounded');
  const ordered=v.finiteDepthFormalImagePositions;
  for(let j=0;j<ordered.length;j++){
   assert.ok(ordered[j].firstDepth>=1&&ordered[j].firstDepth<=maxReflectionOrder);
   for(let k=0;k<j;k++){
    assert.ok(Math.hypot(ordered[j].point.x-ordered[k].point.x,
     ordered[j].point.y-ordered[k].point.y)>=1e-7-1e-10);
   }
  }
  last=v.finiteDepthUniquePositionCount;
 }
 assert.ok(last>20,'Real mathematical orbit must expand without a fake fixed small image count');
});
test('rigid rotation, translation and unit scales preserve orbit layer counts, not fake visibility',()=>{
 const reference=analyzeMirrorFormalOrbit(sample).value;
 for(const scale of [.2,.5,2,5]){
  for(const thetaDeg of [0,37,-71]){
   const theta=thetaDeg*Math.PI/180,C=Math.cos(theta),S=Math.sin(theta);
   const transform=p=>({x:500+scale*(C*p.x-S*p.y),
    y:-250+scale*(S*p.x+C*p.y)});
   const q={...sample,vertices:sample.vertices.map(transform),
    source:transform(sample.source)};
   const r=analyzeMirrorFormalOrbit(q).value;
   assert.equal(r.finiteDepthUniquePositionCount,reference.finiteDepthUniquePositionCount);
   assert.deepEqual(r.countsByFirstDepth,reference.countsByFirstDepth);
   nearPoint(r.translationProof.verifiedTranslationVectorMm,{
    x:scale*(C*reference.translationProof.verifiedTranslationVectorMm.x-
     S*reference.translationProof.verifiedTranslationVectorMm.y),
    y:scale*(S*reference.translationProof.verifiedTranslationVectorMm.x+
     C*reference.translationProof.verifiedTranslationVectorMm.y)
   },1e-6);
   near(r.sideLengthMm,140*scale,1e-6);
  }
 }
});
test('strict physical facts, source position and reflection budget reject incomplete or unsafe geometry',()=>{
 const fails=[
  q=>delete q.vertices,q=>delete q.source,q=>delete q.maxReflectionOrder,
  q=>q.source={x:150,y:0},q=>q.source={x:0,y:0},
  q=>q.source={x:NaN,y:0},q=>q.source={x:100000,y:0},
  q=>q.maxReflectionOrder=9,q=>q.maxReflectionOrder=-1,
  q=>q.maxReflectionOrder=2.2,q=>q.maxReflectionOrder='8',
  q=>q.vertices[2].x+=1,
  q=>q.vertices[1]=structuredClone(q.vertices[0]),
  q=>q.vertices[0].extra=1,
  q=>q.vertices[0].x='0',
  q=>q.vertices.push({x:10,y:10}),
  q=>q.topology='three-mirror-open-wedge',
  q=>q.reflectionPolicy='max-five-reflections',
  q=>q.model='finite-two-sided-native-mirror-visibility',
  q=>q.kind='actual-observer-visible-image-count',
  q=>q.aperture=100
 ];
 for(const f of fails){
  const q=structuredClone(sample);
  f(q);
  assert.throws(()=>analyzeMirrorFormalOrbit(q));
 }
 for(const q of [null,0,{},'{}',[],{...structural,vertices:[]}])
  assert.throws(()=>analyzeMirrorFormalOrbit(q));
 assert.throws(()=>analyzeMirrorFormalOrbit({...structural,source:{x:5,y:5}}));
 assert.throws(()=>analyzeMirrorFormalOrbit({...structural,numberOfImages:12}));
});
test('CLI archives original bytes and reports structural, numeric and malformed separately without constructing native scenes',()=>{
 const fixtures=[structural,sample];
 for(const q of fixtures){
  const bytes=Buffer.from(JSON.stringify(q,null,2)+'\n'),
   path=resolve('test-artifacts/llm-authoring/j02-orbit-'+randomUUID());
  const r=runMirrorFormalOrbitEvidence({queryBytes:bytes,outputPath:path});
  assert.equal(r.status,'conditional-formal-orbit');assert.equal(r.exitCode,0);
  assert.deepEqual(readFileSync(resolve(path,'input.json')),bytes);
  const h=createHash('sha256').update(bytes).digest('hex');
  assert.equal(r.report.originalInputSha256,h);
  const a=JSON.parse(readFileSync(resolve(path,'analytical-result.json')));
  assert.equal(a.originalInputSha256,h);
  assert.equal(a.result.native.status,'not-run');
  assert.equal(r.report.native.status,'not-run');
  for(const file of ['scene.ray-optics-2d.json','native-summary.json','qualified-scene.json'])
   assert.equal(existsSync(resolve(path,file)),false);
  assert.throws(()=>runMirrorFormalOrbitEvidence({queryBytes:bytes,outputPath:path}));
 }
 const raw=Buffer.from('{"format":}');
 const path=resolve('test-artifacts/llm-authoring/j02-orbit-'+randomUUID());
 const r=runMirrorFormalOrbitEvidence({queryBytes:raw,outputPath:path});
 assert.equal(r.status,'rejected');assert.equal(r.exitCode,1);
 assert.equal(r.report.native.status,'not-run');
 assert.equal(existsSync(resolve(path,'analytical-result.json')),false);
 assert.deepEqual(readFileSync(resolve(path,'input.json')),raw);
 const caps=JSON.parse(execFileSync(process.execPath,[
  fileURLToPath(new URL('../scripts/mirror-reflection-orbit-query.mjs',import.meta.url)),
  'capabilities'],{encoding:'utf8'}));
 assert.equal(caps.format,MIRROR_ORBIT_QUERY_FORMAT);
 assert.equal(caps.policy.maxReflectionOrder,8);
 assert.match(caps.native,/not-run/);
});
