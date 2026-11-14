// Shared geometry/measurement helpers for admitted finite glass regions.
// These functions neither trace rays nor admit new shapes or scene combinations.
// Family validators retain their own cardinality, convexity and clearance rules.
const delta=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
export function distanceToFiniteSegment(p,a,b){
 const ab=delta(a,b),ap=delta(a,p),t=Math.max(0,Math.min(1,dot(ap,ab)/dot(ab,ab)));
 // Relative coordinates avoid subtracting two large reconstructed positions.
 return Math.hypot(ap.x-t*ab.x,ap.y-t*ab.y);
}
export function finiteGlassFaces(vertices){
 const count=vertices.length,w=Math.sign(cross(delta(vertices[0],vertices[1]),delta(vertices[0],vertices[2])));
 return vertices.map((a,i)=>{
  const next=(i+1)%count,b=vertices[next],d=delta(a,b),length=Math.hypot(d.x,d.y);
  return {id:'face-'+(i+1)+(next+1),a,b,length,normal:{x:w*d.y/length,y:-w*d.x/length}};
 });
}
// A conservative separating-face proof for a complete external finite segment.
// This checks authored geometry only; it never computes a ray intersection.
export function segmentOutsideFiniteGlass(faces,line,clearanceMm){
 return faces.some(f=>line.every(q=>dot(delta(f.a,q),f.normal)>=clearanceMm));
}
export function compileFiniteGlass(parameters,vertices){
 return {type:'Glass',path:vertices.map(p=>({x:p.x,y:-p.y,arc:false})),
  notDone:false,refIndex:parameters.insideIndex/parameters.outsideIndex,
  partialReflect:parameters.partialReflection};
}
export function finiteGlassEncounter(parameters,vertices,nativePoint,incoming,clearanceMm){
 // Identify a surface only AFTER PhyDemo has supplied its actual hit point.
 const point={x:nativePoint.x,y:-nativePoint.y},faces=finiteGlassFaces(vertices),
  near=faces.filter(f=>distanceToFiniteSegment(point,f.a,f.b)<=1e-5);
 if(near.length!==1||vertices.some(v=>Math.hypot(point.x-v.x,point.y-v.y)<clearanceMm))
  return {point,normal:{x:NaN,y:NaN},faceId:null,invalid:true};
 const face=near[0],normal=face.normal,leaving=incoming&&dot(incoming,normal)>0;
 return {point,normal,faceId:face.id,from:leaving?'inside':'outside',
  incidentIndex:leaving?parameters.insideIndex:parameters.outsideIndex,
  destinationIndex:leaving?parameters.outsideIndex:parameters.insideIndex};
}
