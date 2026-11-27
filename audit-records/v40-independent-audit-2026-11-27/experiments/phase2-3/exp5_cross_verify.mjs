import {pathToFileURL} from 'node:url';
// Phase 2 Cross-Verification of neon-auditor findings (N1-F2, N1-F3, N1-F5, N1-F6, N1-F7)
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(root, 'dist/test-core.cjs'));
const {prepareScene} = await import(pathToFileURL(resolve(root, 'src/authoring.js')).href);
const {evaluateDocument} = await import(pathToFileURL(resolve(root, 'scripts/author-scene.mjs')).href);
const {evaluateObservables} = await import(pathToFileURL(resolve(root, 'src/observables.js')).href);
const {buildOpticalBenchNativeWitness} = await import(pathToFileURL(resolve(root, 'src/optical-bench-witness.js')).href);
const {explorationBundle, explorationContext, nativeComparisonReadouts} = await import(pathToFileURL(resolve(root, 'src/exploration.js')).href);
const {focusedExplorationContext} = await import(pathToFileURL(resolve(root, 'src/focused-exploration-context.js')).href);

// 1. Verify N1-F2: witness-optical-bench rayDensity override throws UNSUPPORTED_FIELD
let f2Result;
try {
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    object: {x: -100, y: 0},
    elements: [{id: 'L1', type: 'thin-lens', x: 0, focalLength: 50}]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: {format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-conjugate'},
    aperturesById: {L1: 40},
    emitter: {mode: 'single-ray', directionDeg: 2, brightness: 0.2},
    detector: {x: 100, y: 0, orientationDeg: 90, length: 40},
    rayDensity: 0.5
  };
  await buildOpticalBenchNativeWitness(stack, spec);
  f2Result = {threw: false};
} catch (err) {
  f2Result = {threw: true, code: err.code, message: err.message, issues: err.issues};
}
console.log('[VERIFY N1-F2]', JSON.stringify(f2Result));

// 2. Verify N1-F3: Equal-index neutral body with partialReflection: true across integer angles 1..85 deg
let f3Failed = 0, f3Total = 0, f3Sample = null;
for (let deg = 1; deg <= 85; deg++) {
  f3Total++;
  const prep = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1.5,
    components: [
      {id: 'S1', type: 'point-source', parameters: {x: -20, y: 0, brightness: 0.5}, emission: {mode: 'single-ray', directionDeg: deg}},
      {id: 'G1', type: 'polygon-dielectric', parameters: {x1: 0, y1: -500, x2: 20, y2: -500, x3: 20, y3: 500, x4: 0, y4: 500, insideIndex: 1.5, outsideIndex: 1.5, partialReflection: true}}
    ]
  });
  const ev = evaluateDocument(prep.document, core, []);
  if (ev.summary.native.status !== 'completed') {
    f3Failed++;
    if (!f3Sample) f3Sample = {deg, status: ev.summary.native.status, truncation: ev.summary.native.truncation};
  }
}
console.log('[VERIFY N1-F3]', JSON.stringify({f3Failed, f3Total, f3Sample}));

// 3. Verify N1-F5 & N1-F7: nativeComparisonReadouts & explorationContext size on v40-beam-splitter-bench
const bsDoc = JSON.parse(readFileSync(resolve(root, 'scenes/v40-beam-splitter-bench.json'), 'utf8'));
const readouts = nativeComparisonReadouts(bsDoc);
const bundle = await explorationBundle(bsDoc);
const fullCtx = await explorationContext(bundle, 'Test question');
const focusedCtx = await focusedExplorationContext(bundle, 'Test question');
console.log('[VERIFY N1-F5]', JSON.stringify({
  components: bsDoc.physics.components.map(c => ({id: c.id, type: c.type})),
  readoutComponentIds: readouts.map(r => `${r.componentId}:${r.kind}`),
  hasBeamSplitterInReadouts: readouts.some(r => r.kind === 'beam-splitter-interactions')
}));
console.log('[VERIFY N1-F7]', JSON.stringify({
  fullContextBytes: Buffer.byteLength(JSON.stringify(fullCtx)),
  focusedContextBytes: Buffer.byteLength(JSON.stringify(focusedCtx)),
  mentionsV10Upgrade: JSON.stringify(fullCtx).includes('upgradeToSchemaVersion:11')
}));

// 4. Verify N1-F6: IdealMirror symmetric two-sided focal sign (back-side ray converges on f > 0)
const mPrep = prepareScene({
  model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
  components: [
    // Mirror at x=100, normalDeg=180 (front faces -x), f=+50, ap=40
    // Source at BACK side x=200, y=5 shooting LEFT (-180 deg) -> if symmetric converging, reflects back to focus (150, 0)!
    {id: 'S1', type: 'point-source', parameters: {x: 200, y: 5, brightness: 0.2}, emission: {mode: 'single-ray', directionDeg: 180}},
    {id: 'M1', type: 'ideal-curved-mirror', parameters: {x: 100, y: 0, normalDeg: 180, focalLength: 50, apertureHeight: 40}},
    {id: 'D1', type: 'ray-detector', parameters: {x: 150, y: 0, orientationDeg: 90, length: 40}}
  ]
});
const mObs = [{id: 'o1', kind: 'detector-hit-events', componentId: 'D1'}];
const mEv = evaluateDocument(mPrep.document, core, mObs);
const mRes = await evaluateObservables(mPrep.document, mObs, mEv.summary);
const backHits = mRes.results[0].value || [];
const reflectedBackHit = backHits.find(h => h.incomingUnit.x > 0);
console.log('[VERIFY N1-F6]', JSON.stringify({
  status: mEv.summary.native.status,
  reflectedHitAtX150: reflectedBackHit?.pointMm ?? null
}));
