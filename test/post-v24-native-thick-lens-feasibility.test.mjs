// Post-v24 integration rehearsal, deliberately test-only.
// Real pinned PhyDemo SphericalLens and Detector objects own propagation.
// No public spherical-lens admission, output image or ray route is invented.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const saved=JSON.parse(readFileSync(new URL('../scenes/polygon-dielectric.json',import.meta.url),'utf8'));
const lens=(x,n)=>({type:'SphericalLens',
 p1:{x,y:-50},p2:{x,y:50},path:null,defBy:'DR1R2',
 params:{d:30,r1:100,r2:-100},refIndex:n,partialReflect:false});
function run({secondIndex=1.3,sourceHeight=10,secondX=150}={}){
 const doc=structuredClone(saved);
 doc.physics.components[0].parameters.y=sourceHeight;
 const fixture=core.compile(saved).native;
 const source=structuredClone(fixture.objs[0]);
 source.p1.y=-sourceHeight;source.p2.y=-sourceHeight;
 const detector=structuredClone(fixture.objs[2]);
 detector.p1={x:350,y:-200};detector.p2={x:350,y:200};
 const l1=lens(0,1.5),l2=lens(secondX,secondIndex);
 fixture.objs=[source,l1,l2,detector];
 doc.physics.components.splice(1,1,
  {id:'L1',type:'spherical-lens',parameters:{x:0}},
  {id:'L2',type:'spherical-lens',parameters:{x:secondX}});
 doc.physics.components.at(-1).parameters.x=350;
 doc.physics.components.at(-1).parameters.length=400;
 const scene=core.loadNative(fixture);
 const byId=new Map(doc.physics.components.map((c,i)=>[c.id,i]));
 const sources=core.observeSourceSet(doc,scene,byId);
 const detectors=core.observeDetectorSet(doc,scene,byId);
 const events=[];
 for(const id of ['L1','L2']){
  const obj=scene.objs[byId.get(id)],prior=obj.onRayIncident;
  assert.equal(typeof prior,'function');
  obj.onRayIncident=function(...args){
   const hit={x:args[2]?.x,y:-args[2]?.y};
   const ret=prior.apply(this,args); // delegate native solver unchanged
   events.push({id,hit,absorbed:ret?.isAbsorbed===true});
   return ret;
  };
 }
 const sim=new core.Simulator(scene,null,null,null,null,null,false,10000);
 let terminal=null;for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{terminal=name;});
 sim.updateSimulation();
 const diag=core.diagnostics(scene,sim,sources,null,detectors,null);
 return {terminal,state:core.classifyRun(terminal,diag),diag,events,doc};
}
test('post-v24 pinned native supports two separate thick SphericalLens surfaces without a scripted ray path',()=>{
 const r=run();
 assert.equal(r.terminal,'simulationComplete');
 assert.equal(r.state,'completed');
 assert.equal(r.diag.errors.length,0);
 assert.equal(r.diag.truncation,0);
 assert.equal(r.diag.undefinedBehavior,0);
 assert.equal(r.diag.emissionsById.S1.emitted,1);
 assert.equal(r.diag.detectorsById.D1.crossings,1);
 assert.deepEqual(r.events.map(e=>e.id),['L1','L1','L2','L2']);
 const xs=[-14.49874371066197,14.591776274279326,
  135.0329852193489,164.89432443050868];
 for(let i=0;i<xs.length;i++)
  assert.ok(Math.abs(r.events[i].hit.x-xs[i])<.001,
   'observed native spherical face '+i+' not a static image guess');
 assert.ok(r.events.every(e=>e.absorbed===false));
 console.log('POST_V24_THICK_LENS_NATIVE '+JSON.stringify({
  status:r.state,realFaces:r.events.map(e=>({lens:e.id,x:e.hit.x,y:e.hit.y})),
  detectorCrossings:r.diag.detectorsById.D1.crossings,
  researchOnly:true,nativeImageDetected:false}));
});
test('changed material and actual finite aperture miss remain native outcomes',()=>{
 const base=run(),index=run({secondIndex:1.45}),miss=run({sourceHeight:80});
 assert.equal(base.state,'completed');assert.equal(index.state,'completed');
 assert.deepEqual(index.events.map(e=>e.id),base.events.map(e=>e.id));
 assert.ok(Math.abs(base.events[2].hit.y-index.events[2].hit.y)>1e-5,
  'changing second index should change native refraction before the second lens');
 assert.equal(miss.state,'completed');
 assert.deepEqual(miss.events,[]);
 assert.equal(miss.diag.detectorsById.D1.crossings,1);
});
test('research native SphericalLens objects are not a public schema-v9 admission',()=>{
 const r=run();
 assert.throws(()=>core.compile(r.doc),/scope|support|version|model|type/i);
});
