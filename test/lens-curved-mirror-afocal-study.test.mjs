import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../evaluation/lens-curved-mirror-afocal-study-v1/frozen.json',import.meta.url)));
const g=frozen.syntheticNativeGeometry;
mkdirSync('test-artifacts/llm-authoring',{recursive:true});
const out=mkdtempSync('test-artifacts/llm-authoring/lens-curved-mirror-afocal-');
const point=(x,y)=>({x,y:-y});
function trace(trial,height){
  const radius=frozen.mirrorRadiusMm, half=g.mirrorSemiHeightMm, pole=g.lensXmm+trial.gapMm;
  const sag=half*half/(radius+Math.sqrt(radius*radius-half*half));
  const lens={type:'IdealLens',p1:point(g.lensXmm,g.lensApertureHeightMm/2),
    p2:point(g.lensXmm,-g.lensApertureHeightMm/2),focalLength:frozen.focalLengthMm};
  const mirror={type:'ArcMirror',p1:point(pole-sag,-half),p2:point(pole-sag,half),p3:point(pole,0)};
  const detector={type:'Detector',p1:point(g.detectorXmm,-g.detectorHeightMm/2),p2:point(g.detectorXmm,g.detectorHeightMm/2)};
  const source={type:'SingleRay',brightness:g.brightness,p1:point(g.sourceXmm,height),p2:point(g.sourceXmm+10,height)};
  const native={version:5,width:1200,height:700,origin:{x:250,y:350},scale:1,mode:'rays',lengthScale:1,
    rayModeDensity:0.1,maxRayDepth:g.maxRayDepth,objs:[source,lens,mirror,detector]};
  const scene=core.loadNative(native), emitter=scene.objs[0], start=emitter.onSimulationStart;
  const hits=[];
  let emitted,starts=0,terminal;
  emitter.onSimulationStart=function(...args){
    const result=start.apply(this,args);
    starts++;
    assert.equal(result.newRays.length,1);
    emitted=result.newRays[0];
    return result;
  };
  function heading(ray){
    const dx=ray.p2.x-ray.p1.x, dy=ray.p1.y-ray.p2.y;
    return {longitudinalSign:Math.sign(dx),travelSlope:dy/Math.abs(dx)};
  }
  for(const [i,obj] of scene.objs.slice(1).entries()){
    const original=obj.onRayIncident;
    obj.onRayIncident=function(ray,index,p,...rest){
      assert.equal(ray,emitted);
      const x=p.x,y=-p.y,before=heading(ray);
      const result=original.call(this,ray,index,p,...rest);
      assert.ok(!result?.newRays?.length && !result?.isAbsorbed && !result?.isUndefinedBehavior);
      hits.push({type:native.objs[i+1].type,x,y,before,after:heading(ray)});
      return result;
    };
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,1000);
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  assert.equal(core.classifyRun(terminal,diagnostics),'completed');
  assert.deepEqual(diagnostics.warnings,[]);
  assert.equal(starts,1);
  assert.deepEqual(hits.map(h=>h.type),['Detector','IdealLens','ArcMirror','IdealLens','Detector']);
  assert.deepEqual(hits.map(h=>h.after.longitudinalSign),[1,1,-1,-1,-1]);
  assert.ok(Math.abs(hits[2].x-pole)<=sag+1e-7 && Math.abs(hits[2].y)<half);
  assert.ok(Math.abs(hits[3].y-trial.returnHeightScaleAtLens*height)<0.02);
  assert.ok(Math.abs(hits[4].before.travelSlope-trial.returnSlopePerMm*height)<3e-6);
  return {height,native,hits,diagnostics};
}
for(const trial of frozen.cases)test('native return after mirror placement '+trial.id,()=>{
  const records=g.launchHeightsMm.map(height=>trace(trial,height));
  writeFileSync(join(out,trial.id+'.json'),JSON.stringify(records,null,2),{flag:'wx'});
});
