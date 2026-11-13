import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {makeU2Motion} from '../src/motion-example.js';
import {prepareMotionExperiment} from '../src/source-motion.js';
import {motionRayControls,motionRayControlCapabilities,editMotionRayScene,reviseMotionRayExperiment} from '../src/motion-ray-controls.js';
import {verifyQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {canonicalJSON} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const sourceExample=JSON.parse(readFileSync(new URL('../examples/u2-motion.json',import.meta.url)));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const make=async()=>prepareMotionExperiment(await makeU2Motion(sourceExample));
function startSource(model){return model.baseline.scene.physics.components.find(x=>x.type==='point-source');}
test('ray controls are canonical scene values, including exact existing sampling presets',async()=>{
 const model=await make(),r=motionRayControls(model.baseline.scene),c=motionRayControlCapabilities();
 assert.equal(r.brightness,0.05);assert.equal(r.rayDensity,1);assert.equal(r.densityPreset,'dense');
 assert.equal(r.emissionMode,'directional');assert.equal(r.directionDeg,0);assert.equal(r.angleDeg,40);
 assert.deepEqual(c.samplingPresets,{sparse:0.048,medium:0.2,dense:1});
 assert.equal(r.maxRayDepth,8);assert.equal(r.processedRayLimit,10000);
 assert.equal(c.meaning.includes('physical'),true);
});
test('brightness revision preserves sealed author interpretation, mirror, motion and native semantics',async()=>{
 const model=await make(),initial=model.exportExperiment(),before=canonicalJSON(initial);
 const pkg=await reviseMotionRayExperiment(initial,{brightness:0.36});
 const next=await prepareMotionExperiment(pkg);
 assert.equal(next.baseline.scene.physics.components[0].parameters.brightness,0.36);
 assert.deepEqual(next.baseline.scene.physics.components.slice(1),model.baseline.scene.physics.components.slice(1));
 assert.deepEqual(next.spec,model.spec);
 assert.equal(next.baseline.qualification.origin.inputSha256,model.baseline.qualification.origin.inputSha256);
 assert.deepEqual(next.baseline.qualification.interpretation,model.baseline.qualification.interpretation);
 assert.equal(next.baseline.qualification.edits.at(-1).kind,'physics');
 assert.match(JSON.stringify(next.baseline.qualification.edits.at(-1)),/brightness/);
 assert.notEqual(pkg.integritySha256,initial.integritySha256);
 assert.equal(canonicalJSON(initial),before);
 const a=model.frame(30).analysis,b=next.frame(30).analysis;
 assert.deepEqual(a,b);
 const opened=await parseQualifiedBundle(JSON.stringify(await next.qualifiedFrame(30)));
 assert.equal(opened.scene.physics.components[0].parameters.brightness,0.36);
 assert.ok(opened.qualification.edits.some(x=>x.kind==='physics'));
});
test('density presets and exact custom sampling change real native ray counts, not calculated image positions',async()=>{
 const model=await make(),pkg=model.exportExperiment();
 const sparse=await prepareMotionExperiment(await reviseMotionRayExperiment(pkg,{densityPreset:'sparse'}));
 const custom=await prepareMotionExperiment(await reviseMotionRayExperiment(pkg,{rayDensity:0.337}));
 assert.equal(motionRayControls(sparse.baseline.scene).densityPreset,'sparse');
 assert.equal(motionRayControls(custom.baseline.scene).densityPreset,'custom');
 assert.equal(custom.baseline.scene.simulation.rayDensity,0.337);
 assert.equal(sparse.baseline.qualification.edits.at(-1).kind,'numerics');
 const a=evaluateDocument(model.frame(0).scene,core),b=evaluateDocument(sparse.frame(0).scene,core);
 assert.ok(a.summary.native.status.startsWith('completed'));
 assert.ok(b.summary.native.status.startsWith('completed'));
 assert.ok(a.summary.native.emitted>b.summary.native.emitted,'Native sparse sampling should launch fewer rays');
 assert.deepEqual(sparse.frame(0).analysis,model.frame(0).analysis);
 assert.deepEqual(sparse.frame(60).analysis,model.frame(60).analysis);
});
test('emission direction and cone remain authored physical fields; single-ray density does not create a cone',async()=>{
 const original=await make(),pkg=original.exportExperiment();
 const changed=await prepareMotionExperiment(await reviseMotionRayExperiment(pkg,{directionDeg:12,angleDeg:20}));
 assert.equal(startSource(changed).emission.directionDeg,12);
 assert.equal(startSource(changed).emission.angleDeg,20);
 assert.equal(startSource(original).emission.directionDeg,0);
 const one=await prepareMotionExperiment(await reviseMotionRayExperiment(pkg,{emissionMode:'single-ray',directionDeg:0}));
 const sparse=await prepareMotionExperiment(await reviseMotionRayExperiment(one.exportExperiment(),{densityPreset:'sparse'}));
 assert.equal(startSource(one).emission.mode,'single-ray');
 for(const m of [one,sparse]){
  const native=evaluateDocument(m.frame(0).scene,core);
  assert.equal(native.summary.native.emitted,1);
  assert.equal(native.summary.native.status,'completed');
 }
});
test('full-circle to exact ray requires an explicitly provided direction; directional reuses existing medium reset rule',async()=>{
 const origin=await make(),full=await prepareMotionExperiment(
  await reviseMotionRayExperiment(origin.exportExperiment(),{emissionMode:'full-circle'}));
 assert.equal(startSource(full).emission.mode,'full-circle');
 await assert.rejects(reviseMotionRayExperiment(full.exportExperiment(),{emissionMode:'single-ray'}),/explicitly supplied direction/);
 const exact=await prepareMotionExperiment(await reviseMotionRayExperiment(full.exportExperiment(),
  {emissionMode:'single-ray',directionDeg:-12}));
 assert.equal(startSource(exact).emission.directionDeg,-12);
 const directional=await prepareMotionExperiment(await reviseMotionRayExperiment(full.exportExperiment(),
  {emissionMode:'directional'}));
 assert.equal(directional.baseline.scene.simulation.rayDensity,0.2);
});
test('native limit changes are hash-bound numerics; rays/extended and grid are presentation only',async()=>{
 const model=await make(),doc=model.baseline.scene;
 const limits=await prepareMotionExperiment(await reviseMotionRayExperiment(model.exportExperiment(),
  {maxRayDepth:4,processedRayLimit:500}));
 assert.equal(limits.baseline.qualification.edits.at(-1).kind,'numerics');
 assert.equal(limits.baseline.scene.simulation.maxRayDepth,4);
 assert.equal(limits.baseline.scene.simulation.processedRayLimit,500);
 const presentation=await prepareMotionExperiment(await reviseMotionRayExperiment(model.exportExperiment(),
  {presentationMode:'extended',grid:true}));
 assert.equal(presentation.baseline.qualification.edits.at(-1).kind,'presentation');
 assert.equal(presentation.baseline.scene.presentation.mode,'extended');
 assert.equal(presentation.baseline.scene.presentation.grid,true);
 assert.deepEqual(presentation.frame(30).analysis,model.frame(30).analysis);
 assert.deepEqual(presentation.baseline.scene.physics,doc.physics);
 assert.deepEqual(presentation.baseline.scene.simulation,doc.simulation);
});
test('multiple user edits append to the same qualified history and remain portable',async()=>{
 const original=await make(),before=original.exportExperiment(),source=before.baseline.scene.physics.components[0];
 let pkg=await reviseMotionRayExperiment(before,{brightness:.2});
 pkg=await reviseMotionRayExperiment(pkg,{densityPreset:'medium'});
 pkg=await reviseMotionRayExperiment(pkg,{presentationMode:'extended'});
 const next=await prepareMotionExperiment(pkg);
 await verifyQualifiedBundle(next.baseline);
 assert.deepEqual(next.baseline.qualification.edits.map(x=>x.kind),['physics','numerics','presentation']);
 assert.equal(next.baseline.qualification.origin.inputSha256,original.baseline.qualification.origin.inputSha256);
 assert.deepEqual(next.spec,original.spec);
 assert.equal(startSource(original).parameters.brightness,source.parameters.brightness);
 assert.equal(startSource(next).parameters.brightness,.2);
 assert.equal(next.baseline.scene.simulation.rayDensity,.2);
 assert.equal(next.baseline.scene.presentation.mode,'extended');
 const saved=JSON.stringify(next.exportExperiment());
 const reopened=await prepareMotionExperiment(saved);
 assert.equal(reopened.integritySha256,next.integritySha256);
 assert.deepEqual(reopened.frame(10),next.frame(10));
});
test('reject unsafe or unsupported edits without mutating original baseline or preserving stale results',async()=>{
 const model=await make(),pkg=model.exportExperiment(),snapshot=canonicalJSON(pkg);
 for(const change of [
  {},{brightness:0},{brightness:2},{brightness:NaN},{rayDensity:0},{rayDensity:1.01},
  {densityPreset:'extreme'},{densityPreset:'sparse',rayDensity:.2},
  {emissionMode:'scripted'},{directionDeg:999},{angleDeg:0},
  {maxRayDepth:-1},{maxRayDepth:1.5},{processedRayLimit:10001},
  {presentationMode:'wave'},{grid:1},{eval:'malicious'},['brightness']
 ]){
  await assert.rejects(reviseMotionRayExperiment(pkg,change));
 }
 assert.equal(canonicalJSON(pkg),snapshot);
 const tampered=structuredClone(pkg);tampered.baseline.scene.physics.components[0].parameters.brightness=.9;
 await assert.rejects(reviseMotionRayExperiment(tampered,{brightness:.3}),/integrity/i);
 assert.throws(()=>editMotionRayScene(model.baseline.scene,{rayDensity:Infinity}),/finite/);
});
