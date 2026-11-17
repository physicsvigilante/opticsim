// Bounded v16 physical composition of a real native thick spherical lens and
// one finite native plane Mirror. This is admission geometry ONLY:
// PhyDemo chooses all ray encounters, reflected/return routes and misses.
import {compositionCountsMatch} from './composition-profiles.js';
import {SPHERICAL_LENS_TYPE,SPHERICAL_CLEARANCE_MM,
  thickLensGeometry,validateSphericalLensTrain} from './spherical-lens.js';

export const THICK_MIRROR_MODEL='native-thick-lens-mirror-tracing';
export const THICK_MIRROR_VERSION=16;

export function validateThickLensMirrorComposition(components,mirrorEndpoints,fail){
 const path='$.physics.components';
 if(!compositionCountsMatch(components,THICK_MIRROR_MODEL,THICK_MIRROR_VERSION))
  fail(path,'Native thick-lens/mirror scope: exactly one spherical biconvex thick lens, exactly one finite plane mirror, 1–4 explicit single rays and 0–2 passive detectors; no other optics.','UNSUPPORTED_SCOPE');
 // The previously reviewed v15 geometry/material/single-ray/source/detector
 // rules are reused verbatim. This is a VALIDATION VIEW, not a scene rewrite.
 // Do not run a different or simplified thick-lens geometry validator.
 const withoutMirror=components.filter(c=>c.type!=='plane-mirror');
 validateSphericalLensTrain(withoutMirror,mirrorEndpoints,fail);
 const glass=components.find(c=>c.type===SPHERICAL_LENS_TYPE);
 const mirror=components.find(c=>c.type==='plane-mirror');
 const extent=thickLensGeometry(glass.parameters);
 const ends=mirrorEndpoints(mirror.parameters);
 if(ends.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||
     Math.abs(p.x)>10000||Math.abs(p.y)>10000))
  fail(path,'The entire finite mirror must fit inside +/-10000 mm.','UNSUPPORTED_SCOPE');
 // A straight finite mirror is inside the x interval spanned by its endpoints.
 // A complete x-axis separation certificate is conservative but cannot
 // accidentally admit a mirror crossing an actual curved lens/rim.
 if(!(ends.every(p=>p.x<=extent.left-SPHERICAL_CLEARANCE_MM)||
      ends.every(p=>p.x>=extent.right+SPHERICAL_CLEARANCE_MM)))
  fail(path,'The complete mirror segment must remain to one side of the entire thick lens by >=0.01 mm; intersection/near-touch is unsupported.','UNSUPPORTED_SCOPE');
 // Additional mirror/source/detector mutual exclusion is inherited from the
 // existing general-optical + detectors validation rules. No mandated route.
}
