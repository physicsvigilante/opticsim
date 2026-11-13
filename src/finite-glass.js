// Shared bounded finite-glass geometry: canonical y-up vertices and native
// Glass compilation. This does NOT intersect, propagate, refract or reroute rays.
export const FINITE_GLASS_CLEARANCE_MM=.01;
export const delta=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
export const cross=(a,b)=>a.x*b.y-a.y*b.x;
export const dot=(a,b)=>a.x*b.x+a.y*b.y;
export function finiteVertices(p,count){
  return Array.from({length:count},(_,i)=>({x:p['x'+(i+1)],y:p['y'+(i+1)]}));
}
export function finiteFaces(vertices){
  const w=Math.sign(vertices.reduce((total,v,i)=>total+cross(v,vertices[(i+1)%vertices.length]),0));
  return vertices.map((a,i)=>{
    const b=vertices[(i+1)%vertices.length],d=delta(a,b),length=Math.hypot(d.x,d.y);
    return {id:`face-${i+1}${(i+1)%vertices.length+1}`,a,b,length,
      normal:{x:w*d.y/length,y:-w*d.x/length}};
  });
}
export function distanceToSegment(p,a,b){
  const ab=delta(a,b),ap=delta(a,p),square=dot(ab,ab);
  const t=square>0?Math.max(0,Math.min(1,dot(ap,ab)/square)):0;
  return Math.hypot(ap.x-t*ab.x,ap.y-t*ab.y);
}
export function compileFiniteGlass(component,vertices){
  const p=component.parameters;
  return {type:'Glass',path:vertices.map(v=>({x:v.x,y:-v.y,arc:false})),
    notDone:false,refIndex:p.insideIndex/p.outsideIndex,partialReflect:p.partialReflection};
}
// Read native hit location only AFTER PhyDemo has chosen the encounter.
// Surface/corner ambiguities are invalid evidence, not guessed face identity.
export function finiteGlassEncounter(component,vertices,nativePoint,incoming){
  const p=component.parameters,point={x:nativePoint.x,y:-nativePoint.y};
  const faces=finiteFaces(vertices),near=faces.filter(f=>distanceToSegment(point,f.a,f.b)<=1e-5);
  if(near.length!==1||vertices.some(v=>Math.hypot(point.x-v.x,point.y-v.y)<FINITE_GLASS_CLEARANCE_MM))
    return {point,normal:{x:NaN,y:NaN},invalid:true,faceId:null};
  const face=near[0],normal=face.normal,leaving=incoming&&dot(incoming,normal)>0;
  return {normal,point,faceId:face.id,from:leaving?'inside':'outside',
    incidentIndex:leaving?p.insideIndex:p.outsideIndex,
    destinationIndex:leaving?p.outsideIndex:p.insideIndex};
}
// A common conservative admission test for triangle and quadrilateral regions.
// Detectors must have one separating supporting face: sufficient, not necessary.
export function validateFiniteGlassAttachments(components,endpoints,fail,regionType,vertices,faces,{name}={}){
  const path='$.physics.components',regions=components.filter(c=>c.type===regionType),
    sources=components.filter(c=>c.type==='point-source');
  if(regions.length!==1||sources.length<1||sources.length>4||
    components.filter(c=>c.type==='ray-detector').length>2||
    components.some(c=>!['point-source',regionType,'ray-detector'].includes(c.type)))
    fail(path,(name||'Finite glass')+' scope: one bounded region, 1–4 single rays, 0–2 external detectors, no other optics or nested regions.','UNSUPPORTED_SCOPE');
  for(const c of sources){
    if(c.emission.mode!=='single-ray')
      fail(path,(name||'Finite glass')+' requires explicit native single-ray emission.','UNSUPPORTED_SCOPE');
    const s=c.parameters;
    if(faces.some(f=>distanceToSegment(s,f.a,f.b)<FINITE_GLASS_CLEARANCE_MM))
      fail(path,'Sources need at least 0.01 mm clearance from every finite glass face.','UNSUPPORTED_SCOPE');
    const a=c.emission.directionDeg*Math.PI/180,d={x:Math.cos(a),y:Math.sin(a)};
    // Only forward near-vertex directions are conservatively excluded; native
    // engine still chooses all actual ray hits, including surface misses.
    if(vertices.some(v=>{const offset=delta(s,v);
      return dot(offset,d)>0&&Math.abs(cross(offset,d))<FINITE_GLASS_CLEARANCE_MM;}))
      fail(path,'Initial forward ray passes within 0.01 mm of a glass vertex; corner incidence is unsupported.','UNSUPPORTED_SCOPE');
  }
  for(const c of components.filter(c=>c.type==='ray-detector')){
    const line=endpoints(c.parameters);
    if(!faces.some(f=>line.every(q=>dot(delta(f.a,q),f.normal)>=FINITE_GLASS_CLEARANCE_MM)))
      fail(path,'Detector must be wholly outside finite glass with a separating face and 0.01 mm clearance.','UNSUPPORTED_SCOPE');
  }
}
