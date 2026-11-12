import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {scoreSubmission} from '../evaluation/llm-pilot-v1/score.mjs';
import {prepareScene} from '../src/authoring.js';

const load=name=>JSON.parse(readFileSync(new URL(
  '../evaluation/llm-pilot-v1/'+name+'.json',import.meta.url),'utf8'));
const prompts=load('prompts'),gold=load('authoring-reference'),
  corpus=load('corpus-prompts'),refs=load('corpus-reference');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const control=()=>({format:'opticsim-pilot-submission-v1',
  authoring:gold.cases.map(c=>({id:c.id,request:structuredClone(c.request)})),
  scope:refs.cases.map(c=>({id:c.id,scope:c.scope,
    reason:c.reviewerNote}))});
const get=(s,id)=>s.authoring.find(r=>r.id===id);
const lengthFields=new Set(['x','y','focalLength','apertureHeight','length']);

test('ten general composition prompts and nine real questions have distinct linked references',()=>{
  assert.equal(prompts.cases.length,10);
  assert.equal(gold.cases.length,10);
  assert.equal(corpus.cases.length,9);
  assert.equal(refs.cases.length,9);
  assert.deepEqual(prompts.cases.map(c=>c.id),gold.cases.map(c=>c.id));
  assert.deepEqual(corpus.cases.map(c=>c.id),refs.cases.map(c=>c.id));
  assert.equal(new Set(prompts.cases.map(c=>c.id)).size,10);
  assert.equal(new Set(corpus.cases.map(c=>c.problemPath)).size,9);
  assert.equal(prompts.sourceModel,'general-component-tracing');
  assert.equal(corpus.archive.branch,'evaluation/jee-problems');
  assert.match(corpus.archive.sha256,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(prompts).includes('"request"'));
  assert.ok(!JSON.stringify(corpus).includes('/Solutions/'));
  for(const c of corpus.cases)
    assert.ok(c.problemPath.includes('/Problems/')&&c.problemPath.endsWith('.png'));
});

test('the ten control requests compile and execute through pinned native PhyDemo',()=>{
  for(const {id,request} of gold.cases){
    const prepared=prepareScene(request);
    assert.equal(prepared.document.physics.model,'general-component-tracing',id);
    assert.deepEqual(prepared.preparation.assignedIds,[],id);
  }
  const s=scoreSubmission(control(),core);
  assert.equal(s.counts.authored,10);
  assert.equal(s.counts.structurallyValid,10);
  assert.equal(s.counts.physicallyFaithful,10);
  assert.equal(s.counts.idsPreserved,10);
  assert.equal(s.counts.nativeExecutionPassed,10);
  assert.equal(s.counts.classificationsSubmitted,9);
  assert.equal(s.counts.scopeLabelsCorrect,9);
  assert.ok(s.authoring.every(x=>x.nativeStatus==='completed'||
    x.nativeStatus==='completed-with-warnings'));
  assert.ok(s.authoring.every(x=>x.analysisStatus==='unavailable'));
  assert.ok(s.scope.every(x=>x.explanationAssessment==='requires-independent-review'));
  assert.equal(s.solutionImages,'not-loaded');
});

test('physically wrong but native-runnable scenes fail semantic fidelity',()=>{
  const candidate=control();
  get(candidate,'C04').request.components.find(x=>x.id==='L1').parameters.focalLength=12;
  const report=scoreSubmission(candidate,core);
  assert.equal(report.counts.structurallyValid,10);
  assert.equal(report.counts.physicallyFaithful,9);
  assert.equal(report.counts.nativeExecutionPassed,10);
  assert.ok(report.authoring.find(x=>x.id==='C04').issues
    .some(x=>x.code==='PHYSICAL_MISMATCH'));
});

test('unit changes and component reorder preserve physical fidelity',()=>{
  const candidate=control(),original=get(candidate,'C03').request;
  const v=structuredClone(original);
  v.lengthUnit='mm';
  for(const component of v.components)
    for(const key of Object.keys(component.parameters))
      if(lengthFields.has(key))component.parameters[key]*=10;
  v.components.reverse();
  get(candidate,'C03').request=v;
  const report=scoreSubmission(candidate,core);
  assert.equal(report.counts.physicallyFaithful,10);
  assert.equal(report.counts.nativeExecutionPassed,10);
});

test('missing physical emission values cannot pass via a conveniently valid fallback',()=>{
  const candidate=control();
  delete get(candidate,'C08').request.components[0].emission.angleDeg;
  const report=scoreSubmission(candidate,core);
  const invalid=report.authoring.find(x=>x.id==='C08');
  assert.equal(invalid.valid,false);
  assert.equal(invalid.executionPassed,false);
  assert.equal(invalid.nativeStatus,'not-run');
  assert.ok(invalid.issues.some(x=>x.code==='MISSING_VALUE'&&
    x.path.includes('angleDeg')));
});

test('correct scope labels and explanations are explicitly separate assessments',()=>{
  const candidate=control();
  const a=candidate.scope.find(x=>x.id==='R06');
  a.scope='exact';
  a.reason='Convex mirror refractive and reflection physics are available everywhere.';
  const b=candidate.scope.find(x=>x.id==='R02');
  b.reason='short';
  const report=scoreSubmission(candidate,core);
  assert.equal(report.counts.scopeLabelsCorrect,7);
  assert.ok(report.scope.find(x=>x.id==='R06').issues.includes('SCOPE_MISMATCH'));
  assert.ok(report.scope.find(x=>x.id==='R02').issues.includes('INVALID_SCOPE_OR_REASON'));
  assert.equal(report.corpusExplanations,'not-independently-graded');
});

test('missing candidate rows and unknown IDs are not silently scored as successes',()=>{
  const candidate=control();
  candidate.authoring.splice(0,1);
  candidate.scope.splice(0,2);
  const report=scoreSubmission(candidate,core);
  assert.equal(report.counts.authored,9);
  assert.equal(report.counts.physicallyFaithful,9);
  assert.equal(report.counts.scopeLabelsCorrect,7);
  assert.ok(report.authoring[0].issues.some(x=>x.code==='MISSING_SUBMISSION'));
  const duplicated=control();
  duplicated.authoring.push(structuredClone(duplicated.authoring[0]));
  assert.throws(()=>scoreSubmission(duplicated,core),/duplicate case/);
  const unknown=control();
  unknown.scope[0].id='R77';
  assert.throws(()=>scoreSubmission(unknown,core),/unknown or malformed case ID/);
});
