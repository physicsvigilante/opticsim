import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');

// The caller supplies a native scene, with one SingleRay emitter first.
// Each observer measures the actual callback and delegates exactly once.
export function measureNativeSingleRay(native){
  assert.equal(native.objs[0].type,'SingleRay');
  const scene=core.loadNative(native), source=scene.objs[0], start=source.onSimulationStart;
  let emitted,starts=0,terminal;
  source.onSimulationStart=function(...args){
    const result=start.apply(this,args);
    assert.equal(result.newRays.length,1);
    emitted=result.newRays[0]; starts++;
    return result;
  };
  const direction=ray=>{
    const dx=ray.p2.x-ray.p1.x, dy=ray.p1.y-ray.p2.y, norm=Math.hypot(dx,dy);
    assert.ok(norm>0 && Number.isFinite(norm));
    return {x:dx/norm,y:dy/norm};
  };
  const events=[];
  for(const [i,object] of scene.objs.slice(1).entries()){
    const original=object.onRayIncident;
    object.onRayIncident=function(ray,index,p,...args){
      assert.equal(ray,emitted);
      const x=p.x,y=-p.y,before=direction(ray);
      const result=original.call(this,ray,index,p,...args);
      assert.ok(!result?.newRays?.length && !result?.isUndefinedBehavior && !result?.isAbsorbed);
      events.push({objectIndex:i+1,type:native.objs[i+1].type,x,y,before,after:direction(ray)});
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
  return {native,events,diagnostics};
}
