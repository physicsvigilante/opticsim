// Conditional two-face prism angles from explicit physical facts.
// No ray intersections, native scene synthesis, minimum-deviation assumption,
// branch discovery, or multi-reflection/instrument solver is implemented here.
import {isRecord} from './qualified-utils.js';
import {COMPONENT_BOUNDS} from './contract.js';
import {RAD,classifySnellTransmission,CRITICAL_UNCERTAINTY} from './angular-math.js';
export const PRISM_FACTS_FORMAT='opticsim-prism-angular-facts-v1';
export const PRISM_QUERY_FORMAT='opticsim-prism-angle-query-v1';
const model='homogeneous-prism',branch='direct-two-face-transmission';
const kinds=Object.freeze(['prism-transmission-angles','prism-index-from-deviation']);
// New analytical qualification policy, never a native cutoff or historical change.
const ANGLE_TOLERANCE_DEG=1e-8,INDEX_TOLERANCE=1e-10,MIN_APEX_SINE=1e-8;
const own=(o,k)=>Object.hasOwn(o,k);
export class PrismAngleQueryError extends Error {
 constructor(code,message){super(message);this.name='PrismAngleQueryError';this.code=code;}
}
const fail=(code,message)=>{throw new PrismAngleQueryError(code,message);};
function fields(value,allowed,required,label){
 if(!isRecord(value))fail('INVALID_PRISM_FACTS',label+' must be an object');
 const extra=Object.keys(value).filter(k=>!allowed.includes(k));
 if(extra.length)fail('INVALID_PRISM_FACTS',label+' has unsupported fields: '+extra.join(', '));
 const missing=required.filter(k=>!own(value,k));
 if(missing.length)fail('MISSING_FACTS',label+' requires '+missing.join(', '));
}
function finite(n,label){
 if(typeof n!=='number'||!Number.isFinite(n))fail('INVALID_PRISM_FACTS',label+' must be an explicit finite number');
 return n;
}
function index(n,label){
 finite(n,label);const [lo,hi]=COMPONENT_BOUNDS.refractiveIndex;
 if(n<lo||n>hi)fail('UNSUPPORTED_SCOPE',label+' is outside the qualified refractive-index range ['+lo+','+hi+']');
}
const refused=(status,reasonCode,reason,details={})=>({status,value:null,reasonCode,reason,...details});
const unavailable=(code,reason,details)=>refused('unavailable',code,reason,details);
const uncertain=(code,reason,details)=>refused('numerically-indeterminate',code,reason,details);
const closeIndex=(a,b)=>Math.abs(a-b)<=INDEX_TOLERANCE*Math.max(1,Math.abs(a),Math.abs(b));
export function prismAngleCapabilities(){
 return {format:PRISM_QUERY_FORMAT,factsFormat:PRISM_FACTS_FORMAT,kinds:[...kinds],model,branch,
  requiredFacts:['format','model','branch','apexAngleDeg','incidenceAngleDeg','outsideIndex'],
  forwardRequires:['insideIndex'],inverseRequires:['deviationDeg','deviationConvention'],
  deviationConventions:['signed','magnitude'],
  signs:'i, e, r1 and r2 are nonnegative angles from the corresponding face normals; r1+r2=A. Signed deviation is i+e-A. Magnitude explicitly evaluates both signs, not an assumed positive deviation.',
  domain:{apexAngleDeg:'0 < A < 180',incidenceAngleDeg:'0 <= i < 90',directBranch:'0 <= r1,r2,e < 90',
    refractiveIndex:[...COMPONENT_BOUNDS.refractiveIndex],outside:'Same explicitly supplied homogeneous exterior at both faces; no implicit air.'},
  numericalPolicy:{criticalRatioBand:CRITICAL_UNCERTAINTY,angleToleranceDeg:ANGLE_TOLERANCE_DEG,
    indexRelativeTolerance:INDEX_TOLERANCE,minimumApexSine:MIN_APEX_SINE,
    note:'Conservative floating-point qualification, not measurement uncertainty or proof of exact criticality.'},
  limits:['Conditional on the declared entry-to-exit transmitted branch; no finite-face reach, native path or minimum deviation is inferred.',
    'TIR or an uncertain critical boundary withholds the requested transmission. No substitute internal-reflection route is solved.',
    'No source brightness, launch point, dimensions, native reflection policy, scene or rays are created.',
    'Inverse results are bounded to [1,4] absolute indices; multiple, unqualified or numerically unresolved sign branches are not promoted to a unique answer.',
    'Not dispersion, absorption, nonuniform media, multiple prisms, an unknown-incidence inverse, or a general ray-path inverse.']};
}
function validateFacts(input){
 if(!isRecord(input)||input.format!==PRISM_FACTS_FORMAT)
  fail('UNSUPPORTED_FACTS','Use explicit '+PRISM_FACTS_FORMAT+' facts; no components or unmodeled media are deleted from a native scene');
 fields(input,['format','model','branch','apexAngleDeg','incidenceAngleDeg','outsideIndex','insideIndex','deviationDeg','deviationConvention'],
  ['format','model','branch','apexAngleDeg','incidenceAngleDeg','outsideIndex'],'Prism facts');
 if(input.model!==model)fail('UNSUPPORTED_MODEL','Only the explicit homogeneous-prism model is supported');
 if(input.branch!==branch)fail('UNSUPPORTED_SCOPE','State the direct two-face transmission branch explicitly; no ray route is inferred');
 const A=finite(input.apexAngleDeg,'apexAngleDeg'),i=finite(input.incidenceAngleDeg,'incidenceAngleDeg');
 if(A<=0||A>=180||i<0||i>=90)fail('INVALID_PRISM_FACTS','Require 0 < apexAngleDeg < 180 and 0 <= incidenceAngleDeg < 90');
 index(input.outsideIndex,'outsideIndex');
 if(own(input,'insideIndex'))index(input.insideIndex,'insideIndex');
 if(own(input,'deviationConvention')&&!['signed','magnitude'].includes(input.deviationConvention))
  fail('INVALID_PRISM_FACTS','deviationConvention must be signed or magnitude; no sign is guessed');
 if(own(input,'deviationDeg')){
  finite(input.deviationDeg,'deviationDeg');
  if(!own(input,'deviationConvention'))fail('MISSING_FACTS','deviationConvention is required with a deviation measurement');
  if(Math.abs(input.deviationDeg)>=180||input.deviationConvention==='magnitude'&&input.deviationDeg<0)
   fail('INVALID_PRISM_FACTS','Signed deviation must be between -180 and 180 degrees; a magnitude must be nonnegative and below 180');
 }
 return input;
}
function boundary(transverse,n1,n2,angleDeg,face){
 const r=classifySnellTransmission(transverse,n1,n2,angleDeg);
 if(r.uncertainCritical)return uncertain('NEAR_CRITICAL_NUMERIC','Transmission is at or too close to the critical boundary; no exact criticality or branch absence is asserted.',{boundary:face});
 if(r.tir)return unavailable('TOTAL_INTERNAL_REFLECTION','The requested transmitted branch is absent under total internal reflection.',{boundary:face});
 if(r.out===null)return unavailable('NO_TRANSMITTED_BRANCH','No propagating principal transmission exists at this boundary.',{boundary:face});
 return {status:'transmitted',angleDeg:r.out};
}
function branchAngle(angle,label){
 if(angle===0)return null; // Exact normal incidence is admitted; near-zero is not guessed to be zero.
 if(Math.abs(angle)<=ANGLE_TOLERANCE_DEG||Math.abs(angle-90)<=ANGLE_TOLERANCE_DEG)
  return uncertain('NEAR_BRANCH_BOUNDARY',label+' is too close to a branch boundary to classify without qualification');
 if(angle<0||angle>=90)return unavailable('OUTSIDE_DIRECT_BRANCH',label+' is outside the declared nonnegative direct-transmission branch');
 return null;
}
function forward(f,n){
 const i=f.incidenceAngleDeg,A=f.apexAngleDeg,n0=f.outsideIndex;
 const first=boundary(n0*Math.sin(i*RAD),n0,n,i,'entry');
 if(first.status!=='transmitted')return first;
 const r1=first.angleDeg,r2=A-r1;
 const invalid=branchAngle(r1,'Entry refraction angle')||branchAngle(r2,'Exit incidence angle');
 if(invalid)return invalid;
 const last=boundary(n*Math.sin(r2*RAD),n,n0,r2,'exit');
 if(last.status!=='transmitted')return last;
 const e=last.angleDeg,exitIssue=branchAngle(e,'Emergence angle');if(exitIssue)return exitIssue;
 return {status:'conditional',value:{apexAngleDeg:A,incidenceAngleDeg:i,entryRefractionAngleDeg:r1,
  exitIncidenceAngleDeg:r2,emergenceAngleDeg:e,signedDeviationDeg:i+e-A,
  insideIndex:n,outsideIndex:n0,relativeIndex:n/n0}};
}
function inverseBranch(f,signedDeviationDeg){
 const A=f.apexAngleDeg,i=f.incidenceAngleDeg,n0=f.outsideIndex;
 const e=A+signedDeviationDeg-i,exitIssue=branchAngle(e,'Emergence angle inferred from the measurement');
 if(exitIssue)return {...exitIssue,signedDeviationDeg};
 // From Snell at both faces: p=n*sin(r1), q=n*sin(A-r1).
 // Therefore n*cos(r1)=(q+p*cos(A))/sin(A). Keep the normal component's sign;
 // squaring an invalid negative normal would introduce an extraneous candidate.
 const p=n0*Math.sin(i*RAD),q=n0*Math.sin(e*RAD),s=Math.sin(A*RAD),c=Math.cos(A*RAD);
 const normalNumerator=q+p*c,exitNormalNumerator=p+q*c;
 const guard=CRITICAL_UNCERTAINTY*Math.max(1,Math.abs(p),Math.abs(q));
 if(Math.abs(normalNumerator)<=guard||Math.abs(exitNormalNumerator)<=guard)
  return {...uncertain('NEAR_BRANCH_BOUNDARY','Inferred internal ray is too close to grazing or degenerate incidence'),signedDeviationDeg};
 if(normalNumerator<0||exitNormalNumerator<0)
  return {...unavailable('NO_ADMISSIBLE_INDEX','The deviation would require a ray outside the declared two-face branch'),signedDeviationDeg};
 const n=Math.hypot(p,normalNumerator/s),[lo,hi]=COMPONENT_BOUNDS.refractiveIndex;
 if(!Number.isFinite(n))return {...uncertain('UNRELIABLE_PRISM_INVERSE','Index computation is not finite'),signedDeviationDeg};
 if(n<lo||n>hi){
  const near=closeIndex(n,lo)||closeIndex(n,hi);
  return {...(near?uncertain('INDEX_BOUNDARY_NUMERIC','Derived index is too close to the qualified-domain boundary'):
   unavailable('UNQUALIFIED_INDEX_CANDIDATE','This sign has a mathematical candidate outside the qualified index range; it is not certified or silently discarded')),
   signedDeviationDeg};
 }
 if(own(f,'insideIndex')&&!closeIndex(n,f.insideIndex))
  return {...unavailable('INCONSISTENT_PRISM_FACTS','This candidate contradicts the explicitly supplied insideIndex'),signedDeviationDeg};
 const checked=forward(f,n);
 if(checked.status!=='conditional')return {...checked,signedDeviationDeg};
 const v=checked.value;
 if(Math.abs(v.emergenceAngleDeg-e)>ANGLE_TOLERANCE_DEG||Math.abs(v.signedDeviationDeg-signedDeviationDeg)>ANGLE_TOLERANCE_DEG)
  return {...uncertain('UNRELIABLE_PRISM_INVERSE','The derived index fails the forward angular residual checks'),signedDeviationDeg};
 return {...checked,signedDeviationDeg};
}
export function analyzePrismAngleQuery(input,query){
 fields(query,['format','kind'],['format','kind'],'Prism query');
 if(query.format!==PRISM_QUERY_FORMAT||!kinds.includes(query.kind))fail('UNSUPPORTED_QUERY','Unknown prism-angle query');
 const f=validateFacts(input),inverse=query.kind==='prism-index-from-deviation';
 if(inverse&&!own(f,'deviationDeg'))fail('MISSING_FACTS','deviationDeg and its explicit convention are required for index inference');
 if(!inverse&&!own(f,'insideIndex'))fail('MISSING_FACTS','insideIndex is required for forward transmission; no solved index is invented');
 const base={format:'opticsim-prism-angle-result-v1',kind:query.kind,method:'conditional-analytical',model,branch,
  native:{status:'not-run',observations:null},nativePathVerified:false,questionSupport:'not-assessed-by-engine',
  assumptions:['One homogeneous prism and the same explicitly indexed homogeneous exterior at both faces.',
   'Declared direct two-face transmitted branch with nonnegative principal incidence/refraction/emergence angles and r1+r2=A.',
   'Geometrical optics at one stated material-index condition; no minimum-deviation assumption.'],
  limitations:prismAngleCapabilities().limits,numericalPolicy:prismAngleCapabilities().numericalPolicy};
 if(Math.abs(Math.sin(f.apexAngleDeg*RAD))<=MIN_APEX_SINE)
  return {...base,...uncertain('NEAR_DEGENERATE_PRISM','The face-angle relationship is too close to degeneracy for this qualified calculation')};
 const incidenceIssue=branchAngle(f.incidenceAngleDeg,'Incidence angle');
 if(incidenceIssue)return {...base,...incidenceIssue};
 if(!inverse){
  const r=forward(f,f.insideIndex);
  if(r.status==='conditional'&&own(f,'deviationDeg')){
   const predicted=f.deviationConvention==='magnitude'?Math.abs(r.value.signedDeviationDeg):r.value.signedDeviationDeg;
   if(Math.abs(predicted-f.deviationDeg)>ANGLE_TOLERANCE_DEG)
    return {...base,...unavailable('INCONSISTENT_PRISM_FACTS','The specified index and measured deviation do not agree on the declared branch')};
  }
  return {...base,...r};
 }
 // A nonzero measured deviation below the existing angular resolution must
 // not collapse to exact zero or two numerically identical material candidates.
 if(f.deviationDeg!==0&&Math.abs(f.deviationDeg)<=ANGLE_TOLERANCE_DEG)
  return {...base,...uncertain('UNRESOLVED_SMALL_DEVIATION','The nonzero deviation is below this analytical policy\'s angular resolution; no exact zero or resolved sign candidates are asserted')};
 const signs=f.deviationConvention==='signed'||f.deviationDeg===0?[f.deviationDeg]:[f.deviationDeg,-f.deviationDeg];
 const branches=signs.map(d=>inverseBranch(f,d)),candidates=branches.filter(r=>r.status==='conditional').map(r=>r.value);
 const unresolved=branches.some(r=>r.status==='numerically-indeterminate');
 const unqualified=branches.some(r=>r.reasonCode==='UNQUALIFIED_INDEX_CANDIDATE');
 if(unresolved)return {...base,...refused(candidates.length?'partially-indeterminate':'numerically-indeterminate','UNRESOLVED_PRISM_CANDIDATE',
  'At least one deviation-sign branch is numerically unresolved; no unique material index is asserted'),candidates,branches};
 if(unqualified)return {...base,...refused(candidates.length?'partially-unavailable':'unavailable','UNQUALIFIED_PRISM_CANDIDATE',
  'At least one sign has an index outside the qualified range; no unrestricted uniqueness is asserted'),candidates,branches};
 if(candidates.length===0)return {...base,...unavailable('NO_ADMISSIBLE_INDEX','No index satisfies the supplied facts on the declared branch in the qualified range'),candidates,branches};
 if(candidates.length>1)return {...base,...refused('multiple-solutions','AMBIGUOUS_DEVIATION_SIGN',
  'A deviation magnitude admits distinct material-index candidates. Supply its sign or an independently known constraint; no candidate is selected'),candidates,branches};
 return {...base,status:'conditional',value:candidates[0],candidates,branches};
}
