import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {prepareScene,reviseScene} from '../src/authoring.js';
import {validate,serializeSave,parseSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {createQualifiedBundle,initialQualification,parseQualifiedBundle} from '../src/qualification.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const first=JSON.parse(readFileSync(new URL('../evaluation/planar-refraction-v1/first-request.json',import.meta.url)));
const request=()=>structuredClone(first.request);
const doc=(r=request())=>prepareScene(r).document;
const execute=d=>evaluateDocument(d,core);
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const event=r=>r.report.native.diagnostics.interfacesById.I1.first;
const angleExpected=(i,n1,n2)=>Math.asin(n1/n2*Math.sin(i*Math.PI/180))*180/Math.PI;

test('planar v5 is explicit; all old requests and v4 scopes remain unchanged',()=>{
 const r=request(),original=structuredClone(r),d=doc(r);
 assert.equal(d.schemaVersion,5);assert.equal(d.physics.model,'planar-media-tracing');assert.deepEqual(r,original);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 const old=JSON.parse(readFileSync(new URL('../scenes/general-source-only.json',import.meta.url)));
 assert.equal(parseSave(serializeSave(old)).schemaVersion,4);
 const fake=structuredClone(d);fake.schemaVersion=fake.adapterVersion=4;assert.throws(()=>validate(fake));
 const unrelated=structuredClone(d);unrelated.physics.model='ideal-thin-lens-geometric';assert.throws(()=>validate(unrelated));
});
test('planar fields, material indices and emission are required, never illustration defaults',()=>{
 for(const key of ['negativeIndex','positiveIndex','partialReflection','normalDeg']){const r=request();delete r.components[1].parameters[key];assert.throws(()=>doc(r),/Required/);}
 for(const v of [0,-1,4.1,NaN,null,'1.5']){const r=request();r.components[1].parameters.positiveIndex=v;assert.throws(()=>doc(r));}
 for(const v of [0,1,null,'true']){const r=request();r.components[1].parameters.partialReflection=v;assert.throws(()=>doc(r));}
 const r=request();delete r.components[0].emission.directionDeg;assert.throws(()=>doc(r),/directionDeg/);
 r.components[0].emission={mode:'directional',directionDeg:30,angleDeg:1};assert.throws(()=>doc(r),/single-ray/);
});
test('planar geometry rejects inconsistent media, crossing surfaces and ambiguous regions',()=>{
 const base=request(),other=structuredClone(base.components[1]);other.id='I2';other.parameters.x=10;other.parameters.negativeIndex=1.5;other.parameters.positiveIndex=1.33;
 const r={...base,components:[...base.components,other]};assert.doesNotThrow(()=>doc(r));
 for(const [key,value] of [['normalDeg',30],['x',0],['negativeIndex',1.4]]){const bad=structuredClone(r);bad.components[2].parameters[key]=value;assert.throws(()=>doc(bad));}
 const on=request();on.components[0].parameters.x=0;assert.throws(()=>doc(on),/0.01/);
 const cross=request();cross.components.push({id:'D1',type:'ray-detector',parameters:{x:0,y:10,length:10,orientationDeg:0}});assert.throws(()=>doc(cross),/wholly/);
 const lens=request();lens.components.push({id:'L1',type:'ideal-lens',parameters:{x:20,focalLength:10,apertureHeight:10}});assert.throws(()=>doc(lens),/lenses/);
});
test('native PlaneGlass reproduces normal, oblique and reversed refraction with explicit media',()=>{
 for(const [x,direction,incidence,n1,n2] of [[-10,0,0,1,1.5],[-10,30,30,1,1.5],[-10,60,60,1,1.5],[10,150,30,1.5,1]]){
  const r=request();r.components[0].parameters.x=x;r.components[0].emission.directionDeg=direction;
  const run=execute(doc(r)),e=event(run);assert.equal(run.summary.executionPassed,true);
  close(e.incidentAngleDeg,incidence);close(e.transmittedAngleDeg,angleExpected(incidence,n1,n2));close(e.reflectedAngleDeg,incidence);
  close(e.branches.reduce((n,b)=>n+b.relativePower,0),e.incidentRelativePower);assert.equal(e.incidentIndex,n1);assert.equal(e.destinationIndex,n2);
  if(incidence===0){close(e.branches.find(b=>b.kind==='reflected').relativePower,.04);close(e.branches.find(b=>b.kind==='transmitted').relativePower,.96);}
 }
 const normalized=request();normalized.components[1].parameters.negativeIndex=1.33;normalized.components[1].parameters.positiveIndex=2;
 const run=execute(doc(normalized));assert.equal(run.summary.executionPassed,true);close(event(run).transmittedAngleDeg,angleExpected(30,1.33,2));
});
test('native TIR and near-critical decisions preserve missing transmission instead of zero',async()=>{
 const critical=Math.asin(1/1.5)*180/Math.PI;
 for(const incidence of [critical-1e-5,critical+1e-5,50]){
  const r=request();r.components[0].parameters.x=10;r.components[0].emission.directionDeg=180-incidence;
  const d=doc(r),run=execute(d),e=event(run);assert.equal(run.summary.executionPassed,true);
  close(e.incidentAngleDeg,incidence);
  if(incidence>critical){assert.equal(e.outcome,'total-internal-reflection');assert.equal(e.transmittedAngleDeg,null);close(e.reflectedAngleDeg,incidence);}
  else close(e.transmittedAngleDeg,angleExpected(incidence,1.5,1),1e-6);
  const out=await evaluateObservables(d,first.observables,run.summary);
  assert.equal(out.results.find(r=>r.id==='transmission').status,incidence>critical?'unavailable':'available');
 }
});
test('layer composition uses native overlapping ratios; Fresnel truncation is not repaired',async()=>{
 const r=request(),second=structuredClone(r.components[1]);second.id='I2';second.parameters.x=10;second.parameters.negativeIndex=1.5;second.parameters.positiveIndex=1.33;r.components.push(second);
 const full=execute(doc(r));assert.equal(full.summary.native.status,'incomplete');assert.ok(full.summary.native.truncation>0);assert.equal(full.summary.observations,null);
 const blocked=await evaluateObservables(doc(r),first.observables,full.summary);assert.ok(blocked.results.every(x=>x.status==='suppressed'));
 for(const c of r.components.filter(c=>c.type==='planar-interface'))c.parameters.partialReflection=false;
 const d=doc(r),run=execute(d);assert.equal(run.summary.executionPassed,true);
 const a=run.summary.observations.interfacesById;close(a.I1.first.transmittedAngleDeg,angleExpected(30,1,1.5));
 close(a.I2.first.incidentAngleDeg,a.I1.first.transmittedAngleDeg);close(a.I2.first.transmittedAngleDeg,angleExpected(30,1,1.33));
 assert.equal(a.I2.reflected,0);
 const out=await evaluateObservables(d,first.observables,run.summary);assert.equal(out.results[0].status,'qualified');assert.ok(out.results[0].warnings.some(s=>s.includes('approximation')));
});
test('native angle/power evidence survives units, component order and normal rotation',()=>{
 const base=execute(doc()),expected=event(base);
 for(const [unit,scale] of [['mm',10],['m',.01]]){
  const r=request();r.lengthUnit=unit;for(const c of r.components){c.parameters.x*=scale;c.parameters.y*=scale;}
  r.components.reverse();const run=execute(doc(r));assert.equal(run.summary.executionPassed,true);close(event(run).transmittedAngleDeg,expected.transmittedAngleDeg);
 }
 const r=request(),a=37*Math.PI/180;r.components[0].parameters.x=-10*Math.cos(a);r.components[0].parameters.y=-10*Math.sin(a);r.components[0].emission.directionDeg=67;r.components[1].parameters.normalDeg=37;
 const rotated=execute(doc(r));assert.equal(rotated.summary.executionPassed,true);close(event(rotated).incidentAngleDeg,30);close(event(rotated).transmittedAngleDeg,expected.transmittedAngleDeg);
});
test('interface observers delegate exactly once and preserve native arguments, rays and return object',()=>{
 const d=doc(),a=core.loadDocument(d),b=core.loadDocument(d),native=a.scene.objs[a.idMap.get('I1')],ref=b.scene.objs[b.idMap.get('I1')];
 const ray=a.scene.objs[a.idMap.get('S1')].onSimulationStart().newRays[0];assert.equal(ray.gap,true);
 const copy=structuredClone(ray),point=native.checkRayIntersects(ray),other=structuredClone(point),merges=[];
 const original=native.onRayIncident;let calls=0,returned;
 native.onRayIncident=function(...args){calls++;assert.equal(args[0],ray);assert.equal(args[2],point);assert.equal(args[3],merges);returned=original.apply(this,args);return returned;};
 const meter=core.observeInterfaceSet(d,a.scene,a.idMap),actual=native.onRayIncident(ray,0,point,merges),expected=ref.onRayIncident(copy,0,other,[]);
 assert.equal(calls,1);assert.equal(actual,returned);assert.deepEqual(actual,expected);assert.deepEqual(ray,copy);assert.equal(meter.byId.I1.interactions,1);
 assert.deepEqual(a.scene.objs.map(o=>o.serialize()),b.scene.objs.map(o=>o.serialize()));
});
test('no-hit, equal-index, zero-angle and stale/incomplete outcomes stay distinct',async()=>{
 const r=request();r.components[0].emission.directionDeg=180;const d=doc(r),run=execute(d);
 const requests=[...first.observables,{id:'count',kind:'interface-interactions',componentId:'I1'}];
 const results=(await evaluateObservables(d,requests,run.summary)).results;assert.equal(results.at(-1).value,0);assert.equal(results[0].status,'unavailable');
 const equal=request();equal.components[0].emission.directionDeg=0;equal.components[1].parameters.positiveIndex=1;
 const er=execute(doc(equal));assert.equal(er.summary.executionPassed,true);close(event(er).transmittedAngleDeg,0);assert.equal(event(er).reflectedAngleDeg,null);
 const fresh=doc(),ok=execute(fresh),stale=reviseScene(fresh,{changes:[{id:'S1',section:'emission',key:'directionDeg',value:40}]}).document;
 assert.ok((await evaluateObservables(stale,first.observables,ok.summary)).results.every(r=>r.status==='suppressed'));
 fresh.simulation.maxRayDepth=0;const truncated=execute(fresh);assert.equal(truncated.summary.native.status,'incomplete');
 assert.ok((await evaluateObservables(fresh,first.observables,truncated.summary)).results.every(r=>r.status==='suppressed'));
});
test('qualified packages and parameter sweeps reuse accepted native refraction scenes',async()=>{
 const d=doc(),q=initialQualification(d,null,{inputSha256:'a'.repeat(64),interpretation:first.interpretation}),b=await createQualifiedBundle(d,q,first.observables);
 assert.deepEqual((await parseQualifiedBundle(JSON.stringify(b))).scene,d);
 const report=await runParameterSweep(b,{format:'opticsim-parameter-sweep-v1',expectedSceneSha256:b.sceneSha256,...first.sweep},{execute});
 assert.equal(report.completedSamples,5);assert.equal(report.failedSamples,0);
 for(const s of report.samples)close(s.requestedResults.results[1].value,angleExpected(s.value,1,1.5));
 assert.deepEqual(b.scene,d);
 const changed=reviseScene(d,{changes:[{id:'I1',section:'parameters',key:'partialReflection',value:false}]}).document;
 assert.equal(changed.physics.components[1].parameters.partialReflection,false);
});
test('parallel slab supports reversed travel and sources inside an explicitly indexed layer',()=>{
 const make=()=>{const r=request();r.components[1].parameters.partialReflection=false;
  r.components.push({id:'I2',type:'planar-interface',parameters:{x:10,y:0,normalDeg:0,negativeIndex:1.5,positiveIndex:1,partialReflection:false}});return r;};
 for(const [x,direction,last,expected] of [[-10,30,'I2',30],[20,150,'I1',30],[5,30,'I2',angleExpected(30,1.5,1)]]){
  const r=make();r.components[0].parameters.x=x;r.components[0].emission.directionDeg=direction;
  const out=execute(doc(r));assert.equal(out.summary.executionPassed,true);
  close(out.summary.observations.interfacesById[last].first.transmittedAngleDeg,expected);
 }
});
test('native detectors and finite mirrors compose within explicitly bounded medium sides',()=>{
 const r=request();r.components.push({id:'D1',type:'ray-detector',parameters:{x:5,y:10,length:40,orientationDeg:90}});
 const out=execute(doc(r));assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.observations.detectorsById.D1.crossings,1);
 close(Math.abs(out.summary.observations.detectorsById.D1.signedPower),event(out).branches.find(b=>b.kind==='transmitted').relativePower);
 r.components[1].parameters.partialReflection=false;
 r.components.push({id:'M1',type:'plane-mirror',parameters:{x:10,y:10,length:40,orientationDeg:90}});
 const reflected=execute(doc(r));assert.equal(reflected.summary.executionPassed,true);
 assert.equal(reflected.summary.observations.reflectionsById.M1,1);assert.equal(reflected.summary.observations.detectorsById.D1.crossings,2);
 assert.equal(reflected.summary.observations.interfacesById.I1.interactions,2);
});
