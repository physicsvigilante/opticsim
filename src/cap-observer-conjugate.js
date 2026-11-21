import {isRecord} from './qualified-utils.js';
import {analyzeSphericalInterface,SPHERICAL_INTERFACE_QUERY_FORMAT} from './spherical-interface-paraxial-query.js';

export const CAP_OBSERVER_FACTS='opticsim-cap-observer-facts-v1';
export const CAP_OBSERVER_QUERY='opticsim-cap-observer-query-v1';
const kind='cap-axial-observer-conjugate';
const model='axial-spherical-cap-exit';
const units=Object.freeze({mm:1,cm:10,m:1000});
export function capObserverCapabilities(){
  return {format:CAP_OBSERVER_QUERY,factsFormat:CAP_OBSERVER_FACTS,kinds:[kind],model,
    object:['base-contact-limit','interior-axial-point'],coordinate:'Distances from the base in the forward direction toward the observer.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(v,keys){
  if(!isRecord(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('INVALID_CAP_OBSERVER_FACTS','Unexpected cap observer field.');
  for(const key of keys)if(!Object.hasOwn(v,key))fail('MISSING_FACTS','Missing '+key);
}
export function analyzeCapObserver(f,q){
  if(f?.format!==CAP_OBSERVER_FACTS)fail('UNSUPPORTED_FACTS','Explicit cap and on-axis observer facts required.');
  fields(q,['format','kind']);
  if(q.kind!==kind||q.format!==CAP_OBSERVER_QUERY)fail('UNSUPPORTED_QUERY','Unknown cap observer query.');
  fields(f,['format','model','lengthUnit','curvatureRadius','capHeight','observerDistanceFromBase','interiorIndex','exteriorIndex','object']);
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare a homogeneous spherical cap and the axial paraxial exit branch.');
  if(typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('INVALID_CAP_OBSERVER_FACTS','Use mm, cm or m.');
  const {curvatureRadius:radius,capHeight:height,observerDistanceFromBase:observer,interiorIndex,exteriorIndex}=f;
  const scale=units[f.lengthUnit];
  if(![radius,height,observer].every(v=>Number.isFinite(v)&&v*scale>=1&&v*scale<=10000)||
    height>radius||(observer-height)*scale<1||
    ![interiorIndex,exteriorIndex].every(v=>Number.isFinite(v)&&v>=1&&v<=4)||interiorIndex<exteriorIndex)
    fail('UNSUPPORTED_SCOPE','Use a minor cap or hemisphere, a homogeneous interior at least as dense as the exterior, and an observer at least 1 mm beyond the pole.');
  const object=f.object;
  let objectDepth;
  if(object?.kind==='base-contact-limit'){
    fields(object,['kind']);objectDepth=0;
  }else{
    fields(object,['kind','depthFromBase']);
    objectDepth=object.depthFromBase;
    if(object.kind!=='interior-axial-point'||!Number.isFinite(objectDepth)||objectDepth*scale<.01||(height-objectDepth)*scale<.01)
      fail('UNSUPPORTED_SCOPE','Place the interior point at least 0.01 mm from both the base and pole.');
  }
  const fromPole=height-objectDepth;
  const surface=analyzeSphericalInterface({format:SPHERICAL_INTERFACE_QUERY_FORMAT,kind:'real-object-conjugate',
    signConvention:'positive-along-incident-light',lengthUnit:f.lengthUnit,incidentIndex:interiorIndex,
    transmittedIndex:exteriorIndex,signedRadius:-radius,signedObjectDistance:-fromPole});
  const base={format:'opticsim-cap-observer-result-v1',kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Axial paraxial object and observer. The stated exterior continues from the curved exit to the observer.'],
    limitations:['This conjugate describes apparent position. Table scattering, finite visibility and eye accommodation are not specified.']};
  if(surface.status!=='conditional')
    return {...base,status:surface.status,value:null,reasonCode:surface.reasonCode,reason:surface.reason};
  const contrast=interiorIndex-exteriorIndex;
  const denominator=interiorIndex*radius-contrast*fromPole;
  // Stable form of height + signedImageDistance, including the exact
  // hemispherical centre and matched-medium identities.
  const apparent=(interiorIndex*radius*objectDepth+contrast*fromPole*(radius-height))/denominator;
  return {...base,status:'conditional',value:{lengthUnit:f.lengthUnit,objectModel:object.kind,
    apparentPositionFromBase:apparent,signedImageDistanceFromPole:surface.value.signedImageDistance,
    distanceFromObserver:observer-height-surface.value.signedImageDistance}};
}
