// Conditional paraxial refraction at ONE spherical interface.
// No PhyDemo scene, ray, detector, observer, or image observation is created.
// Positive signed coordinates point along INCIDENT light; the centre of
// curvature is at positive R when it lies on the transmitted side of the pole.
// n2/v - n1/u = (n2 - n1)/R, with u<0 for an admitted real object.
export const SPHERICAL_INTERFACE_QUERY_FORMAT='opticsim-spherical-interface-paraxial-query-v1';
export const SPHERICAL_INTERFACE_RESULT_FORMAT='opticsim-spherical-interface-paraxial-result-v1';

const SCALES=Object.freeze({mm:1,cm:10,m:1000});
const LENGTH_BOUND_MM=10000;
const MIN_RADIUS_MM=1,MIN_OBJECT_DISTANCE_MM=.01;
const MAX_ANALYTICAL_DISTANCE_MM=1e9;
const WEAK_INDEX_DIFFERENCE_REL=1e-12;
const NEAR_CONJUGATE_REL=1e-10;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

function reject(code,message){
 const e=new Error(message);e.code=code;throw e;
}
function fields(x,allowed,required,label){
 if(!isRecord(x))reject('INVALID_QUERY',label+' must be a JSON object');
 const unknown=Object.keys(x).filter(k=>!allowed.includes(k));
 if(unknown.length)reject('INVALID_QUERY',label+' has unknown fields: '+unknown.join(', '));
 const missing=required.filter(k=>!own(x,k));
 if(missing.length)reject('MISSING_FACTS',label+' requires '+missing.join(', '));
}
function number(x,label){
 if(typeof x!=='number'||!Number.isFinite(x))
  reject('INVALID_FACTS',label+' must be an explicitly supplied finite JSON number');
 return x;
}
function materialIndex(x,label){
 const v=number(x,label);
 if(v<1||v>4)reject('UNSUPPORTED_SCOPE',label+' must lie within [1,4]');
 return v;
}
function length(x,scale,label){
 const v=number(x,label)*scale;
 if(!Number.isFinite(v)||Math.abs(v)>LENGTH_BOUND_MM)
  reject('UNSUPPORTED_SCOPE',label+' must fit inside ±10000 mm');
 return v;
}
function base(kind,n1,n2,R,unit){
 return {format:SPHERICAL_INTERFACE_RESULT_FORMAT,kind,
  model:'single-spherical-refracting-interface-paraxial',
  status:'conditional',reasonCode:null,reason:null,
  incidentIndex:n1,transmittedIndex:n2,signedRadiusMm:R,lengthUnit:unit,
  method:'conditional-analytical-spherical-interface-paraxial',
  native:{status:'not-run',observations:null,nativeImageDetected:false},
  interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine',
  assumptions:[
   'Exactly one stationary spherical refracting interface between homogeneous, isotropic nondispersive media.',
   'Strict paraxial/first-order approximation; no finite angle, aperture, ray height or physical observer is specified.',
   'Positive signed distances are along the explicitly defined incident-light direction, measured from the surface pole.',
   'Positive radius means the centre of curvature lies on the transmitted side; a real incident-side object has signed u<0.'
  ],
  limitations:[
   'Analytical surface power and Gaussian conjugate are not a native ray trace or a detector-observed physical image.',
   'A complete glass sphere or circular dielectric has a second interface; this query never silently adds or removes it.',
   'No Fresnel reflection, TIR, vignetting, spherical aberration, diffraction, 3D visibility or eye accommodation is inferred.',
   'Original textbook interpretation and missing exterior-medium index values are never inferred by this calculation.'
  ]};
}
function indeterminate(base,reasonCode,reason){
 return {...base,status:'numerically-indeterminate',reasonCode,reason,value:null};
}
export function sphericalInterfaceCapabilities(){
 return {format:SPHERICAL_INTERFACE_QUERY_FORMAT,
  resultFormat:SPHERICAL_INTERFACE_RESULT_FORMAT,
  kinds:['surface-power','real-object-conjugate'],
  signConvention:'positive-along-incident-light',
  lengthUnits:Object.keys(SCALES),indexBounds:[1,4],
  signedRadiusBoundsMm:[-LENGTH_BOUND_MM,LENGTH_BOUND_MM],
  minimumAbsRadiusMm:MIN_RADIUS_MM,
  minimumRealObjectDistanceMm:MIN_OBJECT_DISTANCE_MM,
  inputFields:['format','kind','signConvention','lengthUnit','incidentIndex',
   'transmittedIndex','signedRadius','signedObjectDistance (conjugate only)'],
  numericalPolicy:{
   nearEqualIndicesRelative:WEAK_INDEX_DIFFERENCE_REL,
   nearConjugateRelative:NEAR_CONJUGATE_REL,
   maximumReportedDistanceMm:MAX_ANALYTICAL_DISTANCE_MM
  },
  statuses:['conditional','numerically-indeterminate'],
  native:'not-run; a separate complete authored native scene is required for optical propagation',
  limitations:base('surface-power',1,1,1,'mm').limitations};
}
export function analyzeSphericalInterface(query){
 fields(query,['format','kind','signConvention','lengthUnit','incidentIndex',
   'transmittedIndex','signedRadius','signedObjectDistance'],
  ['format','kind','signConvention','lengthUnit','incidentIndex',
   'transmittedIndex','signedRadius'],'spherical-interface query');
 if(query.format!==SPHERICAL_INTERFACE_QUERY_FORMAT)
  reject('UNSUPPORTED_QUERY','Unknown spherical-interface query format');
 if(!['surface-power','real-object-conjugate'].includes(query.kind))
  reject('UNSUPPORTED_QUERY','Use surface-power or real-object-conjugate explicitly');
 if(query.signConvention!=='positive-along-incident-light')
  reject('UNSUPPORTED_SCOPE','The explicit positive-along-incident-light convention is required');
 if(typeof query.lengthUnit!=='string'||!own(SCALES,query.lengthUnit))
  reject('UNSUPPORTED_UNIT','Specify mm, cm, or m as a JSON string');
 const scale=SCALES[query.lengthUnit];
 const n1=materialIndex(query.incidentIndex,'incidentIndex');
 const n2=materialIndex(query.transmittedIndex,'transmittedIndex');
 const R=length(query.signedRadius,scale,'signedRadius');
 if(Math.abs(R)<MIN_RADIUS_MM)
  reject('UNSUPPORTED_SCOPE','Nonzero signed radius magnitude must be at least 1 mm');
 if(query.kind==='surface-power'&&own(query,'signedObjectDistance'))
  reject('INVALID_QUERY','Surface power does not accept an object position');
 if(query.kind==='real-object-conjugate'&&!own(query,'signedObjectDistance'))
  reject('MISSING_FACTS','Real-object conjugate requires signedObjectDistance');
 let u=null;
 if(query.kind==='real-object-conjugate'){
  u=length(query.signedObjectDistance,scale,'signedObjectDistance');
  if(u> -MIN_OBJECT_DISTANCE_MM)
   reject('UNSUPPORTED_SCOPE','Only a real incident-side object at u <= -0.01 mm is admitted');
 }
 const common=base(query.kind,n1,n2,R,query.lengthUnit);
 const delta=n2-n1;
 if(delta!==0&&Math.abs(delta)<=WEAK_INDEX_DIFFERENCE_REL*Math.max(n1,n2)){
  return indeterminate(common,'NEAR_EQUAL_INDICES',
   'Index contrast is too small relative to the declared binary64 indices to certify a curved-surface prediction.');
 }
 const p=delta===0?0:delta/R; // canonical +0 for zero contrast, even if R<0
 const powerDiopters=p*1000;
 const focalRaw=delta===0?null:{object:-n1/p,image:n2/p};
 if(focalRaw&&(!Number.isFinite(focalRaw.object)||!Number.isFinite(focalRaw.image)||
   Math.abs(focalRaw.object)>MAX_ANALYTICAL_DISTANCE_MM||
   Math.abs(focalRaw.image)>MAX_ANALYTICAL_DISTANCE_MM)){
  return indeterminate(common,'UNBOUNDED_FOCAL_DISTANCE',
   'Focal distances exceed the bounded analytical reporting domain; no finite focus is certified.');
 }
 const focal={focalStatus:delta===0?'afocal':'finite',
  signedObjectSpaceFocalDistanceMm:focalRaw?.object??null,
  signedImageSpaceFocalDistanceMm:focalRaw?.image??null,
  signedObjectSpaceFocalDistance:focalRaw?focalRaw.object/scale:null,
  signedImageSpaceFocalDistance:focalRaw?focalRaw.image/scale:null};
 const powerValue={powerDiopters,normalizedSurfacePowerPerMm:p,
  ...focal,lengthUnit:query.lengthUnit,nativeImageDetected:false};
 if(query.kind==='surface-power')
  return {...common,value:powerValue,qualification:
   'First-order power of exactly one stated refracting surface; finite-image detection is not asserted.'};
 const objectVergence=n1/u,denominator=p+objectVergence;
 // Zero after floating-point cancellation cannot establish a reliable infinite
 // conjugate; near-zero is also withheld rather than an arbitrary huge image.
 const scaleDen=Math.max(Math.abs(p),Math.abs(objectVergence),1e-15);
 if(!Number.isFinite(denominator)||Math.abs(denominator)<=NEAR_CONJUGATE_REL*scaleDen)
  return indeterminate(common,'NEAR_FOCAL_CONJUGATE',
   'Predicted conjugate lies at or too near a paraxial infinity/cancellation singularity.');
 const v=n2/denominator;
 const m=n1*v/(n2*u);
 if(!Number.isFinite(v)||!Number.isFinite(m)||
  Math.abs(v)>MAX_ANALYTICAL_DISTANCE_MM||Math.abs(m)>1e12)
  return indeterminate(common,'UNBOUNDED_IMAGE_CONJUGATE',
   'Predicted image distance or Gaussian magnification cannot be reported reliably.');
 return {...common,value:{...powerValue,
   signedObjectDistance:u/scale,signedObjectDistanceMm:u,
   signedImageDistance:v/scale,signedImageDistanceMm:v,
   imageKind:v>0?'real':'virtual',
   signedParaxialMagnification:m},
  qualification:'Conditional on one transmitted paraxial pencil at the stated single surface. The signed Gaussian image is not a native or physiological observation.'};
}
