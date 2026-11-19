// JEE v23 native Beam+CircleGlass public authoring and genuine measured data.
// The unchanged pinned native engine selects all entry, exit and TIR paths.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,inspectAuthoringRequest} from '../src/authoring.js';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {predict} from '../src/analysis.js';
import {formatRequestedResult} from '../src/result-preview.js';
import {CIRCLE_BEAM_VERSION,CIRCLE_BEAM_MODEL,circleBeamNativeEncounter} from '../src/native-circle-beam.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/jee-circle-beam-v23.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(fixture.physical);
const by=(r,id)=>r.components.find(c=>c.id===id).parameters;
const prepare=p=>prepareScene(p).document;
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,
  String(a)+' differs from '+String(b)+' by more than '+t);
async function run(p,requests=fixture.requests){
 const doc=prepare(p),native=evaluateDocument(doc,core,requests);
 const obs=(await evaluateObservables(doc,requests,native.summary)).results;
 return {doc,native,obs};
}
test('v23 authoring has its own full-circle contract and exactly compiled native Beam/CircleGlass/Detector',()=>{
 const physical=fresh(),before=JSON.stringify(physical),doc=prepare(physical);
 assert.equal(JSON.stringify(physical),before,'source raw physical facts must remain unchanged');
 assert.equal(doc.schemaVersion,CIRCLE_BEAM_VERSION);
 assert.equal(doc.adapterVersion,CIRCLE_BEAM_VERSION);
 assert.equal(doc.physics.model,CIRCLE_BEAM_MODEL);
 assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['Beam','CircleGlass','Detector']);
 const circle=core.compile(doc).native.objs[1];
 assert.deepEqual(circle,{type:'CircleGlass',p1:{x:0,y:-0},
   p2:{x:100,y:-0},refIndex:1.5,partialReflect:false});
 assert.deepEqual(parseSave(serializeSave(doc)),doc);
 assert.equal(capabilities().nativeCircleBeam.schemaVersion,23);
 assert.equal(predict(doc).kind,'unavailable');
});
test('actual pinned native finite Beam enters and exits curved CircleGlass with independently computed nonzero Snell',async()=>{
 const r=await run(fresh());
 assert.equal(r.native.summary.native.status,'completed');
 assert.equal(r.native.summary.native.truncation,0);
 assert.equal(r.native.summary.native.undefinedBehavior,0);
 assert.deepEqual(r.obs.map(x=>x.status),Array(6).fill('qualified'),
   'Fresnel-off is an explicit approximation, not native image detection');
 assert.deepEqual([r.obs[0].value,r.obs[1].value,r.obs[3].value,r.obs[4].value],[4,8,0,4]);
 assert.equal(r.obs[5].value.length,4);
 const e=r.obs[2].value;
 assert.equal(e.from,'outside');assert.equal(e.incidentIndex,1);
 assert.equal(e.destinationIndex,1.5);
 assert.equal(e.outcome,'transmission');
 const measuredY=Math.abs(e.pointMm.y);
 assert.ok(measuredY>0,'this first sampled ray must be genuinely oblique');
 const angle=Math.asin(measuredY/100);
 near(e.incidentAngleDeg,angle*180/Math.PI,1e-7);
 near(e.transmittedAngleDeg,Math.asin(Math.sin(angle)/1.5)*180/Math.PI,1e-7);
 const normal=e.outwardNormal,incoming=e.branches[0].direction;
 near(Math.hypot(normal.x,normal.y),1,1e-8);
 assert.ok(incoming.x>0,'native first transmitted branch must head forward');
 assert.ok(r.obs[5].value.every(h=>Math.abs(h.pointMm.x-260)<1e-7));
 console.log('JEE_V23_CIRCLE_NATIVE '+JSON.stringify({nativeComplete:true,
   emitted:4,realCircleIncidents:8,detectorCrossings:4,
   firstIncidenceDeg:e.incidentAngleDeg,firstTransmittedDeg:e.transmittedAngleDeg,
   nativeImageDetected:false}));
});
test('reverse right-to-left and translated finite circular optics retrace pinned native rays',async()=>{
 const r=fresh();by(r,'B1').x=160;by(r,'B1').directionDeg=180;by(r,'D1').x=-260;
 const rev=await run(r);
 assert.equal(rev.native.summary.native.status,'completed');
 assert.deepEqual([rev.obs[0].value,rev.obs[1].value,rev.obs[4].value],[4,8,4]);
 assert.ok(rev.obs[5].value.every(e=>e.incomingUnit.x<0));
 const t=fresh();
 for(const c of t.components){c.parameters.x+=70;c.parameters.y-=35;}
 const shifted=await run(t);
 assert.equal(shifted.native.summary.native.status,'completed');
 assert.deepEqual([shifted.obs[0].value,shifted.obs[1].value,shifted.obs[4].value],[4,8,4]);
});
test('explicit radius, index and sample width variation truly re-executes CircleGlass',async()=>{
 for(const [key,value] of [['radius',80],['insideIndex',1.3],['insideIndex',2]]){
  const r=fresh();by(r,'G1')[key]=value;
  const z=await run(r);
  assert.equal(z.native.summary.native.status,'completed');
  assert.deepEqual([z.obs[0].value,z.obs[1].value,z.obs[4].value],[4,8,4]);
  assert.equal(z.obs[2].value.incidentIndex,1);
  assert.equal(z.obs[2].value.destinationIndex,key==='insideIndex'?value:1.5);
 }
 const wide=fresh();by(wide,'B1').width=40;
 const z=await run(wide);
 assert.equal(z.native.summary.native.status,'completed');
 assert.deepEqual([z.obs[0].value,z.obs[1].value,z.obs[4].value],[8,16,8]);
});
test('explicit lower-index bubble uses native two-boundary refraction, not planar apparent depth',async()=>{
 const p=fresh();by(p,'G1').insideIndex=1;by(p,'G1').outsideIndex=1.5;
 const z=await run(p);
 assert.equal(z.native.summary.native.status,'completed');
 assert.equal(z.obs[0].value,4);
 assert.equal(z.obs[1].value,8);
 assert.equal(z.obs[2].value.from,'outside');
 assert.equal(z.obs[2].value.incidentIndex,1.5);
 assert.equal(z.obs[2].value.destinationIndex,1);
 assert.equal(z.obs[3].value,0);
 assert.equal(z.obs[4].value,4);
 const initial=Math.asin(Math.abs(z.obs[2].value.pointMm.y)/100);
 near(z.obs[2].value.transmittedAngleDeg,
   Math.asin(1.5*Math.sin(initial))*180/Math.PI,1e-7);
 assert.equal(predict(z.doc).kind,'unavailable','no 3D bubble apparent image is inferred');
});
test('two downstream vertical detectors record independent native crossings without inventing ray ancestry',async()=>{
 const p=fresh();
 p.components.push({id:'D2',type:'ray-detector',parameters:{x:360,y:0,length:400,orientationDeg:90}});
 const requests=[...fixture.requests,
  {id:'D2count',kind:'detector-crossings',componentId:'D2'},
  {id:'D2hits',kind:'detector-hit-events',componentId:'D2'}];
 const z=await run(p,requests);
 assert.equal(z.native.summary.native.status,'completed');
 assert.deepEqual(core.compile(z.doc).native.objs.map(o=>o.type),
   ['Beam','CircleGlass','Detector','Detector']);
 assert.equal(z.obs[4].value,4);
 assert.equal(z.obs[6].value,4);
 assert.equal(z.obs[5].value.length,4);
 assert.equal(z.obs[7].value.length,4);
 assert.ok(z.obs[7].value.every(h=>Math.abs(h.pointMm.x-360)<1e-7));
});
test('v23 refuses tangent, uncertain first entry, source inside, Fresnel, mixed optics and missing indices',()=>{
 const mutators=[
  ['tangent centre',p=>by(p,'B1').y=90],
  ['near tangent centre',p=>by(p,'B1').y=89.99],
  ['source inside circle',p=>by(p,'B1').x=0],
  ['source near boundary',p=>by(p,'B1').x=-100.005],
  ['oblique beam',p=>by(p,'B1').directionDeg=30],
  ['circle radius small',p=>by(p,'G1').radius=10],
  ['circle extends outside world',p=>by(p,'G1').x=9990],
  ['Fresnel branching',p=>by(p,'G1').partialReflection=true],
  ['missing inside index',p=>delete by(p,'G1').insideIndex],
  ['missing outside index',p=>delete by(p,'G1').outsideIndex],
  ['missing Fresnel choice',p=>delete by(p,'G1').partialReflection],
  ['saturation',p=>by(p,'B1').brightness=.9],
  ['too wide for 90 percent circle',p=>by(p,'B1').width=100;],
  ['detector intersecting circle',p=>by(p,'D1').x=90],
  ['second detector same plane',p=>p.components.push({
    id:'D2',type:'ray-detector',parameters:{x:260,y:0,length:200,orientationDeg:90}})],
  ['extra prism',p=>p.components.push({id:'P1',type:'triangular-prism',parameters:{
    x1:100,y1:-40,x2:100,y2:40,x3:150,y3:0,insideIndex:1.4,outsideIndex:1,partialReflection:false}})],
  ['point source mixture',p=>p.components.push({id:'S2',type:'point-source',
    parameters:{x:-180,y:0,brightness:.08},emission:{mode:'single-ray',directionDeg:0}})]
 ];
 for(const [why,edit] of mutators){
  const p=fresh();edit(p);
  assert.throws(()=>prepare(p),undefined,'should refuse: '+why);
 }
 const p=fresh();by(p,'G1').insideIndex=1;by(p,'G1').outsideIndex=3;
 by(p,'B1').y=31;
 assert.throws(()=>prepare(p),'outside-to-inside near critical initial sample must refuse');
 const missing=fresh();delete by(missing,'G1').radius;
 assert.ok(inspectAuthoringRequest(missing).length>0);
});
test('v7 SingleRay circle and v19 Beam never migrate to v23 or acquire its evidence policy',()=>{
 const old=JSON.parse(readFileSync(new URL('../examples/circular-dielectric.json',import.meta.url),'utf8'));
 const v7=prepare(old.physical);
 assert.equal(v7.schemaVersion,7);
 assert.deepEqual(core.compile(v7).native.objs.map(o=>o.type),['SingleRay','CircleGlass','Detector']);
 assert.deepEqual(parseSave(serializeSave(v7)),v7);
 const v19=JSON.parse(readFileSync(new URL('../examples/jee-parallel-lens-v19.json',import.meta.url),'utf8'));
 const oldBeam=prepare(v19.physical);
 assert.equal(oldBeam.schemaVersion,19);
 assert.deepEqual(parseSave(serializeSave(oldBeam)),oldBeam);
 const invalid=structuredClone(v7);
 invalid.physics.components[0].type='parallel-beam';
 assert.throws(()=>validate(invalid));
 // Explicit synthetic off-circle callback: v23 rejects radial residual
 // but frozen v7 measurement continues its original radial normal logic.
 const hit={x:100.0001,y:-0},incoming={x:1,y:0};
 const comp=prepare(fresh()).physics.components.find(c=>c.id==='G1');
 assert.equal(circleBeamNativeEncounter(comp,hit,incoming).invalid,true);
});
test('stale, stopped and depth-limited circle Beam never promote raw native data to qualified readings',async()=>{
 const doc=prepare(fresh());
 for(const [key,value] of [['maxRayDepth',0],['processedRayLimit',1]]){
  const altered=structuredClone(doc);altered.simulation[key]=value;validate(altered);
  const run=evaluateDocument(altered,core,fixture.requests);
  assert.notEqual(run.summary.native.status,'completed');
  const results=(await evaluateObservables(altered,fixture.requests,run.summary)).results;
  assert.ok(results.every(r=>r.status==='suppressed'&&r.value===null));
 }
 const original=evaluateDocument(doc,core,fixture.requests);
 const stale=structuredClone(doc);
 stale.physics.components.find(c=>c.id==='G1').parameters.insideIndex=1.4;validate(stale);
 const results=(await evaluateObservables(stale,fixture.requests,original.summary)).results;
 assert.ok(results.every(r=>r.status==='suppressed'&&r.value===null));
});
test('dense native circle detector overflow retains true counts and withholds full event list',async()=>{
 const p=fresh();by(p,'B1').width=80;by(p,'D1').length=1000;
 const doc=prepare(p);doc.simulation.rayDensity=.8;validate(doc);
 const run=evaluateDocument(doc,core,fixture.requests);
 assert.equal(run.summary.native.status,'completed');
 const results=(await evaluateObservables(doc,fixture.requests,run.summary)).results;
 assert.equal(results[0].value,64);
 assert.equal(results[1].value,128);
 assert.equal(results[4].value,64);
 assert.equal(results[5].status,'unavailable');
 assert.equal(results[5].value,null);
 assert.equal(run.summary.observations.detectorHitEventsById.D1.observedCount,64);
 assert.equal(run.summary.observations.detectorHitEventsById.D1.reasonCode,'HIT_EVENT_LIMIT_EXCEEDED');
 console.log('JEE_V23_OVERFLOW_NATIVE '+JSON.stringify({
   emitted:64,circleIncidents:128,detectorCrossings:64,
   precisePositions:'withheld',nativeImageDetected:false}));
});
