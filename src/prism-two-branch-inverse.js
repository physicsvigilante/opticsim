// J14 source-backed conditional TWO-BRANCH inverse for a normally entered,
// small-apex homogeneous prism. Pure first-order angular mathematics.
// NEVER native Fresnel tracing, actual return-path detection or power evidence.
export const TWO_BRANCH_PRISM_QUERY_FORMAT='opticsim-prism-two-branch-inverse-v1';
export const TWO_BRANCH_PRISM_RESULT_FORMAT='opticsim-prism-two-branch-result-v1';
const KIND='small-angle-prism-apex-relative-index';
const MODEL='first-order-small-angle-homogeneous-prism';
const CONVENTION='normal-first-face-incidence-second-face-reflection-and-transmission';
const POLICY=Object.freeze({
 maxInputDeviationDeg:10,
 minPositiveDeviationDeg:1e-8,
 minApexDeg:1e-8,
 maxApexDeg:5,
 maxRelativeIndex:4,
 nearDegenerateDenominatorDeg:1e-7,
 nearCriticalSineMargin:1e-5,
 maxExactVsFirstOrderResidualDeg:0.05,
 optionalExteriorIndexRange:[1,4]
});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
export class TwoBranchPrismInverseError extends Error{
 constructor(code,message){super(message);this.name='TwoBranchPrismInverseError';this.code=code;}
}
const reject=(code,message)=>{throw new TwoBranchPrismInverseError(code,message);};
const assumptions=Object.freeze([
 'One homogeneous, isotropic prism, one homogeneous exterior, normal incidence at the first planar face, and a small positive prism apex angle.',
 'Second-face partial reflection and transmission are declared branches; a return reaches and transmits through the first face (finite reach is not verified).',
 'Transmitted deviation is measured from the original forward incident direction; return deviation is measured from the reversed incident direction, both positive magnitudes.',
 'First-order paraxial relations T=(m-1)A and R=2mA use m=n_inside/n_outside, angles in degrees, and retain the declared sign/branch.'
]);
const limitations=Object.freeze([
 'No exterior refractive index is assumed: only the relative material index is known unless outsideIndex is explicitly supplied.',
 'No finite triangle, source width/brightness, emission path, detector geometry, face encounter, ray lineage, native Fresnel energy or downstream return path is synthesized.',
 'An exact Snell angular re-evaluation only screens first-order suitability; it does not validate physical native ray reach or form an exact nonlinear inverse.',
 'The 0.05-degree forward-consistency guard is a conservative admission threshold, not a universal approximation bound, a measurement uncertainty, or complete ray propagation.',
 'Native Fresnel-on prism runs can truncate weak rays; raw branch detector crossings from PR #188 do not qualify a full physical two-branch measurement.',
 'Not general prism geometry, J13 above-critical internal reflection, multiple prisms, polarization modelling, continuous irradiance, 3-D visibility or original question correctness scoring.'
]);
function base(q){
 return {
  format:TWO_BRANCH_PRISM_RESULT_FORMAT,kind:KIND,model:MODEL,
  branchConvention:CONVENTION,angleUnit:'deg',
  status:'conditional',reasonCode:null,reason:null,
  native:{status:'not-run',observations:null,branchCompletenessCertified:false,nativeImageDetected:false},
  sourceInterpretation:'conditional-first-order-model; not independently graded as original JEE answer',
  numericalPolicy:{...POLICY,optionalExteriorIndexRange:[...POLICY.optionalExteriorIndexRange]},
  assumptions:[...assumptions],limitations:[...limitations],
  inputFacts:{transmittedDeviationDeg:q.transmittedDeviationDeg,
   returnedDeviationDeg:q.returnedDeviationDeg,
   outsideIndex:own(q,'outsideIndex')?q.outsideIndex:null},
  value:null
 };
}
const withheld=(b,status,code,reason,details={})=>({
 ...b,status,reasonCode:code,reason,value:null,...details
});
export function twoBranchPrismInverseCapabilities(){
 return {
  format:TWO_BRANCH_PRISM_QUERY_FORMAT,
  resultFormat:TWO_BRANCH_PRISM_RESULT_FORMAT,
  kinds:[KIND],model:MODEL,branchConvention:CONVENTION,angleUnit:'deg',
  requiredFields:['format','kind','model','branchConvention','angleUnit',
   'transmittedDeviationDeg','returnedDeviationDeg'],
  optionalFields:['outsideIndex'],
  statuses:['conditional','unavailable','numerically-indeterminate'],
  mathematicalRelations:{
   firstOrder:['T=(m-1)*A','R=2*m*A','A=R/2-T','m=R/(R-2*T)'],
   exactSanityCheck:['T_exact=asin(m*sin(A))-A','R_exact=asin(m*sin(2*A))']
  },
  numericalPolicy:{...POLICY,optionalExteriorIndexRange:[...POLICY.optionalExteriorIndexRange]},
  limitations:[...limitations],
  native:'not-run: purely conditional first-order inverse; no physical returned/forward ray or Fresnel completeness verified'
 };
}
export function analyzeTwoBranchPrismInverse(q){
 const required=['format','kind','model','branchConvention','angleUnit',
  'transmittedDeviationDeg','returnedDeviationDeg'];
 const allowed=[...required,'outsideIndex'];
 if(!record(q))reject('INVALID_QUERY','A strict JSON object is required');
 const unknown=Object.keys(q).filter(k=>!allowed.includes(k));
 if(unknown.length)reject('INVALID_QUERY','Unsupported fields: '+unknown.join(', '));
 const missing=required.filter(k=>!own(q,k));
 if(missing.length)reject('MISSING_FACTS','Required explicit facts: '+missing.join(', '));
 if(q.format!==TWO_BRANCH_PRISM_QUERY_FORMAT||q.kind!==KIND)
  reject('UNSUPPORTED_QUERY','Provide the exact two-branch prism query format and kind');
 if(q.model!==MODEL||q.branchConvention!==CONVENTION||q.angleUnit!=='deg')
  reject('UNSUPPORTED_SCOPE','Explicit supported first-order model, branch convention and degree units are mandatory');
 const T=q.transmittedDeviationDeg,R=q.returnedDeviationDeg;
 if(typeof T!=='number'||!Number.isFinite(T)||typeof R!=='number'||!Number.isFinite(R))
  reject('INVALID_FACTS','Both deviations must be finite JSON numbers, not strings or null');
 if(own(q,'outsideIndex')){
  const n0=q.outsideIndex;
  if(typeof n0!=='number'||!Number.isFinite(n0))
   reject('INVALID_FACTS','Optional outsideIndex must be an explicit finite absolute refractive index');
  if(n0<POLICY.optionalExteriorIndexRange[0]||n0>POLICY.optionalExteriorIndexRange[1])
   reject('UNSUPPORTED_SCOPE','Exterior absolute refractive index must be within [1,4]');
 }
 const common=base(q);
 if(T<=0||R<=0)
  return withheld(common,'unavailable','NO_POSITIVE_TWO_BRANCH_DEVIATIONS',
   'This bounded prism inverse requires strictly positive forward and return deviation magnitudes; no reflected branch can be inferred from zero or negative input.');
 if(T<=POLICY.minPositiveDeviationDeg||R<=POLICY.minPositiveDeviationDeg)
  return withheld(common,'numerically-indeterminate','UNRESOLVED_SMALL_DEVIATION',
   'At least one positive deviation is at the conservative numeric resolution floor.');
 if(T>POLICY.maxInputDeviationDeg||R>POLICY.maxInputDeviationDeg)
  return withheld(common,'unavailable','OUTSIDE_SMALL_ANGLE_INPUT_BOUNDS',
   'The stated angles are outside the tested conservative small-angle input domain.');
 // A=R/2-T. R=2T is a zero-apex/infinite-index degeneracy, not a
 // convenient exactly-zero transmitted angle or an alternative ray route.
 const denominator=R-2*T;
 if(denominator===0)
  return withheld(common,'unavailable','DEGENERATE_ZERO_APEX',
   'The stated deviations imply A=0 and no finite refractive-index inverse for positive T.');
 if(Math.abs(denominator)<=POLICY.nearDegenerateDenominatorDeg)
  return withheld(common,'numerically-indeterminate','NEAR_ZERO_APEX_OR_INDEX_SINGULARITY',
   'The inverse denominator R-2T is too close to zero to certify a bounded prism.');
 if(denominator<0)
  return withheld(common,'unavailable','NO_ADMISSIBLE_POSITIVE_APEX',
   'R must exceed 2T to yield a positive prism angle and interior-to-exterior relative index greater than one.');
 const apexAngleDeg=denominator/2,relativeIndex=R/denominator;
 if(!Number.isFinite(apexAngleDeg)||!Number.isFinite(relativeIndex))
  return withheld(common,'numerically-indeterminate','NUMERIC_OVERFLOW',
   'Cannot certify a finite apex angle and relative refractive index.');
 if(apexAngleDeg<=POLICY.minApexDeg)
  return withheld(common,'numerically-indeterminate','UNRESOLVED_SMALL_APEX',
   'The positive inferred apex is below the supported angular resolution.');
 if(apexAngleDeg>POLICY.maxApexDeg||relativeIndex>POLICY.maxRelativeIndex)
  return withheld(common,'unavailable','OUTSIDE_QUALIFIED_FIRST_ORDER_DOMAIN',
   'Derived prism apex or relative index exceeds the conservative first-order domain.');
 const outsideIndex=own(q,'outsideIndex')?q.outsideIndex:null;
 const insideIndex=outsideIndex===null?null:outsideIndex*relativeIndex;
 if(insideIndex!==null&&(!Number.isFinite(insideIndex)||insideIndex>4||
    insideIndex<1))
  return withheld(common,'unavailable','ABSOLUTE_INDEX_OUTSIDE_QUALIFIED_DOMAIN',
   'The supplied exterior index implies an interior absolute refractive index outside [1,4].');
 // Exact Snell relations are ONLY a conservative physical-suitability
 // witness for the declared face route. They do not run, steer, qualify or
 // reconstruct the finite native Fresnel-on rays.
 const sineForward=relativeIndex*Math.sin(rad(apexAngleDeg));
 const sineReturn=relativeIndex*Math.sin(rad(2*apexAngleDeg));
 if(!Number.isFinite(sineForward)||!Number.isFinite(sineReturn)||
    sineForward>=1-POLICY.nearCriticalSineMargin||
    sineReturn>=1-POLICY.nearCriticalSineMargin)
  return withheld(common,'numerically-indeterminate','NO_RELIABLE_PROPAGATING_EXIT',
   'An assumed transmitted/returned branch is near or outside the physical Snell transmission condition.');
 const exactT=deg(Math.asin(sineForward))-apexAngleDeg;
 const exactR=deg(Math.asin(sineReturn));
 const residualT=Math.abs(exactT-T),residualR=Math.abs(exactR-R);
 if(![exactT,exactR,residualT,residualR].every(Number.isFinite))
  return withheld(common,'numerically-indeterminate','NONFINITE_TRIG_WITNESS',
   'Cannot independently reevaluate the first-order relations with finite Snell trigonometry.');
 if(Math.max(residualT,residualR)>POLICY.maxExactVsFirstOrderResidualDeg)
  return withheld(common,'unavailable','FIRST_ORDER_APPROXIMATION_TOO_LARGE',
   'The exact-Snell angular consistency check exceeds the declared first-order tolerance.');
 return {
  ...common,status:'conditional',reasonCode:null,reason:null,
  value:{
   apexAngleDeg,relativeIndex,
   outsideIndex,insideIndex,
   absoluteInsideIndexAvailable:insideIndex!==null,
   firstOrderPredictedTransmittedDeg:(relativeIndex-1)*apexAngleDeg,
   firstOrderPredictedReturnedDeg:2*relativeIndex*apexAngleDeg,
   exactSnellForwardWitness:{
    predictedTransmittedDeviationDeg:exactT,
    predictedReturnedDeviationDeg:exactR,
    transmittedAbsoluteResidualDeg:residualT,
    returnedAbsoluteResidualDeg:residualR,
    maximumAbsoluteResidualDeg:Math.max(residualT,residualR),
    witnessOnlyNotNativeOrExactInverse:true
   },
   assumedSecondFaceReflection:true,
   nativeTwoBranchVerified:false,
   fullPhysicalQuestionSolved:false
  },
  qualification:'Bounded, conditional first-order angular inverse; relative index known, but no finite native Fresnel-on completeness, ray lineage or original JEE answer certified.'
 };
}
