// Public authorable v20: explicit transverse lens centres with one pinned
// native Beam. Test-side line extrapolation is NOT native image detection.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,capabilities,inspectAuthoringRequest} from '../src/authoring.js';
import {validate,parseSave,serializeSave,componentParameterNames} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {DECENTERED_BEAM_VERSION,DECENTERED_BEAM_MODEL} from '../src/decentered-two-lens-beam.js';
import {LENGTH_PARAMETERS} from '../src/contract.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/jee-parallel-two-lens-v20.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(fixture.physical);
const by=(r,id)=>r.components.find(c=>c.id===id);
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,a+' != '+b);
const prepared=r=>prepareScene(r).document;
async function execute(physical){
 const document=prepared(physical),run=evaluateDocument(document,core,fixture.requests);
 const measured=await evaluateObservables(document,fixture.requests,run.summary);
 return {document,run,results:measured.results};
}
test('v20 authoring retains original request bytes, exact offset fields and native PhyDemo components',()=>{
 const req=fresh(),before=JSON.stringify(req),doc=prepared(req);
 assert.equal(JSON.stringify(req),before);
 assert.equal(doc.schemaVersion,DECENTERED_BEAM_VERSION);
 assert.equal(doc.adapterVersion,DECENTERED_BEAM_VERSION);
 assert.equal(doc.physics.model,DECENTERED_BEAM_MODEL);
 assert.deepEqual(core.compile(doc).native.objs.map(o=>o.type),['Beam','IdealLens','IdealLens','Detector','Detector']);
 assert.deepEqual(componentParameterNames('ideal-lens',20),['x','y','focalLength','apertureHeight']);
 const compiled=core.compile(doc);
 near(compiled.native.objs[2].p1.y,-52);
 near(compiled.native.objs[2].p2.y,48);
 assert.equal(compiled.native.objs[2].focalLength,200);
 assert.deepEqual(parseSave(serializeSave(doc)),doc);
 assert.equal(capabilities().nativeTwoLensBeam.schemaVersion,20);
 assert.equal(capabilities().lensParameterVariants.legacy.centreY,0);
 assert.equal(capabilities().nativeParallelBeam.schemaVersion,19);
});
test('actual native two-lens rays agree with independent J19 paraxial concurrence, not detected image',async()=>{
 const {document,run,results}=await execute(fresh());
 assert.equal(run.summary.native.status,'completed');
 assert.equal(run.summary.native.truncation,0);
 assert.equal(run.summary.native.undefinedBehavior,0);
 assert.deepEqual(results.map(r=>r.status),['available','available','available','available','available']);
 assert.deepEqual(results.slice(0,3).map(r=>r.value),[8,8,8]);
 for(const hits of results.slice(3).map(r=>r.value)){
  assert.equal(hits.length,8);
  for(const hit of hits){
   assert.ok(hit.incomingUnit.x>0);
   const x=hit.pointMm.x;
   // Extrapolate each independently measured native outgoing line to x=5f.
   // This tests a geometric concurrence; it is not a new image solver.
   near(hit.pointMm.y+(1000-x)*hit.incomingUnit.y/hit.incomingUnit.x,4,1e-6);
  }
 }
 const native=core.compile(document).native;
 assert.equal(native.objs[0].type,'Beam');
 assert.equal(run.summary.analysis.status,'unavailable');
 console.log('V20_TWO_LENS_NATIVE '+JSON.stringify({completed:true,samples:8,conditionalConcurrenceMm:[1000,4],nativeImageDetected:false}));
});
test('signed offsets, zero offset and independent translation preserve native ideal geometry',async()=>{
 for(const [offset,expected] of [[-2,-4],[0,0],[4,8]]){
  const r=fresh();by(r,'L2').parameters.y=offset;
  const {run,results}=await execute(r);
  assert.equal(run.summary.native.status,'completed');
  assert.deepEqual(results.slice(0,3).map(v=>v.value),[8,8,8]);
  for(const h of results.slice(3).flatMap(v=>v.value))
   near(h.pointMm.y+(1000-h.pointMm.x)*h.incomingUnit.y/h.incomingUnit.x,expected,1e-6);
 }
 const shifted=fresh();
 for(const c of shifted.components){c.parameters.x+=123;if('y' in c.parameters)c.parameters.y-=37;}
 const {results,run}=await execute(shifted);
 assert.equal(run.summary.native.status,'completed');
 for(const h of results.slice(3).flatMap(v=>v.value))
  near(h.pointMm.y+(1123-h.pointMm.x)*h.incomingUnit.y/h.incomingUnit.x,-33,1e-6);
});
test('reverse illumination uses actual native lens intersections in the opposite direction',async()=>{
 const req=fresh();
 by(req,'B1').parameters.x=800;
 by(req,'B1').parameters.directionDeg=180;
 by(req,'D1').parameters.x=-300;
 by(req,'D2').parameters.x=-500;
 const {document,run,results}=await execute(req);
 assert.equal(document.schemaVersion,20);
 assert.equal(run.summary.native.status,'completed');
 assert.deepEqual(results.slice(0,3).map(v=>v.value),[8,8,8]);
 for(const h of results.slice(3).flatMap(r=>r.value))assert.ok(h.incomingUnit.x<0);
});
test('finite second lens partial miss and total miss remain native propagation, not absorption',async()=>{
 const partial=fresh();by(partial,'L2').parameters.apertureHeight=20;
 by(partial,'D1').parameters.length=300;by(partial,'D2').parameters.length=300;
 const p=await execute(partial);
 assert.equal(p.run.summary.native.status,'completed');
 assert.equal(p.results[0].value,8);
 // Neither lens is opaque: a missed second lens does not remove its ray.
 assert.equal(p.results[1].value,8);
 assert.equal(p.results[2].value,8);
 const all=p.results[3].value;
 const yAtFocus=all.map(h=>h.pointMm.y+(1000-h.pointMm.x)*h.incomingUnit.y/h.incomingUnit.x);
 assert.ok(yAtFocus.some(y=>Math.abs(y-4)>1),'mixed bypass rays must not fake a common focus');
 assert.ok(yAtFocus.some(y=>Math.abs(y-4)<1e-6),'some rays really traversed both lenses');
 const total=fresh();by(total,'L2').parameters.y=300;by(total,'D1').parameters.length=300;by(total,'D2').parameters.length=300;
 const q=await execute(total);
 assert.equal(q.run.summary.native.status,'completed');
 assert.equal(q.results[0].value,8);
 assert.equal(q.results[1].value,8);
 assert.equal(q.results[2].value,8);
});
test('v20 physical revision, existing save and units work without scope reinterpretation',async()=>{
 const d=prepared(fresh());
 const updated=reviseScene(d,{changes:[{id:'L2',section:'parameters',key:'y',value:3}]}).document;
 assert.equal(updated.schemaVersion,20);
 assert.equal(updated.physics.components.find(c=>c.id==='L2').parameters.y,3);
 assert.equal(d.physics.components.find(c=>c.id==='L2').parameters.y,2);
 const out=evaluateDocument(updated,core,fixture.requests);
 assert.equal(out.summary.native.status,'completed');
 assert.deepEqual(parseSave(serializeSave(updated)),updated);
 const cm=fresh();cm.lengthUnit='cm';
 const keys=new Set(LENGTH_PARAMETERS);
 for(const c of cm.components)for(const key of Object.keys(c.parameters))if(keys.has(key))c.parameters[key]/=10;
 assert.deepEqual(prepared(cm).physics.components,d.physics.components);
});
test('historical v19 and v4 lenses retain exact centred native compilation and reject new y field',()=>{
 const v19=JSON.parse(readFileSync(new URL('../examples/jee-parallel-lens-v19.json',import.meta.url),'utf8'));
 const old=prepared(v19.physical);
 assert.equal(old.schemaVersion,19);assert.equal(old.physics.components.find(c=>c.type==='ideal-lens').parameters.y,undefined);
 const lens=core.compile(old).native.objs.find(o=>o.type==='IdealLens');
 near(lens.p1.y,-50);near(lens.p2.y,50);
 const illegal=structuredClone(v19.physical);illegal.components.find(c=>c.type==='ideal-lens').parameters.y=0;
 assert.throws(()=>prepareScene(illegal));
 assert.deepEqual(parseSave(serializeSave(old)),old);
 const invalid=structuredClone(prepared(fresh()));
 invalid.schemaVersion=invalid.adapterVersion=19;invalid.physics.model='native-parallel-lens-tracing';
 assert.throws(()=>validate(invalid));
});
test('unsupported v20 geometry and model combinations refuse before any native execution',()=>{
 const bad=[
  ['missing explicit second centre',r=>delete by(r,'L2').parameters.y],
  ['missing explicit first centre',r=>delete by(r,'L1').parameters.y],
  ['sample at first rim',r=>by(r,'L1').parameters.apertureHeight=35],
  ['post-refraction second rim',r=>{by(r,'L2').parameters.y=0;by(r,'L2').parameters.apertureHeight=70;}],
  ['lens behind emitter',r=>by(r,'L1').parameters.x=-300],
  ['lens planes coincide',r=>by(r,'L2').parameters.x=0],
  ['lens endpoints exceed world',r=>by(r,'L2').parameters.y=9990],
  ['oblique illumination',r=>by(r,'B1').parameters.directionDeg=20],
  ['saturation',r=>by(r,'B1').parameters.brightness=.5],
  ['high-angle condition',r=>by(r,'L1').parameters.focalLength=10],
  ['detector at lens',r=>by(r,'D1').parameters.x=600],
  ['detector tip hit',r=>by(r,'D1').parameters.length=11.5],
  ['intersected detector',r=>by(r,'D1').parameters.orientationDeg=0],
  ['third lens',r=>r.components.push({id:'L3',type:'ideal-lens',parameters:{x:700,y:0,focalLength:200,apertureHeight:50}})],
  ['extra aperture',r=>r.components.push({id:'A1',type:'finite-aperture',parameters:{x:300,y:0,orientationDeg:90,length:100,openingLength:20}})],
  ['extra point-source',r=>r.components.push({id:'S2',type:'point-source',parameters:{x:-300,y:0,brightness:.08},emission:{mode:'single-ray',directionDeg:0,angleDeg:30}})]
 ];
 for(const [name,mutate] of bad){
  const req=fresh();mutate(req);
  assert.throws(()=>prepareScene(req),undefined,name);
 }
 assert.ok(inspectAuthoringRequest((()=>{const r=fresh();delete by(r,'L2').parameters.y;return r;})())
  .some(i=>i.path.endsWith('L2.y')||i.path.endsWith('.parameters.y')));
});
