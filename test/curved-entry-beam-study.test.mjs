import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { compileParallelBeam } from '../src/parallel-beam.js';
import { compileSemicircular, semicircularEncounter } from '../src/semicircular-dielectric.js';

const core = createRequire(import.meta.url)('../dist/test-core.cjs');
const study = JSON.parse(readFileSync(new URL('../evaluation/curved-entry-beam-v1/frozen.json', import.meta.url)));

function verifiedTerminal(terminal, diagnostics) {
  return terminal === 'simulationComplete' && core.classifyRun(terminal, diagnostics) === 'completed';
}

function transmitted(event, ray) {
  const dx = ray.p2.x - ray.p1.x, dy = ray.p1.y - ray.p2.y;
  const projection = (dx * event.normal.x + dy * event.normal.y) / Math.hypot(dx, dy);
  return event.from === 'outside' ? projection < -1e-8 : projection > 1e-8;
}

function observe({ radius, width, beamY, density }, limit = 10000) {
  const glass = {parameters: {x: 0, y: 0, radius, outsideIndex: 1, insideIndex: 1.5, partialReflection: false}};
  const beam = {parameters: {x: 200, y: beamY, width, directionDeg: 180, brightness: 0.08}};
  const scene = core.loadNative({
    version: 5, width: 1200, height: 700, scale: 1, origin: {x: 500, y: 350}, mode: 'rays',
    rayModeDensity: density, maxRayDepth: 8, lengthScale: 1, simulateColors: false,
    colorMode: 'default', objs: [compileParallelBeam(beam), compileSemicircular(glass)]
  });
  const [source, boundary] = scene.objs;
  const launch = source.onSimulationStart, incident = boundary.onRayIncident;
  const paths = new Map();
  source.onSimulationStart = function (...args) {
    const result = launch.apply(this, args);
    for (const ray of result.newRays) {
      assert.ok(!paths.has(ray));
      paths.set(ray, {launchY: -ray.p1.y, events: []});
    }
    return result;
  };
  boundary.onRayIncident = function (ray, index, point, ...rest) {
    const dx = ray.p2.x - ray.p1.x, dy = ray.p1.y - ray.p2.y, norm = Math.hypot(dx, dy);
    const event = semicircularEncounter(glass, point, {x: dx/norm, y: dy/norm});
    const result = incident.call(this, ray, index, point, ...rest);
    assert.ok(!event.invalid && !result?.isUndefinedBehavior && !result?.isAbsorbed && !result?.newRays?.length);
    assert.ok(transmitted(event, ray), 'Outgoing ray must cross the observed face');
    paths.get(ray).events.push(event);
    return result;
  };
  const sim = new core.Simulator(scene, null, null, null, null, null, false, limit);
  let terminal;
  for (const name of ['simulationComplete', 'simulationStop']) sim.on(name, () => { terminal = name; });
  sim.updateSimulation();
  const diagnostics = core.diagnostics(scene, sim, null, null, null, null, null, {nativeEvent: terminal});
  return {verified: verifiedTerminal(terminal, diagnostics), diagnostics, paths: [...paths.values()]};
}

test('frozen A14 controls measure actual flat-face hits of a curved-entry native Beam', () => {
  const spans = [];
  for (const cfg of study.cases) {
    const {paths, verified, diagnostics} = observe(cfg);
    assert.equal(verified, true);
    assert.equal(verifiedTerminal(undefined, diagnostics), false);
    assert.equal(paths.length, cfg.width * cfg.density);
    const heights = paths.map(({launchY, events}) => {
      assert.deepEqual(events.map(e => [e.faceId, e.from]), [['face-arc','outside'], ['face-flat','inside']]);
      // At entry the inward normal tilts toward the axis. Snell gives the
      // residual angle between that normal and the transmitted direction.
      const normalAngle = Math.asin(launchY / cfg.radius);
      const residual = Math.asin(launchY / (1.5 * cfg.radius));
      const expected = launchY - cfg.radius * Math.cos(normalAngle) * Math.tan(normalAngle - residual);
      const actual = events[1].point.y;
      assert.ok(Math.abs(actual - expected) < 1e-5);
      return actual;
    });
    const min = Math.min(...heights), max = Math.max(...heights);
    if (cfg.beamY === 0) {
      assert.ok(Math.abs(min + max) < 1e-5 && max > 0 && max < cfg.width/2);
    } else {
      assert.ok(min > 0);
    }
    spans.push({name:cfg.name, count:paths.length, min, max});
  }
  assert.ok(spans[1].max > spans[0].max);
  assert.equal(observe(study.cases[0], 1).verified, false);
  const flat = {from:'inside', normal:{x:-1,y:0}};
  assert.equal(transmitted(flat, {p1:{x:0,y:0},p2:{x:1,y:0}}), false);
  console.log('A14 sampled flat-face ordinates (mm)', JSON.stringify(spans));
});
