// Post-freeze same-assistant development pilot. NOT independent inference.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {scoreHeldout} from '../heldout-authoring-v1/scoring.mjs';
import {componentParameterNames} from '../../src/contract.js';
import {parseQualifiedBundle} from '../../src/qualification.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=resolve(root,'evaluation/self-reviewed-pilot-v1');
const out=resolve(root,'test-artifacts/llm-authoring/self-reviewed-pilot-v1');
const text=path=>readFileSync(resolve(dir,path));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>createHash('sha1').update(Buffer.concat([
 Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
// Pin the unedited first-attempt payloads to the *earlier* Git commit, never
// derive an answer/reference from current results in this replay.
const PINNED={
 questions:'b191ad0241759b6e1fc9c263d6c4c7a7dc6be9ed',
 attempts:'5f2ca869351321a1fe585d3b91dc096d0734163e'
};
const questionBytes=text('questions.json'),attemptBytes=text('first-attempts.json');
assert.equal(gitBlob(questionBytes),PINNED.questions);
assert.equal(gitBlob(attemptBytes),PINNED.attempts);
const questions=JSON.parse(questionBytes),first=JSON.parse(attemptBytes),reference=JSON.parse(text('reference.json'));
assert.equal(reference.firstAttemptFreezeCommit,'4ee53964751721bf4307ebef1c7de23a9c642486');
assert.equal(first.independentModel,false);
assert.equal(first.externalProviderCalls,0);
assert.equal(first.automatedRepairs,0);
assert.equal(reference.independentlyReviewed,false);
assert.equal(reference.numberOfIndependentReviewers,0);
assert.equal(questions.questions.length,3);
assert.equal(first.attempts.length,3);
assert.equal(reference.cases.length,3);
mkdirSync(out,{recursive:true});
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
const report={
 format:'opticsim-same-assistant-development-pilot-v1',
 origin:'GPT-6 same chat wrote prompts and first attempts before self-review; not held out or independently evaluated',
 independentModelEvaluation:false,independentReview:false,
 firstAttemptFreezeCommit:reference.firstAttemptFreezeCommit,
 frozenQuestionGitBlob:PINNED.questions,frozenResponseGitBlob:PINNED.attempts,
 questionsSha256:sha256(questionBytes),firstAttemptsSha256:sha256(attemptBytes),
 externalModelCalls:0,automatedRepairs:0,sourceQuestions:3,cases:[],
 counts:{supported:2,negative:1,nativeCalls:0,nativeCompleted:0,
  exactSameAssistantAuthoring:0,provisionalDeclines:0,verifiedIndependentDeclines:0}
};
for(let i=0;i<first.attempts.length;i++){
 const attempt=first.attempts[i],q=questions.questions[i],gold=reference.cases[i];
 assert.equal(attempt.id,q.id);assert.equal(gold.id,q.id);
 assert.equal(attempt.attemptNumber,1);
 const raw=attempt.rawOutput;
 assert.equal(typeof raw,'string');
 writeFileSync(resolve(out,attempt.id+'.raw-first-attempt.txt'),raw+'\n',{flag:'wx'});
 const parsed=JSON.parse(raw),caseRow={
  id:q.id,sourcePromptSha256:sha256(Buffer.from(q.prompt)),
  rawFirstResponseSha256:sha256(Buffer.from(raw)),firstAttemptKind:attempt.kind,
  independentAccuracy:null,manualReviewers:0
 };
 if(attempt.kind==='declined'){
  assert.equal(typeof parsed.cannotAuthor,'string');
  assert.equal(Object.keys(parsed).length,1);
  assert.equal(gold.classification,'missing');
  assert.ok(componentParameterNames('circle-blocker').includes('radius'));
  assert.equal(gold.missingField,'B1.parameters.radius');
  caseRow.outcome='provisional-self-reviewed-refusal';
  caseRow.reason=parsed.cannotAuthor;
  caseRow.nativeCalls=0;
  caseRow.explanationIndependentlyAdjudicated=false;
  report.counts.provisionalDeclines++;
  report.cases.push(caseRow);
  continue;
 }
 assert.equal(attempt.kind,'request');
 assert.deepEqual(Object.keys(parsed),['request']);
 const inputBytes=Buffer.from(JSON.stringify(parsed.request,null,2)+'\n');
 const inputFile=resolve(out,attempt.id+'.request.json');
 writeFileSync(inputFile,inputBytes,{flag:'wx'});
 const pre=spawnSync(process.execPath,[resolve(root,'scripts/preflight-problem.mjs'),inputFile],{
  cwd:root,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024
 });
 if(pre.error)throw pre.error;
 if(![0,1,2].includes(pre.status))throw Error(q.id+': preflight infrastructure failed');
 const preflight=JSON.parse(pre.stdout);
 assert.equal(preflight.inputSha256,sha256(inputBytes));
 assert.equal(preflight.native.calls,0);
 writeFileSync(resolve(out,q.id+'.preflight.json'),JSON.stringify(preflight,null,2)+'\n',{flag:'wx'});
 let calls=0;
 const actual=await runProblemEvidence({inputBytes,
  outputPath:resolve(out,q.id),
  execute:scene=>{calls++;return evaluateDocument(scene,core);}
 });
 assert.equal(calls,actual.report.dispatch.nativeCalls);
 assert.equal(actual.report.dispatch.externalModelCalls,0);
 assert.equal(actual.report.dispatch.repairs,0);
 report.counts.nativeCalls+=calls;
 const score=scoreHeldout(gold,{response:parsed.request},preflight,actual);
 caseRow.outcome=score.exactAuthoring?'self-reviewed-supported':'self-reviewed-mismatch';
 caseRow.nativeCalls=calls;
 caseRow.preflight=preflight.status;
 caseRow.native=actual.report.native;
 caseRow.scoring=score;
 caseRow.outputExitCode=actual.exitCode;
 caseRow.results=actual.report.results;
 caseRow.qualifiedPackage=actual.report.portable.status;
 if(score.nativeComplete)report.counts.nativeCompleted++;
 if(score.exactAuthoring)report.counts.exactSameAssistantAuthoring++;
 if(actual.report.portable.status==='created'){
  const qbundle=await parseQualifiedBundle(readFileSync(resolve(out,q.id,'qualified-scene.json'),'utf8'));
  assert.deepEqual(qbundle.qualification.interpretation,parsed.request.interpretation);
 }
 // The expected count is compared with actual native result, not synthesized.
 const sample=Object.fromEntries(actual.report.results.map(x=>[x.kind,x.value]));
 caseRow.nativeSampledCounts=sample;
 caseRow.expectedNativeCounts=gold.expectedNative||null;
 caseRow.expectedCountMatch=Object.entries(gold.expectedNative||{}).every(([key,value])=>
  key==='emitted'?actual.report.native.emitted===value:
  sample[key==='absorptions'?'blocker-absorptions':'detector-crossings']===value);
 report.cases.push(caseRow);
}
assert.equal(report.cases.length,3);
assert.equal(report.counts.nativeCalls,2);
assert.equal(report.counts.provisionalDeclines,1);
report.note='Development evidence only. Same assistant authored prompts and reference; two supported simulations were independently executed by the deterministic pinned PhyDemo core, but original-problem/model accuracy is unmeasured.';
writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Self-reviewed pilot complete: '+JSON.stringify({
 attempts:report.cases.length,modelIndependent:false,
 supportedSelfReviewed:report.counts.exactSameAssistantAuthoring,
 nativeCompleted:report.counts.nativeCompleted,
 provisionalDeclines:report.counts.provisionalDeclines,
 externalModelCalls:report.externalModelCalls}));
