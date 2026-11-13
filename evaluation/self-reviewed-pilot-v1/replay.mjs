// Post-freeze same-assistant development replay. NOT independent inference.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {reserveAuthoringOutput} from '../../scripts/authoring-evidence.mjs';
import {scoreHeldout} from '../heldout-authoring-v1/scoring.mjs';
import {componentParameterNames} from '../../src/contract.js';
import {parseQualifiedBundle} from '../../src/qualification.js';
import {saveRawResponse,assessNativeCounts,supportedOutcome} from './evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=resolve(root,'evaluation/self-reviewed-pilot-v1');
const out=resolve(root,'test-artifacts/llm-authoring/self-reviewed-pilot-v1');
const text=path=>readFileSync(resolve(dir,path));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
const PINNED={questions:'b191ad0241759b6e1fc9c263d6c4c7a7dc6be9ed',attempts:'5f2ca869351321a1fe585d3b91dc096d0734163e'};
const questionBytes=text('questions.json'),attemptBytes=text('first-attempts.json'),referenceBytes=text('reference.json');
assert.equal(gitBlob(questionBytes),PINNED.questions);
assert.equal(gitBlob(attemptBytes),PINNED.attempts);
const questions=JSON.parse(questionBytes),first=JSON.parse(attemptBytes),reference=JSON.parse(referenceBytes);
assert.equal(reference.firstAttemptFreezeCommit,'4ee53964751721bf4307ebef1c7de23a9c642486');
assert.equal(first.independentModel,false);assert.equal(first.externalProviderCalls,0);assert.equal(first.automatedRepairs,0);
assert.equal(reference.independentlyReviewed,false);assert.equal(reference.numberOfIndependentReviewers,0);
assert.equal(questions.questions.length,3);assert.equal(first.attempts.length,3);assert.equal(reference.cases.length,3);
// Reserve before writing anything: prior output and symlink ancestors fail closed.
reserveAuthoringOutput(out,root);
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
const report={format:'opticsim-same-assistant-development-pilot-v1',
 origin:'Same-chat synthetic fixture replay; not unseen, held out, or independently evaluated',
 independentModelEvaluation:false,independentReview:false,
 firstAttemptFreezeCommit:reference.firstAttemptFreezeCommit,
 frozenQuestionGitBlob:PINNED.questions,frozenResponseGitBlob:PINNED.attempts,
 questionsSha256:sha256(questionBytes),firstAttemptsSha256:sha256(attemptBytes),referenceSha256:sha256(referenceBytes),
 externalModelCalls:0,automatedRepairs:0,sourceQuestions:3,cases:[],
 counts:{supported:2,negative:1,nativeCalls:0,nativeCompleted:0,exactSameAssistantAuthoring:0,
   expectedCountMismatches:0,provisionalDeclines:0,verifiedIndependentDeclines:0}};
for(let i=0;i<first.attempts.length;i++){
 const attempt=first.attempts[i],q=questions.questions[i],gold=reference.cases[i];
 assert.equal(attempt.id,q.id);assert.equal(gold.id,q.id);assert.equal(attempt.attemptNumber,1);
 const raw=attempt.rawOutput;
 const rawHash=saveRawResponse(resolve(out,attempt.id+'.raw-first-attempt.txt'),raw);
 assert.equal(rawHash,sha256(readFileSync(resolve(out,attempt.id+'.raw-first-attempt.txt'))));
 const parsed=JSON.parse(raw),row={id:q.id,sourcePromptSha256:sha256(Buffer.from(q.prompt)),
   rawFirstResponseSha256:rawHash,firstAttemptKind:attempt.kind,independentAccuracy:null,manualReviewers:0};
 if(attempt.kind==='declined'){
  assert.equal(typeof parsed.cannotAuthor,'string');assert.deepEqual(Object.keys(parsed),['cannotAuthor']);
  assert.equal(gold.classification,'missing');assert.ok(componentParameterNames('circle-blocker').includes('radius'));
  assert.equal(gold.missingField,'B1.parameters.radius');
  Object.assign(row,{outcome:'provisional-self-reviewed-refusal',reason:parsed.cannotAuthor,nativeCalls:0,explanationIndependentlyAdjudicated:false});
  report.counts.provisionalDeclines++;report.cases.push(row);continue;
 }
 assert.equal(attempt.kind,'request');assert.deepEqual(Object.keys(parsed),['request']);
 const inputBytes=Buffer.from(JSON.stringify(parsed.request,null,2)+'\n'),inputFile=resolve(out,q.id+'.request.json');
 writeFileSync(inputFile,inputBytes,{flag:'wx'});
 const pre=spawnSync(process.execPath,[resolve(root,'scripts/preflight-problem.mjs'),inputFile],{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
 if(pre.error)throw pre.error;
 if(![0,1,2].includes(pre.status))throw Error(q.id+': preflight infrastructure failed');
 const preflight=JSON.parse(pre.stdout);
 assert.equal(preflight.inputSha256,sha256(inputBytes));assert.equal(preflight.native.calls,0);
 writeFileSync(resolve(out,q.id+'.preflight.json'),JSON.stringify(preflight,null,2)+'\n',{flag:'wx'});
 let calls=0;
 const actual=await runProblemEvidence({inputBytes,outputPath:resolve(out,q.id),execute:scene=>{calls++;return evaluateDocument(scene,core);}});
 assert.equal(calls,actual.report.dispatch.nativeCalls);assert.equal(actual.report.dispatch.externalModelCalls,0);assert.equal(actual.report.dispatch.repairs,0);
 report.counts.nativeCalls+=calls;
 const score=scoreHeldout(gold,{response:parsed.request},preflight,actual);
 const counts=assessNativeCounts(gold.expectedNative,actual.report,parsed.request.requests);
 const supported=supportedOutcome(score,counts);
 Object.assign(row,{outcome:supported?'self-reviewed-supported':'self-reviewed-mismatch',nativeCalls:calls,
   preflight:preflight.status,native:actual.report.native,scoring:score,outputExitCode:actual.exitCode,
   results:actual.report.results,qualifiedPackage:actual.report.portable.status,
   nativeSampledCounts:counts.observations,expectedNativeCounts:gold.expectedNative||null,
   nativeCountComparisons:counts.comparisons,expectedCountMatch:counts.expectedCountMatch});
 if(score.nativeComplete)report.counts.nativeCompleted++;
 if(supported)report.counts.exactSameAssistantAuthoring++;
 if(counts.expectedCountMatch===false)report.counts.expectedCountMismatches++;
 if(actual.report.portable.status==='created'){
  const bundle=await parseQualifiedBundle(readFileSync(resolve(out,q.id,'qualified-scene.json'),'utf8'));
  assert.deepEqual(bundle.qualification.interpretation,parsed.request.interpretation);
 }
 report.cases.push(row);
}
assert.equal(report.cases.length,3);assert.equal(report.counts.nativeCalls,2);assert.equal(report.counts.provisionalDeclines,1);
report.evidenceStatus='completed';
report.evaluationStatus=report.cases.some(x=>x.outcome==='self-reviewed-mismatch')?'completed-with-mismatches':'supported-cases-matched-refusal-provisional';
report.note='Same-assistant synthetic controls only. Native execution is real; neither CI completion nor these self-reviewed matches measure unseen-question accuracy.';
writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Self-reviewed pilot complete: '+JSON.stringify({attempts:3,modelIndependent:false,
 supportedSelfReviewed:report.counts.exactSameAssistantAuthoring,nativeCompleted:report.counts.nativeCompleted,
 expectedCountMismatches:report.counts.expectedCountMismatches,provisionalDeclines:report.counts.provisionalDeclines,
 evaluationStatus:report.evaluationStatus,externalModelCalls:0}));
