// Isolated v18 admission: two native finite spherical thick lenses, one
// native finite mirror, one native finite centered-gap Aperture.
// This module validates authored geometry only. It NEVER calculates a ray
// intersection, redirects a ray, synthesizes a crossing or patches PhyDemo.
import {compositionCountsMatch} from './composition-profiles.js';
import {SPHERICAL_CLEARANCE_MM,SPHERICAL_LENS_TYPE,thickLensGeometry} from './spherical-lens.js';
import {FINITE_APERTURE_TYPE,apertureGeometry,APERTURE_CLEARANCE_MM} from './finite-aperture.js';
import {validateTwoThickLensMirrorComposition} from './two-thick-lens-mirror-composition.js';

export const THICK_APERTURE_MODEL='native-two-thick-lens-mirror-aperture-tracing';
export const THICK_APERTURE_VERSION=18;
export const THICK_APERTURE_NATIVE_DEPTH=16;

const onOneSide=(points,left,right,margin)=>
  points.every(p=>p.x<=left-margin)||points.every(p=>p.x>=right+margin);

export function validateThickApertureComposition(components,mirrorEndpoints,fail){
  const path='$.physics.components';
  if(!compositionCountsMatch(components,THICK_APERTURE_MODEL,THICK_APERTURE_VERSION))
    fail(path,'v18 requires exactly two finite biconvex spherical lenses, one plane mirror, one finite Aperture, 1–4 explicit single rays and 0–2 passive detectors; no other optics.','UNSUPPORTED_SCOPE');

  // Reuse every validated v17 lens/mirror/source/detector bound, without
  // deleting anything from the canonical document or compiled native scene.
  validateTwoThickLensMirrorComposition(
    components.filter(c=>c.type!==FINITE_APERTURE_TYPE),mirrorEndpoints,fail
  );
  const aperture=components.find(c=>c.type===FINITE_APERTURE_TYPE);
  const p=aperture.parameters;
  // Strict axis-aligned native stop for this version. Rotated/oblique stops
  // need separate physical clearance and corner/grazing validation.
  if(p.orientationDeg!==90&&p.orientationDeg!==-90)
    fail(path,'v18 only supports a vertical aperture tangent (+90° or -90°); tilted stops require separate verification.','UNSUPPORTED_SCOPE');
  const g=apertureGeometry(p,mirrorEndpoints);
  const endpoints=[g.p1,g.p2,g.p3,g.p4];
  if(endpoints.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)||
      Math.abs(q.x)>10000||Math.abs(q.y)>10000))
    fail(path,'Entire native aperture, including opaque arms and gap endpoints, must remain inside +/-10000 mm.','UNSUPPORTED_SCOPE');

  for(const lens of components.filter(c=>c.type===SPHERICAL_LENS_TYPE)){
    const x=thickLensGeometry(lens.parameters);
    if(!onOneSide(endpoints,x.left,x.right,SPHERICAL_CLEARANCE_MM))
      fail(path,'Entire aperture must remain >=0.01 mm outside each whole thick-lens x envelope; a gap does not permit overlap with glass.','UNSUPPORTED_SCOPE');
  }
  // Stronger than simple finite segment nonintersection: separate the entire
  // stop x-plane from other finite native mirror/detector segments, even when
  // their y-ranges do not intersect the aperture's arms.
  for(const c of components.filter(c=>c.type==='plane-mirror'||c.type==='ray-detector')){
    if(!onOneSide(mirrorEndpoints(c.parameters),p.x,p.x,APERTURE_CLEARANCE_MM))
      fail(path,'Mirror and detector segments must remain >=0.01 mm to one side of the entire aperture x-plane.','UNSUPPORTED_SCOPE');
  }
  for(const source of components.filter(c=>c.type==='point-source')){
    const s=source.parameters;
    if(Math.abs(s.x-p.x)<APERTURE_CLEARANCE_MM)
      fail(path,'Source may not be on or within 0.01 mm of the aperture supporting plane.','UNSUPPORTED_SCOPE');
    const angle=source.emission.directionDeg*Math.PI/180;
    const direction={x:Math.cos(angle),y:Math.sin(angle)};
    if(Math.abs(direction.x)<=1e-8)
      fail(path,'Initial rays nearly tangent to the vertical aperture are unsupported.','UNSUPPORTED_SCOPE');
    // Check each of the TWO arm endpoints and TWO open-gap corners. This is
    // an admission refusal for an ambiguous *initial* ray, not a ray tracer
    // or an assumption about later reflected/refracted encounters.
    if(endpoints.some(q=>{
      const z={x:q.x-s.x,y:q.y-s.y};
      return z.x*direction.x+z.y*direction.y>0&&
        Math.abs(z.x*direction.y-z.y*direction.x)<=APERTURE_CLEARANCE_MM;
    }))
      fail(path,'Initial source ray passes within 0.01 mm of a native aperture arm/gap endpoint.','UNSUPPORTED_SCOPE');
  }
  // The composition catalog separately runs the original v4 finite-arm and
  // mirror segment guards (without the thick lenses) and detector guards.
  // This rule never assumes a source→aperture→lens→mirror itinerary.
}
