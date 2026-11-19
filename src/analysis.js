import { calculateLensTrain } from './lens-train-matrix.js';
import { validate, benchComponents } from './contract.js';
// Independent, arrangement-specific predictions; never generates simulation rays.
export function predict(doc) {
  validate(doc);
  switch (doc.physics.model) {
    case 'ideal-thin-lens-geometric': return predictLenses(doc);
    case 'plane-mirror-geometric': return predictMirror(doc);
    case 'lens-mirror-return-geometric': return predictReturn(doc);
    case 'mixed-lens-mirror-tracing': return { kind: 'unavailable',
      reason: 'Mixed lens–mirror tracing has no route-independent analytical image; native PhyDemo selects the actual ray encounters.' };
    case 'triangular-prism-tracing': return {kind:'unavailable',reason:'Finite prism exposes native face observations, not an image solver.'};
    case 'native-parallel-two-lens-tracing': return {kind:'unavailable',reason:'Finite decentered native ideal lenses do not establish a physical image or justify a coaxial lens-train prediction.'};
    case 'native-parallel-prism-tracing': return {kind:'unavailable',reason:'Sampled native finite triangle Beam refraction and TIR do not constitute a general prism inverse, detected image or 3D optics prediction.'};
    case 'native-parallel-semicircular-tracing': return {kind:'unavailable',reason:'Native flat-and-arc semicircular glass measures sampled refraction and TIR, not an image or a general 3D half-cylinder solution.'};
    case 'circular-dielectric-tracing': return {kind:'unavailable',reason:'Finite circular dielectric exposes native boundary observations, not an image solver or a 3D sphere model.'};
    case 'planar-media-tracing': return {kind:'unavailable',reason:'Planar media expose native interface angles and branches, not an analytical image solver.'};
    case 'general-component-tracing': return { kind: 'unavailable',
      reason: 'General component tracing does not imply an optical route or an analytical image. PhyDemo traces the actual ray intersections.' };
    default: return { kind: 'unavailable', reason: 'No analytical prediction is available for this arrangement.' };
  }
}
function predictReturn(doc) {
  const source = doc.physics.components.find(c => c.type === 'point-source');
  const lens = doc.physics.components.find(c => c.type === 'ideal-lens');
  const mirror = doc.physics.components.find(c => c.type === 'plane-mirror');
  const s = lens.parameters.x - source.parameters.x, g = mirror.parameters.x - lens.parameters.x, f = lens.parameters.focalLength;
  // L(f) T(2g) L(f) T(s), in unfolded travel coordinates. On return,
  // travel increases toward -x while the transverse y-up axis stays fixed.
  const a = 1 - 2 * g / f, b = s + 2 * g * (1 - s / f);
  const c = -2 / f + 2 * g / (f * f), d = 1 - s / f - b / f;
  const unavailable = () => ({ kind: 'unavailable', reason: 'The return-path matrix is numerically unreliable at these parameters.' });
  if (![a, b, c, d].every(Number.isFinite)) return unavailable();
  const result = { kind: 'lens-mirror-return', path: [lens.id, mirror.id, lens.id] };
  const tolerance = 1e-10;
  if (Math.abs(d) <= tolerance * Math.max(1, Math.abs(b) / 100)) return { ...result, imageKind: 'at-infinity', tolerance };
  const distance = -b / d, magnification = 1 / d;
  // det(M)=1 independently implies m=1/D. Disagreement with A+z*C
  // detects cancellation rather than presenting an unreliable finite image.
  const checkMagnification = a + distance * c;
  if (!Number.isFinite(distance) || !Number.isFinite(magnification) ||
      Math.abs(checkMagnification - magnification) > 1e-7 * Math.abs(magnification)) return unavailable();
  return { ...result, imageKind: distance >= 0 ? 'finite-real' : 'finite-virtual',
    x: lens.parameters.x - distance, y: magnification * source.parameters.y, distance, magnification };
}
function predictMirror(doc) {
  const source = doc.physics.components.find(c => c.type === 'point-source').parameters;
  const mirror = doc.physics.components.find(c => c.type === 'plane-mirror').parameters;
  const theta = mirror.orientationDeg * Math.PI / 180;
  const nx = -Math.sin(theta), ny = Math.cos(theta);
  const d = (source.x - mirror.x) * nx + (source.y - mirror.y) * ny;
  // Conditional ideal image across the supporting line, not a simulated detection.
  return { kind: 'plane-mirror-virtual', x: source.x - 2 * d * nx,
    y: source.y - 2 * d * ny, normalDistance: Math.abs(d) };
}
function predictLenses(doc) {
  const { source, lenses } = benchComponents(doc);
  return calculateLensTrain(source.parameters.x, lenses.map(lens => lens.parameters),
    source.parameters.y).prediction;
}
