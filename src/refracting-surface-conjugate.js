import {isRecord} from './qualified-utils.js';
import {fromBinary64, add, subtract, multiply, divide, compare} from './binary64-rational.js';

export const CONJUGATE_FACTS = 'opticsim-refracting-surface-conjugate-facts-v1';
export const CONJUGATE_QUERY = 'opticsim-refracting-surface-conjugate-query-v1';
const kind = 'refracting-surface-conjugate';
const model = 'coaxial-paraxial-positive-x';
const scales = {mm: 1, cm: 10, m: 1000};
const zero = fromBinary64(0), one = fromBinary64(1);

export function surfaceConjugateCapabilities() {
  return {format: CONJUGATE_QUERY, factsFormat: CONJUGATE_FACTS, kinds: [kind], model,
    lengthUnits: Object.keys(scales), surfaceCount: [1, 4], distanceOrigin: 'last authored pole'};
}
function fail(code, message) { throw Object.assign(new Error(message), {code}); }
function fields(value, required, optional = []) {
  if (!isRecord(value) || Object.keys(value).some(k => !required.includes(k) && !optional.includes(k)))
    fail('INVALID_SURFACE_FACTS', 'Unexpected field in refracting surface contract.');
  for (const key of required) if (!Object.hasOwn(value, key)) fail('MISSING_FACTS', 'Supply '+key+'.');
}
function length(value, scale) {
  if (!Number.isFinite(value) || Math.abs(value)*scale > 10000)
    fail('INVALID_SURFACE_FACTS', 'Supply a finite length within 10000 mm of the origin.');
  return fromBinary64(value);
}
function index(value) {
  if (!Number.isFinite(value) || value < 1 || value > 4) fail('INVALID_SURFACE_FACTS', 'Use absolute indices in [1,4].');
  return fromBinary64(value);
}

// Fail closed if the conversion of either exact integer is outside binary64.
function rounded(ratio) {
  const n = Number(ratio.n), d = Number(ratio.d);
  if (!Number.isFinite(n) || !Number.isFinite(d)) return NaN;
  const value = n/d;
  return value === 0 && ratio.n !== 0n ? NaN : value;
}
export function analyzeSurfaceConjugate(f, q) {
  fields(q, ['format', 'kind']);
  if (q.format !== CONJUGATE_QUERY || q.kind !== kind) fail('UNSUPPORTED_QUERY', 'Unknown refracting surface query.');
  fields(f, ['format','model','lengthUnit','entranceIndex','objectX','surfaces'], ['objectHeight']);
  if (f.format !== CONJUGATE_FACTS || f.model !== model) fail('UNSUPPORTED_MODEL', 'Declare the coaxial paraxial positive-x model.');
  if (typeof f.lengthUnit !== 'string' || !Object.hasOwn(scales, f.lengthUnit)) fail('INVALID_SURFACE_FACTS', 'Use mm, cm or m.');
  if (!Array.isArray(f.surfaces) || f.surfaces.length < 1 || f.surfaces.length > 4)
    fail('UNSUPPORTED_SCOPE', 'Supply one to four ordered refracting surfaces.');
  const scale = scales[f.lengthUnit], unit = fromBinary64(scale);
  let position = length(f.objectX, scale), medium = index(f.entranceIndex);
  const height = Object.hasOwn(f, 'objectHeight') ? length(f.objectHeight, scale) : null;
  const ids = new Set();
  // The second column maps an initial reduced slope into height and reduced slope.
  // Unit determinant then gives finite conjugate magnification 1/D.
  let B = zero, D = one;
  let unresolved = false;
  for (const face of f.surfaces) {
    fields(face, ['id','x','signedRadius','transmittedIndex']);
    if (typeof face.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(face.id) || ids.has(face.id))
      fail('INVALID_SURFACE_FACTS', 'Require unique stable surface IDs.');
    ids.add(face.id);
    const x = length(face.x, scale), gap = subtract(x, position), after = index(face.transmittedIndex);
    if (compare(multiply(gap, unit), one) < 0) fail('UNSUPPORTED_SCOPE', 'Separate successive poles and the incident object by at least 1 mm.');
    const drift = multiply(divide(gap, medium), D);
    const nextB = add(B, drift);
    if (nearCancellation(nextB, B, drift)) unresolved = true;
    B = nextB;
    if (face.signedRadius !== 'infinity') {
      const radius = length(face.signedRadius, scale);
      if (Math.abs(face.signedRadius)*scale < 1) fail('UNSUPPORTED_SCOPE', 'Finite radius magnitude must be at least 1 mm.');
      const bend = multiply(divide(subtract(after, medium), radius), B);
      const nextD = subtract(D, bend);
      if (nearCancellation(nextD, D, bend)) unresolved = true;
      D = nextD;
    }
    position = x;
    medium = after;
  }
  const result = {format:'opticsim-refracting-surface-conjugate-result-v1', kind, method:'conditional-analytical',
    native:{status:'not-run'}, assumptions:['First-order transmission about a common axis in successive homogeneous media.'],
    limitations:['Finite apertures, aberration and measured image formation require separate evidence.']};
  const uncertain = () => ({...result, status:'numerically-indeterminate', reasonCode:'UNRESOLVED_SURFACE_CONJUGATE',
    reason:'The conjugate exceeds the representation, conditioning or distance limits.', value:null});
  if (unresolved) return uncertain();
  const reference = {referenceFaceId:f.surfaces.at(-1).id, lengthUnit:f.lengthUnit};
  if (D.n === 0n) return {...result, status:'conditional', value:{...reference, state:'at-infinity',
    signedDistanceFromLastPole:null, transverseMagnification:null}};
  const m = divide(one, D), z = divide(subtract(zero, multiply(medium, B)), D);
  const distance = rounded(z), magnification = rounded(m);
  const imageHeight = height && rounded(multiply(height, m));
  if (!Number.isFinite(distance) || Math.abs(distance)*scale > 1e9 || !Number.isFinite(magnification) ||
      (height && !Number.isFinite(imageHeight))) return uncertain();
  return {...result, status:'conditional', value:{...reference, state:z.n === 0n ? 'at-last-pole' : z.n > 0n ? 'real' : 'virtual',
    signedDistanceFromLastPole:distance, transverseMagnification:magnification, ...(height ? {imageHeight} : {})}};
}
function nearCancellation(result, a, b) {
  if (result.n === 0n) return false;
  const remaining = Math.abs(rounded(result)), scale = Math.max(Math.abs(rounded(a)), Math.abs(rounded(b)));
  return !Number.isFinite(remaining) || !Number.isFinite(scale) || remaining <= 1e-10*scale;
}
