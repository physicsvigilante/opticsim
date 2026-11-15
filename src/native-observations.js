// Plain read-only measurements shared by CLI and browser result qualification.
// Projection is not proof of completion; callers retain run-status/hash gates.
export const NATIVE_OBSERVATION_KEYS=Object.freeze([
  'emissionsById','reflectionsById','detectorsById','interfacesById','blockersById'
]);
export function snapshotNativeObservations(diagnostics,requests=[]){
  const ordinary=Object.fromEntries(NATIVE_OBSERVATION_KEYS.map(key=>
    [key,structuredClone(diagnostics?.[key]??null)]));
  // Opt-in snapshot: old source/canonical/native report fingerprints are unchanged.
  return requests.some(r=>r?.kind==='detector-hit-events')?
    {...ordinary,detectorHitEventsById:structuredClone(diagnostics?.detectorHitEventsById??null)}:ordinary;
}
