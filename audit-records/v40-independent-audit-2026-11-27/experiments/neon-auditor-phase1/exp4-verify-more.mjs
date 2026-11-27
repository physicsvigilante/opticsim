import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(REPO, 'dist/test-core.cjs'));
const { prepareScene } = await import(pathToFileURL(resolve(REPO, 'src/authoring.js')));
const { evaluateDocument } = await import(pathToFileURL(resolve(REPO, 'scripts/author-scene.mjs')));
const { evaluateObservables } = await import(pathToFileURL(resolve(REPO, 'src/observables.js')));
const { runOpticalBenchNativeWitness } = await import(pathToFileURL(resolve(REPO, 'src/optical-bench-witness.js')));

// 1. Re-run Probe A (water-immersed thick lens + thin lens + spherical return mirror) with proper execute signature!
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
  const rep = await runOpticalBenchNativeWitness(stack, spec, {
    execute: (doc, requests) => evaluateDocument(doc, core, requests)
  });
  console.log('=== 1. Water-immersed witness (proper execute signature) ===');
  console.log(JSON.stringify({
    v40Verified: rep.native?.v40EndpointsVerified,
    status: rep.comparison?.status,
    paraxialImageX: rep.paraxial?.result?.value?.imageX,
    maxPerpMissMm: rep.comparison?.maxPerpendicularMissMm,
    maxDeltaYMm: rep.comparison?.maxAbsDeltaYMm
  }, null, 2));
}

// 2. Single-interface Brewster angle exact Fresnel check (submerged blocker absorbs transmitted ray before 2nd face!)
{
  const n1 = 1.0, n2 = 1.5;
  const thB = Math.atan(n2 / n1);
  const thBDeg = thB * 180 / Math.PI;
  const prep = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -30, y: 0, brightness: 1.0 }, emission: { mode: 'single-ray', directionDeg: thBDeg } },
      { id: 'G1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -100, x2: 40, y2: -100, x3: 40, y3: 100, x4: 0, y4: 100, insideIndex: 1.5, outsideIndex: 1, partialReflection: true } },
      { id: 'Blk', type: 'line-blocker', parameters: { x: 20, y: 50, orientationDeg: 90, length: 80 } }
    ]
  });
  const obs = [{ id: 'fe', kind: 'interface-first-event', componentId: 'G1' }];
  const ev = evaluateDocument(prep.document, core, obs);
  const res = await evaluateObservables(prep.document, obs, ev.summary);
  const fe = res.results[0].value;
  const cos1 = Math.cos(thB), sin2 = Math.sin(thB) / n2, cos2 = Math.sqrt(1 - sin2 * sin2);
  const Rs = Math.pow((n1 * cos1 - n2 * cos2) / (n1 * cos1 + n2 * cos2), 2);
  const Rp = Math.pow((n1 * cos2 - n2 * cos1) / (n1 * cos2 + n2 * cos1), 2);
  const expR = 0.5 * (Rs + Rp), expT = 1 - expR;
  const reflB = fe?.branches?.find(b => b.kind === 'reflected');
  const transB = fe?.branches?.find(b => b.kind === 'transmitted');
  console.log('\n=== 2. Single-interface Brewster exact Fresnel check ===');
  console.log({
    passed: ev.summary.executionPassed, status: ev.summary.native.status, trunc: ev.summary.native.truncation,
    errR: Math.abs((reflB?.relativePower ?? NaN) - expR),
    errT: Math.abs((transB?.relativePower ?? NaN) - expT),
    sumRT: (reflB?.relativePower ?? 0) + (transB?.relativePower ?? 0)
  });
}

// 3. Universal Fresnel truncation trap on ANY two-face finite dielectric with partialReflection=true!
{
  console.log('\n=== 3. Fresnel partialReflection=true across finite dielectric indices ===');
  for (const n of [1.2, 1.5, 2.0, 3.0, 4.0]) {
    const prep = prepareScene({
      model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
      components: [
        { id: 'S1', type: 'point-source', parameters: { x: -30, y: 0, brightness: 1.0 }, emission: { mode: 'single-ray', directionDeg: 10 } },
        { id: 'G1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -50, x2: 20, y2: -50, x3: 20, y3: 50, x4: 0, y4: 50, insideIndex: n, outsideIndex: 1, partialReflection: true } },
        { id: 'D1', type: 'ray-detector', parameters: { x: 40, y: 0, orientationDeg: 90, length: 80 } }
      ]
    });
    const ev = evaluateDocument(prep.document, core, []);
    console.log(`  n=${n}: passed=${ev.summary.executionPassed} status=${ev.summary.native.status} processed=${ev.summary.native.processed} trunc=${ev.summary.native.truncation.toExponential(3)} measState=${ev.summary.measurementState}`);
  }
}

// 4. Test equal-index neutral body across ALL 5 dielectric types with partialReflection=true!
{
  console.log('\n=== 4. Equal-index neutral body (n_in=n_out=1.5) with partialReflection=true ===');
  const bodies = [
    { id: 'B1', type: 'circular-dielectric', parameters: { x: 20, y: 0, radius: 15, insideIndex: 1.5, outsideIndex: 1.5, partialReflection: true } },
    { id: 'B1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -20, x2: 20, y2: -20, x3: 20, y3: 20, x4: 0, y4: 20, insideIndex: 1.5, outsideIndex: 1.5, partialReflection: true } },
    { id: 'B1', type: 'spherical-lens', parameters: { x: 10, y: 0, apertureHeight: 20, centerThickness: 10, frontRadius: 40, backRadius: 40, insideIndex: 1.5, outsideIndex: 1.5, partialReflection: true } }
  ];
  for (const body of bodies) {
    const prep = prepareScene({
      model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1.5,
      components: [
        { id: 'S1', type: 'point-source', parameters: { x: -30, y: 3, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: 7 } },
        body
      ]
    });
    const ev = evaluateDocument(prep.document, core, []);
    console.log(`  ${body.type} (single-ray 7deg): passed=${ev.summary.executionPassed} status=${ev.summary.native.status} trunc=${ev.summary.native.truncation}`);
  }
}

// 5. Test BeamSplitter + grazing angle + high-depth + 0.01 cutoff
{
  console.log('\n=== 5. BeamSplitter boundary & cutoff tests ===');
  // 5a: brightness=0.02, T=0.5 -> both branches = 0.01 (not > 0.01!) -> both truncated!
  const prep5a = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -30, y: 0, brightness: 0.02 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'BS1', type: 'beam-splitter', parameters: { x: 0, y: 0, orientationDeg: 45, length: 30, transmissionRatio: 0.5 } }
    ]
  });
  const ev5a = evaluateDocument(prep5a.document, core, []);
  console.log('  5a (brightness=0.02, T=0.5):', { passed: ev5a.summary.executionPassed, status: ev5a.summary.native.status, trunc: ev5a.summary.native.truncation });

  // 5b: brightness=0.03, T=0.5 -> both branches = 0.015 > 0.01 -> clean complete!
  const prep5b = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -30, y: 0, brightness: 0.03 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'BS1', type: 'beam-splitter', parameters: { x: 0, y: 0, orientationDeg: 45, length: 30, transmissionRatio: 0.5 } }
    ]
  });
  const ev5b = evaluateDocument(prep5b.document, core, []);
  console.log('  5b (brightness=0.03, T=0.5):', { passed: ev5b.summary.executionPassed, status: ev5b.summary.native.status, trunc: ev5b.summary.native.truncation });
}
