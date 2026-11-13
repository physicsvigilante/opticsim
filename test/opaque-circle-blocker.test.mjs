import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,capabilities,inspectAuthoringRequest} from '../src/authoring.js';
import {validate,parseSave,serializeSave,setParameter} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables,observableCapabilities} from '../src/observables.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {apparatusPoints,fitRequestedView} from '../src/result-preview.js';
import {planProblem} from '../src/problem-workflow.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/circle-blocker-detector.json',import.meta.url)));
const request=()=>structuredClone(fixture.physical);
const stop=r=>r.components.find(c=>c.type==='circle-blocker').parameters;
const build=(edit=()=>{})=>{const r=request();edit(r);return prepareScene(r).document;};
const run=doc=>evaluateDocument(doc,core).summary;
const observe=(doc,s)=>evaluateObservables(doc,fixture.requests,s);

test('native CircleBlocker is compiled as an opaque positive-radius disk without changing the model or schema',()=>{
 const input=request(),bytes=JSON.stringify(input),doc=build(),compiled=core.compile(doc);
 assert.equal(doc.schemaVersion,4);assert.equal(doc.physics.model,'general-component-tracing');
 assert.equal(capabilities().maxComponents,16);
 assert.equal(capabilities().componentTypes['circle-blocker'].nativeType,'CircleBlocker');
 assert.equal(capabilities().opaqueCircularBlockers.combinedStopMax,2);
 assert.deepEqual(compiled.native.objs[compiled.idMap.get('B1')],{
  type:'CircleBlocker',p1:{x:0,y:0},p2:{x:40,y:0},filter:false});
 const loaded=core.loadNative(JSON.parse(core.nativeExport(doc)));
 assert.equal(loaded.objs[compiled.idMap.get('B1')].constructor.type,'CircleBlocker');
 assert.deepEqual(parseSave(serializeSave(doc)),doc);assert.equal(JSON.stringify(input),bytes);
});

test('six preview rays hit the native circular absorber; no downstream rays cross',async()=>{
 const doc=build(),s=run(doc),o=await observe(doc,s);
 assert.equal(s.native.status,'completed');assert.equal(s.native.emitted,6);
 assert.deepEqual(s.observations.blockersById.B1,{absorptions:6,invalidObservations:0});
 assert.equal(s.observations.detectorsById.D1.crossings,0);
 assert.deepEqual(o.results.map(x=>x.value),[6,6,0,0]);
 assert.equal(o.results[0].status,'available');
 assert.equal(o.results[0].method,'native-observation');
 assert.equal(o.questionSupport,'not-assessed-by-engine');
 assert.deepEqual(observableCapabilities().kinds['blocker-absorptions'].type,['line-blocker','circle-blocker']);
});

test('translated circular stop clears the source cone; a no-stop native run is an independent reference',async()=>{
 const doc=build(r=>stop(r).y=100),clear=run(doc),o=await observe(doc,clear);
 const free=structuredClone(doc);free.physics.components=free.physics.components.filter(c=>c.type!=='circle-blocker');
 const reference=run(free);
 assert.equal(clear.native.status,'completed');assert.equal(reference.native.status,'completed');
 assert.deepEqual(o.results.slice(0,3).map(x=>x.value),[0,6,4]);
 assert.equal(clear.observations.detectorsById.D1.crossings,reference.observations.detectorsById.D1.crossings);
 assert.equal(clear.native.emitted,reference.native.emitted);
 assert.equal(o.results[3].unit,'relative native units; not watts');
});

test('smaller radius produces native partial absorption, while dense sampling changes sampled counts',async()=>{
 const partial=run(build(r=>stop(r).radius=10));
 assert.equal(partial.native.status,'completed');
 assert.ok(partial.observations.blockersById.B1.absorptions>0);
 assert.ok(partial.observations.blockersById.B1.absorptions<partial.native.emitted);
 const dense=run(build(r=>r.runPolicy='dense-v1'));
 assert.equal(dense.native.status,'completed');
 assert.equal(dense.native.emitted,28);
 assert.equal(dense.observations.blockersById.B1.absorptions,dense.native.emitted);
 assert.match(capabilities().opaqueCircularBlockers.scope,/not continuous shadow/);
});

test('both native blocker shapes share the exact same stable-ID meter and combined two-stop limit',()=>{
 const doc=build(r=>{
  stop(r).y=100;stop(r).radius=30;
  r.components.push({id:'L1',type:'line-blocker',parameters:{x:0,y:0,orientationDeg:90,length:80}});
 });
 const compiled=core.compile(doc),s=run(doc);
 assert.equal(compiled.native.objs.filter(o=>['Blocker','CircleBlocker'].includes(o.type)).length,2);
 assert.equal(s.native.status,'completed');
 assert.equal(s.observations.blockersById.L1.absorptions,6);
 assert.equal(s.observations.blockersById.B1.absorptions,0);
 assert.throws(()=>build(r=>{
  stop(r).y=100;stop(r).radius=30;
  r.components.push({id:'L1',type:'line-blocker',parameters:{x:0,y:0,orientationDeg:90,length:80}});
  r.components.push({id:'L2',type:'line-blocker',parameters:{x:0,y:-100,orientationDeg:90,length:60}});
 }),/0–2|two-stop|total opaque|general tracing/);
});

test('strict circle geometry refuses missing, nonpositive, unbounded, source-inside and crossed disks',()=>{
 const bad=[
  r=>delete stop(r).radius,r=>stop(r).radius=0,r=>stop(r).radius=-10,
  r=>stop(r).radius=10001,r=>stop(r).radius=NaN,r=>stop(r).radius=Infinity,
  r=>stop(r).x=9980,r=>stop(r).x=-200,r=>stop(r).x=-160,
  r=>stop(r).radius='40',
  r=>r.components.push({id:'C2',type:'circle-blocker',parameters:{x:80,y:0,radius:40}}),
  r=>r.components.push({id:'C2',type:'circle-blocker',parameters:{x:0,y:0,radius:5}}),
  r=>r.components.push({id:'L1',type:'ideal-lens',parameters:{x:40,focalLength:100,apertureHeight:70}}),
  r=>r.components.push({id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:0,length:70}}),
  r=>r.components.push({id:'L1',type:'line-blocker',parameters:{x:0,y:0,orientationDeg:90,length:60}}),
  r=>r.components.find(c=>c.id==='D1').parameters.x=40
 ];
 for(const [index,edit] of bad.entries()){
  assert.throws(()=>build(edit),'invalid geometry case '+index);
 }
 const missing=request();delete stop(missing).radius;
 assert.ok(inspectAuthoringRequest(missing).some(x=>x.code==='MISSING_VALUE'));
});

test('near tangent and endpoint contact are rejected without an invented ray outcome',()=>{
 assert.throws(()=>build(r=>r.components.find(c=>c.id==='D1').parameters.x=40.005));
 assert.throws(()=>build(r=>{
  r.components.push({id:'M1',type:'plane-mirror',parameters:{
   x:70,y:0,orientationDeg:0,length:60}});
 })); // Endpoint at x=40 touches the opaque circumference
 assert.equal(build(r=>stop(r).radius=1).physics.components[1].parameters.radius,1);
});

test('v4 general-scene only: old or isolated model families may not silently reinterpret the disk',()=>{
 const doc=build();
 for(const [version,model] of [[5,'planar-media-tracing'],[6,'curved-mirror-tracing'],[7,'circular-dielectric-tracing'],[8,'triangular-prism-tracing'],[9,'polygon-dielectric-tracing']]){
  const wrong=structuredClone(doc);wrong.schemaVersion=wrong.adapterVersion=version;
  wrong.physics.model=model;assert.throws(()=>validate(wrong));
 }
 for(const model of ['plane-mirror-geometric','mixed-lens-mirror-tracing','lens-mirror-return-geometric','ideal-thin-lens-geometric']){
  const wrong=structuredClone(doc);wrong.physics.model=model;assert.throws(()=>validate(wrong));
 }
});

test('result targeting is type-safe; an implicit request finds the unique native circular stop',()=>{
 const r=request();
 const planned=planProblem({format:'opticsim-problem-v1',physical:r,requests:[{id:'x',kind:'blocker-absorptions'}]});
 assert.equal(planned.native.canRun,true);
 assert.equal(planned.targetBindings[0].componentId,'B1');
 const bad=planProblem({format:'opticsim-problem-v1',physical:r,requests:[{id:'x',kind:'blocker-absorptions',componentId:'D1'}]});
 assert.equal(bad.native.canRun,false);assert.equal(bad.results[0].reasonCode,'INCOMPATIBLE_COMPONENT_TARGET');
});

test('native circular absorber observer delegates exactly once; malformed returns fail measurement',()=>{
 const doc=build(),{scene,idMap}=core.loadDocument(doc),native=scene.objs[idMap.get('B1')];
 const original=native.onRayIncident,observer=core.observeBlockerSet(doc,scene,idMap);
 const ray={p1:{x:-10,y:0},p2:{x:10,y:0},brightness_s:.1,brightness_p:.1},hit={x:0,y:0};
 assert.deepEqual(native.onRayIncident(ray,0,hit),original.call(native,ray,0,hit));
 assert.equal(observer.byId.B1.absorptions,1);
 const copied=observer.byId;copied.B1.absorptions=9;
 assert.equal(observer.byId.B1.absorptions,1);
 const second=core.loadDocument(doc),obj=second.scene.objs[second.idMap.get('B1')];
 let calls=0;const sentinel={newRays:[]};
 obj.onRayIncident=()=>{calls++;return sentinel;};
 const invalid=core.observeBlockerSet(doc,second.scene,second.idMap);
 assert.strictEqual(obj.onRayIncident({},0,{x:0,y:0}),sentinel);
 assert.equal(calls,1);assert.equal(invalid.byId.B1.invalidObservations,1);
 assert.ok(invalid.errors.length);
});

test('stale and incomplete native runs never publish circular-blocker measurements',async()=>{
 const d=build(),s=run(d),later=build(r=>stop(r).y=100);
 const stale=await observe(later,s);
 assert.ok(stale.results.every(x=>x.status==='suppressed'&&x.value===null));
 d.simulation.processedRayLimit=1;const incomplete=run(d);
 assert.ok(['stopped','incomplete'].includes(incomplete.native.status));
 const unavailable=await observe(d,incomplete);
 assert.ok(unavailable.results.every(x=>x.status==='suppressed'&&x.value===null));
});

test('atomic radius edits, qualified provenance and Fit preserve a physical circular stop',async()=>{
 const d=build(),q=initialQualification(d,null,{inputSha256:'e'.repeat(64),interpretation:fixture.interpretation});
 const original=await createQualifiedBundle(d,q,fixture.requests);
 const edited=reviseScene(d,{changes:[{id:'B1',section:'parameters',key:'y',value:10,unit:'cm'},
  {id:'B1',section:'parameters',key:'radius',value:3,unit:'cm'}]}).document;
 assert.equal(edited.physics.components[1].parameters.radius,30);
 assert.equal(edited.physics.components[1].parameters.y,100);
 assert.equal(setParameter(d,'B1','radius',20).physics.components[1].parameters.radius,20);
 const qualified=await createQualifiedBundle(edited,
  recordQualifiedEdit(d,edited,original.qualification),fixture.requests);
 const reopened=await parseQualifiedBundle(JSON.stringify(qualified));
 assert.deepEqual(reopened.qualification.interpretation,original.qualification.interpretation);
 const points=apparatusPoints(edited);
 for(const x of [-30,30])assert.ok(points.some(p=>p.x===x&&p.y===100));
 for(const y of [70,130])assert.ok(points.some(p=>p.x===0&&p.y===y));
 const fit=await fitRequestedView(edited,await observe(edited,run(edited)),390,320);
 assert.deepEqual(fit.document.physics,edited.physics);
 const corrupt=structuredClone(qualified);corrupt.scene.physics.components[1].parameters.radius=22;
 await assert.rejects(parseQualifiedBundle(JSON.stringify(corrupt)),/integrity/);
});

test('additional independent source does not become falsely attributed to the sampled blocker',()=>{
 const d=build(r=>r.components.push({id:'S2',type:'point-source',
  parameters:{x:-200,y:100,brightness:.08},emission:{mode:'directional',directionDeg:0,angleDeg:20}}));
 const s=run(d);
 assert.equal(s.native.status,'completed');
 assert.equal(s.native.emitted,12);
 assert.equal(s.observations.emissionsById.S1.emitted,6);
 assert.equal(s.observations.emissionsById.S2.emitted,6);
 assert.equal(s.observations.blockersById.B1.absorptions,6);
 assert.equal(s.observations.detectorsById.D1.crossings,0);
});
