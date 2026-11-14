// Bounded composition of EXISTING native components, not a new ray solver.
import {POLYGON_TYPE,POLYGON_CLEARANCE_MM,polygonFaces,validatePolygonGeometry} from './polygon-dielectric.js';
import {segmentOutsideFiniteGlass} from './finite-glass-geometry.js';
import {separatedSegmentDistance} from './finite-aperture.js';
export const FINITE_COMPOSITION_MODEL='finite-dielectric-composition';
export const FINITE_COMPOSITION_VERSION=10;
export function validateFiniteDielectricComposition(components,endpoints,fail){
  const path='$.physics.components',mirrors=components.filter(c=>c.type==='plane-mirror');
  if(mirrors.length!==1||components.some(c=>!['point-source',POLYGON_TYPE,'plane-mirror','ray-detector'].includes(c.type)))
    fail(path,'Finite dielectric composition requires one convex quadrilateral, one external plane mirror, 1–4 single rays and 0–2 external detectors; no other optics or media.','UNSUPPORTED_SCOPE');
  // Reuse the unchanged region/source/detector checks. No component is removed
  // from the canonical scene, its native compilation or result qualification.
  validatePolygonGeometry(components.filter(c=>c.type!=='plane-mirror'),endpoints,fail);
  const glass=components.find(c=>c.type===POLYGON_TYPE),faces=polygonFaces(glass.parameters);
  if(!segmentOutsideFiniteGlass(faces,endpoints(mirrors[0].parameters),POLYGON_CLEARANCE_MM))
    fail(path,'Mirror must lie entirely outside the dielectric and at least 0.01 mm beyond a common separating face.','UNSUPPORTED_SCOPE');
  const segments=components.filter(c=>['plane-mirror','ray-detector'].includes(c.type));
  for(let i=0;i<segments.length;i++)for(let j=0;j<i;j++){
    if(separatedSegmentDistance(endpoints(segments[i].parameters),endpoints(segments[j].parameters))<POLYGON_CLEARANCE_MM)
      fail(path,'External mirror/detector segments need 0.01 mm mutual clearance.','UNSUPPORTED_SCOPE');
  }
}
