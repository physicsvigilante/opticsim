// Research-only native multi-element optical train feasibility.
// This file does not admit a v17 scene type or alter the pinned physics engine.
// First prepare a valid v15 TWO-SphericalLens authoring document, then append
// the preexisting upstream Mirror to a test-only copy of its compiled native
// objects. Native Simulator chooses all intersections and re-encounters.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(
 new URL('../examples/native-thick-lens-train.json',import.meta.url),'utf8'));
const physical=()=>structuredClone(frozen.physical);
const close=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,
 `actual ${a} versus independently calculated ${b}`);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
function unit(ray){
 const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,n=Math.hypot(dx,dy);
 assert.ok(n>0&&Number.isFinite(n));
 return {x:dx/n,y:dy/n};
}
function makeScene({height=0,mirrorY=0,mirrorX=300,swapLenses=false,ambient=1,testOnlyRayDepth=null}={}){
 const r=physical();
 r.components.find(c=>c.id==='S1').parameters.y=height;
 const detector=r.components.find(c=>c.id==='D1').parameters;
 Object.assign(detector,{x:-100,y:0,orientationDeg:90,length:400});
 for(const id of ['L1','L2'])r.components.find(c=>c.id===id).parameters.outsideIndex=ambient;
 const doc=prepareScene(r).document;
 assert.equal(doc.schemaVersion,15,'Two thick lenses are already valid v15 authoring');
 assert.equal(doc.physics.model,'native-thick-lens-tracing');
 const native=core.compile(doc).native;
 if(testOnlyRayDepth!==null){
  assert.ok(Number.isInteger(testOnlyRayDepth)&&testOnlyRayDepth>doc.simulation.maxRayDepth);
  // RESEARCH ONLY: override a native JSON setting AFTER canonical v15
  // validation. v15/v16 public scenes remain capped at depth 8.
  native.maxRayDepth=testOnlyRayDepth;
 }
 assert.deepEqual(native.objs.map(x=>x.type),
  ['SingleRay','SphericalLens','SphericalLens','Detector']);
 // This is not canonical/public authoring; native full physical object list is
 // modified ONLY inside the test's independent feasibility experiment.
 const ids=['S1','L1','L2','D1'];
 if(swapLenses){
  [native.objs[1],native.objs[2]]=[native.objs[2],native.objs[1]];
  [ids[1],ids[2]]=[ids[2],ids[1]];
 }
 native.objs.push({type:'Mirror',p1:{x:mirrorX,y:-mirrorY-200},
  p2:{x:mirrorX,y:-mirrorY+200},filter:false});
 ids.push('M1');
 const scene=core.loadNative(native),idMap=new Map(ids.map((id,i)=>[id,i]));
 const sourceMeter=core.observeSourceSet(doc,scene,idMap);
 const detectorMeter=core.observeDetectorSet(doc,scene,idMap);
 const interfaceMeter=core.observeInterfaceSet(doc,scene,idMap);
 const trace=[];
 for(const [i,id] of ids.entries()){
  if(id==='S1')continue;
  const obj=scene.objs[i],original=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const incident=unit(args[0]),point={x:args[2].x,y:-args[2].y};
   const result=original.apply(this,args);
   const outputs=[...(!result?.isAbsorbed?[args[0]]:[]),...(result?.newRays||[])];
   assert.ok(trace.length<80,'Test captures a bounded number of real native events');
   trace.push({id,point,incident,outgoing:outputs.map(unit),
    absorbed:!!result?.isAbsorbed,truncation:result?.truncation??0});
   return result;
  };
 }
 const sim=new core.Simulator(scene,null,null,null,null,null,false,
   doc.simulation.processedRayLimit);
 let event=null;
 for(const kind of ['simulationComplete','simulationStop'])
  sim.on(kind,()=>{event=kind;});
 sim.updateSimulation();
 const diagnostics=core.diagnostics(scene,sim,sourceMeter,null,detectorMeter,interfaceMeter);
 return {doc,ids,trace,diagnostics,event,status:core.classifyRun(event,diagnostics)};
}
function checkLensEvent(e,p){
 const front=e.point.x<p.x,left=p.x-p.centerThickness/2,right=p.x+p.centerThickness/2;
 const R=front?p.frontRadius:p.backRadius,cx=front?left+R:right-R;
 const outward={x:(e.point.x-cx)/R,y:(e.point.y-p.y)/R};
 close(Math.hypot(e.point.x-cx,e.point.y-p.y),R,1e-5);
 assert.ok(Math.abs(e.point.y-p.y)<p.apertureHeight/2-.01);
 const leaving=dot(e.incident,outward)>0;
 const ni=leaving?p.insideIndex:p.outsideIndex;
 const nt=leaving?p.outsideIndex:p.insideIndex;
 assert.equal(e.outgoing.length,1,'Fresnel-off path has one true outgoing ray');
 const out=e.outgoing[0];
 // Only direct native refraction paths are tested here, not F/TIR switching.
 assert.ok(dot(e.incident,outward)*dot(out,outward)>0);
 close(ni*cross(e.incident,outward),nt*cross(out,outward),1e-7);
 return {id:e.id,face:front?'front-arc':'back-arc',from:leaving?'inside':'outside',
  point:e.point,ni,nt,direction:out};
}
function checkMirror(e){
 assert.equal(e.id,'M1');assert.equal(e.outgoing.length,1);
 close(e.outgoing[0].x,-e.incident.x,1e-8);
 close(e.outgoing[0].y,e.incident.y,1e-8);
}

test('Two thick lenses with a finite mirror: actual native axial return crosses both glass bodies twice',()=>{
 const r=makeScene({testOnlyRayDepth:16}),actual=r.trace.map(e=>e.id);
 console.log('NATIVE_TWO_LENSES_DEEP_AXIAL_DIAGNOSTIC '+JSON.stringify({status:r.status,trace:actual,truncation:r.diagnostics.truncation,undefinedBehavior:r.diagnostics.undefinedBehavior,errors:r.diagnostics.errors}));
 assert.equal(r.status,'completed');
 assert.deepEqual(actual,['D1','L1','L1','L2','L2','M1','L2','L2','L1','L1','D1']);
 assert.equal(r.diagnostics.truncation,0);
 assert.equal(r.diagnostics.undefinedBehavior,0);
 assert.deepEqual(['L1','L2'].map(id=>r.diagnostics.interfacesById[id].interactions),[4,4]);
 assert.equal(r.diagnostics.detectorsById.D1.crossings,2);
 const specs=Object.fromEntries(r.doc.physics.components.filter(c=>c.type==='spherical-lens')
  .map(c=>[c.id,c.parameters]));
 const faces=r.trace.filter(e=>specs[e.id]).map(e=>checkLensEvent(e,specs[e.id]));
 assert.deepEqual(faces.map(x=>x.id),['L1','L1','L2','L2','L2','L2','L1','L1']);
 assert.deepEqual(faces.map(x=>x.from),[
  'outside','inside','outside','inside','outside','inside','outside','inside']);
 const mirror=r.trace.find(e=>e.id==='M1');close(mirror.point.x,300);checkMirror(mirror);
 assert.ok(r.trace.every(e=>e.truncation===0));
 console.log('NATIVE_TWO_THICK_LENS_MIRROR_AXIAL '+JSON.stringify({
  status:r.status,objectOrder:actual,faces,mirror:mirror.point,
  detectors:r.trace.filter(e=>e.id==='D1').map(e=>e.point),
  actualNativePin:r.doc.upstreamCommit}));
});
test('Off-axis two-thick-lens/mirror native composition is independent of object-list order',()=>{
 const a=makeScene({height:2,testOnlyRayDepth:16}),b=makeScene({height:2,swapLenses:true,testOnlyRayDepth:16});
 console.log('NATIVE_TWO_LENSES_DEEP_OFFAXIS_DIAGNOSTIC '+JSON.stringify({a:{status:a.status,trace:a.trace.map(x=>x.id),truncation:a.diagnostics.truncation,undefinedBehavior:a.diagnostics.undefinedBehavior,errors:a.diagnostics.errors},b:{status:b.status,trace:b.trace.map(x=>x.id),truncation:b.diagnostics.truncation,undefinedBehavior:b.diagnostics.undefinedBehavior,errors:b.diagnostics.errors}}));
 for(const r of [a,b]){
  assert.equal(r.status,'completed');
  assert.equal(r.diagnostics.truncation,0);
  assert.equal(r.diagnostics.undefinedBehavior,0);
  const specs=Object.fromEntries(r.doc.physics.components.filter(c=>c.type==='spherical-lens')
   .map(c=>[c.id,c.parameters]));
  r.trace.filter(e=>specs[e.id]).forEach(e=>checkLensEvent(e,specs[e.id]));
  const mirrors=r.trace.filter(e=>e.id==='M1');
  assert.equal(mirrors.length,1);
  checkMirror(mirrors[0]);
  assert.ok(mirrors[0].point.y>-200&&mirrors[0].point.y<200);
 }
 assert.deepEqual(a.trace.map(e=>e.id),b.trace.map(e=>e.id));
 for(let i=0;i<a.trace.length;i++){
  close(a.trace[i].point.x,b.trace[i].point.x,1e-7);
  close(a.trace[i].point.y,b.trace[i].point.y,1e-7);
 }
 console.log('NATIVE_TWO_THICK_LENS_MIRROR_OFFAXIS '+JSON.stringify({
  status:a.status,actualEvents:a.trace.map(e=>({id:e.id,point:e.point})),
  objectReorderingInvariant:true}));
});
test('The same two-lens native ray genuinely misses a finite mirror moved out of the beam',()=>{
 const r=makeScene({height:2,mirrorY:500});
 assert.equal(r.status,'completed');
 assert.equal(r.trace.filter(e=>e.id==='M1').length,0);
 assert.equal(r.diagnostics.truncation,0);
 assert.equal(r.diagnostics.undefinedBehavior,0);
 assert.equal(r.diagnostics.detectorsById.D1.crossings,1);
 const specs=Object.fromEntries(r.doc.physics.components.filter(c=>c.type==='spherical-lens')
  .map(c=>[c.id,c.parameters]));
 r.trace.filter(e=>specs[e.id]).forEach(e=>checkLensEvent(e,specs[e.id]));
 assert.deepEqual(r.trace.map(e=>e.id),['D1','L1','L1','L2','L2']);
 console.log('NATIVE_TWO_THICK_LENS_MIRROR_MISS '+JSON.stringify({
  status:r.status,actualEvents:r.trace.map(e=>e.id),
  mirrorHits:0,detectorCrossings:1}));
});

test('Default public native depth-8 policy retains genuine incomplete two-lens mirror-return evidence',()=>{
 const r=makeScene({height:0});
 assert.equal(r.doc.simulation.maxRayDepth,8);
 assert.equal(r.status,'incomplete',
   'The default budget must not incorrectly qualify this deeper return train');
 console.log('NATIVE_TWO_LENSES_DEFAULT_DEPTH_GATING '+JSON.stringify({
  authoredMaxRayDepth:r.doc.simulation.maxRayDepth,
  status:r.status,actualTrace:r.trace.map(e=>({id:e.id,point:e.point})),
  truncation:r.diagnostics.truncation,
  undefinedBehavior:r.diagnostics.undefinedBehavior,
  errors:r.diagnostics.errors,warnings:r.diagnostics.warnings
 }));
});

test('Explicit native-depth sweep distinguishes admissible default incompleteness from research-only full return',()=>{
 const depths=[8,9,10,11,12,16],cases=[];
 for(const depth of depths){
  const r=depth===8?makeScene():makeScene({testOnlyRayDepth:depth});
  const ids=r.trace.map(e=>e.id);
  cases.push({depth,status:r.status,ids,truncation:r.diagnostics.truncation,
   undefinedBehavior:r.diagnostics.undefinedBehavior,errors:r.diagnostics.errors});
 }
 assert.equal(cases[0].depth,8);
 assert.equal(cases[0].status,'incomplete');
 assert.ok(cases[0].truncation>0,'The default incomplete ray must not count missing power as zero');
 assert.equal(cases.at(-1).status,'completed');
 assert.equal(cases.at(-1).truncation,0);
 assert.equal(cases.at(-1).undefinedBehavior,0);
 const firstFull=cases.find(x=>x.status==='completed');
 assert.ok(firstFull?.depth>8,'No public scene depth is silently raised');
 for(const c of cases.filter(x=>x.depth<firstFull.depth))
  assert.equal(c.status,'incomplete','Insufficient native depth is not a qualified run');
 for(const c of cases.filter(x=>x.depth>=firstFull.depth))
  assert.equal(c.status,'completed','This tested native scene completes with sufficient explicit depth');
 assert.deepEqual(cases.at(-1).ids,
  ['D1','L1','L1','L2','L2','M1','L2','L2','L1','L1','D1']);
 console.log('NATIVE_TWO_LENSES_DEPTH_SWEEP '+JSON.stringify({
  publicV15MaximumDepth:8,firstCompletedNativeDepth:firstFull.depth,
  researchOnlyBeyondPublicContract:true,cases
 }));
});
