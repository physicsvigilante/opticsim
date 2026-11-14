import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {planProblem} from '../src/problem-workflow.js';
import {readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const file=n=>readFileSync(new URL('../evaluation/reduced-inverse-original-v1/'+n,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const select=JSON.parse(file('selection.json'));
const attempts=JSON.parse(file('first-attempts.json'));
const review=JSON.parse(file('review.json'));
test('six original image choices were selected from excluded atlas and prior ten without replacement',()=>{
 const inventory=JSON.parse(readFileSync(new URL('../evaluation/optical-systems-atlas-v1/inventory.json',import.meta.url)));
 const prior=JSON.parse(readFileSync(new URL('../evaluation/real-ten-v1/selection.json',import.meta.url)));
 const excluded=new Set(prior.cases.map(x=>x.problemPath));
 const chapters=['01_Reflection_at_Plane_Surfaces','02_Reflection_at_Curved_Surfaces','07_Lens_Formula'];
 const expected=chapters.flatMap(ch=>{
  const remaining=inventory.inventory.filter(x=>x.chapter===ch&&x.reviewStatus==='not-reviewed'&&!excluded.has(x.path)).sort((a,b)=>a.path.localeCompare(b.path));
  return [remaining[0].path,remaining[Math.floor((remaining.length-1)/2)].path];
 });
 assert.deepEqual(select.cases.map(x=>x.problemPath),expected);
 assert.equal(expected.length,6);assert.equal(new Set(expected).size,6);
 assert.equal(select.solutionsReadBeforeFirstAttempt,false);
});
test('first attempt selection and bytes stay sealed, never upgraded into independent evidence',()=>{
 assert.equal(blob(file('selection.json')),'00bc8d83632f023424f72698431ce361bf8fe9d0');
 assert.equal(blob(file('first-attempts.json')),'b57d10d9688380d92dffc047aea0a47c4d2c493f');
 assert.equal(attempts.selectionSha256,sha(file('selection.json')));
 assert.equal(attempts.solutionsReadBeforeFirstAttempt,false);
 assert.equal(attempts.independentReviewers,0);
 assert.equal(attempts.externalModelCalls,0);
 assert.equal(attempts.repairs,0);
 assert.equal(review.firstAttemptFreezeCommit,'dd5a095bf3dc9ac8f68cf6bed6aba68cccfa9aec');
 assert.equal(review.firstAttemptGitBlob,blob(file('first-attempts.json')));
 assert.equal(review.reviewSummary.manualAgreements,3);
 assert.equal(review.reviewSummary.manualAgreementsWithSignConvention,1);
 assert.equal(review.reviewSummary.partialManualAnswers,1);
 assert.equal(review.reviewSummary.alreadyGivenFormulaDerivations,1);
});
test('exact source Problems match stored selected SHA; CI never reads Solutions images',()=>{
 const archive=readFileSync(new URL('../08_Ray_Optics_Explanations.zip',import.meta.url));
 assert.equal(sha(archive),select.archiveSha256);
 for(let i=0;i<6;i++){
  const image=readProblemPng(archive,select.cases[i].problemPath);
  assert.equal(sha(image),attempts.cases[i].problemSha256);
 }
});
test('new reduced inverse kinds do not misrepresent any of the six original questions',()=>{
 for(const item of attempts.cases){
  assert.equal(item.newInverseCapability.directlyApplicable,false,item.id);
  assert.ok(item.newInverseCapability.reason.length>20);
  assert.ok(item.firstManualAnswer.expression);
  const before=JSON.stringify(item.submittedRequest);
  const plan=planProblem(item.submittedRequest);
  assert.equal(JSON.stringify(item.submittedRequest),before);
  assert.equal(plan.results[0].kind,item.originalRequestedKind);
  assert.equal(plan.results[0].reasonCode,'UNSUPPORTED_QUANTITY');
  assert.equal(plan.results[0].status,'unavailable');
  assert.equal(plan.results[0].value,null);
  assert.equal(plan.native.canRun,false);
  assert.equal(plan.scene,null);
 }
});
test('post-solution manual agreements are distinct from original engine coverage',()=>{
 assert.equal(review.solutionsReadAfterFreeze,true);
 assert.equal(review.reviewSummary.questions,6);
 assert.equal(review.reviewSummary.newInverseDirectlyApplicable,0);
 assert.equal(review.reviewSummary.originalQuantitiesAvailableFromSubmittedRequests,0);
 assert.equal(review.reviewSummary.nativeCallsForOriginalRequests,0);
 const assessments=review.cases.map(x=>x.assessment);
 assert.deepEqual(assessments,['manual-agreement','manual-agreement','manual-agreement','partial-manual-answer',
   'manual-agreement-with-sign-convention','formula-already-in-question']);
 for(const row of review.cases)assert.match(row.solutionSha256,/^[a-f0-9]{64}$/);
});
