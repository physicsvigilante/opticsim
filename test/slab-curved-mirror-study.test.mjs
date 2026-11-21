import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {compileInterface} from '../src/planar-media.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../evaluation/slab-curved-mirror-v1/frozen.json',import.meta.url)));
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'slab-curved-mirror-'));
function run(c,y){
  const components=[
    {id:'S',type:'point-source',parameters:{x:-300,y,brightness:.04},emission:{mode:'directional',directionDeg:0,angleDeg:1.8}},
    {id:'M',type:'circular-arc-mirror',parameters:{x:0,y:0,radius:200,normalDeg:180,apertureHeight:40}},
    {id:'D',type:'ray-detector',parameters:{x:-100,y:0,orientationDeg:90,length:60}}
  ];
  const doc=prepareScene({lengthUnit:'mm',runPolicy:'dense-v1',components}).document;
  assert.equal(doc.schemaVersion,6);
  const {native}=core.compile(doc);
  native.objs.push(...c.facesXmm.map((x,i)=>compileInterface({parameters:{x,y:0,normalDeg:0,
    negativeIndex:i===0?1:1.5,positiveIndex:i===0?1.5:1,partialReflection:false}})));
  const scene=core.loadNative(native),[source,...optics]=scene.objs;
  const begin=source.onSimulationStart,events=new Map();
  let starts=0;
  source.onSimulationStart=function(...args){
    const result=begin.apply(this,args);starts++;
    assert.equal(result.brightnessScale,1);
    for(const ray of result.newRays){assert.ok(!events.has(ray));events.set(ray,[]);}
    return result;
  };
  for(const [i,obj] of optics.entries()){
    const incident=obj.onRayIncident;
    obj.onRayIncident=function(ray,index,point,...rest){
      const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y;
      events.get(ray).push({id:['M','D','front','rear'][i],x:point.x,y:-point.y,
        direction:Math.sign(dx),slope:dy/dx});
      const result=incident.call(this,ray,index,point,...rest);
      assert.ok(!result?.isAbsorbed&&!result?.isUndefinedBehavior&&!result?.newRays?.length);
      return result;
    };
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
  let terminal;
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  assert.equal(terminal,'simulationComplete');assert.equal(core.classifyRun(terminal,diagnostics),'completed');
  assert.equal(starts,1);assert.ok(events.size>=3);
  const returning=[];
  for(const path of events.values()){
    assert.deepEqual(path.map(e=>e.id),c.facesXmm.length?['front','rear','D','M','D','rear','front']:['D','M','D']);
    const detector=path.filter(e=>e.id==='D');
    assert.deepEqual(detector.map(e=>e.direction),[1,-1]);
    returning.push(detector[1]);
  }
  const intersections=[];
  for(const [i,a] of returning.entries())for(const b of returning.slice(i+1)){
    assert.ok(Math.abs(a.slope-b.slope)>1e-5);
    const x=a.x+(b.y-a.y+b.slope*(a.x-b.x))/(a.slope-b.slope);
    const ordinate=a.y+(x-a.x)*a.slope;
    assert.ok(Math.abs(x-c.expectedXmm)<.15 && Math.abs(ordinate-y*c.expectedMagnification)<.025,
      JSON.stringify({x,ordinate,c,y}));
    intersections.push({x,y:ordinate});
  }
  writeFileSync(join(out,c.id+'-'+y+'.json'),JSON.stringify({native,diagnostics,terminal,
    paths:[...events.values()],intersections},null,2),{flag:'wx'});
}
for(const c of frozen.cases)for(const y of [0,1])test('A12 native '+c.id+' source height '+y,()=>run(c,y));
