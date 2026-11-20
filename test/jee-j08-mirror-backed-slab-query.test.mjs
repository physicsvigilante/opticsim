import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {analyzeMirrorBackedSlab,mirrorBackedSlabCapabilities,
 MIRROR_BACKED_SLAB_QUERY_FORMAT,MirrorBackedSlabError}
 from '../src/mirror-backed-slab-displacement.js';
import {runMirrorBackedSlabEvidence} from '../scripts/mirror-backed-slab-query.mjs';
const source=JSON.parse(readFileSync(new URL('../examples/jee-j08-mirror-backed-slab-source-only-v1.json',import.meta.url),'utf8'));
const illustration=JSON.parse(readFileSync(new URL('../examples/jee-j08-mirror-backed-slab-synthetic-air-v1.json',import.meta.url),'utf8'));
const frozen=JSON.parse(readFileSync(new URL('../evaluation/jee-j08-mirror-backed-slab-v1/frozen-protocol.json',import.meta.url),'utf8'));
const near=(a,b,tol=1e-10)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol,
 String(a)+' != '+String(b)+' tol '+String(tol));
const rad=d=>d*Math.PI/180;
const invalid=code=>e=>e instanceof MirrorBackedSlabError&&e.code===code;

test('J08 original source facts are frozen and exterior index is absent',()=>{
 assert.equal(frozen.status,'frozen-before-implementation-and-execution');
 assert.equal(frozen.source.caseId,'J08');
 assert.equal(frozen.source.solutionsRead,false);
 assert.equal(frozen.productionBaseline,'cf0366d2b46a0cb88e97bc8d9ec94a29e556ed83');
 assert.equal(source.format,MIRROR_BACKED_SLAB_QUERY_FORMAT);
 assert.equal(source.outsideIndex,undefined);
 assert.equal(illustration.outsideIndex,1);
 assert.equal(frozen.nativeResearch.physicallySyntheticChoices.exteriorIndex,1);
});
test('source-only J08 requires exterior index, not an invented air default or native simulation',()=>{
 const original=structuredClone(source),before=structuredClone(original);
 const r=analyzeMirrorBackedSlab(original);
 assert.deepEqual(original,before);
 assert.equal(r.status,'needs-information');
 assert.equal(r.reasonCode,'MISSING_OUTSIDE_INDEX');
 assert.equal(r.value,null);
 assert.equal(r.physicalFacts.insideIndex,1.8);
 assert.equal(r.physicalFacts.outsideIndex,null);
 assert.equal(r.native.status,'not-run');
 assert.equal(r.originalJeeSolved,false);
});
test('explicit conditional exterior 1 gives 6.585855599 cm surface separation without native detection',()=>{
 const r=analyzeMirrorBackedSlab(illustration);
 assert.equal(r.status,'conditional');
 const analytic=12*Math.sin(rad(60))/Math.sqrt(1.8**2-Math.sin(rad(60))**2);
 near(r.value.entranceToExitSeparation,analytic,1e-12);
 near(r.value.entranceToExitSeparation,6.58585559938142,1e-10);
 near(r.value.entranceToExitSeparationMm,65.8585559938142,1e-9);
 near(r.value.refractedAngleDeg,Math.asin(Math.sin(rad(60))/1.8)*180/Math.PI);
 near(r.value.signedReturnedHeadingDeg,120);
 near(r.value.exitAngleFromOriginalNormalDeg,60);
 near(r.value.perTraversalLateralShiftMm,32.9292779969071);
 assert.equal(r.native.status,'not-run');
 assert.equal(r.value.nativeDetectorEventCount,null);
 assert.equal(r.value.actualNativeFacePointsCertified,false);
});
test('independent vector Snell and mirror reflection predict displacement across a bounded family',()=>{
 let count=0;
 for(const n0 of [1,1.2,1.33,1.5,1.8]){
  for(const n1 of [1.2,1.5,1.8,2.3]){
   for(const incidentAngleDeg of [0,10,30,50,60]){
    const s=n0/n1*Math.sin(rad(incidentAngleDeg));
    if(s>=.99)continue;
    const r=analyzeMirrorBackedSlab({...illustration,insideIndex:n1,
     outsideIndex:n0,incidentAngleDeg});
    assert.equal(r.status,'conditional',JSON.stringify({n0,n1,incidentAngleDeg}));
    const vx=Math.sqrt(1-s*s),vy=s;
    const expectedMm=2*60*vy/vx;
    near(r.value.entranceToExitSeparationMm,expectedMm,1e-8);
    near(r.value.exitAngleFromOriginalNormalDeg,incidentAngleDeg);
    assert.equal(r.native.status,'not-run');
    count++;
   }
  }
 }
 assert.ok(count>35,'Must exercise the general plate relation, not only the source example');
});
test('unit invariance, reflected path, index ratio and thickness scaling are distinct',()=>{
 const a=analyzeMirrorBackedSlab(illustration);
 for(const [unit,factor] of [['mm',10],['m',.01]]){
  const b=analyzeMirrorBackedSlab({...illustration,lengthUnit:unit,
   thickness:illustration.thickness*factor});
  assert.equal(b.status,'conditional');
  near(b.value.entranceToExitSeparationMm,a.value.entranceToExitSeparationMm,1e-10);
 }
 const doubled=analyzeMirrorBackedSlab({...illustration,thickness:12});
 near(doubled.value.entranceToExitSeparation,2*a.value.entranceToExitSeparation);
 const sameRatio=analyzeMirrorBackedSlab({...illustration,insideIndex:3.6,outsideIndex:2});
 near(sameRatio.value.entranceToExitSeparation,a.value.entranceToExitSeparation,1e-10);
 const normal=analyzeMirrorBackedSlab({...illustration,incidentAngleDeg:0});
 near(normal.value.entranceToExitSeparation,0);
 near(normal.value.signedReturnedHeadingDeg,180);
});
test('critical, total internal reflection and missing exterior are never returned as an actual transmitted displacement',()=>{
 const critical=Math.asin(1/1.8)*180/Math.PI;
 for(const deg of [critical-1e-8,critical,critical+1e-8]){
  const r=analyzeMirrorBackedSlab({...illustration,
   outsideIndex:1.8,insideIndex:1,incidentAngleDeg:deg});
  assert.equal(r.status,'numerically-indeterminate');
  assert.equal(r.reasonCode,'NEAR_CRITICAL_ENTRY');
  assert.equal(r.value,null);
 }
 const tir=analyzeMirrorBackedSlab({...illustration,
  outsideIndex:1.8,insideIndex:1,incidentAngleDeg:60});
 assert.equal(tir.status,'unavailable');
 assert.equal(tir.reasonCode,'NO_ENTERING_TRANSMISSION_TIR');
 assert.equal(tir.value,null);
 const sourceOnly=analyzeMirrorBackedSlab(source);
 assert.equal(sourceOnly.status,'needs-information');
 assert.equal(sourceOnly.native.status,'not-run');
});
test('strict fields, unknown model, length units and false optical assumptions fail closed',()=>{
 const keys=['format','kind','model','branchConvention','coordinateConvention','lengthUnit',
  'thickness','insideIndex','incidentAngleDeg'];
 for(const key of keys){
  const q=structuredClone(illustration);delete q[key];
  assert.throws(()=>analyzeMirrorBackedSlab(q),invalid('MISSING_FACTS'));
 }
 for(const bad of [
  {...illustration,outsideIndex:null},
  {...illustration,outsideIndex:undefined},
  {...illustration,outsideIndex:'air'},
  {...illustration,insideIndex:'1.8'},
  {...illustration,insideIndex:NaN},
  {...illustration,insideIndex:4.01},
  {...illustration,thickness:0},
  {...illustration,thickness:-6},
  {...illustration,thickness:'6'},
  {...illustration,lengthUnit:'inches'},
  {...illustration,thickness:1001},
  {...illustration,incidentAngleDeg:-1},
  {...illustration,incidentAngleDeg:90},
  {...illustration,incidentAngleDeg:'60'},
  {...illustration,model:'single-interface-no-mirror'},
  {...illustration,branchConvention:'remove-mirror-for-return'},
  {...illustration,coordinateConvention:'reverse-exit-forward'},
  {...illustration,sourceBrightness:.08},
  {...illustration,detectorCrossings:2},
  {...illustration,partialReflection:false},
  {...illustration,originalQuestionSolved:true},
  null,[],0,{},'{}'
 ])assert.throws(()=>analyzeMirrorBackedSlab(bad));
});
test('capabilities advertise bounded conditional model and original-fact insufficiency',()=>{
 const c=mirrorBackedSlabCapabilities();
 assert.equal(c.format,MIRROR_BACKED_SLAB_QUERY_FORMAT);
 assert.deepEqual(c.optionalFields,['outsideIndex']);
 assert.ok(c.statuses.includes('needs-information'));
 assert.match(c.native,/not-run/);
 assert.ok(c.limitations.some(x=>x.includes('original J08')));
});
test('CLI preserves source bytes for missing information, conditional illustration, physical unavailability and malformed input',()=>{
 for(const q of [source,illustration,{...illustration,outsideIndex:1.8,insideIndex:1}]){
  const input=Buffer.from(JSON.stringify(q,null,2)+'\n'),
   dir=resolve('test-artifacts/llm-authoring/j08-slab-query-'+randomUUID());
  const r=runMirrorBackedSlabEvidence({queryBytes:input,outputPath:dir});
  assert.equal(r.exitCode,0);
  assert.deepEqual(readFileSync(resolve(dir,'input.json')),input);
  const hash=createHash('sha256').update(input).digest('hex');
  assert.equal(r.report.originalInputSha256,hash);
  assert.equal(r.report.result.native.status,'not-run');
  assert.equal(r.report.native.status,'not-run');
  assert.equal(existsSync(resolve(dir,'qualified-scene.json')),false);
  assert.equal(existsSync(resolve(dir,'scene.ray-optics-2d.json')),false);
  assert.equal(existsSync(resolve(dir,'native-summary.json')),false);
  const written=JSON.parse(readFileSync(resolve(dir,'analytical-result.json')));
  assert.equal(written.originalInputSha256,hash);
  assert.throws(()=>runMirrorBackedSlabEvidence({queryBytes:input,outputPath:dir}));
 }
 const broken=Buffer.from('{"format":}');
 const dir=resolve('test-artifacts/llm-authoring/j08-slab-query-'+randomUUID());
 const r=runMirrorBackedSlabEvidence({queryBytes:broken,outputPath:dir});
 assert.equal(r.status,'rejected');assert.equal(r.exitCode,1);
 assert.equal(r.report.native.status,'not-run');
 assert.equal(existsSync(resolve(dir,'analytical-result.json')),false);
 assert.deepEqual(readFileSync(resolve(dir,'input.json')),broken);
 const caps=JSON.parse(execFileSync(process.execPath,[
  fileURLToPath(new URL('../scripts/mirror-backed-slab-query.mjs',import.meta.url)),
  'capabilities'],{encoding:'utf8'}));
 assert.equal(caps.model,illustration.model);
});
