// TEST-ONLY native feasibility: unmodified PhyDemo AngleSource illumination
// combined with independently authored native SphericalLens/Mirror/Aperture.
// The canonical v18 contract MUST still reject directional fan sources.
// Do not interpret sampled absorption as an image or continuous throughput.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const original=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-aperture-v18.json',import.meta.url),'utf8'));
// Pinned AngleSource iterates in native y-DOWN; our documented readout is y-UP.
// Thus the first emitted sample is +18°, descending by 3.6° per ray.
const sampleAngles=Object.freeze(Array.from({length:10},(_,i)=>18-3.6*i));
const close=(a,b,epsilon=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=epsilon,a+' != '+b);
const byId=(r,id)=>r.components.find(c=>c.id===id);
const sourceDirection=ray=>{
 const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y;
 return Math.atan2(dy,dx)*180/Math.PI;
};
function probe({openingLength=20,density=.2,mirrorShift=0,reverseComponents=false}={}){
 const r=structuredClone(original.physical);
 byId(r,'S1').parameters.brightness=.08; // No per-ray brightness clipping.
 byId(r,'A1').parameters.openingLength=openingLength;
 byId(r,'M1').parameters.y+=mirrorShift;
 if(reverseComponents)r.components.reverse();
 const doc=prepareScene(r).document;
 assert.equal(doc.schemaVersion,18);
 const compiled=core.compile(doc);
 const sourceId=compiled.idMap.get('S1');
 const originalNative=structuredClone(compiled.native.objs);
 // The existing v4 general-component compiler is the *only* origin of the
 // native AngleSource object. This intentionally bypasses only v18's source
 // admission, not the upstream solver, component geometry, or ray routing.
 const v4=structuredClone(doc);
 v4.schemaVersion=v4.adapterVersion=4;
 v4.physics.model='general-component-tracing';
 v4.physics.components=[structuredClone(byId(r,'S1'))];
 v4.physics.components[0].emission={mode:'directional',directionDeg:0,angleDeg:36};
 v4.simulation.maxRayDepth=8;
 const emitter=core.compile(v4).native.objs[0];
 assert.equal(emitter.type,'AngleSource');
 const assembled=structuredClone(compiled.native);
 assembled.rayModeDensity=density;
 assembled.objs[sourceId]=emitter;
 // No other native object may be changed or reordered by this probe.
 assembled.objs.forEach((obj,i)=>{if(i!==sourceId)assert.deepEqual(obj,originalNative[i]);});
 const scene=core.loadNative(assembled);
 const source=scene.objs[sourceId];
 const nativeStart=source.onSimulationStart;
 let starts=0,emittedAngles=[];
 source.onSimulationStart=function(...args){
   const result=nativeStart.apply(this,args);starts++;
   emittedAngles=(result?.newRays??[]).map(sourceDirection);
   return result;
 };
 const sources=core.observeSourceSet(doc,scene,compiled.idMap);
 const mirrors=core.observeMirrorSet(doc,scene,compiled.idMap);
 const detectors=core.observeDetectorSet(doc,scene,compiled.idMap);
 const interfaces=core.observeInterfaceSet(doc,scene,compiled.idMap);
 const blockers=core.observeBlockerSet(doc,scene,compiled.idMap);
 const aperture=scene.objs[compiled.idMap.get('A1')],originalIncident=aperture.onRayIncident;
 const stopEvents=[];
 aperture.onRayIncident=function(...args){
   // Snapshot incident ray and finite intersection BEFORE the native incident
   // mutates its own ray. Call the pre-existing observer exactly once.
   const ray=args[0],hit=args[2];
   const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,
     norm=Math.hypot(dx,dy);
   const point={x:hit?.x,y:hit?.y===undefined?null:-hit.y};
   const incoming={x:dx/norm,y:dy/norm};
   const out=originalIncident.apply(this,args);
   if(stopEvents.length>=128)throw Error('Research evidence overflow; no clipped observations');
   stopEvents.push({point,incoming,absorbed:out?.isAbsorbed===true});
   return out;
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
 let event=null;
 for(const type of ['simulationComplete','simulationStop'])sim.on(type,()=>{event=type;});
 sim.updateSimulation();
 const diagnostic=core.diagnostics(scene,sim,sources,mirrors,detectors,interfaces,blockers);
 const status=core.classifyRun(event,diagnostic);
 return {status,event,doc,starts,emittedAngles,stopEvents,diagnostic,emitter};
}

test('v18 remains sealed: a sampled directional fan is not yet public thick-lens authoring',()=>{
 const d=prepareScene(structuredClone(original.physical)).document;
 const altered=structuredClone(d);
 altered.physics.components.find(c=>c.id==='S1').emission={
   mode:'directional',directionDeg:0,angleDeg:36
 };
 assert.throws(()=>core.compile(altered),/single|scope|source/i);
 const r=probe();
 assert.equal(r.emitter.type,'AngleSource');
 assert.equal(r.starts,1,'Native source start delegates exactly once');
 assert.equal(r.diagnostic.emissionsById.S1.emitted,r.emittedAngles.length);
 assert.equal(r.emittedAngles.length,10);
 for(let i=0;i<10;i++)close(r.emittedAngles[i],sampleAngles[i],1e-7);
 // The returned native brightnessScale must not hide saturation in the probe.
 close(r.diagnostic.emissionsById.S1.brightnessScale,1,1e-12);
 assert.equal(r.event,'simulationComplete');
 assert.equal(r.diagnostic.errors.length,0);
 assert.equal(r.diagnostic.blockersById.A1.invalidObservations,0);
 console.log('NATIVE_ANGLE_FAN_EMISSION '+JSON.stringify({
   mode:'research-only',nativeType:r.emitter.type,anglesDeg:r.emittedAngles,
   nativeStatus:r.status,rayDensity:.2,emitted:r.diagnostic.emissionsById.S1.emitted
 }));
});

test('native aperture forward absorption agrees with independent source-to-stop geometry across three gaps',()=>{
 const reports=[];
 for(const [openingLength,blockedForward] of [[8,7],[20,3],[40,0]]){
   const r=probe({openingLength});
   const aperture=byId(r.doc.physics,'A1').parameters;
   const source=byId(r.doc.physics,'S1').parameters;
   assert.equal(r.starts,1);assert.equal(r.emittedAngles.length,10);
   assert.equal(r.event,'simulationComplete','Real pinned solver must finish');
   assert.deepEqual(r.diagnostic.errors,[]);
   assert.equal(r.diagnostic.blockersById.A1.invalidObservations,0);
   assert.equal(r.diagnostic.emissionsById.S1.emitted,10);
   // This scalar reference applies ONLY to the free-space initial 50 mm from
   // source to stop; no refracted/reflected path is analytically prescribed.
   const expected=r.emittedAngles.filter(a=>{
     const y=source.y+(aperture.x-source.x)*Math.tan(a*Math.PI/180);
     assert.ok(Math.abs(y-aperture.y)<aperture.length/2-.01);
     assert.ok(Math.abs(Math.abs(y-aperture.y)-aperture.openingLength/2)>.01,
       'Cannot classify a near-corner sample');
     return Math.abs(y-aperture.y)>aperture.openingLength/2;
   }).length;
   assert.equal(expected,blockedForward);
   const forward=r.stopEvents.filter(e=>e.incoming.x>0);
   const backward=r.stopEvents.filter(e=>e.incoming.x<0);
   assert.equal(forward.length,blockedForward,'Observed native forward absorber count');
   for(const e of r.stopEvents){
     assert.equal(e.absorbed,true,'Every actual native aperture hit is terminal');
     close(e.point.x,aperture.x,1e-6);
     assert.ok(Math.abs(e.point.y-aperture.y)<=aperture.length/2+1e-6);
   }
   assert.equal(r.diagnostic.blockersById.A1.absorptions,r.stopEvents.length);
   if(r.status==='incomplete')assert.ok(r.diagnostic.truncation>0||r.diagnostic.undefinedBehavior>0);
   else assert.ok(['completed','completed-with-warnings'].includes(r.status),r.status);
   reports.push({openingLength,emitted:10,expectedInitialAbsorptions:blockedForward,
     observedForwardAbsorptions:forward.length,observedLeftGoingAbsorptions:backward.length,
     totalNativeAbsorptions:r.diagnostic.blockersById.A1.absorptions,
     lensInteractions:Object.fromEntries(['L1','L2'].map(id=>[id,r.diagnostic.interfacesById[id].interactions])),
     mirrorReflections:r.diagnostic.reflectionsById.M1,
     detectorCrossings:r.diagnostic.detectorsById.D1.crossings,
     status:r.status,truncation:r.diagnostic.truncation,
     undefinedBehavior:r.diagnostic.undefinedBehavior});
 }
 assert.deepEqual(reports.map(x=>x.observedForwardAbsorptions),[7,3,0]);
 console.log('NATIVE_ANGLE_FAN_APERTURE_SWEEP '+JSON.stringify(reports));
});

test('removing the mirror return changes real native topology without prescribing a path',()=>{
 const withMirror=probe({openingLength:20}),moved=probe({openingLength:20,mirrorShift:500});
 assert.equal(withMirror.event,'simulationComplete');
 assert.equal(moved.event,'simulationComplete');
 assert.equal(moved.diagnostic.emissionsById.S1.emitted,withMirror.diagnostic.emissionsById.S1.emitted);
 assert.equal(moved.stopEvents.filter(e=>e.incoming.x>0).length,3,
   'Same initial fan and gap must have the same forward absorption');
 assert.equal(moved.diagnostic.reflectionsById.M1,0);
 assert.ok(moved.diagnostic.interfacesById.L1.interactions>0);
 assert.equal(moved.diagnostic.blockersById.A1.invalidObservations,0);
 console.log('NATIVE_ANGLE_FAN_MIRROR_MISS '+JSON.stringify({
   status:moved.status,emitted:moved.diagnostic.emitted,
   mirrorReflections:moved.diagnostic.reflectionsById.M1,
   forwardAbsorptions:moved.stopEvents.filter(e=>e.incoming.x>0).length,
   returnedAbsorptions:moved.stopEvents.filter(e=>e.incoming.x<0).length
 }));
});

test('native sampled ray counts change with density, without any continuous throughput claim',()=>{
 const dense=probe({openingLength:20,density:.4});
 assert.equal(dense.starts,1);
 assert.equal(dense.emittedAngles.length,20);
 assert.equal(dense.diagnostic.emissionsById.S1.emitted,20);
 assert.equal(dense.event,'simulationComplete');
 assert.equal(dense.diagnostic.blockersById.A1.invalidObservations,0);
 assert.equal(dense.diagnostic.blockersById.A1.absorptions,dense.stopEvents.length);
 const angles=Array.from({length:20},(_,i)=>18-1.8*i);
 dense.emittedAngles.forEach((a,i)=>close(a,angles[i]));
 console.log('NATIVE_ANGLE_FAN_DENSITY '+JSON.stringify({
   status:dense.status,density:.4,emitted:20,
   forwardAbsorptions:dense.stopEvents.filter(e=>e.incoming.x>0).length,
   returnedAbsorptions:dense.stopEvents.filter(e=>e.incoming.x<0).length,
   truncation:dense.diagnostic.truncation,undefinedBehavior:dense.diagnostic.undefinedBehavior
 }));
});
