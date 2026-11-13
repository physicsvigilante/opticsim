import {compilePrism,PRISM_TYPE} from './triangular-prism.js';
import {compilePolygon,POLYGON_TYPE} from './polygon-dielectric.js';
import {compileCircular} from './circular-dielectric.js';
import {CIRCLE_BLOCKER_TYPE,compileCircleBlocker} from './opaque-circle-blocker.js';
import {compileCurved,isCurved} from './curved-mirrors.js';
import Scene from '../vendor/ray-optics/src/core/Scene.js';
import Simulator from '../vendor/ray-optics/src/core/Simulator.js';
import i18next from '../vendor/ray-optics/node_modules/i18next/dist/esm/i18next.js';
import en from '../vendor/ray-optics/locales/en/simulator.json';
import { validate, mirrorEndpoints } from './contract.js';
i18next.init({ lng: 'en', resources: { en: { simulator: en } }, initImmediate: false, interpolation: { escapeValue: false } });
import {compileInterface,observeInterfaceSet} from './planar-media.js';
export {observeInterfaceSet};
const compilers = {
  'circular-dielectric':compileCircular,[PRISM_TYPE]:compilePrism,[POLYGON_TYPE]:compilePolygon,
  [CIRCLE_BLOCKER_TYPE]:compileCircleBlocker,
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
  'ideal-lens': c => ({ type: 'IdealLens', p1: { x: c.parameters.x, y: -c.parameters.apertureHeight / 2 },
    p2: { x: c.parameters.x, y: c.parameters.apertureHeight / 2 }, focalLength: c.parameters.focalLength }),
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
  return { ...compiled, scene: loadNative(compiled.native, width, height) };
}
export function nativeExport(doc) { return loadDocument(doc).scene.toJSON(); }
// Instance-local observation only: one native call, same return value and rays.
// No tracing, resampling, or source prototype/upstream modification.
export function observeSourceEmission(source) {
  const meter = { emitted: null, brightnessScale: null };
  const nativeStart = source.onSimulationStart;
  source.onSimulationStart = function (...args) {
    const result = nativeStart.apply(this, args);
    meter.emitted = result?.newRays?.length || 0;
    meter.brightnessScale = result?.brightnessScale ?? null;
    return result;
  };
  return meter;
}
// Wrap each authored source once; no ray provenance is assigned after emission.
// Stable-ID counts describe actual PhyDemo sampling, never detector attribution.
export function observeSourceSet(doc, scene, idMap) {
  const entries=doc.physics.components.filter(c=>c.type==='point-source')
    .map(c=>[c.id,observeSourceEmission(scene.objs[idMap.get(c.id)])]);
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
// Observe only authored detectors. Native onRayIncident and power accounting
// stay authoritative; the observer counts calls and delegates exactly once.
export function observeDetectorSet(doc, scene, idMap) {
  const entries=doc.physics.components.filter(c=>c.type==='ray-detector').map(c=>{
    const detector=scene.objs[idMap.get(c.id)], original=detector.onRayIncident;
    let crossings=0;
    detector.onRayIncident=function (...args) {
      const result=original.apply(this,args);
      crossings++;
      return result;
    };
    return {id:c.id,detector,get crossings(){return crossings;}};
  });
  if(!entries.length)return null;
  return {get byId(){return Object.fromEntries(entries.map(entry=>[
    entry.id,{crossings:entry.crossings,
      signedPower:Number.isFinite(entry.detector.power)?entry.detector.power:null}
  ]));}};
}
// Per-instance native absorber observations; never trace or reroute a ray.
export function observeBlockerSet(doc, scene, idMap) {
  const entries=doc.physics.components.filter(c=>['line-blocker',CIRCLE_BLOCKER_TYPE].includes(c.type)).map(c=>{
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
export function diagnostics(scene, simulator, meter = null, mirrorMeter = null, detectorMeter = null, interfaceMeter = null, blockerMeter = null) {
  const errors = [...(interfaceMeter?.errors||[]),...(blockerMeter?.errors||[]),scene.error, simulator.error, ...scene.objs.map(o => o.getError())].filter(Boolean);
  const warnings = [scene.warning, simulator.warning, ...scene.objs.map(o => o.getWarning())].filter(Boolean);
  const emissionsById=meter?.byId ?? null;
  const sourceCount=emissionsById ? Object.keys(emissionsById).length : 0;
  return { errors, warnings, processed: simulator.processedRayCount, truncation: simulator.totalTruncation,
    undefinedBehavior: simulator.totalUndefinedBehavior, emitted: meter?.emitted ?? null,
    // There is no meaningful single scale for multiple independently emitting
    // sources; keep source-specific scaling in emissionsById instead.
    brightnessScale: sourceCount>1 ? null : meter?.brightnessScale ?? simulator.brightnessScale,
    emissionsById,
    reflections: mirrorMeter?.reflections ?? null,
    reflectionsById: mirrorMeter?.byId ?? null,
    detectorsById: detectorMeter?.byId ?? null,
    interfacesById: interfaceMeter?.byId ?? null,
    blockersById: blockerMeter?.byId ?? null }; 
}
export function classifyRun(event, data) {
  return data.errors.length ? 'failed' : event === 'simulationStop' ? 'stopped' :
    data.truncation > 0 || data.undefinedBehavior > 0 ? 'incomplete' : data.warnings.length ? 'completed-with-warnings' : 'completed';
}
export { Scene, Simulator };
