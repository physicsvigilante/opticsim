// New bounded v18 physically authored native SphericalLens + Mirror + Aperture.
// Every ray hit/absorption comes from the unchanged pinned PhyDemo solver.
// No test computes a replacement ray path or certifies a continuous shadow.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,capabilities} from '../src/authoring.js';
import {validate,parseSave,serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {inspectNative} from './helpers/native-composition-inspection.mjs';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {THICK_APERTURE_MODEL,THICK_APERTURE_VERSION,THICK_APERTURE_NATIVE_DEPTH} from '../src/thick-lens-aperture-composition.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-thick-lens-aperture-v18.json',import.meta.url),'utf8'));
const make=()=>structuredClone(fixture.physical);
const cmp=(r,id)=>r.components.find(x=>x.id===id);
const param=(r,id)=>cmp(r,id).parameters;
const prepare=r=>prepareScene(r).document;
const execute=(doc,requests=fixture.requests)=>evaluateDocument(doc,core,requests);
const near=(x,y,t=1e-7)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=t,`${x} != ${y}`);
const eventIds=e=>e.trace.map(x=>x.id);

test('v18 is a distinct saved authoring profile with a real native Aperture and unchanged v17 prerequisite',()=>{
  const request=make(),snapshot=JSON.stringify(request),p=prepareScene(request),doc=p.document;
  assert.equal(JSON.stringify(request),snapshot,'No physical inputs silently repaired');
  assert.equal(doc.schemaVersion,THICK_APERTURE_VERSION);
  assert.equal(doc.adapterVersion,18);
  assert.equal(doc.physics.model,THICK_APERTURE_MODEL);
  assert.equal(p.preparation.runPolicy,'native-deep-v18');
  assert.equal(doc.simulation.maxRayDepth,THICK_APERTURE_NATIVE_DEPTH);
  assert.equal(doc.simulation.processedRayLimit,10000);
  assert.deepEqual(core.compile(doc).native.objs.map(x=>x.type),
    ['SingleRay','SphericalLens','SphericalLens','Mirror','Detector','Aperture']);
  assert.deepEqual(parseSave(serializeSave(doc)),doc);
  assert.equal(capabilities().nativeThickLensAperture.schemaVersion,18);
  assert.ok(capabilities().composition.profiles.some(x=>x.schemaVersion===18));
  const forged=structuredClone(doc);forged.schemaVersion=forged.adapterVersion=17;
  forged.physics.model='native-two-thick-lens-mirror-tracing';
  assert.throws(()=>validate(forged),'Old v17 contract must not acquire a stop');
});

test('actual native on-axis open gap passes both lenses and finite mirror return',async()=>{
  const doc=prepare(make()),e=inspectNative(doc),s=execute(doc).summary;
  const ids=['D1','L1','L1','L2','L2','M1','L2','L2','L1','L1','D1'];
  assert.equal(s.native.status,'completed');
  assert.equal(s.executionPassed,true);
  assert.deepEqual(eventIds(e),ids);
  assert.equal(e.trace.some(x=>x.id==='A1'),false,'Transparent gap is not a hit');
  assert.equal(e.diagnostic.interfacesById.L1.interactions,4);
  assert.equal(e.diagnostic.interfacesById.L2.interactions,4);
  assert.equal(e.diagnostic.reflectionsById.M1,1);
  assert.equal(e.diagnostic.detectorsById.D1.crossings,2);
  assert.equal(s.observations.blockersById.A1.absorptions,0);
  assert.equal(s.observations.blockersById.A1.invalidObservations,0);
  assert.equal(s.native.truncation,0);
  assert.equal(s.native.undefinedBehavior,0);
  const values=await evaluateObservables(doc,fixture.requests,s);
  assert.ok(values.results.every(x=>x.status==='qualified'));
  assert.deepEqual(values.results.map(x=>typeof x.value==='number'?x.value:null),
    [4,4,null,null,1,2,0]);
  assert.ok(values.results.every(x=>x.warnings.some(w=>/approximation/i.test(w))));
  console.log('V18_NATIVE_APERTURE_TRANSPARENT '+JSON.stringify({nativeStatus:s.native.status,
    ids,absorbed:0,detectorCrossings:2}));
});

test('moving only the native opening blocks the source before any glass/mirror/detector',async()=>{
  const r=make();param(r,'A1').y=30;
  const doc=prepare(r),e=inspectNative(doc),s=execute(doc).summary;
  assert.equal(s.native.status,'completed');
  assert.deepEqual(eventIds(e),['A1']);
  assert.equal(e.trace[0].absorbed,true);
  near(e.trace[0].point.x,-150);near(e.trace[0].point.y,0);
  assert.equal(s.observations.blockersById.A1.absorptions,1);
  assert.equal(s.observations.blockersById.A1.invalidObservations,0);
  assert.equal(s.observations.emissionsById.S1.emitted,1);
  assert.equal(s.observations.interfacesById.L1.interactions,0);
  assert.equal(s.observations.interfacesById.L2.interactions,0);
  assert.equal(s.observations.reflectionsById.M1,0);
  assert.equal(s.observations.detectorsById.D1.crossings,0);
  assert.equal(s.native.truncation,0);
  assert.equal(s.native.undefinedBehavior,0);
  const values=await evaluateObservables(doc,fixture.requests,s);
  assert.ok(values.results.every(x=>x.status==='qualified'));
  assert.equal(values.results.at(-1).value,1);
  console.log('V18_NATIVE_APERTURE_ABSORPTION '+JSON.stringify({status:s.native.status,
    events:e.trace,absorptions:1,lensHits:0,mirrorHits:0,detectorHits:0}));
});

test('gap is an independent stop: native glass-first, missed ray, reversed orientation and two-source mixed stop',()=>{
  const between=make();param(between,'A1').x=75;
  const e=inspectNative(prepare(between));
  assert.equal(e.trace.some(v=>v.id==='A1'),false);
  assert.deepEqual(eventIds(e),['D1','L1','L1','L2','L2','M1','L2','L2','L1','L1','D1']);
  const reverse=make();param(reverse,'A1').orientationDeg=-90;
  assert.deepEqual(eventIds(inspectNative(prepare(reverse))),eventIds(inspectNative(prepare(make()))));
  const miss=make();cmp(miss,'S1').emission.directionDeg=80;
  const lost=execute(prepare(miss)).summary;
  assert.equal(lost.native.status,'completed');
  assert.equal(lost.observations.blockersById.A1.absorptions,0);
  assert.equal(lost.observations.detectorsById.D1.crossings,0);
  const two=make(),other=structuredClone(cmp(two,'S1'));other.id='S2';other.parameters.y=30;
  two.components.push(other);
  const sample=execute(prepare(two)).summary;
  assert.equal(sample.native.status,'completed');
  assert.equal(sample.observations.emissionsById.S1.emitted,1);
  assert.equal(sample.observations.emissionsById.S2.emitted,1);
  assert.equal(sample.observations.blockersById.A1.absorptions,1);
  assert.equal(sample.observations.interfacesById.L1.interactions,4);
  assert.equal(sample.observations.interfacesById.L2.interactions,4);
  assert.equal(sample.observations.reflectionsById.M1,1);
  assert.equal(sample.observations.detectorsById.D1.crossings,2);
});

test('new v18 whole-system refusals do not loosen older model scope or invent a source route',()=>{
  const source=make();
  const bad=[
    r=>param(r,'A1').orientationDeg=45,
    r=>param(r,'A1').orientationDeg=89.99,
    r=>param(r,'A1').x=-15.005, // glass x envelope begins at -15
    r=>param(r,'A1').x=0,       // even if y is far away
    r=>{param(r,'A1').x=0;param(r,'A1').y=500;},
    r=>param(r,'A1').x=135.005, // second lens begins at x=135
    r=>{param(r,'M1').x=-150.005;param(r,'M1').y=500;param(r,'M1').length=20;},
    r=>{param(r,'D1').x=-150.005;param(r,'D1').y=500;param(r,'D1').length=20;},
    r=>param(r,'S1').x=-150.005,
    r=>param(r,'S1').y=10, // exactly at the transparent-gap boundary
    r=>cmp(r,'S1').emission.directionDeg=90, // nearly tangent to stop
    r=>{param(r,'A1').y=9990;},
    r=>{param(r,'A1').openingLength=99;},
    r=>{param(r,'A1').openingLength=0;},
    r=>r.components.push({...structuredClone(cmp(r,'A1')),id:'A2'}),
    r=>r.components.push({...structuredClone(cmp(r,'L2')),id:'L3',parameters:{...param(r,'L2'),x:400}}),
    r=>r.components.push({id:'B1',type:'line-blocker',parameters:{x:50,y:80,orientationDeg:0,length:20}}),
    r=>param(r,'L2').outsideIndex=1.2,
    r=>{param(r,'L2').x=25;},
    r=>{param(r,'M1').x=150;},
    r=>{cmp(r,'S1').emission.mode='directional';cmp(r,'S1').emission.angleDeg=20;}
  ];
  for(const [i,edit] of bad.entries()){
    const r=structuredClone(source);edit(r);
    assert.throws(()=>prepare(r),undefined,'Unsupported physical arrangement #'+i);
  }
  // A demonstrably separated but close aperture is admitted as geometry
  // alone; no assertion that close-boundary native rays are always complete.
  const nearby=make();param(nearby,'A1').x=-15.011;
  assert.equal(prepare(nearby).schemaVersion,18);
  const out=make();out.components=out.components.filter(c=>c.id!=='A1');
  assert.throws(()=>prepare(out),'Deep v18 policy is non-transferable to v17');
  out.runPolicy='native-deep-v17';
  assert.equal(prepare(out).schemaVersion,17);
  const legacy=structuredClone(prepare(out));legacy.physics.components.push({
    id:'A1',type:'finite-aperture',parameters:{x:-150,y:0,orientationDeg:90,length:100,openingLength:20}
  });
  assert.throws(()=>validate(legacy),'Old v17 saved model cannot gain the aperture');
  const to17=make();to17.runPolicy='native-deep-v17';
  assert.throws(()=>prepare(to17),'Deep v17 policy is non-transferable to v18');
  const to15=structuredClone(source);to15.components=to15.components.filter(c=>c.id!=='M1'&&c.id!=='A1');
  assert.throws(()=>prepare(to15));
  assert.throws(()=>reviseComponents(prepare(make()),{
    format:'opticsim-component-revision-v1',operations:[{op:'remove',id:'A1'}]
  }),'Removing the aperture cannot silently downgrade the saved v18 model');
});

test('v18 preview depth 8 is incomplete and full Fresnel does not silently qualify',async()=>{
  const shallow=make();shallow.runPolicy='preview-v1';
  const d=prepare(shallow),s=execute(d).summary;
  assert.equal(d.simulation.maxRayDepth,8);
  assert.equal(s.native.status,'incomplete');assert.ok(s.native.truncation>0);
  assert.equal(s.executionPassed,false);
  const values=await evaluateObservables(d,fixture.requests,s);
  assert.ok(values.results.every(v=>v.status==='suppressed'&&v.value===null));
  const fresnel=make();for(const id of ['L1','L2'])param(fresnel,id).partialReflection=true;
  const f=prepare(fresnel),result=execute(f).summary;
  assert.equal(result.native.status,'incomplete');
  assert.ok(result.native.truncation>0||result.native.undefinedBehavior>0);
  const refused=await evaluateObservables(f,fixture.requests,result);
  assert.ok(refused.results.every(v=>v.status==='suppressed'&&v.value===null));
  const old=make();old.components=old.components.filter(c=>c.id!=='A1');old.runPolicy='native-deep-v17';
  const oldDoc=prepare(old);oldDoc.simulation.maxRayDepth=17;
  assert.throws(()=>validate(oldDoc),'v17 still refuses depth >16');
  const older=structuredClone(oldDoc);older.schemaVersion=older.adapterVersion=16;
  older.physics.model='native-thick-lens-mirror-tracing';older.simulation.maxRayDepth=9;
  assert.throws(()=>validate(older),'v16 still refuses depth >8');
});

test('v18 qualified edits protect physical identity and stale measurements',async()=>{
  const original=prepare(make()),s=execute(original).summary;
  const edited=reviseScene(original,{changes:[{id:'A1',section:'parameters',key:'y',value:30}]}).document;
  const stale=await evaluateObservables(edited,fixture.requests,s);
  assert.ok(stale.results.every(v=>v.status==='suppressed'&&v.value===null));
  const fresh=execute(edited).summary;
  assert.equal(fresh.observations.blockersById.A1.absorptions,1);
  const q=initialQualification(original,null,{inputSha256:'e'.repeat(64)});
  const child=recordQualifiedEdit(original,edited,q);
  const bundle=await createQualifiedBundle(edited,child,fixture.requests);
  const reopened=await parseQualifiedBundle(JSON.stringify(bundle));
  assert.deepEqual(reopened.scene,edited);
  assert.equal(reopened.scene.simulation.maxRayDepth,16);
  assert.equal(reopened.scene.physics.components.find(c=>c.id==='A1').parameters.y,30);
  assert.equal(reopened.results,undefined);
  assert.throws(()=>reviseScene(original,{changes:[{id:'A1',section:'parameters',key:'x',value:0}]}));
});
