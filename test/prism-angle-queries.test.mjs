import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {analyzePrismAngleQuery,prismAngleCapabilities,PRISM_FACTS_FORMAT,PRISM_QUERY_FORMAT} from '../src/prism-angle-queries.js';
import {RAD,asinAngle,classifySnellTransmission} from '../src/angular-math.js';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {prismVectorReference} from './helpers/prism-vector-reference.mjs';
const base=()=>({format:PRISM_FACTS_FORMAT,model:'homogeneous-prism',branch:'direct-two-face-transmission',
 apexAngleDeg:60,incidenceAngleDeg:45,outsideIndex:1,insideIndex:Math.SQRT2});
const query=kind=>({format:PRISM_QUERY_FORMAT,kind});
const forward=f=>analyzePrismAngleQuery(f,query('prism-transmission-angles'));
const inverse=f=>analyzePrismAngleQuery(f,query('prism-index-from-deviation'));
const inv=(deviation=30,convention='signed')=>{const f=base();delete f.insideIndex;return {...f,deviationDeg:deviation,deviationConvention:convention};};
const problem=(f=base(),kind='prism-transmission-angles')=>({format:'opticsim-problem-v1',physical:f,requests:[{id:'angles',kind}]});
const close=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const error=code=>e=>e.code===code;

test('prism capabilities expose explicit physical conventions with defensive policy data',()=>{
 const a=prismAngleCapabilities();a.kinds.length=0;a.domain.refractiveIndex[0]=-2;a.limits.length=0;
 assert.equal(prismAngleCapabilities().kinds.length,2);assert.deepEqual(prismAngleCapabilities().domain.refractiveIndex,[1,4]);
 const c=problemWorkflowCapabilities();assert.equal(c.requestKinds['prism-transmission-angles'].contract,PRISM_QUERY_FORMAT);
 assert.deepEqual(c.methodSuitability.contractFamilies[PRISM_QUERY_FORMAT],[PRISM_FACTS_FORMAT]);
});

test('extracted scalar angular functions preserve the former planar expressions exactly across 1296 controls',()=>{
 let count=0;
 const indices=[1,1.25,1.5,2,3,4],angles=[0,1e-9,5,15,25,30,35,40,45,50,60,70,80,85,89,89.999999999,
  10,20,33,44,55,66,77,88,2,3,4,6,7,8,9,11,13,17,19,23];
 const oldAsin=s=>!Number.isFinite(s)||s<0||s>1+2e-12?null:Math.asin(Math.min(1,s))/RAD;
 for(const n1 of indices)for(const n2 of indices)for(const i of angles){
  const transverse=n1*Math.sin(i*RAD),ratio=transverse/n2,at=oldAsin(transverse/n1),sameMedium=n1===n2,delta=ratio-1;
  assert.deepEqual(classifySnellTransmission(transverse,n1,n2,at),{sameMedium,uncertainCritical:!sameMedium&&Math.abs(delta)<=2e-12,
   tir:!sameMedium&&delta>2e-12,out:sameMedium?at:oldAsin(ratio)});count++;
 }
 assert.equal(count,1296);
 for(const x of [NaN,Infinity,-1,0,0.5,1,1+1e-12,1+4e-12])assert.equal(asinAngle(x),oldAsin(x));
});

test('symmetric prism forward and signed inverse agree with exact sqrt(2) reference without native assumptions',()=>{
 const f=base(),before=structuredClone(f),r=forward(f);assert.deepEqual(f,before);
 assert.equal(r.status,'conditional');close(r.value.entryRefractionAngleDeg,30);close(r.value.exitIncidenceAngleDeg,30);
 close(r.value.emergenceAngleDeg,45);close(r.value.signedDeviationDeg,30);close(inverse(inv()).value.insideIndex,Math.SQRT2,1e-12);
 assert.equal(r.native.status,'not-run');assert.equal(r.nativePathVerified,false);
 for(const key of ['scene','canonicalForwardScene','proposedForwardScene','brightness','apertureHeight'])assert.equal(r[key],undefined);
});

test('180 explicit material-angle cases agree with a separately implemented vector reference',()=>{
 let completed=0,refused=0,inverted=0,inverseIndeterminate=0;
 for(const A of [15,30,45,60,75,110])for(const i of [0,12,30,45,68])for(const [n,n0] of [[1.5,1],[1.8,1.33],[1,1.5],[1.5,1.5],[4,1],[2,2.5]]){
  const f={...base(),apexAngleDeg:A,incidenceAngleDeg:i,insideIndex:n,outsideIndex:n0};
  const ref=prismVectorReference(A,i,n,n0),r=forward(f);
  if(r.status==='conditional'){
   assert.equal(ref.kind,'transmission');close(r.value.entryRefractionAngleDeg,ref.r1);close(r.value.exitIncidenceAngleDeg,ref.r2);
   close(r.value.emergenceAngleDeg,ref.e);close(r.value.signedDeviationDeg,ref.deviation);completed++;
   // Strictly interior candidate indices avoid confusing domain-boundary rounding
   // with inverse correctness. Every skipped inverse is counted separately.
   if(n>1&&n<4&&ref.r1>1e-7&&ref.r2>1e-7&&ref.e>1e-7){
    const g={...f,deviationDeg:ref.deviation,deviationConvention:'signed'};delete g.insideIndex;
    const v=inverse(g);
    if(ref.deviation!==0&&Math.abs(ref.deviation)<=1e-8){
     assert.equal(v.status,'numerically-indeterminate');assert.equal(v.reasonCode,'UNRESOLVED_SMALL_DEVIATION');inverseIndeterminate++;
    }else{assert.equal(v.status,'conditional');close(v.value.insideIndex,n,1e-10);inverted++;}
   }
  }else{
   assert.ok(['unavailable','numerically-indeterminate'].includes(r.status));assert.equal(r.value,null);refused++;
   if(r.reasonCode==='TOTAL_INTERNAL_REFLECTION')assert.match(ref.kind,/tir/);
   if(r.reasonCode==='OUTSIDE_DIRECT_BRANCH')assert.equal(ref.kind,'outside-branch');
  }
 }
 assert.equal(completed+refused,180);assert.ok(completed>20&&refused>20&&inverted>10&&inverseIndeterminate>0);
});

test('signed deviation and magnitude ambiguity are distinct without candidate ranking',()=>{
 const f={...inv(5,'magnitude'),apexAngleDeg:40,incidenceAngleDeg:30,outsideIndex:1.5};
 const r=inverse(f);assert.equal(r.status,'multiple-solutions');assert.equal(r.value,null);assert.equal(r.candidates.length,2);
 close(r.candidates[0].insideIndex,1.6750760457803364,1e-12);close(r.candidates[1].insideIndex,1.3290406845064389,1e-12);
 for(const d of [5,-5]){const one=inverse({...f,deviationDeg:d,deviationConvention:'signed'});assert.equal(one.status,'conditional');close(one.value.signedDeviationDeg,d);}
 const original=structuredClone(f);inverse(f);assert.deepEqual(f,original);
});

test('partial numerical or qualified-range uncertainty never turns into a unique inverse result',()=>{
 const uncertain=inverse({...inv(30,'magnitude'),apexAngleDeg:100,incidenceAngleDeg:40,outsideIndex:1.5});
 assert.equal(uncertain.status,'partially-indeterminate');assert.equal(uncertain.value,null);assert.equal(uncertain.candidates.length,1);
 const unqualified=inverse({...inv(5,'magnitude'),apexAngleDeg:40,incidenceAngleDeg:30,outsideIndex:4});
 assert.equal(unqualified.status,'partially-unavailable');assert.equal(unqualified.value,null);assert.equal(unqualified.candidates.length,1);
});

test('specified index is a consistency constraint, never an unacknowledged inverse answer',()=>{
 const f={...inv(5,'magnitude'),apexAngleDeg:40,incidenceAngleDeg:30,outsideIndex:1.5,insideIndex:1.6750760457803364};
 assert.equal(inverse(f).status,'conditional');
 assert.equal(inverse({...f,insideIndex:2}).status,'unavailable');
 assert.equal(forward({...base(),deviationDeg:30,deviationConvention:'signed'}).status,'conditional');
 const r=forward({...base(),deviationDeg:31,deviationConvention:'signed'});assert.equal(r.reasonCode,'INCONSISTENT_PRISM_FACTS');assert.equal(r.value,null);
});

test('normal incidence and matched indices remain supported without minimum-deviation assumptions',()=>{
 const f={...base(),apexAngleDeg:30,incidenceAngleDeg:0,insideIndex:1.5};const r=forward(f);
 assert.equal(r.status,'conditional');close(r.value.entryRefractionAngleDeg,0);assert.ok(Math.abs(r.value.emergenceAngleDeg)>1);
 const g={...f,deviationDeg:r.value.signedDeviationDeg,deviationConvention:'signed'};delete g.insideIndex;
 assert.equal(inverse(g).status,'conditional');close(inverse(g).value.insideIndex,1.5,1e-12);
 const matched={...base(),incidenceAngleDeg:20,insideIndex:1.5,outsideIndex:1.5};
 assert.equal(forward(matched).value.signedDeviationDeg,0);
 const zero={...matched,deviationDeg:0,deviationConvention:'magnitude'};delete zero.insideIndex;
 assert.equal(inverse(zero).candidates.length,1);close(inverse(zero).value.insideIndex,1.5,1e-12);
});

test('entry and exit TIR withhold transmitted output without inventing a reflection route',()=>{
 for(const [f,face] of [[{...base(),insideIndex:1,outsideIndex:1.5,incidenceAngleDeg:60},'entry'],
  [{...base(),insideIndex:1.5,incidenceAngleDeg:0},'exit']]){
  const r=forward(f);assert.equal(r.status,'unavailable');assert.equal(r.reasonCode,'TOTAL_INTERNAL_REFLECTION');
  assert.equal(r.boundary,face);assert.equal(r.value,null);assert.equal(r.native.status,'not-run');
 }
});

test('critical, near-grazing and degenerate boundary facts remain numerically indeterminate',()=>{
 const critical=Math.asin(1/1.5)/RAD;
 for(const f of [{...base(),insideIndex:1,outsideIndex:1.5,incidenceAngleDeg:critical},
  {...base(),insideIndex:1.5,incidenceAngleDeg:0,apexAngleDeg:critical},
  {...base(),apexAngleDeg:1e-12},{...base(),apexAngleDeg:180-1e-12},
  {...base(),incidenceAngleDeg:90-1e-10}]){
  const r=forward(f);assert.equal(r.status,'numerically-indeterminate');assert.equal(r.value,null);
 }
});

test('nontransmitted and impossible angular geometry are refused, not repaired',()=>{
 assert.equal(forward({...base(),apexAngleDeg:10,incidenceAngleDeg:60}).reasonCode,'OUTSIDE_DIRECT_BRANCH');
 const no=inverse({...inv(-60),apexAngleDeg:40,incidenceAngleDeg:30});assert.equal(no.status,'unavailable');assert.equal(no.candidates.length,0);
 const out=inverse({...inv(60),apexAngleDeg:10,incidenceAngleDeg:20});assert.equal(out.status,'unavailable');assert.equal(out.value,null);
});

test('missing physics and deviation convention require information rather than inferred values',()=>{
 for(const key of ['model','branch','apexAngleDeg','incidenceAngleDeg','outsideIndex','insideIndex']){
  const f=base();delete f[key];assert.throws(()=>forward(f),error('MISSING_FACTS'));
 }
 const a=inv();delete a.deviationConvention;assert.throws(()=>inverse(a),error('MISSING_FACTS'));
 const b=inv();delete b.deviationDeg;assert.throws(()=>inverse(b),error('MISSING_FACTS'));
});

test('invalid facts, unsupported regimes and unknown kinds remain explicit and do not mutate input',()=>{
 for(const patch of [{apexAngleDeg:0},{apexAngleDeg:180},{incidenceAngleDeg:90},{incidenceAngleDeg:-1},
  {outsideIndex:null},{insideIndex:'1.5'},{insideIndex:NaN},{deviationDeg:5},{deviationDeg:-1,deviationConvention:'magnitude'},
  {components:[]},{angleUnit:'radian'}]){
  const f={...base(),...patch},before=structuredClone(f);assert.throws(()=>forward(f));assert.deepEqual(f,before);
 }
 for(const f of [{...base(),outsideIndex:0.9},{...base(),insideIndex:5},{...base(),branch:'internal-reflection'},
  {...base(),model:'graded-index'},{format:'ray-optics-2d',physics:{components:[]}}])assert.throws(()=>forward(f));
 assert.throws(()=>analyzePrismAngleQuery(base(),query('prism-minimum-deviation')),error('UNSUPPORTED_QUERY'));
});

test('dispatcher separates analytical success, unknown requests and unresolved native execution',()=>{
 const p=problem();const r=planProblem(p);assert.equal(r.results[0].status,'conditional');assert.equal(r.scene,null);assert.equal(r.native.canRun,false);
 assert.equal(r.methodSuitability.entries[0].familyCompatibility,'form-compatible');
 const native=planProblem({...p,verifyNative:true});assert.equal(native.results[0].status,'conditional');assert.equal(native.native.required,true);assert.equal(native.native.canRun,false);
 const mixed=planProblem({...p,requests:[...p.requests,{id:'hits',kind:'interface-interactions',componentId:'P'}]});assert.equal(mixed.results[1].status,'needs-information');
 const unsupported=planProblem({...p,requests:[{id:'x',kind:'prism-unknown-inverse'}]});assert.equal(unsupported.results[0].status,'unavailable');
 assert.throws(()=>planProblem({...p,requests:[{id:'x',kind:'prism-transmission-angles',componentId:'P'}]}));
});

test('public evidence retains bytes, ambiguity and zero-native status without a portable native package',async()=>{
 mkdirSync('test-artifacts/llm-authoring',{recursive:true});const root=mkdtempSync(resolve('test-artifacts/llm-authoring/prism-unit-'));
 let calls=0;
 for(const [name,p,exit] of [['forward',problem(),0],['native-request', {...problem(),verifyNative:true},2],
  ['ambiguous',problem({...inv(5,'magnitude'),apexAngleDeg:40,incidenceAngleDeg:30,outsideIndex:1.5},'prism-index-from-deviation'),2]]){
  const bytes=Buffer.from(JSON.stringify(p)),out=resolve(root,name);
  const r=await runProblemEvidence({inputBytes:bytes,outputPath:out,execute:()=>{calls++;throw Error('Unexpected native call');}});
  assert.equal(r.exitCode,exit);assert.equal(r.report.native.status,'not-run');assert.equal(r.report.dispatch.nativeCalls,0);
  assert.equal(r.report.portable.status,'not-created');assert.deepEqual(readFileSync(resolve(out,'input.json')),bytes);
  assert.equal(existsSync(resolve(out,'qualified-scene.json')),false);
 }
 assert.equal(calls,0);
});

test('both public CLIs run reduced prism facts without a vendor checkout, native core or build',()=>{
 mkdirSync('test-artifacts/prism-isolation',{recursive:true});const folder=mkdtempSync(resolve('test-artifacts/prism-isolation/run-'));
 for(const dir of ['src','scripts','skills'])cpSync(resolve(dir),resolve(folder,dir),{recursive:true});
 writeFileSync(resolve(folder,'package.json'),'{"type":"module"}');writeFileSync(resolve(folder,'request.json'),JSON.stringify(problem()));
 for(const cmd of ['preflight-problem.mjs','run-problem.mjs']){
  const r=spawnSync(process.execPath,['scripts/'+cmd,'request.json',...(cmd==='run-problem.mjs'?['--out','test-artifacts/llm-authoring/run']:[])],{cwd:folder,encoding:'utf8',timeout:20000});
  assert.equal(r.status,0,r.stdout+'\n'+r.stderr);assert.equal(JSON.parse(r.stdout).native.status,'not-run');
 }
 const report=JSON.parse(readFileSync(resolve(folder,'test-artifacts/llm-authoring/run/report.json')));assert.equal(report.results[0].status,'conditional');
 assert.equal(existsSync(resolve(folder,'vendor')),false);assert.equal(existsSync(resolve(folder,'dist')),false);
});


test('tiny nonzero deviation cannot become exact zero or two identical inverse candidates',()=>{
 for(const convention of ['signed','magnitude']){
  const f={...inv(1e-15,convention),apexAngleDeg:40,incidenceAngleDeg:30,outsideIndex:1.5};
  const r=inverse(f);assert.equal(r.status,'numerically-indeterminate');assert.equal(r.value,null);
  assert.equal(r.reasonCode,'UNRESOLVED_SMALL_DEVIATION');assert.equal(r.candidates,undefined);
 }
 const zero={...inv(0,'magnitude'),apexAngleDeg:40,incidenceAngleDeg:30,outsideIndex:1.5};
 const exact=inverse(zero);assert.equal(exact.status,'conditional');assert.equal(exact.candidates.length,1);
});
