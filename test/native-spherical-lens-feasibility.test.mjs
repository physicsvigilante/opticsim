// RESEARCH-ONLY feasibility of upstream SphericalLens at the exact pinned
// PhyDemo SHA. This does NOT admit a new Opticsim component, scene contract,
// analytical image, ray route, geometry tolerance or production compiler.
// We deliberately replace a valid scene's one native Glass with an existing
// upstream SphericalLens only AFTER canonical compilation and validation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {COMPONENT_TYPES} from '../src/contract.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const base=JSON.parse(readFileSync(new URL('../scenes/polygon-dielectric.json',import.meta.url),'utf8'));
const close=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
const direction=r=>{
 const dx=r.p2.x-r.p1.x,dy=r.p1.y-r.p2.y,n=Math.hypot(dx,dy);
 assert.ok(n>0&&Number.isFinite(n));
 return {x:dx/n,y:dy/n};
};
const cross=(a,b)=>a.x*b.y-a.y*b.x;

// Native upstream DR1R2 definition: 100 mm aperture, 30 mm central thickness,
// symmetric 100 mm radius biconvex surfaces, relative index 1.5 in n=1 air.
// This is deliberately a synthesized test optic, not an interpreted textbook
// apparatus. The upstream SphericalLens itself constructs both curved arcs.
const lens=()=>({
 type:'SphericalLens',
 p1:{x:0,y:-50},p2:{x:0,y:50},defBy:'DR1R2',
 params:{d:30,r1:100,r2:-100},
 refIndex:1.5,partialReflect:false
});
function trial(y=10,{radius1=100,radius2=-100}={}){
 const native=core.compile(base).native;
 native.objs[0]={type:'SingleRay',p1:{x:-200,y:-y},p2:{x:-180,y:-y},brightness:0.5};
 native.objs[1]={...lens(),params:{d:30,r1:radius1,r2:radius2}};
 native.objs[2]={type:'Detector',p1:{x:200,y:-150},p2:{x:200,y:150},irradMap:false};
 const scene=core.loadNative(native),optic=scene.objs[1],events=[];
 const original=optic.onRayIncident;
 optic.onRayIncident=function(...args){
  const incoming=direction(args[0]),point={x:args[2].x,y:-args[2].y};
  const result=original.apply(this,args);
  const outputs=[...(!result?.isAbsorbed?[args[0]]:[]),...(result?.newRays||[])];
  assert.ok(events.length<20,'Bounded actual native interactions');
  events.push({point,incoming,outgoing:outputs.map(direction),
   absorbed:!!result?.isAbsorbed,nativeTruncation:result?.truncation??0});
  return result;
 };
 const idMap=new Map([['S1',0],['G1',1],['D1',2]]);
 const sources=core.observeSourceSet(base,scene,idMap);
 const detectors=core.observeDetectorSet(base,scene,idMap);
 const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
 let event=null;
 for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{event=name;});
 sim.updateSimulation();
 const diagnostics=core.diagnostics(scene,sim,sources,null,detectors,null);
 return {optic,events,status:core.classifyRun(event,diagnostics),diagnostics};
}
test('SphericalLens feasibility is native-only: canonical scene contracts remain unchanged',()=>{
 assert.equal(COMPONENT_TYPES.includes('spherical-lens'),false);
 assert.equal(core.compile(base).native.objs[1].type,'Glass');
});
test('Pinned native SphericalLens constructs two finite spherical faces and refracts an oblique-height ray',()=>{
 const r=trial(10);
 assert.equal(r.optic.constructor.type,'SphericalLens');
 assert.ok(Array.isArray(r.optic.path),'Native lens parameters must create a real finite path');
 assert.equal(r.optic.path.length,6);
 assert.equal(r.optic.path.filter(p=>p.arc).length,2);
 assert.equal(r.status,'completed');
 assert.equal(r.events.length,2,'One actual entry and a distinct actual exit');
 assert.equal(r.diagnostics.detectorsById.D1.crossings,1);
 const [entry,exit]=r.events;
 assert.equal(entry.outgoing.length,1);
 assert.equal(exit.outgoing.length,1);
 assert.ok(entry.point.x<0&&exit.point.x>0);
 // Independent circle geometry, using the authored R1/R2/d definition.
 // Left spherical center (85,0), right spherical center (-85,0).
 close(entry.point.x,85-Math.sqrt(100*100-10*10),1e-6);
 close(Math.hypot(entry.point.x-85,entry.point.y),100,1e-5);
 close(Math.hypot(exit.point.x+85,exit.point.y),100,1e-5);
 const towardGlass={x:(85-entry.point.x)/100,y:-entry.point.y/100};
 const towardAir={x:(exit.point.x+85)/100,y:exit.point.y/100};
 close(Math.abs(cross(entry.incoming,towardGlass)),
  1.5*Math.abs(cross(entry.outgoing[0],towardGlass)),1e-7);
 close(1.5*Math.abs(cross(exit.incoming,towardAir)),
  Math.abs(cross(exit.outgoing[0],towardAir)),1e-7);
 assert.ok(entry.outgoing[0].y<0&&exit.outgoing[0].y<0,
  'Refracted positive-height ray heads toward the optical axis');
 console.log('SPHERICAL_LENS_NATIVE_PROBE '+JSON.stringify({
  pin:base.upstreamCommit,status:r.status,hitCount:r.events.length,
  crossings:r.diagnostics.detectorsById.D1.crossings,
  entry,exit
 }));
});
test('SphericalLens native ray height matters; a physically missed lens has no invented encounter',()=>{
 const low=trial(5),high=trial(20),miss=trial(80);
 for(const r of [low,high,miss])assert.equal(r.status,'completed');
 assert.equal(low.events.length,2);
 assert.equal(high.events.length,2);
 assert.equal(miss.events.length,0);
 assert.ok(high.events[1].outgoing[0].y<low.events[1].outgoing[0].y,
  'Higher entrance height has stronger downward refracted direction');
 assert.equal(miss.diagnostics.detectorsById.D1.crossings,1,
  'A ray missing the lens still crosses the finite native detector');
});
