import {pathToFileURL} from 'node:url';
// Phase 1 Independent Audit Experiment Suite (Areas B, C, D)
// Private scratch script — does not modify any tracked workspace files.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const root = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(root, 'dist/test-core.cjs'));
const {prepareScene, reviseScene, reviseComponents} = await import(pathToFileURL(resolve(root, 'src/authoring.js')).href);
const {evaluateDocument} = await import(pathToFileURL(resolve(root, 'scripts/author-scene.mjs')).href);
const {evaluateObservables} = await import(pathToFileURL(resolve(root, 'src/observables.js')).href);
const {analyzeCoaxialStack} = await import(pathToFileURL(resolve(root, 'src/coaxial-paraxial-stack.js')).href);
const {buildOpticalBenchNativeWitness, runOpticalBenchNativeWitness} = await import(pathToFileURL(resolve(root, 'src/optical-bench-witness.js')).href);

const results = [];
async function runCase(name, fn) {
  try {
    const out = await fn();
    results.push({name, ok: true, ...out});
    console.log(`[PASS-RUN] ${name}:`, JSON.stringify(out));
  } catch (err) {
    results.push({name, ok: false, error: err.message, code: err.code || null, issues: err.issues || null});
    console.log(`[THROW] ${name}: ${err.code || ''} ${err.message}`);
  }
}

async function evalV40(req, obs = []) {
  const prep = prepareScene(req);
  const ev = evaluateDocument(prep.document, core, obs);
  const obsRes = obs.length ? await evaluateObservables(prep.document, obs, ev.summary) : null;
  return {doc: prep.document, summary: ev.summary, obsRes};
}

// =========================================================================
// B1. Independent Snell slab lateral displacement oracle vs v40 native
// =========================================================================
await runCase('B1_slab_lateral_displacement', async () => {
  const n = 1.5, t = 20, thetaDeg = 30;
  const theta = thetaDeg * Math.PI / 180;
  const sinT = Math.sin(theta) / n;
  const thetaT = Math.asin(sinT);
  // Source at (-20, 0), slab x in [0, 20], detector at x = 40
  const yEnter = 20 * Math.tan(theta);
  const yExit = yEnter + t * Math.tan(thetaT);
  const yDetExpected = yExit + 20 * Math.tan(theta);
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: thetaDeg}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -50, x2: 20, y2: -50, x3: 20, y3: 50, x4: 0, y4: 50, insideIndex: n, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 40, y: 0, orientationDeg: 90, length: 100}}
    ]
  }, [
    {id: 'o1', kind: 'detector-hit-events', componentId: 'D1'},
    {id: 'o2', kind: 'interface-face-events', componentId: 'G1'}
  ]);
  const hit = obsRes.results[0].value?.[0];
  return {
    status: summary.native.status,
    yDetExpected,
    yDetObserved: hit?.pointMm?.y,
    errMm: hit ? Math.abs(hit.pointMm.y - yDetExpected) : null,
    dirErr: hit ? Math.hypot(hit.incomingUnit.x - Math.cos(theta), hit.incomingUnit.y - Math.sin(theta)) : null
  };
});

// =========================================================================
// B2. Prism minimum deviation oracle vs v40 native
// =========================================================================
await runCase('B2_prism_minimum_deviation', async () => {
  // Equilateral prism A = 60 deg, n = 1.5 => sin((A+dm)/2) = 1.5*sin(30) = 0.75
  // => i1 = asin(0.75) = 48.59037789 deg, dm = 2*i1 - 60 = 37.18075578 deg
  const A = 60 * Math.PI / 180;
  const n = 1.5;
  const i1 = Math.asin(n * Math.sin(A / 2));
  const dm = 2 * i1 - A;
  // Base horizontal along y = -20 from x=-20 to x=20, apex at (0, -20 + 40*sqrt(3)/2)
  const h = 20 * Math.sqrt(3);
  const v1 = {x: -20, y: -20}, v2 = {x: 20, y: -20}, v3 = {x: 0, y: -20 + h};
  // Left face v1->v3 has angle +60 deg from +x, outward normal at 150 deg
  // Incoming ray normal is 150 deg, so ray pointing into face (toward -normal = -30 deg)
  // rotated by +i1 CCW from -30 deg => directionDeg = -30 + i1*180/pi = +18.59037789 deg
  const dirIn = -30 + i1 * 180 / Math.PI;
  const dirOutExpected = dirIn - dm * 180 / Math.PI; // bends downward by dm
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -30, y: -8, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: dirIn}},
      {id: 'P1', type: 'triangular-prism', parameters: {x1: v1.x, y1: v1.y, x2: v2.x, y2: v2.y, x3: v3.x, y3: v3.y, insideIndex: n, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 35, y: -15, orientationDeg: 90, length: 60}}
    ]
  }, [{id: 'o1', kind: 'detector-hit-events', componentId: 'D1'}]);
  const hit = obsRes.results[0].value?.[0];
  const obsAngleDeg = hit ? Math.atan2(hit.incomingUnit.y, hit.incomingUnit.x) * 180 / Math.PI : null;
  return {
    status: summary.native.status,
    dirOutExpected,
    obsAngleDeg,
    angleErrDeg: obsAngleDeg !== null ? Math.abs(obsAngleDeg - dirOutExpected) : null
  };
});

// =========================================================================
// B3. Beam splitter energy conservation (R + T = incident)
// =========================================================================
await runCase('B3_beam_splitter_energy', async () => {
  const T = 0.37, B = 0.5;
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: B}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'BS1', type: 'beam-splitter', parameters: {x: 0, y: 0, orientationDeg: 45, length: 20, transmissionRatio: T}},
      {id: 'D_T', type: 'ray-detector', parameters: {x: 20, y: 0, orientationDeg: 90, length: 20}},
      {id: 'D_R', type: 'ray-detector', parameters: {x: 0, y: 20, orientationDeg: 0, length: 20}}
    ]
  }, [
    {id: 'o1', kind: 'detector-signed-power', componentId: 'D_T'},
    {id: 'o2', kind: 'detector-signed-power', componentId: 'D_R'},
    {id: 'o3', kind: 'beam-splitter-interactions', componentId: 'BS1'}
  ]);
  const pT = Math.abs(obsRes.results[0].value);
  const pR = Math.abs(obsRes.results[1].value);
  return {
    status: summary.native.status,
    interactions: obsRes.results[2].value,
    pT, expectedT: B * T,
    pR, expectedR: B * (1 - T),
    sumErr: Math.abs((pT + pR) - B)
  };
});

// =========================================================================
// B4. Optical reciprocity (time-reversal) across multi-element v40 bench
// =========================================================================
await runCase('B4_optical_reciprocity', async () => {
  const commonOptics = [
    {id: 'L1', type: 'ideal-lens', parameters: {x: 0, y: 3, focalLength: 80, apertureHeight: 40}},
    {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 20, y1: -30, x2: 35, y2: -30, x3: 35, y3: 30, x4: 20, y4: 30, insideIndex: 1.52, outsideIndex: 1, partialReflection: false}},
    {id: 'M1', type: 'circular-arc-mirror', parameters: {x: 60, y: 0, normalDeg: 180, radius: 120, apertureHeight: 40}}
  ];
  // Forward ray from (-50, 5) at +4 deg -> L1 -> G1 -> M1 -> G1 -> L1 -> D_fwd at x=-50
  const fwd = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -50, y: 5, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 4}},
      ...commonOptics,
      {id: 'D1', type: 'ray-detector', parameters: {x: -60, y: 0, orientationDeg: 90, length: 60}}
    ]
  }, [{id: 'o1', kind: 'detector-hit-events', componentId: 'D1'}]);
  const hitFwd = fwd.obsRes.results[0].value?.[0];
  if (!hitFwd) return {status: fwd.summary.native.status, errors: fwd.summary.native.errors, hitFwd: null};
  // Reverse ray from hitFwd.pointMm in opposite direction (-incomingUnit)
  const revDeg = Math.atan2(-hitFwd.incomingUnit.y, -hitFwd.incomingUnit.x) * 180 / Math.PI;
  const rev = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S2', type: 'point-source', parameters: {x: hitFwd.pointMm.x, y: hitFwd.pointMm.y, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: revDeg}},
      ...commonOptics,
      {id: 'D2', type: 'ray-detector', parameters: {x: -50, y: 0, orientationDeg: 90, length: 60}}
    ]
  }, [{id: 'o1', kind: 'detector-hit-events', componentId: 'D2'}]);
  const hitRev = rev.obsRes.results[0].value?.[0];
  return {
    fwdStatus: fwd.summary.native.status,
    revStatus: rev.summary.native.status,
    yStart: 5,
    yReturned: hitRev?.pointMm?.y,
    posErrMm: hitRev ? Math.abs(hitRev.pointMm.y - 5) : null,
    angleErrDeg: hitRev ? Math.abs((Math.atan2(-hitRev.incomingUnit.y, -hitRev.incomingUnit.x) * 180 / Math.PI) - 4) : null
  };
});

// =========================================================================
// C1. SUSPECTED BUG #1a: False tangency rejection on circular-arc-mirror absent circle
// =========================================================================
await runCase('C1a_arc_mirror_phantom_circle_admission', async () => {
  // Mirror at vertex (100, 0), normalDeg 180, radius 100 => center (0, 0), radius 100
  // apertureHeight = 20 => mirror spans y in [-10, +10] ONLY!
  // Source at (-50, 100), directionDeg 0 => ray at y = 100, 90 mm ABOVE the mirror!
  const {summary} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -50, y: 100, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'M1', type: 'circular-arc-mirror', parameters: {x: 100, y: 0, normalDeg: 180, radius: 100, apertureHeight: 20}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 120, y: 100, orientationDeg: 90, length: 20}}
    ]
  }, [{id: 'o1', kind: 'detector-crossings', componentId: 'D1'}]);
  return {status: summary.native.status, errors: summary.native.errors};
});

// =========================================================================
// C1b. SUSPECTED BUG #1b: False tangency rejection on spherical-lens absent circle
// =========================================================================
await runCase('C1b_spherical_lens_phantom_circle_admission', async () => {
  // Spherical lens at (50, 0), apertureHeight 20 (y in [-10, 10]), centerThickness 6, frontRadius 50, backRadius 50
  // frontCenter = (47 + 50, 0) = (97, 0), radius = 50.
  // Ray at y = 50 (40 mm ABOVE the lens!) shooting horizontally!
  const {summary} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -50, y: 50, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'G1', type: 'spherical-lens', parameters: {x: 50, y: 0, apertureHeight: 20, centerThickness: 6, frontRadius: 50, backRadius: 50, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 120, y: 50, orientationDeg: 90, length: 20}}
    ]
  }, [{id: 'o1', kind: 'detector-crossings', componentId: 'D1'}]);
  return {status: summary.native.status, errors: summary.native.errors};
});

// =========================================================================
// C1c. SUSPECTED BUG #1c: Runtime v40EndpointsVerified false failure via deflected ray
// =========================================================================
await runCase('C1c_spherical_lens_phantom_circle_runtime', async () => {
  // Source at (-50, 0) with directional fan (30 deg) — admission doesn't check directional rays!
  // Actually let's use single-ray reflected by a mirror onto y = 50, 40 mm above spherical lens!
  // Mirror at (0, 25) horizontal? No, mirror at (-50, 50) at 45 deg, source at (-50, 0) pointing up (+90 deg) -> reflects to +x at y=50!
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -50, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 90}},
      {id: 'M1', type: 'plane-mirror', parameters: {x: -50, y: 50, orientationDeg: 45, length: 20}},
      {id: 'G1', type: 'spherical-lens', parameters: {x: 50, y: 0, apertureHeight: 20, centerThickness: 6, frontRadius: 50, backRadius: 50, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 120, y: 50, orientationDeg: 90, length: 20}}
    ]
  }, [{id: 'o1', kind: 'detector-crossings', componentId: 'D1'}]);
  return {status: summary.native.status, errors: summary.native.errors, measurementState: summary.measurementState};
});

// =========================================================================
// C2. SUSPECTED BUG #2: Sandwiched plane-mirror between two touching slabs
// =========================================================================
await runCase('C2_sandwiched_mirror_between_touching_slabs', async () => {
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 10}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -30, x2: 20, y2: -30, x3: 20, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'G2', type: 'polygon-dielectric', parameters: {x1: 20, y1: -30, x2: 40, y2: -30, x3: 40, y3: 30, x4: 20, y4: 30, insideIndex: 1.8, outsideIndex: 1, partialReflection: false}},
      {id: 'M1', type: 'plane-mirror', parameters: {x: 20, y: 0, orientationDeg: 90, length: 60}},
      {id: 'D1', type: 'ray-detector', parameters: {x: -20, y: 15, orientationDeg: 90, length: 30}}
    ]
  }, [
    {id: 'o1', kind: 'mirror-reflections', componentId: 'M1'},
    {id: 'o2', kind: 'detector-hit-events', componentId: 'D1'},
    {id: 'o3', kind: 'interface-interactions', componentId: 'G1'},
    {id: 'o4', kind: 'interface-interactions', componentId: 'G2'}
  ]);
  return {
    status: summary.native.status,
    errors: summary.native.errors,
    obs: obsRes.results.map(r => ({id: r.id, status: r.status, value: r.value}))
  };
});

// =========================================================================
// C3. Cemented spherical lenses with DIFFERENT apertureHeight (ray hits overhang)
// =========================================================================
await runCase('C3_cemented_lenses_mismatched_aperture_overhang', async () => {
  // L1: apertureHeight 20 (y in [-10, 10]), x=0, centerThickness=10, frontRadius=null, backRadius=50 (backApex=5)
  // L2: apertureHeight 40 (y in [-20, 20]), x=10, centerThickness=10, frontRadius=-50 (frontApex=5), backRadius=null
  // Ray at y=15 hits L2's front concave face at y=15 (outside L1's aperture!)
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -30, y: 15, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'L1', type: 'spherical-lens', parameters: {x: 0, y: 0, apertureHeight: 20, centerThickness: 10, frontRadius: null, backRadius: 50, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'L2', type: 'spherical-lens', parameters: {x: 10, y: 0, apertureHeight: 40, centerThickness: 10, frontRadius: -50, backRadius: null, insideIndex: 1.65, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 40, y: 0, orientationDeg: 90, length: 60}}
    ]
  }, [
    {id: 'o1', kind: 'detector-hit-events', componentId: 'D1'},
    {id: 'o2', kind: 'interface-first-event', componentId: 'L2'}
  ]);
  return {
    status: summary.native.status,
    errors: summary.native.errors,
    hit: obsRes.results[0].value,
    l2First: obsRes.results[1].value
  };
});

// =========================================================================
// C4. Spherical-lens flat face (null radius) hit right at y=0 (collinear arc:true midpoint)
// =========================================================================
await runCase('C4_flat_spherical_lens_midpoint_hit', async () => {
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -30, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'L1', type: 'spherical-lens', parameters: {x: 0, y: 0, apertureHeight: 30, centerThickness: 10, frontRadius: null, backRadius: null, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 30, y: 0, orientationDeg: 90, length: 30}}
    ]
  }, [
    {id: 'o1', kind: 'detector-hit-events', componentId: 'D1'},
    {id: 'o2', kind: 'interface-face-events', componentId: 'L1'}
  ]);
  return {
    status: summary.native.status,
    errors: summary.native.errors,
    hit: obsRes.results[0].value,
    faces: obsRes.results[1].value
  };
});

// =========================================================================
// C5. partialReflection: true on simple glass slab (Fresnel truncation behavior)
// =========================================================================
await runCase('C5_partial_reflection_true_simple_slab', async () => {
  const {summary} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: 0.5}, emission: {mode: 'single-ray', directionDeg: 10}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -30, x2: 20, y2: -30, x3: 20, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: true}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 40, y: 0, orientationDeg: 90, length: 60}}
    ]
  });
  return {
    status: summary.native.status,
    truncation: summary.native.truncation,
    measurementState: summary.measurementState,
    processed: summary.native.processed
  };
});

// =========================================================================
// C6. 3-body T-junction touching dielectric slabs
// =========================================================================
await runCase('C6_three_body_T_junction', async () => {
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 5, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -20, x2: 10, y2: -20, x3: 10, y3: 20, x4: 0, y4: 20, insideIndex: 1.4, outsideIndex: 1, partialReflection: false}},
      {id: 'G2', type: 'polygon-dielectric', parameters: {x1: 10, y1: 0, x2: 20, y2: 0, x3: 20, y3: 20, x4: 10, y4: 20, insideIndex: 1.6, outsideIndex: 1, partialReflection: false}},
      {id: 'G3', type: 'polygon-dielectric', parameters: {x1: 10, y1: -20, x2: 20, y2: -20, x3: 20, y3: 0, x4: 10, y4: 0, insideIndex: 1.8, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 30, y: 0, orientationDeg: 90, length: 50}}
    ]
  }, [{id: 'o1', kind: 'detector-hit-events', componentId: 'D1'}]);
  return {status: summary.native.status, errors: summary.native.errors, hits: obsRes.results[0].value};
});

// =========================================================================
// C7. Equal-index neutral touching bodies (n1 === n2 === 1.5)
// =========================================================================
await runCase('C7_equal_index_touching_bodies', async () => {
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 15}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -30, x2: 10, y2: -30, x3: 10, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'G2', type: 'polygon-dielectric', parameters: {x1: 10, y1: -30, x2: 20, y2: -30, x3: 20, y3: 30, x4: 10, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 40, y: 0, orientationDeg: 90, length: 60}}
    ]
  }, [
    {id: 'o1', kind: 'detector-hit-events', componentId: 'D1'},
    {id: 'o2', kind: 'interface-face-events', componentId: 'G1'}
  ]);
  return {status: summary.native.status, errors: summary.native.errors, hit: obsRes.results[0].value?.[0], g1Face23: obsRes.results[1].value?.['face-23']};
});

// =========================================================================
// C8. Unfamiliar 6-type multi-primitive composition (Area D)
// =========================================================================
await runCase('D1_six_primitive_composition', async () => {
  // Interior source inside tilted circular-cap -> ideal-lens -> beam-splitter ->
  // transmitted arm hits circular-arc-mirror -> D1; reflected arm hits plane-mirror -> D2
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'CAP1', type: 'circular-cap-dielectric', parameters: {x: -40, y: 0, radius: 15, capHeight: 15, normalDeg: 0, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'S1', type: 'point-source', parameters: {x: -35, y: 2, brightness: 0.5}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'L1', type: 'ideal-lens', parameters: {x: 0, y: 0, focalLength: 60, apertureHeight: 30}},
      {id: 'BS1', type: 'beam-splitter', parameters: {x: 30, y: 0, orientationDeg: 45, length: 30, transmissionRatio: 0.5}},
      {id: 'AM1', type: 'circular-arc-mirror', parameters: {x: 70, y: 0, normalDeg: 180, radius: 80, apertureHeight: 30}},
      {id: 'PM1', type: 'plane-mirror', parameters: {x: 30, y: 40, orientationDeg: 135, length: 30}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 50, y: 0, orientationDeg: 90, length: 30}},
      {id: 'D2', type: 'ray-detector', parameters: {x: 10, y: 40, orientationDeg: 90, length: 30}}
    ]
  }, [
    {id: 'o1', kind: 'detector-crossings', componentId: 'D1'},
    {id: 'o2', kind: 'detector-crossings', componentId: 'D2'},
    {id: 'o3', kind: 'beam-splitter-interactions', componentId: 'BS1'}
  ]);
  return {
    status: summary.native.status,
    errors: summary.native.errors,
    truncation: summary.native.truncation,
    obs: obsRes.results.map(r => ({id: r.id, status: r.status, value: r.value}))
  };
});

// =========================================================================
// D2. Submerged circle-blocker + submerged detector inside slab + external beam + finite-aperture
// =========================================================================
await runCase('D2_submerged_stop_and_detector_with_beam_aperture', async () => {
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'B1', type: 'parallel-beam', parameters: {x: -40, y: 0, width: 30, directionDeg: 0, brightness: 0.1}},
      {id: 'A1', type: 'finite-aperture', parameters: {x: -20, y: 0, orientationDeg: 90, length: 50, openingLength: 24}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -30, x2: 50, y2: -30, x3: 50, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'CB1', type: 'circle-blocker', parameters: {x: 15, y: 0, radius: 4}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 35, y: 0, orientationDeg: 90, length: 40}}
    ]
  }, [
    {id: 'o1', kind: 'source-emissions', componentId: 'B1'},
    {id: 'o2', kind: 'blocker-absorptions', componentId: 'A1'},
    {id: 'o3', kind: 'blocker-absorptions', componentId: 'CB1'},
    {id: 'o4', kind: 'detector-crossings', componentId: 'D1'}
  ]);
  return {
    status: summary.native.status,
    errors: summary.native.errors,
    obs: obsRes.results.map(r => ({id: r.id, status: r.status, value: r.value}))
  };
});

// =========================================================================
// D3. Witness bridge: flush curved-silvered plano-convex lens (paraxial vs native v40)
// =========================================================================
await runCase('D3_witness_bridge_silvered_plano_convex', async () => {
  // Plano-convex: flat front at x=0, curved back at x=10 with signedRadius=-50 (concave toward +x? Wait: center upstream -> -50 => convex outward back face!)
  // Wait: in coaxial-paraxial-stack, positive signedRadius has center downstream (+x).
  // So back surface with center upstream (-x) has signedRadius = -50.
  // Flush silvered mirror at x=10 with signedRadius = -50 (concave facing +x light).
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    object: {x: -60, y: 0},
    elements: [
      {id: 'S1', type: 'refracting-surface', x: 0, signedRadius: 'infinity', downstreamIndex: 1.5},
      {id: 'M1', type: 'terminal-mirror', x: 10, signedRadius: -50}
    ]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: {format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-conjugate'},
    bodies: [{id: 'G1', frontSurfaceId: 'S1', backSurfaceId: 'M1', apertureHeight: 30}],
    aperturesById: {M1: 30},
    mirrorModel: 'circular-arc-mirror',
    partialReflection: false,
    emitter: {mode: 'single-ray', directionDeg: 1, brightness: 0.2},
    detector: {x: -20, y: 0, orientationDeg: 90, length: 30}
  };
  const rep = await runOpticalBenchNativeWitness(stack, spec, {
    execute: (doc, reqs) => evaluateDocument(doc, core, reqs).summary
  });
  return {
    paraxialImageX: rep.paraxialResult?.value?.imageX,
    comparisonStatus: rep.comparison?.status,
    maxPerpMissMm: rep.comparison?.summary?.maxPerpendicularMissMm,
    deltaYAtTargetX: rep.comparison?.hits?.[0]?.deltaYAtTargetXMm
  };
});
