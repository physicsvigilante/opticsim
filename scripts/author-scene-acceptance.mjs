// Real end-to-end CLI check: LLM-sized request -> preparation -> the pinned
// PhyDemo engine -> source/detector evidence -> stable-ID unit-aware revision.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../src/contract.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=resolve(root,'test-artifacts/llm-authoring');
mkdirSync(base,{recursive:true});
const cli=(args)=>JSON.parse(execFileSync(process.execPath,
  ['scripts/author-scene.mjs',...args],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));
const path=(x)=>resolve(base,x);
const current=cli(['evaluate','test/fixtures/llm-authoring/general-source-detector.request.json',
  '--out',path('source-detector')]);
assert.equal(current.accepted,true);assert.equal(current.executionPassed,true);
assert.equal(current.native.status,'completed');
assert.equal(current.measurementState,'complete');
assert.equal(current.analysis.status,'unavailable');
assert.equal(current.interpretation,'not-assessed-by-engine');
assert.ok(current.observations.detectorsById.D1.crossings>0);
assert.equal(current.preparation.canonicalLengthUnit,'mm');
assert.ok(current.outputs.scene.startsWith(base));
const doc=JSON.parse(readFileSync(current.outputs.scene,'utf8'));
assert.equal(validate(doc),doc);
assert.equal(doc.physics.components.find(c=>c.id==='D1').parameters.x,150);
const patch={expectedSha256:current.canonicalSha256,changes:[
  {id:'D1',section:'parameters',key:'x',value:16,unit:'cm'}
]};
writeFileSync(path('edit.json'),JSON.stringify(patch,null,2)+'\n');
const revised=cli(['revise',current.outputs.scene,path('edit.json'),'--out',path('revised')]);
assert.equal(revised.accepted,true);assert.equal(revised.executionPassed,true);
assert.equal(revised.native.status,'completed');assert.equal(revised.measurementState,'complete');
assert.notEqual(revised.canonicalSha256,current.canonicalSha256);
const next=JSON.parse(readFileSync(revised.outputs.scene,'utf8'));
assert.equal(next.physics.components.find(c=>c.id==='D1').parameters.x,160);
assert.equal(next.physics.components.find(c=>c.id==='S1').parameters.x,-250);
assert.equal(next.physics.components.find(c=>c.id==='S1').id,'S1');
const stale=spawnSync(process.execPath,['scripts/author-scene.mjs','revise',
  revised.outputs.scene,path('edit.json')],{cwd:root,encoding:'utf8'});
assert.equal(stale.status,1);
assert.ok(JSON.parse(stale.stdout).issues.some(x=>x.code==='STALE_REVISION'));
const mirror=cli(['evaluate','test/fixtures/llm-authoring/general-mirror-pair.request.json',
  '--out',path('mirror-pair')]);
assert.equal(mirror.accepted,true);assert.equal(mirror.executionPassed,true);
assert.equal(mirror.native.status,'completed');
assert.equal(mirror.observations.detectorsById,null);
assert.deepEqual(Object.keys(mirror.observations.reflectionsById),['M1','M2']);
const report={status:'pass',cases:['source-detector','targeted-revision','stale-revision',
  'mirror-pair-without-lens'],firstSha256:current.canonicalSha256,
  revisedSha256:revised.canonicalSha256,sourceAndDetector:current.observations,
  mirrorCounts:mirror.observations.reflectionsById};
writeFileSync(path('acceptance.json'),JSON.stringify(report,null,2)+'\n');
console.log('LLM authoring acceptance PASS: 4 cases, native tracing, feedback and revision guard.');
