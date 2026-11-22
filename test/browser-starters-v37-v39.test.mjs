import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseSave,validate} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const html=readFileSync(resolve(root,'public/index.html'),'utf8');

const STARTERS=[
  {name:'native-general-optical-bench',version:37,model:'native-general-optical-bench',marker:'v37EndpointsVerified'},
  {name:'native-general-refractive-bench',version:38,model:'native-general-refractive-bench',marker:'v38EndpointsVerified'},
  {name:'native-general-hybrid-bench',version:39,model:'native-general-hybrid-bench',marker:'v39EndpointsVerified'}
];

test('v37, v38, and v39 browser starters exist in scenes/ and public/index.html and trace cleanly in pinned PhyDemo',async()=>{
  for(const starter of STARTERS){
    assert.ok(html.includes(`option value="${starter.name}"`),'public/index.html selector should expose '+starter.name);
    const raw=readFileSync(resolve(root,'scenes',starter.name+'.json'),'utf8');
    const doc=parseSave(raw);
    validate(doc);
    assert.equal(doc.schemaVersion,starter.version);
    assert.equal(doc.physics.model,starter.model);
    const run=await evaluateDocument(doc,core,[{id:'det',kind:'detector-crossings',componentId:'D1'}]);
    assert.equal(run.summary.executionPassed,true,starter.name+' should execute cleanly');
    assert.equal(run.summary.observations[starter.marker],true,starter.name+' should pass '+starter.marker);
  }
});
