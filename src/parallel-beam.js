// v19 JEE-first, deterministic finite parallel emitter. Geometry/admission only.
// Pinned native PhyDemo Beam alone emits every sample and traces every encounter.
import {compositionCountsMatch} from './composition-profiles.js';
// Surface endpoints are supplied by the canonical contract at admission time.
import {apertureGeometry,APERTURE_CLEARANCE_MM} from './finite-aperture.js';
import {interfaceNormal} from './planar-media.js';

export const PARALLEL_BEAM_TYPE='parallel-beam';
export const PARALLEL_BEAM_VERSION=19;
export const PARALLEL_LENS_MODEL='native-parallel-lens-tracing';
export const PARALLEL_PLANAR_MODEL='native-parallel-planar-tracing';
export const PARALLEL_BEAM_PARAMETERS=Object.freeze(['x','y','width','directionDeg','brightness']);
export const BEAM_CLEARANCE_MM=0.01;
const allowed=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=10000&&Math.abs(b)<=10000;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;

export function parallelBeamGeometry(p){
 const angle=p.directionDeg*Math.PI/180,normal={x:Math.cos(angle),y:Math.sin(angle)};
 const tangent={x:-normal.y,y:normal.x},half=p.width/2;
 const point=(sign)=>({x:p.x+sign*tangent.x*half,y:p.y+sign*tangent.y*half});
 // This order matters: native Beam's p1→p2 tangent produces the authored
 // right/left/up/down direction in PhyDemo's y-down coordinate convention.
 return {p1:point(1),p2:point(-1),direction:normal,tangent};
}
export function compileParallelBeam(component){
 const {p1,p2}=parallelBeamGeometry(component.parameters),flip=p=>({x:p.x,y:-p.y});
 return {type:'Beam',p1:flip(p1),p2:flip(p2),
  brightness:component.parameters.brightness,emisAngle:0,lambert:false,random:false};
}
export function parallelBeamSamples(p,density){
 // Admission-only emitted positions, identical to pinned native Beam's
 // deterministic midpoint loop (i=.5; i<=length*rayDensity; i++).
 // This never computes an optical ray interaction or an outgoing path.
 const g=parallelBeamGeometry(p),n=p.width*density,out=[];
 if(!Number.isFinite(n)||n<.5||n>100) return [];
 for(let i=.5;i<=n;i++)out.push({
  x:g.p1.x+(g.p2.x-g.p1.x)*i/n,
  y:g.p1.y+(g.p2.y-g.p1.y)*i/n
 });
 return out;
}
function outsidePlane(points,value,axis,margin=BEAM_CLEARANCE_MM){
 return points.every(p=>p[axis]<=value-margin)||
        points.every(p=>p[axis]>=value+margin);
}
function supportDistance(point,[a,b]){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
 return cross({x:dx,y:dy},{x:point.x-a.x,y:point.y-a.y})/len;
}
export function validateParallelBeamComposition(components,model,rayDensity,mirrorEndpoints,fail){
 const path='$.physics.components';
 if(![PARALLEL_LENS_MODEL,PARALLEL_PLANAR_MODEL].includes(model)||
    !compositionCountsMatch(components,model,PARALLEL_BEAM_VERSION))
  fail(path,'v19 admits one finite deterministic parallel emitter with either 0–1 ideal thin lenses and an optional vertical aperture, OR 1–2 parallel interfaces, plus 0–2 passive detectors. No other optics.','UNSUPPORTED_SCOPE');
 const beam=components.find(c=>c.type===PARALLEL_BEAM_TYPE),p=beam.parameters,g=parallelBeamGeometry(p);
 const endpoints=[g.p1,g.p2],direction=g.direction;
 if(!(p.width>=10&&p.width<=100&&
     endpoints.every(e=>allowed(e.x,e.y))))
  fail(path,'The complete finite emitting segment must fit within +/-10000 mm; width 10–100 mm.','UNSUPPORTED_SCOPE');
 if(!Number.isFinite(rayDensity)||rayDensity<0.048||rayDensity>1)
  fail('$.simulation.rayDensity','Parallel-beam sampling must use the supported density range.','UNSUPPORTED_SCOPE');
 if(p.brightness>rayDensity)
  fail(path,'Beam brightness must not exceed ray density, avoiding silently saturated native per-ray brightness.','UNSUPPORTED_SCOPE');
 const samples=parallelBeamSamples(p,rayDensity);
 if(samples.length<1||samples.length>100)
  fail(path,'Native Beam would emit zero or over 100 sampled rays under this numerical policy.','UNSUPPORTED_SCOPE');
 const detectors=components.filter(c=>c.type==='ray-detector');
 for(const detector of detectors){
  const segment=mirrorEndpoints(detector.parameters),signed=endpoints.map(v=>supportDistance(v,segment));
  if(signed.some(v=>!Number.isFinite(v)||Math.abs(v)<BEAM_CLEARANCE_MM)||
     signed[0]*signed[1]<=0)
   fail(path,'The entire emitting segment must start on one safe side of every detector supporting line.','UNSUPPORTED_SCOPE');
 }
 if(model===PARALLEL_LENS_MODEL){
  const lenses=components.filter(c=>c.type==='ideal-lens'),stops=components.filter(c=>c.type==='finite-aperture');
  if(![0,180,-180].includes(p.directionDeg))
   fail(path,'The first bounded ideal-lens beam profile supports exactly horizontal forward/reverse parallel rays.','UNSUPPORTED_SCOPE');
  const lens=lenses[0],stop=stops[0];
  if(lens){
   if(!outsidePlane(endpoints,lens.parameters.x,'x'))
    fail(path,'Entire parallel emitter must be at least 0.01 mm outside the lens plane.','UNSUPPORTED_SCOPE');
   if(lens.parameters.apertureHeight<2*BEAM_CLEARANCE_MM)
    fail(path,'Invalid physical lens aperture.','UNSUPPORTED_SCOPE');
   const forward=(lens.parameters.x-p.x)*direction.x>0,edge=lens.parameters.apertureHeight/2;
   if(forward&&samples.some(v=>Math.abs(Math.abs(v.y)-edge)<=BEAM_CLEARANCE_MM))
    fail(path,'A native beam sample lies within 0.01 mm of a finite lens rim.','UNSUPPORTED_SCOPE');
  }
  if(stop){
   const a=stop.parameters;
   // Initial straight-line corner checks are valid only BEFORE a lens can
   // change the direction. A native post-lens ray can meet the stop's inner
   // endpoint even though its original parallel sample was nowhere near it.
   // Until a bounded, separately reviewed downstream policy exists, refuse
   // an aperture beyond a forward ideal lens. This checks only authored plane
   // order, not a prescribed ray route, transmitted sample or image.
   // Topological order uses strictly positive signed distance, NOT the
   // clearance tolerance: the adjacent-plane validators admit equality at
   // 0.01 mm, which must not bypass downstream refusal.
   if(lens&&(lens.parameters.x-p.x)*direction.x>0&&
      (a.x-p.x)*direction.x>0&&
      (a.x-lens.parameters.x)*direction.x>0)
    fail(path,'A parallel-beam aperture downstream of a forward ideal lens is not admitted: refracted rays may hit gap/arm endpoints not checked by the initial-sample guard. Place the stop before the lens or use a separately validated arrangement.','UNSUPPORTED_SCOPE');
   const geometry=apertureGeometry(a,mirrorEndpoints);
   if(![90,-90].includes(a.orientationDeg)||
      [geometry.p1,geometry.p2,geometry.p3,geometry.p4].some(v=>!allowed(v.x,v.y)))
    fail(path,'v19 aperture must be vertical with all solid and gap endpoints inside coordinate bounds.','UNSUPPORTED_SCOPE');
   if(!outsidePlane(endpoints,a.x,'x')||
      lens&&Math.abs(lens.parameters.x-a.x)<APERTURE_CLEARANCE_MM)
    fail(path,'Whole source and lens must be strictly x-separated from the entire aperture plane.','UNSUPPORTED_SCOPE');
   if(Math.abs(direction.x)<1e-8)
    fail(path,'Ray directions tangent to the vertical stop are unsupported.','UNSUPPORTED_SCOPE');
   const corners=[geometry.p1.y,geometry.p2.y,geometry.p3.y,geometry.p4.y];
   if(samples.some(v=>{
     const t=(a.x-v.x)/direction.x;
     return t>0&&corners.some(y=>Math.abs(v.y+t*direction.y-y)<=BEAM_CLEARANCE_MM);
   }))fail(path,'An emitted native sample approaches an opaque arm or gap endpoint within 0.01 mm.','UNSUPPORTED_SCOPE');
  }
 } else {
  const planes=components.filter(c=>c.type==='planar-interface');
  const n=interfaceNormal(planes[0].parameters);
  const ordered=[...planes].sort((a,b)=>dot(a.parameters,n)-dot(b.parameters,n));
  if(Math.abs(dot(n,direction))<=1e-8)
   fail(path,'Near-grazing parallel beam at refractive plane is not admitted.','UNSUPPORTED_SCOPE');
  if(planes.some(c=>!Number.isFinite(c.parameters.normalDeg)||
        c.parameters.normalDeg!==planes[0].parameters.normalDeg))
   fail(path,'Parallel media must have the same explicitly oriented plane normals.','UNSUPPORTED_SCOPE');
  for(const plane of planes){
   const signed=endpoints.map(v=>dot({x:v.x-plane.parameters.x,y:v.y-plane.parameters.y},n));
   if(signed.some(v=>Math.abs(v)<BEAM_CLEARANCE_MM)||signed[0]*signed[1]<=0)
    fail(path,'Entire emitter segment must start on one unambiguous side of each medium boundary.','UNSUPPORTED_SCOPE');
   for(const detector of detectors){
    const d=mirrorEndpoints(detector.parameters);
    const side=d.map(v=>dot({x:v.x-plane.parameters.x,y:v.y-plane.parameters.y},n));
    if(side.some(v=>Math.abs(v)<BEAM_CLEARANCE_MM)||side[0]*side[1]<=0)
     fail(path,'Every finite detector must remain wholly inside one medium.','UNSUPPORTED_SCOPE');
   }
  }
  for(let i=1;i<ordered.length;i++){
   const a=ordered[i-1].parameters,b=ordered[i].parameters;
   const separation=dot({x:b.x-a.x,y:b.y-a.y},n);
   if(separation<BEAM_CLEARANCE_MM||a.positiveIndex!==b.negativeIndex)
    fail(path,'Parallel interfaces need 0.01 mm separation and matching adjacent absolute indices.','UNSUPPORTED_SCOPE');
  }
 }
}
