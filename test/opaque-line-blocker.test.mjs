import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,capabilities} from '../src/authoring.js';
import {validate,parseSave,serializeSave,mirrorEndpoints} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {apparatusPoints,fitRequestedView} from '../src/result-preview.js';
import {planProblem} from '../src/problem-workflow.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/blocker-detector.json',import.meta.url)));
const request=()=>structuredClone(fixture.physical);
const blocker=r=>r.components.find(c=>c.type==='line-blocker').parameters;
const source=r=>r.components.find(c=>c.type==='point-source');
const build=(edit=()=>{})=>{const r=request();edit(r);return prepareScene(r).document;};
const run=doc=>evaluateDocument(doc,core).summary;
const results=(doc,s)=>evaluateObservables(doc,fixture.requests,s);
test('finite blocker compiles to a native fully opaque line; original authoring bytes are unchanged',()=>{
 const r=request(),old=JSON.stringify(r),d=build(),compiled=core.compile(d);
 assert.equal(d.schemaVersion,4);assert.equal(d.physics.model,'general-component-tracing');
 assert.equal(capabilities().componentTypes['line-blocker'].nativeType,'Blocker');
 assert.equal(capabilities().opaqueLineBlockers.max,2);
 const native=compiled.native.objs[compiled.idMap.get('B1')],p=d.physics.components.find(c=>c.id==='B1').parameters;
 const [a,b]=mirrorEndpoints(p);
 assert.deepEqual(native,{type:'Blocker',p1:{x:a.x,y:-a.y},p2:{x:b.x,y:-b.y},filter:false});
 assert.equal(core.loadNative(JSON.parse(core.nativeExport(d))).objs[compiled.idMap.get('B1')].constructor.type,'Blocker');
 assert.deepEqual(parseSave(serializeSave(d)),d);assert.equal(JSON.stringify(r),old);
});
test('native blocked rays give six absorptions, six emitted, and zero downstream crossings',async()=>{
 const d=build(),s=run(d),r=await results(d,s);
 assert.equal(s.native.status,'completed');assert.equal(s.native.emitted,6);
 assert.deepEqual(s.observations.blockersById.B1,{absorptions:6,invalidObservations:0});
 assert.equal(s.observations.detectorsById.D1.crossings,0);
 assert.deepEqual(r.results.map(x=>x.value),[6,6,0,0]);
 assert.equal(r.results[0].method,'native-observation');
 assert.equal(r.questionSupport,'not-assessed-by-engine');
});
test('moving the same native stop away gives zero absorptions and four detector crossings',async()=>{
 const d=build(r=>blocker(r).y=100),s=run(d),r=await results(d,s);
 assert.equal(s.native.status,'completed');
 assert.deepEqual(r.results.slice(0,3).map(x=>x.value),[0,6,4]);
 assert.equal(r.results[3].unit,'relative native units; not watts');
});
test('dense native ray sampling changes counts, not an absolute shadow visibility theorem',async()=>{
 const d=build(r=>r.runPolicy='dense-v1'),s=run(d),o=await results(d,s);
 assert.equal(s.native.emitted,28);assert.equal(o.results[0].value,28);
 assert.match(capabilities().opaqueLineBlockers.scope,/no shadow visibility/);
});
test('unique target is resolved but explicit wrong component type cannot trigger native work',()=>{
 const p=request();
 const good=planProblem({format:'opticsim-problem-v1',physical:p,requests:[{id:'B',kind:'blocker-absorptions'}]});
 assert.equal(good.native.canRun,true);assert.equal(good.targetBindings[0].componentId,'B1');
 const bad=planProblem({format:'opticsim-problem-v1',physical:p,requests:[{id:'B',kind:'blocker-absorptions',componentId:'D1'}]});
 assert.equal(bad.native.canRun,false);assert.equal(bad.results[0].reasonCode,'INCOMPATIBLE_COMPONENT_TARGET');
 p.components=p.components.filter(c=>c.type!=='line-blocker');
 const absent=planProblem({format:'opticsim-problem-v1',physical:p,requests:[{id:'B',kind:'blocker-absorptions'}]});
 assert.equal(absent.results[0].reasonCode,'NO_COMPATIBLE_COMPONENT');
});
test('invalid geometry and overlapping passive/optical segments are rejected rather than repaired',()=>{
 const edits=[r=>blocker(r).length=0,r=>blocker(r).orientationDeg=200,
  r=>blocker(r).x=-200,r=>blocker(r).x=100,r=>blocker(r).length=10001,
  r=>r.components.push({...r.components.find(c=>c.id==='B1'),id:'B2'}),
  r=>r.components.push({...r.components.find(c=>c.id==='B1'),id:'B2',parameters:{...blocker(r),x:40,y:20,orientationDeg:0,length:200}}),
  r=>{r.components.push({...r.components.find(c=>c.id==='B1'),id:'B2',parameters:{...blocker(r),x:30}});
   r.components.push({...r.components.find(c=>c.id==='B1'),id:'B3',parameters:{...blocker(r),x:60}});},
  r=>r.components.push({id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:50,apertureHeight:100}})
 ];
 for(const edit of edits)assert.throws(()=>build(edit));
});
test('two disjoint native blockers can compose with existing lenses and plane mirrors',()=>{
 const d=build(r=>{
  r.components.push({id:'B2',type:'line-blocker',parameters:{x:60,y:100,orientationDeg:90,length:60}});
  r.components.push({id:'L1',type:'ideal-lens',parameters:{x:-50,focalLength:100,apertureHeight:80}});
  r.components.push({id:'M1',type:'plane-mirror',parameters:{x:180,y:0,orientationDeg:90,length:50}});
 });
 const objects=core.compile(d).native.objs;
 assert.equal(objects.filter(x=>x.type==='Blocker').length,2);
 assert.equal(objects.filter(x=>x.type==='IdealLens').length,1);
 assert.equal(objects.filter(x=>x.type==='Mirror').length,1);
});
test('old isolated optical schemas cannot admit the new blocker',()=>{
 const d=build();
 for(const [v,model] of [[5,'planar-media-tracing'],[6,'curved-mirror-tracing'],[7,'circular-dielectric-tracing'],[8,'triangular-prism-tracing'],[9,'polygon-dielectric-tracing']]){
  const x=structuredClone(d);x.schemaVersion=x.adapterVersion=v;x.physics.model=model;assert.throws(()=>validate(x));
 }
 for(const model of ['plane-mirror-geometric','mixed-lens-mirror-tracing','lens-mirror-return-geometric']){
  const x=structuredClone(d);x.physics.model=model;assert.throws(()=>validate(x));
 }
});
test('native absorber observer delegates exactly once and preserves actual result and ray',()=>{
 const d=build(),{scene,idMap}=core.loadDocument(d),obj=scene.objs[idMap.get('B1')];
 const original=obj.onRayIncident,observer=core.observeBlockerSet(d,scene,idMap);
 const ray={p1:{x:-10,y:0},p2:{x:10,y:0},brightness_s:.1,brightness_p:.1},hit={x:0,y:0};
 assert.deepEqual(obj.onRayIncident(ray,0,hit),original.call(obj,ray,0,hit));
 assert.equal(observer.byId.B1.absorptions,1);const copy=observer.byId;copy.B1.absorptions=10;
 assert.equal(observer.byId.B1.absorptions,1);
});
test('invalid native absorber return is a measurement error rather than a manufactured hit',()=>{
 const d=build(),{scene,idMap}=core.loadDocument(d),obj=scene.objs[idMap.get('B1')];
 let called=0;const fake={newRays:[]};obj.onRayIncident=()=>{called++;return fake;};
 const observer=core.observeBlockerSet(d,scene,idMap);
 assert.strictEqual(obj.onRayIncident({},0,{x:0,y:0}),fake);
 assert.equal(called,1);assert.equal(observer.byId.B1.invalidObservations,1);assert.ok(observer.errors.length);
});
test('stale and incomplete native runs suppress blocker and detector measurements',async()=>{
 const d=build(),s=run(d),changed=build(r=>blocker(r).y=100);
 const stale=await results(changed,s);assert.ok(stale.results.every(x=>x.status==='suppressed'));
 d.simulation.processedRayLimit=1;const stopped=run(d);
 assert.ok(['incomplete','stopped'].includes(stopped.native.status));
 const suppressed=await results(d,stopped);
 assert.ok(suppressed.results.every(x=>x.status==='suppressed'&&x.value===null));
});
test('qualified blocker edits and Fit preserve original physical facts and protect hashes',async()=>{
 const d=build(),q=initialQualification(d,null,{inputSha256:'e'.repeat(64),interpretation:fixture.interpretation});
 const original=await createQualifiedBundle(d,q,fixture.requests);
 const changed=reviseScene(d,{changes:[{id:'B1',section:'parameters',key:'y',value:10,unit:'cm'}]}).document;
 const later=await createQualifiedBundle(changed,recordQualifiedEdit(d,changed,original.qualification),fixture.requests);
 const reopened=await parseQualifiedBundle(JSON.stringify(later));
 assert.equal(reopened.scene.physics.components.find(c=>c.id==='B1').parameters.y,100);
 assert.deepEqual(reopened.qualification.interpretation,original.qualification.interpretation);
 const p=changed.physics.components.find(c=>c.id==='B1').parameters;
 for(const end of mirrorEndpoints(p))assert.ok(apparatusPoints(changed).some(x=>x.x===end.x&&x.y===end.y));
 const fit=await fitRequestedView(changed,await results(changed,run(changed)),390,320);
 assert.deepEqual(fit.document.physics,changed.physics);
 const tampered=structuredClone(later);tampered.scene.physics.components.find(c=>c.id==='B1').parameters.y+=5;
 await assert.rejects(parseQualifiedBundle(JSON.stringify(tampered)),/integrity/);
});
