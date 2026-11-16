// Bounded run-local, opt-in NONCERTIFYING v9 native Glass observation.
// No ray routing or numerical repair. Exact arithmetic happens only at
// terminal, never inside the native callback. No raw ray coordinates escape.
import {POLYGON_TYPE,polygonFaces} from './polygon-dielectric.js';
import {auditRecordedFiniteHit,FINITE_HIT_CAP} from './finite-hit-exact.js';
export const FINITE_DIAGNOSTIC_KIND='finite-hit-numerical-diagnostic';
export const FINITE_DIAGNOSTIC_METHOD='advisory-native-finite-hit-binary64-v1';
const object=x=>x!==null&&typeof x==='object';
const complete=new Set(['simulationComplete']);
export function supportsFiniteHitDiagnostic(doc){
 const components=doc?.physics?.components;
 return doc?.schemaVersion===9&&doc?.physics?.model==='polygon-dielectric-tracing'&&
  Array.isArray(components)&&components.filter(c=>c.type===POLYGON_TYPE).length===1&&
  components.filter(c=>c.type==='point-source').length>=1&&
  components.filter(c=>c.type==='point-source').length<=4&&
  components.filter(c=>c.type==='ray-detector').length<=2&&
  components.every(c=>[POLYGON_TYPE,'point-source','ray-detector'].includes(c.type))&&
  components.filter(c=>c.type==='point-source').every(c=>c.emission?.mode==='single-ray');
}
export function createNativeFiniteHitDiagnostic(doc,scene,idMap,requestedIds=[]){
 if(!requestedIds?.length||!supportsFiniteHitDiagnostic(doc))return null;
 const glass=doc.physics.components.find(c=>c.type===POLYGON_TYPE);
 if(requestedIds.some(id=>id!==glass.id))return null;
 const expected=new Map(doc.physics.components.map(c=>[c.id,{type:c.type,
   native:scene.objs[idMap.get(c.id)],method:c.type==='point-source'?'onSimulationStart':'onRayIncident'}]));
 if([...expected.values()].some(x=>!object(x.native)))return null;
 const faces=polygonFaces(glass.parameters);
 const installed=new Map(),starts=new Map(),emitted=new WeakSet();
 const snapshots=[];
 let incidents=0,overflow=false,invalid=false,finished=false,answer=null;
 const issue=()=>{invalid=true;};
 const result=(status,reasonCode,checked=0,unknown=0,conflicting=0)=>{
   return {status,reasonCode,method:FINITE_DIAGNOSTIC_METHOD,
     observedGlassIncidents:incidents,analyzedGlassIncidents:checked+unknown+conflicting,
     checked,unknown,conflicting,limit:FINITE_HIT_CAP,
     advisory:true,nativeMeasurementQualificationUnchanged:true};
 };
 return {
  register(id,type,native,handler,method){
   const ex=expected.get(id);
   if(!ex||ex.type!==type||ex.native!==native||ex.method!==method||
     installed.has(id)||typeof handler!=='function'||native[method]!==handler){issue();return;}
   installed.set(id,{native,handler,method});
  },
  sourceStarted(id,returned){
   try{
    starts.set(id,(starts.get(id)||0)+1);
    const ex=expected.get(id),rays=returned?.newRays;
    if(ex?.type!=='point-source'||starts.get(id)!==1||!Array.isArray(rays)||
       rays.length!==1||!object(rays[0])||emitted.has(rays[0])){issue();return;}
    emitted.add(rays[0]);
   }catch{issue();}
  },
  beforeIncident(id,ray,incident){
   // A malformed/bypassed callback must never prevent the original native
   // method from executing. Capture only scalar binary64 endpoint evidence.
   try{
    incidents++;
    if(!Number.isSafeInteger(incidents)){issue();return;}
    if(id!==glass.id||!object(ray)||!object(ray.p1)||!object(ray.p2)||!object(incident)){
     issue();return;
    }
    if(incidents>FINITE_HIT_CAP){overflow=true;return;}
    snapshots.push({p1:{x:ray.p1.x,y:ray.p1.y},
      p2:{x:ray.p2.x,y:ray.p2.y},
      incident:{x:incident.x,y:incident.y}});
   }catch{issue();}
  },
  finish({event,simulator,errors=[],warnings=[],sources,detectors,interfaces,scene}){
   if(finished)return answer;finished=true;
   if(!complete.has(event)||errors.length||simulator.totalTruncation!==0||
      simulator.totalUndefinedBehavior!==0)
     return answer=result('suppressed','NATIVE_RUN_NOT_COMPLETE');
   // Must be an actual fully installed source/interface/detector observer set.
   for(const [id,ex]of expected){
    const installedHandler=installed.get(id);
    if(!installedHandler||installedHandler.native!==ex.native||
      ex.native[ex.method]!==installedHandler.handler)issue();
    if(ex.type==='point-source'&&starts.get(id)!==1)issue();
   }
   if(installed.size!==expected.size)issue();
   const sourceMeter=sources?.byId||{},detectorMeter=detectors?.byId||{};
   for(const [id,ex]of expected){
    if(ex.type==='point-source'&&sourceMeter[id]?.emitted!==1)issue();
    if(ex.type==='ray-detector'&&(!Number.isInteger(detectorMeter[id]?.crossings)||
      !Number.isFinite(detectorMeter[id]?.signedPower)))issue();
   }
   if(interfaces?.byId?.[glass.id]?.interactions!==incidents)issue();
   if(invalid)return answer=result('unknown','NATIVE_CALLBACK_COVERAGE_UNAVAILABLE');
   if(overflow||snapshots.length!==incidents)
     return answer=result('unknown','FINITE_HIT_DIAGNOSTIC_CAP_EXCEEDED');
   // Never let a diagnostic arithmetic exception turn a completed native run
   // into a failed simulation or alter the underlying recorded measurements.
   let checked=0,unknown=0,conflicting=0,firstConflict=null,firstUnknown=null;
   const scale=scene?.lengthScale;
   const cutoffSquared=simulator.constructor.MIN_RAY_SEGMENT_LENGTH_SQUARED*
     (Number.isFinite(scale)?scale**2:NaN);
   for(const sample of snapshots){
    let outcome;
    try{outcome=auditRecordedFiniteHit(sample,faces,cutoffSquared);}
    catch{outcome={status:'unknown',reasonCode:'DIAGNOSTIC_ARITHMETIC_UNAVAILABLE'};}
    if(outcome.status==='inconsistent'){conflicting++;firstConflict??=outcome.reasonCode;}
    else if(outcome.status==='checked')checked++;
    else {unknown++;firstUnknown??=outcome.reasonCode;}
   }
   // Contradictory represented geometry is always visible as an ADVISORY,
   // even if other individual encounters have unavailable point bounds.
   if(conflicting)return answer=result('inconsistent',firstConflict,checked,unknown,conflicting);
   if(warnings.length)return answer=result('unknown','NATIVE_WARNINGS_NOT_CERTIFIED',checked,unknown,conflicting);
   if(unknown)return answer=result('unknown',firstUnknown,checked,unknown,conflicting);
   if(!incidents)return answer=result('checked-no-hit','NO_NATIVE_GLASS_INTERACTION_OBSERVED');
   // Only *exact* binary64 point equality can be checked without a validated
   // coordinate-error envelope; ordinary nonzero float error stays unknown.
   return answer=result('checked','EXACT_BINARY64_FINITE_HITS_MATCH',checked,unknown,conflicting);
  }
 };
}
