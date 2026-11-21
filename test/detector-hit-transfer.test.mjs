// Reserved synthetic apparatus: first executed only after production and checking
// code hashes were frozen. Same-assistant exposure; NOT independent holdout data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const hash=p=>createHash('sha256').update(read(p)).digest('hex');
const freeze=JSON.parse(read('test/fixtures/detector-hit-transfer-freeze.json'));
const integration=JSON.parse(read('test/fixtures/detector-hit-integration-rebase.json'));
const focusedPostFreeze=JSON.parse(read('test/fixtures/focused-exploration-postfreeze.json'));
const notebookPostFreeze=JSON.parse(read('test/fixtures/portable-notebook-postfreeze-v1.json'));
// Historical SHA-256 values remain immutable evidence of the earlier R1 run.
// The NEW parentage milestone intentionally modifies these current production
// paths, and does not retroactively make the old transfer a newly blind test.
const parentageFeaturePaths=new Set([
 'src/adapter.js','src/app.js','src/native-observations.js','src/observables.js',
 'src/result-preview.js','scripts/author-scene.mjs',
 'skills/sim-ro-image-to-scene/scripts/check-scene.mjs'
]);

const request=[{id:'hits',kind:'detector-hit-events',componentId:'D1'},
 {id:'crossings',kind:'detector-crossings',componentId:'D1'},
 {id:'glass',kind:'interface-interactions',componentId:'P1'},
 {id:'blocked',kind:'blocker-absorptions',componentId:'B1'}];
const reserved=()=>JSON.parse(read('test/fixtures/detector-hit-transfer.json'));
const almost=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('original reserved transfer evidence remains frozen; explicit later parentage integration is not relabelled blind',()=>{
 assert.equal(hash('test/fixtures/detector-hit-transfer.json'),freeze.reservedInputSha256);
 assert.equal(freeze.status,'preexecution-freeze');
 assert.equal(freeze.reservedInputSha256,'8e8deca8af9919cb56906c2491eb2ac2e8de50f833e30134272b1a074213c756');
 // Preserve the original freeze exactly. A later corrective merge-baseline
 // integration restored two PRE-EXISTING v10-to-v11 qualified upgrade behaviors.
 // Neither its new hashes nor R1 replays are retrospectively first-run evidence.
 assert.equal(integration.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 // This post-exposure optional UI feature is not part of the old sealed
 // transfer. Preserve its actual original freeze bytes and pin the precise
 // later replacement instead of broadening the exemption to arbitrary edits.
 assert.equal(focusedPostFreeze.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 assert.equal(focusedPostFreeze.baselineCommit,freeze.baseline);
 assert.deepEqual(Object.keys(focusedPostFreeze.replacementHashes),['src/exploration-ui.js']);
 // Second, distinct post-exposure additive feature. Do not modify either
 // historical SHA record; check every link in the UI provenance chain.
 assert.equal(notebookPostFreeze.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 assert.equal(notebookPostFreeze.priorPostfreezeFile,'test/fixtures/focused-exploration-postfreeze.json');
 assert.equal(notebookPostFreeze.originalFrozenUiSha256,
  freeze.frozenFiles['src/exploration-ui.js']);
 assert.equal(notebookPostFreeze.priorFocusedUiSha256,
  focusedPostFreeze.replacementHashes['src/exploration-ui.js']);
 for(const [path,expected] of Object.entries(freeze.frozenFiles)){
  // The post-v27 B1 review required these two historical consumers to reject
  // old execution evidence. Pin both links without changing either freeze.
  const endpointFollowup={
   'src/exploration.js':['855f1b3dc786852f881e75c761e191515b6fefe87bdbb82dcca3711481e02dab','eadaec97de4f2a7f4780d40694bc1cce2f5a8798be62ac611097060f043f6f5d'],
   'src/scenario-comparison.js':['7852e615d59b88ed7eba1ba9bc15e450cdfa49eda7b04f5ee2398df334452bbf','df3e8b88c40964191bae567ae3e48ec876ba64f817ef44ef02a1e30852ff58ed']
  }[path];
  if(endpointFollowup){
   assert.equal(integration.replacementHashes[path]??expected,endpointFollowup[0]);
   assert.equal(hash(path),endpointFollowup[1]);
  }else if(integration.changedAfterReservedExecution.includes(path)){
   assert.equal(integration.baselineCommit,freeze.baseline);
   assert.equal(hash(path),integration.replacementHashes[path],'Integration correction must remain frozen: '+path);
   assert.notEqual(hash(path),expected,'Do not rewrite original freeze evidence: '+path);
  }else if(Object.hasOwn(focusedPostFreeze.replacementHashes,path)){
   assert.equal(focusedPostFreeze.originalFrozenHashes[path],expected,
    'Original reserved transfer SHA must remain immutable: '+path);
   assert.equal(notebookPostFreeze.priorFocusedUiSha256,
    focusedPostFreeze.replacementHashes[path],
    'Previously reviewed focused UI SHA is still immutable');
   assert.equal(hash(path),notebookPostFreeze.portableNotebookUiSha256,
    'Exact later portable-notebook UI version must remain pinned: '+path);
   assert.notEqual(hash(path),expected,'Do not relabel the old reserve test as newly blind: '+path);
  }else if(parentageFeaturePaths.has(path)){
   assert.notEqual(hash(path),expected,'New parentage feature modifies this formerly frozen source path: '+path);
  }else assert.equal(hash(path),expected,'Unexpected change to an unrelated historically frozen path: '+path);
 }
});

test('reserved prism/blocker/detector transfers with native hit location and no new controller',async()=>{
 const scene=reserved(),before=JSON.stringify(scene),out=evaluateDocument(scene,core,request);
 assert.equal(JSON.stringify(scene),before);assert.equal(out.summary.native.status,'completed');
 assert.equal(out.summary.executionPassed,true);
 const r=(await evaluateObservables(scene,request,out.summary)).results;
 assert.equal(r[0].status,'qualified');assert.equal(r[1].value,1);
 assert.equal(r[2].value,2);assert.equal(r[3].value,0);
 assert.equal(r[0].value.length,1);
 const hit=r[0].value[0];almost(hit.pointMm.x,85);almost(hit.pointMm.y,6.180474192751514);
 almost(hit.incomingUnit.x,.9934279251373641);almost(hit.incomingUnit.y,-.11445941445451874);
 almost(hit.distanceFromP1Mm,86.18047419275152);
 assert.deepEqual(Object.keys(hit).sort(),['distanceFromP1Mm','incomingUnit','pointMm']);
 assert.ok(!('rayId'in hit)&&!('sourceId'in hit));
});

test('reserved transfer native miss stays a measured zero rather than a manufactured ray path',async()=>{
 const scene=reserved(),source=scene.physics.components.find(c=>c.id==='S1');
 source.emission.directionDeg=180; // teacher-authored new hypothesis, not the frozen R1 input
 const out=evaluateDocument(scene,core,request);assert.equal(out.summary.native.status,'completed');
 const r=(await evaluateObservables(scene,request,out.summary)).results;
 assert.equal(r[1].value,0);assert.deepEqual(r[0].value,[]);
 assert.equal(r[2].value,0);assert.equal(r[3].value,0);
});
