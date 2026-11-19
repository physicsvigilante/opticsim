// One JEE-first v22+v23 integration rehearsal: unchanged pinned native
// PhyDemo owns every ray. No cross-family migration, invented ray or image.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,capabilities,reviseComponents} from '../src/authoring.js';
import {validate,parseSave,serializeSave,componentParameterNames} from '../src/contract.js';
import {compositionModels,selectAuthoringComposition} from '../src/composition-profiles.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {predict} from '../src/analysis.js';
import {PRISM_BEAM_VERTEX_CLEARANCE_MM,PRISM_BEAM_CRITICAL_SIN_MARGIN} from '../src/native-prism-beam.js';
import {CIRCLE_BEAM_VERSION,CIRCLE_BEAM_CRITICAL_MARGIN,circleBeamNativeEncounter} from '../src/native-circle-beam.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const load=f=>JSON.parse(readFileSync(new URL('../examples/'+f,import.meta.url),'utf8'));
const left=load('jee-prism-beam-v22.json'),right=load('jee-circle-beam-v23.json');
const physical=x=>structuredClone(x.physical);
const prepared=x=>prepareScene(physical(x)).document;

test('one combined registry preserves distinct native v22 prism and v23 circle contracts',()=>{
 const a=prepared(left),b=prepared(right),caps=capabilities();
 assert.equal(a.schemaVersion,22);assert.equal(a.adapterVersion,22);
 assert.equal(b.schemaVersion,23);assert.equal(b.adapterVersion,23);
 assert.equal(a.physics.model,'native-parallel-prism-tracing');
 assert.equal(b.physics.model,'native-parallel-circle-tracing');
 assert.deepEqual(compositionModels(19),['native-parallel-lens-tracing','native-parallel-planar-tracing']);
 assert.deepEqual(compositionModels(20),['native-parallel-two-lens-tracing']);
 assert.deepEqual(compositionModels(21),['native-parallel-semicircular-tracing']);
 assert.deepEqual(compositionModels(22),['native-parallel-prism-tracing']);
 assert.deepEqual(compositionModels(23),['native-parallel-circle-tracing']);
 assert.equal(caps.composition.profiles.filter(p=>p.schemaVersion<=23&&![14,15,16,17,18].includes(p.schemaVersion)).length,24,
  'The v22/v23 integration still owns exactly its historical 24 profiles');
 assert.equal(caps.nativePrismBeam.schemaVersion,22);
 assert.equal(caps.nativeCircleBeam.schemaVersion,23);
 assert.equal(CIRCLE_BEAM_VERSION,23);
 assert.equal(PRISM_BEAM_VERTEX_CLEARANCE_MM,.1);
 assert.equal(PRISM_BEAM_CRITICAL_SIN_MARGIN,1e-5);
 assert.equal(CIRCLE_BEAM_CRITICAL_MARGIN,1e-5);
 assert.deepEqual(core.compile(a).native.objs.map(o=>o.type),['Beam','Glass','Detector']);
 assert.deepEqual(core.compile(b).native.objs.map(o=>o.type),['Beam','CircleGlass','Detector']);
 assert.deepEqual(parseSave(serializeSave(a)),a);
 assert.deepEqual(parseSave(serializeSave(b)),b);
 assert.equal(predict(a).kind,'unavailable');
 assert.equal(predict(b).kind,'unavailable');
 assert.equal(componentParameterNames('ideal-lens',19).includes('y'),false);
 assert.deepEqual(componentParameterNames('ideal-lens',20),['x','y','focalLength','apertureHeight']);
});

test('cross-family mixtures are refused with no implicit version fallback',()=>{
 const a=physical(left),b=physical(right);
 const prism=structuredClone(a.components.find(c=>c.type==='triangular-prism'));
 const circle=structuredClone(b.components.find(c=>c.type==='circular-dielectric'));
 assert.equal(selectAuthoringComposition(a.components).schemaVersion,22);
 assert.equal(selectAuthoringComposition(b.components).schemaVersion,23);
 a.components.push(circle);b.components.push(prism);
 assert.equal(selectAuthoringComposition(a.components).schemaVersion,22);
 assert.equal(selectAuthoringComposition(b.components).schemaVersion,22);
 assert.throws(()=>prepareScene(a),'Mixed prism+circle is not allowed');
 assert.throws(()=>prepareScene(b),'Ordering cannot permit mixed region types');
 const aDoc=prepared(left),bDoc=prepared(right);
 const add=c=>({format:'opticsim-component-revision-v1',operations:[
  {op:'add',lengthUnit:'mm',component:c}]});
 assert.throws(()=>reviseComponents(aDoc,add(circle)));
 assert.throws(()=>reviseComponents(bDoc,add(prism)));
 for(const [doc,version,model] of [
  [aDoc,23,'native-parallel-circle-tracing'],
  [bDoc,22,'native-parallel-prism-tracing'],
  [aDoc,19,'native-parallel-lens-tracing'],
  [bDoc,7,'circular-dielectric-tracing']]){
  const forged=structuredClone(doc);
  forged.schemaVersion=forged.adapterVersion=version;
  forged.physics.model=model;
  assert.throws(()=>validate(forged),'Saved schema cannot be silently recast');
 }
});

test('two independent native runs yield actual face counts, TIR, detector hits and stale suppression',async()=>{
 const a=prepared(left),b=prepared(right);
 const aRun=evaluateDocument(a,core,left.requests),bRun=evaluateDocument(b,core,right.requests);
 for(const n of [aRun,bRun]){
  assert.equal(n.summary.native.status,'completed');
  assert.equal(n.summary.native.truncation,0);
  assert.equal(n.summary.native.undefinedBehavior,0);
 }
 const [aObs,bObs]=await Promise.all([
  evaluateObservables(a,left.requests,aRun.summary),
  evaluateObservables(b,right.requests,bRun.summary)
 ]);
 assert.ok(aObs.results.every(x=>x.status==='qualified'));
 assert.ok(bObs.results.every(x=>x.status==='qualified'));
 assert.deepEqual(aObs.results.slice(0,2).map(x=>x.value),[4,12]);
 assert.equal(aObs.results[4].value,4,'four true native prism TIR callbacks');
 assert.equal(aObs.results[5].value,0,'a genuine sampled prism downstream zero');
 assert.deepEqual(aObs.results[6].value,[]);
 assert.deepEqual(bObs.results.slice(0,2).map(x=>x.value),[4,8]);
 assert.equal(bObs.results[3].value,0);
 assert.equal(bObs.results[4].value,4,'four true native CircleGlass detector crossings');
 assert.equal(bObs.results[5].value.length,4);
 assert.equal(bObs.results[2].value.from,'outside');
 assert.equal(bObs.results[2].value.destinationIndex,1.5);
 const staleA=(await evaluateObservables(a,left.requests,bRun.summary)).results;
 const staleB=(await evaluateObservables(b,right.requests,aRun.summary)).results;
 assert.ok(staleA.every(x=>x.status==='suppressed'&&x.value===null));
 assert.ok(staleB.every(x=>x.status==='suppressed'&&x.value===null));
 assert.notEqual(aRun.summary.canonicalSha256,bRun.summary.canonicalSha256);
 console.log('JEE_V22_V23_NATIVE_INTEGRATION '+JSON.stringify({
  prism:{native:'completed',interactions:12,tir:4,crossings:0},
  circle:{native:'completed',interactions:8,crossings:4},
  staleCrossFamily:'suppressed',nativeImageDetected:false}));
});

test('v23 radial callback guard does not override v22 prism face policy',()=>{
 const a=prepared(left),b=prepared(right);
 const circle=b.physics.components.find(c=>c.type==='circular-dielectric');
 const invalid=circleBeamNativeEncounter(circle,{x:100.0001,y:0},{x:1,y:0});
 assert.equal(invalid.invalid,true);
 assert.equal(core.compile(a).native.objs[1].type,'Glass');
 assert.equal(core.compile(b).native.objs[1].type,'CircleGlass');
});
