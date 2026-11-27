import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(REPO, 'dist/test-core.cjs'));
const { prepareScene, reviseScene, reviseComponents } = await import(pathToFileURL(resolve(REPO, 'src/authoring.js')));
const { evaluateDocument } = await import(pathToFileURL(resolve(REPO, 'scripts/author-scene.mjs')));
const { evaluateObservables } = await import(pathToFileURL(resolve(REPO, 'src/observables.js')));
const { runOpticalBenchNativeWitness } = await import(pathToFileURL(resolve(REPO, 'src/optical-bench-witness.js')));
const { analyzeCoaxialStack } = await import(pathToFileURL(resolve(REPO, 'src/coaxial-paraxial-stack.js')));
const { explorationBundle, explorationContext, prepareExplorationProposal } = await import(pathToFileURL(resolve(REPO, 'src/exploration.js')));
const { focusedExplorationContext } = await import(pathToFileURL(resolve(REPO, 'src/focused-exploration-context.js')));
const { runParameterSweep } = await import(pathToFileURL(resolve(REPO, 'src/parameter-sweep.js')));

function runV40(req, obs = []) {
  let prepared;
  try { prepared = prepareScene(req); }
  catch (e) { return { stage: 'prepare', ok: false, error: e.message, issues: e.issues }; }
  const ev = evaluateDocument(prepared.document, core, obs);
  return { stage: 'run', ok: ev.summary.executionPassed, summary: ev.summary, doc: prepared.document, diag: ev.report.native.diagnostics };
}
async function runV40WithObs(req, obs) {
  const res = runV40(req, obs);
  if (res.stage !== 'run') return res;
  return { ...res, obsRes: await evaluateObservables(res.doc, obs, res.summary) };
}

// =========================================================================
// 1. Full diagnosis of Probe A (water-immersed witness)!
// =========================================================================
{
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1.33,
    object: { x: -200, y: 0 },
    elements: [
      { id: 'S1', type: 'refracting-surface', x: 0, signedRadius: 60, downstreamIndex: 1.6 },
      { id: 'S2', type: 'refracting-surface', x: 10, signedRadius: -80, downstreamIndex: 1.33 },
      { id: 'L1', type: 'thin-lens', x: 50, focalLength: 100 },
      { id: 'M1', type: 'terminal-mirror', x: 120, signedRadius: -150 }
    ]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: { format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-conjugate' },
    bodies: [{ id: 'B1', frontSurfaceId: 'S1', backSurfaceId: 'S2', apertureHeight: 40 }],
    aperturesById: { L1: 60, M1: 60 },
    mirrorModel: 'circular-arc-mirror',
    partialReflection: false,
    emitter: { mode: 'single-ray', directionDeg: 0.5, brightness: 0.2 },
    detector: { x: -100, y: 0, orientationDeg: 90, length: 60 }
  };
  let captured = null;
  const report = await runOpticalBenchNativeWitness(stack, spec, {
    execute: (doc, requests) => {
      captured = evaluateDocument(doc, core, requests);
      return captured.summary;
    }
  });
  console.log('=== 1. PROBE A FULL DIAGNOSIS ===');
  console.log('summary.native:', JSON.stringify(captured.summary.native));
  console.log('report.native.qualification:', JSON.stringify(report.native?.qualification));
  console.log('report.comparison:', JSON.stringify(report.comparison));
  console.log('paraxialResult:', JSON.stringify(report.paraxialResult?.value));
}

// =========================================================================
// 2. Runtime ghost-circle tangency on circular-arc-mirror (post-reflection)!
// =========================================================================
{
  console.log('\n=== 2. RUNTIME GHOST-CIRCLE TANGENCY ON CIRCULAR-ARC-MIRROR ===');
  // S1 at (-10, 0) -> shoots +90 to M_fold at (-10, 50) -> reflects +x along y=50!
  // M1 at x=100, y=0, normalDeg=180, radius=+50 (center=(50,0), physical y in [-10,10]).
  // Ray along y=50 is 40mm ABOVE M1, tangent to ghost circle at (50, 50)!
  const r = runV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -10, y: 0, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 90 } },
      { id: 'M_fold', type: 'plane-mirror', parameters: { x: -10, y: 50, orientationDeg: 45, length: 20 } },
      { id: 'M1', type: 'circular-arc-mirror', parameters: { x: 100, y: 0, normalDeg: 180, radius: 50, apertureHeight: 20 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 120, y: 50, orientationDeg: 90, length: 20 } }
    ]
  });
  console.log('Runtime arc-mirror ghost tangency:', { stage: r.stage, ok: r.ok, status: r.summary?.native?.status, errors: r.summary?.native?.errors, v40Verified: r.diag?.v40EndpointsVerified });
}

// =========================================================================
// 3. Fresnel exact equations (R_s, R_p, Brewster angle, energy conservation R+T=1)!
// =========================================================================
{
  console.log('\n=== 3. FRESNEL EQUATIONS & BREWSTER ANGLE ===');
  // Air (1.0) -> Glass (1.5) at Brewster angle atan(1.5) = 56.309932474020215 deg
  const n1 = 1.0, n2 = 1.5;
  const thB = Math.atan(n2 / n1);
  const thBDeg = thB * 180 / Math.PI;
  // Vertical slab at x in [0, 30], y in [-100, 100], source at (-30, 0), directionDeg = thBDeg -> hits front face at (0, 30*tan(thB)=45)
  const r = await runV40WithObs({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -30, y: 0, brightness: 1.0 }, emission: { mode: 'single-ray', directionDeg: thBDeg } },
      { id: 'G1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -100, x2: 30, y2: -100, x3: 30, y3: 100, x4: 0, y4: 100, insideIndex: 1.5, outsideIndex: 1, partialReflection: true } }
    ]
  }, [{ id: 'fe', kind: 'interface-first-event', componentId: 'G1' }]);
  const fe = r.obsRes?.results?.[0]?.value;
  // Independent Fresnel formulas at Brewster angle:
  // cos1 = cos(thB), sin1 = sin(thB), sin2 = sin1 / 1.5, cos2 = sqrt(1 - sin2^2)
  // R_s = ((n1*cos1 - n2*cos2)/(n1*cos1 + n2*cos2))^2, R_p = 0
  // Unpolarized incident (0.5 s + 0.5 p) -> R_total = 0.5*R_s + 0.5*0 = 0.5 * ((1.5^2 - 1)/(1.5^2 + 1))^2 = 0.5 * (1.25/3.25)^2 = 0.07396449704...
  const cos1 = Math.cos(thB), sin2 = Math.sin(thB) / n2, cos2 = Math.sqrt(1 - sin2 * sin2);
  const Rs = Math.pow((n1 * cos1 - n2 * cos2) / (n1 * cos1 + n2 * cos2), 2);
  const Rp = Math.pow((n1 * cos2 - n2 * cos1) / (n1 * cos2 + n2 * cos1), 2);
  const expectedR = 0.5 * (Rs + Rp);
  const expectedT = 1 - expectedR;
  const reflB = fe?.branches?.find(b => b.kind === 'reflected');
  const transB = fe?.branches?.find(b => b.kind === 'transmitted');
  console.log('Brewster check:', {
    ok: r.ok, status: r.summary?.native?.status, trunc: r.summary?.native?.truncation,
    obsR: reflB?.relativePower, expR: expectedR, errR: Math.abs((reflB?.relativePower ?? NaN) - expectedR),
    obsT: transB?.relativePower, expT: expectedT, errT: Math.abs((transB?.relativePower ?? NaN) - expectedT),
    sumRT: (reflB?.relativePower ?? 0) + (transB?.relativePower ?? 0)
  });
}

// =========================================================================
// 4. Curved silvering on circular-cap-dielectric (tilted major cap) & concave spherical-lens face!
// =========================================================================
{
  console.log('\n=== 4. CURVED SILVERING ON TILTED MAJOR CAP & CONCAVE LENS ===');
  // 4a: Tilted major cap (base=(0,0), R=30, h=45, normalDeg=30) with concentric circular-arc-mirror on the curved apex!
  // center = base + (h-R)*u = 15*(cos30, sin30). Apex = base + 45*u.
  // Mirror vertex = apex, normalDeg = 30+180 = -150 (pointing INWARD toward center), radius = +30 (concave toward -150 -> center = apex + 30*(-u) = base + 15*u = cap.center!).
  const a30 = 30 * Math.PI / 180, u30 = { x: Math.cos(a30), y: Math.sin(a30) };
  const apex = { x: 45 * u30.x, y: 45 * u30.y };
  const r4a = await runV40WithObs({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'Cap1', type: 'circular-cap-dielectric', parameters: { x: 0, y: 0, radius: 30, capHeight: 45, normalDeg: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'M1', type: 'circular-arc-mirror', parameters: { x: apex.x, y: apex.y, normalDeg: -150, radius: 30, apertureHeight: 30 } },
      { id: 'S1', type: 'point-source', parameters: { x: -20, y: -10, brightness: 0.3 }, emission: { mode: 'single-ray', directionDeg: 32 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: -25, y: -15, orientationDeg: 120, length: 40 } }
    ]
  }, [
    { id: 'm', kind: 'mirror-reflections', componentId: 'M1' },
    { id: 'c', kind: 'interface-face-events', componentId: 'Cap1' },
    { id: 'd', kind: 'detector-crossings', componentId: 'D1' }
  ]);
  console.log('4a. Curved-silvered tilted major cap:', {
    stage: r4a.stage, ok: r4a.ok, error: r4a.error, status: r4a.summary?.native?.status, errors: r4a.summary?.native?.errors,
    refl: r4a.obsRes?.results?.[0]?.value, capFaces: r4a.obsRes?.results?.[1]?.value, det: r4a.obsRes?.results?.[2]?.value
  });

  // 4b: Concave back face of plano-concave spherical-lens silvered with convex circular-arc-mirror!
  // L1: x=0, y=0, ap=20, d=10, frontRadius=null, backRadius=-40 (concave inward -> backApex=+5, backCenter=(+45, 0)!)
  // Mirror M1: vertex=(+5, 0), normalDeg=180 (facing left into lens), radius=-40 (convex toward left -> center=(5,0)+(-40)*(-1,0)=(+45,0)!), ap=20!
  const r4b = await runV40WithObs({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'L1', type: 'spherical-lens', parameters: { x: 0, y: 0, apertureHeight: 20, centerThickness: 10, frontRadius: null, backRadius: -40, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'M1', type: 'circular-arc-mirror', parameters: { x: 5, y: 0, normalDeg: 180, radius: -40, apertureHeight: 20 } },
      { id: 'S1', type: 'point-source', parameters: { x: -40, y: 5, brightness: 0.3 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: -30, y: 0, orientationDeg: 90, length: 40 } }
    ]
  }, [
    { id: 'm', kind: 'mirror-reflections', componentId: 'M1' },
    { id: 'l', kind: 'interface-face-events', componentId: 'L1' },
    { id: 'd', kind: 'detector-hit-events', componentId: 'D1' }
  ]);
  console.log('4b. Silvered concave back face of plano-concave lens:', {
    stage: r4b.stage, ok: r4b.ok, error: r4b.error, status: r4b.summary?.native?.status, errors: r4b.summary?.native?.errors,
    refl: r4b.obsRes?.results?.[0]?.value, backHits: r4b.obsRes?.results?.[1]?.value?.['back-arc']?.interactions, detHits: r4b.obsRes?.results?.[2]?.value?.length
  });
}

// =========================================================================
// 5. Corner-touching mirrors: 3-wall equilateral triangle, acute 3.5-deg cavity truncation, and 3-mirror vertex!
// =========================================================================
{
  console.log('\n=== 5. CORNER-TOUCHING MIRROR ENCLOSURES ===');
  // Acute 4-degree V-mirror (|sin(4 deg)| = 0.06975 >= 0.05) -> many bounces -> hits maxRayDepth=16 -> must fail closed as incomplete!
  const ang = 4 * Math.PI / 180;
  const L = 100;
  // M1 along y=0 from (0,0) to (100,0): center=(50,0), orientationDeg=0, length=100
  // M2 from (0,0) to (100*cos4, 100*sin4): center=(50*cos4, 50*sin4), orientationDeg=4, length=100
  const r5a = runV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'M1', type: 'plane-mirror', parameters: { x: 50, y: 0, orientationDeg: 0, length: L } },
      { id: 'M2', type: 'plane-mirror', parameters: { x: 50 * Math.cos(ang), y: 50 * Math.sin(ang), orientationDeg: 4, length: L } },
      { id: 'S1', type: 'point-source', parameters: { x: 95, y: 3, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 180 } }
    ]
  });
  console.log('5a. Acute 4-deg V-mirror cavity (>16 bounces -> must truncate/fail closed):', {
    stage: r5a.stage, ok: r5a.ok, status: r5a.summary?.native?.status, trunc: r5a.summary?.native?.truncation, refl: r5a.diag?.reflections, errors: r5a.summary?.native?.errors
  });

  // Check 3 plane mirrors meeting at ONE shared corner (e.g. Y-junction at (0,0))!
  const r5b = runV40({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'M1', type: 'plane-mirror', parameters: { x: 25, y: 0, orientationDeg: 0, length: 50 } },
      { id: 'M2', type: 'plane-mirror', parameters: { x: 0, y: 25, orientationDeg: 90, length: 50 } },
      { id: 'M3', type: 'plane-mirror', parameters: { x: -25 * Math.SQRT1_2, y: -25 * Math.SQRT1_2, orientationDeg: 45, length: 50 } },
      { id: 'S1', type: 'point-source', parameters: { x: 15, y: 15, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: -135 } }
    ]
  });
  console.log('5b. 3-mirror Y-junction at origin with ray aimed at vertex:', {
    stage: r5b.stage, ok: r5b.ok, error: r5b.error, status: r5b.summary?.native?.status, errors: r5b.summary?.native?.errors
  });
}

// =========================================================================
// 6. Focused exploration context & Parameter sweep & Exploration proposal on v40!
// =========================================================================
{
  console.log('\n=== 6. FOCUSED EXPLORATION CONTEXT & PARAMETER SWEEP ON v40 ===');
  const bsDoc = JSON.parse(readFileSync(resolve(REPO, 'scenes/v40-beam-splitter-bench.json'), 'utf8'));
  const bundle = await explorationBundle(bsDoc);
  const focused = await focusedExplorationContext(bundle, 'Change beam splitter transmissionRatio to 0.7');
  const full = await explorationContext(bundle, 'Add a second detector');
  console.log('v40-beam-splitter-bench focusedContext chars:', JSON.stringify(focused).length, 'fullContext chars:', JSON.stringify(full).length);
  console.log('focusedContext has beam-splitter type:', Boolean(focused.authoring.componentTypes['beam-splitter']));
  console.log('focusedContext has beam-splitter-interactions observable:', Boolean(focused.observables.kinds['beam-splitter-interactions']));

  // Check if focusedContext on v40-silvered-plano-convex (which has frontRadius: null!) allows parameter sweep!
  const spcDoc = JSON.parse(readFileSync(resolve(REPO, 'scenes/v40-silvered-plano-convex.json'), 'utf8'));
  const spcBundle = await explorationBundle(spcDoc, null, [{ id: 'o1', kind: 'detector-crossings', componentId: 'D1' }]);
  // Try sweeping frontRadius from null -> [200, 100, -100]
  const sweep = await runParameterSweep(spcBundle, {
    format: 'opticsim-parameter-sweep-v1',
    expectedSceneSha256: spcBundle.sceneSha256,
    parameter: { id: 'L1', section: 'parameters', key: 'frontRadius', unit: 'mm' },
    values: [200, 100, -100]
  }, {
    execute: (doc, requests) => evaluateDocument(doc, core, requests)
  });
  console.log('Sweep on v40 plano-convex frontRadius (starting from null):', { status: sweep.status, completed: sweep.completedSamples, failed: sweep.failedSamples });

  // WAIT A SECOND: What if we try to sweep `backgroundIndex` via reviseScene?
  let bgRevErr = null;
  try { reviseScene(bsDoc, { changes: [{ id: 'scene', section: 'parameters', key: 'backgroundIndex', value: 1.33 }] }); }
  catch (e) { bgRevErr = e.message; }
  console.log('reviseScene backgroundIndex (intentionally immutable?):', bgRevErr);
}

// =========================================================================
// 7. Coaxial paraxial stack adversarial numerical checks!
// =========================================================================
{
  console.log('\n=== 7. COAXIAL PARAXIAL STACK ADVERSARIAL CHECKS ===');
  // 7a: Exact afocal Galilean telescope (f1=+100, f2=-25, d=75) -> M = [[0.25, 75], [0, 4]] -> m = +0.25, angularScale = 4!
  const gal = analyzeCoaxialStack({
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    elements: [
      { id: 'L1', type: 'thin-lens', x: 0, focalLength: 100 },
      { id: 'L2', type: 'thin-lens', x: 75, focalLength: -25 }
    ]
  }, { format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-collimated-focus' });
  console.log('7a. Galilean telescope:', { status: gal.status, isAfocal: gal.value?.isAfocal, beamHeightScale: gal.value?.beamHeightScale, angularScale: gal.value?.angularScale });

  // 7b: Near-afocal cancellation (f1=+100, f2=-25, d = 75 + 1e-11) -> must be numerically-indeterminate!
  const nearAfocal = analyzeCoaxialStack({
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    elements: [
      { id: 'L1', type: 'thin-lens', x: 0, focalLength: 100 },
      { id: 'L2', type: 'thin-lens', x: 75 + 1e-11, focalLength: -25 }
    ]
  }, { format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-collimated-focus' });
  console.log('7b. Near-afocal (d = 75 + 1e-11):', { status: nearAfocal.status, reasonCode: nearAfocal.reasonCode });

  // 7c: Silvered equiconvex lens (n=1.5, R1=+100, R2=-100, d=0 -> thin limit equivalent focal length f_eq = R / (2*(2n-1)) = 100/(2*2) = 25? Wait: P = 2*(n-1)/R + 2*n/R? No:
  // Front surface: (1.5-1)/100 = +0.005; Back mirror in n=1.5: -2*1.5/(-100) = +0.03; Front reverse: +0.005 -> Total P = 0.04 -> f_eq = 25 mm!
  // Self-conjugate objects: at 2*f_eq = 50 mm (m = -1)! Wait: also at vertex (0 mm, excluded)!
  const silv = analyzeCoaxialStack({
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    elements: [
      { id: 'S1', type: 'refracting-surface', x: 0, signedRadius: 100, downstreamIndex: 1.5 },
      { id: 'M1', type: 'terminal-mirror', x: 0, signedRadius: -100 }
    ]
  }, { format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-transfer' });
  console.log('7c. Thin silvered equiconvex lens (exact f_eq=25, self-conj at x=-50):', { status: silv.status, efl: silv.value?.effectiveFocalLength, selfConj: silv.value?.selfConjugateObjects });
}
