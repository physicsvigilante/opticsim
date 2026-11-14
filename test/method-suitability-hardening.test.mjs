import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const fresh=()=>resolve('test-artifacts/llm-authoring/method-hardening-'+randomUUID());
const reflection=()=>({format:'opticsim-problem-v1',physical:{format:'opticsim-reduced-inverse-facts-v1',model:'plane-mirror',lengthUnit:'cm',mirror:{x:0,y:0,tangentDeg:0},points:{A:{x:0,y:5},B:{x:20,y:20}}},requests:[{id:'hit',kind:'plane-mirror-reflection-point'}]});
const source=kind=>({format:'opticsim-problem-v1',physical:{lengthUnit:'mm',components:[{id:'S',type:'point-source',parameters:{x:-200,y:0,brightness:0.08},emission:{mode:'full-circle'}}]},requests:[{id:'out',kind,componentId:'S'}]});
function preflight(input){
 const file=fresh()+'.json';mkdirSync(resolve('test-artifacts/llm-authoring'),{recursive:true});
 writeFileSync(file,bytes(input),{flag:'wx'});
 try{const child=spawnSync(process.execPath,['scripts/preflight-problem.mjs',file],{encoding:'utf8',timeout:15000});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);
  return {exitCode:child.status,report:JSON.parse(child.stdout)};
 }finally{rmSync(file,{force:true});}
}
function partialBranches(nearCritical=false){
 return {format:'opticsim-problem-v1',physical:{format:'opticsim-planar-angular-facts-v1',
  source:{id:'S',region:0,incidentAngleDeg:nearCritical?Math.asin(1/1.5)*180/Math.PI:60,approach:'positive'},
  interfaces:nearCritical?[{id:'I1',negativeIndex:1.5,positiveIndex:1.4},{id:'I2',negativeIndex:1.4,positiveIndex:1}]:[{id:'I1',negativeIndex:1.5,positiveIndex:1}]},
  requests:[{id:'branches',kind:'branch-angles',sourceId:'S',branches:[
   {id:'reflected',events:[{interfaceId:'I1',action:'reflect'}]},
   {id:'transmitted',events:nearCritical?[{interfaceId:'I1',action:'transmit'},{interfaceId:'I2',action:'transmit'}]:[{interfaceId:'I1',action:'transmit'}]}
  ]}]};
}
test('editing returned fact families cannot poison later audits or sibling entries',()=>{
 const input=reflection();input.requests.push({id:'second',kind:'plane-mirror-reflection-point'});
 const p=planProblem(input),exposed=p.methodSuitability.entries[0].acceptedInputFamilies,before=[...exposed];
 try{exposed.push('invented-facts');exposed[0]='corrupt-format';
  assert.deepEqual(p.methodSuitability.entries[1].acceptedInputFamilies,before);
  const next=planProblem(reflection());
  assert.deepEqual(next.methodSuitability.entries[0].acceptedInputFamilies,before);
  assert.equal(next.methodSuitability.entries[0].familyCompatibility,'form-compatible');
 }finally{exposed.splice(0,exposed.length,...before);}
});
test('capability type arrays cannot authorize absorption measurements on sources',()=>{
 const types=problemWorkflowCapabilities().requestKinds['blocker-absorptions'].type,before=[...types];
 try{types.push('point-source');
  const p=planProblem(source('blocker-absorptions'));
  assert.equal(p.results[0].reasonCode,'INCOMPATIBLE_COMPONENT_TARGET');assert.equal(p.native.canRun,false);
  assert.deepEqual(problemWorkflowCapabilities().requestKinds['blocker-absorptions'].type,before);
 }finally{types.splice(0,types.length,...before);}
});
test('nested solver capability lists cannot mutate method registration',()=>{
 const caps=problemWorkflowCapabilities(),kinds=caps.curvedMirrors.kinds,before=[...kinds];
 try{kinds.splice(0,kinds.length,'fake-calculation');
  caps.methodSuitability.contractFamilies['opticsim-reduced-inverse-query-v1'].push('fake-family');
  const next=problemWorkflowCapabilities();assert.deepEqual(next.curvedMirrors.kinds,before);
  assert.equal(Object.hasOwn(next.requestKinds,'fake-calculation'),false);
  assert.deepEqual(next.methodSuitability.contractFamilies['opticsim-reduced-inverse-query-v1'],['opticsim-reduced-inverse-facts-v1']);
 }finally{kinds.splice(0,kinds.length,...before);}
});
test('partial branch absence is blocked without erasing the valid reflected branch',async()=>{
 const request=partialBranches(),p=planProblem(request);
 assert.equal(p.results[0].status,'partially-unavailable');
 assert.deepEqual(p.results[0].branches.map(x=>x.status),['conditional','unavailable']);
 assert.equal(p.methodSuitability.entries[0].readiness,'partially-unavailable');
 const checked=preflight(request);assert.equal(checked.exitCode,2);assert.equal(checked.report.status,'blocked');
 assert.equal(checked.report.native.calls,0);
 assert.ok(Math.abs(checked.report.results[0].branches[0].value.exitAngleDeg-60)<1e-9);
 let calls=0;const done=await runProblemEvidence({inputBytes:bytes(request),outputPath:fresh(),execute:()=>{calls++;throw Error('must not run');}});
 assert.equal(done.exitCode,2);assert.equal(calls,0);assert.equal(done.report.results[0].status,'partially-unavailable');
});
test('partially indeterminate branches cannot pass a success-only preflight gate',()=>{
 const request=partialBranches(true),p=planProblem(request);assert.equal(p.results[0].status,'partially-indeterminate');
 assert.equal(p.methodSuitability.entries[0].readiness,'partially-indeterminate');
 const checked=preflight(request);assert.equal(checked.exitCode,2);assert.equal(checked.report.status,'blocked');
 assert.equal(checked.report.native.calls,0);
 assert.deepEqual(checked.report.results[0].branches.map(x=>x.status),['conditional','numerically-indeterminate']);
});
test('unfulfilled requested native verification blocks preflight while retaining analytical math',async()=>{
 const request=reflection();request.verifyNative=true;const checked=preflight(request);
 assert.equal(checked.exitCode,2);assert.equal(checked.report.status,'blocked');
 assert.equal(checked.report.native.required,true);assert.equal(checked.report.native.canRun,false);
 assert.equal(checked.report.results[0].status,'conditional');assert.equal(checked.report.results[0].value.reflectionPoint.x,4);
 let calls=0;const done=await runProblemEvidence({inputBytes:bytes(request),outputPath:fresh(),execute:()=>{calls++;throw Error('must not run');}});
 assert.equal(done.exitCode,2);assert.equal(calls,0);assert.equal(done.report.results[0].value.reflectionPoint.x,4);
});
test('ordinary analytical and target-validated native plans retain successful preflight',()=>{
 const a=preflight(reflection());assert.equal(a.exitCode,0);assert.equal(a.report.status,'no-native-required');
 const n=preflight(source('source-emissions'));assert.equal(n.exitCode,0);assert.equal(n.report.status,'native-ready');
 assert.equal(n.report.native.calls,0);assert.equal(n.report.results[0].status,'pending');
});
test('saved method audit explicitly identifies the pre-execution assessment phase',async()=>{
 const done=await runProblemEvidence({inputBytes:bytes(reflection()),outputPath:fresh(),execute:()=>{throw Error('must not run');}});
 assert.equal(done.exitCode,0);assert.equal(done.report.methodSuitability.phase,'pre-execution-plan');
 const disk=JSON.parse(readFileSync(resolve(done.output,'report.json')));
 assert.deepEqual(disk.methodSuitability,done.report.methodSuitability);
 assert.equal(done.report.questionSupport,'not-assessed-by-engine');
});
