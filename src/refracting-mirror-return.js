import {isRecord} from './qualified-utils.js';
import {add, subtract, multiply, divide, compare, fromBinary64} from './binary64-rational.js';

export const RETURN_FACTS = 'opticsim-refracting-mirror-return-facts-v1';
export const RETURN_QUERY = 'opticsim-refracting-mirror-return-query-v1';
const focus = 'refracting-mirror-return-focus', coincidence = 'refracting-mirror-self-conjugate';
const model = 'coaxial-paraxial-refraction-reflection-return';
const units = {mm:1, cm:10, m:1000};
const zero = fromBinary64(0), one = fromBinary64(1), two = fromBinary64(2);
const cap = fromBinary64(1e9), largestInput = fromBinary64(10000);
const band = fromBinary64(1e-10);
const abs = a => a.n < 0n ? {n:-a.n,d:a.d} : a;
const neg = a => ({n:-a.n,d:a.d});
export function returnCapabilities() {
  return {format:RETURN_QUERY, factsFormat:RETURN_FACTS, kinds:[focus,coincidence], model,
    lengthUnits:Object.keys(units), reference:'front pole', positiveOutputDirection:'toward the incident object'};
}
function fail(code,message) { throw Object.assign(new Error(message),{code}); }
function fields(value,names) {
  if (!isRecord(value) || Object.keys(value).some(k=>!names.includes(k))) fail('INVALID_RETURN_FACTS','Unexpected return geometry field.');
  for (const k of names) if (!Object.hasOwn(value,k)) fail('MISSING_FACTS','Supply '+k+'.');
}
function material(n) {
  if (!Number.isFinite(n) || n<1 || n>4) fail('INVALID_RETURN_FACTS','Require absolute indices from 1 to 4.');
  return fromBinary64(n);
}
function checkLength(exact,unit) {
  const mm = multiply(abs(exact),unit);
  if (compare(mm,one)<0 || compare(mm,largestInput)>0) fail('UNSUPPORTED_SCOPE','Require magnitude from 1 through 10000 mm.');
  return exact;
}
function length(x,unit) {
  if (!Number.isFinite(x)) fail('INVALID_RETURN_FACTS','Require a finite length.');
  return checkLength(fromBinary64(x),unit);
}
function geometry(g,unit,n0,n) {
  if (g?.kind==='equiconvex-thin-from-focal-length') {
    fields(g,['kind','uncoatedFocalLength']);
    const focal = length(g.uncoatedFocalLength,unit);
    if (focal.n<=0n || compare(n,n0)<=0) fail('UNSUPPORTED_SCOPE','Require a positive uncoated focal length in the stated lower-index exterior.');
    const radius = checkLength(divide(multiply(two,multiply(focal,subtract(n,n0))),n0),unit);
    return {front:divide(one,radius), mirror:divide(one,neg(radius)), gap:zero};
  }
  fields(g,['kind','frontSignedRadius','mirrorSignedRadius','poleSeparation']);
  if (g.kind!=='signed-poles') fail('UNSUPPORTED_SCOPE','Declare explicit signed pole geometry.');
  const curvature = x => x==='infinity' ? zero : divide(one,length(x,unit));
  const gap = g.poleSeparation===0 ? zero : length(g.poleSeparation,unit);
  if (gap.n<0n) fail('UNSUPPORTED_SCOPE','The reflector must be at or behind the front pole.');
  return {front:curvature(g.frontSignedRadius), mirror:curvature(g.mirrorSignedRadius), gap};
}
function cancelled(sum,a,b) {
  const aa = abs(a), bb = abs(b);
  return sum.n!==0n && compare(abs(sum),multiply(band,compare(aa,bb)>0?aa:bb))<=0;
}
function output(value,unit) {
  if (compare(multiply(abs(value),unit),cap)>0) return null;
  const n = Number(value.n), d = Number(value.d);
  if (!Number.isFinite(n) || !Number.isFinite(d)) return null;
  const rounded = n/d;
  return rounded===0 && value.n!==0n ? null : rounded;
}
export function analyzeReturn(f,q) {
  fields(q,['format','kind']);
  if (q.format!==RETURN_QUERY || ![focus,coincidence].includes(q.kind)) fail('UNSUPPORTED_QUERY','Unknown return query.');
  if (f?.format!==RETURN_FACTS) fail('UNSUPPORTED_FACTS','Explicit return-path paraxial facts required.');
  fields(f,['format','model','lengthUnit','exteriorIndex','interiorIndex','geometry']);
  if (f.model!==model || typeof f.lengthUnit!=='string' || !Object.hasOwn(units,f.lengthUnit)) fail('UNSUPPORTED_MODEL','Declare a common-axis return and a supported length unit.');
  const unit = fromBinary64(units[f.lengthUnit]), n0 = material(f.exteriorIndex), n = material(f.interiorIndex);
  const shape = geometry(f.geometry,unit,n0,n);
  const surface = multiply(subtract(n,n0),shape.front), mirror = multiply(neg(two),multiply(n,shape.mirror));
  const drift = divide(shape.gap,n);
  // Propagate both matrix columns in travel coordinates. Reflection changes the
  // longitudinal direction. Transverse height retains its sign on the return.
  let ill = false;
  function sum(a,b) {
    const s = add(a,b);
    ill ||= cancelled(s,a,b);
    return s;
  }
  function traceColumn(y,q) {
    q = sum(q,neg(multiply(surface,y)));
    y = sum(y,multiply(drift,q));
    q = sum(q,neg(multiply(mirror,y)));
    y = sum(y,multiply(drift,q));
    q = sum(q,neg(multiply(surface,y)));
    return [y,q];
  }
  const [A,C] = traceColumn(one,zero), [B,D] = traceColumn(zero,one);
  const base = {format:'opticsim-refracting-mirror-return-result-v1',kind:q.kind,method:'conditional-analytical',
    native:{status:'not-run'},assumptions:['Homogeneous media and paraxial transmission through the front face twice with one rear reflection.'],
    limitations:['Finite aperture, native ray interception and the brightness of any return require separate evidence.']};
  const uncertain = () => ({...base,status:'numerically-indeterminate',reasonCode:'UNRESOLVED_RETURN',reason:'A cancellation or distance exceeds the numerical policy.',value:null});
  if (ill || compare(A,D)!==0) return uncertain();
  const reference = {lengthUnit:f.lengthUnit,reference:'front pole',positiveDirection:'toward the incident object'};
  if (q.kind===focus) {
    if (!C.n) return {...base,status:'conditional',value:{...reference,action:'afocal',effectiveFocalLength:null,signedFrontFocusDistance:null}};
    const effective = divide(neg(n0),C), axial = multiply(effective,A);
    const e = output(effective,unit), z = output(axial,unit);
    if (e===null || z===null) return uncertain();
    return {...base,status:'conditional',value:{...reference,action:e>0?'converging':'diverging',effectiveFocalLength:e,signedFrontFocusDistance:z}};
  }
  // Imaging to the same external object plane requires B+2At+Ct²=0,
  // t=s/n0. For this symmetric round trip, A²−BC=1 exactly.
  const roots = C.n ? [sum(A,one),sum(A,neg(one))].map(x=>divide(multiply(neg(n0),x),C))
    : [divide(multiply(neg(n0),B),multiply(two,A))];
  const distances = roots.filter(x=>x.n>0n).sort(compare).map(x=>output(x,unit));
  if (ill || distances.some(x=>x===null) || new Set(distances).size!==distances.length) return uncertain();
  return {...base,status:'conditional',value:{...reference,objectDistances:distances,state:distances.length?'finite-real-object':'no-positive-object-distance'}};
}
