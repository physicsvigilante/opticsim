import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,cpSync,existsSync,rmSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {analyzePrismAngleQuery,prismAngularCapabilities,PRISM_FACTS_FORMAT,PRISM_QUERY_FORMAT} from '../src/prism-angle-queries.js';
import {analyzePlanarAngleQuery} from '../src/planar-angle-queries.js';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {vectorPrismReference,bisectedPrismIndex} from './helpers/prism-angular-reference.mjs';
import {planarPreservationCases} from './helpers/planar-angle-preservation.mjs';
const q=kind=>({format:PRISM_QUERY_FORMAT,kind});
const base=()=>({format:PRISM_FACTS_FORMAT,model:'homogeneous-prism',branch:'direct-two-face-transmission',angleConvention:'normal-angles-signed-deviation',prismAngleDeg:60,incidenceAngleDeg:45,outsideIndex:1,insideIndex:1.5});
const forward=f=>analyzePrismAngleQuery(f,q('prism-direct-angles'));
const inverse=f=>analyzePrismAngleQuery(f,q('prism-direct-index'));
const problem=(physical=base(),kind='prism-direct-angles')=>({format:'opticsim-problem-v1',physical,requests:[{id:'angles',kind}]});
const close=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const invFacts=f=>{const ref=vectorPrismReference(f.prismAngleDeg,f.incidenceAngleDeg,f.outsideIndex,f.insideIndex),x={...f,deviationDeg:ref.delta};delete x.insideIndex;return x;};

test('shared extraction preserves 102 exact original planar outcomes including rejected grazing inputs',()=>{
 const g=JSON.parse(readFileSync(new URL('./fixtures/prism-planar-preservation.json',import.meta.url)));
 const hash=s=>createHash('sha256').update(s).digest('hex'),cases=planarPreservationCases();
 assert.equal(g.baselineCommit,'8f8edc905348d7cac8babe55f823740556fa8027');assert.equal(cases.length,102);
 assert.equal(hash(JSON.stringify(cases)),g.inputSha256);
 assert.deepEqual(cases.map(x=>{let out;try{out={result:analyzePlanarAngleQuery(x.facts,x.query)};}catch(e){out={error:e.message};}return hash(JSON.stringify(out));}),g.resultSha256);
});
test('forward conventional prism gives conditional angles without creating rays or mutating facts',()=>{
 const f=base(),copy=structuredClone(f),r=forward(f);assert.equal(r.status,'conditional');assert.deepEqual(f,copy);
 close(r.value.entryRefractionAngleDeg,28.125505702055705);close(r.value.emergenceAngleDeg,52.381306483361165);
 close(r.value.deviationDeg,37.38130648336116);assert.equal(r.native.status,'not-run');assert.equal(r.native.observations,null);
 assert.equal(r.proposedForwardScene,undefined);assert.equal(r.canonicalForwardScene,undefined);
 const p=planProblem(problem());assert.equal(p.scene,null);assert.equal(p.native.required,false);assert.equal(p.results[0].nativeObservation,false);
 assert.equal(p.methodSuitability.entries[0].familyCompatibility,'form-compatible');
});
test('inverse index uses known incidence, not an assumed symmetric or minimum-deviation ray',()=>{
 const f=invFacts(base()),original=structuredClone(f),r=inverse(f);
 assert.equal(r.status,'conditional');close(r.value.insideIndex,1.5);assert.deepEqual(f,original);
 assert.equal(r.candidates.length,1);assert.equal(r.solutionMultiplicity,'unique-within-declared-branch');
 assert.ok(Math.abs(r.value.incidenceAngleDeg-r.value.emergenceAngleDeg)>1);
 close(bisectedPrismIndex(f.prismAngleDeg,f.incidenceAngleDeg,f.deviationDeg,f.outsideIndex),r.value.insideIndex);
});
test('independent vector and bracketed references exercise air, immersed, lower-index and asymmetric angles',()=>{
 let good=0,refused=0;
 for(const A of [25,40,60,80,110])for(const i of [15,30,45,60])for(const [n0,n] of [[1,1.5],[1.33,1.6],[1.5,1.25],[1.33,1.33],[1,1.05]]){
  const f={...base(),prismAngleDeg:A,incidenceAngleDeg:i,outsideIndex:n0,insideIndex:n};
  const ref=vectorPrismReference(A,i,n0,n),r=forward(f);
  if(ref.outcome!=='direct'){assert.notEqual(r.status,'conditional');refused++;continue;}
  if(r.status==='numerically-indeterminate'){refused++;continue;}
  assert.equal(r.status,'conditional');close(r.value.entryRefractionAngleDeg,ref.r1);close(r.value.exitIncidenceAngleDeg,ref.r2);
  close(r.value.emergenceAngleDeg,ref.e);close(r.value.deviationDeg,ref.delta);
  const inv=inverse(invFacts(f));assert.equal(inv.status,'conditional');close(inv.value.insideIndex,n);
  close(inv.value.insideIndex,bisectedPrismIndex(A,i,ref.delta,n0));good++;
 }assert.ok(good>=25);assert.ok(refused>=10);
});
test('signed negative deviation and matched-index rays do not inherit air or critical defaults',()=>{
 const f={...base(),prismAngleDeg:45,incidenceAngleDeg:25,insideIndex:1.25,outsideIndex:1.5};
 const r=forward(f);assert.equal(r.status,'conditional');assert.ok(r.value.deviationDeg<0);close(inverse(invFacts(f)).value.insideIndex,1.25);
 const same=forward({...base(),insideIndex:1.33,outsideIndex:1.33});assert.equal(same.status,'conditional');close(same.value.deviationDeg,0);
 close(same.value.entryRefractionAngleDeg,45);close(same.value.emergenceAngleDeg,15);
});
test('normal incidence, normal emergence and reciprocity are qualified only on their stated branch',()=>{
 const f={...base(),prismAngleDeg:30,incidenceAngleDeg:0},r=forward(f);assert.equal(r.status,'conditional');close(r.value.entryRefractionAngleDeg,0);close(r.value.emergenceAngleDeg,48.59037789072914);
 close(inverse(invFacts(f)).value.insideIndex,1.5);
 const a=forward(base()),back=forward({...base(),incidenceAngleDeg:a.value.emergenceAngleDeg});
 close(back.value.emergenceAngleDeg,45);close(back.value.deviationDeg,a.value.deviationDeg);
 const normal=forward({...base(),prismAngleDeg:30,incidenceAngleDeg:30,insideIndex:1,outsideIndex:1});assert.equal(normal.status,'conditional');close(normal.value.emergenceAngleDeg,0);
});
test('TIR at either face has no invented transmitted emergence or total deviation',()=>{
 const entry=forward({...base(),incidenceAngleDeg:60,outsideIndex:1.5,insideIndex:1});assert.equal(entry.status,'unavailable');assert.equal(entry.reasonCode,'TOTAL_INTERNAL_REFLECTION_ENTRY');assert.equal(entry.value,null);
 const exit=forward({...base(),incidenceAngleDeg:0});assert.equal(exit.status,'unavailable');assert.equal(exit.reasonCode,'TOTAL_INTERNAL_REFLECTION_EXIT');assert.equal(exit.value,null);
});
test('critical, nearly degenerate and grazing cases remain numerically indeterminate',()=>{
 const critical=Math.asin(1/1.5)*180/Math.PI;
 for(const f of [{...base(),incidenceAngleDeg:critical,outsideIndex:1.5,insideIndex:1},
  {...base(),prismAngleDeg:critical,incidenceAngleDeg:0},{...base(),prismAngleDeg:1e-12},
  {...base(),prismAngleDeg:180-1e-12},{...base(),incidenceAngleDeg:90-1e-12}]){
  const r=forward(f);assert.equal(r.status,'numerically-indeterminate');assert.equal(r.value,null);
 }
 const below=forward({...base(),prismAngleDeg:critical-1e-5,incidenceAngleDeg:0});assert.equal(below.status,'conditional');
 const above=forward({...base(),prismAngleDeg:critical+1e-5,incidenceAngleDeg:0});assert.equal(above.reasonCode,'TOTAL_INTERNAL_REFLECTION_EXIT');
});
test('wrong-side and backward exit branches are not repaired by absolute values',()=>{
 const negative=forward({...base(),prismAngleDeg:10,incidenceAngleDeg:60});assert.equal(negative.reasonCode,'OUTSIDE_DECLARED_BRANCH');
 const backward=forward({...base(),prismAngleDeg:120,incidenceAngleDeg:0});assert.equal(backward.reasonCode,'OUTSIDE_DECLARED_BRANCH');
 for(const delta of [-100,120]){const f={...base(),deviationDeg:delta};delete f.insideIndex;const r=inverse(f);assert.equal(r.status,'unavailable');assert.equal(r.value,null);}
 const f={...base(),prismAngleDeg:30,incidenceAngleDeg:0,deviationDeg:-30};delete f.insideIndex;assert.equal(inverse(f).reasonCode,'NO_ADMISSIBLE_INDEX');
});
test('missing or ambiguous facts cannot be replaced by a minimum-deviation or air assumption',()=>{
 for(const key of ['model','branch','angleConvention','prismAngleDeg','incidenceAngleDeg','outsideIndex','insideIndex']){
  const f=base();delete f[key];const p=planProblem(problem(f));assert.equal(p.results[0].status,'needs-information');assert.equal(p.scene,null);
 }
 const inv=invFacts(base());delete inv.incidenceAngleDeg;assert.equal(planProblem(problem(inv,'prism-direct-index')).results[0].status,'needs-information');
 for(const [key,value] of [['branch','unknown'],['branch','one-internal-reflection'],['angleConvention','unsigned-deviation'],['model','graded-index']]){
  const f={...base(),[key]:value};assert.equal(planProblem(problem(f)).results[0].status,'unavailable');
 }
});
test('malformed, extra or overdetermined facts are not silently ignored',()=>{
 for(const edit of [f=>{f.deviationDeg=0;},f=>{f.insideIndex='1.5';},f=>{f.outsideIndex=null;},f=>{f.prismAngleDeg=0;},
  f=>{f.incidenceAngleDeg=90;},f=>{f.components=[];},f=>{f.partialReflection=false;}]){
  const f=base();edit(f);assert.equal(planProblem(problem(f)).results[0].status,'invalid-input');
 }
 assert.throws(()=>planProblem(problem({...base(),prismAngleDeg:NaN})),/finite JSON/);
 const known=base();known.deviationDeg=37;assert.equal(planProblem(problem(known,'prism-direct-index')).results[0].status,'invalid-input');
 const limits=base();limits.insideIndex=5;assert.equal(planProblem(problem(limits)).results[0].status,'unavailable');
});
test('capabilities are defensive, native verification remains unresolved and old kinds are not substituted',()=>{
 const a=prismAngularCapabilities();a.kinds.push('anything');a.bounds.refractiveIndex[0]=0;assert.equal(prismAngularCapabilities().kinds.length,2);assert.equal(prismAngularCapabilities().bounds.refractiveIndex[0],1);
 const p=problem();p.verifyNative=true;const plan=planProblem(p);assert.equal(plan.results[0].status,'conditional');assert.equal(plan.native.required,true);assert.equal(plan.native.canRun,false);assert.equal(plan.scene,null);
 const q=problem();q.requests.push({id:'native',kind:'interface-transmission-angle',componentId:'P'});assert.equal(planProblem(q).results[1].status,'needs-information');
 const old=problem();old.requests=[{id:'old',kind:'prism-emergence-angle'}];assert.equal(planProblem(old).results[0].reasonCode,'UNSUPPORTED_QUANTITY');
 assert.ok(problemWorkflowCapabilities().prismAngular);
});
test('existing public CLIs execute analytical prism facts without vendor, dist or native calls',()=>{
 const root=resolve('test-artifacts/prism-angular-development');mkdirSync(root,{recursive:true});const dir=mkdtempSync(resolve(root,'isolated-'));
 for(const path of ['src','scripts','skills'])cpSync(path,resolve(dir,path),{recursive:true});cpSync('package.json',resolve(dir,'package.json'));cpSync('upstream-pin.json',resolve(dir,'upstream-pin.json'));
 writeFileSync(resolve(dir,'input.json'),JSON.stringify(problem()));assert.equal(existsSync(resolve(dir,'vendor')),false);
 let run=spawnSync(process.execPath,['scripts/preflight-problem.mjs','input.json'],{cwd:dir,encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);
 run=spawnSync(process.execPath,['scripts/run-problem.mjs','input.json','--out','test-artifacts/llm-authoring/run'],{cwd:dir,encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);
 const report=JSON.parse(readFileSync(resolve(dir,'test-artifacts/llm-authoring/run/report.json')));assert.equal(report.dispatch.nativeCalls,0);assert.equal(report.portable.status,'not-created');assert.equal(existsSync(resolve(dir,'dist')),false);
 rmSync(dir,{recursive:true,force:true});
});
