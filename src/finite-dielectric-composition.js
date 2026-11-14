// Bounded composition of EXISTING native components, not a new ray solver.
import {POLYGON_TYPE,POLYGON_CLEARANCE_MM,polygonFaces,validatePolygonGeometry} from './polygon-dielectric.js';
import {PRISM_TYPE,PRISM_CLEARANCE_MM,prismFaces,validatePrismGeometry} from './triangular-prism.js';
import {segmentOutsideFiniteGlass} from './finite-glass-geometry.js';
import {separatedSegmentDistance} from './finite-aperture.js';
import {compositionCardinalitiesMatch} from './composition-validation.js';
export const FINITE_COMPOSITION_MODEL='finite-dielectric-composition';
// v10 is a frozen historical contract. v11 permits one OR two mirrors in the
// same family, including atomic mirror add/remove, without a route controller.
export const FINITE_COMPOSITION_VERSION=10;
export const FINITE_COMPOSITION_EXTENDED_VERSION=11;
export const FINITE_COMPOSITION_SHAPES_VERSION=12;
export const isFiniteCompositionVersion=v=>v===10||v===11||v===12;
// The shape owns region geometry and material boundaries; composition owns
// external placement. The native adapter still compiles the original component.
const regions=Object.freeze({
  [POLYGON_TYPE]:Object.freeze({faces:polygonFaces,validate:validatePolygonGeometry,clearance:POLYGON_CLEARANCE_MM}),
  [PRISM_TYPE]:Object.freeze({faces:prismFaces,validate:validatePrismGeometry,clearance:PRISM_CLEARANCE_MM})
});
export const isFiniteCompositionRegion=type=>Object.hasOwn(regions,type);
const counts=Object.freeze(Object.fromEntries(Object.entries({
  'point-source':{min:1,max:4},[POLYGON_TYPE]:{min:1,max:1},
  'plane-mirror':{min:1,max:2},'ray-detector':{min:0,max:2}
}).map(([type,limit])=>[type,Object.freeze(limit)])));
const shapeCounts=Object.freeze({...counts,
  [POLYGON_TYPE]:Object.freeze({min:0,max:1}),[PRISM_TYPE]:Object.freeze({min:0,max:1})});
const shapeGroups=Object.freeze([Object.freeze({types:Object.freeze(Object.keys(regions)),min:1,max:1})]);
export function finiteShapeCompositionPolicy(){
  return {schemaVersion:FINITE_COMPOSITION_SHAPES_VERSION,model:FINITE_COMPOSITION_MODEL,
    counts:Object.fromEntries(Object.entries(shapeCounts).map(([type,limit])=>[type,{...limit}])),
    groups:shapeGroups.map(g=>({...g,types:[...g.types]})),sourceMode:'single-ray',
    geometry:'Exactly one finite triangle OR convex quadrilateral. Each shape retains its own source, edge and vertex rules. Every external mirror/detector needs a separating face and 0.01 mm mutual clearance.',
    limits:'One or two external plane mirrors; no additional medium, other optics, automatic migration or implied ray route. Native completion is checked separately.'};
}
export function extendedFiniteCompositionPolicy(){
  return {schemaVersion:FINITE_COMPOSITION_EXTENDED_VERSION,model:FINITE_COMPOSITION_MODEL,
    counts:Object.fromEntries(Object.entries(counts).map(([type,limit])=>[type,{...limit}])),
    sourceMode:'single-ray',externalClearanceMm:POLYGON_CLEARANCE_MM,
    limits:'One convex quadrilateral; external mirrors and detectors; no other optics, nested media or automatic migration. Geometry and native completion are separate checks.'};
}
export function finiteCompositionVersionFor(components){
  if(components.some(c=>c.type===PRISM_TYPE))return FINITE_COMPOSITION_SHAPES_VERSION;
  return components.filter(c=>c.type==='plane-mirror').length>1?FINITE_COMPOSITION_EXTENDED_VERSION:FINITE_COMPOSITION_VERSION;
}
export function validateFiniteDielectricComposition(components,endpoints,fail,version=FINITE_COMPOSITION_VERSION){
  const path='$.physics.components',mirrors=components.filter(c=>c.type==='plane-mirror');
  if(!isFiniteCompositionVersion(version))fail(path,'Unsupported finite composition version.','UNSUPPORTED_SCOPE');
  if(version===FINITE_COMPOSITION_VERSION){
    if(mirrors.length!==1||components.some(c=>!['point-source',POLYGON_TYPE,'plane-mirror','ray-detector'].includes(c.type)))
      fail(path,'Finite dielectric composition requires one convex quadrilateral, one external plane mirror, 1–4 single rays and 0–2 external detectors; no other optics or media.','UNSUPPORTED_SCOPE');
  }else if(version===FINITE_COMPOSITION_EXTENDED_VERSION){
    if(!compositionCardinalitiesMatch(components,counts))
      fail(path,'Finite composition v11 requires one convex quadrilateral, 1–2 external plane mirrors, 1–4 single rays and 0–2 external detectors; no other optics or media.','UNSUPPORTED_SCOPE');
  }else if(!compositionCardinalitiesMatch(components,shapeCounts,shapeGroups))
    fail(path,'Finite composition v12 requires exactly one triangle or convex quadrilateral, 1–2 external plane mirrors, 1–4 single rays and 0–2 external detectors; no other optics or media.','UNSUPPORTED_SCOPE');
  // Reuse the unchanged region/source/detector checks. No component is removed
  // from the canonical scene, its native compilation or result qualification.
  const glass=components.find(c=>isFiniteCompositionRegion(c.type));
  const shape=version===FINITE_COMPOSITION_SHAPES_VERSION?regions[glass.type]:regions[POLYGON_TYPE];
  shape.validate(components.filter(c=>c.type!=='plane-mirror'),endpoints,fail);
  const faces=shape.faces(glass.parameters);
  if(mirrors.some(m=>!segmentOutsideFiniteGlass(faces,endpoints(m.parameters),shape.clearance)))
    fail(path,'Mirror must lie entirely outside the dielectric and at least 0.01 mm beyond a common separating face.','UNSUPPORTED_SCOPE');
  const segments=components.filter(c=>['plane-mirror','ray-detector'].includes(c.type));
  for(let i=0;i<segments.length;i++)for(let j=0;j<i;j++){
    if(separatedSegmentDistance(endpoints(segments[i].parameters),endpoints(segments[j].parameters))<shape.clearance)
      fail(path,'External mirror/detector segments need 0.01 mm mutual clearance.','UNSUPPORTED_SCOPE');
  }
}
