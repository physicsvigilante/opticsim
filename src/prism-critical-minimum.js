import {isRecord} from './qualified-utils.js';
import {classifySnellTransmission,RAD} from './angular-math.js';

export const PRISM_LIMIT_FACTS='opticsim-prism-angular-limits-facts-v1';
export const PRISM_LIMIT_QUERY='opticsim-prism-angular-limits-query-v1';
const inverse='prism-index-at-grazing-emergence';
const minimum='prism-minimum-direct-deviation';
const model='homogeneous-denser-prism-direct-transmission';
export function prismLimitCapabilities(){
  return {format:PRISM_LIMIT_QUERY,factsFormat:PRISM_LIMIT_FACTS,kinds:[inverse,minimum],model,
    material:['grazing-exit-limit','known-index'],convention:'Angles in degrees from face normals. The two exterior indices are equal.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_PRISM_LIMIT_FACTS','Unexpected prism angular-limit field.');
  for(const key of keys)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
const index=n=>Number.isFinite(n)&&n>=1&&n<=4;
function resolveMaterial(material,apex,outside){
  if(material?.kind==='known-index'){
    fields(material,['kind','insideIndex']);
    if(!index(material.insideIndex)||material.insideIndex<=outside)
      fail('UNSUPPORTED_SCOPE','Inside index must exceed the shared exterior index and be at most 4.');
    return {insideIndex:material.insideIndex};
  }
  fields(material,['kind','incidentAngleDeg']);
  const i=material.incidentAngleDeg;
  if(material.kind!=='grazing-exit-limit'||!Number.isFinite(i)||i<0||i>85)
    fail('UNSUPPORTED_SCOPE','Declare exit grazing with incident angle in [0,85] degrees.');
  const s=Math.sin(i*RAD),a=apex*RAD;
  const ratio=Math.hypot(s,(1+s*Math.cos(a))/Math.sin(a));
  const insideIndex=outside*ratio;
  if(!index(insideIndex))fail('UNSUPPORTED_SCOPE','The implied absolute inside index lies outside [1,4].');
  const entry=classifySnellTransmission(outside*s,outside,insideIndex,i);
  const critical=Math.asin(1/ratio)/RAD;
  const second=apex-entry.out;
  const residual=insideIndex*Math.sin(second*RAD)-outside;
  if(!(second>0&&second<90)||Math.abs(residual)>1e-10||
      Math.abs(second-critical)>1e-8)return null;
  return {insideIndex,grazingIncidenceAngleDeg:i,firstInternalAngleDeg:entry.out,criticalInternalAngleDeg:second};
}
function uncertain(){
  return {status:'numerically-indeterminate',value:null,reasonCode:'UNCERTAIN_PRISM_LIMIT',
    reason:'Near index matching or the critical boundary prevents a stable result.'};
}
export function analyzePrismLimit(f,q){
  if(f?.format!==PRISM_LIMIT_FACTS)fail('UNSUPPORTED_FACTS','Explicit prism angular-limit facts required.');
  fields(q,['format','kind']);
  if(q.format!==PRISM_LIMIT_QUERY||![inverse,minimum].includes(q.kind))fail('UNSUPPORTED_QUERY','Unknown prism angular-limit query.');
  fields(f,['format','model','apexAngleDeg','outsideIndex','material']);
  const a=f.apexAngleDeg,outside=f.outsideIndex;
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare the nonnegative direct two-face branch in a denser homogeneous prism.');
  if(!Number.isFinite(a)||a<1||a>85||!index(outside))fail('UNSUPPORTED_SCOPE','Use apex angle 1–85 degrees and explicit exterior index in [1,4].');
  if(q.kind===inverse&&f.material?.kind!=='grazing-exit-limit')fail('UNSUPPORTED_SCOPE','The inverse requires an exact grazing-exit premise.');
  const composition=resolveMaterial(f.material,a,outside);
  const base={format:'opticsim-prism-angular-limits-result-v1',kind:q.kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['The nonnegative direct two-face branch has equal exterior indices and a denser prism.'],
    limitations:['Finite face reach and any other reflected or transmitted path require separate geometry and evidence.']};
  if(!composition||composition.insideIndex/outside-1<=1e-10)return {...base,...uncertain()};
  const {insideIndex}=composition;
  if(q.kind===inverse)return {...base,status:'conditional',value:{...composition,relativeIndex:insideIndex/outside,
    emergenceAngleLimitDeg:90,boundary:'critical-limit'}};
  const symmetric=classifySnellTransmission(insideIndex*Math.sin(a*RAD/2),insideIndex,outside,a/2);
  if(symmetric.uncertainCritical)return {...base,...uncertain()};
  if(symmetric.tir||symmetric.out===null)return {...base,status:'unavailable',value:null,
    reasonCode:'NO_STRICT_DIRECT_BRANCH',reason:'A strictly transmitted direct branch cannot reach both faces at this index ratio and apex.'};
  return {...base,status:'conditional',value:{insideIndex,incidenceAngleDeg:symmetric.out,emergenceAngleDeg:symmetric.out,
    internalAngleDeg:a/2,minimumDeviationDeg:2*symmetric.out-a}};
}
