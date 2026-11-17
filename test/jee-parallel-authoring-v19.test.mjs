// New version-isolated JEE-first native Beam contract acceptance.
// No constructed ray paths, source substitution or unqualified image assertions.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,capabilities} from '../src/authoring.js';
import {parseSave,serializeSave,validate,mirrorEndpoints} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {parallelBeamGeometry,parallelBeamSamples,PARALLEL_BEAM_VERSION,
 PARALLEL_LENS_MODEL,PARALLEL_PLANAR_MODEL} from '../src/parallel-beam.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const load=name=>JSON.parse(readFileSync(new URL('../examples/jee-parallel-'+name+'-v19.json',import.meta.url),'utf8'));
const copy=name=>structuredClone(load(name).physical);
const component=(r,id)=>r.components.find(c=>c.id===id);
const prepared=r=>prepareScene(r).document;
const near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const observe=async(d,req)=>{
 const out=evaluateDocument(d,core,req);
 const results=(await evaluateObservables(d,req,out.summary)).results;
 return {out,results};
};
test('v19 native Beam is fully authorable and version isolated; no hidden source substitution',()=>{
 const a=copy('lens'),snapshot=JSON.stringify(a),d=prepared(a);
 assert.equal(JSON.stringify(a),snapshot);
 assert.equal(d.schemaVersion,PARALLEL_BEAM_VERSION);
 assert.equal(d.adapterVersion,PARALLEL_BEAM_VERSION);
 assert.equal(d.physics.model,PARALLEL_LENS_MODEL);
 assert.equal(d.simulation.maxRayDepth,8);
 assert.deepEqual(core.compile(d).native.objs.map(x=>x.type),['Beam','Aperture','IdealLens','Detector']);
 const native=core.compile(d).native.objs[0],g=parallelBeamGeometry(component(a,'B1').parameters);
 near(native.p1.x,g.p1.x);near(native.p1.y,-g.p1.y);
 near(native.p2.x,g.p2.x);near(native.p2.y,-g.p2.y);
 assert.equal(native.emisAngle,0);assert.equal(native.random,false);
 assert.equal(native.lambert,false);
 assert.equal(native.brightness,.08);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 const old=structuredClone(d);
 old.schemaVersion=old.adapterVersion=4;old.physics.model='general-component-tracing';
 assert.throws(()=>validate(old),'v4 must not accept a newly authored Beam');
 const bad=copy('lens');bad.components[0].type='point-source';
 assert.throws(()=>prepareScene(bad),'Beam parameters must not masquerade as a point emitter');
 const cap=capabilities();
 assert.equal(cap.nativeParallelBeam.schemaVersion,19);
 assert.ok(cap.composition.profiles.some(x=>x.schemaVersion===19&&x.model===PARALLEL_LENS_MODEL));
});
test('native v19 lens-aperture scene reports exactly two sampled focal-plane hits after six real absorptions',async()=>{
 const fixture=load('lens'),d=prepared(fixture.physical);
 const {out,results:r}=await observe(d,fixture.requests);
 assert.equal(out.summary.native.status,'completed');
 assert.equal(out.summary.executionPassed,true);
 assert.deepEqual(r.map(x=>x.kind),fixture.requests.map(x=>x.kind));
 assert.deepEqual(r.map(x=>x.status),['available','available','available','available']);
 assert.equal(r[0].value,8);assert.equal(r[1].value,6);
 assert.equal(r[2].value,2);assert.equal(r[3].value.length,2);
 for(const e of r[3].value){near(e.pointMm.x,100);near(e.pointMm.y,0);near(e.incomingUnit.x,1);}
 assert.equal(out.summary.native.truncation,0);
 assert.equal(out.summary.native.undefinedBehavior,0);
 assert.equal(out.summary.observations.emissionsById.B1.emitted,8);
 assert.equal(out.summary.observations.emissionsById.B1.brightnessScale,1);
 console.log('V19_NATIVE_BEAM_APERTURE '+JSON.stringify({state:out.summary.native.status,emitted:8,blocked:6,detected:2}));
});
test('v19 whole-segment source and neutral free-space controls are physical and deterministic',async()=>{
 const p=copy('lens');p.components=p.components.filter(c=>['B1','D1'].includes(c.id));
 const d=prepared(p);
 assert.equal(d.physics.model,PARALLEL_LENS_MODEL);
 assert.deepEqual(core.compile(d).native.objs.map(x=>x.type),['Beam','Detector']);
 const expected=parallelBeamSamples(component(p,'B1').parameters,.2);
 assert.equal(expected.length,8);expected.forEach((v,i)=>{near(v.x,-100);near(v.y,17.5-i*5);});
 const req=[{id:'s',kind:'source-emissions',componentId:'B1'},
   {id:'n',kind:'detector-crossings',componentId:'D1'},
   {id:'h',kind:'detector-hit-events',componentId:'D1'}];
 const first=await observe(d,req),second=await observe(d,req);
 assert.equal(first.out.summary.native.status,'completed');
 assert.deepEqual(first.results,second.results);
 assert.equal(first.results[0].value,8);assert.equal(first.results[1].value,8);
 assert.deepEqual(first.results[2].value.map(v=>v.pointMm.y),[17.5,12.5,7.5,2.5,-2.5,-7.5,-12.5,-17.5]);
});
test('v19 slab with 30-degree parallel rays preserves native Snell refraction and exit parallelism',async()=>{
 const f=load('slab'),d=prepared(f.physical),{out,results:r}=await observe(d,f.requests);
 assert.equal(d.physics.model,PARALLEL_PLANAR_MODEL);
 assert.deepEqual(core.compile(d).native.objs.map(x=>x.type),['Beam','PlaneGlass','PlaneGlass','Detector']);
 assert.equal(out.summary.native.status,'completed');
 assert.equal(out.summary.executionPassed,true);
 assert.deepEqual(r.map(x=>x.status),['qualified','qualified','qualified','qualified','qualified']);
 assert.deepEqual(r.slice(0,4).map(x=>x.value),[8,8,8,8]);
 assert.equal(r[4].value.length,8);
 const theta=Math.asin(Math.sin(Math.PI/6)/1.5),D=Math.sin(Math.PI/6-theta)/Math.cos(theta)*60;
 const sample=parallelBeamSamples(component(f.physical,'B1').parameters,.2);
 const expected=sample.map(v=>v.y+(0-v.x)*Math.tan(Math.PI/6)+60*Math.tan(theta)+60*Math.tan(Math.PI/6)).sort((a,b)=>a-b);
 const observed=r[4].value.map(e=>e.pointMm.y).sort((a,b)=>a-b);
 observed.forEach((y,i)=>near(y,expected[i]));
 r[4].value.forEach(e=>{near(e.incomingUnit.x,Math.cos(Math.PI/6));near(e.incomingUnit.y,.5);});
 near(D,11.628826929126161);
 console.log('V19_NATIVE_BEAM_SLAB '+JSON.stringify({state:out.summary.native.status,emitted:8,crossings:8,index:1.5,slabThicknessMm:60,lateralDisplacementMm:D}));
});
test('v19 native TIR is not converted into fictitious transmitted rays',async()=>{
 const s=copy('slab');
 s.components=s.components.filter(c=>!['I2','D1'].includes(c.id));
 component(s,'B1').parameters.directionDeg=60;
 Object.assign(component(s,'I1').parameters,{positiveIndex:1,negativeIndex:1.5});
 s.components.push({id:'D1',type:'ray-detector',parameters:{x:-150,y:400,orientationDeg:90,length:600}});
 const d=prepared(s),req=[{id:'tir',kind:'interface-tir-count',componentId:'I1'},
   {id:'det',kind:'detector-crossings',componentId:'D1'}];
 const {out,results}=await observe(d,req);
 assert.equal(out.summary.native.status,'completed');
 assert.equal(results[0].value,8);
 assert.equal(results[1].value,8);
 assert.equal(out.summary.observations.interfacesById.I1.transmitted,0);
});
test('v19 numerical sampling changes native count without altering physical beam or focal plane',async()=>{
 const a=copy('lens');a.components=a.components.filter(c=>c.id!=='A1');
 const medium=prepared(a),heavy=prepared({...a,runPolicy:'dense-v1'});
 const req=[{id:'s',kind:'source-emissions',componentId:'B1'},
   {id:'n',kind:'detector-crossings',componentId:'D1'},
   {id:'hits',kind:'detector-hit-events',componentId:'D1'}];
 const low=await observe(medium,req),high=await observe(heavy,req);
 assert.equal(low.out.summary.native.status,'completed');
 assert.equal(high.out.summary.native.status,'completed');
 assert.equal(low.results[0].value,8);assert.equal(low.results[1].value,8);
 assert.equal(high.results[0].value,40);assert.equal(high.results[1].value,40);
 assert.equal(high.results[2].status,'unavailable');
 assert.equal(high.results[2].value,null);
 assert.equal(high.out.summary.observations.detectorHitEventsById.D1.reasonCode,'HIT_EVENT_LIMIT_EXCEEDED');
 assert.equal(high.out.summary.native.truncation,0);
 console.log('V19_NATIVE_BEAM_OVERFLOW '+JSON.stringify({emitted:40,detectorCrossings:40,listAvailable:false,rayDensity:1}));
});
test('qualified native beam revisions and save/reopen never manufacture source or measurements',async()=>{
 const original=prepared(copy('lens')),revision=reviseScene(original,{
  changes:[{id:'B1',section:'parameters',key:'width',value:20}]}).document;
 assert.equal(revision.schemaVersion,19);
 assert.equal(revision.physics.components[0].parameters.width,20);
 const r=await observe(revision,load('lens').requests);
 assert.equal(r.out.summary.native.status,'completed');
 assert.equal(r.results[0].value,4);
 assert.equal(r.results[1].value,2);
 assert.equal(r.results[2].value,2);
 const saved=parseSave(serializeSave(revision));
 assert.deepEqual(saved,revision);
 const changed=reviseScene(revision,{changes:[{id:'B1',section:'parameters',key:'brightness',value:.05}]}).document;
 assert.equal(changed.physics.components[0].parameters.brightness,.05);
 assert.deepEqual(original.physics.components[0].parameters,{x:-100,y:0,width:40,directionDeg:0,brightness:.08});
});
test('an incomplete native v19 Fresnel slab withholds ALL positional and scalar native results',async()=>{
 const f=load('slab');
 for(const id of ['I1','I2'])component(f.physical,id).parameters.partialReflection=true;
 const d=prepared(f.physical),{out,results}=await observe(d,f.requests);
 assert.equal(out.summary.native.status,'incomplete');
 assert.ok(out.summary.native.truncation>0||out.summary.native.undefinedBehavior>0);
 assert.equal(out.summary.observations,null);
 assert.ok(results.every(x=>x.status==='suppressed'&&x.value===null));
});
test('strict v19 beam geometry refuses ambiguous source segments, lens edges, optical overlaps and unsupported physics',()=>{
 const lens=copy('lens'),slab=copy('slab');
 const cases=[
  ['width too small',r=>component(r,'B1').parameters.width=9,lens],
  ['width too large',r=>component(r,'B1').parameters.width=101,lens],
  ['source not entirely in bounds',r=>component(r,'B1').parameters.y=9990,lens],
  ['source overlaps lens x plane',r=>component(r,'B1').parameters.x=0,lens],
  ['source overlaps finite aperture plane',r=>component(r,'B1').parameters.x=-50,lens],
  ['aperture overlaps lens x plane',r=>component(r,'A1').parameters.x=0,lens],
  ['source near transparent-gap endpoint',r=>component(r,'A1').parameters.openingLength=15,lens],
  ['tilted finite aperture',r=>component(r,'A1').parameters.orientationDeg=45,lens],
  ['nonnative tilted ideal lens illumination',r=>component(r,'B1').parameters.directionDeg=30,lens],
  ['beam overbright and saturated',r=>component(r,'B1').parameters.brightness=.5,lens],
  ['beam on detector supporting line',r=>component(r,'D1').parameters.x=-100,lens],
  ['another source family',r=>r.components.push({id:'S2',type:'point-source',parameters:{x:-200,y:0,brightness:.08},emission:{mode:'directional',angleDeg:20,directionDeg:0}}),lens],
  ['extra ideal lens',r=>r.components.push({...structuredClone(component(r,'L1')),id:'L2',parameters:{...component(r,'L1').parameters,x:200}}),lens],
  ['source intersects slab first plane',r=>component(r,'B1').parameters.x=0,slab],
  ['source straddles slab second plane',r=>component(r,'B1').parameters.x=60,slab],
  ['inconsistent slab indices',r=>component(r,'I2').parameters.negativeIndex=2,slab],
  ['nonparallel interface normals',r=>component(r,'I2').parameters.normalDeg=90,slab],
  ['collapsed medium',r=>component(r,'I2').parameters.x=.005,slab],
  ['detector crosses refractive boundary',r=>component(r,'D1').parameters.x=0,slab],
  ['ray tangent to refractive plane',r=>component(r,'B1').parameters.directionDeg=90,slab],
  ['unsupported lens and planar interface',r=>r.components.push({id:'I1',type:'planar-interface',parameters:{x:50,y:0,normalDeg:0,negativeIndex:1,positiveIndex:1.5,partialReflection:false}}),lens],
  ['density too low for first sample',r=>{r.components=r.components.filter(c=>c.id!=='A1');component(r,'B1').parameters.width=10;r.runPolicy='preview-v1';},null]
 ];
 // For the final sampling boundary use a directly validated canonical edit:
 // the sparse numeric policy is only authorable by subsequent explicit control.
 for(const [name,change,parent] of cases){
  if(parent===null)continue;
  const r=structuredClone(parent);change(r);
  assert.throws(()=>prepareScene(r),undefined,name);
 }
 const doc=prepared(copy('lens'));
 const thin=structuredClone(doc);thin.simulation.rayDensity=.048;thin.physics.components[0].parameters.width=10;
 assert.throws(()=>validate(thin),/sampled|zero|density/i);
});
