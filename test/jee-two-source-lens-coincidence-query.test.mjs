import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {
 analyzeTwoSourceLensCoincidence,twoSourceLensCoincidenceCapabilities,
 COINCIDENCE_QUERY_FORMAT
} from '../src/two-source-lens-coincidence-query.js';
import {runTwoSourceLensCoincidenceEvidence}
 from '../scripts/two-source-lens-coincidence-query.mjs';

const example=JSON.parse(readFileSync(new URL('../examples/jee-two-source-lens-coincidence-v1.json',import.meta.url),'utf8'));
const protocol=JSON.parse(readFileSync(new URL('../evaluation/jee-two-source-lens-coincidence-v1/frozen-protocol.json',import.meta.url),'utf8'));
const near=(x,y,eps=1e-9)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=eps,
 String(x)+' differs from '+String(y)+' by more than '+String(eps));
const sample=()=>structuredClone(example);

test('frozen original J17 source hash and exact mathematical reference preceded implementation',()=>{
 assert.equal(protocol.frozenBeforeImplementation,true);
 assert.equal(protocol.source.frozenCaseId,'J17');
 assert.equal(protocol.source.originalPngSha256,'42364c9242e377fbdf4de4360450e980530626cbfe14992ac1fa089908a62e7b');
 assert.equal(protocol.source.originalSolutionsRead,false);
 assert.deepEqual(protocol.predeclaredJ17Reference.lensFromLeftSourceCm,[6,18]);
 assert.deepEqual(protocol.predeclaredJ17Reference.correspondingGlobalImageXCm,[-12,36]);
 assert.equal(example.format,COINCIDENCE_QUERY_FORMAT);
});
test('J17 stated 24cm and 9cm yield 6cm and 18cm lenses, image x -12cm and +36cm; one real one virtual',()=>{
 const q=sample(),before=structuredClone(q),r=analyzeTwoSourceLensCoincidence(q);
 assert.deepEqual(q,before);
 assert.equal(r.status,'conditional');assert.equal(r.kind,'coincident-image-lens-placement');
 assert.equal(r.value.placementCount,2);assert.equal(r.native.status,'not-run');
 assert.equal(r.native.nativeImageDetected,false);
 for(let i=0;i<2;i++){
  const x=r.value.placements[i];
  near(x.lensX,[6,18][i]);near(x.sharedImageX,[-12,36][i]);
  near(x.lensDistanceFromSource2,[18,6][i]);
  near(x.source1Image.globalImageX,x.sharedImageX);
  near(x.source2Image.globalImageX,x.sharedImageX);
  assert.equal(x.oneRealOneVirtual,true);
  assert.ok(x.maximumSignedGaussianCoordinateMismatchMm<1e-8,
   'The displayed Gaussian coordinate discrepancy is an absolute mm value');
  assert.equal(x.physicalDetectorCoincidenceCertified,false);
  assert.deepEqual([x.source1Image.kind,x.source2Image.kind],
   [['virtual','real'],['real','virtual']][i]);
 }
 assert.equal(r.value.sameMathematicalPositionPerPlacement,true);
});
test('independent signed conjugate formulas agree for a family of valid source separations and focal lengths',()=>{
 for(const d of [23,24,30,60,120]){
  for(const f of [2,3,5,9]){
   if(d<=2*f)continue;
   const q=sample();q.sourceSeparation=d;q.focalLength=f;
   const r=analyzeTwoSourceLensCoincidence(q);
   assert.equal(r.status,'conditional',String(d)+' '+String(f)+': '+String(r.reasonCode));
   for(const solution of r.value.placements){
    const a=solution.lensX;
    const xLeft=a+f*a/(a-f);
    const other=d-a,xRight=a-f*other/(other-f);
    near(xLeft,xRight,1e-7);near(xLeft,solution.sharedImageX,1e-7);
    near(a*(d-a),f*d/2,1e-7);
    assert.ok(a>0&&a<d);
    assert.notEqual(solution.source1Image.kind,solution.source2Image.kind);
   }
  }
 }
});
test('no outside-lens placement makes distinct same-side thin-lens object distances image-coincident',()=>{
 const f=9,d=24,signedV=u=>f*u/(u-f);
 for(const lensX of [-100,-50,-10,30,50,100]){
  const u1=Math.abs(lensX),u2=Math.abs(lensX-d);
  if(u1===f||u2===f)continue;
  assert.ok(Math.abs(signedV(u1)-signedV(u2))>1e-7);
 }
});
test('focal midpoint singularity and negative discriminant do not fabricate finite coincident images',()=>{
 const q=sample();q.sourceSeparation=18;
 let r=analyzeTwoSourceLensCoincidence(q);
 assert.equal(r.status,'no-finite-placement');
 assert.equal(r.reasonCode,'BOTH_OBJECTS_AT_FOCUS');
 assert.equal(r.value.placements.length,0);
 assert.equal(r.native.status,'not-run');
 for(const d of [2,12,17]){
  q.sourceSeparation=d;r=analyzeTwoSourceLensCoincidence(q);
  assert.equal(r.status,'no-finite-placement',String(d));
  assert.equal(r.reasonCode,'NO_REAL_BETWEEN_SOURCE_ROOTS');
  assert.equal(r.value.placementCount,0);
 }
});
test('near-double-focus numerical degeneracy is withheld rather than labeled a detected image',()=>{
 const q=sample();
 for(const d of [18+1e-7,18-1e-7]){
  q.sourceSeparation=d;
  const r=analyzeTwoSourceLensCoincidence(q);
  assert.equal(r.status,'numerically-indeterminate');
  assert.equal(r.reasonCode,'NEAR_DOUBLE_ROOT');
  assert.equal(r.value,null);
 }
 q.sourceSeparation=18.00001;
 const r=analyzeTwoSourceLensCoincidence(q);
 assert.ok(['numerically-indeterminate','conditional'].includes(r.status));
 if(r.status==='conditional')assert.ok(r.value.placements.every(x=>x.oneRealOneVirtual));
});
test('strict essential fact, sign convention, unsupported fields, bounds and JSON type validation',()=>{
 const mutations=[
  q=>{delete q.sourceSeparation;},q=>{delete q.focalLength;},
  q=>{q.focalLength='9';},q=>{q.sourceSeparation=['24'];},
  q=>{q.sourceSeparation=0;},q=>{q.sourceSeparation=-24;},
  q=>{q.focalLength=0;},q=>{q.focalLength=-9;},
  q=>{q.focalLength=Infinity;},q=>{q.focalLength=null;},
  q=>{q.sourceSeparation=1001;},q=>{q.sourceSeparation=NaN;},
  q=>{q.lengthUnit=['cm'];},q=>{q.lengthUnit='in';},
  q=>{q.kind='observed-two-source-image';},
  q=>{q.model='geometrical-native-image';},
  q=>{q.coordinateConvention='silent-ray-convergence';},
  q=>{q.imageX=-12;},q=>{q.aperture=100;},
  q=>{q.backgroundIndex=1;},q=>{q.format='other-query';}
 ];
 for(const mutate of mutations){const q=sample();mutate(q);
  assert.throws(()=>analyzeTwoSourceLensCoincidence(q));}
 for(const thing of [[],null,0,{},'{}'])assert.throws(()=>analyzeTwoSourceLensCoincidence(thing));
});
test('mm/cm/m scale conversions preserve both globally signed image coordinates',()=>{
 const a=analyzeTwoSourceLensCoincidence(sample());
 for(const [unit,factor] of [['mm',10],['m',.01]]){
  const q=sample();q.lengthUnit=unit;q.sourceSeparation*=factor;q.focalLength*=factor;
  const b=analyzeTwoSourceLensCoincidence(q);
  assert.equal(b.status,'conditional');
  for(let i=0;i<2;i++){
   near(b.value.placements[i].lensXMm,a.value.placements[i].lensXMm);
   near(b.value.placements[i].sharedImageXMm,a.value.placements[i].sharedImageXMm);
  }
 }
});
test('CLI preserves original bytes and SHA for conditional, no-placement and refusal, never inventing native scene',()=>{
 const q=sample(),raw=Buffer.from(JSON.stringify(q,null,2)+'\n');
 const dir=resolve('test-artifacts/llm-authoring/lens-coincidence-'+randomUUID());
 const r=runTwoSourceLensCoincidenceEvidence({queryBytes:raw,outputPath:dir});
 assert.equal(r.status,'conditional');assert.equal(r.exitCode,0);
 assert.deepEqual(readFileSync(resolve(dir,'input.json')),raw);
 const sha=createHash('sha256').update(raw).digest('hex');
 assert.equal(r.report.originalInputSha256,sha);
 const analysis=JSON.parse(readFileSync(resolve(dir,'analytical-result.json')));
 assert.equal(analysis.originalInputSha256,sha);
 assert.equal(analysis.results.native.status,'not-run');
 assert.equal(analysis.results.value.placementCount,2);
 assert.equal(existsSync(resolve(dir,'scene.ray-optics-2d.json')),false);
 assert.throws(()=>runTwoSourceLensCoincidenceEvidence({queryBytes:raw,outputPath:dir}));
 const no=sample();no.sourceSeparation=18;
 const noDir=resolve('test-artifacts/llm-authoring/lens-coincidence-'+randomUUID());
 const noResult=runTwoSourceLensCoincidenceEvidence({queryBytes:Buffer.from(JSON.stringify(no)),outputPath:noDir});
 assert.equal(noResult.status,'no-finite-placement');assert.equal(noResult.exitCode,0);
 const malformed=Buffer.from('{"format":}');
 const badDir=resolve('test-artifacts/llm-authoring/lens-coincidence-'+randomUUID());
 const rejected=runTwoSourceLensCoincidenceEvidence({queryBytes:malformed,outputPath:badDir});
 assert.equal(rejected.status,'rejected');assert.equal(rejected.exitCode,1);
 assert.equal(rejected.report.native.status,'not-run');
 assert.equal(existsSync(resolve(badDir,'analytical-result.json')),false);
 assert.deepEqual(readFileSync(resolve(badDir,'input.json')),malformed);
 const caps=JSON.parse(execFileSync(process.execPath,[
  new URL('../scripts/two-source-lens-coincidence-query.mjs',import.meta.url).pathname,
  'capabilities'],{encoding:'utf8'}));
 assert.deepEqual(caps.kinds,twoSourceLensCoincidenceCapabilities().kinds);
 assert.match(caps.native,/not-run/);
});
