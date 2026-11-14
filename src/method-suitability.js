// Explain the *already-authored* requested kind -> registered method decision.
// This is not an NLP classifier, a physics solver, or an automatic method fallback.
// The dispatcher and native engine retain full authority for their own results.
export const METHOD_SUITABILITY_FORMAT='opticsim-method-suitability-v1';
const own=(o,k)=>Object.hasOwn(o,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const analytic=new Set(['conditional','available','qualified']);
const pending=new Set(['pending']);
const unresolved=Object.freeze({
 'needs-information':'missing-facts',
 'invalid-input':'invalid-input',
 'unavailable':'unavailable',
 'multiple-solutions':'ambiguous-candidates',
 'numerically-indeterminate':'numerically-indeterminate',
 'partially-unavailable':'partially-unavailable',
 'partially-indeterminate':'partially-indeterminate',
 'suppressed':'native-suppressed'
});
const physicalFamily=physical=>!physical?'absent':
  typeof physical.format==='string'?physical.format:
  object(physical)&&Array.isArray(physical.components)?'authoring-scene':
  'unrecognized-fact-shape';

// A contract tells us which *declared input family* is appropriate. Passing
// this shape check is NOT proof that all required facts or physical scope fit.
export function assessMethodSuitability(plan,registry,factContracts){
 if(!object(plan)||!object(plan.request)||!Array.isArray(plan.request.requests)||
    !Array.isArray(plan.results)||!object(registry)||!object(factContracts))
   throw Error('Method suitability needs an already validated immutable problem plan');
 const results=new Map(plan.results.map(r=>[r.id,r]));
 const executable=new Set((plan.nativeRequests||[]).map(r=>r.id));
 const bindings=new Map((plan.targetBindings||[]).map(r=>[r.requestId,r]));
 const physical=physicalFamily(plan.request.physical);
 const entries=plan.request.requests.map(request=>{
   const row=results.get(request.id);
   if(!row||row.kind!==request.kind)throw Error('Planner and request identity mismatch');
   const spec=own(registry,request.kind)?registry[request.kind]:null;
   const registered=spec!==null,route=spec?.route??null;
   // Returned evidence must never expose the internal contract arrays. Each
   // entry gets its own copy, including two requests sharing one contract.
   const acceptedFamilies=!registered?[]:spec?.contract?
    [...(factContracts[spec.contract]||[])]:['authoring-scene'];
   const familyCompatibility=!registered?'not-assessed':physical==='absent'?'no-physical-facts':
     acceptedFamilies.includes(physical)?'form-compatible':'form-mismatch';
   const status=row.status;
   const readiness=!registered?'unregistered-kind':
     analytic.has(status)?'conditional-result':
     pending.has(status)?plan.native?.canRun===true&&executable.has(request.id)?
       'requires-native-execution':'native-not-ready':
     unresolved[status]??'unresolved';
   return {id:request.id,kind:request.kind,registered,route,
     methodContract:spec?.contract??null,acceptedInputFamilies:acceptedFamilies,
     declaredInputFamily:physical,familyCompatibility,readiness,
     planResultStatus:status,reasonCode:row.reasonCode??null,
     ...(row.reason?{reason:row.reason}:{}),
     ...(Array.isArray(row.candidates)?{candidateCount:row.candidates.length}:
       Array.isArray(row.candidateIncidenceAnglesDeg)?{candidateCount:row.candidateIncidenceAnglesDeg.length}:{}),
     nativeTargetReady:executable.has(request.id),
     ...(bindings.has(request.id)?{inferredSoleComponentBinding:bindings.get(request.id).componentId}:{}),
     originalQuestionFidelity:'not-assessed-by-engine'};
 });
 const count=kind=>entries.filter(e=>e.readiness===kind).length;
 return {format:METHOD_SUITABILITY_FORMAT,source:'validated-opticsim-problem-plan',
   phase:'pre-execution-plan',
   basedOn:'exact author-selected result kinds and current dispatcher outcomes',
   originalQuestionFidelity:'not-assessed-by-engine',
   noAutomaticKindSubstitution:true,
   auditActions:{nativeSimulatorCalls:0,externalModelCalls:0,repairs:0},
   note:'This is the pre-execution method assessment. Final measurements and native status are recorded separately. A registered kind or executable scene does not prove faithful interpretation of the original problem. Unknown kinds are not mapped by text similarity.',
   totalRequests:entries.length,registeredRequests:entries.filter(e=>e.registered).length,
   unregisteredRequests:count('unregistered-kind'),
   pendingNativeRequests:count('requires-native-execution'),
   conditionalResultRequests:count('conditional-result'),
   unresolvedRequests:entries.filter(e=>!['conditional-result','requires-native-execution'].includes(e.readiness)).length,
   entries};
}
