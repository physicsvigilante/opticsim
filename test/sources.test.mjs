import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseSave, serializeSave, validate, setSourceMode, SAMPLING_PRESETS, samplingPreset, setParameter } from '../src/contract.js';
import { predict } from '../src/analysis.js';
const { compile, loadDocument, loadNative, nativeExport, Simulator, diagnostics, observeSourceEmission, Session } = createRequire(import.meta.url)('../dist/test-core.cjs');
const example = () => parseSave(readFileSync(new URL('../scenes/single-lens.json', import.meta.url), 'utf8'));
const legacy = () => JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json', import.meta.url)));
const near = (a,b,e=1e-9) => assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const source = d => d.physics.components.find(c=>c.type==='point-source');
function directional(direction=0, angle=30, density=.2) {
  const d=setSourceMode(example(),'source-1','directional');
  Object.assign(source(d).emission,{directionDeg:direction,angleDeg:angle});d.simulation.rayDensity=density;return validate(d);
}
test('v1 migration preserves exact intensity/density and full-circle native emission, without mutating the old save',()=>{
  for(const [brightness,density] of [[.5,1],[.073219,.137891],[.875,.1]]){
    const old=legacy();old.presentation.brightness=brightness;old.simulation.rayDensity=density;
    const original=structuredClone(old);const migrated=parseSave(JSON.stringify(old));
    assert.deepEqual(old,original);assert.equal(migrated.schemaVersion,4);assert.equal(migrated.adapterVersion,4);
    assert.deepEqual(source(migrated).parameters,{...source(old).parameters,brightness});
    assert.deepEqual(source(migrated).emission,{mode:'full-circle',directionDeg:0,angleDeg:30});
    assert.equal(migrated.simulation.rayDensity,density);assert.equal('brightness' in migrated.presentation,false);
    assert.deepEqual(migrated.physics.components.slice(1),old.physics.components.slice(1));
    assert.deepEqual({...migrated.presentation,brightness},old.presentation);
    const scene=loadDocument(migrated).scene;
    const reference=loadNative({version:5,objs:[{type:'PointSource',x:-300,y:-10,brightness}],mode:'rays',rayModeDensity:density});
    assert.deepEqual(scene.objs[0].onSimulationStart(),reference.objs[0].onSimulationStart());
    assert.deepEqual(parseSave(serializeSave(migrated)),migrated);
    if(density===.137891)assert.equal(samplingPreset(density),'custom');
  }
  const bad=legacy();bad.presentation.brightness=NaN;assert.throws(()=>parseSave(JSON.stringify(bad)),/brightness/);
  const version=legacy();version.adapterVersion=2;assert.throws(()=>parseSave(JSON.stringify(version)),/adapterVersion/);
  const extra=legacy();source(extra).emission={mode:'directional'};assert.throws(()=>parseSave(JSON.stringify(extra)),/emission/);
});
test('source mode action defaults to Medium; saved explicit directional densities and inactive angles survive round trips',()=>{
  let d=example();const id=source(d).id;
  d=setSourceMode(d,id,'directional');assert.equal(d.simulation.rayDensity,.2);assert.equal(source(d).id,id);
  source(d).emission.directionDeg=17.125;source(d).emission.angleDeg=12.75;d.simulation.rayDensity=.137891;
  assert.deepEqual(parseSave(serializeSave(d)),d);
  d=setSourceMode(d,id,'full-circle');assert.equal(d.simulation.rayDensity,.137891);assert.equal(source(d).emission.directionDeg,17.125);
  assert.equal(compile(d).native.objs[0].type,'PointSource');
  d=setSourceMode(d,id,'directional');assert.equal(d.simulation.rayDensity,.2);assert.equal(source(d).emission.angleDeg,12.75);
  assert.equal(compile(d).native.objs[0].type,'AngleSource');assert.equal(compile(d).idMap.get(id),0);
});
test('reject unsupported source characteristics and bounds without clamping precise numeric edits',()=>{
  for(const [field,value] of [['angleDeg',0],['angleDeg',180.1],['directionDeg',181],['directionDeg',-181],['directionDeg',NaN],['mode','beam']]){
    const d=directional();source(d).emission[field]=value;assert.throws(()=>validate(d),/emission/);
  }
  for(const b of [0,1.1,NaN]){const d=example();source(d).parameters.brightness=b;assert.throws(()=>validate(d),/brightness/);}
  const exact=directional(12.3456789,30.1234567);source(exact).parameters.brightness=.123456789;
  assert.deepEqual(parseSave(serializeSave(exact)),exact);
  const bad=example();bad.presentation.brightness=.5;assert.throws(()=>validate(bad),/presentation.brightness/);
  const low=example();low.simulation.rayDensity=.0479;assert.throws(()=>validate(low),/rayDensity/);
});
test('sandbox angle signs and native symmetric cone are correct at right/up/down/left directions',()=>{
  for(const [direction,dx,dy] of [[0,20,0],[90,0,-20],[-90,0,20],[180,-20,0],[-180,-20,0]]){
    const d=directional(direction);const native=compile(d).native.objs[0];
    assert.deepEqual(native.p1,{x:-300,y:-10});near(native.p2.x,-300+dx);near(native.p2.y,-10+dy);
    assert.equal(native.symmetric,true);assert.equal(native.emisAngle,30);
    const scene=loadDocument(d).scene;const rays=scene.objs[0].onSimulationStart().newRays;
    const offsets=rays.map(r=>{
      const angle=Math.atan2(-(r.p2.y-r.p1.y),r.p2.x-r.p1.x)*180/Math.PI;
      return ((angle-direction+540)%360)-180;
    });
    assert.equal(rays.length,9);
    offsets.forEach(o=>assert.ok(o>=-15-1e-9&&o<=15+1e-9));
    near(offsets[0],15);near(offsets.at(-1),-13.8); // native half-open lattice, no invented symmetry rays
  }
});
test('preset counts, brightness scale and exactly-once emission observation preserve native return values',()=>{
  for(const mode of ['rays','extended'])for(const [preset,density] of Object.entries(SAMPLING_PRESETS))for(const directionalMode of [false,true]){
    const d=directionalMode?directional(0,30,density):example();d.simulation.rayDensity=density;d.presentation.mode=mode;
    const {scene}=loadDocument(d);const emitter=scene.objs[0];const native=emitter.onSimulationStart;let calls=0,returned;
    emitter.onSimulationStart=function(...args){calls++;assert.equal(this,emitter);returned=native.apply(this,args);return returned;};
    const meter=observeSourceEmission(emitter);const result=emitter.onSimulationStart();
    assert.equal(calls,1);assert.equal(result,returned);assert.equal(result.newRays,returned.newRays);
    assert.equal(meter.emitted,(directionalMode?{sparse:2,medium:9,dense:42}:{sparse:24,medium:100,dense:500})[preset]);
    near(meter.brightnessScale,Math.min(.5/density,1)/(.5/density));
    result.newRays.forEach(r=>near(r.brightness_s+r.brightness_p,Math.min(.5/density,1)));
    assert.deepEqual(result,loadDocument(d).scene.objs[0].onSimulationStart());
  }
  assert.equal(loadDocument(directional(0,1,.2)).scene.objs[0].onSimulationStart().newRays.length,1);
});
test('source-only changes preserve real/virtual/infinite predictions, IDs and native export reload',()=>{
  for(const x of [-300,-50,-100]){
    const base=setParameter(example(),'source-1','x',x);const prediction=predict(base);
    for(const mode of ['full-circle','directional'])for(const density of Object.values(SAMPLING_PRESETS))for(const b of [.01,.123456789,1]){
      const d=setSourceMode(base,'source-1',mode);d.simulation.rayDensity=density;source(d).parameters.brightness=b;source(d).emission.directionDeg=180;
      assert.deepEqual(predict(d),prediction);assert.deepEqual(parseSave(serializeSave(d)),d);
      const native=JSON.parse(nativeExport(d));const reloaded=loadNative(native);
      assert.equal(reloaded.error,null);assert.equal(reloaded.rayDensity,density);assert.equal(reloaded.objs[0].brightness,b);
      assert.equal(reloaded.objs[0].constructor.type,mode==='full-circle'?'PointSource':'AngleSource');
      assert.equal(native.objs.some(o=>'id' in o||'emission' in o),false);
    }
  }
});
test('directional native simulator and detector see an image only when the cone illuminates the lens',()=>{
  for(const direction of [0,180]){
    const d=directional(direction);source(d).parameters.brightness=.05;
    // 30-degree cone from y=10 reaches y=90.38 at the lens; use a 200mm
    // aperture so this fixture, explicitly, transmits every forward sample.
    d.physics.components.find(c=>c.type==='ideal-lens').parameters.apertureHeight=200;
    const n=compile(d).native;n.objs.push({type:'Detector',p1:{x:150,y:-100},p2:{x:150,y:100},irradMap:true,binSize:.01});
    const scene=loadNative(n);const meter=observeSourceEmission(scene.objs[0]);const sim=new Simulator(scene,null,null,null,null,null,false,10000);
    let event;sim.on('simulationComplete',()=>{event='complete';});sim.on('simulationStop',()=>{event='stop';});sim.updateSimulation();
    assert.equal(event,'complete');const data=diagnostics(scene,sim,meter);
    assert.equal(data.emitted,9);assert.equal(data.truncation,0);assert.equal(data.undefinedBehavior,0);assert.deepEqual(data.errors,[]);
    const detector=scene.objs.at(-1);
    if(direction===180){assert.equal(detector.power,0);assert.ok(detector.binData.every(v=>v===0));}
    else {near(detector.power,9*.25);const bins=detector.binData.flatMap((v,j)=>v?[j]:[]);assert.ok(bins.length>0);bins.forEach(j=>assert.ok(j*.01-100<=5+1e-7&&(j+1)*.01-100>=5-1e-7));}
    assert.equal(predict(d).x,150); // conditional ideal location, not a detector result
  }
});
test('source edits retain stale-callback and invalid-result safeguards',()=>{
  const callbacks=[];const s=new Session(()=>({cancel(){},run(cb){callbacks.push(cb);}}),()=>{});
  s.apply(example());s.apply(directional());const revision=s.revision;
  const success={errors:[],warnings:[],processed:12,truncation:0,undefinedBehavior:0};callbacks[0]('simulationComplete',success);
  assert.equal(s.state,'running');assert.equal(s.revision,revision);
  const bad=directional();source(bad).emission.angleDeg=0;s.apply(bad);callbacks[1]('simulationComplete',success);
  assert.equal(s.state,'invalid');assert.equal(s.prediction,null);
  s.apply(directional());callbacks.at(-1)('simulationComplete',{...success,truncation:.5});assert.equal(s.state,'incomplete');assert.equal(s.prediction,null);
});
