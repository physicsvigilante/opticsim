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
   requestKinds:['source-emissions'],expectedPreflight:'native-ready'},
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
 assert.equal(result.counts.safeNegativeHandling,1);
 assert.equal(result.counts.providerCallsRecorded,2);
 assert.equal(result.independentlyVerifiedReviewers,false);
 assert.equal(result.rows[0].physicalFidelity,true);
 assert.equal(result.rows[0].kindFidelity,true);
 assert.equal(result.rows[1].safeDecline,true);
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
