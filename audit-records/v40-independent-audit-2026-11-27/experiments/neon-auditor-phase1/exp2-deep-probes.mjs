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
const { nativeComparisonReadouts } = await import(pathToFileURL(resolve(REPO, 'src/exploration.js')));

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
// PROBE A: Diagnose why Test 10 (water-immersed witness) failed!
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
  console.log('=== PROBE A (Test 10 diagnosis) ===');
  console.log(JSON.stringify({
    nativeStatus: report.native?.execution?.native,
    comparison: report.comparison,
    paraxial: report.paraxialResult?.value
  }, null, 2));
}

// =========================================================================
// PROBE B: Glass.getIncidentData rng()*1e-5 parity flip (corner BELOW ray in y-up = +y in y-down!)
// =========================================================================
{
  console.log('\n=== PROBE B (Long-travel Glass.getIncidentData rng()*1e-5 parity flip) ===');
  let flippedCount = 0;
  let exampleFlip = null;
  // G1 at [-4010, -4000] x [-20, 20], ray exits at (-4000, 0) moving +x with |p2-p1| = 1.
  // G2 front face from (4000, -0.02) to (4020, 20), back face at x=4050, bottom face y=-0.02!
  // In y-up, corner (4000, -0.02) is 0.02 mm BELOW y=0 (passes 0.01 mm corner guard!).
  // In y-down (native), ray is at y_down = 0, corner is at y_down = +0.02.
  // Glass.getIncidentData perturbs ray2.p2.y += rng()*1e-5 (> 0 in y-down!).
  // Over dx = 8000 mm, dy_down = 8000 * rng() * 1e-5 = up to +0.08 mm > +0.02 mm!
  // So test ray2 passes BELOW the bottom edge (y_down > +0.02) and misses G2 completely -> ray_intersect_count = 0 (wait: 0 is EVEN -> outside-to-inside!).
  // Wait: to FLIP parity from EVEN (2 hits: front + back) to ODD (1 hit!), we want ray2 to hit ONLY ONE face of G2 (e.g. miss front face, hit bottom face, and exit back face -> still 2; OR hit ONLY back face -> impossible for convex polygon!).
  // WAIT A SECOND! Can a straight line intersect a CONVEX polygon in an ODD number of points (1 point)?!
  // ONLY if the ray starts INSIDE, OR hits a vertex, OR hits one face cleanly and passes within MIN_RAY_SEGMENT_LENGTH of a corner, OR grazes an edge!!
  // Let's test BOTH: (a) ray starting OUTSIDE passing 0.015mm above bottom corner where ray2 hits bottom face vs misses; (b) ray starting INSIDE (e.g. inside a long thin glass slab/guide!) passing 0.015mm from corner!!
  // Wait: if ray starts OUTSIDE a convex polygon, a perturbed line NOT starting inside can hit 0 or 2 faces (both EVEN!) unless it hits 1 face due to floating-point/vertex gap!
  // WHAT IF ray starts INSIDE a long glass prism/slab (or exits face 1 and hits face 2, distance 8000 mm) and approaches a corner at 0.02 mm?!
  // Inside -> outside should have ray_intersect_count = 1 (ODD). If ray2 misses the polygon? No, ray2 starts INSIDE, so it MUST exit at 1 point (ODD), UNLESS ray2 passes through a vertex and hits 2 adjacent edges (EVEN = 2 -> flips to outside-to-inside -1!!)!
  // Let's also test TWO touching/close faces or grazing ray2 hitting 1 vs 2 edges!
  for (let i = 0; i < 40; i++) {
    const req = {
      model: 'native-optical-bench',
      lengthUnit: 'mm',
      backgroundIndex: 1,
      randomSeed: 'parity-inside-' + i,
      components: [
        // Long rectangular glass block from x=-4000 to x=+4000, y in [-0.5, +1.5] (height 2mm, length 8000mm)
        // Wait: polygon-dielectric needs altitude >= 1mm! 2mm height >= 1mm.
        // Ray starts inside at (-3990, 0) heading at tiny angle toward corner (+4000, -0.5) passing 0.02 mm above it!
        // Actually even better: tilted far face so incidence angle is 45 deg (if flipped from inside->outside to outside->inside, TIR won't happen when it MUST happen!!)!
        // Vertices: (-4000, -10), (4000, -10), (4020, 10), (-4000, 10) -> slanted right face from (4000,-10) to (4020,10) (45 deg!).
        // Source inside at (-3990, -9.98), dir = 0 deg -> hits slanted right face at (4000.02, -9.98), distance to corner (4000, -10) = 0.02828 mm > 0.01 mm!
        // With n_in=1.5, n_out=1, incidence angle on 45-deg face is 45 deg > critical angle 41.81 deg -> MUST undergo TIR!!
        // Wait: SingleRay has |p2-p1| = 20 mm, so first refract/reflect off left face or internal mirror? Let's bounce off an internal mirror or just launch from (-3990, -9.98) after a refraction so |p2-p1| = 1!
        { id: 'S1', type: 'point-source', parameters: { x: -4020, y: -9.98, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
        { id: 'G1', type: 'polygon-dielectric', parameters: { x1: -4000, y1: -10, x2: 4000, y2: -10, x3: 4020, y3: 10, x4: -4000, y4: 10, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
        { id: 'D_trans', type: 'ray-detector', parameters: { x: 4050, y: -10, orientationDeg: 90, length: 40 } },
        { id: 'D_tir', type: 'ray-detector', parameters: { x: 4000, y: 20, orientationDeg: 0, length: 40 } }
      ]
    };
    const r = await runV40WithObs(req, [
      { id: 'f', kind: 'interface-face-events', componentId: 'G1' },
      { id: 'tir', kind: 'interface-tir-count', componentId: 'G1' },
      { id: 'dt', kind: 'detector-crossings', componentId: 'D_trans' },
      { id: 'dr', kind: 'detector-crossings', componentId: 'D_tir' }
    ]);
    if (r.ok) {
      const tir = r.obsRes.results[1].value;
      const dt = r.obsRes.results[2].value;
      if (tir === 0 || dt > 0) {
        flippedCount++;
        if (!exampleFlip) exampleFlip = { seed: 'parity-inside-' + i, tir, dt, dr: r.obsRes.results[3].value, faces: r.obsRes.results[0].value };
      }
    }
  }
  console.log('Inside->outside parity flips (TIR suppressed?):', flippedCount, exampleFlip);

  // Also test OUTSIDE ray hitting a 45-deg face at y=-9.98 where ray2 misses the front face!
  // Wait: if ray starts at (-4000, -9.98) with |p2-p1|=1, hitting G2 at (4000, -10) -> (4020, 10) -> (4050, 10) -> (4050, -10):
  // Test ray2 starts at (-4000, -9.98), perturbed downward by +dy_down (in y-up, -dy_up up to 0.08 mm -> y = -10.06, BELOW G2!)
  // Wait: what if ray2 goes UPWARD or hits the bottom face? Still even (0 or 2).
  // What if G2 has a CONCAVE shape? No, polygon-dielectric is strictly convex!
  // What about a `spherical-lens` (BICONCAVE!) or `circular-cap-dielectric` (where `ray` is inside/outside) — CAN a straight line intersect a BICONCAVE `spherical-lens` in an ODD number of points? No, any closed Jordan curve is crossed an even number of times by any line not starting inside (unless tangent or hitting a vertex)!
  // WAIT: What if `ray.p1` IS ON A FACE of G1 (from entering G1 at x=-4000, y=-9.98), so `ray2` starts ON the left face of G1!
  // Because `ray2` starts at `(-4000, -9.98)` ON face-41, `distanceSquared(ray2.p1, left_face_hit) === 0 <= MIN_RAY_SEGMENT_LENGTH_SQUARED`, so left face is NOT counted!
  // Then `ray2` travels +8000 mm in +x, perturbed DOWNWARD by `rng()*1e-5` (up to `0.08 mm`)!
  // At `x = 4000`, `y(ray2) = -9.98 - 0.08 = -10.06 < -10`! So `ray2` EXITS through the BOTTOM face `y = -10` at `x = -4000 + (0.02 / 0.08)*8000 = -2000` (1 hit -> still ODD = 1!).
  // WAIT A SECOND!! What if `ray2` is perturbed to exit at `(-4000 + eps)`? Still 1 hit!
  // WHAT IF `ray` is entering G1 from OUTSIDE, AFTER leaving a touching slab G0 at `x = 0` (`|p2-p1| = 1`), and G1 is at `x = 8000`? Still outside -> 0 or 2 hits (even)!
  // Good! That's actually a topological reason why parity-flip on a convex body is rare (unless `ray2` hits a vertex EXACTLY, or exits within `1e-6 mm` of `ray.p1` when grazing the entry face!).
  // WAIT A SECOND!! TEST THAT LAST CASE!!
  // What if `ray` enters a slab at `(-4000, -9.98)` (0.02 mm above bottom face `y=-10`), moving horizontally (`dir = (1, 0)`), and `rng()*1e-5` tilts `ray2` downward so `ray2` exits bottom face at distance `<= 1e-6 mm`? No, `0.02 / 1e-5 = 2000 mm >> 1e-6 mm`.
  // What if `ray` is emitted at `(-10, -9.989)` (0.011 mm above bottom face) at `-89°`? No, that hits bottom face at `0.011 mm`, not grazing.
}

// =========================================================================
// PROBE C: Runtime ghost-circle tangency failure in v40!
// =========================================================================
{
  console.log('\n=== PROBE C (Runtime ghost-circle tangency failure) ===');
  // Ray starts at (-20, 0), hits plane mirror M_fold at (0, 50) (Wait: fire ray up to (0, 50), reflect horizontally along y=50!).
  // Arc mirror M1 is at x=100, y=0, normalDeg=180, radius=+50 (center=(50,0)), apertureHeight=20 (physical y in [-10,10]).
  // Admission ONLY checks INITIAL rays (which go from (0,0) to (0,50) — NOT tangent to M1!).
  // After reflecting off M_fold at (0,50) horizontally (+x along y=50), the outgoing ray is 40 mm ABOVE M1,
  // yet tangent to M1's absent ghost generating circle at (50, 50)!
  const rC1 = runV40({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: 0, y: 0, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 90 } },
      { id: 'M_fold', type: 'plane-mirror', parameters: { x: 0, y: 50, orientationDeg: 45, length: 20 } },
      { id: 'M1', type: 'circular-arc-mirror', parameters: { x: 100, y: 0, normalDeg: 180, radius: 50, apertureHeight: 20 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 120, y: 50, orientationDeg: 90, length: 20 } }
    ]
  });
  console.log('C1 (post-reflection ray 40mm above arc-mirror):', { ok: rC1.ok, status: rC1.summary?.native?.status, errors: rC1.summary?.native?.errors, v40Verified: rC1.diag?.v40EndpointsVerified });

  // Same for spherical-lens! L1 at x=50, y=0, aperture=20, R=100 (frontCenter=(145,0), R=100).
  // Ray reflects at (0, 100) horizontally along y=100 — 90 mm ABOVE L1!
  const rC2 = runV40({
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: 0, y: 0, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 90 } },
      { id: 'M_fold', type: 'plane-mirror', parameters: { x: 0, y: 100, orientationDeg: 45, length: 20 } },
      { id: 'L1', type: 'spherical-lens', parameters: { x: 50, y: 0, apertureHeight: 20, centerThickness: 10, frontRadius: 100, backRadius: 100, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 180, y: 100, orientationDeg: 90, length: 20 } }
    ]
  });
  console.log('C2 (post-reflection ray 90mm above spherical-lens):', { ok: rC2.ok, status: rC2.summary?.native?.status, errors: rC2.summary?.native?.errors, v40Verified: rC2.diag?.v40EndpointsVerified });
}

// =========================================================================
// PROBE D: Independent exact analytical ray-tracing oracles for ALL v40 optical laws!
// =========================================================================
{
  console.log('\n=== PROBE D (Independent exact physics oracles) ===');
  // D1: All 6 spherical-lens shapes (biconvex, plano-convex, plano-concave, meniscus, biconcave, flat-flat)
  // Independent exact ray-sphere intersection + vector Snell's law!
  function exactSphereLensTrace(p, y0) {
    const n1 = p.outsideIndex, n2 = p.insideIndex;
    const fApex = p.x - p.centerThickness / 2, bApex = p.x + p.centerThickness / 2;
    function refract(d, nOut, nIn, nTo) {
      // nOut points outward from glass; orient N opposite to d
      let nx = nOut.x, ny = nOut.y;
      if (d.x * nx + d.y * ny > 0) { nx = -nx; ny = -ny; }
      const cos1 = -(d.x * nx + d.y * ny);
      const eta = nIn / nTo;
      const sin2Sq = eta * eta * (1 - cos1 * cos1);
      const cos2 = Math.sqrt(1 - sin2Sq);
      return { x: eta * d.x + (eta * cos1 - cos2) * nx, y: eta * d.y + (eta * cos1 - cos2) * ny };
    }
    function intersectFace(orig, dir, apexX, R, isFront) {
      if (R === null) {
        const t = (apexX - orig.x) / dir.x;
        return { pt: { x: apexX, y: orig.y + t * dir.y }, normal: { x: isFront ? -1 : 1, y: 0 } };
      }
      const cx = isFront ? apexX + R : apexX - R, cy = p.y;
      const absR = Math.abs(R), sgn = Math.sign(R);
      const ox = orig.x - cx, oy = orig.y - cy;
      const b = ox * dir.x + oy * dir.y, c = ox * ox + oy * oy - absR * absR;
      const disc = Math.sqrt(b * b - c);
      const ts = [-b - disc, -b + disc].filter(t => t > 1e-9);
      for (const t of ts.sort((a, b) => a - b)) {
        const x = orig.x + t * dir.x, y = orig.y + t * dir.y;
        const onSide = isFront ? (sgn > 0 ? x <= cx : x >= cx) : (sgn > 0 ? x >= cx : x <= cx);
        if (onSide) return { pt: { x, y }, normal: { x: sgn * (x - cx) / absR, y: sgn * (y - cy) / absR } };
      }
      throw new Error('No intersection');
    }
    const h1 = intersectFace({ x: -100, y: y0 }, { x: 1, y: 0 }, fApex, p.frontRadius, true);
    const d1 = refract({ x: 1, y: 0 }, h1.normal, n1, n2);
    const h2 = intersectFace(h1.pt, d1, bApex, p.backRadius, false);
    const d2 = refract(d1, h2.normal, n2, n1);
    const tDet = (100 - h2.pt.x) / d2.x;
    return { yDet: h2.pt.y + tDet * d2.y, dir: d2 };
  }

  const shapes = [
    { name: 'biconvex', frontRadius: 60, backRadius: 80, centerThickness: 12 },
    { name: 'plano-convex', frontRadius: null, backRadius: 60, centerThickness: 10 },
    { name: 'convex-plano', frontRadius: 60, backRadius: null, centerThickness: 10 },
    { name: 'plano-concave', frontRadius: null, backRadius: -60, centerThickness: 6 },
    { name: 'biconcave', frontRadius: -60, backRadius: -80, centerThickness: 6 },
    { name: 'pos-meniscus', frontRadius: 40, backRadius: -80, centerThickness: 10 },
    { name: 'neg-meniscus', frontRadius: -80, backRadius: 40, centerThickness: 10 },
    { name: 'flat-flat', frontRadius: null, backRadius: null, centerThickness: 10 }
  ];
  for (const s of shapes) {
    const lp = { x: 0, y: 0, apertureHeight: 30, centerThickness: s.centerThickness, frontRadius: s.frontRadius, backRadius: s.backRadius, insideIndex: 1.62, outsideIndex: 1.2, partialReflection: false };
    const r = await runV40WithObs({
      model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1.2,
      components: [
        { id: 'S1', type: 'point-source', parameters: { x: -100, y: 8, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 0 } },
        { id: 'L1', type: 'spherical-lens', parameters: lp },
        { id: 'D1', type: 'ray-detector', parameters: { x: 100, y: 0, orientationDeg: 90, length: 120 } }
      ]
    }, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
    const hit = r.obsRes?.results?.[0]?.value?.[0];
    const ref = exactSphereLensTrace(lp, 8);
    const yErr = hit ? Math.abs(hit.pointMm.y - ref.yDet) : NaN;
    const dirErr = hit ? Math.hypot(hit.incomingUnit.x - ref.dir.x, hit.incomingUnit.y - ref.dir.y) : NaN;
    console.log(`  D1 [${s.name}]: ok=${r.ok} yErr=${yErr.toExponential(2)} mm, dirErr=${dirErr.toExponential(2)}`);
  }

  // D2: Decentered ideal-lens oblique forward (+x) AND reverse (-x) exact law check!
  // IdealLens at x=50, y=20, f=80, ap=60. Source at (0, 5), angle=+25 deg -> hits lens at yHit = 5 + 50*tan(25) = 28.3154
  // Thin lens law: tan(theta_out) = tan(theta_in) - (yHit - yLens)/f!
  const thIn = 25 * Math.PI / 180;
  const yHit = 5 + 50 * Math.tan(thIn);
  const slopeOutExpected = Math.tan(thIn) - (yHit - 20) / 80;
  const rD2 = await runV40WithObs({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: 0, y: 5, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: 25 } },
      { id: 'L1', type: 'ideal-lens', parameters: { x: 50, y: 20, focalLength: 80, apertureHeight: 60 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: 100, y: 20, orientationDeg: 90, length: 100 } }
    ]
  }, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  const hD2 = rD2.obsRes?.results?.[0]?.value?.[0];
  const slopeOutObs = hD2.incomingUnit.y / hD2.incomingUnit.x;
  console.log(`  D2 [decentered ideal-lens oblique]: ok=${rD2.ok} slopeErr=${Math.abs(slopeOutObs - slopeOutExpected).toExponential(2)} yErr=${Math.abs(hD2.pointMm.y - (yHit + 50 * slopeOutExpected)).toExponential(2)}`);

  // D3: 90-degree corner-touching plane-mirror retroreflector exact 180-deg reversal invariant!
  const rD3 = await runV40WithObs({
    model: 'native-optical-bench', lengthUnit: 'mm', backgroundIndex: 1,
    components: [
      { id: 'S1', type: 'point-source', parameters: { x: -40, y: 12, brightness: 0.2 }, emission: { mode: 'single-ray', directionDeg: -17 } },
      { id: 'M1', type: 'plane-mirror', parameters: { x: 50, y: 25, orientationDeg: 90, length: 50 } },
      { id: 'M2', type: 'plane-mirror', parameters: { x: 25, y: 0, orientationDeg: 0, length: 50 } },
      { id: 'D1', type: 'ray-detector', parameters: { x: -30, y: 0, orientationDeg: 90, length: 80 } }
    ]
  }, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  const hD3 = rD3.obsRes?.results?.[0]?.value || [];
  const ret = hD3.find(h => h.incomingUnit.x < 0);
  const inDir = { x: Math.cos(-17 * Math.PI / 180), y: Math.sin(-17 * Math.PI / 180) };
  const retroErr = ret ? Math.hypot(ret.incomingUnit.x + inDir.x, ret.incomingUnit.y + inDir.y) : NaN;
  console.log(`  D3 [90-deg corner reflector]: ok=${rD3.ok} retroDirErr=${retroErr.toExponential(2)} hits=${hD3.length}`);
}

// =========================================================================
// PROBE E: Check ALL 8 curated v40 browser starters + nativeComparisonReadouts!
// =========================================================================
{
  console.log('\n=== PROBE E (All 8 curated v40 starters + exploration readouts) ===');
  const starters = [
    'native-optical-bench', 'v40-billet-split-lens', 'v40-snell-window',
    'v40-silvered-plano-convex', 'v40-cemented-doublet', 'v40-layered-mirror-tank',
    'v40-silvered-hemisphere', 'v40-beam-splitter-bench'
  ];
  for (const name of starters) {
    const doc = JSON.parse(readFileSync(resolve(REPO, 'scenes', name + '.json'), 'utf8'));
    const ev = evaluateDocument(doc, core, []);
    const compReadouts = nativeComparisonReadouts(doc);
    const hasBS = doc.physics.components.some(c => c.type === 'beam-splitter');
    const bsReadout = compReadouts.some(r => r.kind === 'beam-splitter-interactions');
    console.log(`  ${name}: passed=${ev.summary.executionPassed} status=${ev.summary.native.status} emitted=${ev.summary.native.emitted} processed=${ev.summary.native.processed} trunc=${ev.summary.native.truncation} warnings=${ev.summary.native.warnings.length} hasBS=${hasBS} bsInCompReadouts=${bsReadout}`);
  }
}

// =========================================================================
// PROBE F: Unfamiliar 14-component multi-primitive v40 composition + reviseComponents closure!
// =========================================================================
{
  console.log('\n=== PROBE F (Unfamiliar multi-primitive v40 composition + reviseComponents) ===');
  // Compose simultaneously in n_bg = 1.1:
  // - Interior source inside tilted circular-cap-dielectric
  // - Second ambient directional source
  // - Touching 2-layer glass slab (polygon + prism)
  // - Decentered ideal-lens
  // - Exterior beam-splitter
  // - Curved circular-arc-mirror
  // - Submerged circle-blocker inside polygon
  // - Submerged detector + exterior detector
  const req = {
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: 1.1,
    components: [
      { id: 'Cap1', type: 'circular-cap-dielectric', parameters: { x: -60, y: 0, radius: 20, capHeight: 20, normalDeg: 0, insideIndex: 1.5, outsideIndex: 1.1, partialReflection: false } },
      { id: 'S_in', type: 'point-source', parameters: { x: -50, y: 4, brightness: 0.4 }, emission: { mode: 'single-ray', directionDeg: 5 } },
      { id: 'L_dec', type: 'ideal-lens', parameters: { x: -20, y: 5, focalLength: 100, apertureHeight: 30 } },
      { id: 'BS1', type: 'beam-splitter', parameters: { x: 0, y: 0, orientationDeg: 45, length: 30, transmissionRatio: 0.5 } },
      { id: 'Slab1', type: 'polygon-dielectric', parameters: { x1: 20, y1: -20, x2: 40, y2: -20, x3: 40, y3: 20, x4: 20, y4: 20, insideIndex: 1.6, outsideIndex: 1.1, partialReflection: false } },
      { id: 'Prism1', type: 'triangular-prism', parameters: { x1: 40, y1: -20, x2: 60, y2: 0, x3: 40, y3: 20, insideIndex: 1.75, outsideIndex: 1.1, partialReflection: false } },
      { id: 'Blk_sub', type: 'circle-blocker', parameters: { x: 30, y: -12, radius: 3 } },
      { id: 'D_sub', type: 'ray-detector', parameters: { x: 30, y: 6, orientationDeg: 90, length: 12 } },
      { id: 'M_arc', type: 'circular-arc-mirror', parameters: { x: 0, y: 40, normalDeg: -90, radius: 60, apertureHeight: 24 } },
      { id: 'D_out', type: 'ray-detector', parameters: { x: 80, y: 0, orientationDeg: 90, length: 60 } }
    ]
  };
  const rF = await runV40WithObs(req, [
    { id: 'bs', kind: 'beam-splitter-interactions', componentId: 'BS1' },
    { id: 'dsub', kind: 'detector-crossings', componentId: 'D_sub' },
    { id: 'dout', kind: 'detector-crossings', componentId: 'D_out' },
    { id: 'm', kind: 'mirror-reflections', componentId: 'M_arc' },
    { id: 'cap', kind: 'interface-interactions', componentId: 'Cap1' },
    { id: 'slab', kind: 'interface-interactions', componentId: 'Slab1' }
  ]);
  console.log('F1 unfamiliar 10-component bench:', {
    ok: rF.ok, status: rF.summary?.native?.status, errors: rF.summary?.native?.errors,
    obs: rF.obsRes?.results?.map(x => ({ id: x.id, status: x.status, value: x.value }))
  });
  // Test reviseComponents: remove Cap1 (so S_in becomes ambient in backgroundIndex=1.1!) and remove Slab1 + Prism1 + Blk_sub + D_sub -> 0 bodies closure!
  if (rF.doc) {
    const rev = reviseComponents(rF.doc, {
      format: 'opticsim-component-revision-v1',
      operations: [
        { op: 'remove', id: 'Cap1' },
        { op: 'remove', id: 'Slab1' },
        { op: 'remove', id: 'Prism1' }
      ]
    });
    const evRev = evaluateDocument(rev.document, core, []);
    console.log('F2 reviseComponents 3->0 body deletion closure:', {
      bgIndexPreserved: rev.document.physics.backgroundIndex === 1.1,
      seedPreserved: rev.document.simulation.randomSeed === rF.doc.simulation.randomSeed,
      passed: evRev.summary.executionPassed, status: evRev.summary.native.status
    });
  }
}
