import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validate,parseSave,serializeSave,ValidationError} from '../src/contract.js';
import {predict} from '../src/analysis.js';
const {compile,loadDocument,loadNative,nativeExport,Simulator,diagnostics,
  classifyRun,observeSourceEmission,observeMirrorSet,Session} =
  createRequire(import.meta.url)('../dist/test-core.cjs');

const example=name=>JSON.parse(readFileSync(new URL('../scenes/'+name+'.json',import.meta.url)));
const get=(d,id)=>d.physics.components.find(c=>c.id===id);
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,String(a)+' != '+String(b));
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const direction=ray=>{
  const x=ray.p2.x-ray.p1.x,y=-(ray.p2.y-ray.p1.y),mag=Math.hypot(x,y);
  return {x:x/mag,y:y/mag};
};
function nativeRun(doc) {
  const {scene,idMap}=loadDocument(doc);
  const emitter=observeSourceEmission(scene.objs[idMap.get('source-1')]);
  const mirrors=observeMirrorSet(doc,scene,idMap);
  const sim=new Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let event;
  for(const e of ['simulationComplete','simulationStop'])sim.on(e,()=>{event=e;});
  sim.updateSimulation();
  const data=diagnostics(scene,sim,emitter,mirrors);
  return {scene,idMap,event,data,state:classifyRun(event,data)};
}

test('current v4 mixed scenes author existing components without changing native IDs or old model scopes',()=>{
  for(const name of ['mixed-two-lens-two-mirror','mixed-reverse-source']){
    const doc=example(name);
    assert.equal(validate(doc),doc);
    assert.equal(predict(doc).kind,'unavailable');
    assert.match(predict(doc).reason,/no route-independent analytical image/);
    assert.deepEqual(parseSave(serializeSave(doc)),doc);
    const rev=structuredClone(doc);rev.physics.components.reverse();
    assert.deepEqual(predict(rev),predict(doc));
    const c=compile(rev);
    assert.deepEqual([...c.idMap.keys()],rev.physics.components.map(o=>o.id));
    assert.deepEqual(c.native.objs.map(o=>o.type).sort(),
      rev.physics.components.map(o=>o.type==='ideal-lens'?'IdealLens':
        o.type==='plane-mirror'?'Mirror':'AngleSource').sort());
    const native=JSON.parse(nativeExport(rev));
    assert.deepEqual(loadNative(native).objs.map(o=>o.serialize()),
      loadDocument(rev).scene.objs.map(o=>o.serialize()));
    assert.ok(native.objs.every(o=>!('id' in o)&&!('parameters' in o)));
    assert.deepEqual(parseSave(serializeSave(rev)),rev);
  }
  const legacy=example('mixed-two-lens-two-mirror');
  legacy.schemaVersion=legacy.adapterVersion=3;
  assert.throws(()=>parseSave(JSON.stringify(legacy)),error=>
    error instanceof ValidationError&&error.path==='$.physics.model'&&error.code==='UNSUPPORTED');
  const oldReturn=example('lens-mirror-finite');
  get(oldReturn,'mirror-1').parameters.orientationDeg=45;
  assert.throws(()=>validate(oldReturn),/return layout requires/);
  const oldLens=example('four-lenses');
  oldLens.physics.components.push({id:'mirror-1',type:'plane-mirror',
    parameters:{x:700,y:5,orientationDeg:45,length:100}});
  assert.throws(()=>validate(oldLens),/lens bench supports/);
});

test('mixed scope diagnoses invalid cardinalities, intersections, and source degeneracies',()=>{
  const baseline=example('mixed-two-lens-two-mirror');
  const rejected=[
    d=>d.physics.components.push({id:'second-source',type:'point-source',
      parameters:{x:-400,y:40,brightness:0.5},
      emission:{mode:'full-circle',directionDeg:0,angleDeg:30}}),
    d=>d.physics.components.splice(d.physics.components.findIndex(c=>c.id==='mirror-1'),2),
    d=>d.physics.components.splice(d.physics.components.findIndex(c=>c.id==='lens-1'),2),
    d=>d.physics.components.push(...[3,4,5].map(i=>({id:'mirror-'+i,
      type:'plane-mirror',parameters:{x:1000+i*300,y:400,orientationDeg:90,length:100}}))),
    d=>d.physics.components.push(...[3,4,5].map(i=>({id:'lens-'+i,type:'ideal-lens',
      parameters:{x:700+i*200,focalLength:100,apertureHeight:100}}))),
    d=>{get(d,'source-1').parameters.x=get(d,'lens-1').parameters.x;},
    d=>{get(d,'lens-2').parameters.x=get(d,'lens-1').parameters.x;},
    d=>{get(d,'source-1').parameters.y=-540;},
    d=>{Object.assign(get(d,'mirror-1').parameters,{x:0,y:0,orientationDeg:45});},
    d=>{Object.assign(get(d,'mirror-2').parameters,{x:260,y:20,orientationDeg:-45});},
    d=>{Object.assign(get(d,'mirror-1').parameters,{x:9990,y:0,orientationDeg:0,length:100});},
  ];
  for(const change of rejected){
    const doc=structuredClone(baseline);change(doc);
    assert.throws(()=>validate(doc),error=>error instanceof ValidationError&&
      (error.code==='UNSUPPORTED_SCOPE'||error.code==='INVALID_INPUT')&&
      error.path.startsWith('$.physics.components'));
  }
  const valid=structuredClone(baseline);
  get(valid,'mirror-1').parameters.orientationDeg=30;
  assert.equal(validate(valid),valid);
});

test('real native mixed tracing completes and accounts for every mirror independently',()=>{
  for(const name of ['mixed-two-lens-two-mirror','mixed-reverse-source']){
    const doc=example(name),r=nativeRun(doc);
    assert.equal(r.event,'simulationComplete');
    assert.equal(r.state,'completed');
    assert.deepEqual(r.data.errors,[]);
    assert.deepEqual(r.data.warnings,[]);
    assert.equal(r.data.truncation,0);
    assert.equal(r.data.undefinedBehavior,0);
    assert.ok(r.data.emitted>0);
    assert.deepEqual(Object.keys(r.data.reflectionsById),['mirror-1','mirror-2']);
    assert.equal(Object.values(r.data.reflectionsById).reduce((a,b)=>a+b,0),r.data.reflections);
    assert.ok(r.data.processed>=r.data.emitted);
  }
});

// Test-only ray and per-ID incident observers; native objects retain authored order.
test('native ray traverses two lenses and two rotated mirrors with independently checked optics',()=>{
  const baseline=example('mixed-two-lens-two-mirror');
  const authored=baseline.physics.components.map(c=>c.id);
  const shuffled=['mirror-2','lens-2','source-1','lens-1','mirror-1'];
  for(const order of [authored,shuffled]){
    const doc=structuredClone(baseline),mapping=new Map(doc.physics.components.map(c=>[c.id,c]));
    doc.physics.components=order.map(id=>mapping.get(id));
    const {native,idMap}=compile(doc);
    const src=get(doc,'source-1').parameters;
    const objs=native.objs.slice();
    objs[idMap.get('source-1')]={type:'SingleRay',p1:{x:src.x,y:-src.y},
      p2:{x:get(doc,'lens-1').parameters.x,y:0},brightness:1};
    const scene=loadNative({...native,objs}),meters=observeMirrorSet(doc,scene,idMap),hits=[];
    for(const c of doc.physics.components.filter(c=>c.type!=='point-source')){
      const obj=scene.objs[idMap.get(c.id)],old=obj.onRayIncident;
      obj.onRayIncident=function(ray,index,point,...rest){
        const incoming=direction(ray),result=old.call(this,ray,index,point,...rest);
        hits.push({id:c.id,point:{x:point.x,y:-point.y},
          incoming,outgoing:direction(ray)});
        return result;
      };
    }
    const sim=new Simulator(scene,null,null,null,null,null,false,10000);
    let event;sim.on('simulationComplete',()=>event='completed');
    sim.on('simulationStop',()=>event='stopped');sim.updateSimulation();
    assert.equal(event,'completed');
    const data=diagnostics(scene,sim,null,meters);
    assert.deepEqual(data.errors,[]);
    assert.equal(data.truncation,0);
    assert.equal(data.undefinedBehavior,0);
    assert.deepEqual(hits.map(h=>h.id),['lens-1','lens-2','mirror-1','mirror-2']);
    assert.deepEqual(data.reflectionsById,{'mirror-1':1,'mirror-2':1});
    assert.equal(data.reflections,2);
    let point={x:src.x,y:src.y};
    let vector={x:1,y:(0-src.y)/(get(doc,'lens-1').parameters.x-src.x)};
    for(const id of ['lens-1','lens-2']){
      const lens=get(doc,id).parameters,hit=hits.find(h=>h.id===id);
      const travel=(lens.x-point.x)/vector.x;
      point={x:lens.x,y:point.y+travel*vector.y};
      near(hit.point.x,point.x);near(hit.point.y,point.y);
      const slope=vector.y/vector.x;
      near(hit.incoming.y/hit.incoming.x,slope,1e-9);
      const newSlope=slope-point.y/lens.focalLength;
      near(hit.outgoing.y/hit.outgoing.x,newSlope,1e-9);
      vector={x:1,y:newSlope};
    }
    for(const id of ['mirror-1','mirror-2']){
      const mirror=get(doc,id).parameters,hit=hits.find(h=>h.id===id);
      const theta=mirror.orientationDeg*Math.PI/180;
      const tangent={x:Math.cos(theta),y:Math.sin(theta)};
      const displacement={x:mirror.x-point.x,y:mirror.y-point.y};
      const travel=cross(displacement,tangent)/cross(vector,tangent);
      const side=cross(displacement,vector)/cross(vector,tangent);
      assert.ok(travel>0);assert.ok(Math.abs(side)<=mirror.length/2);
      point={x:point.x+travel*vector.x,y:point.y+travel*vector.y};
      near(hit.point.x,point.x);near(hit.point.y,point.y);
      const norm=Math.hypot(vector.x,vector.y);
      near(hit.incoming.x,vector.x/norm,1e-9);near(hit.incoming.y,vector.y/norm,1e-9);
      const reflected={x:2*dot(vector,tangent)*tangent.x-vector.x,
        y:2*dot(vector,tangent)*tangent.y-vector.y};
      const newNorm=Math.hypot(reflected.x,reflected.y);
      near(hit.outgoing.x,reflected.x/newNorm,1e-9);
      near(hit.outgoing.y,reflected.y/newNorm,1e-9);
      vector=reflected;
    }
  }
});

test('finite mirror misses do not fabricate native interactions or analytical images',()=>{
  const doc=example('mixed-two-lens-two-mirror');
  get(doc,'mirror-1').parameters.length=1;
  const r=nativeRun(doc);
  assert.equal(r.state,'completed');
  assert.equal(predict(doc).kind,'unavailable');
  assert.equal(Object.values(r.data.reflectionsById).reduce((a,b)=>a+b,0),r.data.reflections);
});

test('mixed tracing obeys native stop/truncation and Session revision guards',()=>{
  for(const [key,value,expected] of [['processedRayLimit',1,'stopped'],['maxRayDepth',0,'incomplete']]){
    const doc=example('mixed-two-lens-two-mirror');doc.simulation[key]=value;
    assert.equal(nativeRun(doc).state,expected);
    assert.equal(predict(doc).kind,'unavailable');
  }
  const doc=example('mixed-two-lens-two-mirror'),callbacks=[];
  const session=new Session(()=>({cancel(){},run(cb){callbacks.push(cb);}}),()=>{});
  assert.equal(session.apply(doc),true);
  assert.equal(session.analysisStatus,'unavailable');
  assert.equal(session.prediction,null);
  assert.match(session.analysisReason,/no route-independent/);
  const good={errors:[],warnings:[],processed:20,truncation:0,undefinedBehavior:0};
  callbacks[0]('simulationComplete',good);
  assert.equal(session.state,'completed');
  const changed=structuredClone(doc);
  get(changed,'mirror-1').parameters.orientationDeg=30;
  assert.equal(session.apply(changed),true);
  callbacks[0]('simulationComplete',good);
  assert.equal(session.state,'running');
  callbacks[1]('simulationComplete',{...good,truncation:0.5});
  assert.equal(session.state,'incomplete');
  assert.equal(session.prediction,null);
});
