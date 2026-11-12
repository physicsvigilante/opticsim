import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {observableCapabilities} from '../src/observables.js';
import {parseQualifiedBundle} from '../src/qualification.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const priors=JSON.parse(readFileSync(new URL('../evaluation/original-refraction-pair-v1/first-attempt.json',import.meta.url)));
const reduced=JSON.parse(readFileSync(new URL('../evaluation/planar-angular-v1/reduced-facts.json',import.meta.url)));
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const fresh=()=>resolve('test-artifacts/llm-authoring/unified-test-'+randomUUID());
const angle=(i=0)=>{const c=structuredClone(reduced.cases[i]);const {format,...q}=c.query;return {format:'opticsim-problem-v1',physical:c.input,requests:[{id:'angle',...q}]};};
const lens=()=>({format:'opticsim-problem-v1',physical:{lengthUnit:'cm',components:[
  {id:'S',type:'point-source',parameters:{x:-30,y:2,brightness:.08},emission:{mode:'full-circle'}},
  {id:'L',type:'ideal-lens',parameters:{x:0,focalLength:10,apertureHeight:10}}
]},requests:[{id:'image',kind:'ideal-image',componentId:'S'},{id:'emissions',kind:'source-emissions',componentId:'S'}],
 interpretation:{requestedResult:'Conditional image and sampled emissions for a declared synthetic source.',assumptions:['Synthetic emitting point, not a real-question claim.']}});
const execute=scene=>evaluateDocument(scene,core);
test('unified capabilities expose live contracts without a new physics vocabulary',()=>{
 const c=problemWorkflowCapabilities();
 for(const k of Object.keys(observableCapabilities().kinds))assert.ok(c.requestKinds[k]);
 assert.equal(c.requestKinds['critical-input-angle'].route,'conditional-analytical');
 assert.equal(c.angular.factsFormat,'opticsim-planar-angular-facts-v1');
 assert.equal(c.authoring.componentTypes['ideal-lens'].parameters.includes('focalLength'),true);
});
test('angular facts calculate without native work, invented brightness or coordinates',async()=>{
 const input=angle(),original=structuredClone(input);let calls=0;
 const r=await runProblemEvidence({inputBytes:bytes(input),outputPath:fresh(),execute:()=>{calls++;throw Error('should not run');}});
 assert.equal(calls,0);assert.equal(r.exitCode,0);
 assert.equal(r.report.results[0].status,'conditional');
 assert.ok(Math.abs(r.report.results[0].value.initialIncidenceAngleDeg-54.3409123039)<1e-8);
 assert.equal(r.report.native.status,'not-run');assert.equal(r.report.portable.status,'not-created');
 assert.equal(r.report.coverage.status,'all-requested-quantities-available');
 assert.equal(r.report.questionSupport,'not-assessed-by-engine');assert.deepEqual(input,original);
});
test('one native run supplies several observables and carries author assumptions',async()=>{
 const input=lens();let calls=0;
 const r=await runProblemEvidence({inputBytes:bytes(input),outputPath:fresh(),execute:scene=>{calls++;return execute(scene);}});
 assert.equal(calls,1);assert.equal(r.exitCode,0);assert.equal(r.report.native.status,'completed');
 assert.equal(r.report.results[0].status,'conditional');assert.ok(r.report.results[1].value>0);
 const q=await parseQualifiedBundle(readFileSync(resolve(r.output,'qualified-scene.json'),'utf8'));
 assert.deepEqual(q.qualification.interpretation,input.interpretation);
 assert.equal(q.qualification.origin.inputSha256,r.report.inputSha256);
});
test('mixed branch calculation and incomplete native evidence remain separately qualified',async()=>{
 const p=angle(1);p.physical=structuredClone(priors.cases.find(c=>c.id==='B06').request);
 p.requests.push({id:'air-native',kind:'interface-transmission-angle',componentId:'I1A'});
 let calls=0;const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh(),execute:s=>{calls++;return execute(s);}});
 assert.equal(calls,1);assert.equal(r.report.native.status,'incomplete');assert.equal(r.exitCode,2);
 assert.equal(r.report.results[0].status,'conditional');assert.equal(r.report.results[1].status,'suppressed');
 assert.equal(r.report.results[1].value,null);assert.equal(r.report.coverage.status,'partially-available');
 const q=await parseQualifiedBundle(readFileSync(resolve(r.output,'qualified-scene.json'),'utf8'));
 assert.equal(q.qualification.calculations[0].kind,'branch-angles');
});
test('unknown quantity is unavailable without inference, native execution or retry',async()=>{
 const p={format:'opticsim-problem-v1',physical:null,requests:[{id:'unsupported',kind:'curved-mirror-image-velocity'}]};
 const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh(),execute:()=>{throw Error('must not run');}});
 assert.equal(r.report.results[0].reasonCode,'UNSUPPORTED_QUANTITY');assert.equal(r.report.results[0].value,null);
 assert.equal(r.report.dispatch.nativeCalls,0);assert.equal(r.report.dispatch.repairs,0);assert.equal(r.exitCode,2);
});
test('missing native input is neither inferred nor confused with an unsupported requested method',async()=>{
 const p=lens();delete p.physical.components[1].parameters.focalLength;
 const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh(),execute:()=>{throw Error('must not run');}});
 assert.equal(r.report.preparation.status,'needs-information');assert.equal(r.report.native.status,'not-run');
 assert.ok(r.report.results.every(x=>x.status==='needs-information'));
 assert.equal(r.report.portable.status,'not-created');
});
test('explicit illustrative choices stay in ordinary qualified package, never silently enabled',async()=>{
 const p=lens();delete p.physical.components[0].parameters.brightness;
 delete p.physical.components[0].emission;delete p.physical.components[1].parameters.apertureHeight;
 assert.equal(planProblem(p).scene,null);
 p.illustration=true;const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh(),execute});
 assert.equal(r.report.preparation.status,'illustrative');assert.equal(r.report.preparation.appliedChoices.length,3);
 const q=await parseQualifiedBundle(readFileSync(resolve(r.output,'qualified-scene.json'),'utf8'));
 assert.equal(q.qualification.assumptions.length,3);assert.equal(q.qualification.origin.preparationStatus,'illustrative');
});
test('native setup failure preserves angular plan/results and suppresses only gated requests',async()=>{
 const p=angle(1);p.physical=structuredClone(priors.cases.find(c=>c.id==='B06').request);
 p.requests.push({id:'native',kind:'source-emissions',componentId:'S1'});const out=fresh();
 const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:out,execute:()=>{
   assert.ok(existsSync(resolve(out,'analytical-results.json')));throw Error('injected native build failure');}});
 assert.equal(r.exitCode,2);assert.equal(r.report.native.status,'failed');
 assert.equal(r.report.results[0].status,'conditional');assert.equal(r.report.results[1].status,'suppressed');
 assert.ok(existsSync(resolve(out,'plan.json')));assert.ok(existsSync(resolve(out,'report.json')));
});
test('stale native execution evidence is not accepted',async()=>{
 const r=await runProblemEvidence({inputBytes:bytes(lens()),outputPath:fresh(),execute:()=>({summary:{canonicalSha256:'0'.repeat(64),executionPassed:true}})});
 assert.equal(r.report.native.status,'failed');assert.ok(r.report.results.every(x=>x.status==='suppressed'));
});
test('contradictory inverse scenes are not silently selected for native tracing',async()=>{
 const p=angle();p.physical=structuredClone(priors.cases.find(c=>c.id==='B05').request);
 p.requests.push({...p.requests[0],id:'other-direction',tangentSide:'positive'});p.verifyNative=true;
 const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh(),execute:()=>{throw Error('not selected');}});
 assert.equal(r.report.native.status,'not-run');assert.equal(r.report.portable.status,'not-created');
 assert.ok(r.report.diagnostics.some(x=>x.code==='CONFLICTING_FORWARD_SCENES'));assert.equal(r.exitCode,2);
 assert.ok(r.report.results.every(x=>x.status==='conditional'));
});
test('malformed envelopes and duplicate IDs leave structured rejection reports',async()=>{
 for(const p of [{...lens(),script:'eval()'},{...lens(),verifyNative:'yes'},
  {...lens(),requests:[lens().requests[0],lens().requests[0]]}]){
  const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh()});
  assert.equal(r.exitCode,1);assert.equal(r.report.status,'rejected');assert.equal(r.report.native.status,'not-run');
 }
});
test('asynchronous caller mutation cannot change the planned problem',async()=>{
 const input=lens(),raw=bytes(input);let entered;
 const gate=new Promise(ok=>{entered=ok;});let release;const wait=new Promise(ok=>release=ok);
 const task=runProblemEvidence({inputBytes:raw,outputPath:fresh(),execute:async scene=>{entered();await wait;return execute(scene);}});
 await gate;raw.fill(0);input.physical.components[1].parameters.focalLength=1000;release();
 const r=await task;assert.equal(r.exitCode,0);assert.equal(r.report.results[0].value.x,150);
});
