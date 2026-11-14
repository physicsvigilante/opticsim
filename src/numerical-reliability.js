// Bounded native numerical DIAGNOSTIC, not a repaired canonical simulation.
// The only native difference is PhyDemo's documented scene.colorMode.
// It controls the native weak-ray cutoff as well as appearance; never report
// the variant as if the original native default completed.
import {validate,serializeSave} from './contract.js';
export const NATIVE_REPLAY_MODES=Object.freeze({
  default:Object.freeze({nativeColorMode:'default',weakReflectedRayCutoff:0.01}),
  linear:Object.freeze({nativeColorMode:'linear',weakReflectedRayCutoff:0.000001})
});
export function numericalTraceFindings(doc,trace){
  const findings=[],interfaces=new Map(doc.physics.components
    .filter(c=>c.type==='planar-interface').map(c=>[c.id,c.parameters]));
  // Diagnostic tolerances do NOT decide physical intersections, refract rays,
  // change solver precision or authorize requested measurements.
  // The upstream simulator processes pending-ray slots in rounds. Interface
  // callbacks from different slots can be interleaved, so neighboring trace
  // entries are NOT necessarily successive interactions of one native ray.
  const previousBySlot=new Map();
  for(let i=0;i<trace.length;i++){
    const next=trace[i];
    if(!Number.isSafeInteger(next.rayIndex)||next.rayIndex<0)continue;
    const prior=previousBySlot.get(next.rayIndex);
    previousBySlot.set(next.rayIndex,{event:next,index:i});
    if(!prior)continue;
    const {event:prev,index:prevIndex}=prior,p=interfaces.get(next.interfaceId);
    if(!p||prev.interfaceId!==next.interfaceId||!Number.isFinite(next.incidentDistanceMm))continue;
    // The same slot can only be called a rehit when this segment starts
    // where its previous native interface encounter ended (within a
    // diagnostic tolerance, not an intersection/solver tolerance).
    const continuity=prev.incidentPoint&&next.rayStart?
      Math.hypot(prev.incidentPoint.x-next.rayStart.x,
        prev.incidentPoint.y-next.rayStart.y):Infinity;
    if(!Number.isFinite(continuity)||continuity>.001)continue;
    const a=p.normalDeg*Math.PI/180,n={x:Math.cos(a),y:Math.sin(a)};
    const d=prev.outgoingPrimaryDirection;
    const projection=d?Math.abs(d.x*n.x+d.y*n.y):Infinity;
    if(next.incidentDistanceMm<.001&&projection<1e-5){
      findings.push({code:'NEAR_TANGENT_SAME_INTERFACE_REHIT',level:'diagnostic',
        interfaceId:next.interfaceId,rayIndex:next.rayIndex,
        traceIndices:[prevIndex,i],incidentDistanceMm:next.incidentDistanceMm,
        precedingOutgoingNormalProjection:projection,
        meaning:'The same native pending-ray slot re-intersected its previous boundary after a microscopic near-tangent step. This suggests a numerical grazing ambiguity, not a validated second physical event.'});
      break;
    }
  }
  const far=trace.findIndex(e=>e.incidentPoint&&
    Math.max(Math.abs(e.incidentPoint.x),Math.abs(e.incidentPoint.y))>1e8);
  if(far>=0)findings.push({code:'EXTREME_GRAZING_TRAVEL',level:'diagnostic',
    traceIndex:far,interfaceId:trace[far].interfaceId,
    incidentPoint:trace[far].incidentPoint,
    meaning:'A native ray reached a boundary at extremely large coordinates. Infinite interfaces permit this, but the ray is numerically ill-conditioned for a bounded scene.'});
  return findings;
}
export function nativeNumericalReplay(doc,core,mode='default'){
  validate(doc);
  if(!Object.hasOwn(NATIVE_REPLAY_MODES,mode))throw Error('Unsupported native numerical replay mode');
  if(doc.schemaVersion!==5||doc.physics.model!=='planar-media-tracing')
    throw Error('Native color-mode comparison is currently scoped to v5 planar media only');
  if(!core||typeof core.loadDocument!=='function'||typeof core.Simulator!=='function')
    throw Error('A pinned built native core is required');
  // Never mutate the authored document or its canonical numerical settings.
  const original=serializeSave(doc),loaded=core.loadDocument(structuredClone(doc));
  if(loaded.scene.colorMode!=='default')throw Error('Unexpected native scene default; re-audit upstream pin');
  loaded.scene.colorMode=NATIVE_REPLAY_MODES[mode].nativeColorMode;
  const emission=core.observeSourceSet(doc,loaded.scene,loaded.idMap);
  const mirror=core.observeMirrorSet(doc,loaded.scene,loaded.idMap);
  const detector=core.observeDetectorSet(doc,loaded.scene,loaded.idMap);
  const interfaces=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
  // Bounded, read-only native incident trace to localize exact-critical
  // numerical loops. No source attribution, ray reinsertion or path steering.
  const trace=[],traceLimit=32;let tracedEvents=0;
  const dir=ray=>{
    if(!ray?.p1||!ray?.p2)return null;
    const x=ray.p2.x-ray.p1.x,y=-(ray.p2.y-ray.p1.y),len=Math.hypot(x,y);
    return len>0&&Number.isFinite(len)?{x:x/len,y:y/len}:null;
  };
  const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:-p.y}:null;
  for(const component of doc.physics.components.filter(c=>c.type==='planar-interface')){
    const obj=loaded.scene.objs[loaded.idMap.get(component.id)],originalIncident=obj.onRayIncident;
    obj.onRayIncident=function(...args){
      const ray=args[0],hit=args[2],incident=dir(ray),start=point(ray.p1),location=point(hit),depth=ray.depth;
      const distance=location&&start?Math.hypot(location.x-start.x,location.y-start.y):null;
      // The prior observer and the pinned native interaction are invoked only
      // once, with the same arguments, return value and mutated ray.
      const outcome=originalIncident.apply(this,args);
      tracedEvents++;
      if(trace.length<traceLimit)trace.push({
        interfaceId:component.id,rayIndex:args[1],depth:depth??null,
        rayStart:start,incidentPoint:location,incidentDistanceMm:distance,
        incomingDirection:incident,outgoingPrimaryDirection:dir(ray),
        newRayCount:outcome?.newRays?.length??0,
        truncation:outcome?.truncation??0,
        absorbed:!!outcome?.isAbsorbed,undefinedBehavior:!!outcome?.isUndefinedBehavior,
        nativeReturnedUndefined:outcome===undefined
      });
      return outcome;
    };
  }
  const simulator=new core.Simulator(loaded.scene,null,null,null,null,null,false,
    doc.simulation.processedRayLimit);
  let event=null;
  for(const name of ['simulationComplete','simulationStop']){
    simulator.on(name,()=>{event=name;});
  }
  simulator.updateSimulation();
  const diagnostics=core.diagnostics(loaded.scene,simulator,emission,mirror,detector,interfaces);
  const status=event?core.classifyRun(event,diagnostics):'no-completion-event';
  const complete=['completed','completed-with-warnings'].includes(status);
  if(serializeSave(doc)!==original)throw Error('Numerical replay mutated the canonical scene');
  const nativeScene=JSON.parse(loaded.scene.toJSON());
  if((nativeScene.colorMode??'default')!==mode)throw Error('Native replay mode did not survive serialization');
  return {
    format:'opticsim-native-numerical-replay-v1',
    mode,upstreamColorMode:mode,
    nativeWeakBranchThreshold:NATIVE_REPLAY_MODES[mode].weakReflectedRayCutoff,
    scope:'headless v5 native-planar diagnostic only; not canonical scene execution',
    alteredNativeProperties:['colorMode'],
    canonicalDocument:structuredClone(doc),
    nativeSceneColorMode:nativeScene.colorMode??'default',
    numericalFindings:numericalTraceFindings(doc,trace),
    status,complete,
    diagnostic:{
      nativeEvent:event,
      // These MAY be partial! Never expose as requested final measurements
      // without completion and current matching native execution evidence.
      ...diagnostics,
      interactionTrace:{coordinateConvention:'x-right-y-up',maxEvents:traceLimit,
        totalEvents:tracedEvents,eventsOmitted:tracedEvents-trace.length,
        entries:trace}
    },
    observations:complete?{
      emissionsById:diagnostics.emissionsById,
      reflectionsById:diagnostics.reflectionsById,
      detectorsById:diagnostics.detectorsById,
      interfacesById:diagnostics.interfacesById
    }:null,
    interpretation:'not-assessed-by-engine',
    questionSupport:'not-assessed-by-engine'
  };
}
