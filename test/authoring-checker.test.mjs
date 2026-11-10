import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkCandidate } from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';
const core = createRequire(import.meta.url)('../dist/test-core.cjs');
const example = name => JSON.parse(readFileSync(new URL(`../scenes/${name}.json`, import.meta.url)));
const text = doc => JSON.stringify(doc);

test('authoring checker rejects JSON/schema/native/unsupported inputs instead of repairing or running them', () => {
  const old = example('single-lens'); old.schemaVersion = old.adapterVersion = 3;
  const prism = example('single-lens'); prism.physics.components[1].type = 'prism';
  const metadata = example('single-lens'); metadata.provenance = 'must remain outside sandbox';
  for (const input of ['{broken', text({version:5,objs:[]}), text(old), text(prism), text(metadata)]) {
    const r = checkCandidate(input, {});
    assert.equal(r.validation.valid, false); assert.equal(r.executionPassed, false);
    assert.equal(r.native.status, 'not-run'); assert.ok(r.validation.error.message);
  }
});

test('authoring checker observes native execution and exact round-trips without certifying interpretation', () => {
  const input = text(example('two-lenses')), r = checkCandidate(input, core);
  assert.equal(r.documentSha256, createHash('sha256').update(input).digest('hex'));
  assert.equal(r.validation.valid, true); assert.equal(r.native.status, 'completed');
  assert.equal(r.analysis.status, 'available'); assert.equal(r.executionPassed, true);
  assert.equal(r.interpretation, 'not-assessed-by-checker');
  assert.deepEqual(r.roundTrip, {sandbox:true,native:true});
  assert.deepEqual(r.components.map(c=>c.id), ['source-1','lens-1','lens-2']);
  assert.equal(r.native.diagnostics.errors.length,0);
  assert.equal(r.native.diagnostics.emitted,500);
});

test('authoring checker honors low native limits and separates unavailable analysis from successful execution', () => {
  for (const [key,value,status] of [['processedRayLimit',1,'stopped'],['maxRayDepth',0,'incomplete']]) {
    const d = example('single-lens'); d.simulation[key] = value;
    const r = checkCandidate(text(d),core);
    assert.equal(r.native.status,status); assert.equal(r.executionPassed,false);
    assert.equal(r.analysis.status,'suppressed'); assert.equal(r.analysis.prediction,null);
    assert.equal(d.simulation[key],value);
  }
  const d = example('lens-mirror-finite');
  d.physics.components[0].parameters.x=-9000;
  d.physics.components[1].parameters.focalLength=1;
  d.physics.components[2].parameters.x=9000;
  const r=checkCandidate(text(d),core);
  assert.equal(r.validation.valid,true);assert.equal(r.native.status,'completed');
  assert.equal(r.analysis.status,'unavailable');assert.equal(r.analysis.prediction,null);
  assert.equal(r.executionPassed,true);assert.ok(r.analysis.reason);
  const failed=checkCandidate(text(example('single-lens')),{...core,loadDocument(){throw Error('native loading failure');}});
  assert.equal(failed.validation.valid,true);assert.equal(failed.executionPassed,false);
  assert.match(failed.native.error,/native loading failure/);
});

test('checker CLI refuses report writes outside its ignored output area before rebuilding or mutating files', () => {
  const root = fileURLToPath(new URL('../',import.meta.url));
  const before = readFileSync(new URL('../README.md',import.meta.url));
  const result = spawnSync(process.execPath,['skills/sim-ro-image-to-scene/scripts/check-scene.mjs','scenes/single-lens.json','--report','README.md'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,2);assert.match(result.stderr,/--report/);
  assert.deepEqual(readFileSync(new URL('../README.md',import.meta.url)),before);
});
