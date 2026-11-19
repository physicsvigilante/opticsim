// v25 BOUNDED native continuously graded dielectric, authoring candidate.
// Pinned native GrinGlass alone advances the ray via native Euler integration.
// This module is validation + fixed trusted numeric schema + READ-ONLY native
// qualification. No injected arbitrary LaTeX, prescribed route, native repair,
// physical-image detection or silent tolerance relaxation.
import {compositionCountsMatch} from './composition-profiles.js';

export const GRIN_V25_TYPE='graded-index-rectangle';
export const GRIN_V25_VERSION=25;
export const GRIN_V25_MODEL='native-bounded-grin-tracing';
export const GRIN_V25_PARAMETERS=Object.freeze([
 'leftX','axisY','spanX','upHeight','downHeight','indexSquaredAtAxis',
 'gradientLength','outsideIndex','partialReflection'
]);
export const GRIN_V25_POLICY=Object.freeze({
 stepSizeMm:.0025,maxRayDepth:1024,processedRayLimit:2048,
 rayDensity:.2,maxCallbacks:1024,maxDetectorHits:2,
 maxPathDeviationMm:.002,maxDetectorDeviationMm:.002
});
export const GRIN_V25_TRUSTED_LATEX='\\sqrt{1.5-y}'; // native relative y-down
const refuse=(fail,path,message)=>fail(path,message,'UNSUPPORTED_SCOPE');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const inRange=(x,a,b)=>finite(x)&&x>=a&&x<=b;
const inWorld=x=>finite(x)&&Math.abs(x)<=500;
export function grinV25Extents(p){
 return [{x:p.leftX,y:p.axisY+p.upHeight},
         {x:p.leftX+p.spanX,y:p.axisY+p.upHeight},
         {x:p.leftX+p.spanX,y:p.axisY-p.downHeight},
         {x:p.leftX,y:p.axisY-p.downHeight}];
}
export function compileGrinV25(component){
 const p=component.parameters,pts=grinV25Extents(p);
 return {type:'GrinGlass',
  path:pts.map(v=>({x:v.x,y:-v.y})),notDone:false,
  refIndexFn:GRIN_V25_TRUSTED_LATEX,
  absorptionFn:'0',plotFns:false,
  origin:{x:p.leftX,y:-p.axisY},
  stepSize:GRIN_V25_POLICY.stepSizeMm,
  intersectTol:1e-5,
  partialReflect:false};
}
export function grinV25ExactReference(components){
 const glass=components.find(c=>c.type===GRIN_V25_TYPE);
 const source=components.find(c=>c.type==='point-source');
 const detector=components.find(c=>c.type==='ray-detector');
 if(!glass||!source||!detector)return null;
 const p=glass.parameters,s=source.parameters,d=detector.parameters;
 const right=p.leftX+p.spanX;
 const travel=right-s.x;
 const A=p.indexSquaredAtAxis,L=p.gradientLength;
 const exitOffset=travel*travel/(4*A*L);
 const sinOutside=travel/(2*Math.sqrt(A)*L*p.outsideIndex);
 if(!Number.isFinite(sinOutside)||Math.abs(sinOutside)>=1)return null;
 const expectedDetectorY=p.axisY+exitOffset+
  (d.x-right)*sinOutside/Math.sqrt(1-sinOutside*sinOutside);
 return {rightX:right,travelMm:travel,
  exitPhysicalY:p.axisY+exitOffset,expectedDetectorY,
  sinOutside,sourceX:s.x,axisY:p.axisY,A,L};
}
export function validateGrinV25(components,model,rayDensity,endpoints,fail){
 const path='$.physics.components';
 if(model!==GRIN_V25_MODEL||!compositionCountsMatch(components,model,GRIN_V25_VERSION))
  refuse(fail,path,'v25 requires exactly one real single-ray point source, one bounded GRIN rectangle and one external passive ray detector; no other optics.');
 const glass=components.find(c=>c.type===GRIN_V25_TYPE);
 const p=glass.parameters;
 const gs=components.find(c=>c.type==='point-source'),s=gs.parameters;
 const detector=components.find(c=>c.type==='ray-detector'),d=detector.parameters;
 if(!inWorld(p.leftX)||!inWorld(p.axisY)||
   !inRange(p.spanX,.8,1)||!inRange(p.upHeight,.7,.9)||
   !inRange(p.downHeight,.2,.4)||p.indexSquaredAtAxis!==1.5||
   p.gradientLength!==1||p.outsideIndex!==1||p.partialReflection!==false||
   grinV25Extents(p).some(v=>!inWorld(v.x)||!inWorld(v.y)))
  refuse(fail,path,'v25 is a narrow finite rectangle, spanX 0.8-1 mm, upHeight 0.7-0.9 mm, downHeight 0.2-0.4 mm, field n²=1.5+(y-axisY)/1mm, outside index exactly 1 and Fresnel-off.');
 const minSquared=p.indexSquaredAtAxis-p.downHeight/p.gradientLength;
 const maxSquared=p.indexSquaredAtAxis+p.upHeight/p.gradientLength;
 if(minSquared<1.1||maxSquared>2.4)
  refuse(fail,path,'The complete graded region must keep real finite n>=sqrt(1.1) and <=sqrt(2.4).');
 if(gs.emission.mode!=='single-ray'||gs.emission.directionDeg!==0||
    s.y!==p.axisY||!inWorld(s.x)||
    s.x-p.leftX<.1-1e-12||s.x-p.leftX>.3+1e-12)
  refuse(fail,path,'The single native incident ray starts on the GRIN reference axis, horizontally rightward, 0.1-0.3 mm inside the left face.');
 if(![90,-90].includes(d.orientationDeg)||d.y!==p.axisY||
   !inRange(d.length,1.8,2.2)||!inWorld(d.x)||!inWorld(d.y)||
   d.x-(p.leftX+p.spanX)<.2-1e-12||
   d.x-(p.leftX+p.spanX)>.3+1e-12)
  refuse(fail,path,'One vertical centred passive detector must be 0.2-0.3 mm beyond the right face, length 1.8-2.2 mm.');
 const pts=endpoints(d);
 if(pts.some(v=>!inWorld(v.x)||!inWorld(v.y)))
  refuse(fail,path,'The entire detector must be in the bounded 500-mm coordinate domain.');
 const prediction=grinV25ExactReference(components);
 if(!prediction||prediction.sinOutside>.75||
   prediction.exitPhysicalY>p.axisY+p.upHeight-.1||
   Math.abs(prediction.expectedDetectorY-d.y)>d.length/2-.1)
  refuse(fail,path,'The stated horizontal inside-source configuration must have a finite noncritical exit and at least 0.1 mm detector/upper-surface clearance.');
 if(rayDensity!==GRIN_V25_POLICY.rayDensity)
  refuse(fail,'$.simulation.rayDensity','v25 numerical sampling must remain at the exact sealed medium preset.');
}
const finiteNativePoint=pt=>!!pt&&finite(pt.x)&&finite(pt.y);
function observedReferenceAtX(reference,x){
 return reference.axisY+((x-reference.sourceX)**2)/(4*reference.A*reference.L);
}
export function observeNativeGrinV25(doc,scene,idMap){
 if(doc?.schemaVersion!==GRIN_V25_VERSION||doc?.physics?.model!==GRIN_V25_MODEL)return null;
 const comps=doc.physics.components;
 const g=comps.find(c=>c.type===GRIN_V25_TYPE);
 const src=comps.find(c=>c.type==='point-source');
 const detector=comps.find(c=>c.type==='ray-detector');
 const reference=grinV25ExactReference(comps);
 const faults=[],records={callbacks:0,detectorCallbacks:0,sourceStarts:0,emitted:null,
  maxPathErrorMm:0,detectorErrorMm:null,firstNativeStep:null,lastNativeStep:null,
  firstDetectorHit:null,unexpectedBranches:0};
 const nativeG=scene?.objs?.[idMap?.get(g?.id)];
 const nativeS=scene?.objs?.[idMap?.get(src?.id)];
 const nativeD=scene?.objs?.[idMap?.get(detector?.id)];
 if(!reference||!nativeG||!nativeD||!nativeS||
    typeof nativeG.onRayIncident!=='function'||
    typeof nativeD.onRayIncident!=='function'||
    typeof nativeS.onSimulationStart!=='function'){
  faults.push('v25 GRIN numerical observer could not attach to all native objects');
  return {get errors(){return [...faults];},get observation(){return {status:'withheld-uncertain',method:'bounded-grin-v25-first-integral-native-witness',nativeImageDetected:false};}};
 }
 const priorS=nativeS.onSimulationStart;
 nativeS.onSimulationStart=function(...args){
  let ret;
  try{ret=priorS.apply(this,args);}
  catch(e){faults.push('Native source callback threw before GRIN audit');throw e;}
  try{
   records.sourceStarts++;
   records.emitted=ret?.newRays?.length??null;
   if(records.sourceStarts!==1||records.emitted!==1)
    faults.push('Unexpected native GRIN source emission count');
  }catch{faults.push('Uninspectable GRIN source emission');}
  return ret;
 };
 const priorG=nativeG.onRayIncident;
 nativeG.onRayIncident=function(...args){
  const point=args[2]&&{x:args[2].x,y:args[2].y};
  let ret;
  try{ret=priorG.apply(this,args);}
  catch(e){faults.push('Native GRIN incident callback threw');throw e;}
  try{
   records.callbacks++;
   if(records.callbacks>GRIN_V25_POLICY.maxCallbacks){
    if(records.callbacks===GRIN_V25_POLICY.maxCallbacks+1)faults.push('GRIN native callback audit capacity exceeded');
    return ret;
   }
   if(!finiteNativePoint(point)||!finiteNativePoint(args[0]?.p1)||
      !finiteNativePoint(args[0]?.p2)||ret?.isAbsorbed||ret?.isUndefinedBehavior){
    faults.push('Invalid or absorbed native GRIN ray state');
    return ret;
   }
   const out=ret?.newRays;
   if(out!==undefined&&(!Array.isArray(out)||out.length)){
    records.unexpectedBranches++;
    faults.push('Unexpected native GRIN partial/secondary ray branch');
   }
   const x=point.x,yPhysical=-point.y;
   if(x<reference.sourceX-.005||x>reference.rightX+.005||
      Math.abs(yPhysical-reference.axisY)>1.2){
    faults.push('Native GRIN callback left the bounded physical domain');
    return ret;
   }
   const err=Math.abs(yPhysical-observedReferenceAtX(reference,x));
   records.maxPathErrorMm=Math.max(records.maxPathErrorMm,err);
   if(err>GRIN_V25_POLICY.maxPathDeviationMm)
    faults.push('Native GRIN ray position exceeds bounded continuous-field witness tolerance');
   const event={xNative:x,yNative:point.y,physicalY:yPhysical,
    conditionalReferencePhysicalY:observedReferenceAtX(reference,x),errorMm:err};
   if(records.callbacks===1)records.firstNativeStep=event;
   records.lastNativeStep=event;
  }catch{faults.push('GRIN numerical audit could not inspect a native callback');}
  return ret;
 };
 const priorD=nativeD.onRayIncident;
 nativeD.onRayIncident=function(...args){
  const point=args[2]&&{x:args[2].x,y:args[2].y};
  let ret;
  try{ret=priorD.apply(this,args);}
  catch(e){faults.push('Native detector callback threw before GRIN qualification');throw e;}
  try{
   records.detectorCallbacks++;
   if(records.detectorCallbacks>GRIN_V25_POLICY.maxDetectorHits)
    faults.push('Excess GRIN detector hit callbacks');
   if(!finiteNativePoint(point)){
    faults.push('Uninspectable GRIN native detector hit');
   }else{
    const error=Math.abs(-point.y-reference.expectedDetectorY);
    records.detectorErrorMm=error;
    if(records.detectorCallbacks===1)records.firstDetectorHit=point;
    if(Math.abs(point.x-detector.parameters.x)>1e-7||
      error>GRIN_V25_POLICY.maxDetectorDeviationMm)
      faults.push('Native GRIN detector crossing exceeds continuous-field witness tolerance');
   }
  }catch{faults.push('GRIN detector audit could not inspect a native event');}
  return ret;
 };
 return {
  get errors(){
   return [...faults,
    ...(records.sourceStarts!==1||records.emitted!==1?['Missing qualified native GRIN source emission']:[]),
    ...(records.callbacks<10?['Insufficient observed native GRIN stepping callbacks']:[]),
    ...(records.detectorCallbacks!==1?['Missing or multiple native GRIN detector crossing']:[])
   ];
  },
  get observation(){
   const errs=this.errors;
   return {method:'bounded-grin-v25-first-integral-native-witness',
    status:errs.length?'withheld-uncertain':'within-bounded-observed-tolerance',
    declaredNumericalStepMm:GRIN_V25_POLICY.stepSizeMm,
    maxPathDeviationMm:GRIN_V25_POLICY.maxPathDeviationMm,
    maxDetectorDeviationMm:GRIN_V25_POLICY.maxDetectorDeviationMm,
    certifiedGlobalErrorBound:false,
    nativeImageDetected:false,
    originalJeeJ09Solved:false,
    observedNativeCallbacks:records.callbacks,
    observedNativeSourceStarts:records.sourceStarts,
    observedNativeEmitted:records.emitted,
    observedNativeDetectorCalls:records.detectorCallbacks,
    observedMaxPathErrorMm:records.maxPathErrorMm,
    observedDetectorErrorMm:records.detectorErrorMm,
    actualNativeDetectorPoint:records.firstDetectorHit,
    firstNativeStep:records.firstNativeStep,lastNativeStep:records.lastNativeStep,
    conditionalAnalyticalDetectorY:reference.expectedDetectorY,
    unexpectedBranches:records.unexpectedBranches,
    nativeRayModified:false,
    qualificationOnly:true};
  }
 };
}
export function grinV25Capabilities(){
 return {schemaVersion:GRIN_V25_VERSION,model:GRIN_V25_MODEL,type:GRIN_V25_TYPE,
  indexFamily:'native n(y)^2=1.5+(y-axisY)/(1 mm), no arbitrary LaTeX',
  numericalPolicy:{...GRIN_V25_POLICY},source:'one horizontal SingleRay inside rectangular GRIN region',
  requiredPhysicalParameters:[...GRIN_V25_PARAMETERS],detector:'one external vertical real passive detector',
  limitations:[
   'Only a narrow, fixed physically positive square-root index function, not general GRIN or original grazing J09.',
   'The independent continuous-field first integral qualifies only this stated horizontal inside-source branch.',
   'Euler ray snapshots and detector residuals are numerical witness tests, not globally certified error bounds.',
   'Any native callback fault, path mismatch, extra hit or incomplete run withholds all qualified measurements.',
   'No source interpretation, physical image, radiometry, diffraction, arbitrary mixing or unobserved native path is certified.'
  ]};
}
