import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const require = createRequire(import.meta.url);
const core = require(path.join(root, 'dist', 'test-core.cjs'));
const { prepareScene, reviseScene } = await import(pathToFileURL(path.join(root, 'src', 'authoring.js')));
const { evaluateDocument } = await import(pathToFileURL(path.join(root, 'scripts', 'author-scene.mjs')));
const { evaluateObservables } = await import(pathToFileURL(path.join(root, 'src', 'observables.js')));
const { compile, loadNative } = core;

function v40(components, extra = {}) {
  return {
    title: 'phase2-probe',
    model: 'native-optical-bench',
    lengthUnit: 'mm',
    backgroundIndex: extra.backgroundIndex ?? 1,
    randomSeed: extra.randomSeed ?? 'p2-seed',
    components
  };
}

const out = {};

// 1. Cross-verify N2-F2: ideal-curved-mirror bounding-disk rejection vs circular-arc-mirror
{
  const reqIdeal = v40([
    { id: 'S1', type: 'point-source', parameters: { x: 85, y: 0, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: 20 } },
    { id: 'M1', type: 'ideal-curved-mirror', parameters: { x: 100, y: 0, normalDeg: 180, focalLength: 25, apertureHeight: 40 } },
    { id: 'D1', type: 'ray-detector', parameters: { x: 50, y: 0, orientationDeg: 90, length: 120 } }
  ]);
  let idealErr = null;
  try { prepareScene(reqIdeal); } catch (e) { idealErr = { code: e.code, message: e.message }; }

  const reqArc = v40([
    { id: 'S1', type: 'point-source', parameters: { x: 85, y: 0, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: 20 } },
    { id: 'M1', type: 'circular-arc-mirror', parameters: { x: 100, y: 0, normalDeg: 180, radius: 50, apertureHeight: 40 } },
    { id: 'D1', type: 'ray-detector', parameters: { x: 50, y: 0, orientationDeg: 90, length: 120 } }
  ]);
  const arcDoc = prepareScene(reqArc).document;
  const arcRes = evaluateDocument(arcDoc, core, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }]);
  const arcObs = await evaluateObservables(arcDoc, [{ id: 'h', kind: 'detector-hit-events', componentId: 'D1' }], arcRes.summary);

  // Also check two facing circular-arc-mirrors (Cassegrain / optical cavity: separation 30 < 20+20)
  const reqCavity = v40([
    { id: 'S1', type: 'point-source', parameters: { x: 5, y: 0, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: 5 } },
    { id: 'M1', type: 'circular-arc-mirror', parameters: { x: 30, y: 0, normalDeg: 180, radius: 60, apertureHeight: 40 } },
    { id: 'M2', type: 'circular-arc-mirror', parameters: { x: 0, y: 0, normalDeg: 0, radius: 60, apertureHeight: 40 } }
  ]);
  let cavityErr = null;
  try { prepareScene(reqCavity); } catch (e) { cavityErr = { code: e.code, message: e.message }; }

  out.probe1_N2_F2 = {
    idealErr,
    arcStatus: arcRes.summary.native.status,
    arcHits: arcObs.results[0]?.value?.length,
    cavityTwoArcMirrorsErr: cavityErr
  };
}

// 2. Direct PhyDemo IdealMirror stress probe: would replacing bounding disk with exact segment clearance expose any PhyDemo hazard?
{
  const cases = [
    { name: 'concave_virtual_u15_f25_onaxis', sx: 85, sy: 0, deg: 20, f: 25, ap: 40 },
    { name: 'concave_virtual_u15_f25_offaxis', sx: 85, sy: 5, deg: 15, f: 25, ap: 40 },
    { name: 'concave_ultra_close_u0.02_f25', sx: 99.98, sy: 0, deg: 89, f: 25, ap: 40 },
    { name: 'concave_ultra_close_u0.02_normal', sx: 99.98, sy: 10, deg: 0, f: 25, ap: 40 },
    { name: 'concave_u_eq_f_25', sx: 75, sy: 0, deg: 20, f: 25, ap: 40 },
    { name: 'concave_u_eq_2f_50', sx: 50, sy: 0, deg: 15, f: 25, ap: 40 },
    { name: 'convex_close_u10_fneg25', sx: 90, sy: 0, deg: 30, f: -25, ap: 40 },
    { name: 'convex_ultra_close_u0.02_fneg25', sx: 99.98, sy: 5, deg: 45, f: -25, ap: 40 },
    { name: 'steep_from_near_plane_x99.98_y25', sx: 99.98, sy: 25, deg: -89.9, f: 25, ap: 40 },
    { name: 'back_side_close_u15_f25', sx: 115, sy: 0, deg: 160, f: 25, ap: 40 }
  ];
  const results = [];
  for (const tc of cases) {
    const rad = tc.deg * Math.PI / 180;
    const dx = Math.cos(rad), dy = Math.sin(rad);
    const detX = tc.name === 'steep_from_near_plane_x99.98_y25' ? 99 : (tc.sx < 100 ? 50 : 150);
    const native = {
      version: 5,
      objs: [
        { type: 'SingleRay', p1: { x: tc.sx, y: -tc.sy }, p2: { x: tc.sx + dx, y: -(tc.sy + dy) }, brightness: 0.5 },
        { type: 'IdealMirror', p1: { x: 100, y: -(tc.ap / 2) }, p2: { x: 100, y: (tc.ap / 2) }, focalLength: tc.f, filter: false },
        { type: 'Detector', p1: { x: detX, y: -10000 }, p2: { x: detX, y: 10000 }, irradMap: false }
      ],
      rayModeDensity: 0.1,
      mode: 'rays'
    };
    const scene = loadNative(native, 800, 600);
    const hits = [];
    const origDet = scene.objs[2].onRayIncident;
    scene.objs[2].onRayIncident = function (ray, idx, pt) {
      const len = Math.hypot(ray.p2.x - ray.p1.x, ray.p2.y - ray.p1.y);
      hits.push({
        x: pt.x, y: -pt.y,
        ux: (ray.p2.x - ray.p1.x) / len,
        uy: -(ray.p2.y - ray.p1.y) / len
      });
      return origDet.apply(this, arguments);
    };
    const sim = new core.Simulator(scene, null, null, null, null, null, false, 1000);
    sim.updateSimulation();

    // Independent exact ideal-mirror equation oracle:
    // Mirror at x=100, focal length f (positive converging on BOTH sides).
    // Incoming ray hits mirror at (100, yHit) with slope m_in = dy/dx.
    // Let sgn = +1 if ray approaches from left (dx > 0), -1 if from right (dx < 0).
    // For ideal mirror (Gaussian thin-mirror mapping):
    // Incoming ray travels in direction (sgn, sgn*m_in) -> reflected ray travels back in (-sgn, ?).
    // Exact paraxial/ideal mirror law (equivalent to thin lens + reflection):
    //   slope_out = -slope_in + sgn * yHit / f   (where slope = dy/dx_ray_travel? Let's derive cleanly!)
    // Derive: ray from (sx, sy) hits (100, yHit).
    //   After thin lens of focal length f: tan(theta_t) = dy_in/dx_in - yHit/(sgn*f) -> wait:
    //   For ray from left (dx > 0): slope_in = dy/dx. Thin lens bends slope to: slope_t = slope_in - yHit / f.
    //   Reflecting across x = 100 negates x-component while keeping y-component:
    //   Vector (1, slope_t) reflected -> (-1, slope_t), so dy/dx_ref = -slope_t = -slope_in + yHit / f.
    //   Check: horizontal ray (slope_in=0) at yHit>0 -> (-1, -yHit/f) -> hits x=100-f at y=0! YES!
    //   For ray from right (dx < 0): incoming vector (-1, -slope_in) where slope_in = dy/dx.
    //   Actually simpler: let u_x = dx/|dx| in {+1,-1}, m_in = dy / (u_x * dx) = dy / |dx| (change in y per unit progress toward mirror).
    //   Thin lens changes m to m_t = m_in - yHit / f (change in y per unit travel away from mirror).
    //   Reflected ray travels in x-direction -u_x, with y-change m_t per unit |dx|, so dir proportional to (-u_x, m_t)!
    let maxErr = null;
    if (hits.length === 1) {
      const tHit = (100 - tc.sx) / dx;
      const yHit = tc.sy + tHit * dy;
      const u_x = Math.sign(dx);
      const m_in = dy / Math.abs(dx);
      const m_t = m_in - yHit / tc.f;
      const norm = Math.hypot(-u_x, m_t);
      const expUx = -u_x / norm, expUy = m_t / norm;
      const expYDet = yHit + (detX - 100) * (expUy / expUx);
      maxErr = {
        yHit,
        yDetErr: Math.abs(hits[0].y - expYDet),
        dirErr: Math.hypot(hits[0].ux - expUx, hits[0].uy - expUy)
      };
    }
    results.push({
      name: tc.name,
      hits: hits.length,
      truncation: sim.totalTruncation,
      warning: sim.warning,
      err: maxErr
    });
  }
  out.probe2_IdealMirror_direct = results;
}

// 3. Cross-verify N2-F7 (spherical-lens AABB concave pocket) AND probe NON-CONVEX biconcave Glass.getIncidentData parity!
{
  // Biconcave lens: frontRadius = -30, backRadius = -30, apertureHeight = 40, centerThickness = 4, x = 50, y = 0
  // sag = - (20^2 / (30 + sqrt(900-400))) = -400 / (30 + 22.36068) = -7.63932 mm
  // frontApex = 48, frontRim = 40.36068; backApex = 52, backRim = 59.63932
  // Empty air pocket at (44, 0) is 4 mm outside the glass!
  const reqPocket = v40([
    { id: 'S1', type: 'point-source', parameters: { x: 44, y: 0, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: 0 } },
    { id: 'L1', type: 'spherical-lens', parameters: { x: 50, y: 0, apertureHeight: 40, centerThickness: 4, frontRadius: -30, backRadius: -30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
    { id: 'D1', type: 'ray-detector', parameters: { x: 100, y: 0, orientationDeg: 90, length: 120 } }
  ]);
  let pocketErr = null;
  try { prepareScene(reqPocket); } catch (e) { pocketErr = { code: e.code, message: e.message }; }

  // Now sweep 200 adversarial rays through this non-convex biconcave spherical-lens (outside->inside->outside, near rims, steep angles, 10 seeds)
  // AND compare against independent exact ray-circle/rim Snell tracer!
  const biconcaveFailures = [];
  let tested = 0;
  for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
    for (const y0 of [-19.5, -18, -15, -10, -5, 0, 5, 10, 15, 18, 19.5]) {
      for (const deg of [-25, -10, 0, 10, 25]) {
        const req = v40([
          { id: 'S1', type: 'point-source', parameters: { x: 0, y: y0, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: deg } },
          { id: 'L1', type: 'spherical-lens', parameters: { x: 50, y: 0, apertureHeight: 40, centerThickness: 4, frontRadius: -30, backRadius: -30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } },
          { id: 'D1', type: 'ray-detector', parameters: { x: 100, y: 0, orientationDeg: 90, length: 400 } }
        ], { randomSeed: seed });
        try {
          const doc = prepareScene(req).document;
          const res = evaluateDocument(doc, core, [
            { id: 'h', kind: 'detector-hit-events', componentId: 'D1' },
            { id: 'g', kind: 'interface-interactions', componentId: 'L1' }
          ]);
          tested++;
          // Check if native ray entered and exited with matching incidentType signs (first outside->inside, last inside->outside)
          const st = res.summary.native.status;
          const evs = res.summary.observations?.boundaryEventsById?.L1;
          if (st !== 'completed') {
            biconcaveFailures.push({ seed, y0, deg, status: st, errors: res.summary.native.errors });
          } else if (evs && evs.length >= 2) {
            if (evs[0].from !== 'outside' || evs[evs.length - 1].from !== 'inside') {
              biconcaveFailures.push({ seed, y0, deg, parityBug: true, evs });
            }
          }
        } catch (e) {
          // admission rejection (e.g. corner proximity) is ok to note if unexpected
        }
      }
    }
  }

  // Also test directly in PhyDemo with a source INSIDE the concave air pocket (44, 0) firing across 20 angles & 10 seeds!
  let pocketNativeParityFlips = [];
  for (const seed of [0.01, 0.13, 0.27, 0.49, 0.61, 0.77, 0.89, 0.99]) {
    for (const deg of [-40, -20, -5, 0, 5, 20, 40]) {
      const rad = deg * Math.PI / 180;
      const lensDoc = prepareScene(v40([
        { id: 'S1', type: 'point-source', parameters: { x: 0, y: 0, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: 0 } },
        { id: 'L1', type: 'spherical-lens', parameters: { x: 50, y: 0, apertureHeight: 40, centerThickness: 4, frontRadius: -30, backRadius: -30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } }
      ])).document;
      const compiled = compile(lensDoc).native;
      compiled.objs[0] = { type: 'SingleRay', p1: { x: 44, y: 0 }, p2: { x: 44 + Math.cos(rad), y: -Math.sin(rad) }, brightness: 0.5 };
      const scene = loadNative(compiled, 800, 600);
      const incTypes = [];
      const origInc = scene.objs[1].onRayIncident;
      scene.objs[1].onRayIncident = function (ray, idx, pt, sm) {
        incTypes.push(this.getIncidentData(ray).incidentType);
        return origInc.apply(this, arguments);
      };
      scene.rng = () => seed;
      const sim = new core.Simulator(scene, null, null, null, null, null, false, 1000);
      sim.updateSimulation();
      if (incTypes.length === 0) pocketNativeParityFlips.push({ seed, deg, error: 'NO_INCIDENTS' });
      else if (incTypes[0] !== -1 || (incTypes.length > 1 && incTypes[incTypes.length - 1] !== 1)) {
        pocketNativeParityFlips.push({ seed, deg, incTypes });
      }
    }
  }

  out.probe3_N2_F7_and_biconcave = {
    pocketAdmissionErr: pocketErr,
    biconcaveTested: tested,
    biconcaveFailures: biconcaveFailures.slice(0, 10),
    biconcaveFailureCount: biconcaveFailures.length,
    pocketNativeParityFlipCount: pocketNativeParityFlips.length,
    pocketNativeParityFlips: pocketNativeParityFlips.slice(0, 5)
  };
}

// 4. Probe F1 deeper: runtime onRayIncident tangency check on spherical-lens when incoming ray hits front-arc cleanly
//    but its infinite line happens to be tangent to back-arc's physical arc (which the ray NEVER reaches because it refracts at front-arc!)
{
  // Biconvex lens at x=50, y=0, ap=40, d=10, frontRadius=30, backRadius=30.
  // frontApex = 45, frontCenter = (75, 0), R = 30.
  // backApex = 55, backCenter = (25, 0), R = 30.
  // A ray hitting front-arc cleanly at y=10, aimed along a line tangent to back-arc (center=(25,0), R=30)!
  // Let's pick a tangent point on back-arc's PHYSICAL arc: back-arc spans y in [-20, 20] on the right side of (25,0), i.e., x = 25 + sqrt(900 - y^2).
  // Pick y_tan = 18 on back-arc: x_tan = 25 + sqrt(900-324) = 25 + 24 = 49.
  // Tangent unit vector at (49, 18) on circle centered at (25, 0): radial is (24, 18)/30 = (0.8, 0.6), tangent is (0.6, -0.8) (pointing down-right) or (-0.6, 0.8).
  // Wait: if incoming ray travels along (0.6, -0.8) from top-left toward (49, 18):
  //   At x = 25 (left of lens): t = (25 - 49)/0.6 = -40 -> y = 18 - (-40)*0.8? Wait: p(t) = (49 + 0.6t, 18 - 0.8t).
  //   Check distance to frontCenter (75, 0): at t = -10: p = (43, 26) (above lens).
  //   What about y_tan = 19 -> radial = (sqrt(539)/30, 19/30) = (0.77388, 0.63333), tangent = (0.63333, -0.77388).
  //   Wait: at t = 0, p = (48.216, 19) is ALREADY on back-arc, inside x of front-arc?
  //   Check front-arc x at y=19: frontCenter=(75,0), x_front = 75 - sqrt(900-361) = 75 - 23.216 = 51.784 > 48.216! (Wait: d=10, sag=30-sqrt(500)=7.64, edgeThickness = 10-15.28 < 0! Need d=20!)
  // Let's use d = 20, frontRadius = 30, backRadius = 30, ap = 40:
  //   frontApex = 40, frontCenter = (70, 0); backApex = 60, backCenter = (30, 0).
  //   frontRim = 40 + 7.639 = 47.639; backRim = 60 - 7.639 = 52.361; edgeThickness = 4.721 >= 1!
  //   Wait: a ray tangent to back-arc at y_tan = 18: x_tan = 30 + 24 = 54.
  //   Tangent dir = (0.6, -0.8). Move backward (t < 0): at y = 19.6 (on front-arc?): t = -2 -> x = 52.8 (past front-arc).
  //   Let's check a thicker lens or meniscus lens, OR a ray that hits front-arc at y=0 and refracts, wait:
  //   For a MENISCUS lens (frontRadius = +40, backRadius = -30, d = 6, ap = 30):
  //     frontApex = 47, frontCenter = (87, 0), sag1 = 40 - sqrt(1600-225) = 2.919, frontRim = 49.919.
  //     backApex = 53, backCenter = (83, 0), sag2 = -(30 - sqrt(900-225)) = -4.019, backRim = 57.019.
  //     Notice backCenter = (83, 0), R = 30, physical back-arc is at x = 83 - sqrt(900 - y^2) in [53, 57.019].
  //     Pick y_tan = 12 on back-arc: x_tan = 83 - sqrt(900-144) = 83 - 27.4955 = 55.5045.
  //     Radial = (-27.4955, 12)/30, tangent pointing right-up: dir = (12/30, 27.4955/30) = (0.4, 0.916515).
  //     Trace BACKWARD from (55.5045, 12) by t = -15: origin = (49.5045, -1.7477) -> wait, x=49.5 is inside!
  //     Try t = -25: origin = (45.5045, -10.9129) — OUTSIDE front-arc (x_front at y=-10.91 is 87-sqrt(1600-119)=48.51)!
  //     So the ray starts OUTSIDE the lens at (45.5, -10.91), hits front-arc CLEANLY around (48, -5) (NOT tangent to front-arc!), refracts inside the glass AWAY from tangency to back-arc!
  //     Let's see what happens at admission AND runtime!
  const yTan = 12;
  const dxR = -Math.sqrt(900 - yTan * yTan);
  const ux = yTan / 30, uy = -dxR / 30; // tangent dir (0.4, 0.916515)
  const xTan = 83 + dxR;
  const origX = xTan - 25 * ux, origY = yTan - 25 * uy;
  const deg = Math.atan2(uy, ux) * 180 / Math.PI;
  const reqMeniscus = v40([
    { id: 'S1', type: 'point-source', parameters: { x: origX, y: origY, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: deg } },
    { id: 'L1', type: 'spherical-lens', parameters: { x: 50, y: 0, apertureHeight: 30, centerThickness: 6, frontRadius: 40, backRadius: -30, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } }
  ]);
  let menAdmErr = null;
  try { prepareScene(reqMeniscus); } catch (e) { menAdmErr = { code: e.code, message: e.message }; }

  // Also test a ray that hits a plane mirror first, reflecting onto that EXACT same clean front-arc trajectory!
  // And test a ray whose BACKWARD extension after exiting back-arc is tangent to front-arc!
  // Biconvex lens x=50, d=10, frontRadius=40, backRadius=40, ap=30.
  // Ray starts at (-20, 0), hits front-arc at (45, 0), wait - even simpler:
  // Any ray leaving back-arc of a circular-cap-dielectric or spherical-lens where sameCurvedFace=true!
  out.probe4_F1_deep = {
    meniscusCleanFrontHitRejectedBecauseUnreachedBackArcTangent: menAdmErr
  };
}

// 5. Probe reviseScene coverage on v40 component types (beam-splitter, circular-cap-dielectric, spherical-lens null radius, backgroundIndex, randomSeed)
{
  const bsDoc = prepareScene(v40([
    { id: 'S1', type: 'point-source', parameters: { x: 0, y: 0, brightness: 0.5 }, emission: { mode: 'single-ray', directionDeg: 0 } },
    { id: 'BS1', type: 'beam-splitter', parameters: { x: 50, y: 0, orientationDeg: 45, length: 40, transmissionRatio: 0.5 } },
    { id: 'L1', type: 'spherical-lens', parameters: { x: 100, y: 0, apertureHeight: 30, centerThickness: 6, frontRadius: 40, backRadius: null, insideIndex: 1.5, outsideIndex: 1, partialReflection: false } }
  ])).document;
  const r1 = (() => { try { const r = reviseScene(bsDoc, { changes: [{ id: 'BS1', section: 'parameters', key: 'transmissionRatio', value: 0.3 }] }); return { ok: true, val: r.document.physics.components[1].parameters.transmissionRatio }; } catch (e) { return { ok: false, err: e.message }; } })();
  const r2 = (() => { try { const r = reviseScene(bsDoc, { changes: [{ id: 'L1', section: 'parameters', key: 'frontRadius', value: null }] }); return { ok: true, val: r.document.physics.components[2].parameters.frontRadius }; } catch (e) { return { ok: false, err: e.message }; } })();
  const r3 = (() => { try { const r = reviseScene(bsDoc, { changes: [{ id: 'L1', section: 'parameters', key: 'backRadius', value: 40 }] }); return { ok: true, val: r.document.physics.components[2].parameters.backRadius }; } catch (e) { return { ok: false, err: e.message }; } })();
  const r4 = (() => { try { const r = reviseScene(bsDoc, { backgroundIndex: 1.33, changes: [{ id: 'L1', section: 'parameters', key: 'outsideIndex', value: 1.33 }] }); return { ok: true }; } catch (e) { return { ok: false, code: e.code, err: e.message }; } })();
  out.probe5_reviseScene = { bsTransmission: r1, lensToFlat: r2, lensFromFlat: r3, backgroundIndex: r4 };
}

console.log(JSON.stringify(out, null, 2));
