import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validate,parseSave,serializeSave,ValidationError} from '../src/contract.js';
import {predict} from '../src/analysis.js';
const {compile,loadDocument,loadNative,nativeExport,Simulator,diagnostics,
  observeSourceEmission,observeMirrorSet,observeDetectorSet,classifyRun,Session} =
  createRequire(import.meta.url)('../dist/test-core.cjs');

const example=name=>JSON.parse(readFileSync(new URL('../scenes/'+name+'.json',import.meta.url)));
const byId=(d,id)=>d.physics.components.find(c=>c.id===id);
const detectors=d=>d.physics.components.filter(c=>c.type==='ray-detector');
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,String(a)+' != '+String(b));
const checkError=(f,path,code)=>assert.throws(f,e=>e instanceof ValidationError&&e.path.startsWith(path)&&e.code===code);

function run(doc, sourceOverride=null, capture=false) {
  const compiled=compile(doc),objs=compiled.native.objs.slice();
  if(sourceOverride)objs[compiled.idMap.get('source-1')]=sourceOverride;
  const scene=loadNative({...compiled.native,objs});
  const detectorMeter=observeDetectorSet(doc,scene,compiled.idMap);
  const mirrorMeter=observeMirrorSet(doc,scene,compiled.idMap);
  const emitted=sourceOverride?null:observeSourceEmission(scene.objs[compiled.idMap.get('source-1')]);
  const hits=[];
  if(capture)for(const c of doc.physics.components.filter(c=>c.type!=='point-source')) {
    const obj=scene.objs[compiled.idMap.get(c.id)],old=obj.onRayIncident;
    obj.onRayIncident=function(ray,index,point,...rest) {
      hits.push({id:c.id,at:{x:point.x,y:-point.y}});
      return old.call(this,ray,index,point,...rest);
    };
  }
  let event=null;
  const sim=new Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{event=name;});
  sim.updateSimulation();
  const data=diagnostics(scene,sim,emitted,mirrorMeter,detectorMeter);
  return {event,data,scene,hits,idMap:compiled.idMap,state:classifyRun(event,data)};
}
const singleRay=(doc,height=0)=>{
  const s=byId(doc,'source-1').parameters;
  return {type:'SingleRay',p1:{x:s.x,y:-s.y},p2:{x:0,y:-height},brightness:1};
};

test('v4 detector component is reusable strict scene data with stable IDs and native serialization',()=>{
  for(const name of ['mixed-detectors','mixed-detectors-reverse']){
    const doc=example(name),count=detectors(doc).length;
    assert.equal(count,2);
    assert.equal(validate(doc),doc);
    assert.equal(predict(doc).kind,'unavailable');
    assert.deepEqual(parseSave(serializeSave(doc)),doc);
    const permuted=structuredClone(doc);
    permuted.physics.components.reverse();
    assert.equal(validate(permuted),permuted);
    const {native,idMap}=compile(permuted);
    assert.deepEqual([...idMap.keys()],permuted.physics.components.map(c=>c.id));
    const nodes=permuted.physics.components.filter(c=>c.type==='ray-detector');
    for(const item of nodes){
      const obj=native.objs[idMap.get(item.id)];
      assert.equal(obj.type,'Detector');
      assert.equal(obj.irradMap,false);
      const a=item.parameters,theta=a.orientationDeg*Math.PI/180;
      const dx=a.length/2*Math.cos(theta),dy=a.length/2*Math.sin(theta);
      near(obj.p1.x,a.x-dx);near(obj.p1.y,-(a.y-dy));
      near(obj.p2.x,a.x+dx);near(obj.p2.y,-(a.y+dy));
    }
    const loaded=loadDocument(permuted).scene;
    assert.equal(loaded.error,null);
    const nativeSave=JSON.parse(nativeExport(permuted));
    assert.equal(nativeSave.objs.filter(c=>c.type==='Detector').length,2);
    assert.deepEqual(loadNative(nativeSave).objs.map(c=>c.serialize()),
      loaded.objs.map(c=>c.serialize()));
    assert.ok(nativeSave.objs.every(c=>!('id' in c)&&!('parameters' in c)));
  }
});

test('detectors preserve older models and historical schema exclusions',()=>{
  const doc=example('mixed-detectors');
  const old=structuredClone(doc);
  old.schemaVersion=old.adapterVersion=3;
  checkError(()=>parseSave(JSON.stringify(old)),'$.physics.model','UNSUPPORTED');
  for(const name of ['single-lens','plane-mirror','lens-mirror-finite','four-lenses']){
    const scene=example(name);
    scene.physics.components.push({...detectors(doc)[0],id:'detector-added'});
    checkError(()=>validate(scene),'$.physics.components','UNSUPPORTED_SCOPE');
  }
  // Old mixed scenes need not supply any detector, and retain their exact exports.
  const baseline=example('mixed-two-lens-two-mirror');
  assert.equal(validate(baseline),baseline);
  const noMeter=run(baseline);
  assert.equal(noMeter.state,'completed');
  assert.equal(noMeter.data.detectorsById,null);
});

test('detector counts, parameters, and placement boundaries fail early with paths',()=>{
  const base=example('mixed-detectors');
  const invalid=[
    d=>d.physics.components.push({id:'detector-third',type:'ray-detector',
      parameters:{x:700,y:0,orientationDeg:90,length:100}}),
    d=>byId(d,'detector-early').parameters.length=0,
    d=>byId(d,'detector-early').parameters.orientationDeg=190,
    d=>byId(d,'detector-early').parameters.x=NaN,
    d=>byId(d,'detector-early').parameters.noSuchParameter=1,
    d=>Object.assign(byId(d,'detector-early').parameters,{x:0,y:0,length:100}),
    d=>Object.assign(byId(d,'detector-return').parameters,{x:160,y:0,orientationDeg:0,length:100}),
    d=>byId(d,'detector-return').parameters.y=10,
    d=>Object.assign(byId(d,'detector-return').parameters,{x:9990,y:0,orientationDeg:0,length:100}),
    d=>byId(d,'detector-return').id='detector-early',
  ];
  for(const edit of invalid){
    const doc=structuredClone(base);edit(doc);
    assert.throws(()=>validate(doc),e=>e instanceof ValidationError&&e.path.includes('physics.components'));
  }
  const adjusted=structuredClone(base);
  byId(adjusted,'detector-return').parameters.y=140;
  assert.equal(validate(adjusted),adjusted);
});

test('real native detector measurements report signed power and observed crossings by authored ID',()=>{
  for(const name of ['mixed-detectors','mixed-detectors-reverse']){
    const doc=example(name),r=run(doc);
    assert.equal(r.state,'completed');
    assert.deepEqual(r.data.errors,[]);
    assert.deepEqual(r.data.warnings,[]);
    assert.equal(r.data.truncation,0);
    assert.equal(r.data.undefinedBehavior,0);
    assert.deepEqual(Object.keys(r.data.detectorsById),detectors(doc).map(c=>c.id));
    for(const [id,reading] of Object.entries(r.data.detectorsById)){
      assert.ok(Number.isInteger(reading.crossings)&&reading.crossings>=0,id);
      assert.ok(Number.isFinite(reading.signedPower),id+' did not expose native power');
      const raw=r.scene.objs[r.idMap.get(id)];
      near(reading.signedPower,raw.power,1e-10);
    }
    if(name==='mixed-detectors'){
      assert.ok(r.data.detectorsById['detector-early'].crossings>0);
      assert.ok(r.data.detectorsById['detector-return'].crossings>0);
    } else {
      assert.equal(r.data.detectorsById['detector-away'].crossings,0);
      near(r.data.detectorsById['detector-away'].signedPower,0);
    }
  }
});

test('native single-ray crosses independently placed detector segments without a scripted ray route',()=>{
  for(const ids of [
    ['source-1','lens-1','lens-2','mirror-1','mirror-2','detector-early','detector-return'],
    ['detector-return','mirror-2','lens-2','source-1','detector-early','mirror-1','lens-1']
  ]){
    const doc=example('mixed-detectors'),map=new Map(doc.physics.components.map(c=>[c.id,c]));
    doc.physics.components=ids.map(id=>map.get(id));
    const r=run(doc,singleRay(doc),true);
    assert.equal(r.event,'simulationComplete');
    assert.deepEqual(r.data.errors,[]);
    assert.equal(r.data.truncation,0);
    assert.equal(r.data.undefinedBehavior,0);
    assert.deepEqual(r.hits.map(hit=>hit.id),[
      'lens-1','lens-2','detector-early','mirror-1','detector-return','mirror-2'
    ]);
    const left=r.data.detectorsById['detector-early'];
    const right=r.data.detectorsById['detector-return'];
    assert.equal(left.crossings,1);
    assert.equal(right.crossings,1);
    near(Math.abs(left.signedPower),1,1e-9);
    near(Math.abs(right.signedPower),1,1e-9);
    near(r.hits.find(hit=>hit.id==='detector-early').at.x,160);
    near(r.hits.find(hit=>hit.id==='detector-return').at.y,130);
    for(const c of detectors(doc))assert.equal(r.scene.objs[r.idMap.get(c.id)].constructor.type,'Detector');
  }
});

test('detector readouts are unavailable on incomplete/stopped runs and stale revisions',()=>{
  const fixture=example('mixed-detectors');
  for(const [key,val,status] of [['processedRayLimit',1,'stopped'],['maxRayDepth',0,'incomplete']]){
    const doc=structuredClone(fixture);doc.simulation[key]=val;
    const r=run(doc);assert.equal(r.state,status);
    assert.equal(predict(doc).kind,'unavailable');
  }
  const callbacks=[];
  const session=new Session(()=>({cancel(){},run(cb){callbacks.push(cb);}}),()=>{});
  session.apply(fixture);
  assert.equal(session.data,null);
  const success={errors:[],warnings:[],processed:50,truncation:0,undefinedBehavior:0,
    detectorsById:{'detector-early':{crossings:2,signedPower:-1}}};
  session.apply({...fixture,presentation:{...fixture.presentation,title:'revision-two'}});
  callbacks[0]('simulationComplete',success);
  assert.equal(session.state,'running');
  assert.equal(session.data,null);
  callbacks[1]('simulationComplete',success);
  assert.equal(session.state,'completed');
  assert.deepEqual(session.data.detectorsById,success.detectorsById);
  const changed=structuredClone(fixture);
  byId(changed,'detector-return').parameters.length=0;
  session.apply(changed);
  assert.equal(session.state,'invalid');
  assert.equal(session.data,null);
  callbacks[1]('simulationComplete',success);
  assert.equal(session.data,null);
});
