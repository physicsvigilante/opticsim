import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validate, parseSave, serializeSave, setParameter, setSourceMode, SAMPLING_PRESETS } from '../src/contract.js';
import { predict } from '../src/analysis.js';
const { compile, loadDocument, loadNative, nativeExport, Simulator, diagnostics, observeSourceEmission, observeMirrorReflections, classifyRun, Session } = createRequire(import.meta.url)('../dist/test-core.cjs');
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const example = () => read('../scenes/plane-mirror.json');
const source = d => d.physics.components.find(c => c.type === 'point-source');
const mirror = d => d.physics.components.find(c => c.type === 'plane-mirror');
const near = (a,b,t=1e-7) => assert.ok(Math.abs(a-b)<=t, `${a} != ${b}`);
const native = p => ({ x:p.x, y:-p.y });
const dot = (a,b) => a.x*b.x+a.y*b.y;
const unit = v => { const m=Math.hypot(v.x,v.y);return {x:v.x/m,y:v.y/m}; };
function run(doc) {
  const {scene,idMap}=loadDocument(doc);
  const emitter=observeSourceEmission(scene.objs[idMap.get(source(doc).id)]);
  const reflections=observeMirrorReflections(scene.objs[idMap.get(mirror(doc).id)]);
  const sim=new Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let event;for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{event=name;});
  sim.updateSimulation();const data=diagnostics(scene,sim,emitter,reflections);
  return {scene,event,data,state:classifyRun(event,data)};
}

test('v2 migration preserves all lens/source values and historical schemas reject mirrors before migration',()=>{
  for(const mode of ['full-circle','directional'])for(const density of [.048,.137891,1]){
    const old=read('./fixtures/legacy-v2.json');const s=source(old);
    s.id='stable-emitter';s.parameters.brightness=.073219;s.emission={mode,directionDeg:17.125,angleDeg:12.75};old.simulation.rayDensity=density;
    const before=structuredClone(old), migrated=parseSave(JSON.stringify(old));
    const expected=structuredClone(old);expected.schemaVersion=expected.adapterVersion=4;
    assert.deepEqual(old,before);assert.deepEqual(migrated,expected);
    assert.deepEqual(parseSave(serializeSave(migrated)),expected);
    const scene=loadDocument(migrated).scene;
    assert.equal(scene.rayDensity,density);assert.equal(scene.objs[0].brightness,.073219);
    assert.equal(scene.objs[0].constructor.type,mode==='directional'?'AngleSource':'PointSource');
    const reference=loadNative({version:5,mode:'rays',rayModeDensity:density,objs:[mode==='full-circle'?
      {type:'PointSource',x:-300,y:-10,brightness:.073219}:
      {type:'AngleSource',p1:{x:-300,y:-10},p2:{x:-300+20*Math.cos(17.125*Math.PI/180),y:-10-20*Math.sin(17.125*Math.PI/180)},brightness:.073219,emisAngle:12.75,symmetric:true}]});
    assert.deepEqual(scene.objs[0].onSimulationStart(),reference.objs[0].onSimulationStart());
  }
  for(const version of [1,2]){
    const old=example();old.schemaVersion=old.adapterVersion=version;
    assert.throws(()=>parseSave(JSON.stringify(old)),/physics.model/);
    old.physics.model='ideal-thin-lens-geometric';
    if(version===1){delete source(old).emission;delete source(old).parameters.brightness;old.presentation.brightness=.15;}
    assert.throws(()=>parseSave(JSON.stringify(old)),/type/);
  }
  for(const mutate of [d=>d.adapterVersion=3,d=>d.physics.components[1].parameters.focalLength=0,d=>source(d).parameters.x=100,d=>d.presentation.extra=true]){
    const old=read('./fixtures/legacy-v2.json');mutate(old);assert.throws(()=>parseSave(JSON.stringify(old)),/\$/);
  }
});

test('mirror contract rejects unsupported combinations, degeneracy and bounds; precise values and IDs round-trip',()=>{
  const changes=[d=>mirror(d).parameters.length=0,d=>mirror(d).parameters.length=10001,
    d=>mirror(d).parameters.orientationDeg=180.001,d=>mirror(d).parameters.orientationDeg=NaN,
    d=>mirror(d).parameters.y=10000,d=>source(d).parameters.x=0,
    d=>Object.assign(source(d).parameters,{x:.005,y:500}),
    d=>d.physics.components.push({...mirror(d),id:'mirror-2'}),
    d=>d.physics.components.push({id:'lens-1',type:'ideal-lens',parameters:{x:100,focalLength:100,apertureHeight:100}}),
    d=>d.physics.model='ideal-thin-lens-geometric',d=>mirror(d).parameters.reflectivity=.5,
    d=>mirror(d).id=source(d).id,d=>d.physics.components.shift()];
  for(const change of changes){const d=example();change(d);assert.throws(()=>validate(d),/\$/);}
  const lens=read('../scenes/single-lens.json');lens.physics.components.push(mirror(example()));assert.throws(()=>validate(lens),/lens bench/);
  let d=setParameter(example(),'mirror-1','orientationDeg',-37.1234567);
  for(const [key,value] of Object.entries({x:12.3456789,y:-27.125,length:201.1234567}))d=setParameter(d,'mirror-1',key,value);
  mirror(d).id='reflector-stable';source(d).id='emitter-stable';d.simulation.rayDensity=.137891;
  assert.deepEqual(parseSave(serializeSave(d)),d);
});

test('mirror adapter uses centre/tangent endpoints with correct y sign and native export preserves independent objects',()=>{
  for(const theta of [0,90,45,-45,180,-180]){
    const d=example();Object.assign(mirror(d).parameters,{x:20,y:-30,orientationDeg:theta,length:200});
    source(d).parameters={x:-200,y:100,brightness:.073219};d.simulation.rayDensity=.137891;
    d.physics.components.reverse(); // IDs, not ordering conventions, identify the source/mirror.
    const {native:n,idMap}=compile(d);assert.equal(idMap.get('mirror-1'),0);assert.equal(idMap.get('source-1'),1);
    const m=n.objs[0];assert.equal(m.type,'Mirror');assert.equal(m.filter,false);
    const angle=theta*Math.PI/180,dx=100*Math.cos(angle),dy=100*Math.sin(angle);
    near(m.p1.x,20-dx);near(m.p1.y,30+dy);near(m.p2.x,20+dx);near(m.p2.y,30-dy);
    const loaded=loadDocument(d).scene, exported=JSON.parse(nativeExport(d)), reloaded=loadNative(exported);
    assert.equal(exported.version,5);assert.equal(reloaded.error,null);assert.equal(reloaded.rayDensity,.137891);
    assert.deepEqual(reloaded.objs.map(o=>o.serialize()),loaded.objs.map(o=>o.serialize()));
    assert.ok(exported.objs.every(o=>!('id' in o)&&!('parameters' in o)&&!('emission' in o)));
    assert.throws(()=>parseSave(JSON.stringify(exported)),/\$/);
  }
});

test('independent virtual-image fixtures and equal normal distances remain conditional on mirror hits',()=>{
  const cases=[{c:[0,0],s:[-200,30],angle:90,image:[200,30],distance:200},
    {c:[10,5],s:[-20,80],angle:0,image:[-20,-70],distance:75},
    {c:[10,-10],s:[110,30],angle:45,image:[50,90],distance:60/Math.sqrt(2)},
    {c:[10,-10],s:[110,30],angle:-45,image:[-30,-110],distance:140/Math.sqrt(2)},
    {c:[0,0],s:[200,30],angle:90,image:[-200,30],distance:200}];
  for(const f of cases){
    const d=example();Object.assign(mirror(d).parameters,{x:f.c[0],y:f.c[1],orientationDeg:f.angle});
    Object.assign(source(d).parameters,{x:f.s[0],y:f.s[1]});const p=predict(d);
    assert.equal(p.kind,'plane-mirror-virtual');near(p.x,f.image[0]);near(p.y,f.image[1]);near(p.normalDistance,f.distance);
    assert.equal('magnification' in p,false);assert.equal('distance' in p,false);
    // Independent midpoint and distance geometry, in addition to fixed fixtures.
    const t={x:Math.cos(f.angle*Math.PI/180),y:Math.sin(f.angle*Math.PI/180)};
    near((p.x-f.s[0])*t.x+(p.y-f.s[1])*t.y,0);
    near(Math.hypot(p.x-f.s[0],p.y-f.s[1]),2*f.distance);
    for(const length of [1,200])for(const mode of ['full-circle','directional'])for(const density of Object.values(SAMPLING_PRESETS)){
      const varied=setSourceMode(d,'source-1',mode);mirror(varied).parameters.length=length;varied.simulation.rayDensity=density;
      source(varied).emission.directionDeg=180;source(varied).parameters.brightness=.073219;
      assert.deepEqual(predict(varied),p);
    }
  }
});

test('native reflection law, brightness and backward virtual-image geometry agree for both sides and endpoint orders',()=>{
  for(const theta of [0,30,90,-45])for(const side of [-1,1])for(const reverse of [false,true]){
    const t={x:Math.cos(theta*Math.PI/180),y:Math.sin(theta*Math.PI/180)},n={x:-t.y,y:t.x},c={x:25,y:-15};
    const d=example();Object.assign(mirror(d).parameters,{x:c.x,y:c.y,orientationDeg:theta,length:200});
    Object.assign(source(d).parameters,{x:c.x+80*side*n.x+20*t.x,y:c.y+80*side*n.y+20*t.y});
    const s=source(d).parameters,image=predict(d),m=loadDocument(d).scene.objs[1];
    if(reverse)[m.p1,m.p2]=[m.p2,m.p1];
    for(const h of [-40,0,40]){
      const point={x:c.x+h*t.x,y:c.y+h*t.y};
      const original={p1:native(s),p2:native(point),brightness_s:.17,brightness_p:.23},ray=structuredClone(original);
      const hit=m.checkRayIntersects(ray);assert.ok(hit);near(hit.x,point.x);near(-hit.y,point.y);
      m.onRayIncident(ray,0,hit);
      const incident=unit({x:point.x-s.x,y:point.y-s.y}),actual=unit({x:ray.p2.x-ray.p1.x,y:-(ray.p2.y-ray.p1.y)});
      const expected={x:incident.x-2*dot(incident,n)*n.x,y:incident.y-2*dot(incident,n)*n.y};
      near(actual.x,expected.x,1e-9);near(actual.y,expected.y,1e-9);
      near(dot(actual,t),dot(incident,t),1e-9);near(dot(actual,n),-dot(incident,n),1e-9);
      const toImage={x:image.x-point.x,y:image.y-point.y};near(actual.x*toImage.y-actual.y*toImage.x,0);assert.ok(dot(actual,toImage)<0);
      assert.equal(ray.brightness_s,.17);assert.equal(ray.brightness_p,.23);
    }
  }
  // Exact native coordinates isolate endpoint inclusion from sin/cos and
  // intersection roundoff; production geometry is not snapped or repaired.
  const m=loadNative({version:5,objs:[{type:'Mirror',p1:{x:0,y:-100},p2:{x:0,y:100}}]}).objs[0];
  for(const y of [-100,100])assert.ok(m.checkRayIntersects({p1:{x:-200,y:0},p2:{x:0,y}}));
  for(const y of [-100.001,100.001])assert.equal(m.checkRayIntersects({p1:{x:-200,y:0},p2:{x:0,y}}),null);
  assert.equal(m.checkRayIntersects({p1:{x:-200,y:0},p2:{x:-200,y:20}}),null);
});

test('native reflection observer delegates once with identical arguments, return and mutated ray; counts actual source reflections',()=>{
  const m=loadDocument(example()).scene.objs[1],original=m.onRayIncident;
  const ray={p1:{x:-200,y:-30},p2:{x:0,y:0},brightness_s:.17,brightness_p:.23},reference=structuredClone(ray);
  const hit=m.checkRayIntersects(ray),extra=[];original.call(m,reference,7,hit,extra);
  const result={nativeReturn:true};let calls=0;
  m.onRayIncident=function(...args){calls++;assert.equal(this,m);assert.equal(args[0],ray);assert.equal(args[1],7);assert.equal(args[2],hit);assert.equal(args[3],extra);original.apply(this,args);return result;};
  const meter=observeMirrorReflections(m);assert.equal(meter.reflections,0);
  assert.equal(m.onRayIncident(ray,7,hit,extra),result);assert.equal(calls,1);assert.equal(meter.reflections,1);assert.deepEqual(ray,reference);
  for(const density of Object.values(SAMPLING_PRESETS))for(const mode of ['full-circle','directional']){
    const doc=setSourceMode(example(),'source-1',mode);doc.simulation.rayDensity=density;const r=run(doc);
    assert.equal(r.state,'completed');assert.deepEqual(r.data.errors,[]);assert.equal(r.data.truncation,0);assert.equal(r.data.undefinedBehavior,0);
    assert.ok(r.data.reflections>0&&r.data.reflections<=r.data.emitted);
    if(mode==='directional')assert.equal(r.data.reflections,r.data.emitted);
    const baseline=loadDocument(doc).scene,sim=new Simulator(baseline,null,null,null,null,null,false,10000);sim.updateSimulation();
    assert.equal(r.data.processed,sim.processedRayCount);assert.equal(r.data.brightnessScale,sim.brightnessScale);
  }
  const away=example();source(away).emission.directionDeg=180;
  assert.equal(run(away).data.reflections,0);near(predict(away).x,200);
  const short=setParameter(example(),'mirror-1','length',1);assert.equal(run(short).data.reflections,0);
  const narrow=example();source(narrow).emission.angleDeg=1;
  assert.equal(run(narrow).data.emitted,1);assert.equal(run(narrow).data.reflections,1);
});

test('bounded native mirror and detectors match outgoing crossings on two planes for both sides and rotated surfaces',()=>{
  for(const theta of [0,30,90,-45])for(const side of [-1,1]){
    const t={x:Math.cos(theta*Math.PI/180),y:Math.sin(theta*Math.PI/180)},n={x:-t.y,y:t.x};
    const point=(normal,tangent)=>({x:normal*n.x+tangent*t.x,y:normal*n.y+tangent*t.y});
    const s=point(side*100,30),hit=point(0,0);
    // Reflection reverses normal travel; tangent travel continues. Incident
    // crossings have positive tangent coordinates and cannot hit these detectors.
    const detectors=[25,50].map(distance=>({type:'Detector',p1:native(point(side*distance,-50)),p2:native(point(side*distance,-1)),irradMap:true,binSize:.01}));
    const d=example();Object.assign(mirror(d).parameters,{orientationDeg:theta});Object.assign(source(d).parameters,s);
    const compiled=compile(d).native;compiled.objs=[{type:'SingleRay',p1:native(s),p2:native(hit),brightness:1},compiled.objs[1],...detectors];
    const scene=loadNative(compiled),sim=new Simulator(scene,null,null,null,null,null,false,10000);let event;
    sim.on('simulationComplete',()=>{event='complete';});sim.on('simulationStop',()=>{event='stop';});sim.updateSimulation();
    assert.equal(event,'complete');assert.equal(sim.totalTruncation,0);assert.equal(sim.totalUndefinedBehavior,0);assert.deepEqual(diagnostics(scene,sim).errors,[]);
    scene.objs.slice(2).forEach((detector,i)=>{
      near(Math.abs(detector.power),1);const expectedPosition=50-.3*[25,50][i];
      const bins=detector.binData.flatMap((v,j)=>v!==0?[j]:[]);assert.equal(bins.length,1);
      assert.ok(expectedPosition>=bins[0]*.01-1e-7&&expectedPosition<=(bins[0]+1)*.01+1e-7);
    });
  }
});

test('mirror limits, invalid edits, failures and late callbacks cannot display stale predictions or reflection counts',()=>{
  for(const [key,value,expected] of [['processedRayLimit',1,'stopped'],['maxRayDepth',0,'incomplete']]){
    const d=example();d.simulation[key]=value;assert.equal(run(d).state,expected);
  }
  const callbacks=[],s=new Session(()=>({cancel(){},run(cb){callbacks.push(cb);}}),()=>{});
  const success={errors:[],warnings:[],processed:18,truncation:0,undefinedBehavior:0,reflections:9};
  s.apply(example());callbacks.at(-1)('simulationComplete',success);assert.equal(s.data.reflections,9);
  const second=setParameter(example(),'mirror-1','y',10);s.apply(second);assert.equal(s.data,null);
  callbacks[0]('simulationComplete',{...success,reflections:100});assert.equal(s.state,'running');assert.equal(s.data,null);
  callbacks.at(-1)('simulationComplete',success);near(s.prediction.y,30);
  const bad=example();mirror(bad).parameters.length=0;s.apply(bad);assert.equal(s.state,'invalid');assert.equal(s.prediction,null);assert.equal(s.data,null);
  callbacks.at(-1)('simulationComplete',success);assert.equal(s.state,'invalid');assert.equal(s.data,null);
  for(const outcome of ['stopped','incomplete','failed']){
    s.apply(example());callbacks.at(-1)(outcome==='stopped'?'simulationStop':'simulationComplete',{...success,truncation:outcome==='incomplete'?.5:0,errors:outcome==='failed'?['native error']:[]});
    assert.equal(s.state,outcome);assert.equal(s.prediction,null);
  }
  s.apply(example());s.stop();assert.equal(s.state,'stopped');assert.equal(s.prediction,null);assert.equal(s.data,null);
});

test('data-only unequal two-lens arrangement remains valid through the current pipeline',()=>{
  const d=read('../scenes/two-lenses-data-check.json'),p=predict(d),loaded=loadDocument(d);
  near(p.x,900);near(p.y,48);near(p.magnification,3);
  assert.deepEqual([...loaded.idMap],[['source-data',0],['lens-a',1],['lens-b',2]]);
  assert.deepEqual(parseSave(serializeSave(d)),d);
});
