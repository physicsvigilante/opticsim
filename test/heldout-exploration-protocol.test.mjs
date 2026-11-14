// MOCK ONLY. These tests do not contact a model, have no independent expert
// reference and must never be reported as unfamiliar LLM accuracy.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {initialQualification,createQualifiedBundle} from '../src/qualification.js';
import {evaluateObservables} from '../src/observables.js';
import {makeExplorationCommitment,validateExplorationQuestions,validateExplorationReference} from '../evaluation/heldout-exploration-v1/manifest.mjs';
import {commitExploration} from '../evaluation/heldout-exploration-v1/commit.mjs';
import {parseExplorationAnswer,explorationMessages,collectExplorationOnce,captureMain} from '../evaluation/heldout-exploration-v1/capture.mjs';
import {applyExplorationProposal,verifyExplorationCapture,reviewExploration} from '../evaluation/heldout-exploration-v1/review.mjs';
import {scoreExplorationRevision,scoreExplorationDecline,summarizeExploration} from '../evaluation/heldout-exploration-v1/scoring.mjs';
import {checkCommitment} from '../evaluation/heldout-authoring-v1/manifest.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../evaluation/teaching-fidelity-v1/plan.json',import.meta.url)));
const json=x=>JSON.stringify(x,null,2)+'\n';
const outRoot=resolve('test-artifacts/llm-evaluation/private-heldout');
const newArea=()=>{const path=resolve(outRoot,'mock-m35-'+randomUUID());mkdirSync(path,{recursive:true});return path;};
const get=(doc,id)=>doc.physics.components.find(x=>x.id===id);
const detector={id:'Probe',type:'ray-detector',
 parameters:{x:80,y:0,orientationDeg:90,length:160}};
const pRevise={action:'revise',patch:{changes:[{
 id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}]}};
const pStructure={action:'structure',
 patch:{format:'opticsim-component-revision-v1',operations:[{
  op:'add',lengthUnit:'mm',component:detector}]},
 additionalObservables:[{id:'probe-crossings',kind:'detector-crossings',componentId:'Probe'}]};
async function scenario(){
 const doc=prepareScene(structuredClone(fixture.initialRequest)).document;
 const qualification=initialQualification(doc,null,{inputSha256:'a'.repeat(64),
  interpretation:{source:{caseId:'EXPOSED-MOCK-FIXTURE',path:'scenes/single-lens-detector.json',sha256:'b'.repeat(64)},
    stated:['Three physical objects are deliberately supplied by a synthetic fixture.'],
    derived:[],assumptions:[],unknowns:['This is NOT independent source interpretation.']}});
 const baseline=await createQualifiedBundle(doc,qualification,fixture.observables);
 const expectedPhysical1=reviseScene(doc,pRevise.patch).document.physics;
 const expectedPhysical2=structuredClone(doc.physics);
 expectedPhysical2.components.push(structuredClone(detector));
 const questions={format:'opticsim-heldout-exploration-questions-v1',cases:[
  {id:'H1',task:'Move the single lens focal length to exactly 150 millimetres; leave all other physical fields and numerical controls unchanged.',baseline},
  {id:'H2',task:'Add the explicitly specified passive Probe detector at x 80 mm, y 0 mm, orientation 90 degrees and length 160 mm; inspect its sampled crossings.',baseline},
  {id:'H3',task:'Increase the lens focal length, but I have not said what value to use. Do not guess or treat a numerical solver setting as a physical value.',baseline}
 ]};
 const reference={format:'opticsim-heldout-exploration-reference-v1',
  reviewers:['MOCK researcher A, NOT independent','MOCK researcher B, NOT independent'],cases:[
  {id:'H1',classification:'supported',expectedAction:'revise',expectedPhysics:expectedPhysical1,
   expectedAdditionalTargets:[],reviewNote:'The exact focal length is a new hypothetical; all other fields retained.'},
  {id:'H2',classification:'supported',expectedAction:'structure',expectedPhysics:expectedPhysical2,
   expectedAdditionalTargets:[{kind:'detector-crossings',componentId:'Probe'}],
   reviewNote:'Passive detector reads real native sampled rays, not an image or per-source attribution.'},
  {id:'H3',classification:'missing',expectedFirstStatus:'needs-information',
   reviewNote:'No focal length value is supplied, so the model cannot author a numerical physical revision.'}
 ]};
 return {doc,baseline,questions,reference};
}
const privateFiles=async()=>{
 const f=await scenario(),root=newArea();
 const q=resolve(root,'questions.json'),r=resolve(root,'reference.json'),c=resolve(root,'commitment.json');
 writeFileSync(q,json(f.questions),{flag:'wx'});
 writeFileSync(r,json(f.reference),{flag:'wx'});
 const committed=await commitExploration({questionsPath:q,referencePath:r,outPath:c});
 return {...f,root,q,r,c,commitment:committed.commitment};
};

test('private revision questions are qualified, strict, source-identified and exclude reference fields',async()=>{
 const f=await scenario();await validateExplorationQuestions(f.questions);
 assert.equal(validateExplorationReference(f.reference,f.questions),f.reference);
 const bad=structuredClone(f.questions);bad.cases[0].expectedPhysics={hidden:true};
 await assert.rejects(validateExplorationQuestions(bad),/reference data|task/);
 const damaged=structuredClone(f.questions);damaged.cases[0].baseline.scene.physics.components[1].parameters.focalLength=40;
 await assert.rejects(validateExplorationQuestions(damaged),/integrity mismatch/);
 const withoutSource=structuredClone(f.questions);
 withoutSource.cases[0].baseline.qualification.interpretation.source=undefined;
 await assert.rejects(validateExplorationQuestions(withoutSource),/integrity|source/);
});
test('offline reviewer reference must be complete, physically supported and reject unsupported target/family',async()=>{
 const f=await scenario();
 for(const key of ['expectedPhysics','expectedAction','expectedAdditionalTargets']){
  const bad=structuredClone(f.reference);delete bad.cases[0][key];
  assert.throws(()=>validateExplorationReference(bad,f.questions),/supported reference/);
 }
 const x=structuredClone(f.reference);x.reviewers=['same','same'];
 assert.throws(()=>validateExplorationReference(x,f.questions),/two distinct/);
 const badTarget=structuredClone(f.reference);
 badTarget.cases[1].expectedAdditionalTargets=[{kind:'detector-crossings',componentId:'Absent'}];
 assert.throws(()=>validateExplorationReference(badTarget,f.questions),/not present/);
 const unsupported=structuredClone(f.reference);
 unsupported.cases[0].expectedPhysics.model='triangular-prism-tracing';
 assert.throws(()=>validateExplorationReference(unsupported,f.questions),/model|Unsupported|invalid/);
 const negative=structuredClone(f.reference);negative.cases[2].expectedPhysics=f.doc.physics;
 assert.throws(()=>validateExplorationReference(negative,f.questions),/negative reference/);
});
test('precommitment freezes exact question and reference bytes before any model capture',async()=>{
 const f=await privateFiles(),q=readFileSync(f.q),ref=readFileSync(f.r);
 const commit=await makeExplorationCommitment(f.questions,f.reference,q,ref);
 assert.deepEqual(commit,f.commitment);
 assert.deepEqual(checkCommitment(commit,q,ref),commit);
 assert.throws(()=>checkCommitment(commit,Buffer.concat([q,Buffer.from(' ')])),/Question bytes changed/);
 assert.throws(()=>checkCommitment(commit,q,Buffer.concat([ref,Buffer.from(' ')])),/reference bytes changed/);
 await assert.rejects(commitExploration({questionsPath:f.q,referencePath:f.r,outPath:f.c}),/overwrite/);
});
test('model sees only qualified original physical inputs and public contracts, never hidden adjudication',async()=>{
 const f=await scenario(),msgs=explorationMessages(f.questions.cases[0]),s=JSON.stringify(msgs);
 assert.match(s,/baselineScene/);
 assert.match(s,/componentTypes/);
 assert.match(s,/cannotAuthor/);
 assert.match(s,/lens-1/);
 assert.doesNotMatch(s,/MOCK researcher|expectedPhysics|expectedAdditionalTargets/);
 assert.deepEqual(f.questions.cases[0].baseline,JSON.parse(JSON.stringify(f.baseline)));
});
test('raw first responses and malformed text are retained with exactly one call per task',async()=>{
 const f=await scenario(),replies=[JSON.stringify({proposal:pRevise}),JSON.stringify({proposal:pStructure}),'not json'];
 let count=0;
 const result=await collectExplorationOnce({questions:f.questions,commitment:{
  questionsSha256:'0'.repeat(64),referenceSha256:'1'.repeat(64)
 },maxCases:3,send:async()=>({content:replies[count++],model:'MOCK-NO-API',usage:null})});
 assert.equal(count,3);
 assert.deepEqual(result.attempts.map(x=>x.kind),['proposal','proposal','invalid']);
 assert.equal(result.attempts[2].code,'NON_JSON_FIRST_RESPONSE');
 assert.equal(result.attempts[0].rawOutput,replies[0]);
 assert.deepEqual(result.attempts.map(x=>x.attemptNumber),[1,1,1]);
 assert.equal(result.repairs,0);assert.equal(result.referenceRead,false);
 assert.equal(parseExplorationAnswer('{"proposal":{},"cannotAuthor":"bad"}').kind,'invalid');
 assert.equal(parseExplorationAnswer('{"proposal":{},"extra":"bad"}').kind,'invalid');
});
test('external model capture requires explicit private transfer authorization, without contacting provider',async()=>{
 await assert.rejects(captureMain([],{}),/Explicit OPTICSIM_EXTERNAL_DATA_APPROVED/);
});
test('parameter and structural model proposals preserve the source and use original engine validators',async()=>{
 const f=await scenario();
 const a=await applyExplorationProposal(f.baseline,pRevise),b=await applyExplorationProposal(f.baseline,pStructure);
 assert.deepEqual(a.document.physics,f.reference.cases[0].expectedPhysics);
 assert.deepEqual(b.document.physics,f.reference.cases[1].expectedPhysics);
 assert.deepEqual(f.baseline.scene.physics.components,f.doc.physics.components);
 assert.equal(a.child.qualification.edits[0].kind,'physics');
 assert.equal(b.child.qualification.edits[0].kind,'physics');
 assert.equal(b.child.observables.at(-1).componentId,'Probe');
 assert.deepEqual(b.child.qualification.origin,f.baseline.qualification.origin);
 await assert.rejects(applyExplorationProposal(f.baseline,{
  action:'revise',patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:0,unit:'mm'}]}
 }),/focalLength/);
 await assert.rejects(applyExplorationProposal(f.baseline,{
  action:'structure',patch:{format:'opticsim-component-revision-v1',operations:[{
    op:'add',lengthUnit:'mm',component:{...detector,parameters:{...detector.parameters,x:0}}
  }]}
 }),/intersect|overlap|contact|clearance|lens/i);
 await assert.rejects(applyExplorationProposal(f.baseline,{action:'observe',additionalObservables:[]}),/require new/);
});
test('independently computed correct native results do not excuse valid but incorrect physical edits',async()=>{
 const f=await scenario(),wrong=await applyExplorationProposal(f.baseline,{
  action:'revise',patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:140,unit:'mm'}]}
 });
 const run=evaluateDocument(wrong.document,core);
 const result=await evaluateObservables(wrong.document,wrong.child.observables,run.summary);
 const grade=scoreExplorationRevision({
  baseline:f.baseline,reference:f.reference.cases[0],proposal:{action:'revise'},
  child:wrong.child,addedObservables:[],execution:run,requestedResults:result});
 assert.equal(run.summary.native.status,'completed');
 assert.equal(grade.nativeCompleted,true);
 assert.equal(grade.physicalFidelity,false);
 assert.equal(grade.exactRequestedChange,false);
 assert.equal(grade.supportedQualified,false);
 const stale=scoreExplorationRevision({
  baseline:f.baseline,reference:{...f.reference.cases[0],expectedPhysics:wrong.document.physics},
  proposal:{action:'revise'},child:wrong.child,addedObservables:[],
  execution:{summary:{...run.summary,canonicalSha256:'f'.repeat(64)}},requestedResults:result});
 assert.equal(stale.physicalFidelity,true);
 assert.equal(stale.nativeCompleted,false);
});
test('wrong measurement target is not credited even if native rays complete',async()=>{
 const f=await scenario();
 const bad=await applyExplorationProposal(f.baseline,{
  ...pStructure,additionalObservables:[{id:'changed',kind:'detector-crossings',componentId:'detector-1'}]
 });
 const run=evaluateDocument(bad.document,core),results=await evaluateObservables(bad.document,bad.child.observables,run.summary);
 const grade=scoreExplorationRevision({baseline:f.baseline,reference:f.reference.cases[1],
  proposal:pStructure,child:bad.child,addedObservables:[{id:'changed',kind:'detector-crossings',componentId:'detector-1'}],
  execution:run,requestedResults:results});
 assert.equal(grade.physicalFidelity,true);
 assert.equal(grade.nativeCompleted,true);
 assert.equal(grade.targetFidelity,false);
 assert.equal(grade.supportedQualified,false);
});
test('offline mock full pipeline preserves first decisions, counts only valid native proposals and flags declines provisional',async()=>{
 const f=await privateFiles(),capDir=resolve(f.root,'mock-capture'),reportDir=resolve(f.root,'mock-review');
 mkdirSync(capDir);
 const replies=[JSON.stringify({proposal:pRevise}),JSON.stringify({proposal:pStructure}),
   JSON.stringify({cannotAuthor:'The new focal length is not numerically specified; no physical parameter can be changed faithfully.'})];
 let index=0,engineCalls=0;
 const capture=await collectExplorationOnce({
  questions:f.questions,commitment:f.commitment,maxCases:3,
  send:async()=>({content:replies[index++],model:'MOCK-NO-PROVIDER',usage:null}),
  onAttempt:async a=>writeFileSync(resolve(capDir,a.id+'.first.json'),json(a),{flag:'wx'})
 });
 const commitmentBytes=readFileSync(f.c);
 Object.assign(capture,{
  commitmentSha256:(await import('node:crypto')).createHash('sha256').update(commitmentBytes).digest('hex'),
  modelRequested:'MOCK-NO-PROVIDER',
  providerOrigin:'https://example.test'
 });
 const capturePath=resolve(capDir,'capture.json');
 writeFileSync(capturePath,json(capture),{flag:'wx'});
 assert.equal(verifyExplorationCapture(capture,f.questions,f.commitment,capDir),true);
 const report=await reviewExploration({questionsPath:f.q,referencePath:f.r,commitmentPath:f.c,
  capturePath,outPath:reportDir,
  execute:doc=>{engineCalls++;return evaluateDocument(doc,core);}});
 assert.equal(report.counts.selected,3);
 assert.equal(report.counts.supported,2);
 assert.equal(report.counts.exactRequestedChanges,2);
 assert.equal(report.counts.nativeCompletedAmongSupported,2);
 assert.equal(report.counts.supportedQualified,2);
 assert.equal(report.counts.provisionalNegativeDeclines,1);
 assert.equal(report.counts.automaticNegativeApprovals,0);
 assert.equal(report.counts.overallModelAccuracy,null);
 assert.equal(report.humanExplanationReviews,0);
 assert.equal(engineCalls,2);
 assert.equal(report.nativeCalls.modelRevisions,2);
 assert.equal(report.nativeCalls.refused,1);
 assert.equal(report.rows[2].manualExplanationReview,'required');
 assert.equal(report.independentlyVerifiedReviewers,false);
 assert.equal(report.modelProviderIndependenceVerified,false);
 assert.ok(existsSync(resolve(reportDir,'H2.qualified-scene.json')));
 assert.equal(readFileSync(capturePath,'utf8'),json(capture));
 assert.equal(readFileSync(f.q,'utf8'),json(f.questions));
});
test('first-attempt tampering is rejected before reference review; an inaccurate decline is not a verified refusal',async()=>{
 const f=await privateFiles(),dir=resolve(f.root,'captured');mkdirSync(dir);
 const attempt=await collectExplorationOnce({questions:f.questions,commitment:f.commitment,maxCases:1,
  send:async()=>({content:'{"broken":',model:'MOCK'}),
  onAttempt:async a=>writeFileSync(resolve(dir,a.id+'.first.json'),json(a),{flag:'wx'})});
 attempt.commitmentSha256=(await import('node:crypto')).createHash('sha256').update(readFileSync(f.c)).digest('hex');
 const path=resolve(dir,'capture.json');writeFileSync(path,json(attempt),{flag:'wx'});
 attempt.attempts[0].rawOutput='different';
 assert.throws(()=>verifyExplorationCapture(attempt,f.questions,f.commitment,dir),/checksum|bytes|changed|differs/);
 const decline=scoreExplorationDecline(f.reference.cases[0],'Cannot do it');
 assert.equal(decline.provisionalDecline,false);
 assert.equal(decline.automaticallyVerifiedNegative,false);
 const counts=summarizeExploration([{id:'H1',responseKind:'declined',...decline}],{cases:[f.reference.cases[0]]});
 assert.equal(counts.supportedQualified,0);
 assert.equal(counts.overallModelAccuracy,null);
});
