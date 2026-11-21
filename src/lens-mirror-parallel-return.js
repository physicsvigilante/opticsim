import {isRecord} from './qualified-utils.js';
import {add,compare,fromBinary64,multiply,toBinary64} from './binary64-rational.js';

export const PARALLEL_RETURN_FACTS='opticsim-lens-mirror-parallel-return-facts-v1';
export const PARALLEL_RETURN_QUERY='opticsim-lens-mirror-parallel-return-query-v1';
const kind='parallel-return-mirror-placements';
const model='coaxial-positive-thin-lens-and-facing-concave-mirror-in-air';
const units={mm:1,cm:10,m:1000};
export function parallelReturnCapabilities(){
  return {format:PARALLEL_RETURN_QUERY,factsFormat:PARALLEL_RETURN_FACTS,kinds:[kind],model,
    incidence:'collimated-along-axis',lengthUnits:Object.keys(units),reference:'lens plane to mirror pole'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(value,keys){
  if(!isRecord(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('INVALID_PARALLEL_RETURN_FACTS','Unexpected parallel-return field.');
  for(const k of keys)if(!Object.hasOwn(value,k))fail('MISSING_FACTS','Supply '+k+'.');
}
function opticalLength(x,unit){
  if(!Number.isFinite(x))fail('INVALID_PARALLEL_RETURN_FACTS','Optical dimensions must be finite.');
  const value=fromBinary64(x), mm=multiply(value,unit);
  if(compare(mm,fromBinary64(1))<0||compare(mm,fromBinary64(10000))>0)
    fail('UNSUPPORTED_SCOPE','Use positive optical dimensions from 1 through 10000 mm.');
  return value;
}
export function analyzeParallelReturn(f,q){
  fields(q,['format','kind']);
  if(q.format!==PARALLEL_RETURN_QUERY||q.kind!==kind)fail('UNSUPPORTED_QUERY','Unknown parallel-return query.');
  if(f?.format!==PARALLEL_RETURN_FACTS)fail('UNSUPPORTED_FACTS','Supply the lens and mirror and declare axial collimated input.');
  fields(f,['format','model','incidence','lengthUnit','lens','mirror']);
  if(f.model!==model||f.incidence!=='collimated-along-axis')fail('UNSUPPORTED_MODEL','Use the positive ideal lens and facing concave mirror with axial parallel input in air.');
  if(typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('INVALID_PARALLEL_RETURN_FACTS','Declare mm, cm or m.');
  fields(f.lens,['id','focalLength']); fields(f.mirror,['id','radiusMagnitude']);
  if(![f.lens.id,f.mirror.id].every(id=>typeof id==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id))||f.lens.id===f.mirror.id)
    fail('INVALID_PARALLEL_RETURN_FACTS','Supply distinct stable lens and mirror IDs.');
  const unit=fromBinary64(units[f.lengthUnit]);
  const focal=opticalLength(f.lens.focalLength,unit), radius=opticalLength(f.mirror.radiusMagnitude,unit);
  // The output-slope coefficient factors as -2(1-d/f)[1/f+(1-d/f)/R].
  // Positive f and R give two distinct positive roots.
  return {format:'opticsim-lens-mirror-parallel-return-result-v1',kind,status:'conditional',method:'conditional-analytical',
    native:{status:'not-run'},assumptions:['First-order propagation along the common axis, with two passes through the same lens.'],
    limitations:['A finite aperture or detector crossing requires an independently specified native arrangement.'],
    value:{lensId:f.lens.id,mirrorId:f.mirror.id,lengthUnit:f.lengthUnit,reference:'lens plane to mirror pole',
      returnedImage:'at-infinity',placements:[
        {branch:'pole-at-lens-focus',gap:toBinary64(focal),returnHeightScale:-1},
        {branch:'centre-at-lens-focus',gap:toBinary64(add(focal,radius)),returnHeightScale:1}
      ]}};
}
