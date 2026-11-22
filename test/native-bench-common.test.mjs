// Direct unit tests for shared v37/v38/v39 geometry and ray-state audit helpers.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  BENCH_CLEARANCE_MM,
  BENCH_NATIVE_STATE_LIMIT,
  DIELECTRIC_BODY_TYPES,
  bodiesDisjoint,
  buildDielectricBody,
  extractNativeRay,
  installBenchEndpointAudit,
  pointSegmentDistance,
  signedSupportDistance
} from '../src/native-bench-common.js';
import {GENERAL_BENCH_CLEARANCE_MM,V37_NATIVE_STATE_LIMIT} from '../src/native-general-optical-bench.js';
import {REFRACTIVE_BENCH_CLEARANCE_MM,REFRACTIVE_BODY_TYPES,V38_NATIVE_STATE_LIMIT} from '../src/native-general-refractive-bench.js';
import {HYBRID_BENCH_CLEARANCE_MM,HYBRID_DIELECTRIC_TYPES,V39_NATIVE_STATE_LIMIT} from '../src/native-general-hybrid-bench.js';

test('v37, v38, and v39 share identical clearance, state-limit, and dielectric-type constants',()=>{
  assert.equal(GENERAL_BENCH_CLEARANCE_MM,BENCH_CLEARANCE_MM);
  assert.equal(REFRACTIVE_BENCH_CLEARANCE_MM,BENCH_CLEARANCE_MM);
  assert.equal(HYBRID_BENCH_CLEARANCE_MM,BENCH_CLEARANCE_MM);
  assert.equal(V37_NATIVE_STATE_LIMIT,BENCH_NATIVE_STATE_LIMIT);
  assert.equal(V38_NATIVE_STATE_LIMIT,BENCH_NATIVE_STATE_LIMIT);
  assert.equal(V39_NATIVE_STATE_LIMIT,BENCH_NATIVE_STATE_LIMIT);
  assert.deepEqual(REFRACTIVE_BODY_TYPES,DIELECTRIC_BODY_TYPES);
  assert.deepEqual(HYBRID_DIELECTRIC_TYPES,DIELECTRIC_BODY_TYPES);
});

test('shared geometry helpers compute exact y-up native rays, segment distances, and body disjointness',()=>{
  const ray=extractNativeRay({p1:{x:10,y:-20},p2:{x:13,y:-24}});
  assert.deepEqual(ray.origin,{x:10,y:20});
  assert.ok(Math.abs(ray.dir.x-0.6)<1e-12&&Math.abs(ray.dir.y-0.8)<1e-12);
  assert.equal(extractNativeRay({p1:{x:0,y:0},p2:{x:0,y:0}}),null);
  assert.equal(extractNativeRay({p1:{x:NaN,y:0},p2:{x:1,y:0}}),null);

  assert.equal(pointSegmentDistance({x:5,y:3},[{x:0,y:0},{x:10,y:0}]),3);
  assert.equal(signedSupportDistance({x:5,y:3},[{x:0,y:0},{x:10,y:0}]),3);
  assert.equal(signedSupportDistance({x:5,y:-3},[{x:0,y:0},{x:10,y:0}]),-3);

  const fail=(p,m)=>{throw Error(`${p}: ${m}`);};
  const c1=buildDielectricBody({id:'C1',type:'circular-dielectric',parameters:{x:0,y:0,radius:20,outsideIndex:1}},'c1',fail);
  const c2=buildDielectricBody({id:'C2',type:'circular-dielectric',parameters:{x:45,y:0,radius:20,outsideIndex:1}},'c2',fail);
  const cTouch=buildDielectricBody({id:'C3',type:'circular-dielectric',parameters:{x:40.005,y:0,radius:20,outsideIndex:1}},'c3',fail);
  assert.equal(bodiesDisjoint(c1,c2,BENCH_CLEARANCE_MM),true);
  assert.equal(bodiesDisjoint(c1,cTouch,BENCH_CLEARANCE_MM),false);
});

test('installBenchEndpointAudit fails closed on missing native methods, non-array newRays, and bounded state limit',()=>{
  const doc={
    physics:{
      components:[
        {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0}},
        {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:90,length:80}}
      ]
    }
  };
  const mirrorEndpoints=p=>[{x:p.x,y:p.y-p.length/2},{x:p.x,y:p.y+p.length/2}];

  // Missing onSimulationStart fails closed.
  const idMap=new Map([['S1',0],['M1',1]]);
  const badScene={objs:[{}, {onRayIncident:()=>({})}]};
  const auditMissing=installBenchEndpointAudit(doc,badScene,idMap,mirrorEndpoints,{
    versionTag:'v37',key:'v37EndpointsVerified',isRedirector:c=>c.type==='plane-mirror'
  });
  assert.match(auditMissing.finish(),/native emitter method unavailable/);

  // Non-array newRays and bounded stateLimit fail closed.
  const scene={
    objs:[
      {onSimulationStart:()=>({newRays:[{p1:{x:-100,y:0},p2:{x:-99,y:0}},{p1:{x:-100,y:5},p2:{x:-99,y:5}}]})},
      {onRayIncident:()=>({newRays:'not-an-array'})}
    ]
  };
  const auditLimit=installBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints,{
    versionTag:'v39',key:'v39EndpointsVerified',stateLimit:1,isRedirector:c=>c.type==='plane-mirror'
  });
  scene.objs[0].onSimulationStart();
  assert.match(auditLimit.finish(),/exceeded bounded state limit/);
});
