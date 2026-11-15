// Test-only observations of normal production compilation. No donor scenes,
// alternative intersection routine, patched prototype or constructed ray path.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const direction=ray=>{const d={x:ray.p2.x-ray.p1.x,y:ray.p1.y-ray.p2.y},l=Math.hypot(d.x,d.y);return{x:d.x/l,y:d.y/l};};
const close=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} differs from ${b}`);
export function inspectExternalSurfaceScene(doc){
 const {scene,idMap}=core.loadDocument(doc),trace=[];
 const sources=core.observeSourceSet(doc,scene,idMap),mirrors=core.observeMirrorSet(doc,scene,idMap),
  detectors=core.observeDetectorSet(doc,scene,idMap),interfaces=core.observeInterfaceSet(doc,scene,idMap),
  blockers=core.observeBlockerSet(doc,scene,idMap);
 for(const c of doc.physics.components.filter(c=>c.type!=='point-source')){
  const obj=scene.objs[idMap.get(c.id)],original=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const incoming=direction(args[0]),point={x:args[2].x,y:-args[2].y},start={x:args[0].p1.x,y:-args[0].p1.y};
   const result=original.apply(this,args);
   trace.push({id:c.id,type:c.type,slot:args[1],start,point,incoming,
    absorbed:result?.isAbsorbed===true,secondaryRays:result?.newRays?.length||0,
    outgoing:[...(!result?.isAbsorbed?[args[0]]:[]),...(result?.newRays||[])].map(direction)});
   return result;
  };
 }
 const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);let event;
 for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>{event=e;});sim.updateSimulation();
 const diagnostic=core.diagnostics(scene,sim,sources,mirrors,detectors,interfaces,blockers);
 const status=core.classifyRun(event,diagnostic);let checked=0;
 // Complete-run physical checks only; partial evidence is never qualified here.
 if(['completed','completed-with-warnings'].includes(status)){
  for(const e of trace){
   const c=doc.physics.components.find(c=>c.id===e.id),p=c.parameters;
   close(Math.hypot(e.incoming.x,e.incoming.y),1);
   for(const v of e.outgoing)close(Math.hypot(v.x,v.y),1);
   if(['plane-mirror','line-blocker','ray-detector'].includes(c.type)){
    const angle=p.orientationDeg*Math.PI/180,t={x:Math.cos(angle),y:Math.sin(angle)},n={x:-t.y,y:t.x},q=sub(e.point,p);
    close(dot(q,n),0);assert.ok(Math.abs(dot(q,t))<=p.length/2+1e-7);
    if(c.type==='plane-mirror'){
     assert.equal(e.outgoing.length,1);const v=e.outgoing[0],k=2*dot(e.incoming,n);
     close(v.x,e.incoming.x-k*n.x);close(v.y,e.incoming.y-k*n.y);
    }else if(c.type==='ray-detector'){
     assert.equal(e.outgoing.length,1);close(e.outgoing[0].x,e.incoming.x);close(e.outgoing[0].y,e.incoming.y);
    }else{assert.equal(e.absorbed,true);assert.equal(e.secondaryRays,0);assert.equal(e.outgoing.length,0);}
   }else{
    const count=c.type==='triangular-prism'?3:4;
    const vertices=Array.from({length:count},(_,i)=>({x:p['x'+(i+1)],y:p['y'+(i+1)]}));
    const winding=Math.sign(vertices.reduce((sum,a,i)=>sum+cross(a,vertices[(i+1)%count]),0));
    const faces=vertices.map((a,i)=>{const b=vertices[(i+1)%count],edge=sub(b,a),length=Math.hypot(edge.x,edge.y),q=sub(e.point,a);
     return {n:{x:winding*edge.y/length,y:-winding*edge.x/length},distance:Math.abs(cross(edge,q))/length,t:dot(edge,q)/(length*length)};
    }).filter(f=>f.distance<1e-6&&f.t>0&&f.t<1);
    assert.equal(faces.length,1,'unambiguous authored face at native encounter');
    const n=faces[0].n,leaving=dot(e.incoming,n)>0,ni=leaving?p.insideIndex:p.outsideIndex,nt=leaving?p.outsideIndex:p.insideIndex;
    for(const v of e.outgoing){
     if(dot(e.incoming,n)*dot(v,n)>0)close(ni*cross(e.incoming,n),nt*cross(v,n));
     else{const k=2*dot(e.incoming,n);close(v.x,e.incoming.x-k*n.x);close(v.y,e.incoming.y-k*n.y);}
    }
   }
   checked++;
  }
  // Continuity is only asserted for a single nonbranching source. Callback
  // adjacency is NOT a source-labelled ray path for multiple sources/Fresnel.
  if(doc.physics.components.filter(c=>c.type==='point-source').length===1&&
     doc.physics.components.every(c=>c.parameters.partialReflection!==true)){
   for(let i=1;i<trace.length;i++){
    const a=trace[i-1],b=trace[i];assert.equal(a.absorbed,false,'no further event after absorption');
    close(a.point.x,b.start.x);close(a.point.y,b.start.y);
    close(a.outgoing[0].x,b.incoming.x);close(a.outgoing[0].y,b.incoming.y);
   }
  }
 }
 return {status,trace,diagnostic,checked};
}
export function transformExternalScene(request,rotation,scale=1,tx=0,ty=0){
 const a=rotation*Math.PI/180,point=(x,y)=>({x:tx+scale*(x*Math.cos(a)-y*Math.sin(a)),y:ty+scale*(x*Math.sin(a)+y*Math.cos(a))});
 const wrap=x=>((x+180)%360+360)%360-180;
 for(const c of request.components){const p=c.parameters;
  if(['triangular-prism','polygon-dielectric'].includes(c.type))for(let i=1;i<=(c.type==='triangular-prism'?3:4);i++){
   const q=point(p['x'+i],p['y'+i]);p['x'+i]=q.x;p['y'+i]=q.y;
  }else{Object.assign(p,point(p.x,p.y));if('length'in p)p.length*=scale;if('orientationDeg'in p)p.orientationDeg=wrap(p.orientationDeg+rotation);}
  if(c.emission)c.emission.directionDeg=wrap(c.emission.directionDeg+rotation);
 }return request;
}
