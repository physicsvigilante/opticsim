import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.env.OPTICSIM_ROOT || process.cwd();
const require = createRequire(import.meta.url);
const core = require(resolve(REPO, 'dist/test-core.cjs'));
const { prepareScene, reviseScene, reviseComponents, opticalBenchCapabilities } = await import(pathToFileURL(resolve(REPO, 'src/authoring.js')));
const { evaluateDocument } = await import(pathToFileURL(resolve(REPO, 'scripts/author-scene.mjs')));
const { evaluateObservables } = await import(pathToFileURL(resolve(REPO, 'src/observables.js')));
const { buildOpticalBenchNativeWitness, runOpticalBenchNativeWitness } = await import(pathToFileURL(resolve(REPO, 'src/optical-bench-witness.js')));

function runV40(req, obs = []) {
  let prepared;
  try {
    prepared = prepareScene(req);
  } catch (e) {
    return { stage: 'prepare', ok: false, error: e.message, issues: e.issues };
  }
  const ev = evaluateDocument(prepared.document, core, obs);
  return { stage: 'run', ok: ev.summary.executionPassed, summary: ev.summary, doc: prepared.document, diag: ev.report.native.diagnostics };
}

async function runV40WithObs(req, obs) {
  const res = runV40(req, obs);
  if (res.stage !== 'run') return res;
  const obsRes = await evaluateObservables(res.doc, obs, res.summary);
  return { ...res, obsRes };
}

const results = [];
function log(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FINDING'}] ${name}`);
  if (detail) console.log('   ', typeof detail === 'string' ? detail : JSON.stringify(detail));
}

// =========================================================================
// TEST 1: Ghost generating-circle tangency false positive on circular-arc-mirror & spherical-lens
// =========================================================================
{
  // Arc mirror at x=100, y=0, normalDeg=180, radius=+50 (center=(50,0)), apertureHeight=20 (physical y in [-10,10])
  // Source at (-20, 50), shooting right (0 deg) — passes 40 mm ABOVE the mirror, tangent to absent ghost circle at (50, 50)!
  const r1 = runV40({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -20, y: 50, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'M1', type: 'circular-arc-mirror', parameters: { x: 100, y: 0, normalDeg: 180, radius: 50, apertureHeight: 20 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 120, y: 50, orientationDeg: 90, length: 20 } }
    ]
  });
  log('1a. Ghost-circle tangency admission: circular-arc-mirror (ray 40mm above mirror)', r1.ok, { stage: r1.stage, error: r1.error });

  // Same for spherical-lens: x=0, y=0, apertureHeight=20, centerThickness=10, frontRadius=100, backRadius=100
  // frontCenter=(95,0), R=100. Source at (-20, 100), directionDeg=0 — passes 90 mm ABOVE the physical lens!
  const r2 = runV40({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -20, y: 100, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'L1', type: 'spherical-lens', parameters: { x: 0, y: 0, apertureHeight: 20, centerThickness: 10, frontRadius: 100, backRadius: 100, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 50, y: 100, orientationDeg: 90, length: 20 } }
    ]
  });
  log('1b. Ghost-circle tangency admission: spherical-lens (ray 90mm above lens)', r2.ok, { stage: r2.stage, error: r2.error });

  // Runtime test: full-circle fan at (-50, 0) facing a small spherical-lens (x=0, aperture=20, R=100) — does a ray missing the lens by 40mm fail v40EndpointsVerified?
  const r3 = runV40({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    runPolicy: 'bench-v40-dense',
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -50, y: 0, brightness: 0.2 }, emission: { mode: 'full-circle' } },
      { id: 'L1', type: 'spherical-lens', parameters: { x: 0, y: 0, apertureHeight: 20, centerThickness: 10, frontRadius: 100, backRadius: 100, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 80, y: 0, orientationDeg: 90, length: 40 } }
    ]
  });
  log('1c. Ghost-circle tangency runtime: full-circle dense fan near small spherical-lens', r3.ok, { status: r3.summary?.native?.status, errors: r3.summary?.native?.errors });

  // Runtime test: directional fan directed at a spherical-lens or arc-mirror where one ray misses lens but grazes ghost circle
  // For arc-mirror at x=100, radius=50 (center at 50,0), source at (-50,0): tangent angle = asin(50/100) = 30 deg!
  // At 30 deg, ray passes x=100 at y = 150*tan(30) = 86.6 mm (76.6 mm above mirror!).
  const r4 = runV40({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -50, y: 0, brightness: 0.2 }, emission: { mode: 'directional', directionDeg: 30, angleDeg: 2 } },
      { id: 'M1', type: 'circular-arc-mirror', parameters: { x: 100, y: 0, normalDeg: 180, radius: 50, apertureHeight: 20 } }
    ]
  });
  log('1d. Ghost-circle tangency runtime: directional fan 76.6mm away from circular-arc-mirror', r4.ok, { status: r4.summary?.native?.status, errors: r4.summary?.native?.errors });
}

// =========================================================================
// TEST 2: witness-optical-bench rayDensity bug!
// =========================================================================
{
  const stack = {
    format: 'opticsim-coaxial-paraxial-stack-facts-v1',
    model: 'coaxial-paraxial-optical-stack',
    signConvention: 'x-increasing',
    lengthUnit: 'mm',
    incidentIndex: 1,
    object: { x: -200, y: 0 },
    elements: [{ id: 'L1', type: 'thin-lens', x: 0, focalLength: 100 }]
  };
  const spec = {
    format: 'opticsim-optical-bench-native-witness-v1',
    query: { format: 'opticsim-coaxial-paraxial-stack-query-v1', kind: 'coaxial-stack-conjugate' },
    aperturesById: { L1: 60 },
    emitter: { mode: 'directional', directionDeg: 0, angleDeg: 10, brightness: 0.2 },
    detector: { x: 200, y: 0, orientationDeg: 90, length: 60 },
    rayDensity: 0.5
  };
  let ok = true, err = null;
  try {
    await buildOpticalBenchNativeWitness(stack, spec);
  } catch (e) {
    ok = false;
    err = e.message;
  }
  log('2. witness-optical-bench explicit rayDensity override (documented in capabilities)', ok, err);
}

// =========================================================================
// TEST 3: Glass.getIncidentData rng()*1e-5 parity flip on long-travel rays!
// =========================================================================
{
  // Strategy: emit a single ray, reflect it off a plane mirror at x=-4000 so ray.p2-ray.p1 has length ~1 (wait: Mirror preserves |rx,ry| scaled by m^2! Better: refract through a thin slab at x=-4000 so BaseGlass sets |p2-p1| = 1!),
  // then travel ~8000 mm to a second glass slab at x=+4000, aiming 0.015 mm inside the top edge (passing 0.01 mm corner clearance!).
  // Because |p2-p1|=1, rng()*1e-5 rotates test ray2 by up to 1e-5 rad -> 0.08 mm shift over 8000 mm -> crosses OUTSIDE top edge -> flips parity!
  let flipped = null;
  for (let seedIdx = 0; seedIdx < 20; seedIdx++) {
    const seed = 'seed-parity-' + seedIdx;
    // Slab1 at [-4010, -4000] x [-20, 20], n=1.5 -> ray enters horizontally at y=10, exits horizontally at x=-4000, y=10 with |p2-p1| = 1!
    // Slab2 at [4000, 4020] x [-20, 10.02] -> top edge is at y=10.02! Ray at y=10.00 is 0.02 mm BELOW corner (4000, 10.02) -> passes 0.01 mm corner clearance!
    // Wait: at normal incidence (0 deg), even if n flips from 1/1.5 to 1.5, normal incidence doesn't deflect! So tilt Slab2's front face by 30 deg (or tilt the ray)!
    // Better: Slab1 is horizontal, ray enters at 0 deg -> exits horizontally at (-4000, 10) with dir=(1,0) and |p2-p1|=1.
    // Slab2 is a triangular prism or trapezoid with slanted front face!
    // Front face from (4000, 10.02) down-left to (3990, -10), back vertical face at x=4030.
    // Hit point on front face at y=10.00: x = 3990 + (10 - (-10))/(20.02) * 10 = 3999.99001. Distance to corner (4000, 10.02) = sqrt(0.01^2 + 0.02^2) = 0.02236 mm > 0.01 mm!
    const req = {
      model: 'native-optical-bench',
      lengthUnit: 'mm',
      backgroundIndex: 1,
      randomSeed: seed,
      components: [
        { id: 'S1', type: 'point-source', parameters: { x: -4020, y: 10, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
        { id: 'G1', type: 'polygon-dielectric', parameters: { x1: -4010, y1: -20, x2: -4000, y2: -20, x3: -4000, y3: 20, x4: -4010, y4: 20, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
        { id: 'G2', type: 'polygon-dielectric', parameters: { x1: 3980, y1: -10, x2: 4030, y2: -10, x3: 4030, y3: 10.02, x4: 4000, y4: 10.02, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
        { id: 'D1', type: 'ray-detector', parameters: { x: 4060, y: 0, orientationDeg: 90, length: 100 } }
      ]
    };
    const obs = [
      { id: 'o1', kind: 'interface-first-event', componentId: 'G2' },
      { id: 'o2', kind: 'interface-tir-count', componentId: 'G2' },
      { id: 'o3', kind: 'detector-hit-events', componentId: 'D1' }
    ];
    const r = await runV40WithObs(req, obs);
    if (r.ok) {
      const ev = r.obsRes.results[0].value;
      const tir = r.obsRes.results[1].value;
      // Compute expected Snell angle for outside->inside (n_in=1, n_out=1.5):
      // Front face vector from (3980,-10) to (4000,10.02) -> dx=20, dy=20.02 -> ~45.03 deg -> incidence angle ~44.97 deg!
      // Outside->inside: sin(theta_t) = (1/1.5)*sin(44.97) = 0.4711 -> theta_t = 28.11 deg!
      // If inverted (inside->outside!): sin(theta_t) = 1.5*sin(44.97) = 1.060 > 1 -> SPURIOUS TIR!!
      if (tir > 0 || (ev && ev.transmittedAngleDeg !== null && Math.abs(ev.transmittedAngleDeg - 28.11) > 1)) {
        flipped = { seed, status: r.summary.native.status, v40Verified: r.diag.v40EndpointsVerified, firstEvent: ev, tir, hits: r.obsRes.results[2].value };
        break;
      }
    }
  }
  log('3. Long-travel Glass.getIncidentData rng() parity flip (spurious TIR / inverted Snell accepted as v40EndpointsVerified!)', !flipped, flipped || 'No flip observed across 20 seeds');
}

// =========================================================================
// TEST 4: Equal-index neutral body (n_in === n_out, and touching nA === nB) with partialReflection=true/false
// =========================================================================
{
  for (const mode of ['single-ray', 'directional', 'full-circle', 'parallel-beam']) {
    for (const pr of [false, true]) {
      const emitter = mode === 'parallel-beam'
        ? { id: 'B1', type: 'parallel-beam', parameters: { x: -30, y: 0, width: 20, directionDeg: 0, brightness: 0.2 } }
        : mode === 'single-ray'
          ? { id: 'S1', type: 'point-source', parameters: { x: -30, y: 0, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 10 } }
          : mode === 'directional'
            ? { id: 'S1', type: 'point-source', parameters: { x: -30, y: 0, brightness: 0.2 }, emission: { mode: 'directional', directionDeg: 0, angleDeg: 20 } }
            : { id: 'S1', type: 'point-source', parameters: { x: -30, y: 0, brightness: 0.2 }, emission: { mode: 'full-circle' } };
      const r = runV40({
        model: 'native-optical-bench',
        lengthUnit: 'mm',
        backgroundIndex: 1.5,
        components: [
          emitter,
          { id: 'G1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -30, x2: 20, y2: -30, x3: 20, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1.5, partialReflection: pr } },
          { id: 'D1', type: 'ray-detector', parameters: { x: 40, y: 0, orientationDeg: 90, length: 60 } }
        ]
      });
      if (!r.ok || r.summary?.native?.truncation > 0 || r.summary?.native?.undefinedBehavior > 0 || r.summary?.native?.errors?.length) {
        log(`4. Equal-index neutral body (${mode}, partialReflection=${pr})`, false, { ok: r.ok, native: r.summary?.native, error: r.error });
      }
    }
  }
  // Check touching equal-index pair (nA = nB = 1.5 in air n=1) with partialReflection=false and true
  for (const pr of [false, true]) {
    const r = await runV40WithObs({
      model: 'native-optical-bench',
      lengthUnit: 'mm',
      backgroundIndex: 1,
      components: [
        { id: 'B1', type: 'parallel-beam', parameters: { x: -30, y: 0, width: 20, directionDeg: 15, brightness: 0.2 } },
        { id: 'G1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -30, x2: 10, y2: -30, x3: 10, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: pr } },
        { id: 'G2', type: 'polygon-dielectric', parameters: { x1: 10, y1: -30, x2: 20, y2: -30, x3: 20, y3: 30, x4: 10, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: pr } },
        { id: 'D1', type: 'ray-detector', parameters: { x: 40, y: 0, orientationDeg: 90, length: 80 } }
      ]
    }, [{ id: 'd1', kind: 'detector-hit-events', componentId: 'D1' }]);
    log(`4b. Touching equal-index pair (beam, nA=nB=1.5, partialReflection=${pr})`, r.ok, { status: r.summary?.native?.status, trunc: r.summary?.native?.truncation, errors: r.summary?.native?.errors, crossings: r.diag?.detectorsById?.D1 });
  }
}

// =========================================================================
// TEST 5: Cemented doublet mixing flat-face (path branch) + curved-face (DR1R2 branch)
//         AND mismatched apertures AND large-R (R=10000, aperture=4)
// =========================================================================
{
  // 5a: Plano-convex (frontRadius=null, backRadius=+50 -> path branch!) cemented to meniscus (frontRadius=-50, backRadius=+100 -> DR1R2 branch!)
  const r5a = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -40, y: 5, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'L1', type: 'spherical-lens', parameters: { x: 0, y: 0, apertureHeight: 30, centerThickness: 10, frontRadius: null, backRadius: 50, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'L2', type: 'spherical-lens', parameters: { x: 10, y: 0, apertureHeight: 30, centerThickness: 10, frontRadius: -50, backRadius: 100, insideIndex: 1.7, outsideIndex: 1, partialReflection: false } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 40, y: 0, orientationDeg: 90, length: 60 } }
    ]
  }, [
    { id: 'i1', kind: 'interface-face-events', componentId: 'L1' },
    { id: 'i2', kind: 'interface-face-events', componentId: 'L2' },
    { id: 'h1', kind: 'detector-hit-events', componentId: 'D1' }
  ]);
  log('5a. Cemented doublet (path branch + DR1R2 branch)', r5a.ok, {
    status: r5a.summary?.native?.status,
    errors: r5a.summary?.native?.errors,
    L1_back: r5a.obsRes?.results?.[0]?.value?.['back-arc'],
    L2_front: r5a.obsRes?.results?.[1]?.value?.['front-arc'],
    hits: r5a.obsRes?.results?.[2]?.value
  });

  // 5b: Large-R cemented doublet (R=10000, aperture=4, path + DR1R2)
  const r5b = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -40, y: 1, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'L1', type: 'spherical-lens', parameters: { x: 0, y: 0, apertureHeight: 4, centerThickness: 6, frontRadius: null, backRadius: 10000, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'L2', type: 'spherical-lens', parameters: { x: 6, y: 0, apertureHeight: 4, centerThickness: 6, frontRadius: -10000, backRadius: 10000, insideIndex: 1.7, outsideIndex: 1, partialReflection: false } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 40, y: 0, orientationDeg: 90, length: 20 } }
    ]
  }, [{ id: 'h1', kind: 'detector-hit-events', componentId: 'D1' }]);
  log('5b. Large-R (10000mm) narrow-aperture (4mm) cemented doublet', r5b.ok, { status: r5b.summary?.native?.status, errors: r5b.summary?.native?.errors, hits: r5b.obsRes?.results?.[0]?.value });

  // 5c: Mismatched-aperture cemented doublet where L2 (larger aperture=40) wraps around L1 (smaller aperture=20)!
  // L1: x=0, d=4, ap=20, frontRadius=-20 (concave), backRadius=+20 (convex, backApex=+2, backRim=2-(20-sqrt(300))=-0.679)
  // L2: x=7, d=10, ap=40, frontRadius=-20 (concave, frontApex=+2, frontRim=2-(20-0)=-18?? wait |R|>=ap/2+1 => |R|>=21, so use R=22!)
  const r5c = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -40, y: 15, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'L1', type: 'spherical-lens', parameters: { x: 0, y: 0, apertureHeight: 20, centerThickness: 4, frontRadius: -22, backRadius: 22, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'L2', type: 'spherical-lens', parameters: { x: 7, y: 0, apertureHeight: 40, centerThickness: 10, frontRadius: -22, backRadius: null, insideIndex: 1.7, outsideIndex: 1, partialReflection: false } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 40, y: 0, orientationDeg: 90, length: 60 } }
    ]
  }, [{ id: 'h1', kind: 'detector-hit-events', componentId: 'D1' }]);
  log('5c. Mismatched-aperture cemented doublet (L1 ap=20, L2 ap=40, ray hits overhang at y=15)', r5c.ok, { status: r5c.summary?.native?.status, errors: r5c.summary?.native?.errors, hits: r5c.obsRes?.results?.[0]?.value });

  // 5d: Wait — what if L1 and L2 are cemented with mismatched apertures AND L1 is biconvex (frontRadius=+22, backRadius=+22, d=12, ap=20 -> frontApex=-6, backApex=+6, frontRim=-3.59, backRim=+3.59)
  // and L2 is plano-concave (frontRadius=-22, backRadius=null, d=10, ap=40 -> frontApex=+6, frontRim=6-(22-sqrt(484-400))=-6.835!!)?
  // Wait: at y=15, L2's front face is at x = 6 - (22-sqrt(484-225)) = +0.09, back face at +16. Still disjoint in y because L1 is |y|<=10 and L2 overhang is |y|>10!
  // WHAT IF L1 (ap=20, frontRadius=-22, backRadius=+22) AND L2 (ap=40, frontRadius=-22, backRadius=null) AND a THIRD lens/slab/source is placed at (-4, 15) — OUTSIDE L1 and OUTSIDE L2?
  // Wait: L2's AABB left is -6.835, so (-4, 15) is inside L2's AABB (rejected).
  // WHAT IF L1 has frontRadius=+22, backRadius=+22, ap=20, and L2 has frontRadius=-22, backRadius=+22, ap=40 — check if L1 and L2 can physically overlap?
  // Both separated by the full circle centered at (backApex - 22, 0) of radius 22! Wait: can L2's front face cross L1? No, L1 is left of circle, L2 is right of circle.
  // WAIT: what if L1 has backRadius = +22, L2 has frontRadius = -22, AND L1 is cemented to L2, AND L3 is cemented to L1 or L2 — a cemented triplet? Let's test!
  const r5d = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -50, y: 4, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'L1', type: 'spherical-lens', parameters: { x: 0, y: 0, apertureHeight: 20, centerThickness: 8, frontRadius: 40, backRadius: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'L2', type: 'spherical-lens', parameters: { x: 8, y: 0, apertureHeight: 20, centerThickness: 8, frontRadius: -30, backRadius: -30, insideIndex: 1.7, outsideIndex: 1, partialReflection: false } },
      { id: 'L3', type: 'spherical-lens', parameters: { x: 16, y: 0, apertureHeight: 20, centerThickness: 8, frontRadius: 30, backRadius: 40, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 50, y: 0, orientationDeg: 90, length: 40 } }
    ]
  }, [{ id: 'h1', kind: 'detector-hit-events', componentId: 'D1' }]);
  log('5d. Cemented triplet (L1-L2-L3, 3 touching curved lenses)', r5d.ok, { status: r5d.summary?.native?.status, errors: r5d.summary?.native?.errors, hits: r5d.obsRes?.results?.[0]?.value });
}

// =========================================================================
// TEST 6: Sandwiched flush mirror between two touching slabs & between cemented doublet
// =========================================================================
{
  const r6a = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -20, y: 0, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 20 } },
      { id: 'G1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -30, x2: 10, y2: -30, x3: 10, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'G2', type: 'polygon-dielectric', parameters: { x1: 10, y1: -30, x2: 20, y2: -30, x3: 20, y3: 30, x4: 10, y4: 30, insideIndex: 1.7, outsideIndex: 1, partialReflection: false } },
      { id: 'M1', type: 'plane-mirror', parameters: { x: 10, y: 0, orientationDeg: 90, length: 60 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: -10, y: 15, orientationDeg: 90, length: 40 } }
    ]
  }, [
    { id: 'm1', kind: 'mirror-reflections', componentId: 'M1' },
    { id: 'h1', kind: 'detector-hit-events', componentId: 'D1' }
  ]);
  log('6a. Sandwiched plane-mirror between two touching slabs', r6a.ok, { status: r6a.summary?.native?.status, errors: r6a.summary?.native?.errors, refl: r6a.obsRes?.results?.[0]?.value, hits: r6a.obsRes?.results?.[1]?.value });

  // 6b: Partial flush plane-mirror on a slab with another slab touching the SAME face!
  // Mirror covers y in [-10, 10], slabs cover y in [-30, 30]. Ray hits at y = 20 (glass-glass) and second ray hits at y = 0 (mirror).
  const r6b = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -20, y: 0, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 10 } },
      { id: 'S2', type: 'point-source', parameters: { x: -20, y: 20, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 10 } },
      { id: 'G1', type: 'polygon-dielectric', parameters: { x1: 0, y1: -30, x2: 10, y2: -30, x3: 10, y3: 30, x4: 0, y4: 30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'G2', type: 'polygon-dielectric', parameters: { x1: 10, y1: -30, x2: 20, y2: -30, x3: 20, y3: 30, x4: 10, y4: 30, insideIndex: 1.7, outsideIndex: 1, partialReflection: false } },
      { id: 'M1', type: 'plane-mirror', parameters: { x: 10, y: 0, orientationDeg: 90, length: 20 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 30, y: 20, orientationDeg: 90, length: 30 } }
    ]
  }, [
    { id: 'm1', kind: 'mirror-reflections', componentId: 'M1' },
    { id: 'h1', kind: 'detector-hit-events', componentId: 'D1' }
  ]);
  log('6b. Partial flush mirror sandwiched between two touching slabs', r6b.ok, { status: r6b.summary?.native?.status, errors: r6b.summary?.native?.errors, refl: r6b.obsRes?.results?.[0]?.value, hits: r6b.obsRes?.results?.[1]?.value });
}

// =========================================================================
// TEST 7: IdealMirror two-sided behavior (front vs back incidence)
// =========================================================================
{
  // Concave IdealMirror at x=100, y=0, normalDeg=180 (front faces -x), focalLength=+50, apertureHeight=40
  // Ray from front (-x, at x=0, y=10, dir=0) -> should converge toward focus (50, 0) (dx<0, dy<0)!
  // Ray from BACK (+x, at x=200, y=10, dir=180) -> physically a concave mirror's back is CONVEX,
  // but PhyDemo IdealMirror is symmetric two-sided -> converges toward (150, 0) instead of diverging!
  const r7front = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: 0, y: 10, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'M1', type: 'ideal-curved-mirror', parameters: { x: 100, y: 0, normalDeg: 180, focalLength: 50, apertureHeight: 40 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 50, y: 0, orientationDeg: 90, length: 40 } }
    ]
  }, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  const r7back = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: 200, y: 10, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 180 } },
      { id: 'M1', type: 'ideal-curved-mirror', parameters: { x: 100, y: 0, normalDeg: 180, focalLength: 50, apertureHeight: 40 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 150, y: 0, orientationDeg: 90, length: 40 } }
    ]
  }, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  const backHits = r7back.obsRes?.results?.[0]?.value || [];
  const backReflected = backHits.find(h => h.incomingUnit.x > 0);
  log('7. IdealMirror back-side incidence (converges on BOTH sides despite normalDeg=180)', false, {
    frontHits: r7front.obsRes?.results?.[0]?.value,
    backReflectedAtX150: backReflected
  });
}

// =========================================================================
// TEST 8: BeamSplitter power conservation, geometry, and 2-splitter Mach-Zehnder fold
// =========================================================================
{
  const r8 = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -50, y: 0, brightness: 0.8 }, emission: { mode: 'single-ray', directionDeg: 0 } },
      { id: 'BS1', type: 'beam-splitter', parameters: { x: 0, y: 0, orientationDeg: 45, length: 30, transmissionRatio: 0.35 } },
      { id: 'M1', type: 'plane-mirror', parameters: { x: 0, y: 50, orientationDeg: 45, length: 30 } },
      { id: 'M2', type: 'plane-mirror', parameters: { x: 50, y: 0, orientationDeg: 45, length: 30 } },
      { id: 'BS2', type: 'beam-splitter', parameters: { x: 50, y: 50, orientationDeg: 45, length: 30, transmissionRatio: 0.6 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 90, y: 50, orientationDeg: 90, length: 30 } },
      { id: 'D2', type: 'ray-detector', parameters: { x: 50, y: 90, orientationDeg: 0, length: 30 } }
    ]
  }, [
    { id: 'bs1', kind: 'beam-splitter-interactions', componentId: 'BS1' },
    { id: 'bs2', kind: 'beam-splitter-interactions', componentId: 'BS2' },
    { id: 'p1', kind: 'detector-signed-power', componentId: 'D1' },
    { id: 'p2', kind: 'detector-signed-power', componentId: 'D2' },
    { id: 'c1', kind: 'detector-crossings', componentId: 'D1' },
    { id: 'c2', kind: 'detector-crossings', componentId: 'D2' }
  ]);
  // Expected:
  // Arm 1 (reflected at BS1: 0.8*0.65=0.52 -> M1 -> goes +x to BS2):
  //   transmitted at BS2 -> D1 (+x): 0.52 * 0.6 = 0.312
  //   reflected at BS2 -> D2 (+y): 0.52 * 0.4 = 0.208
  // Arm 2 (transmitted at BS1: 0.8*0.35=0.28 -> M2 -> goes +y to BS2):
  //   transmitted at BS2 -> D2 (+y): 0.28 * 0.6 = 0.168
  //   reflected at BS2 -> D1 (+x): 0.28 * 0.4 = 0.112
  // Total at D1: 0.424 (2 crossings), Total at D2: 0.376 (2 crossings), Sum = 0.800!
  const p1 = Math.abs(r8.obsRes?.results?.[2]?.value ?? NaN);
  const p2 = Math.abs(r8.obsRes?.results?.[3]?.value ?? NaN);
  const err1 = Math.abs(p1 - 0.424), err2 = Math.abs(p2 - 0.376);
  log('8. Mach-Zehnder 2-splitter fold power & crossing conservation', r8.ok && err1 < 1e-12 && err2 < 1e-12, {
    ok: r8.ok, p1, p2, sum: p1 + p2, c1: r8.obsRes?.results?.[4]?.value, c2: r8.obsRes?.results?.[5]?.value,
    bs1: r8.obsRes?.results?.[0]?.value, bs2: r8.obsRes?.results?.[1]?.value
  });
}

// =========================================================================
// TEST 9: Tilted major circular-cap-dielectric + interior source + submerged blocker & detector + reciprocity
// =========================================================================
{
  // Major cap: base=(0,0), radius=30, capHeight=45 (h > R!), normalDeg=37, n_in=1.6, n_out=1.2 (water/ambient)
  // center = base + (45-30)*u = 15*(cos37, sin37) = (11.9795, 9.0272)
  // Source strictly inside near center: (12, 9), shooting along normalDeg=37 -> hits curved apex at normal incidence,
  // and second ray at 37+25=62 deg -> refracts out of curved face!
  const u = { x: Math.cos(37 * Math.PI / 180), y: Math.sin(37 * Math.PI / 180) };
  const center = { x: 15 * u.x, y: 15 * u.y };
  // Place source at center + (-5, 3) (dist from center = 5.83 << 30, axial = (center.x-5)*u.x + (center.y+3)*u.y = 15 - 5*0.7986 + 3*0.6018 = 12.81 >> 0)
  const sx = center.x - 5, sy = center.y + 3;
  const r9 = await runV40WithObs({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1.2,
    components: [
      { id: 'C1', type: 'circular-cap-dielectric', parameters: { x: 0, y: 0, radius: 30, capHeight: 45, normalDeg: 37, insideIndex: 1.6, outsideIndex: 1.2, partialReflection: false } },
      { id: 'S1', type: 'point-source', parameters: { x: sx, y: sy, brightness: 0.3 }, emission: { mode: 'single-ray', directionDeg: 20 } },
      { id: 'D_in', type: 'ray-detector', parameters: { x: center.x + 6, y: center.y + 3, orientationDeg: 90, length: 12 } },
      { id: 'D_out', type: 'ray-detector', parameters: { x: 65, y: 20, orientationDeg: 90, length: 80 } }
    ]
  }, [
    { id: 'fe', kind: 'interface-first-event', componentId: 'C1' },
    { id: 'din', kind: 'detector-hit-events', componentId: 'D_in' },
    { id: 'dout', kind: 'detector-hit-events', componentId: 'D_out' }
  ]);
  // Independent Snell check on first event!
  const fe = r9.obsRes?.results?.[0]?.value;
  let snellErr = NaN;
  if (fe) {
    const sinI = Math.sin(fe.incidentAngleDeg * Math.PI / 180);
    const sinT = Math.sin(fe.transmittedAngleDeg * Math.PI / 180);
    snellErr = Math.abs(1.6 * sinI - 1.2 * sinT);
  }
  // Reciprocity test: fire ray BACKWARD from D_out hit point with reversed direction!
  let recipMiss = NaN;
  const outHit = r9.obsRes?.results?.[2]?.value?.[0];
  if (outHit) {
    const revAngle = Math.atan2(-outHit.incomingUnit.y, -outHit.incomingUnit.x) * 180 / Math.PI;
    const r9rev = await runV40WithObs({
      model: 'native-optical-bench',
      lengthUnit: 'mm',
      backgroundIndex: 1.2,
      components: [
        { id: 'C1', type: 'circular-cap-dielectric', parameters: { x: 0, y: 0, radius: 30, capHeight: 45, normalDeg: 37, insideIndex: 1.6, outsideIndex: 1.2, partialReflection: false } },
        { id: 'S_rev', type: 'point-source', parameters: { x: outHit.pointMm.x, y: outHit.pointMm.y, brightness: 0.3 }, emission: { mode: 'single-ray', directionDeg: revAngle } },
        { id: 'D_src', type: 'ray-detector', parameters: { x: sx, y: sy, orientationDeg: 90, length: 10 } }
      ]
    }, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D_src' }]);
    const h = r9rev.obsRes?.results?.[0]?.value?.[0];
    if (h) recipMiss = Math.hypot(h.pointMm.x - sx, h.pointMm.y - sy);
  }
  log('9. Tilted major cap + interior source + submerged detector + Snell & reciprocity', r9.ok && snellErr < 1e-12 && recipMiss < 1e-10, {
    ok: r9.ok, snellErr, recipMiss, fe: fe ? { face: fe.faceId, from: fe.from, nI: fe.incidentIndex, nT: fe.destinationIndex, thI: fe.incidentAngleDeg, thT: fe.transmittedAngleDeg } : null
  });
}

// =========================================================================
// TEST 10: Check backgroundIndex > 1 with spherical-lens + ideal-lens + witness bridge!
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
  const report = await runOpticalBenchNativeWitness(stack, spec, {
    execute: (doc, requests) => evaluateDocument(doc, core, requests).summary
  });
  log('10. v40 witness bridge: water-immersed thick lens + thin lens + spherical return mirror', report.comparison.status === 'compared', {
    status: report.comparison.status,
    paraxialX: report.paraxialResult?.value?.imageX,
    maxPerpMissMm: report.comparison.summary?.maxPerpendicularMissMm,
    maxDeltaYMm: report.comparison.summary?.maxAbsDeltaYMm
  });
}

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${results.filter(r => r.pass).length} / ${results.length}`);
