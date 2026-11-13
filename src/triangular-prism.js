import {distanceToFiniteSegment,finiteGlassFaces,compileFiniteGlass,finiteGlassEncounter} from './finite-glass-geometry.js';
// Finite triangle geometry and read-only surface identification. Native Glass
// chooses every hit and outgoing ray; no Snell/Fresnel or routing code here.
export const PRISM_TYPE='triangular-prism';
export const PRISM_PARAMETERS=Object.freeze([
 'x1','y1','x2','y2','x3','y3','insideIndex','outsideIndex','partialReflection'
]);
export const PRISM_CLEARANCE_MM=.01;
export function prismVertices(p){return [1,2,3].map(i=>({x:p['x'+i],y:p['y'+i]}));}
const delta=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
export function prismFaces(p){return finiteGlassFaces(prismVertices(p));}
const distanceToSegment=distanceToFiniteSegment;
export function compilePrism(component){
 return compileFiniteGlass(component.parameters,prismVertices(component.parameters));
}
export function validatePrismGeometry(components,endpoints,fail){
 const path='$.physics.components',prisms=components.filter(c=>c.type===PRISM_TYPE),
  sources=components.filter(c=>c.type==='point-source');
 if(prisms.length!==1||sources.length<1||sources.length>4||
  components.filter(c=>c.type==='ray-detector').length>2||
  components.some(c=>!['point-source',PRISM_TYPE,'ray-detector'].includes(c.type)))
  fail(path,'Prism scope: one finite triangular region, 1–4 single rays and 0–2 external detectors; no other optics or nested regions.','UNSUPPORTED_SCOPE');
 const p=prisms[0].parameters,v=prismVertices(p),faces=prismFaces(p);
 const twiceArea=Math.abs(cross(delta(v[0],v[1]),delta(v[0],v[2])));
 if(v.some(q=>![q.x,q.y].every(Number.isFinite)||Math.abs(q.x)>10000||Math.abs(q.y)>10000)||
  faces.some(f=>f.length<1||twiceArea/f.length<1))
  fail(path,'Prism vertices must be within +/-10000 mm with each edge and altitude at least 1 mm; repeated or collinear vertices are invalid.','UNSUPPORTED_SCOPE');
 for(const c of sources){
  if(c.emission.mode!=='single-ray')fail(path,'Prisms require explicit native single-ray emission.','UNSUPPORTED_SCOPE');
  const s=c.parameters;
  if(faces.some(f=>distanceToSegment(s,f.a,f.b)<PRISM_CLEARANCE_MM))
   fail(path,'Sources need 0.01 mm clearance from every finite prism face.','UNSUPPORTED_SCOPE');
  const a=c.emission.directionDeg*Math.PI/180,d={x:Math.cos(a),y:Math.sin(a)};
  // Conservative initial vertex/grazing guard only, not an intersection solver.
  if(v.some(q=>{const offset=delta(s,q);return dot(offset,d)>0&&Math.abs(cross(offset,d))<PRISM_CLEARANCE_MM;}))
   fail(path,'Initial forward ray passes within 0.01 mm of a prism vertex; corner/grazing incidence is unsupported.','UNSUPPORTED_SCOPE');
 }
 for(const c of components.filter(c=>c.type==='ray-detector')){
  const line=endpoints(c.parameters);
  // A separating face certifies the whole detector lies outside the convex
  // region. Deliberately conservative: reject unproved separation, never clip.
  if(!faces.some(f=>line.every(q=>dot(delta(f.a,q),f.normal)>=PRISM_CLEARANCE_MM)))
   fail(path,'Detector must be wholly outside the prism with a common separating face and 0.01 mm clearance.','UNSUPPORTED_SCOPE');
 }
}
// Identify the face only at a hit ALREADY returned by native Glass. Ambiguous
// corner events invalidate measured evidence but never alter the native ray.
export function prismEncounter(component,nativePoint,incoming){
 return finiteGlassEncounter(component.parameters,prismVertices(component.parameters),
  nativePoint,incoming,PRISM_CLEARANCE_MM);
}
