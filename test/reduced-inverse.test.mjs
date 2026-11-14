import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {analyzeReducedInverseQuery,reducedInverseCapabilities,INVERSE_FACTS_FORMAT,INVERSE_QUERY_FORMAT} from '../src/reduced-inverse-queries.js';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {runProblemEvidence} from '../scripts/run-problem.mjs';
const query=kind=>({format:INVERSE_QUERY_FORMAT,kind});
const reflection=()=>({format:INVERSE_FACTS_FORMAT,model:'plane-mirror',lengthUnit:'cm',
 mirror:{x:0,y:0,tangentDeg:0},points:{A:{x:0,y:5},B:{x:20,y:20}}});
const inverse=(model='ideal-thin-lens',observations=[{id:'O1',objectDistance:30,signedMagnification:-2}])=>({
 format:INVERSE_FACTS_FORMAT,model,lengthUnit:'cm',signConvention:'real-object-positive',observations});
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<tolerance,
 'Expected '+actual+' ≈ '+expected);
const plan=(physical,kind)=>planProblem({format:'opticsim-problem-v1',physical,
 requests:[{id:'answer',kind}]});
const limit='paraxial-focal-length-inverse';
const hit='plane-mirror-reflection-point';
const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const fresh=()=>resolve('test-artifacts/llm-authoring/reduced-inverse-test-'+randomUUID());

test('reflection on a stated horizontal mirror is 4 cm from A foot and 16 cm from B foot',()=>{
 const r=analyzeReducedInverseQuery(reflection(),query(hit));
 assert.equal(r.status,'conditional');assert.equal(r.method,'conditional-analytical');
 near(r.value.reflectionPoint.x,4);near(r.value.reflectionPoint.y,0);
 near(r.value.distanceFromProjectionA,4);near(r.value.distanceFromProjectionB,16);
 near(r.value.incidenceAngleFromNormalDeg,Math.atan(20/25)*180/Math.PI);
 near(r.value.pathLength,Math.sqrt(20*20+25*25));
 assert.equal(r.native.status,'not-run');assert.match(r.limitations[0],/extent is unspecified/);
});
test('reflection point covaries exactly with translation and mirror rotation',()=>{
 const f=reflection(),turn={x:13,y:-7},rot=p=>({x:turn.x-p.y,y:turn.y+p.x});
 f.mirror={x:turn.x,y:turn.y,tangentDeg:90};
 f.points.A=rot(f.points.A);f.points.B=rot(f.points.B);
 const r=analyzeReducedInverseQuery(f,query(hit));
 assert.equal(r.status,'conditional');
 near(r.value.reflectionPoint.x,13);near(r.value.reflectionPoint.y,-3);
 near(r.value.distanceFromProjectionA,4);near(r.value.distanceFromProjectionB,16);
});
test('finite mirror requires the reflection point inside its actual length',()=>{
 const f=reflection();f.mirror.length=20;
 assert.equal(analyzeReducedInverseQuery(f,query(hit)).status,'conditional');
 f.mirror.length=6;const miss=analyzeReducedInverseQuery(f,query(hit));
 assert.equal(miss.status,'unavailable');
 assert.equal(miss.reasonCode,'REFLECTION_MISSES_FINITE_MIRROR');
 f.mirror.length=8;
 const endpoint=analyzeReducedInverseQuery(f,query(hit));
 assert.equal(endpoint.status,'numerically-indeterminate');
 assert.equal(endpoint.reasonCode,'ENDPOINT_REFLECTION_AMBIGUITY');
});
test('cross-side and coincident points cannot fabricate a specular bounce',()=>{
 const f=reflection();f.points.B.y=-20;
 assert.equal(analyzeReducedInverseQuery(f,query(hit)).reasonCode,'OPPOSITE_MIRROR_SIDES');
 f.points.B={...f.points.A};
 assert.equal(analyzeReducedInverseQuery(f,query(hit)).reasonCode,'DEGENERATE_TWO_POINT_PATH');
 f.points.B={x:20,y:20};f.points.A.y=0;
 assert.equal(analyzeReducedInverseQuery(f,query(hit)).reasonCode,'POINT_ON_MIRROR');
});
test('mirror and point geometry is strict, including nonfinite and unknown parameters',()=>{
 const edits=[f=>delete f.points.B, f=>f.mirror.tangentDeg=181,
  f=>f.mirror.x=Infinity, f=>f.points.A.y=NaN,
  f=>f.points.A.z=5, f=>f.mirror.length=-1,
  f=>f.lengthUnit='inch'];
 for(const edit of edits){
  const f=reflection();edit(f);
  assert.throws(()=>analyzeReducedInverseQuery(f,query(hit)),/./);
 }
});
test('signed lens magnification uniquely determines a Gaussian focal length and real image',()=>{
 const r=analyzeReducedInverseQuery(inverse(),query(limit));
 assert.equal(r.status,'conditional');
 near(r.value.focalLength,20);
 assert.equal(r.value.opticalClassification,'converging');
 near(r.value.observations[0].imageDistance,60);
 assert.equal(r.value.observations[0].orientation,'inverted');
 assert.equal(r.value.observations[0].imageKind,'real');
});
test('erect magnification +4 and 2.5m real-object mirror imply concave 10/3m focal length',()=>{
 const p=inverse('spherical-mirror-paraxial',[{id:'A',objectDistance:2.5,signedMagnification:4}]);
 p.lengthUnit='m';
 const r=analyzeReducedInverseQuery(p,query(limit));
 assert.equal(r.status,'conditional');
 assert.equal(r.value.opticalClassification,'concave');
 near(r.value.focalLength,10/3);
 near(r.value.signedRadiusOfCurvature,20/3);
 near(r.value.observations[0].imageDistance,-10);
 assert.equal(r.value.observations[0].imageKind,'virtual');
});
test('a convex mirror can have positive but diminished erect magnification',()=>{
 const r=analyzeReducedInverseQuery(inverse('spherical-mirror-paraxial',
   [{id:'O1',objectDistance:12,signedMagnification:0.5}]),query(limit));
 assert.equal(r.status,'conditional');
 assert.equal(r.value.opticalClassification,'convex');
 near(r.value.focalLength,-12);near(r.value.signedRadiusOfCurvature,-24);
 near(r.value.observations[0].imageDistance,-6);
});
test('two unsigned magnification observations resolve a unique shared convex-lens focal length',()=>{
 const r=analyzeReducedInverseQuery(inverse('ideal-thin-lens',[
  {id:'far',objectDistance:16,absoluteMagnification:3},
  {id:'near',objectDistance:8,absoluteMagnification:3}
 ]),query(limit));
 assert.equal(r.status,'conditional');
 near(r.value.focalLength,12);
 assert.deepEqual(r.value.observations.map(x=>x.signedMagnification),[-3,3]);
 assert.deepEqual(r.value.observations.map(x=>x.imageDistance),[48,-24]);
 assert.deepEqual(r.value.observations.map(x=>x.imageKind),['real','virtual']);
});
test('unsigned magnification with one observation exposes both possible f, without picking',()=>{
 const p=inverse('ideal-thin-lens',[{id:'O1',objectDistance:16,absoluteMagnification:3}]);
 const r=analyzeReducedInverseQuery(p,query(limit));
 assert.equal(r.status,'multiple-solutions');assert.equal(r.value,null);
 assert.equal(r.reasonCode,'AMBIGUOUS_IMAGE_ORIENTATION');
 assert.deepEqual(r.candidates.map(x=>x.focalLength),[12,24]);
 assert.deepEqual(r.candidates.map(x=>x.observations[0].orientation),['inverted','erect']);
 const bounded=plan(p,limit);assert.equal(bounded.results[0].status,'multiple-solutions');
 assert.equal(bounded.results[0].value,null);
 assert.equal(bounded.results[0].candidates.length,2);
});
test('explicit orientation resolves unsigned magnitude without a second observation',()=>{
 const p=inverse('ideal-thin-lens',[{id:'O1',objectDistance:16,absoluteMagnification:3,imageOrientation:'erect'}]);
 const r=analyzeReducedInverseQuery(p,query(limit));
 near(r.value.focalLength,24);
 near(r.value.observations[0].imageDistance,-48);
});
test('mutually inconsistent magnification measurements remain unavailable, not averaged',()=>{
 const p=inverse('ideal-thin-lens',[
  {id:'O1',objectDistance:16,signedMagnification:-3},
  {id:'O2',objectDistance:9,signedMagnification:3}]);
 const r=analyzeReducedInverseQuery(p,query(limit));
 assert.equal(r.status,'unavailable');assert.equal(r.value,null);
 assert.equal(r.reasonCode,'INCONSISTENT_PARAXIAL_OBSERVATIONS');
});
test('exact and near unit erect magnification do not yield invented huge f',()=>{
 let p=inverse('ideal-thin-lens',[{id:'O1',objectDistance:20,signedMagnification:1}]);
 assert.equal(analyzeReducedInverseQuery(p,query(limit)).reasonCode,'NO_FINITE_FOCAL_LENGTH');
 p=inverse('ideal-thin-lens',[{id:'O1',objectDistance:20,signedMagnification:1+1e-12}]);
 assert.equal(analyzeReducedInverseQuery(p,query(limit)).status,'numerically-indeterminate');
});
test('object distance and magnification signs cannot be inferred from absent facts',()=>{
 const edits=[p=>delete p.signConvention,p=>delete p.observations[0].objectDistance,
  p=>delete p.observations[0].signedMagnification,p=>p.observations[0].signedMagnification=0,
  p=>p.observations[0].objectDistance=-3,
  p=>p.observations[0].imageOrientation='erect',
  p=>p.observations.push({...p.observations[0]})];
 for(const edit of edits){const p=inverse();edit(p);
  const r=plan(p,limit).results[0];
  assert.ok(['needs-information','invalid-input'].includes(r.status),JSON.stringify(r));
  assert.equal(r.value,null);
 }
 for(const value of [Infinity,NaN]){
  const p=inverse();p.observations[0].objectDistance=value;
  assert.throws(()=>plan(p,limit),/Only finite JSON data is supported/);
 }
});
test('unit conversion changes focal distances, not magnification or physical result',()=>{
 const cm=inverse('spherical-mirror-paraxial',[{id:'A',objectDistance:25,signedMagnification:-2}]);
 const mm=structuredClone(cm);mm.lengthUnit='mm';mm.observations[0].objectDistance=250;
 const m=structuredClone(cm);m.lengthUnit='m';m.observations[0].objectDistance=0.25;
 const a=analyzeReducedInverseQuery(cm,query(limit)).value,b=analyzeReducedInverseQuery(mm,query(limit)).value,c=analyzeReducedInverseQuery(m,query(limit)).value;
 near(a.focalLength*10,b.focalLength);near(a.focalLength/100,c.focalLength);
 assert.equal(a.observations[0].signedMagnification,b.observations[0].signedMagnification);
});
test('reduced inverse contracts are discoverable and never masquerade as native scenes',()=>{
 const c=problemWorkflowCapabilities();
 assert.equal(c.reducedInverse.factsFormat,INVERSE_FACTS_FORMAT);
 assert.equal(c.requestKinds[hit].route,'conditional-analytical');
 assert.equal(c.requestKinds[limit].route,'conditional-analytical');
 const p=plan(reflection(),hit);
 assert.equal(p.scene,null);assert.equal(p.native.required,false);
 assert.equal(p.native.canRun,false);assert.equal(p.results[0].status,'conditional');
 assert.equal(p.calculations.length,1);assert.equal(p.calculations[0].result.native.status,'not-run');
});
test('inverse facts cannot be silently used as a physical native apparatus',()=>{
 const p={format:'opticsim-problem-v1',physical:inverse(),requests:[
  {id:'f',kind:limit},{id:'det',kind:'detector-crossings',componentId:'D1'}],verifyNative:true};
 const r=planProblem(p);
 assert.equal(r.scene,null);assert.equal(r.native.required,true);assert.equal(r.native.canRun,false);
 assert.equal(r.results[0].status,'conditional');
 assert.equal(r.results[1].status,'needs-information');
 assert.equal(r.results[1].reasonCode,'NATIVE_SCENE_REQUIRED');
});
test('wrong requested inverse model remains unavailable without fallback',()=>{
 assert.equal(plan(inverse(),hit).results[0].status,'unavailable');
 assert.equal(plan(reflection(),limit).results[0].status,'unavailable');
});
test('three archived reduced-fact examples execute with zero native calls and preserved hashes',async()=>{
 const items=[
  {physical:reflection(),kind:hit,answer:4},
  {physical:inverse('spherical-mirror-paraxial',[{id:'O1',objectDistance:2.5,signedMagnification:4}]),kind:limit,answer:10/3,units:'m'},
  {physical:inverse('ideal-thin-lens',[{id:'A',objectDistance:16,absoluteMagnification:3},{id:'B',objectDistance:8,absoluteMagnification:3}]),kind:limit,answer:12}
 ];
 items[1].physical.lengthUnit='m';
 for(const x of items){
  const p={format:'opticsim-problem-v1',physical:x.physical,requests:[{id:'out',kind:x.kind}]};
  let calls=0;const result=await runProblemEvidence({inputBytes:bytes(p),outputPath:fresh(),execute:()=>{calls++;throw Error('no native calls allowed');}});
  assert.equal(calls,0);assert.equal(result.exitCode,0);
  assert.equal(result.report.dispatch.nativeCalls,0);
  assert.equal(result.report.native.status,'not-run');
  assert.equal(result.report.portable.status,'not-created');
  assert.equal(result.report.results[0].status,'conditional');
  const v=result.report.results[0].value;
  near(x.kind===hit?v.reflectionPoint.x:v.focalLength,x.answer);
 }
});
test('multiple candidates never become available quantities or a successful preflight',()=>{
 const p={format:'opticsim-problem-v1',
  physical:inverse('ideal-thin-lens',[{id:'O1',objectDistance:16,absoluteMagnification:3}]),
  requests:[{id:'ambiguous',kind:limit}]};
 const outfile=resolve('test-artifacts/llm-authoring/inverse-preflight-'+randomUUID()+'.json');
 mkdirSync(resolve('test-artifacts/llm-authoring'),{recursive:true});
 writeFileSync(outfile,bytes(p),{flag:'wx'});
 let out;
 try{out=spawnSync(process.execPath,['scripts/preflight-problem.mjs',outfile],{encoding:'utf8'});}
 finally{rmSync(outfile);}
 assert.equal(out.status,2,'ambiguous preflight does not claim successful authoring');
 const preflight=JSON.parse(out.stdout);
 assert.equal(preflight.status,'blocked');
 assert.equal(preflight.results[0].status,'multiple-solutions');
 assert.equal(preflight.native.calls,0);
 assert.equal(planProblem(p).results[0].status,'multiple-solutions');
});
