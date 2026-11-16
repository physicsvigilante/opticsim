// Plain read-only measurements shared by CLI and browser result qualification.
// Projection is not proof of completion; callers retain run-status/hash gates.
export const NATIVE_OBSERVATION_KEYS=Object.freeze([
  'emissionsById','reflectionsById','detectorsById','interfacesById','blockersById'
]);
export function snapshotNativeObservations(diagnostics,requests=[]){
  const ordinary=Object.fromEntries(NATIVE_OBSERVATION_KEYS.map(key=>
    [key,structuredClone(diagnostics?.[key]??null)]));
  // Opt-in only: never add keys or change any existing default result shape.
  const hits=requests.some(r=>r?.kind==='detector-hit-events');
  const parentage=requests.some(r=>r?.kind==='detector-ray-provenance');
  const finite=requests.some(r=>r?.kind==='finite-hit-numerical-diagnostic');
  return {...ordinary,
    ...(hits?{detectorHitEventsById:structuredClone(diagnostics?.detectorHitEventsById??null)}:{}),
    ...(parentage?{detectorRayProvenanceById:structuredClone(diagnostics?.detectorRayProvenanceById??null)}:{}),
    ...(finite?{finiteHitDiagnostic:structuredClone(diagnostics?.finiteHitDiagnostic??null)}:{})};
}
