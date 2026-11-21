import {isRecord} from './qualified-utils.js';
import {analyzeCurvedMirrorQuery,CURVED_FACTS_FORMAT,CURVED_QUERY_FORMAT} from './curved-mirror-queries.js';

export const PORT_FACTS='opticsim-mirror-plane-port-facts-v1';
export const PORT_QUERY='opticsim-mirror-plane-port-query-v1';
const [direct,reflected]=['plane-port-direct-conjugate','mirror-plane-return-conjugate'];
const model='concave-mirror-behind-planar-exit';
const units=Object.freeze({mm:1,cm:10,m:1000});
export function mirrorPlanePortCapabilities(){
  return {format:PORT_QUERY,factsFormat:PORT_FACTS,kinds:[direct,reflected],model,
    coordinates:'Positive axial depth into the source medium, with the exit plane as origin.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_MIRROR_PORT_FACTS','Unexpected mirror and plane-exit field.');
  for(const key of keys)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
function validate(f){
  fields(f,['format','model','lengthUnit','objectDepth','poleDepth','curvatureRadius','interiorIndex','exteriorIndex']);
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare an axial paraxial point and concave spherical mirror behind the plane.');
  if(typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('INVALID_MIRROR_PORT_FACTS','Use mm, cm or m.');
  const scale=units[f.lengthUnit];
  const lengths=[f.objectDepth,f.poleDepth,f.curvatureRadius,f.poleDepth-f.objectDepth];
  if(!lengths.every(v=>Number.isFinite(v)&&v*scale>=1&&v*scale<=10000))
    fail('UNSUPPORTED_SCOPE','Object, pole and radius must be explicit and the object must be at least 1 mm from the plane and mirror pole.');
  if(![f.interiorIndex,f.exteriorIndex].every(v=>Number.isFinite(v)&&v>=1&&v<=4))
    fail('UNSUPPORTED_SCOPE','Specify both absolute indices in [1,4].');
  return scale;
}
function uncertain(){
  return {status:'numerically-indeterminate',value:null,reasonCode:'UNCERTAIN_RETURN_CONJUGATE',
    reason:'The reflected result is near the focal or exit plane boundary, or exceeds the conditioning bounds.'};
}
function returnConjugate(f,scale){
  const grid=2**64;
  const [p,x,r]=[f.poleDepth,f.objectDepth,f.curvatureRadius].map(n=>BigInt(n*grid));
  const u=p-x,denominator=2n*u-r,numerator=p*denominator-r*u;
  if(denominator===0n)return {status:'conditional',value:{state:'afocal',signedDepth:null,lengthUnit:f.lengthUnit}};
  if(Math.abs(Number(denominator))<=1e-10*Number(2n*u+r))return uncertain();
  const mirror=analyzeCurvedMirrorQuery({format:CURVED_FACTS_FORMAT,model:'spherical-paraxial',
    signConvention:'real-positive-local',lengthUnit:f.lengthUnit,focalLength:f.curvatureRadius/2,
    objectDistance:f.poleDepth-f.objectDepth},{format:CURVED_QUERY_FORMAT,kind:'curved-mirror-image'});
  if(mirror.status!=='conditional'||mirror.value.imageDistance===null)return uncertain();
  const depth=Number(numerator)/Number(denominator)/grid;
  if(numerator!==0n && Math.abs(depth)<=1e-10*(f.poleDepth+Math.abs(mirror.value.imageDistance)))return uncertain();
  const signedDepth=depth*f.exteriorIndex/f.interiorIndex;
  if(!Number.isFinite(signedDepth)||Math.abs(signedDepth)*scale>1e8)return uncertain();
  return {status:'conditional',value:{state:numerator===0n?'at-exit-plane':signedDepth>0?'virtual-into-body':'real-in-exterior',
    signedDepth,lengthUnit:f.lengthUnit}};
}
export function analyzeMirrorPlanePort(f,q){
  if(f?.format!==PORT_FACTS)fail('UNSUPPORTED_FACTS','Explicit mirror and plane-exit facts required.');
  fields(q,['format','kind']);
  if(q.format!==PORT_QUERY||![direct,reflected].includes(q.kind))fail('UNSUPPORTED_QUERY','Unknown mirror and plane-exit query.');
  const scale=validate(f);
  const value=q.kind===direct?{status:'conditional',value:{state:'virtual-into-body',
    signedDepth:f.objectDepth*f.exteriorIndex/f.interiorIndex,lengthUnit:f.lengthUnit}}:returnConjugate(f,scale);
  return {format:'opticsim-mirror-plane-port-result-v1',kind:q.kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Axial point object, homogeneous source and exterior media, paraxial plane refraction. The return branch has one specular reflection.'],
    limitations:['Finite aperture, observer visibility and the physical size of the scatterer are outside these conjugates.'],
    ...value};
}
