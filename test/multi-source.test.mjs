import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validate,ValidationError,parseSave,serializeSave,setSourceMode} from '../src/contract.js';
import {predict} from '../src/analysis.js';
const {compile,loadDocument,loadNative,nativeExport,Simulator,diagnostics,
  observeSourceSet,observeMirrorSet,observeDetectorSet,classifyRun,Session} =
  createRequire(import.meta.url)('../dist/test-core.cjs');

const example=name=>JSON.parse(readFileSync(new URL('../scenes/'+name+'.json',import.meta.url)));
const sources=doc=>doc.physics.components.filter(c=>c.type==='point-source');
const byId=(doc,id)=>doc.physics.components.find(c=>c.id===id);
const addSource=(doc,id,x,y,mode='directional')=>doc.physics.components.push({
  id,type:'point-source',parameters:{x,y,brightness:.31},
  emission:{mode,directionDeg:0,angleDeg:18}
});
const rejects=(doc,code='UNSUPPORTED_SCOPE')=>
  assert.throws(()=>validate(doc),error=>error instanceof ValidationError&&
    error.code===code&&error.path.startsWith('$.physics.components'));

function nativeRun(doc) {
  const {scene,idMap}=loadDocument(doc),meter=observeSourceSet(doc,scene,idMap);
  const mirror=observeMirrorSet(doc,scene,idMap),detector=observeDetectorSet(doc,scene,idMap);
  const sim=new Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let event;
  for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>event=name);
  sim.updateSimulation();
  const data=diagnostics(scene,sim,meter,mirror,detector);
  return {scene,idMap,event,data,state:classifyRun(event,data)};
}

test('new mixed tracing accepts one to four independently authored sources and rejects zero/five',()=>{
  for(const name of ['mixed-detectors','multi-source-mixed','multi-source-four']){
    const doc=example(name),n=sources(doc).length;
    assert.equal(validate(doc),doc);
    assert.ok(n>=1&&n<=4);
    assert.equal(predict(doc).kind,'unavailable');
    assert.deepEqual(parseSave(serializeSave(doc)),doc);
    const newIds=doc.physics.components.map(c=>c.id);
    assert.equal(new Set(newIds).size,newIds.length);
  }
  const none=example('multi-source-four');
  none.physics.components=none.physics.components.filter(c=>c.type!=='point-source');
  rejects(none);
  const five=example('multi-source-four');
  addSource(five,'source-5',-420,90);
  rejects(five);
  const same=example('multi-source-mixed');
  byId(same,'source-2').parameters={...byId(same,'source-1').parameters};
  rejects(same);
  const near=example('multi-source-mixed');
  Object.assign(byId(near,'source-2').parameters,{x:-300.001,y:10.001});
  rejects(near);
});

test('source separation applies to every lens, every mirror supporting line and every detector',()=>{
  for(const [id,edit] of [
    ['lens-plane',s=>Object.assign(s.parameters,{x:0,y:55})],
    ['mirror-line',s=>Object.assign(s.parameters,{x:340,y:100})],
    ['detector-line',s=>Object.assign(s.parameters,{x:160,y:50})]
  ]){
    const doc=example('multi-source-mixed');
    edit(byId(doc,'source-2'));
    rejects(doc);
  }
  const good=example('multi-source-mixed');
  Object.assign(byId(good,'source-2').parameters,{x:-300,y:80});
  assert.equal(validate(good),good); // Equal x, different y is allowed for distinct sources.
});

test('single-source historical and restricted optical models remain strictly single source',()=>{
  const added=byId(example('multi-source-mixed'),'source-2');
  for(const name of ['single-lens','two-lenses','plane-mirror','lens-mirror-finite','four-lenses']){
    const doc=example(name);
    doc.physics.components.push(structuredClone(added));
    rejects(doc);
  }
  const legacy=example('single-lens');
  legacy.schemaVersion=legacy.adapterVersion=3;
  legacy.physics.components.push(structuredClone(added));
  assert.throws(()=>parseSave(JSON.stringify(legacy)),error=>
    error instanceof ValidationError&&error.code==='UNSUPPORTED_SCOPE');
  const original=example('single-lens');
  assert.equal(validate(original),original);
  assert.equal(predict(original).kind,'finite-real');
});

test('multiple source native compilation preserves stable IDs, modes and independent parameters',()=>{
  for(const name of ['multi-source-mixed','multi-source-four']){
    const doc=example(name),permuted=structuredClone(doc);
    permuted.physics.components.reverse();
    assert.equal(validate(permuted),permuted);
    const {native,idMap}=compile(permuted);
    assert.deepEqual([...idMap.keys()],permuted.physics.components.map(c=>c.id));
    for(const c of sources(permuted)){
      const obj=native.objs[idMap.get(c.id)];
      assert.equal(obj.type,c.emission.mode==='directional'?'AngleSource':'PointSource');
      assert.equal(obj.brightness,c.parameters.brightness);
      const pos=obj.type==='AngleSource'?obj.p1:{x:obj.x,y:obj.y};
      assert.deepEqual(pos,{x:c.parameters.x,y:-c.parameters.y});
      if(obj.type==='AngleSource'){
        assert.equal(obj.emisAngle,c.emission.angleDeg);
        assert.equal(obj.symmetric,true);
      }
    }
    const saved=JSON.parse(nativeExport(permuted));
    assert.deepEqual(loadNative(saved).objs.map(o=>o.serialize()),
      loadDocument(permuted).scene.objs.map(o=>o.serialize()));
    assert.ok(saved.objs.every(o=>!('id' in o)&&!('emission' in o)&&!('parameters' in o)));
    assert.deepEqual(parseSave(serializeSave(permuted)),permuted);
  }
  const doc=example('multi-source-mixed'),other=structuredClone(doc);
  byId(other,'source-2').parameters.brightness=.73125;
  assert.equal(compile(other).native.objs.find(o=>o.brightness===.73125)?.type,'AngleSource');
  for(const id of ['source-1','source-3'])assert.deepEqual(byId(other,id),byId(doc,id));
});

test('actual native execution reports the sum and every source emission, without fabricated detector provenance',()=>{
  for(const name of ['multi-source-mixed','multi-source-four']){
    const doc=example(name),r=nativeRun(doc);
    console.log('MULTI_SOURCE_NATIVE',JSON.stringify({name,state:r.state,data:r.data}));
    assert.equal(r.event,'simulationComplete');
    assert.equal(r.state,'completed');
    assert.deepEqual(r.data.errors,[]);
    assert.deepEqual(r.data.warnings,[]);
    assert.equal(r.data.truncation,0);
    assert.equal(r.data.undefinedBehavior,0);
    assert.deepEqual(Object.keys(r.data.emissionsById),sources(doc).map(c=>c.id));
    let expectedTotal=0;
    const separate=loadDocument(doc);
    for(const c of sources(doc)){
      const expected=separate.scene.objs[separate.idMap.get(c.id)].onSimulationStart();
      const reading=r.data.emissionsById[c.id];
      assert.ok(Number.isInteger(reading.emitted)&&reading.emitted>0,c.id);
      assert.equal(reading.emitted,expected.newRays.length);
      assert.equal(reading.brightnessScale,expected.brightnessScale);
      expectedTotal+=reading.emitted;
    }
    assert.equal(r.data.emitted,expectedTotal);
    assert.equal(r.data.brightnessScale,null);
    assert.ok(r.data.processed>=expectedTotal);
    assert.deepEqual(Object.keys(r.data.detectorsById),['detector-early','detector-return']);
    for(const reading of Object.values(r.data.detectorsById)){
      assert.deepEqual(Object.keys(reading),['crossings','signedPower']);
      assert.ok(Number.isFinite(reading.signedPower));
    }
    assert.equal(Object.keys(r.data.reflectionsById).length,2);
  }
});

test('source wrappers delegate native starts exactly once even when object order is shuffled',()=>{
  const doc=example('multi-source-four'),reversed=structuredClone(doc);
  reversed.physics.components.reverse();
  const {scene,idMap}=loadDocument(reversed),calls={};
  for(const c of sources(reversed)){
    const obj=scene.objs[idMap.get(c.id)],native=obj.onSimulationStart;
    calls[c.id]=0;
    obj.onSimulationStart=function(...args) {
      calls[c.id]++;
      return native.apply(this,args);
    };
  }
  const observer=observeSourceSet(reversed,scene,idMap);
  const sim=new Simulator(scene,null,null,null,null,null,false,10000);
  let event=null;
  sim.on('simulationComplete',()=>event='complete');
  sim.updateSimulation();
  assert.equal(event,'complete');
  for(const id of Object.keys(calls))assert.equal(calls[id],1);
  const data=diagnostics(scene,sim,observer);
  assert.deepEqual(data.errors,[]);
  assert.equal(Object.keys(data.emissionsById).length,4);
  assert.equal(data.emitted,Object.values(data.emissionsById).reduce((n,r)=>n+r.emitted,0));
  assert.deepEqual(parseSave(serializeSave(reversed)),reversed);
});

test('source mode editing touches the selected source only; sampling remains a shared scene parameter',()=>{
  const doc=example('multi-source-four'),original=structuredClone(doc);
  doc.simulation.rayDensity=1;
  const active='source-4';
  const switched=setSourceMode(doc,active,'directional');
  assert.equal(byId(switched,active).emission.mode,'directional');
  assert.equal(switched.simulation.rayDensity,.2); // Existing explicit mode-change preset policy.
  assert.equal(byId(doc,active).emission.mode,'full-circle');
  assert.equal(doc.simulation.rayDensity,1);
  for(const c of sources(original).filter(c=>c.id!==active))
    assert.deepEqual(byId(switched,c.id),c);
  const back=setSourceMode(switched,active,'full-circle');
  assert.equal(back.simulation.rayDensity,.2);
  assert.equal(byId(back,active).emission.angleDeg,30);
  assert.deepEqual(parseSave(serializeSave(back)),back);
});

test('multi-source stop/depth limits suppress analysis and stale completion after a source edit',()=>{
  for(const [key,value,status] of [['processedRayLimit',1,'stopped'],['maxRayDepth',0,'incomplete']]){
    const doc=example('multi-source-mixed');doc.simulation[key]=value;
    const r=nativeRun(doc);
    assert.equal(r.state,status);
    assert.equal(predict(doc).kind,'unavailable');
  }
  const base=example('multi-source-mixed'),callbacks=[];
  const s=new Session(()=>({cancel(){},run(cb){callbacks.push(cb);}}),()=>{});
  assert.equal(s.apply(base),true);
  const revision=s.revision;
  const next=structuredClone(base);byId(next,'source-2').parameters.brightness=.19;
  assert.equal(s.apply(next),true);
  assert.ok(s.revision>revision);
  const success={errors:[],warnings:[],processed:10,truncation:0,undefinedBehavior:0,
    emitted:17,emissionsById:{'source-1':{emitted:8,brightnessScale:1},
      'source-2':{emitted:4,brightnessScale:1},'source-3':{emitted:5,brightnessScale:1}}};
  callbacks[0]('simulationComplete',success);
  assert.equal(s.state,'running');assert.equal(s.data,null);
  callbacks[1]('simulationComplete',success);
  assert.equal(s.state,'completed');assert.equal(s.prediction,null);
  assert.equal(s.analysisStatus,'unavailable');
  const bad=structuredClone(next);byId(bad,'source-3').parameters.x=0;
  s.apply(bad);
  assert.equal(s.state,'invalid');
  assert.equal(s.data,null);assert.equal(s.prediction,null);
  callbacks[1]('simulationComplete',success);
  assert.equal(s.state,'invalid');
});
