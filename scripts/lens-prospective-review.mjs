// Replays *committed* first attempts from selected original Problems images.
// Does not read Solutions, repair interpretations, supply an external model,
// or count synthetic lens scene as an original-question solution.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalJSON} from '../src/qualified-utils.js';
import {sha256,readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
import {runProblemEvidence} from './run-problem.mjs';
const selectionBytes=readFileSync('evaluation/lens-motion-prospective-v1/selection.json');
const firstBytes=readFileSync('evaluation/lens-motion-prospective-v1/first-attempt.json');
const selection=JSON.parse(selectionBytes),first=JSON.parse(firstBytes);
assert.equal(selection.format,'opticsim-lens-motion-prospective-selection-v1');
assert.equal(first.format,'opticsim-lens-motion-first-attempt-v1');
assert.equal(first.selectionSha256,sha256(selectionBytes));
assert.equal(first.allFirstAttemptsSealedBeforeExecution,true);
assert.equal(first.solutionsRead,undefined);
assert.equal(first.answersOrSolutionsUsed,false);
assert.equal(first.externalModelCalls,0);
assert.deepEqual(first.cases.map(c=>c.id),selection.cases.map(c=>c.id));
const archive=readFileSync(selection.archiveName);
assert.equal(sha256(archive),selection.archiveSha256);
const path=resolve('test-artifacts/llm-authoring/lens-prospective');mkdirSync(path,{recursive:true});
const cases=[];let nativeCalls=0;
for(let i=0;i<first.cases.length;i++){
 const original=first.cases[i],choice=selection.cases[i];
 assert.equal(original.id,choice.id);
 assert.equal(original.solutionsRead,false);
 assert.equal(original.request.physical,null);
 assert.equal(original.request.illustration,false);
 assert.equal(original.request.verifyNative,false);
 const source=original.request.interpretation.source;
 assert.equal(source.path,choice.problemPath);
 assert.equal(source.caseId,original.id);
 assert.ok(source.path.includes('/Problems/')&&!source.path.includes('/Solutions/'));
 const png=readProblemPng(archive,source.path);
 assert.equal(sha256(png),source.sha256);
 const bytes=Buffer.from(JSON.stringify(original.request,null,2)+'\n');
 writeFileSync(resolve(path,original.id+'.input.json'),bytes,{flag:'wx'});
 const exec=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(path,original.id),
  execute:()=>{nativeCalls++;throw Error('No native scene was authored for this original problem');}});
 assert.equal(exec.exitCode,2);
 assert.equal(exec.report.native.status,'not-run');
 assert.equal(exec.report.dispatch.nativeCalls,0);
 assert.equal(exec.report.dispatch.externalModelCalls,0);
 assert.equal(exec.report.dispatch.repairs,0);
 assert.equal(exec.report.portable.status,'not-created');
 assert.equal(exec.report.results.length,1);
 assert.equal(exec.report.results[0].status,'unavailable');
 assert.equal(exec.report.results[0].reasonCode,'UNSUPPORTED_QUANTITY');
 assert.equal(exec.report.questionSupport,'not-assessed-by-engine');
 cases.push({id:original.id,sourcePath:source.path,imageSha256:source.sha256,
  interpretationSummary:original.firstScopeAssessment,
  requestedKind:original.request.requests[0].kind,inputSha256:sha256(bytes),
  resultStatus:exec.report.results[0].status,reasonCode:exec.report.results[0].reasonCode,
  nativeStatus:exec.report.native.status,originalQuestionSolved:false});
}
assert.equal(nativeCalls,0);
const review={format:'opticsim-lens-prospective-review-v1',
 selectionSha256:sha256(selectionBytes),
 firstAttemptBytesSha256:sha256(firstBytes),
 firstAttemptCanonicalSha256:createHash('sha256').update(canonicalJSON(first)).digest('hex'),
 firstInterpretationsSealedBeforeExecution:true,
 originalProblemCount:3,originalFullQuestionSolvedCount:0,independentAccuracyScore:null,
 rationale:'Selected end-of-section questions probe prism branching, spherical dielectric apparent depth and lensmaker index inversion; no such operation is yet registered. This is a same-assistant prospective development test, not an independent blind LLM evaluation.',
 syntheticLensSuccessExcluded:true,solutionsRead:false,externalModelCalls:0,
 automaticRepairs:0,nativeCalls,records:cases};
writeFileSync(resolve(path,'review.json'),JSON.stringify(review,null,2)+'\n',{flag:'wx'});
console.log('Prospective original-problem review PASS: 3/3 sealed first inputs replayed without repair, 0/3 original questions supported, no Solutions/native/model call.');
