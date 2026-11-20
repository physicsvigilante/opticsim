// Source-bound two-point-source ideal converging-lens inverse.
// Strict conditional Gaussian/paraxial model ONLY. Does not simulate rays.
// Sources have axial positions 0 and +d. Candidate lens lies between them;
// illumination travels toward the lens from opposite directions.
// For d>2f finite solutions satisfy 2a(d-a)=fd. Real and virtual image
// positions may coincide numerically; this is NOT a detected optical image.
export const COINCIDENCE_QUERY_FORMAT='opticsim-two-source-lens-coincidence-v1';
export const COINCIDENCE_RESULT_FORMAT='opticsim-two-source-lens-coincidence-result-v1';
const SCALES=Object.freeze({mm:1,cm:10,m:1000});
const INPUT_BOUND_MM=10000,MIN_LENGTH_MM=1;
const REPORT_IMAGE_BOUND_MM=100000000;
const DOUBLE_ROOT_RELATIVE_GUARD=1e-8;
const FOCAL_DENOMINATOR_RELATIVE_GUARD=1e-10;
const own=(q,k)=>Object.prototype.hasOwnProperty.call(q,k);
const record=q=>q!==null&&typeof q==='object'&&!Array.isArray(q);
function reject(code,message){const e=new Error(message);e.code=code;throw e;}
function requireExact(q,allowed,required){
 if(!record(q))reject('INVALID_QUERY','A strict JSON object is required');
 const extra=Object.keys(q).filter(k=>!allowed.includes(k));
 if(extra.length)reject('INVALID_QUERY','Unknown fields: '+extra.join(', '));
 const missing=required.filter(k=>!own(q,k));
 if(missing.length)reject('MISSING_FACTS','Required explicit facts: '+missing.join(', '));
}
function lengthMm(value,scale,name){
 if(typeof value!=='number'||!Number.isFinite(value))
  reject('INVALID_FACTS',name+' must be a finite JSON number (not a string, boolean or array)');
 const n=value*scale;
 if(!Number.isFinite(n)||n<MIN_LENGTH_MM||n>INPUT_BOUND_MM)
  reject('UNSUPPORTED_SCOPE',name+' must lie in [1,10000] mm after unit conversion');
 return n;
}
function base(d,f,unit){
 return {
  format:COINCIDENCE_RESULT_FORMAT,
  kind:'coincident-image-lens-placement',
  model:'ideal-thin-lens-paraxial-two-coaxial-opposing-sources',
  lengthUnit:unit,
  status:'conditional',reasonCode:null,reason:null,
  sourceFacts:{source1X:0,source2X:d/SCALES[unit],
   sourceSeparation:d/SCALES[unit],focalLength:f/SCALES[unit],
   sourceSeparationMm:d,focalLengthMm:f},
  method:'conditional-two-opposite-side-thin-lens-conjugate-inverse',
  native:{status:'not-run',observations:null,nativeImageDetected:false},
  interpretation:'source geometry conditional; not independently graded',
  assumptions:[
   'An ideal, stationary, converging thin lens with the same positive focal length for light incident from either side.',
   'Both point sources lie on the principal axis at x=0 and x=+d; the lens is strictly between them.',
   'Light from the left source propagates +x, light from the right source propagates -x toward the lens.',
   'Finite Gaussian/paraxial conjugates use positive distance measured along each corresponding incident-light direction.'
  ],
  limitations:[
   'The statement of source separation and focal length alone does not specify a finite lens aperture, illumination or a detector.',
   'Coincident signed mathematical image positions can pair one virtual image and one real image. Neither is a native reconstructed image.',
   'A virtual image is a backward extension of outgoing rays, NOT a physical detector hit; no ray path or source-specific evidence is synthesized.',
   'No finite aperture, diffraction, aberration, actual eye, power collection, phase coherence or complete 3D imaging claim is made.',
   'Real native illustration needs independently declared finite source, lens and detector apparatus, not source-inferred locations.'
  ]
 };
}
function noFinite(x,code,reason){
 return {...x,status:'no-finite-placement',reasonCode:code,reason,
  value:{placements:[],placementCount:0,finiteImageCoincidence:false,nativeImageDetected:false}};
}
function withheld(x,code,reason){
 return {...x,status:'numerically-indeterminate',reasonCode:code,reason,value:null};
}
export function twoSourceLensCoincidenceCapabilities(){
 return {
  format:COINCIDENCE_QUERY_FORMAT,resultFormat:COINCIDENCE_RESULT_FORMAT,
  kinds:['coincident-image-lens-placement'],
  model:'ideal-thin-lens-paraxial',
  arrangement:'coaxial two sources; lens strictly between; each source illuminates toward lens',
  coordinateConvention:'source-1-at-zero-source-2-at-positive-separation',
  lengthUnits:Object.keys(SCALES),
  requiredFields:['format','kind','model','coordinateConvention','lengthUnit','sourceSeparation','focalLength'],
  lengthBoundsMm:[MIN_LENGTH_MM,INPUT_BOUND_MM],
  statuses:['conditional','no-finite-placement','numerically-indeterminate'],
  numericalPolicy:{relativeDoubleRootGuard:DOUBLE_ROOT_RELATIVE_GUARD,
   relativeFocalDenominatorGuard:FOCAL_DENOMINATOR_RELATIVE_GUARD,
   maximumReportedImageXAbsMm:REPORT_IMAGE_BOUND_MM},
  native:'not-run; separately declared pinned native rays can illustrate real versus virtual branches',
  limitations:base(240,90,'mm').limitations
 };
}
export function analyzeTwoSourceLensCoincidence(q){
 const keys=['format','kind','model','coordinateConvention','lengthUnit','sourceSeparation','focalLength'];
 requireExact(q,keys,keys);
 if(q.format!==COINCIDENCE_QUERY_FORMAT||q.kind!=='coincident-image-lens-placement')
  reject('UNSUPPORTED_QUERY','Supported format and query kind must both be explicit');
 if(q.model!=='ideal-thin-lens-paraxial'||
    q.coordinateConvention!=='source-1-at-zero-source-2-at-positive-separation')
  reject('UNSUPPORTED_SCOPE','Explicit thin-lens model and source coordinate convention are required');
 if(typeof q.lengthUnit!=='string'||!own(SCALES,q.lengthUnit))
  reject('UNSUPPORTED_UNIT','Provide mm, cm or m as one exact JSON string');
 const scale=SCALES[q.lengthUnit];
 const d=lengthMm(q.sourceSeparation,scale,'sourceSeparation');
 const f=lengthMm(q.focalLength,scale,'focalLength');
 const common=base(d,f,q.lengthUnit);
 const distanceFromDoubleRoot=d-2*f;
 if(distanceFromDoubleRoot===0)
  return noFinite(common,'BOTH_OBJECTS_AT_FOCUS',
   'The unique algebraic midpoint is focal for both sources: the images lie at infinity, not at a shared finite image position.');
 const nearThreshold=DOUBLE_ROOT_RELATIVE_GUARD*Math.max(d,2*f,MIN_LENGTH_MM);
 if(Math.abs(distanceFromDoubleRoot)<=nearThreshold)
  return withheld(common,'NEAR_DOUBLE_ROOT',
   'A near-degenerate pair of focal branches has poorly conditioned finite image positions; no reliable finite coincidence certified.');
 if(distanceFromDoubleRoot<0)
  return noFinite(common,'NO_REAL_BETWEEN_SOURCE_ROOTS',
   'Discriminant d(d-2f) is negative: no finite lens placement between the sources can produce a coincident Gaussian image.');
 const discriminant=d*distanceFromDoubleRoot,sqrtD=Math.sqrt(discriminant);
 if(!Number.isFinite(sqrtD))
  return withheld(common,'UNBOUNDED_DISCRIMINANT','The source facts exceed the reliable finite quadratic domain.');
 const roots=[(d-sqrtD)/2,(d+sqrtD)/2],branches=[];
 const denomSafety=FOCAL_DENOMINATOR_RELATIVE_GUARD*Math.max(d,f,1);
 for(const lensX of roots){
  const uLeft=lensX,uRight=d-lensX;
  const denLeft=uLeft-f,denRight=uRight-f;
  if(!(lensX>0&&lensX<d)||Math.abs(denLeft)<=denomSafety||
     Math.abs(denRight)<=denomSafety)
   return withheld(common,'NEAR_FOCAL_CONJUGATE',
    'At least one candidate is at or too near a focal singularity to certify a finite Gaussian image.');
  const vLeft=f*uLeft/denLeft,vRight=f*uRight/denRight;
  // Two independently evaluated Gaussian images in ONE global x coordinate.
  // Right-side incident light travels -x, hence the subtraction there.
  const imageFromLeft=lensX+vLeft,imageFromRight=lensX-vRight;
  const imageFromQuadratic=lensX*d/(2*lensX-d);
  const spread=Math.max(Math.abs(imageFromLeft-imageFromRight),
    Math.abs(imageFromLeft-imageFromQuadratic),
    Math.abs(imageFromRight-imageFromQuadratic));
  const maxPosition=Math.max(Math.abs(imageFromLeft),Math.abs(imageFromRight),
    Math.abs(imageFromQuadratic));
  if(!Number.isFinite(maxPosition)||!Number.isFinite(spread)||
     maxPosition>REPORT_IMAGE_BOUND_MM||spread>1e-8*Math.max(1,maxPosition))
   return withheld(common,'UNBOUNDED_OR_INCONSISTENT_CONJUGATE',
    'The finite-image coordinates are out of range or internally inconsistent near a singular branch.');
  const leftType=vLeft>0?'real':'virtual',rightType=vRight>0?'real':'virtual';
  if(leftType===rightType)
   return withheld(common,'BRANCH_CLASSIFICATION_INCONSISTENT',
    'The declared opposite-side model must not silently convert one real and one virtual image into two physical detector hits.');
  const image=(imageFromLeft+imageFromRight)/2;
  branches.push({
   lensX:lensX/scale,lensXMm:lensX,
   lensDistanceFromSource1:lensX/scale,
   lensDistanceFromSource2:(d-lensX)/scale,
   source1Image:{kind:leftType,
     signedImageDistanceAlongRightwardIncident:vLeft/scale,
     globalImageX:imageFromLeft/scale},
   source2Image:{kind:rightType,
     signedImageDistanceAlongLeftwardIncident:vRight/scale,
     globalImageX:imageFromRight/scale},
   sharedImageX:image/scale,sharedImageXMm:image,
   normalizedGaussianMismatchMm:spread,
   physicalDetectorCoincidenceCertified:false,
   oneRealOneVirtual:true
  });
 }
 branches.sort((a,b)=>a.lensXMm-b.lensXMm);
 return {...common,status:'conditional',reasonCode:null,reason:null,
  value:{placements:branches,placementCount:branches.length,
   lensMustLieBetweenSources:true,
   sameMathematicalPositionPerPlacement:true,
   oneRealOneVirtualPerPlacement:true,nativeImageDetected:false},
  qualification:'Exactly two finite conditional placements for d>2f. Each common mathematical image position is one real and one virtual Gaussian conjugate, not a two-source native detected image.'};
}
