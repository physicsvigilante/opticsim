// Reduced one-plane JEE apparent-depth mathematics. NO native ray tracing,
// observer position, detector, eye, point-image reconstruction or scene creation.
import {isRecord} from './qualified-utils.js';

export const APPARENT_DEPTH_FACTS_FORMAT='opticsim-planar-apparent-depth-facts-v1';
export const APPARENT_DEPTH_QUERY_FORMAT='opticsim-planar-apparent-depth-query-v1';
export const APPARENT_DEPTH_RESULT_FORMAT='opticsim-planar-apparent-depth-result-v1';
export const APPARENT_DEPTH_KIND='paraxial-apparent-depth';

const SCALE=Object.freeze({mm:1,cm:10,m:1000});
const DEPTH_MIN_MM=.01,DEPTH_MAX_MM=10000,OUTPUT_MAX_MM=50000;
const MAX_INCIDENT_DEG=5,MAX_MODEL_DISCREPANCY=.01;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

export class ApparentDepthError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
const refuse=(code,message)=>{throw new ApparentDepthError(code,message);};
function fields(o,allowed,required,label){
  if(o===undefined)refuse('MISSING_FACTS','Missing '+label+'.');
  if(!isRecord(o))refuse('INVALID_FACTS',label+' must be a JSON object.');
  if(Object.keys(o).some(k=>!allowed.includes(k)))
    refuse('INVALID_FACTS','Unsupported field in '+label+'.');
  if(required.some(k=>!own(o,k)))
    refuse('MISSING_FACTS','Missing required field in '+label+'.');
}
function number(v,label,min,max){
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)
    refuse('INVALID_FACTS',label+' must be a finite number in ['+min+', '+max+'].');
  return v;
}
function id(v){
  if(typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v))
    refuse('INVALID_FACTS','The object requires a bounded, stable object ID.');
}
const assumptionList=()=>[
  'The object has a stated positive normal distance from exactly one ideal infinite planar boundary.',
  'The two regions are homogeneous, isotropic and nondispersive with explicitly stated refractive indices.',
  'The paraxial viewing regime is explicitly ASSUMED; no observer position, eye, pupil or ray is provided.'
];
const limitationList=()=>[
  'The result is a conditional near-normal optical relation, not a native ray observation or a measured physical image.',
  'No particular eye position, visibility, continuous illumination, power or accuracy of a nonparaxial image is established.',
  'A finite-angle envelope, if present, compares two stipulated symmetric-ray constructions, not viewer error or native numerical uncertainty.'
];
function result(status,value,reasonCode=null,reason=null,{cone=false,equal=false}={}){
  const warnings=[
    'Conditional paraxial apparent depth only; no physical image or observer was measured.',
    cone?'The angle-envelope difference is between stipulated geometric constructions; not numerical accuracy or pupil uncertainty.':
      'No quantitative finite-angle viewing regime or approximation-error bound was supplied.',
    ...(equal?['Equal indices imply undeviated ray continuation, not formation of a detected virtual image.']:[])
  ];
  return {
    format:APPARENT_DEPTH_RESULT_FORMAT,kind:APPARENT_DEPTH_KIND,
    status,method:'conditional-analytical-paraxial',value,reasonCode,reason,
    assumptions:assumptionList(),limitations:limitationList(),
    qualification:{basis:'assumption-dependent',warnings},
    native:{status:'not-run',observations:null},
    nativeObservation:false,nativeImageDetected:false,
    interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'
  };
}
export function apparentDepthCapabilities(){
  return structuredClone({
    format:APPARENT_DEPTH_QUERY_FORMAT,factsFormat:APPARENT_DEPTH_FACTS_FORMAT,
    resultFormat:APPARENT_DEPTH_RESULT_FORMAT,kinds:[APPARENT_DEPTH_KIND],
    physicalInput:'Explicit real object normalDepth, mm/cm/m, two refractive indices in [1,4], and the declared paraxial viewing assumption. Not a native scene.',
    model:'One ideal infinite plane. Conditional d_apparent = d_real * n_receiving / n_object. No actual observer point or image detection.',
    optionalCone:'If explicitly stated, object-medium maxIncidentAngleDeg must be >0 and <=5 and the paraxial-vs-symmetric construction difference <=1%; otherwise the entire scalar calculation is withheld.',
    bounds:{normalDepthMm:[DEPTH_MIN_MM,DEPTH_MAX_MM],refractiveIndex:[1,4],
      maxIncidentAngleDeg:MAX_INCIDENT_DEG,maxRelativeConstructionDifference:MAX_MODEL_DISCREPANCY,
      maxOutputDepthMm:OUTPUT_MAX_MM},
    native:'not-run; authoring a complete scene is separate, never inferred from these facts',
    limitations:limitationList()
  });
}
export function analyzePlanarApparentDepthQuery(facts,query){
  fields(query,['format','kind'],['format','kind'],'apparent-depth query');
  if(query.format!==APPARENT_DEPTH_QUERY_FORMAT||query.kind!==APPARENT_DEPTH_KIND)
    refuse('INVALID_FACTS','Unsupported apparent-depth query format or kind.');
  if(facts?.format!==undefined&&facts.format!==APPARENT_DEPTH_FACTS_FORMAT)
    refuse('UNSUPPORTED_SCOPE','This method requires the explicit planar apparent-depth reduced-facts family, not a substituted scene.');
  fields(facts,['format','lengthUnit','object','media','viewing'],
    ['format','lengthUnit','object','media','viewing'],'apparent-depth facts');
  if(facts.format!==APPARENT_DEPTH_FACTS_FORMAT)
    refuse('INVALID_FACTS','Unsupported apparent-depth facts format.');
  if(!own(SCALE,facts.lengthUnit))refuse('INVALID_FACTS','Explicit lengthUnit must be mm, cm or m.');
  fields(facts.object,['id','normalDepth'],['id','normalDepth'],'object');
  fields(facts.media,['objectIndex','observerIndex'],
    ['objectIndex','observerIndex'],'refractive media');
  fields(facts.viewing,['model','maxIncidentAngleDeg'],['model'],'viewing');
  id(facts.object.id);
  const original=number(facts.object.normalDepth,'object.normalDepth',0,10000);
  const depthMm=original*SCALE[facts.lengthUnit];
  if(!Number.isFinite(depthMm)||depthMm<DEPTH_MIN_MM||depthMm>DEPTH_MAX_MM)
    refuse('INVALID_FACTS','Converted real normal depth must be in [0.01,10000] mm.');
  const nObject=number(facts.media.objectIndex,'media.objectIndex',1,4);
  const nReceiving=number(facts.media.observerIndex,'media.observerIndex',1,4);
  if(facts.viewing.model!=='paraxial')
    return result('unavailable',null,'UNSUPPORTED_VIEWING_MODEL',
      'The only admitted viewing model is an explicitly assumed paraxial one.');
  const hasCone=own(facts.viewing,'maxIncidentAngleDeg'),equal=nObject===nReceiving;
  let imax=null;
  if(hasCone){
    imax=number(facts.viewing.maxIncidentAngleDeg,'viewing.maxIncidentAngleDeg',0,90);
    if(imax===0)refuse('INVALID_FACTS','A supplied maximum incidence angle must be strictly positive.');
    if(imax>MAX_INCIDENT_DEG)
      return result('unavailable',null,'OUTSIDE_PARAXIAL_DOMAIN',
        'The declared object-medium cone is wider than the admitted 5 degree near-normal model.',{cone:true,equal});
  }
  const factor=nReceiving/nObject,paraxial=depthMm*factor;
  if(!(Number.isFinite(paraxial)&&paraxial>0))
    return result('numerically-indeterminate',null,'UNSTABLE_PARAXIAL_RESULT',
      'No reliable finite positive analytical depth could be computed.',{cone:hasCone,equal});
  if(paraxial>OUTPUT_MAX_MM)
    return result('unavailable',null,'OUTSIDE_DERIVED_DEPTH_ENVELOPE',
      'The derived depth exceeds the bounded output range.',{cone:hasCone,equal});
  let envelope=null;
  if(hasCone){
    const theta=imax*Math.PI/180,r=nObject/nReceiving;
    const transmittedSine=r*Math.sin(theta);
    // Within the admitted 5 degree cone and index range [1,4] this is
    // <0.349; no grazing/critical boundary is approached or clipped.
    if(!(transmittedSine<1&&Math.cos(theta)>0))
      return result('unavailable',null,'NONTRANSMITTING_CONE',
        'The declared angular cone cannot support a stable propagating transmission.',{cone:true,equal});
    const symmetric=equal?depthMm:
      paraxial*Math.sqrt((1-transmittedSine)*(1+transmittedSine))/Math.cos(theta);
    if(!(Number.isFinite(symmetric)&&symmetric>0))
      return result('numerically-indeterminate',null,'UNSTABLE_PARAXIAL_RESULT',
        'No stable finite symmetric-ray comparison exists.',{cone:true,equal});
    if(symmetric>OUTPUT_MAX_MM)
      return result('unavailable',null,'OUTSIDE_DERIVED_DEPTH_ENVELOPE',
        'The conditional symmetric-ray depth is outside the output bound.',{cone:true,equal});
    const discrepancy=Math.abs(symmetric-paraxial)/paraxial;
    if(!Number.isFinite(discrepancy))
      return result('numerically-indeterminate',null,'UNSTABLE_PARAXIAL_RESULT',
        'The relative model-construction difference is nonfinite.',{cone:true,equal});
    if(discrepancy>MAX_MODEL_DISCREPANCY)
      return result('unavailable',null,'PARAXIAL_CONSTRUCTION_DISCREPANCY',
        'The stated cone changes the stipulated symmetric-ray depth by more than 1% of the paraxial limit.',{cone:true,equal});
    envelope={maxObjectIncidenceDeg:imax,
      rangeMm:[Math.min(paraxial,symmetric),Math.max(paraxial,symmetric)],
      maxDifferenceFromParaxialMm:Math.abs(symmetric-paraxial)};
  }
  return result('conditional',{
    realNormalDepthMm:depthMm,estimatedNormalDepthMm:paraxial,
    depthFactor:factor,symmetricAngleEnvelope:envelope
  },null,null,{cone:hasCone,equal});
}
