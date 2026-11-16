// MOCK-ONLY developmental harness. NO LLM/provider contacted, no independent
// curators/reviewers, no educational effectiveness/first-attempt accuracy claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {initialQualification,createQualifiedBundle} from '../src/qualification.js';
import {reviseScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {commitPair} from '../evaluation/focused-context-pair-v1/commit.mjs';
import {capturePairMain,pairOrder,pairMessages,collectPairsOnce,
 parseExplorationAnswer} from '../evaluation/focused-context-pair-v1/capture.mjs';
import {verifyPairCapture,reviewPair} from '../evaluation/focused-context-pair-v1/review.mjs';
import {readJSON,sha256} from '../evaluation/heldout-authoring-v1/manifest.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const home=resolve('test-artifacts/llm-evaluation/private-heldout');
const json=x=>JSON.stringify(x,null,2)+'\n';
function fresh(){
 const root=resolve(home,'mock-paired-context-'+randomUUID());
 mkdirSync(root,{recursive:true});
 return root;
}
async function fixture(root=fresh()){
 const source=JSON.parse(readFileSync('scenes/single-lens-detector.json','utf8'));
 const qualification=initialQualification(source,null,{
  inputSha256:'a'.repeat(64),interpretation:{
   source:{caseId:'EXPOSED-ONLY',path:'scenes/single-lens-detector.json',sha256:'b'.repeat(64)},
   stated:['This is an already exposed synthetic fixture, NOT unseen independent source interpretation.'],
   derived:[],assumptions:['One fixed ideal lens, source and passive detector.'],unknowns:['No classroom observations.']
  }
 });
 const baseline=await createQualifiedBundle(source,qualification,[{id:'rays',kind:'source-emissions',componentId:'source-1'}]);
 const expected=reviseScene(source,{changes:[{
  id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'
 }]}).document.physics;
 const questions={format:'opticsim-heldout-exploration-questions-v1',cases:[
  {id:'T01',task:'Set the already present lens-1 focalLength to exactly 150 millimetres, with nothing else changed.',baseline},
  {id:'T02',task:'Change lens-1 focalLength to a longer focal length, but no number or allowable value is given. Do not guess.',baseline}
 ]};
 const reference={format:'opticsim-heldout-exploration-reference-v1',
  reviewers:['MOCK internal fixture A, NOT independent','MOCK internal fixture B, NOT independent'],
  cases:[
   {id:'T01',classification:'supported',expectedAction:'revise',expectedPhysics:expected,
    expectedAdditionalTargets:[],reviewNote:'Only exact focalLength 150 mm is the instructed hypothetical.'},
   {id:'T02',classification:'missing',expectedFirstStatus:'needs-information',
    reviewNote:'Missing new focal value must be clarified or refused; never guessed.'}
  ]};
 const q=resolve(root,'questions.json'),r=resolve(root,'reference.json'),c=resolve(root,'commitment.json');
 writeFileSync(q,json(questions),{flag:'wx'});writeFileSync(r,json(reference),{flag:'wx'});
 const commit=await commitPair({questionsPath:q,referencePath:r,outPath:c});
 return {root,questions,reference,q,r,c,commitment:commit.commitment};
}
const correct=JSON.stringify({proposal:{action:'revise',
 patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}]},
 additionalObservables:[]}});
const decline=JSON.stringify({cannotAuthor:'The new focal length value was not supplied. Please give an exact value in mm.'});
test('Exact baseline/prompt parity and balanced paired order use existing full and focused contexts',async()=>{
 const f=await fixture();
 assert.deepEqual(pairOrder(0),['focused','full']);
 assert.deepEqual(pairOrder(1),['full','focused']);
 assert.throws(()=>pairOrder(-1),/Invalid/);
 const q=f.questions.cases[0];
 const a=await pairMessages(q,'focused'),b=await pairMessages(q,'full');
 assert.deepEqual(a[0],b[0],'System instruction must be identical for both conditions');
 const fa=JSON.parse(a[1].content),fb=JSON.parse(b[1].content);
 assert.equal(fa.task,fb.task);
 assert.deepEqual(fa.context.baseline,fb.context.baseline);
 assert.equal(fa.context.responseContract.expectedIntegritySha256,q.baseline.integritySha256);
 assert.equal(fb.context.responseContract.expectedIntegritySha256,q.baseline.integritySha256);
 assert.ok(Buffer.byteLength(a[1].content)<Buffer.byteLength(b[1].content)*.8);
 assert.ok(!a[1].content.includes('MOCK internal fixture A'),'Reference must never be in the prompt');
 assert.ok(!b[1].content.includes('expectedPhysics'),'Reference must never be in the prompt');
 assert.throws(()=>pairOrder(1.5),/Invalid/);
 await assert.rejects(()=>pairMessages(q,'structure'),/Choose focused or full/);
 rmSync(f.root,{recursive:true,force:true});
});
test('Paired precommit freezes eligible even tasks and rejects structural or odd references before inference',async()=>{
 const f=await fixture();
 assert.equal(f.commitment.numberOfCases,2);
 assert.match(f.commitment.note,/only supported revise\/observe/i);
 await assert.rejects(()=>commitPair({questionsPath:f.q,referencePath:f.r,outPath:f.c}),/overwrite/);
 const odd=structuredClone(f.questions);odd.cases.pop();
 writeFileSync(resolve(f.root,'odd.json'),json(odd),{flag:'wx'});
 await assert.rejects(()=>commitPair({questionsPath:resolve(f.root,'odd.json'),referencePath:f.r,
  outPath:resolve(f.root,'odd-commit.json')}),/Reference case count|EVEN/);
 const ref=structuredClone(f.reference);
 const added=structuredClone(ref.cases[0]);
 added.expectedAction='structure';added.sourceNamedNewComponentIds=[];
 ref.cases[0]=added;
 writeFileSync(resolve(f.root,'bad-reference.json'),json(ref),{flag:'wx'});
 await assert.rejects(()=>commitPair({questionsPath:f.q,referencePath:resolve(f.root,'bad-reference.json'),
  outPath:resolve(f.root,'bad-commit.json')}),/structural|Structural/i);
 rmSync(f.root,{recursive:true,force:true});
});
test('Mock sends exactly one original response per arm, balances orders, never repairs malformed JSON',async()=>{
 const f=await fixture(),d=resolve(f.root,'first-attempts');mkdirSync(d);
 const tags=[],replies=[correct,correct,decline,'NOT VALID JSON'];
 const capture=await collectPairsOnce({questions:f.questions,commitment:f.commitment,
  maxCases:2,send:async(messages,tag)=>{
   assert.equal(messages.length,2);tags.push(tag);
   return {content:replies[tags.length-1],model:'MOCK-NO-EXTERNAL-API',
    usage:{prompt_tokens:tag.includes('focused')?100:200,completion_tokens:15}};
  },onAttempt:async a=>writeFileSync(resolve(d,a.id+'.'+a.profile+'.first.json'),json(a),{flag:'wx'})});
 assert.deepEqual(tags,['paired-exploration:T01:focused','paired-exploration:T01:full',
  'paired-exploration:T02:full','paired-exploration:T02:focused']);
 assert.deepEqual(capture.attempts.map(x=>x.kind),['proposal','proposal','declined','invalid']);
 assert.equal(capture.externalCalls,4);assert.equal(capture.repairs,0);
 assert.equal(capture.referenceRead,false);
 assert.equal(capture.attempts[3].rawOutput,'NOT VALID JSON');
 assert.equal(capture.attempts[3].code,'NON_JSON_FIRST_RESPONSE');
 assert.equal(capture.attempts[0].inputSha256.length,64);
 assert.equal(capture.attempts[0].outputSha256,sha256(Buffer.from(correct)));
 assert.ok(capture.attempts[0].inputBytes<capture.attempts[1].inputBytes);
 assert.equal(await verifyPairCapture(capture,f.questions,f.commitment,d),true);
 // First-attempt raw copy tampering is caught before the evaluator opens gold reference.
 const first=resolve(d,'T01.focused.first.json'),old=readFileSync(first);
 writeFileSync(first,json({...capture.attempts[0],rawOutput:'altered'}));
 await assert.rejects(()=>verifyPairCapture(capture,f.questions,f.commitment,d),/replaced/);
 writeFileSync(first,old);
 assert.equal(await verifyPairCapture(capture,f.questions,f.commitment,d),true);
 const interrupted=resolve(f.root,'interrupted');mkdirSync(interrupted);
 let calls=0;
 await assert.rejects(()=>collectPairsOnce({questions:f.questions,commitment:f.commitment,
  maxCases:2,send:async()=>{calls++;if(calls===2)throw Error('Provider interrupted');return {content:correct,model:'MOCK'};},
  onAttempt:async a=>writeFileSync(resolve(interrupted,a.id+'.'+a.profile+'.first.json'),json(a),{flag:'wx'})}),
  /Provider interrupted/);
 assert.equal(calls,2);assert.ok(readFileSync(resolve(interrupted,'T01.focused.first.json')).length>0);
 assert.equal(parseExplorationAnswer('not json').kind,'invalid');
 rmSync(f.root,{recursive:true,force:true});
});
test('Offline scorer preserves native/fidelity separation, negative refusal is provisional, and no provider calls',async()=>{
 const f=await fixture(),d=resolve(f.root,'capture');mkdirSync(d);
 const capture=await collectPairsOnce({questions:f.questions,commitment:f.commitment,
  maxCases:2,send:async(_,tag)=>({content:tag.endsWith('T02:focused')?'not JSON':
   tag.endsWith('T02:full')?decline:correct,model:'MOCK-NO-API',
   usage:{prompt_tokens:100,completion_tokens:10}}),
  onAttempt:async a=>writeFileSync(resolve(d,a.id+'.'+a.profile+'.first.json'),json(a),{flag:'wx'})});
 const cbytes=readFileSync(f.c);
 writeFileSync(resolve(d,'capture.json'),json({...capture,commitmentSha256:sha256(cbytes)}),{flag:'wx'});
 const out=resolve(f.root,'review');
 const result=await reviewPair({questionsPath:f.q,referencePath:f.r,commitmentPath:f.c,
  capturePath:resolve(d,'capture.json'),outPath:out,
  execute:doc=>evaluateDocument(doc,core)});
 assert.equal(result.summary.pairedCases,2);
 assert.equal(result.summary.firstAttemptCount,4);
 assert.equal(result.summary.armCounts.focused.exactRequestedChanges,1);
 assert.equal(result.summary.armCounts.full.exactRequestedChanges,1);
 assert.equal(result.summary.armCounts.focused.nativeCompletedSupported,1);
 assert.equal(result.summary.armCounts.full.nativeCompletedSupported,1);
 assert.equal(result.summary.armCounts.full.provisionalNegativeDeclines,1);
 assert.equal(result.summary.armCounts.focused.malformed,1);
 assert.equal(result.summary.armCounts.focused.inputBytes>0,true);
 assert.equal(result.summary.armCounts.full.observedPromptTokens,200);
 assert.equal(result.summary.automaticResponseRepair,0);
 assert.equal(result.summary.overallModelAccuracy,null);
 assert.equal(result.summary.humanNegativeReviewCompleted,false);
 assert.equal(result.summary.providerCallsDuringReview,0);
 assert.equal(result.rows.filter(x=>x.nativeCalls===1).length,2);
 assert.equal(result.rows.filter(x=>x.nativeCalls===0).length,2);
 await assert.rejects(()=>reviewPair({questionsPath:f.q,referencePath:f.r,commitmentPath:f.c,
  capturePath:resolve(d,'capture.json'),outPath:out,execute:doc=>evaluateDocument(doc,core)}),/Existing evidence path/);
 // Corrupted provider response must be rejected BEFORE reading even a removed reference.
 const bad=structuredClone(capture);bad.attempts[0].outputSha256='0'.repeat(64);
 writeFileSync(resolve(d,'bad.json'),json({...bad,commitmentSha256:sha256(cbytes)}),{flag:'wx'});
 rmSync(f.r); // Reference now missing; invalid capture must still be caught FIRST.
 await assert.rejects(()=>reviewPair({questionsPath:f.q,referencePath:f.r,commitmentPath:f.c,
  capturePath:resolve(d,'bad.json'),outPath:resolve(f.root,'review-bad'),
  execute:doc=>evaluateDocument(doc,core)}),/raw first response hash mismatch/);
 rmSync(f.root,{recursive:true,force:true});
});
test('Manual provider CLI refuses approval gates before reading private tasks or credentials',async()=>{
 const a=['--questions','not-present.json','--commitment','not-present.json',
  '--out','not-present'];
 await assert.rejects(()=>capturePairMain(a,{}),/transfer AND paired model\/provider charge approval/);
 await assert.rejects(()=>capturePairMain(a,{OPTICSIM_EXTERNAL_DATA_APPROVED:'yes'}),/approval required/);
});
