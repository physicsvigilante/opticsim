import {pathToFileURL} from 'node:url';
// Phase 1 Independent Audit Experiment Suite 2 (Deep Physics, Witness, Composability, Edge Cases)
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const root = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(root, 'dist/test-core.cjs'));
const {prepareScene, reviseScene, reviseComponents} = await import(pathToFileURL(resolve(root, 'src/authoring.js')).href);
const {evaluateDocument} = await import(pathToFileURL(resolve(root, 'scripts/author-scene.mjs')).href);
const {evaluateObservables} = await import(pathToFileURL(resolve(root, 'src/observables.js')).href);
const {analyzeCoaxialStack} = await import(pathToFileURL(resolve(root, 'src/coaxial-paraxial-stack.js')).href);
const {runOpticalBenchNativeWitness} = await import(pathToFileURL(resolve(root, 'src/optical-bench-witness.js')).href);

async function runCase(name, fn) {
  try {
    const out = await fn();
    console.log(`[PASS-RUN] ${name}:`, JSON.stringify(out));
  } catch (err) {
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
// 1. Fix B4: Optical reciprocity (time-reversal) — read 2nd hit on D2 or place D2 behind S2
// =========================================================================
await runCase('B4_fixed_optical_reciprocity', async () => {
  const commonOptics = [
    {id: 'L1', type: 'ideal-lens', parameters: {x: 0, y: 3, focalLength: 80, apertureHeight: 40}},
    {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 20, y1: -30, x2: 35, y2: -30, x3: 35, y3: 30, x4: 20, y4: 30, insideIndex: 1.52, outsideIndex: 1, partialReflection: false}},
    {id: 'M1', type: 'circular-arc-mirror', parameters: {x: 60, y: 0, normalDeg: 180, radius: 120, apertureHeight: 40}}
  ];
  const fwd = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -50, y: 5, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 4}},
      ...commonOptics,
      {id: 'D1', type: 'ray-detector', parameters: {x: -60, y: 0, orientationDeg: 90, length: 60}}
    ]
  }, [{id: 'o1', kind: 'detector-hit-events', componentId: 'D1'}]);
  const hitFwd = fwd.obsRes.results[0].value?.[0];
  const revDeg = Math.atan2(-hitFwd.incomingUnit.y, -hitFwd.incomingUnit.x) * 180 / Math.PI;
  const rev = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S2', type: 'point-source', parameters: {x: hitFwd.pointMm.x, y: hitFwd.pointMm.y, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: revDeg}},
      ...commonOptics,
      {id: 'D2', type: 'ray-detector', parameters: {x: -50, y: 0, orientationDeg: 90, length: 60}}
    ]
  }, [{id: 'o1', kind: 'detector-hit-events', componentId: 'D2'}]);
  // D2 is hit twice: index 0 going +x, index 1 returning -x!
  const hits = rev.obsRes.results[0].value || [];
  const ret = hits.find(h => h.incomingUnit.x < 0);
  const retBackDeg = ret ? Math.atan2(-ret.incomingUnit.y, -ret.incomingUnit.x) * 180 / Math.PI : null;
  return {
    fwdStatus: fwd.summary.native.status,
    revStatus: rev.summary.native.status,
    hitCount: hits.length,
    yStart: 5,
    yReturned: ret?.pointMm?.y,
    posErrMm: ret ? Math.abs(ret.pointMm.y - 5) : null,
    angleErrDeg: retBackDeg !== null ? Math.abs(retBackDeg - 4) : null
  };
});

// =========================================================================
// 2. Fix C2: Sandwiched plane-mirror between two touching slabs
// =========================================================================
await runCase('C2_fixed_sandwiched_mirror', async () => {
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 10}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -30, x2: 20, y2: -30, x3: 20, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'G2', type: 'polygon-dielectric', parameters: {x1: 20, y1: -30, x2: 40, y2: -30, x3: 40, y3: 30, x4: 20, y4: 30, insideIndex: 1.8, outsideIndex: 1, partialReflection: false}},
      {id: 'M1', type: 'plane-mirror', parameters: {x: 20, y: 0, orientationDeg: 90, length: 60}},
      {id: 'D1', type: 'ray-detector', parameters: {x: -10, y: 15, orientationDeg: 90, length: 30}}
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
// 3. Diagnose D3: Why did witness bridge silvered plano-convex return native-run-not-qualified?
// =========================================================================
await runCase('D3_diagnose_witness_silvered_plano_convex', async () => {
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
    nativeStatus: rep.nativeExecution?.status,
    nativeErrors: rep.nativeExecution?.errors,
    nativeWarnings: rep.nativeExecution?.warnings,
    comparisonStatus: rep.comparison?.status,
    comparisonReason: rep.comparison?.reason,
    encounters: rep.comparison?.stackEncounters
  };
});

// =========================================================================
// 4. All 6 spherical-lens shapes vs exact ray-circle Snell oracle!
// =========================================================================
function traceSphericalLensOracle(p, y0) {
  // Horizontal ray from left at height y0 through spherical-lens p
  const n = p.insideIndex / p.outsideIndex;
  const frontApex = p.x - p.centerThickness / 2;
  const backApex = p.x + p.centerThickness / 2;
  // Refract at front face
  let x1, n1x, n1y;
  if (p.frontRadius === null) {
    x1 = frontApex; n1x = -1; n1y = 0;
  } else {
    const R = p.frontRadius, absR = Math.abs(R);
    const cx = frontApex + R;
    const dx = Math.sqrt(absR * absR - y0 * y0);
    x1 = R > 0 ? cx - dx : cx + dx;
    // Outward normal from glass
    n1x = (R > 0 ? (x1 - cx) : (cx - x1)) / absR;
    n1y = (R > 0 ? y0 : -y0) / absR;
  }
  // Snell at front: incoming d = (1, 0), entering glass (ratio = 1/n)
  const snell = (dx, dy, nx, ny, ratio) => {
    // Make normal oppose incoming ray
    let N_x = nx, N_y = ny;
    let cosI = -(dx * N_x + dy * N_y);
    if (cosI < 0) { N_x = -N_x; N_y = -N_y; cosI = -cosI; }
    const sin2T = ratio * ratio * (1 - cosI * cosI);
    const cosT = Math.sqrt(1 - sin2T);
    return {
      x: ratio * dx + (ratio * cosI - cosT) * N_x,
      y: ratio * dy + (ratio * cosI - cosT) * N_y
    };
  };
  const d1 = snell(1, 0, n1x, n1y, 1 / n);
  // Intersect back face
  let x2, y2, n2x, n2y;
  if (p.backRadius === null) {
    const t = (backApex - x1) / d1.x;
    x2 = backApex; y2 = y0 + t * d1.y;
    n2x = 1; n2y = 0;
  } else {
    const R = p.backRadius, absR = Math.abs(R);
    const cx = backApex - R;
    const wx = x1 - cx, wy = y0;
    const b = wx * d1.x + wy * d1.y;
    const c = wx * wx + wy * wy - absR * absR;
    const disc = Math.sqrt(b * b - c);
    // R > 0 (convex back): hit is on right side of circle (larger t); R < 0 (concave back): hit is on left side (smaller t)
    const t = R > 0 ? (-b + disc) : (-b - disc);
    x2 = x1 + t * d1.x; y2 = y0 + t * d1.y;
    n2x = (R > 0 ? (x2 - cx) : (cx - x2)) / absR;
    n2y = (R > 0 ? y2 : -y2) / absR;
  }
  const d2 = snell(d1.x, d1.y, n2x, n2y, n);
  // Propagate to detector at x = 40
  const tDet = (40 - x2) / d2.x;
  return {yDet: y2 + tDet * d2.y, dir: d2};
}

await runCase('B5_all_six_spherical_lens_shapes_oracle', async () => {
  const shapes = [
    {name: 'biconvex', frontRadius: 60, backRadius: 80},
    {name: 'plano-convex', frontRadius: null, backRadius: 60},
    {name: 'convex-plano', frontRadius: 60, backRadius: null},
    {name: 'plano-concave', frontRadius: null, backRadius: -60},
    {name: 'biconcave', frontRadius: -60, backRadius: -80},
    {name: 'meniscus-pos', frontRadius: 50, backRadius: -90},
    {name: 'meniscus-neg', frontRadius: -90, backRadius: 50}
  ];
  const out = {};
  for (const s of shapes) {
    const params = {x: 0, y: 0, apertureHeight: 30, centerThickness: 10, frontRadius: s.frontRadius, backRadius: s.backRadius, insideIndex: 1.5, outsideIndex: 1, partialReflection: false};
    const oracle = traceSphericalLensOracle(params, 8);
    const {summary, obsRes} = await evalV40({
      model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
      components: [
        {id: 'S1', type: 'point-source', parameters: {x: -30, y: 8, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
        {id: 'L1', type: 'spherical-lens', parameters: params},
        {id: 'D1', type: 'ray-detector', parameters: {x: 40, y: 0, orientationDeg: 90, length: 80}}
      ]
    }, [{id: 'o1', kind: 'detector-hit-events', componentId: 'D1'}]);
    const hit = obsRes.results[0].value?.[0];
    out[s.name] = {
      status: summary.native.status,
      yErrMm: hit ? Math.abs(hit.pointMm.y - oracle.yDet) : null,
      dirErr: hit ? Math.hypot(hit.incomingUnit.x - oracle.dir.x, hit.incomingUnit.y - oracle.dir.y) : null
    };
  }
  return out;
});

// =========================================================================
// 5. Tilted major circular-cap-dielectric (h > R) + interior source + Snell's window
// =========================================================================
await runCase('B6_tilted_major_cap_refraction_and_tir', async () => {
  // Major cap: base at (0,0), radius 20, capHeight 30 (h > R), normalDeg 35
  // Center is at (0,0) + (30-20)*u = 10*(cos 35, sin 35)
  const rad = 35 * Math.PI / 180;
  const cx = 10 * Math.cos(rad), cy = 10 * Math.sin(rad);
  // Put interior source at center (cx, cy) — every ray from center hits curved arc at normal incidence (0 deg)!
  // And ray pointing backward (-normalDeg = -145 deg) hits flat base at normal incidence!
  // Ray at angle 35 + 180 + 45 = -100 deg hits flat base at 45 deg (> critical angle asin(1/1.5)=41.81 deg -> TIR!)
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'CAP1', type: 'circular-cap-dielectric', parameters: {x: 0, y: 0, radius: 20, capHeight: 30, normalDeg: 35, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'S1', type: 'point-source', parameters: {x: cx, y: cy, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: -100}},
      {id: 'D1', type: 'ray-detector', parameters: {x: -35, y: 20, orientationDeg: 90, length: 60}}
    ]
  }, [
    {id: 'o1', kind: 'interface-tir-count', componentId: 'CAP1'},
    {id: 'o2', kind: 'interface-face-events', componentId: 'CAP1'}
  ]);
  return {
    status: summary.native.status,
    errors: summary.native.errors,
    tirCount: obsRes.results[0].value,
    flatFace: obsRes.results[1].value?.['face-flat'],
    arcFace: obsRes.results[1].value?.['face-arc']
  };
});

// =========================================================================
// 6. Corner-touching 90-deg plane-mirror retroreflector + prism
// =========================================================================
await runCase('D4_corner_retroreflector_plus_prism', async () => {
  // Two mirrors meeting at (40, 0): M1 from (40,0) to (40-20, 20) [orientation 135, center (30, 10), len 20*sqrt(2)]
  // M2 from (40,0) to (40-20, -20) [orientation 45, center (30, -10), len 20*sqrt(2)]
  const len = 20 * Math.SQRT2;
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 8, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'M1', type: 'plane-mirror', parameters: {x: 30, y: 10, orientationDeg: 135, length: len}},
      {id: 'M2', type: 'plane-mirror', parameters: {x: 30, y: -10, orientationDeg: 45, length: len}},
      {id: 'D1', type: 'ray-detector', parameters: {x: -20, y: -8, orientationDeg: 90, length: 10}}
    ]
  }, [
    {id: 'o1', kind: 'mirror-reflections', componentId: 'M1'},
    {id: 'o2', kind: 'mirror-reflections', componentId: 'M2'},
    {id: 'o3', kind: 'detector-hit-events', componentId: 'D1'}
  ]);
  const hit = obsRes.results[2].value?.[0];
  return {
    status: summary.native.status,
    errors: summary.native.errors,
    m1: obsRes.results[0].value,
    m2: obsRes.results[1].value,
    returnY: hit?.pointMm?.y,
    returnDir: hit?.incomingUnit
  };
});

// =========================================================================
// 7. Structural revision: delete host body around interior source + submerged stop/detector
// =========================================================================
await runCase('E1_structural_delete_host_body', async () => {
  const prep = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: -20, y1: -20, x2: 20, y2: -20, x3: 20, y3: 20, x4: -20, y4: 20, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'S1', type: 'point-source', parameters: {x: -10, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'CB1', type: 'circle-blocker', parameters: {x: 0, y: 10, radius: 3}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 10, y: 0, orientationDeg: 90, length: 10}}
    ]
  });
  const rev = reviseComponents(prep.document, {
    format: 'opticsim-component-revision-v1',
    operations: [{op: 'remove', id: 'G1'}]
  });
  const ev = evaluateDocument(rev.document, core, [{id: 'o1', kind: 'detector-crossings', componentId: 'D1'}]);
  return {
    backgroundIndexPreserved: rev.document.physics.backgroundIndex,
    remainingIds: rev.document.physics.components.map(c => c.id),
    nativeStatus: ev.summary.native.status
  };
});

// =========================================================================
// 8. Can reviseScene change physics.backgroundIndex? (Structural/API gap check)
// =========================================================================
await runCase('E2_reviseScene_change_backgroundIndex_attempt', async () => {
  const prep = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -20, x2: 20, y2: -20, x3: 20, y3: 20, x4: 0, y4: 20, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 40, y: 0, orientationDeg: 90, length: 20}}
    ]
  });
  // Attempt to change G1.outsideIndex to 1.33 — must fail because physics.backgroundIndex cannot be changed in reviseScene!
  const rev = reviseScene(prep.document, {
    changes: [{id: 'G1', section: 'parameters', key: 'outsideIndex', value: 1.33}]
  });
  return {rev};
});

// =========================================================================
// 9. Beam splitter faint branch truncation check (B = 0.05, T = 0.1 => 0.005 <= 0.01)
// =========================================================================
await runCase('C8_beam_splitter_faint_branch_truncation', async () => {
  const {summary} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: 0.05}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'BS1', type: 'beam-splitter', parameters: {x: 0, y: 0, orientationDeg: 45, length: 20, transmissionRatio: 0.1}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 20, y: 0, orientationDeg: 90, length: 20}}
    ]
  });
  return {status: summary.native.status, truncation: summary.native.truncation, measurementState: summary.measurementState};
});

// =========================================================================
// 10. Ideal lens in immersed medium (backgroundIndex = 1.5) via witness bridge
// =========================================================================
await runCase('B7_immersed_ideal_lens_witness', async () => {
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1.5,
    object: {x: -100, y: 5},
    elements: [
      {id: 'L1', type: 'thin-lens', x: 0, focalLength: 50}
    ]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: {format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-conjugate'},
    aperturesById: {L1: 40},
    emitter: {mode: 'single-ray', directionDeg: 2, brightness: 0.2},
    detector: {x: 60, y: 0, orientationDeg: 90, length: 40}
  };
  const rep = await runOpticalBenchNativeWitness(stack, spec, {
    execute: (doc, reqs) => evaluateDocument(doc, core, reqs).summary
  });
  return {
    paraxialImageX: rep.paraxialResult?.value?.imageX,
    paraxialImageY: rep.paraxialResult?.value?.imageY,
    comparisonStatus: rep.comparison?.status,
    maxPerpMissMm: rep.comparison?.summary?.maxPerpendicularMissMm
  };
});
