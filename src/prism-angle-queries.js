// Conditional two-face prism angles from explicit reduced facts, NOT ray tracing.
// The declared branch must exist; finite face interception needs native geometry.
import {isRecord} from './qualified-utils.js';
import {COMPONENT_BOUNDS} from './contract.js';
import {RAD,asinAngle,snellBoundaryState,CRITICAL_UNCERTAINTY} from './analytical-angle-math.js';
export const PRISM_FACTS_FORMAT='opticsim-prism-angular-facts-v1';
export const PRISM_QUERY_FORMAT='opticsim-prism-angular-query-v1';
const model='homogeneous-prism',branch='direct-two-face-transmission';
const convention='normal-angles-signed-deviation';
const kinds=Object.freeze(['prism-direct-angles','prism-direct-index']);
const ANGLE_GUARD_DEG=1e-9,MIN_SIN_APEX=1e-10,ANGLE_RESIDUAL_DEG=1e-8;
const own=(o,k)=>Object.hasOwn(o,k);
export class PrismAngleQueryError extends Error {
 constructor(code,message){super(message);this.name='PrismAngleQueryError';this.code=code;}
}
const fail=(code,message)=>{throw new PrismAngleQueryError(code,message);};
function fields(x,allowed,required,label){
 if(!isRecord(x))fail('INVALID_PRISM_FACTS',label+' must be an object');
 const extra=Object.keys(x).filter(k=>!allowed.includes(k));
 if(extra.length)fail('INVALID_PRISM_FACTS',label+' has unsupported fields: '+extra.join(', '));
 const missing=required.filter(k=>!own(x,k));
 if(missing.length)fail('MISSING_FACTS',label+' requires '+missing.join(', '));
}
function finite(x,label){if(typeof x!=='number'||!Number.isFinite(x))fail('INVALID_PRISM_FACTS',label+' must be an explicit finite number');return x;}
function index(x,label){
 finite(x,label);const [lo,hi]=COMPONENT_BOUNDS.refractiveIndex;
 if(x<lo||x>hi)fail('UNSUPPORTED_SCOPE',label+' must be in the qualified index interval ['+lo+','+hi+']');return x;
}
export function prismAngularCapabilities(){
 return {format:PRISM_QUERY_FORMAT,factsFormat:PRISM_FACTS_FORMAT,kinds:[...kinds],model,branch,angleConvention:convention,
  requiredFacts:['format','model','branch','angleConvention','prismAngleDeg','incidenceAngleDeg','outsideIndex'],
  forward:'prism-direct-angles additionally requires insideIndex; no measured deviation constraint.',
  inverse:'prism-direct-index additionally requires signed deviationDeg and an unknown (omitted) insideIndex. Known incidence is mandatory; minimum deviation is not assumed.',
  angles:'Unsigned incidence/refraction/emergence in [0,90) degrees from the relevant normal. A is the included prism angle. Signed deviation delta=i+e-A may be negative for a lower-index prism.',
  bounds:{refractiveIndex:[...COMPONENT_BOUNDS.refractiveIndex],prismAngleDeg:'0 < A < 180',incidenceAngleDeg:'0 <= i < 90'},
  numericalPolicy:{criticalSineBand:CRITICAL_UNCERTAINTY,angularBoundaryDeg:ANGLE_GUARD_DEG,minimumSinPrismAngle:MIN_SIN_APEX,forwardResidualDeg:ANGLE_RESIDUAL_DEG},
  limits:['Same explicit homogeneous exterior on entry and exit; no implicit air.',
   'Only the conventional branch r1+r2=A with 0<=r1,r2<90; no extra internal reflections, third-face selection, dispersion, power or minimum-deviation optimization.',
   'No source position, brightness, finite dimensions or reflection policy is invented. No native scene, image or measured ray route is produced.',
   'Known incidence and signed deviation give at most one positive index on this branch. Missing facts are not solved by choosing among other branches.',
   'Nominal floating-point results, not symbolic proof, experimental uncertainty propagation, or independent source interpretation.']};
}
function refusal(status,reasonCode,reason,diagnostics={}){return {status,value:null,reasonCode,reason,diagnostics};}
const uncertain=(code,reason,d={})=>refusal('numerically-indeterminate',code,reason,d);
const absent=(code,reason,d={})=>refusal('unavailable',code,reason,d);
function refract(i,n1,n2,face){
 const ratio=n1/n2*Math.sin(i*RAD),same=n1===n2;
 const {uncertainCritical,tir}=snellBoundaryState(ratio,same);
 const diagnostic={face,incidentAngleDeg:i,incidentIndex:n1,destinationIndex:n2,transmittedSine:ratio};
 if(uncertainCritical)return uncertain('NEAR_CRITICAL_'+face.toUpperCase(),'No reliable transmission/critical classification at this boundary.',diagnostic);
 if(tir)return absent('TOTAL_INTERNAL_REFLECTION_'+face.toUpperCase(),'The requested direct transmitted branch is absent under TIR; no emergence or deviation is invented.',diagnostic);
 const angle=same?i:asinAngle(ratio);
 if(angle===null)return absent('NO_TRANSMITTED_BRANCH','No propagating transmitted direction exists.',diagnostic);
 return {angle};
}
function forward(A,i,n0,n){
 const entry=refract(i,n0,n,'entry');if(entry.status)return entry;
 const r1=entry.angle,r2=A-r1;
 if(r2<0){
  if(r2>=-ANGLE_GUARD_DEG)return uncertain('NEAR_BRANCH_BOUNDARY','Internal exit angle is too close to the signed branch boundary.');
  return absent('OUTSIDE_DECLARED_BRANCH','The derived internal angle is negative; the conventional r1+r2=A branch does not describe this configuration.');
 }
 if(r2>=90-ANGLE_GUARD_DEG)return r2>90+ANGLE_GUARD_DEG?
  absent('OUTSIDE_DECLARED_BRANCH','The selected exit face is not forward-facing for the declared branch.'):
  uncertain('NEAR_GRAZING_EXIT','The derived ray is tangent or too close to tangent to the selected exit face.');
 const exit=refract(r2,n,n0,'exit');if(exit.status)return exit;
 return {status:'conditional',value:{prismAngleDeg:A,incidenceAngleDeg:i,entryRefractionAngleDeg:r1,
  exitIncidenceAngleDeg:r2,emergenceAngleDeg:exit.angle,deviationDeg:i+exit.angle-A,
  insideIndex:n,outsideIndex:n0},reasonCode:null};
}
export function analyzePrismAngleQuery(input,query){
 fields(query,['format','kind'],['format','kind'],'Prism angular query');
 if(query.format!==PRISM_QUERY_FORMAT||!kinds.includes(query.kind))fail('UNSUPPORTED_QUERY','Unknown prism angular query');
 if(!isRecord(input)||input.format!==PRISM_FACTS_FORMAT)fail('UNSUPPORTED_FACTS','Use explicit '+PRISM_FACTS_FORMAT+'; a native scene is not reduced by discarding components');
 fields(input,['format','model','branch','angleConvention','prismAngleDeg','incidenceAngleDeg','outsideIndex','insideIndex','deviationDeg'],
  ['format','model','branch','angleConvention','prismAngleDeg','incidenceAngleDeg','outsideIndex'],'Prism angular facts');
 if(input.model!==model)fail('UNSUPPORTED_MODEL','State the homogeneous-prism model explicitly');
 if(input.branch!==branch)fail('UNSUPPORTED_SCOPE','Only explicitly declared direct two-face transmission is qualified; unknown or reflected routes are not inferred');
 if(input.angleConvention!==convention)fail('UNSUPPORTED_SCOPE','Specify normal angles and signed deviation; an unsigned measured magnitude is not silently assigned a sign');
 const A=finite(input.prismAngleDeg,'prismAngleDeg'),i=finite(input.incidenceAngleDeg,'incidenceAngleDeg'),n0=index(input.outsideIndex,'outsideIndex');
 if(A<=0||A>=180||i<0||i>=90)fail('INVALID_PRISM_FACTS','Require 0<A<180 and 0<=incidence<90 degrees');
 // Validate every supplied value, even if not needed by a successful request.
 if(own(input,'insideIndex'))index(input.insideIndex,'insideIndex');
 if(own(input,'deviationDeg')){finite(input.deviationDeg,'deviationDeg');if(Math.abs(input.deviationDeg)>180)fail('INVALID_PRISM_FACTS','Signed deviation must lie within [-180,180] degrees');}
 const inverse=query.kind==='prism-direct-index',required=inverse?'deviationDeg':'insideIndex';
 if(!own(input,required))fail('MISSING_FACTS',required+' is required for '+query.kind);
 if(own(input,inverse?'insideIndex':'deviationDeg'))fail('INVALID_PRISM_FACTS','Do not supply both insideIndex and measured deviation; the inverse target must be genuinely unknown, not overwritten');
 const base={format:'opticsim-prism-angular-result-v1',kind:query.kind,method:'conditional-analytical',model,branch,
  angleConvention:convention,native:{status:'not-run',observations:null},questionSupport:'not-assessed-by-engine',
  assumptions:['Homogeneous isotropic nondispersive prism and the same explicitly indexed exterior at both faces.',
   'Direct entry-to-exit transmission with nonnegative normal angles and r1+r2=A. A geometrically realizable pencil must actually encounter those faces.',
   'Snell angles alone do not establish finite interception or Fresnel branch completeness.'],
  limitations:prismAngularCapabilities().limits,numericalPolicy:prismAngularCapabilities().numericalPolicy};
 const sA=Math.sin(A*RAD);
 if(sA<=MIN_SIN_APEX)return {...base,...uncertain('DEGENERATE_PRISM_ANGLE','The prism angle is too close to zero or 180 degrees for this qualified inverse/forward geometry.')};
 if(90-i<=ANGLE_GUARD_DEG)return {...base,...uncertain('NEAR_GRAZING_ENTRY','Entry is too close to grazing to qualify these angular results.')};
 if(!inverse)return {...base,...forward(A,i,n0,input.insideIndex)};
 const e=A+input.deviationDeg-i;
 if(e<0||e>=90){
  if(e>=-ANGLE_GUARD_DEG&&e<=90+ANGLE_GUARD_DEG&&(e<0||Math.abs(e-90)<=ANGLE_GUARD_DEG))return {...base,...uncertain('NEAR_EMERGENCE_BOUNDARY','Derived emergence is at or too close to the branch boundary.')};
  return {...base,...absent('NO_ADMISSIBLE_INDEX','The stated deviation gives no emergence angle on the declared branch.'),candidates:[]};
 }
 if(90-e<=ANGLE_GUARD_DEG)return {...base,...uncertain('NEAR_GRAZING_EXIT','Derived emergence is too close to grazing to infer a reliable index.')};
 // Let m=n/n0. Snell gives m sin(r1)=sin(i), and
 // m cos(r1)=[sin(e)+sin(i)cos(A)]/sin(A). Positive cos selects
 // the declared forward normal quadrant; squaring alone would admit false roots.
 const u=Math.sin(i*RAD),v=Math.sin(e*RAD),t=v+u*Math.cos(A*RAD),w=t/sA;
 if(u===0&&v===0)return {...base,...absent('NO_ADMISSIBLE_INDEX','Two zero external angles cannot span a nonzero prism angle on this branch.'),candidates:[]};
 const cancellation=64*Number.EPSILON*(Math.abs(v)+Math.abs(u*Math.cos(A*RAD)));
 if(Math.abs(t)<=cancellation)return {...base,...uncertain('ILL_CONDITIONED_INDEX','The inverse normal component is unresolved by cancellation.')};
 if(w<0)return {...base,...absent('NO_ADMISSIBLE_INDEX','The inverse would require a backward internal normal component.'),candidates:[]};
 const n=n0*Math.hypot(u,w),[lo,hi]=COMPONENT_BOUNDS.refractiveIndex;
 if(!Number.isFinite(n))return {...base,...uncertain('ILL_CONDITIONED_INDEX','The inverse is not finite.')};
 if(n<lo||n>hi)return {...base,...(Math.min(Math.abs(n-lo),Math.abs(n-hi))<=1e-10?
  uncertain('INDEX_BOUNDARY_UNCERTAIN','Computed index is just outside the qualified interval; it is not clamped.'):
  absent('INDEX_OUTSIDE_QUALIFIED_RANGE','The unique algebraic candidate is outside the qualified material-index interval.'))};
 const checked=forward(A,i,n0,n);
 if(checked.status!=='conditional')return {...base,...checked};
 const residual=Math.abs(checked.value.deviationDeg-input.deviationDeg);
 if(!Number.isFinite(residual)||residual>ANGLE_RESIDUAL_DEG)return {...base,...uncertain('INVERSE_RESIDUAL','The inverse does not reproduce the stated signed deviation within the declared numerical check.',{deviationResidualDeg:residual})};
 return {...base,...checked,value:{...checked.value,measuredDeviationDeg:input.deviationDeg},
  candidates:[{insideIndex:n}],solutionMultiplicity:'unique-within-declared-branch',
  verification:{forwardDeviationResidualDeg:residual},
  uniqueness:'For known A, i and signed delta, e=A+delta-i is fixed; positive m is the norm of the two uniquely determined Snell components. No minimum-deviation assumption is used.'};
}
