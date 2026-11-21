import {compositionCountsMatch} from './composition-profiles.js';
import {parallelBeamGeometry} from './parallel-beam.js';
import {semicircularExtents, semicircularEncounter} from './semicircular-dielectric.js';
import {v26PinnedBeamAdmissionSamples} from './native-beam-planar-mirror-v26.js';

export const CURVED_BEAM_MODEL = 'native-curved-entry-beam-tracing';
const withinWorld = p => [p.x,p.y].every(v => Number.isFinite(v) && Math.abs(v) <= 10000);

export function validateCurvedEntryBeam(components, density, fail) {
  const reject = message => fail('$.physics.components', message, 'UNSUPPORTED_SCOPE');
  if (!compositionCountsMatch(components,CURVED_BEAM_MODEL,30))
    reject('Require one parallel beam and one right semicircular dielectric.');
  const b = components.find(c => c.type === 'parallel-beam').parameters;
  const g = components.find(c => c.type === 'semicircular-dielectric').parameters;
  const endpoints = parallelBeamGeometry(b);
  if (g.radius < 50 || g.radius > 1000 || !semicircularExtents(g).every(withinWorld) ||
      g.partialReflection !== false || !(g.insideIndex > g.outsideIndex && g.insideIndex/g.outsideIndex <= 1.6))
    reject('Use a radius from 50 to 1000 mm, a higher interior index with ratio at most 1.6, and partial reflection disabled.');
  if (Math.abs(b.directionDeg) !== 180 || b.width < 10 || b.width > 100 ||
      ![endpoints.p1,endpoints.p2].every(withinWorld) || b.x-g.x-g.radius < 1 ||
      Math.abs(b.y-g.y)+b.width/2 > g.radius/2)
    reject('Place the entire horizontal leftward beam at least 1 mm beyond the arc and within the central half-radius on either side of the axis.');
  const witness = v26PinnedBeamAdmissionSamples(b,density);
  if (!Number.isFinite(density) || density < .048 || density > 1 || b.brightness > density ||
      witness.nearHalfInteger || witness.samples.length < 1 || witness.samples.length > 100)
    reject('Use 1–100 unambiguous native samples, density 0.048–1 and unsaturated brightness.');
}

function direction(ray) {
  const dx = ray.p2.x-ray.p1.x, dy = ray.p1.y-ray.p2.y, length = Math.hypot(dx,dy);
  return {x:dx/length, y:dy/length};
}

export function curvedEntryBeamAudit(doc, scene, idMap) {
  const b = doc.physics.components.find(c => c.type === 'parallel-beam');
  const g = doc.physics.components.find(c => c.type === 'semicircular-dielectric');
  const source = scene.objs[idMap.get(b.id)], glass = scene.objs[idMap.get(g.id)];
  const expected = v26PinnedBeamAdmissionSamples(b.parameters,doc.simulation.rayDensity).samples;
  const paths = new Map();
  let fault = false, starts = 0, exits = 0, minY = Infinity, maxY = -Infinity;
  const start = source.onSimulationStart;
  source.onSimulationStart = function (...args) {
    const result = start.apply(this,args);
    starts++;
    if (result?.newRays?.length !== expected.length || result?.brightnessScale !== 1) fault = true;
    else for (const [i,ray] of result.newRays.entries()) {
      const d = direction(ray);
      if (paths.has(ray) || ray.p1.x !== expected[i].x || -ray.p1.y !== expected[i].y ||
          !(d.x < 0 && Math.abs(d.y) < 1e-9)) fault = true;
      paths.set(ray,{stage:0,x:ray.p1.x,y:ray.p1.y,direction:d});
    }
    return result;
  };
  const incident = glass.onRayIncident;
  glass.onRayIncident = function (ray,index,point,...rest) {
    const before = direction(ray);
    const event = semicircularEncounter(g,point,before);
    // An accepted callback must lie on the incoming native half-line. Read
    // both coordinates before Glass mutates the primary ray in place.
    const dx = point.x-ray.p1.x, dy = ray.p1.y-point.y;
    if (!(dx*before.x + dy*before.y > 0 && Math.abs(dx*before.y-dy*before.x)<1e-6)) fault = true;
    const previous = paths.get(ray);
    if (!previous || previous.x!==ray.p1.x || previous.y!==ray.p1.y ||
        !(Math.hypot(before.x-previous.direction.x,before.y-previous.direction.y)<1e-9)) fault = true;
    const result = incident.call(this,ray,index,point,...rest);
    const d = direction(ray), projection = d.x*event.normal.x + d.y*event.normal.y;
    const tangent = v => v.x*event.normal.y-v.y*event.normal.x;
    if (!(Math.abs(event.incidentIndex*tangent(before)-event.destinationIndex*tangent(d))<1e-7) ||
        !(Math.hypot(ray.p1.x-event.point.x,ray.p1.y+event.point.y)<1e-6)) fault = true;
    if (event.invalid || !result || result.isAbsorbed || result.isUndefinedBehavior || result.newRays?.length) fault = true;
    if (previous?.stage === 0 && event.faceId === 'face-arc' && event.from === 'outside' && projection < -1e-5)
      paths.set(ray,{stage:1,x:ray.p1.x,y:ray.p1.y,direction:d});
    else if (previous?.stage === 1 && event.faceId === 'face-flat' && event.from === 'inside' && projection > 1e-5) {
      paths.delete(ray);
      exits++;
      minY = Math.min(minY,event.point.y);
      maxY = Math.max(maxY,event.point.y);
    } else fault = true;
    return result;
  };
  return {
    key:'v30CurvedBeamVerified',
    finish(emitted,interfaces,warnings) {
      const meter = interfaces?.[g.id];
      if (fault || starts !== 1 || paths.size || warnings.length || emitted !== expected.length ||
          exits !== emitted || meter?.interactions !== 2*emitted || meter.transmitted !== meter.interactions ||
          meter.faces?.['face-flat']?.interactions !== exits || meter.faces?.['face-arc']?.interactions !== exits)
        return 'Curved-entry Beam boundary samples could not be verified.';
      return null;
    },
    decorate(interfaces) {
      interfaces[g.id].faces['face-flat'].sampledYRangeMm = {min:minY,max:maxY,count:exits};
    }
  };
}
