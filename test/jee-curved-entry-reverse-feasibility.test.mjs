// Feasibility probe for public curved-entry authoring, using exactly the
// already-reviewed native v21 Glass geometry from the public compiler.
// This is research evidence only until a separate, explicitly versioned
// authoring/qualification contract has passed final review.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {compileSemicircular,semicircularEncounter}
 from '../src/semicircular-dielectric.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const R=100;
const near=(actual,expected,tol=1e-7)=>assert.ok(
 Number.isFinite(actual)&&Math.abs(actual-expected)<=tol,
 String(actual)+' != '+String(expected)+' tolerance '+tol);
const vec=ray=>{const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y;
 const l=Math.hypot(dx,dy);return {x:dx/l,y:dy/l};};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;

function fixture({height=4,insideIndex=4/3,outsideIndex=1,
 blockerX=40,blocker=true,angleDeg=180,rayDepth=8}={}){
 const glass={id:'G1',type:'semicircular-dielectric',parameters:{
  x:0,y:0,radius:R,insideIndex,outsideIndex,partialReflection:false}};
 const radians=angleDeg*Math.PI/180;
 const ray={type:'SingleRay',p1:{x:200,y:-height},
  p2:{x:200+20*Math.cos(radians),y:-height-20*Math.sin(radians)},brightness:.08};
 const segments=[80,60].map(x=>({type:'Detector',p1:{x,y:-50},
  p2:{x,y:50},irradMap:false}));
 const objs=[ray,compileSemicircular(glass),...segments,
  ...(blocker?[{type:'Blocker',p1:{x:blockerX,y:-50},p2:{x:blockerX,y:50},
   filter:false}]:[])];
 return {glass,native:{version:5,name:'RESEARCH: reverse v21 curved entrance, actual internal screen',
  width:1200,height:700,scale:1,origin:{x:500,y:350},
  mode:'rays',rayModeDensity:.2,maxRayDepth:rayDepth,lengthScale:1,
  simulateColors:false,colorMode:'default',objs}};
}
function run(cfg={},limit=10000){
 const f=fixture(cfg),scene=core.loadNative(f.native),events=[],starts=[];
 const s=scene.objs[0],start=s.onSimulationStart;
 s.onSimulationStart=function(...args){const result=start.apply(this,args);
  starts.push(result?.newRays?.length??0);return result;};
 for(let i=1;i<scene.objs.length;i++){
  const obj=scene.objs[i],original=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const before=vec(args[0]),point={x:args[2].x,y:-args[2].y};
   const returned=original.apply(this,args);
   events.push({index:i,type:obj.constructor.type,point,before,
    after:returned?.isAbsorbed?null:vec(args[0]),
    absorbed:returned?.isAbsorbed===true,
    children:(returned?.newRays??[]).length});
   return returned;
  };
 }
 const sim=new core.Simulator(scene,null,null,null,null,null,false,limit);
 let terminal=null;
 for(const type of ['simulationComplete','simulationStop'])
  sim.on(type,()=>{terminal=type;});
 sim.updateSimulation();
 const d=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
 const status=core.classifyRun(terminal,d);
 const usable=terminal==='simulationComplete'&&status==='completed'&&
  starts.length===1&&starts[0]===1&&events.length===4&&
  events.map(e=>e.type).join(',')==='Glass,Detector,Detector,Blocker'&&
  events.every(e=>e.children===0)&&events.at(-1).absorbed;
 return {f,events,starts,terminal,status,d,usable};
}
test('reverse-illuminated native v21 Glass retains its flat face but transmits at curved entrance and is absorbed internally',()=>{
 const series=[];
 for(const height of [8,4,2,1,0.5,0.25]){
  const r=run({height});
  assert.equal(r.status,'completed');
  assert.equal(r.usable,true,'Native sequence '+JSON.stringify(r.events));
  const e=r.events[0],encounter=semicircularEncounter(r.f.glass,
   {x:e.point.x,y:-e.point.y},e.before);
  assert.equal(encounter.invalid,false);
  assert.equal(encounter.faceId,'face-arc');
  assert.equal(encounter.from,'outside');
  near(encounter.incidentIndex,1);
  near(encounter.destinationIndex,4/3);
  assert.ok(dot(e.before,encounter.normal)<0);
  assert.ok(dot(e.after,encounter.normal)<0);
  near(cross(e.before,encounter.normal),
   (4/3)*cross(e.after,encounter.normal),1e-11);
  const a=r.events[1].point,b=r.events[2].point;
  const slope=(b.y-a.y)/(b.x-a.x);
  assert.ok(Number.isFinite(slope)&&Math.abs(slope)>1e-12);
  const x0=a.x-a.y/slope;
  const expected=-300,err=Math.abs(x0-expected);
  series.push({height,x0,err,events:r.events.map(x=>x.type)});
 }
 for(let i=1;i<series.length;i++)
  assert.ok(series[i].err<series[i-1].err*.35,
   'Finite-angle curved surface should tend quadratically to Gaussian limit');
 assert.ok(series.at(-1).err<.002);
 assert.ok(series[0].err>.1,'Finite-height ray need not equal paraxial focal distance');
 console.log('CURVED_ENTRY_REVERSE_RESEARCH '+JSON.stringify({
  native:'pinned-PhyDemo',canonicalPublicVersion:'not-yet-admitted',
  flatBoundaryRetained:true,nativeImageDetected:false,series}));
});
test('second boundary, missing screen and stopped rays do not qualify as one-crossing witnesses',()=>{
 for(const args of [{blocker:false},{blockerX:-30},{rayDepth:0}]){
  const r=run(args);
  assert.equal(r.usable,false);
  if(args.blocker===false||args.blockerX<0)
   assert.ok(r.events.filter(e=>e.type==='Glass').length>=2,
    'Fully retained flat boundary must remain a native encounter if not absorbed first');
  if(args.rayDepth===0)assert.notEqual(r.status,'completed');
 }
 const p=run({},1);
 assert.equal(p.usable,false);
});
test('on-axis two-hit ray does not identify a mathematical focus',()=>{
 const r=run({height:0});
 assert.equal(r.usable,true);
 // sin(pi) is not exact zero in binary64; the two observed heights are
 // indistinguishable at this scale. Do not form 1/(near-zero slope) or claim a focus.
 near(r.events[1].point.y-r.events[2].point.y,0,1e-10);
 assert.equal(r.events[0].type,'Glass');
});
