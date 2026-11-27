import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(REPO, 'dist/test-core.cjs'));
const { prepareScene } = await import(pathToFileURL(resolve(REPO, 'src/authoring.js')));
const { evaluateDocument } = await import(pathToFileURL(resolve(REPO, 'scripts/author-scene.mjs')));
const { planProblem } = await import(pathToFileURL(resolve(REPO, 'src/problem-workflow.js')));
const { runOpticalBenchNativeWitness } = await import(pathToFileURL(resolve(REPO, 'src/optical-bench-witness.js')));

// 1. Sole-target auto-binding for beam-splitter-interactions in problem-workflow.js!
{
  const plan = planProblem({
    format: 'opticsim-problem-v1',
    physical: {
      model: 'native-optical-bench',
      lengthUnit: 'mm',
      backgroundIndex: 1,
      components: [
        { id: 'S1', type: 'point-source', parameters: { x: -40, y: 0, brightness: 0.4 }, emission: { mode: 'single-ray', directionDeg: 0 } },
        { id: 'BS1', type: 'beam-splitter', parameters: { x: 0, y: 0, orientationDeg: 45, length: 30, transmissionRatio: 0.5 } }
      ]
    },
    requests: [{ id: 'bs-count', kind: 'beam-splitter-interactions' }]
  });
  console.log('1. problem-workflow sole-target binding for beam-splitter-interactions:', {
    status: plan.status,
    targetBindings: plan.targetBindings,
    nativeRequests: plan.nativeRequests
  });
}

// 2. Equal-index neutral body: pinpoint single-ray angle that triggers 1-ULP phantom truncation!
{
  let triggered = [];
  for (let deg = 1; deg <= 85; deg += 1) {
    const prep = prepareScene({
      model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1.5,
      components: [
        { id: 'S1', type: 'point-source', parameters: { x: -20, y: 0, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: deg } },
        { id: 'G1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -500, x2: 20, y2: -500, x3: 20, y3: 500, x4: 0, y4: 500, insideIndex: 1.5, outsideIndex: 1.5, partialReflection: true } }
      ]
    });
    const ev = evaluateDocument(prep.document, core, []);
    if (!ev.summary.executionPassed && ev.summary.native.truncation > 0) {
      triggered.push({ deg, trunc: ev.summary.native.truncation });
    }
  }
  console.log(`2. Equal-index neutral slab (partialReflection=true): ${triggered.length}/85 integer angles failed closed with phantom ULP truncation! First 5:`, triggered.slice(0, 5));
}

// 3. Grazing angle on plane-mirror, ideal-lens, beam-splitter (long 10000mm segment, 0.001 deg incidence!)
{
  // Plane mirror along y=0 from x=-5000 to x=+5000. Source at (-1000, 0.02), directionDeg = -0.0011459 deg -> hits near (0, 0), 5000mm from endpoints!
  const ang = -Math.atan2(0.02, 1000) * 180 / Math.PI;
  const prepM = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -1000, y: 0.02, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: ang } },
      { id: 'M1', type: 'plane-mirror', parameters: { x: 0, y: 0, orientationDeg: 0, length: 10000 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 1000, y: 0.02, orientationDeg: 90, length: 2 } }
    ]
  });
  const evM = evaluateDocument(prepM.document, core, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  console.log('3a. Grazing plane-mirror (0.00115 deg):', {
    passed: evM.summary.executionPassed, status: evM.summary.native.status,
    hit: evM.summary.observations?.detectorHitEventsById?.D1?.events?.[0]
  });

  // Same for beam-splitter!
  const prepBS = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -1000, y: 0.02, brightness: 0.4 }, emission: { mode: 'single-ray', directionDeg: ang } },
      { id: 'BS1', type: 'beam-splitter', parameters: { x: 0, y: 0, orientationDeg: 0, length: 10000, transmissionRatio: 0.5 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 1000, y: 0.02, orientationDeg: 90, length: 2 } }
    ]
  });
  const evBS = evaluateDocument(prepBS.document, core, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  console.log('3b. Grazing beam-splitter (0.00115 deg):', {
    passed: evBS.summary.executionPassed, status: evBS.summary.native.status,
    hits: evBS.summary.observations?.detectorHitEventsById?.D1?.events?.length
  });

  // Grazing ideal-lens (vertical lens at x=0, apertureHeight=10000, source at (-0.02, -1000), angle=+89.99885 deg -> hits near (0,0)!)
  const angL = Math.atan2(1000, 0.02) * 180 / Math.PI;
  const prepL = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -0.02, y: -1000, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: angL } },
      { id: 'L1', type: 'ideal-lens', parameters: { x: 0, y: 0, focalLength: 100, apertureHeight: 10000 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 0.02, y: 1000, orientationDeg: 90, length: 20 } }
    ]
  });
  const evL = evaluateDocument(prepL.document, core, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  console.log('3c. Grazing ideal-lens (89.99885 deg):', {
    passed: evL.summary.executionPassed, status: evL.summary.native.status,
    hit: evL.summary.observations?.detectorHitEventsById?.D1?.events?.[0]
  });
}

// 4. Witness bridge: cemented doublet with silvered curved back face (3 elements: S1, S2, M1) AND 2-layer touching slab with flush plane mirror!
{
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    elements: [
      { id: 'S1', type: 'refracting-surface', x: 0, signedRadius: 80, downstreamIndex: 1.5 },
      { id: 'S2', type: 'refracting-surface', x: 10, signedRadius: -60, downstreamIndex: 1.65 },
      { id: 'M1', type: 'terminal-mirror', x: 18, signedRadius: -100 }
    ]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: { format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-collimated-focus' },
    bodies: [
      { id: 'L1', frontSurfaceId: 'S1', backSurfaceId: 'S2', apertureHeight: 36 },
      { id: 'L2', frontSurfaceId: 'S2', backSurfaceId: 'M1', apertureHeight: 36 }
    ],
    aperturesById: { M1: 36 },
    mirrorModel: 'circular-arc-mirror',
    partialReflection: false,
    emitter: { mode: 'single-ray', rays: [{ x: -50, y: 0.5, brightness: 0.2 }, { x: -50, y: -0.5, brightness: 0.2 }] },
    detector: { x: -60, y: 0, orientationDeg: 90, length: 40 }
  };
  const rep = await runOpticalBenchNativeWitness(stack, spec, {
    execute: (doc, requests) => evaluateDocument(doc, core, requests)
  });
  console.log('4. Witness bridge: curved-silvered cemented doublet:', {
    v40Verified: rep.native?.v40EndpointsVerified,
    status: rep.comparison?.status,
    backFocusX: rep.paraxial?.result?.value?.backFocusX,
    maxPerpMissMm: rep.comparison?.maxPerpendicularMissMm
  });
}

// 5. Check v40 witness bridge when a cemented doublet has MISMATCHED apertures in spec.bodies (e.g. L1=40, L2=20)!
{
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    elements: [
      { id: 'S1', type: 'refracting-surface', x: 0, signedRadius: 80, downstreamIndex: 1.5 },
      { id: 'S2', type: 'refracting-surface', x: 10, signedRadius: -60, downstreamIndex: 1.65 },
      { id: 'S3', type: 'refracting-surface', x: 18, signedRadius: 'infinity', downstreamIndex: 1 }
    ]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: { format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-collimated-focus' },
    bodies: [
      { id: 'L1', frontSurfaceId: 'S1', backSurfaceId: 'S2', apertureHeight: 40 },
      { id: 'L2', frontSurfaceId: 'S2', backSurfaceId: 'S3', apertureHeight: 20 }
    ],
    partialReflection: false,
    emitter: { mode: 'single-ray', rays: [{ x: -50, y: 15, brightness: 0.2 }] },
    detector: { x: 80, y: 0, orientationDeg: 90, length: 80 }
  };
  const rep = await runOpticalBenchNativeWitness(stack, spec, {
    execute: (doc, requests) => evaluateDocument(doc, core, requests)
  });
  console.log('5. Witness bridge: mismatched-aperture doublet ray bypassing L2 (must NOT corroborate!):', {
    v40Verified: rep.native?.v40EndpointsVerified,
    status: rep.comparison?.status,
    routeQualification: rep.comparison?.routeQualification
  });
}

// 6. Check v40 planar-interface absence vs finite slab workaround, and check 4-layer touching stack (oil-water-crown-flint)!
{
  const prep = prepareScene({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -20, y: 0, brightness: 0.3 }, emission: { mode: 'single-ray', directionDeg: 25 } },
      { id: 'L1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -80, x2: 10, y2: -80, x3: 10, y3: 80, x4: 0, y4: 80, insideIndex: 1.33, outsideIndex: 1, partialReflection: false } },
      { id: 'L2', type: 'polygon-dielectric', parameters: { x1: 10, y1: -80, x2: 20, y2: -80, x3: 20, y3: 80, x4: 10, y4: 80, insideIndex: 1.47, outsideIndex: 1, partialReflection: false } },
      { id: 'L3', type: 'polygon-dielectric', parameters: { x1: 20, y1: -80, x2: 30, y2: -80, x3: 30, y3: 80, x4: 20, y4: 80, insideIndex: 1.52, outsideIndex: 1, partialReflection: false } },
      { id: 'L4', type: 'polygon-dielectric', parameters: { x1: 30, y1: -80, x2: 40, y2: -80, x3: 40, y3: 80, x4: 30, y4: 80, insideIndex: 1.72, outsideIndex: 1, partialReflection: false } },
      { id: 'M1', type: 'plane-mirror', parameters: { x: 40, y: 0, orientationDeg: 90, length: 160 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: -10, y: 0, orientationDeg: 90, length: 160 } }
    ]
  });
  const ev = evaluateDocument(prep.document, core, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  // Independent Snell invariant: n_k sin(theta_k) = const = 1 * sin(25 deg) throughout ALL 4 layers and return!
  // Exiting ray MUST have angle = 180 - 25 = 155 deg, and lateral shift = 2 * sum_k (d_k * tan(asin(sin25 / n_k)))!
  const s25 = Math.sin(25 * Math.PI / 180);
  const shiftInSlabs = 2 * [1.33, 1.47, 1.52, 1.72].reduce((acc, n) => acc + 10 * Math.tan(Math.asin(s25 / n)), 0);
  const yExpected = 20 * Math.tan(25 * Math.PI / 180) + shiftInSlabs + 10 * Math.tan(25 * Math.PI / 180);
  const hits = ev.summary.observations?.detectorHitEventsById?.D1?.events || [];
  const ret = hits.find(h => h.incomingUnit.x < 0);
  const yErr = ret ? Math.abs(ret.pointMm.y - yExpected) : NaN;
  const dirErr = ret ? Math.hypot(ret.incomingUnit.x + Math.cos(25 * Math.PI / 180), ret.incomingUnit.y - Math.sin(25 * Math.PI / 180)) : NaN;
  console.log('6. 4-layer touching stack + flush mirror return (Snell invariant):', {
    passed: ev.summary.executionPassed, status: ev.summary.native.status,
    hits: hits.length, yErr: yErr.toExponential(2), dirErr: dirErr.toExponential(2)
  });
}
