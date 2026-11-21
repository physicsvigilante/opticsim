import {isRecord} from './qualified-utils.js';
import {analyzeCurvedMirrorQuery,CURVED_FACTS_FORMAT,CURVED_QUERY_FORMAT} from './curved-mirror-queries.js';

export const MIRROR_MAGNIFICATION_FACTS='opticsim-mirror-magnification-facts-v1';
export const MIRROR_MAGNIFICATION_QUERY='opticsim-mirror-magnification-query-v1';
const kind='mirror-object-distance-from-magnification';
const model='paraxial-mirror-real-object-inverse';
const units=Object.freeze({mm:1,cm:10,m:1000});
export function mirrorMagnificationCapabilities(){
  return {format:MIRROR_MAGNIFICATION_QUERY,factsFormat:MIRROR_MAGNIFICATION_FACTS,kinds:[kind],model,
    signConvention:'Distances positive toward the object. Positive focal length concave, negative convex.',
    target:['signed','magnitude']};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_MIRROR_MAGNIFICATION_FACTS','Unexpected mirror inverse field.');
  for(const key of keys)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
function pursue(f,m,scale){
  const distance=f.focalLength*((m-1)/m);
  if(distance===0)return {signedMagnification:m,status:'unavailable',reasonCode:'OBJECT_ON_POLE'};
  if(distance<0)return {signedMagnification:m,status:'unavailable',reasonCode:'VIRTUAL_OBJECT_REQUIRED'};
  const image=f.focalLength*(1-m);
  const guarded={signedMagnification:m,status:'numerically-indeterminate',reasonCode:'UNRESOLVED_INVERSE_DISTANCE'};
  if(distance*scale<.01||Math.max(distance,Math.abs(image))*scale>1e6)return guarded;
  const result=analyzeCurvedMirrorQuery({format:CURVED_FACTS_FORMAT,model:'spherical-paraxial',
    signConvention:'real-positive-local',lengthUnit:f.lengthUnit,focalLength:f.focalLength,
    objectDistance:distance},{format:CURVED_QUERY_FORMAT,kind:'curved-mirror-image'});
  if(result.status!=='conditional'||result.value.imageDistance===null||
    Math.abs(result.value.magnification-m)>1e-8*Math.abs(m))return guarded;
  return {signedMagnification:m,status:'conditional',objectDistance:distance,signedImageDistance:image,
    imageKind:image>0?'real':'virtual',orientation:m>0?'upright':'inverted'};
}
export function analyzeMirrorMagnification(f,q){
  if(f?.format!==MIRROR_MAGNIFICATION_FACTS)fail('UNSUPPORTED_FACTS','Explicit mirror focal length and magnification facts required.');
  fields(q,['format','kind']);
  if(q.format!==MIRROR_MAGNIFICATION_QUERY||q.kind!==kind)fail('UNSUPPORTED_QUERY','Unknown mirror magnification inverse.');
  fields(f,['format','model','lengthUnit','focalLength','target']);
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare a real incident-side object and the paraxial spherical mirror model.');
  if(typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('INVALID_MIRROR_MAGNIFICATION_FACTS','Use mm, cm or m.');
  const scale=units[f.lengthUnit];
  if(!Number.isFinite(f.focalLength)||Math.abs(f.focalLength)*scale<1||Math.abs(f.focalLength)*scale>10000)
    fail('UNSUPPORTED_SCOPE','Use a signed focal length with magnitude between 1 and 10000 mm.');
  fields(f.target,['kind','value']);
  const target=f.target.value;
  if(!['signed','magnitude'].includes(f.target.kind)||!Number.isFinite(target)||
    (f.target.kind==='magnitude'&&target<=0))
    fail('INVALID_MIRROR_MAGNIFICATION_FACTS','Provide a finite signed magnification or a positive magnitude.');
  if(Math.abs(target)<.0001||Math.abs(target)>1e6)
    fail('UNSUPPORTED_SCOPE','Declare a signed magnification or positive magnitude from 0.0001 to 1000000.');
  const signs=f.target.kind==='magnitude'?[target,-target]:[target];
  const branches=signs.map(m=>pursue(f,m,scale));
  const candidates=branches.filter(b=>b.status==='conditional');
  const status=candidates.length?'conditional':branches.some(b=>b.status==='numerically-indeterminate')?'numerically-indeterminate':'unavailable';
  return {format:'opticsim-mirror-magnification-result-v1',kind,method:'conditional-analytical',status,
    value:candidates.length?{lengthUnit:f.lengthUnit,candidates}:null,branches,native:{status:'not-run'},
    assumptions:['Real incident-side object, first paraxial spherical mirror conjugate.'],
    limitations:['Size ratio alone has no orientation. Aperture and visibility require separate native evidence.']};
}
