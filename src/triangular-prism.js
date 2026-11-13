import {FINITE_GLASS_CLEARANCE_MM,finiteVertices,finiteFaces,compileFiniteGlass,
  finiteGlassEncounter,validateFiniteGlassAttachments,delta,cross} from './finite-glass.js';
// Finite triangle geometry and read-only surface identification. Native Glass
// chooses every hit and outgoing ray; no Snell/Fresnel or routing code here.
export const PRISM_TYPE='triangular-prism';
export const PRISM_PARAMETERS=Object.freeze([
 'x1','y1','x2','y2','x3','y3','insideIndex','outsideIndex','partialReflection'
]);
export const PRISM_CLEARANCE_MM=FINITE_GLASS_CLEARANCE_MM;
export const prismVertices=p=>finiteVertices(p,3);
export const prismFaces=p=>finiteFaces(prismVertices(p));
export const compilePrism=c=>compileFiniteGlass(c,prismVertices(c.parameters));
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
 validateFiniteGlassAttachments(components,endpoints,fail,PRISM_TYPE,v,faces,{name:'Prism'});
}
export const prismEncounter=(component,nativePoint,incoming)=>
  finiteGlassEncounter(component,prismVertices(component.parameters),nativePoint,incoming);
