// Bounded plane-parallel glass + backing mirror displacement from reduced
// JEE-like facts. Pure CONDITIONAL geometrical optics. No native ray tracing.
// Source values may omit exterior index: NEVER imply n=1 from a drawing.
export const MIRROR_BACKED_SLAB_QUERY_FORMAT='opticsim-mirror-backed-slab-displacement-v1';
export const MIRROR_BACKED_SLAB_RESULT_FORMAT='opticsim-mirror-backed-slab-result-v1';
const KIND='slab-return-surface-separation';
const MODEL='homogeneous-parallel-slab-ideal-backing-mirror';
const BRANCH='entry-refraction-mirror-return-exit-refraction';
const CONVENTION='normal-into-plate-positive-x-upward-incident';
const scales=Object.freeze({mm:1,cm:10,m:1000});
const MAX_INPUT_MM=10000,MIN_INPUT_MM=1,CRITICAL_SINE_MARGIN=1e-7,MAX_ABS_OUTPUT_MM=100000;
const RAD=Math.PI/180,DEG=180/Math.PI, own=(o,k)=>Object.hasOwn(o,k);
const isObject=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
export class MirrorBackedSlabError extends Error{
 constructor(code,message){super(message);this.name='MirrorBackedSlabError';this.code=code;}
}
const reject=(code,message)=>{throw new MirrorBackedSlabError(code,message);};
const required=['format','kind','model','branchConvention','coordinateConvention','lengthUnit',
 'thickness','insideIndex','incidentAngleDeg'];
const allowed=[...required,'outsideIndex'];
const assumptions=[
 'One ideal plane-parallel homogeneous isotropic plate of declared thickness, with a plane specular mirror in contact with its back face.',
 'The incident ray approaches the front face from the lower-index-UNSPECIFIED exterior, measured at a nonnegative angle from the front-face normal.',
 'The declared single route is entry transmission, ideal back-mirror reflection, and front-face exit transmission; Fresnel partial branches and interference are excluded.',
 'The reported separation is measured along the FRONT face between actual mathematical entry and exit points, not distance between two arbitrarily placed detectors.'
];
const limitations=[
 'The original J08 does not state an exterior absolute refractive index; missing outsideIndex yields needs-information and no numeric surface displacement.',
 'An ideal mirror directly backing the slab is assumed; finite mirror geometry, thickness tolerances, coating loss and any air gap require separately stated physical apparatus.',
 'This reduced model has no source brightness, launch location, finite lateral reach, detector hit, polarization, Fresnel power, wave optics, 3D image or observed native ray route.',
 'The analytical exit ray is the nominal specular conjugate, not a proven native crossing. A separate synthetic PhyDemo scene may illustrate the route without certifying the original question.',
 'The conservative critical-boundary guard and output caps are numerical domain policies, not universal physical accuracy bounds.'
];
const native=()=>({status:'not-run',observations:null,nativePathVerified:false,nativeImageDetected:false});
const common=(q,t)=>({
 format:MIRROR_BACKED_SLAB_RESULT_FORMAT,kind:KIND,model:MODEL,branchConvention:BRANCH,
 coordinateConvention:CONVENTION,lengthUnit:q.lengthUnit,
 status:'conditional',reasonCode:null,reason:null,method:'conditional-parallel-slab-round-trip-Snell-and-specular',
 physicalFacts:{thickness:q.thickness,thicknessMm:t,incidentAngleDeg:q.incidentAngleDeg,
  insideIndex:q.insideIndex,outsideIndex:own(q,'outsideIndex')?q.outsideIndex:null},
 native:native(),originalJeeSolved:false,
 assumptions:[...assumptions],limitations:[...limitations],
 numericalPolicy:{minThicknessMm:MIN_INPUT_MM,maxThicknessMm:MAX_INPUT_MM,
  criticalSineMargin:CRITICAL_SINE_MARGIN,maxAbsoluteDisplacementMm:MAX_ABS_OUTPUT_MM,
  refractiveIndexBounds:[1,4],incidenceBoundsDeg:[0,89]},
 value:null
});
const refused=(b,status,code,reason)=>({...b,status,reasonCode:code,reason,value:null});
export function mirrorBackedSlabCapabilities(){
 const q={lengthUnit:'mm',thickness:60,insideIndex:1.8,incidentAngleDeg:60};
 return {format:MIRROR_BACKED_SLAB_QUERY_FORMAT,resultFormat:MIRROR_BACKED_SLAB_RESULT_FORMAT,
  kinds:[KIND],model:MODEL,branchConvention:BRANCH,coordinateConvention:CONVENTION,
  requiredFields:[...required],optionalFields:['outsideIndex'],
  statuses:['needs-information','conditional','unavailable','numerically-indeterminate'],
  equations:['nOutside*sin(i)=nInside*sin(r)',
   'front-face entry-to-exit displacement=2*thickness*tan(r)',
   'returned exterior heading=180deg-i on stated positive-y entry branch'],
  numericalPolicy:common(q,60).numericalPolicy,
  native:'not-run; finite native source and mirror geometries must be independently authored',
  limitations:[...limitations]};
}
export function analyzeMirrorBackedSlab(q){
 if(!isObject(q))reject('INVALID_QUERY','A strict JSON query object is required');
 const extra=Object.keys(q).filter(k=>!allowed.includes(k));
 if(extra.length)reject('INVALID_QUERY','Unsupported fields: '+extra.join(', '));
 const missing=required.filter(k=>!own(q,k));
 if(missing.length)reject('MISSING_FACTS','Missing required physical facts: '+missing.join(', '));
 if(q.format!==MIRROR_BACKED_SLAB_QUERY_FORMAT||q.kind!==KIND)
  reject('UNSUPPORTED_QUERY','Exact J08-style model format and kind must be supplied');
 if(q.model!==MODEL||q.branchConvention!==BRANCH||q.coordinateConvention!==CONVENTION)
  reject('UNSUPPORTED_SCOPE','Declared ideal plate, backing mirror route and signed coordinate convention are mandatory');
 if(typeof q.lengthUnit!=='string'||!own(scales,q.lengthUnit))
  reject('UNSUPPORTED_UNIT','Explicit lengthUnit must be mm, cm or m');
 if(typeof q.thickness!=='number'||!Number.isFinite(q.thickness))
  reject('INVALID_FACTS','Thickness must be an explicit finite JSON number');
 const thicknessMm=q.thickness*scales[q.lengthUnit];
 if(!Number.isFinite(thicknessMm)||thicknessMm<MIN_INPUT_MM||thicknessMm>MAX_INPUT_MM)
  reject('UNSUPPORTED_SCOPE','Slab thickness must be 1–10000 mm after unit conversion');
 for(const name of ['insideIndex',...(own(q,'outsideIndex')?['outsideIndex']:[])]){
  const v=q[name];
  if(typeof v!=='number'||!Number.isFinite(v))
   reject('INVALID_FACTS',name+' must be an explicit finite JSON number');
  if(v<1||v>4)reject('UNSUPPORTED_SCOPE',name+' is outside supported refractive index [1,4]');
 }
 if(typeof q.incidentAngleDeg!=='number'||!Number.isFinite(q.incidentAngleDeg))
  reject('INVALID_FACTS','Incident angle must be an explicit finite JSON number');
 if(q.incidentAngleDeg<0||q.incidentAngleDeg>89)
  reject('UNSUPPORTED_SCOPE','Incident angle must be in [0,89] degrees from the front normal');
 const b=common(q,thicknessMm);
 if(!own(q,'outsideIndex'))
  return refused(b,'needs-information','MISSING_OUTSIDE_INDEX',
   'The incident exterior material is unstated: no numerical slab displacement can be certified without outsideIndex.');
 const s=q.outsideIndex*Math.sin(q.incidentAngleDeg*RAD)/q.insideIndex;
 if(!Number.isFinite(s))
  return refused(b,'numerically-indeterminate','NONFINITE_SNELL_RATIO','Entry Snell ratio is not finite');
 if(s>1+CRITICAL_SINE_MARGIN)
  return refused(b,'unavailable','NO_ENTERING_TRANSMISSION_TIR',
   'The requested ray cannot enter the plate at this index pair and incidence because of total internal reflection.');
 if(s>=1-CRITICAL_SINE_MARGIN)
  return refused(b,'numerically-indeterminate','NEAR_CRITICAL_ENTRY',
   'Entry ray is too close to the critical/grazing boundary to certify a finite return displacement.');
 const r=Math.asin(s),dy=2*thicknessMm*Math.tan(r);
 if(!Number.isFinite(dy)||Math.abs(dy)>MAX_ABS_OUTPUT_MM)
  return refused(b,'numerically-indeterminate','UNBOUNDED_DISPLACEMENT',
   'Calculated lateral displacement is nonfinite or beyond the admitted report bound.');
 const exitS=q.insideIndex*Math.sin(r)/q.outsideIndex;
 if(!Number.isFinite(exitS)||Math.abs(exitS-Math.sin(q.incidentAngleDeg*RAD))>1e-12)
  return refused(b,'numerically-indeterminate','ROUNDTRIP_SNELL_MISMATCH',
   'The two independently evaluated Snell relations do not close consistently.');
 return {...b,status:'conditional',value:{
  refractedAngleDeg:r*DEG,incidentAngleDeg:q.incidentAngleDeg,
  mirrorReflectionAngleDeg:r*DEG,
  exitAngleFromOriginalNormalDeg:q.incidentAngleDeg,
  signedReturnedHeadingDeg:180-q.incidentAngleDeg,
  entranceToExitSeparation:dy/scales[q.lengthUnit],
  entranceToExitSeparationMm:dy,
  perTraversalLateralShiftMm:dy/2,
  actualNativeFacePointsCertified:false,
  nativeDetectorEventCount:null,originalJeeSolved:false
 },qualification:'Conditional front-face separation in an ideal normal-backed planar plate. Requires explicitly supplied exterior index; no native ray path or image asserted.'};
}
