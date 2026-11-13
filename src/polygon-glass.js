// Explicit four-vertex convex dielectric, sharing native Glass and finite
// boundary observations with the triangular prism. No polygon/ray DSL.
import {FINITE_GLASS_CLEARANCE_MM,finiteVertices,finiteFaces,compileFiniteGlass,
  finiteGlassEncounter,validateFiniteGlassAttachments,delta,cross,dot} from './finite-glass.js';
export const POLYGON_TYPE='glass-polygon';
export const POLYGON_PARAMETERS=Object.freeze([
  'x1','y1','x2','y2','x3','y3','x4','y4','insideIndex','outsideIndex','partialReflection'
]);
export const polygonVertices=p=>finiteVertices(p,4);
export const polygonFaces=p=>finiteFaces(polygonVertices(p));
export const polygonEncounter=(c,nativePoint,incoming)=>
  finiteGlassEncounter(c,polygonVertices(c.parameters),nativePoint,incoming);
export const compilePolygon=c=>compileFiniteGlass(c,polygonVertices(c.parameters));
export function validatePolygonGeometry(components,endpoints,fail){
  const path='$.physics.components',polygons=components.filter(c=>c.type===POLYGON_TYPE),
    sources=components.filter(c=>c.type==='point-source');
  if(polygons.length!==1||sources.length<1||sources.length>4||
     components.filter(c=>c.type==='ray-detector').length>2||
     components.some(c=>!['point-source',POLYGON_TYPE,'ray-detector'].includes(c.type)))
    fail(path,'Polygon-glass scope: one stationary convex quadrilateral, 1–4 exact single rays, 0–2 exterior detectors; no other optics or nested glass.','UNSUPPORTED_SCOPE');
  const vertices=polygonVertices(polygons[0].parameters),faces=finiteFaces(vertices);
  // All four turns must have one consistent, clearly nonzero orientation.
  // This excludes bow-ties, concavity, collinear edges and needle-like corners.
  const turns=vertices.map((v,i)=>{
    const a=delta(v,vertices[(i+1)%4]),b=delta(vertices[(i+1)%4],vertices[(i+2)%4]);
    return cross(a,b);
  });
  const sign=Math.sign(turns[0]);
  if(vertices.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)||
       Math.abs(v.x)>10000||Math.abs(v.y)>10000)||
     faces.some(f=>!Number.isFinite(f.length)||f.length<1)||!sign||
     turns.some((v,i)=>Math.sign(v)!==sign||
       Math.abs(v)/Math.max(faces[i].length,faces[(i+1)%4].length)<1))
    fail(path,'A glass polygon needs four ordered, strictly convex, non-collinear vertices within +/-10000 mm; each edge and local altitude must be >=1 mm.','UNSUPPORTED_SCOPE');
  validateFiniteGlassAttachments(components,endpoints,fail,POLYGON_TYPE,vertices,faces,{name:'Polygon glass'});
}
