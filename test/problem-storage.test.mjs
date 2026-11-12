import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
test('native evidence storage failure aborts without misreporting the physics',async()=>{
 const prior=JSON.parse(readFileSync(new URL('../evaluation/original-refraction-pair-v1/first-attempt.json',import.meta.url)));
 const input={format:'opticsim-problem-v1',physical:prior.cases.find(c=>c.id==='B06').request,
   requests:[{id:'emissions',kind:'source-emissions',componentId:'S1'}]};
 const out=resolve('test-artifacts/llm-authoring/unified-storage-'+randomUUID());
 await assert.rejects(runProblemEvidence({inputBytes:Buffer.from(JSON.stringify(input)),outputPath:out,execute:scene=>{
  writeFileSync(resolve(out,'native-evidence.json'),'occupied evidence path',{flag:'wx'});
  return evaluateDocument(scene,core);
 }}),/EEXIST/);
 assert.ok(existsSync(resolve(out,'plan.json')));
 assert.ok(existsSync(resolve(out,'analytical-results.json')));
 assert.ok(!existsSync(resolve(out,'report.json')));
 assert.equal(readFileSync(resolve(out,'native-evidence.json'),'utf8'),'occupied evidence path');
});
