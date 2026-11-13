import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {makeU2Motion} from '../src/motion-example.js';
import {prepareMotionExperiment,createMotionExperiment,MotionPlayer} from '../src/source-motion.js';
import {parseQualifiedBundle} from '../src/qualification.js';
import {canonicalJSON} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const example=JSON.parse(readFileSync(new URL('../examples/u2-motion.json',import.meta.url)));
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const make=async()=>prepareMotionExperiment(await makeU2Motion(example));
test('U2 t=0 matches stated instantaneous problem without treating later trajectory as given',async()=>{
 const m=await make(),f=m.frame(0),v=f.analysis.globalImageVelocityMmPerSecond;
 near(f.analysis.image.value.imageDistance,1000);near(f.analysis.image.value.magnification,-4);
 near(v.x,-400*Math.SQRT2);near(v.y,-100*Math.SQRT2);
 assert.match(m.spec.continuationAssumption,/does not specify/);
 assert.equal(f.native.status,'not-run');assert.equal(f.analysis.nativeImageDetection,false);
});
test('out-of-order frames come from immutable baseline, not accumulation or caller mutation',async()=>{
 const pkg=await makeU2Motion(example),before=canonicalJSON(pkg),pending=prepareMotionExperiment(pkg);
 pkg.motion.velocity.speed=900;
 const m=await pending,a=m.frame(60),z=m.frame(0),again=m.frame(60);
 assert.deepEqual(again,a);near(z.object.positionMm.x,-250);near(z.object.positionMm.y,0);
 near(a.object.positionMm.x,-250+25/Math.SQRT2);near(a.object.positionMm.y,25/Math.SQRT2);
 assert.equal(canonicalJSON(m.exportExperiment()),before);
 a.scene.physics.components[0].parameters.x=999;assert.notEqual(m.frame(60).scene.physics.components[0].parameters.x,999);
 assert.deepEqual(m.frame(30).scene.simulation,m.baseline.scene.simulation);
 assert.deepEqual(m.frame(30).scene.physics.components[0].emission,m.baseline.scene.physics.components[0].emission);
});
test('native ideal/circular rays are actually retraced at every sampled source position',async()=>{
 for(const circular of [false,true]){
  const m=await prepareMotionExperiment(await makeU2Motion(example,{circular}));
  for(const i of [0,30,60]){
   const f=m.frame(i),r=evaluateDocument(f.scene,core);
   assert.equal(r.summary.native.status,'completed');assert.equal(r.summary.native.truncation,0);
   assert.ok(r.summary.observations.reflectionsById.M1>0);
   assert.equal(f.analysis.image.model,circular?'spherical-paraxial':'ideal-gaussian');
  }
 }
});
test('instantaneous analytical velocity is consistent with neighbouring image positions',async()=>{
 const m=await make(),t=.25,h=1e-5,a=m.sampleAt(t-h),b=m.sampleAt(t+h),v=m.sampleAt(t).analysis.globalImageVelocityMmPerSecond;
 near((b.analysis.globalImageMm.x-a.analysis.globalImageMm.x)/(2*h),v.x,1e-5);
 near((b.analysis.globalImageMm.y-a.analysis.globalImageMm.y)/(2*h),v.y,1e-5);
});
test('exact focus, near focus and beyond focus never become clipped finite image markers',async()=>{
 const original=await makeU2Motion(example),spec={...original.motion,durationSeconds:2};
 const m=await prepareMotionExperiment(await createMotionExperiment(original.baseline,spec));
 const focus=(250-200)/(50/Math.SQRT2);
 const at=m.sampleAt(focus),close=m.sampleAt(focus+1e-11),after=m.sampleAt(1.7);
 assert.ok(at.analysis.image.value?.imageKind==='at-infinity'||at.analysis.image.status==='numerically-indeterminate');
 assert.equal(at.analysis.globalImageMm,null);assert.equal(close.analysis.globalImageMm,null);
 assert.equal(after.analysis.image.value.imageKind,'finite-virtual');
 assert.equal(at.analysis.globalImageVelocityMmPerSecond,null);
});
test('units agree; invalid expression/unknown field, unbounded time, wrong source and collision reject',async()=>{
 const p=await makeU2Motion(example),m=await prepareMotionExperiment(p),v=50/Math.SQRT2;
 const mm=await prepareMotionExperiment(await createMotionExperiment(p.baseline,{...p.motion,velocity:{x:v,y:v,unit:'mm/s'}}));
 near(m.frame(60).object.positionMm.x,mm.frame(60).object.positionMm.x);
 for(const bad of [{...p.motion,law:'eval'}, {...p.motion,samples:500}, {...p.motion,sourceId:'bogus'},
  {...p.motion,durationSeconds:Infinity},{...p.motion,velocity:{x:'sin(t)',y:0,unit:'mm/s'}},
  {...p.motion,velocity:{x:1000,y:0,unit:'mm/s'},durationSeconds:.5}]){
  await assert.rejects(createMotionExperiment(p.baseline,bad));
 }
});
test('motion hash and baseline integrity reject tampering; frame export preserves assumptions',async()=>{
 const p=await makeU2Motion(example),tampered=structuredClone(p);tampered.motion.velocity.speed=6;
 await assert.rejects(prepareMotionExperiment(tampered),/integrity/);
 const m=await prepareMotionExperiment(p),frame=await m.qualifiedFrame(20),opened=await parseQualifiedBundle(JSON.stringify(frame));
 assert.equal(opened.qualification.origin.preparationStatus,'illustrative');
 assert.equal(opened.qualification.edits.length,1);
 assert.ok(opened.qualification.interpretation.derived.at(-1).includes(m.integritySha256));
 assert.deepEqual(opened.scene,m.frame(20).scene);
});
test('stopped or truncated native frames stay incomplete, despite available conditional mathematics',async()=>{
 const p=await makeU2Motion(example),doc=structuredClone(p.baseline.scene);doc.simulation.maxRayDepth=0;
 const {createQualifiedBundle}=await import('../src/qualification.js');
 const b=await createQualifiedBundle(doc,p.baseline.qualification,[]);
 const m=await prepareMotionExperiment(await createMotionExperiment(b,p.motion));
 const result=evaluateDocument(m.frame(0).scene,core);
 assert.equal(result.summary.native.status,'incomplete');assert.equal(result.summary.observations,null);
 assert.equal(m.frame(0).analysis.image.status,'conditional');
});
test('scrubbing cancels an older render and never publishes its late callback',async()=>{
 const m=await make(),waiters=[],states=[];
 const player=new MotionPlayer({model:m,render:(f,s)=>new Promise(resolve=>waiters.push({f,s,resolve})),onState:p=>states.push({i:p.index,state:p.state})});
 const a=player.seek(0),b=player.seek(30);assert.equal(waiters[0].s.aborted,true);
 waiters[1].resolve({status:'completed'});await b;
 waiters[0].resolve({status:'completed'});await a;
 assert.equal(player.index,30);assert.equal(player.result.frame.timeSeconds,.25);
 assert.equal(states.filter(x=>x.state==='completed').length,1);
});
test('play waits for completion, pause prevents next frame, failed frames pause and reset works',async()=>{
 const m=await make(),scheduled=[];
 const player=new MotionPlayer({model:m,render:async()=>({status:'completed'}),schedule:(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;},unschedule:()=>{}});
 await player.play();assert.equal(scheduled.length,1);assert.equal(player.playing,true);
 player.pause();await player.seek(0);assert.equal(player.index,0);assert.equal(player.playing,false);
 const failure=new MotionPlayer({model:m,render:async()=>({status:'incomplete'}),schedule:()=>{throw Error('Should not schedule');}});
 await failure.play();assert.equal(failure.playing,false);assert.equal(failure.state,'incomplete');
 failure.stop();assert.equal(failure.result,null);
});
