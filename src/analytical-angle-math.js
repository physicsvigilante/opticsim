// Shared scalar angular arithmetic extracted from planar-angle-queries.js.
// Analytical qualification only: never modifies native optics or its tolerances.
export const RAD=Math.PI/180;
export const CRITICAL_UNCERTAINTY=2e-12;
export function asinAngle(s){
  // Tiny overshoot from valid trigonometric rounding is clipped; a genuinely
  // impossible angle is NOT clamped into a valid physical solution.
  if(!Number.isFinite(s)||s<0||s>1+2e-12)return null;
  return Math.asin(Math.min(1,s))/RAD;
}
export function snellBoundaryState(ratio,sameMedium){
  const delta=ratio-1;
  return {uncertainCritical:!sameMedium&&Math.abs(delta)<=CRITICAL_UNCERTAINTY,
    tir:!sameMedium&&delta>CRITICAL_UNCERTAINTY};
}
