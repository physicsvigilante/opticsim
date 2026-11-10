import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validate, parseSave, serializeSave } from '../../../src/contract.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const local = p => relative(root, p).split(sep).join('/');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// Exported for focused tests using the already-built core. The CLI always builds
// afresh before loading that core. This function makes no files or native exports.
export function checkCandidate(text, core) {
  const report = { documentSha256: hash(text), validation: { valid: false },
    interpretation: 'not-assessed-by-checker', executionPassed: false };
  let doc;
  try {
    doc = JSON.parse(text); validate(doc);
    report.validation = { valid: true };
    report.document = { format: doc.format, schemaVersion: doc.schemaVersion,
      adapterVersion: doc.adapterVersion, upstreamCommit: doc.upstreamCommit };
  } catch (error) {
    report.validation.error = { message: error.message, path: error.path ?? null, code: error.code ?? 'INVALID_JSON' };
    report.native = { status: 'not-run' }; report.analysis = { status: 'not-run' };
    return report;
  }
  let loaded;
  const session = new core.Session(candidate => {
    loaded = core.loadDocument(candidate);
    const emission = core.observeSourceSet(candidate, loaded.scene, loaded.idMap);
    const reflections = core.observeMirrorSet(candidate, loaded.scene, loaded.idMap);
    const detectors = core.observeDetectorSet(candidate, loaded.scene, loaded.idMap);
    const simulator = new core.Simulator(loaded.scene, null, null, null, null, null, false, candidate.simulation.processedRayLimit);
    return {
      cancel() { simulator.shouldSimulatorStop = true; },
      run(notify) {
        for (const event of ['simulationComplete', 'simulationStop']) simulator.on(event, () => notify(event, core.diagnostics(loaded.scene, simulator, emission, reflections, detectors)));
        simulator.updateSimulation();
      }
    };
  }, () => {});
  session.apply(doc);
  if (session.state === 'running') session.stop(); // Never report an unobserved completion.
  const completed = ['completed', 'completed-with-warnings'].includes(session.state);
  const expectedSources=doc.physics.components.filter(c=>c.type==='point-source');
  const sourceReadings=session.data?.emissionsById || {};
  const sourceState = !completed ? 'incomplete-or-failed' :
    expectedSources.every(c=>Number.isInteger(sourceReadings[c.id]?.emitted)&&
      sourceReadings[c.id].emitted>=0)&&
    Object.values(sourceReadings).reduce((n,reading)=>n+reading.emitted,0)===session.data?.emitted ?
      'complete' : 'unavailable';
  const expectedDetectors=doc.physics.components.filter(c=>c.type==='ray-detector');
  const readings=session.data?.detectorsById || {};
  const measurementState = !expectedDetectors.length ? 'not-applicable' :
    !completed ? 'incomplete-or-failed' :
    expectedDetectors.every(c=>Number.isFinite(readings[c.id]?.signedPower) &&
      Number.isInteger(readings[c.id]?.crossings)) ? 'complete' : 'unavailable';
  report.native = { status: session.state, completed, diagnostics: session.data,
    error: session.error ?? null, sourceEmissions: sourceState,
    detectorMeasurements: measurementState };
  report.analysis = { status: session.analysisStatus, reason: session.analysisReason, prediction: session.prediction };
  report.components = loaded ? doc.physics.components.map(c => ({ id: c.id, type: c.type, nativeIndex: loaded.idMap.get(c.id) })) : [];
  try {
    assert.deepEqual(parseSave(serializeSave(doc)), doc);
    const derived = core.loadNative(JSON.parse(core.nativeExport(doc)));
    const reference = core.loadDocument(doc).scene;
    assert.deepEqual(derived.objs.map(o => o.serialize()), reference.objs.map(o => o.serialize()));
    report.roundTrip = { sandbox: true, native: true };
  } catch (error) { report.roundTrip = { error: error.message }; }
  report.executionPassed = completed && report.roundTrip.sandbox === true &&
    report.roundTrip.native === true && sourceState==='complete' &&
    ['not-applicable','complete'].includes(measurementState);
  return report;
}

function fingerprint() {
  const files = [local(fileURLToPath(import.meta.url)), 'scripts/build.mjs', 'package.json', 'package-lock.json', 'upstream-pin.json',
    'vendor/ray-optics/package-lock.json', ...readdirSync(resolve(root, 'src')).filter(n => n.endsWith('.js')).map(n => `src/${n}`)];
  return Object.fromEntries(files.map(p => [p, hash(readFileSync(resolve(root, p)))]));
}

function main() {
  const args = process.argv.slice(2), inputs = [], evidence = [];
  let output;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') {
      console.log('check-scene.mjs <candidate.json> [...] [--evidence <input-file>] [...] [--report test-artifacts/image-to-scene/...json]\nRebuilds the existing headless core. Exit 0: execution/round-trips pass (not interpretation); 1: candidate/run failure; 2: setup/usage failure.');
      return;
    }
    if (arg === '--report' || arg === '--evidence') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw Error(`${arg} requires a file path`);
      if (arg === '--report') output = resolve(value); else evidence.push(resolve(value));
    } else if (arg.startsWith('--')) throw Error(`Unknown option ${arg}`);
    else inputs.push(resolve(arg));
  }
  if (!inputs.length) throw Error('Provide at least one candidate JSON file; use --help.');
  const reportRoot = resolve(root, 'test-artifacts/image-to-scene');
  if (output && (!output.startsWith(reportRoot + sep) || !output.endsWith('.json'))) throw Error('--report must be a .json file under this repo\'s test-artifacts/image-to-scene/');
  const candidates = inputs.map(path => {
    const bytes = readFileSync(path);
    if (bytes.length > 1024 * 1024) throw Error(`Candidate exceeds the browser's 1 MB limit: ${local(path)}`);
    return { path, text: bytes.toString('utf8') };
  });
  const evidenceFiles = evidence.map(path => ({ path: local(path), sha256: hash(readFileSync(path)) }));
  const before = fingerprint();
  // Fails on missing dependencies, dirty upstream, or pin mismatch. Never falls
  // back to a stale bundle or installs anything. Build output stays in the repo.
  const build = execFileSync(process.execPath, [resolve(root, 'scripts/build.mjs'), '--test'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const after = fingerprint(); assert.deepEqual(after, before, 'Source changed during build; retry against a consistent working tree.');
  const core = createRequire(import.meta.url)(resolve(root, 'dist/test-core.cjs'));
  const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(root, 'vendor/ray-optics'), encoding: 'utf8' }).trim();
  const report = { tool: 'sim-ro-image-to-scene-checker', createdAt: new Date().toISOString(),
    context: { gitHead: git(['rev-parse', 'HEAD']), gitStatus: git(['status', '--porcelain=v1', '--untracked-files=all']),
      upstreamCommit: upstream, sourceHashes: after, coreSha256: hash(readFileSync(resolve(root, 'dist/test-core.cjs'))), build: build.trim() },
    evidence: evidenceFiles, results: candidates.map(c => ({ path: local(c.path), ...checkCandidate(c.text, core) })) };
  const text = JSON.stringify(report, null, 2) + '\n';
  if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, text); }
  process.stdout.write(text);
  if (report.results.some(r => !r.executionPassed)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Checker setup/usage failure: ${error.message}\n`);
    process.exitCode = 2;
  }
}
