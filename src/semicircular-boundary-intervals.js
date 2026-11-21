import {isRecord} from './qualified-utils.js';
import {classifySnellTransmission,RAD} from './angular-math.js';

export const INTERVAL_FACTS='opticsim-semicircular-boundary-facts-v1';
export const INTERVAL_QUERY='opticsim-semicircular-boundary-query-v1';
const curved='curved-entry-base-interval',flat='flat-entry-arc-transmission-interval';
export function boundaryIntervalCapabilities(){
  return {format:INTERVAL_QUERY,factsFormat:INTERVAL_FACTS,kinds:[curved,flat],
    units:'Signed transverse coordinate divided by hemisphere or half-cylinder radius.',
    entry:'One homogeneous region and one common exterior. Direct first passage only.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,required){
  if(!isRecord(o)||Object.keys(o).some(k=>!required.includes(k)))fail('INVALID_INTERVAL_FACTS','Unexpected boundary-interval field.');
  for(const k of required)if(!Object.hasOwn(o,k))fail('MISSING_FACTS','Missing '+k);
}
function uncertainty(){
  return {status:'numerically-indeterminate',value:null,reasonCode:'UNCERTAIN_BOUNDARY_INTERVAL',
    reason:'Near matching or a critical threshold at the flat/arc joint prevents a stable classification.'};
}
function baseInterval(f,m){
  const a=f.launch;
  const disk=a.kind==='centred-filled-circular-beam';
  let lo,hi;
  if(disk){
    fields(a,['kind','radiusOverGlassRadius']);
    hi=a.radiusOverGlassRadius;lo=-hi;
    if(f.geometry!=='hemisphere-of-revolution')fail('UNSUPPORTED_SCOPE','A circular footprint requires explicit rotational symmetry.');
  }else{
    fields(a,['kind','lowerOverR','upperOverR']);
    if(a.kind!=='meridional-parallel-interval')fail('UNSUPPORTED_SCOPE','Declare an axial parallel beam interval.');
    lo=a.lowerOverR;hi=a.upperOverR;
  }
  if(![lo,hi].every(v=>Number.isFinite(v)&&Math.abs(v)<=.5)||!(hi-lo>=1e-8)||m>1.6)
    fail('UNSUPPORTED_SCOPE','Require a resolved interval within the central half-radius and an index ratio at most 1.6.');
  const ordinate=h=>{
    const incidence=Math.asin(Math.abs(h));
    const beta=classifySnellTransmission(f.exteriorIndex*Math.abs(h),f.exteriorIndex,f.glassIndex,incidence/RAD).out;
    return (h/m)/Math.cos(incidence-beta*RAD);
  };
  const min=ordinate(lo),max=ordinate(hi);
  return {status:'conditional',value:{face:'flat-diameter',coordinate:'signed-world-transverse-offset-over-radius',
    lowerOverR:min,upperOverR:max,...(disk?{firstIncidenceRadiusOverBeamRadius:max/hi}:{})}};
}
function arcInterval(f,m){
  fields(f.launch,['kind','angleFromFlatNormalDeg']);
  const angle=f.launch.angleFromFlatNormalDeg;
  if(f.launch.kind!=='parallel-at-flat-face'||!Number.isFinite(angle)||Math.abs(angle)>60)
    fail('UNSUPPORTED_SCOPE','Require parallel input within 60 degrees of the inward flat-face normal.');
  const beta=classifySnellTransmission(f.exteriorIndex*Math.sin(Math.abs(angle)*RAD),f.exteriorIndex,f.glassIndex,Math.abs(angle)).out;
  const threshold=1/(m*Math.cos(beta*RAD));
  if(Math.abs(threshold-1)<=1e-10)return uncertainty();
  const interior=threshold<1;
  return {status:'conditional',value:{face:'curved-arc',signedInteriorAngleDeg:Math.sign(angle)*beta,
    coordinate:'signed-entry-offset-over-radius',strictTransmission:{lower:interior?-threshold:-1,upper:interior?threshold:1,open:true},
    criticalAbsoluteEntryOffsetOverR:interior?threshold:null,tir:interior?'above-critical-offset-and-below-unit-offset':'none-on-open-diameter'}};
}
export function analyzeBoundaryInterval(f,q){
  if(f?.format!==INTERVAL_FACTS)fail('UNSUPPORTED_FACTS','Explicit semicircular boundary facts required.');
  fields(q,['format','kind']);
  if(q.format!==INTERVAL_QUERY||![curved,flat].includes(q.kind))fail('UNSUPPORTED_QUERY','Unknown boundary interval.');
  fields(f,['format','geometry','glassIndex','exteriorIndex','launch']);
  if(!['hemisphere-of-revolution','meridional-half-disk'].includes(f.geometry))fail('UNSUPPORTED_SCOPE','Specify a homogeneous half-disk section or hemisphere.');
  if(!isRecord(f.launch))fail('INVALID_INTERVAL_FACTS','Expected a launch object.');
  if(![f.exteriorIndex,f.glassIndex].every(n=>Number.isFinite(n)&&n>=1&&n<=4)||f.glassIndex<=f.exteriorIndex)
    fail('UNSUPPORTED_SCOPE','Require absolute indices in [1,4] with a denser interior.');
  if((q.kind===flat)!==(f.launch.kind==='parallel-at-flat-face'))fail('UNSUPPORTED_SCOPE','The requested interval requires the corresponding entry face.');
  const m=f.glassIndex/f.exteriorIndex;
  const result=q.kind===flat?arcInterval(f,m):baseInterval(f,m);
  return {format:'opticsim-semicircular-boundary-result-v1',kind:q.kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Direct meridional geometrical-optics branch in homogeneous media, with the same exterior at both faces.'],
    limitations:['First-incidence geometry only. Surface visibility, irradiance and reflected branches require additional evidence.'],
    ...(m-1<=1e-10?uncertainty():result)};
}
