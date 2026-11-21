import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {compileInterface} from '../src/planar-media.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../evaluation/planar-interface-lens-conjugate-v1/frozen.json',import.meta.url)));
const protocol=frozen.nativeProtocol;
mkdirSync('test-artifacts/llm-authoring',{recursive:true});
const evidence=mkdtempSync('test-artifacts/llm-authoring/planar-interface-lens-');
const direction=ray=>{
  const dx=ray.p2.x-ray.p1.x, dy=ray.p1.y-ray.p2.y, norm=Math.hypot(dx,dy);
  return {x:dx/norm,y:dy/norm};
};
function replay(trial,wet,slope){
  const x=trial.objectLensMm, detectorX=x+protocol.detectorGapMm;
  const segment=(type,position,height)=>({type,p1:{x:position,y:-height/2},p2:{x:position,y:height/2}});
  const source={type:'SingleRay',brightness:protocol.brightness,p1:{x:0,y:0},p2:{x:10,y:-10*slope}};
  const boundary=compileInterface({parameters:{x:trial.depthMm,y:0,normalDeg:180,
    positiveIndex:trial.insideIndex,negativeIndex:1,partialReflection:false}});
  const lens={...segment('IdealLens',x,protocol.lensApertureMm),focalLength:trial.focalLengthMm};
  const detector=segment('Detector',detectorX,protocol.detectorHeightMm);
  const native={version:5,width:1200,height:700,origin:{x:100,y:350},scale:1,lengthScale:1,mode:'rays',
    maxRayDepth:protocol.depthBudget,rayModeDensity:0.1,objs:[source,...(wet?[boundary]:[]),lens,detector]};
  const scene=core.loadNative(native), emitter=scene.objs[0], start=emitter.onSimulationStart;
  let emitted,starts=0,terminal;
  emitter.onSimulationStart=function(...args){
    const result=start.apply(this,args);
    assert.equal(result.newRays.length,1);
    emitted=result.newRays[0]; starts++;
    return result;
  };
  const callbacks=[];
  for(const [i,object] of scene.objs.slice(1).entries()){
    const incident=object.onRayIncident;
    object.onRayIncident=function(ray,index,hit,...args){
      assert.equal(ray,emitted);
      const before=direction(ray),point={x:hit.x,y:-hit.y};
      const result=incident.call(this,ray,index,hit,...args);
      assert.ok(!result?.newRays?.length && !result?.isAbsorbed && !result?.isUndefinedBehavior);
      callbacks.push({type:native.objs[i+1].type,point,before,after:direction(ray)});
      return result;
    };
  }
  const simulator=new core.Simulator(scene,null,null,null,null,null,false,1000);
  for(const event of ['simulationComplete','simulationStop'])simulator.on(event,()=>{terminal=event;});
  simulator.updateSimulation();
  const diagnostics=core.diagnostics(scene,simulator,null,null,null,null,null,{nativeEvent:terminal});
  assert.equal(core.classifyRun(terminal,diagnostics),'completed');
  assert.deepEqual(diagnostics.warnings,[]);
  assert.equal(starts,1);
  assert.deepEqual(callbacks.map(c=>c.type),wet?['PlaneGlass','IdealLens','Detector']:['IdealLens','Detector']);
  assert.ok(callbacks.every(c=>c.before.x>0 && c.after.x>0));
  if(wet){
    const entry=callbacks[0];
    assert.ok(Math.abs(entry.point.x-trial.depthMm)<1e-8);
    assert.ok(Math.abs(entry.after.y-trial.insideIndex*entry.before.y)<1e-9);
  }
  const hit=callbacks.at(-1);
  assert.ok(Math.abs(hit.point.x-detectorX)<1e-8 && Math.abs(hit.before.y)>1e-5);
  const imageDistance=hit.point.x-x-hit.point.y*hit.before.x/hit.before.y;
  assert.ok(Math.abs(imageDistance-(wet?trial.wetImageMm:trial.dryImageMm))<protocol.axialToleranceMm,String(imageDistance));
  return {native,callbacks,diagnostics,imageDistance};
}
for(const trial of frozen.cases)for(const wet of [false,true]){
  const id=trial.id+(wet?'-wet':'-dry');
  test('actual planar and thin-lens conjugate callbacks '+id,()=>{
    const results=protocol.slopes.map(s=>replay(trial,wet,s));
    assert.ok(Math.abs(results[0].imageDistance-results[1].imageDistance)<protocol.symmetryToleranceMm);
    writeFileSync(join(evidence,id+'.json'),JSON.stringify(results,null,2),{flag:'wx'});
  });
}
