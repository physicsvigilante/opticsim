// DRAFT v25 public integration acceptance. No new ray tracer or prescribed ray.
// Every positive outcome uses actual pinned GrinGlass callbacks and one real
// passive detector hit, qualified by a separately derived continuous reference.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,reviseScene} from '../src/authoring.js';
import {validate,UPSTREAM,serializeSave,parseSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {GRIN_V25_POLICY,GRIN_V25_MODEL,GRIN_V25_TRUSTED_LATEX,
 grinV25ExactReference,compileGrinV25,grinV25Extents}
 from '../src/native-grin-v25.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fx=JSON.parse(readFileSync(new URL('../examples/jee-bounded-grin-v25.json',import.meta.url),'utf8'));
const physical=()=>structuredClone(fx.physical);
const scene=()=>prepareScene(physical()).document;
const requests=()=>structuredClone(fx.requests);
const approx=(got,wanted,tol=1e-8)=>assert.ok(Number.isFinite(got)&&Math.abs(got-wanted)<=tol,
 'Expected '+got+' near '+wanted+' within '+tol);
function actualNative(doc,{mutate=null,detectorHits=true}={}){
 const compiled=core.compile(doc);
 if(mutate)mutate(compiled.native);
 const loaded=core.loadNative(compiled.native),ids=compiled.idMap;
 const emission=core.observeSourceSet(doc,loaded,ids);
 const detectors=core.observeDetectorSet(doc,loaded,ids,{captureHitEvents:detectorHits});
 const guard=core.observeNativeGrinV25(doc,loaded,ids);
 const sim=new core.Simulator(loaded,null,null,null,null,null,false,doc.simulation.processedRayLimit);
 let terminal=null;
 for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>terminal=name);
 sim.updateSimulation();
 const data=core.diagnostics(loaded,sim,emission,null,detectors,null,null,{
  detectorHitEvents:detectorHits,nativeEvent:terminal,grinNumericalGuard:guard});
 return {terminal,data,status:core.classifyRun(terminal,data),guard,rawScene:loaded};
}
test('v25 authoring is a strict native GRIN rectangle with exact isolated numerical policy',()=>{
 const before=physical(),input=JSON.stringify(before);
 const {document:d,preparation}=prepareScene(before);
 assert.equal(JSON.stringify(before),input,'authoring must not modify the input');
 assert.equal(d.schemaVersion,25);assert.equal(d.adapterVersion,25);
 assert.equal(d.physics.model,GRIN_V25_MODEL);
 assert.equal(d.upstreamCommit,UPSTREAM);
 assert.deepEqual(d.simulation,{rayDensity:.2,maxRayDepth:1024,processedRayLimit:2048});
 assert.equal(preparation.runPolicy,'native-grin-fine-v25');
 assert.equal(capabilities().nativeGrinV25.schemaVersion,25);
 assert.equal(core.compile(d).native.objs.map(x=>x.type).join(','),'SingleRay,GrinGlass,Detector');
 assert.deepEqual(parseSave(serializeSave(d)),d);
 const grin=d.physics.components[1],native=compileGrinV25(grin);
 assert.equal(native.refIndexFn,GRIN_V25_TRUSTED_LATEX);
 assert.equal(native.origin.y,-grin.parameters.axisY);
 assert.equal(native.partialReflect,false);
 assert.equal(native.stepSize,GRIN_V25_POLICY.stepSizeMm);
 assert.equal(native.path.length,4);
 assert.equal(grinV25Extents(grin.parameters).length,4);
 assert.ok(!core.compile(d).native.objs.some(o=>o.type==='Glass'));
});
test('actual fixed native GrinGlass supports qualified physical ray and true passive detector crossing',async()=>{
 const d=scene(),native=actualNative(d),prediction=grinV25ExactReference(d.physics.components);
 assert.equal(native.terminal,'simulationComplete');
 assert.equal(native.status,'completed',JSON.stringify(native.data.errors));
 assert.deepEqual(native.data.errors,[]);
 assert.equal(native.data.truncation,0);assert.equal(native.data.undefinedBehavior,0);
 assert.equal(native.data.emissionsById.S1.emitted,1);
 assert.equal(native.data.detectorsById.D1.crossings,1);
 assert.equal(native.data.detectorHitEventsById.D1.status,'complete');
 assert.equal(native.data.detectorHitEventsById.D1.events.length,1);
 assert.equal(native.data.grinNumericalGuard.status,'within-bounded-observed-tolerance');
 assert.equal(native.data.grinNumericalGuard.nativeImageDetected,false);
 assert.ok(native.data.grinNumericalGuard.observedNativeCallbacks>=100);
 assert.ok(native.data.grinNumericalGuard.observedNativeCallbacks<1024);
 assert.ok(native.data.grinNumericalGuard.observedMaxPathErrorMm<.002);
 assert.ok(native.data.grinNumericalGuard.observedDetectorErrorMm<.002);
 approx(native.data.grinNumericalGuard.conditionalAnalyticalDetectorY,prediction.expectedDetectorY);
 approx(-native.data.grinNumericalGuard.actualNativeDetectorPoint.y,prediction.expectedDetectorY,.002);
 const evaluated=evaluateDocument(d,core,requests());
 assert.equal(evaluated.summary.native.status,'completed',JSON.stringify(evaluated.summary.native));
 assert.equal(evaluated.summary.executionPassed,true);
 assert.equal(evaluated.summary.native.errors.length,0);
 assert.equal(evaluated.summary.observations.detectorsById.D1.crossings,1);
 const out=await evaluateObservables(d,requests(),evaluated.summary);
 assert.ok(out.results.every(q=>['available','qualified'].includes(q.status)),
  JSON.stringify(out.results));
 console.log('JEE_V25_GRIN_QUALIFIED_NATIVE '+JSON.stringify({
  emitted:1,crossings:1,nativeCallbacks:native.data.grinNumericalGuard.observedNativeCallbacks,
  maxPathErrorMm:native.data.grinNumericalGuard.observedMaxPathErrorMm,
  detectorErrorMm:native.data.grinNumericalGuard.observedDetectorErrorMm,
  nativeY:native.data.grinNumericalGuard.actualNativeDetectorPoint.y,
  conditionalDetectorY:prediction.expectedDetectorY,
  originalJeeSolved:false,nativeImageDetected:false}));
});
test('v25 guard withholds numerically inaccurate native completion and detector hits for test-only coarse stepping',()=>{
 const d=scene();
 const r=actualNative(d,{mutate:native=>{
  const grin=native.objs.find(x=>x.type==='GrinGlass');
  grin.stepSize=.04; // NOT an authorable v25 option; test-only failure witness
 }});
 assert.equal(r.terminal,'simulationComplete','raw pinned ray completion is not a qualified result');
 assert.ok(r.data.grinNumericalGuard.observedNativeCallbacks>0);
 assert.equal(r.status,'failed','strict path/deviation gate must fail despite raw native completion');
 assert.equal(r.data.grinNumericalGuard.status,'withheld-uncertain');
 assert.ok(r.data.errors.some(x=>/GRIN.*(tolerance|mismatch)|numerical/i.test(x)),JSON.stringify(r.data.errors));
 assert.equal(r.data.detectorHitEventsById,null,'native hit event list must not leak from numerically unqualified run');
 assert.equal(r.data.grinNumericalGuard.nativeImageDetected,false);
});
test('v25 rejects missing facts, arbitrary functions, other optics, physical relabeling and foreign budgets',()=>{
 const mutations=[
  p=>{delete p.components[1].parameters.outsideIndex;},
  p=>{p.components[1].parameters.arbitraryLatex='sqrt(y)';},
  p=>{p.components[1].parameters.indexSquaredAtAxis=1;},
  p=>{p.components[1].parameters.gradientLength=1.5;},
  p=>{p.components[1].parameters.partialReflection=true;},
  p=>{p.components[1].parameters.downHeight=.5;},
  p=>{p.components[1].parameters.spanX=2;},
  p=>{p.components[1].parameters.leftX=9000;},
  p=>{p.components[0].parameters.x=0;},
  p=>{p.components[0].parameters.y=.1;},
  p=>{p.components[0].emission.mode='directional';},
  p=>{p.components[0].emission.directionDeg=90;},
  p=>{p.components[2].parameters.orientationDeg=45;},
  p=>{p.components[2].parameters.x=1;},
  p=>{p.components[2].parameters.length=.1;},
  p=>{p.components.push({id:'L',type:'ideal-lens',parameters:{x:3,focalLength:20,apertureHeight:20}});},
  p=>{p.components.push({id:'D2',type:'ray-detector',parameters:{x:2,y:0,orientationDeg:90,length:2}});},
  p=>{p.runPolicy='preview-v1';},
  p=>{p.runPolicy='native-deep-v17';},
  p=>{p.components[1].parameters.indexSquaredAtAxis=Infinity;},
  p=>{p.components[1].parameters.downHeight='0.3';},
  p=>{p.lengthUnit=['mm'];}
 ];
 for(const mutate of mutations){const p=physical();mutate(p);
  assert.throws(()=>prepareScene(p),'Invalid v25 setup must refuse before constructing native rays');
 }
 const d=scene();
 for(const update of [
  d=>{d.schemaVersion=d.adapterVersion=24;d.physics.model='native-curved-entry-observation-tracing';},
  d=>{d.schemaVersion=d.adapterVersion=19;d.physics.model='native-parallel-lens-tracing';},
  d=>{d.simulation.maxRayDepth=8;},
  d=>{d.simulation.maxRayDepth=2048;},
  d=>{d.simulation.processedRayLimit=10000;},
  d=>{d.simulation.rayDensity=1;}
 ]){
  const forged=structuredClone(d);update(forged);assert.throws(()=>validate(forged));
 }
});
test('v25 accepted edits change the actual scene and suppress all stale native results',async()=>{
 const d=scene(),original=evaluateDocument(d,core,requests());
 assert.equal(original.summary.executionPassed,true);
 const changed=structuredClone(d);
 changed.physics.components[0].parameters.x=.2;
 validate(changed);
 const stale=(await evaluateObservables(changed,requests(),original.summary)).results;
 assert.ok(stale.every(x=>x.status==='suppressed'&&x.value===null));
 const revised=evaluateDocument(changed,core,requests());
 assert.equal(revised.summary.executionPassed,true,JSON.stringify(revised.summary.native));
 assert.equal(revised.summary.native.status,'completed');
 assert.notEqual(revised.summary.canonicalSha256,original.summary.canonicalSha256);
 console.log('JEE_V25_REVISED_REAL_NATIVE '+JSON.stringify({
  originalSha:original.summary.canonicalSha256,changedSha:revised.summary.canonicalSha256,
  staleAllSuppressed:true,originalQuestionSolved:false}));
});
