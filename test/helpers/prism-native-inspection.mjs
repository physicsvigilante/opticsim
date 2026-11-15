// Test-only explicitly declared finite apparatus. Never called by the analytical service.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareScene} from '../../src/authoring.js';
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
const R=Math.PI/180;
const direction=ray=>{const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,n=Math.hypot(dx,dy);return {x:dx/n,y:dy/n};};
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
export function prismNativeFixture({apexAngleDeg,incidenceAngleDeg,insideIndex,outsideIndex},
 {rotation=0,scale=1,tx=120,ty=-50,partialReflection=false,entryDepth=20}={}){
 const A=apexAngleDeg*R,i=incidenceAngleDeg*R,L=200,theta=rotation*R;
 const move=(x,y)=>({x:tx+scale*(x*Math.cos(theta)-y*Math.sin(theta)),y:ty+scale*(x*Math.sin(theta)+y*Math.cos(theta))});
 const vertices=[[0,0],[0,-L],[L*Math.sin(A),-L*Math.cos(A)]].map(([x,y])=>move(x,y));
 const parameters={insideIndex,outsideIndex,partialReflection};vertices.forEach((p,k)=>Object.assign(parameters,{['x'+(k+1)]:p.x,['y'+(k+1)]:p.y}));
 const s=move(-50*Math.cos(i),-entryDepth-50*Math.sin(i));
 const request={lengthUnit:'mm',title:'Explicit synthetic prism angular native cross-check',components:[
  {id:'S',type:'point-source',parameters:{...s,brightness:1},emission:{mode:'single-ray',directionDeg:((incidenceAngleDeg+rotation+180)%360+360)%360-180}},
  {id:'P',type:'triangular-prism',parameters}]};
 return prepareScene(request).document;
}
export function inspectPrismNative(doc){
 const {scene,idMap}=core.loadDocument(doc),events=[];
 const emissions=core.observeSourceSet(doc,scene,idMap),interfaces=core.observeInterfaceSet(doc,scene,idMap);
 const obj=scene.objs[idMap.get('P')],original=obj.onRayIncident;
 obj.onRayIncident=function(...args){
  const incoming=direction(args[0]),point={x:args[2].x,y:-args[2].y};
  const ret=original.apply(this,args); // Exactly one native delegation.
  const outgoing=[...(!ret?.isAbsorbed?[args[0]]:[]),...(ret?.newRays||[])].map(direction);
  events.push({point,incoming,outgoing});return ret;
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);let event;
 for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>{event=e;});sim.updateSimulation();
 const diagnostic=core.diagnostics(scene,sim,emissions,null,null,interfaces);
 return {events,diagnostic,status:core.classifyRun(event,diagnostic)};
}
export function verifyDirectPrismTrace(doc,trace,value){
 assert.equal(trace.status,'completed');assert.equal(trace.events.length,2);
 const p=doc.physics.components.find(c=>c.id==='P').parameters;
 const vertices=[1,2,3].map(k=>({x:p['x'+k],y:p['y'+k]}));
 const cross=(a,b)=>a.x*b.y-a.y*b.x,dot=(a,b)=>a.x*b.x+a.y*b.y;
 const winding=Math.sign(vertices.reduce((s,a,k)=>s+cross(a,vertices[(k+1)%3]),0));
 const normals=[];
 for(const event of trace.events){
  assert.equal(event.outgoing.length,1);
  const faces=vertices.map((a,k)=>{const b=vertices[(k+1)%3],edge={x:b.x-a.x,y:b.y-a.y},len=Math.hypot(edge.x,edge.y);
   const v={x:event.point.x-a.x,y:event.point.y-a.y};return {k,n:{x:winding*edge.y/len,y:-winding*edge.x/len},distance:Math.abs(cross(edge,v))/len,t:dot(edge,v)/(len*len)};
  }).filter(f=>f.distance<1e-6&&f.t>0&&f.t<1);
  assert.equal(faces.length,1);const face=faces[0],normal=face.n,leaving=dot(event.incoming,normal)>0;
  const ni=leaving?p.insideIndex:p.outsideIndex,nt=leaving?p.outsideIndex:p.insideIndex;
  near(ni*cross(event.incoming,normal),nt*cross(event.outgoing[0],normal),1e-10);
  normals.push(normal);
 }
 const angle=(u,n)=>Math.atan2(Math.abs(cross(u,n)),Math.abs(dot(u,n)))/R;
 near(angle(trace.events[0].incoming,normals[0]),value.incidenceAngleDeg,1e-7);
 near(angle(trace.events[0].outgoing[0],normals[0]),value.entryRefractionAngleDeg,1e-7);
 near(angle(trace.events[1].incoming,normals[1]),value.exitIncidenceAngleDeg,1e-7);
 near(angle(trace.events[1].outgoing[0],normals[1]),value.emergenceAngleDeg,1e-7);
 const a=trace.events[0],b=trace.events[1],step={x:b.point.x-a.point.x,y:b.point.y-a.point.y};
 near(cross(step,a.outgoing[0]),0,1e-6);assert.ok(dot(step,a.outgoing[0])>0);
 near(a.outgoing[0].x,b.incoming.x,1e-10);near(a.outgoing[0].y,b.incoming.y,1e-10);
 near(-Math.atan2(cross(a.incoming,b.outgoing[0]),dot(a.incoming,b.outgoing[0]))/R,value.signedDeviationDeg,1e-7);
 return true;
}
