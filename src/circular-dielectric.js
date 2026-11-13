// Finite circular-region geometry only. PhyDemo owns all ray intersections,
// Snell/Fresnel refraction and TIR; this module never propagates a ray.
export const CIRCULAR_TYPE='circular-dielectric';
export const CIRCULAR_PARAMETERS=Object.freeze([
 'x','y','radius','insideIndex','outsideIndex','partialReflection'
]);
export function circularExtents({x,y,radius:r}){
 return [{x:x-r,y},{x:x+r,y},{x,y:y-r},{x,y:y+r}];
}
export function compileCircular(component){
 const p=component.parameters;
 // A single homogeneous outside medium is normalized to 1. Absolute indices
 // remain canonical facts. No optical path, light speed or 3D model is implied.
 return {type:'CircleGlass',p1:{x:p.x,y:-p.y},p2:{x:p.x+p.radius,y:-p.y},
  refIndex:p.insideIndex/p.outsideIndex,partialReflect:p.partialReflection};
}
function segmentDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function validateCircularGeometry(components,endpoints,fail){
 const path='$.physics.components',circles=components.filter(c=>c.type===CIRCULAR_TYPE);
 const sources=components.filter(c=>c.type==='point-source');
 if(circles.length!==1||sources.length<1||sources.length>4||
  components.filter(c=>c.type==='ray-detector').length>2||
  components.some(c=>!['point-source',CIRCULAR_TYPE,'ray-detector'].includes(c.type)))
  fail(path,'Circular dielectric scope: one stationary circular region, 1–4 single rays, 0–2 external detectors; no other optics or nested media.','UNSUPPORTED_SCOPE');
 const p=circles[0].parameters;
 if(p.radius<2||circularExtents(p).some(q=>Math.abs(q.x)>10000||Math.abs(q.y)>10000))
  fail(path,'Circular radius must be positive and at least 2 mm; the entire circle must fit within +/-10000 mm.','UNSUPPORTED_SCOPE');
 for(const c of sources){
  if(c.emission.mode!=='single-ray')fail(path,'Circular dielectric currently supports only explicit native single-ray emission.','UNSUPPORTED_SCOPE');
  const dx=c.parameters.x-p.x,dy=c.parameters.y-p.y,d=Math.hypot(dx,dy);
  if(Math.abs(d-p.radius)<.01)fail(path,'Sources must be at least 0.01 mm from the circular boundary.','UNSUPPORTED_SCOPE');
  // A geometric clearance guard on the initial forward line, not a custom
  // intersection finder. Near-tangent incidence needs a separate numerical
  // audit; reject rather than assert a hit/miss in this unresolved band.
  const a=c.emission.directionDeg*Math.PI/180,vx=Math.cos(a),vy=Math.sin(a);
  if(d>p.radius&&dx*vx+dy*vy<0&&Math.abs(Math.abs(dx*vy-dy*vx)-p.radius)<.01)
   fail(path,'Initial forward ray is within 0.01 mm of tangency to the circle.','UNSUPPORTED_SCOPE');
 }
 for(const c of components.filter(c=>c.type==='ray-detector')){
  if(segmentDistance(p,...endpoints(c.parameters))<p.radius+.01)
   fail(path,'Detectors must lie wholly outside the circle with 0.01 mm clearance.','UNSUPPORTED_SCOPE');
 }
}
// Local outward normal AT A REAL NATIVE HIT, never a prescribed ray route.
export function circularEncounter(component,nativePoint,incoming){
 const p=component.parameters,point={x:nativePoint.x,y:-nativePoint.y};
 const dx=point.x-p.x,dy=point.y-p.y,r=Math.hypot(dx,dy);
 const normal={x:dx/r,y:dy/r};
 const leaving=incoming&&incoming.x*normal.x+incoming.y*normal.y>0;
 return {normal,point,from:leaving?'inside':'outside',
  incidentIndex:leaving?p.insideIndex:p.outsideIndex,
  destinationIndex:leaving?p.outsideIndex:p.insideIndex};
}
