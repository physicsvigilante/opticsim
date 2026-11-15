// TEST ONLY. Independent vector Snell construction and bracketed inverse.
// This module is never imported by production code and never supplies native rays.
import assert from 'node:assert/strict';
const rad=Math.PI/180,deg=180/Math.PI;
export function vectorPrismReference(A,i,n0,n){
 // Resolve the tangential component at entry then at the rotated exit normal.
 const entryT=n0/n*Math.sin(i*rad);
 if(Math.abs(entryT)>1)return {outcome:'entry-tir'};
 const v={x:Math.sqrt(1-entryT*entryT),y:entryT};
 const normal={x:Math.cos(A*rad),y:Math.sin(A*rad)};
 const tangent={x:-normal.y,y:normal.x};
 const vn=v.x*normal.x+v.y*normal.y,vt=v.x*tangent.x+v.y*tangent.y;
 if(vn<=0||vt>1e-14)return {outcome:'other-branch'};
 const outT=n/n0*vt;
 if(Math.abs(outT)>1)return {outcome:'exit-tir'};
 const outN=Math.sqrt(1-outT*outT),out={x:outN*normal.x+outT*tangent.x,y:outN*normal.y+outT*tangent.y};
 return {outcome:'direct',r1:Math.atan2(v.y,v.x)*deg,r2:Math.atan2(-vt,vn)*deg,
  e:Math.atan2(-outT,outN)*deg,delta:i-Math.atan2(out.y,out.x)*deg,outgoing:out};
}
export function bisectedPrismIndex(A,i,delta,n0){
 const e=A+delta-i,u=Math.sin(i*rad),v=Math.sin(e*rad);
 if(i===0)return n0*v/Math.sin(A*rad);
 if(e===0)return n0*u/Math.sin(A*rad);
 let lo=Math.max(0,A-90),hi=Math.min(90,A);
 const f=r=>u*Math.sin((A-r)*rad)-v*Math.sin(r*rad);
 assert.ok(f(lo)>=0&&f(hi)<=0,'Reference must bracket a conventional branch');
 for(let k=0;k<100;k++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid;}
 return n0*u/Math.sin(((lo+hi)/2)*rad);
}
export function nativePrismRequest({A,i,n0,n,left=120,right=120,entryY=-30,sourceX=-20,rotation=0,scale=1,tx=0,ty=0}){
 const a=rotation*rad,point=(x,y)=>({x:tx+scale*(x*Math.cos(a)-y*Math.sin(a)),y:ty+scale*(x*Math.sin(a)+y*Math.cos(a))});
 const vertices=[[0,0],[0,-left],[right*Math.sin(A*rad),-right*Math.cos(A*rad)]].map(([x,y])=>point(x,y));
 const source=point(sourceX,entryY+sourceX*Math.tan(i*rad));
 return {lengthUnit:'mm',title:'Synthetic angular qualification; dimensions and illumination explicitly declared',components:[
  {id:'S',type:'point-source',parameters:{...source,brightness:1},emission:{mode:'single-ray',directionDeg:((i+rotation+180)%360+360)%360-180}},
  {id:'P',type:'triangular-prism',parameters:{...Object.fromEntries(vertices.flatMap((v,j)=>[['x'+(j+1),v.x],['y'+(j+1),v.y]])),insideIndex:n,outsideIndex:n0,partialReflection:false}}
 ]};
}
const unit=(x,y)=>{const d=Math.hypot(x,y);return {x:x/d,y:y/d};};
const rayDirection=r=>unit(r.p2.x-r.p1.x,r.p1.y-r.p2.y);
export function inspectPrismNative(doc,core){
 const {scene,idMap}=core.loadDocument(doc),trace=[];
 const emission=core.observeSourceSet(doc,scene,idMap),interfaces=core.observeInterfaceSet(doc,scene,idMap);
 const c=doc.physics.components.find(c=>c.type==='triangular-prism'),o=scene.objs[idMap.get(c.id)],incident=o.onRayIncident;
 o.onRayIncident=function(...args){
  const incoming=rayDirection(args[0]),point={x:args[2].x,y:-args[2].y},ret=incident.apply(this,args);
  trace.push({point,incoming,outgoing:ret?.isAbsorbed?null:rayDirection(args[0])});return ret;
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);let event;
 for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>{event=e;});sim.updateSimulation();
 const diagnostic=core.diagnostics(scene,sim,emission,null,null,interfaces);
 return {trace,diagnostic,status:core.classifyRun(event,diagnostic)};
}
export function checkNativeSnell(doc,trace){
 const p=doc.physics.components.find(c=>c.type==='triangular-prism').parameters,vs=[1,2,3].map(k=>({x:p['x'+k],y:p['y'+k]}));
 const cross=(a,b)=>a.x*b.y-a.y*b.x,dot=(a,b)=>a.x*b.x+a.y*b.y;
 const area=vs.reduce((s,a,j)=>s+cross(a,vs[(j+1)%3]),0),w=Math.sign(area);
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
 for(const e of trace){
  const faces=vs.map((a,j)=>{const b=vs[(j+1)%3],v={x:b.x-a.x,y:b.y-a.y},d={x:e.point.x-a.x,y:e.point.y-a.y},len=Math.hypot(v.x,v.y);
   return {id:j,distance:Math.abs(cross(v,d))/len,t:dot(v,d)/(len*len),n:{x:w*v.y/len,y:-w*v.x/len}};}).filter(f=>f.distance<1e-6&&f.t>0&&f.t<1);
  assert.equal(faces.length,1,'Unambiguous finite face, away from corners');e.face=faces[0].id;
  const n=faces[0].n,leaving=dot(e.incoming,n)>0,ni=leaving?p.insideIndex:p.outsideIndex,nt=leaving?p.outsideIndex:p.insideIndex;
  assert.ok(e.outgoing);const transmitted=dot(e.incoming,n)*dot(e.outgoing,n)>0;e.transmitted=transmitted;
  if(transmitted)close(ni*cross(e.incoming,n),nt*cross(e.outgoing,n));
  else {close(e.outgoing.x,e.incoming.x-2*dot(e.incoming,n)*n.x);close(e.outgoing.y,e.incoming.y-2*dot(e.incoming,n)*n.y);}
 }
}
