// Shared admission-time geometry for already validated finite components.
// These predicates DO NOT locate native ray hits, propagate rays, admit model
// families, or change numerical budgets. Family validators own their policies.
import {FINITE_APERTURE_TYPE,apertureGeometry,separatedSegmentDistance} from './finite-aperture.js';

// Mechanical surface construction shared by optical and detector validation.
// A transparent aperture opening is NOT a solid segment. Whole-line endpoints
// remain available for the existing bounds and supporting-line guards.
export function finiteSurfaceGeometry(component,endpoints){
  const p=component.parameters,aperture=component.type===FINITE_APERTURE_TYPE;
  if(!['ideal-lens','plane-mirror','line-blocker','ray-detector',FINITE_APERTURE_TYPE].includes(component.type))
    throw new TypeError('Finite segment geometry is not defined for '+component.type);
  const line=component.type==='ideal-lens'
    ? [{x:p.x,y:-p.apertureHeight/2},{x:p.x,y:p.apertureHeight/2}]
    : endpoints(p);
  return {line,segments:aperture?apertureGeometry(p,endpoints).arms:[line],aperture};
}

// Preserve the original expression and strict boundary comparison. Do not
// replace this supporting-line guard with finite-segment distance: they admit
// different scenes. The caller supplies its existing clearance policy.
export function pointWithinSupportingLineClearance(point,p,clearanceMm){
  const theta=p.orientationDeg*Math.PI/180;
  return Math.abs(-(point.x-p.x)*Math.sin(theta)+(point.y-p.y)*Math.cos(theta))<clearanceMm;
}

// Moved verbatim from contract.js: tolerances are historical admission guards,
// not proposed changes to PhyDemo's intersection algorithm.
export function segmentsIntersect([a,b], [c,d]) {
  const delta = (p,q) => ({x:q.x-p.x,y:q.y-p.y});
  const cross = (p,q) => p.x*q.y-p.y*q.x;
  const ab=delta(a,b), cd=delta(c,d), ac=delta(a,c);
  const den=cross(ab,cd);
  const scale=Math.hypot(ab.x,ab.y)*Math.hypot(cd.x,cd.y);
  if(Math.abs(den)<1e-12*scale) {
    if(Math.abs(cross(ab,ac))>1e-9*Math.hypot(ab.x,ab.y)) return false;
    const dim=Math.abs(ab.x)>=Math.abs(ab.y)?'x':'y';
    return Math.max(Math.min(a[dim],b[dim]),Math.min(c[dim],d[dim])) <=
      Math.min(Math.max(a[dim],b[dim]),Math.max(c[dim],d[dim]))+1e-9;
  }
  const t=cross(ac,cd)/den, u=cross(ac,ab)/den;
  return t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9;
}

// 'aperture' identifies opaque arms, not a new physical surface. Only existing
// aperture pairs use a distance band in v4; ordinary segments retain their
// historical intersection-only rule. Do not generalize this into a universal
// minimum separation (v10 additionally imposes its own mutual-clearance rule).
export function finiteSurfacesConflict(a,b,apertureClearanceMm){
  return segmentsIntersect(a.line,b.line)||
    (a.aperture||b.aperture)&&separatedSegmentDistance(a.line,b.line)<apertureClearanceMm;
}
