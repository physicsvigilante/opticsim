// TEST-ONLY feasibility: native Aperture + existing v17 thick-lens train.
// No canonical admission, no numerical cutoff changes, no authored ray route.
// All intersections, transmissions, reflections and absorptions are pinned PhyDemo.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {mirrorEndpoints} from '../src/contract.js';
import {compileFiniteAperture} from '../src/finite-aperture.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-two-thick-lens-mirror-v17.json',import.meta.url),'utf8'));
const base=prepareScene(structuredClone(fixture.physical)).document;
const stop=(x,y,openingLength=20)=>({
  id:'A1',type:'finite-aperture',
  parameters:{x,y,orientationDeg:90,length:100,openingLength}
});
const matches=(a,b)=>assert.deepEqual(a,b);

function nativeProbe(aperture=null){
  // Canonical v17 validator *correctly rejects* any Aperture here.
  // Only the test-native scene adds the already supported PhyDemo object.
  const compiled=core.compile(base),objects=structuredClone(compiled.native.objs);
  if(aperture)objects.push(compileFiniteAperture(aperture,mirrorEndpoints));
  const scene=core.loadNative({...compiled.native,objs:objects});
  const byId=new Map(base.physics.components.map((c,i)=>[c.id,i]));
  const sources=core.observeSourceSet(base,scene,byId);
  const mirrors=core.observeMirrorSet(base,scene,byId);
  const detectors=core.observeDetectorSet(base,scene,byId);
  const interfaces=core.observeInterfaceSet(base,scene,byId);
  const order=aperture?[...base.physics.components.map(c=>c.id),'A1']:base.physics.components.map(c=>c.id);
  const events=[],absorptions=[];
  for(let i=0;i<scene.objs.length;i++){
    if(order[i]==='S1')continue;
    const native=scene.objs[i],original=native.onRayIncident;
    native.onRayIncident=function(...args){
      const x=args[2]?.x,y=args[2]?.y, before={x,y:y===undefined?null:-y};
      const result=original.apply(this,args);
      assert.ok(events.length<64,'bounded actual native events');
      events.push({id:order[i],pointMm:before,absorbed:result?.isAbsorbed===true});
      if(order[i]==='A1'&&result?.isAbsorbed===true)absorptions.push(before);
      return result;
    };
  }
  const simulator=new core.Simulator(scene,null,null,null,null,null,false,base.simulation.processedRayLimit);
  let completion=null;
  for(const e of ['simulationComplete','simulationStop'])simulator.on(e,()=>{completion=e;});
  simulator.updateSimulation();
  const diagnostic=core.diagnostics(scene,simulator,sources,mirrors,detectors,interfaces);
  const status=core.classifyRun(completion,diagnostic);
  return {status,events,absorptions,diagnostic,types:objects.map(x=>x.type)};
}
test('canonical v17 still refuses a finite aperture without an expressly reviewed profile',()=>{
  const forged=structuredClone(base);
  forged.physics.components.push(stop(-150,0));
  assert.throws(()=>core.compile(forged),/scope|support|composition|type|count/i);
});
test('native on-axis finite aperture gap preserves actual two-lens and mirror return',()=>{
  const reference=nativeProbe(),open=nativeProbe(stop(-150,0));
  assert.equal(reference.status,'completed');
  assert.equal(open.status,'completed');
  assert.deepEqual(open.types,['SingleRay','SphericalLens','SphericalLens','Mirror','Detector','Aperture']);
  assert.deepEqual(open.events.map(e=>e.id),reference.events.map(e=>e.id));
  assert.deepEqual(open.absorptions,[]);
  assert.equal(open.diagnostic.interfacesById.L1.interactions,4);
  assert.equal(open.diagnostic.interfacesById.L2.interactions,4);
  assert.equal(open.diagnostic.reflectionsById.M1,1);
  assert.equal(open.diagnostic.detectorsById.D1.crossings,2);
  assert.equal(open.diagnostic.truncation,0);
  assert.equal(open.diagnostic.undefinedBehavior,0);
  console.log('THICK_LENS_APERTURE_CLEAR_NATIVE '+JSON.stringify({
    status:open.status,events:open.events.map(e=>e.id),absorptions:0,
    crossingCount:open.diagnostic.detectorsById.D1.crossings
  }));
});
test('moving only aperture opening makes pinned native stop absorb before both lenses',()=>{
  const blocked=nativeProbe(stop(-150,30));
  assert.equal(blocked.status,'completed');
  matches(blocked.events.map(e=>e.id),['A1']);
  assert.equal(blocked.absorptions.length,1);
  assert.ok(Math.abs(blocked.absorptions[0].x+150)<1e-7);
  assert.ok(Math.abs(blocked.absorptions[0].y)<1e-7);
  assert.equal(blocked.diagnostic.interfacesById.L1.interactions,0);
  assert.equal(blocked.diagnostic.interfacesById.L2.interactions,0);
  assert.equal(blocked.diagnostic.reflectionsById.M1,0);
  assert.equal(blocked.diagnostic.detectorsById.D1.crossings,0);
  assert.equal(blocked.diagnostic.emissionsById.S1.emitted,1);
  assert.equal(blocked.diagnostic.truncation,0);
  assert.equal(blocked.diagnostic.undefinedBehavior,0);
  console.log('THICK_LENS_APERTURE_BLOCK_NATIVE '+JSON.stringify({
    status:blocked.status,events:blocked.events,absorptions:blocked.absorptions.length,
    lensHits:0,mirrorHits:0,detectorCrossings:0
  }));
});
