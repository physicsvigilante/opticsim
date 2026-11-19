// v18-only NECESSARY numerical qualification: observed native rays that
// could approach finite Aperture endpoints after a real refractive/reflective
// interaction. This NEVER computes a propagated hit, draws/reroutes a ray,
// modifies PhyDemo, or concludes whether a stop arm was actually encountered.
// A potential proximity WITHHOLDS measurements (conservative false positives
// are permitted), even when native PhyDemo reports simulationComplete.
// v1–v17 and v19–v21 are not modified by this observer.
import {FINITE_APERTURE_TYPE,APERTURE_CLEARANCE_MM,apertureGeometry} from './finite-aperture.js';
import {THICK_APERTURE_MODEL,THICK_APERTURE_VERSION} from './thick-lens-aperture-composition.js';
import {SPHERICAL_LENS_TYPE} from './spherical-lens.js';

export const V18_CORNER_GUARD_METHOD='v18-native-output-aperture-endpoint-proximity-v1';
export const V18_CORNER_NATIVE_STATE_LIMIT=10000;
const finite=Number.isFinite;

// Attach AFTER the ordinary native/source/mirror/interface observers. Wrap only
// instance-local methods, and call their prior delegate once, first. The new
// guard's audit logic cannot steer native geometry or change return objects.
export function observeNativeV18ApertureCorner(doc,scene,idMap,mirrorEndpoints){
 if(doc.schemaVersion!==THICK_APERTURE_VERSION||doc.physics.model!==THICK_APERTURE_MODEL)return null;
 const aperture=doc.physics.components.find(c=>c.type===FINITE_APERTURE_TYPE);
 if(!aperture)return {get errors(){return ['v18 aperture endpoint observer has no authored Aperture'];},
   get observation(){return {status:'unavailable',method:V18_CORNER_GUARD_METHOD};}};
 const g=apertureGeometry(aperture.parameters,mirrorEndpoints);
 const named=[['outer-p1',g.p1],['outer-p2',g.p2],['inner-p3',g.p3],['inner-p4',g.p4]];
 const points=named.map(([id,p])=>({id,x:p.x,y:-p.y})); // native y-down
 let checked=0,near=0,faults=0,first=null;
 function capture(ray,componentId){
  if(++checked>V18_CORNER_NATIVE_STATE_LIMIT){faults++;return;}
  const p=ray?.p1,q=ray?.p2;
  if(!p||!q||![p.x,p.y,q.x,q.y].every(finite)){faults++;return;}
  const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);
  if(!(len>1e-12&&finite(len))){faults++;return;}
  for(const corner of points){
   const vx=corner.x-p.x,vy=corner.y-p.y;
   const ahead=(vx*dx+vy*dy)/len;
   if(!(ahead>0))continue;
   const perpendicular=Math.abs(vx*dy-vy*dx)/len;
   if(!finite(perpendicular)){faults++;continue;}
   if(perpendicular<=APERTURE_CLEARANCE_MM){
    near++;
    first??={componentId,apertureEndpoint:corner.id,
      necessaryRayLineDistanceMm:perpendicular,forwardDistanceMm:ahead};
    // We have a sufficient reason to withhold the entire run's results.
    // Native will still be delegated for every later ray/interaction.
    break;
   }
  }
 }
 for(const component of doc.physics.components.filter(c=>
   c.type===SPHERICAL_LENS_TYPE||c.type==='plane-mirror')){
  const obj=scene.objs[idMap.get(component.id)];
  if(!obj||typeof obj.onRayIncident!=='function'){faults++;continue;}
  const nativeIncident=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const returned=nativeIncident.apply(this,args); // preserve real PhyDemo exactly
   try{
    if(!returned?.isAbsorbed)capture(args[0],component.id);
    if(returned?.newRays!==undefined){
     if(!Array.isArray(returned.newRays)){faults++;return returned;}
     for(const child of returned.newRays)capture(child,component.id);
    }
   }catch{faults++;} // audit failure must not mutate, throw, or reroute native rays
   return returned;
  };
 }
 return {
  get errors(){
   return [
    ...(near?[`${aperture.id}: observed native outgoing ray can pass within ${APERTURE_CLEARANCE_MM} mm of a finite aperture endpoint; v18 numerical corner classification is unqualified`]:[]),
    ...(faults?[`${aperture.id}: v18 native aperture corner observer could not examine all actual output ray states`]:[])
   ];
  },
  get observation(){return {method:V18_CORNER_GUARD_METHOD,
   status:near||faults?'withheld-uncertain':'no-proximity-observed',
   checkedNativeOutgoingRayStates:checked,
   nearApertureEndpointRayStates:near,
   auditFaults:faults,
   limit:V18_CORNER_NATIVE_STATE_LIMIT,
   guardDistanceMm:APERTURE_CLEARANCE_MM,
   firstPotentialProximity:first?structuredClone(first):null,
   nativeRayModified:false,
   tracedOrInferredImpact:false,
   conservativeQualificationOnly:true,
   legacyModelsUnchanged:true};}
 };
}
