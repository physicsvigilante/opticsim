// Release-safety configuration checks: do not omit native or browser CI
// when expanding PR targets for stacked feature/research branches.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflowNames=["curved-mirrors.yml","mirror-angular.yml","numerical-reliability.yml","opticsim-ci.yml","original-refraction-pair.yml","parameter-experiments.yml","planar-angular-queries.yml","planar-refraction.yml","qualified-authoring.yml","source-motion.yml","unified-workflow.yml"];
const allowed = "  pull_request:\n    branches: [main, 'feature/**', 'research/**', 'fix/**', 'study/**', 'integration/**', 'design/**']";
const restrictedPush = "  push:\n    branches: [main]";
for (const name of workflowNames) {
  test('stacked PR base accepted without dropping safeguards: ' + name, () => {
    const yaml = readFileSync(new URL('../.github/workflows/' + name, import.meta.url),'utf8');
    assert.ok(yaml.includes(allowed), 'expected exact supported PR targets');
    assert.equal(yaml.split(allowed).length - 1, 1, 'one PR trigger only');
    assert.ok(yaml.includes(restrictedPush), 'push remains main-only');
    assert.ok(yaml.includes('permissions:\n  contents: read'), 'token remains read-only');
    assert.ok(yaml.includes("node-version: '24.19.0'"), 'pinned Node 24 kept');
    assert.ok(yaml.includes('npm test'), 'full Node test suite remains');
    assert.ok(yaml.includes('actions/checkout@v4'), 'trusted pinned workflow structure');
    assert.ok(!yaml.includes('pull_request_target:'), 'no elevated PR trigger');
  });
}
