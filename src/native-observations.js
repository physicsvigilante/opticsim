// Plain read-only measurements shared by CLI and browser result qualification.
// Projection is not proof of completion; callers retain run-status/hash gates.
export const NATIVE_OBSERVATION_KEYS=Object.freeze([
  'emissionsById','reflectionsById','detectorsById','interfacesById','blockersById'
]);
export const MISSING_V27_ENDPOINTS='A fresh native endpoint verification is required for this profile.';
export function hasEndpointEvidence(doc,evidence) {
  if(doc?.schemaVersion===29)return evidence?.v29FanVerified===true;
  if(doc?.schemaVersion===28)return evidence?.v28EndpointsVerified===true;
  return doc?.schemaVersion!==27 || evidence?.v27EndpointsVerified===true;
}
// An injected runner can use an older core with the same upstream pin and
// scene SHA. Do not pass its raw counters through an accepted summary.
export function qualifyRunnerSummary(doc,summary) {
  if (hasEndpointEvidence(doc,summary?.observations) || !summary?.executionPassed) return summary;
  return {canonicalSha256:summary.canonicalSha256,executionPassed:false,
    native:{status:'incomplete',error:MISSING_V27_ENDPOINTS,errors:[MISSING_V27_ENDPOINTS],warnings:[]},
    observations:null,measurementState:'withheld-incomplete'};
}
export function snapshotNativeObservations(diagnostics,requests=[]){
  const ordinary=Object.fromEntries(NATIVE_OBSERVATION_KEYS.map(key=>
    [key,structuredClone(diagnostics?.[key]??null)]));
  // Opt-in only: never add keys or change any existing default result shape.
  const hits=requests.some(r=>r?.kind==='detector-hit-events');
  const parentage=requests.some(r=>r?.kind==='detector-ray-provenance');
  const finite=requests.some(r=>r?.kind==='finite-hit-numerical-diagnostic');
  return {...ordinary,
    ...(diagnostics?.v29FanVerified===true?{v29FanVerified:true}:{}),
    ...(diagnostics?.v28EndpointsVerified===true?{v28EndpointsVerified:true}:{}),
    ...(diagnostics?.v27EndpointsVerified===true?{v27EndpointsVerified:true}:{}),
    ...(hits?{detectorHitEventsById:structuredClone(diagnostics?.detectorHitEventsById??null)}:{}),
    ...(parentage?{detectorRayProvenanceById:structuredClone(diagnostics?.detectorRayProvenanceById??null)}:{}),
    ...(finite?{finiteHitDiagnostic:structuredClone(diagnostics?.finiteHitDiagnostic??null)}:{})};
}
