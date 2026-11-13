import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {makeLensMotion,makeU2Motion} from '../src/motion-example.js';
import {prepareMotionExperiment,createMotionExperiment,validateMotion,motionCapabilities} from '../src/source-motion.js';
import {analyzeMovingThinLens} from '../src/motion-thin-lens.js';
import {motionRayControls,reviseMotionRayExperiment} from '../src/motion-ray-controls.js';
import {collectMotionView,fitMotionView,projectMotionPoint} from '../src/motion-viewport.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {verifyQualifiedBundle} from '../src/qualification.js';
const lensFixture=JSON.parse(readFileSync(new URL('../examples/moving-lens.json',import.meta.url))),
 mirrorFixture=JSON.parse(readFileSync(new URL('../examples/u2-motion.json',import.meta.url)));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const near=(a,b,tol=1e-5)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol, a+' != '+b);
const make=async()=>prepareMotionExperiment(await makeLensMotion(lensFixture));
test('moving lens is a strictly validated v4 single lens, not a curved mirror or a substituted scene',async()=>{
 const m=await make(),doc=m.baseline.scene,c=doc.physics.components;
 assert.equal(doc.schemaVersion,4);assert.equal(doc.physics.model,'ideal-thin-lens-geometric');
 assert.deepEqual(c.map(x=>x.type),['point-source','ideal-lens']);
 assert.equal(motionCapabilities().limits.maxDepth,8);
 assert.match(motionCapabilities().scope,/thin lens/i);
 assert.equal(m.baseline.qualification.origin.preparationStatus,'illustrative');
 assert.equal(m.baseline.qualification.interpretation.source,undefined);
 assert.match(m.spec.continuationAssumption,/Synthetic demonstration/);
 await verifyQualifiedBundle(m.baseline);
 const mirror=await prepareMotionExperiment(await makeU2Motion(mirrorFixture));
 assert.equal(mirror.frame(0).analysis.image.model,'ideal-gaussian');
 assert.equal(m.frame(0).analysis.image.model,'ideal-thin-lens');
});
test('reuses canonical static lens result for real, focal infinity and virtual image states',async()=>{
 const m=await make(),a=m.frame(0),f=m.sampleAt(2),v=m.frame(60);
 near(a.analysis.globalImageMm.x,700);near(a.analysis.globalImageMm.y,-25);
 near(a.analysis.image.value.magnification,-2.5);
 near(a.analysis.globalImageVelocityMmPerSecond.x,250);
 near(a.analysis.globalImageVelocityMmPerSecond.y,-42.5);
 assert.equal(f.scene.physics.model,'ideal-thin-lens-geometric');
 assert.equal(f.analysis.image.value.imageKind,'at-infinity');
 assert.equal(f.analysis.globalImageMm,null);
 assert.equal(f.analysis.globalImageVelocityMmPerSecond,null);
 near(v.analysis.globalImageMm.x,-800);near(v.analysis.globalImageMm.y,230);
 near(v.analysis.globalImageVelocityMmPerSecond.x,1000);
 near(v.analysis.globalImageVelocityMmPerSecond.y,-170);
 assert.equal(v.analysis.image.value.imageKind,'finite-virtual');
 assert.equal(v.analysis.nativeImageDetection,false);
});
test('analytical image velocity agrees with finite differences including changing off-axis magnification',async()=>{
 const m=await make(),t=.7,h=1e-5;
 const left=m.sampleAt(t-h).analysis.globalImageMm,
 right=m.sampleAt(t+h).analysis.globalImageMm,
 velocity=m.sampleAt(t).analysis.globalImageVelocityMmPerSecond;
 near((right.x-left.x)/(2*h),velocity.x,1e-5);
 near((right.y-left.y)/(2*h),velocity.y,1e-5);
 const snapshot=m.frame(60);
 assert.notEqual(snapshot.analysis.globalImageVelocityMmPerSecond.y,
  snapshot.analysis.image.value.magnification*12,
  'transverse image motion must include the changing-magnification product-rule term');
});
test('existing native PhyDemo traces lens rays at real/focus/virtual samples without image detection',async()=>{
 const m=await make();
 for(const i of [0,20,40,60]){
  const f=m.frame(i),r=evaluateDocument(f.scene,core);
  assert.equal(f.status,'valid');
  assert.equal(r.summary.native.status,'completed');
  assert.ok(r.summary.native.emitted>0);
  assert.equal(f.analysis.nativeImageDetection,false);
 }
});
test('shared camera fits finite lens image states and does not fabricate focal image marker',async()=>{
 const m=await make(),subjects=collectMotionView(m);
 assert.ok(subjects.optics.some(p=>p.x===0&&Math.abs(p.y)===60));
 assert.ok(subjects.nonfiniteImages>=1);
 for(const [width,height] of [[700,360],[390,300]]){
  const fit=fitMotionView(subjects,width,height);
  const a=m.frame(0),v=m.frame(60),infinite=m.sampleAt(2);
  for(const p of [a.object.positionMm,v.object.positionMm,a.analysis.globalImageMm,v.analysis.globalImageMm])
   assert.equal(projectMotionPoint(p,fit.camera).visible,true);
  assert.equal(projectMotionPoint(infinite.analysis.globalImageMm,fit.camera).visible,false);
 }
});
test('source must stay left of the lens at EVERY instant; no side-switching or apparatus change',async()=>{
 const m=await make(),pkg=m.exportExperiment(),baseline=pkg.baseline;
 await assert.rejects(createMotionExperiment(baseline,
  {...pkg.motion,velocity:{x:15,y:0,unit:'cm/s'}}),/thin-lens plane/);
 await assert.rejects(createMotionExperiment(baseline,
  {...pkg.motion,velocity:{x:15,y:0,unit:'cm/s'},samples:2}),/thin-lens plane/);
 assert.throws(()=>analyzeMovingThinLens(
  {...m.baseline.scene,physics:{...m.baseline.scene.physics,model:'general-component-tracing'}},
  {x:40,y:12}),/requires a single canonical ideal lens/);
 assert.equal(m.frame(60).scene.physics.components[0].parameters.x,-160);
});
test('source ray controls and physical lens aperture use same qualified revision/export format as mirrors',async()=>{
 const m=await make(),orig=m.exportExperiment();
 assert.equal(motionRayControls(m.baseline.scene).mirrorType,'ideal-lens');
 const changed=await reviseMotionRayExperiment(orig,{brightness:.3,mirrorApertureHeightMm:80});
 const reloaded=await prepareMotionExperiment(JSON.stringify(changed));
 assert.equal(reloaded.baseline.scene.physics.components[0].parameters.brightness,.3);
 assert.equal(reloaded.baseline.scene.physics.components[1].parameters.apertureHeight,80);
 assert.equal(reloaded.baseline.scene.physics.components[1].parameters.focalLength,200);
 assert.equal(reloaded.baseline.qualification.edits.at(-1).kind,'physics');
 assert.deepEqual(reloaded.spec,m.spec);
 assert.deepEqual(reloaded.frame(60).analysis,m.frame(60).analysis);
 await assert.rejects(reviseMotionRayExperiment(orig,{emissionMode:'single-ray'}),/Unsupported native source/);
 assert.equal(m.frame(0).scene.physics.components[1].parameters.apertureHeight,120);
});
test('negative focal length produces a qualified finite virtual image and velocity',async()=>{
 const m=await make(),pkg=m.exportExperiment(),lens=pkg.baseline.scene.physics.components[1];
 lens.parameters.focalLength=-200;
 const old=m.baseline,doc=structuredClone(old.scene);
 doc.physics.components[1].parameters.focalLength=-200;
 const {recordQualifiedEdit,createQualifiedBundle}=await import('../src/qualification.js');
 const changed=await createQualifiedBundle(doc,recordQualifiedEdit(old.scene,doc,old.qualification),old.observables);
 const experiment=await createMotionExperiment(changed,pkg.motion);
 const model=await prepareMotionExperiment(experiment),f=model.frame(0);
 assert.equal(f.analysis.image.value.imageKind,'finite-virtual');
 assert.equal(f.analysis.nativeImageDetection,false);
 assert.ok(f.analysis.globalImageMm.x<0);
 assert.ok(Number.isFinite(f.analysis.globalImageVelocityMmPerSecond.x));
});
