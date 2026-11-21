import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const protocol=JSON.parse(readFileSync(new URL('../evaluation/finite-circular-cap-v1/frozen.json',import.meta.url)));
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'finite-circular-cap-'));
function observe(c,probe,limit=10000){
  const {radiusMm:r,heightMm:h,insideIndex,exteriorIndex,observerXmm}=c;
  const source={id:'S',type:'point-source',parameters:{x:probe,y:0,brightness:.04},
    emission:{mode:'directional',directionDeg:0,angleDeg:1.8}};
  const detector={id:'D',type:'ray-detector',parameters:{x:observerXmm,y:0,length:40,orientationDeg:90}};
  const doc=prepareScene({lengthUnit:'mm',runPolicy:'dense-v1',components:[source,detector]}).document;
  const {native}=core.compile(doc);
  const halfHeight=Math.sqrt(h*(2*r-h)),centreX=h-r;
  native.objs.push({type:'Glass',path:[{x:0,y:-halfHeight,arc:false},{x:h,y:0,arc:true},
    {x:0,y:halfHeight,arc:false}],notDone:false,refIndex:insideIndex/exteriorIndex,partialReflect:false});
  const scene=core.loadNative(native),[emitter,gauge,cap]=scene.objs;
  const starts=emitter.onSimulationStart,glassIncident=cap.onRayIncident,detectorIncident=gauge.onRayIncident;
  const paths=new Map();
  let startCount=0;
  emitter.onSimulationStart=function(...args){
    const result=starts.apply(this,args);startCount++;
    assert.equal(result.brightnessScale,1);
    for(const ray of result.newRays){assert.ok(!paths.has(ray));paths.set(ray,[]);}
    return result;
  };
  const angle=ray=>Math.atan2(ray.p1.y-ray.p2.y,ray.p2.x-ray.p1.x);
  cap.onRayIncident=function(ray,index,point,...rest){
    const before=angle(ray);
    const result=glassIncident.call(this,ray,index,point,...rest);
    const y=-point.y, normal=Math.atan2(y,point.x-centreX),after=angle(ray);
    assert.ok(point.x>0&&Math.abs(Math.hypot(point.x-centreX,y)-r)<1e-7);
    assert.ok(!result?.isAbsorbed&&!result?.isUndefinedBehavior&&!result?.newRays?.length&&Math.cos(after-normal)>0);
    assert.ok(Math.abs(insideIndex*Math.sin(before-normal)-exteriorIndex*Math.sin(after-normal))<1e-9);
    paths.get(ray).push({label:'arc',point:{x:point.x,y},before,after});
    return result;
  };
  gauge.onRayIncident=function(ray,index,point,...rest){
    paths.get(ray).push({label:'detector',point:{x:point.x,y:-point.y},direction:angle(ray)});
    return detectorIncident.call(this,ray,index,point,...rest);
  };
  const sim=new core.Simulator(scene,null,null,null,null,null,false,limit);
  let terminal;
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  return {native,terminal,status:core.classifyRun(terminal,diagnostics),diagnostics,startCount,paths:[...paths.values()]};
}
for(const c of protocol.cases)test('Finite cap inside-source sequence '+c.id,()=>{
  const errors=[];
  for(const probe of [1,.25,.0625]){
    const run=observe(c,probe);
    assert.equal(run.terminal,'simulationComplete');assert.equal(run.status,'completed');
    assert.equal(run.startCount,1);assert.equal(run.paths.length,3);
    const local=c.exteriorIndex/((c.exteriorIndex-c.insideIndex)/-c.radiusMm+c.insideIndex/(probe-c.heightMm));
    const expected=c.observerXmm-c.heightMm-local;
    const estimates=run.paths.map(events=>{
      assert.deepEqual(events.map(e=>e.label),['arc','detector']);
      const {point,direction}=events[1],slope=Math.tan(direction);
      assert.ok(Math.abs(point.x-c.observerXmm)<1e-8&&Math.abs(slope)>1e-6&&Math.cos(direction)>0);
      const measured=point.y/slope;
      assert.ok(Math.abs(measured-expected)<.05,JSON.stringify({measured,expected,probe,c:c.id}));
      return measured;
    });
    errors.push(Math.max(...estimates.map(e=>Math.abs(e-c.expectedObserverDistanceMm))));
    writeFileSync(join(out,c.id+'-'+probe+'.json'),JSON.stringify({run,expected,estimates},null,2),{flag:'wx'});
  }
  assert.ok(errors[0]>errors[1]&&errors[1]>errors[2]&&errors[2]<.10,JSON.stringify(errors));
  assert.equal(observe(c,1,1).terminal,'simulationStop');
});
