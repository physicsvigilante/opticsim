import {IMMERSED_ARC_VERSION,immersedArcPortAudit} from './immersed-arc-plane-port.js';
import {GENERAL_BENCH_VERSION,installGeneralBenchEndpointAudit} from './native-general-optical-bench.js';
import {MIRROR_BOX_VERSION,mirrorBoxAudit} from './native-mirror-box.js';
import {GUIDE_FAN_VERSION,guideFanAudit} from './finite-guide-fan.js';
import {CAP_TYPE,CAP_VERSION,compileCircularCap,capNativeAudit} from './finite-circular-cap.js';
import {slabArcReturnAudit} from './slab-arc-return.js';
import {curvedEntryBeamAudit} from './curved-entry-beam.js';
import {installRefractiveFanAudit} from './refractive-fan.js';
import {installPostLensAudit} from './native-post-lens-audit.js';
import {compilePrism,PRISM_TYPE} from './triangular-prism.js';
import {PARALLEL_BEAM_TYPE,compileParallelBeam} from './parallel-beam.js';
import {compilePolygon,POLYGON_TYPE} from './polygon-dielectric.js';
import {compileCircular} from './circular-dielectric.js';
import {SEMICIRCULAR_TYPE,compileSemicircular} from './semicircular-dielectric.js';
import {SPHERICAL_LENS_TYPE,compileSphericalLens} from './spherical-lens.js';
import {GRIN_SLAB_VERSION,compileEnteringGradedSlab,enteringGradedSlabAudit} from './native-entering-graded-slab.js';
import {GRIN_V25_TYPE,compileGrinV25,observeNativeGrinV25} from './native-grin-v25.js';
export {observeNativeGrinV25};
import {observeNativeV18ApertureCorner as nativeV18CornerObserver} from './native-v18-aperture-corner-guard.js';
import {installV27EndpointAudit} from './native-v27-endpoint-audit.js';
import {BEAM_TWO_PLANE_MIRROR_VERSION} from './native-beam-two-plane-mirror-v27.js';
const endpointAudits = new WeakMap();
import {CIRCLE_BLOCKER_TYPE,compileCircleBlocker} from './opaque-circle-blocker.js';
import {FINITE_APERTURE_TYPE,compileFiniteAperture} from './finite-aperture.js';
import {compileCurved,isCurved} from './curved-mirrors.js';
import Scene from '../vendor/ray-optics/src/core/Scene.js';
import Simulator from '../vendor/ray-optics/src/core/Simulator.js';
import i18next from '../vendor/ray-optics/node_modules/i18next/dist/esm/i18next.js';
import en from '../vendor/ray-optics/locales/en/simulator.json';
import { validate, mirrorEndpoints } from './contract.js';
i18next.init({ lng: 'en', resources: { en: { simulator: en } }, initImmediate: false, interpolation: { escapeValue: false } });
import {compileInterface,observeInterfaceSet} from './planar-media.js';
export {observeInterfaceSet};
// Strict v18-only runtime qualification. Never changes pinned native rays.
export function observeNativeV18ApertureCorner(doc,scene,idMap){
  return nativeV18CornerObserver(doc,scene,idMap,mirrorEndpoints);
}
const compilers = {
  [PARALLEL_BEAM_TYPE]:compileParallelBeam,
  'circular-dielectric':compileCircular,[SEMICIRCULAR_TYPE]:compileSemicircular,[CAP_TYPE]:compileCircularCap,[PRISM_TYPE]:compilePrism,[POLYGON_TYPE]:compilePolygon,
  [SPHERICAL_LENS_TYPE]:compileSphericalLens,[GRIN_V25_TYPE]:(c,doc)=>doc.schemaVersion===GRIN_SLAB_VERSION?compileEnteringGradedSlab(c):compileGrinV25(c),
  [CIRCLE_BLOCKER_TYPE]:compileCircleBlocker,
  [FINITE_APERTURE_TYPE]:c=>compileFiniteAperture(c,mirrorEndpoints),
  'ideal-curved-mirror':compileCurved,'circular-arc-mirror':compileCurved,
  'planar-interface':compileInterface,
  'point-source': c => {
    const { x, y, brightness } = c.parameters;
    if(c.emission.mode==='single-ray'){const a=c.emission.directionDeg*Math.PI/180;return {type:'SingleRay',p1:{x,y:-y},p2:{x:x+20*Math.cos(a),y:-y-20*Math.sin(a)},brightness};}
    if (c.emission.mode === 'full-circle') return { type: 'PointSource', x, y: -y, brightness };
    const theta = c.emission.directionDeg * Math.PI / 180;
    return { type: 'AngleSource', p1: { x, y: -y },
      p2: { x: x + 20 * Math.cos(theta), y: -y - 20 * Math.sin(theta) },
      brightness, emisAngle: c.emission.angleDeg, symmetric: true };
  },
  'ideal-lens': c => ({ type: 'IdealLens',
    p1: { x: c.parameters.x, y: -(c.parameters.y ?? 0) - c.parameters.apertureHeight / 2 },
    p2: { x: c.parameters.x, y: -(c.parameters.y ?? 0) + c.parameters.apertureHeight / 2 },
    focalLength: c.parameters.focalLength }),
  'line-blocker': c => {
    const [a,b]=mirrorEndpoints(c.parameters);
    return {type:'Blocker',p1:{x:a.x,y:-a.y},p2:{x:b.x,y:-b.y},filter:false};
  },
  'plane-mirror': c => {
    const [a, b] = mirrorEndpoints(c.parameters);
    return { type: 'Mirror', p1: { x: a.x, y: -a.y }, p2: { x: b.x, y: -b.y }, filter: false };
  },
  'ray-detector': c => {
    const [a, b] = mirrorEndpoints(c.parameters);
    return { type: 'Detector', p1: { x: a.x, y: -a.y },
      p2: { x: b.x, y: -b.y }, irradMap: false };
  }
};
export function compile(doc, width = 1200, height = 700) {
  validate(doc);
  const { view } = doc.presentation;
  return { idMap: new Map(doc.physics.components.map((c, i) => [c.id, i])),
    native: { version: 5, name: doc.presentation.title, objs: doc.physics.components.map(c => compilers[c.type](c, doc)),
      // Pinned Scene.loadJSON uses viewport sizes rounded UP to 100 CSS pixels.
      // Match its serialization convention to prevent an unintended scale/origin
      // adjustment; the camera origin still uses the actual canvas dimensions.
      width: Math.ceil(width / 100) * 100, height: Math.ceil(height / 100) * 100,
      scale: view.zoom, origin: { x: width / 2 - view.x * view.zoom, y: height / 2 + view.y * view.zoom },
      mode: doc.presentation.mode, showGrid: doc.presentation.grid, gridSize: 50,
      lockObjs: true, rayModeDensity: doc.simulation.rayDensity, maxRayDepth: doc.simulation.maxRayDepth,
      simulateColors: false, colorMode: 'default', lengthScale: 1 } };
}
export function loadNative(native, width = native.width || 1200, height = native.height || 700) {
  const scene = new Scene();
  scene.setViewportSize(width, height);
  let completed = false;
  scene.loadJSON(JSON.stringify(native), (_, done) => { completed = done; });
  if (!completed || scene.error) throw Error(scene.error || 'Native scene did not load synchronously');
  return scene;
}
export function loadDocument(doc, width, height) {
  const compiled = compile(doc, width, height);
  const scene = loadNative(compiled.native, width, height);
  if (doc.schemaVersion===BEAM_TWO_PLANE_MIRROR_VERSION)
    endpointAudits.set(scene,{key:'v27EndpointsVerified',finish:installV27EndpointAudit(doc,scene,compiled.idMap)});
  if(doc.schemaVersion===28)
    endpointAudits.set(scene,{key:'v28EndpointsVerified',finish:installPostLensAudit(doc,scene,compiled.idMap)});
  if(doc.schemaVersion===IMMERSED_ARC_VERSION) endpointAudits.set(scene,immersedArcPortAudit(doc,scene,compiled.idMap));
  if(doc.schemaVersion===MIRROR_BOX_VERSION) endpointAudits.set(scene,mirrorBoxAudit(doc,scene,compiled.idMap,mirrorEndpoints));
  if(doc.schemaVersion===GUIDE_FAN_VERSION) endpointAudits.set(scene,guideFanAudit(doc,scene,compiled.idMap));
  if(doc.schemaVersion===GRIN_SLAB_VERSION) endpointAudits.set(scene,enteringGradedSlabAudit(doc,scene,compiled.idMap));
  if(doc.schemaVersion===CAP_VERSION) endpointAudits.set(scene,capNativeAudit(doc,scene,compiled.idMap));
  if(doc.schemaVersion===31) endpointAudits.set(scene,slabArcReturnAudit(doc,scene,compiled.idMap));
  if(doc.schemaVersion===30) endpointAudits.set(scene,curvedEntryBeamAudit(doc,scene,compiled.idMap));
  if(doc.schemaVersion===29)
    endpointAudits.set(scene,{key:'v29FanVerified',finish:installRefractiveFanAudit(doc,scene,compiled.idMap)});
  if(doc.schemaVersion===GENERAL_BENCH_VERSION)
    endpointAudits.set(scene,installGeneralBenchEndpointAudit(doc,scene,compiled.idMap,mirrorEndpoints));
  return { ...compiled, scene };
}
export function nativeExport(doc) { return loadDocument(doc).scene.toJSON(); }
// Instance-local observation only: one native call, same return value and rays.
// No tracing, resampling, or source prototype/upstream modification.
export function observeSourceEmission(source,{parentage=null,finiteDiagnostic=null,sourceId=null,sourceType='point-source'}={}) {
  const meter = { emitted: null, brightnessScale: null };
  const nativeStart = source.onSimulationStart;
  source.onSimulationStart = function (...args) {
    const result = nativeStart.apply(this, args);
    meter.emitted = result?.newRays?.length || 0;
    meter.brightnessScale = result?.brightnessScale ?? null;
    parentage?.sourceStarted(sourceId,result);
    try{finiteDiagnostic?.sourceStarted(sourceId,result);}catch{reportAuditFault(finiteDiagnostic);}
    return result;
  };
  if(parentage)parentage.register(sourceId,sourceType,source,source.onSimulationStart,'onSimulationStart');
  try{finiteDiagnostic?.register(sourceId,sourceType,source,source.onSimulationStart,'onSimulationStart');}
  catch{reportAuditFault(finiteDiagnostic);}
  return meter;
}
// Wrap each authored source once; no ray provenance is assigned after emission.
// Stable-ID counts describe actual PhyDemo sampling, never detector attribution.
export function observeSourceSet(doc, scene, idMap,{parentage=null,finiteDiagnostic=null}={}) {
  const entries=doc.physics.components.filter(c=>c.type==='point-source'||c.type===PARALLEL_BEAM_TYPE)
    .map(c=>[c.id,observeSourceEmission(scene.objs[idMap.get(c.id)],{parentage,finiteDiagnostic,sourceId:c.id,sourceType:c.type})]);
  return {
    get emitted() {
      return entries.some(([,meter])=>meter.emitted===null) ? null :
        entries.reduce((sum,[,meter])=>sum+meter.emitted,0);
    },
    get brightnessScale() {
      return entries.length===1 ? entries[0][1].brightnessScale : null;
    },
    get byId() {
      return Object.fromEntries(entries.map(([id,meter])=>[
        id,{emitted:meter.emitted,brightnessScale:meter.brightnessScale}
      ]));
    }
  };
}
export function observeMirrorReflections(mirror) {
  const meter = { reflections: 0 };
  const nativeIncident = mirror.onRayIncident;
  mirror.onRayIncident = function (...args) {
    const result = nativeIncident.apply(this, args);
    meter.reflections++;
    return result;
  };
  return meter;
}
// Attach to every native mirror, preserving stable authored IDs and physical
// object order. The old single-mirror observer remains available for callers.
export function observeMirrorSet(doc, scene, idMap) {
  const entries = doc.physics.components.filter(c=>c.type==='plane-mirror'||isCurved(c.type))
    .map(c=>[c.id,observeMirrorReflections(scene.objs[idMap.get(c.id)])]);
  if(!entries.length)return null;
  return {
    get reflections() {return entries.reduce((n,[,meter])=>n+meter.reflections,0);},
    get byId() {return Object.fromEntries(entries.map(([id,meter])=>[id,meter.reflections]));}
  };
}
// Native incident events are sampled, NOT an inferred source/ray history.
// The existing byId count/power projection stays byte-for-byte unchanged.
export const DETECTOR_HIT_EVENT_LIMIT=32;
const DETECTOR_HIT_RESIDUAL_MM=1e-5;
const DETECTOR_HIT_ENDPOINT_MM=.01;
const reportAuditFault=d=>{try{d?.captureFault?.();}catch{/* Never affect native propagation. */}};
function nativeDetectorHit(ray,incidentPoint,segment){
  const {a,b,length,dx,dy}=segment;
  if(!ray?.p1||!ray?.p2||!incidentPoint||
    !Number.isFinite(incidentPoint.x)||!Number.isFinite(incidentPoint.y))return null;
  const vx=ray.p2.x-ray.p1.x,vy=ray.p2.y-ray.p1.y,travel=Math.hypot(vx,vy);
  if(!(travel>0&&Number.isFinite(travel)))return null;
  const x=incidentPoint.x,y=-incidentPoint.y;
  const along=((x-a.x)*dx+(y-a.y)*dy)/length;
  const deviation=Math.abs((x-a.x)*dy-(y-a.y)*dx)/length;
  // Conservative detector endpoint and out-of-segment refusals are
  // qualification rules only. They never relocate or reroute a native ray.
  if(!Number.isFinite(along)||deviation>DETECTOR_HIT_RESIDUAL_MM||
    along<DETECTOR_HIT_ENDPOINT_MM||length-along<DETECTOR_HIT_ENDPOINT_MM)return null;
  return {pointMm:{x,y},incomingUnit:{x:vx/travel,y:-vy/travel},distanceFromP1Mm:along};
}
export function observeDetectorSet(doc,scene,idMap,{captureHitEvents=false,parentage=null,finiteDiagnostic=null}={}) {
  const entries=doc.physics.components.filter(c=>c.type==='ray-detector').map(c=>{
    const detector=scene.objs[idMap.get(c.id)],original=detector.onRayIncident;
    let crossings=0,issue=null;const events=[];
    const [a,b]=mirrorEndpoints(c.parameters),dx=b.x-a.x,dy=b.y-a.y;
    const segment={a,b,dx,dy,length:Math.hypot(dx,dy)};
    detector.onRayIncident=function(...args){
      // Snapshot native inputs BEFORE Detector.onRayIncident mutates ray.p1/p2.
      const sample=captureHitEvents?nativeDetectorHit(args[0],args[2],segment):null;
      const result=original.apply(this,args); // Exactly one native delegation.
      crossings++;
      parentage?.detector(c.id,args[0]);
      if(captureHitEvents){
        if(!sample)issue??='AMBIGUOUS_DETECTOR_HIT';
        else if(events.length>=DETECTOR_HIT_EVENT_LIMIT)issue??='HIT_EVENT_LIMIT_EXCEEDED';
        else if(!issue)events.push(sample);
      }
      return result;
    };
    if(parentage)parentage.register(c.id,'ray-detector',detector,detector.onRayIncident,'onRayIncident');
    try{finiteDiagnostic?.register(c.id,'ray-detector',detector,detector.onRayIncident,'onRayIncident');}
    catch{reportAuditFault(finiteDiagnostic);}
    return {id:c.id,detector,get crossings(){return crossings;},
      get hitEvents(){return {observedCount:crossings,limit:DETECTOR_HIT_EVENT_LIMIT,
        status:!issue&&events.length===crossings?'complete':'unavailable',
        reasonCode:issue,events:!issue&&events.length===crossings?structuredClone(events):null};}};
  });
  if(!entries.length)return null;
  return {get byId(){return Object.fromEntries(entries.map(entry=>[
    entry.id,{crossings:entry.crossings,
      signedPower:Number.isFinite(entry.detector.power)?entry.detector.power:null}
  ]));},
  get hitEventsById(){return captureHitEvents?Object.fromEntries(entries.map(e=>[e.id,e.hitEvents])):null;}};
}
// Per-instance native absorber observations; never trace or reroute a ray.
export function observeBlockerSet(doc, scene, idMap) {
  const entries=doc.physics.components.filter(c=>['line-blocker',CIRCLE_BLOCKER_TYPE,FINITE_APERTURE_TYPE].includes(c.type)).map(c=>{
    const native=scene.objs[idMap.get(c.id)],original=native.onRayIncident;
    const count={absorptions:0,invalidObservations:0};
    native.onRayIncident=function(...args){
      const result=original.apply(this,args);
      if(result?.isAbsorbed===true)count.absorptions++;
      else count.invalidObservations++;
      return result;
    };
    return [c.id,count];
  });
  if(!entries.length)return null;
  return {
    get byId(){return Object.fromEntries(entries.map(([id,m])=>[id,{...m}]));},
    get errors(){return entries.filter(([,m])=>m.invalidObservations).map(([id])=>
      id+': native blocker incident did not report absorption');}
  };
}
export function diagnostics(scene, simulator, meter = null, mirrorMeter = null, detectorMeter = null, interfaceMeter = null, blockerMeter = null, {detectorHitEvents=false,nativeEvent=null,parentage=null,finiteDiagnostic=null,apertureCornerGuard=null,grinNumericalGuard=null}={}) {
  const errors = [...(interfaceMeter?.errors||[]),...(blockerMeter?.errors||[]),...(apertureCornerGuard?.errors||[]),...(grinNumericalGuard?.errors||[]),scene.error, simulator.error, ...scene.objs.map(o => o.getError())].filter(Boolean);
  const warnings = [scene.warning, simulator.warning, ...scene.objs.map(o => o.getWarning())].filter(Boolean);
  const interfacesById = interfaceMeter?.byId ?? null;
  const endpointAudit = endpointAudits.get(scene);
  let endpointsVerified = false;
  if (endpointAudit && nativeEvent==='simulationComplete' && !errors.length &&
      simulator.totalTruncation===0 && simulator.totalUndefinedBehavior===0) {
    const issue = endpointAudit.finish(meter?.emitted,interfacesById,warnings,mirrorMeter?.byId,detectorMeter?.byId,blockerMeter?.byId);
    if (issue) errors.push(issue);
    else {
      endpointsVerified = true;
      endpointAudit.decorate?.(interfacesById);
    }
  }
  const emissionsById=meter?.byId ?? null;
  const sourceCount=emissionsById ? Object.keys(emissionsById).length : 0;
  const parentageById=parentage?.finish({event:nativeEvent,simulator,errors,warnings,sources:meter,detectors:detectorMeter,interfaces:interfaceMeter});
  let finiteHitAdvisory=null;
  if(finiteDiagnostic)try{
    finiteHitAdvisory=finiteDiagnostic.finish({event:nativeEvent,simulator,errors,warnings,
      sources:meter,detectors:detectorMeter,interfaces:interfaceMeter,scene});
  }catch{
    // A faulty OPTIONAL numerical auditor must never change true native
    // completion, source or detector readouts. It cannot certify anything.
    finiteHitAdvisory={status:'unknown',reasonCode:'NATIVE_FINITE_HIT_AUDITOR_FAILED',
      method:'advisory-native-finite-hit-binary64-v1',advisory:true,
      observedGlassIncidents:0,analyzedGlassIncidents:0,checked:0,unknown:0,
      conflicting:0,limit:128,nativeMeasurementQualificationUnchanged:true};
  }
  return { errors, warnings, processed: simulator.processedRayCount, truncation: simulator.totalTruncation,
    ...(endpointAudit?{[endpointAudit.key]:endpointsVerified}:{}),
    ...(endpointAudit?.extra&&endpointsVerified?endpointAudit.extra():{}),
    undefinedBehavior: simulator.totalUndefinedBehavior, emitted: meter?.emitted ?? null,
    // There is no meaningful single scale for multiple independently emitting
    // sources; keep source-specific scaling in emissionsById instead.
    brightnessScale: sourceCount>1 ? null : meter?.brightnessScale ?? simulator.brightnessScale,
    emissionsById,
    reflections: mirrorMeter?.reflections ?? null,
    reflectionsById: mirrorMeter?.byId ?? null,
    detectorsById: detectorMeter?.byId ?? null,
    // Raw positions are withheld even from execution diagnostics unless the
    // ENTIRE native run completed with no truncation, undefined behavior or errors.
    ...(detectorHitEvents?{detectorHitEventsById:nativeEvent==='simulationComplete'&&
      errors.length===0&&simulator.totalTruncation===0&&simulator.totalUndefinedBehavior===0?
      detectorMeter?.hitEventsById??null:null}:{}),
    interfacesById,
    blockersById: blockerMeter?.byId ?? null,
    ...(parentage?{detectorRayProvenanceById:parentageById}:{} ),
    ...(finiteDiagnostic?{finiteHitDiagnostic:finiteHitAdvisory}:{}),
    ...(apertureCornerGuard?{apertureCornerGuard:apertureCornerGuard.observation}:{}),
    ...(grinNumericalGuard?{grinNumericalGuard:grinNumericalGuard.observation}:{}) }; 
}
export function classifyRun(event, data) {
  return data.errors.length ? 'failed' : event === 'simulationStop' ? 'stopped' :
    data.truncation > 0 || data.undefinedBehavior > 0 || data.v27EndpointsVerified===false || data.v28EndpointsVerified===false || data.v29FanVerified===false || data.v30CurvedBeamVerified===false || data.v31SlabArcVerified===false || data.v32CapVerified===false || data.v33GradedSlabVerified===false || data.v34ImmersedArcVerified===false || data.v35MirrorBoxVerified===false || data.v36GuideFanVerified===false || data.v37EndpointsVerified===false ? 'incomplete' : data.warnings.length ? 'completed-with-warnings' : 'completed';
}
export { Scene, Simulator };
