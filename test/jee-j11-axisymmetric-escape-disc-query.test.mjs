import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {analyzeEscapeDisc,escapeDiscCapabilities,EscapeDiscError,
 ESCAPE_DISC_QUERY_FORMAT} from '../src/axisymmetric-escape-disc.js';
import {runEscapeDiscEvidence} from '../scripts/axisymmetric-escape-disc-query.mjs';

const load=file=>JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8'));
const frozen=load('../evaluation/jee-j11-escape-disc-v1/frozen-protocol.json');
const symbolic=load('../examples/jee-j11-escape-disc-symbolic-v1.json');
const numeric=load('../examples/jee-j11-escape-disc-synthetic-numeric-v1.json');
const missing=load('../examples/jee-j11-escape-disc-missing-exterior-v1.json');
const near=(a,b,e=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=e,
 String(a)+' differs from '+String(b)+' tolerance '+String(e));
const err=code=>e=>e instanceof EscapeDiscError&&e.code===code;
const rad=x=>x*Math.PI/180;

test('J11 original symbolic source and nine frozen prospective controls precede implementation',()=>{
 assert.equal(frozen.status,'pre-implementation-frozen-protocol');
 assert.equal(frozen.baselineMain,'2a529aeca8cf4960f3c7f285e635c55ae5a130b9');
 assert.equal(frozen.source.frozenCase,'J11');
 assert.equal(frozen.source.sourceAnswersOrSolutionsRead,false);
 assert.equal(frozen.fixedCases.length,9);
 assert.equal(frozen.source.path,'08_Ray_Optics_Explanations/04_Total_Internal_Reflection_TIR/Problems/005.png');
 assert.equal(symbolic.format,ESCAPE_DISC_QUERY_FORMAT);
 assert.equal(symbolic.kind,'symbolic-escape-disc-radius');
 assert.equal(symbolic.outsideIndex,undefined);
});
test('source-only symbolic J11 preserves parameters and an explicitly unknown exterior medium',()=>{
 const q=structuredClone(symbolic),before=structuredClone(q),r=analyzeEscapeDisc(q);
 assert.deepEqual(q,before);
 assert.equal(r.status,'symbolic-conditional');
 assert.equal(r.value.depthSymbol,'h');
 assert.equal(r.value.insideIndexSymbol,'mu');
 assert.equal(r.value.outsideIndexSymbol,'n_outside');
 assert.equal(r.value.minimumRadiusExpression,'h*n_outside/sqrt(mu^2-n_outside^2)');
 assert.equal(r.value.numericalRadius,null);
 assert.equal(r.value.exteriorIndexNumericallySpecified,false);
 assert.equal(r.value.sourceQuestionNumericallySolved,false);
 assert.equal(r.native.status,'not-run');
 assert.equal(r.native.native3DVisibilityCertified,false);
 assert.equal(r.native.physicalDiscSimulated,false);
 assert.equal(r.originalJeeQuestionSolved,false);
 assert.ok(r.limitations.some(x=>x.includes('not a measured observer')));
});
test('with explicitly added nWater=1.5 nOutside=1 and depth 100 mm the limiting disc radius and critical angle are conditional',()=>{
 const q=structuredClone(numeric),before=structuredClone(q),r=analyzeEscapeDisc(q);
 assert.deepEqual(q,before);
 assert.equal(r.status,'conditional');
 near(r.value.minimumDiscRadiusMm,100/Math.sqrt(1.25),1e-10);
 near(r.value.minimumDiscRadius,89.44271909999158,1e-10);
 near(r.value.criticalAngleDeg,Math.asin(2/3)*180/Math.PI,1e-12);
 near(r.value.radiusOverDepth,1/Math.sqrt(1.25),1e-12);
 assert.equal(r.value.discRadiusAtOrAboveLimitCoversAllGeometricEscapingRays,true);
 assert.equal(r.value.actual3DVisibilityMeasured,false);
 assert.equal(r.value.criticalBoundaryAPropagatingRayCertified,false);
 assert.equal(r.native.status,'not-run');
 assert.equal(r.originalJeeQuestionSolved,false);
});
test('independent 3D all-azimuth geometry and a smaller disc counterexample prove the conditional footprint, not visibility',()=>{
 const h=100,n1=1.5,n0=1,critical=Math.asin(n0/n1);
 const model=analyzeEscapeDisc(numeric);
 const R=model.value.minimumDiscRadiusMm;
 for(const theta of [0,.1,.2,.4,critical-.0001]){
  const predicted=h*Math.tan(theta);
  assert.ok(predicted<R,'All strictly entering rays should hit within the limiting footprint');
  for(const phi of [0,.2,Math.PI/4,Math.PI/2,Math.PI,1.85*Math.PI]){
   const dx=Math.sin(theta)*Math.cos(phi),dy=Math.sin(theta)*Math.sin(phi),dz=Math.cos(theta);
   const travel=h/dz;
   const point={x:travel*dx,y:travel*dy};
   near(Math.hypot(point.x,point.y),predicted,1e-10);
   assert.ok(Math.hypot(point.x,point.y)<R);
  }
 }
 const tooSmall=R*.8,unblockedRadial=(tooSmall+R)/2;
 const rayAngle=Math.atan(unblockedRadial/h);
 assert.ok(rayAngle<critical&&rayAngle>0);
 assert.ok(n1*Math.sin(rayAngle)<n0,'Counterexample ray can actually transmit');
 assert.ok(h*Math.tan(rayAngle)>tooSmall,'An undersized disc fails to cover a transmitted direction');
 assert.equal(model.value.actual3DVisibilityMeasured,false);
});
test('a reusable index/depth family matches independent trigonometry, and length units preserve the actual 3D radius',()=>{
 let count=0;
 for(const h of [5,20,100,2000])for(const n0 of [1,1.2,1.33])for(const n1 of [1.5,1.8,2.5,3]){
  if(n1<=n0)continue;
  const input={...numeric,depth:h,insideIndex:n1,outsideIndex:n0};
  const v=analyzeEscapeDisc(input);
  assert.equal(v.status,'conditional',JSON.stringify(input));
  const theta=Math.asin(n0/n1),ref=h*Math.tan(theta);
  near(v.value.minimumDiscRadiusMm,ref,1e-8);
  near(v.value.criticalAngleDeg,theta*180/Math.PI,1e-10);
  count++;
 }
 assert.ok(count>40);
 const base=analyzeEscapeDisc(numeric).value;
 for(const [unit,depth] of [['cm',10],['m',.1]]){
  const other=analyzeEscapeDisc({...numeric,lengthUnit:unit,depth}).value;
  near(other.minimumDiscRadiusMm,base.minimumDiscRadiusMm);
  near(other.minimumDiscRadius,base.minimumDiscRadiusMm/({cm:10,m:1000}[unit]));
 }
 const doubled=analyzeEscapeDisc({...numeric,depth:200});
 near(doubled.value.minimumDiscRadiusMm,2*base.minimumDiscRadiusMm);
});
test('no TIR escape cone, missing exterior index and near-equal boundary are distinct honest statuses',()=>{
 const no=analyzeEscapeDisc({...numeric,outsideIndex:1.5,insideIndex:1.5});
 assert.equal(no.status,'no-finite-coverage');
 assert.equal(no.value.minimumFiniteDiscRadius,null);
 assert.equal(no.value.escapeFootprintUnbounded,true);
 assert.equal(no.native.status,'not-run');
 const inverted=analyzeEscapeDisc({...numeric,insideIndex:1,outsideIndex:1.5});
 assert.equal(inverted.status,'no-finite-coverage');
 assert.equal(inverted.value.finiteDiscSufficient,false);
 const without=analyzeEscapeDisc(missing);
 assert.equal(without.status,'needs-information');
 assert.equal(without.reasonCode,'MISSING_EXTERIOR_INDEX');
 assert.equal(without.value,null);
 const almostEqual=analyzeEscapeDisc({...numeric,insideIndex:1+1e-10});
 assert.equal(almostEqual.status,'numerically-indeterminate');
 assert.equal(almostEqual.reasonCode,'NEAR_EQUAL_INDEX_ESCAPE_BOUNDARY');
 assert.equal(almostEqual.value,null);
 const enormous=analyzeEscapeDisc({...numeric,depth:10000,insideIndex:1+2e-8});
 assert.equal(enormous.status,'numerically-indeterminate');
 assert.equal(enormous.reasonCode,'UNBOUNDED_OR_UNRELIABLE_RADIUS');
 assert.equal(enormous.value,null);
});
test('strict exact symbolic/numeric modes refuse missing physics, fake images, invalid units, and unbounded depth',()=>{
 const essentials=['format','kind','model','geometry','emission'];
 for(const key of essentials){
  for(const q of [symbolic,numeric]){
   const copy=structuredClone(q);delete copy[key];
   assert.throws(()=>analyzeEscapeDisc(copy));
  }
 }
 for(const key of ['depthSymbol','insideIndexSymbol','outsideIndexSymbol']){
  const copy=structuredClone(symbolic);delete copy[key];
  assert.throws(()=>analyzeEscapeDisc(copy),err('MISSING_FACTS'));
 }
 for(const key of ['lengthUnit','depth','insideIndex']){
  const copy=structuredClone(numeric);delete copy[key];
  assert.throws(()=>analyzeEscapeDisc(copy),err('MISSING_FACTS'));
 }
 for(const bad of [
  {...symbolic,insideIndexSymbol:'1.33'}, {...symbolic,outsideIndexSymbol:'air'},
  {...symbolic,depthSymbol:'2m'}, {...symbolic,depth:100},
  {...numeric,kind:'symbolic-escape-disc-radius'},
  {...numeric,model:'ray-optics-native-3d'},
  {...numeric,geometry:'opaque-line-blocker'},
  {...numeric,emission:'parallel-beam-2d'},
  {...numeric,physical3DVisibilityCertified:true},
  {...numeric,discRadius:1e5},
  {...numeric,insideIndex:null},{...numeric,outsideIndex:undefined},
  {...numeric,outsideIndex:NaN},{...numeric,insideIndex:'1.5'},
  {...numeric,depth:'100'},{...numeric,depth:0},{...numeric,depth:10001},
  {...numeric,depth:-1},{...numeric,lengthUnit:'inches'},
  {...numeric,insideIndex:0.5},{...numeric,insideIndex:4.1},
  {...numeric,sourcePosition:{z:-100}},{...numeric,observer:{z:30}},
  null,0,{},[],'{}'
 ])assert.throws(()=>analyzeEscapeDisc(bad));
});
test('capabilities expose 3D source interpretation but no native visibility or original answer assertion',()=>{
 const c=escapeDiscCapabilities();
 assert.equal(c.format,ESCAPE_DISC_QUERY_FORMAT);
 assert.deepEqual(c.numericOptional,['outsideIndex']);
 assert.equal(c.native.includes('cannot certify 3D visibility'),true);
 assert.ok(c.statuses.includes('no-finite-coverage'));
 assert.ok(c.limitations.some(x=>x.includes('two-dimensional PhyDemo')));
});
test('CLI preserves exact original bytes, SHA and no-native statuses for symbolic/numeric/missing/refusal/malformed',()=>{
 for(const q of [symbolic,numeric,missing,{...numeric,insideIndex:1,outsideIndex:1.5}]){
  const raw=Buffer.from(JSON.stringify(q,null,2)+'\n'),
   path=resolve('test-artifacts/llm-authoring/j11-disc-'+randomUUID());
  const out=runEscapeDiscEvidence({queryBytes:raw,outputPath:path});
  assert.equal(out.exitCode,0);
  assert.deepEqual(readFileSync(resolve(path,'input.json')),raw);
  const sha=createHash('sha256').update(raw).digest('hex');
  assert.equal(out.report.originalInputSha256,sha);
  const saved=JSON.parse(readFileSync(resolve(path,'analytical-result.json')));
  assert.equal(saved.originalInputSha256,sha);
  assert.equal(saved.result.native.status,'not-run');
  assert.equal(out.report.native.status,'not-run');
  for(const name of ['qualified-scene.json','scene.ray-optics-2d.json','native-summary.json'])
   assert.equal(existsSync(resolve(path,name)),false);
  assert.throws(()=>runEscapeDiscEvidence({queryBytes:raw,outputPath:path}));
 }
 const bad=Buffer.from('{"format":}');
 const path=resolve('test-artifacts/llm-authoring/j11-disc-'+randomUUID());
 const rejected=runEscapeDiscEvidence({queryBytes:bad,outputPath:path});
 assert.equal(rejected.status,'rejected');
 assert.equal(rejected.exitCode,1);
 assert.equal(rejected.report.native.status,'not-run');
 assert.deepEqual(readFileSync(resolve(path,'input.json')),bad);
 assert.equal(existsSync(resolve(path,'analytical-result.json')),false);
 const c=JSON.parse(execFileSync(process.execPath,[
  fileURLToPath(new URL('../scripts/axisymmetric-escape-disc-query.mjs',import.meta.url)),
  'capabilities'],{encoding:'utf8'}));
 assert.deepEqual(c.kinds,['symbolic-escape-disc-radius','numeric-escape-disc-radius']);
});
