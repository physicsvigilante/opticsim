import {distanceToFiniteSegment,finiteGlassFaces,compileFiniteGlass,finiteGlassEncounter,segmentOutsideFiniteGlass} from './finite-glass-geometry.js';
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
const pointSegmentDistance=distanceToFiniteSegment;
export function polygonFaces(p){return finiteGlassFaces(polygonVertices(p));}
export function compilePolygon(component){
  return compileFiniteGlass(component.parameters,polygonVertices(component.parameters));
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
  if(faces.some((f,i)=>f.length<1||v.some((q,j)=>j!==i&&j!==(i+1)%4&&
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
    if(!segmentOutsideFiniteGlass(faces,line,POLYGON_CLEARANCE_MM))
      fail(path,'Detector must lie entirely outside the polygon and 0.01 mm from a common separating face.','UNSUPPORTED_SCOPE');
  }
}
export function polygonEncounter(component,nativePoint,incoming){
  return finiteGlassEncounter(component.parameters,polygonVertices(component.parameters),
    nativePoint,incoming,POLYGON_CLEARANCE_MM);
}
