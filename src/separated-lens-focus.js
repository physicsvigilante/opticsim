import {isRecord} from './qualified-utils.js';

export const FOCUS_FACTS='opticsim-separated-lens-focus-facts-v1';
export const FOCUS_QUERY='opticsim-separated-lens-focus-query-v1';
const kind='two-lens-angular-focus';
const model='positive-thin-lens-pair-in-air';
const units={mm:.001,cm:.01,m:1};
export function focusCapabilities(){
  return {format:FOCUS_QUERY,factsFormat:FOCUS_FACTS,kinds:[kind],model,
    given:['object-distance-from-objective','lens-plane-separation','focal-plane-interval'],
    angleReference:['objective-plane','eyepiece-plane','specified-viewing-distance'],
    output:'collimated',lengthUnits:Object.keys(units)};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_FOCUS_FACTS','Unexpected field in separated-lens facts.');
  for(const k of keys)if(!Object.hasOwn(o,k))fail('MISSING_FACTS','Missing '+k);
}
function positive(value,scale){
  if(!Number.isFinite(value)||value*scale<.001||value*scale>1e6)
    fail('INVALID_FOCUS_FACTS','Lengths must be positive and within 0.001 to 1,000,000 metres.');
  return value;
}
export function analyzeFocus(f,q){
  fields(q,['format','kind']);
  if(q.format!==FOCUS_QUERY||q.kind!==kind)fail('UNSUPPORTED_QUERY','Unknown separated-lens focus request.');
  if(f?.format!==FOCUS_FACTS)fail('UNSUPPORTED_FACTS','Supply explicit separated-lens focus facts.');
  fields(f,['format','model','lengthUnit','objective','eyepiece','output','given','angleReference']);
  if(f.model!==model||f.output!=='collimated')fail('UNSUPPORTED_MODEL','Require two positive ideal lenses in unit-index air with collimated output.');
  if(typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('INVALID_FOCUS_FACTS','Use mm, cm or m.');
  const scale=units[f.lengthUnit];
  for(const lens of [f.objective,f.eyepiece]){
    fields(lens,['id','focalLength']);
    if(typeof lens.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(lens.id))fail('INVALID_FOCUS_FACTS','Invalid optical element ID.');
    positive(lens.focalLength,scale);
  }
  if(f.objective.id===f.eyepiece.id)fail('INVALID_FOCUS_FACTS','Objective and eyepiece require distinct IDs.');
  fields(f.given,['kind','value']);
  const {kind:given,value}=f.given;
  if(!focusCapabilities().given.includes(given))fail('UNSUPPORTED_SCOPE','Specify the tube-length convention or the object distance.');
  const atInfinity=given==='object-distance-from-objective'&&value==='infinity';
  if(!atInfinity)positive(value,scale);
  const ref=f.angleReference?.kind;
  fields(f.angleReference,ref==='specified-viewing-distance'?['kind','distance']:['kind']);
  if(!focusCapabilities().angleReference.includes(ref))fail('UNSUPPORTED_SCOPE','Specify the unaided angular reference.');
  if(ref==='specified-viewing-distance'){
    positive(f.angleReference.distance,scale);
    if(atInfinity)fail('UNSUPPORTED_SCOPE','A finite viewing-distance reference requires a finite object.');
  }
  const base={format:'opticsim-separated-lens-focus-result-v1',kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:[model,'Stationary objective, downstream eyepiece, common optical axis, real intermediate image and collimated output.'],
    limitations:['First-order signed angular gain for the declared comparison angle. Finite pupil and aperture illumination are unverified.']};
  const fo=f.objective.focalLength,fe=f.eyepiece.focalLength;
  const farSpacing=fo+fe;
  const uncertain=()=>({...base,status:'numerically-indeterminate',value:null,reasonCode:'ILL_CONDITIONED_FOCUS',
    reason:'The input or derived conjugates lie too near the branch boundary or outside the qualified numerical range.'});
  let delta=0,u=value;
  // delta is the interval between the rear objective and front eyepiece
  // focal planes. With collimated output it is also the shift from far focus.
  if(!atInfinity){
    if(given==='object-distance-from-objective'){
      if(Math.abs(u-fo)<=1e-10*Math.max(u,fo))return uncertain();
      if(u<fo)fail('UNSUPPORTED_SCOPE','The objective must form a real intermediate image.');
      delta=fo*fo/(u-fo);
    }else{
      delta=given==='focal-plane-interval'?value:value-farSpacing;
      if(Math.abs(delta)<=1e-10*Math.max(value,farSpacing))return uncertain();
      if(delta<0)fail('UNSUPPORTED_SCOPE','This spacing cannot focus a finite real object on the supported branch.');
      u=fo+fo*fo/delta;
    }
    if(delta<=1e-10*farSpacing||u-fo<=1e-10*u||u*scale>1e6)return uncertain();
  }
  const v=fo+delta,spacing=v+fe;
  if(spacing*scale>1e6)return uncertain();
  let gain=-v/fe;
  if(ref==='specified-viewing-distance')gain=-delta/fo*f.angleReference.distance/fe;
  else if(ref==='eyepiece-plane'&&!atInfinity)gain*=1+spacing/u;
  return {...base,status:'conditional',value:{objectiveId:f.objective.id,eyepieceId:f.eyepiece.id,
    lengthUnit:f.lengthUnit,objectDistanceFromObjective:u,intermediateDistanceFromObjective:v,
    lensPlaneSeparation:spacing,farFocusSeparation:farSpacing,eyepieceShiftFromFarFocus:delta,
    angleReference:{...f.angleReference},signedAngularGain:gain,angularGainMagnitude:Math.abs(gain),
    ...(ref==='specified-viewing-distance'?{}:{farFocusSignedAngularGain:-fo/fe})}};
}
