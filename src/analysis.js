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
  // ABCD transfer matrix to immediately after the last lens.
  const { source, lenses } = benchComponents(doc);
  let [a, b, c, d] = [1, 0, 0, 1];
  let x = source.parameters.x;
  for (const lens of lenses) {
    const gap = lens.parameters.x - x;
    [a, b] = [a + gap * c, b + gap * d];
    [c, d] = [c - a / lens.parameters.focalLength, d - b / lens.parameters.focalLength];
    x = lens.parameters.x;
  }
  const unavailable = () => ({ kind: 'unavailable', reason: 'The lens-train matrix is numerically unreliable at these parameters.' });
  if (![a, b, c, d].every(Number.isFinite)) return unavailable();
  const tolerance = 1e-10;
  if (Math.abs(d) <= tolerance * Math.max(1, Math.abs(b) / 100)) return { kind: 'at-infinity', tolerance };
  const distance = -b / d;
  // det(M)=1 implies magnification=1/D, checked against A+z*C for cancellation.
  const magnification = 1 / d, checkMagnification = a + distance * c;
  const imageX = x + distance, imageY = magnification * source.parameters.y;
  if (![distance, magnification, checkMagnification, imageX, imageY].every(Number.isFinite) ||
      Math.abs(checkMagnification - magnification) > 1e-7 * Math.abs(magnification)) return unavailable();
  return { kind: distance >= 0 ? 'finite-real' : 'finite-virtual', x: imageX,
    y: imageY, distance, magnification };
}
