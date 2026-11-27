import {pathToFileURL} from 'node:url';
// Phase 1 Independent Audit Experiment Suite 4 (Depth Exhaustion, Bounding Disk, Grazing, Scaling)
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const root = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(root, 'dist/test-core.cjs'));
const {prepareScene} = await import(pathToFileURL(resolve(root, 'src/authoring.js')).href);
const {evaluateDocument} = await import(pathToFileURL(resolve(root, 'scripts/author-scene.mjs')).href);
const {evaluateObservables} = await import(pathToFileURL(resolve(root, 'src/observables.js')).href);
const {analyzeCoaxialStack} = await import(pathToFileURL(resolve(root, 'src/coaxial-paraxial-stack.js')).href);

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

// 1. maxRayDepth = 16 exhaustion in a 2-mirror bounce channel (does PhyDemo report truncation or silently drop?)
await runCase('C11_maxRayDepth_16_exhaustion', async () => {
  // Two parallel mirrors at y = +10 and y = -10, length = 500, x = 250.
  // Ray starts at (0, 0) at angle 45 deg -> bounces every dx = 20 mm => 25 bounces > 16!
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: 0, y: 0, brightness: 0.5}, emission: {mode: 'single-ray', directionDeg: 45}},
      {id: 'M1', type: 'plane-mirror', parameters: {x: 250, y: 10, orientationDeg: 0, length: 500}},
      {id: 'M2', type: 'plane-mirror', parameters: {x: 250, y: -10, orientationDeg: 0, length: 500}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 520, y: 0, orientationDeg: 90, length: 30}}
    ]
  }, [
    {id: 'o1', kind: 'mirror-reflections', componentId: 'M1'},
    {id: 'o2', kind: 'mirror-reflections', componentId: 'M2'},
    {id: 'o3', kind: 'detector-crossings', componentId: 'D1'}
  ]);
  return {
    status: summary.native.status,
    executionPassed: summary.executionPassed,
    truncation: summary.native.truncation,
    undefinedBehavior: summary.native.undefinedBehavior,
    processed: summary.native.processed,
    measurementState: summary.measurementState,
    obs: obsRes.results.map(r => ({id: r.id, status: r.status, value: r.value}))
  };
});

// 2. Concave ideal-curved-mirror vs circular-arc-mirror: object between pole and focus (u=15, f=25, ap=40)
await runCase('C12a_ideal_curved_mirror_virtual_object_u15_f25_ap40', async () => {
  const {summary} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -15, y: 2, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'M1', type: 'ideal-curved-mirror', parameters: {x: 0, y: 0, normalDeg: 180, focalLength: 25, apertureHeight: 40}},
      {id: 'D1', type: 'ray-detector', parameters: {x: -30, y: 0, orientationDeg: 90, length: 40}}
    ]
  });
  return {status: summary.native.status};
});

await runCase('C12b_circular_arc_mirror_virtual_object_u15_R50_ap40', async () => {
  const {summary} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -15, y: 2, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'M1', type: 'circular-arc-mirror', parameters: {x: 0, y: 0, normalDeg: 180, radius: 50, apertureHeight: 40}},
      {id: 'D1', type: 'ray-detector', parameters: {x: -30, y: 0, orientationDeg: 90, length: 40}}
    ]
  });
  return {status: summary.native.status};
});

// 3. Dimensional / scale invariance in coaxial-paraxial-stack (mm vs cm vs m vs scale-unit)
await runCase('B9_coaxial_stack_dimensional_invariance', async () => {
  const units = [
    {u: 'mm', s: 1},
    {u: 'cm', s: 0.1},
    {u: 'm', s: 0.001},
    {u: 'scale-unit', s: 0.01}
  ];
  const out = {};
  for (const {u, s} of units) {
    const res = analyzeCoaxialStack({
      format: 'opticsim-coaxial-paraxial-stack-facts-v1',
      model: 'coaxial-paraxial-optical-stack',
      signConvention: 'x-increasing',
      lengthUnit: u,
      incidentIndex: 1,
      object: {x: -300 * s, y: 10 * s},
      elements: [
        {id: 'L1', type: 'thin-lens', x: 0, focalLength: 100 * s},
        {id: 'S1', type: 'refracting-surface', x: 50 * s, signedRadius: 80 * s, downstreamIndex: 1.5},
        {id: 'S2', type: 'refracting-surface', x: 70 * s, signedRadius: 'infinity', downstreamIndex: 1}
      ]
    }, {format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-conjugate'});
    out[u] = {
      imageX_mm: res.value.imageX / s,
      imageY_mm: res.value.imageY / s,
      mag: res.value.magnification
    };
  }
  return out;
});

// 4. Beam-splitter grazing incidence (0.005 deg from surface tangent)
await runCase('C13_beam_splitter_grazing', async () => {
  // BS1 horizontal at (0, 0), length 40 (x in [-20, 20]). Source at (-30, 0.003), directionDeg = -0.0057 deg
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -30, y: 0.003, brightness: 0.5}, emission: {mode: 'single-ray', directionDeg: -0.0057}},
      {id: 'BS1', type: 'beam-splitter', parameters: {x: 0, y: 0, orientationDeg: 0, length: 40, transmissionRatio: 0.5}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 30, y: 0, orientationDeg: 90, length: 20}}
    ]
  }, [
    {id: 'o1', kind: 'beam-splitter-interactions', componentId: 'BS1'},
    {id: 'o2', kind: 'detector-crossings', componentId: 'D1'}
  ]);
  return {
    status: summary.native.status,
    errors: summary.native.errors,
    obs: obsRes.results.map(r => ({id: r.id, status: r.status, value: r.value}))
  };
});

// 5. Overhanging flush plane-mirror on plano-convex spherical-lens flat face
await runCase('C14_overhanging_flush_mirror_on_spherical_lens', async () => {
  // Lens: x=0, centerThickness=10 => frontApex=-5 (flat), backApex=+5 (convex R=50), ap=20 (y in [-10, 10])
  // Mirror: x=-5, y=0, orientationDeg=90, length=50 (y in [-25, 25]) — overhangs by 15 mm!
  // Ray at y=18 hits overhanging mirror from left -> reflects back without touching lens!
  const {summary, obsRes} = await evalV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -30, y: 18, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 5}},
      {id: 'L1', type: 'spherical-lens', parameters: {x: 0, y: 0, apertureHeight: 20, centerThickness: 10, frontRadius: null, backRadius: 50, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'M1', type: 'plane-mirror', parameters: {x: -5, y: 0, orientationDeg: 90, length: 50}},
      {id: 'D1', type: 'ray-detector', parameters: {x: -30, y: 25, orientationDeg: 90, length: 10}}
    ]
  }, [
    {id: 'o1', kind: 'mirror-reflections', componentId: 'M1'},
    {id: 'o2', kind: 'detector-crossings', componentId: 'D1'}
  ]);
  return {status: summary.native.status, errors: summary.native.errors, obs: obsRes.results.map(r => r.value)};
});
