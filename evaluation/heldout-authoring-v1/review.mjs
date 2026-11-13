// Post-first-response held-out review. The capture executable NEVER imports
// this file, its reference, native core, or authoring scorer.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {readJSON,validateQuestions,validateReference,checkCommitment,
 checkedNewOutput,requirePrivateInput,sha256,ROOT} from './manifest.mjs';
import {scoreHeldout} from './scoring.mjs';
import {parseAnswer,authoringMessages} from './capture.mjs';
import {runProblemEvidence} from '../../scripts/run-problem.mjs';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
const require=createRequire(import.meta.url);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function parse(args){
 if(args.length!==10||
    args[0]!=='--questions'||args[2]!=='--reference'||args[4]!=='--commitment'||
    args[6]!=='--capture'||args[8]!=='--out')
  throw Error('Usage: node review.mjs --questions test-artifacts/... --reference test-artifacts/... --commitment test-artifacts/... --capture test-artifacts/.../capture.json --out test-artifacts/llm-evaluation/private-heldout/<fresh>');
 return {questions:args[1],reference:args[3],commitment:args[5],capture:args[7],out:args[9]};
}
export function validateFrozenCapture(capture,questions,commitment,attemptDirectory){
 if(!isObject(capture)||capture.format!=='opticsim-heldout-capture-v1'||
    capture.referenceRead!==false||capture.firstAttemptOnly!==true||capture.repairs!==0||
    capture.questionsSha256!==commitment.questionsSha256||
    capture.referenceSha256!==commitment.referenceSha256||
    !Array.isArray(capture.attempts)||capture.attempts.length<1||
    capture.attempts.length>questions.cases.length||
    capture.attempted!==capture.attempts.length||
    capture.externalCalls!==capture.attempted)
  throw Error('First-attempt capture manifest invalid or tampered');
 for(let i=0;i<capture.attempts.length;i++){
  const a=capture.attempts[i],id=questions.cases[i].id;
  if(!a||a.id!==id||a.attemptNumber!==1||!['request','declined','invalid'].includes(a.kind)||
     typeof a.outputSha256!=='string'||a.outputSha256.length!==64||
     a.outputSha256!==sha256(Buffer.from(typeof a.rawOutput==='string'?a.rawOutput:'')))
   throw Error(id+': captured first-response checksum/metadata mismatch');
  const parsed=parseAnswer(a.rawOutput);
  if(parsed.kind!==a.kind||parsed.code!==a.code||
     (a.kind==='request'&&JSON.stringify(parsed.request)!==JSON.stringify(a.request))||
     (a.kind==='declined'&&parsed.reason!==a.reason))
   throw Error(id+': captured structured result differs from raw first response');
  const expectedPromptHash=sha256(Buffer.from(
    JSON.stringify(authoringMessages(questions.cases[i]))));
  if(a.inputSha256!==expectedPromptHash)
   throw Error(id+': model prompt differs from frozen questions or capabilities');
  const raw=readFileSync(resolve(attemptDirectory,id+'.first.json'));
  if(raw.length>128000)throw Error(id+': first-attempt file too large');
  if(JSON.stringify(JSON.parse(raw.toString('utf8')))!==JSON.stringify(a))
   throw Error(id+': immutable per-case first attempt differs from captured result');
 }
 return true;
}
export async function runReview({questionsPath,referencePath,commitmentPath,capturePath,outPath,
 execute=null}){
 const q=readJSON(requirePrivateInput(questionsPath)),c=readJSON(requirePrivateInput(commitmentPath),20000),
  f=readJSON(requirePrivateInput(capturePath),1024*1024);
 const questions=validateQuestions(q.value);checkCommitment(c.value,q.bytes);
 const capture=f.value;
 if(capture.commitmentSha256!==c.digest)
  throw Error('Capture commitment SHA-256 does not match committed file');
 if(c.value.ids.join('|')!==questions.cases.map(x=>x.id).join('|'))
  throw Error('Committed case list differs from private question set');
 // Verify every first model response BEFORE opening the independently
 // adjudicated reference, even though inference lives in a separate process.
 validateFrozenCapture(capture,questions,c.value,resolve(capturePath,'..'));
 const r=readJSON(requirePrivateInput(referencePath));
 checkCommitment(c.value,q.bytes,r.bytes);
 const reference=validateReference(r.value,questions);
 const runKey=basename(resolve(outPath))+'-'+sha256(Buffer.from(resolve(outPath))).slice(0,12),
  nativeRoot=resolve(ROOT,'test-artifacts/llm-authoring/private-heldout-'+runKey);
 if(existsSync(nativeRoot))throw Error('Existing native scoring evidence; choose a new output directory');
 const out=checkedNewOutput(outPath);
 const core=execute?null:require(resolve(ROOT,'dist/test-core.cjs'));
 const evaluator=execute||((scene)=>evaluateDocument(scene,core));
 const rows=[];
 for(let i=0;i<capture.attempts.length;i++){
  const a=capture.attempts[i],gold=reference.cases[i];
  if(a.kind==='invalid'){
   rows.push({id:a.id,responseKind:'invalid',errorCode:a.code||'INVALID_FIRST_RESPONSE',
    physicalFidelity:false,requestedKindFidelity:false,nativeCalls:0,
    manualExplanationReview:'not-performed',exactAuthoring:false});
   continue;
  }
  if(a.kind==='declined'){
   // Only provisionally acceptable: human adjudication of the reason is pending.
   rows.push({id:a.id,responseKind:'declined',
    provisionalDecline:gold.classification!=='supported',
    declineReason:a.reason,physicalFidelity:false,kindFidelity:false,nativeCalls:0,
    manualExplanationReview:'required',exactAuthoring:false});
   continue;
  }
  const inputBytes=Buffer.from(JSON.stringify(a.request,null,2)+'\n');
  const inputFile=resolve(out,a.id+'.request.json');
  writeFileSync(inputFile,inputBytes,{flag:'wx'});
  const pre=spawnSync(process.execPath,[resolve(ROOT,'scripts/preflight-problem.mjs'),inputFile],
    {cwd:ROOT,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
  if(pre.error)throw pre.error;
  if(![0,1,2].includes(pre.status))throw Error(a.id+': preflight infrastructure failure; not a model score');
  const preflight=JSON.parse(pre.stdout);
  assert.equal(preflight.inputSha256,sha256(inputBytes));
  assert.equal(preflight.native.calls,0);
  writeFileSync(resolve(out,a.id+'.preflight.json'),JSON.stringify(preflight,null,2)+'\n',{flag:'wx'});
  let nativeCalls=0;
  const run=await runProblemEvidence({inputBytes,
    outputPath:resolve(nativeRoot,a.id),
    execute:async scene=>{nativeCalls++;return evaluator(scene);}});
  assert.equal(nativeCalls,run.report.dispatch?.nativeCalls??0,
    a.id+': native attempt count must agree with logged dispatcher');
  assert.equal(run.report.dispatch?.repairs??0,0);
  assert.equal(run.report.dispatch?.externalModelCalls??0,0);
  // A malformed first response is a model-format failure, not a broken
  // evaluator or a reason to re-prompt and silently repair it.
  if(preflight.status==='rejected'||run.report.status==='rejected'){
   rows.push({id:a.id,responseKind:'request',modelInputRejected:true,
    errorCode:'INVALID_MODEL_REQUEST',physicalFidelity:false,kindFidelity:false,
    preflightCorrect:false,nativeCalls:0,nativeComplete:false,exactAuthoring:false,
    errors:preflight.issues||run.report.issues||[],
    manualExplanationReview:'required'});
   continue;
  }
  const score=scoreHeldout(gold,{response:a.request},preflight,run);
  rows.push({...score,responseKind:'request',sourceResponseSha256:a.outputSha256,
   preflightStatus:preflight.status,nativeCalls,originalInterpretation:'requires-independent-review'});
 }
 const selected=rows.length,supported=rows.filter((_,i)=>reference.cases[i].classification==='supported'),
  negatives=rows.filter((_,i)=>reference.cases[i].classification!=='supported');
 const counts={
  selected,supported:supported.length,negatives:negatives.length,
  responseRequests:rows.filter(x=>x.responseKind==='request').length,
  responseDeclines:rows.filter(x=>x.responseKind==='declined').length,
  responseInvalid:rows.filter(x=>x.responseKind==='invalid').length,
  physicalMatches:rows.filter(x=>x.physicalFidelity).length,
  kindMatches:rows.filter(x=>x.kindFidelity).length,
  nativeAttempted:rows.filter(x=>x.nativeCalls===1).length,
  nativeComplete:supported.filter(x=>x.nativeComplete).length,
  supportedQualified:supported.filter(x=>x.exactAuthoring).length,
  // Unreviewed declines are NOT automatically verified negative handling.
  safeNegativeHandling:negatives.filter(x=>x.negativeDiscipline).length,
  negativeDeclinesAwaitingReview:negatives.filter(x=>x.provisionalDecline).length,
  adjudicatedTargetCases:supported.filter(x=>x.adjudicatedTargets>0).length,
  matchedTargetCases:supported.filter(x=>x.targetFidelity===true).length,
  statedIdCases:supported.filter(x=>x.requiredStatedIds>0).length,
  matchedStatedIdCases:supported.filter(x=>x.statedIdsFaithful===true).length,
  manualExplanationsReviewed:0,
  providerCallsRecorded:capture.externalCalls,repairAttempts:0
 };
 const report={format:'opticsim-heldout-review-v1',questionsSha256:q.digest,referenceSha256:r.digest,
  commitmentSha256:c.digest,captureSha256:f.digest,modelRequested:capture.modelRequested,
  caseIds:capture.attempts.map(x=>x.id),independentReferenceReviewersDeclared:reference.reviewers.length,
  independentlyVerifiedReviewers:false,counts,rows,
  validity:'First-attempt external-model trial against a PRIVATE, precommitted, separately authored reference. Independence of reference reviewers and subjective explanations still requires human verification.',
  limitations:['Reference SHA proves byte identity, not independent adjudication.',
   'Unreviewed model declines are held for manual explanation review and earn no automatic safe-handling credit.',
   'Native completion cannot certify semantic fidelity to the original question.',
   'Full-scene physical-fact and request-kind comparisons are separate from native coverage.',
   'No retry/repair. Decline reasons require human review. Invalid JSON is not repaired.',
   'No private source question or reference is copied into this public repository.']};
 writeFileSync(resolve(out,'review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const kv=parse(process.argv.slice(2));
  runReview({questionsPath:kv.questions,referencePath:kv.reference,
   commitmentPath:kv.commitment,capturePath:kv.capture,outPath:kv.out}).then(x=>
   console.log(JSON.stringify({status:'review-complete',counts:x.counts,out:kv.out},null,2))
  ).catch(e=>{console.error('Held-out review failed: '+e.message);process.exitCode=1;});
 }catch(e){console.error('Held-out review rejected: '+e.message);process.exitCode=1;}
}
