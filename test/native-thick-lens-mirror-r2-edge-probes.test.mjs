// Independent R2 #113 nonblocking follow-up, test-only. Do not add new
// production ray tracing, alter PhyDemo thresholds, or prescribe hit order.
// These are adversarial native runtime observations, not an image solver.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {inspectNative} from './helpers/native-composition-inspection.mjs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-mirror-v16.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(fixture.physical);
const component=(r,id)=>r.components.find(c=>c.id===id);
const prepare=r=>prepareScene(r).document;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const near=(x,y,eps=1e-6)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=eps,`${x} != ${y}`);
const vector=ray=>{
 const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,n=Math.hypot(dx,dy);
 assert.ok(n>0&&Number.isFinite(n));
 return {x:dx/n,y:dy/n};
};
const requests=[
 {id:'lens',kind:'interface-interactions',componentId:'L1'},
 {id:'mirror',kind:'mirror-reflections',componentId:'M1'},
 {id:'detector',kind:'detector-crossings',componentId:'D1'}
];
// Actual pinned callback events even when native run is incomplete or failed.
// Never force an expected ray route or change the production onRayIncident.
function rawNative(doc){
 const loaded=core.loadDocument(doc),trace=[];
 const sources=core.observeSourceSet(doc,loaded.scene,loaded.idMap);
 const mirrors=core.observeMirrorSet(doc,loaded.scene,loaded.idMap);
 const detectors=core.observeDetectorSet(doc,loaded.scene,loaded.idMap);
 const interfaces=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
 for(const c of doc.physics.components.filter(c=>c.type!=='point-source')){
  const native=loaded.scene.objs[loaded.idMap.get(c.id)],original=native.onRayIncident;
  native.onRayIncident=function(...args){
   const incoming=vector(args[0]),point={x:args[2].x,y:-args[2].y};
   const result=original.apply(this,args);
   const rays=[...(!result?.isAbsorbed?[args[0]]:[]),...(result?.newRays||[])];
   assert.ok(trace.length<96,'Bounded actual pinned-native callbacks');
   trace.push({id:c.id,point,incoming,outgoing:rays.map(vector),
    absorbed:!!result?.isAbsorbed,undefinedBehavior:!!result?.isUndefinedBehavior,
    truncation:result?.truncation??0});
   return result;
  };
 }
 const simulator=new core.Simulator(loaded.scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
 let event=null;
 for(const kind of ['simulationComplete','simulationStop'])simulator.on(kind,()=>{event=kind;});
 simulator.updateSimulation();
 const diagnostic=core.diagnostics(loaded.scene,simulator,sources,mirrors,detectors,interfaces);
 return {trace,event,diagnostic,status:core.classifyRun(event,diagnostic)};
}
async function publicResults(doc){
 const run=evaluateDocument(doc,core,requests);
 const measured=await evaluateObservables(doc,requests,run.summary);
 if(!run.summary.executionPassed)
  assert.ok(measured.results.every(v=>v.status==='suppressed'&&v.value===null),
   'Invalid native evidence cannot publish a qualified physics measurement');
 return {status:run.summary.native.status,executionPassed:run.summary.executionPassed,
  values:measured.results.map(x=>({status:x.status,value:x.value})),
  errors:run.report.native.diagnostics.errors,
  truncation:run.summary.native.truncation,
  undefinedBehavior:run.summary.native.undefinedBehavior};
}
test('R2-V16-03: actual mirror-first ray reflects before later finite-lens entry',async()=>{
 const r=fresh();
 Object.assign(component(r,'S1').parameters,{x:-50,y:10});
 component(r,'S1').emission.directionDeg=180;
 Object.assign(component(r,'M1').parameters,{x:-130,y:0,orientationDeg:90});
 Object.assign(component(r,'D1').parameters,{x:100,y:0});
 const d=prepare(r),native=inspectNative(d),events=native.trace;
 assert.equal(d.schemaVersion,16);
 assert.deepEqual(events.map(e=>e.id),['M1','L1','L1','D1']);
 const mirror=events[0],lens=events.filter(e=>e.id==='L1');
 near(mirror.point.x,-130);
 near(mirror.outgoing[0].x,-mirror.incoming.x,1e-8);
 near(mirror.outgoing[0].y,mirror.incoming.y,1e-8);
 for(const e of lens){
  const p=component(r,'L1').parameters,front=e.point.x<p.x;
  const R=front?p.frontRadius:p.backRadius,cx=front?p.x-p.centerThickness/2+R:p.x+p.centerThickness/2-R;
  near(Math.hypot(e.point.x-cx,e.point.y-p.y),R,1e-5);
  const n={x:(e.point.x-cx)/R,y:(e.point.y-p.y)/R};
  const leaving=dot(e.incoming,n)>0,ni=leaving?p.insideIndex:p.outsideIndex,
   nt=leaving?p.outsideIndex:p.insideIndex;
  assert.equal(e.outgoing.length,1);
  near(ni*cross(e.incoming,n),nt*cross(e.outgoing[0],n),1e-7);
 }
 assert.equal(native.diagnostic.reflectionsById.M1,1);
 assert.equal(native.diagnostic.interfacesById.L1.interactions,2);
 assert.equal(native.diagnostic.detectorsById.D1.crossings,1);
 const publicEvidence=await publicResults(d);
 assert.equal(publicEvidence.status,'completed');
 assert.deepEqual(publicEvidence.values.map(x=>x.value),[2,1,1]);
 console.log('V16_R2_MIRROR_FIRST_NATIVE '+JSON.stringify({
  status:'completed',sequence:events.map(e=>e.id),mirror:mirror.point,
  lensPoints:lens.map(e=>e.point),detector:events.at(-1).point}));
});
test('R2-V16-01: native corner-targeted mirror returns cannot qualify an observed ambiguous rim/arc incident',async()=>{
 const corner={x:-15+100-Math.sqrt(10000-2500),y:50}; // back/top corner uses right vertex +15 - sag
 corner.x=15-100+Math.sqrt(10000-2500);
 const orientations=[76.177,76.18094629718023,76.185];
 for(const orientation of orientations){
  const r=fresh();component(r,'M1').parameters.orientationDeg=orientation;
  const d=prepare(r),raw=rawNative(d),run=await publicResults(d);
  const mirror=raw.trace.find(x=>x.id==='M1');
  assert.ok(mirror&&mirror.outgoing.length===1,'Actual finite native mirror encounter required');
  const v=mirror.outgoing[0],z={x:corner.x-mirror.point.x,y:corner.y-mirror.point.y};
  const ahead=dot(z,v),perpendicular=Math.abs(cross(z,v));
  assert.ok(ahead>0,'Lens corner must lie ahead of actual reflected ray');
  const callback=raw.trace.filter(x=>x.id==='L1').filter(x=>
   Math.hypot(x.point.x-corner.x,x.point.y-corner.y)<0.01);
  const invalid=raw.diagnostic.interfacesById.L1.invalidObservations;
  if(callback.length){
   assert.ok(invalid>0,'Actual near-corner native callback must be ambiguous');
   assert.equal(run.executionPassed,false,'Ambiguous native face must not certify a result');
   assert.ok(run.values.every(x=>x.status==='suppressed'&&x.value===null));
  }
  // A theoretical near-corner aim with NO native callback is insufficient
  // to certify numerical precision; the exact native hit/miss is reported.
  assert.ok(raw.trace.every(x=>Number.isFinite(x.point.x)&&Number.isFinite(x.point.y)));
  console.log('V16_R2_RETURNED_CORNER_NATIVE '+JSON.stringify({
   orientation,sourceSha:d.upstreamCommit,geometricCorner:corner,
   mirrorPoint:mirror.point,reflectedUnit:v,projectedCornerDistance:perpendicular,
   nearCornerCallbacks:callback.length,interfaceInvalidObservations:invalid,
   status:raw.status,errors:raw.diagnostic.errors,public:run
  }));
 }
});
test('R2-V16-02: almost-coincident finite mirror/detector is not silently given fake complete readings',async()=>{
 const r=fresh();
 r.components.push({id:'D2',type:'ray-detector',
  parameters:{x:130.0000001,y:0,orientationDeg:90,length:200}});
 const d=prepare(r),raw=rawNative(d);
 const inquiries=[...requests,{id:'near',kind:'detector-crossings',componentId:'D2'}];
 const run=evaluateDocument(d,core,inquiries);
 const read=(await evaluateObservables(d,inquiries,run.summary)).results;
 if(!run.summary.executionPassed){
  assert.ok(read.every(x=>x.status==='suppressed'&&x.value===null),
    'Near-coincident undefined or truncated simulation may not publish counts');
 }else{
  assert.ok(read.every(x=>x.value!==null),
    'Complete native run may report true samples but cannot imply guaranteed precision');
 }
 assert.equal(raw.diagnostic.detectorsById.D2.crossings,
  run.report.native.diagnostics.detectorsById.D2.crossings);
 assert.ok(raw.trace.filter(x=>x.id==='D2').length<=4,'Bounded observed detector callbacks');
 console.log('V16_R2_NEAR_COINCIDENT_NATIVE '+JSON.stringify({
  deltaMm:1e-7,standardNativeMinimumRaySegmentMm:1e-6,
  status:raw.status,errors:raw.diagnostic.errors,warnings:raw.diagnostic.warnings,
  truncation:raw.diagnostic.truncation,undefinedBehavior:raw.diagnostic.undefinedBehavior,
  sequence:raw.trace.map(x=>({id:x.id,point:x.point})),
  callbacksD2:raw.diagnostic.detectorsById.D2.crossings,
  publicStatus:run.summary.native.status,
  publicResults:read.map(x=>({id:x.id,status:x.status,value:x.value}))
 }));
});
