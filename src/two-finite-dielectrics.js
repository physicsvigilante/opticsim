// Proposed v14: exactly two externally separated convex Glass bodies.
// This is ADMISSION geometry only; pinned native PhyDemo propagates every ray.
// Before release, an independent physics reviewer must approve the new model
// scope and confirm real native cross-body interactions on the pinned core.
import {POLYGON_TYPE,POLYGON_CLEARANCE_MM,polygonVertices,polygonFaces,
 validatePolygonGeometry} from './polygon-dielectric.js';
import {segmentOutsideFiniteGlass} from './finite-glass-geometry.js';
import {compositionCountsMatch} from './composition-profiles.js';

export const TWO_FINITE_REGIONS_MODEL='two-separated-dielectrics-tracing';
export const TWO_FINITE_REGIONS_VERSION=14;
export function validateTwoSeparatedDielectrics(components,endpoints,fail){
 const path='$.physics.components';
 if(!compositionCountsMatch(components,TWO_FINITE_REGIONS_MODEL,TWO_FINITE_REGIONS_VERSION))
  fail(path,'Two-region scope requires exactly two convex four-vertex glasses, 1–4 exact single-ray sources and 0–2 external detectors; no other optics, media or nested glass.','UNSUPPORTED_SCOPE');
 const regions=components.filter(c=>c.type===POLYGON_TYPE);
 if(regions.length!==2)fail(path,'Exactly two separately authored polygon regions are required.','UNSUPPORTED_SCOPE');
 // Each original v9 geometry rule is reused WITHOUT weakening the 1 mm
 // edges/altitudes, 0.01 mm source/vertex or external detector clearances.
 // Validate independently with only that one body's source/detector context.
 for(const body of regions){
  const single=components.filter(c=>c.type!==POLYGON_TYPE||c.id===body.id);
  validatePolygonGeometry(single,endpoints,fail);
 }
 const [a,b]=regions.map(c=>c.parameters);
 if(a.outsideIndex!==b.outsideIndex)
  fail(path,'Two separate glass regions require the same explicitly authored exterior refractive index; differing backgrounds would need a new medium model.','UNSUPPORTED_SCOPE');
 // Convex disjointness is certified only if all vertices of one polygon
 // lie strictly beyond one full outward supporting face of the other. By
 // convexity, the entire second polygon lies there too; edge crossings,
 // tangencies, overlap, and containment cannot pass. This conservative
 // separating-axis proof reuses the EXISTING polygon 0.01 mm clearance.
 // It is not a ray-intersection tolerance and never changes propagation.
 const fa=polygonFaces(a),fb=polygonFaces(b),va=polygonVertices(a),vb=polygonVertices(b);
 if(!segmentOutsideFiniteGlass(fa,vb,POLYGON_CLEARANCE_MM)&&
    !segmentOutsideFiniteGlass(fb,va,POLYGON_CLEARANCE_MM))
  fail(path,'Two glasses must be disjoint with at least 0.01 mm separation proven by a complete supporting face; touching, crossing, nesting and unproven separation are unsupported.','UNSUPPORTED_SCOPE');
}
