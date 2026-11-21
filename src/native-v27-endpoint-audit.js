import geometry from '../vendor/ray-optics/src/core/geometry.js';
import {beamTwoPlaneMirrorSafetyWitness, V27_SECTION_AGREEMENT_MM} from './native-beam-two-plane-mirror-v27.js';
import {BEAM_PLANAR_MIRROR_MIRROR_RIM_CLEARANCE_MM, BEAM_PLANAR_MIRROR_DETECTOR_ENDPOINT_CLEARANCE_MM} from './native-beam-planar-mirror-v26.js';

const ascending = (a,b) => a-b;
function agree(a,b,budget) {
  if (a.length !== b.length) return false;
  a.sort(ascending);
  b.sort(ascending);
  return a.every((y,i) => Math.abs(y-b[i]) <= budget);
}

// Observe the pinned simulator's actual candidate queries and selected contacts.
// A finite miss has no callback point. Evaluate the pinned supporting-line
// expression on the actual incoming ray for that query only. Never change its
// result, advance a ray, or pair samples across different cross-sections.
export function installV27EndpointAudit(doc,scene,idMap) {
  const components = doc.physics.components;
  const witness = beamTwoPlaneMirrorSafetyWitness(components,doc.simulation.rayDensity);
  const sections = [];
  let fault = null;
  function section(expected) {
    const result = {expected, candidates:[], hits:[], incidents:[]};
    sections.push(result);
    return result;
  }
  const middleOfSlab = (witness.frontX+witness.rearX)/2;
  const mirror = components.find(c => c.type === 'plane-mirror');
  const detector = components.find(c => c.type === 'ray-detector');
  const mirrorSection = section(witness.samples.map(s => s.mirrorY));
  watch(mirror,BEAM_PLANAR_MIRROR_MIRROR_RIM_CLEARANCE_MM,(x,dx) =>
    dx>0 && x>middleOfSlab && x<(witness.rearX+witness.mirrorX)/2 ? mirrorSection : null);
  if (detector) {
    const inbound = section(witness.samples.map(s => s.detectorY[0].inbound));
    const returning = section(witness.samples.map(s => s.detectorY[0].outbound));
    const detectorX = detector.parameters.x;
    watch(detector,BEAM_PLANAR_MIRROR_DETECTOR_ENDPOINT_CLEARANCE_MM,(x,dx) => {
      // Admission separates the entire emitter from the Detector by >=0.01 mm.
      if (dx>0 && x<detectorX-0.005) return inbound;
      if (dx<0 && x>(witness.frontX+detectorX)/2 && x<middleOfSlab) return returning;
      return null;
    });
  }
  function watch(component,margin,select) {
    const target = scene.objs[idMap.get(component.id)];
    const query = target.checkRayIntersects;
    const incident = target.onRayIncident;
    const selectRay = ray => select(ray.p1.x,ray.p2.x-ray.p1.x);
    const low = Math.min(target.p1.y,target.p2.y);
    const high = Math.max(target.p1.y,target.p2.y);
    target.checkRayIntersects = function(ray) {
      const hit = query.call(this,ray);
      try {
        const s = selectRay(ray);
        if (s) {
          const p = hit ?? geometry.linesIntersection(ray,this);
          const inside = p.y>low && p.y<high;
          if (!Number.isFinite(p.y) || !(Math.abs(p.x-component.parameters.x)<=V27_SECTION_AGREEMENT_MM)
              || !geometry.intersectionIsOnRay(p,ray) || Boolean(hit)!==inside
              || Math.min(Math.abs(p.y-low),Math.abs(p.y-high))<=margin
              || (s===mirrorSection && !hit) || s.candidates.length>=s.expected.length) {
            fault = component.id+': native finite endpoint classification or clearance is uncertain';
          } else {
            s.candidates.push(-p.y);
            if (hit) s.hits.push(-p.y);
          }
        }
      } catch { fault = component.id+': native endpoint query could not be inspected'; }
      return hit;
    };
    target.onRayIncident = function(...args) {
      try {
        const s = selectRay(args[0]);
        if (!s || s.incidents.length>=s.expected.length || !Number.isFinite(args[2]?.y)) {
          fault = component.id+': unexpected native finite-segment encounter';
        } else s.incidents.push(-args[2].y);
      } catch { fault = component.id+': native encounter could not be inspected'; }
      return incident.apply(this,args);
    };
  }
  return function finish() {
    if (fault) return fault;
    for (const s of sections) {
      if (!agree(s.expected,s.candidates,V27_SECTION_AGREEMENT_MM) || !agree(s.hits,s.incidents,0))
        return 'v27 native mirror/detector cross-sections or selected encounters disagree with endpoint qualification';
    }
    return null;
  };
}
