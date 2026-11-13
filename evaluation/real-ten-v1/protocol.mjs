// Integrity and accounting for a fixed real-problem development trial.
// No new physical solver and no answer-key import at capture time.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const DIR=fileURLToPath(new URL('./',import.meta.url));
export const FIRST_FREEZE='662e51fef3bee29837f0b4df9f000575da543ee2';
export const FIRST_BLOB='f149779dfc638a99b723dfb8a224d595f6f3afe7';
export const SELECTION_SHA256='4be3b58d62b767bb87cecc33a73b92a89673017ecc2bfefe6c30937b0bddb51e';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export const gitBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
export function loadTrial(){
 const selectionBytes=readFileSync(resolve(DIR,'selection.json')),
   firstBytes=readFileSync(resolve(DIR,'first-attempts.json')),
   reviewBytes=readFileSync(resolve(DIR,'review.json'));
 assert.equal(sha256(selectionBytes),SELECTION_SHA256,'Frozen selection changed');
 assert.equal(gitBlob(firstBytes),FIRST_BLOB,'Frozen first attempts changed');
 const selection=JSON.parse(selectionBytes),first=JSON.parse(firstBytes),review=JSON.parse(reviewBytes);
 assert.equal(first.solutionsOpened,false,'This flag describes the historical capture phase');
 assert.equal(first.selectionSha256,SELECTION_SHA256);
 assert.equal(first.sourceArchiveSha256,selection.archiveSha256);
 assert.equal(review.firstAttemptFreezeCommit,FIRST_FREEZE);
 assert.equal(review.firstAttemptGitBlob,FIRST_BLOB);
 assert.equal(review.selectionSha256,SELECTION_SHA256);
 assert.equal(review.sourceArchiveSha256,selection.archiveSha256);
 assert.equal(review.solutionTransfer.verifiedFirstAttemptFreeze,FIRST_FREEZE);
 assert.equal(review.solutionsOpenedAfterFreeze,true);
 assert.equal(first.independentModel,false);assert.equal(first.externalProviderCalls,0);assert.equal(first.repairs,0);
 assert.equal(selection.cases.length,10);
 const ids=selection.cases.map(x=>x.id);
 assert.equal(new Set(ids).size,10);
 assert.deepEqual(first.cases.map(x=>x.id),ids);assert.deepEqual(review.cases.map(x=>x.id),ids);
 const inventoryBytes=readFileSync(resolve(ROOT,'evaluation/optical-systems-atlas-v1/inventory.json'));
 assert.equal(gitBlob(inventoryBytes),selection.inventoryGitBlob);
 const inventory=JSON.parse(inventoryBytes).inventory;
 const chapters=[...new Set(inventory.map(x=>x.chapter))].sort();
 const paths=chapters.flatMap(ch=>inventory.filter(x=>x.chapter===ch&&x.reviewStatus==='not-reviewed')
   .sort((a,b)=>a.path.localeCompare(b.path)).slice(0,ch.startsWith('01_')||ch.startsWith('07_')?2:1)).map(x=>x.path).sort();
 assert.deepEqual(selection.cases.map(x=>x.problemPath),paths,'Selection is not reproducible');
 for(const c of first.cases){assert.equal(c.attemptNumber,1);assert.match(c.problemSha256,/^[a-f0-9]{64}$/);}
 for(const c of review.cases)assert.match(c.solutionSha256,/^[a-f0-9]{64}$/);
 return {selection,first,review,selectionBytes,firstBytes,reviewBytes};
}
export function summarizeTrial(records,derivedChecks,review){
 const categories={};for(const r of review.cases)categories[r.assessment]=(categories[r.assessment]||0)+1;
 return {originalQuestions:records.length,
   originalResultRequests:records.reduce((n,r)=>n+(r.report.coverage?.requested||0),0),
   originalResultsAvailable:records.reduce((n,r)=>n+(r.report.coverage?.available||0),0),
   originalQuestionsFullyAvailable:records.filter(r=>r.report.coverage?.status==='all-requested-quantities-available').length,
   originalNativeCalls:records.reduce((n,r)=>n+(r.report.dispatch?.nativeCalls||0),0),
   originalNativeCompleted:records.filter(r=>['completed','completed-with-warnings'].includes(r.report.native?.status)).length,
   originalQualifiedPackages:records.filter(r=>r.report.portable?.status==='created').length,
   derivedAnalyticalChecks:derivedChecks.length,
   derivedNativeCalls:derivedChecks.reduce((n,r)=>n+(r.report.dispatch?.nativeCalls||0),0),
   manualSolutionReview:categories,
   independentModelAccuracy:null};
}
