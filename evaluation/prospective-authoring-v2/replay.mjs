// Replay the committed, unchanged first-attempt records. First seal bytes
// are persisted BEFORE invoking any deterministic dispatcher. No model API or Solutions.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readProblemPng} from '../llm-pilot-v1/independent-inference.mjs';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=resolve(root,'evaluation/prospective-authoring-v2');
const read=name=>readFileSync(resolve(dir,name));
const sha=x=>createHash('sha256').update(x).digest('hex');
const selectionBytes=read('selection.json'),attemptBytes=read('first-attempt.json'),manifestBytes=read('image-manifest.json');
const selection=JSON.parse(selectionBytes),first=JSON.parse(attemptBytes),manifest=JSON.parse(manifestBytes);
assert.equal(first.format,'opticsim-prospective-first-attempt-v2');
assert.equal(first.selectionSha256,sha(selectionBytes));
assert.equal(manifest.selectionSha256,sha(selectionBytes));
assert.equal(first.frozenEngineCommit,selection.frozenEngineCommit);
assert.equal(first.solutionsRead,false);assert.equal(first.referenceAnswersRead,false);
assert.equal(first.externalModelCalls,0);assert.equal(first.automaticRepairs,0);
assert.equal(first.independentEvaluator,false);assert.equal(first.allFirstAttemptsSealedBeforeExecution,true);
assert.deepEqual(first.cases.map(c=>c.id),selection.cases.map(c=>c.id));
assert.deepEqual(manifest.records.map(c=>c.id),selection.cases.map(c=>c.id));
const zip=readFileSync(resolve(root,'08_Ray_Optics_Explanations.zip'));
assert.equal(sha(zip),selection.archiveSha256);
const out=resolve(root,'test-artifacts/llm-authoring/prospective-v2');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'pre-execution-seal.json'),JSON.stringify({
 format:'opticsim-prospective-pre-execution-seal-v2',
 frozenEngineCommit:first.frozenEngineCommit,runnerCommit:process.env.GITHUB_SHA||'unknown-local',
 selectionBytesSha256:sha(selectionBytes),firstAttemptBytesSha256:sha(attemptBytes),
 imageManifestBytesSha256:sha(manifestBytes),externalModelCalls:0,solutionImagesRead:false
},null,2)+'\n',{flag:'wx'});
const results=[];let nativeCalls=0;
for(let i=0;i<first.cases.length;i++){
 const item=first.cases[i],sel=selection.cases[i],image=manifest.records[i];
 assert.equal(item.id,sel.id);assert.equal(item.solutionsRead,false);
 const source=item.request.interpretation.source;
 assert.equal(source.path,sel.problemPath);assert.equal(source.sha256,image.pngSha256);
 assert.equal(image.problemPath,sel.problemPath);
 assert.ok(source.path.includes('/Problems/')&&!source.path.includes('/Solutions/'));
 assert.equal(sha(readProblemPng(zip,source.path)),source.sha256);
 assert.equal(item.request.physical,null);assert.equal(item.request.illustration,false);
 assert.equal(item.request.verifyNative,false);
 const bytes=Buffer.from(JSON.stringify(item.request,null,2)+'\n');
 const output=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(out,item.id),
  execute:()=>{nativeCalls++;throw Error('Unexpected native work without an authored native scene');}});
 assert.equal(output.report.dispatch.repairs,0);
 assert.equal(output.report.dispatch.nativeCalls,0);
 assert.equal(output.report.dispatch.externalModelCalls,0);
 assert.equal(output.report.native.status,'not-run');
 assert.equal(output.report.portable.status,'not-created');
 assert.ok(output.report.results.every(x=>x.status==='unavailable'&&x.reasonCode==='UNSUPPORTED_QUANTITY'));
 results.push({id:item.id,originalQuestionSolved:false,kind:item.request.requests.map(x=>x.kind),
  inputSha256:sha(bytes),statuses:output.report.results.map(x=>x.status),
  reasonCodes:output.report.results.map(x=>x.reasonCode),
  nativeStatus:output.report.native.status,firstScopeAssessment:item.firstScopeAssessment});
}
assert.equal(nativeCalls,0);
const review={format:'opticsim-prospective-review-v2',
 originalProblemCount:results.length,originalFullQuestionSolvedCount:0,
 analyticalRequestCount:results.reduce((n,x)=>n+x.kind.length,0),
 independentlyAdjudicated:false,independentModelScore:null,
 rationale:'All eight sealed first attempts use original requested operations that are not registered on this frozen engine. That does not establish the underlying textbook problems are unsolvable or that any solution has been independently checked.',
 firstAttemptBytesSha256:sha(attemptBytes),selectionSha256:sha(selectionBytes),
 solutionsRead:false,referenceAnswersRead:false,externalModelCalls:0,repairs:0,nativeCalls,
 syntheticRegressionControlsNotCountedAsOriginalSolves:true,records:results};
writeFileSync(resolve(out,'review.json'),JSON.stringify(review,null,2)+'\n',{flag:'wx'});
console.log('Prospective first-attempt replay completed: '+results.length+' questions, 0 original results supported; 0 native/model calls or repairs. This is not independent accuracy.');
