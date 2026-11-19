// Focused follow-up for Chat B PR173 PASS WITH CONDITIONS at d6e5d404.
// This is optical NUMERICS and qualifier evidence, not a separate tracer.
// All real ray cases use the unchanged pinned PhyDemo native runtime.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {validate} from '../src/contract.js';
import {prismVertices} from '../src/triangular-prism.js';
import {compileParallelBeam} from '../src/parallel-beam.js';
import {PRISM_BEAM_VERTEX_CLEARANCE_MM} from '../src/native-prism-beam.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/jee-prism-beam-v22.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(fixture.physical);
const lens=(p,id)=>p.components.find(c=>c.id===id).parameters;
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} not equal to ${b} (tolerance ${t})`);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const radians=deg=>deg*Math.PI/180;
const degrees=rad=>rad*180/Math.PI;
async function observed(p,requests=fixture.requests){
 const doc=prepareScene(p).document,run=evaluateDocument(doc,core,requests);
 const results=(await evaluateObservables(doc,requests,run.summary)).results;
 return {doc,run,results};
}
test('real non-normal v22 sloping-face transmission satisfies independent sine and signed tangential Snell law',async()=>{
 const p=copy();lens(p,'G1').x3=20;
 const {run,results}=await observed(p);
 assert.equal(run.summary.native.status,'completed');
 assert.equal(run.summary.native.undefinedBehavior,0);
 assert.equal(run.summary.native.truncation,0);
 assert.equal(results[4].value,0,'short prism does not invoke native TIR');
 const faces=results[2].value;
 // Independent geometry, before reading native angles. Source enters flat
 // normal, then sees the sloping face with tan(theta)=20/70.
 const incidentExpected=degrees(Math.atan2(20,70));
 const transmittedExpected=degrees(Math.asin(1.5*Math.sin(radians(incidentExpected))));
 assert.ok(incidentExpected>10&&transmittedExpected>20,'genuinely oblique non-degenerate test');
 for(const id of ['face-23','face-31']){
  const event=faces[id].first;
  assert.equal(event.faceId,id);
  assert.equal(event.from,'inside');
  assert.equal(event.incidentIndex,1.5);
  assert.equal(event.destinationIndex,1);
  assert.equal(event.outcome,'transmission');
  near(event.incidentAngleDeg,incidentExpected,1e-8);
  near(event.transmittedAngleDeg,transmittedExpected,1e-8);
  const transmitted=event.branches.filter(b=>b.kind==='transmitted');
  assert.equal(transmitted.length,1);
  const n=event.outwardNormal;
  near(Math.hypot(n.x,n.y),1,1e-12);
  const i=event.incidentDirection,o=transmitted[0].direction;
  assert.ok(dot(i,n)>0&&dot(o,n)>0,'measured inside-to-outside transmission');
  near(1.5*cross(i,n),cross(o,n),1e-9);
  near(Math.asin(Math.min(1,1.5*Math.abs(cross(i,n)))),radians(event.transmittedAngleDeg),1e-9);
 }
 console.log('JEE_V22_OBLIQUE_SNELL '+JSON.stringify({actualFaces:['face-23','face-31'],
   analyticalIncidentDeg:incidentExpected,analyticalTransmittedDeg:transmittedExpected,
   nativeTIR:results[4].value,detectorCrossings:results[5].value,
   numericalClaim:'sampled finite native rays, not original prism inverse'}));
});
test('actual v22 near-critical native hits are withheld below, at and above the independently calculated critical boundary',async()=>{
 const H=70,n1=1.5,n2=1;
 // tan(asin(n2/n1)) = n2 / sqrt(n1^2-n2^2).
 const critX=H*n2/Math.sqrt(n1*n1-n2*n2);
 const records=[];
 for(const delta of [-.000001,0,.000001]){
  const p=copy();lens(p,'G1').x3=critX+delta;
  const {doc,run,results}=await observed(p);
  assert.equal(doc.schemaVersion,22);
  // Qualified execution intentionally withholds its interface ledger on
  // failure. Capture the ORIGINAL native callbacks in a second, separately
  // labelled test-only replay of the exact same canonical scene. This raw
  // event witness is not published as qualified execution evidence.
  const loaded=core.loadDocument(doc);
  const meter=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
  const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,10000);
  let nativeTerminal=null;
  for(const event of ['simulationComplete','simulationStop'])
    sim.on(event,()=>{nativeTerminal=event;});
  sim.updateSimulation();
  assert.ok(nativeTerminal,'exact-scene raw witness did not finish native callback dispatch');
  const first=meter.byId.G1;
  assert.ok(first,'test-only native Glass callback ledger was not captured');
  assert.ok(first.invalidObservations>0,
    'a real native near-critical incident must raise v22 observer risk');
  const sides=['face-23','face-31'].map(k=>first.faces[k].first).filter(Boolean);
  assert.ok(sides.length>0,'real finite native ray reached an actual sloping face');
  // Critical proximity is evaluated ONLY from observed incoming direction
  // and actual outward normal, never by steering native propagation.
  const closest=Math.min(...sides.map(e=>
    Math.abs(e.incidentIndex*Math.abs(cross(e.incidentDirection,e.outwardNormal))-e.destinationIndex)));
  assert.ok(closest<.00001,'actual sampled ray is not in the explicitly near-critical band');
  assert.ok(results.every(r=>r.value===null&&r.status==='suppressed'),
    'numerically unresolved near-critical branches must not become qualified measurements');
  assert.notEqual(run.summary.native.status,'completed');
  records.push({deltaMm:delta,actualNativeStatus:run.summary.native.status,
    rawNativeTerminal:nativeTerminal,rawNativeWitnessNotQualified:true,
    sideEvents:sides.length,minimumCriticalResidual:closest,
    invalidObservations:first.invalidObservations,
    sampledTransmission:sides.filter(x=>x.outcome==='transmission').length,
    sampledTIR:sides.filter(x=>x.outcome==='total-internal-reflection').length});
 }
 console.log('JEE_V22_CRITICAL_NATIVE '+JSON.stringify({
  criticalApexDistanceMm:critX,records,allReadingsWithheld:true,
  noInventedCriticalRay:true}));
});
test('v22 runtime rejects a later actual native Glass hit within 0.1 mm of a vertex even though initial safe public Beam is unchanged',()=>{
 const physical=copy(),doc=prepareScene(physical).document;
 const compiled=core.compile(doc),raw=structuredClone(compiled.native);
 assert.equal(doc.schemaVersion,22);
 // First, prove the same risky source is *rejected* by normal public
 // authoring. Then substitute only that Beam in an UNQUALIFIED RAW NATIVE
 // research input. The emitted ray near y=.05 hits the flat face first,
 // then its actual native post-entry trajectory meets the sloping face near
 // the physical apex. This raw scene is never treated as canonical evidence.
 const unsafe=copy();lens(unsafe,'B1').width=10;lens(unsafe,'B1').y=2.55;
 assert.throws(()=>prepareScene(unsafe),'the native probe must not become public authoring');
 raw.objs[compiled.idMap.get('B1')]=compileParallelBeam({
  type:'parallel-beam',parameters:lens(unsafe,'B1')});
 const scene=core.loadNative(raw),prism=scene.objs[compiled.idMap.get('G1')];
 const original=prism.onRayIncident;
 const captured=[];
 prism.onRayIncident=function(...args){
  captured.push({point:{x:args[2].x,y:-args[2].y}});
  return original.apply(this,args);
 };
 const observer=core.observeInterfaceSet(doc,scene,compiled.idMap);
 const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
 let terminal=null;
 for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{terminal=name;});
 sim.updateSimulation();
 assert.ok(terminal,'native probe failed to return a terminal callback');
 const vertices=prismVertices(lens(physical,'G1'));
 const apex=vertices[2];
 const close=captured.filter(e=>Math.hypot(e.point.x-apex.x,e.point.y-apex.y)<PRISM_BEAM_VERTEX_CLEARANCE_MM);
 assert.ok(close.length>=1,'actual post-flat native ray never reached the near-apex band');
 assert.ok(close.every(e=>Math.hypot(e.point.x-apex.x,e.point.y-apex.y)>.01),
   'native probe must distinguish reviewed .01 historical observer threshold');
 assert.ok(observer.byId.G1.invalidObservations>=1,
   'v22 must not qualify a native callback inside the 0.1-mm vertex band');
 assert.ok(observer.errors.length>=1);
 console.log('JEE_V22_RAW_NATIVE_VERTEX '+JSON.stringify({unqualifiedResearchOnly:true,
  nativeCallbackCount:captured.length,nearApexCallbacks:close.length,
  apexDistanceMm:Math.min(...close.map(e=>Math.hypot(e.point.x-apex.x,e.point.y-apex.y))),
  capturedErrors:observer.errors.length,notAPublicQualifiedRun:true}));
});
test('v22 near-vertex callback refusal is stricter than frozen v8 0.01 mm and delegates exactly once',()=>{
 const nativePoint={x:100-.05*100/Math.hypot(100,70),
  y:-.05*70/Math.hypot(100,70)};
 function inject(doc){
  const loaded=core.loadDocument(doc),prism=loaded.scene.objs[loaded.idMap.get('G1')];
  let calls=0;
  prism.onRayIncident=function(...args){calls++;return {isAbsorbed:true};};
  const observer=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
  const ray={p1:{x:nativePoint.x-1,y:nativePoint.y},p2:{x:nativePoint.x,y:nativePoint.y},
    brightness_s:.04,brightness_p:.04};
  prism.onRayIncident(ray,0,nativePoint,[]);
  assert.equal(calls,1,'observer must not double-delegate or replace native method');
  return observer;
 }
 const v22=prepareScene(copy()).document,modern=inject(v22);
 assert.equal(modern.byId.G1.invalidObservations,1);
 assert.equal(modern.byId.G1.first.faceId,null);
 assert.equal(modern.byId.G1.faces['face-23'].interactions,0);
 assert.equal(modern.errors.length,1);
 const legacy=copy();
 legacy.components[0]={id:'S1',type:'point-source',parameters:{x:-100,y:20,brightness:.08},
  emission:{mode:'single-ray',directionDeg:0}};
 lens(legacy,'D1').length=100;
 const v8=prepareScene(legacy).document;
 assert.equal(v8.schemaVersion,8);
 const old=inject(v8);
 assert.equal(old.byId.G1.invalidObservations,0);
 assert.equal(old.byId.G1.first.faceId,'face-23');
 assert.equal(old.errors.length,0);
});
test('two real downstream native Detectors count all four separate transmitted Beam samples without positional route fabrication',async()=>{
 const p=copy();lens(p,'G1').x3=20;
 p.components.push({id:'D2',type:'ray-detector',parameters:{x:300,y:0,
   length:600,orientationDeg:90}});
 const requests=[...fixture.requests,
  {id:'d2count',kind:'detector-crossings',componentId:'D2'},
  {id:'d2hits',kind:'detector-hit-events',componentId:'D2'}];
 const {doc,run,results}=await observed(p,requests);
 assert.equal(doc.schemaVersion,22);
 assert.equal(run.summary.native.status,'completed');
 assert.deepEqual(core.compile(doc).native.objs.map(x=>x.type),['Beam','Glass','Detector','Detector']);
 const get=id=>results.find(x=>x.id===id);
 for(const [n,hit,x] of [['crossings','hits',200],['d2count','d2hits',300]]){
  assert.equal(get(n).status,'qualified');assert.equal(get(n).value,4);
  assert.equal(get(hit).status,'qualified');assert.equal(get(hit).value.length,4);
  assert.ok(get(hit).value.every(e=>Math.abs(e.pointMm.x-x)<1e-6&&
    Number.isFinite(e.pointMm.y)&&e.incomingUnit.x>0));
 }
 assert.deepEqual(run.summary.observations.detectorsById.D1.crossings,4);
 assert.deepEqual(run.summary.observations.detectorsById.D2.crossings,4);
 console.log('JEE_V22_TWO_DETECTORS '+JSON.stringify({nativeComplete:true,
  firstCrossings:4,secondCrossings:4,distinctNativePositions:true,
  noPerRayPathIdentityClaim:true}));
});
