// Reuse the existing validated thin-lens Gaussian image calculation.
// This computes conditional image kinematics only; PhyDemo still chooses
// actual finite-aperture ray intersections at each independent time sample.
import {predict} from './analysis.js';
export const LENS_MOTION_IMAGE_MODEL='ideal-thin-lens';
const method='conditional-paraxial-thin-lens';
const assumptions=[
 'A stationary vertical ideal thin lens with fixed nonzero focal length, one source to its left, and no intervening active optic.',
 'The Gaussian image assumes ideal paraxial lens mapping. Actual finite aperture, sampled emission and source position may fail to illuminate the image or lens.',
 'The lens image guide is calculated, never detected from PhyDemo rays.'
];
function imageState(status,value,reason=null){return {kind:'ideal-thin-lens-image',model:LENS_MOTION_IMAGE_MODEL,status,method,value,reason,assumptions};}
function velocityState(status,value,reason=null){return {kind:'ideal-thin-lens-image-velocity',model:LENS_MOTION_IMAGE_MODEL,status,method,value,reason,assumptions};}
export function analyzeMovingThinLens(scene,velocity){
 const src=scene.physics.components.find(c=>c.type==='point-source');
 const lens=scene.physics.components.find(c=>c.type==='ideal-lens');
 if(!src||!lens||scene.physics.model!=='ideal-thin-lens-geometric')throw Error('One validated thin-lens scene is required');
 const source=src.parameters,lp=lens.parameters;
 const objectDistance=lp.x-source.x,f=lp.focalLength;
 const predicted=predict(scene); // Existing strict lens ABCD calculation and numerical guard.
 if(predicted.kind==='at-infinity'){
  return {image:imageState('conditional',{imageKind:'at-infinity',imageDistance:null,
    imageHeight:null,magnification:null,unit:'mm'},'No finite Gaussian image at the focal plane.'),
   kinematics:velocityState('unavailable',null,'A finite instantaneous image velocity does not exist at a focal singularity.'),
   globalImageMm:null,globalImageVelocityMmPerSecond:null,method:'conditional-analytical',
   nativeImageDetection:false,assumptions};
 }
 const illConditioned=Math.abs(objectDistance-f)<=1e-8*Math.max(1,Math.abs(objectDistance),Math.abs(f));
 if(illConditioned){
  const reason='Near the focal plane; finite image position and velocity are numerically indeterminate.';
  return {image:imageState('numerically-indeterminate',null,reason),
   kinematics:velocityState('numerically-indeterminate',null,reason),
   globalImageMm:null,globalImageVelocityMmPerSecond:null,method:'conditional-analytical',
   nativeImageDetection:false,assumptions};
 }
 if(!['finite-real','finite-virtual'].includes(predicted.kind)){
  const reason=predicted.reason||'The validated ideal thin-lens calculation is unavailable.';
  return {image:imageState('unavailable',null,reason),kinematics:velocityState('unavailable',null,reason),
   globalImageMm:null,globalImageVelocityMmPerSecond:null,method:'conditional-analytical',
   nativeImageDetection:false,assumptions};
 }
 // u = lens.x - source.x; s' = f*u/(u-f), m=-s'/u.
 // With stationary lens du/dt = -vx, hence d(s')/dt = m^2 * vx,
 // d(m)/dt = -(m^2/f)*vx, and d(y')/dt = m*vy + y*d(m)/dt.
 // This is not the mirror's global axial velocity/sign convention.
 const m=predicted.magnification,imageVelocity={
  x:m*m*velocity.x,
  y:m*velocity.y-source.y*(m*m/f)*velocity.x
 };
 if(!Object.values(imageVelocity).every(Number.isFinite)){
  const reason='The ideal thin-lens image velocity exceeds finite numerical limits.';
  return {image:imageState('numerically-indeterminate',null,reason),
   kinematics:velocityState('numerically-indeterminate',null,reason),
   globalImageMm:null,globalImageVelocityMmPerSecond:null,method:'conditional-analytical',
   nativeImageDetection:false,assumptions};
 }
 return {
  image:imageState('conditional',{imageKind:predicted.kind,imageDistance:predicted.distance,
   imageHeight:predicted.y,magnification:m,unit:'mm'},null),
  kinematics:velocityState('conditional',{velocity:{axial:imageVelocity.x,transverse:imageVelocity.y},
   unit:'mm/s'},null),
  globalImageMm:{x:predicted.x,y:predicted.y},
  globalImageVelocityMmPerSecond:imageVelocity,
  method:'conditional-analytical',nativeImageDetection:false,assumptions
 };
}
