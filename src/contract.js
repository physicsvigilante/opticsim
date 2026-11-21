import {validatePostLensAperture} from './post-lens-aperture.js';
import {compositionModels,compositionSourceModes,compositionProfile,compositionCapacity,compositionCountsMatch,validateCompositionRules} from './composition-profiles.js';
import {SPHERICAL_LENS_TYPE,SPHERICAL_PARAMETERS,validateSphericalLensTrain} from './spherical-lens.js';
import {validateTwoSeparatedDielectrics} from './two-finite-dielectrics.js';
import {validateThickLensMirrorComposition} from './thick-lens-mirror-composition.js';
import {TWO_THICK_MIRROR_VERSION,TWO_THICK_MIRROR_NATIVE_DEPTH,validateTwoThickLensMirrorComposition} from './two-thick-lens-mirror-composition.js';
import {THICK_APERTURE_VERSION,THICK_APERTURE_NATIVE_DEPTH,validateThickApertureComposition} from './thick-lens-aperture-composition.js';
import {validateFiniteDielectricComposition} from './finite-dielectric-composition.js';
import {PRISM_TYPE,PRISM_PARAMETERS,validatePrismGeometry} from './triangular-prism.js';
import {POLYGON_TYPE,POLYGON_PARAMETERS,validatePolygonGeometry} from './polygon-dielectric.js';
import {CIRCULAR_TYPE,CIRCULAR_PARAMETERS,validateCircularGeometry} from './circular-dielectric.js';
import {SEMICIRCULAR_TYPE,SEMICIRCULAR_VERSION,SEMICIRCULAR_PARAMETERS,validateSemicircularBeam} from './semicircular-dielectric.js';
import {CURVED_PARAMETERS,isCurved,validateCurvedGeometry} from './curved-mirrors.js';
import {PLANAR_TYPE,PLANAR_PARAMETERS,validatePlanarGeometry} from './planar-media.js';
import {CIRCLE_BLOCKER_TYPE,validateCircleBlockerGeometry} from './opaque-circle-blocker.js';
import {FINITE_APERTURE_TYPE,APERTURE_CLEARANCE_MM} from './finite-aperture.js';
import {finiteSurfaceGeometry,pointWithinSupportingLineClearance,finiteSurfacesConflict} from './composition-validation.js';
import {PARALLEL_BEAM_TYPE,PARALLEL_BEAM_VERSION,PARALLEL_BEAM_PARAMETERS,validateParallelBeamComposition} from './parallel-beam.js';
import {PRISM_BEAM_VERSION,validateNativePrismBeam} from './native-prism-beam.js';
import {CIRCLE_BEAM_VERSION,validateCircleBeam} from './native-circle-beam.js';
import {BEAM_PLANAR_MIRROR_VERSION,validateBeamPlanarMirror} from './native-beam-planar-mirror-v26.js';
import {BEAM_TWO_PLANE_MIRROR_VERSION,validateBeamTwoPlaneMirror} from './native-beam-two-plane-mirror-v27.js';
import {DECENTERED_BEAM_VERSION,validateDecenteredTwoLensBeam} from './decentered-two-lens-beam.js';
import {CURVED_ENTRY_VERSION,validateCurvedEntryObservation} from './native-curved-entry-observation.js';
import {GRIN_V25_TYPE,GRIN_V25_VERSION,GRIN_V25_PARAMETERS,GRIN_V25_POLICY,validateGrinV25} from './native-grin-v25.js';
export const UPSTREAM = '811f508d2b070898c241a568b0c167dcb8645251';
export const SAMPLING_PRESETS = Object.freeze({ sparse: 0.048, medium: 0.2, dense: 1 });
export function samplingPreset(density) { return Object.keys(SAMPLING_PRESETS).find(key => SAMPLING_PRESETS[key] === density) || 'custom'; }
export class ValidationError extends Error {
  constructor(path, message, code = 'INVALID_INPUT') { super(`${path}: ${message}`); this.path = path; this.code = code; }
}
const fail = (p, m, c) => { throw new ValidationError(p, m, c); };
function object(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unsupported field', 'UNSUPPORTED');
  for (const key of keys) if (!(key in value)) fail(`${path}.${key}`, 'required field');
}
function number(n, min, max, path) {
  if (!Number.isFinite(n) || n < min || n > max) fail(path, `expected a finite number in [${min}, ${max}]`);
}
function choice(value, choices, path) { if (!choices.includes(value)) fail(path, `supported: ${choices.join(', ')}`, 'UNSUPPORTED'); }
// These schemas describe components. The current bench scope is enforced separately below.
const parameters = { [PARALLEL_BEAM_TYPE]:[...PARALLEL_BEAM_PARAMETERS], 'point-source': ['x', 'y'], 'ideal-lens': ['x', 'focalLength', 'apertureHeight'],
  'plane-mirror': ['x', 'y', 'orientationDeg', 'length'],
  'line-blocker': ['x', 'y', 'orientationDeg', 'length'],
  [CIRCLE_BLOCKER_TYPE]: ['x', 'y', 'radius'],
  [FINITE_APERTURE_TYPE]: ['x', 'y', 'orientationDeg', 'length', 'openingLength'],
  'ray-detector': ['x', 'y', 'orientationDeg', 'length'],
  [PLANAR_TYPE]: [...PLANAR_PARAMETERS], [CIRCULAR_TYPE]: [...CIRCULAR_PARAMETERS], [SEMICIRCULAR_TYPE]: [...SEMICIRCULAR_PARAMETERS], [PRISM_TYPE]: [...PRISM_PARAMETERS], [POLYGON_TYPE]: [...POLYGON_PARAMETERS], [SPHERICAL_LENS_TYPE]: [...SPHERICAL_PARAMETERS], [GRIN_V25_TYPE]:[...GRIN_V25_PARAMETERS], ...CURVED_PARAMETERS };
// Shared authoring/validator definitions. General composition relaxes mandatory
// apparatus types; it does not relax numerical, geometric or runtime limits.
export const COMPONENT_TYPES = Object.freeze(Object.keys(parameters));
export const LENGTH_PARAMETERS = Object.freeze(['x','y','x1','y1','x2','y2','x3','y3','x4','y4','width','focalLength','apertureHeight','centerThickness','frontRadius','backRadius','leftX','axisY','spanX','upHeight','downHeight','gradientLength','length','openingLength','radius']);
// Compatibility envelope for legacy clients; whole-system profiles determine
// admission. These per-type maxima must never be summed across optical families.
export const GENERAL_SCOPE = Object.freeze(Object.fromEntries(
  COMPONENT_TYPES.map(type=>[type,Object.freeze(compositionCapacity(type))])));
// Largest currently admitted arrangement: general sources/lenses/mirrors/stops/detectors.
// Line blockers, circles and finite apertures share a two-stop limit. Do not sum
// their individual limits or the isolated optical-family limits.
export const MAX_AUTHORING_COMPONENTS = ['point-source','ideal-lens','plane-mirror',
  'line-blocker','ray-detector'].reduce((total,type)=>total+GENERAL_SCOPE[type].max,0);
export const COMPONENT_BOUNDS = Object.freeze({
  coordinateMm: Object.freeze([-10000,10000]),
  positiveLengthMm: Object.freeze([1,10000]),
  minimumAbsFocalLengthMm: 1,
  orientationDeg: Object.freeze([-180,180]),
  directionDeg: Object.freeze([-180,180]),
  openingAngleDeg: Object.freeze([1,180]),
  brightness: Object.freeze([.01,1]),
  refractiveIndex: Object.freeze([1,4]),
  sourcePlaneSeparationMm: .01
});
export function componentParameterNames(type, version = 4) {
  if (!Object.hasOwn(parameters,type)) return null;
  if(type==='ideal-lens'&&version===DECENTERED_BEAM_VERSION)
    return ['x','y','focalLength','apertureHeight'];
  return [...parameters[type], ...(version >= 2 && type === 'point-source' ? ['brightness'] : [])];
}
// Legacy versions stay isolated; circular scenes use v7 and triangular prisms v8.
export function validate(doc) {
  const version=Number.isInteger(doc?.schemaVersion)&&doc.schemaVersion>4&&compositionModels(doc.schemaVersion).length
    ?doc.schemaVersion:4;
  return validateVersion(doc,version);
}
function validateVersion(doc, version) {
  object(doc, ['format', 'schemaVersion', 'adapterVersion', 'upstreamCommit', 'physics', 'presentation', 'simulation'], '$');
  choice(doc.format, ['ray-optics-2d'], '$.format');
  choice(doc.schemaVersion, [version], '$.schemaVersion');
  choice(doc.adapterVersion, [version], '$.adapterVersion');
  choice(doc.upstreamCommit, [UPSTREAM], '$.upstreamCommit');
  const p = doc.physics;
  object(p, ['lengthUnit', 'coordinates', 'model', 'components'], '$.physics');
  choice(p.lengthUnit, ['mm'], '$.physics.lengthUnit');
  choice(p.coordinates, ['x-right-y-up'], '$.physics.coordinates');
  const models = compositionModels(version);
  choice(p.model, models, '$.physics.model');
  if (!Array.isArray(p.components) || p.components.length > 32) fail('$.physics.components', 'expected a bounded component array');
  const ids = new Set();
  p.components.forEach((c, i) => {
    const path = `$.physics.components[${i}]`;
    object(c, ['id', 'type', 'parameters', ...(version >= 2 && c?.type === 'point-source' ? ['emission'] : [])], path);
    if (typeof c.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(c.id) || ids.has(c.id)) fail(`${path}.id`, 'expected a unique stable ID (letters, digits, underscores, hyphens)');
    ids.add(c.id);
    choice(c.type, version >= 4 ? Object.keys(parameters).filter(t=>(version>=5||t!==PLANAR_TYPE)&&(version>=6||!isCurved(t))&&(version>=7||t!==CIRCULAR_TYPE)&&(version>=8||t!==PRISM_TYPE)&&(version>=9||t!==POLYGON_TYPE)&&(t!==SPHERICAL_LENS_TYPE||[15,16,17,18].includes(version))&&(t!==GRIN_V25_TYPE||version===GRIN_V25_VERSION)&&(version===4||([13,CURVED_ENTRY_VERSION].includes(version)&&t==='line-blocker')||(version===THICK_APERTURE_VERSION&&t===FINITE_APERTURE_TYPE)||([PARALLEL_BEAM_VERSION,28].includes(version)&&t===FINITE_APERTURE_TYPE)||!['line-blocker',CIRCLE_BLOCKER_TYPE,FINITE_APERTURE_TYPE].includes(t))&&(t!==PARALLEL_BEAM_TYPE||[PARALLEL_BEAM_VERSION,DECENTERED_BEAM_VERSION,SEMICIRCULAR_VERSION,PRISM_BEAM_VERSION,CIRCLE_BEAM_VERSION,BEAM_PLANAR_MIRROR_VERSION,BEAM_TWO_PLANE_MIRROR_VERSION,28].includes(version))&&(t!==SEMICIRCULAR_TYPE||[SEMICIRCULAR_VERSION,CURVED_ENTRY_VERSION].includes(version))) :
      version >= 3 ? ['point-source', 'ideal-lens', 'plane-mirror'] :
      ['point-source', 'ideal-lens'], `${path}.type`);
    object(c.parameters, componentParameterNames(c.type,version), `${path}.parameters`);
    for (const [key, value] of Object.entries(c.parameters)) {
      if(key==='partialReflection'){if(typeof value!=='boolean')fail(`${path}.parameters.${key}`,'expected explicit boolean');continue;}
      if(['negativeIndex','positiveIndex','insideIndex','outsideIndex'].includes(key))number(value,1,4,`${path}.parameters.${key}`);
      if(key==='normalDeg')number(value,-180,180,`${path}.parameters.${key}`);
      number(value, -10000, 10000, `${path}.parameters.${key}`);
      if (key === 'apertureHeight' && value < 1) fail(`${path}.parameters.${key}`, 'must be at least 1 mm');
      if (key === 'radius' && (c.type===CIRCULAR_TYPE?value<2:c.type===SEMICIRCULAR_TYPE?value<5:c.type===CIRCLE_BLOCKER_TYPE?value<1:Math.abs(value)<2)) fail(`${path}.parameters.${key}`, c.type===CIRCLE_BLOCKER_TYPE?'opaque circle radius must be at least 1 mm':'radius magnitude must be at least 2 mm');
      if (key === 'focalLength' && Math.abs(value) < 1) fail(`${path}.parameters.${key}`, 'magnitude must be at least 1 mm');
      if (key === 'brightness') number(value, 0.01, 1, `${path}.parameters.brightness`);
      if (key === 'width') number(value, 10, 100, `${path}.parameters.width`);
      if (c.type===PARALLEL_BEAM_TYPE && key==='directionDeg') number(value,-180,180,`${path}.parameters.directionDeg`);
      if (['length','openingLength','centerThickness','frontRadius','backRadius'].includes(key)) number(value, 1, 10000, `${path}.parameters.${key}`);
      if (key === 'orientationDeg') number(value, -180, 180, `${path}.parameters.orientationDeg`);
    }
    if (c.type===FINITE_APERTURE_TYPE && c.parameters.length-c.parameters.openingLength < 2)
      fail(`${path}.parameters.openingLength`, 'central opening must leave two opaque arms at least 1 mm long');
    if (version >= 2 && c.type === 'point-source') {
      object(c.emission, ['mode', 'directionDeg', 'angleDeg'], `${path}.emission`);
      choice(c.emission.mode, compositionSourceModes(version), `${path}.emission.mode`);
      number(c.emission.directionDeg, -180, 180, `${path}.emission.directionDeg`);
      number(c.emission.angleDeg, 1, 180, `${path}.emission.angleDeg`);
    }
  });
  // The registry owns rule order and validation views. No component is ever
  // removed from the authoritative document or the native scene compiler.
  validateCompositionRules(p.components,p.model,version,{
    'finite-composition':c=>validateFiniteDielectricComposition(c,mirrorEndpoints,fail,version),
    'two-separated-glass':c=>validateTwoSeparatedDielectrics(c,mirrorEndpoints,fail),
    'native-thick-lenses':c=>validateSphericalLensTrain(c,mirrorEndpoints,fail),
    'native-thick-mirror':c=>validateThickLensMirrorComposition(c,mirrorEndpoints,fail),
    'native-two-thick-mirror':c=>validateTwoThickLensMirrorComposition(c,mirrorEndpoints,fail),
    'native-thick-aperture':c=>validateThickApertureComposition(c,mirrorEndpoints,fail),
    'native-post-lens-aperture':c=>validatePostLensAperture(c,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-parallel-beam':c=>validateParallelBeamComposition(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-decentered-two-lens':c=>validateDecenteredTwoLensBeam(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-semicircular-beam':c=>validateSemicircularBeam(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-prism-beam':c=>validateNativePrismBeam(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-beam-planar-mirror':c=>validateBeamPlanarMirror(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-beam-two-plane-mirror':c=>validateBeamTwoPlaneMirror(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-circle-beam':c=>validateCircleBeam(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-curved-entry':c=>validateCurvedEntryObservation(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'native-grin-v25':c=>validateGrinV25(c,p.model,doc.simulation?.rayDensity,mirrorEndpoints,fail),
    'polygon-region':c=>validatePolygonGeometry(c,mirrorEndpoints,fail),
    'prism-region':c=>validatePrismGeometry(c,mirrorEndpoints,fail),
    'circular-region':c=>validateCircularGeometry(c,mirrorEndpoints,fail),
    'curved-mirrors':c=>validateCurvedGeometry(c,mirrorEndpoints,fail),
    'planar-media':c=>validatePlanarGeometry(c,mirrorEndpoints,fail),
    'lens-mirror-return':validateReturnScope,
    'mixed-optical':c=>validateMixedTraceScope(c),
    'general-optical':c=>validateMixedTraceScope(c,true),
    'plane-mirror':validateMirrorScope,
    'lens-bench':c=>validateBenchScope(c,version),
    detectors:validateDetectorScope,
    'opaque-circles':c=>validateCircleBlockerGeometry(c,mirrorEndpoints,fail)
  });
  const v = doc.presentation;
  object(v, ['title', 'view', 'mode', 'grid', ...(version === 1 ? ['brightness'] : [])], '$.presentation');
  if (typeof v.title !== 'string' || v.title.length > 120) fail('$.presentation.title', 'expected a title of at most 120 characters');
  object(v.view, ['x', 'y', 'zoom'], '$.presentation.view');
  number(v.view.x, -10000, 10000, '$.presentation.view.x');
  number(v.view.y, -10000, 10000, '$.presentation.view.y');
  number(v.view.zoom, 0.03, version===GRIN_V25_VERSION?100:10, '$.presentation.view.zoom');
  choice(v.mode, ['rays', 'extended'], '$.presentation.mode');
  if (typeof v.grid !== 'boolean') fail('$.presentation.grid', 'expected boolean');
  if (version === 1) number(v.brightness, 0.01, 1, '$.presentation.brightness');
  object(doc.simulation, ['rayDensity', 'maxRayDepth', 'processedRayLimit'], '$.simulation');
  number(doc.simulation.rayDensity, version === 1 ? 0.1 : SAMPLING_PRESETS.sparse, 1, '$.simulation.rayDensity');
  // Only v17-v18 receive the explicitly versioned deep native budget.
  // v19-v21 remain bounded at their independently reviewed depth <=8.
  number(doc.simulation.maxRayDepth,0,
    version===TWO_THICK_MIRROR_VERSION?TWO_THICK_MIRROR_NATIVE_DEPTH:
    version===THICK_APERTURE_VERSION?THICK_APERTURE_NATIVE_DEPTH:
    version===GRIN_V25_VERSION?GRIN_V25_POLICY.maxRayDepth:8,
    '$.simulation.maxRayDepth');
  number(doc.simulation.processedRayLimit, 1, 10000, '$.simulation.processedRayLimit');
  for (const key of ['maxRayDepth', 'processedRayLimit']) if (!Number.isInteger(doc.simulation[key])) fail(`$.simulation.${key}`, 'expected integer');
  if(version===GRIN_V25_VERSION&&(doc.simulation.maxRayDepth!==GRIN_V25_POLICY.maxRayDepth||
    doc.simulation.processedRayLimit!==GRIN_V25_POLICY.processedRayLimit||
    doc.simulation.rayDensity!==GRIN_V25_POLICY.rayDensity))
    fail('$.simulation','v25 requires its exact isolated numerical run policy','UNSUPPORTED_SCOPE');
  return doc;
}
export function benchComponents(doc) {
  return { source: doc.physics.components.find(c => c.type === 'point-source'),
    lenses: doc.physics.components.filter(c => c.type === 'ideal-lens').sort((a, b) => a.parameters.x - b.parameters.x) };
}
function validateBenchScope(components, version) {
  const { source, lenses } = benchComponents({ physics: { components } });
  const maxLenses = compositionProfile('ideal-thin-lens-geometric',version).counts['ideal-lens'].max;
  if (!compositionCountsMatch(components,'ideal-thin-lens-geometric',version)) fail('$.physics.components', `lens bench supports one point source and one to ${maxLenses} coaxial ideal lenses`, 'UNSUPPORTED_SCOPE');
  let previous = source.parameters.x;
  for (const lens of lenses) {
    if (lens.parameters.x - previous < 0.01) fail('$.physics.components', 'source must be left of the lenses; distinct lens planes need at least 0.01 mm separation');
    previous = lens.parameters.x;
  }
}
// Semantic geometry only: endpoints are derived, never additional authored state.
export function mirrorEndpoints({ x, y, orientationDeg, length }) {
  const theta = orientationDeg * Math.PI / 180;
  const dx = length / 2 * Math.cos(theta), dy = length / 2 * Math.sin(theta);
  return [{ x: x - dx, y: y - dy }, { x: x + dx, y: y + dy }];
}
function validateMirrorScope(components) {
  const sources = components.filter(c => c.type === 'point-source');
  const mirrors = components.filter(c => c.type === 'plane-mirror');
  if (!compositionCountsMatch(components,'plane-mirror-geometric',4)) fail('$.physics.components', 'mirror arrangement supports one point source and one plane mirror only', 'UNSUPPORTED_SCOPE');
  const mirror = mirrors[0];
  const path = `$.physics.components[${components.indexOf(mirror)}].parameters`;
  if (mirrorEndpoints(mirror.parameters).some(p => Math.abs(p.x) > 10000 || Math.abs(p.y) > 10000)) fail(path, 'derived mirror endpoints must lie within +/-10000 mm');
  const theta = mirror.parameters.orientationDeg * Math.PI / 180;
  const distance = -(sources[0].parameters.x - mirror.parameters.x) * Math.sin(theta) + (sources[0].parameters.y - mirror.parameters.y) * Math.cos(theta);
  if (Math.abs(distance) < 0.01) fail('$.physics.components', 'source must be at least 0.01 mm from the mirror supporting line (including its extension)');
}
function validateReturnScope(components) {
  const sources = components.filter(c => c.type === 'point-source');
  const lenses = components.filter(c => c.type === 'ideal-lens');
  const mirrors = components.filter(c => c.type === 'plane-mirror');
  const path = '$.physics.components';
  if (!compositionCountsMatch(components,'lens-mirror-return-geometric',4)) fail(path, 'return layout supports one point source, one ideal lens and one plane mirror only', 'UNSUPPORTED_SCOPE');
  const [source, lens, mirror] = [sources[0].parameters, lenses[0].parameters, mirrors[0].parameters];
  if (lens.x - source.x < 0.01 || mirror.x - lens.x < 0.01) fail(path, 'return layout requires source left of lens left of mirror, with >=0.01 mm plane separation');
  if (mirror.y !== 0 || ![90, -90].includes(mirror.orientationDeg)) fail(path, 'return layout requires mirror centre y=0 and perpendicular orientation +90 or -90 degrees', 'UNSUPPORTED_SCOPE');
  if (mirrorEndpoints(mirror).some(p => Math.abs(p.x) > 10000 || Math.abs(p.y) > 10000)) fail(path, 'derived mirror endpoints must lie within +/-10000 mm');
}

// Current-v4 bounded composition: finite optical and measuring segments.
// Reject intersections to avoid ambiguous simultaneous native encounters.
function validateMixedTraceScope(components, general = false) {
  const sources=components.filter(c=>c.type==='point-source');
  const lenses=components.filter(c=>c.type==='ideal-lens');
  const path='$.physics.components';
  if(!compositionCountsMatch(components,general?'general-component-tracing':'mixed-lens-mirror-tracing',4))
    fail(path,general
      ? 'general tracing supports 1–4 point sources, 0–4 coaxial lenses, 0–4 plane mirrors and 0–2 total opaque line/circular/aperture stops'
      : 'mixed tracing supports 1–4 point sources, 1–4 coaxial lenses and 1–4 plane mirrors',
      'UNSUPPORTED_SCOPE');
  const points=sources.map(c=>c.parameters);
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)
    if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<0.01)
      fail(path,'distinct point sources must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');
  const planes=lenses.map(c=>c.parameters.x).sort((a,b)=>a-b);
  if(planes.some((x,i)=>points.some(p=>Math.abs(x-p.x)<0.01)||
      (i>0 && x-planes[i-1]<0.01)))
    fail(path,'each source and distinct lens planes must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');
  const surfaces=[];
  for(const [index,c] of components.entries()) {
    if(c.type==='point-source'||c.type===CIRCLE_BLOCKER_TYPE)continue;
    const p=c.parameters;
    const {line,segments:lines,aperture:isAperture}=finiteSurfaceGeometry(c,mirrorEndpoints);
    if(['plane-mirror','line-blocker',FINITE_APERTURE_TYPE].includes(c.type)){
      if(line.some(v=>Math.abs(v.x)>10000||Math.abs(v.y)>10000))
        fail(path+'['+index+'].parameters','segment endpoints exceed coordinate bounds','UNSUPPORTED_SCOPE');
      if(points.some(source=>pointWithinSupportingLineClearance(source,p,0.01)))
        fail(path+'['+index+'].parameters','each source must be at least 0.01 mm from finite surface supporting line','UNSUPPORTED_SCOPE');
    }
    // The transparent opening is free space, not a solid obstacle.
    for(const arm of lines){
      for(const other of surfaces)
        if(finiteSurfacesConflict(other,{line:arm,aperture:isAperture},APERTURE_CLEARANCE_MM))
          fail(path+'['+index+']','optical segments intersect or nearly touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      surfaces.push({id:c.id,line:arm,aperture:isAperture});
    }
  }
}
// The detector layer is independent of the optical model and can be authored
// on a pure lens train, a lone plane mirror, a return layout, or a mixed scene.
// Detectors are passive but may not share a native intersection with a surface.
function validateDetectorScope(components) {
  const detectors=components.filter(c=>c.type==='ray-detector');
  if(detectors.length>compositionProfile('general-component-tracing',4).counts['ray-detector'].max)
    fail('$.physics.components','at most two ray detectors are supported','UNSUPPORTED_SCOPE');
  if(!detectors.length)return;
  const sources=components.filter(c=>c.type==='point-source').map(c=>c.parameters);
  const surfaces=components.filter(c=>['ideal-lens','plane-mirror','line-blocker',FINITE_APERTURE_TYPE].includes(c.type))
    .flatMap(c=>{
      const {segments:lines,aperture}=finiteSurfaceGeometry(c,mirrorEndpoints);
      return lines.map(line=>({id:c.id,line,aperture}));
    });
  for(const [i,c] of components.entries()) {
    if(c.type!=='ray-detector')continue;
    const p=c.parameters,line=mirrorEndpoints(p),path='$.physics.components['+i+']';
    if(line.some(v=>Math.abs(v.x)>10000||Math.abs(v.y)>10000))
      fail(path+'.parameters','detector endpoints exceed coordinate bounds','UNSUPPORTED_SCOPE');
    if(sources.some(source=>pointWithinSupportingLineClearance(source,p,0.01)))
      fail(path+'.parameters','each source must be at least 0.01 mm from detector supporting line','UNSUPPORTED_SCOPE');
    for(const other of surfaces)
      if(finiteSurfacesConflict(other,{line,aperture:false},APERTURE_CLEARANCE_MM))
        fail(path,'detector segment intersects or nearly touches '+other.id,'UNSUPPORTED_SCOPE');
    surfaces.push({id:c.id,line,aperture:false});
  }
}
export function setParameter(doc, id, parameter, value) {
  const next = structuredClone(doc);
  const component = next.physics.components.find(c => c.id === id);
  if (!component || !(parameter in component.parameters)) fail(`${id}.${parameter}`, 'unknown parameter');
  component.parameters[parameter] = value;
  return validate(next);
}
// Migration is explicit and only occurs at the save-loading boundary. Existing
// intensity and density numbers are transferred exactly, never quantized to presets.
export function migrateDocument(doc) {
  let next = doc;
  if (next?.schemaVersion === 1) {
    validateVersion(next, 1);
    next = structuredClone(next);
    for (const source of next.physics.components.filter(c => c.type === 'point-source')) {
      source.parameters.brightness = next.presentation.brightness;
      source.emission = { mode: 'full-circle', directionDeg: 0, angleDeg: 30 };
    }
    delete next.presentation.brightness;
    next.schemaVersion = next.adapterVersion = 2;
  }
  if (next?.schemaVersion === 2) {
    validateVersion(next, 2);
    next = structuredClone(next);
    next.schemaVersion = next.adapterVersion = 3;
  }
  if (next?.schemaVersion === 3) {
    validateVersion(next, 3);
    next = structuredClone(next);
    next.schemaVersion = next.adapterVersion = 4;
  }
  return validate(next);
}
// This is a user mode-change action, not a load/compile default. Explicit saved
// directional densities (including Custom) remain untouched during loading.
export function setSourceMode(doc, id, mode) {
  const next = structuredClone(doc);
  const source = next.physics.components.find(c => c.id === id && c.type === 'point-source');
  if (!source) fail(id, 'unknown point source');
  if (source.emission.mode !== 'directional' && mode === 'directional') next.simulation.rayDensity = SAMPLING_PRESETS.medium;
  source.emission.mode = mode;
  return validate(next);
}
export function parseSave(text) { return migrateDocument(JSON.parse(text)); }
export function serializeSave(doc) { return JSON.stringify(validate(doc), null, 2) + '\n'; }
