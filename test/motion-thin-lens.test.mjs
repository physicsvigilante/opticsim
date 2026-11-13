import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {makeLensMotion,makeU2Motion} from '../src/motion-example.js';
import {prepareMotionExperiment,createMotionExperiment,validateMotion,MotionPlayer} from '../src/source-motion.js';
import {reviseMotionRayExperiment,motionRayControls,motionRayControlCapabilities} from '../src/motion-ray-controls.js';
import {recordQualifiedEdit,createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {collectMotionView,fitMotionView,projectMotionPoint} from '../src/motion-viewport.js';
import {predict} from '../src/analysis.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const lensExample=JSON.parse(readFileSync(new URL('../examples/thin-lens-motion.json',import.meta.url)));
const mirrorExample=JSON.parse(readFileSync(new URL('../examples/u2-motion.json',import.meta.url)));
const make=async()=>prepareMotionExperiment(await makeLensMotion(lensExample));
const near=(a,b,tol=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`Expected ${a} near ${b}`);
const lens=scene=>scene.physics.components.find(c=>c.type==='ideal-lens');
test('one unchanged motion package handles a single ideal lens and the old curved mirror',async()=>{
 const old=await prepareMotionExperiment(await makeU2Motion(mirrorExample));
 const newer=await make();
 assert.equal(old.baseline.scene.schemaVersion,6);
 assert.equal(newer.baseline.scene.schemaVersion,4);
 assert.equal(newer.baseline.scene.physics.model,'ideal-thin-lens-geometric');
 assert.equal(old.times.length,newer.times.length);
 assert.equal(newer.exportExperiment().format,old.exportExperiment().format);
 assert.ok(newer.spec.continuationAssumption.includes('Synthetic'));
 assert.equal(newer.baseline.qualification.origin.preparationStatus,'illustrative');
 assert.equal(newer.baseline.scene.physics.components.length,2);
});
test('moving thin lens predicts finite real -> infinity -> virtual without fake native detection',async()=>{
 const m=await make(),real=m.frame(0),infinity=m.frame(50),virtual=m.frame(60);
 assert.equal(real.analysis.image.value.imageKind,'finite-real');
 near(real.analysis.image.value.imageDistance,200);near(real.analysis.image.value.magnification,-1);
 near(real.analysis.globalImageMm.x,200);near(real.analysis.globalImageMm.y,-10);
 near(real.analysis.globalImageVelocityMmPerSecond.x,120);near(real.analysis.globalImageVelocityMmPerSecond.y,-32);
 assert.equal(infinity.analysis.image.value.imageKind,'at-infinity');
 assert.equal(infinity.analysis.globalImageMm,null);assert.equal(infinity.analysis.globalImageVelocityMmPerSecond,null);
 assert.equal(infinity.analysis.kinematics.status,'unavailable');
 assert.equal(virtual.analysis.image.value.imageKind,'finite-virtual');
 near(virtual.analysis.image.value.imageDistance,-400);near(virtual.analysis.image.value.magnification,5);
 near(virtual.analysis.globalImageMm.x,-400);near(virtual.analysis.globalImageMm.y,150);
 near(virtual.analysis.globalImageVelocityMmPerSecond.x,3000);near(virtual.analysis.globalImageVelocityMmPerSecond.y,-800);
 for(const f of [real,infinity,virtual]){
  assert.equal(f.analysis.nativeImageDetection,false);
  assert.equal(f.native.status,'not-run');
  assert.deepEqual(f.scene.simulation,m.baseline.scene.simulation);
  assert.equal(lens(f.scene).parameters.focalLength,100);
 }
});
test('image-position derivative agrees with independent finite difference off axis on both sides of focus',async()=>{
 const m=await make();
 for(const t of [0.2,0.5,0.92]){
  const h=1e-6,a=m.sampleAt(t-h),b=m.sampleAt(t+h),v=m.sampleAt(t).analysis.globalImageVelocityMmPerSecond;
  near((b.analysis.globalImageMm.x-a.analysis.globalImageMm.x)/(2*h),v.x,1e-3);
  near((b.analysis.globalImageMm.y-a.analysis.globalImageMm.y)/(2*h),v.y,1e-3);
  assert.equal(m.sampleAt(t).analysis.image.value.imageKind,predict(m.sampleAt(t).scene).kind);
 }
});
test('near focal singularity withholds finite image/velocity, but native scene remains valid',async()=>{
 const m=await make(),t=5/6;
 for(const time of [t,t+1e-11,t-1e-11]){
  const f=m.sampleAt(time);
  assert.equal(f.scene!==null,true);
  assert.equal(f.analysis.globalImageMm,null);
  assert.equal(f.analysis.globalImageVelocityMmPerSecond,null);
  assert.ok(['at-infinity','numerically-indeterminate'].includes(f.analysis.image.value?.imageKind||f.analysis.image.status));
 }
});
test('pinned native PhyDemo actually intercepts a finite lens in real, focal, and virtual samples',async()=>{
 const m=await make();
 for(const i of [0,30,50,60]){
  const doc=m.frame(i).scene,native=core.compile(doc).native,scene=core.loadNative(native);
  const single=scene.objs.filter(o=>o.constructor.type==='IdealLens');assert.equal(single.length,1);
  let hits=0;const optic=single[0],original=optic.onRayIncident;
  optic.onRayIncident=function(...args){hits++;return original.apply(this,args);};
  const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let event;sim.on('simulationComplete',()=>event='completed');sim.on('simulationStop',()=>event='stopped');
  sim.updateSimulation();assert.equal(event,'completed');assert.equal(sim.totalTruncation,0);
  assert.ok(hits>0,'Real native sampled rays should hit the lens for frame '+i);
 }
});
test('thin-lens controls and aperture reuse qualified revisions, preserving mirror-only edits as mirror-only',async()=>{
 const m=await make(),original=m.exportExperiment(),before=JSON.stringify(original);
 const r=motionRayControls(m.baseline.scene);assert.equal(r.opticType,'ideal-lens');
 assert.equal(r.opticalApertureHeightMm,80);assert.equal(r.mirrorApertureHeightMm,null);
 assert.deepEqual(motionRayControlCapabilities().sourceModesBySchema[4],['full-circle','directional']);
 let edited=await reviseMotionRayExperiment(original,{opticalApertureHeightMm:60});
 edited=await reviseMotionRayExperiment(edited,{brightness:0.25});
 const changed=await prepareMotionExperiment(edited);
 assert.equal(lens(changed.baseline.scene).parameters.apertureHeight,60);
 assert.equal(lens(changed.baseline.scene).parameters.focalLength,100);
 assert.equal(changed.baseline.qualification.edits.length,2);
 assert.ok(changed.baseline.qualification.edits.every(e=>e.kind==='physics'));
 assert.deepEqual(changed.frame(30).analysis,m.frame(30).analysis);
 const qualified=await parseQualifiedBundle(JSON.stringify(await changed.qualifiedFrame(30)));
 assert.equal(lens(qualified.scene).parameters.apertureHeight,60);
 assert.equal(JSON.stringify(original),before);
 await assert.rejects(reviseMotionRayExperiment(original,{emissionMode:'single-ray'}),/single-ray/);
 await assert.rejects(reviseMotionRayExperiment(original,{mirrorApertureHeightMm:70}),/Mirror-only/);
 const old=await prepareMotionExperiment(await makeU2Motion(mirrorExample));
 const mirrorEdited=await prepareMotionExperiment(await reviseMotionRayExperiment(old.exportExperiment(),{mirrorApertureHeightMm:70}));
 assert.equal(mirrorEdited.baseline.scene.physics.components.find(c=>c.type==='ideal-curved-mirror').parameters.apertureHeight,70);
});
test('lens motion rejects crossing its plane, unsupported additions, and tampered saved packages',async()=>{
 const m=await make(),pkg=m.exportExperiment(),bad={...m.spec,velocity:{x:40,y:0,unit:'cm/s'}};
 await assert.rejects(createMotionExperiment(pkg.baseline,bad),/lens plane|source must be left/);
 await assert.rejects(reviseMotionRayExperiment(pkg,{opticalApertureHeightMm:0}),/finite/);
 const tampered=structuredClone(pkg);tampered.baseline.scene.physics.components[1].parameters.focalLength=120;
 await assert.rejects(prepareMotionExperiment(tampered),/integrity/);
 const second=structuredClone(pkg.baseline.scene);
 second.physics.components.push({...lens(second),id:'L2',parameters:{...lens(second).parameters,x:100}});
 assert.throws(()=>validateMotion(second,m.spec),/Motion requires|lens bench/);
});
test('reuse whole-motion automatic camera and player for lens without changing optical facts',async()=>{
 const m=await make(),snapshot=JSON.stringify(m.exportExperiment()),subjects=collectMotionView(m);
 assert.ok(subjects.optics.some(p=>p.x===0&&p.y===40));
 assert.ok(subjects.optics.some(p=>p.x===0&&p.y===-40));
 const fitted=fitMotionView(subjects,840,490,{mode:'motion'}),frame=m.frame(0);
 assert.ok(projectMotionPoint(frame.object.positionMm,fitted.camera).visible);
 assert.ok(projectMotionPoint(frame.analysis.globalImageMm,fitted.camera).visible);
 let seen=0;const p=new MotionPlayer({model:m,render:async f=>{seen++;return {status:'completed',timeSeconds:f.timeSeconds};}});
 await p.seek(60);await p.seek(0);await p.seek(50);
 assert.equal(seen,3);assert.equal(p.index,50);
 assert.equal(JSON.stringify(m.exportExperiment()),snapshot);
});
test('diverging lens gives finite virtual upright image with independent finite-difference motion',async()=>{
 const m=await make(),original=m.exportExperiment(),scene=structuredClone(original.baseline.scene);
 lens(scene).parameters.focalLength=-100;
 const q=recordQualifiedEdit(original.baseline.scene,scene,original.baseline.qualification);
 const baseline=await createQualifiedBundle(scene,q,original.baseline.observables);
 const b=await prepareMotionExperiment(await createMotionExperiment(baseline,m.spec));
 const f=b.frame(0);assert.equal(f.analysis.image.value.imageKind,'finite-virtual');
 near(f.analysis.image.value.imageDistance,-200/3);near(f.analysis.image.value.magnification,1/3);
 near(f.analysis.globalImageMm.y,10/3);
 assert.ok(f.analysis.globalImageVelocityMmPerSecond.x>0);
 const h=1e-5,x=b.sampleAt(.3+h),y=b.sampleAt(.3-h),v=b.sampleAt(.3).analysis.globalImageVelocityMmPerSecond;
 near((x.analysis.globalImageMm.x-y.analysis.globalImageMm.x)/(2*h),v.x,1e-5);
 near((x.analysis.globalImageMm.y-y.analysis.globalImageMm.y)/(2*h),v.y,1e-5);
});
