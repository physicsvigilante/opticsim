// v15 bounded physical thick lenses; geometry/admission only. Native
// PhyDemo SphericalLens (DR1R2) performs ALL ray intersections and propagation.
// This module NEVER traces rays, computes a focal image, or repairs cutoffs.
import {compositionCountsMatch} from './composition-profiles.js';

export const SPHERICAL_LENS_TYPE='spherical-lens';
export const SPHERICAL_LENS_MODEL='native-thick-lens-tracing';
export const SPHERICAL_LENS_VERSION=15;
export const SPHERICAL_PARAMETERS=Object.freeze([
 'x','y','apertureHeight','centerThickness','frontRadius','backRadius',
 'insideIndex','outsideIndex','partialReflection'
]);
export const SPHERICAL_CLEARANCE_MM=.01;
export const SPHERICAL_FACES=Object.freeze([
 {id:'front-arc'},{id:'back-arc'},{id:'top-rim'},{id:'bottom-rim'}
]);

const near=(a,b,t=1e-5)=>Math.abs(a-b)<=t;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
function sagitta(radius,halfAperture){
 // Numerically stable signed circle sag (+ convex outward, - concave inward, null flat).
 if(radius===null)return 0;
 const absR=Math.abs(radius);
 return Math.sign(radius)*(halfAperture*halfAperture/(absR+Math.sqrt(absR*absR-halfAperture*halfAperture)));
}
export function thickLensGeometry(p){
 const half=p.apertureHeight/2,s1=sagitta(p.frontRadius,half),
  s2=sagitta(p.backRadius,half);
 const frontApex=p.x-p.centerThickness/2,backApex=p.x+p.centerThickness/2;
 const frontRim=frontApex+s1,backRim=backApex-s2;
 return {
  left:Math.min(frontApex,frontRim),right:Math.max(backApex,backRim),
  frontApex,backApex,
  top:p.y+half,bottom:p.y-half,
  frontRim,backRim,
  frontCenter:p.frontRadius===null?null:{x:frontApex+p.frontRadius,y:p.y},
  backCenter:p.backRadius===null?null:{x:backApex-p.backRadius,y:p.y},
  edgeThickness:p.centerThickness-s1-s2,
  corners:[{x:frontRim,y:p.y-half},{x:backRim,y:p.y-half},
   {x:backRim,y:p.y+half},{x:frontRim,y:p.y+half}]
 };
}
export function thickLensExtents(p){
 const g=thickLensGeometry(p);
 return [{x:g.left,y:g.top},{x:g.right,y:g.top},
  {x:g.left,y:g.bottom},{x:g.right,y:g.bottom}];
}
export function compileSphericalLens(component){
 const p=component.parameters,half=p.apertureHeight/2;
 if(p.frontRadius!==null&&p.backRadius!==null){
  // Native y is down. p1 is the upper end of the vertical aperture, p2 lower.
  // DR1R2 uses r1 = frontRadius (+ convex, - concave) and r2 = -backRadius (- convex, + concave).
  return {type:'SphericalLens',
   p1:{x:p.x,y:-(p.y+half)},p2:{x:p.x,y:-(p.y-half)},
   path:null,defBy:'DR1R2',
   params:{d:p.centerThickness,r1:p.frontRadius,r2:-p.backRadius},
   refIndex:p.insideIndex/p.outsideIndex,partialReflect:p.partialReflection};
 }
 // JSON.stringify converts Infinity to null, so flat (null-radius) faces compile directly
 // to the exact 6-point SphericalLens path produced by createLensWithDR1R2.
 const g=thickLensGeometry(p);
 return {type:'SphericalLens',
  p1:null,p2:null,defBy:'DR1R2',params:null,
  path:[
   {x:g.frontRim,y:-(p.y+half),arc:false},
   {x:g.backRim,y:-(p.y+half),arc:false},
   {x:g.backApex,y:-p.y,arc:true},
   {x:g.backRim,y:-(p.y-half),arc:false},
   {x:g.frontRim,y:-(p.y-half),arc:false},
   {x:g.frontApex,y:-p.y,arc:true}
  ],
  refIndex:p.insideIndex/p.outsideIndex,partialReflect:p.partialReflection};
}
function entirelyOutsideX(vertices,g,margin=SPHERICAL_CLEARANCE_MM){
 return vertices.every(v=>v.x<=g.left-margin)||
        vertices.every(v=>v.x>=g.right+margin);
}
export function validateSphericalLensTrain(components,endpoints,fail){
 const path='$.physics.components';
 if(!compositionCountsMatch(components,SPHERICAL_LENS_MODEL,SPHERICAL_LENS_VERSION))
  fail(path,'Native thick lens scope: 1–2 separated biconvex spherical lenses, 1–4 exact native rays and 0–2 external detectors; no other optics.','UNSUPPORTED_SCOPE');
 const lenses=components.filter(c=>c.type===SPHERICAL_LENS_TYPE);
 const geometry=lenses.map(c=>{
  const p=c.parameters,half=p.apertureHeight/2;
  if(!(p.apertureHeight>=4&&p.centerThickness>=2&&p.frontRadius>=half+1&&p.backRadius>=half+1))
   fail(path,'Biconvex lens requires aperture >=4 mm, thickness >=2 mm and each positive spherical radius >= half-aperture + 1 mm.','UNSUPPORTED_SCOPE');
  const g=thickLensGeometry(p);
  if(!Number.isFinite(g.edgeThickness)||g.edgeThickness<1)
   fail(path,'Both finite spherical faces must retain a rim thickness of at least 1 mm, with no crossings.','UNSUPPORTED_SCOPE');
  if(thickLensExtents(p).some(v=>Math.abs(v.x)>10000||Math.abs(v.y)>10000))
   fail(path,'Entire native spherical lens must lie within +/-10000 mm.','UNSUPPORTED_SCOPE');
  return g;
 });
 if(lenses.some(c=>c.parameters.outsideIndex!==lenses[0].parameters.outsideIndex))
  fail(path,'All thick lenses require one explicitly shared outside refractive index.','UNSUPPORTED_SCOPE');
 if(geometry.length===2){
  const [a,b]=[...geometry].sort((a,b)=>a.left-b.left);
  if(b.left-a.right<SPHERICAL_CLEARANCE_MM)
   fail(path,'Two finite thick lenses must have >=0.01 mm clearance between entire x extents; touching, overlapping or nested media are unsupported.','UNSUPPORTED_SCOPE');
 }
 const sources=components.filter(c=>c.type==='point-source');
 for(const c of sources){
  if(c.emission.mode!=='single-ray')
   fail(path,'Spherical lens tracing requires explicit single native rays, never an implicit cone.','UNSUPPORTED_SCOPE');
  const p=c.parameters,a=c.emission.directionDeg*Math.PI/180;
  const d={x:Math.cos(a),y:Math.sin(a)};
  for(const [i,g] of geometry.entries()){
   if(!entirelyOutsideX([p],g))
    fail(path,'Source must be outside every thick-lens horizontal extent by 0.01 mm; inside/boundary sources require separate validation.','UNSUPPORTED_SCOPE');
   if(g.corners.some(q=>{
    const z={x:q.x-p.x,y:q.y-p.y};
    return dot(z,d)>0&&Math.abs(cross(z,d))<SPHERICAL_CLEARANCE_MM;
   }))fail(path,'Initial forward ray approaches a native lens rim/arc vertex within 0.01 mm.','UNSUPPORTED_SCOPE');
   for(const [center,r] of [[g.frontCenter,lenses[i].parameters.frontRadius],
                            [g.backCenter,lenses[i].parameters.backRadius]]){
    const v={x:center.x-p.x,y:center.y-p.y};
    if(dot(v,d)>0&&Math.abs(Math.abs(cross(v,d))-r)<SPHERICAL_CLEARANCE_MM)
     fail(path,'Initial forward ray is within 0.01 mm of tangency to a lens generating circle.','UNSUPPORTED_SCOPE');
   }
  }
 }
 for(const c of components.filter(c=>c.type==='ray-detector')){
  const ends=endpoints(c.parameters);
  for(const g of geometry)if(!entirelyOutsideX(ends,g))
   fail(path,'Detector must lie entirely to one side of every thick lens with at least 0.01 mm x clearance; crossings and internal detectors are unsupported.','UNSUPPORTED_SCOPE');
 }
}
export function sphericalLensEncounter(component,nativePoint,incoming){
 const p=component.parameters,g=thickLensGeometry(p);
 const point={x:nativePoint?.x,y:-nativePoint?.y},eps=1e-5;
 const candidates=[];
 if([point.x,point.y].every(Number.isFinite)){
  if(p.frontRadius===null){
   if(near(point.x,g.frontApex,eps)&&point.y>=g.bottom-eps&&point.y<=g.top+eps)
    candidates.push({id:'front-arc',normal:{x:-1,y:0}});
  }else{
   const sgn=Math.sign(p.frontRadius),absR=Math.abs(p.frontRadius);
   const dx=point.x-g.frontCenter.x,dy=point.y-g.frontCenter.y,r=Math.hypot(dx,dy);
   const onSide=sgn>0?point.x<=g.frontCenter.x+eps:point.x>=g.frontCenter.x-eps;
   if(onSide&&Math.abs(r-absR)<eps&&point.y>=g.bottom-eps&&point.y<=g.top+eps)
    candidates.push({id:'front-arc',normal:{x:sgn*dx/r,y:sgn*dy/r}});
  }
  if(p.backRadius===null){
   if(near(point.x,g.backApex,eps)&&point.y>=g.bottom-eps&&point.y<=g.top+eps)
    candidates.push({id:'back-arc',normal:{x:1,y:0}});
  }else{
   const sgn=Math.sign(p.backRadius),absR=Math.abs(p.backRadius);
   const dx=point.x-g.backCenter.x,dy=point.y-g.backCenter.y,r=Math.hypot(dx,dy);
   const onSide=sgn>0?point.x>=g.backCenter.x-eps:point.x<=g.backCenter.x+eps;
   if(onSide&&Math.abs(r-absR)<eps&&point.y>=g.bottom-eps&&point.y<=g.top+eps)
    candidates.push({id:'back-arc',normal:{x:sgn*dx/r,y:sgn*dy/r}});
  }
  if(near(point.y,g.top,eps)&&point.x>=g.frontRim-eps&&point.x<=g.backRim+eps)
   candidates.push({id:'top-rim',normal:{x:0,y:1}});
  if(near(point.y,g.bottom,eps)&&point.x>=g.frontRim-eps&&point.x<=g.backRim+eps)
   candidates.push({id:'bottom-rim',normal:{x:0,y:-1}});
 }
 if(candidates.length!==1||g.corners.some(v=>Math.hypot(v.x-point.x,v.y-point.y)<SPHERICAL_CLEARANCE_MM))
  return {point,normal:{x:NaN,y:NaN},faceId:null,invalid:true};
 const {id,normal}=candidates[0],leaving=incoming&&dot(incoming,normal)>0;
 return {point,normal,faceId:id,from:leaving?'inside':'outside',
  incidentIndex:leaving?p.insideIndex:p.outsideIndex,
  destinationIndex:leaving?p.outsideIndex:p.insideIndex};
}
