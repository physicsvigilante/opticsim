// Test-only vector Snell construction; not the production inverse formula.
// No intersections or outgoing rays from this helper are supplied to PhyDemo.
const R=Math.PI/180;
export function prismVectorReference(A,i,n,n0){
 const si=n0*Math.sin(i*R)/n;
 if(si>1)return {kind:'entry-tir'};
 const u={x:Math.sqrt(1-si*si),y:si};
 const normal={x:Math.cos(A*R),y:Math.sin(A*R)};
 const normalDot=u.x*normal.x+u.y*normal.y;
 const tangentMagnitude=u.x*normal.y-u.y*normal.x;
 if(normalDot<=0||tangentMagnitude< -1e-14)return {kind:'outside-branch'};
 const tangential=n*tangentMagnitude;
 if(tangential>n0)return {kind:'exit-tir'};
 const outward=Math.sqrt(n0*n0-tangential*tangential);
 const r1=Math.atan2(u.y,u.x)/R,r2=Math.atan2(tangentMagnitude,normalDot)/R;
 const e=Math.atan2(tangential,outward)/R;
 return {kind:'transmission',r1,r2,e,deviation:i+e-A};
}
