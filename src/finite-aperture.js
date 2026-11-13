// Native PhyDemo Aperture: two collinear opaque finite arms with an
// explicitly transparent centred gap. No custom ray tracing or routing.
export const FINITE_APERTURE_TYPE='finite-aperture';
export const APERTURE_CLEARANCE_MM=0.01;
export function apertureGeometry(parameters,endpoints){
  const {length,openingLength}=parameters;
  const [p1,p2]=endpoints(parameters);
  const t=(length-openingLength)/(2*length);
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const p3=lerp(p1,p2,t),p4=lerp(p2,p1,t);
  return {p1,p2,p3,p4,arms:[[p1,p3],[p4,p2]]};
}
export function compileFiniteAperture(component,endpoints){
  const {p1,p2,p3,p4}=apertureGeometry(component.parameters,endpoints);
  const flip=p=>({x:p.x,y:-p.y});
  return {type:'Aperture',p1:flip(p1),p2:flip(p2),p3:flip(p3),p4:flip(p4),filter:false};
}
// Only a conservative clearance guard; PhyDemo exclusively chooses actual
// ray/surface intersections and makes each absorption decision.
function pointToSegmentDistance(p,[a,b]){
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
// Callers first reject geometrically intersecting segments separately.
export function separatedSegmentDistance([a,b],[c,d]){
  return Math.min(pointToSegmentDistance(a,[c,d]),pointToSegmentDistance(b,[c,d]),
    pointToSegmentDistance(c,[a,b]),pointToSegmentDistance(d,[a,b]));
}
