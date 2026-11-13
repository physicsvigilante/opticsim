// Four-vertex convex dielectric geometry. Native Glass owns every ray.
// This layer validates a bounded polygon and identifies ONLY actual native hits.
export const POLYGON_TYPE='polygon-dielectric';
export const POLYGON_PARAMETERS=Object.freeze([
  'x1','y1','x2','y2','x3','y3','x4','y4',
  'insideIndex','outsideIndex','partialReflection'
]);
export const POLYGON_CLEARANCE_MM=.01;
export const polygonVertices=p=>[1,2,3,4].map(i=>({x:p['x'+i],y:p['y'+i]}));
const delta=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pointSegmentDistance=(p,a,b)=>{
  const ab=delta(a,b),ap=delta(a,p),t=Math.max(0,Math.min(1,dot(ap,ab)/dot(ab,ab)));
  return distance(p,{x:a.x+t*ab.x,y:a.y+t*ab.y});
};
const keys=['face-12','face-23','face-34','face-41'];
export function polygonFaces(p){
  const v=polygonVertices(p),w=Math.sign(cross(delta(v[0],v[1]),delta(v[0],v[2])));
  return v.map((a,i)=>{
    const b=v[(i+1)%4],d=delta(a,b),length=Math.hypot(d.x,d.y);
    return {id:keys[i],a,b,length,normal:{x:w*d.y/length,y:-w*d.x/length}};
  });
}
export function compilePolygon(component){
  const p=component.parameters;
  return {type:'Glass',path:polygonVertices(p).map(v=>({x:v.x,y:-v.y,arc:false})),
    notDone:false,refIndex:p.insideIndex/p.outsideIndex,
    partialReflect:p.partialReflection};
}
export function validatePolygonGeometry(components,endpoints,fail){
  const path='$.physics.components',polygons=components.filter(c=>c.type===POLYGON_TYPE),
    sources=components.filter(c=>c.type==='point-source');
  if(polygons.length!==1||sources.length<1||sources.length>4||
     components.filter(c=>c.type==='ray-detector').length>2||
     components.some(c=>!['point-source',POLYGON_TYPE,'ray-detector'].includes(c.type)))
    fail(path,'Polygon scope: one stationary convex quadrilateral, 1–4 exact single rays and 0–2 external detectors; no other optical or nested media.','UNSUPPORTED_SCOPE');
  const p=polygons[0].parameters,v=polygonVertices(p);
  if(v.some(q=>![q.x,q.y].every(Number.isFinite)||Math.abs(q.x)>10000||Math.abs(q.y)>10000))
    fail(path,'All four vertices must be finite and within +/-10000 mm.','UNSUPPORTED_SCOPE');
  const turns=v.map((a,i)=>cross(delta(a,v[(i+1)%4]),delta(v[(i+1)%4],v[(i+2)%4])));
  const winding=Math.sign(turns[0]);
  if(!winding||turns.some(t=>winding*t<=0))
    fail(path,'Quadrilateral must be strictly convex, non-self-intersecting, and have consistent vertex winding.','UNSUPPORTED_SCOPE');
  const faces=polygonFaces(p);
  // Every vertex must be separated from every nonincident supporting edge;
  // additionally each edge's opposite vertices need a 1 mm altitude.
  if(faces.some(f=>f.length<1||v.some(q=>q!==f.a&&q!==f.b&&
       Math.abs(cross(delta(f.a,f.b),delta(f.a,q)))/f.length<1)))
    fail(path,'All polygon edges and opposite-vertex altitudes must be at least 1 mm.','UNSUPPORTED_SCOPE');
  for(const c of sources){
    if(c.emission.mode!=='single-ray')
      fail(path,'Polygon glass requires an explicitly directed single native ray per source.','UNSUPPORTED_SCOPE');
    const s=c.parameters;
    if(faces.some(f=>pointSegmentDistance(s,f.a,f.b)<POLYGON_CLEARANCE_MM))
      fail(path,'Sources require 0.01 mm clearance from each finite polygon edge.','UNSUPPORTED_SCOPE');
    const a=c.emission.directionDeg*Math.PI/180,d={x:Math.cos(a),y:Math.sin(a)};
    if(v.some(q=>{const z=delta(s,q);return dot(z,d)>0&&Math.abs(cross(z,d))<POLYGON_CLEARANCE_MM;}))
      fail(path,'Initial forward ray passes within 0.01 mm of a polygon vertex.','UNSUPPORTED_SCOPE');
  }
  for(const c of components.filter(c=>c.type==='ray-detector')){
    const line=endpoints(c.parameters);
    if(!faces.some(f=>line.every(q=>dot(delta(f.a,q),f.normal)>=POLYGON_CLEARANCE_MM)))
      fail(path,'Detector must lie entirely outside the polygon and 0.01 mm from a common separating face.','UNSUPPORTED_SCOPE');
  }
}
export function polygonEncounter(component,nativePoint,incoming){
  const p=component.parameters,point={x:nativePoint.x,y:-nativePoint.y},
    v=polygonVertices(p),faces=polygonFaces(p),
    near=faces.filter(f=>pointSegmentDistance(point,f.a,f.b)<=1e-5);
  if(near.length!==1||v.some(a=>distance(point,a)<POLYGON_CLEARANCE_MM))
    return {point,normal:{x:NaN,y:NaN},faceId:null,invalid:true};
  const face=near[0],normal=face.normal,
    leaving=incoming&&dot(incoming,normal)>0;
  return {point,normal,faceId:face.id,from:leaving?'inside':'outside',
    incidentIndex:leaving?p.insideIndex:p.outsideIndex,
    destinationIndex:leaving?p.outsideIndex:p.insideIndex};
}
