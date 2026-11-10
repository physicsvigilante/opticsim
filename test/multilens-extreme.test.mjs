import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { checkCandidate } from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';
const core = createRequire(import.meta.url)('../dist/test-core.cjs');
const fixtureText = readFileSync(new URL('./fixtures/multilens-extreme.json', import.meta.url), 'utf8');

// This is the same numerical case as the earlier Session unit test. Here the
// checker uses the real bundled Session, source, adapter and PhyDemo Simulator:
// no replacement source, mock runner or fabricated completion event.
test('extreme lens train completes real native tracing with analytical unavailability', t => {
  const report = checkCandidate(fixtureText, core);
  assert.equal(report.validation.valid, true);
  assert.equal(report.native.status, 'completed');
  assert.equal(report.native.completed, true);
  assert.equal(report.native.error, null);
  const d = report.native.diagnostics;
  assert.deepEqual(d.errors, []);
  assert.deepEqual(d.warnings, []);
  assert.equal(d.emitted, 100);
  assert.ok(Number.isInteger(d.processed) && d.processed >= d.emitted);
  assert.ok(d.processed <= JSON.parse(fixtureText).simulation.processedRayLimit);
  assert.equal(d.truncation, 0);
  assert.equal(d.undefinedBehavior, 0);
  assert.equal(report.analysis.status, 'unavailable');
  assert.equal(report.analysis.prediction, null);
  assert.match(report.analysis.reason, /lens-train matrix is numerically unreliable/);
  assert.deepEqual(report.roundTrip, { sandbox: true, native: true });
  assert.equal(report.executionPassed, true);
  assert.deepEqual(report.components.map(c => c.id), ['source-1', 'lens-1', 'lens-2', 'lens-3']);
  t.diagnostic(JSON.stringify({ case: 'extreme-native', documentSha256: report.documentSha256,
    native: report.native.status, emitted: d.emitted, processed: d.processed,
    truncation: d.truncation, undefinedBehavior: d.undefinedBehavior,
    analysis: report.analysis.status, roundTrip: report.roundTrip }));
  // Completion certifies a bounded sampled run, not full-train illumination or
  // a trustworthy extreme-case image position. Missing finite lenses is allowed.
});

test('extreme lens train obeys real native stop and depth limits without stale analysis', t => {
  for (const [key, value, expected] of [
    ['processedRayLimit', 1, 'stopped'], ['maxRayDepth', 0, 'incomplete']
  ]) {
    const candidate = JSON.parse(fixtureText);
    candidate.simulation[key] = value;
    const text = JSON.stringify(candidate);
    const report = checkCandidate(text, core);
    assert.equal(report.validation.valid, true);
    assert.equal(report.native.status, expected);
    assert.equal(report.native.completed, false);
    assert.equal(report.executionPassed, false);
    assert.equal(report.analysis.status, 'suppressed');
    assert.equal(report.analysis.prediction, null);
    assert.deepEqual(report.native.diagnostics.errors, []);
    assert.deepEqual(report.roundTrip, { sandbox: true, native: true });
    if (key === 'maxRayDepth') assert.ok(report.native.diagnostics.truncation > 0);
    assert.equal(JSON.stringify(candidate), text, 'checker must not repair authored run limits');
    t.diagnostic(JSON.stringify({ case: 'extreme-native-limit', key, value,
      native: report.native.status, processed: report.native.diagnostics.processed,
      truncation: report.native.diagnostics.truncation, analysis: report.analysis.status }));
  }
});
