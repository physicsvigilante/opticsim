// Bounded public v27: exactly one real Beam, a two-plane parallel slab,
// a finite separated Mirror beyond the rear face and passive source-side
// Detectors. This module only validates geometry. No custom rays are produced.
import {compositionCountsMatch} from './composition-profiles.js';
import {parallelBeamGeometry,BEAM_CLEARANCE_MM} from './parallel-beam.js';
import {
 v26PinnedBeamAdmissionSamples,
 BEAM_PLANAR_MIRROR_HALF_SAMPLE_GUARD,
 BEAM_PLANAR_MIRROR_MIRROR_RIM_CLEARANCE_MM,
 BEAM_PLANAR_MIRROR_DETECTOR_ENDPOINT_CLEARANCE_MM
} from './native-beam-planar-mirror-v26.js';

export const BEAM_TWO_PLANE_MIRROR_VERSION=27;
export const BEAM_TWO_PLANE_MIRROR_MODEL='native-parallel-slab-mirror-tracing';
export const BEAM_TWO_PLANE_MIRROR_MIN_SLAB_MM=1;
export const BEAM_TWO_PLANE_MIRROR_MIN_GAP_MM=1;
const DEG=Math.PI/180,NO=1e-10;
const safe=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&
 Math.abs(p.x)<=10000&&Math.abs(p.y)<=10000;
const refuse=(fail,path,why)=>fail(path,why,'UNSUPPORTED_SCOPE');
const interior=(y,mid,half,rim)=>
 Number.isFinite(y)&&y>mid-half+rim&&y<mid+half-rim;
function structure(components){
 const planes=components.filter(x=>x.type==='planar-interface').sort(
  (a,b)=>a.parameters.x-b.parameters.x);
 return {
  beam:components.find(x=>x.type==='parallel-beam').parameters,
  planes:planes.map(x=>x.parameters),
  mirror:components.find(x=>x.type==='plane-mirror').parameters,
  detectors:components.filter(x=>x.type==='ray-detector').map(x=>x.parameters)
 };
}
// Necessary geometric first-pass checkpoints, never actual native ray paths.
// Emission positions use EXACTLY the same y-down compiled Beam endpoints,
// sqrt distance, native n and midpoint loop as pinned PhyDemo, via v26 B1 fix.
// No angular interpolation, declared path, or Ray identity is handed to native.
export function beamTwoPlaneMirrorSafetyWitness(components,rayDensity){
 const {beam,planes,mirror,detectors}=structure(components);
 const samples=v26PinnedBeamAdmissionSamples(beam,rayDensity);
 const [front,rear]=planes,i=beam.directionDeg*DEG;
 const refracted=Math.asin(front.negativeIndex/front.positiveIndex*Math.sin(i));
 const emerged=Math.asin(front.positiveIndex/rear.positiveIndex*Math.sin(refracted));
 const tanIn=Math.tan(i),tanGlass=Math.tan(refracted),tanAfter=Math.tan(emerged);
 const rays=samples.samples.map(p=>{
  const entryY=p.y+(front.x-p.x)*tanIn;
  const rearExitY=entryY+(rear.x-front.x)*tanGlass;
  const mirrorY=rearExitY+(mirror.x-rear.x)*tanAfter;
  const rearReturnY=mirrorY+(mirror.x-rear.x)*tanAfter;
  const frontReturnY=rearReturnY+(rear.x-front.x)*tanGlass;
  const detectorY=detectors.map(d=>({
   x:d.x,
   inbound:p.y+(d.x-p.x)*tanIn,
   outbound:frontReturnY+(front.x-d.x)*tanIn
  }));
  return {emitted:p,entryY,rearExitY,mirrorY,rearReturnY,
   frontReturnY,detectorY};
 });
 return {
  samples:rays,nativeSampleFactor:samples.nativeSampleFactor,
  nearHalfInteger:samples.nearHalfInteger,nativeLengthScale:samples.nativeLengthScale,
  frontX:front.x,rearX:rear.x,mirrorX:mirror.x,
  initialAngleDeg:beam.directionDeg,refractedAngleDeg:refracted/DEG,
  emergedAngleDeg:emerged/DEG,
  nativePathVerified:false
 };
}
export function validateBeamTwoPlaneMirror(components,model,rayDensity,mirrorEndpoints,fail){
 const path='$.physics.components';
 // With a full outbound+return slab path, two source-side passive detector
 // planes yield nine genuine encounters (2+2 detector, 2+2 glass, 1 mirror),
 // exceeding the v27 native maxRayDepth=8. Do not silently admit a scene
 // which can only return incomplete measurements.
 if(components.filter(c=>c.type==='ray-detector').length>1)
  refuse(fail,path,'v27 admits at most one passive detector: two detector planes need nine native interactions on the round trip and exceed depth budget 8.');
 if(model!==BEAM_TWO_PLANE_MIRROR_MODEL||
  !compositionCountsMatch(components,model,BEAM_TWO_PLANE_MIRROR_VERSION))
  refuse(fail,path,'v27 requires precisely one finite Beam, exactly two planar refracting interfaces, one finite return Mirror and at most one passive source-side Detector, with no other optics.');
 const {beam,planes,mirror,detectors}=structure(components);
 const [front,rear]=planes;
 if(front.normalDeg!==0||rear.normalDeg!==0||
  front.partialReflection!==false||rear.partialReflection!==false)
  refuse(fail,path,'Both v27 planes must be vertical (+x normals) with explicit partialReflection=false; partial Fresnel branches are not qualified.');
 if(front.positiveIndex<front.negativeIndex||
  rear.negativeIndex!==front.positiveIndex||
  rear.positiveIndex!==front.negativeIndex)
  refuse(fail,path,'v27 requires a uniform slab index >= both equal outside indices; two interfaces must explicitly use the same material and return to the original exterior medium.');
 if(rear.x-front.x<BEAM_TWO_PLANE_MIRROR_MIN_SLAB_MM)
  refuse(fail,path,'The two refracting planes must delimit a genuinely finite slab at least 1 mm thick.');
 if(!safe({x:front.x,y:front.y})||!safe({x:rear.x,y:rear.y}))
  refuse(fail,path,'Refracting planes must use finite bounded coordinates.');
 if(!Number.isFinite(beam.directionDeg)||beam.directionDeg<0||beam.directionDeg>60)
  refuse(fail,path,'v27 admits a forward finite Beam inclined between 0 and 60 degrees; no reverse/oblique unknown route.');
 if(!Number.isFinite(rayDensity)||rayDensity<0.048||rayDensity>1||
    beam.brightness>rayDensity)
  refuse(fail,'$.simulation.rayDensity','v27 admits density 0.048–1 and brightness <= density; no silently saturated or missing native Beam samples.');
 const segment=parallelBeamGeometry(beam),endpoints=[segment.p1,segment.p2];
 if(!(beam.width>=10&&beam.width<=100)||
    endpoints.some(p=>!safe(p)||front.x-p.x<BEAM_CLEARANCE_MM))
  refuse(fail,path,'The full emitter segment must lie within world bounds, and at least 0.01 mm before the front face.');
 if(![90,-90].includes(mirror.orientationDeg)||
   mirror.length<20||
   mirror.x-rear.x<BEAM_TWO_PLANE_MIRROR_MIN_GAP_MM||
   !mirrorEndpoints(mirror).every(safe))
  refuse(fail,path,'The finite vertical return mirror must be at least 1 mm BEYOND the rear slab interface, length >=20 mm and fully bounded. Co-planar/touching and near-contact mirrors are explicitly unqualified.');
 const witness=beamTwoPlaneMirrorSafetyWitness(components,rayDensity);
 if(witness.nativeLengthScale!==1||witness.nearHalfInteger)
  refuse(fail,path,'The pinned native Beam lengthScale is fixed to 1; v27 refuses sampling factors within 1e-10 of a half-integer threshold, preserving exact B1 admission.');
 if(witness.samples.length<1||witness.samples.length>100)
  refuse(fail,path,'The pinned native Beam must emit 1–100 deterministic samples; no clipping of an uninspected sample set.');
 const half=mirror.length/2;
 for(const sample of witness.samples){
  if(![sample.entryY,sample.rearExitY,sample.mirrorY,
    sample.rearReturnY,sample.frontReturnY].every(Number.isFinite)||
   ![front.x,rear.x,mirror.x].every(Number.isFinite)||
   ![sample.entryY,sample.rearExitY,sample.mirrorY,
    sample.rearReturnY,sample.frontReturnY].every(y=>Math.abs(y)<=10000))
   refuse(fail,path,'A necessary two-boundary Snell/mirror checkpoint is nonfinite or outside the authored world; v27 cannot safely admit it.');
  if(!interior(sample.mirrorY,mirror.y,half,BEAM_PLANAR_MIRROR_MIRROR_RIM_CLEARANCE_MM))
   refuse(fail,path,'Every exact native Beam sample must meet the finite downstream mirror strictly more than 0.1 mm from each end; misses and post-refraction rim hazards are not admitted.');
 }
 const maxSourceX=Math.max(...endpoints.map(x=>x.x));
 for(const detector of detectors){
  if(![90,-90].includes(detector.orientationDeg)||
   detector.x-maxSourceX<BEAM_CLEARANCE_MM||
   front.x-detector.x<BEAM_CLEARANCE_MM||
   !mirrorEndpoints(detector).every(safe))
   refuse(fail,path,'Any detector must be a finite vertical source-side segment between the entire Beam and first refracting plane, with >=0.01 mm separation.');
  for(const sample of witness.samples){
   const d=sample.detectorY.find(x=>x.x===detector.x);
   for(const y of [d?.inbound,d?.outbound]){
    if(!Number.isFinite(y)||Math.abs(y)>10000)
     refuse(fail,path,'Predicted necessary inbound/return detector geometry is unbounded; cannot admit v27.');
    if(Math.abs(y-(detector.y+detector.length/2))<=
       BEAM_PLANAR_MIRROR_DETECTOR_ENDPOINT_CLEARANCE_MM||
       Math.abs(y-(detector.y-detector.length/2))<=
       BEAM_PLANAR_MIRROR_DETECTOR_ENDPOINT_CLEARANCE_MM)
     refuse(fail,path,'Native sample approaches a finite detector endpoint within 0.1 mm on inbound or return leg.');
   }
  }
 }
}
