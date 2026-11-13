// Keep same-chat development attempts byte-frozen and separate from independent evaluation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {planProblem} from '../src/problem-workflow.js';
const here=new URL('../evaluation/self-reviewed-pilot-v1/',import.meta.url);
const file=name=>readFileSync(new URL(name,here));
const sha=bytes=>createHash('sha1').update(Buffer.concat([
 Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
test('three GPT-6 same-chat first attempts match earlier Git blobs and are never labelled independent',()=>{
 const qb=file('questions.json'),ab=file('first-attempts.json');
 assert.equal(sha(qb),'b191ad0241759b6e1fc9c263d6c4c7a7dc6be9ed');
 assert.equal(sha(ab),'5f2ca869351321a1fe585d3b91dc096d0734163e');
 const q=JSON.parse(qb),a=JSON.parse(ab),r=JSON.parse(file('reference.json'));
 assert.equal(q.questions.length,3);assert.equal(a.attempts.length,3);
 assert.equal(a.independentModel,false);assert.equal(a.independentReviewers,0);
 assert.equal(a.externalProviderCalls,0);assert.equal(a.automatedRepairs,0);
 assert.equal(r.independentlyReviewed,false);assert.equal(r.firstAttemptFreezeCommit,
  '4ee53964751721bf4307ebef1c7de23a9c642486');
 assert.deepEqual(q.questions.map(x=>x.id),a.attempts.map(x=>x.id));
 assert.deepEqual(q.questions.map(x=>x.id),r.cases.map(x=>x.id));
});
test('typed scene requests are accepted without inventing physical inputs; missing radius produces a refusal',()=>{
 const a=JSON.parse(file('first-attempts.json'));
 for(const attempt of a.attempts.slice(0,2)){
  const raw=JSON.parse(attempt.rawOutput);
  const prior=JSON.stringify(raw.request);
  const planned=planProblem(raw.request);
  assert.equal(planned.native.canRun,true);
  assert.equal(planned.nativeRequests.length,3);
  assert.equal(planned.scene.schemaVersion,4);
  assert.equal(planned.scene.physics.model,'general-component-tracing');
  assert.equal(JSON.stringify(raw.request),prior);
 }
 const refused=JSON.parse(a.attempts[2].rawOutput);
 assert.equal(typeof refused.cannotAuthor,'string');
 assert.match(refused.cannotAuthor,/radius.*(missing|not specified|not supplied)|radius is not specified/i);
});
