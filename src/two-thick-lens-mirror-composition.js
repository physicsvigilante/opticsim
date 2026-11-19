// Isolated v17 whole-system admission for TWO finite biconvex SphericalLens
// objects and ONE independent finite plane Mirror. Geometry validation only.
// Pinned native PhyDemo alone chooses every reflected/refracted encounter.
import {compositionCountsMatch} from './composition-profiles.js';
import {SPHERICAL_CLEARANCE_MM,SPHERICAL_LENS_TYPE,
  thickLensGeometry,validateSphericalLensTrain} from './spherical-lens.js';

export const TWO_THICK_MIRROR_MODEL='native-two-thick-lens-mirror-tracing';
export const TWO_THICK_MIRROR_VERSION=17;
export const TWO_THICK_MIRROR_NATIVE_DEPTH=16;

export function validateTwoThickLensMirrorComposition(components,mirrorEndpoints,fail){
 const path='$.physics.components';
 if(!compositionCountsMatch(components,TWO_THICK_MIRROR_MODEL,TWO_THICK_MIRROR_VERSION))
  fail(path,'v17 supports exactly two separated finite spherical biconvex lenses, one finite plane mirror, 1–4 explicit single native rays and 0–2 passive detectors; no other optics.','UNSUPPORTED_SCOPE');
 // The v15 full two-lens geometry, material, source and detector constraints
 // are retained verbatim on a VALIDATION-ONLY component subset. Canonical
 // objects and the native scene are never filtered or rewritten.
 const withoutMirror=components.filter(c=>c.type!=='plane-mirror');
 validateSphericalLensTrain(withoutMirror,mirrorEndpoints,fail);
 const lenses=components.filter(c=>c.type===SPHERICAL_LENS_TYPE);
 const mirror=components.find(c=>c.type==='plane-mirror');
 const endpoints=mirrorEndpoints(mirror.parameters);
 if(endpoints.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)||
  Math.abs(v.x)>10000||Math.abs(v.y)>10000))
  fail(path,'The complete finite plane mirror must remain inside +/-10000 mm.','UNSUPPORTED_SCOPE');
 for(const lens of lenses){
  const g=thickLensGeometry(lens.parameters);
  if(!(endpoints.every(v=>v.x<=g.left-SPHERICAL_CLEARANCE_MM)||
       endpoints.every(v=>v.x>=g.right+SPHERICAL_CLEARANCE_MM)))
   fail(path,'Every point of the finite mirror must remain horizontally separated by >=0.01 mm from each entire thick-lens body; touching, crossing or near-overlap is unsupported.','UNSUPPORTED_SCOPE');
 }
 // The profile separately dispatches the old general-optical validator
 // (native finite mirror and source) and the old passive-detector validator.
 // These are not equivalent to an arbitrary multi-object ray-route contract.
}
