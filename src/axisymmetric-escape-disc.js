// JEE-style axisymmetric escape footprint under a planar refracting surface.
// Pure conditional 3D geometric reasoning, NOT a PhyDemo 3D trace or native
// visibility detector. No exterior absolute material index is silently assumed.
export const ESCAPE_DISC_QUERY_FORMAT='opticsim-axisymmetric-escape-disc-v1';
export const ESCAPE_DISC_RESULT_FORMAT='opticsim-axisymmetric-escape-disc-result-v1';
const MODEL='isotropic-point-planar-interface-axisymmetric-geometric';
const GEOMETRY='centered-opaque-surface-disc-infinite-interface';
const SYMBOLIC='symbolic-escape-disc-radius';
const NUMERIC='numeric-escape-disc-radius';
const scales=Object.freeze({mm:1,cm:10,m:1000});
const RAD=Math.PI/180,DEG=180/Math.PI;
const MIN_DEPTH_MM=1,MAX_DEPTH_MM=10000,MAX_RADIUS_MM=1000000;
const NEAR_EQUAL_INDEX_RELATIVE_GUARD=1e-8;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export class EscapeDiscError extends Error{
 constructor(code,message){super(message);this.name='EscapeDiscError';this.code=code;}
}
const reject=(code,message)=>{throw new EscapeDiscError(code,message);};
function requireFields(input,allowed,required,label){
 if(!object(input))reject('INVALID_QUERY',label+' must be a strict JSON object');
 const extra=Object.keys(input).filter(x=>!allowed.includes(x));
 if(extra.length)reject('INVALID_QUERY','Unsupported '+label+' fields: '+extra.join(', '));
 const missing=required.filter(x=>!own(input,x));
 if(missing.length)reject('MISSING_FACTS','Required '+label+' fields: '+missing.join(', '));
}
const COMMON_FIELDS=['format','kind','model','geometry','emission'];
const COMMON_VALUES={
 format:ESCAPE_DISC_QUERY_FORMAT,
 model:MODEL,geometry:GEOMETRY,emission:'isotropic-point-3d'
};
const ASSUMPTIONS=[
 'A stationary point source lies at depth h>0 beneath one infinite, flat, horizontal interface between two homogeneous isotropic transparent media.',
 'A truly opaque circular disc is centered vertically above the source and lies exactly in the interface plane; it blocks all upward geometric rays crossing its footprint.',
 'The source emits all azimuths; every meridional cross-section shares the same polar incidence angle from the upward normal.',
 'Only single-interface direct geometrical rays are considered. There are no other escape paths, mirrors, scattering, diffraction or edge diffraction.'
];
const LIMITS=[
 'The 3D escape cone is established by rotational symmetry and Snell/TIR geometry, NOT by a two-dimensional PhyDemo simulation.',
 'This geometric disc-covering criterion is not a measured observer visibility test or human-eye result; it omits diffraction, scattering, reflections from other surfaces, partial radiometric throughput and disc-edge optics.',
 'For an interior index no greater than the exterior index, unbounded near-grazing surface intersections imply no finite disc radius in the stated infinite-plane model.',
 'The limiting critical ray has no certified propagating external transmitted path; the radius is a mathematical supremum and equality is sufficient for covering the strictly transmitting set.',
 'Numeric absolute refractive indices must be explicit in [1,4]. Symbolic mu and n_outside are not numbers and cannot be converted to an original JEE numeric answer without actual inputs.',
 'The original symbolic J11 is not independently graded or marked fully simulated; no physical opaque disc, observer, image, pupil or detector is constructed here.'
];
function base(kind){
 return {
  format:ESCAPE_DISC_RESULT_FORMAT,kind,model:MODEL,geometry:GEOMETRY,emission:'isotropic-point-3d',
  status:'conditional',reasonCode:null,reason:null,
  method:'conditional-axisymmetric-geometrical-escape-cone',
  native:{status:'not-run',observations:null,native3DVisibilityCertified:false,
   physicalDiscSimulated:false,nativeImageDetected:false},
  originalJeeQuestionSolved:false,
  assumptions:[...ASSUMPTIONS],limitations:[...LIMITS],
  numericalPolicy:{
   absoluteIndexBounds:[1,4],depthMmBounds:[MIN_DEPTH_MM,MAX_DEPTH_MM],
   nearEqualIndexRelativeGuard:NEAR_EQUAL_INDEX_RELATIVE_GUARD,
   maximumReportedDiscRadiusMm:MAX_RADIUS_MM,
   note:'Conservative admission/refusal policy; not a universal physical accuracy or eye-observation guarantee.'},
  value:null
 };
}
const refuse=(base,status,reasonCode,reason)=>({...base,status,reasonCode,reason,value:null});
export function escapeDiscCapabilities(){
 return {
  format:ESCAPE_DISC_QUERY_FORMAT,resultFormat:ESCAPE_DISC_RESULT_FORMAT,
  kinds:[SYMBOLIC,NUMERIC],model:MODEL,geometry:GEOMETRY,emission:'isotropic-point-3d',
  sharedFields:[...COMMON_FIELDS],
  symbolicFields:['depthSymbol','insideIndexSymbol','outsideIndexSymbol'],
  numericRequired:['lengthUnit','depth','insideIndex'],
  numericOptional:['outsideIndex'],
  statuses:['symbolic-conditional','needs-information','conditional','no-finite-coverage','numerically-indeterminate'],
  geometryRelations:[
   'For insideIndex>outsideIndex: thetaCritical = asin(outsideIndex/insideIndex).',
   'At source depth h, surface intersection radius r(theta)=h*tan(theta), independent of azimuth.',
   'Minimum covering disc radius R=h*tan(thetaCritical)=h*outsideIndex/sqrt(insideIndex^2-outsideIndex^2).',
   'An opaque centered disc of radius R covers all strictly transmitting geometric rays; actual 3D visibility has not been measured.',
   'For insideIndex<=outsideIndex on an infinite plane there is no finite covering radius.'
  ],
  native:'not-run; separate real native 2D cross-section test cannot certify 3D visibility',
  limitations:[...LIMITS],
  numericalPolicy:base(NUMERIC).numericalPolicy
 };
}
export function analyzeEscapeDisc(input){
 if(!object(input))reject('INVALID_QUERY','Expected a strict JSON escape-disc query');
 const kind=input.kind;
 if(![SYMBOLIC,NUMERIC].includes(kind))
  reject('UNSUPPORTED_QUERY','Specify a supported symbolic or numeric disc-escape query kind');
 const modeFields=kind===SYMBOLIC?['depthSymbol','insideIndexSymbol','outsideIndexSymbol']:
  ['lengthUnit','depth','insideIndex','outsideIndex'];
 const mandatory=[...COMMON_FIELDS,...(kind===SYMBOLIC?modeFields:['lengthUnit','depth','insideIndex'])];
 requireFields(input,[...COMMON_FIELDS,...modeFields],mandatory,'escape-disc query');
 for(const [key,value] of Object.entries(COMMON_VALUES)){
  if(input[key]!==value)reject('UNSUPPORTED_SCOPE','Explicit supported '+key+' is required');
 }
 const result=base(kind);
 if(kind===SYMBOLIC){
  for(const [key,value] of [
   ['depthSymbol','h'],['insideIndexSymbol','mu'],['outsideIndexSymbol','n_outside']]){
   if(input[key]!==value)
    reject('UNSUPPORTED_SCOPE','Symbolic model must declare '+key+' exactly as '+value+' without substituting a numeric environment');
  }
  return {...result,status:'symbolic-conditional',
   value:{
    depthSymbol:'h',insideIndexSymbol:'mu',outsideIndexSymbol:'n_outside',
    criticalAngleExpression:'asin(n_outside/mu)',
    minimumRadiusExpression:'h*n_outside/sqrt(mu^2-n_outside^2)',
    domain:'h>0 and mu>n_outside>0, homogeneous infinite planar interface',
    noFiniteRadiusWhen:'mu<=n_outside (no total-internal-reflection escape cutoff)',
    coveringCondition:'discRadius >= minimumRadiusExpression',
    exteriorIndexNumericallySpecified:false,
    numericalRadius:null,
    threeDimensionalSymmetryArgument:'Every azimuth shares the same escape-cone half-angle, so the union of strictly transmitting surface intersections is a circular open footprint.',
    actual3DVisibilityMeasured:false,sourceQuestionNumericallySolved:false
   },
   qualification:'Symbolic conditional 3D escape cone only; numeric h, mu and exterior index were not stated and cannot be inferred.'};
 }
 if(typeof input.lengthUnit!=='string'||!own(scales,input.lengthUnit))
  reject('UNSUPPORTED_UNIT','lengthUnit must explicitly be mm, cm or m');
 if(typeof input.depth!=='number'||!Number.isFinite(input.depth))
  reject('INVALID_FACTS','depth must be an explicit finite JSON number');
 const depthMm=input.depth*scales[input.lengthUnit];
 if(!Number.isFinite(depthMm)||depthMm<MIN_DEPTH_MM||depthMm>MAX_DEPTH_MM)
  reject('UNSUPPORTED_SCOPE','Source depth must be 1–10000 mm after unit conversion');
 for(const key of ['insideIndex',...(own(input,'outsideIndex')?['outsideIndex']:[])]){
  const n=input[key];
  if(typeof n!=='number'||!Number.isFinite(n))
   reject('INVALID_FACTS',key+' must be an explicit finite JSON number');
  if(n<1||n>4)reject('UNSUPPORTED_SCOPE',key+' must be in supported absolute index interval [1,4]');
 }
 const facts={lengthUnit:input.lengthUnit,depth:input.depth,depthMm,
  insideIndex:input.insideIndex,
  outsideIndex:own(input,'outsideIndex')?input.outsideIndex:null};
 const shared={...result,physicalFacts:facts};
 if(!own(input,'outsideIndex')){
  return refuse(shared,'needs-information','MISSING_EXTERIOR_INDEX',
   'The upper medium refractive index is unstated; a numerical 3D escape footprint cannot be certified.');
 }
 const n1=input.insideIndex,n0=input.outsideIndex;
 if(n1<=n0){
  return {...shared,status:'no-finite-coverage',reasonCode:'NO_TIR_ESCAPE_CONE',
   reason:'With insideIndex<=outsideIndex on an infinite interface, no finite disc covers every near-grazing geometric transmitted ray.',
   value:{minimumFiniteDiscRadius:null,finiteDiscSufficient:false,
    escapeFootprintUnbounded:true,nearGrazingLimitNotMeasured:true,
    actual3DVisibilityMeasured:false,originalJeeSolved:false}};
 }
 const contrast=(n1-n0)/Math.max(n1,n0);
 if(contrast<=NEAR_EQUAL_INDEX_RELATIVE_GUARD)
  return refuse(shared,'numerically-indeterminate','NEAR_EQUAL_INDEX_ESCAPE_BOUNDARY',
   'Media are too close in index for a reliably bounded disc-radius result under the declared numerical policy.');
 const delta=(n1-n0)*(n1+n0);
 const minimumRadiusMm=depthMm*n0/Math.sqrt(delta);
 const criticalAngleDeg=Math.asin(n0/n1)*DEG;
 if(!Number.isFinite(minimumRadiusMm)||!Number.isFinite(criticalAngleDeg)||
    minimumRadiusMm>MAX_RADIUS_MM)
  return refuse(shared,'numerically-indeterminate','UNBOUNDED_OR_UNRELIABLE_RADIUS',
   'The limiting footprint exceeds the reliable finite reporting domain.');
 const radius=input.lengthUnit==='mm'?minimumRadiusMm:
  minimumRadiusMm/scales[input.lengthUnit];
 return {...shared,status:'conditional',value:{
  minimumDiscRadius:radius,minimumDiscRadiusMm:minimumRadiusMm,
  lengthUnit:input.lengthUnit,criticalAngleDeg,
  insideIndex:n1,outsideIndex:n0,sourceDepthMm:depthMm,
  radiusOverDepth:n0/Math.sqrt(delta),
  strictlyTransmittingSurfacePointsInsideRadius:true,
  discRadiusAtOrAboveLimitCoversAllGeometricEscapingRays:true,
  actual3DVisibilityMeasured:false,nativeDiscSimulated:false,
  criticalBoundaryAPropagatingRayCertified:false,
  originalJeeSolved:false
 },qualification:'Conditionally sufficient geometric 3D circular surface coverage. Native 3D visibility, complete Fresnel power and human observation are not certified.'};
}
