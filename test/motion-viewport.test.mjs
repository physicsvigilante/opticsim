import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {collectMotionView,fitMotionView,projectMotionPoint,defaultMotionCameraControl,applyMotionCameraControl,stepMotionCameraZoom,panMotionCameraByPixels,MOTION_VIEW_LIMITS,MOTION_CAMERA_CONTROLS} from '../src/motion-viewport.js';
import {prepareMotionExperiment} from '../src/source-motion.js';
import {serializeSave} from '../src/contract.js';
import {makeU2Motion} from '../src/motion-example.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const example=JSON.parse(readFileSync(new URL('../examples/u2-motion.json',import.meta.url)));
function sampleModel(){
 const scene={physics:{components:[
  {id:'S1',type:'point-source',parameters:{x:-250,y:0}},
  {id:'M1',type:'ideal-curved-mirror',parameters:{x:0,y:0,normalDeg:180,focalLength:200,apertureHeight:60}}
 ]}};
 return {baseline:{scene},times:Array.from({length:61},(_,i)=>i/120),frame(i){
   const t=i/120,u=250-50/Math.SQRT2*t,h=50/Math.SQRT2*t,m=-200/(u-200);
   return {object:{positionMm:{x:-u,y:h}},analysis:{globalImageMm:{x:-(200*u/(u-200)),y:m*h}}};
 }};
}
test('full-motion camera includes object, optics and every finite U2 image on wide and narrow views',()=>{
 const model=sampleModel(),before=JSON.stringify(model.baseline),subjects=collectMotionView(model);
 for(const [width,height] of [[697,360],[320,300],[820,360]]){
  const fit=fitMotionView(subjects,width,height);
  assert.equal(fit.omittedImages,0);assert.equal(fit.clippedTargets,0);
  for(let i=0;i<61;i++)for(const p of [model.frame(i).object.positionMm,model.frame(i).analysis.globalImageMm])
    assert.equal(projectMotionPoint(p,fit.camera).visible,true);
  for(const i of [60,0,30])assert.deepEqual(fitMotionView(subjects,width,height,{frame:model.frame(i)}).view,fit.view);
 }
 assert.equal(JSON.stringify(model.baseline),before);
});
test('camera modes change only presentation; infinity and extreme finite results are never clipped into a marker',()=>{
 const model=sampleModel(),subjects=collectMotionView(model),frame=model.frame(30);
 const close=fitMotionView(subjects,600,360,{mode:'apparatus',frame});
 assert.equal(projectMotionPoint(frame.analysis.globalImageMm,close.camera).visible,false);
 assert.equal(projectMotionPoint(frame.analysis.globalImageMm,fitMotionView(subjects,600,360,{mode:'frame',frame}).camera).visible,true);
 const extreme={...model,times:[0,1],frame(i){return {...frame,analysis:{globalImageMm:i?null:{x:1e12,y:2}}};}};
 const other=collectMotionView(extreme);assert.equal(other.omittedImages,1);assert.equal(other.nonfiniteImages,1);
 assert.equal(other.images.length,0);
 assert.equal(projectMotionPoint(null,fitMotionView(other,600,360).camera).visible,false);
 assert.equal(projectMotionPoint({x:1e12,y:2},fitMotionView(other,600,360).camera).visible,false);
});
test('fit uses rotated optical endpoints and refuses unusable dimensions or unknown modes',()=>{
 const model=sampleModel();model.baseline.scene.physics.components[1].parameters.normalDeg=90;
 const subjects=collectMotionView(model);
 assert.ok(subjects.optics.some(p=>Math.abs(p.x)>29));
 assert.throws(()=>fitMotionView(subjects,10,360),/Viewport/);
 assert.throws(()=>fitMotionView(subjects,600,360,{mode:'made-up'}),/Unknown camera/);
});
test('fitted camera uses the actual native transform and does not change ray counts or the immutable baseline',async()=>{
 for(const circular of [false,true]){
  const model=await prepareMotionExperiment(await makeU2Motion(example,{circular}));
  const before=serializeSave(model.baseline.scene),subjects=collectMotionView(model);
  for(const index of [0,30,60]){
   const frame=model.frame(index),baseline=serializeSave(frame.scene);
   function native(view){
    const {scene,idMap}=core.loadDocument(view,697,360);
    const em=core.observeSourceSet(view,scene,idMap),mir=core.observeMirrorSet(view,scene,idMap),det=core.observeDetectorSet(view,scene,idMap);
    const sim=new core.Simulator(scene,null,null,null,null,null,false,view.simulation.processedRayLimit);
    sim.updateSimulation();
    return {scene,data:core.diagnostics(scene,sim,em,mir,det)};
   }
   const original=native(frame.scene),view=structuredClone(frame.scene);
   view.presentation.view=fitMotionView(subjects,697,360).view;
   const fitted=native(view);
   const camera={width:697,height:360,scale:fitted.scene.scale,origin:fitted.scene.origin};
   assert.equal(projectMotionPoint(frame.analysis.globalImageMm,camera).visible,true);
   assert.equal(projectMotionPoint(frame.object.positionMm,camera).visible,true);
   assert.deepEqual(fitted.data,original.data);
   assert.equal(serializeSave(frame.scene),baseline);
  }
  assert.equal(serializeSave(model.baseline.scene),before);
 }
});

test('zoom is a presentation-only multiplier for arbitrary motion subjects, not U2-specific optics',()=>{
 const points={optics:[{x:100,y:40},{x:120,y:-20}],objects:[{x:-70,y:30},{x:-20,y:20}],
   images:[{x:450,y:100},{x:500,y:120}],omittedImages:0,nonfiniteImages:0};
 const old=JSON.stringify(points),fit=fitMotionView(points,780,420);
 const start=defaultMotionCameraControl(),unchanged=applyMotionCameraControl(fit,start);
 assert.equal(unchanged.view.zoom,fit.view.zoom);
 let zoom=stepMotionCameraZoom(fit,start,1),inView=applyMotionCameraControl(fit,zoom);
 assert.ok(inView.camera.scale>unchanged.camera.scale);
 assert.ok(Math.abs(inView.camera.scale/unchanged.camera.scale-1.5)<1e-10);
 const outView=applyMotionCameraControl(fit,stepMotionCameraZoom(fit,zoom,-1));
 assert.ok(Math.abs(outView.camera.scale-fit.view.zoom)<1e-10);
 assert.deepEqual(points,JSON.parse(old));
 assert.deepEqual(fit.view,fitMotionView(points,780,420).view);
});
test('pointer-anchored zoom preserves the exact world point beneath the cursor',()=>{
 const fit=fitMotionView({optics:[{x:-20,y:50},{x:5,y:0}],objects:[{x:120,y:75}],
  images:[{x:-400,y:-30}],omittedImages:0,nonfiniteImages:0},800,400);
 const anchor={x:157,y:301},world={x:-130,y:25};
 const old=applyMotionCameraControl(fit,defaultMotionCameraControl()).camera;
 const positionBefore=projectMotionPoint(world,old,0);
 let control=stepMotionCameraZoom(fit,defaultMotionCameraControl(),1,anchor);
 let after=applyMotionCameraControl(fit,control).camera;
 const anchorWorld={x:(anchor.x-old.origin.x)/old.scale,y:(old.origin.y-anchor.y)/old.scale};
 const beforeAt=projectMotionPoint(anchorWorld,old,0),afterAt=projectMotionPoint(anchorWorld,after,0);
 assert.ok(Math.abs(beforeAt.x-anchor.x)<1e-7);
 assert.ok(Math.abs(beforeAt.y-anchor.y)<1e-7);
 assert.ok(Math.abs(afterAt.x-anchor.x)<1e-7);
 assert.ok(Math.abs(afterAt.y-anchor.y)<1e-7);
 assert.ok(positionBefore.x!==projectMotionPoint(world,after,0).x);
});
test('dragging pans in screen directions, does not alter physics, and respects camera coordinate limits',()=>{
 const fit=fitMotionView({optics:[{x:0,y:0}],objects:[{x:-250,y:0}],
  images:[{x:-1000,y:0}],omittedImages:0,nonfiniteImages:0},750,360);
 const world={x:-250,y:0};
 const control=defaultMotionCameraControl(),before=applyMotionCameraControl(fit,control);
 const afterControl=panMotionCameraByPixels(fit,control,48,-32);
 const after=applyMotionCameraControl(fit,afterControl);
 const p=projectMotionPoint(world,before.camera,0),q=projectMotionPoint(world,after.camera,0);
 assert.ok(Math.abs(q.x-p.x-48)<1e-8);
 assert.ok(Math.abs(q.y-p.y+32)<1e-8);
 assert.ok(Math.abs(after.view.x)<=MOTION_VIEW_LIMITS.maxCenter);
 assert.ok(Math.abs(after.view.y)<=MOTION_VIEW_LIMITS.maxCenter);
 assert.throws(()=>panMotionCameraByPixels(fit,control,NaN,4),/Invalid bounded/);
 assert.throws(()=>applyMotionCameraControl(fit,{zoomFactor:Infinity,panMm:{x:0,y:0}}),/Invalid bounded/);
});
test('zoom bounds and automatic fits stay reproducible after non-sequential scrubbing',()=>{
 const model=sampleModel(),subjects=collectMotionView(model),fit=fitMotionView(subjects,697,360);
 let control=defaultMotionCameraControl();
 for(let i=0;i<40;i++)control=stepMotionCameraZoom(fit,control,1);
 assert.ok(control.zoomFactor<=MOTION_CAMERA_CONTROLS.maxRelativeZoom);
 const max=applyMotionCameraControl(fit,control);
 assert.ok(max.view.zoom<=MOTION_VIEW_LIMITS.maxZoom);
 for(let i=0;i<80;i++)control=stepMotionCameraZoom(fit,control,-1);
 assert.ok(control.zoomFactor>=MOTION_CAMERA_CONTROLS.minRelativeZoom);
 const min=applyMotionCameraControl(fit,control);
 assert.ok(min.view.zoom>=MOTION_VIEW_LIMITS.minZoom);
 const fixed=applyMotionCameraControl(fit,{zoomFactor:2,panMm:{x:10,y:-5}});
 for(const i of [60,0,30,5,60,0]){
   const current=fitMotionView(subjects,697,360,{mode:'motion',frame:model.frame(i)});
   assert.deepEqual(applyMotionCameraControl(current,{zoomFactor:2,panMm:{x:10,y:-5}}).camera,fixed.camera);
 }
});
