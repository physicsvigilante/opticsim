// Moving-source image analysis for the pre-existing canonical single ideal lens.
// Reuses the static ABCD prediction; never constructs ray routes or native rays.
import {predict} from './analysis.js';

export const THIN_LENS_MOTION_MODEL='ideal-thin-lens';
export function analyzeMovingThinLens(scene,velocity){
 const sources=scene.physics.components.filter(c=>c.type==='point-source'),
  lenses=scene.physics.components.filter(c=>c.type==='ideal-lens');
 if(scene.schemaVersion!==4||scene.physics.model!=='ideal-thin-lens-geometric'||
  sources.length!==1||lenses.length!==1||scene.physics.components.length!==2)
  throw Error('Moving thin lens requires a single canonical ideal lens and one point source');
 if(!velocity||![velocity.x,velocity.y].every(Number.isFinite))
  throw Error('A finite Cartesian source velocity in mm/s is required');
 const source=sources[0].parameters,lens=lenses[0].parameters;
 const p=predict(scene),u=lens.x-source.x,f=lens.focalLength,gap=u-f;
 if(p.kind==='unavailable')return {
  image:{status:'unavailable',model:THIN_LENS_MOTION_MODEL,reason:p.reason},
  kinematics:{status:'unavailable',model:THIN_LENS_MOTION_MODEL,reason:'Static lens image is unavailable'},
  globalImageMm:null,globalImageVelocityMmPerSecond:null
 };
 if(p.kind==='at-infinity'){
  // The static ABCD result uses a tolerance band. Only the exactly represented
  // single-lens focal condition establishes infinity. Other states in that
  // band remain unresolved: do not call them infinity or rescue finite values
  // with a second, less conservative formula. No static threshold is changed.
  if(gap!==0)return {
   image:{status:'numerically-indeterminate',model:THIN_LENS_MOTION_MODEL,
    reason:'Near the focal condition, inside the static ABCD resolution band; no finite image is qualified.',
    tolerance:p.tolerance},
   kinematics:{status:'numerically-indeterminate',model:THIN_LENS_MOTION_MODEL,
    reason:'No finite image velocity is qualified when image position is numerically unresolved.'},
   globalImageMm:null,globalImageVelocityMmPerSecond:null
  };
  return {
   image:{status:'conditional',model:THIN_LENS_MOTION_MODEL,value:{imageKind:'at-infinity',imageDistance:null,
    imageHeight:null,magnification:null},reason:'Image at infinity; no finite point can be plotted'},
   kinematics:{status:'unavailable',model:THIN_LENS_MOTION_MODEL,
    reason:'At the focal condition there is no finite image-point velocity'},
   globalImageMm:null,globalImageVelocityMmPerSecond:null
  };
 }
 if(!['finite-real','finite-virtual'].includes(p.kind))throw Error('Unsupported canonical lens image prediction');
 // Never upgrade an indeterminate ABCD result just because arithmetic is finite.
 const dvdt=(f/gap)**2*velocity.x,mdot=-(f/(gap*gap))*velocity.x;
 const dydt=p.magnification*velocity.y+source.y*mdot;
 if(![dvdt,dydt,mdot].every(Number.isFinite))return {
  image:{status:'conditional',model:THIN_LENS_MOTION_MODEL,value:{imageKind:p.kind,
   imageDistance:p.distance,imageHeight:p.y,magnification:p.magnification}},
  kinematics:{status:'numerically-indeterminate',model:THIN_LENS_MOTION_MODEL},
  globalImageMm:{x:p.x,y:p.y},globalImageVelocityMmPerSecond:null
 };
 return {
  image:{status:'conditional',model:THIN_LENS_MOTION_MODEL,
   value:{imageKind:p.kind,imageDistance:p.distance,imageHeight:p.y,magnification:p.magnification}},
  kinematics:{status:'conditional',model:THIN_LENS_MOTION_MODEL,
   value:{velocity:{axial:dvdt,transverse:dydt},magnificationDerivativePerSecond:mdot,
    meaning:'Global +x and +y; stationary ideal lens, fixed focal length, quasi-static image-point motion'}},
  globalImageMm:{x:p.x,y:p.y},globalImageVelocityMmPerSecond:{x:dvdt,y:dydt}
 };
}
