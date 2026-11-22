// Plain read-only measurements shared by CLI and browser result qualification.
// Projection is not proof of completion; callers retain run-status/hash gates.
export const NATIVE_OBSERVATION_KEYS=Object.freeze([
  'emissionsById','reflectionsById','detectorsById','interfacesById','blockersById'
]);
export const MISSING_V27_ENDPOINTS='A fresh native endpoint verification is required for this profile.';
export function hasEndpointEvidence(doc,evidence) {
  if(doc?.schemaVersion===37)return evidence?.v37EndpointsVerified===true;
  if(doc?.schemaVersion===36)return evidence?.v36GuideFanVerified===true;
  if(doc?.schemaVersion===35)return evidence?.v35MirrorBoxVerified===true;
  if(doc?.schemaVersion===34)return evidence?.v34ImmersedArcVerified===true;
  if(doc?.schemaVersion===33)return evidence?.v33GradedSlabVerified===true;
  if(doc?.schemaVersion===32)return evidence?.v32CapVerified===true;
  if(doc?.schemaVersion===31)return evidence?.v31SlabArcVerified===true;
  if(doc?.schemaVersion===30)return evidence?.v30CurvedBeamVerified===true;
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
    ...(diagnostics?.v37EndpointsVerified===true?{v37EndpointsVerified:true}:{}),
    ...(diagnostics?.v37OpticalIncidentsById?{v37OpticalIncidentsById:structuredClone(diagnostics.v37OpticalIncidentsById)}:{}),
    ...(diagnostics?.v36GuideFanVerified===true?{v36GuideFanVerified:true}:{}),
    ...(diagnostics?.v35MirrorBoxVerified===true?{v35MirrorBoxVerified:true}:{}),
    ...(diagnostics?.v34ImmersedArcVerified===true?{v34ImmersedArcVerified:true}:{}),
    ...(diagnostics?.v33GradedSlabVerified===true?{v33GradedSlabVerified:true}:{}),
    ...(diagnostics?.v32CapVerified===true?{v32CapVerified:true}:{}),
    ...(diagnostics?.v31SlabArcVerified===true?{v31SlabArcVerified:true}:{}),
    ...(diagnostics?.v30CurvedBeamVerified===true?{v30CurvedBeamVerified:true}:{}),
    ...(diagnostics?.v29FanVerified===true?{v29FanVerified:true}:{}),
    ...(diagnostics?.v28EndpointsVerified===true?{v28EndpointsVerified:true}:{}),
    ...(diagnostics?.v27EndpointsVerified===true?{v27EndpointsVerified:true}:{}),
    ...(hits?{detectorHitEventsById:structuredClone(diagnostics?.detectorHitEventsById??null)}:{}),
    ...(parentage?{detectorRayProvenanceById:structuredClone(diagnostics?.detectorRayProvenanceById??null)}:{}),
    ...(finite?{finiteHitDiagnostic:structuredClone(diagnostics?.finiteHitDiagnostic??null)}:{})};
}
