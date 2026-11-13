import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {makeOfflineCommitment} from '../evaluation/heldout-authoring-v1/commit.mjs';
import {validateQuestions,validateReference,readJSON,checkCommitment,checkedNewOutput,
 requirePrivateInput} from '../evaluation/heldout-authoring-v1/manifest.mjs';
import {collectOnce,authoringMessages} from '../evaluation/heldout-authoring-v1/capture.mjs';
import {runReview} from '../evaluation/heldout-authoring-v1/review.mjs';
import {scoreHeldout} from '../evaluation/heldout-authoring-v1/scoring.mjs';
import {scoreAuthoring} from '../evaluation/cross-family-prospective-v3/replay.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root=resolve('test-artifacts/llm-evaluation/private-heldout');
const files=x=>{
 const base=resolve(root,'test-'+randomUUID());mkdirSync(base,{recursive:true});
 const questionPath=resolve(base,'private-questions.json'),referencePath=resolve(base,'private-reference.json'),
  commitmentPath=resolve(base,'commitment.json');
 const positive={format:'opticsim-problem-v1',physical:{lengthUnit:'cm',components:[
  {id:'S',type:'point-source',parameters:{x:-24,y:1,brightness:.08},emission:{mode:'full-circle'}},
  {id:'L',type:'ideal-lens',parameters:{x:0,focalLength:10,apertureHeight:10}}
 ]},requests:[{id:'emissions',kind:'source-emissions'}]};
 const questions={format:'opticsim-heldout-questions-v1',cases:[
  {id:'A01',prompt:'Mock fully stated lens problem requiring sampled source rays; this is deliberately exposed developer test data, not held out.'},
  {id:'B01',prompt:'Mock incomplete lens problem lacks focal length; return a refusal without guessing the focal length.'}]};
 const ref={format:'opticsim-heldout-reference-v1',reviewers:['mock reviewer one','mock reviewer two'],cases:[
  {id:'A01',classification:'supported',expectedPhysical:positive.physical,
   requestKinds:['source-emissions'],expectedPreflight:'native-ready',
   requiredComponentIds:[],expectedTargets:[]},
  {id:'B01',classification:'missing',expectedPhysical:null,requestKinds:['ideal-image'],
   expectedPreflight:'blocked',expectedFirstStatus:'needs-information',reviewNote:'Missing focal length should not be invented.'}
 ]};
 writeFileSync(questionPath,JSON.stringify(questions,null,2)+'\n',{flag:'wx'});
 writeFileSync(referencePath,JSON.stringify(ref,null,2)+'\n',{flag:'wx'});
 const commit=makeOfflineCommitment({questionsPath:questionPath,referencePath,outPath:commitmentPath});
 return {base,questionPath,referencePath,commitmentPath,commitment:commit.commitment,positive,questions,ref};
};
test('private questions and reference require strict separate manifests and declared reviewers',()=>{
 const f=files();
 assert.equal(validateQuestions(f.questions),f.questions);
 assert.equal(validateReference(f.ref,f.questions),f.ref);
 const invalid={...f.questions,cases:[...f.questions.cases]};
 invalid.cases[0]={...invalid.cases[0],answer:'exposed gold'};
 assert.throws(()=>validateQuestions(invalid),/private text prompt|reference keys/);
 const other={...f.ref,reviewers:['same','same']};
 assert.throws(()=>validateReference(other,f.questions),/two distinct/);
 assert.throws(()=>requirePrivateInput('README.md'),/ignored test-artifacts/);
 assert.throws(()=>checkedNewOutput('test-artifacts/llm-evaluation/private-heldout'),/fresh descendant/);
 const altered=Buffer.from(JSON.stringify({...f.questions,cases:f.questions.cases.slice(0,1)}));
 assert.throws(()=>checkCommitment(f.commitment,altered),/Question bytes changed/);
});
test('mock external transport calls exactly once per case and preserves unedited raw responses',async()=>{
 const f=files(),q=readJSON(f.questionPath);let calls=0;
 const replies=[JSON.stringify({request:f.positive}),JSON.stringify({cannotAuthor:'Focal length and sign are absent; no faithful image calculation.'})];
 const messages=authoringMessages(f.questions.cases[0]);
 assert.match(messages[0].content,/CAPABILITIES/);
 assert.ok(!JSON.stringify(messages).includes('mock reviewer'));
 const output=await collectOnce({questions:f.questions,commitment:f.commitment,maxCases:2,
  send:async(_messages,tag)=>({content:replies[calls++],model:'MOCK-NO-API',usage:null})});
 assert.equal(calls,2);assert.equal(output.externalCalls,2);
 assert.equal(output.referenceRead,false);assert.equal(output.repairs,0);
 assert.equal(output.attempts[0].kind,'request');
 assert.equal(output.attempts[0].rawOutput,replies[0]);
 assert.equal(output.attempts[1].kind,'declined');
 assert.equal(output.attempts[1].rawOutput,replies[1]);
 assert.deepEqual(output.attempts.map(x=>x.attemptNumber),[1,1]);
});
test('non-JSON and invalid request envelopes are failures with no retries',async()=>{
 const f=files();let called=0;
 const x=await collectOnce({questions:f.questions,commitment:f.commitment,maxCases:1,
  send:async()=>{called++;return {content:'{"broken":',model:'MOCK'};}});
 assert.equal(called,1);assert.equal(x.attempts[0].kind,'invalid');
 assert.equal(x.attempts[0].code,'NON_JSON_FIRST_RESPONSE');
});
test('review validates original checksum before any score and rejects reference tampering',async()=>{
 const f=files(),commitment=readJSON(f.commitmentPath);const q=readJSON(f.questionPath),r=readJSON(f.referencePath);
 assert.deepEqual(checkCommitment(commitment.value,q.bytes,r.bytes),f.commitment);
 const tampered=Buffer.from(r.bytes.toString('utf8')+' ');
 assert.throws(()=>checkCommitment(commitment.value,q.bytes,tampered),/reference bytes changed/);
});
test('offline mock first-attempt review scores native success separately from negative refusal',async()=>{
 const f=files(),captureDir=resolve(f.base,'first-attempts'),out=resolve(f.base,'scored');
 mkdirSync(captureDir,{recursive:true});
 const inputs=[JSON.stringify({request:f.positive}),
  JSON.stringify({cannotAuthor:'Missing focal length cannot be inferred from the stated lens setup.'})];
 let index=0;
 const collected=await collectOnce({questions:f.questions,commitment:f.commitment,maxCases:2,
  send:async()=>({content:inputs[index++],model:'MOCK-OFFLINE',usage:null}),
  onAttempt:async a=>writeFileSync(resolve(captureDir,a.id+'.first.json'),
    JSON.stringify(a,null,2)+'\n',{flag:'wx'})});
 const c=readJSON(f.commitmentPath);
 Object.assign(collected,{commitmentSha256:c.digest,modelRequested:'MOCK-OFFLINE',providerOrigin:'https://example.test'});
 const cap=resolve(captureDir,'capture.json');
 writeFileSync(cap,JSON.stringify(collected,null,2)+'\n',{flag:'wx'});
 const result=await runReview({questionsPath:f.questionPath,referencePath:f.referencePath,
   commitmentPath:f.commitmentPath,capturePath:cap,outPath:out,
   execute:scene=>evaluateDocument(scene,core)});
 assert.equal(result.counts.selected,2);
 assert.equal(result.counts.supportedQualified,1);
 assert.equal(result.counts.nativeAttempted,1);
 assert.equal(result.counts.nativeComplete,1);
 assert.equal(result.counts.safeNegativeHandling,0);
 assert.equal(result.counts.negativeDeclinesAwaitingReview,1);
 assert.equal(result.counts.providerCallsRecorded,2);
 assert.equal(result.independentlyVerifiedReviewers,false);
 assert.equal(result.rows[0].physicalFidelity,true);
 assert.equal(result.rows[0].kindFidelity,true);
 assert.equal(result.rows[1].provisionalDecline,true);
 assert.equal(result.rows[1].manualExplanationReview,'required');
 assert.equal(result.rows[1].nativeCalls,0);
 assert.ok(existsSync(resolve(out,'review.json')));
 assert.equal(readFileSync(cap,'utf8'),JSON.stringify(collected,null,2)+'\n',
  'The score never rewrites raw first-attempt capture');
});
test('physically incorrect but runnable model requests do not receive factual fidelity',()=>{
 const f=files();
 const bad=structuredClone(f.positive);
 bad.physical.components[1].parameters.focalLength=5;
 const pre={status:'native-ready',native:{canRun:true},results:[]};
 const executed={report:{results:[{id:'emissions',kind:'source-emissions',status:'available'}],
  coverage:{requested:1,available:1},native:{status:'completed'},
  dispatch:{nativeCalls:1,repairs:0,externalModelCalls:0},targetBindings:[]}};
 const ref=f.ref.cases[0];
 const scored=scoreAuthoring(ref,{response:bad},pre,executed);
 assert.equal(scored.nativeComplete,true);
 assert.equal(scored.kindFidelity,true);
 assert.equal(scored.physicalFidelity,false);
});

test('malformed model request is recorded as a first-attempt failure, and later cases are still reviewed offline',async()=>{
 const f=files(),captureDir=resolve(f.base,'malformed-capture');mkdirSync(captureDir,{recursive:true});
 const replies=[JSON.stringify({request:{format:'wrong-format'}}),JSON.stringify({cannotAuthor:'The focal length was not supplied.'})];
 let index=0,calls=0;
 const capture=await collectOnce({questions:f.questions,commitment:f.commitment,maxCases:2,
  send:async()=>({content:replies[index++],model:'MOCK-OFFLINE'}),
  onAttempt:async a=>writeFileSync(resolve(captureDir,a.id+'.first.json'),JSON.stringify(a,null,2)+'\n',{flag:'wx'})});
 capture.commitmentSha256=readJSON(f.commitmentPath).digest;capture.modelRequested='MOCK-OFFLINE';
 const cap=resolve(captureDir,'capture.json'),bytes=JSON.stringify(capture,null,2)+'\n';writeFileSync(cap,bytes,{flag:'wx'});
 const report=await runReview({questionsPath:f.questionPath,referencePath:f.referencePath,
  commitmentPath:f.commitmentPath,capturePath:cap,outPath:resolve(f.base,'malformed-review'),
  execute:()=>{calls++;throw Error('Neither response may execute native physics');}});
 assert.equal(calls,0);assert.equal(report.rows.length,2);
 assert.equal(report.rows[0].errorCode,'INVALID_MODEL_REQUEST');assert.equal(report.rows[0].exactAuthoring,false);
 assert.equal(report.rows[1].responseKind,'declined');assert.equal(report.counts.nativeAttempted,0);
 assert.equal(readFileSync(cap,'utf8'),bytes);
});


test('supported private references must explicitly adjudicate named IDs and targets',()=>{
 const f=files();
 const missing=structuredClone(f.ref);delete missing.cases[0].expectedTargets;
 assert.throws(()=>validateReference(missing,f.questions),/adjudicated ID and target lists/);
 const badIds=structuredClone(f.ref);badIds.cases[0].requiredComponentIds=['UNKNOWN'];
 assert.throws(()=>validateReference(badIds,f.questions),/exist in expected apparatus/);
 const badTargets=structuredClone(f.ref);
 badTargets.cases[0].expectedTargets=[{kind:'source-emissions',componentId:'L'}];
 assert.equal(validateReference(badTargets,f.questions),badTargets);
 // The declared component is present; whether it is a *valid* target is
 // checked by the actual result contract, not by a second authoring DSL.
 const noNegative=structuredClone(f.ref);delete noNegative.cases[1].expectedFirstStatus;
 assert.throws(()=>validateReference(noNegative,f.questions),/requires expectedFirstStatus/);
});
function scoredExecution(id='S',kind='source-emissions'){
 return {report:{results:[{id:'emissions',kind,componentId:id,status:'available'}],
  coverage:{requested:1,available:1},native:{status:'completed'},
  dispatch:{nativeCalls:1,repairs:0,externalModelCalls:0},targetBindings:[]}};
}
test('renaming a stated physical ID does not earn exact authoring despite native completion',()=>{
 const f=files(),gold={...f.ref.cases[0],requiredComponentIds:['S'],
  expectedTargets:[{kind:'source-emissions',componentId:'S'}]};
 const bad=structuredClone(f.positive);bad.physical.components[0].id='DIFFERENT';
 bad.requests[0].componentId='DIFFERENT';
 const score=scoreHeldout(gold,{response:bad},
  {status:'native-ready',native:{canRun:true},results:[]},
  scoredExecution('DIFFERENT'));
 assert.equal(score.physicalFidelity,true);
 assert.equal(score.kindFidelity,true);
 assert.equal(score.nativeComplete,true);
 assert.equal(score.statedIdsFaithful,false);
 assert.equal(score.targetFidelity,false);
 assert.equal(score.exactAuthoring,false);
});
test('wrong source of a valid measurement cannot earn target-fidelity credit',()=>{
 const f=files(),physical=structuredClone(f.positive.physical);
 physical.components.push({id:'S2',type:'point-source',
  parameters:{x:-30,y:12,brightness:.08},emission:{mode:'full-circle'}});
 const gold={...f.ref.cases[0],expectedPhysical:physical,requiredComponentIds:[],
  expectedTargets:[{kind:'source-emissions',componentId:'S'}]};
 const bad={format:'opticsim-problem-v1',physical,
  requests:[{id:'emissions',kind:'source-emissions',componentId:'S2'}]};
 const score=scoreHeldout(gold,{response:bad},
  {status:'native-ready',native:{canRun:true},results:[]},scoredExecution('S2'));
 assert.equal(score.physicalFidelity,true);
 assert.equal(score.kindFidelity,true);
 assert.equal(score.nativeComplete,true);
 assert.equal(score.targetFidelity,false);
 assert.equal(score.exactAuthoring,false);
});
test('fresh held-out case IDs do not inherit sealed N03 negative-validation special cases',()=>{
 const incomplete={lengthUnit:'cm',components:[
  {id:'S',type:'point-source',parameters:{x:-24,y:1,brightness:.08},emission:{mode:'full-circle'}},
  {id:'L',type:'ideal-lens',parameters:{x:0,apertureHeight:10}}
 ]};
 const reference={id:'N03',classification:'missing',expectedPhysical:incomplete,
  requestKinds:['ideal-image'],expectedPreflight:'blocked',
  expectedFirstStatus:'needs-information',requiredComponentIds:[],expectedTargets:[]};
 const attempt={response:{format:'opticsim-problem-v1',physical:structuredClone(incomplete),
  requests:[{id:'image',kind:'ideal-image',componentId:'S'}]}};
 const run={report:{results:[{kind:'ideal-image',status:'needs-information',
  reasonCode:'NATIVE_SCENE_REQUIRED'}],coverage:{requested:1,available:0},
  native:{status:'not-run'},dispatch:{nativeCalls:0,repairs:0,externalModelCalls:0},targetBindings:[]}};
 const score=scoreHeldout(reference,attempt,{status:'blocked',native:{canRun:false},results:[]},run);
 assert.equal(score.physicalFidelity,true);
 assert.equal(score.negativeDiscipline,true);
 assert.equal(score.exactAuthoring,true);
});
