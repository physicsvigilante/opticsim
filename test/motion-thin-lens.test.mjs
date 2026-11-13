import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {makeLensMotion,makeU2Motion} from '../src/motion-example.js';
import {prepareMotionExperiment,createMotionExperiment,validateMotion,motionCapabilities,MotionPlayer} from '../src/source-motion.js';
import {analyzeMovingThinLens} from '../src/motion-thin-lens.js';
import {motionRayControls,reviseMotionRayExperiment,motionRayControlCapabilities} from '../src/motion-ray-controls.js';
import {collectMotionView,fitMotionView,projectMotionPoint} from '../src/motion-viewport.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {verifyQualifiedBundle,recordQualifiedEdit,createQualifiedBundle} from '../src/qualification.js';
const lensFixture=JSON.parse(readFileSync(new URL('../examples/moving-lens.json',import.meta.url))),
 mirrorFixture=JSON.parse(readFileSync(new URL('../examples/u2-motion.json',import.meta.url)));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const near=(a,b,tol=1e-5)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,a+' != '+b);
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
 assert.equal(m.exportExperiment().format,mirror.exportExperiment().format);
});
test('reuses canonical static lens result for real, exact focal infinity and virtual image states',async()=>{
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
 for(const frame of [a,f,v]){
  assert.equal(frame.analysis.nativeImageDetection,false);
  assert.equal(frame.native.status,'not-run');
  assert.deepEqual(frame.scene.simulation,m.baseline.scene.simulation);
 }
});
test('analytical image velocity agrees with finite differences on BOTH sides of focus, including off-axis magnification',async()=>{
 const m=await make(),h=1e-6;
 for(const t of [.7,1.5,2.5,2.9]){
  const left=m.sampleAt(t-h).analysis.globalImageMm,right=m.sampleAt(t+h).analysis.globalImageMm,
   velocity=m.sampleAt(t).analysis.globalImageVelocityMmPerSecond;
  near((right.x-left.x)/(2*h),velocity.x,1e-3);
  near((right.y-left.y)/(2*h),velocity.y,1e-3);
 }
 const snapshot=m.frame(60);
 assert.notEqual(snapshot.analysis.globalImageVelocityMmPerSecond.y,
  snapshot.analysis.image.value.magnification*12,
  'transverse image motion must include the changing-magnification product-rule term');
});
test('pinned native rays actually HIT the finite lens in real/focal/virtual samples, not merely emit',async()=>{
 const m=await make();
 for(const i of [0,20,40,60]){
  const f=m.frame(i),r=evaluateDocument(f.scene,core);
  assert.equal(f.status,'valid');assert.equal(r.summary.native.status,'completed');
  assert.ok(r.summary.native.emitted>0);assert.equal(f.analysis.nativeImageDetection,false);
  // Ported from PR 29: observe only this native lens instance and delegate
  // every incident call unchanged. No production core/prototype modification.
  const scene=core.loadNative(core.compile(f.scene).native);
  const lenses=scene.objs.filter(o=>o.constructor.type==='IdealLens');
  assert.equal(lenses.length,1);
  const optic=lenses[0],original=optic.onRayIncident;let hits=0;
  optic.onRayIncident=function(...args){hits++;return original.apply(this,args);};
  const sim=new core.Simulator(scene,null,null,null,null,null,false,f.scene.simulation.processedRayLimit);
  let event;sim.on('simulationComplete',()=>event='completed');sim.on('simulationStop',()=>event='stopped');
  sim.updateSimulation();
  assert.equal(event,'completed');assert.equal(sim.totalTruncation,0);
  assert.ok(hits>0,'Actual native rays must hit the lens at frame '+i);
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
test('source controls and physical lens aperture use the same qualified revisions and exports as mirrors',async()=>{
 const m=await make(),orig=m.exportExperiment(),originalBytes=JSON.stringify(orig);
 assert.equal(motionRayControls(m.baseline.scene).opticType,'ideal-lens');
 const changed=await reviseMotionRayExperiment(orig,{brightness:.3,opticalApertureHeightMm:80});
 const reloaded=await prepareMotionExperiment(JSON.stringify(changed));
 assert.equal(reloaded.baseline.scene.physics.components[0].parameters.brightness,.3);
 assert.equal(reloaded.baseline.scene.physics.components[1].parameters.apertureHeight,80);
 assert.equal(reloaded.baseline.scene.physics.components[1].parameters.focalLength,200);
 assert.equal(reloaded.baseline.qualification.edits.at(-1).kind,'physics');
 assert.deepEqual(reloaded.spec,m.spec);
 assert.deepEqual(reloaded.frame(60).analysis,m.frame(60).analysis);
 await verifyQualifiedBundle(await reloaded.qualifiedFrame(60));
 await assert.rejects(reviseMotionRayExperiment(orig,{emissionMode:'single-ray'}),/single-ray/);
 assert.equal(m.frame(0).scene.physics.components[1].parameters.apertureHeight,120);
 assert.equal(JSON.stringify(orig),originalBytes);
});
test('negative focal length gives the correct virtual image and finite-difference velocity',async()=>{
 const m=await make(),old=m.baseline,doc=structuredClone(old.scene);
 doc.physics.components[1].parameters.focalLength=-200;
 const changed=await createQualifiedBundle(doc,recordQualifiedEdit(old.scene,doc,old.qualification),old.observables);
 const model=await prepareMotionExperiment(await createMotionExperiment(changed,m.spec)),f=model.frame(0);
 assert.equal(f.analysis.image.value.imageKind,'finite-virtual');
 assert.equal(f.analysis.nativeImageDetection,false);
 near(f.analysis.globalImageMm.x,-350/3);near(f.analysis.globalImageMm.y,25/6);
 near(f.analysis.image.value.magnification,5/12);
 const h=1e-5,t=.3,a=model.sampleAt(t-h),b=model.sampleAt(t+h),v=model.sampleAt(t).analysis.globalImageVelocityMmPerSecond;
 near((b.analysis.globalImageMm.x-a.analysis.globalImageMm.x)/(2*h),v.x,1e-5);
 near((b.analysis.globalImageMm.y-a.analysis.globalImageMm.y)/(2*h),v.y,1e-5);
});
test('near-focus resolution band is indeterminate, not falsely labelled exact infinity',async()=>{
 const m=await make();
 assert.equal(m.sampleAt(2).analysis.image.value.imageKind,'at-infinity');
 for(const time of [2-1e-11,2+1e-11]){
  const f=m.sampleAt(time);
  assert.equal(f.status,'valid');assert.ok(f.scene);
  assert.equal(f.analysis.image.status,'numerically-indeterminate');
  assert.equal(f.analysis.kinematics.status,'numerically-indeterminate');
  assert.equal(f.analysis.globalImageMm,null);
  assert.equal(f.analysis.globalImageVelocityMmPerSecond,null);
  assert.equal(f.analysis.image.value,undefined);
 }
});
test('generic optical aperture preserves the historical mirror-only alias and rejects ambiguous revisions',async()=>{
 const m=await make(),pkg=m.exportExperiment(),controls=motionRayControls(m.baseline.scene);
 assert.equal(controls.opticalApertureHeightMm,120);assert.equal(controls.mirrorApertureHeightMm,null);
 assert.equal(controls.mirrorType,null);
 assert.deepEqual(motionRayControlCapabilities().sourceModesBySchema[4],['full-circle','directional']);
 await assert.rejects(reviseMotionRayExperiment(pkg,{mirrorApertureHeightMm:80}),/Mirror-only/);
 await assert.rejects(reviseMotionRayExperiment(pkg,{mirrorApertureHeightMm:80,opticalApertureHeightMm:80}),/only one/);
 const mirror=await prepareMotionExperiment(await makeU2Motion(mirrorFixture));
 const edited=await prepareMotionExperiment(await reviseMotionRayExperiment(mirror.exportExperiment(),{mirrorApertureHeightMm:70}));
 assert.equal(motionRayControls(edited.baseline.scene).mirrorApertureHeightMm,70);
 assert.equal(motionRayControls(edited.baseline.scene).opticalApertureHeightMm,70);
});
test('lens motion rejects unsupported additions, invalid apertures and tampered qualified packages',async()=>{
 const m=await make(),pkg=m.exportExperiment(),tampered=structuredClone(pkg);
 tampered.baseline.scene.physics.components[1].parameters.focalLength=220;
 await assert.rejects(prepareMotionExperiment(tampered),/integrity/);
 await assert.rejects(reviseMotionRayExperiment(pkg,{opticalApertureHeightMm:0}),/finite/);
 const second=structuredClone(m.baseline.scene),lens=second.physics.components[1];
 second.physics.components.push({...lens,id:'L2',parameters:{...lens.parameters,x:100}});
 assert.throws(()=>validateMotion(second,m.spec),/Motion accepts/);
});
test('the same MotionPlayer seeks a lens experiment without mutating its baseline or exports',async()=>{
 const m=await make(),before=JSON.stringify(m.exportExperiment());let rendered=0;
 const player=new MotionPlayer({model:m,render:async frame=>{rendered++;return {status:'completed',timeSeconds:frame.timeSeconds};}});
 for(const index of [60,0,40])await player.seek(index);
 assert.equal(rendered,3);assert.equal(player.index,40);assert.equal(player.state,'completed');
 const copy=m.frame(0);copy.scene.physics.components[0].parameters.x=-1;
 assert.equal(m.frame(0).scene.physics.components[0].parameters.x,-280);
 assert.equal(JSON.stringify(m.exportExperiment()),before);
});
