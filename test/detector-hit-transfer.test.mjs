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
const twoGlassUiPostFreeze=JSON.parse(read('test/fixtures/two-glass-app-postfreeze-v1.json'));
const thickLensUiPostFreeze=JSON.parse(read('test/fixtures/thick-lens-app-postfreeze-v1.json'));
const thickMirrorUiPostFreeze=JSON.parse(read('test/fixtures/thick-lens-mirror-app-postfreeze-v1.json'));
const twoThickMirrorUiPostFreeze=JSON.parse(read('test/fixtures/two-thick-lens-mirror-app-postfreeze-v1.json'));
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
 // The v14 engine needs one later UI compatibility change to expose native
 // SingleRay controls. Pin its exact SHA and original R1 freeze separately;
 // do not treat any later app.js change as fresh blind source evidence.
 assert.equal(twoGlassUiPostFreeze.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 assert.equal(twoGlassUiPostFreeze.target,'src/app.js');
 assert.equal(twoGlassUiPostFreeze.originalFrozenSha256,freeze.frozenFiles['src/app.js']);
 assert.equal(twoGlassUiPostFreeze.productionBaseMain,'d3509e82fb65d81aabe336666851f8f2962623f4');
 // Third, distinct post-exposure v15 viewer patch. Chain prior immutable v14
 // source SHA instead of editing or retrospectively re-freezing old evidence.
 assert.equal(thickLensUiPostFreeze.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 assert.equal(thickLensUiPostFreeze.priorPostfreezeFile,'test/fixtures/two-glass-app-postfreeze-v1.json');
 assert.equal(thickLensUiPostFreeze.originalFrozenSha256,freeze.frozenFiles['src/app.js']);
 assert.equal(thickLensUiPostFreeze.priorReviewedTwoGlassSha256,twoGlassUiPostFreeze.candidateTwoGlassSha256);
 // A further v16 post-exposure browser patch is never relabelled as earlier
 // blind R1 evidence, nor does it mutate the separately pinned v15 source.
 assert.equal(thickMirrorUiPostFreeze.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 assert.equal(thickMirrorUiPostFreeze.priorPostfreezeFile,'test/fixtures/thick-lens-app-postfreeze-v1.json');
 assert.equal(thickMirrorUiPostFreeze.originalFrozenSha256,freeze.frozenFiles['src/app.js']);
 assert.equal(thickMirrorUiPostFreeze.priorReviewedThickLensSha256,thickLensUiPostFreeze.candidateThickLensSha256);
 // v17 deeper native scenes expose a separate post-exposure browser patch;
 // original R1/v14/v15/v16 source hashes remain independently frozen.
 assert.equal(twoThickMirrorUiPostFreeze.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 assert.equal(twoThickMirrorUiPostFreeze.priorPostfreezeFile,'test/fixtures/thick-lens-mirror-app-postfreeze-v1.json');
 assert.equal(twoThickMirrorUiPostFreeze.originalFrozenSha256,freeze.frozenFiles['src/app.js']);
 assert.equal(twoThickMirrorUiPostFreeze.priorReviewedV16Sha256,thickMirrorUiPostFreeze.candidateThickMirrorSha256);
 for(const [path,expected] of Object.entries(freeze.frozenFiles)){
  if(integration.changedAfterReservedExecution.includes(path)){
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
  }else if(path==='src/app.js'){
   assert.equal(hash(path),twoThickMirrorUiPostFreeze.candidateV17Sha256,
    'Only this explicitly separate v17 native two-thick-lens/mirror browser patch is admitted');
   assert.notEqual(hash(path),expected,'Do not rewrite original pre-transfer frozen app source evidence');
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
