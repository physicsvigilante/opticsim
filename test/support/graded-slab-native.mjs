import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
export function runGradedSlab(i,stepSize,{entryX=0,entryY=0,thickness=.3,limit=10000}={}){
  const angle=i*(Math.PI/180),x=entryX-.1*Math.tan(angle),y=.1-entryY;
  const native={version:5,width:1200,height:700,origin:{x:150,y:350},scale:1,mode:'rays',
    rayModeDensity:.2,maxRayDepth:8192,lengthScale:1,simulateColors:false,colorMode:'default',objs:[
    {type:'SingleRay',p1:{x,y},p2:{x:x+Math.sin(angle),y:y-Math.cos(angle)},brightness:.08},
    {type:'GrinGlass',path:[{x:entryX-.5,y:-entryY-thickness},{x:entryX+3,y:-entryY-thickness},{x:entryX+3,y:-entryY},{x:entryX-.5,y:-entryY}],
      notDone:false,refIndexFn:'\\sqrt{1-y}',absorptionFn:'0',plotFns:false,
      origin:{x:entryX,y:-entryY},stepSize,intersectTol:1e-5,partialReflect:false},
    {type:'Detector',p1:{x:entryX-.5,y:-(entryY+thickness+.2)},p2:{x:entryX+3,y:-(entryY+thickness+.2)},irradMap:false}
  ]};
  const scene=core.loadNative(native),[source,body,detector]=scene.objs;
  const emitter=source.onSimulationStart,incident=body.onRayIncident,crossing=detector.onRayIncident;
  const hits=[],sampled=[],identity={start:null};
  let starts=0,terminal;
  source.onSimulationStart=function(...args){
    const result=emitter.apply(this,args);starts++;
    assert.equal(result.newRays.length,1);
    identity.start=result.newRays[0];
    return result;
  };
  body.onRayIncident=function(ray,index,point,...rest){
    assert.equal(ray,identity.start);
    const result=incident.call(this,ray,index,point,...rest);
    assert.ok(!result?.isAbsorbed&&!result?.isUndefinedBehavior&&!result?.newRays?.length);
    sampled.push({x:point.x,y:-point.y});
    return result;
  };
  detector.onRayIncident=function(ray,index,point,...rest){
    assert.equal(ray,identity.start);
    const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y;
    hits.push({x:point.x,y:-point.y,direction:{x:dx/Math.hypot(dx,dy),y:dy/Math.hypot(dx,dy)}});
    return crossing.call(this,ray,index,point,...rest);
  };
  const sim=new core.Simulator(scene,null,null,null,null,null,false,limit);
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  return {native,terminal,diagnostics,status:core.classifyRun(terminal,diagnostics),starts,hits,sampled};
}
