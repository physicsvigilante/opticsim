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
const later=JSON.parse(read('test/fixtures/detector-hit-provenance-integration.json'));
const request=[{id:'hits',kind:'detector-hit-events',componentId:'D1'},
 {id:'crossings',kind:'detector-crossings',componentId:'D1'},
 {id:'glass',kind:'interface-interactions',componentId:'P1'},
 {id:'blocked',kind:'blocker-absorptions',componentId:'B1'}];
const reserved=()=>JSON.parse(read('test/fixtures/detector-hit-transfer.json'));
const almost=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('reserved transfer file and frozen production/checker fingerprints are unchanged',()=>{
 assert.equal(hash('test/fixtures/detector-hit-transfer.json'),freeze.reservedInputSha256);
 assert.equal(freeze.status,'preexecution-freeze');
 assert.equal(freeze.reservedInputSha256,'8e8deca8af9919cb56906c2491eb2ac2e8de50f833e30134272b1a074213c756');
 // Preserve the original freeze exactly. A later corrective merge-baseline
 // integration restored two PRE-EXISTING v10-to-v11 qualified upgrade behaviors.
 // Neither its new hashes nor R1 replays are retrospectively first-run evidence.
 assert.equal(integration.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 assert.equal(later.historicalFreezeFile,'test/fixtures/detector-hit-transfer-freeze.json');
 assert.equal(later.priorIntegrationRecord,'test/fixtures/detector-hit-integration-rebase.json');
 assert.equal(later.baselineCommit,freeze.baseline);
 assert.equal(later.qualification.includes('NOT rerun'),true);
 assert.deepEqual(Object.keys(later.replacementHashes).sort(),[...later.changedAfterReservedExecution].sort());
 assert.ok(later.changedAfterReservedExecution.every(path=>Object.hasOwn(freeze.frozenFiles,path)));
 assert.ok(later.changedAfterReservedExecution.every(path=>!integration.changedAfterReservedExecution.includes(path)));
 for(const [path,expected] of Object.entries(freeze.frozenFiles)){
  if(later.changedAfterReservedExecution.includes(path)){
   assert.equal(hash(path),later.replacementHashes[path],'Later R2 feature source fingerprint changed: '+path);
   assert.notEqual(hash(path),expected,'Original reserved first-run snapshot must remain historical: '+path);
  }else if(integration.changedAfterReservedExecution.includes(path)){
   assert.equal(integration.baselineCommit,freeze.baseline);
   assert.equal(hash(path),integration.replacementHashes[path],'Integration correction must remain frozen: '+path);
   assert.notEqual(hash(path),expected,'Do not rewrite original freeze evidence: '+path);
  }else assert.equal(hash(path),expected,'Unexpected change after reserved R1 first run: '+path);
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
