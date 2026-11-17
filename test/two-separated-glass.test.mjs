// R2 physical candidate: exact two-disjoint-region authoring and true native
// Glass callbacks. Public synthetic controls, not independent physics review.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,capabilities} from '../src/authoring.js';
import {validate,serializeSave,parseSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {inspectNative,transform} from './helpers/native-composition-inspection.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const request=JSON.parse(readFileSync(new URL('../examples/two-separated-glass.json',import.meta.url)));
const make=()=>structuredClone(request.physical);
const find=(r,id)=>r.components.find(c=>c.id===id);
const p=(r,id)=>find(r,id).parameters;
const near=(a,b,eps=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<eps, String(a)+' != '+String(b));
const prepare=r=>prepareScene(r).document;
const run=(d,requests=[])=>evaluateDocument(d,core,requests).summary;
const expected=(doc)=>doc.physics.components.filter(c=>c.type==='polygon-dielectric').map(c=>c.id).sort();
test('Two separate polygon regions use new v14 model, original native Glass and per-ID observables',async()=>{
 const input=make(),before=JSON.stringify(input),prepared=prepareScene(input),doc=prepared.document;
 assert.equal(doc.schemaVersion,14);assert.equal(doc.adapterVersion,14);
 assert.equal(doc.physics.model,'two-separated-dielectrics-tracing');
 assert.deepEqual(expected(doc),['G1','G2']);
 assert.deepEqual(doc.physics.components.map(c=>c.id),input.components.map(c=>c.id));
 assert.equal(JSON.stringify(input),before,'No source values repaired');
 assert.equal(core.compile(doc).native.objs.filter(x=>x.type==='Glass').length,2);
 assert.deepEqual(parseSave(serializeSave(doc)),doc);
 const evidence=evaluateDocument(doc,core,request.requests),summary=evidence.summary;
 assert.equal(summary.native.status,'completed');
 assert.equal(summary.executionPassed,true);
 assert.equal(summary.native.truncation,0);
 assert.equal(summary.observations.interfacesById.G1.interactions,2);
 assert.equal(summary.observations.interfacesById.G2.interactions,2);
 assert.equal(summary.observations.detectorsById.D1.crossings,1);
 const r=(await evaluateObservables(doc,request.requests,summary)).results;
 assert.deepEqual(r.map(x=>x.status),['qualified','qualified','qualified','qualified','qualified']);
 assert.deepEqual(r.slice(0,2).map(x=>x.value),[2,2]);
 assert.equal(r.at(-1).value,1);
 // Explicit Fresnel-off approximation is qualified (not a full Fresnel model).
 for(const [id,n] of [['G1',1.5],['G2',1.3]]){
  const first=summary.observations.interfacesById[id].first;
  near(first.incidentIndex,1);near(first.destinationIndex,n);
  near(Math.sin(first.incidentAngleDeg*Math.PI/180),
    n*Math.sin(first.transmittedAngleDeg*Math.PI/180),1e-9);
  assert.equal(first.partialReflection,false);
 }
 const checked=inspectNative(doc);
 assert.deepEqual(checked.trace.filter(x=>x.type==='polygon-dielectric').map(x=>x.id),
  ['G1','G1','G2','G2']);
 assert.equal(JSON.stringify(input),before);
});
test('Two glass elements independently record native events under rotation, scale, order and index changes',()=>{
 let trials=0;
 for(const rotation of [0,37,-90])for(const scale of [.5,1,2])
 for(const [a,b] of [[1.5,1.3],[1.3,1.5],[2,1.5]]){
  const r=make();p(r,'G1').insideIndex=a;p(r,'G2').insideIndex=b;
  transform(r,rotation,scale,100,-75);const d=prepare(r);
  const x=inspectNative(d);const obs=x.diagnostic.interfacesById;
  assert.equal(obs.G1.interactions,2);
  assert.equal(obs.G2.interactions,2);
  assert.equal(x.diagnostic.detectorsById.D1.crossings,1);
  assert.equal(x.trace.filter(t=>t.type==='polygon-dielectric').length,4);trials++;
 }
 assert.equal(trials,27);
 const r=make();r.components.reverse();const d=prepare(r);
 assert.deepEqual(Object.keys(run(d).observations.interfacesById).sort(),['G1','G2']);
 assert.equal(run(d).observations.detectorsById.D1.crossings,1);
});
test('Native first and second region misses are genuine outcomes, never prescribed routes',()=>{
 for(const [dir,g1,g2,hit] of [[0,2,2,1],[80,0,0,0]]){
  const r=make();find(r,'S1').emission.directionDeg=dir;const x=run(prepare(r));
  assert.equal(x.native.status,'completed');
  assert.equal(x.observations.interfacesById.G1.interactions,g1);
  assert.equal(x.observations.interfacesById.G2.interactions,g2);
  assert.equal(x.observations.detectorsById.D1.crossings,hit);
 }
 const r=make();r.components.push({id:'S2',type:'point-source',parameters:{x:-200,y:-10,brightness:.5},
  emission:{mode:'single-ray',directionDeg:0}});
 const x=run(prepare(r));
 assert.equal(x.native.status,'completed');assert.equal(x.observations.emissionsById.S2.emitted,1);
 assert.equal(x.observations.interfacesById.G1.interactions,4);
 assert.equal(x.observations.interfacesById.G2.interactions,4);
});
test('Shared exterior and convex disjoint geometry are strict, not inferred from position labels',()=>{
 const b=make();
 const rejected=[
  r=>p(r,'G2').outsideIndex=1.1,
  r=>{for(const i of [1,2,3,4])p(r,'G2')['x'+i]-=150;}, // overlapping x50..200
  r=>{for(const i of [1,2,3,4])p(r,'G2')['x'+i]-=50;}, // exact edge touching
  r=>{for(const i of [1,2,3,4])p(r,'G2')['x'+i]-=49.995;}, // 0.005 mm
  r=>{Object.assign(p(r,'G2'),{x1:10,x2:10,x3:20,x4:20,y1:-10,y2:10,y3:10,y4:-10});}, // nested inside first
  r=>{p(r,'G2').x3=p(r,'G2').x1;}, // zero/concave
  r=>{p(r,'G2').y2=p(r,'G2').y1;}, // repeated
  r=>{p(r,'S1').x=200;p(r,'S1').y=0;}, // source on G2 face
  r=>{Object.assign(p(r,'D1'),{x:220,y:0});}, // detector inside G2
  r=>{find(r,'S1').emission.mode='directional';}, // unsupported ray cone
  r=>r.components.push({...structuredClone(find(r,'G2')),id:'G3'}),
  r=>r.components.push({id:'M',type:'plane-mirror',parameters:{x:400,y:0,orientationDeg:90,length:80}}),
  r=>r.components.push({id:'B',type:'line-blocker',parameters:{x:400,y:0,orientationDeg:90,length:80}}),
  r=>r.components.splice(r.components.findIndex(c=>c.id==='G2'),1)
 ];
 for(const [i,edit] of rejected.entries()){
  const r=structuredClone(b);edit(r);
  assert.throws(()=>prepare(r),null,'Invalid two-region input '+i+' must not run natively');
 }
 const almost=make();for(const i of [1,2,3,4])p(almost,'G2')['x'+i]-=49.989;
 assert.equal(prepare(almost).schemaVersion,14,'11 micrometres face separation is admitted');
});
test('Historical single-region, blocker and prism-family contracts are not silently broadened',()=>{
 const doc=prepare(make());
 for(const v of [4,7,8,9,10,11,12,13]){
  const old=structuredClone(doc);old.schemaVersion=old.adapterVersion=v;
  assert.throws(()=>validate(old),'An old schema must not accept two regions');
 }
 const old=JSON.parse(readFileSync(new URL('../scenes/polygon-dielectric.json',import.meta.url)));
 assert.equal(old.schemaVersion,9);
 const second=structuredClone(doc.physics.components.find(c=>c.id==='G2'));
 assert.throws(()=>reviseComponents(old,{format:'opticsim-component-revision-v1',
  operations:[{op:'add',lengthUnit:'mm',component:second}]}));
 const catalog=capabilities().composition.profiles;
 assert.ok(catalog.some(x=>x.model==='two-separated-dielectrics-tracing'&&x.schemaVersion===14));
});
test('Qualified existing physical revisions and exports preserve source assumptions and expire old native results',async()=>{
 const before=prepare(make()),native=run(before,request.requests);
 assert.equal(native.executionPassed,true);
 const qualification=initialQualification(before,null,{inputSha256:'a'.repeat(64)});
 const baseline=await createQualifiedBundle(before,qualification,request.requests);
 const change={changes:[{id:'G2',section:'parameters',key:'insideIndex',value:1.4}]};
 const altered=reviseScene(before,change).document;
 const q=recordQualifiedEdit(before,altered,qualification);
 const child=await parseQualifiedBundle(JSON.stringify(await createQualifiedBundle(altered,q,request.requests)));
 assert.deepEqual(child.qualification.origin,baseline.qualification.origin);
 assert.equal(child.scene.physics.components.find(c=>c.id==='G1').parameters.insideIndex,1.5);
 assert.equal(child.scene.physics.components.find(c=>c.id==='G2').parameters.insideIndex,1.4);
 const stale=await evaluateObservables(altered,request.requests,native);
 assert.ok(stale.results.every(x=>x.status==='suppressed'&&x.value===null));
 const current=run(child.scene,child.observables);
 assert.equal(current.native.status,'completed');
 assert.equal((await evaluateObservables(child.scene,child.observables,current)).results.length,5);
 const overlap=reviseScene.bind(null,before,{changes:[{id:'G2',section:'parameters',key:'x1',value:100}]});
 assert.throws(overlap,'Crossing one region into the other must reject the atomic edit');
 assert.deepEqual(baseline.scene,before);
});
test('Native incompleteness and unavailable route-independent image remain explicit',async()=>{
 const doc=prepare(make()),small=structuredClone(doc);
 small.simulation.maxRayDepth=2;validate(small);
 const sample=run(small,request.requests);
 assert.equal(sample.native.status,'incomplete');
 const observed=await evaluateObservables(small,request.requests,sample);
 assert.ok(observed.results.every(r=>r.status==='suppressed'&&r.value===null));
 const image=await evaluateObservables(doc,[{id:'image',kind:'ideal-image',componentId:'S1'}],run(doc));
 assert.equal(image.results[0].status,'unavailable');
 assert.equal(image.results[0].value,null);
});
