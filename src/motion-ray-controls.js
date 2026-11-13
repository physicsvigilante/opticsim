// Reuse the canonical ray/source controls for a hash-bound motion experiment.
// These are explicit scene revisions, never visual-only brightness multipliers.
import {validate,setSourceMode,SAMPLING_PRESETS,samplingPreset} from './contract.js';
import {isCurved} from './curved-mirrors.js';
import {recordQualifiedEdit,createQualifiedBundle} from './qualification.js';
import {prepareMotionExperiment,createMotionExperiment} from './source-motion.js';

export const MOTION_RAY_CONTROL_FIELDS=Object.freeze([
 'brightness','densityPreset','rayDensity','emissionMode','directionDeg',
 'angleDeg','maxRayDepth','processedRayLimit','presentationMode','grid',
 'mirrorApertureHeightMm'
]);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const finite=(v,low,high,name)=>{
 if(typeof v!=='number'||!Number.isFinite(v)||v<low||v>high)throw Error(
  name+' must be a finite number between '+low+' and '+high);
};
const integer=(v,low,high,name)=>{
 finite(v,low,high,name);if(!Number.isInteger(v))throw Error(name+' must be an integer');
};
const sourceOf=scene=>{
 const sources=scene.physics.components.filter(c=>c.type==='point-source');
 if(sources.length!==1||!((scene.schemaVersion===6&&scene.physics.model==='curved-mirror-tracing')||
   (scene.schemaVersion===4&&scene.physics.model==='ideal-thin-lens-geometric')))
  throw Error('Motion source controls require one accepted single-source mirror or lens scene');
 return sources[0];
};
const opticOf=scene=>{
 const optics=scene.physics.components.filter(c=>isCurved(c.type)||c.type==='ideal-lens');
 if(optics.length!==1)throw Error('Motion aperture control needs exactly one optical element');
 return optics[0];
};
export function motionRayControls(scene){
 validate(scene);
 const source=sourceOf(scene),mirror=opticOf(scene),p=source.parameters,emission=source.emission,s=scene.simulation;
 return {sourceId:source.id,brightness:p.brightness,densityPreset:samplingPreset(s.rayDensity),
  rayDensity:s.rayDensity,emissionMode:emission.mode,directionDeg:emission.directionDeg,
  angleDeg:emission.angleDeg,maxRayDepth:s.maxRayDepth,processedRayLimit:s.processedRayLimit,
  presentationMode:scene.presentation.mode,grid:scene.presentation.grid,
  mirrorId:mirror.id,mirrorType:mirror.type,
  mirrorApertureHeightMm:mirror.parameters.apertureHeight};
}
export function motionRayControlCapabilities(){
 return {fields:[...MOTION_RAY_CONTROL_FIELDS],
  samplingPresets:{...SAMPLING_PRESETS},
  brightness:{min:0.01,max:1},rayDensity:{min:SAMPLING_PRESETS.sparse,max:1},
  mirrorApertureHeightMm:{min:1,max:10000,unit:'mm',
   note:'The existing circular-arc and whole-motion geometry validators can impose stricter limits.'},
  directionDeg:{min:-180,max:180},angleDeg:{min:1,max:180},
  sourceModes:['full-circle','directional','single-ray'],
  nativeLimits:{maxRayDepth:{min:0,max:8},processedRayLimit:{min:1,max:10000}},
  presentationModes:['rays','extended'],
  meaning:'Brightness, source emission and physical optical aperture are optical properties; sampling and limits change native numerical rays; ray/extended mode and grid are presentation. None is a native image detector.',
  provenance:'Each accepted edit creates a new qualified baseline and SHA-bound motion experiment. Original author input and prior edits remain preserved.'};
}
export function editMotionRayScene(scene,change){
 validate(scene);
 if(!change||typeof change!=='object'||Array.isArray(change)||!Object.keys(change).length||
   Object.keys(change).some(k=>!MOTION_RAY_CONTROL_FIELDS.includes(k)))
  throw Error('Expected one or more supported existing ray-control fields');
 if(own(change,'densityPreset')&&own(change,'rayDensity'))
  throw Error('Choose a density preset or an explicit custom density, not both');
 const prev=sourceOf(scene),mirror=opticOf(scene),previousMode=prev.emission.mode;
 if(own(change,'brightness'))finite(change.brightness,0.01,1,'Source brightness');
 if(own(change,'mirrorApertureHeightMm'))finite(change.mirrorApertureHeightMm,1,10000,'Mirror aperture height (mm)');
 if(own(change,'rayDensity'))finite(change.rayDensity,SAMPLING_PRESETS.sparse,1,'Native ray density');
 if(own(change,'densityPreset')&&!own(SAMPLING_PRESETS,change.densityPreset))
  throw Error('Unsupported native ray-density preset');
 if(own(change,'directionDeg'))finite(change.directionDeg,-180,180,'Emission direction');
 if(own(change,'angleDeg'))finite(change.angleDeg,1,180,'Directional cone opening');
 if(own(change,'maxRayDepth'))integer(change.maxRayDepth,0,8,'Maximum native ray depth');
 if(own(change,'processedRayLimit'))integer(change.processedRayLimit,1,10000,'Native segment limit');
 if(own(change,'emissionMode')&&!(scene.schemaVersion===6?['full-circle','directional','single-ray']:['full-circle','directional']).includes(change.emissionMode))
  throw Error('Unsupported native source emission mode');
 if(previousMode==='full-circle'&&change.emissionMode==='single-ray'&&!own(change,'directionDeg'))
  throw Error('Switching from full circle to one ray requires an explicitly supplied direction');
 if(own(change,'presentationMode')&&!['rays','extended'].includes(change.presentationMode))
  throw Error('Unsupported native presentation mode');
 if(own(change,'grid')&&typeof change.grid!=='boolean')throw Error('Grid must be boolean');

 let next=structuredClone(scene);
 if(own(change,'emissionMode')&&change.emissionMode!==previousMode)
  next=setSourceMode(next,prev.id,change.emissionMode);
 const src=sourceOf(next);
 if(own(change,'brightness'))src.parameters.brightness=change.brightness;
 if(own(change,'directionDeg'))src.emission.directionDeg=change.directionDeg;
 if(own(change,'angleDeg'))src.emission.angleDeg=change.angleDeg;
 if(own(change,'densityPreset'))next.simulation.rayDensity=SAMPLING_PRESETS[change.densityPreset];
 if(own(change,'rayDensity'))next.simulation.rayDensity=change.rayDensity;
 if(own(change,'maxRayDepth'))next.simulation.maxRayDepth=change.maxRayDepth;
 if(own(change,'processedRayLimit'))next.simulation.processedRayLimit=change.processedRayLimit;
 if(own(change,'presentationMode'))next.presentation.mode=change.presentationMode;
 if(own(change,'grid'))next.presentation.grid=change.grid;
 if(own(change,'mirrorApertureHeightMm')){
  const curved=next.physics.components.find(c=>c.id===mirror.id);
  curved.parameters.apertureHeight=change.mirrorApertureHeightMm;
 }
 return validate(next);
}
export async function reviseMotionRayExperiment(experiment,change){
 // UI/LLM callers retain ownership of their request; async hashing must not
 // let a later mutation alter the edit that is being accepted.
 const requestedChange=structuredClone(change);
 const base=await prepareMotionExperiment(experiment);
 const oldPackage=base.exportExperiment(),oldScene=oldPackage.baseline.scene;
 const newScene=editMotionRayScene(oldScene,requestedChange);
 const prior=oldPackage.baseline;
 const qualification=recordQualifiedEdit(oldScene,newScene,prior.qualification);
 // A scene containing an explicit physical or sampling edit must never be
 // exported with the old original hash and without a change record.
 const baseline=await createQualifiedBundle(newScene,qualification,prior.observables);
 return createMotionExperiment(baseline,oldPackage.motion);
}
