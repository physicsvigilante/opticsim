import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {analyzePrismAngleQuery,PRISM_FACTS_FORMAT,PRISM_QUERY_FORMAT} from '../src/prism-angle-queries.js';
import {nativePrismRequest,inspectPrismNative,checkNativeSnell,vectorPrismReference} from './helpers/prism-angular-reference.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const rad=Math.PI/180,deg=180/Math.PI;
const query={format:PRISM_QUERY_FORMAT,kind:'prism-direct-angles'};
const facts=({A,i,n0,n})=>({format:PRISM_FACTS_FORMAT,model:'homogeneous-prism',branch:'direct-two-face-transmission',angleConvention:'normal-angles-signed-deviation',prismAngleDeg:A,incidenceAngleDeg:i,outsideIndex:n0,insideIndex:n});
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const angle=(a,b)=>Math.atan2(Math.abs(a.x*b.y-a.y*b.x),a.x*b.x+a.y*b.y)*deg;
function check(c){
 const input=nativePrismRequest(c),d=prepareScene(input).document,out=inspectPrismNative(d,core);assert.equal(out.status,'completed');checkNativeSnell(d,out.trace);
 assert.equal(out.trace.length,2);assert.deepEqual(out.trace.map(e=>e.face),[0,2]);assert.ok(out.trace.every(e=>e.transmitted));
 const answer=analyzePrismAngleQuery(facts(c),query);assert.equal(answer.status,'conditional');
 const ref=vectorPrismReference(c.A,c.i,c.n0,c.n),a=(c.rotation||0)*rad;
 const native=out.trace.at(-1).outgoing;
 close(native.x,ref.outgoing.x*Math.cos(a)-ref.outgoing.y*Math.sin(a));close(native.y,ref.outgoing.x*Math.sin(a)+ref.outgoing.y*Math.cos(a));
 close(angle(out.trace[0].incoming,out.trace[0].outgoing),Math.abs(c.i-answer.value.entryRefractionAngleDeg));
 const inc=out.trace[0].incoming,em=out.trace[1].outgoing;
 const signed=-Math.atan2(inc.x*em.y-inc.y*em.x,inc.x*em.x+inc.y*em.y)*deg;
 close(signed,answer.value.deviationDeg);return {d,out,answer};
}
test('both motivating prism investigations use ordinary unchanged native compilation',()=>{
 check({A:60,i:45,n0:1,n:1.5});check({A:45,i:25,n0:1.5,n:1.25,left:160,right:80});
 check({A:110,i:60,n0:1,n:1.05});
});
test('24 finite native configurations retain angular agreement through geometry, material and orientation changes',()=>{
 let cases=0;
 for(const c of [{A:60,n0:1,n:1.5,left:120,right:120,incidences:[40,50]},
  {A:45,n0:1.5,n:1.25,left:160,right:80,incidences:[20,30]}])
 for(const i of c.incidences)for(const rotation of [0,37,-90])for(const scale of [.5,2]){
  check({...c,i,rotation,scale,tx:75,ty:-20});cases++;
 }assert.equal(cases,24);
});
test('actual TIR is observed without promoting a later alternative exit into the direct branch',()=>{
 for(const c of [{A:60,i:60,n0:1.5,n:1},{A:60,i:0,n0:1,n:1.5}]){
  const r=analyzePrismAngleQuery(facts(c),query);assert.equal(r.status,'unavailable');assert.equal(r.value,null);
  const d=prepareScene(nativePrismRequest(c)).document,out=inspectPrismNative(d,core);
  assert.equal(out.status,'completed');checkNativeSnell(d,out.trace);
  assert.ok(out.trace.some(e=>!e.transmitted));assert.ok(out.diagnostic.interfacesById.P.totalInternalReflections>0);
 }
});
test('conditional angular success is not proof that a finite native ray reaches the named exit face',()=>{
 const c={A:60,i:45,n0:1,n:1.5,entryY:-105,right:50,left:120};
 const a=analyzePrismAngleQuery(facts(c),query);assert.equal(a.status,'conditional');
 const d=prepareScene(nativePrismRequest(c)).document,out=inspectPrismNative(d,core);checkNativeSnell(d,out.trace);
 assert.notDeepEqual(out.trace.map(e=>e.face),[0,2]);
 // The extra finite-size facts are intentionally absent from angular analysis.
 assert.equal(a.native.status,'not-run');assert.equal(a.proposedForwardScene,undefined);
});
test('full Fresnel, depth and stale native evidence retain original suppression even when angular math succeeds',async()=>{
 const c={A:60,i:45,n0:1,n:1.5},d=prepareScene(nativePrismRequest(c)).document;
 const requests=[{id:'hits',kind:'interface-interactions',componentId:'P'},{id:'angle',kind:'interface-transmission-angle',componentId:'P'}];
 const baseline=evaluateDocument(d,core);
 for(const edit of [x=>{x.physics.components[1].parameters.partialReflection=true;},x=>{x.simulation.maxRayDepth=1;}]){
  const changed=structuredClone(d);edit(changed);const run=evaluateDocument(changed,core);
  assert.equal(run.summary.native.status,'incomplete');assert.equal(run.summary.observations,null);
  assert.ok((await evaluateObservables(changed,requests,run.summary)).results.every(r=>r.status==='suppressed'&&r.value===null));
 }
 const changed=structuredClone(d);changed.physics.components[0].emission.directionDeg+=1;
 assert.ok((await evaluateObservables(changed,requests,baseline.summary)).results.every(r=>r.status==='suppressed'));
 assert.equal(analyzePrismAngleQuery(facts(c),query).status,'conditional');assert.equal(d.simulation.maxRayDepth,8);
});
