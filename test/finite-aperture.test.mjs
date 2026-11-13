import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,capabilities,inspectAuthoringRequest} from '../src/authoring.js';
import {validate,parseSave,serializeSave,setParameter,mirrorEndpoints} from '../src/contract.js';
import {apertureGeometry} from '../src/finite-aperture.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables,observableCapabilities} from '../src/observables.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {apparatusPoints,fitRequestedView} from '../src/result-preview.js';
import {planProblem} from '../src/problem-workflow.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/finite-aperture-detector.json',import.meta.url)));
const request=()=>structuredClone(fixture.physical);
const aperture=r=>r.components.find(c=>c.type==='finite-aperture').parameters;
const build=(edit=()=>{})=>{const r=request();edit(r);return prepareScene(r).document;};
const run=doc=>evaluateDocument(doc,core).summary;
const results=(doc,s)=>evaluateObservables(doc,fixture.requests,s);

test('native Aperture uses four precisely derived points; schema and original request remain unchanged',()=>{
 const input=request(),old=JSON.stringify(input),doc=build(),compiled=core.compile(doc);
 assert.equal(doc.schemaVersion,4);assert.equal(doc.physics.model,'general-component-tracing');
 assert.equal(capabilities().componentTypes['finite-aperture'].nativeType,'Aperture');
 assert.equal(capabilities().finiteApertures.combinedStopMax,2);
 assert.equal(capabilities().maxComponents,16);
 const g=apertureGeometry(doc.physics.components[1].parameters,mirrorEndpoints);
 const flip=p=>({x:p.x,y:-p.y});
 assert.deepEqual(compiled.native.objs[compiled.idMap.get('B1')],{
   type:'Aperture',p1:flip(g.p1),p2:flip(g.p2),p3:flip(g.p3),p4:flip(g.p4),filter:false});
 assert.ok(Math.abs(Math.hypot(g.p4.x-g.p3.x,g.p4.y-g.p3.y)-30)<1e-9);
 for(const [a,b] of g.arms)assert.ok(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-25)<1e-9);
 assert.equal(core.loadNative(JSON.parse(core.nativeExport(doc))).objs[compiled.idMap.get('B1')].constructor.type,'Aperture');
 assert.deepEqual(parseSave(serializeSave(doc)),doc);assert.equal(JSON.stringify(input),old);
});

test('native opening transmits some sampled rays and absorbs others, never infers a continuous field',async()=>{
 const doc=build(),s=run(doc),o=await results(doc,s);
 assert.equal(s.native.status,'completed');assert.equal(s.native.emitted,6);
 const absorbed=s.observations.blockersById.B1.absorptions;
 const crossed=s.observations.detectorsById.D1.crossings;
 assert.ok(absorbed>0&&absorbed<6,JSON.stringify({absorbed,crossed}));
 assert.ok(crossed>0,JSON.stringify({absorbed,crossed}));
 assert.equal(s.observations.blockersById.B1.invalidObservations,0);
 assert.deepEqual(o.results.map(x=>x.value),[absorbed,6,crossed,s.observations.detectorsById.D1.signedPower]);
 assert.equal(o.results[0].method,'native-observation');
 assert.match(o.results[0].limitation,/not a continuous coverage/);
 assert.equal(o.questionSupport,'not-assessed-by-engine');
 assert.deepEqual(observableCapabilities().kinds['blocker-absorptions'].type,
  ['line-blocker','circle-blocker','finite-aperture']);
});

test('shifting the aperture out of the cone produces zero real absorptions and a no-aperture reference',async()=>{
 const doc=build(r=>aperture(r).y=100),shifted=run(doc),report=await results(doc,shifted);
 const free=structuredClone(doc);free.physics.components=free.physics.components.filter(c=>c.type!=='finite-aperture');
 const reference=run(free);
 assert.equal(shifted.native.status,'completed');assert.equal(reference.native.status,'completed');
 assert.equal(shifted.observations.blockersById.B1.absorptions,0);
 assert.equal(shifted.observations.detectorsById.D1.crossings,reference.observations.detectorsById.D1.crossings);
 assert.equal(shifted.native.emitted,reference.native.emitted);
 assert.equal(report.results[0].value,0);
});

test('opening width changes which rays the native object absorbs; sampling changes counts only',()=>{
 const narrow=run(build(r=>aperture(r).openingLength=1));
 const normal=run(build());
 const wide=run(build(r=>aperture(r).openingLength=78));
 const free=build();free.physics.components=free.physics.components.filter(c=>c.type!=='finite-aperture');
 const reference=run(free);
 for(const s of [narrow,normal,wide,reference])assert.equal(s.native.status,'completed');
 assert.ok(narrow.observations.blockersById.B1.absorptions>=normal.observations.blockersById.B1.absorptions);
 assert.ok(normal.observations.blockersById.B1.absorptions>=wide.observations.blockersById.B1.absorptions);
 assert.equal(wide.observations.blockersById.B1.absorptions,0);
 assert.equal(wide.observations.detectorsById.D1.crossings,reference.observations.detectorsById.D1.crossings);
 const dense=run(build(r=>r.runPolicy='dense-v1'));
 assert.equal(dense.native.emitted,28);
 assert.ok(dense.observations.blockersById.B1.absorptions>0);
 assert.ok(dense.observations.blockersById.B1.absorptions<28);
});

test('a finite lens or detector entirely inside the transparent opening is permitted',()=>{
 const lens=build(r=>r.components.push({id:'L1',type:'ideal-lens',
  parameters:{x:0,focalLength:100,apertureHeight:20}}));
 assert.equal(core.compile(lens).native.objs.filter(o=>o.type==='Aperture').length,1);
 assert.equal(core.compile(lens).native.objs.filter(o=>o.type==='IdealLens').length,1);
 const detector=build(r=>{
  r.components.find(c=>c.id==='D1').parameters.x=0;
  r.components.find(c=>c.id==='D1').parameters.length=20;
 });
 assert.equal(core.compile(detector).native.objs.filter(o=>o.type==='Detector').length,1);
});

test('opaque arms block surface intersections, endpoints, and near-contact even if the gap is clear',()=>{
 const bad=[
  r=>r.components.push({id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:90,apertureHeight:50}}),
  r=>r.components.push({id:'M1',type:'plane-mirror',parameters:{x:0,y:30,orientationDeg:0,length:30}}),
  r=>r.components.push({id:'X1',type:'line-blocker',parameters:{x:0,y:25,orientationDeg:90,length:10}}),
  r=>{const d=r.components.find(c=>c.id==='D1').parameters;d.x=0;d.length=40;},
  r=>{const d=r.components.find(c=>c.id==='D1').parameters;d.x=0.005;d.length=40;},
  r=>{const d=r.components.find(c=>c.id==='D1').parameters;d.x=0;d.y=15;d.length=1;}
 ];
 for(const [i,edit] of bad.entries())assert.throws(()=>build(edit),'arm crossing '+i);
 assert.equal(build(r=>{const d=r.components.find(c=>c.id==='D1').parameters;d.x=0;d.length=20;}).physics.model,
   'general-component-tracing');
});

test('strict authoring rejects missing/incorrect opening length, invalid arms, limits, and source on support line',()=>{
 const bad=[
  r=>delete aperture(r).openingLength,r=>aperture(r).openingLength=0,
  r=>aperture(r).openingLength=-1,r=>aperture(r).openingLength=Infinity,
  r=>aperture(r).openingLength='30',r=>aperture(r).openingLength=79,
  r=>aperture(r).openingLength=80,r=>aperture(r).openingLength=100,
  r=>aperture(r).length=31,r=>aperture(r).length=0,
  r=>aperture(r).orientationDeg=181,r=>aperture(r).x=10000,
  r=>aperture(r).x=-200
 ];
 for(const [i,edit] of bad.entries())assert.throws(()=>build(edit),'invalid aperture '+i);
 const input=request();delete aperture(input).openingLength;
 assert.ok(inspectAuthoringRequest(input).some(x=>x.code==='MISSING_VALUE'));
 assert.throws(()=>setParameter(build(),'B1','openingLength',79),/arms at least 1 mm/);
 assert.equal(setParameter(build(),'B1','openingLength',78).physics.components[1].parameters.openingLength,78);
});

test('circle intersection guard checks solid aperture arms, not an imaginary barrier through the gap',()=>{
 const insideGap=build(r=>r.components.push({id:'C2',type:'circle-blocker',
   parameters:{x:0,y:0,radius:5}}));
 assert.equal(core.compile(insideGap).native.objs.filter(o=>o.type==='CircleBlocker').length,1);
 assert.throws(()=>build(r=>r.components.push({id:'C2',type:'circle-blocker',
   parameters:{x:0,y:30,radius:5}})));
 assert.throws(()=>build(r=>r.components.push({id:'C2',type:'circle-blocker',
   parameters:{x:0,y:15,radius:1}})));
});

test('line/circle/aperture count totals at most two and old optical families remain sealed',()=>{
 const accepted=build(r=>r.components.push({id:'L2',type:'line-blocker',
   parameters:{x:60,y:70,orientationDeg:0,length:20}}));
 assert.equal(accepted.physics.components.length,4);
 assert.throws(()=>build(r=>{
  r.components.push({id:'L2',type:'line-blocker',parameters:{x:60,y:70,orientationDeg:0,length:20}});
  r.components.push({id:'C2',type:'circle-blocker',parameters:{x:0,y:70,radius:5}});
 }));
 const d=build();
 for(const [version,model] of [[5,'planar-media-tracing'],[6,'curved-mirror-tracing'],
   [7,'circular-dielectric-tracing'],[8,'triangular-prism-tracing'],[9,'polygon-dielectric-tracing']]){
  const old=structuredClone(d);old.schemaVersion=old.adapterVersion=version;old.physics.model=model;
  assert.throws(()=>validate(old));
 }
 for(const model of ['plane-mirror-geometric','mixed-lens-mirror-tracing','lens-mirror-return-geometric'])
  assert.throws(()=>validate({...structuredClone(d),physics:{...structuredClone(d).physics,model}}));
});

test('problem target resolution finds a unique native aperture and rejects wrong targets',()=>{
 const ok=planProblem({format:'opticsim-problem-v1',physical:request(),
   requests:[{id:'A',kind:'blocker-absorptions'}]});
 assert.equal(ok.native.canRun,true);assert.equal(ok.targetBindings[0].componentId,'B1');
 const bad=planProblem({format:'opticsim-problem-v1',physical:request(),
   requests:[{id:'A',kind:'blocker-absorptions',componentId:'D1'}]});
 assert.equal(bad.native.canRun,false);assert.equal(bad.results[0].reasonCode,'INCOMPATIBLE_COMPONENT_TARGET');
});

test('native aperture observer calls through once, preserves the real result, and flags invalid returns',()=>{
 const doc=build(),{scene,idMap}=core.loadDocument(doc),obj=scene.objs[idMap.get('B1')];
 const original=obj.onRayIncident,observer=core.observeBlockerSet(doc,scene,idMap);
 const ray={p1:{x:-10,y:0},p2:{x:10,y:0},brightness_s:.1,brightness_p:.1};
 const hit={x:0,y:30};
 assert.deepEqual(obj.onRayIncident(ray,0,hit),original.call(obj,ray,0,hit));
 assert.equal(observer.byId.B1.absorptions,1);
 const captured=observer.byId;captured.B1.absorptions=99;assert.equal(observer.byId.B1.absorptions,1);
 const other=core.loadDocument(doc),native=other.scene.objs[other.idMap.get('B1')];
 const sentinel={newRays:[]};let calls=0;native.onRayIncident=()=>{calls++;return sentinel;};
 const meter=core.observeBlockerSet(doc,other.scene,other.idMap);
 assert.strictEqual(native.onRayIncident({},0,{x:0,y:30}),sentinel);
 assert.equal(calls,1);assert.equal(meter.byId.B1.invalidObservations,1);assert.ok(meter.errors.length);
});

test('stale and incomplete runs suppress aperture counts and detector readings',async()=>{
 const d=build(),s=run(d),edited=build(r=>aperture(r).openingLength=20);
 const stale=await results(edited,s);assert.ok(stale.results.every(x=>x.status==='suppressed'));
 d.simulation.processedRayLimit=1;const stopped=run(d);
 assert.ok(['incomplete','stopped'].includes(stopped.native.status));
 const withheld=await results(d,stopped);
 assert.ok(withheld.results.every(x=>x.status==='suppressed'&&x.value===null));
});

test('qualified opening edits, units, Fit and hash-protected exports preserve author facts',async()=>{
 const d=build(),q=initialQualification(d,null,{inputSha256:'a'.repeat(64),
  interpretation:fixture.interpretation});
 const base=await createQualifiedBundle(d,q,fixture.requests);
 const edited=reviseScene(d,{changes:[
  {id:'B1',section:'parameters',key:'openingLength',value:6,unit:'cm'},
  {id:'B1',section:'parameters',key:'y',value:10,unit:'cm'}
 ]}).document;
 assert.equal(edited.physics.components[1].parameters.openingLength,60);
 assert.equal(edited.physics.components[1].parameters.y,100);
 const updated=await createQualifiedBundle(edited,recordQualifiedEdit(d,edited,base.qualification),fixture.requests);
 const reopened=await parseQualifiedBundle(JSON.stringify(updated));
 assert.deepEqual(reopened.qualification.interpretation,base.qualification.interpretation);
 const [a,b]=mirrorEndpoints(edited.physics.components[1].parameters),pts=apparatusPoints(edited);
 for(const end of [a,b])assert.ok(pts.some(x=>x.x===end.x&&x.y===end.y));
 const fit=await fitRequestedView(edited,await results(edited,run(edited)),390,320);
 assert.deepEqual(fit.document.physics,edited.physics);
 const invalid=structuredClone(updated);invalid.scene.physics.components[1].parameters.openingLength=10;
 await assert.rejects(parseQualifiedBundle(JSON.stringify(invalid)),/integrity/);
});

test('multiple independent sources aggregate sampled absorption without invented per-source stop attribution',()=>{
 const d=build(r=>r.components.push({id:'S2',type:'point-source',
  parameters:{x:-200,y:100,brightness:.08},emission:{mode:'directional',directionDeg:0,angleDeg:20}}));
 const s=run(d);assert.equal(s.native.status,'completed');assert.equal(s.native.emitted,12);
 assert.equal(s.observations.emissionsById.S1.emitted,6);
 assert.equal(s.observations.emissionsById.S2.emitted,6);
 assert.ok(s.observations.blockersById.B1.absorptions>0);
 assert.ok(s.observations.blockersById.B1.absorptions<12);
});
