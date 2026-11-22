// New bounded v18 physically authored native SphericalLens + Mirror + Aperture.
// Every ray hit/absorption comes from the unchanged pinned PhyDemo solver.
// No test computes a replacement ray path or certifies a continuous shadow.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
  assert.deepEqual(e.trace[0].outgoing,[],'Native aperture absorption creates no outgoing ray');
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

test('v18 browser provenance is append-only relative to reviewed v17 code, never a blind reevaluation',()=>{
  const p=JSON.parse(readFileSync(new URL('./fixtures/thick-lens-aperture-app-postfreeze-v1.json',import.meta.url),'utf8'));
  const bytes=readFileSync(new URL('../src/app.js',import.meta.url));
  const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  // Original reviewed v18 app blob is intentionally frozen in the existing
  // manifest. It MUST NOT be relabelled as the newer main-based UI code.
  assert.equal(p.newV18AppGitBlob,'cfbea455df3f7ea7a30002d0139730c25b235d32');
  const reconciliation=JSON.parse(readFileSync(new URL('./fixtures/native-v14-v21-app-integration-v1.json',import.meta.url),'utf8'));
  assert.equal(reconciliation.originalV18AppGitBlob,p.newV18AppGitBlob);
  assert.equal(reconciliation.originalV21IntegrationBase,'59b485d14ac28ca4ee97acc754a4cd207a7d33f1');
  assert.equal(reconciliation.mainBeforeIntegration,'487314dcb7e74e7f16f5b711f950090e16400780');
  assert.equal(reconciliation.reconciledAppGitBlob,'ac8ee9e3bf448c4280342d9049052bbbce1691b0',
   'The independently reviewed v24 integration app SHA is now historical');
  const grinFollowup=JSON.parse(readFileSync(new URL('./fixtures/grin-v25-app-integration-v1.json',import.meta.url),'utf8'));
  assert.equal(grinFollowup.sourceReviewedV24AppGitBlob,reconciliation.reconciledAppGitBlob);
  assert.equal(grinFollowup.newV25AppGitBlob,'553c71a1393be89a30f326d366a7caae388c595e');
  const fanFollowup=JSON.parse(readFileSync(new URL('./fixtures/refractive-fan-v29-app-integration.json',import.meta.url),'utf8'));
  assert.equal(fanFollowup.sourceV25AppGitBlob,grinFollowup.newV25AppGitBlob);
  assert.equal(fanFollowup.v29AppGitBlob,'40ac623ed20887ff44e353f74c3fedce315b1695');
  const curvedBeamFollowup=JSON.parse(readFileSync(new URL('./fixtures/curved-entry-beam-v30-app-integration.json',import.meta.url),'utf8'));
  assert.equal(curvedBeamFollowup.sourceV29AppGitBlob,fanFollowup.v29AppGitBlob);
  assert.equal(curvedBeamFollowup.v30AppGitBlob,'15655cc6ea8a25aea7fc0758c111841fd60bee51');
  const slabArcFollowup=JSON.parse(readFileSync(new URL('./fixtures/slab-arc-return-v31-app-integration.json',import.meta.url),'utf8'));
  assert.equal(slabArcFollowup.sourceV30AppGitBlob,curvedBeamFollowup.v30AppGitBlob);
  assert.equal(slabArcFollowup.v31AppGitBlob,'64f74f2cf8bc81ad87a8b92d03612ee0975962d2');
  const finiteCapFollowup=JSON.parse(readFileSync(new URL('./fixtures/finite-cap-v32-app-integration.json',import.meta.url),'utf8'));
  assert.equal(finiteCapFollowup.sourceV31AppGitBlob,slabArcFollowup.v31AppGitBlob);
  assert.equal(finiteCapFollowup.v32AppGitBlob,'34d9be9c483f694b1a7c0a80a7125edf645bfad5');
  const enteringGrinFollowup=JSON.parse(readFileSync(new URL('./fixtures/entering-graded-slab-v33-app-integration.json',import.meta.url),'utf8'));
  assert.equal(enteringGrinFollowup.sourceV32AppGitBlob,finiteCapFollowup.v32AppGitBlob);
  assert.equal(enteringGrinFollowup.v33AppGitBlob,'d65ed1c0a3cc34f5a7c5b83e0e4bcc8a276ac4cd');
  const immersedArcFollowup=JSON.parse(readFileSync(new URL('./fixtures/immersed-arc-port-v34-app-integration.json',import.meta.url),'utf8'));
  assert.equal(immersedArcFollowup.sourceV33AppGitBlob,enteringGrinFollowup.v33AppGitBlob);
  assert.equal(immersedArcFollowup.v34AppGitBlob,'94e5c54e8c9076856b75ac2cce7a574d9e24b3b1');
  const mirrorBoxFollowup=JSON.parse(readFileSync(new URL('./fixtures/native-mirror-box-v35-app-integration.json',import.meta.url),'utf8'));
  assert.equal(mirrorBoxFollowup.sourceV34AppGitBlob,immersedArcFollowup.v34AppGitBlob);
  assert.equal(mirrorBoxFollowup.v35AppGitBlob,'8e2d783783a5b953f58ac2264a1e0e6f7df11ce0');
  const guideFanFollowup=JSON.parse(readFileSync(new URL('./fixtures/finite-guide-fan-v36-app-integration.json',import.meta.url),'utf8'));
  assert.equal(guideFanFollowup.sourceV35AppGitBlob,mirrorBoxFollowup.v35AppGitBlob);
  const audit=JSON.parse(readFileSync(new URL('./fixtures/pre-transfer-audit-app-integration.json',import.meta.url),'utf8'));
  assert.equal(guideFanFollowup.v36AppGitBlob,audit.sourceV36AppGitBlob);
  const generalBenchFollowup=JSON.parse(readFileSync(new URL('./fixtures/native-general-bench-v37-app-integration.json',import.meta.url),'utf8'));
  assert.equal(audit.auditAppGitBlob,generalBenchFollowup.sourceAuditAppGitBlob);
  const refractiveBenchFollowup=JSON.parse(readFileSync(new URL('./fixtures/native-general-refractive-v38-app-integration.json',import.meta.url),'utf8'));
  assert.equal(generalBenchFollowup.v37AppGitBlob,refractiveBenchFollowup.sourceV37AppGitBlob);
  assert.equal(refractiveBenchFollowup.v38AppGitBlob,sha);
  assert.notEqual(sha,reconciliation.reconciledAppGitBlob,'New v25 UI is not the reviewed v24 browser code');
  assert.notEqual(sha,p.newV18AppGitBlob,'Do not claim new UI matches old reviewed v18 byte identity');
  assert.equal(p.originalV17AppGitBlob,'9d447af4c8fc59ec1e8fdcfbcec0c4d739fc477f');
  const historical=JSON.parse(readFileSync(new URL('./fixtures/two-thick-lens-mirror-app-postfreeze-v1.json',import.meta.url),'utf8'));
  assert.equal(historical.sourceBaseV16,'94ea1a184e025065fe28da49691a3f39dc916296');
});
