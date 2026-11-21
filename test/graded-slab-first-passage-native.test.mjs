import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'graded-slab-first-passage-'));
const rad=Math.PI/180;
const thickness=.3;
function run(i,stepSize){
  const angle=i*rad,x=-.1*Math.tan(angle);
  const native={version:5,width:1200,height:700,origin:{x:150,y:350},scale:1,mode:'rays',
    rayModeDensity:.2,maxRayDepth:8192,lengthScale:1,simulateColors:false,colorMode:'default',objs:[
    {type:'SingleRay',p1:{x,y:.1},p2:{x:x+Math.sin(angle),y:.1-Math.cos(angle)},brightness:.08},
    {type:'GrinGlass',path:[{x:-.5,y:-thickness},{x:3,y:-thickness},{x:3,y:0},{x:-.5,y:0}],
      notDone:false,refIndexFn:'\\sqrt{1-y}',absorptionFn:'0',plotFns:false,
      origin:{x:0,y:0},stepSize,intersectTol:1e-5,partialReflect:false},
    {type:'Detector',p1:{x:-.5,y:-.5},p2:{x:3,y:-.5},irradMap:false}
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
  const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  return {native,terminal,diagnostics,status:core.classifyRun(terminal,diagnostics),starts,hits,sampled};
}
for(const i of [20,60,80])test('A15 non-grazing native first passage at '+i+' degrees',()=>{
  const q=Math.sin(i*rad),b=Math.cos(i*rad);
  const expected=2*q*thickness/(Math.sqrt(b*b+thickness)+b);
  const deviations=[];
  for(const stepSize of [.001,.00025]){
    const observed=run(i,stepSize);
    writeFileSync(join(out,i+'-'+stepSize+'.json'),JSON.stringify({observed,expected},null,2),{flag:'wx'});
    assert.equal(observed.terminal,'simulationComplete');assert.equal(observed.status,'completed');
    assert.equal(observed.starts,1);assert.equal(observed.hits.length,1);
    const [entrance]=observed.sampled,exit=observed.sampled.at(-1);
    assert.ok(Math.hypot(entrance.x,entrance.y)<1e-7);
    assert.ok(Math.abs(exit.y-thickness)<1e-7&&Math.abs(exit.x-expected)<.003,JSON.stringify({exit,expected,i,stepSize}));
    assert.ok(observed.hits[0].direction.y>0 && Math.abs(observed.hits[0].direction.x-q)<.003);
    const residual=Math.max(...observed.sampled.map(p=>Math.abs(p.y-b*p.x/q-p.x*p.x/(4*q*q))));
    assert.ok(residual<.003);
    deviations.push(residual);
  }
  assert.ok(deviations[1]<=deviations[0],JSON.stringify(deviations));
});
