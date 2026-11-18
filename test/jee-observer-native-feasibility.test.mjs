// TEST-ONLY JEE observer-anchored refraction feasibility. Not a public
// inverse solver or a synthetic native ray tracer. An independently computed
// single shooting direction is EXPLICITLY authored in a v5 native scene;
// PhyDemo then freely propagates that ray. Neither source attribution nor
// native crossing coordinates nor an actual image/eye is inferred.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {interfaceNormal} from '../src/planar-media.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const RAD=Math.PI/180;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const times=(a,s)=>({x:a.x*s,y:a.y*s});
const norm=a=>{const l=Math.hypot(a.x,a.y);return {x:a.x/l,y:a.y/l};};
const approx=(a,b,e=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<=e,`Actual ${a} != expected ${b} within ${e}`);
const approxPoint=(a,b,e=1e-6)=>{approx(a.x,b.x,e);approx(a.y,b.y,e);};
const requests=[
 {id:'emitted',kind:'source-emissions',componentId:'S1'},
 {id:'first',kind:'interface-first-event',componentId:'I1'},
 {id:'hits',kind:'detector-hit-events',componentId:'D1'},
 {id:'count',kind:'detector-crossings',componentId:'D1'}
];
function fixture({normalDeg=0,plane={x:0,y:0},source={x:-60,y:0},
  observer={x:100,y:40},ns=1.5,no=1}={}){
 return {normalDeg,plane,source,observer,ns,no};
}

// Independent reference for an explicit source+observer pair across ONE plane.
// Root of d/dq [ns*|S-Q(q)| + no*|O-Q(q)|]=0, strictly monotone when
// ds>0 and do>0. This is conditional stationary optical path geometry,
// not a prescribed native trajectory or an author-facing capability.
function shootingReference(f){
 const {source:S,observer:O,plane:P,normalDeg,ns,no}=f;
 assert.ok([ns,no].every(v=>Number.isFinite(v)&&v>=1&&v<=4));
 const n=interfaceNormal({normalDeg}),t={x:-n.y,y:n.x};
 const s=subtract(S,P),o=subtract(O,P);
 const ds=-dot(s,n),doo=dot(o,n);
 if(!(ds>=.01&&doo>=.01))throw Error('Both source and observer must be on stated opposite sides');
 const us=dot(s,t),uo=dot(o,t);
 let low=Math.min(us,uo),high=Math.max(us,uo);
 const fprime=q=>ns*(q-us)/Math.hypot(ds,q-us)-
   no*(uo-q)/Math.hypot(doo,uo-q);
 // Exact on-axis geometry still has one real native ray, but it cannot
 // infer virtual depth from the one ray alone.
 for(let i=0;i<110;i++){
   const mid=(low+high)/2;
   if(fprime(mid)>0)high=mid;else low=mid;
 }
 const q=(low+high)/2,Q=add(P,times(t,q));
 const incoming=norm(subtract(Q,S)),outgoing=norm(subtract(O,Q));
 const incident=dot(incoming,t),refracted=dot(outgoing,t);
 const thetaI=Math.atan2(incident,dot(incoming,n))/RAD;
 const thetaT=Math.atan2(refracted,dot(outgoing,n))/RAD;
 const error=ns*incident-no*refracted;
 approx(error,0,1e-12);
 const incidentHeading=Math.atan2(incoming.y,incoming.x)/RAD;
 const sourceNormalFoot=add(P,times(t,us));
 const axial=Math.abs(q-us)<1e-10||Math.abs(uo-q)<1e-10;
 const apparentDepth=axial?null:(q-us)*doo/(uo-q);
 const apparentPoint=apparentDepth===null?null:
   subtract(sourceNormalFoot,times(n,apparentDepth));
 return {Q,incoming,outgoing,ds,doo,us,uo,n,t,
   incidentHeading,incidentDeg:thetaI,refractedDeg:thetaT,
   sourceNormalFoot,apparentDepth,apparentPoint};
}

function sceneFor(f,ref){
 // Finite detector at the author-specified observer coordinate, tangent
 // to interface. It is a sampled ray intersection witness, NOT an eye.
 let tangentDeg=f.normalDeg+90;
 if(tangentDeg>180)tangentDeg-=360;
 const document={lengthUnit:'mm',title:'Test-only: native ray reaching specified observer coordinate',
  components:[
   {id:'S1',type:'point-source',parameters:{
     x:f.source.x,y:f.source.y,brightness:1
   },emission:{mode:'single-ray',directionDeg:ref.incidentHeading}},
   {id:'I1',type:'planar-interface',parameters:{
     x:f.plane.x,y:f.plane.y,normalDeg:f.normalDeg,
     negativeIndex:f.ns,positiveIndex:f.no,partialReflection:false
   }},
   {id:'D1',type:'ray-detector',parameters:{
     x:f.observer.x,y:f.observer.y,length:20,orientationDeg:tangentDeg
   }}
 ]};
 return prepareScene(document).document;
}
async function nativeWitness(f){
 const ref=shootingReference(f),d=sceneFor(f,ref);
 assert.equal(d.schemaVersion,5);
 const e=evaluateDocument(d,core,requests).summary;
 const measured=(await evaluateObservables(d,requests,e));
 return {ref,d,e,measured,by:Object.fromEntries(measured.results.map(v=>[v.id,v]))};
}
function confirmNativeHit(f,run){
 const {ref,e,by,measured}=run;
 assert.equal(e.native.status,'completed');
 assert.equal(e.executionPassed,true);
 assert.equal(e.native.truncation,0);
 assert.equal(e.native.undefinedBehavior,0);
 assert.equal(measured.canonicalSha256,e.canonicalSha256);
 assert.equal(by.emitted.value,1);
 assert.equal(by.count.value,1);
 assert.equal(by.first.method,'native-observation');
 assert.equal(by.hits.method,'native-hit-event-observation');
 assert.equal(by.hits.status,'qualified');
 assert.ok(by.hits.warnings.some(x=>/omits Fresnel/.test(x)));
 assert.equal(e.observations.detectorHitEventsById.D1.status,'complete');
 assert.equal(e.observations.detectorHitEventsById.D1.observedCount,1);
 assert.equal(by.hits.value.length,1);
 const event=by.first.value,hit=by.hits.value[0];
 assert.equal(event.outcome,'transmission');
 assert.equal(event.incidentIndex,f.ns);
 assert.equal(event.destinationIndex,f.no);
 assert.equal(event.branches.filter(b=>b.kind==='transmitted').length,1);
 approx(event.incidentAngleDeg,Math.abs(ref.incidentDeg),1e-6);
 approx(event.transmittedAngleDeg,Math.abs(ref.refractedDeg),1e-6);
 approxPoint(hit.pointMm,f.observer,1e-5);
 approxPoint(hit.incomingUnit,ref.outgoing,1e-7);
 // Conditional consistency only: reconstruct the crossing by mathematically
 // EXTENDING the observed outgoing line to the plane, not by asserting that
 // a native interface 'pointMm' field was recorded (it was not).
 const rayToBoundary=ref.doo/dot(hit.incomingUnit,ref.n);
 const inferredCrossing=subtract(hit.pointMm,times(hit.incomingUnit,rayToBoundary));
 approxPoint(inferredCrossing,ref.Q,1e-5);
 if(ref.apparentDepth!==null){
   const independent=ref.ds*Math.tan(Math.abs(ref.incidentDeg)*RAD)/
     Math.tan(Math.abs(ref.refractedDeg)*RAD);
   approx(ref.apparentDepth,independent,1e-7);
 }
 return {observer:f.observer,interfaceCrossingReference:ref.Q,
    nativeDetectorHit:hit.pointMm,sourceHeadingDeg:ref.incidentHeading,
    incidentDeg:ref.incidentDeg,refractedDeg:ref.refractedDeg,
    conditionalApparentDepthMm:ref.apparentDepth,nativeImageDetected:false};
}
test('observer-anchored nonaxial source in high-index medium reaches an independently specified finite detector',async()=>{
 const f=fixture(),r=await nativeWitness(f);
 const outcome=confirmNativeHit(f,r);
 assert.ok(outcome.sourceHeadingDeg>0&&outcome.incidentDeg>0);
 assert.ok(outcome.conditionalApparentDepthMm<60);
 console.log('JEE_OBSERVER_NATIVE_ARRIVAL '+JSON.stringify(outcome));
});
test('observer coordinates above and below axis give mirror-symmetric actual ray hits',async()=>{
 const positive=fixture(),negative=fixture({observer:{x:100,y:-40}});
 const a=confirmNativeHit(positive,await nativeWitness(positive));
 const b=confirmNativeHit(negative,await nativeWitness(negative));
 approx(a.conditionalApparentDepthMm,b.conditionalApparentDepthMm);
 approx(a.interfaceCrossingReference.y,-b.interfaceCrossingReference.y);
 approx(a.sourceHeadingDeg,-b.sourceHeadingDeg);
});
test('equal indices and reverse index contrast still land on finite observer detector',async()=>{
 for(const [ns,no] of [[1,1],[1,1.5],[1.5,1]]){
   const f=fixture({ns,no}),a=confirmNativeHit(f,await nativeWitness(f));
   assert.ok(Number.isFinite(a.conditionalApparentDepthMm));
   if(ns===no)approx(a.conditionalApparentDepthMm,60);
   else if(ns<no)assert.ok(a.conditionalApparentDepthMm>60);
   else assert.ok(a.conditionalApparentDepthMm<60);
 }
});
test('rotated 90 and 180 degree planes plus source/observer translation preserve native arrival',async()=>{
 const original=fixture(),baseline=confirmNativeHit(original,await nativeWitness(original));
 const rotatedPoint=(p,deg)=>deg===90?{x:-p.y,y:p.x}:{x:-p.x,y:-p.y};
 for(const angle of [90,180]){
   const f=fixture({normalDeg:angle,
     source:rotatedPoint(original.source,angle),
     observer:rotatedPoint(original.observer,angle)});
   const actual=confirmNativeHit(f,await nativeWitness(f));
   approx(actual.conditionalApparentDepthMm,baseline.conditionalApparentDepthMm);
   approxPoint(actual.interfaceCrossingReference,
     rotatedPoint(baseline.interfaceCrossingReference,angle));
 }
 const translated=fixture({plane:{x:13,y:-9},
   source:{x:-47,y:11},observer:{x:113,y:51}});
 const shifted=confirmNativeHit(translated,await nativeWitness(translated));
 approx(shifted.conditionalApparentDepthMm,baseline.conditionalApparentDepthMm);
 approxPoint(shifted.interfaceCrossingReference,{
    x:baseline.interfaceCrossingReference.x+13,
    y:baseline.interfaceCrossingReference.y+11
 });
});
test('one exactly axial observed native ray cannot uniquely locate the virtual source',async()=>{
 const f=fixture({observer:{x:100,y:0}});
 const r=await nativeWitness(f),a=confirmNativeHit(f,r);
 assert.equal(r.ref.apparentDepth,null);
 assert.equal(r.ref.apparentPoint,null);
 assert.equal(a.conditionalApparentDepthMm,null);
 assert.equal(a.nativeImageDetected,false);
});
test('invalid observer ordering is refused by reference; no ray is silently reversed',()=>{
 for(const f of [
  fixture({source:{x:60,y:0}}),
  fixture({observer:{x:-100,y:40}}),
  fixture({source:{x:-0.009,y:0}}),
  fixture({observer:{x:0.009,y:40}})
 ])assert.throws(()=>shootingReference(f),/opposite sides/);
});
test('stale scene or incomplete native run never supplies an observer detector hit',async()=>{
 const f=fixture(),ref=shootingReference(f),d=sceneFor(f,ref);
 const prior=evaluateDocument(d,core,requests).summary;
 assert.equal(prior.native.status,'completed');
 const edited=structuredClone(d);
 edited.physics.components.find(x=>x.id==='point' || x.id==='S1').emission.directionDeg+=1;
 const stale=(await evaluateObservables(edited,requests,prior)).results;
 assert.ok(stale.every(x=>x.status==='suppressed'&&x.value===null));
 const shallow=structuredClone(d);
 shallow.simulation.maxRayDepth=0;
 const truncated=evaluateDocument(shallow,core,requests).summary;
 assert.equal(truncated.native.status,'incomplete');
 assert.equal(truncated.observations,null);
 const suppressed=(await evaluateObservables(shallow,requests,truncated)).results;
 assert.ok(suppressed.every(x=>x.status==='suppressed'&&x.value===null));
 console.log('JEE_OBSERVER_NATIVE_SUPPRESSION '+JSON.stringify({
  staleSuppressed:true,incompleteSuppressed:true,nativeImageDetected:false
 }));
});
