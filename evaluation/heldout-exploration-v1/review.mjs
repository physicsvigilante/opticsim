// Offline post-first-attempt review. Capture NEVER imports this file or the
// private adjudicated reference. This verifies the raw responses before
// opening the precommitted expert reference and never repairs a model reply.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateObservables,evaluateObservables} from '../../src/observables.js';
import {reviseScene,AuthoringError} from '../../src/authoring.js';
import {prepareQualifiedStructure} from '../../src/qualified-structure.js';
import {verifyQualifiedBundle,recordQualifiedEdit,createQualifiedBundle} from '../../src/qualification.js';
import {canonicalJSON} from '../../src/qualified-utils.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {readJSON,checkCommitment,checkedNewOutput,requirePrivateInput,sha256,ROOT} from '../heldout-authoring-v1/manifest.mjs';
import {CAPTURE_FORMAT,parseExplorationAnswer,explorationMessages} from './capture.mjs';
import {validateExplorationQuestions,validateExplorationReference} from './manifest.mjs';
import {scoreExplorationRevision,scoreExplorationDecline,summarizeExploration} from './scoring.mjs';
const require=createRequire(import.meta.url);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const only=(x,allowed)=>isObject(x)&&Object.keys(x).every(k=>allowed.includes(k));
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
export function verifyExplorationCapture(capture,questions,commitment,dir){
 if(!isObject(capture)||capture.format!==CAPTURE_FORMAT||
   capture.referenceRead!==false||capture.firstAttemptOnly!==true||capture.repairs!==0||
   capture.questionsSha256!==commitment.questionsSha256||
   capture.referenceSha256!==commitment.referenceSha256||
   !Array.isArray(capture.attempts)||capture.attempts.length<1||
   capture.attempts.length>questions.cases.length||
   capture.attempted!==capture.attempts.length||
   capture.externalCalls!==capture.attempts.length)
   throw Error('Private exploration first-attempt capture manifest inconsistent');
 for(const [index,a] of capture.attempts.entries()){
   const q=questions.cases[index];
   if(!a||a.id!==q.id||a.attemptNumber!==1||
     !['proposal','declined','invalid'].includes(a.kind)||
     a.outputSha256!==sha256(Buffer.from(typeof a.rawOutput==='string'?a.rawOutput:''))||
     a.inputSha256!==sha256(Buffer.from(JSON.stringify(explorationMessages(q)))))
     throw Error(q.id+': first-response identity, bytes or exact model prompt changed');
   const parsed=parseExplorationAnswer(a.rawOutput);
   if(parsed.kind!==a.kind||parsed.code!==a.code||
     (parsed.kind==='proposal'&&!same(parsed.proposal,a.proposal))||
     (parsed.kind==='declined'&&parsed.reason!==a.reason))
     throw Error(q.id+': structured attempt differs from immutable original provider text');
   const raw=readFileSync(resolve(dir,a.id+'.first.json'));
   if(raw.length>128000||!same(JSON.parse(raw.toString('utf8')),a))
     throw Error(q.id+': separate original first-attempt file differs from capture record');
 }
 return true;
}
// The model never supplies a baseline hash, core object type, full replacement
// scene, revised source facts or native result values. Hash binding and
// complete recomputation happen deterministically after first-response freeze.
export async function applyExplorationProposal(baseline,input){
 const parent=await verifyQualifiedBundle(baseline);
 const proposal=structuredClone(input);
 if(!only(proposal,['action','patch','additionalObservables'])||
   !['revise','structure','observe'].includes(proposal.action))
   throw new AuthoringError([{path:'$.proposal.action',code:'INVALID_ACTION',message:'Choose one supported revision, structural edit or passive readout action'}]);
 const additional=proposal.additionalObservables===undefined?[]:proposal.additionalObservables;
 if(!Array.isArray(additional)||additional.length>16)
   throw Error('Expected at most 16 additional explicit requested observations');
 validateObservables(additional);
 let document,qualification;
 if(proposal.action==='observe'){
   if(Object.hasOwn(proposal,'patch')||additional.length===0)
     throw Error('Observation-only proposals require new measurements and no physical patch');
   document=structuredClone(parent.scene);qualification=structuredClone(parent.qualification);
 }else if(proposal.action==='revise'){
   if(!only(proposal.patch,['changes']))
     throw Error('Parameter patch may only contain existing targeted changes');
   document=reviseScene(parent.scene,proposal.patch).document;
   qualification=recordQualifiedEdit(parent.scene,document,parent.qualification);
 }else{
   if(!only(proposal.patch,['format','operations']))
     throw Error('Structural patch may only contain admitted add/remove operations');
   const structure=await prepareQualifiedStructure(parent,{
     expectedSha256:parent.sceneSha256,...proposal.patch});
   document=structure.document;qualification=structure.qualification;
 }
 const requests=[...structuredClone(parent.observables),...structuredClone(additional)];
 validateObservables(requests);
 const child=await createQualifiedBundle(document,qualification,requests);
 return {document,child,addedObservables:structuredClone(additional),
   action:proposal.action};
}
export async function reviewExploration({questionsPath,referencePath,commitmentPath,capturePath,outPath,execute=null}){
 const q=readJSON(requirePrivateInput(questionsPath)),c=readJSON(requirePrivateInput(commitmentPath),20000),
   f=readJSON(requirePrivateInput(capturePath),1024*1024);
 const questions=await validateExplorationQuestions(q.value),commit=checkCommitment(c.value,q.bytes);
 if(commit.ids.join('|')!==questions.cases.map(x=>x.id).join('|')||
    f.value.commitmentSha256!==c.digest)
   throw Error('First responses do not match precommitted questions');
 // This MUST precede loading the answer/reference file.
 verifyExplorationCapture(f.value,questions,commit,dirname(resolve(capturePath)));
 const r=readJSON(requirePrivateInput(referencePath));
 checkCommitment(commit,q.bytes,r.bytes);
 const reference=validateExplorationReference(r.value,questions);
 const out=checkedNewOutput(outPath);
 const core=execute?null:require(resolve(ROOT,'dist/test-core.cjs'));
 const evaluator=execute||((scene)=>evaluateDocument(scene,core));
 const rows=[],nativeCounts={modelRevisions:0,refused:0,rejected:0};
 const write=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 for(const [i,attempt] of f.value.attempts.entries()){
   const rowReference=reference.cases[i],baseline=await verifyQualifiedBundle(questions.cases[i].baseline);
   if(attempt.kind==='invalid'){
     const row={id:attempt.id,responseKind:'invalid',errorCode:attempt.code,exactRequestedChange:false,
       nativeCompleted:false,manualExplanationReview:'not-performed'};
     rows.push(row);write(attempt.id+'.review.json',row);continue;
   }
   if(attempt.kind==='declined'){
     nativeCounts.refused++;
     const row={id:attempt.id,...scoreExplorationDecline(rowReference,attempt.reason)};
     rows.push(row);write(attempt.id+'.review.json',row);continue;
   }
   let prepared;
   try{prepared=await applyExplorationProposal(baseline,attempt.proposal);}
   catch(error){
     nativeCounts.rejected++;
     const row={id:attempt.id,responseKind:'proposal',engineRejected:true,
       rejectionCode:error.code||'INVALID_MODEL_PROPOSAL',issues:error.issues||[{message:error.message}],
       physicalFidelity:false,exactRequestedChange:false,nativeCompleted:false,
       nativeCalls:0,manualExplanationReview:'required'};
     rows.push(row);write(attempt.id+'.review.json',row);continue;
   }
   // Count real native calls only after the whole proposed system has passed
   // existing authoring and canonical validation. Run results are recreated
   // from the accepted child, not trusted model output.
   nativeCounts.modelRevisions++;
   const run=await evaluator(structuredClone(prepared.document));
   if(!run||!run.summary||!isObject(run.summary.native))
     throw Error(attempt.id+': native execution infrastructure did not return a valid summary');
   const observations=await evaluateObservables(prepared.document,prepared.child.observables,run.summary);
   const result=rowReference.classification==='supported'?
     scoreExplorationRevision({
       reference:rowReference,baseline,proposal:attempt.proposal,
       child:prepared.child,addedObservables:prepared.addedObservables,
       execution:run,requestedResults:observations}):
     {responseKind:'proposal',engineRejected:false,negativeSubmission:true,
       physicalFidelity:false,exactRequestedChange:false,
       nativeCompleted:run.summary.executionPassed===true,
       automaticallyVerifiedNegative:false,manualExplanationReview:'required',
       note:'A submitted scene on a negative reference is not a safe LLM refusal.'};
   const row={id:attempt.id,responseKind:'proposal',...result,nativeCalls:1,
     nativeStatus:run.summary.native.status,sourceResponseSha256:attempt.outputSha256};
   rows.push(row);
   write(attempt.id+'.qualified-scene.json',prepared.child);
   write(attempt.id+'.native.json',run.summary);
   write(attempt.id+'.observations.json',observations);
   write(attempt.id+'.review.json',row);
 }
 const counts=summarizeExploration(rows,{cases:reference.cases.slice(0,rows.length)});
 const report={format:'opticsim-heldout-exploration-review-v1',
   questionsSha256:q.digest,referenceSha256:r.digest,commitmentSha256:c.digest,
   captureSha256:f.digest,firstAttempts:f.value.attempted,providerCallsRecorded:f.value.externalCalls,
   nativeCalls:nativeCounts,reviewersDeclared:reference.reviewers.length,
   independentlyVerifiedReviewers:false,modelProviderIndependenceVerified:false,
   humanExplanationReviews:0,teacherParticipants:0,studentParticipants:0,
   counts,rows,dimensions:{
     baselineInterpretation:'not-assessed: reference provides an independently curated qualified starting model',
     revisionFidelity:'physical scene and requested target equivalence against frozen adjudicated expert outcome',
     numericalAndPhysicalCorrectness:'existing native completion and sample observations; no independent proof of each optical law',
     coverage:'accepted/unsupported/missing and native availability reported separately',
     educationalUsefulness:'not-assessed: teacher/student review required',
     textbookAnswerCompleteness:'not-requested'
   },
   limitations:['Mock transport tests are not a real independent model evaluation.',
     'Two declared reviewer identities do not authenticate independence or correctness.',
     'Unreviewed negative declines earn zero automatic safe-refusal credit.',
     'Physical fidelity, exact requested changes, native completion and sampled measurement availability are separate.',
     'First attempts and source/reference bytes remain private; no automatic score publication or model repair.']
 };
 write('review.json',report);
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const a=process.argv.slice(2);
 if(a.length!==10||a[0]!=='--questions'||a[2]!=='--reference'||
   a[4]!=='--commitment'||a[6]!=='--capture'||a[8]!=='--out'){
   console.error('Usage: node review.mjs --questions <private> --reference <private> --commitment <private> --capture <first-attempts/capture.json> --out <fresh-private-result-dir>');
   process.exitCode=1;
 }else reviewExploration({questionsPath:a[1],referencePath:a[3],
   commitmentPath:a[5],capturePath:a[7],outPath:a[9]})
  .then(x=>console.log(JSON.stringify({status:'offline-review-complete',
    counts:x.counts,out:a[9],reviewersVerified:false,teacherLearningAssessed:false})))
  .catch(e=>{console.error('Exploration review failed: '+e.message);process.exitCode=1;});
}
