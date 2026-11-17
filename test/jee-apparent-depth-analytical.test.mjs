// JEE apparent-depth A: reduced facts, no PhyDemo execution or simulated eye.
// Scalar references check independently stated paraxial and symmetric-ray laws.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
import {analyzePlanarApparentDepthQuery,apparentDepthCapabilities,
  APPARENT_DEPTH_FACTS_FORMAT,APPARENT_DEPTH_QUERY_FORMAT,APPARENT_DEPTH_KIND} from '../src/planar-apparent-depth-queries.js';

const fixture=JSON.parse(readFileSync(new URL('../examples/jee-apparent-depth-v1.json',import.meta.url)));
const request=()=>structuredClone(fixture);
const query=()=>({format:APPARENT_DEPTH_QUERY_FORMAT,kind:APPARENT_DEPTH_KIND});
const bytes=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const fresh=()=>resolve('test-artifacts/llm-authoring/apparent-depth-test-'+randomUUID());
const check=(v,t=1e-8)=>assert.ok(Number.isFinite(v)&&Math.abs(v)<=t,'unexpected numerical deviation: '+v);
const rads=d=>d*Math.PI/180;
const reference=(d,no,nv,i)=>{
  const a=rads(i),t=Math.asin(no/nv*Math.sin(a));
  return d*Math.tan(a)/Math.tan(t);
};
const analyzed=p=>analyzePlanarApparentDepthQuery(p.physical,query());
const entry=p=>planProblem(p).results[0];

test('one exactly registered kind and explicit reduced facts; no new native scene or default component',()=>{
  const c=problemWorkflowCapabilities(),p=planProblem(request());
  assert.deepEqual(apparentDepthCapabilities().kinds,[APPARENT_DEPTH_KIND]);
  assert.equal(c.requestKinds[APPARENT_DEPTH_KIND].route,'conditional-analytical');
  assert.equal(c.requestKinds[APPARENT_DEPTH_KIND].contract,APPARENT_DEPTH_QUERY_FORMAT);
  assert.equal(c.apparentDepth.factsFormat,APPARENT_DEPTH_FACTS_FORMAT);
  assert.equal(p.scene,null);assert.equal(p.preparation,null);
  assert.deepEqual(p.nativeRequests,[]);assert.deepEqual(p.targetBindings,[]);
  assert.equal(p.native.required,false);assert.equal(p.native.canRun,false);
  assert.equal(p.calculations.length,1);
  assert.deepEqual(p.calculations[0].query,query());
  assert.equal(p.results[0].status,'conditional');
  assert.equal(p.results[0].method,'conditional-analytical-paraxial');
  assert.equal(p.results[0].nativeObservation,false);
  assert.equal(p.results[0].nativeImageDetected,false);
  assert.equal(p.results[0].native.status,'not-run');
  assert.equal(p.methodSuitability.entries[0].familyCompatibility,'form-compatible');
  assert.equal(p.methodSuitability.entries[0].readiness,'conditional-result');
  assert.equal(p.methodSuitability.auditActions.nativeSimulatorCalls,0);
  assert.equal(p.questionSupport,'not-assessed-by-engine');
  const isolated=c.apparentDepth;isolated.kinds[0]='malicious';
  assert.equal(problemWorkflowCapabilities().apparentDepth.kinds[0],APPARENT_DEPTH_KIND);
});

test('120 mm 1.5-to-1 near-normal result is conditional with independently computed angle envelope',()=>{
  const p=request(),before=bytes(p),r=analyzed(p);
  assert.equal(r.status,'conditional');
  assert.equal(r.value.realNormalDepthMm,120);
  assert.equal(r.value.estimatedNormalDepthMm,80);
  check(r.value.depthFactor-2/3,1e-15);
  const e=r.value.symmetricAngleEnvelope;
  assert.equal(e.maxObjectIncidenceDeg,5);
  check(e.rangeMm[0]-reference(120,1.5,1,5),1e-10);
  check(e.rangeMm[1]-80);
  check(e.maxDifferenceFromParaxialMm-(80-reference(120,1.5,1,5)),1e-10);
  assert.equal(r.qualification.basis,'assumption-dependent');
  assert.match(r.qualification.warnings.join(' '),/not numerical accuracy|not numerical accuracy|not numerical accuracy/i);
  assert.equal(r.native.status,'not-run');
  assert.equal(r.native.observations,null);
  assert.equal(r.interpretation,'not-assessed-by-engine');
  assert.deepEqual(bytes(p),before);
});

test('without an explicitly stated angle cone a formula is still conditional, never claims numeric error',()=>{
  const p=request();delete p.physical.viewing.maxIncidentAngleDeg;
  const r=analyzed(p);
  assert.equal(r.status,'conditional');
  assert.equal(r.value.estimatedNormalDepthMm,80);
  assert.equal(r.value.symmetricAngleEnvelope,null);
  assert.ok(r.qualification.warnings.some(w=>w.includes('No quantitative finite-angle')));
  assert.ok(r.limitations.some(w=>w.includes('not a native ray observation')));
});

test('equal indices, reverse index contrast, and unit changes preserve the conditional mathematical relation',()=>{
  const base=request(),original=structuredClone(base);
  for(const [no,nv,angle,expected] of [[1,1,5,120],[1.5,1.5,5,120],[1,1.5,5,180],[4,1,1,30]]){
    const p=request();
    p.physical.media.objectIndex=no;p.physical.media.observerIndex=nv;
    p.physical.viewing.maxIncidentAngleDeg=angle;
    const r=analyzed(p);
    assert.equal(r.status,'conditional',no+' to '+nv);
    check(r.value.estimatedNormalDepthMm-expected);
    const ref=no===nv?120:reference(120,no,nv,angle);
    check(r.value.symmetricAngleEnvelope.rangeMm[no>=nv?0:1]-ref,1e-8);
  }
  for(const [unit,depth] of [['mm',120],['cm',12],['m',.12]]){
    const p=request();p.physical.lengthUnit=unit;p.physical.object.normalDepth=depth;
    const r=analyzed(p);assert.equal(r.status,'conditional');
    check(r.value.realNormalDepthMm-120);check(r.value.estimatedNormalDepthMm-80);
    check(r.value.symmetricAngleEnvelope.rangeMm[0]-reference(120,1.5,1,5),1e-8);
  }
  assert.deepEqual(base,original);
});

test('wide cones, too-strong contrast and grazing/critical claims withhold the entire scalar',()=>{
  for(const [no,nv,a,code] of [[1.5,1,30,'OUTSIDE_PARAXIAL_DOMAIN'],
    [1.5,1,41.81031489578,'OUTSIDE_PARAXIAL_DOMAIN'],
    [1,1.5,89.999,'OUTSIDE_PARAXIAL_DOMAIN'],
    [1,1.5,90,'OUTSIDE_PARAXIAL_DOMAIN'],
    [4,1,5,'PARAXIAL_CONSTRUCTION_DISCREPANCY'],
    [4,1,2.087,'PARAXIAL_CONSTRUCTION_DISCREPANCY']]){
    const p=request();p.physical.media.objectIndex=no;p.physical.media.observerIndex=nv;
    p.physical.viewing.maxIncidentAngleDeg=a;
    const r=analyzed(p);
    assert.equal(r.status,'unavailable',a+' '+no+' '+nv);
    assert.equal(r.reasonCode,code);
    assert.equal(r.value,null);assert.equal(entry(p).status,'unavailable');
  }
  const justInside=request();justInside.physical.media.objectIndex=4;
  justInside.physical.viewing.maxIncidentAngleDeg=2.084;
  assert.equal(analyzed(justInside).status,'conditional');
});

test('unknown fields and malformed values never become missing facts or an authorized formula',()=>{
  const cases=[
    p=>p.physical.other='eval()',
    p=>p.physical.object.foo=1,
    p=>p.physical.media.wavelength=550,
    p=>p.physical.viewing.eye={x:100,y:0},
    p=>p.physical.object.id='O1<script>',
    p=>p.physical.object.normalDepth=-2,
    p=>p.physical.object.normalDepth=0,
    p=>p.physical.media.objectIndex=0,
    p=>p.physical.media.observerIndex=4.01,
    p=>p.physical.media.observerIndex='1',
    p=>p.physical.viewing.maxIncidentAngleDeg='5',
    p=>p.physical.viewing.maxIncidentAngleDeg=0,
    p=>p.physical.viewing.maxIncidentAngleDeg=-1,
    p=>p.physical.viewing.maxIncidentAngleDeg=91,
    p=>p.physical.lengthUnit='inch',
    p=>p.physical.viewing=null
  ];
  for(const mutate of cases){
    const p=request();mutate(p);
    const r=entry(p);assert.equal(r.status,'invalid-input',JSON.stringify(p.physical));
    assert.equal(r.value,null);assert.equal(planProblem(p).native.canRun,false);
  }
  const simultaneous=request();
  delete simultaneous.physical.viewing.model;
  simultaneous.physical.viewing.newField='injection';
  assert.equal(entry(simultaneous).status,'invalid-input',
    'unknown JSON field takes priority over missing required viewing model');
});

test('genuinely absent required input receives needs-information and unsupported viewing remains unavailable',()=>{
  const omissions=[
    p=>{p.physical=null;},
    p=>{delete p.physical.object;},
    p=>{delete p.physical.object.normalDepth;},
    p=>{delete p.physical.media;},
    p=>{delete p.physical.media.observerIndex;},
    p=>{delete p.physical.viewing;},
    p=>{delete p.physical.viewing.model;},
    p=>{delete p.physical.lengthUnit;}
  ];
  for(const edit of omissions){
    const p=request();edit(p);
    assert.equal(entry(p).status,'needs-information',JSON.stringify(p.physical));
    assert.equal(entry(p).value,null);
  }
  const other=request();other.physical.viewing.model='finite-angle';
  assert.equal(entry(other).status,'unavailable');
  assert.equal(entry(other).reasonCode,'UNSUPPORTED_VIEWING_MODEL');
  const substituted=request();substituted.physical={format:'unknown-facts-v1',lengthUnit:'mm'};
  assert.equal(entry(substituted).status,'unavailable');
  assert.equal(entry(substituted).reasonCode,'UNSUPPORTED_SCOPE');
});

test('depth limits and index endpoints are checked after conversion, not silently clipped',()=>{
  for(const [unit,d,valid] of [['mm',.01,true],['cm',.001,true],['m',.00001,true],
    ['mm',10000,true],['m',10,true],['mm',.009999,false],
    ['cm',.0009,false],['m',.000009,false],['mm',10000.001,false],['m',10.001,false]]){
    const p=request();p.physical.lengthUnit=unit;p.physical.object.normalDepth=d;
    delete p.physical.viewing.maxIncidentAngleDeg;
    const r=entry(p);
    assert.equal(r.status,valid?'conditional':'invalid-input',unit+' '+d);
    if(!valid)assert.equal(r.value,null);
  }
  for(const [no,nv] of [[1,4],[4,1],[1,1],[4,4]]){
    const p=request();p.physical.media.objectIndex=no;p.physical.media.observerIndex=nv;
    delete p.physical.viewing.maxIncidentAngleDeg;
    assert.equal(entry(p).status,'conditional');
  }
  const extreme=request();extreme.physical.object.normalDepth=10000;
  extreme.physical.media.objectIndex=1;extreme.physical.media.observerIndex=4;
  assert.equal(entry(extreme).status,'conditional');
  assert.ok(entry(extreme).value.symmetricAngleEnvelope.rangeMm[1]<50000);
});

test('request schemas, calculation limits, unavailable native targets and capability mutation fail closed',()=>{
  for(const edit of [
    p=>p.requests[0].componentId='O1',
    p=>p.requests[0].angleDeg=5,
    p=>p.requests[0].kind='conditional-apparent-image',
    p=>p.requests[0].id=''
  ]){
    const p=request();edit(p);
    if(p.requests[0].kind==='conditional-apparent-image'){
      const r=entry(p);assert.equal(r.status,'unavailable');
      assert.equal(r.reasonCode,'UNSUPPORTED_QUANTITY');
    }else assert.throws(()=>planProblem(p));
  }
  const p=request();p.requests=Array.from({length:5},(_,i)=>({id:'depth'+i,kind:APPARENT_DEPTH_KIND}));
  assert.throws(()=>planProblem(p),/four analytical/);
});

test('preflight is native-free; run CLI persists only original bytes, typed math and report',async()=>{
  const p=request(),raw=bytes(p),plan=planProblem(p);
  const inputPath=resolve('test-artifacts/llm-authoring/apparent-input-'+randomUUID()+'.json');
  mkdirSync(resolve('test-artifacts/llm-authoring'),{recursive:true});
  writeFileSync(inputPath,raw,{flag:'wx'});
  let proc;
  try{proc=spawnSync(process.execPath,['scripts/preflight-problem.mjs',inputPath],{encoding:'utf8'});}
  finally{rmSync(inputPath);}
  assert.equal(proc.status,0,proc.stderr);
  const pre=JSON.parse(proc.stdout);
  assert.equal(pre.status,'no-native-required');assert.equal(pre.scenePrepared,false);
  assert.equal(pre.native.calls,0);assert.equal(pre.results[0].status,'conditional');
  assert.equal(pre.methodSuitability.entries[0].readiness,'conditional-result');
  assert.equal(pre.inputSha256,createHash('sha256').update(raw).digest('hex'));
  let calls=0;
  const r=await runProblemEvidence({inputBytes:raw,outputPath:fresh(),
    execute:()=>{calls++;throw Error('native execution forbidden for reduced apparent-depth facts');}});
  assert.equal(r.exitCode,0);assert.equal(calls,0);
  assert.equal(r.report.native.status,'not-run');
  assert.equal(r.report.portable.status,'not-created');
  assert.equal(r.report.dispatch.nativeCalls,0);
  assert.equal(r.report.results[0].status,'conditional');
  assert.equal(r.report.results[0].qualification.basis,'assumption-dependent');
  assert.deepEqual(r.report.methodSuitability,plan.methodSuitability);
  assert.equal(r.report.inputSha256,createHash('sha256').update(raw).digest('hex'));
  assert.deepEqual(readFileSync(resolve(r.output,'input.json')),raw);
  assert.deepEqual(readdirSync(r.output).sort(),['analytical-results.json','input.json','plan.json','report.json']);
  assert.equal(JSON.parse(readFileSync(resolve(r.output,'plan.json'),'utf8')).scene,null);
  assert.equal(JSON.parse(readFileSync(resolve(r.output,'analytical-results.json'),'utf8')).calculations[0].result.status,'conditional');
  assert.equal(JSON.parse(readFileSync(resolve(r.output,'report.json'),'utf8')).results[0].method,
    'conditional-analytical-paraxial');
});

test('verifyNative:true refuses to misrepresent a conditional formula as native verified',async()=>{
  const p=request();p.verifyNative=true;
  const plan=planProblem(p);
  assert.equal(plan.results[0].status,'conditional');
  assert.equal(plan.native.required,true);assert.equal(plan.native.canRun,false);
  assert.equal(plan.native.reasonCode,'NATIVE_SCENE_REQUIRED');
  assert.equal(plan.scene,null);
  const inputPath=resolve('test-artifacts/llm-authoring/apparent-verify-'+randomUUID()+'.json');
  mkdirSync(resolve('test-artifacts/llm-authoring'),{recursive:true});
  writeFileSync(inputPath,bytes(p),{flag:'wx'});
  let proc;
  try{proc=spawnSync(process.execPath,['scripts/preflight-problem.mjs',inputPath],{encoding:'utf8'});}
  finally{rmSync(inputPath);}
  assert.equal(proc.status,2);
  assert.equal(JSON.parse(proc.stdout).status,'blocked');
  let calls=0;
  const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh(),execute:()=>{calls++;}});
  assert.equal(calls,0);assert.equal(r.exitCode,2);
  assert.equal(r.report.status,'blocked-native-verification');
  assert.equal(r.report.results[0].status,'conditional');
  assert.equal(r.report.coverage.status,'all-requested-quantities-available');
  assert.equal(r.report.native.status,'not-run');
  assert.equal(r.report.native.reasonCode,'NATIVE_SCENE_REQUIRED');
  assert.equal(r.report.portable.status,'not-created');
  assert.equal(r.report.dispatch.nativeCalls,0);
  assert.ok(!existsSync(resolve(r.output,'qualified-scene.json')));
  assert.ok(!existsSync(resolve(r.output,'native-evidence.json')));
});

test('valid conditional A plus requested native detector remains blocked with no fabricated scene',async()=>{
  const p=request();p.requests.push({id:'detector',kind:'detector-crossings',componentId:'D1'});
  const plan=planProblem(p);
  assert.equal(plan.scene,null);assert.equal(plan.native.canRun,false);
  assert.deepEqual(plan.results.map(x=>x.status),['conditional','needs-information']);
  const r=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh(),execute:()=>{throw Error('no native apparatus');}});
  assert.equal(r.exitCode,2);
  assert.equal(r.report.dispatch.nativeCalls,0);
  assert.equal(r.report.results[0].status,'conditional');
  assert.equal(r.report.results[1].value,null);
});
