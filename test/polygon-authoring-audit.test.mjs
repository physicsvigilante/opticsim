import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {LENGTH_PARAMETERS} from '../src/contract.js';
import {planProblem} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {physicalSignatures,scoreAuthoring} from '../evaluation/cross-family-prospective-v3/replay.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/polygon-dielectric.json',import.meta.url)));
const fresh=()=>resolve('test-artifacts/llm-authoring/polygon-audit-'+randomUUID());
const raw=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const convert=(physical,unit,factor)=>{
 const p=structuredClone(physical);p.lengthUnit=unit;
 for(const c of p.components)for(const k of Object.keys(c.parameters))
  if(LENGTH_PARAMETERS.includes(k))c.parameters[k]*=factor;
 return p;
};
test('all four polygon vertex coordinates use the live length registry in authoring fidelity',()=>{
 const cm=structuredClone(fixture.physical),mm=convert(cm,'mm',10),m=convert(cm,'m',.01);
 for(const p of [mm,m])for(const includeIds of [true,false])
  assert.deepEqual(physicalSignatures(p,{includeIds}),physicalSignatures(cm,{includeIds}));
 // Invalid/missing controls must compare the stated physics, not repaired docs.
 cm.components[1].parameters.insideIndex=.7;
 const converted=convert(cm,'mm',10);
 const gold={id:'negative-polygon',classification:'invalid',expectedPhysical:cm,
  requestKinds:['interface-interactions'],expectedPreflight:'invalid-input',expectedFirstStatus:'invalid-input'};
 const request={...fixture,physical:converted,requests:[{id:'count',kind:'interface-interactions'}]};
 const run={report:{results:[{status:'invalid-input'}],dispatch:{nativeCalls:0,repairs:0,externalModelCalls:0},native:{status:'not-run'}}};
 const score=scoreAuthoring(gold,{response:request},{status:'invalid-input',native:{canRun:false}},run);
 assert.equal(score.physicalFidelity,true);assert.equal(score.idsFaithful,true);
 converted.components[1].parameters.x4+=1;
 assert.equal(scoreAuthoring(gold,{response:request},{status:'invalid-input'},run).physicalFidelity,false);
});
test('explicit absent or wrong-type measurement targets stop before native execution, without reassignment',async()=>{
 for(const [componentId,code,status] of [['missing','UNKNOWN_COMPONENT_TARGET','needs-information'],['S1','INCOMPATIBLE_COMPONENT_TARGET','unavailable']]){
  const request=structuredClone(fixture);request.requests=[{id:'count',kind:'interface-interactions',componentId}];
  const before=JSON.stringify(request),plan=planProblem(request);
  assert.equal(plan.native.canRun,false);
  assert.equal(plan.results[0].reasonCode,code);assert.equal(plan.results[0].status,status);
  assert.equal(plan.results[0].componentId,componentId);
  assert.deepEqual(plan.results[0].candidateComponentIds,['G1']);
  assert.deepEqual(plan.targetBindings,[]);assert.deepEqual(plan.nativeRequests,[]);
  assert.equal(JSON.stringify(request),before);assert.equal(plan.request.requests[0].componentId,componentId);
  const out=await runProblemEvidence({inputBytes:raw(request),outputPath:fresh(),execute:()=>{throw Error('Must not trace an invalid target');}});
  assert.equal(out.report.dispatch.nativeCalls,0);assert.equal(out.report.results[0].reasonCode,code);
 }
});
test('valid requests can execute alongside unresolved targets; explicit verifyNative remains an opt-in',async()=>{
 const request=structuredClone(fixture);
 request.requests=[{id:'wrong',kind:'interface-interactions',componentId:'S1'},{id:'right',kind:'interface-face-events'}];
 let count=0;
 const out=await runProblemEvidence({inputBytes:raw(request),outputPath:fresh(),execute:doc=>{count++;return evaluateDocument(doc,core);}});
 assert.equal(count,1);assert.equal(out.report.results[0].reasonCode,'INCOMPATIBLE_COMPONENT_TARGET');
 assert.equal(out.report.results[1].value['face-34'].interactions,1);
 assert.equal(out.report.targetBindings[0].componentId,'G1');
 request.requests.splice(1);request.verifyNative=true;
 const plan=planProblem(request);
 assert.equal(plan.native.canRun,true);assert.deepEqual(plan.nativeRequests,[]);
 assert.equal(plan.results[0].reasonCode,'INCOMPATIBLE_COMPONENT_TARGET');
});
