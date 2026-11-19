// SYNTHETIC observer-fault injection only. All real CircleGlass optics
// remain pinned-native; these manufactured callback arguments are NOT
// native optical events or publicly qualified measurements.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {circleBeamNativeEncounter} from '../src/native-circle-beam.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const example=JSON.parse(readFileSync(new URL('../examples/jee-circle-beam-v23.json',import.meta.url),'utf8'));
const canonical=()=>prepareScene(structuredClone(example.physical)).document;
function callFake(doc,point,ray){
 const loaded=core.loadDocument(doc);
 const optic=loaded.scene.objs[loaded.idMap.get('G1')];
 let delegates=0;const originalRay=structuredClone(ray);
 optic.onRayIncident=function(...args){
  delegates++;
  assert.strictEqual(args[0],ray,'observer must keep original ray identity');
  assert.strictEqual(args[2],point,'observer must keep incident point identity');
  return {isAbsorbed:true};
 };
 const meter=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
 const outcome=optic.onRayIncident(ray,0,point,[]);
 assert.equal(delegates,1,'must delegate to native method exactly once');
 assert.deepEqual(ray,originalRay,'observer must not alter the incident ray');
 assert.deepEqual(outcome,{isAbsorbed:true});
 return meter;
}
const ordinaryRay=(x,y)=>({p1:{x:x-1,y},p2:{x,y},
 brightness_s:.04,brightness_p:.04});
test('v23 synthetic radial and malformed callback inputs fail closed without replacing native delegation',()=>{
 const cases=[
  ['outside authored radius tolerance',{x:100.0001,y:0},ordinaryRay(100.0001,0)],
  ['missing hit point',null,ordinaryRay(100,0)],
  ['nonfinite hit point',{x:Infinity,y:0},ordinaryRay(100,0)],
  ['nonfinite incoming direction',{x:100,y:0},
   {p1:{x:100,y:0},p2:{x:100,y:0},brightness_s:.04,brightness_p:.04}]
 ];
 for(const [why,point,ray] of cases){
  const meter=callFake(canonical(),point,ray);
  assert.equal(meter.byId.G1.invalidObservations,1,why);
  assert.equal(meter.errors.length,1,why);
  assert.equal(core.classifyRun('simulationComplete',{
   errors:meter.errors,warnings:[],truncation:0,undefinedBehavior:0}),'failed',why);
 }
});
test('v23 near-critical and grazing callback probes withhold qualified interface data',()=>{
 const n=1.5,y=100/n,x=Math.sqrt(10000-y*y);
 const probes=[
  ['exact numerical critical', {x,y:-y}, ordinaryRay(x,-y)],
  ['grazing at a true circle point', {x:0,y:-100},ordinaryRay(0,-100)]
 ];
 for(const [why,point,ray] of probes){
  const meter=callFake(canonical(),point,ray);
  assert.equal(meter.byId.G1.invalidObservations,1,why);
  assert.equal(meter.errors.length,1,why);
 }
});
test('older v7 CircleGlass keeps its historical callback interpretation, even for radial deviation',()=>{
 const source=JSON.parse(readFileSync(new URL('../examples/circular-dielectric.json',import.meta.url),'utf8'));
 const old=prepareScene(source.physical).document;
 assert.equal(old.schemaVersion,7);
 const point={x:100.0001,y:0},ray=ordinaryRay(100.0001,0);
 const observed=callFake(old,point,ray);
 assert.equal(observed.byId.G1.invalidObservations,0,
   'v7 has no v23 radial tolerance; it must not silently migrate');
 assert.deepEqual(observed.errors,[]);
 const newDoc=canonical();
 const native23=circleBeamNativeEncounter(newDoc.physics.components.find(c=>c.id==='G1'),
   point,{x:1,y:0});
 assert.equal(native23.invalid,true);
});
test('v23 fully finite normal native-shaped synthetic hit remains acceptable to observer',()=>{
 const doc=canonical(),point={x:100,y:0},ray=ordinaryRay(100,0);
 const meter=callFake(doc,point,ray);
 assert.equal(meter.byId.G1.invalidObservations,0,
   'do not suppress every finite native-shaped callback indiscriminately');
 assert.deepEqual(meter.errors,[]);
});
