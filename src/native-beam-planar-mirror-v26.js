// v26 STRICT native finite Beam + one PlaneGlass + one finite Mirror.
// Admission geometry and conservative first-hit clearance only. Native PhyDemo
// alone refracts, reflects and creates detector events; never route or modify rays.
import {compositionCountsMatch} from './composition-profiles.js';
import {parallelBeamGeometry,pinnedBeamAdmissionSamples,BEAM_HALF_SAMPLE_GUARD,BEAM_CLEARANCE_MM} from './parallel-beam.js';

export const BEAM_PLANAR_MIRROR_VERSION=26;
export const BEAM_PLANAR_MIRROR_MODEL='native-parallel-planar-mirror-tracing';
export const BEAM_PLANAR_MIRROR_MIRROR_RIM_CLEARANCE_MM=0.1;
export const BEAM_PLANAR_MIRROR_DETECTOR_ENDPOINT_CLEARANCE_MM=0.1;
export const BEAM_PLANAR_MIRROR_MIN_SPACING_MM=0.01;
// Pin-specific conservative guard against branch-crossing half-integer native
// Beam emission counts when endpoint arithmetic differs across JS runtimes.
export const BEAM_PLANAR_MIRROR_HALF_SAMPLE_GUARD=BEAM_HALF_SAMPLE_GUARD;
export const v26PinnedBeamAdmissionSamples=pinnedBeamAdmissionSamples;
const RAD=Math.PI/180,refuse=(fail,path,message)=>fail(path,message,'UNSUPPORTED_SCOPE');
const world=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 Math.abs(p.x)<=10000&&Math.abs(p.y)<=10000;
const near=(a,b,t=1e-8)=>Math.abs(a-b)<=t;
const inside=(a,low,high,tol)=>a>low+tol&&a<high-tol;

// Predicted FIRST outbound glass->mirror intersection is an independent
// necessary admission check against finite endpoint uncertainty. It is NOT
// prescribed to native PhyDemo, observed as a detector hit, or advertised
// as a native optical path. No other optic or Fresnel child is admitted.
export function beamPlanarMirrorSafetyWitness(components,rayDensity){
 const beam=components.find(c=>c.type==='parallel-beam').parameters;
 const glass=components.find(c=>c.type==='planar-interface').parameters;
 const mirror=components.find(c=>c.type==='plane-mirror').parameters;
 const geometry=parallelBeamGeometry(beam),emitter=[geometry.p1,geometry.p2];
 const nativeSamples=v26PinnedBeamAdmissionSamples(beam,rayDensity);
 const densitySamples=nativeSamples.samples;
 const i=beam.directionDeg*RAD,r=Math.asin(glass.negativeIndex/
  glass.positiveIndex*Math.sin(i)),tangentIn=Math.tan(i),
  tangentGlass=Math.tan(r);
 const x0=glass.x,xM=mirror.x,halfM=mirror.length/2;
 const tracks=densitySamples.map(point=>{
  const entryY=point.y+(x0-point.x)*tangentIn;
  const mirrorY=entryY+(xM-x0)*tangentGlass;
  const returnY=entryY+2*(xM-x0)*tangentGlass;
  return {emitted:point,entryY,mirrorY,returnY};
 });
 return {emitter,tracks,nativeSampleFactor:nativeSamples.nativeSampleFactor,
  computedNativeLengthMm:nativeSamples.computedNativeLengthMm,
  nearHalfInteger:nativeSamples.nearHalfInteger,
  nativeLengthScale:nativeSamples.nativeLengthScale,refractionDeg:r/RAD,
  incidentDeg:beam.directionDeg,frontX:x0,mirrorX:xM,
  mirrorBottom:mirror.y-halfM,mirrorTop:mirror.y+halfM,
  sourceSideExit:'negative',nativePathVerified:false};
}
export function validateBeamPlanarMirror(components,model,rayDensity,mirrorEndpoints,fail){
 const path='$.physics.components';
 if(model!==BEAM_PLANAR_MIRROR_MODEL||
    !compositionCountsMatch(components,model,BEAM_PLANAR_MIRROR_VERSION))
  refuse(fail,path,'v26 requires exactly one true finite Beam, one planar refractive interface, one independently finite return mirror, and 0–2 passive detectors. No other optical objects.');
 const beam=components.find(c=>c.type==='parallel-beam').parameters;
 const interfaceP=components.find(c=>c.type==='planar-interface').parameters;
 const mirror=components.find(c=>c.type==='plane-mirror').parameters;
 const detectors=components.filter(c=>c.type==='ray-detector');
 if(interfaceP.normalDeg!==0||
    interfaceP.partialReflection!==false||
    !(interfaceP.positiveIndex>=interfaceP.negativeIndex))
  refuse(fail,path,'v26 requires a vertical x-plane, explicitly Fresnel-off partialReflection=false and an explicitly equal/higher-index second medium. Native TIR remains enabled.');
 if(!Number.isFinite(beam.directionDeg)||beam.directionDeg<0||beam.directionDeg>60)
  refuse(fail,path,'v26 admits forward positive-x finite Beam incidence between 0 and +60 degrees only; reverse/oblique outside this range is unverified.');
 if(!Number.isFinite(rayDensity)||rayDensity<0.048||rayDensity>1||
    beam.brightness>rayDensity)
  refuse(fail,'$.simulation.rayDensity','v26 requires ray density .048–1 and brightness <= density to prevent native per-sample saturation.');
 const geometry=parallelBeamGeometry(beam),ends=[geometry.p1,geometry.p2];
 if(!(beam.width>=10&&beam.width<=100)||ends.some(p=>!world(p)||
    interfaceP.x-p.x<BEAM_CLEARANCE_MM))
  refuse(fail,path,'The complete finite Beam must lie within +/-10000 mm, width 10–100 mm and at least 0.01 mm before the vertical interface.');
 const witness=beamPlanarMirrorSafetyWitness(components,rayDensity);
 if(witness.nearHalfInteger)
  refuse(fail,path,'Native Beam emission factor is too close to a half-integer threshold (<=1e-10); v26 withholds ambiguous native sample counts rather than leaving an unchecked sample.');
 if(witness.tracks.length<1||witness.tracks.length>100)
  refuse(fail,path,'Pinned native Beam must emit 1–100 deterministic samples under this numerical density.');
 if(![90,-90].includes(mirror.orientationDeg))
  refuse(fail,path,'v26 requires a vertical finite ideal mirror: no tilted mirror or additional later interface is admitted.');
 const mirrorSegment=mirrorEndpoints(mirror),dist=mirror.x-interfaceP.x;
 if(!Number.isFinite(dist)||dist<BEAM_PLANAR_MIRROR_MIN_SPACING_MM||
    !mirrorSegment.every(world)||mirror.length<20)
  refuse(fail,path,'Mirror must be wholly within world bounds, at least 0.01 mm inside the second medium and at least 20 mm long.');
 if(!Number.isFinite(witness.refractionDeg)||witness.tracks.some(v=>
     !world({x:interfaceP.x,y:v.entryY})||
     !world({x:mirror.x,y:v.mirrorY})||
     !world({x:interfaceP.x,y:v.returnY})||
     !inside(v.mirrorY,witness.mirrorBottom,witness.mirrorTop,
       BEAM_PLANAR_MIRROR_MIRROR_RIM_CLEARANCE_MM)))
  refuse(fail,path,'Every genuine Beam starting sample must have a safely interior first refracted mirror encounter and finite exit, >0.1 mm from both finite mirror endpoints. Unproven/clipped/near-corner beam paths are refused rather than silently lost.');
 for(const detector of detectors){
  const p=detector.parameters;
  if(![90,-90].includes(p.orientationDeg)||
     p.x<=Math.max(...ends.map(e=>e.x))+BEAM_CLEARANCE_MM||
     interfaceP.x-p.x<BEAM_CLEARANCE_MM||
     !mirrorEndpoints(p).every(world))
    refuse(fail,path,'Every v26 detector must be a wholly finite vertical segment between the entire Beam and the interface, with >=0.01 mm plane clearance.');
  const top=p.y+p.length/2,bottom=p.y-p.length/2;
  const source=beam.directionDeg*RAD,tan=Math.tan(source);
  for(const ray of witness.tracks){
   const yIn=ray.emitted.y+(p.x-ray.emitted.x)*tan,
    yReturn=ray.returnY+(interfaceP.x-p.x)*tan;
   for(const y of [yIn,yReturn]){
    if(!Number.isFinite(y))
     refuse(fail,path,'A deterministic detector crossing prediction is nonfinite; cannot admit this native return profile.');
    if(near(y,top,BEAM_PLANAR_MIRROR_DETECTOR_ENDPOINT_CLEARANCE_MM)||
       near(y,bottom,BEAM_PLANAR_MIRROR_DETECTOR_ENDPOINT_CLEARANCE_MM))
     refuse(fail,path,'A deterministic native Beam sample approaches a detector endpoint within 0.1 mm on its first/return path; unsupported ambiguous crossing.');
   }
  }
 }
 if(detectors.length===2&&
    Math.abs(detectors[0].parameters.x-detectors[1].parameters.x)<
      BEAM_PLANAR_MIRROR_MIN_SPACING_MM)
  refuse(fail,path,'Two passive detector planes must be separated by at least 0.01 mm.');
}
