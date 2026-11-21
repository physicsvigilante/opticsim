import {isRecord} from './qualified-utils.js';
import {fromBinary64, toBinary64, compare, subtract, multiply, divide} from './binary64-rational.js';

export const IMMERSION_FACTS = 'opticsim-calibrated-lens-immersion-facts-v1';
export const IMMERSION_QUERY = 'opticsim-calibrated-lens-immersion-query-v1';
export const immersionKind = 'immersed-lens-focal-length';
const model = 'fixed-shape-paraxial-thin-lens';
const scales = {mm:1,cm:10,m:1000};
const band = fromBinary64(1e-10), cap = fromBinary64(1e9);
const absolute = a => a.n<0n ? {n:-a.n,d:a.d} : a;
export function immersionCapabilities() {
  return {format:IMMERSION_QUERY,factsFormat:IMMERSION_FACTS,kinds:[immersionKind],model,
    lengthUnits:Object.keys(scales),target:'mediumId',reference:'signed focal length in the reference exterior'};
}
function fail(code,message) { throw Object.assign(new Error(message),{code}); }
function fields(obj,keys) {
  if (!isRecord(obj) || Object.keys(obj).some(k=>!keys.includes(k))) fail('INVALID_IMMERSION_FACTS','Unexpected lens immersion field.');
  for (const key of keys) if (!Object.hasOwn(obj,key)) fail('MISSING_FACTS','Supply '+key+'.');
}
function index(n) {
  if (!Number.isFinite(n) || n<1 || n>4) fail('INVALID_IMMERSION_FACTS','Supply an absolute index between 1 and 4.');
  return fromBinary64(n);
}
function contrast(a,b) {
  const value=subtract(a,b);
  return {value,near:value.n!==0n && compare(absolute(value),multiply(band,compare(a,b)>0?a:b))<=0};
}
const validId = id => typeof id==='string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id);
export function analyzeImmersion(f,q) {
  fields(q,['format','kind','mediumId']);
  if (q.format!==IMMERSION_QUERY || q.kind!==immersionKind) fail('UNSUPPORTED_QUERY','Unknown calibrated lens query.');
  if (!validId(q.mediumId)) fail('INVALID_IMMERSION_FACTS','Specify a stable target medium ID.');
  if (f?.format!==IMMERSION_FACTS) fail('UNSUPPORTED_FACTS','Supply a calibrated thin lens and exterior media.');
  fields(f,['format','model','lengthUnit','lensId','materialIndex','reference','media']);
  if (f.model!==model) fail('UNSUPPORTED_MODEL','Use a fixed-shape paraxial thin lens in homogeneous surroundings.');
  if (typeof f.lengthUnit!=='string' || !Object.hasOwn(scales,f.lengthUnit) || !validId(f.lensId))
    fail('INVALID_IMMERSION_FACTS','Use a stable lens ID and mm, cm or m.');
  fields(f.reference,['exteriorIndex','signedFocalLength']);
  const glass=index(f.materialIndex), reference=index(f.reference.exteriorIndex), unit=fromBinary64(scales[f.lengthUnit]);
  if (!Number.isFinite(f.reference.signedFocalLength)) fail('INVALID_IMMERSION_FACTS','Require a finite signed calibration distance.');
  const focal=fromBinary64(f.reference.signedFocalLength), mm=multiply(absolute(focal),unit);
  if (compare(mm,fromBinary64(1))<0 || compare(mm,fromBinary64(10000))>0)
    fail('UNSUPPORTED_SCOPE','The calibration focal length must have magnitude 1–10000 mm.');
  if (!Array.isArray(f.media) || f.media.length<1 || f.media.length>4) fail('UNSUPPORTED_SCOPE','Declare one to four target media.');
  const targets=new Map();
  for (const medium of f.media) {
    fields(medium,['id','exteriorIndex']);
    if (!validId(medium.id) || targets.has(medium.id)) fail('INVALID_IMMERSION_FACTS','Medium IDs must be valid and unique.');
    targets.set(medium.id,index(medium.exteriorIndex));
  }
  if (!targets.has(q.mediumId)) fail('UNSUPPORTED_SCOPE','The requested medium ID was not supplied.');
  const target=targets.get(q.mediumId), calibration=contrast(glass,reference), changed=contrast(glass,target);
  if (calibration.value.n===0n) fail('INVALID_IMMERSION_FACTS','A matched reference cannot have a finite thin-lens focal length.');
  const base={format:'opticsim-calibrated-lens-immersion-result-v1',kind:q.kind,method:'conditional-analytical',
    native:{status:'not-run'},assumptions:['Fixed thin-lens shape with the same exterior medium on both sides in each configuration.'],
    limitations:['Individual surface radii and finite-thickness focal positions require additional geometry.']};
  const uncertain=()=>({...base,status:'numerically-indeterminate',value:null,reasonCode:'UNRESOLVED_IMMERSION_TRANSFER',
    reason:'Material contrast or focal distance exceeds the numerical qualification policy.'});
  if (calibration.near) return uncertain();
  const description={lensId:f.lensId,mediumId:q.mediumId,lengthUnit:f.lengthUnit};
  if (changed.value.n===0n) return {...base,status:'conditional',value:{...description,state:'afocal',signedFocalLength:null}};
  if (changed.near) return uncertain();
  // Index-weighted focal length calibrates the common curvature difference.
  const result=divide(multiply(multiply(focal,target),calibration.value),multiply(reference,changed.value));
  if (compare(multiply(absolute(result),unit),cap)>0) return uncertain();
  return {...base,status:'conditional',value:{...description,state:result.n>0n?'converging':'diverging',
    signedFocalLength:toBinary64(result)}};
}
