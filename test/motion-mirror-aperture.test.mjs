import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {makeU2Motion} from '../src/motion-example.js';
import {prepareMotionExperiment} from '../src/source-motion.js';
import {motionRayControls,motionRayControlCapabilities,editMotionRayScene,reviseMotionRayExperiment} from '../src/motion-ray-controls.js';
import {curvedPoints} from '../src/curved-mirrors.js';
import {parseQualifiedBundle} from '../src/qualification.js';
import {canonicalJSON} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const example=JSON.parse(readFileSync(new URL('../examples/u2-motion.json',import.meta.url)));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const make=async(circular=false)=>prepareMotionExperiment(await makeU2Motion(example,{circular}));
const mirror=doc=>doc.physics.components.find(c=>c.type==='ideal-curved-mirror'||c.type==='circular-arc-mirror');
const source=doc=>doc.physics.components.find(c=>c.type==='point-source');
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} is not approximately ${b}`);

test('existing v6 mirror aperture is discoverable by model and stable ID, not by the U2 case name',async()=>{
 for(const circular of [false,true]){
  const m=await make(circular),v=motionRayControls(m.baseline.scene);
  assert.equal(v.mirrorApertureHeightMm,60);
  assert.equal(v.mirrorId,'M1');
  assert.equal(v.mirrorType,circular?'circular-arc-mirror':'ideal-curved-mirror');
  assert.equal(motionRayControlCapabilities().mirrorApertureHeightMm.unit,'mm');
  assert.ok(motionRayControlCapabilities().fields.includes('mirrorApertureHeightMm'));
  const scene=structuredClone(m.baseline.scene);
  mirror(scene).id='SecondMirror';
  const revised=editMotionRayScene(scene,{mirrorApertureHeightMm:140});
  assert.equal(mirror(revised).id,'SecondMirror');
  assert.equal(mirror(revised).parameters.apertureHeight,140);
 }
});

test('mirror aperture 6 cm -> 20 cm changes actual bounded native mirror hits without changing focal model',async()=>{
 for(const circular of [false,true]){
  const original=await make(circular),first=original.exportExperiment(),seal=canonicalJSON(first);
  const changed=await prepareMotionExperiment(await reviseMotionRayExperiment(first,{mirrorApertureHeightMm:200}));
  const oldMirror=mirror(original.baseline.scene),newMirror=mirror(changed.baseline.scene);
  assert.equal(newMirror.parameters.apertureHeight,200);
  assert.equal(oldMirror.parameters.apertureHeight,60);
  assert.equal(newMirror.type,oldMirror.type);
  assert.equal(newMirror.parameters.focalLength,oldMirror.parameters.focalLength);
  assert.equal(newMirror.parameters.radius,oldMirror.parameters.radius);
  assert.equal(newMirror.parameters.x,oldMirror.parameters.x);
  assert.equal(newMirror.parameters.y,oldMirror.parameters.y);
  near(Math.hypot(
   curvedPoints({type:newMirror.type,parameters:newMirror.parameters})[0].x-
   curvedPoints({type:newMirror.type,parameters:newMirror.parameters})[1].x,
   curvedPoints({type:newMirror.type,parameters:newMirror.parameters})[0].y-
   curvedPoints({type:newMirror.type,parameters:newMirror.parameters})[1].y),200);
  assert.deepEqual(source(changed.baseline.scene),source(original.baseline.scene));
  assert.deepEqual(changed.spec,original.spec);
  assert.equal(changed.baseline.scene.simulation.rayDensity,original.baseline.scene.simulation.rayDensity);
  assert.equal(changed.baseline.scene.simulation.maxRayDepth,original.baseline.scene.simulation.maxRayDepth);
  assert.equal(changed.baseline.qualification.origin.inputSha256,original.baseline.qualification.origin.inputSha256);
  assert.deepEqual(changed.baseline.qualification.interpretation,original.baseline.qualification.interpretation);
  assert.equal(changed.baseline.qualification.edits.at(-1).kind,'physics');
  assert.match(JSON.stringify(changed.baseline.qualification.edits.at(-1)),/apertureHeight/);
  assert.notEqual(changed.integritySha256,original.integritySha256);
  for(const i of [0,30,60]){
   assert.equal(mirror(changed.frame(i).scene).parameters.apertureHeight,200);
   assert.deepEqual(changed.frame(i).analysis,original.frame(i).analysis);
   const before=evaluateDocument(original.frame(i).scene,core);
   const after=evaluateDocument(changed.frame(i).scene,core);
   assert.equal(before.summary.native.status,'completed');
   assert.equal(after.summary.native.status,'completed');
   assert.equal(before.summary.native.emitted,after.summary.native.emitted);
   assert.ok(after.summary.observations.reflectionsById.M1>before.summary.observations.reflectionsById.M1,
    'larger aperture must collect more real native rays for '+newMirror.type+' at frame '+i);
  }
  const pkg=await changed.qualifiedFrame(30);
  const opened=await parseQualifiedBundle(JSON.stringify(pkg));
  assert.equal(mirror(opened.scene).parameters.apertureHeight,200);
  assert.ok(opened.qualification.edits.some(e=>e.kind==='physics'));
  assert.equal(canonicalJSON(first),seal,'unmodified input package');
 }
});

test('repeated mirror-size revisions preserve history and do not alter the original interpretation',async()=>{
 const original=await make(),sealed=original.exportExperiment();
 let pkg=await reviseMotionRayExperiment(sealed,{mirrorApertureHeightMm:120});
 pkg=await reviseMotionRayExperiment(pkg,{mirrorApertureHeightMm:70});
 const revised=await prepareMotionExperiment(pkg);
 assert.equal(mirror(revised.baseline.scene).parameters.apertureHeight,70);
 assert.equal(revised.baseline.qualification.edits.length,2);
 assert.ok(revised.baseline.qualification.edits.every(e=>e.kind==='physics'));
 assert.equal(revised.baseline.qualification.origin.preparationStatus,'illustrative');
 assert.deepEqual(revised.baseline.qualification.interpretation,original.baseline.qualification.interpretation);
 assert.equal(revised.spec.continuationAssumption,original.spec.continuationAssumption);
 const reopened=await prepareMotionExperiment(JSON.stringify(revised.exportExperiment()));
 assert.equal(reopened.integritySha256,revised.integritySha256);
 assert.equal(mirror(reopened.frame(60).scene).parameters.apertureHeight,70);
 const unchanged=motionRayControls(original.baseline.scene);
 assert.equal(unchanged.mirrorApertureHeightMm,60);
});

test('strict geometry rejects source-motion collisions and impossible circular arcs, never clamps',async()=>{
 for(const circular of [false,true]){
  const m=await make(circular),pkg=m.exportExperiment(),snapshot=canonicalJSON(pkg);
  for(const value of [0,-5,NaN,Infinity,'200',10001]){
   await assert.rejects(reviseMotionRayExperiment(pkg,{mirrorApertureHeightMm:value}));
  }
  await assert.rejects(reviseMotionRayExperiment(pkg,{mirrorApertureHeightMm:1000}),
   /aperture|disk|mirror|arc|Source/i);
  assert.equal(canonicalJSON(pkg),snapshot);
  assert.equal(mirror(m.frame(60).scene).parameters.apertureHeight,60);
 }
});
