// Shared scalar angular mathematics extracted from planar-angle-queries.js.
// Analytical only: never locates intersections, changes native rays or chooses a route.
export const RAD=Math.PI/180;
export const CRITICAL_UNCERTAINTY=2e-12;
export function asinAngle(s){
  // Tiny overshoot from valid trigonometric rounding is clipped; a genuinely
  // impossible angle is NOT clamped into a valid physical solution.
  if(!Number.isFinite(s)||s<0||s>1+2e-12)return null;
  return Math.asin(Math.min(1,s))/RAD;
}
// The expression order and equal-material exception preserve planar behavior.
// transverse = n_incident * sin(i). Callers own geometry, scope and branch policy.
export function classifySnellTransmission(transverse,n1,n2,at){
  const ratio=transverse/n2;
  const sameMedium=n1===n2;
  const delta=ratio-1;
  const uncertainCritical=!sameMedium&&Math.abs(delta)<=CRITICAL_UNCERTAINTY;
  const tir=!sameMedium&&delta>CRITICAL_UNCERTAINTY;
  const out=sameMedium?at:asinAngle(ratio);
  return {sameMedium,uncertainCritical,tir,out};
}
