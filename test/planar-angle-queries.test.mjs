import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzePlanarAngleQuery,angularCapabilities} from '../src/planar-angle-queries.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixtures=JSON.parse(readFileSync(new URL('../evaluation/planar-angular-v1/cases.json',import.meta.url)));
const prior=JSON.parse(readFileSync(new URL('../evaluation/original-refraction-pair-v1/first-attempt.json',import.meta.url)));
const input=id=>structuredClone(prior.cases.find(c=>c.id===id).request);
const query=id=>structuredClone(fixtures.original[id]);
const run=(r,q)=>analyzePlanarAngleQuery(r,q);
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,a+' != '+b);
const angle=(s)=>Math.asin(s)*180/Math.PI;
test('B05 inverse query solves critical input from explicitly provided media, not a guessed source ray',()=>{
 const original=input('B05'),snapshot=structuredClone(original);
 const a=run(original,query('B05'));
 assert.equal(a.status,'conditional');assert.equal(a.kind,'critical-input-angle');
 close(a.value.initialIncidenceAngleDeg,angle(1.3/1.6));
 close(a.value.criticalIncidenceAngleDeg,angle(1.3/1.8));
 close(a.value.sourceDirectionDeg,90-angle(1.3/1.6));
 assert.match(a.value.decreasingInitialIncidence.target,/propagating transmission/);
 assert.equal(a.proposedForwardScene.schemaVersion,5);
 assert.equal(a.proposedForwardScene.physics.components.find(c=>c.id==='S1').emission.directionDeg,a.value.sourceDirectionDeg);
 assert.equal(a.intermediate.length,1);
 assert.equal(a.intermediate[0].interfaceId,'I12');
 assert.equal(a.derivedOnly.length,1);
 assert.equal(a.native.status,'not-run');
 assert.deepEqual(original,snapshot);
 // The solution exists analytically but exact-critical native tracing is incomplete.
 const native=evaluateDocument(a.proposedForwardScene,core);
 assert.equal(native.summary.native.status,'incomplete');
 assert.equal(native.summary.observations,null);
 assert.equal(a.status,'conditional');
});
test('B06 branch analysis predicts both declared routes without fabricating native weak reflection',()=>{
 const original=input('B06'),snapshot=structuredClone(original);
 const a=run(original,query('B06'));
 assert.equal(a.status,'conditional');assert.equal(a.kind,'branch-angles');
 const down=a.results.find(r=>r.id==='theta4'),up=a.results.find(r=>r.id==='theta5');
 close(down.value.exitAngleDeg,angle(1.3*.5/1.45));
 close(up.value.exitAngleDeg,angle(1.3*.5/1));
 assert.equal(down.value.exitMediumIndex,1.45);
 assert.equal(up.value.exitMediumIndex,1);
 assert.equal(down.events.length,3);assert.equal(up.events.length,2);
 assert.equal(up.events[0].action,'reflect');
 assert.equal(up.events[1].interfaceId,'I1A');
 assert.equal(a.native.status,'not-run');
 assert.deepEqual(original,snapshot);
 const native=evaluateDocument(a.canonicalForwardScene,core);
 assert.equal(native.summary.native.status,'incomplete');
 assert.equal(native.summary.observations,null);
 assert.equal(native.report.native.diagnostics.interfacesById.I1A.interactions,0);
 assert.equal(up.status,'conditional'); // not falsely promoted to native evidence
});
test('independent synthetic reverse-direction critical query obeys index invariant',()=>{
 const c=structuredClone(fixtures.synthetic.reverseCritical),a=run(c.request,c.query);
 assert.equal(a.status,'conditional');close(a.value.initialIncidenceAngleDeg,angle(1.1/1.33));
 close(a.value.criticalIncidenceAngleDeg,angle(1.1/1.6));
 assert.equal(a.value.criticalIncidentIndex,1.6);
 assert.equal(a.intermediate[0].interfaceId,'B');
 assert.equal(a.proposedForwardScene.physics.components.find(x=>x.id==='S2').emission.mode,'single-ray');
});
test('independent middle-medium branch composition never skips a physical boundary',()=>{
 const c=structuredClone(fixtures.synthetic.middleBranches),a=run(c.request,c.query);
 assert.equal(a.status,'conditional');close(a.initial.incidenceAngleDeg,30);
 close(a.results[0].value.exitAngleDeg,angle(1.6*.5/1.2));
 close(a.results[1].value.exitAngleDeg,angle(1.6*.5/1.25));
 assert.equal(a.results[1].events[0].reflectionKind,'fresnel-conditional');
 assert.equal(a.results[1].events[1].interfaceId,'B');
 const wrong=structuredClone(c.query);wrong.branches[0].events[0].interfaceId='B';
 const bad=run(c.request,wrong);assert.equal(bad.status,'partially-unavailable');
 assert.equal(bad.results[0].status,'unavailable');
 assert.match(bad.results[0].reason,/skips or misorders/);
});
test('critical inverse is unavailable for impossible indices or no high-to-low target',()=>{
 const c=input('B05');
 c.components.find(x=>x.id==='S1').parameters.x=-10;
 c.components.find(x=>x.id==='I12').parameters.negativeIndex=1;
 const impossible=run(c,query('B05'));
 assert.equal(impossible.status,'unavailable');assert.equal(impossible.proposedForwardScene,undefined);
 assert.match(impossible.reason,/initial medium index/);
 const nonCritical=input('B05'),q=query('B05');
 q.boundaryId='I12';
 const noCritical=run(nonCritical,q);
 assert.equal(noCritical.status,'unavailable');
 assert.match(noCritical.reason,/higher-to-lower/);
});
test('TIR cannot be reported as a transmitted outgoing ray; reflected TIR stays conditional',()=>{
 const c=structuredClone(fixtures.synthetic.middleBranches);
 c.request.components[0].emission.directionDeg=120;
 c.query.branches=[{id:'transmit',events:[{interfaceId:'A',action:'transmit'}]},
   {id:'tir',events:[{interfaceId:'A',action:'reflect'}]}];
 const a=run(c.request,c.query);
 assert.equal(a.status,'partially-unavailable');
 assert.equal(a.results[0].status,'unavailable');assert.match(a.results[0].reason,/total internal reflection/);
 assert.equal(a.results[1].status,'conditional');
 assert.equal(a.results[1].events[0].reflectionKind,'total-internal-reflection');
});
test('explicit no-partial-reflection policy cannot yield a fabricated Fresnel branch',()=>{
 const c=structuredClone(fixtures.synthetic.middleBranches);
 c.request.components.find(x=>x.id==='A').parameters.partialReflection=false;
 const a=run(c.request,c.query);
 assert.equal(a.results[0].status,'conditional');
 assert.equal(a.results[1].status,'unavailable');
 assert.match(a.results[1].reason,/transmitted-only/);
});
test('unknown inputs, duplicated IDs, invalid media and nonparallel planes are rejected',()=>{
 const c=structuredClone(fixtures.synthetic.middleBranches);
 const badQueries=[
  {...c.query,eval:'Math.sin(30)'},
  {...c.query,format:'unknown'},
  {...c.query,branches:[...c.query.branches,c.query.branches[0]]},
  {...c.query,branches:[{id:'x',events:[{interfaceId:'A',action:'eval'}]}]}
 ];
 for(const q of badQueries)assert.throws(()=>run(c.request,q));
 const media=structuredClone(c.request);
 media.components.find(x=>x.id==='B').parameters.negativeIndex=1.7;
 assert.throws(()=>run(media,c.query),/Inconsistent/);
 media.components.find(x=>x.id==='B').parameters.negativeIndex=1.6;
 media.components.find(x=>x.id==='B').parameters.normalDeg=5;
 assert.throws(()=>run(media,c.query),/nonparallel/);
 const dup=structuredClone(c.request);dup.components[2].id='A';assert.throws(()=>run(dup,c.query),/Duplicate/);
});
test('no inverse solution is silently turned into a guessed physical value',()=>{
 const c=input('B05'),q=query('B05');
 assert.equal(Object.hasOwn(c.components[0].emission,'directionDeg'),false);
 const x=structuredClone(c);x.components[0].emission.directionDeg=30;
 assert.throws(()=>run(x,q),/genuinely unknown/);
 const y=structuredClone(q);y.approach='negative';
 const wrongSide=run(c,y);assert.equal(wrongSide.status,'unavailable');
 const all=angularCapabilities();assert.deepEqual(all.kinds,['critical-input-angle','branch-angles']);
});

test('angles are invariant under authored length units and consistent component order',()=>{
 const a=input('B05'),q=query('B05'),reference=run(a,q);
 for(const [unit,scale] of [['mm',10],['m',.01]]){
  const copy=structuredClone(a);copy.lengthUnit=unit;
  for(const c of copy.components){c.parameters.x*=scale;c.parameters.y*=scale;}
  copy.components.reverse();
  const result=run(copy,q);
  close(result.value.initialIncidenceAngleDeg,reference.value.initialIncidenceAngleDeg);
  close(result.value.criticalIncidenceAngleDeg,reference.value.criticalIncidenceAngleDeg);
 }
 const b=input('B06'),bq=query('B06'),ref=run(b,bq);
 const rotated=structuredClone(b);for(const c of rotated.components){
  const x=c.parameters.x,y=c.parameters.y;c.parameters.x=-y;c.parameters.y=x;
  if(c.type==='planar-interface')c.parameters.normalDeg=180;
  if(c.type==='point-source')c.emission.directionDeg+=90;
 }
 rotated.components.reverse();
 const testResult=run(rotated,bq);
 close(testResult.results[0].value.exitAngleDeg,ref.results[0].value.exitAngleDeg);
 close(testResult.results[1].value.exitAngleDeg,ref.results[1].value.exitAngleDeg);
});

test('missing physical brightness, unknown indices and near-boundary sources are not disguised by inverse solution',()=>{
 const c=input('B05'),q=query('B05');
 delete c.components.find(x=>x.id==='S1').parameters.brightness;
 assert.throws(()=>run(c,q),/brightness/);
 const missing=input('B05');delete missing.components.find(x=>x.id==='I12').parameters.negativeIndex;
 assert.throws(()=>run(missing,q),/negativeIndex/);
 const near=input('B05');
 near.components.find(x=>x.id==='S1').parameters.y=-0.0001; // cm, only 0.001 mm from I12
 assert.throws(()=>run(near,q),/0.01 mm/);
 const original=input('B05');assert.equal(Object.hasOwn(original.components.find(x=>x.id==='S1').emission,'directionDeg'),false);
});

test('a critical condition requiring 90-degree initial grazing is not a reachable boundary solution',()=>{
 const c=input('B05');
 c.components.find(x=>x.id==='I12').parameters.negativeIndex=1.3;
 const a=run(c,query('B05'));
 assert.equal(a.status,'unavailable');
 assert.match(a.reason,/finite normal component/);
 assert.equal(a.proposedForwardScene,undefined);
});
