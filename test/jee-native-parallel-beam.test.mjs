// RESEARCH ONLY: existing pinned PhyDemo Beam; NOT canonical authoring admission.
// Compile already valid optics, replace only the test-native source object.
// Do not pass this substituted scene to public qualification using the old hash.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const PIN='811f508d2b070898c241a568b0c167dcb8645251';
const RAD=Math.PI/180;
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const source=(x=-100,y=0,directionDeg=0,mode='directional')=>({id:'S1',type:'point-source',
  parameters:{x,y,brightness:.08},emission:{mode,directionDeg,...(mode==='directional'?{angleDeg:10}:{})}});
const detector=(x=100,y=0,length=1000)=>({id:'D1',type:'ray-detector',parameters:{x,y,orientationDeg:90,length}});
const lens=f=>({id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:f,apertureHeight:100}});
const boundary=(id,x,negativeIndex,positiveIndex,partialReflection=false)=>({id,type:'planar-interface',
  parameters:{x,y:0,normalDeg:0,negativeIndex,positiveIndex,partialReflection}});
const request=components=>({lengthUnit:'mm',title:'Research: native parallel illumination',runPolicy:'preview-v1',components});
const vector=ray=>{const x=ray.p2.x-ray.p1.x,y=ray.p1.y-ray.p2.y,n=Math.hypot(x,y);return {x:x/n,y:y/n};};

function nativeBeam({x,y,width,directionDeg,brightness}){
  // In project y-UP coordinates tangent=(sin(theta),-cos(theta)); its
  // left normal is the requested propagation direction. Native y is DOWN.
  const a=directionDeg*RAD,tx=Math.sin(a),ty=-Math.cos(a);
  const p1={x:x-width*tx/2,y:y-width*ty/2},p2={x:x+width*tx/2,y:y+width*ty/2};
  return {type:'Beam',p1:{x:p1.x,y:-p1.y},p2:{x:p2.x,y:-p2.y},brightness,
    emisAngle:0,random:false,lambert:false};
}
function probe(physical,{width=40,density=.2,processedRayLimit=10000}={}){
  const bytes=JSON.stringify(physical),doc=prepareScene(physical).document;
  assert.equal(doc.upstreamCommit,PIN);
  assert.equal(doc.simulation.maxRayDepth,8,'Do not expand a native depth limit for this study');
  const compiled=core.compile(doc),native=structuredClone(compiled.native);
  const s=doc.physics.components.find(c=>c.id==='S1'),index=compiled.idMap.get('S1');
  native.objs[index]=nativeBeam({...s.parameters,width,directionDeg:s.emission.directionDeg});
  native.rayModeDensity=density;
  for(let i=0;i<native.objs.length;i++)if(i!==index)assert.deepEqual(native.objs[i],compiled.native.objs[i]);
  const scene=core.loadNative(native),emissions=[],trace=[];
  const emitter=scene.objs[index],start=emitter.onSimulationStart;
  let starts=0;
  emitter.onSimulationStart=function(...args){
    const out=start.apply(this,args);starts++;
    assert.ok(out.newRays.length<=64,'Bounded research source evidence, never clipped');
    for(const ray of out.newRays)emissions.push({pointMm:{x:ray.p1.x,y:-ray.p1.y},direction:vector(ray),
      relativePower:ray.brightness_s+ray.brightness_p});
    return out;
  };
  const sources=core.observeSourceSet(doc,scene,compiled.idMap);
  const mirrors=core.observeMirrorSet(doc,scene,compiled.idMap);
  const detectors=core.observeDetectorSet(doc,scene,compiled.idMap,{captureHitEvents:true});
  const interfaces=core.observeInterfaceSet(doc,scene,compiled.idMap);
  const blockers=core.observeBlockerSet(doc,scene,compiled.idMap);
  for(const c of doc.physics.components.filter(c=>c.id!=='S1')){
    const obj=scene.objs[compiled.idMap.get(c.id)],incident=obj.onRayIncident;
    obj.onRayIncident=function(...args){
      const pointMm={x:args[2].x,y:-args[2].y},incoming=vector(args[0]);
      const out=incident.apply(this,args);
      assert.ok(trace.length<4096,'Bounded research incident evidence, never clipped');
      trace.push({id:c.id,pointMm,incoming,absorbed:out?.isAbsorbed===true,
        outgoing:[...(!out?.isAbsorbed?[args[0]]:[]),...(out?.newRays||[])].map(vector)});
      return out;
    };
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,processedRayLimit);
  let event=null;
  for(const type of ['simulationComplete','simulationStop'])sim.on(type,()=>{event=type;});
  sim.updateSimulation();
  assert.ok(event,'A missing terminal callback is not a completed simulation');
  const diagnostics=core.diagnostics(scene,sim,sources,mirrors,detectors,interfaces,blockers,
    {detectorHitEvents:true,nativeEvent:event});
  const status=core.classifyRun(event,diagnostics);
  assert.equal(starts,1);assert.equal(JSON.stringify(physical),bytes);
  assert.equal(diagnostics.emissionsById.S1.emitted,emissions.length);
  return {status,event,diagnostics,emissions,trace,native,doc};
}
function complete(r){
  assert.equal(r.event,'simulationComplete');assert.equal(r.status,'completed');
  assert.deepEqual(r.diagnostics.errors,[]);assert.equal(r.diagnostics.truncation,0);
  assert.equal(r.diagnostics.undefinedBehavior,0);
  near(r.diagnostics.emissionsById.S1.brightnessScale,1);
  assert.equal(r.diagnostics.detectorHitEventsById.D1.status,'complete');
}
const hits=r=>r.diagnostics.detectorHitEventsById.D1.events;
const sorted=n=>[...n].sort((a,b)=>a-b);
function log(name,r,extra={}){
  console.log('JEE_NATIVE_PARALLEL_BEAM '+JSON.stringify({name,researchOnly:true,
    canonicalAuthoringAvailable:false,nativeSource:'Beam',status:r.status,
    emitted:r.emissions.length,crossings:r.diagnostics.detectorsById.D1.crossings,
    truncation:r.diagnostics.truncation,undefinedBehavior:r.diagnostics.undefinedBehavior,...extra}));
}

test('parallel beam stays a research-native source, not an implicitly admitted point-source mode',()=>{
  const physical=request([source(),detector()]);
  const d=prepareScene(physical).document;
  const forged=structuredClone(d);forged.physics.components[0].type='parallel-beam';
  assert.throws(()=>core.compile(forged));
  const unsupported=structuredClone(physical);unsupported.components[0].type='parallel-beam';
  assert.throws(()=>prepareScene(unsupported));
  const r=probe(physical);complete(r);
  assert.equal(r.emissions.length,8);
  for(let i=0;i<8;i++){
    near(r.emissions[i].pointMm.x,-100);near(r.emissions[i].pointMm.y,17.5-5*i);
    near(r.emissions[i].direction.x,1);near(r.emissions[i].direction.y,0);
  }
  log('free-space-eight-parallel-rays',r);
});

test('native parallel rays focus at an ideal converging lens focal plane from either side',()=>{
  for(const sign of [1,-1]){
    const r=probe(request([source(-100*sign,0,sign===1?0:180),lens(100),detector(100*sign)]));
    complete(r);assert.equal(hits(r).length,8);
    assert.equal(r.trace.filter(e=>e.id==='L1').length,8);
    for(const h of hits(r)){near(h.pointMm.x,100*sign);near(h.pointMm.y,0);}
    log(sign===1?'converging-lens-forward':'converging-lens-reverse',r,{focalPlaneXmm:100*sign,
      maxAbsSampleYmm:Math.max(...hits(r).map(h=>Math.abs(h.pointMm.y)))});
  }
});

test('native divergent-lens rays are checked downstream without claiming a detected virtual image',()=>{
  const r=probe(request([source(),lens(-100),detector(100)]));complete(r);
  const observed=sorted(hits(r).map(e=>e.pointMm.y));
  const expected=sorted(r.emissions.map(e=>2*e.pointMm.y));
  assert.equal(observed.length,8);observed.forEach((y,i)=>near(y,expected[i]));
  log('diverging-lens-downstream',r,{detectorXmm:100,maxAbsSampleYmm:Math.max(...observed.map(Math.abs)),
    virtualImageDetected:false});
});

test('finite native aperture clips a parallel beam before the ideal lens',()=>{
  const aperture={id:'A1',type:'finite-aperture',parameters:{x:-50,y:0,orientationDeg:90,length:100,openingLength:12}};
  const r=probe(request([source(),aperture,lens(100),detector(100)]));complete(r);
  assert.equal(r.diagnostics.blockersById.A1.absorptions,6);
  assert.equal(r.diagnostics.blockersById.A1.invalidObservations,0);
  assert.equal(r.trace.filter(e=>e.id==='L1').length,2);
  assert.equal(hits(r).length,2);hits(r).forEach(h=>near(h.pointMm.y,0));
  log('aperture-clipping-before-lens',r,{sampledAbsorptions:6,survivingSamples:2});
});

test('native oblique parallel slab beam matches Snell angles and lateral displacement for each sample',()=>{
  for(const index of [1.5,1.8]){
    const r=probe(request([source(-100,0,30,'single-ray'),boundary('I1',0,1,index),
      boundary('I2',60,index,1),detector(120)]));complete(r);
    assert.equal(hits(r).length,8);
    const refracted=Math.asin(Math.sin(30*RAD)/index),m=Math.tan(30*RAD);
    const expected=sorted(r.emissions.map(e=>e.pointMm.y-e.pointMm.x*m+60*Math.tan(refracted)+60*m));
    const actual=sorted(hits(r).map(h=>h.pointMm.y));
    actual.forEach((y,i)=>near(y,expected[i]));
    for(const h of hits(r)){
      near(h.incomingUnit.x,Math.cos(30*RAD));near(h.incomingUnit.y,Math.sin(30*RAD));
    }
    for(const e of r.trace.filter(e=>e.id==='I1')){
      assert.equal(e.outgoing.length,1);
      near(Math.atan2(e.outgoing[0].y,e.outgoing[0].x),refracted);
    }
    assert.equal(r.diagnostics.interfacesById.I1.interactions,8);
    assert.equal(r.diagnostics.interfacesById.I2.interactions,8);
    const displacement=60*Math.sin(30*RAD-refracted)/Math.cos(refracted);
    log('parallel-slab-index-'+index,r,{incidenceDeg:30,refractionDeg:refracted/RAD,
      expectedPerpendicularDisplacementMm:displacement,transmittedOnlyApproximation:true});
  }
});

test('native parallel beam undergoes total internal reflection at a high-to-low planar boundary',()=>{
  const r=probe(request([source(-100,0,60,'single-ray'),boundary('I1',0,1.5,1),detector(-150,400,400)]));
  complete(r);assert.equal(hits(r).length,8);
  assert.equal(r.diagnostics.interfacesById.I1.totalInternalReflections,8);
  for(const h of hits(r)){near(h.incomingUnit.x,-.5);near(h.incomingUnit.y,Math.sqrt(3)/2);}
  const m=Math.tan(60*RAD),expected=sorted(r.emissions.map(e=>e.pointMm.y-e.pointMm.x*m+150*m));
  sorted(hits(r).map(h=>h.pointMm.y)).forEach((y,i)=>near(y,expected[i]));
  log('parallel-beam-total-internal-reflection',r,{incidenceDeg:60,totalInternalReflections:8,
    criticalAngleDeg:Math.asin(1/1.5)/RAD});
});

test('sampling density changes native sample count but neither parallelism nor the ideal focal plane',()=>{
  const physical=request([source(),lens(100),detector(100)]);
  const sparse=probe(physical),dense=probe(physical,{density:.4}),again=probe(physical,{density:.4});
  for(const r of [sparse,dense,again])complete(r);
  assert.equal(sparse.emissions.length,8);assert.equal(dense.emissions.length,16);
  for(const h of hits(dense))near(h.pointMm.y,0);
  assert.deepEqual(dense.emissions,again.emissions);assert.deepEqual(dense.trace,again.trace);
  log('density-and-repeatability',dense,{lowDensityCount:8,repeatable:true,continuousPowerClaim:false});
});

test('native full-Fresnel or stopped beam propagation cannot expose a complete detector hit list',()=>{
  const physical=request([source(-100,0,30,'single-ray'),boundary('I1',0,1,1.5,true),
    boundary('I2',60,1.5,1,true),detector(120)]);
  const fresnel=probe(physical);
  assert.equal(fresnel.status,'incomplete');assert.ok(fresnel.diagnostics.truncation>0);
  assert.equal(fresnel.diagnostics.detectorHitEventsById,null);
  log('full-fresnel-incomplete',fresnel,{positionsWithheld:true});
  const stopped=probe(request([source(),lens(100),detector(100)]),{processedRayLimit:1});
  assert.ok(['stopped','incomplete'].includes(stopped.status));
  assert.equal(stopped.diagnostics.detectorHitEventsById,null);
  log('processed-limit-stop',stopped,{positionsWithheld:true});
});
