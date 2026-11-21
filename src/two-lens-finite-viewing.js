import {isRecord} from './qualified-utils.js';
import {calculateLensTrain} from './lens-train-matrix.js';

export const FINITE_VIEW_FACTS='opticsim-two-lens-finite-viewing-facts-v1';
export const FINITE_VIEW_QUERY='opticsim-two-lens-finite-viewing-query-v1';
const forward='two-lens-finite-angular-gain',inverse='two-lens-swap-for-angular-gain';
const model='two-positive-thin-lenses-in-unit-index-air';
const reference='unaided-at-same-eye-and-object-planes';
const swapPolicy='hold-object-distance-and-eye-offset';
const units=Object.freeze({mm:1,cm:10,m:1000});
const relativeLimit=1e-10;
const lengthInScope=length=>Number.isFinite(length)&&length>=1&&length<=10000;
const resolved=(difference,...terms)=>Number.isFinite(difference)&&
  Math.abs(difference)>relativeLimit*Math.max(1,...terms.map(Math.abs));
export function finiteViewingCapabilities(){
  return {format:FINITE_VIEW_QUERY,factsFormat:FINITE_VIEW_FACTS,kinds:[forward,inverse],model,
    reference,swapPolicy,lengthUnits:Object.keys(units),branch:'finite virtual image on the object side of the eyepiece'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(obj,required,optional=[]){
  if(!isRecord(obj)||Object.keys(obj).some(k=>!required.includes(k)&&!optional.includes(k)))
    fail('INVALID_VIEWING_FACTS','Unexpected finite viewing field.');
  for(const key of required)if(!Object.hasOwn(obj,key))fail('MISSING_FACTS','Supply '+key+'.');
}
function lens(item,scale){
  fields(item,['id','focalLength']);
  if(typeof item.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(item.id))
    fail('INVALID_VIEWING_FACTS','Use a stable lens ID.');
  return {id:item.id,focalLength:toMm(item.focalLength,scale)};
}
function toMm(value,scale){
  if(!Number.isFinite(value)||!lengthInScope(value*scale))
    fail('UNSUPPORTED_SCOPE','Use positive explicit lengths of 1–10000 mm.');
  return value*scale;
}
const failure=(status,reasonCode,reason)=>({status,reasonCode,reason,value:null});
const uncertain=()=>failure('numerically-indeterminate','UNRESOLVED_VIEWING_GEOMETRY',
  'A focal, observation-plane or inverse relation is too close to cancellation for a reliable result.');
const unavailable=()=>failure('unavailable','NO_FINITE_VIRTUAL_VIEWING_BRANCH',
  'The two positive lenses must produce a finite virtual final image relative to the eyepiece.');

function geometry(u,e,spacing,objective,eyepiece){
  const {matrix:m}=calculateLensTrain(-u,[{...objective,x:0},{...eyepiece,x:spacing}]);
  const beforeEyepieceD=1-u/objective.focalLength,eyeB=m.b+e*m.d;
  const aD=m.a*m.d,bC=m.b*m.c;
  if(!resolved(m.d,beforeEyepieceD,m.b/eyepiece.focalLength)||
    !resolved(m.b,u,spacing*beforeEyepieceD)||!resolved(eyeB,m.b,e*m.d)||
    !(Math.abs(aD-bC-1)<=1e-8))return uncertain();
  const signedDistanceAtEyepiece=-m.b/m.d;
  if(signedDistanceAtEyepiece>=0)return unavailable();
  const signedDistanceAtEye=-eyeB/m.d,total=u+spacing+e,gain=total/eyeB;
  if(!Number.isFinite(gain)||!Number.isFinite(signedDistanceAtEye)||Math.abs(signedDistanceAtEye)>1e7)return uncertain();
  return {status:'conditional',eyeB,total,gain,spacing,signedDistanceAtEye,signedDistanceAtEyepiece};
}

export function analyzeFiniteViewing(f,q){
  fields(q,['format','kind']);
  if(q.format!==FINITE_VIEW_QUERY||![forward,inverse].includes(q.kind))
    fail('UNSUPPORTED_QUERY','Unknown finite viewing query.');
  if(f?.format!==FINITE_VIEW_FACTS)fail('UNSUPPORTED_FACTS','Supply explicit two-lens finite viewing facts.');
  const required=['format','model','lengthUnit','objective','eyepiece','lensPlaneSeparation','objectDistanceFromObjective',
    'eyeDistanceFromEyepiece','angleReference'];
  if(q.kind===inverse)required.push('swapPolicy');
  fields(f,required,q.kind===forward?['swapPolicy']:[]);
  if(f.model!==model||f.angleReference!==reference)
    fail('UNSUPPORTED_MODEL','Use two separated positive ideal lenses and an unaided angle at the same object and eye planes.');
  if(Object.hasOwn(f,'swapPolicy')&&f.swapPolicy!==swapPolicy)
    fail('UNSUPPORTED_MODEL','Hold the object distance and the eye offset fixed in each arrangement.');
  if(typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('INVALID_VIEWING_FACTS','Use mm, cm or m.');
  const scale=units[f.lengthUnit],objective=lens(f.objective,scale),eyepiece=lens(f.eyepiece,scale);
  if(objective.id===eyepiece.id)fail('INVALID_VIEWING_FACTS','Require two distinct lens IDs.');
  const u=toMm(f.objectDistanceFromObjective,scale),e=toMm(f.eyeDistanceFromEyepiece,scale);
  const spacing=toMm(f.lensPlaneSeparation,scale),initial=geometry(u,e,spacing,objective,eyepiece);
  const base={format:'opticsim-two-lens-finite-viewing-result-v1',kind:q.kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:[model,'Static optical arrangements and an on-axis observation plane with the stated unaided comparison.'],
    limitations:['Signed gain is paraxial. Virtual image distance does not establish eye accommodation, pupil throughput or a native image detection.']};
  if(initial.status!=='conditional')return {...base,...initial};
  const report=(g,a,b)=>({objectiveId:a.id,eyepieceId:b.id,lensPlaneSeparation:g.spacing/scale,
    signedAngularGain:g.gain,signedVirtualDistanceFromEye:g.signedDistanceAtEye/scale,
    signedVirtualDistanceFromEyepiece:g.signedDistanceAtEyepiece/scale});
  const value={lengthUnit:f.lengthUnit,objectDistanceFromObjective:f.objectDistanceFromObjective,
    eyeDistanceFromEyepiece:f.eyeDistanceFromEyepiece,angleReference:reference,initial:report(initial,objective,eyepiece)};
  if(q.kind===forward)return {...base,status:'conditional',value};
  // B at the eye is affine in the lens separation. Equate B/total distance
  // so the two arrangements have the same signed angular gain.
  const a=1-u/eyepiece.focalLength,b=1-e/objective.focalLength;
  const coefficient=b*a,intercept=b*u+e*a;
  const left=initial.total*intercept,right=initial.eyeB*(u+e),linear=initial.total*coefficient;
  const numerator=left-right,denominator=initial.eyeB-linear;
  if(!resolved(numerator,left,right)||!resolved(denominator,initial.eyeB,linear))return {...base,...uncertain()};
  const swappedSpacing=numerator/denominator;
  if(!lengthInScope(swappedSpacing))return {...base,...failure('unavailable','SWAPPED_SEPARATION_OUTSIDE_SCOPE',
    'The equal-gain condition does not yield a positive separated layout within 1–10000 mm.')};
  const swapped=geometry(u,e,swappedSpacing,eyepiece,objective);
  if(swapped.status!=='conditional')return {...base,...swapped};
  if(Math.abs(swapped.gain-initial.gain)>1e-8*Math.abs(initial.gain))return {...base,...uncertain()};
  return {...base,status:'conditional',value:{...value,swapPolicy,swapped:report(swapped,eyepiece,objective)}};
}
