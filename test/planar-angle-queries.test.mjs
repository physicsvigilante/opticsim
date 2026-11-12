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
 const dup=structuredClone(c.request);dup.components[2].id='A';assert.throws(()=>run(dup,c.query),/unique|[Dd]uplicate/);
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

test('near-critical rays are numerically indeterminate, not falsely absent or propagating',()=>{
 const c=structuredClone(fixtures.synthetic.middleBranches),p=c.request.components.find(x=>x.id==='S2');
 const boundary=c.request.components.find(x=>x.id==='A');
 const critical=angle(1.2/1.6);
 const q={format:'opticsim-planar-angle-query-v1',kind:'branch-angles',sourceId:'S2',
   branches:[{id:'out',events:[{interfaceId:'A',action:'transmit'}]}]};
 for(const shift of [-1e-11,1e-11]){
  p.emission.directionDeg=180-(critical+shift);
  const r=run(c.request,q);
  assert.equal(r.status,'numerically-indeterminate');
  assert.equal(r.results[0].status,'numerically-indeterminate');
  assert.equal(r.results[0].reasonCode,'NEAR_CRITICAL_NUMERIC');
  assert.equal(r.results[0].value,null);
 }
 p.emission.directionDeg=180-(critical-1e-5);
 const below=run(c.request,q);
 assert.equal(below.results[0].status,'conditional');
 assert.ok(below.results[0].value.exitAngleDeg<90);
 p.emission.directionDeg=180-(critical+1e-5);
 const above=run(c.request,q);
 assert.equal(above.status,'unavailable');
 assert.equal(above.results[0].reasonCode,'TOTAL_INTERNAL_REFLECTION');
 // Partial-reflection disabling does not disable the physical TIR branch.
 boundary.parameters.partialReflection=false;
 q.branches=[{id:'tir',events:[{interfaceId:'A',action:'reflect'}]}];
 const reflected=run(c.request,q);
 assert.equal(reflected.status,'conditional');
 assert.equal(reflected.results[0].events[0].reflectionKind,'total-internal-reflection');
});
test('nearly tangent identity transmission is not a critical-angle rejection',()=>{
 const c=structuredClone(fixtures.synthetic.middleBranches);
 c.request.components.find(x=>x.id==='A').parameters.negativeIndex=1.6;
 c.request.components.find(x=>x.id==='A').parameters.partialReflection=false;
 c.request.components.find(x=>x.id==='S2').emission.directionDeg=90.0001;
 const q={format:'opticsim-planar-angle-query-v1',kind:'branch-angles',sourceId:'S2',
   branches:[{id:'identity',events:[{interfaceId:'A',action:'transmit'}]}]};
 const result=run(c.request,q);
 assert.equal(result.status,'conditional');
 assert.ok(Math.abs(result.results[0].value.exitAngleDeg-89.9999)<1e-7);
});
test('invalid later events are validated even when an earlier event is physically impossible',()=>{
 const c=structuredClone(fixtures.synthetic.middleBranches);
 c.request.components.find(x=>x.id==='S2').emission.directionDeg=120;
 const q={format:'opticsim-planar-angle-query-v1',kind:'branch-angles',sourceId:'S2',
   branches:[{id:'no-transmission',events:[
    {interfaceId:'A',action:'transmit'},{interfaceId:'B',action:'eval'}
   ]}]};
 assert.throws(()=>run(c.request,q),/Expected declared reflect or transmit/);
 q.branches[0].events[1]={interfaceId:'B',action:'reflect'};
 assert.equal(run(c.request,q).status,'unavailable');
 const bad=structuredClone(q);bad.branches.push({...q.branches[0],id:'other'});
 assert.equal(run(c.request,bad).status,'unavailable'); // all unavailable, never partial
});

test('angular-only facts solve B05 without inventing brightness, geometry or native reflection settings',()=>{
 const facts={format:'opticsim-planar-angular-facts-v1',
   source:{id:'S1',region:0},
   interfaces:[{id:'I12',negativeIndex:1.6,positiveIndex:1.8},
     {id:'I23',negativeIndex:1.8,positiveIndex:1.3}]};
 const snapshot=structuredClone(facts),r=run(facts,query('B05'));
 assert.equal(r.status,'conditional');
 const alreadyKnown=structuredClone(facts);alreadyKnown.source.incidentAngleDeg=20;
 assert.throws(()=>run(alreadyKnown,query('B05')),/genuinely unknown/);
 const conflict=structuredClone(facts);conflict.source.approach='negative';
 assert.throws(()=>run(conflict,query('B05')),/Conflicting approach/);
 close(r.value.initialIncidenceAngleDeg,angle(1.3/1.6));
 close(r.value.criticalIncidenceAngleDeg,angle(1.3/1.8));
 assert.equal(r.value.sourceDirectionDeg,null);
 assert.equal(r.proposedForwardScene,undefined);
 assert.equal(r.native.status,'not-run');
 assert.ok(r.noNativeReason.includes('brightness'));
 assert.deepEqual(facts,snapshot);
});
test('angular-only ordered media solve both B06 branches with no invented drawing dimensions',()=>{
 const facts={format:'opticsim-planar-angular-facts-v1',
  source:{id:'S1',region:3,incidentAngleDeg:30,approach:'negative'},
  interfaces:[{id:'I34',negativeIndex:1.45,positiveIndex:1.32},
    {id:'I23',negativeIndex:1.32,positiveIndex:1.4},
    {id:'I12',negativeIndex:1.4,positiveIndex:1.3},
    {id:'I1A',negativeIndex:1.3,positiveIndex:1}]};
 const result=run(facts,query('B06'));
 assert.equal(result.status,'conditional');
 close(result.results[0].value.exitAngleDeg,angle(1.3*.5/1.45));
 close(result.results[1].value.exitAngleDeg,angle(1.3*.5/1));
 assert.equal(result.results[1].events[0].nativeReflectionPolicy,
  'unspecified; analytically conditional on physical Fresnel reflection');
 assert.equal(result.canonicalForwardScene,undefined);
 assert.ok(result.noNativeReason.includes('brightness'));
});
test('angular facts must state medium order, source region and angle but not unrelated native fields',()=>{
 const base={format:'opticsim-planar-angular-facts-v1',
  source:{id:'S1',region:0,incidentAngleDeg:30,approach:'positive'},
  interfaces:[{id:'I',negativeIndex:1,positiveIndex:1.5}]};
 const branch={format:'opticsim-planar-angle-query-v1',kind:'branch-angles',sourceId:'S1',
  branches:[{id:'transmit',events:[{interfaceId:'I',action:'transmit'}]}]};
 assert.equal(run(base,branch).status,'conditional');
 const cases=[
  {...base,source:{id:'S1',incidentAngleDeg:30,approach:'positive'}},
  {...base,source:{...base.source,region:4}},
  {...base,source:{...base.source,incidentAngleDeg:'30'}},
  {...base,interfaces:[{id:'I',negativeIndex:1,positiveIndex:1.5,code:'eval()'}]},
  {...base,interfaces:[{id:'I',negativeIndex:1,positiveIndex:0}]}
 ];
 for(const x of cases)assert.throws(()=>run(x,branch));
 const noDirection=structuredClone(base);delete noDirection.source.approach;
 assert.throws(()=>run(noDirection,branch),/explicit incidentAngleDeg and approach/);
 const badOrder=structuredClone(base);
 badOrder.interfaces.push({id:'J',negativeIndex:1.4,positiveIndex:1.2});
 assert.throws(()=>run(badOrder,branch),/Inconsistent shared medium/);
});
