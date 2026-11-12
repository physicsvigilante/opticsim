// Synthetic finite apparatus only: actual unmodified native PhyDemo handles
// both reflection intersections. Not a fabricated native run of original U1.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {analyzePlaneMirrorAngleQuery} from '../src/mirror-angle-queries.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const deg=Math.PI/180;
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,'Expected '+a+' near '+b);
test('test-only finite two-mirror apparatus obeys native reflection law and requested conditional geometry',()=>{
 const fact={format:'opticsim-plane-mirror-angular-facts-v1',mirrorIds:['M1','M2'],consecutiveInclinationsDeg:[70]};
 const query={format:'opticsim-plane-mirror-angular-query-v1',kind:'mirror-incidence-from-output-direction',
   referenceMirrorId:'M1',outgoingRelation:'parallel',angleConvention:'from-normal'};
 const analytic=analyzePlaneMirrorAngleQuery(fact,query);
 near(analytic.value.incidenceAngleDeg,50);
 const P2={x:200*Math.cos(140*deg),y:200*Math.sin(140*deg)};
 const source={x:-100*Math.cos(-140*deg),y:-100*Math.sin(-140*deg)};
 const native={version:5,name:'synthetic finite two-mirror angular check',
   objs:[
    {type:'SingleRay',p1:{x:source.x,y:-source.y},
     p2:{x:source.x+20*Math.cos(-140*deg),y:-source.y-20*Math.sin(-140*deg)},brightness:1},
    {type:'Mirror',p1:{x:-200,y:0},p2:{x:200,y:0},filter:false},
    {type:'Mirror',p1:{x:P2.x-50*Math.cos(70*deg),y:-P2.y+50*Math.sin(70*deg)},
     p2:{x:P2.x+50*Math.cos(70*deg),y:-P2.y-50*Math.sin(70*deg)},filter:false}],
   maxRayDepth:8,rayModeDensity:.2,mode:'rays',simulateColors:false,colorMode:'default',
   scale:1,origin:{x:700,y:400},width:1200,height:800};
 const scene=core.loadNative(native);assert.equal(scene.error,null);
 const events=[];
 for(const i of [1,2]){
   const mirror=scene.objs[i],original=mirror.onRayIncident;
   mirror.onRayIncident=function(...args){
     const ray=args[0],incoming=Math.atan2(-(ray.p2.y-ray.p1.y),ray.p2.x-ray.p1.x)/deg;
     const ret=original.apply(this,args);
     const outgoing=Math.atan2(-(ray.p2.y-ray.p1.y),ray.p2.x-ray.p1.x)/deg;
     events.push({id:'M'+i,incoming,outgoing});return ret;
   };
 }
 const sim=new core.Simulator(scene,null,null,null,null,null,false,1000);let event=null;
 sim.on('simulationComplete',()=>event='completed');
 sim.on('simulationStop',()=>event='stopped');
 sim.updateSimulation();
 assert.equal(event,'completed');assert.equal(sim.totalTruncation,0);
 assert.deepEqual(events.map(e=>e.id),['M1','M2']);
 near(events[0].incoming,-140);near(events[0].outgoing,140);
 near(events[1].incoming,140);near(events[1].outgoing,0);
 assert.equal(analytic.native.status,'not-run');
});
