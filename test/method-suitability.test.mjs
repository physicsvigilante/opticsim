// Typed task-method suitability is advisory on exact authored kinds. It never
// reads source questions, guesses an alias, changes physics or executes native.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {assessMethodSuitability,METHOD_SUITABILITY_FORMAT} from '../src/method-suitability.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url)));
const existing=read('evaluation/real-ten-v1/first-attempts.json');
const six=read('evaluation/reduced-inverse-original-v1/first-attempts.json');
const controls=read('evaluation/reduced-inverse-v1/controls.json');
const pilot=read('evaluation/self-reviewed-pilot-v1/first-attempts.json');
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const fresh=()=>resolve('test-artifacts/llm-authoring/method-suitability-test-'+randomUUID());
const analytic=controls.cases.find(x=>x.id==='reflection-point').request;
const unknown=(kind='mirror-reflection-point')=>({format:'opticsim-problem-v1',physical:null,requests:[{id:'value',kind}]});
const entries=p=>planProblem(p).methodSuitability.entries;
const entry=p=>entries(p)[0];

test('method inventory is built from existing exact registered kinds, not alternate aliases',()=>{
 const caps=problemWorkflowCapabilities();
 assert.equal(caps.methodSuitability.format,METHOD_SUITABILITY_FORMAT);
 assert.equal(caps.methodSuitability.mode,'exact-typed-request-diagnostic');
 for(const [k,d] of Object.entries(caps.requestKinds)){
  assert.ok(['conditional-analytical','native-observation','existing-analysis-with-native-gate'].includes(d.route),k);
 }
 const r=entry(unknown());
 assert.equal(r.registered,false);
 assert.equal(r.route,null);assert.equal(r.methodContract,null);
 assert.deepEqual(r.acceptedInputFamilies,[]);
 assert.equal(r.readiness,'unregistered-kind');
 assert.equal(r.familyCompatibility,'not-assessed');
 assert.equal(r.originalQuestionFidelity,'not-assessed-by-engine');
 assert.equal(r.reasonCode,'UNSUPPORTED_QUANTITY');
});
test('registered inverse returns exact contract and conditional result without native',()=>{
 const p=planProblem(analytic),e=p.methodSuitability.entries[0];
 assert.equal(e.kind,'plane-mirror-reflection-point');
 assert.equal(e.registered,true);
 assert.equal(e.route,'conditional-analytical');
 assert.equal(e.methodContract,'opticsim-reduced-inverse-query-v1');
 assert.deepEqual(e.acceptedInputFamilies,['opticsim-reduced-inverse-facts-v1']);
 assert.equal(e.declaredInputFamily,'opticsim-reduced-inverse-facts-v1');
 assert.equal(e.familyCompatibility,'form-compatible');
 assert.equal(e.readiness,'conditional-result');
 assert.equal(e.planResultStatus,'conditional');
 assert.equal(e.nativeTargetReady,false);
 assert.equal(p.methodSuitability.noAutomaticKindSubstitution,true);
 assert.equal(p.methodSuitability.noNativeCalls,true);
 assert.equal(p.methodSuitability.conditionalResultRequests,1);
});
test('one unsigned observation is ambiguous, not an inferred unique method answer',()=>{
 const a=controls.cases.find(x=>x.id==='ambiguous-unsigned').request;
 const e=entry(a);
 assert.equal(e.readiness,'ambiguous-candidates');
 assert.equal(e.planResultStatus,'multiple-solutions');
 assert.equal(e.candidateCount,2);
 assert.equal(e.reasonCode,'AMBIGUOUS_IMAGE_ORIENTATION');
});
test('missing, malformed and out-of-scope inverse facts get distinct audited diagnoses',()=>{
 const missing=controls.cases.find(x=>x.id==='missing-object-distance').request;
 const outside=controls.cases.find(x=>x.id==='outside-finite-mirror').request;
 const unstable=controls.cases.find(x=>x.id==='near-unit-erect').request;
 assert.equal(entry(missing).readiness,'missing-facts');
 assert.equal(entry(outside).readiness,'unavailable');
 assert.equal(entry(unstable).readiness,'numerically-indeterminate');
 const wrong=structuredClone(analytic);
 wrong.physical={format:'opticsim-plane-mirror-angular-facts-v1',mirrorIds:['A','B'],consecutiveInclinationsDeg:[45]};
 const e=entry(wrong);
 assert.equal(e.familyCompatibility,'form-mismatch');
 assert.ok(['unavailable','invalid-input'].includes(e.readiness));
});
test('known kind without physical facts never creates or selects native apparatus',()=>{
 const q=unknown('paraxial-focal-length-inverse');
 const p=planProblem(q),e=p.methodSuitability.entries[0];
 assert.equal(e.registered,true);assert.equal(e.familyCompatibility,'no-physical-facts');
 assert.equal(e.readiness,'missing-facts');assert.equal(p.scene,null);
 assert.equal(p.native.canRun,false);assert.equal(e.nativeTargetReady,false);
});
test('valid native-only scene is ready for execution, not already a measured answer',()=>{
 const q=JSON.parse(pilot.attempts[0].rawOutput).request,p=planProblem(q),audit=p.methodSuitability;
 assert.equal(p.native.canRun,true);assert.equal(audit.pendingNativeRequests,3);
 assert.equal(audit.conditionalResultRequests,0);
 for(const e of audit.entries){
  assert.equal(e.registered,true);
  assert.equal(e.declaredInputFamily,'authoring-scene');
  assert.equal(e.familyCompatibility,'form-compatible');
  assert.equal(e.readiness,'requires-native-execution');
  assert.equal(e.planResultStatus,'pending');
  assert.equal(e.nativeTargetReady,true);
 }
});
test('native target missing in a valid physical scene does not become a success',()=>{
 const q=JSON.parse(pilot.attempts[0].rawOutput).request;
 q.requests[0].componentId='NO_SUCH_SOURCE';
 const e=entries(q)[0];
 assert.equal(e.readiness,'missing-facts');assert.equal(e.nativeTargetReady,false);
 assert.equal(e.reasonCode,'UNKNOWN_COMPONENT_TARGET');
});
test('mixed requests preserve independently qualified analytics but no fabricated native detector',()=>{
 const q=structuredClone(analytic);
 q.requests.push({id:'detector',kind:'detector-crossings',componentId:'D1'});
 const a=planProblem(q),audit=a.methodSuitability;
 assert.equal(a.scene,null);assert.equal(a.native.canRun,false);
 assert.equal(audit.totalRequests,2);
 assert.equal(audit.conditionalResultRequests,1);
 assert.equal(audit.unresolvedRequests,1);
 assert.deepEqual(audit.entries.map(e=>e.readiness),['conditional-result','missing-facts']);
 assert.equal(audit.entries[1].familyCompatibility,'form-mismatch');
});
test('plan uses defensive snapshots of caller-owned facts before method assessment',()=>{
 const q=structuredClone(analytic);
 const before=bytes(q),plan=planProblem(q);
 q.requests[0].kind='nonexistent-kind';
 q.physical.lengthUnit='m';
 assert.equal(plan.methodSuitability.entries[0].kind,'plane-mirror-reflection-point');
 assert.equal(plan.methodSuitability.entries[0].readiness,'conditional-result');
 assert.equal(plan.request.physical.lengthUnit,'cm');
 assert.notDeepEqual(bytes(q),before);
});
test('mismatched result IDs cannot be silently associated with an authored request',()=>{
 assert.throws(()=>assessMethodSuitability({request:{requests:[{id:'A',kind:'k'}]},
  results:[{id:'B',kind:'k',status:'conditional'}]}, {}, {}),/identity mismatch/);
});
test('historical original requests are *unregistered*, not proved unsolvable or silently renamed',()=>{
 const cases=[...existing.cases.map(x=>({id:x.id,request:x.engineRequest})),
  ...six.cases.map(x=>({id:x.id,request:x.submittedRequest}))];
 assert.equal(cases.length,16);
 let total=0;
 for(const {id,request} of cases){
  const p=planProblem(request);
  assert.equal(p.methodSuitability.unregisteredRequests,request.requests.length,id);
  assert.equal(p.methodSuitability.conditionalResultRequests,0,id);
  assert.ok(p.methodSuitability.entries.every(e=>e.readiness==='unregistered-kind'),id);
  assert.ok(p.results.every(e=>e.reasonCode==='UNSUPPORTED_QUANTITY'),id);
  assert.equal(p.native.canRun,false);assert.equal(p.scene,null);
  assert.equal(p.methodSuitability.originalQuestionFidelity,'not-assessed-by-engine');
  total+=request.requests.length;
 }
 assert.equal(total,19);
});
test('method audit is persisted in both preflight and completed hash-bound offline reports',async()=>{
 const request=analytic,original=bytes(request);
 const pfile=resolve('test-artifacts/llm-authoring/method-audit-input-'+randomUUID()+'.json');
 const {writeFileSync,rmSync,mkdirSync}=await import('node:fs');
 mkdirSync(resolve('test-artifacts/llm-authoring'),{recursive:true});
 writeFileSync(pfile,original,{flag:'wx'});
 let proc;
 try{proc=spawnSync(process.execPath,['scripts/preflight-problem.mjs',pfile],{encoding:'utf8'});}
 finally{rmSync(pfile);}
 assert.equal(proc.status,0,proc.stderr);
 const pre=JSON.parse(proc.stdout);
 assert.equal(pre.methodSuitability.format,METHOD_SUITABILITY_FORMAT);
 assert.equal(pre.methodSuitability.entries[0].readiness,'conditional-result');
 assert.equal(pre.native.calls,0);
 let calls=0;
 const done=await runProblemEvidence({inputBytes:original,outputPath:fresh(),
  execute:()=>{calls++;throw Error('No native execution expected for inverse facts');}});
 assert.equal(done.exitCode,0);assert.equal(calls,0);
 assert.deepEqual(done.report.methodSuitability,pre.methodSuitability);
 assert.equal(done.report.inputSha256,createHash('sha256').update(original).digest('hex'));
 assert.ok(existsSync(resolve(done.output,'plan.json')));
});
