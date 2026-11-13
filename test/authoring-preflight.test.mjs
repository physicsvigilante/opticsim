import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const fresh=()=>resolve('test-artifacts/llm-authoring/preflight-'+randomUUID());
const hash=x=>createHash('sha256').update(x).digest('hex');
function lens(){
 return {format:'opticsim-problem-v1',physical:{lengthUnit:'cm',components:[
  {id:'S',type:'point-source',parameters:{x:-30,y:2,brightness:.08},emission:{mode:'full-circle'}},
  {id:'L',type:'ideal-lens',parameters:{x:0,focalLength:10,apertureHeight:10}}
 ]},requests:[{id:'r1',kind:'source-emissions'},{id:'r2',kind:'ideal-image'}]};
}
function twoSources(){
 return {format:'opticsim-problem-v1',physical:{lengthUnit:'mm',components:[
  {id:'A',type:'point-source',parameters:{x:-30,y:4,brightness:.08},emission:{mode:'full-circle'}},
  {id:'B',type:'point-source',parameters:{x:-50,y:-4,brightness:.08},emission:{mode:'full-circle'}}
 ]},requests:[{id:'r1',kind:'source-emissions'}]};
}
test('preflight records a sole compatible target and keeps submitted bytes and source request untouched',()=>{
 const input=lens(),original=structuredClone(input),plan=planProblem(input);
 assert.deepEqual(input,original);
 assert.deepEqual(plan.request,original);
 assert.deepEqual(plan.targetBindings,[
  {requestId:'r1',kind:'source-emissions',componentId:'S',rule:'sole-compatible-authored-component'},
  {requestId:'r2',kind:'ideal-image',componentId:'S',rule:'sole-compatible-authored-component'}
 ]);
 assert.deepEqual(plan.nativeRequests,[
  {id:'r1',kind:'source-emissions',componentId:'S'},
  {id:'r2',kind:'ideal-image',componentId:'S'}]);
 assert.equal(plan.native.canRun,true);
 assert.equal(plan.results[0].status,'pending');
 const caps=problemWorkflowCapabilities();
 assert.match(caps.policy,/exactly one compatible authored component/);
});
test('ambiguous source targets ask for an ID and do not start native tracing',async()=>{
 const input=twoSources(),plan=planProblem(input);
 assert.equal(plan.scene.physics.model,'general-component-tracing');
 assert.equal(plan.native.canRun,false);
 assert.deepEqual(plan.nativeRequests,[]);
 assert.deepEqual(plan.targetBindings,[]);
 assert.equal(plan.results[0].status,'needs-information');
 assert.equal(plan.results[0].reasonCode,'AMBIGUOUS_COMPONENT_TARGET');
 assert.deepEqual(plan.results[0].candidateComponentIds,['A','B']);
 const result=await runProblemEvidence({inputBytes:bytes(input),outputPath:fresh(),
  execute:()=>{throw Error('ambiguous target must never execute');}});
 assert.equal(result.report.native.status,'not-run');
 assert.equal(result.report.results[0].reasonCode,'AMBIGUOUS_COMPONENT_TARGET');
 assert.equal(result.report.dispatch.nativeCalls,0);
 assert.equal(result.exitCode,2);
});
test('no compatible component is unavailable without substituting an apparatus',()=>{
 const input=lens();input.requests=[{id:'crossing',kind:'detector-crossings'}];
 const plan=planProblem(input);
 assert.equal(plan.native.canRun,false);
 assert.equal(plan.results[0].reasonCode,'NO_COMPATIBLE_COMPONENT');
 assert.equal(plan.results[0].status,'unavailable');
 assert.deepEqual(plan.results[0].candidateComponentIds,[]);
});
test('explicit component IDs are preserved, including in multi-source scenes',()=>{
 const input=twoSources();input.requests[0].componentId='B';
 const plan=planProblem(input);
 assert.deepEqual(plan.nativeRequests,input.requests);
 assert.equal(plan.targetBindings.length,0);
 assert.equal(plan.native.canRun,true);
});
test('prism observations are bound only to the unique authored prism, never a guessed entrance face',()=>{
 const authored=JSON.parse(readFileSync(new URL('../examples/triangular-prism.json',import.meta.url)));
 const input={format:'opticsim-problem-v1',physical:authored.physical,
  requests:[{id:'faces',kind:'interface-face-events'}]};
 const plan=planProblem(input);
 assert.equal(plan.native.canRun,true);
 assert.equal(plan.targetBindings.length,1);
 assert.equal(plan.targetBindings[0].componentId,
  plan.scene.physics.components.find(c=>c.type==='triangular-prism').id);
 assert.equal(plan.nativeRequests[0].componentId,plan.targetBindings[0].componentId);
});
test('missing physical facts are not bypassed by singleton inference',()=>{
 const input=lens();delete input.physical.components[1].parameters.focalLength;
 const plan=planProblem(input);
 assert.equal(plan.scene,null);
 assert.equal(plan.native.canRun,false);
 assert.equal(plan.targetBindings.length,0);
 assert.equal(plan.results[0].status,'needs-information');
});
test('verified native evidence persists unique bindings and original request SHA without repairs',async()=>{
 const input=lens(),raw=bytes(input);
 const result=await runProblemEvidence({inputBytes:raw,outputPath:fresh(),
   execute:scene=>evaluateDocument(scene,core)});
 assert.equal(result.exitCode,0);
 assert.equal(result.report.native.status,'completed');
 assert.equal(result.report.targetBindings.length,2);
 assert.equal(result.report.inputSha256,hash(raw));
 assert.equal(result.report.dispatch.repairs,0);
 const q=await parseQualifiedBundle(readFileSync(resolve(result.output,'qualified-scene.json'),'utf8'));
 assert.equal(q.qualification.origin.inputSha256,hash(raw));
 assert.deepEqual(q.observables,[
  {id:'r1',kind:'source-emissions',componentId:'S'},
  {id:'r2',kind:'ideal-image',componentId:'S'}]);
 assert.equal(result.report.results[1].status,'conditional');
 assert.ok(result.report.results[0].value>0);
 const recorded=JSON.parse(readFileSync(resolve(result.output,'input.json'),'utf8'));
 assert.deepEqual(recorded,input);
});
test('standalone CLI preflights without native calls, writes nothing and reports ambiguous targets',()=>{
 const input=twoSources(),folder=resolve('test-artifacts/llm-authoring');
 mkdirSync(folder,{recursive:true});
 const path=resolve(folder,'preflight-input-'+randomUUID()+'.json');
 const raw=bytes(input);writeFileSync(path,raw,{flag:'wx'});
 let stdout='';
 try{execFileSync(process.execPath,['scripts/preflight-problem.mjs',path],{encoding:'utf8'});}
 catch(error){assert.equal(error.status,2);stdout=error.stdout;}
 const report=JSON.parse(stdout);
 assert.equal(report.format,'opticsim-problem-preflight-v1');
 assert.equal(report.inputSha256,hash(raw));
 assert.equal(report.status,'blocked');
 assert.equal(report.native.status,'not-run');
 assert.equal(report.native.calls,0);
 assert.equal(report.results[0].reasonCode,'AMBIGUOUS_COMPONENT_TARGET');
 assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),input);
 const goodPath=resolve(folder,'preflight-input-'+randomUUID()+'.json');
 writeFileSync(goodPath,bytes(lens()),{flag:'wx'});
 const good=JSON.parse(execFileSync(process.execPath,['scripts/preflight-problem.mjs',goodPath],{encoding:'utf8'}));
 assert.equal(good.status,'native-ready');
 assert.equal(good.native.status,'not-run');
 assert.equal(good.targetBindings.length,2);
});
