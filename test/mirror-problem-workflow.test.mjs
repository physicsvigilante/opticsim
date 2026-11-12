import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {canonicalJSON} from '../src/qualified-utils.js';
const followup=JSON.parse(readFileSync(new URL('../evaluation/mirror-angular-v1/first-followup.json',import.meta.url)));
const original=JSON.parse(readFileSync(new URL('../evaluation/unified-workflow-v1/first-attempt.json',import.meta.url)));
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const fresh=()=>resolve('test-artifacts/llm-authoring/mirror-workflow-test-'+randomUUID());
const requestFrom=f=>({format:'opticsim-problem-v1',physical:f.physical,
 requests:[{id:'angle',kind:f.query.kind,referenceMirrorId:f.query.referenceMirrorId,
 outgoingRelation:f.query.outgoingRelation,angleConvention:f.query.angleConvention}]});
test('original U1 first interpretation stays exactly sealed and remains unrepresented',()=>{
 const digest=createHash('sha256').update(canonicalJSON(original)).digest('hex');
 assert.equal(digest,followup.source.originalTrialCanonicalSha256);
 const request=original.cases.find(x=>x.id==='U1').request;
 assert.equal(request.physical,null);
 assert.equal(request.requests[0].kind,'mirror-incidence-from-output-direction');
 const plan=planProblem(request);
 assert.equal(plan.scene,null);
 assert.equal(plan.results[0].status,'needs-information');
 assert.equal(plan.native.canRun,false);
});
test('unified capabilities expose minimal mirror inverses with no new apparatus component',()=>{
 const caps=problemWorkflowCapabilities();
 assert.equal(caps.mirrorAngular.factsFormat,'opticsim-plane-mirror-angular-facts-v1');
 assert.equal(caps.requestKinds['mirror-incidence-from-output-direction'].route,'conditional-analytical');
 assert.ok(caps.mirrorAngular.physicalLimitations.some(s=>s.includes('finite')));
});
test('U1 follow-up yields 50° from normal with no invented native scene or executor calls',async()=>{
 const input=structuredClone(followup.request),before=structuredClone(input),out=fresh();
 let calls=0;
 const r=await runProblemEvidence({inputBytes:bytes(input),outputPath:out,
 execute:()=>{calls++;throw Error('Must never run native on angular-only facts');}});
 assert.equal(r.exitCode,0);assert.equal(calls,0);
 assert.equal(r.report.results[0].status,'conditional');
 assert.equal(r.report.results[0].value.incidenceAngleDeg,50);
 assert.equal(r.report.results[0].value.complementarySurfaceAngleDeg,40);
 assert.equal(r.report.native.status,'not-run');assert.equal(r.report.portable.status,'not-created');
 assert.equal(r.report.dispatch.nativeCalls,0);assert.equal(r.report.dispatch.externalModelCalls,0);
 assert.equal(r.report.questionSupport,'not-assessed-by-engine');
 assert.ok(existsSync(resolve(out,'plan.json'))&&existsSync(resolve(out,'analytical-results.json')));
 assert.deepEqual(input,before);
});
test('ambiguous unsigned four-mirror inputs return candidates rather than a chosen answer',async()=>{
 const v=followup.additionalCases.find(x=>x.id==='four-mirror-ambiguous');
 const r=await runProblemEvidence({inputBytes:bytes(requestFrom(v)),outputPath:fresh()});
 assert.equal(r.exitCode,2);assert.equal(r.report.results[0].status,'multiple-solutions');
 assert.equal(r.report.results[0].value,null);
 assert.deepEqual(r.report.results[0].candidateIncidenceAnglesDeg,[10,50]);
 assert.equal(r.report.native.status,'not-run');
});
test('optional native verification cannot silently invent finite source or mirror geometry',async()=>{
 const input=structuredClone(followup.request);input.verifyNative=true;
 const r=await runProblemEvidence({inputBytes:bytes(input),outputPath:fresh(),
  execute:()=>{throw Error('Native must not run');}});
 assert.equal(r.exitCode,2);assert.equal(r.report.results[0].status,'conditional');
 assert.equal(r.report.native.status,'not-run');assert.equal(r.report.portable.status,'not-created');
});
test('missing outgoing line condition does not turn into a silently chosen parallel direction',async()=>{
 const input=structuredClone(followup.request);delete input.requests[0].outgoingRelation;
 const r=await runProblemEvidence({inputBytes:bytes(input),outputPath:fresh()});
 assert.equal(r.exitCode,2);assert.equal(r.report.results[0].status,'needs-information');
 assert.equal(r.report.native.status,'not-run');
});
