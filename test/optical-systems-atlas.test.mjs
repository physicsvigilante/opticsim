import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkAtlasMetadata,verifyAtlas} from '../evaluation/optical-systems-atlas-v1/check.mjs';
const root=new URL('../evaluation/optical-systems-atlas-v1/',import.meta.url);
const load=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const datasets=()=>Object.fromEntries(['policy','selection','inventory','review'].map(x=>[x,load(x+'.json')]));
test('JEE Atlas is a fixed 5-per-chapter selection from all 114 Problems, without Solutions',async()=>{
 const data=datasets(),summary=checkAtlasMetadata(data);
 assert.equal(summary.selected,40);
 assert.equal(summary.inventory,114);
 assert.equal(summary.chapters,8);
 assert.equal(summary.unreviewed,74);
 assert.deepEqual(Object.values(data.policy.chapterCounts),[15,13,12,10,15,13,27,9]);
 assert.equal(data.selection.cases[0].problemPath,
  '08_Ray_Optics_Explanations/01_Reflection_at_Plane_Surfaces/Problems/001.png');
 assert.equal(data.selection.cases.at(-1).problemPath,
  '08_Ray_Optics_Explanations/08_Aberrations_Human_Eye_Optical_Instruments/Problems/009.png');
 const report=await verifyAtlas();
 assert.equal(report.verification,'metadata-only');
 assert.equal(report.verifiedImages,0);
 assert.equal(report.solutionsRead,false);
 assert.equal(report.modelCalls,0);
 assert.equal(report.nativeExecutions,0);
});
test('Atlas review statistics are calculated from individual classifications, not claims about the full corpus',()=>{
 const d=datasets();
 const report=checkAtlasMetadata(d);
 assert.deepEqual(report.apparatus,{'existing':7,'partial':15,'not-exposed':18});
 assert.deepEqual(report.observable,{'registered':0,'conditional':4,'unregistered':36});
 for(const rows of [
  ['glass-regions',7],['opaque-screen',2],['beam-sources',9],
  ['apparent-image',10],['ray-provenance',7],['instrument',5]
 ])assert.equal(report.gaps[rows[0]],rows[1],rows[0]);
 assert.equal(d.review.cases.every(c=>c.imageSha256.length===64),true);
 assert.equal(d.review.sameAssistantDevelopment,true);
});
test('Atlas rejects postselection path or summary mutation and malformed capability tags',()=>{
 const orig=datasets();
 for(const edit of [
  x=>x.selection.cases[0].problemPath=x.selection.cases[1].problemPath,
  x=>x.inventory.inventory[0].reviewStatus='not-reviewed',
  x=>x.review.cases[0].candidateGaps.push('imagined-engine-object'),
  x=>x.review.cases[5].currentApparatus='fully-solves-problem',
  x=>x.review.summary.apparatus.existing++,
  x=>x.review.cases[1].problemPath=x.review.cases[1].problemPath.replace('/Problems/','/Solutions/')
 ]){
  const x=structuredClone(orig);edit(x);
  assert.throws(()=>checkAtlasMetadata(x),/Atlas integrity/);
 }
});
test('Atlas labels full-circle image and prism tracing separately from original question answers',()=>{
 const d=datasets();
 const byId=new Map(d.review.cases.map(x=>[x.id,x]));
 assert.equal(byId.get('A16').currentObservable,'conditional');
 assert.equal(byId.get('A21').currentApparatus,'existing');
 assert.equal(byId.get('A21').currentObservable,'unregistered');
 assert.equal(byId.get('A27').currentApparatus,'not-exposed');
 assert.ok(byId.get('A18').candidateGaps.includes('opaque-screen'));
 assert.ok(byId.get('A35').candidateGaps.includes('offaxis-lens'));
 assert.ok(byId.get('A15').candidateGaps.includes('graded-index'));
});
test('Pinned PhyDemo already contains absorber, curved glass, beam and GRIN primitives (not Opticsim scope claims)',()=>{
 const sources={
  'src/core/sceneObjs/blocker/Blocker.js':'Blocker',
  'src/core/sceneObjs/blocker/CircleBlocker.js':'CircleBlocker',
  'src/core/sceneObjs/blocker/Aperture.js':'Aperture',
  'src/core/sceneObjs/glass/Glass.js':'Glass',
  'src/core/sceneObjs/glass/CurveGlass.js':'CurveGlass',
  'src/core/sceneObjs/glass/SphericalLens.js':'SphericalLens',
  'src/core/sceneObjs/glass/GrinGlass.js':'GrinGlass',
  'src/core/sceneObjs/lightSource/Beam.js':'Beam',
  'src/core/sceneObjs/other/Detector.js':'Detector'
 };
 for(const [path,type] of Object.entries(sources)){
  const str=readFileSync(new URL('../vendor/ray-optics/'+path,import.meta.url),'utf8');
  assert.ok(str.includes("static type = '"+type+"'"),type+' is not the pinned native class');
 }
 const absorber=readFileSync(new URL('../vendor/ray-optics/src/core/sceneObjs/blocker/Blocker.js',import.meta.url),'utf8');
 const circleAbsorber=readFileSync(new URL('../vendor/ray-optics/src/core/sceneObjs/blocker/CircleBlocker.js',import.meta.url),'utf8');
 assert.match(absorber,/isAbsorbed: true/);
 assert.match(circleAbsorber,/isAbsorbed: true/);
 const sphere=readFileSync(new URL('../vendor/ray-optics/src/core/sceneObjs/glass/Glass.js',import.meta.url),'utf8');
 assert.match(sphere,/circular arcs/);
});
