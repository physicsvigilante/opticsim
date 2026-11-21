// Version 21: a finite right semicircle with a flat vertical diameter.
// Native PhyDemo alone traces/refraction/TIR. Admission computes only initial
// straight-line clearance, never any refracted/reflected ray or image.
import {compositionCountsMatch} from './composition-profiles.js';
import {parallelBeamGeometry,parallelBeamSamples,BEAM_CLEARANCE_MM} from './parallel-beam.js';

export const SEMICIRCULAR_TYPE='semicircular-dielectric';
export const SEMICIRCULAR_MODEL='native-parallel-semicircular-tracing';
export const SEMICIRCULAR_VERSION=21;
export const SEMICIRCULAR_PARAMETERS=Object.freeze(['x','y','radius','insideIndex','outsideIndex','partialReflection']);
export const SEMICIRCULAR_SEAM_CLEARANCE_MM=.1;
const world=n=>Number.isFinite(n)&&Math.abs(n)<=10000;
const unsupported=(fail,path,message)=>fail(path,message,'UNSUPPORTED_SCOPE');
export const semicircularExtents=p=>[
  {x:p.x,y:p.y+p.radius},{x:p.x+p.radius,y:p.y},
  {x:p.x,y:p.y-p.radius},{x:p.x,y:p.y}];
export const semicircularFaces=()=>[{id:'face-flat'},{id:'face-arc'}];
export function compileSemicircular(c){
 const p=c.parameters;
 // Pinned native Glass: arc=true on the midpoint, then flat closing edge.
 return {type:'Glass',path:[
   {x:p.x,y:-(p.y+p.radius),arc:false},
   {x:p.x+p.radius,y:-p.y,arc:true},
   {x:p.x,y:-(p.y-p.radius),arc:false}],
  notDone:false,refIndex:p.insideIndex/p.outsideIndex,
  partialReflect:p.partialReflection};
}
// Called only after native reports a REAL intersection. No source attribution,
// branch routing or inferred hit positions. Fail closed on seam/tangency.
export function semicircularEncounter(c,nativePoint,incoming){
 const p=c.parameters,point={x:nativePoint?.x,y:-(nativePoint?.y)};
 const dx=point.x-p.x,dy=point.y-p.y,radial=Math.hypot(dx,dy);
 const seam=Math.min(Math.hypot(dx,dy-p.radius),Math.hypot(dx,dy+p.radius));
 const invalid=()=>({point,normal:{x:NaN,y:NaN},faceId:null,invalid:true,
   from:'unverified',incidentIndex:null,destinationIndex:null});
 if(![dx,dy,radial,seam].every(Number.isFinite)||seam<=SEMICIRCULAR_SEAM_CLEARANCE_MM)return invalid();
 let faceId,normal;
 if(Math.abs(dx)<=1e-5&&Math.abs(dy)<p.radius-SEMICIRCULAR_SEAM_CLEARANCE_MM){
   faceId='face-flat';normal={x:-1,y:0};
 }else if(dx>0&&Math.abs(radial-p.radius)<=1e-5){
   faceId='face-arc';normal={x:dx/radial,y:dy/radial};
 }else return invalid();
 const proj=incoming?.x*normal.x+incoming?.y*normal.y;
 if(!Number.isFinite(proj)||Math.abs(proj)<1e-10)return invalid();
 const leaving=proj>0;
 return {point,normal,faceId,invalid:false,
   from:leaving?'inside':'outside',
   incidentIndex:leaving?p.insideIndex:p.outsideIndex,
   destinationIndex:leaving?p.outsideIndex:p.insideIndex};
}
export function validateSemicircularBeam(components,model,rayDensity,mirrorEndpoints,fail){
 const path='$.physics.components';
 if(model!==SEMICIRCULAR_MODEL||!compositionCountsMatch(components,model,SEMICIRCULAR_VERSION))
   unsupported(fail,path,'v21 admits one native finite Beam, one right semicircular dielectric and 0-2 downstream vertical detectors. No other optics.');
 const glass=components.find(c=>c.type===SEMICIRCULAR_TYPE).parameters;
 if(glass.radius<5||semicircularExtents(glass).some(v=>!world(v.x)||!world(v.y)))
   unsupported(fail,path,'Radius >=5 mm and the complete semicircle must fit within +/-10000 mm.');
 if(glass.partialReflection!==false)
   unsupported(fail,path,'v21 requires explicit Fresnel-off approximation; native TIR is still active.');
 if(!(glass.insideIndex>glass.outsideIndex))
   unsupported(fail,path,'Inside index must explicitly exceed surrounding index for this bounded v21 contract.');
 const beam=components.find(c=>c.type==='parallel-beam').parameters;
 if(!Number.isFinite(beam.directionDeg)||Math.abs(beam.directionDeg)>60)
   unsupported(fail,path,'Only forward illumination -60 to +60 degrees through the flat diameter is admitted.');
 const endpoints=parallelBeamGeometry(beam),edge=[endpoints.p1,endpoints.p2];
 if(beam.width<10||beam.width>100||edge.some(p=>!world(p.x)||!world(p.y)))
   unsupported(fail,path,'The full finite source must be in bounds, width 10-100 mm.');
 if(edge.some(e=>glass.x-e.x<BEAM_CLEARANCE_MM))
   unsupported(fail,path,'The complete Beam must start left of the flat diameter with 0.01 mm clearance.');
 if(!Number.isFinite(rayDensity)||rayDensity<.048||rayDensity>1||beam.brightness>rayDensity)
   unsupported(fail,'$.simulation.rayDensity','Density must be .048-1 and brightness must not exceed density.');
 const samples=parallelBeamSamples(beam,rayDensity);
 if(samples.length<1||samples.length>100)
   unsupported(fail,path,'Native Beam requires 1–100 samples and a sample factor clear of a half-integer threshold.');
 const slope=Math.tan(beam.directionDeg*Math.PI/180);
 for(const source of samples){
   // ONLY the un-refracted initial line vs authored flat face, never an
   // outgoing ray or predicted optical path. Native picks all later faces.
   const yAtFlat=source.y+(glass.x-source.x)*slope;
   if(!Number.isFinite(yAtFlat)||
      glass.radius-Math.abs(yAtFlat-glass.y)<=SEMICIRCULAR_SEAM_CLEARANCE_MM)
     unsupported(fail,path,'A sampled initial ray misses or approaches the flat/arc joint: adjust explicit source or radius.');
 }
 const detectors=components.filter(c=>c.type==='ray-detector');
 for(const c of detectors){
   const i=components.indexOf(c),d=c.parameters,segment=mirrorEndpoints(d);
   if(![90,-90].includes(d.orientationDeg)||
      segment.some(q=>!world(q.x)||!world(q.y)||q.x-glass.x-glass.radius<BEAM_CLEARANCE_MM))
     unsupported(fail,path+'['+i+']','Detector must be vertical and strictly to the right of the complete curved region with 0.01 mm clearance.');
 }
 if(detectors.length===2&&
    Math.abs(detectors[0].parameters.x-detectors[1].parameters.x)<BEAM_CLEARANCE_MM)
   unsupported(fail,path,'Two detectors must be on separate planes at least 0.01 mm apart.');
}
