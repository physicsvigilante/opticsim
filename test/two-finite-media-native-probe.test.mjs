// Test-only native feasibility for two disjoint convex glass bodies.
// No canonical v9 admission, no solver/threshold change, no production claim.
// The original native Glass/SingleRay/Detector objects own all propagation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {compilePolygon} from '../src/polygon-dielectric.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const saved=JSON.parse(readFileSync(new URL('../scenes/polygon-dielectric.json',import.meta.url),'utf8'));
const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<=epsilon,a+' differs from '+b);
function system({firstInside=1.5,secondInside=1.3,angle=0,sourceX=-200,sourceY=10}={}){
 const d=structuredClone(saved);
 d.physics.components[0].parameters.x=sourceX;
 d.physics.components[0].parameters.y=sourceY;
 d.physics.components[0].emission.directionDeg=angle;
 const first=d.physics.components[1];
 first.parameters.insideIndex=firstInside;
 const second=structuredClone(first);second.id='G2';second.parameters.insideIndex=secondInside;
 for(const i of [1,2,3,4])second.parameters['x'+i]+=200;
 d.physics.components.splice(2,0,second);
 const detector=d.physics.components.at(-1);detector.parameters.x=500;detector.parameters.length=800;
 const original=structuredClone(saved);
 const compiled=core.compile(original);
 // Build temporary native scene from exactly the already registered native
 // object compiler; canonical admission remains explicitly *unsupported*.
 const p=compiled.native;
 const src=structuredClone(p.objs[0]);src.p1={x:sourceX,y:-sourceY};
 const t=angle*Math.PI/180;src.p2={x:sourceX+20*Math.cos(t),y:-sourceY-20*Math.sin(t)};
 const det=structuredClone(p.objs[2]);det.p1.x=500;det.p2.x=500;
 p.objs=[src,compilePolygon(first),compilePolygon(second),det];
 const loaded=core.loadNative(p),map=new Map(d.physics.components.map((c,i)=>[c.id,i]));
 const sources=core.observeSourceSet(d,loaded.scene,map),
  interfaces=core.observeInterfaceSet(d,loaded.scene,map),
  detectors=core.observeDetectorSet(d,loaded.scene,map);
 const trace=[];
 for(const c of d.physics.components.filter(c=>c.type==='polygon-dielectric')){
  const o=loaded.scene.objs[map.get(c.id)],before=o.onRayIncident;
  o.onRayIncident=function(...args){
   const p={x:args[2].x,y:-args[2].y};
   const r=before.apply(this,args);
   trace.push({id:c.id,point:p,absorbed:!!r?.isAbsorbed});
   return r;
  };
 }
 const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,10000);
 let event=null;for(const n of ['simulationComplete','simulationStop'])sim.on(n,()=>{event=n;});
 sim.updateSimulation();
 const diagnostics=core.diagnostics(loaded.scene,sim,sources,null,detectors,interfaces);
 return {doc:d,trace,diagnostics,status:core.classifyRun(event,diagnostics),loaded};
}
test('Two separate native Glass bodies transmit a single exact ray through four actual faces',()=>{
 const r=system();assert.equal(r.status,'completed');
 assert.deepEqual(r.trace.map(e=>e.id),['G1','G1','G2','G2']);
 assert.equal(r.diagnostics.interfacesById.G1.interactions,2);
 assert.equal(r.diagnostics.interfacesById.G2.interactions,2);
 assert.equal(r.diagnostics.detectorsById.D1.crossings,1);
 assert.equal(r.diagnostics.emissionsById.S1.emitted,1);
 assert.equal(r.diagnostics.truncation,0);
 const xs=r.trace.map(e=>e.point.x);xs.forEach((x,i)=>near(x,[0,150,200,350][i]));
});
test('Two disjoint native Glass bodies use each independently authored index in actual oblique Snell events',()=>{
 const r=system({angle:10});assert.equal(r.status,'completed');
 assert.deepEqual(r.trace.map(e=>e.id),['G1','G1','G2','G2']);
 assert.equal(r.diagnostics.detectorsById.D1.crossings,1);
 for(const [id,n] of [['G1',1.5],['G2',1.3]]){
  const first=r.diagnostics.interfacesById[id].first;
  assert.equal(first.outcome,'transmission');
  near(first.incidentIndex,1);
  near(first.destinationIndex,n);
  // Degrees are actual native local-face observations. The independent
  // scalar Snell law is only a check, not a substitute tracer.
  const incident=first.incidentAngleDeg*Math.PI/180,
   refracted=first.transmittedAngleDeg*Math.PI/180;
  near(Math.sin(incident),n*Math.sin(refracted),1e-9);
 }
});
test('Missed second native region stays a miss, not a prescribed encounter',()=>{
 const r=system({angle:80});assert.equal(r.status,'completed');
 assert.equal(r.diagnostics.interfacesById.G1.interactions,0);
 assert.equal(r.diagnostics.interfacesById.G2.interactions,0);
 assert.equal(r.diagnostics.detectorsById.D1.crossings,0);
});
test('Temporary two-glass scene is not a claim of canonical version admission',()=>{
 const r=system();
 assert.throws(()=>core.compile(r.doc),/version|model|unsupported|scope/i);
});
