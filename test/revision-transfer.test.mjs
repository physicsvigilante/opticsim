import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {PINS,reviewPhysicalChange,runTransfer} from '../evaluation/revision-transfer-v1/run.mjs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url));
const json=p=>JSON.parse(file(p));
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const prompts=json('evaluation/revision-transfer-v1/prompts.json'),decisions=json('evaluation/revision-transfer-v1/first-decisions.json'),review=json('evaluation/revision-transfer-v1/review.json');
test('prospective source models, requests and first decisions stay frozen and are not labelled independent',()=>{
 assert.equal(blob(file('evaluation/revision-transfer-v1/prompts.json')),PINS.prompts);
 assert.equal(blob(file('evaluation/revision-transfer-v1/first-decisions.json')),PINS.decisions);
 assert.equal(decisions.createdBeforeExecution,true);assert.equal(decisions.independentModel,false);
 assert.equal(decisions.externalModelCalls,0);assert.equal(decisions.repairs,0);
 assert.equal(prompts.cases.length,8);assert.equal(decisions.cases.length,8);
 assert.deepEqual(prompts.cases.map(x=>x.id),decisions.cases.map(x=>x.id));
 for(const s of prompts.sourceModels)assert.equal(blob(file(s.path)),s.gitBlob);
 assert.equal(review.firstDecisionsFreezeCommit,'e83cb9135fa8655c27e1e718c519a0604b5cbcf0');
});
test('change fidelity catches a valid but unintended extra physical edit, not just schema acceptance',()=>{
 const base=json('scenes/general-two-source-lens.json'),good=structuredClone(base);
 good.physics.components.find(x=>x.id==='S2').parameters.y+=25;
 const rule=review.cases.find(x=>x.id==='T01');
 assert.equal(reviewPhysicalChange(base,good,rule).exactRequestedState,true);
 const wrong=structuredClone(good);wrong.physics.components.find(x=>x.id==='L1').parameters.focalLength=120;
 assert.equal(reviewPhysicalChange(base,wrong,rule).exactRequestedState,false);
 const numerics=structuredClone(good);numerics.simulation.rayDensity=.5;
 assert.equal(reviewPhysicalChange(base,numerics,rule).unchangedNumerics,false);
 assert.equal(base.physics.components.find(x=>x.id==='S2').parameters.y,-40);
});
test('underspecified textual requests contain no fabricated patch, component target or material value',()=>{
 for(const id of ['T03','T08']){
  const d=decisions.cases.find(x=>x.id===id);
  assert.equal(d.action,'needs-information');assert.equal(Object.hasOwn(d,'patch'),false);
  assert.ok(d.missing.length>0);assert.ok(d.explanation.length>20);
  assert.equal(review.cases.find(x=>x.id===id).expectedDisposition,'unexecuted-needs-information');
 }
 const invalid=decisions.cases.find(x=>x.id==='T07');
 assert.deepEqual(invalid.patch,review.cases.find(x=>x.id==='T07').expectedAttempt);
});
test('replay retains every original decision, executed evidence and nonexecuted outcomes without pooled accuracy',async()=>{
 const output=resolve('test-artifacts/llm-authoring/revision-transfer-test-'+randomUUID());
 const r=await runTransfer({outputPath:output});
 assert.equal(r.status,'recorded');assert.equal(r.counts.firstDecisions,8);
 assert.equal(r.sourceModels.length,2);assert.equal(r.nativeCalls.baselines,2);
 assert.equal(r.counts.executedRevisions+r.counts.engineRejections+r.counts.unexecutedNeedsInformation,8);
 assert.equal(r.counts.unexecutedNeedsInformation,2);
 for(const c of r.cases){
  assert.equal(c.baselinePreserved,true);assert.equal(c.sourceGiven,false);
  assert.ok(existsSync(resolve(output,c.id+'/decision.json')));
  if(c.outcome==='unexecuted-needs-information'){
   assert.equal(c.nativeCalls,0);assert.equal(c.native.status,'not-run');
   assert.equal(c.responseReview.status,'provisional-same-assistant');
  }
  if(c.outcome==='engine-rejection'){
   assert.equal(c.nativeCalls,0);assert.equal(existsSync(resolve(output,c.id+'/qualified-scene.json')),false);
  }
  if(c.nativeCalls){assert.ok(existsSync(resolve(output,c.qualifiedPackage)));assert.ok(c.requestedChangeFidelity);}
 }
 assert.equal(r.independentModel,false);assert.equal(r.educationalUsefulness,'not-assessed');
 assert.equal(r.textbookAnswerCompleteness,'not-requested');assert.equal(r.teacherParticipants,0);
 assert.equal(Object.hasOwn(r,'accuracy'),false);
 await assert.rejects(runTransfer({outputPath:output}),/exist|empty|fresh/i);
});
