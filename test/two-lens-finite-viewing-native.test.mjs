import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../evaluation/two-lens-finite-viewing-v1/frozen.json',import.meta.url))).nativeControl;
const u=40,eyeGap=50;
const close=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,JSON.stringify({actual,expected,tolerance}));

function trace([objective,eyepiece],spacing,y,slope){
  const eye=spacing+eyeGap;
  const lens=(x,focalLength)=>({type:'IdealLens',p1:{x,y:-15},p2:{x,y:15},focalLength});
  const scene=core.loadNative({version:5,width:1200,height:700,origin:{x:380,y:350},scale:1,mode:'rays',
    rayModeDensity:.2,maxRayDepth:8,lengthScale:1,simulateColors:false,colorMode:'default',objs:[
      {type:'SingleRay',p1:{x:-u,y:-y},p2:{x:-u+20,y:-(y+20*slope)},brightness:.04},
      lens(0,objective),lens(spacing,eyepiece),
      {type:'Detector',p1:{x:eye,y:-12},p2:{x:eye,y:12},irradMap:false}
    ]});
  const [source,...encounters]=scene.objs;
  const start=source.onSimulationStart,order=[];
  let ray,terminal,sample;
  source.onSimulationStart=function(...args){
    const result=start.apply(this,args);
    assert.equal(result.newRays.length,1);
    [ray]=result.newRays;
    return result;
  };
  for(const [index,obj] of encounters.entries()){
    const incident=obj.onRayIncident;
    obj.onRayIncident=function(input,j,point,...args){
      assert.equal(input,ray);
      if(index===2)sample={y:-point.y,slope:(input.p1.y-input.p2.y)/(input.p2.x-input.p1.x)};
      order.push(index);
      const result=incident.call(this,input,j,point,...args);
      assert.ok(!result?.newRays?.length&&!result?.isAbsorbed&&!result?.isUndefinedBehavior);
      return result;
    };
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,100);
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
  assert.equal(core.classifyRun(terminal,diagnostics),'completed');
  assert.deepEqual(order,[0,1,2]);
  return sample;
}

for(const [label,arrangement] of Object.entries({baseline:frozen.baseline,swapped:frozen.swapped})){
  test('pinned IdealLens pair verifies finite viewing for '+label,()=>{
    const spacing=arrangement.separationMm??arrangement.separationRatioMm[0]/arrangement.separationRatioMm[1];
    const [objective,eyepiece]=arrangement.focalLengthsMm;
    const total=u+spacing+eyeGap,expectedGain=frozen.signedGainRatio[0]/frozen.signedGainRatio[1];
    for(const y of [-.8,.8]){
      // Aim the witness using its height at the eyepiece and the exit slope.
      // Propagation through the real lenses and detector remains native.
      const incident=-y*((1-eyeGap/eyepiece)*(1-spacing/objective)-eyeGap/objective)/
        ((1-eyeGap/eyepiece)*(u+spacing*(1-u/objective))+eyeGap*(1-u/objective));
      const aimed=trace(arrangement.focalLengthsMm,spacing,y,incident);
      close(aimed.y,0,1e-8);
      close(aimed.slope/(-y/total),expectedGain,1e-8);
      const low=trace(arrangement.focalLengthsMm,spacing,y,incident-.001);
      const high=trace(arrangement.focalLengthsMm,spacing,y,incident+.001);
      close((high.y-low.y)/(low.slope-high.slope),arrangement.signedVirtualDistanceFromEyeMm,1e-6);
    }
  });
}
