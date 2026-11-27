import {pathToFileURL} from 'node:url';
// Phase 1 Independent Audit Experiment Suite 3 (Witness Bridge, Curved Silvering, Starters, Security)
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(root, 'dist/test-core.cjs'));
const {prepareScene, opticalBenchCapabilities} = await import(pathToFileURL(resolve(root, 'src/authoring.js')).href);
const {evaluateDocument} = await import(pathToFileURL(resolve(root, 'scripts/author-scene.mjs')).href);
const {evaluateObservables} = await import(pathToFileURL(resolve(root, 'src/observables.js')).href);
const {runOpticalBenchNativeWitness} = await import(pathToFileURL(resolve(root, 'src/optical-bench-witness.js')).href);
const {reserveAuthoringOutput} = await import(pathToFileURL(resolve(root, 'scripts/authoring-evidence.mjs')).href);
const {validate, parseSave} = await import(pathToFileURL(resolve(root, 'src/contract.js')).href);

async function runCase(name, fn) {
  try {
    const out = await fn();
    console.log(`[PASS-RUN] ${name}:`, JSON.stringify(out));
  } catch (err) {
    console.log(`[THROW] ${name}: ${err.code || ''} ${err.message}`);
  }
}

const exec = (doc, reqs) => evaluateDocument(doc, core, reqs);

// 1. Witness bridge: flush curved-silvered plano-convex lens
await runCase('W1_silvered_plano_convex', async () => {
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
  const rep = await runOpticalBenchNativeWitness(stack, spec, {execute: exec});
  return {
    paraxialImageX: rep.paraxial.result.value?.imageX,
    nativeStatus: rep.native.status,
    v40EndpointsVerified: rep.native.v40EndpointsVerified,
    comparisonStatus: rep.comparison.status,
    maxPerpMissMm: rep.comparison.summary?.maxPerpendicularMissMm
  };
});

// 2. Witness bridge: immersed thin lens (n = 1.5)
await runCase('W2_immersed_thin_lens', async () => {
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1.5,
    object: {x: -100, y: 5},
    elements: [{id: 'L1', type: 'thin-lens', x: 0, focalLength: 50}]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: {format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-conjugate'},
    aperturesById: {L1: 40},
    emitter: {mode: 'single-ray', directionDeg: 2, brightness: 0.2},
    detector: {x: 60, y: 0, orientationDeg: 90, length: 40}
  };
  const rep = await runOpticalBenchNativeWitness(stack, spec, {execute: exec});
  return {
    paraxialImageX: rep.paraxial.result.value?.imageX,
    paraxialImageY: rep.paraxial.result.value?.imageY,
    nativeStatus: rep.native.status,
    comparisonStatus: rep.comparison.status,
    maxPerpMissMm: rep.comparison.summary?.maxPerpendicularMissMm
  };
});

// 3. Witness bridge: cemented doublet (crown n=1.5 + flint n=1.65)
await runCase('W3_cemented_doublet', async () => {
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    elements: [
      {id: 'S1', type: 'refracting-surface', x: 0, signedRadius: 60, downstreamIndex: 1.5},
      {id: 'S2', type: 'refracting-surface', x: 10, signedRadius: -50, downstreamIndex: 1.65},
      {id: 'S3', type: 'refracting-surface', x: 18, signedRadius: 'infinity', downstreamIndex: 1}
    ]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: {format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-collimated-focus'},
    bodies: [
      {id: 'G1', frontSurfaceId: 'S1', backSurfaceId: 'S2', apertureHeight: 30},
      {id: 'G2', frontSurfaceId: 'S2', backSurfaceId: 'S3', apertureHeight: 30}
    ],
    partialReflection: false,
    emitter: {mode: 'single-ray', rays: [{id: 'R1', x: -20, y: 1, brightness: 0.2}]},
    detector: {x: 50, y: 0, orientationDeg: 90, length: 30}
  };
  const rep = await runOpticalBenchNativeWitness(stack, spec, {execute: exec});
  return {
    backFocusX: rep.paraxial.result.value?.backFocusX,
    nativeStatus: rep.native.status,
    comparisonStatus: rep.comparison.status,
    maxPerpMissMm: rep.comparison.summary?.maxPerpendicularMissMm
  };
});

// 4. Curved-silvered CONCAVE back face of spherical-lens
await runCase('C10_curved_silvered_concave_lens_face', async () => {
  const prep = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -30, y: 5, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 0}},
      {id: 'L1', type: 'spherical-lens', parameters: {x: 0, y: 0, apertureHeight: 30, centerThickness: 10, frontRadius: null, backRadius: -60, insideIndex: 1.5, outsideIndex: 1, partialReflection: false}},
      {id: 'M1', type: 'circular-arc-mirror', parameters: {x: 5, y: 0, normalDeg: 180, radius: -60, apertureHeight: 30}},
      {id: 'D1', type: 'ray-detector', parameters: {x: -20, y: 0, orientationDeg: 90, length: 40}}
    ]
  });
  const obs = [
    {id: 'o1', kind: 'mirror-reflections', componentId: 'M1'},
    {id: 'o2', kind: 'detector-hit-events', componentId: 'D1'}
  ];
  const ev = evaluateDocument(prep.document, core, obs);
  const obsRes = await evaluateObservables(prep.document, obs, ev.summary);
  return {
    status: ev.summary.native.status,
    errors: ev.summary.native.errors,
    reflections: obsRes.results[0].value,
    hits: obsRes.results[1].value?.length
  };
});

// 5. All 8 curated v40 browser starters check
await runCase('V40_all_8_curated_starters', async () => {
  const starters = opticalBenchCapabilities().browserStarters;
  const out = {};
  for (const slug of starters) {
    const raw = readFileSync(resolve(root, 'scenes', slug + '.json'), 'utf8');
    const doc = JSON.parse(raw);
    validate(doc);
    const ev = evaluateDocument(doc, core, []);
    out[slug] = {
      status: ev.summary.native.status,
      executionPassed: ev.summary.executionPassed,
      v40Verified: ev.summary.observations?.v40EndpointsVerified ?? null,
      emitted: ev.summary.native.emitted,
      processed: ev.summary.native.processed,
      truncation: ev.summary.native.truncation,
      warnings: ev.summary.native.warnings.length,
      errors: ev.summary.native.errors
    };
  }
  return out;
});

// 6. Security checks: prototype pollution & path traversal
await runCase('SEC1_proto_pollution_and_traversal', async () => {
  const checks = {};
  try {
    parseSave('{"__proto__":{"polluted":true},"format":"ray-optics-2d"}');
    checks.protoRejected = false;
  } catch (e) {
    checks.protoRejected = true;
    checks.polluted = ({}).polluted === true;
  }
  try {
    reserveAuthoringOutput(resolve(root, 'test-artifacts/llm-authoring/../../outside-escape'), root);
    checks.traversalBlocked = false;
  } catch (e) {
    checks.traversalBlocked = true;
    checks.traversalCode = e.issues?.[0]?.code || e.code;
  }
  return checks;
});

// 7. IdealLens steep off-axis ray check
await runCase('B8_ideal_lens_steep_ray_law', async () => {
  const prep = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -100, y: 0, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 30}},
      {id: 'L1', type: 'ideal-lens', parameters: {x: 0, y: 0, focalLength: 100, apertureHeight: 150}},
      {id: 'D1', type: 'ray-detector', parameters: {x: 50, y: 50, orientationDeg: 90, length: 60}}
    ]
  });
  const obs = [{id: 'o1', kind: 'detector-hit-events', componentId: 'D1'}];
  const ev = evaluateDocument(prep.document, core, obs);
  const obsRes = await evaluateObservables(prep.document, obs, ev.summary);
  const hit = obsRes.results[0].value?.[0];
  return {
    status: ev.summary.native.status,
    yHitExpected: 100 * Math.tan(30 * Math.PI / 180),
    yHitObserved: hit?.pointMm?.y,
    outDir: hit?.incomingUnit
  };
});
