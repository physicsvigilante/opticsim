// EXPERIMENT ONLY. Never import this module from production src/ or a viewer.
// A relative-coordinate line formula, NOT a generally robust predicate.
// No tolerance, snapping, index/angle adjustment or exact-arithmetic fallback.
export const EXPERIMENT='relative-planar-intersection-experiment-v1';
export function relativeLineIntersection(a,b){
  const values=[a?.p1?.x,a?.p1?.y,a?.p2?.x,a?.p2?.y,b?.p1?.x,b?.p1?.y,b?.p2?.x,b?.p2?.y];
  if(!values.every(Number.isFinite))throw Error('Finite line endpoints required');
  const rx=a.p2.x-a.p1.x,ry=a.p2.y-a.p1.y,sx=b.p2.x-b.p1.x,sy=b.p2.y-b.p1.y;
  if((rx===0&&ry===0)||(sx===0&&sy===0))throw Error('Degenerate experimental line');
  const qx=b.p1.x-a.p1.x,qy=b.p1.y-a.p1.y,den=rx*sy-ry*sx;
  if(den===0)return null; // Includes unresolved cancellation; see counterexample.
  const t=(qx*sy-qy*sx)/den,p={x:a.p1.x+t*rx,y:a.p1.y+t*ry};
  if(![den,t,p.x,p.y].every(Number.isFinite))throw Error('Nonfinite experimental intersection');
  return p;
}
export function relativePlaneCandidate(ray,boundary){
  const p=relativeLineIntersection(ray,boundary);
  // Preserve the pinned PlaneGlass forward-point test, not a new ray policy.
  return p&&(p.x-ray.p1.x)*(ray.p2.x-ray.p1.x)+(p.y-ray.p1.y)*(ray.p2.y-ray.p1.y)>=0?p:null;
}
export function experimentalPlaneCore(core){
  return {...core,loadDocument(doc,...args){
    if(doc.schemaVersion!==5||doc.physics.model!=='planar-media-tracing')
      throw Error('Experimental override is scoped to v5 planar media');
    const loaded=core.loadDocument(doc,...args);
    for(const component of doc.physics.components.filter(c=>c.type==='planar-interface')){
      const obj=loaded.scene.objs[loaded.idMap.get(component.id)];
      if(obj.constructor.type!=='PlaneGlass')throw Error('Expected pinned PlaneGlass instance');
      // Instance-only, in-memory experiment: do not touch any prototype/vendor
      // file or change onRayIncident, Simulator, cutoff, material law or source.
      Object.defineProperty(obj,'checkRayIntersects',{configurable:true,value:function(ray){
        return relativePlaneCandidate(ray,this)??undefined;
      }});
    }
    return loaded;
  }};
}
export function cancellationCounterexample(){
  const e=Number.EPSILON;
  return {id:'determinant-cancellation',ray:{p1:{x:0,y:0},p2:{x:1,y:1+e}},
    boundary:{p1:{x:0,y:-e*e},p2:{x:1-e,y:1}}};
}
