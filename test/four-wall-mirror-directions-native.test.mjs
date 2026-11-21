import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../evaluation/four-wall-mirror-directions-v1/frozen.json',import.meta.url)));
const root='test-artifacts/llm-authoring';mkdirSync(root,{recursive:true});
const out=mkdtempSync(join(root,'four-wall-mirror-native-'));
const flip=([x,y])=>({x,y:-y});
const segment=(type,a,b)=>({type,p1:flip(a),p2:flip(b),filter:false});
function trace({start,target,vector,limit=10000}){
  const [sx,sy]=start,[tx,ty]=target,[dx,dy]=vector;
  const native={version:5,width:1200,height:700,origin:{x:250,y:350},scale:1,mode:'rays',rayModeDensity:.2,
    maxRayDepth:8,lengthScale:1,simulateColors:false,colorMode:'default',objs:[
      {type:'SingleRay',p1:flip(start),p2:flip([sx+dx,sy+dy]),brightness:.04},
      segment('Mirror',[0,.2],[0,179.8]),segment('Mirror',[300,.2],[300,179.8]),
      segment('Mirror',[.2,0],[299.8,0]),segment('Mirror',[.2,180],[299.8,180]),
      segment('Blocker',[tx,ty-.1],[tx,ty+.1])
    ]};
  const scene=core.loadNative(native),[source,...walls]=scene.objs,events=[];
  const startNative=source.onSimulationStart;
  let emitted,starts=0,terminal;
  source.onSimulationStart=function(...args){
    const result=startNative.apply(this,args);
    assert.equal(result.newRays.length,1);starts++;emitted=result.newRays[0];return result;
  };
  for(const [i,wall] of walls.entries()){
    const label=['left','right','bottom','top','target'][i],incident=wall.onRayIncident;
    wall.onRayIncident=function(ray,index,point,...rest){
      assert.equal(ray,emitted);
      const before={x:ray.p2.x-ray.p1.x,y:ray.p1.y-ray.p2.y};
      const result=incident.call(this,ray,index,point,...rest);
      assert.ok(!result?.isUndefinedBehavior&&!result?.newRays?.length);
      const norm=Math.hypot(before.x,before.y);
      events.push({label,point:{x:point.x,y:-point.y},before:{x:before.x/norm,y:before.y/norm},
        absorbed:result?.isAbsorbed===true});
      return result;
    };
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,limit);
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  return {native,terminal,status:core.classifyRun(terminal,diagnostics),starts,diagnostics,events};
}
for(const [i,c] of frozen.nativeControls.forward.entries())test('A04 real four-wall trajectory and reverse '+i,()=>{
  for(const reverse of [false,true]){
    const start=reverse?[200,60]:[55,140],target=reverse?[55,140]:[200,60];
    const vector=reverse?c.vector.map(v=>-v):c.vector;
    const observed=trace({start,target,vector});
    assert.equal(observed.terminal,'simulationComplete');assert.equal(observed.status,'completed');
    assert.equal(observed.starts,1);
    assert.deepEqual(observed.events.map(e=>e.label),[...(reverse?[...c.walls].reverse():c.walls),'target']);
    const last=observed.events.at(-1),length=Math.hypot(...vector);
    assert.ok(last.absorbed&&Math.hypot(last.point.x-target[0],last.point.y-target[1])<1e-7);
    assert.ok(Math.hypot(last.before.x-vector[0]/length,last.before.y-vector[1]/length)<1e-10);
    for(const {label,point,absorbed} of observed.events.slice(0,-1)){
      const vertical=label==='left'||label==='right';
      assert.ok(!absorbed && (vertical?point.y>1&&point.y<179:point.x>1&&point.x<299));
    }
    writeFileSync(join(out,i+(reverse?'-reverse':'-forward')+'.json'),JSON.stringify(observed,null,2),{flag:'wx'});
  }
  const stopped=trace({start:[55,140],target:[200,60],vector:c.vector,limit:2});
  assert.equal(stopped.terminal,'simulationStop');assert.ok(stopped.events.every(e=>!e.absorbed));
});
