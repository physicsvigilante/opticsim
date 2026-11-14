// Replay frozen original-question requests. No source solution is opened,
// no result kind substituted, and no native scene/brightness fabricated.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
import {readProblemPng} from '../llm-pilot-v1/independent-inference.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const src=resolve(root,'evaluation/reduced-inverse-original-v1');
const output=resolve(root,'test-artifacts/llm-authoring/reduced-inverse-original-v1');
const read=(path)=>readFileSync(resolve(src,path));
const sha=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const selectionBytes=read('selection.json'),attemptBytes=read('first-attempts.json'),reviewBytes=read('review.json');
assert.equal(gitBlob(selectionBytes),'00bc8d83632f023424f72698431ce361bf8fe9d0');
assert.equal(gitBlob(attemptBytes),'b57d10d9688380d92dffc047aea0a47c4d2c493f');
const sel=JSON.parse(selectionBytes),attempt=JSON.parse(attemptBytes),review=JSON.parse(reviewBytes);
assert.equal(attempt.selectionFreezeCommit,'65ae404522f6015c09496c885ae106c4661f33ab');
assert.equal(attempt.solutionsReadBeforeFirstAttempt,false);
assert.equal(review.firstAttemptFreezeCommit,'dd5a095bf3dc9ac8f68cf6bed6aba68cccfa9aec');
assert.equal(review.firstAttemptGitBlob,gitBlob(attemptBytes));
assert.equal(attempt.selectionSha256,sha(selectionBytes));
assert.equal(review.selectionSha256,sha(selectionBytes));
assert.equal(attempt.cases.length,6);
assert.deepEqual(sel.cases.map(x=>x.id),attempt.cases.map(x=>x.id));
assert.deepEqual(sel.cases.map(x=>x.id),review.cases.map(x=>x.id));
assert.equal(attempt.externalModelCalls,0);
assert.equal(review.reviewSummary.newInverseDirectlyApplicable,0);
const archive=readFileSync(resolve(root,sel.archiveFile));
assert.equal(sha(archive),sel.archiveSha256);
mkdirSync(output,{recursive:true});
const report={format:'opticsim-reduced-inverse-original-replay-v1',selectionSha256:sha(selectionBytes),
 frozenFirstAttemptGitBlob:gitBlob(attemptBytes),sourceArchiveSha256:sha(archive),
 firstAttemptFreezeCommit:review.firstAttemptFreezeCommit,
 sameAssistantDevelopment:true,independentAccuracyScore:null,solutionsReadByReplay:false,
 originalRequested:6,originalAvailable:0,nativeCalls:0,automaticRepairs:0,
 derivedManualAgreementCountNotEngineScore:review.reviewSummary.manualAgreements,records:[]};
for(let i=0;i<6;i++){
 const a=attempt.cases[i],s=sel.cases[i],r=review.cases[i];
 assert.equal(a.id,s.id);assert.equal(r.id,s.id);
 assert.equal(a.attemptNumber,1);
 assert.equal(a.newInverseCapability.directlyApplicable,false);
 const image=readProblemPng(archive,s.problemPath);
 assert.equal(sha(image),a.problemSha256);
 const bytes=Buffer.from(JSON.stringify(a.submittedRequest,null,2)+'\n');
 let calls=0;
 const res=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(output,a.id),
  execute:()=>{calls++;throw Error('No native scene may be invented to answer an unregistered original task');}});
 assert.equal(calls,0);assert.equal(res.exitCode,2);
 assert.equal(res.report.inputSha256,sha(bytes));
 assert.deepEqual(readFileSync(resolve(output,a.id,'input.json')),bytes);
 assert.equal(res.report.results.length,1);
 assert.equal(res.report.results[0].status,'unavailable');
 assert.equal(res.report.results[0].reasonCode,'UNSUPPORTED_QUANTITY');
 assert.equal(res.report.results[0].value,null);
 assert.equal(res.report.dispatch.nativeCalls,0);
 assert.equal(res.report.dispatch.repairs,0);
 assert.equal(res.report.dispatch.externalModelCalls,0);
 assert.equal(res.report.portable.status,'not-created');
 assert.equal(res.report.native.status,'not-run');
 report.records.push({id:a.id,originalRequestedKind:a.originalRequestedKind,originalStatus:'unavailable',
  noNewInverseDirectRoute:true,reason:'Submitted original requested kind is unregistered',
  problemSha256:a.problemSha256,sourceSolutionSha256:r.solutionSha256,
  firstManualStatus:a.firstManualAnswer.status,postSolutionAssessment:r.assessment,
  inputSha256:sha(bytes),nativeCalls:0});
}
assert.equal(report.records.length,6);
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Additional six original inverse-scope audit PASS: 6 original requests, 0 available from submitted requests, 0 native calls, 0 model calls.');
