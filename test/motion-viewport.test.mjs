import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {collectMotionView,fitMotionView,projectMotionPoint} from '../src/motion-viewport.js';
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
