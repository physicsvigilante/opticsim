import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const gitBlob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
test('PR 29 selection and first attempts remain byte-identical historical records, not a new unseen trial',()=>{
 const directory=new URL('../evaluation/lens-motion-prospective-v1/',import.meta.url);
 const selectionBytes=readFileSync(new URL('selection.json',directory));
 const attemptBytes=readFileSync(new URL('first-attempt.json',directory));
 // Git object IDs observed on PR 29 head e4e741c729a377963d00bbc8f85b411c34a7db3c.
 // Integrity only: these do not prove independent authorship or scientific truth.
 assert.equal(gitBlob(selectionBytes),'5638279cde8bac0f8587939e99576a8843b3c92b');
 assert.equal(gitBlob(attemptBytes),'48414cf022cbcc04ac0b2242a078b40bf71c6f09');
 const selection=JSON.parse(selectionBytes),first=JSON.parse(attemptBytes);
 assert.equal(createHash('sha256').update(selectionBytes).digest('hex'),first.selectionSha256);
 assert.deepEqual(first.cases.map(c=>c.request.interpretation.source.path),selection.cases.map(c=>c.problemPath));
 assert.equal(first.externalModelCalls,0);assert.equal(first.independentEvaluator,false);
 assert.equal(first.answersOrSolutionsUsed,false);assert.equal(first.cases.length,3);
 for(const c of first.cases){
  assert.equal(c.solutionsRead,false);assert.equal(c.request.physical,null);
  assert.equal(c.request.illustration,false);assert.equal(c.request.verifyNative,false);
 }
});
