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
const parameters = { 'point-source': ['x', 'y'], 'ideal-lens': ['x', 'focalLength', 'apertureHeight'],
  'plane-mirror': ['x', 'y', 'orientationDeg', 'length'] };
export function validate(doc) { return validateVersion(doc, 4); }
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
  const models = ['ideal-thin-lens-geometric', ...(version >= 3 ? ['plane-mirror-geometric'] : []), ...(version >= 4 ? ['lens-mirror-return-geometric'] : [])];
  choice(p.model, models, '$.physics.model');
  if (!Array.isArray(p.components) || p.components.length > 32) fail('$.physics.components', 'expected a bounded component array');
  const ids = new Set();
  p.components.forEach((c, i) => {
    const path = `$.physics.components[${i}]`;
    object(c, ['id', 'type', 'parameters', ...(version >= 2 && c?.type === 'point-source' ? ['emission'] : [])], path);
    if (typeof c.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(c.id) || ids.has(c.id)) fail(`${path}.id`, 'expected a unique stable ID (letters, digits, underscores, hyphens)');
    ids.add(c.id);
    choice(c.type, version >= 3 ? Object.keys(parameters) : ['point-source', 'ideal-lens'], `${path}.type`);
    object(c.parameters, [...parameters[c.type], ...(version >= 2 && c.type === 'point-source' ? ['brightness'] : [])], `${path}.parameters`);
    for (const [key, value] of Object.entries(c.parameters)) {
      number(value, -10000, 10000, `${path}.parameters.${key}`);
      if (key === 'apertureHeight' && value < 1) fail(`${path}.parameters.${key}`, 'must be at least 1 mm');
      if (key === 'focalLength' && Math.abs(value) < 1) fail(`${path}.parameters.${key}`, 'magnitude must be at least 1 mm');
      if (key === 'brightness') number(value, 0.01, 1, `${path}.parameters.brightness`);
      if (key === 'length') number(value, 1, 10000, `${path}.parameters.length`);
      if (key === 'orientationDeg') number(value, -180, 180, `${path}.parameters.orientationDeg`);
    }
    if (version >= 2 && c.type === 'point-source') {
      object(c.emission, ['mode', 'directionDeg', 'angleDeg'], `${path}.emission`);
      choice(c.emission.mode, ['full-circle', 'directional'], `${path}.emission.mode`);
      number(c.emission.directionDeg, -180, 180, `${path}.emission.directionDeg`);
      number(c.emission.angleDeg, 1, 180, `${path}.emission.angleDeg`);
    }
  });
  if (p.model === 'lens-mirror-return-geometric') validateReturnScope(p.components);
  else if (p.model === 'plane-mirror-geometric') validateMirrorScope(p.components);
  else validateBenchScope(p.components);
  const v = doc.presentation;
  object(v, ['title', 'view', 'mode', 'grid', ...(version === 1 ? ['brightness'] : [])], '$.presentation');
  if (typeof v.title !== 'string' || v.title.length > 120) fail('$.presentation.title', 'expected a title of at most 120 characters');
  object(v.view, ['x', 'y', 'zoom'], '$.presentation.view');
  number(v.view.x, -10000, 10000, '$.presentation.view.x');
  number(v.view.y, -10000, 10000, '$.presentation.view.y');
  number(v.view.zoom, 0.03, 10, '$.presentation.view.zoom');
  choice(v.mode, ['rays', 'extended'], '$.presentation.mode');
  if (typeof v.grid !== 'boolean') fail('$.presentation.grid', 'expected boolean');
  if (version === 1) number(v.brightness, 0.01, 1, '$.presentation.brightness');
  object(doc.simulation, ['rayDensity', 'maxRayDepth', 'processedRayLimit'], '$.simulation');
  number(doc.simulation.rayDensity, version === 1 ? 0.1 : SAMPLING_PRESETS.sparse, 1, '$.simulation.rayDensity');
  number(doc.simulation.maxRayDepth, 0, 8, '$.simulation.maxRayDepth');
  number(doc.simulation.processedRayLimit, 1, 10000, '$.simulation.processedRayLimit');
  for (const key of ['maxRayDepth', 'processedRayLimit']) if (!Number.isInteger(doc.simulation[key])) fail(`$.simulation.${key}`, 'expected integer');
  return doc;
}
export function benchComponents(doc) {
  return { source: doc.physics.components.find(c => c.type === 'point-source'),
    lenses: doc.physics.components.filter(c => c.type === 'ideal-lens').sort((a, b) => a.parameters.x - b.parameters.x) };
}
function validateBenchScope(components) {
  const { source, lenses } = benchComponents({ physics: { components } });
  if (components.filter(c => c.type === 'point-source').length !== 1 || lenses.length < 1 || lenses.length > 2 || components.length !== lenses.length + 1) fail('$.physics.components', 'lens bench supports one point source and one or two coaxial ideal lenses', 'UNSUPPORTED_SCOPE');
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
  if (sources.length !== 1 || mirrors.length !== 1 || components.length !== 2) fail('$.physics.components', 'mirror arrangement supports one point source and one plane mirror only', 'UNSUPPORTED_SCOPE');
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
  if (sources.length !== 1 || lenses.length !== 1 || mirrors.length !== 1 || components.length !== 3) fail(path, 'return layout supports one point source, one ideal lens and one plane mirror only', 'UNSUPPORTED_SCOPE');
  const [source, lens, mirror] = [sources[0].parameters, lenses[0].parameters, mirrors[0].parameters];
  if (lens.x - source.x < 0.01 || mirror.x - lens.x < 0.01) fail(path, 'return layout requires source left of lens left of mirror, with >=0.01 mm plane separation');
  if (mirror.y !== 0 || ![90, -90].includes(mirror.orientationDeg)) fail(path, 'return layout requires mirror centre y=0 and perpendicular orientation +90 or -90 degrees', 'UNSUPPORTED_SCOPE');
  if (mirrorEndpoints(mirror).some(p => Math.abs(p.x) > 10000 || Math.abs(p.y) > 10000)) fail(path, 'derived mirror endpoints must lie within +/-10000 mm');
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
