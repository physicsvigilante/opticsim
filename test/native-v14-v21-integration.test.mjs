// Main-based integration rehearsal for five independently bounded historical
// native v14-v18 arrangements alongside the already merged JEE v19-v21.
// No ray route, physical image, or textbook answer is synthesized.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,reviseComponents} from '../src/authoring.js';
import {validate,componentParameterNames,parseSave,serializeSave,UPSTREAM} from '../src/contract.js';
import {compositionModels,compositionSourceModes,selectAuthoringComposition} from '../src/composition-profiles.js';
import {apparatusPoints,fitRequestedView} from '../src/result-preview.js';
import {thickLensExtents} from '../src/spherical-lens.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const examples=[
 [14,'two-separated-glass.json','two-separated-dielectrics-tracing',['SingleRay','Glass','Glass','Detector']],
 [15,'native-thick-lens-train.json','native-thick-lens-tracing',['SingleRay','SphericalLens','SphericalLens','Detector']],
 [16,'native-thick-lens-mirror-v16.json','native-thick-lens-mirror-tracing',['SingleRay','SphericalLens','Mirror','Detector']],
 [17,'native-two-thick-lens-mirror-v17.json','native-two-thick-lens-mirror-tracing',['SingleRay','SphericalLens','SphericalLens','Mirror','Detector']],
 [18,'native-thick-lens-aperture-v18.json','native-two-thick-lens-mirror-aperture-tracing',['SingleRay','SphericalLens','SphericalLens','Mirror','Detector','Aperture']],
 [19,'jee-parallel-lens-v19.json','native-parallel-lens-tracing',['Beam','Aperture','IdealLens','Detector']],
 [20,'jee-parallel-two-lens-v20.json','native-parallel-two-lens-tracing',['Beam','IdealLens','IdealLens','Detector','Detector']],
 [21,'jee-semicircular-beam-v21.json','native-parallel-semicircular-tracing',['Beam','Glass','Detector']]
];
const load=path=>JSON.parse(readFileSync(new URL('../examples/'+path,import.meta.url),'utf8'));
const prepare=path=>prepareScene(load(path).physical).document;

test('separate v14–v21 apparatuses choose only their declared schema and original native object set',()=>{
 const catalogue=capabilities().composition;
 assert.equal(catalogue.profiles.length,27);
 for(const [version,path,model,types] of examples){
  const f=load(path),before=JSON.stringify(f),d=prepareScene(f.physical).document;
  assert.equal(JSON.stringify(f),before,path+' authoring changed input');
  assert.equal(d.schemaVersion,version,path);
  assert.equal(d.adapterVersion,version,path);
  assert.equal(d.physics.model,model,path);
  assert.equal(d.upstreamCommit,UPSTREAM,path);
  assert.deepEqual(compositionModels(version).includes(model),true,path);
  assert.deepEqual(core.compile(d).native.objs.map(o=>o.type),types,path);
  assert.deepEqual(parseSave(serializeSave(d)),d,path);
  if(version<=18)assert.deepEqual(compositionSourceModes(version),['single-ray'],path);
  if(version===17||version===18)assert.equal(d.simulation.maxRayDepth,16,path);
  else assert.equal(d.simulation.maxRayDepth,8,path);
 }
 assert.deepEqual(componentParameterNames('ideal-lens',19),['x','focalLength','apertureHeight']);
 assert.deepEqual(componentParameterNames('ideal-lens',20),['x','y','focalLength','apertureHeight']);
 assert.deepEqual(componentParameterNames('spherical-lens',15),
  ['x','y','apertureHeight','centerThickness','frontRadius','backRadius','insideIndex','outsideIndex','partialReflection']);
});
test('cross-family physics mixing and wrong-version deep policy refuse without downgrade',()=>{
 const r=load('native-thick-lens-train.json').physical;
 const beam=structuredClone(load('jee-parallel-two-lens-v20.json').physical.components[0]);
 assert.throws(()=>prepareScene({...structuredClone(r),components:[...r.components,beam]}),
   'a native Beam must not silently become a v15 SingleRay');
 const x=load('native-thick-lens-aperture-v18.json').physical;
 x.components.push(structuredClone(load('jee-semicircular-beam-v21.json').physical.components[1]));
 assert.throws(()=>prepareScene(x),'native semicircle is not admitted inside the v18 thick-lens composition');
 for(const v of [14,15,16,19,20,21]){
  const scene=prepare(examples.find(e=>e[0]===v)[1]);
  const elevated=structuredClone(scene);
  elevated.simulation.maxRayDepth=16;
  assert.throws(()=>validate(elevated),'only v17-v18 may use deep depth, v'+v);
  const p=structuredClone(load(examples.find(e=>e[0]===v)[1]).physical);
  p.runPolicy='native-deep-v18';
  assert.throws(()=>prepareScene(p),'foreign scene requested deep native budget v'+v);
 }
 for(const [source,other] of [[14,15],[18,19],[17,20],[15,21]]){
  const original=prepare(examples.find(e=>e[0]===source)[1]);
  const forged=structuredClone(original);
  forged.schemaVersion=forged.adapterVersion=other;
  forged.physics.model=examples.find(e=>e[0]===other)[2];
  assert.throws(()=>validate(forged),'saved model mutation cannot silently upgrade v'+source+' to v'+other);
 }
});
test('bounded native thick-lens extents are included in fitted viewport and never change optical facts',async()=>{
 const d=prepare('native-thick-lens-train.json'),before=JSON.stringify(d);
 const r=await fitRequestedView(d,null,1000,700);
 assert.equal(r.apparatusFits,true);
 const lensParts=d.physics.components.filter(c=>c.type==='spherical-lens');
 const expected=lensParts.flatMap(c=>thickLensExtents(c.parameters)),points=apparatusPoints(d);
 for(const p of expected){
  assert.ok(points.some(q=>Math.abs(p.x-q.x)<1e-9&&Math.abs(p.y-q.y)<1e-9));
  const q=r.document.presentation.view;
  assert.ok(Math.abs((p.x-q.x)*q.zoom)<=1000/2-r.padding+1e-7);
  assert.ok(Math.abs((p.y-q.y)*q.zoom)<=700/2-r.padding+1e-7);
 }
 assert.equal(JSON.stringify(d),before);
 assert.deepEqual(r.document.physics,d.physics);
 assert.deepEqual(r.document.simulation,d.simulation);
});
test('real pinned-native v14→v18 runs do not contaminate v19-v21 native observations',async()=>{
 for(const [version,path,model] of examples){
  const d=prepare(path);
  const requests=load(path).requests;
  const executed=evaluateDocument(d,core,requests);
  assert.equal(executed.summary.native.status,'completed',path+' genuine native state');
  assert.equal(executed.summary.executionPassed,true);
  const results=(await evaluateObservables(d,requests,executed.summary)).results;
  assert.ok(results.every(x=>['available','qualified','unavailable'].includes(x.status)),path+' original labels');
  if(version===18){
   const emitted=executed.summary.observations.emissionsById?.S1?.emitted;
   assert.equal(emitted,1);
   const glass=executed.summary.observations.interfacesById;
   assert.ok(glass.L1&&glass.L2,'native spherical-lens observations must keep both stable authored IDs');
  }
 }
});
test('cross-v14/v21 native bundle evidence cannot be re-used even if both native runs completed',async()=>{
 const d14=prepare('two-separated-glass.json'),d21=prepare('jee-semicircular-beam-v21.json');
 const doc14=load('two-separated-glass.json'),doc21=load('jee-semicircular-beam-v21.json');
 const e14=evaluateDocument(d14,core,doc14.requests);
 const e21=evaluateDocument(d21,core,doc21.requests);
 assert.equal(e14.summary.native.status,'completed');
 assert.equal(e21.summary.native.status,'completed');
 const stale=(await evaluateObservables(d21,doc21.requests,e14.summary)).results;
 assert.ok(stale.every(x=>x.value===null&&x.status==='suppressed'));
 const other=(await evaluateObservables(d14,doc14.requests,e21.summary)).results;
 assert.ok(other.every(x=>x.value===null&&x.status==='suppressed'));
});
