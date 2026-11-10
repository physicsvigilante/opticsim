import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validate, parseSave, serializeSave, setParameter, setSourceMode, SAMPLING_PRESETS } from '../src/contract.js';
import { predict } from '../src/analysis.js';
const { compile, loadDocument, loadNative, nativeExport, Simulator, diagnostics, Session, observeSourceEmission } = createRequire(import.meta.url)('../dist/test-core.cjs');
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const example = (name='finite') => read(`../scenes/lens-mirror-${name}.json`);
const component = (d,type) => d.physics.components.find(c=>c.type===type);
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function run(doc,{height,detectors=false}={}) {
  const n=compile(doc).native,s=component(doc,'point-source').parameters,l=component(doc,'ideal-lens').parameters;
  if(height!==undefined)n.objs[0]={type:'SingleRay',p1:{x:s.x,y:-s.y},p2:{x:l.x,y:-height},brightness:1};
  const planes=[s.x-50,s.x-100];
  if(detectors)for(const x of planes)n.objs.push({type:'Detector',p1:{x,y:-1000},p2:{x,y:1000},irradMap:true,binSize:.01});
  const scene=loadNative(n),lens=scene.objs[1],mirror=scene.objs[2],events=[];
  // Test-only observations. Simulator chooses every hit; no route is prescribed.
  for(const [obj,id] of [[lens,component(doc,'ideal-lens').id],[mirror,component(doc,'plane-mirror').id]]){
    const original=obj.onRayIncident;
    obj.onRayIncident=function(ray,index,point,...rest){
      assert.equal(this,obj);const incoming={x:ray.p2.x-ray.p1.x,y:-(ray.p2.y-ray.p1.y)};
      const result=original.call(this,ray,index,point,...rest);
      events.push({id,index,point:{x:point.x,y:-point.y},incoming,outgoing:{x:ray.p2.x-ray.p1.x,y:-(ray.p2.y-ray.p1.y)}});return result;
    };
  }
  const meter=height===undefined?observeSourceEmission(scene.objs[0]):null;
  const sim=new Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);let event;
  for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{event=name;});sim.updateSimulation();
  return {scene,lens,mirror,events,event,planes,data:diagnostics(scene,sim,meter)};
}

test('v3 lens and mirror saves migrate exactly; historical versions cannot admit return layouts',()=>{
  for(const name of ['lens','mirror']){
    const old=read(`./fixtures/legacy-v3-${name}.json`),s=component(old,'point-source');
    s.id='source-stable';s.parameters.brightness=.073219;s.emission.directionDeg=17.125;s.emission.angleDeg=12.75;old.simulation.rayDensity=.137891;
    const before=structuredClone(old),expected=structuredClone(old);expected.schemaVersion=expected.adapterVersion=4;
    const migrated=parseSave(JSON.stringify(old));assert.deepEqual(old,before);assert.deepEqual(migrated,expected);assert.deepEqual(parseSave(serializeSave(migrated)),expected);
    assert.equal(loadDocument(migrated).scene.rayDensity,.137891);
  }
  for(const version of [1,2,3]){
    const old=example();old.schemaVersion=old.adapterVersion=version;
    assert.throws(()=>parseSave(JSON.stringify(old)),/physics.model/);
    old.physics.model=version===3?'plane-mirror-geometric':'ideal-thin-lens-geometric';
    if(version===1){delete component(old,'point-source').emission;delete component(old,'point-source').parameters.brightness;old.presentation.brightness=.05;}
    assert.throws(()=>parseSave(JSON.stringify(old)),/\$/);
  }
});

test('return scope admits only the declared coaxial composition and retains one stable native lens on export',()=>{
  for(const change of [d=>component(d,'point-source').parameters.x=0,d=>component(d,'plane-mirror').parameters.x=0,
    d=>component(d,'plane-mirror').parameters.y=1,d=>component(d,'plane-mirror').parameters.orientationDeg=89.999,
    d=>d.physics.components.push({...component(d,'ideal-lens'),id:'another-lens'}),d=>d.physics.components.pop(),
    d=>d.physics.components.push({...component(d,'plane-mirror'),id:'another-mirror'})]){
    const d=example();change(d);assert.throws(()=>validate(d),/\$/);
  }
  for(const orientation of [90,-90]){
    const d=example();component(d,'ideal-lens').id='one-stable-lens';component(d,'plane-mirror').parameters.orientationDeg=orientation;
    d.physics.components.reverse();const {scene,idMap}=loadDocument(d);
    assert.equal(idMap.get('one-stable-lens'),1);assert.equal(scene.objs.filter(o=>o.constructor.type==='IdealLens').length,1);
    const n=JSON.parse(nativeExport(d)),reloaded=loadNative(n);
    assert.equal(n.version,5);assert.deepEqual(reloaded.objs.map(o=>o.serialize()),scene.objs.map(o=>o.serialize()));
    assert.ok(n.objs.every(o=>!('id' in o)&&!('parameters' in o)));assert.deepEqual(parseSave(serializeSave(d)),d);
  }
});

test('independent focal, finite, virtual and infinite return images use the same lens twice and left-going classification',()=>{
  const focal=predict(example('focal'));assert.equal(focal.imageKind,'finite-real');near(focal.x,-100);near(focal.y,0);near(focal.distance,100);near(focal.magnification,-1);
  const finite=predict(example());near(finite.x,-500/3);near(finite.y,10/3);near(finite.magnification,1/3);assert.deepEqual(finite.path,['lens-1','mirror-1','lens-1']);
  const virtual=predict(setParameter(example(),'mirror-1','x',80));assert.equal(virtual.imageKind,'finite-virtual');near(virtual.x,100/9);near(virtual.y,-50/9);
  const infinity=predict(setParameter(example(),'mirror-1','x',125));assert.equal(infinity.imageKind,'at-infinity');assert.equal('x' in infinity,false);assert.equal('magnification' in infinity,false);
  for(const x of [124.999,125.001])assert.notEqual(predict(setParameter(example(),'mirror-1','x',x)).imageKind,'at-infinity');
  // Scalar conjugates independently cover signed focal lengths and translations.
  for(const [s,g,f] of [[300,200,100],[300,80,100],[300,200,-100],[150,100,75]]){
    const d=example();component(d,'point-source').parameters.x=40-s;component(d,'ideal-lens').parameters.x=40;
    component(d,'ideal-lens').parameters.focalLength=f;component(d,'plane-mirror').parameters.x=40+g;
    const v1=f*s/(s-f),u2=2*g-v1,v2=f*u2/(u2-f),m=(-v1/s)*(-v2/u2),p=predict(d);
    near(p.x,40-v2);near(p.y,10*m);near(p.magnification,m);
  }
  for(const density of Object.values(SAMPLING_PRESETS))for(const mode of ['full-circle','directional']){
    const d=setSourceMode(example(),'source-1',mode);d.simulation.rayDensity=density;component(d,'point-source').emission.directionDeg=180;
    component(d,'point-source').parameters.brightness=.073219;component(d,'ideal-lens').parameters.apertureHeight=1;component(d,'plane-mirror').parameters.length=1;
    assert.deepEqual(predict(d),finite); // conditional path, not detected image or illumination
  }
});

test('native Simulator chooses forward lens, reflection and return through the identical instance; detectors verify output',()=>{
  for(const d of [example('focal'),example(),setParameter(example(),'mirror-1','x',80),setParameter(example(),'mirror-1','x',125),setParameter(example(),'lens-1','focalLength',-100)]){
    component(d,'ideal-lens').parameters.apertureHeight=1000;component(d,'plane-mirror').parameters.length=1000;
    const s=component(d,'point-source').parameters,l=component(d,'ideal-lens').parameters,g=component(d,'plane-mirror').parameters.x-l.x,p=predict(d);
    for(const h of [-10,10,25]){
      const r=run(d,{height:h,detectors:true});assert.equal(r.event,'simulationComplete');assert.deepEqual(r.data.errors,[]);assert.equal(r.data.truncation,0);assert.equal(r.data.undefinedBehavior,0);
      assert.equal(r.scene.objs[1],r.lens);assert.equal(r.scene.objs.filter(o=>o.constructor.type==='IdealLens').length,1);
      assert.deepEqual(r.events.map(e=>e.id),['lens-1','mirror-1','lens-1']);
      const [first,reflection,last]=r.events;assert.ok(first.incoming.x>0&&first.outgoing.x>0&&last.incoming.x<0&&last.outgoing.x<0);
      const q0=(h-s.y)/(l.x-s.x),q1=q0-h/l.focalLength,hm=h+g*q1,hr=h+2*g*q1,qr=q1-hr/l.focalLength;
      near(first.point.y,h);near(first.outgoing.y/first.outgoing.x,q1,1e-9);near(reflection.point.y,hm);
      near(reflection.outgoing.y/(-reflection.outgoing.x),q1,1e-9);near(last.point.y,hr);near(last.outgoing.y/(-last.outgoing.x),qr,1e-9);
      if(p.imageKind==='at-infinity')near(qr,.05,1e-9);else near(hr+p.distance*qr,p.y);
      r.scene.objs.slice(3).forEach((detector,i)=>{
        const expected=-(hr+(l.x-r.planes[i])*qr),bins=detector.binData.flatMap((v,j)=>v?[j]:[]);assert.equal(bins.length,1);near(Math.abs(detector.power),1);
        assert.ok(expected>=-1000+bins[0]*.01-1e-7&&expected<=-1000+(bins[0]+1)*.01+1e-7);
      });
    }
  }
});

test('finite misses naturally change the native route; actual source modes and samples retain conditional predictions',()=>{
  let d=example();component(d,'ideal-lens').parameters.apertureHeight=20;
  assert.deepEqual(run(d,{height:30}).events.map(e=>e.id),['mirror-1']);
  d=example();component(d,'plane-mirror').parameters.length=10;
  assert.deepEqual(run(d,{height:25}).events.map(e=>e.id),['lens-1']);
  d=example();component(d,'ideal-lens').parameters.apertureHeight=40;
  assert.deepEqual(run(d,{height:10}).events.map(e=>e.id),['lens-1','mirror-1']);
  for(const density of Object.values(SAMPLING_PRESETS))for(const mode of ['full-circle','directional']){
    d=setSourceMode(example('focal'),'source-1',mode);d.simulation.rayDensity=density;
    const r=run(d);assert.equal(r.event,'simulationComplete');assert.equal(r.data.truncation,0);assert.equal(r.data.undefinedBehavior,0);assert.deepEqual(r.data.errors,[]);
    const paths=new Map();for(const e of r.events){if(!paths.has(e.index))paths.set(e.index,[]);paths.get(e.index).push(e.id);}
    assert.ok([...paths.values()].some(path=>path.join(',')==='lens-1,mirror-1,lens-1'));
  }
  d=example();component(d,'point-source').emission.directionDeg=180;assert.equal(run(d).events.length,0);near(predict(d).x,-500/3);
  d=example();d.simulation.maxRayDepth=2;assert.ok(run(d).data.truncation>0);
  d=example();d.simulation.processedRayLimit=1;assert.equal(run(d).event,'simulationStop');
});

test('analytical unavailability and exceptions do not invalidate a valid trace; revisions and native failures still suppress stale results',()=>{
  const extreme=example();component(extreme,'point-source').parameters={x:-9000,y:0,brightness:.05};
  component(extreme,'ideal-lens').parameters.focalLength=1;component(extreme,'plane-mirror').parameters.x=9000;
  assert.equal(predict(extreme).kind,'unavailable');assert.equal(run(extreme).event,'simulationComplete');
  let outcomes=[],analysis=()=>({kind:'unavailable',reason:'Explicit analysis boundary'}),runs=0;
  const s=new Session(()=>({cancel(){},run(cb){runs++;outcomes.push(cb);}}),()=>{},d=>analysis(d));
  const success={errors:[],warnings:[],processed:12,truncation:0,undefinedBehavior:0};
  assert.equal(s.apply(example()),true);assert.equal(s.analysisStatus,'unavailable');assert.equal(s.prediction,null);assert.equal(s.state,'running');
  outcomes.at(-1)('simulationComplete',success);assert.equal(s.state,'completed');assert.equal(s.analysisStatus,'unavailable');assert.deepEqual(parseSave(serializeSave(s.document)),s.document);assert.equal(JSON.parse(nativeExport(s.document)).objs.length,3);
  analysis=()=>{throw Error('analytical-only failure');};s.apply(example());assert.equal(s.analysisStatus,'failed');assert.equal(s.error,null);outcomes.at(-1)('simulationComplete',success);assert.equal(s.state,'completed');assert.equal(s.analysisReason,'analytical-only failure');
  analysis=predict;s.apply(example());assert.equal(s.analysisStatus,'available');assert.equal(s.analysisReason,null);
  outcomes[0]('simulationComplete',{...success,errors:['obsolete native failure']});assert.equal(s.state,'running');assert.equal(s.analysisStatus,'available');
  outcomes.at(-1)('simulationComplete',{...success,truncation:1});assert.equal(s.state,'incomplete');assert.equal(s.prediction,null);assert.equal(s.analysisStatus,'suppressed');
  s.apply(example());s.stop();outcomes.at(-1)('simulationComplete',success);assert.equal(s.state,'stopped');assert.equal(s.prediction,null);
  const bad=example();component(bad,'plane-mirror').parameters.orientationDeg=45;s.apply(bad);assert.equal(s.state,'invalid');assert.equal(s.data,null);assert.equal(s.prediction,null);assert.equal(s.analysisStatus,'suppressed');assert.ok(runs>=4);
  const nativeFail=new Session(()=>({cancel(){},run(){throw Error('native failure');}}),()=>{});nativeFail.apply(example());assert.equal(nativeFail.state,'failed');assert.equal(nativeFail.analysisStatus,'suppressed');
});
