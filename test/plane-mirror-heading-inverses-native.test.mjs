import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const s=Math.sqrt(3)/2;
const xy=([x,y])=>({x,y:-y});
const add=([x,y],[dx,dy],n)=>[x+n*dx,y+n*dy];
const close=(a,b)=>assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-9,JSON.stringify({actual:a,expected:b}));
const direction=ray=>{
  const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,length=Math.hypot(dx,dy);
  return [dx/length,dy/length];
};
function finiteSegment(type,center,tangent,halfLength){
  return {type,p1:xy(add(center,tangent,-halfLength)),p2:xy(add(center,tangent,halfLength)),filter:false};
}
function trace(mirrors,initial,expectedPoints,expectedHeadings,sourceDistance=35){
  const source=add(expectedPoints[0],initial,-sourceDistance),target=expectedPoints.at(-1);
  const [dx,dy]=expectedHeadings.at(-1);
  const input={version:5,width:1200,height:700,origin:{x:600,y:350},scale:1,mode:'rays',
    maxRayDepth:8,rayModeDensity:.2,lengthScale:1,simulateColors:false,colorMode:'default',objs:[
      {type:'SingleRay',p1:xy(source),p2:xy(add(source,initial,10)),brightness:.04},
      ...mirrors.map(([c,t])=>finiteSegment('Mirror',c,t,20)),
      finiteSegment('Blocker',target,[-dy,dx],2)
    ]};
  const scene=core.loadNative(input),events=[];
  const [emitter,...objects]=scene.objs;
  let rayIdentity,starts=0,terminal;
  const nativeStart=emitter.onSimulationStart;
  emitter.onSimulationStart=function(...args){
    const result=nativeStart.apply(this,args);
    assert.equal(result.newRays.length,1);
    starts++;
    rayIdentity=result.newRays[0];
    return result;
  };
  for(const [index,obj] of objects.entries()){
    const nativeIncident=obj.onRayIncident;
    obj.onRayIncident=function(ray,rayIndex,point,...args){
      assert.equal(ray,rayIdentity);
      const before=direction(ray);
      const result=nativeIncident.call(this,ray,rayIndex,point,...args);
      assert.ok(!result?.newRays?.length&&!result?.isUndefinedBehavior);
      events.push({index,before,point:[point.x,-point.y],absorbed:result?.isAbsorbed===true});
      return result;
    };
  }
  const simulator=new core.Simulator(scene,null,null,null,null,null,false,100);
  for(const event of ['simulationComplete','simulationStop'])simulator.on(event,()=>{terminal=event;});
  simulator.updateSimulation();
  const diagnostics=core.diagnostics(scene,simulator,null,null,null,null,null,{nativeEvent:terminal});
  assert.equal(core.classifyRun(terminal,diagnostics),'completed');
  assert.equal(starts,1);
  assert.equal(events.length,expectedPoints.length);
  for(const [i,event] of events.entries()){
    assert.equal(event.index,i);
    assert.equal(event.absorbed,i===events.length-1);
    close(event.point,expectedPoints[i]);
    close(event.before,expectedHeadings[i]);
  }
  return events;
}
test('A01 pinned Mirror reflects the two source headings at 30 degrees from its normal',()=>{
  const hit=[0,0],incoming=[.5,s],outgoing=[.5,-s];
  const events=trace([[hit,[1,0]]],incoming,[hit,add(hit,outgoing,40)],[incoming,outgoing],40);
  assert.ok(Math.abs(Math.acos(Math.abs(events[0].before[1]))*180/Math.PI-30)<1e-10);
});
for(const sign of [1,-1])for(const orientation of [1,-1])
  test('A02 real finite mirror sequence '+sign+' '+orientation,()=>{
    const transform=([x,y])=>[orientation*x,orientation*sign*y];
    const first=transform([-120,0]),second=transform([-60,-120*s]);
    const incoming=transform([.5,s]),intermediate=transform([.5,-s]),outgoing=transform([-1,0]);
    const events=trace([[first,transform([1,0])],[second,incoming]],incoming,
      [first,second,add(second,outgoing,40)],[incoming,intermediate,outgoing]);
    const a=events[0].before,b=events[2].before;
    assert.ok(Math.abs(Math.acos(a[0]*b[0]+a[1]*b[1])*180/Math.PI-120)<1e-10);
  });
