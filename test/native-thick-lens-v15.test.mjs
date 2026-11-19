// Proposed v15: physical thick-lens contract backed entirely by the exact
// pinned SphericalLens. Synthetic apparatus only, not original-question proof.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,capabilities} from '../src/authoring.js';
import {validate,serializeSave,parseSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {inspectNative} from './helpers/native-composition-inspection.mjs';
import {thickLensGeometry} from '../src/spherical-lens.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-train.json',import.meta.url),'utf8'));
const make=()=>structuredClone(fixture.physical);
const component=(r,id)=>r.components.find(x=>x.id===id);
const param=(r,id)=>component(r,id).parameters;
const prepare=r=>prepareScene(r).document;
const run=(doc,requests=fixture.requests)=>evaluateDocument(doc,core,requests).summary;
const close=(x,y,t=1e-7)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<t,`${x} != ${y}`);

test('v15 uses two actual pinned native SphericalLens objects with four observed curved faces',async()=>{
 const r=make(),original=JSON.stringify(r),doc=prepare(r);
 assert.equal(doc.schemaVersion,15);
 assert.equal(doc.adapterVersion,15);
 assert.equal(doc.physics.model,'native-thick-lens-tracing');
 assert.equal(JSON.stringify(r),original,'No physical input repaired');
 assert.deepEqual(core.compile(doc).native.objs.filter(o=>o.type==='SphericalLens').map(o=>o.params),
  [{d:30,r1:100,r2:-100},{d:30,r1:100,r2:-100}]);
 assert.deepEqual(parseSave(serializeSave(doc)),doc);
 const native=inspectNative(doc);
 const hits=native.trace.filter(x=>x.type==='spherical-lens');
 assert.deepEqual(hits.map(x=>x.id),['L1','L1','L2','L2']);
 for(const [i,x] of hits.entries()){
  close(x.point.x,[-14.49874371066197,14.591776274279326,135.0329852193489,164.89432443050868][i],1e-6);
  assert.equal(x.outgoing.length,1,'Fresnel-off emits one native outgoing branch');
 }
 const obs=native.diagnostic.interfacesById;
 for(const id of ['L1','L2']){
  assert.equal(obs[id].interactions,2);
  assert.equal(obs[id].faces['front-arc'].interactions,1);
  assert.equal(obs[id].faces['back-arc'].interactions,1);
  assert.equal(obs[id].faces['top-rim'].interactions,0);
  assert.equal(obs[id].faces['bottom-rim'].interactions,0);
  const e=obs[id].first;
  assert.equal(e.faceId,'front-arc');
  assert.equal(e.outcome,'transmission');
  assert.equal(e.from,'outside');
  assert.equal(e.partialReflection,false);
  close(e.incidentIndex,1);
  const n=param(r,id).insideIndex;
  close(e.destinationIndex,n);
  close(Math.sin(e.incidentAngleDeg*Math.PI/180),
   n*Math.sin(e.transmittedAngleDeg*Math.PI/180),1e-8);
 }
 assert.equal(native.diagnostic.detectorsById.D1.crossings,1);
 const summary=run(doc),result=await evaluateObservables(doc,fixture.requests,summary);
 assert.equal(summary.native.status,'completed');
 assert.equal(summary.executionPassed,true);
 assert.deepEqual(result.results.map(x=>x.status),Array(5).fill('qualified'));
 assert.deepEqual(result.results.slice(0,2).map(x=>x.value),[2,2]);
 assert.equal(result.results.at(-1).value,1);
 assert.ok(result.results.every(x=>x.warnings.some(w=>w.includes('approximation'))));
 console.log('V15_NATIVE_THICK_LENSES '+JSON.stringify({status:summary.native.status,
  faceIds:hits.map(x=>x.id),points:hits.map(x=>x.point),
  events:Object.fromEntries(['L1','L2'].map(id=>[id,obs[id].first])),
  detectorCrossings:native.diagnostic.detectorsById.D1.crossings}));
});
test('One native thick lens, reverse native ordering and genuine high-aperture misses',()=>{
 const single=make();single.components=single.components.filter(c=>c.id!=='L2');
 const d=prepare(single),e=inspectNative(d);
 assert.equal(d.schemaVersion,15);
 assert.deepEqual(e.trace.filter(x=>x.type==='spherical-lens').map(x=>x.id),['L1','L1']);
 const backwards=make();backwards.components.reverse();
 const r=inspectNative(prepare(backwards));
 assert.deepEqual(r.trace.filter(x=>x.type==='spherical-lens').map(x=>x.id),['L1','L1','L2','L2']);
 assert.equal(r.diagnostic.detectorsById.D1.crossings,1);
 const missed=make();param(missed,'S1').y=80;
 const out=run(prepare(missed));
 assert.equal(out.native.status,'completed');
 assert.equal(out.observations.interfacesById.L1.interactions,0);
 assert.equal(out.observations.interfacesById.L2.interactions,0);
 assert.equal(out.observations.detectorsById.D1.crossings,1);
});
test('Explicit shared non-air background retains native Snell ratios at both thick lenses',()=>{
 const r=make();
 param(r,'L1').outsideIndex=1.2;param(r,'L2').outsideIndex=1.2;
 const d=prepare(r),x=inspectNative(d),a=x.diagnostic.interfacesById;
 for(const [id,n] of [['L1',1.5],['L2',1.3]]){
  const e=a[id].first;
  close(e.incidentIndex,1.2);close(e.destinationIndex,n);
  close(1.2*Math.sin(e.incidentAngleDeg*Math.PI/180),
    n*Math.sin(e.transmittedAngleDeg*Math.PI/180),1e-8);
 }
 assert.equal(x.diagnostic.detectorsById.D1.crossings,1);
});
test('Strict biconvex geometry, nonoverlap, source/rim clearance and legacy isolation',()=>{
 const b=make();
 const edits=[
  r=>param(r,'L2').outsideIndex=1.1,
  r=>param(r,'L1').frontRadius=50,
  r=>param(r,'L1').backRadius=50,
  r=>param(r,'L1').centerThickness=20,
  r=>param(r,'L1').apertureHeight=1,
  r=>param(r,'L2').x=25,
  r=>param(r,'L2').x=30,
  r=>param(r,'L1').x=9995,
  r=>param(r,'S1').x=0,
  r=>{param(r,'S1').y=50;component(r,'S1').emission.directionDeg=0;},
  r=>param(r,'D1').x=0,
  r=>component(r,'S1').emission.mode='directional',
  r=>r.components.push({...structuredClone(component(r,'L2')),id:'L3',parameters:{...param(r,'L2'),x:300}}),
 ];
 for(const [i,change] of edits.entries()){
  const r=structuredClone(b);change(r);
  assert.throws(()=>prepare(r),null,'Invalid v15 authoring case '+i+' must be refused');
 }
 // New physical requests can deliberately select the *new* v17 profile,
 // but an already-saved v15 model cannot acquire a mirror by mutation.
 const withMirror=structuredClone(b);
 withMirror.components.push({id:'M1',type:'plane-mirror',
  parameters:{x:300,y:0,orientationDeg:90,length:100}});
 assert.equal(prepare(withMirror).schemaVersion,17);
 const historical=prepare(b),forged=structuredClone(historical);
 forged.physics.components.push(structuredClone(withMirror.components.at(-1)));
 assert.throws(()=>validate(forged),
  'An existing v15 document cannot admit a plane mirror without explicit new authoring');
 const g=thickLensGeometry(param(b,'L1'));
 assert.ok(g.edgeThickness>1);
 close(g.left,-15);close(g.right,15);
 const doc=prepare(b);
 for(const version of [4,7,8,9,10,11,12,13,14]){
  const old=structuredClone(doc);old.schemaVersion=old.adapterVersion=version;
  assert.throws(()=>validate(old),'Old versions never admit a native thick lens '+version);
 }
 const saved=JSON.parse(readFileSync(new URL('../scenes/polygon-dielectric.json',import.meta.url),'utf8'));
 const attempted=structuredClone(component(b,'L1'));
 assert.throws(()=>reviseComponents(saved,{format:'opticsim-component-revision-v1',
  operations:[{op:'add',lengthUnit:'mm',component:attempted}]}));
 assert.ok(capabilities().composition.profiles.some(p=>p.schemaVersion===15));
});
test('Edits and exports retain lens identities, expire prior native results and keep unavailable images unavailable',async()=>{
 const old=prepare(make()),req=fixture.requests,evidence=run(old,req);
 const changed=reviseScene(old,{changes:[{id:'L2',section:'parameters',key:'backRadius',value:125}]}).document;
 assert.equal(changed.physics.components.find(c=>c.id==='L1').parameters.backRadius,100);
 assert.equal(changed.physics.components.find(c=>c.id==='L2').parameters.backRadius,125);
 const stale=await evaluateObservables(changed,req,evidence);
 assert.ok(stale.results.every(x=>x.status==='suppressed'&&x.value===null));
 const current=run(changed,req);
 assert.equal(current.native.status,'completed');
 assert.deepEqual((await evaluateObservables(changed,req,current)).results.map(x=>x.status),Array(5).fill('qualified'));
 const q=initialQualification(old,null,{inputSha256:'b'.repeat(64)});
 const result=recordQualifiedEdit(old,changed,q);
 const child=await parseQualifiedBundle(JSON.stringify(await createQualifiedBundle(changed,result,req)));
 assert.deepEqual(child.scene,changed);
 assert.equal(child.scene.physics.components.find(c=>c.id==='L2').id,'L2');
 const bad=reviseScene.bind(null,old,{changes:[{id:'L2',section:'parameters',key:'x',value:25}]});
 assert.throws(bad,'Overlapping lens edit refuses atomically');
 const request=[{id:'image',kind:'ideal-image',componentId:'S1'}];
 const image=(await evaluateObservables(old,request,run(old))).results[0];
 assert.equal(image.status,'unavailable');assert.equal(image.value,null);
});
test('Native depth-incomplete or truncated runs never qualify requested thick-lens measurements',async()=>{
 const doc=prepare(make()),small=structuredClone(doc);
 small.simulation.maxRayDepth=2;validate(small);
 const sum=run(small,fixture.requests);
 assert.equal(sum.native.status,'incomplete');
 assert.equal(sum.executionPassed,false);
 const out=await evaluateObservables(small,fixture.requests,sum);
 assert.ok(out.results.every(x=>x.status==='suppressed'&&x.value===null));
 const full=structuredClone(doc);
 for(const lens of full.physics.components.filter(c=>c.type==='spherical-lens'))lens.parameters.partialReflection=true;
 const fresnel=run(full,fixture.requests);
 assert.ok(['completed','completed-with-warnings','incomplete'].includes(fresnel.native.status));
 const measured=await evaluateObservables(full,fixture.requests,fresnel);
 if(fresnel.native.status==='incomplete')
  assert.ok(measured.results.every(x=>x.status==='suppressed'&&x.value===null));
 else assert.equal(fresnel.executionPassed,true);
 console.log('V15_NATIVE_FRESNEL_GATING '+JSON.stringify({status:fresnel.native.status,
  truncation:fresnel.native.truncation,requested:measured.results.map(x=>x.status)}));
});
