// Test-only native event inspection reused from the verified v10 checks.
// It delegates native interactions once; it never supplies intersections or rays.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
const close=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
const direction=r=>{const x=r.p2.x-r.p1.x,y=r.p1.y-r.p2.y,n=Math.hypot(x,y);return {x:x/n,y:y/n};};
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
export function transform(r,rotation,scale=1,tx=0,ty=0){
 const a=rotation*Math.PI/180,point=(x,y)=>({x:tx+scale*(x*Math.cos(a)-y*Math.sin(a)),y:ty+scale*(x*Math.sin(a)+y*Math.cos(a))});
 const wrap=x=>((x+180)%360+360)%360-180;
 for(const c of r.components){const p=c.parameters;
  if(c.type==='polygon-dielectric')for(let i=1;i<=4;i++){const q=point(p['x'+i],p['y'+i]);p['x'+i]=q.x;p['y'+i]=q.y;}
  else{Object.assign(p,point(p.x,p.y));if('length' in p)p.length*=scale;if('orientationDeg' in p)p.orientationDeg=wrap(p.orientationDeg+rotation);}
  if(c.emission)c.emission.directionDeg=wrap(c.emission.directionDeg+rotation);
 }return r;
}
// Test-only actual-event inspection. These expectations never produce native
// rays. Normals are derived independently from authored edges (shoelace winding).
export function inspectNative(d){
 const loaded=core.loadDocument(d),trace=[];
 const emission=core.observeSourceSet(d,loaded.scene,loaded.idMap);
 const mirrors=core.observeMirrorSet(d,loaded.scene,loaded.idMap);
 const detectors=core.observeDetectorSet(d,loaded.scene,loaded.idMap);
 const interfaces=core.observeInterfaceSet(d,loaded.scene,loaded.idMap);
 for(const c of d.physics.components.filter(c=>c.type!=='point-source')){
  const obj=loaded.scene.objs[loaded.idMap.get(c.id)],original=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const incoming=direction(args[0]),point={x:args[2].x,y:-args[2].y};
   const ret=original.apply(this,args);
   const outgoing=[...(!ret?.isAbsorbed?[args[0]]:[]),...(ret?.newRays||[])].map(direction);
   assert.ok(trace.length<128,'Bounded test-only event evidence');
   trace.push({id:c.id,type:c.type,point,incoming,outgoing});return ret;
  };
 }
 const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,d.simulation.processedRayLimit);
 let event;for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>{event=e;});sim.updateSimulation();
 const diagnostic=core.diagnostics(loaded.scene,sim,emission,mirrors,detectors,interfaces);
 assert.equal(core.classifyRun(event,diagnostic),'completed');
 for(const e of trace){
  const c=d.physics.components.find(c=>c.id===e.id),p=c.parameters;
  if(c.type==='plane-mirror'){
   const a=p.orientationDeg*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)};
   for(const v of e.outgoing){close(v.x,e.incoming.x-2*dot(e.incoming,n)*n.x);close(v.y,e.incoming.y-2*dot(e.incoming,n)*n.y);}
  }
  if(c.type==='polygon-dielectric'){
   const v=[1,2,3,4].map(i=>({x:p['x'+i],y:p['y'+i]}));
   const winding=Math.sign(v.reduce((s,a,i)=>s+cross(a,v[(i+1)%4]),0));
   const face=v.map((a,i)=>{const b=v[(i+1)%4],edge={x:b.x-a.x,y:b.y-a.y},len=Math.hypot(edge.x,edge.y);
    const offset={x:e.point.x-a.x,y:e.point.y-a.y};return {n:{x:winding*edge.y/len,y:-winding*edge.x/len},distance:Math.abs(cross(edge,offset))/len,t:dot(edge,offset)/(len*len)};
   }).filter(f=>f.distance<1e-6&&f.t>0&&f.t<1);
   assert.equal(face.length,1);const n=face[0].n,leaving=dot(e.incoming,n)>0;
   const ni=leaving?p.insideIndex:p.outsideIndex,nt=leaving?p.outsideIndex:p.insideIndex;
   for(const v of e.outgoing){
    if(dot(e.incoming,n)*dot(v,n)>0)close(ni*cross(e.incoming,n),nt*cross(v,n));
    else{close(v.x,e.incoming.x-2*dot(e.incoming,n)*n.x);close(v.y,e.incoming.y-2*dot(e.incoming,n)*n.y);}
   }
  }
 }
 return {trace,diagnostic};
}
