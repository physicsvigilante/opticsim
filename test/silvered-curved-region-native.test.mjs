import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {compileInterface} from '../src/planar-media.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'silvered-curved-native-'));
function trace(depth,reflected){
  const components=[
    {id:'S',type:'point-source',parameters:{x:depth,y:0,brightness:.04},
      emission:{mode:'directional',directionDeg:reflected?0:180,angleDeg:1.8}},
    {id:'M',type:'circular-arc-mirror',parameters:{x:100,y:0,radius:100,apertureHeight:50,normalDeg:180}},
    {id:'D',type:'ray-detector',parameters:{x:-15,y:0,length:60,orientationDeg:90}}
  ];
  // v6 conservatively rejects the deepest control inside its aperture disk.
  // Assemble the test-only mixture from separately valid native components.
  const [,mirror,detector]=components;
  const isolatedMirror=prepareScene({lengthUnit:'mm',runPolicy:'dense-v1',
    components:[{...components[0],parameters:{...components[0].parameters,x:50}},mirror,detector]}).document;
  const isolatedSource=prepareScene({lengthUnit:'mm',runPolicy:'dense-v1',components:[components[0]]}).document;
  const {native}=core.compile(isolatedMirror);
  const [nativeSource]=core.compile(isolatedSource).native.objs;
  native.objs=[nativeSource,...native.objs.slice(1),
    compileInterface({parameters:{x:0,y:0,normalDeg:0,negativeIndex:1,positiveIndex:1.5,partialReflection:false}})];
  const scene=core.loadNative(native),[source,...optics]=scene.objs;
  const original=source.onSimulationStart,paths=new Map();
  let starts=0;
  source.onSimulationStart=function(...args){
    const result=original.apply(this,args);
    starts++;
    assert.equal(result.brightnessScale,1);
    for(const ray of result.newRays){assert.ok(!paths.has(ray));paths.set(ray,[]);}
    return result;
  };
  for(const [i,label] of ['mirror','detector','flat'].entries()){
    const obj=optics[i],incident=obj.onRayIncident;
    obj.onRayIncident=function(ray,index,point,...rest){
      const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y;
      const event={label,x:point.x,y:-point.y,sign:Math.sign(dx),slope:dy/dx};
      const result=incident.call(this,ray,index,point,...rest);
      assert.ok(!result?.isAbsorbed&&!result?.isUndefinedBehavior&&!result?.newRays?.length);
      const outgoingDx=ray.p2.x-ray.p1.x;
      event.outgoingSign=Math.sign(outgoingDx);
      event.outgoingSlope=(ray.p1.y-ray.p2.y)/outgoingDx;
      paths.get(ray).push(event);
      return result;
    };
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
  let terminal;
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  assert.equal(terminal,'simulationComplete');assert.equal(core.classifyRun(terminal,diagnostics),'completed');
  assert.equal(starts,1);assert.equal(paths.size,3);
  return {native,paths:[...paths.values()],terminal,diagnostics};
}
for(const [depth,returnX] of [[25,-100/3],[50,null],[75,100]])for(const reflected of [false,true])
  test('A28 native '+(reflected?'silvered return':'direct exit')+' at depth '+depth,()=>{
    const run=trace(depth,reflected),expected=reflected?returnX:depth/1.5,derived=[];
    for(const events of run.paths){
      assert.deepEqual(events.map(e=>e.label),reflected?['mirror','flat','detector']:['flat','detector']);
      const flat=events.at(-2),detector=events.at(-1);
      assert.equal(flat.sign,-1);assert.equal(flat.outgoingSign,-1);
      assert.equal(detector.sign,-1);assert.equal(detector.outgoingSign,-1);
      assert.ok(Math.abs(flat.x)<1e-8&&Math.abs(detector.x+15)<1e-8&&Math.abs(flat.y)<10);
      if(reflected){assert.equal(events[0].sign,1);assert.equal(events[0].outgoingSign,-1);assert.ok(Math.abs(events[0].y)<2);}
      assert.ok(Math.abs(detector.slope-flat.outgoingSlope)<1e-10);
      if(expected===null){
        assert.ok(Math.abs(detector.slope)<.00002);
        derived.push({slope:detector.slope});
      }else{
        const x=detector.x-detector.y/detector.slope;
        assert.ok(Math.abs(x-expected)<.20,JSON.stringify({x,expected,depth,reflected}));
        derived.push({signedAxisInterceptMm:x});
      }
    }
    writeFileSync(join(out,depth+(reflected?'-return':'-direct')+'.json'),JSON.stringify({run,expected,derived},null,2),{flag:'wx'});
  });
