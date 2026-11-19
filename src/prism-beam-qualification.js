// v22-only numerical evidence boundaries, not native ray propagation.
// Historical v8 prism observations continue using their frozen 0.01 mm guard.
// All checks are made AFTER real native onRayIncident geometry is returned.
export const PRISM_BEAM_VERTEX_CLEARANCE_MM=.1;
export const PRISM_BEAM_CRITICAL_SIN_MARGIN=1e-5;

// Necessary incident Snell condition, not a transmission prediction.
// When n_in sin(theta_in) is within an explicit narrow dimensionless band
// around n_out, the exact native TIR/grazing decision is numerically risky.
// Preserve the native outcome but withhold this run's qualified observables.
export function prismBeamNearCritical(encounter,incoming){
 const n=encounter?.normal,n1=encounter?.incidentIndex,n2=encounter?.destinationIndex;
 if(!incoming||!n||![n.x,n.y,incoming.x,incoming.y,n1,n2].every(Number.isFinite)||
     !(n1>n2))return false;
 const sinIncident=Math.abs(incoming.x*n.y-incoming.y*n.x);
 return Math.abs(n1*sinIncident-n2)<=PRISM_BEAM_CRITICAL_SIN_MARGIN;
}
