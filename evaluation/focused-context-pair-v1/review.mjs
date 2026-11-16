// Offline post-capture paired review. Verify exact raw first-response identities
// BEFORE opening adjudicated reference. No model/provider calls, no new physics.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {evaluateObservables} from '../../src/observables.js';
import {canonicalJSON} from '../../src/qualified-utils.js';
import {readJSON,checkCommitment,checkedNewOutput,requirePrivateInput,sha256,ROOT}
 from '../heldout-authoring-v1/manifest.mjs';
import {validateExplorationQuestions,validateExplorationReference}
 from '../heldout-exploration-v1/manifest.mjs';
import {applyExplorationProposal} from '../heldout-exploration-v1/review.mjs';
import {scoreExplorationRevision,scoreExplorationDecline} from '../heldout-exploration-v1/scoring.mjs';
import {parseExplorationAnswer} from '../heldout-exploration-v1/capture.mjs';
import {PAIR_FORMAT,PAIR_PROFILES,pairOrder,pairMessages} from './capture.mjs';
const require=createRequire(import.meta.url);
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const allowedStatus=new Set(['completed','completed-with-warnings']);
export async function verifyPairCapture(capture,questions,commitment,dir){
 if(!record(capture)||capture.format!==PAIR_FORMAT||capture.referenceRead!==false||
    capture.firstAttemptOnly!==true||capture.repairs!==0||
    capture.questionsSha256!==commitment.questionsSha256||
    capture.referenceSha256!==commitment.referenceSha256||
    !Number.isInteger(capture.pairedCases)||capture.pairedCases<2||
    capture.pairedCases>questions.cases.length||capture.pairedCases%2!==0||
    capture.sourceQuestionCount!==questions.cases.length||
    !Array.isArray(capture.attempts)||capture.attempts.length!==2*capture.pairedCases||
    capture.attempted!==capture.attempts.length||
    capture.externalCalls!==capture.attempts.length||
    capture.comparisonStatus!=='unscored')
   throw Error('Unmodified paired capture manifest missing or inconsistent');
 const schedules=questions.cases.slice(0,capture.pairedCases).map((q,i)=>({id:q.id,order:pairOrder(i)}));
 if(!same(schedules,capture.schedule))throw Error('Balanced original case order was changed');
 const models=new Set();
 for(const [i,a] of capture.attempts.entries()){
  const index=Math.floor(i/2),q=questions.cases[index],profile=pairOrder(index)[i%2];
  if(!a||a.id!==q.id||a.profile!==profile||a.position!==(i%2)+1||
     a.attemptNumber!==1||!['proposal','declined','invalid'].includes(a.kind))
   throw Error('Original paired slot, identity or first-attempt status changed');
  const messages=await pairMessages(q,profile);
  if(sha256(Buffer.from(JSON.stringify(messages)))!==a.inputSha256||
     Buffer.byteLength(JSON.stringify(messages))!==a.inputBytes)
   throw Error(q.id+'/'+profile+': exact model prompt bytes changed');
  const raw=typeof a.rawOutput==='string'?a.rawOutput:'';
  if(a.outputSha256!==sha256(Buffer.from(raw)))
   throw Error(q.id+'/'+profile+': raw first response hash mismatch');
  const parsed=parseExplorationAnswer(a.rawOutput);
  if(parsed.kind!==a.kind||parsed.code!==a.code||
     (parsed.kind==='proposal'&&!same(a.proposal,parsed.proposal))||
     (parsed.kind==='declined'&&a.reason!==parsed.reason))
   throw Error(q.id+'/'+profile+': structured copy differs from original raw text');
  const original=readFileSync(resolve(dir,q.id+'.'+profile+'.first.json'));
  if(original.length>128000||!same(JSON.parse(original.toString('utf8')),a))
   throw Error(q.id+'/'+profile+': original per-arm first response was replaced');
  models.add(a.model??null);
 }
 if(models.size!==1)throw Error('Mixed model identities across paired arms; cannot claim same-model comparison');
 return true;
}
const statusRecord=a=>({id:a.id,profile:a.profile,position:a.position,firstAttemptSha256:a.outputSha256,
 kind:a.kind,model:a.model,usage:a.usage??null});
function countByArm(rows,profile,reference){
 const r=rows.filter(x=>x.profile===profile);
 const supported=r.filter(x=>reference.cases.find(z=>z.id===x.id)?.classification==='supported');
 const negative=r.filter(x=>reference.cases.find(z=>z.id===x.id)?.classification!=='supported');
 return {firstAttempts:r.length,
  validResponseEnvelopes:r.filter(x=>x.kind!=='invalid').length,
  malformed:r.filter(x=>x.kind==='invalid').length,
  proposed:r.filter(x=>x.kind==='proposal').length,
  declined:r.filter(x=>x.kind==='declined').length,
  supported:supported.length,negative:negative.length,
  exactRequestedChanges:supported.filter(x=>x.exactRequestedChange===true).length,
  nativeCompletedSupported:supported.filter(x=>x.nativeCompleted===true).length,
  supportedQualified:supported.filter(x=>x.supportedQualified===true).length,
  engineRejected:r.filter(x=>x.engineRejected===true).length,
  provisionalNegativeDeclines:negative.filter(x=>x.provisionalDecline===true).length,
  automaticNegativeApprovals:0,
  inputBytes:r.reduce((n,x)=>n+x.inputBytes,0),
  observedPromptTokens:r.every(x=>Number.isFinite(x.usage?.prompt_tokens))?
   r.reduce((n,x)=>n+x.usage.prompt_tokens,0):null,
  observedCompletionTokens:r.every(x=>Number.isFinite(x.usage?.completion_tokens))?
   r.reduce((n,x)=>n+x.usage.completion_tokens,0):null
 };
}
export async function reviewPair({questionsPath,referencePath,commitmentPath,capturePath,outPath,execute=null}){
 const q=readJSON(requirePrivateInput(questionsPath)),c=readJSON(requirePrivateInput(commitmentPath),20000),
  f=readJSON(requirePrivateInput(capturePath),1024*1024);
 const questions=await validateExplorationQuestions(q.value),commit=checkCommitment(c.value,q.bytes);
 if(commit.ids.join('|')!==questions.cases.map(x=>x.id).join('|')||
   f.value.commitmentSha256!==c.digest)
  throw Error('Original first-response capture does not belong to the frozen eligible manifest');
 // IMPORTANT: no adjudicated answer/reference bytes have been opened yet.
 await verifyPairCapture(f.value,questions,commit,dirname(resolve(capturePath)));
 const adjudicated=readJSON(requirePrivateInput(referencePath));
 checkCommitment(commit,q.bytes,adjudicated.bytes);
 const reference=validateExplorationReference(adjudicated.value,questions);
 if(reference.cases.some(x=>x.classification==='supported'&&
   !['revise','observe'].includes(x.expectedAction)))
  throw Error('Structural reference cannot be used for focused/full paired fidelity comparison');
 const out=checkedNewOutput(outPath),write=(name,value)=>writeFileSync(resolve(out,name),
   JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const core=execute?null:require(resolve(ROOT,'dist/test-core.cjs'));
 const run=execute||((doc)=>evaluateDocument(doc,core));
 const rows=[];
 for(const a of f.value.attempts){
  const index=questions.cases.findIndex(x=>x.id===a.id),qrow=questions.cases[index],
   rowReference=reference.cases[index],base=statusRecord(a);
  let row;
  if(a.kind==='invalid'){
   row={...base,errorCode:a.code,exactRequestedChange:false,
    nativeCompleted:false,manualExplanationReview:'not-performed',nativeCalls:0};
  }else if(a.kind==='declined'){
   row={...base,...scoreExplorationDecline(rowReference,a.reason),nativeCalls:0};
  }else{
   try{
    const prepared=await applyExplorationProposal(qrow.baseline,a.proposal);
    const execution=await run(structuredClone(prepared.document));
    if(!execution?.summary?.native)throw Error('Native infrastructure did not return a recorded status');
    const results=await evaluateObservables(prepared.document,prepared.child.observables,execution.summary);
    const sc=rowReference.classification==='supported'?
      scoreExplorationRevision({reference:rowReference,baseline:qrow.baseline,
       proposal:a.proposal,child:prepared.child,addedObservables:prepared.addedObservables,
       execution,requestedResults:results}):
      {responseKind:'proposal',negativeSubmission:true,exactRequestedChange:false,
       automaticallyVerifiedNegative:false,manualExplanationReview:'required',
       nativeCompleted:execution.summary.executionPassed===true&&
        allowedStatus.has(execution.summary.native.status),
       note:'A submitted model on a negative reference is not an approved refusal.'};
    row={...base,...sc,nativeCalls:1,nativeStatus:execution.summary.native.status};
    write(a.id+'.'+a.profile+'.native.json',execution.summary);
    write(a.id+'.'+a.profile+'.requested-results.json',results);
    write(a.id+'.'+a.profile+'.qualified-scene.json',prepared.child);
   }catch(e){
    // Existing model validator rejection is not a native numerical failure;
    // do not manufacture a successful model or silently repair a patch.
    if(/Native infrastructure did not return/.test(e.message))throw e;
    row={...base,engineRejected:true,
     code:e.code||'MODEL_OR_EVIDENCE_REJECTED',issues:e.issues||[{message:e.message}],
     physicalFidelity:false,exactRequestedChange:false,nativeCompleted:false,
     nativeCalls:0,manualExplanationReview:'required'};
   }
  }
  rows.push(row);write(a.id+'.'+a.profile+'.review.json',row);
 }
 const armCounts=Object.fromEntries(PAIR_PROFILES.map(p=>[p,countByArm(rows,p,reference)]));
 const pairs=questions.cases.slice(0,f.value.pairedCases).map(qrow=>{
  const full=rows.find(r=>r.id===qrow.id&&r.profile==='full');
  const focused=rows.find(r=>r.id===qrow.id&&r.profile==='focused');
  const referenceClass=reference.cases.find(r=>r.id===qrow.id).classification;
  return {id:qrow.id,referenceClassification:referenceClass,
   originalOrder:pairOrder(questions.cases.findIndex(q=>q.id===qrow.id)),
   full:{kind:full.kind,exactRequestedChange:full.exactRequestedChange===true,
    nativeCompleted:full.nativeCompleted===true,engineRejected:full.engineRejected===true},
   focused:{kind:focused.kind,exactRequestedChange:focused.exactRequestedChange===true,
    nativeCompleted:focused.nativeCompleted===true,engineRejected:focused.engineRejected===true},
   humanNegativeExplanationReview:'pending'};
 });
 const summary={format:'opticsim-focused-full-paired-review-v1',
  originalQuestionsSha256:commit.questionsSha256,originalReferenceSha256:commit.referenceSha256,
  captureSha256:f.digest,pairedCases:pairs.length,firstAttemptCount:rows.length,
  armCounts,pairs,
  sharedBaselineAndTask:true,firstResponsesVerifiedBeforeReferenceRead:true,
  providerCallsDuringReview:0,automaticResponseRepair:0,
  independentExpertReviewVerified:false,humanNegativeReviewCompleted:false,
  teacherStudentLearningAssessed:false,overallModelAccuracy:null,
  comparisonInference:'Descriptive only: evaluate paired fidelity and native completeness separately, no automatic significance/causality claim.',
  originalSourceInterpretation:'not-reassessed: qualified baseline provided',
  textbookAnswerCompleteness:'not-requested'};
 write('paired-summary.json',summary);
 return {summary,rows,out};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const a=process.argv.slice(2);
 if(a.length!==10||a[0]!=='--questions'||a[2]!=='--reference'||a[4]!=='--commitment'||
    a[6]!=='--capture'||a[8]!=='--out'){
  console.error('Usage: node review.mjs --questions <private> --reference <private> --commitment <private> --capture <original-capture.json> --out <fresh-private>');
  process.exitCode=1;
 }else reviewPair({questionsPath:a[1],referencePath:a[3],commitmentPath:a[5],
   capturePath:a[7],outPath:a[9]})
  .then(r=>console.log(JSON.stringify({status:'offline-paired-review-complete',
    selected:r.summary.pairedCases,firstAttempts:r.summary.firstAttemptCount,
    armCounts:r.summary.armCounts,independentReviewersVerified:false,teacherLearningAssessed:false})))
  .catch(e=>{console.error('Paired review failed: '+e.message);process.exitCode=1;});
}
