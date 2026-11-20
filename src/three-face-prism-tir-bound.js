// Source-bound three-face equilateral prism TIR inequality.
// No source geometry, finite face interception or native rays are created.
// A qualitative "slightly above critical" is NEVER converted into equality.
export const THREE_FACE_PRISM_QUERY_FORMAT='opticsim-three-face-prism-tir-bound-v1';
export const THREE_FACE_PRISM_RESULT_FORMAT='opticsim-three-face-prism-tir-bound-result-v1';
const MODEL='equilateral-prism-geometrical-principal-branch';
const KIND='three-face-reflected-prism-index-bound';
const BRANCH='AB-entry-AC-total-internal-reflection-BC-exit';
const ANGLE_LOW_DEG=.1,ANGLE_HIGH_DEG=30;
const ABSOLUTE_INDEX_MIN=1,ABSOLUTE_INDEX_MAX=4;
const CRITICAL_SINE_MARGIN=1e-5;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const isRecord=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const RAD=Math.PI/180,DEG=180/Math.PI;
export class ThreeFacePrismQueryError extends Error{
 constructor(code,message){super(message);this.name='ThreeFacePrismQueryError';this.code=code;}
}
const reject=(code,message)=>{throw new ThreeFacePrismQueryError(code,message);};
const assumptions=Object.freeze([
 'One 2D equilateral homogeneous prism with face AB as a vertical entrance, AC the upper reflection face, and BC the lower exit face.',
 'A ray enters AB from the outside, refracts toward AC, undergoes strict TIR at AC, reaches BC, and exits BC on the principal transmitted Snell branch.',
 'Input emergence angle e is nonnegative from the BC outward normal; the first incidence angle i is on the same principal external half-plane.',
 'Index ratio m=n_inside/n_outside is greater than one; "slightly above critical" is interpreted solely as a strict inequality without a quantitative margin.'
]);
const limitations=Object.freeze([
 'The original J13 gives no numerical exterior index, so no absolute glass refractive index is inferred without added outsideIndex.',
 'Strict TIR determines a LOWER BOUND on relative index, not a unique refractive index; equality is an excluded critical boundary.',
 'The phrase "slightly above critical" does not quantify how close an angle is to the critical angle and is not a numerical tolerance.',
 'Neither the assumed face sequence nor finite face interception is established by these scalar equations; a real native Glass ray can take a different route.',
 'A candidate index may pass angular TIR geometry without proving a physically measured emergent ray, a complete original problem or an observer image.',
 'No native Fresnel powers, polarization, diffraction, beam width, source brightness, 3D visibility or full ray lineage are calculated; native status is always not-run.',
 'This is not the separate J14 first-order two-branch small-apex inverse or a general prism multiple-reflection solver.'
]);
function common(q){
 return {
  format:THREE_FACE_PRISM_RESULT_FORMAT,kind:KIND,model:MODEL,branchConvention:BRANCH,
  angleUnit:'deg',status:'conditional',reasonCode:null,reason:null,
  sourceFacts:{emergenceAngleDeg:q.emergenceAngleDeg,
   outsideIndex:own(q,'outsideIndex')?q.outsideIndex:null,
   candidateInsideIndex:own(q,'candidateInsideIndex')?q.candidateInsideIndex:null},
  native:{status:'not-run',observations:null,nativeFaceSequenceVerified:false,nativeImageDetected:false},
  interpretation:'conditional equilateral meridional branch; source fidelity and textbook answer not independently graded',
  assumptions:[...assumptions],limitations:[...limitations],
  numericalPolicy:{emergenceBoundsDeg:[ANGLE_LOW_DEG,ANGLE_HIGH_DEG],
   absoluteIndexBounds:[ABSOLUTE_INDEX_MIN,ABSOLUTE_INDEX_MAX],
   nearCriticalSineMargin:CRITICAL_SINE_MARGIN,
   boundaryEqualityNotTIR:true,
   note:'Conservative numerical admission policy, not a globally proven simulation error bound'},
  value:null
 };
}
const refuse=(b,status,code,message)=>({...b,status,reasonCode:code,reason:message,value:null});
export function threeFacePrismCapabilities(){
 return {format:THREE_FACE_PRISM_QUERY_FORMAT,
  resultFormat:THREE_FACE_PRISM_RESULT_FORMAT,kinds:[KIND],model:MODEL,
  branchConvention:BRANCH,angleUnit:'deg',
  requiredFields:['format','kind','model','branchConvention','angleUnit','emergenceAngleDeg',
   'criticalRelation'],optionalFields:['outsideIndex','candidateInsideIndex'],
  criticalRelation:'strictly-above',
  numericalPolicy:common({emergenceAngleDeg:30}).numericalPolicy,
  relationships:[
   'For the declared equilateral AB->AC->BC route, entry incidence i equals external emergence e',
   'Internal entrance/exit magnitude r = asin(sin(e)/m)',
   'Upper AC incidence is 60 degrees minus r; TIR requires m*sin(60 degrees-r)>1',
   'The strict lower ratio bound is m > (2/sqrt(3))*sqrt(1+sin(e)+sin(e)^2)',
   'At e=30 degrees this is m>sqrt(7/3), never equality and never a unique n_inside'
  ],native:'not-run; real full finite-route verification must be independently declared',
  limitations:[...limitations]};
}
export function analyzeThreeFacePrismBound(q){
 const required=['format','kind','model','branchConvention','angleUnit','emergenceAngleDeg',
  'criticalRelation'];
 const allowed=[...required,'outsideIndex','candidateInsideIndex'];
 if(!isRecord(q))reject('INVALID_QUERY','Input must be a strict JSON object');
 const unknown=Object.keys(q).filter(k=>!allowed.includes(k));
 if(unknown.length)reject('INVALID_QUERY','Unexpected fields: '+unknown.join(', '));
 const missing=required.filter(k=>!own(q,k));
 if(missing.length)reject('MISSING_FACTS','Missing required facts: '+missing.join(', '));
 if(q.format!==THREE_FACE_PRISM_QUERY_FORMAT||q.kind!==KIND)
  reject('UNSUPPORTED_QUERY','Use the explicit supported three-face reflected-prism query format and kind');
 if(q.model!==MODEL||q.branchConvention!==BRANCH||q.angleUnit!=='deg'||
    q.criticalRelation!=='strictly-above')
  reject('UNSUPPORTED_SCOPE','Explicit equilateral face route, degree units and strict critical inequality required');
 const e=q.emergenceAngleDeg;
 if(typeof e!=='number'||!Number.isFinite(e))
  reject('INVALID_FACTS','Emergence must be a finite JSON number');
 if(e<ANGLE_LOW_DEG||e>ANGLE_HIGH_DEG)
  reject('UNSUPPORTED_SCOPE','Conservative outward emergence domain is 0.1 to 30 degrees inclusive');
 const haveExterior=own(q,'outsideIndex'),haveInside=own(q,'candidateInsideIndex');
 if(haveInside&&!haveExterior)
  reject('MISSING_FACTS','A candidate absolute interior index requires an explicit exterior absolute index');
 for(const [name,present] of [['outsideIndex',haveExterior],['candidateInsideIndex',haveInside]]){
  if(!present)continue;
  const n=q[name];
  if(typeof n!=='number'||!Number.isFinite(n))
   reject('INVALID_FACTS',name+' must be a finite JSON number');
  if(n<ABSOLUTE_INDEX_MIN||n>ABSOLUTE_INDEX_MAX)
   reject('UNSUPPORTED_SCOPE',name+' must be within the supported [1,4] absolute index domain');
 }
 const base=common(q);
 const s=Math.sin(e*RAD);
 // Algebraic independent threshold from Snell and the 60-degree upper normal:
 // m*sin(60-asin(s/m)) = (sqrt(3)*sqrt(m^2-s^2)-s)/2.
 const mMin=2/Math.sqrt(3)*Math.sqrt(1+s+s*s);
 const insideExclusiveMin=haveExterior?mMin*q.outsideIndex:null;
 if(!Number.isFinite(mMin)||!Number.isFinite(insideExclusiveMin??0))
  return refuse(base,'numerically-indeterminate','NONFINITE_CRITICAL_BOUND',
   'The source-derived strict index inequality is not numerically finite');
 if(insideExclusiveMin!==null&&insideExclusiveMin>=ABSOLUTE_INDEX_MAX)
  return refuse(base,'unavailable','NO_BOUNDED_ABSOLUTE_INDEX_INTERVAL',
   'At the explicitly supplied outside index, the strict TIR bound leaves no absolute interior index in [1,4]');
 let candidate=null;
 if(haveInside){
  const m=q.candidateInsideIndex/q.outsideIndex;
  if(m<=1)
   return refuse(base,'unavailable','INTERIOR_NOT_HIGHER_INDEX',
    'The declared strict internal TIR branch requires insideIndex greater than outsideIndex');
  const internal=Math.asin(s/m);
  const upperIncidence=60-internal*DEG;
  const critical=Math.asin(1/m)*DEG;
  const margin=m*Math.sin(60*RAD-internal)-1;
  if(![internal,upperIncidence,critical,margin].every(Number.isFinite))
   return refuse(base,'numerically-indeterminate','CANDIDATE_NUMERIC_UNRELIABLE',
    'Cannot classify the candidate reliably');
  if(Math.abs(margin)<=CRITICAL_SINE_MARGIN)
   return refuse(base,'numerically-indeterminate','CANDIDATE_NEAR_CRITICAL',
    'The candidate is at or too close to the critical boundary to certify the reflected route');
  if(margin<0)
   return refuse(base,'unavailable','CANDIDATE_BELOW_CRITICAL',
    'The supplied candidate has no total internal reflection at the declared upper face');
  candidate={relativeIndex:m,insideIndex:q.candidateInsideIndex,
   outsideIndex:q.outsideIndex,upperIncidenceDeg:upperIncidence,
   criticalAngleDeg:critical,criticalSineMargin:margin,
   candidateStrictTIRConsistent:true,
   finiteNativeThreeFaceRouteCertified:false};
 }
 return {...base,status:'conditional',value:{
  emergentAngleDeg:e,conditionalIncidentAngleDeg:e,
  principalBranchOnly:true,
  relativeIndexLowerBoundExclusive:mMin,
  inequality:'n_inside / n_outside > relativeIndexLowerBoundExclusive',
  outsideIndex:haveExterior?q.outsideIndex:null,
  insideIndexLowerBoundExclusive:insideExclusiveMin,
  uniqueIndexInferred:false,
  criticalEqualityExcluded:true,
  qualitativeSlightlyDoesNotSpecifyMargin:true,
  candidate,
  nativeFaceSequenceVerified:false,originalJeeQuestionSolved:false,
  mathematicalDerivation:'strict above-critical inequality plus equilateral three-face principal Snell symmetry'
 }};
}
