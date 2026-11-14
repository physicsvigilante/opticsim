import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,capabilities} from '../src/authoring.js';
import {validate,serializeSave,parseSave,UPSTREAM} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {createQualifiedBundle,initialQualification,parseQualifiedBundle} from '../src/qualification.js';
import {prepareQualifiedStructure} from '../src/qualified-structure.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
import {inspectNative,transform} from './helpers/native-composition-inspection.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/finite-glass-two-mirrors.json',import.meta.url)));
const request=()=>structuredClone(fixture.physical);
const part=(r,id)=>r.components.find(c=>c.id===id);
const doc=(r=request())=>prepareScene(r).document;
const execute=d=>evaluateDocument(d,core);
const patch=operations=>({format:'opticsim-component-revision-v1',operations});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const bundleFor=async d=>createQualifiedBundle(d,initialQualification(d,null,{inputSha256:'b'.repeat(64),interpretation:fixture.interpretation}),fixture.requests);

test('v11 composes one or two mirrors in the same family without widening v9/v10 or leaking policy mutations',()=>{
 const r=request(),before=structuredClone(r),d=doc(r);assert.deepEqual(r,before);
 assert.equal(d.schemaVersion,11);assert.equal(d.adapterVersion,11);assert.equal(d.physics.model,'finite-dielectric-composition');assert.equal(d.upstreamCommit,UPSTREAM);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 const c=capabilities().extendedFiniteDielectricComposition;
 assert.equal(c.schemaVersion,11);assert.deepEqual(c.counts['plane-mirror'],{min:1,max:2});
 c.counts['plane-mirror'].max=99;delete c.counts['polygon-dielectric'];
 assert.deepEqual(capabilities().extendedFiniteDielectricComposition.counts['plane-mirror'],{min:1,max:2});
 for(const version of [4,5,6,7,8,9,10,12,'11']){const bad=structuredClone(d);bad.schemaVersion=bad.adapterVersion=version;assert.throws(()=>validate(bad));}
 const one=request();one.components=one.components.filter(c=>c.id!=='M2');const historical=doc(one);
 assert.equal(historical.schemaVersion,10);
 assert.throws(()=>reviseComponents(historical,patch([{op:'add',lengthUnit:'mm',component:part(r,'M2')}])),/one external plane mirror/);
 const noMirror=request();noMirror.components=noMirror.components.filter(c=>c.type!=='plane-mirror');assert.equal(doc(noMirror).schemaVersion,9);
 const wrong=structuredClone(d);wrong.physics.model='general-component-tracing';assert.throws(()=>validate(wrong));
 const mismatched=structuredClone(d);mismatched.adapterVersion=10;assert.throws(()=>validate(mismatched));
 assert.throws(()=>reviseScene(d,{changes:[{id:'S1',section:'emission',key:'mode',value:'directional'}]}));
});

test('two independent native mirrors return through the same glass; fixed coordinates verify the actual encounters',()=>{
 const d=doc(),result=execute(d),o=result.summary.observations;assert.equal(result.summary.executionPassed,true);
 assert.equal(o.interfacesById.G1.interactions,4);assert.deepEqual(o.reflectionsById,{M1:1,M2:1});
 assert.equal(o.detectorsById.D1.crossings,1);close(o.detectorsById.D1.signedPower,1);
 assert.equal(result.summary.analysis.status,'unavailable');
 assert.deepEqual(core.loadDocument(d).scene.objs.map(o=>o.constructor.type),['SingleRay','Glass','Mirror','Mirror','Detector']);
 const checked=inspectNative(d);assert.deepEqual(checked.trace.map(e=>e.id),['G1','G1','M1','M2','G1','G1','D1']);
 const points=[[0,0],[20,0],[60,0],[60,20],[20,20],[0,20],[-20,20]];
 checked.trace.forEach((e,i)=>{close(e.point.x,points[i][0]);close(e.point.y,points[i][1]);});
 assert.deepEqual(checked.diagnostic.interfacesById,o.interfacesById);assert.deepEqual(checked.diagnostic.reflectionsById,o.reflectionsById);
});

test('per-encounter Snell and reflection invariants hold across 36 two-mirror transformations/material/angle variants',()=>{
 let cases=0;
 for(const rotation of [0,37,90])for(const scale of [.1,1,10])for(const indices of [[1.5,1],[2,1.33]])for(const direction of [0,3]){
  const r=request();part(r,'S1').emission.directionDeg=direction;
  Object.assign(part(r,'G1').parameters,{insideIndex:indices[0],outsideIndex:indices[1]});
  transform(r,rotation,scale,100,-75);const {diagnostic}=inspectNative(doc(r));
  assert.equal(diagnostic.interfacesById.G1.interactions,4);assert.deepEqual(diagnostic.reflectionsById,{M1:1,M2:1});
  assert.equal(diagnostic.detectorsById.D1.crossings,1);cases++;
 }assert.equal(cases,36);
 for(const [id,angle] of [['M1',43],['M1',47],['M2',133],['M2',137]]){
  const r=request();part(r,id).parameters.orientationDeg=angle;const {diagnostic}=inspectNative(doc(r));
  assert.deepEqual(diagnostic.reflectionsById,{M1:1,M2:1});
 }
 const trapezoid=request();part(trapezoid,'G1').parameters.x3=22;inspectNative(doc(trapezoid));
});

test('either finite mirror may be missed; actual zero counts never imply a scripted return or a missing measurement',async()=>{
 for(const [name,change,counts] of [
  ['first',r=>{part(r,'M1').parameters.y=-60;},{M1:0,M2:0}],
  ['second',r=>{part(r,'M2').parameters.x=100;},{M1:1,M2:0}],
  ['oblique miss',r=>{part(r,'S1').emission.directionDeg=-3;},{M1:1,M2:0}]
 ]){const r=request();change(r);const d=doc(r),out=execute(d);assert.equal(out.summary.executionPassed,true,name);
  assert.deepEqual(out.summary.observations.reflectionsById,counts);assert.equal(out.summary.observations.interfacesById.G1.interactions,2);
  assert.equal(out.summary.observations.detectorsById.D1.crossings,0);
  const results=(await evaluateObservables(d,fixture.requests,out.summary)).results;
  assert.equal(results[3].status,'qualified');assert.equal(results[3].value,0);
 }
 const r=request();part(r,'S1').emission.directionDeg=180;const out=execute(doc(r));
 assert.equal(out.summary.observations.interfacesById.G1.interactions,0);assert.deepEqual(out.summary.observations.reflectionsById,{M1:0,M2:0});
});

test('reverse illumination and internal sources are physical inputs, not assumed encounter orders',()=>{
 const r=request();part(r,'S1').parameters.y=20;part(r,'D1').parameters.y=0;
 const checked=inspectNative(doc(r));assert.deepEqual(checked.trace.map(e=>e.id),['G1','G1','M2','M1','G1','G1','D1']);
 close(checked.trace.at(-1).point.y,0);
 const inside=request();part(inside,'S1').parameters.x=10;const {diagnostic}=inspectNative(doc(inside));
 assert.equal(diagnostic.interfacesById.G1.interactions,3);assert.deepEqual(diagnostic.reflectionsById,{M1:1,M2:1});
 const mirrorFirst=request();Object.assign(part(mirrorFirst,'S1').parameters,{x:85,y:20});part(mirrorFirst,'S1').emission.directionDeg=180;
 const checkedFirst=inspectNative(doc(mirrorFirst));assert.equal(checkedFirst.trace[0].id,'M2');
});

test('TIR and matched-index transmission preserve native material outcomes with two external mirrors',async()=>{
 const r=request();Object.assign(part(r,'G1').parameters,{insideIndex:1,outsideIndex:1.5});
 part(r,'S1').parameters.y=-40*Math.tan(50*Math.PI/180);part(r,'S1').emission.directionDeg=50;
 const d=doc(r),out=execute(d),o=out.summary.observations;inspectNative(d);
 assert.equal(o.interfacesById.G1.totalInternalReflections,1);assert.deepEqual(o.reflectionsById,{M1:0,M2:0});
 const result=(await evaluateObservables(d,[{id:'t',kind:'interface-transmission-angle',componentId:'G1'}],out.summary)).results[0];
 assert.equal(result.status,'unavailable');assert.equal(result.value,null);
 const matched=request();Object.assign(part(matched,'G1').parameters,{outsideIndex:1.5,partialReflection:true});
 const evidence=execute(doc(matched));assert.equal(evidence.summary.executionPassed,true);assert.equal(evidence.summary.observations.interfacesById.G1.reflected,0);
});

test('every mirror and detector is checked against glass, other surfaces and every source before native work',()=>{
 const mutations=[
  r=>{part(r,'M2').parameters.x=10;},
  r=>{Object.assign(part(r,'M2').parameters,{x:60,y:0});},
  r=>{Object.assign(part(r,'M2').parameters,{x:60,y:0,orientationDeg:45});},
  r=>{Object.assign(part(r,'M2').parameters,{x:20,y:0,orientationDeg:90});},
  r=>{Object.assign(part(r,'M2').parameters,{x:20.009,y:0,orientationDeg:90});},
  r=>{Object.assign(part(r,'M2').parameters,{x:10000,y:0});},
  r=>{Object.assign(part(r,'D1').parameters,{x:60,y:20,orientationDeg:45});},
  r=>{Object.assign(part(r,'S1').parameters,{x:80,y:0});},
  r=>{r.components.push({...structuredClone(part(r,'M2')),id:'M3'});},
  r=>{r.components.push({...structuredClone(part(r,'G1')),id:'G2'});},
  r=>{r.components.push({id:'L',type:'ideal-lens',parameters:{x:-25,focalLength:30,apertureHeight:10}});},
  r=>{part(r,'S1').emission.mode='full-circle';},
  r=>{delete part(r,'M2').parameters.orientationDeg;},
  r=>{delete part(r,'G1').parameters.outsideIndex;},
  r=>{part(r,'G1').parameters.insideIndex=0;}
 ];
 for(const mutate of mutations){const r=request();mutate(r);const before=structuredClone(r);assert.throws(()=>doc(r));assert.deepEqual(r,before);}
 const separated=request();Object.assign(part(separated,'M2').parameters,{x:20.011,y:0,orientationDeg:90});assert.doesNotThrow(()=>doc(separated));
 const bad=structuredClone(doc());bad.physics.components=bad.physics.components.filter(c=>c.type!=='plane-mirror');assert.throws(()=>validate(bad));
});

test('v11 structural edits retain their version, stable identities and unbound removed-target requests',async()=>{
 const original=doc(),before=structuredClone(original);
 const one=reviseComponents(original,patch([{op:'remove',id:'M2'}])).document;
 assert.equal(one.schemaVersion,11);assert.equal(one.adapterVersion,11);assert.deepEqual(original,before);
 const out=execute(one);assert.equal(out.summary.executionPassed,true);
 const result=(await evaluateObservables(one,fixture.requests,out.summary)).results[3];assert.equal(result.status,'unavailable');assert.equal(result.value,null);
 const m3={...structuredClone(part(request(),'M2')),id:'M3'};
 const two=reviseComponents(one,patch([{op:'add',lengthUnit:'mm',component:m3}])).document;
 assert.equal(two.schemaVersion,11);assert.deepEqual(execute(two).summary.observations.reflectionsById,{M1:1,M3:1});
 assert.throws(()=>reviseComponents(one,patch([{op:'remove',id:'M1'}])));
 assert.throws(()=>reviseComponents(original,patch([{op:'add',lengthUnit:'mm',component:m3}])));
 const bundle=await bundleFor(original),qualified=await prepareQualifiedStructure(bundle,{...patch([{op:'remove',id:'M2'}]),expectedSha256:bundle.sceneSha256});
 const saved=await parseQualifiedBundle(JSON.stringify(await createQualifiedBundle(qualified.document,qualified.qualification,qualified.observables)));assert.equal(saved.scene.schemaVersion,11);
 assert.throws(()=>reviseScene(original,{changes:[{id:'M2',section:'parameters',key:'x',value:10}]}));
 await assert.rejects(()=>prepareQualifiedStructure(saved,{...patch([{op:'add',lengthUnit:'mm',component:part(request(),'M2')}]),expectedSha256:saved.sceneSha256}),e=>e.issues?.some(i=>i.code==='RETIRED_COMPONENT_ID'));
});

test('Fresnel, ninth encounter, loops, low budgets, corners and stale summaries suppress all accepted native readings',async()=>{
 for(const [name,mutate,expected] of [
  ['Fresnel',d=>{d.physics.components.find(c=>c.id==='G1').parameters.partialReflection=true;},'incomplete'],
  ['ninth encounter',d=>{d.physics.components.push({id:'D2',type:'ray-detector',parameters:{x:40,y:10,orientationDeg:90,length:40}});},'incomplete'],
  ['loop',d=>{Object.assign(d.physics.components.find(c=>c.id==='M1').parameters,{orientationDeg:90,length:30});Object.assign(d.physics.components.find(c=>c.id==='M2').parameters,{x:-60,y:0,orientationDeg:90,length:30});},'incomplete'],
  ['low depth',d=>{d.simulation.maxRayDepth=2;},'incomplete'],
  ['stop',d=>{d.simulation.processedRayLimit=1;},'stopped'],
  ['corner',d=>{d.physics.components.find(c=>c.id==='M2').parameters.y=30;},'failed']
 ]){const d=doc();mutate(d);validate(d);const out=execute(d);assert.equal(out.summary.native.status,expected,name);
  assert.equal(out.summary.observations,null);const results=(await evaluateObservables(d,fixture.requests,out.summary)).results;
  assert.ok(results.every(r=>r.status==='suppressed'&&r.value===null),name);
 }
 const d=doc(),out=execute(d),changed=reviseScene(d,{changes:[{id:'M2',section:'parameters',key:'x',value:100}]}).document;
 assert.ok((await evaluateObservables(changed,fixture.requests,out.summary)).results.every(r=>r.status==='suppressed'));
 assert.equal(d.simulation.maxRayDepth,8);assert.equal(core.loadDocument(d).scene.colorMode,'default');
 const eight=request();Object.assign(part(eight,'D1').parameters,{x:40,y:10,length:40});const complete=execute(doc(eight));
 assert.equal(complete.summary.executionPassed,true);assert.equal(complete.summary.observations.detectorsById.D1.crossings,2);close(complete.summary.observations.detectorsById.D1.signedPower,0);
});

test('units, winding, component order and up to four sources preserve native composition without source attribution',()=>{
 for(const unit of ['cm','m']){const r=request(),divisor=unit==='cm'?10:1000;r.lengthUnit=unit;
  for(const c of r.components)for(const key of capabilities().lengthParameters)if(key in c.parameters)c.parameters[key]/=divisor;
  r.components.reverse();const o=execute(doc(r)).summary.observations;assert.equal(o.interfacesById.G1.interactions,4);assert.deepEqual(o.reflectionsById,{M2:1,M1:1});
 }
 const winding=request(),p=part(winding,'G1').parameters,v=[1,2,3,4].map(i=>[p['x'+i],p['y'+i]]).reverse();
 v.forEach(([x,y],i)=>{p['x'+(i+1)]=x;p['y'+(i+1)]=y;});inspectNative(doc(winding));
 const r=request();for(let i=2;i<=4;i++)r.components.push({id:'S'+i,type:'point-source',parameters:{x:-40,y:i-1,brightness:.5},emission:{mode:'single-ray',directionDeg:0}});
 const d=doc(r),out=execute(d);assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.observations.interfacesById.G1.interactions,16);
 assert.deepEqual(out.summary.observations.reflectionsById,{M1:4,M2:4});assert.equal(out.summary.observations.detectorsById.D1.crossings,4);
 assert.equal(out.summary.observations.emissionsById.S4.emitted,1);
 r.components.push({...structuredClone(r.components.at(-1)),id:'S5'});assert.throws(()=>doc(r));
});

test('qualified mirror edits and immutable sweeps preserve source assumptions, failures and explicit result identities',async()=>{
 const d=doc(),bundle=await bundleFor(d),before=structuredClone(bundle);
 assert.deepEqual((await parseQualifiedBundle(JSON.stringify(bundle))).scene,d);
 const sweep=await runParameterSweep(bundle,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:bundle.sceneSha256,
  parameter:{id:'M2',section:'parameters',key:'x',unit:'mm'},values:[60,100,10],observables:fixture.requests},{execute});
 assert.equal(sweep.completedSamples,2);assert.equal(sweep.samples[2].status,'invalid-input');assert.deepEqual(bundle,before);
 const image=(await evaluateObservables(d,[{id:'image',kind:'ideal-image',componentId:'S1'}],execute(d).summary)).results[0];
 assert.equal(image.status,'unavailable');assert.equal(image.value,null);
});
