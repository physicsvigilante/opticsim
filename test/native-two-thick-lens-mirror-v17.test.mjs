// Proposed v17 public bounded composition: 2 finite thick spherical lenses,
// 1 finite native Mirror, and an explicitly version-specific deeper ray budget.
// Tests observe pinned-native callbacks. None prescribes a ray itinerary.
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
import {TWO_THICK_MIRROR_MODEL,TWO_THICK_MIRROR_NATIVE_DEPTH} from '../src/two-thick-lens-mirror-composition.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(new URL('../examples/native-two-thick-lens-mirror-v17.json',import.meta.url),'utf8'));
const make=()=>structuredClone(fixture.physical);
const c=(r,id)=>r.components.find(x=>x.id===id);
const lens=(r,id)=>c(r,id).parameters;
const prepare=r=>prepareScene(r).document;
const run=(doc,requests=fixture.requests)=>evaluateDocument(doc,core,requests);
const close=(x,y,t=1e-7)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<t,`${x} != ${y}`);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const evidenceFace=(e,p)=>{
 const front=e.point.x<p.x,R=front?p.frontRadius:p.backRadius,
  cx=front?p.x-p.centerThickness/2+R:p.x+p.centerThickness/2-R;
 assert.ok(Math.abs(e.point.y-p.y)<p.apertureHeight/2-.01);
 close(Math.hypot(e.point.x-cx,e.point.y-p.y),R,1e-5);
 const n={x:(e.point.x-cx)/R,y:(e.point.y-p.y)/R};
 const leaving=dot(e.incoming,n)>0,ni=leaving?p.insideIndex:p.outsideIndex,
  nt=leaving?p.outsideIndex:p.insideIndex;
 assert.equal(e.outgoing.length,1,'Fresnel-off transmits one true native outgoing');
 assert.ok(dot(e.incoming,n)*dot(e.outgoing[0],n)>0);
 close(ni*cross(e.incoming,n),nt*cross(e.outgoing[0],n),1e-7);
 return {face:front?'front-arc':'back-arc',from:leaving?'inside':'outside',
  point:e.point,ni,nt};
};
test('v17 native two-lens mirror return is physically traced, never authored as a route',async()=>{
 const r=make(),original=JSON.stringify(r),prepared=prepareScene(r),doc=prepared.document;
 assert.equal(JSON.stringify(r),original,'No supplied apparatus silently repaired');
 assert.equal(doc.schemaVersion,17);assert.equal(doc.adapterVersion,17);
 assert.equal(doc.physics.model,TWO_THICK_MIRROR_MODEL);
 assert.equal(prepared.preparation.runPolicy,'native-deep-v17');
 assert.equal(doc.simulation.maxRayDepth,TWO_THICK_MIRROR_NATIVE_DEPTH);
 assert.equal(doc.simulation.processedRayLimit,10000);
 assert.deepEqual(core.compile(doc).native.objs.map(x=>x.type),
  ['SingleRay','SphericalLens','SphericalLens','Mirror','Detector']);
 assert.deepEqual(parseSave(serializeSave(doc)),doc);
 const native=inspectNative(doc),ids=native.trace.map(x=>x.id);
 assert.deepEqual(ids,['D1','L1','L1','L2','L2','M1','L2','L2','L1','L1','D1']);
 assert.equal(native.diagnostic.truncation,0);
 assert.equal(native.diagnostic.undefinedBehavior,0);
 assert.equal(native.diagnostic.interfacesById.L1.interactions,4);
 assert.equal(native.diagnostic.interfacesById.L2.interactions,4);
 assert.equal(native.diagnostic.reflectionsById.M1,1);
 assert.equal(native.diagnostic.detectorsById.D1.crossings,2);
 for(const id of ['L1','L2']){
  assert.equal(native.diagnostic.interfacesById[id].faces['front-arc'].interactions,2);
  assert.equal(native.diagnostic.interfacesById[id].faces['back-arc'].interactions,2);
 }
 const faces=native.trace.filter(e=>e.id==='L1'||e.id==='L2')
  .map(e=>({id:e.id,...evidenceFace(e,lens(r,e.id))}));
 assert.deepEqual(faces.map(x=>x.id),['L1','L1','L2','L2','L2','L2','L1','L1']);
 assert.deepEqual(faces.map(x=>x.from),
  ['outside','inside','outside','inside','outside','inside','outside','inside']);
 const mirror=native.trace.find(e=>e.id==='M1');
 close(mirror.point.x,300);
 close(mirror.outgoing[0].x,-mirror.incoming.x);
 close(mirror.outgoing[0].y,mirror.incoming.y);
 const result=run(doc),read=await evaluateObservables(doc,fixture.requests,result.summary);
 assert.equal(result.summary.native.status,'completed');
 assert.equal(result.summary.executionPassed,true);
 assert.deepEqual(read.results.map(x=>x.status),Array(fixture.requests.length).fill('qualified'));
 assert.deepEqual(read.results.map(x=>typeof x.value==='number'?x.value:null),
  [4,4,null,null,1,2]);
 assert.ok(read.results.every(x=>x.warnings.some(w=>w.includes('approximation'))));
 const unavailable=(await evaluateObservables(doc,[{id:'image',kind:'ideal-image',componentId:'S1'}],result.summary)).results[0];
 assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.value,null);
 console.log('V17_NATIVE_DEEP_RETURN '+JSON.stringify({status:result.summary.native.status,
  rayDepth:doc.simulation.maxRayDepth,ids,faces,mirrorPoint:mirror.point,
  detector:native.trace.filter(x=>x.id==='D1').map(x=>x.point)}));
});
test('v17 default deep policy is explicit; preview depth 8 remains intentionally incomplete and withheld',async()=>{
 const request=make();delete request.runPolicy;
 const p=prepareScene(request),d=p.document;
 assert.equal(d.schemaVersion,17);
 assert.equal(p.preparation.runPolicy,'native-deep-v17');
 assert.equal(d.simulation.maxRayDepth,16);
 const shallow=make();shallow.runPolicy='preview-v1';
 const doc=prepare(shallow),summary=run(doc).summary;
 assert.equal(doc.schemaVersion,17);
 assert.equal(doc.simulation.maxRayDepth,8);
 assert.equal(summary.native.status,'incomplete');
 assert.ok(summary.native.truncation>0);
 assert.equal(summary.executionPassed,false);
 const measured=await evaluateObservables(doc,fixture.requests,summary);
 assert.ok(measured.results.every(x=>x.status==='suppressed'&&x.value===null));
 // Forging a deeper budget in any older saved model remains a hard error.
 for(const path of ['../examples/native-thick-lens-mirror-v16.json',
                    '../examples/native-thick-lens-train.json']){
  const older=JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
  const valid=prepare(older.physical);
  assert.ok(valid.schemaVersion===15||valid.schemaVersion===16);
  const forged=structuredClone(valid);forged.simulation.maxRayDepth=16;
  assert.throws(()=>validate(forged),'Old versions must retain their original depth-8 cap');
  const requestOld=structuredClone(older.physical);requestOld.runPolicy='native-deep-v17';
  assert.throws(()=>prepare(requestOld),'Deep policy cannot be used for old optical profiles');
 }
 const tooDeep=structuredClone(d);tooDeep.simulation.maxRayDepth=17;
 assert.throws(()=>validate(tooDeep),'Even v17 cannot exceed its reviewed maximum 16');
 console.log('V17_DEPTH_QUALIFICATION '+JSON.stringify({defaultDepth:d.simulation.maxRayDepth,
  previewDepth:doc.simulation.maxRayDepth,previewStatus:summary.native.status,
  truncation:summary.native.truncation}));
});
test('v17 authentic mirror miss, off-axis transmission and object-list reversal',()=>{
 const missing=make();c(missing,'M1').parameters.y=500;
 const d=prepare(missing),e=inspectNative(d);
 assert.deepEqual(e.trace.map(x=>x.id),['D1','L1','L1','L2','L2']);
 assert.equal(e.diagnostic.detectorsById.D1.crossings,1);
 const offset=make();c(offset,'S1').parameters.y=2;
 const a=inspectNative(prepare(offset));
 const reversed=structuredClone(offset);reversed.components.reverse();
 const b=inspectNative(prepare(reversed));
 assert.deepEqual(a.trace.map(x=>x.id),['D1','L1','L1','L2','L2','M1','L2','L2','L1','L1','D1']);
 assert.deepEqual(b.trace.map(x=>x.id),a.trace.map(x=>x.id));
 for(let i=0;i<a.trace.length;i++){
  close(a.trace[i].point.x,b.trace[i].point.x,1e-7);
  close(a.trace[i].point.y,b.trace[i].point.y,1e-7);
 }
 const metrics=run(prepare(offset)).summary;
 assert.equal(metrics.native.status,'completed');
 console.log('V17_NATIVE_OFFAXIS_MISS '+JSON.stringify({offaxis:a.trace.map(x=>x.id),
  missedMirror:e.trace.map(x=>x.id),reversedOrderSame:true}));
});
test('v17 multiple exact sources are independent but do not infer ray ancestry',async()=>{
 const r=make(),additional=structuredClone(c(r,'S1'));additional.id='S2';additional.parameters.y=2;r.components.push(additional);
 const d=prepare(r),s=run(d).summary,native=inspectNative(d),diag=native.diagnostic;
 assert.equal(s.native.status,'completed');
 assert.equal(diag.emissionsById.S1.emitted,1);assert.equal(diag.emissionsById.S2.emitted,1);
 assert.equal(diag.interfacesById.L1.interactions,8);
 assert.equal(diag.interfacesById.L2.interactions,8);
 assert.equal(diag.reflectionsById.M1,2);
 assert.equal(diag.detectorsById.D1.crossings,4);
 const requests=[{id:'s1',kind:'source-emissions',componentId:'S1'},
 {id:'s2',kind:'source-emissions',componentId:'S2'},
 {id:'a',kind:'interface-interactions',componentId:'L1'},
 {id:'b',kind:'interface-interactions',componentId:'L2'},
 {id:'m',kind:'mirror-reflections',componentId:'M1'},
 {id:'d',kind:'detector-crossings',componentId:'D1'}];
 const values=await evaluateObservables(d,requests,run(d,requests).summary);
 assert.deepEqual(values.results.map(v=>v.value),[1,1,8,8,2,4]);
 assert.ok(values.results.every(v=>v.status==='qualified'));
});
test('v17 rejects unsupported material/geometry/scope without deleting components',()=>{
 const original=make(),baseline=prepare(original);
 const refusals=[
  r=>lens(r,'L2').outsideIndex=1.2,
  r=>lens(r,'L1').frontRadius=40,
  r=>lens(r,'L2').centerThickness=20,
  r=>lens(r,'L2').x=25,
  r=>lens(r,'L2').x=30,
  r=>{c(r,'M1').parameters.x=165.009;},
  r=>{c(r,'M1').parameters.x=75;c(r,'M1').parameters.orientationDeg=35;c(r,'M1').parameters.length=200;},
  r=>{c(r,'M1').parameters.x=9999;c(r,'M1').parameters.orientationDeg=0;},
  r=>c(r,'S1').parameters.x=0,
  r=>{c(r,'M1').parameters.x=-200;c(r,'M1').parameters.y=0;},
  r=>c(r,'D1').parameters.x=150,
  r=>c(r,'S1').emission.mode='directional',
  r=>r.components.push({...structuredClone(c(r,'L2')),id:'L3',parameters:{...lens(r,'L2'),x:220}}),
  r=>r.components.push({...structuredClone(c(r,'M1')),id:'M2',parameters:{...c(r,'M1').parameters,x:400}}),
  r=>r.components.push({id:'Block',type:'line-blocker',parameters:{x:210,y:0,length:100,orientationDeg:90}})
 ];
 for(const [i,edit] of refusals.entries()){
  const r=structuredClone(original);edit(r);
  assert.throws(()=>prepare(r),undefined,`Invalid v17 physical case ${i}`);
 }
 const nearGap=make();c(nearGap,'M1').parameters.x=165.011;
 assert.equal(prepare(nearGap).schemaVersion,17);
 const reordered=structuredClone(original);reordered.components.reverse();
 assert.equal(prepare(reordered).schemaVersion,17);
 const cm=structuredClone(original);cm.lengthUnit='cm';
 for(const component of cm.components)for(const [key,value] of Object.entries(component.parameters))
  if(['x','y','apertureHeight','centerThickness','frontRadius','backRadius','length'].includes(key))
   component.parameters[key]=value/10;
 assert.deepEqual(prepare(cm),baseline);
 const v16=structuredClone(baseline);v16.schemaVersion=v16.adapterVersion=16;
 v16.physics.model='native-thick-lens-mirror-tracing';v16.simulation.maxRayDepth=8;
 assert.throws(()=>validate(v16),'Older schema may never admit two physical thick lenses and a mirror');
 const noMirror=structuredClone(original);noMirror.components=noMirror.components.filter(x=>x.id!=='M1');
 assert.throws(()=>prepare(noMirror),
  'Native-deep-v17 is never transferable to an older two-lens-only scene');
 delete noMirror.runPolicy;
 assert.equal(prepare(noMirror).schemaVersion,15);
 const oneLens=structuredClone(original);oneLens.components=oneLens.components.filter(x=>x.id!=='L2');
 assert.throws(()=>prepare(oneLens),
  'Native-deep-v17 is never transferable to an older one-lens/mirror scene');
 delete oneLens.runPolicy;
 assert.equal(prepare(oneLens).schemaVersion,16);
 assert.throws(()=>reviseComponents(baseline,{format:'opticsim-component-revision-v1',
  operations:[{op:'remove',id:'L2'}]}),'A v17 save may not implicitly downgrade to v16');
 assert.ok(capabilities().composition.profiles.some(p=>p.schemaVersion===17));
});
test('v17 physical edits and qualified export/reopen preserve identity and suppress stale readings',async()=>{
 const original=prepare(make()),evidence=run(original).summary;
 const updated=reviseScene(original,{changes:[{id:'M1',section:'parameters',key:'y',value:500}]}).document;
 assert.equal(updated.schemaVersion,17);
 const stale=await evaluateObservables(updated,fixture.requests,evidence);
 assert.ok(stale.results.every(x=>x.value===null&&x.status==='suppressed'));
 assert.equal(run(updated).summary.native.status,'completed');
 const q=initialQualification(original,null,{inputSha256:'d'.repeat(64)});
 const child=recordQualifiedEdit(original,updated,q);
 const parsed=await parseQualifiedBundle(JSON.stringify(await createQualifiedBundle(updated,child,fixture.requests)));
 assert.deepEqual(parsed.scene,updated);
 assert.equal(parsed.scene.simulation.maxRayDepth,16);
 assert.equal(parsed.scene.physics.components.find(x=>x.id==='L2').parameters.insideIndex,1.3);
 assert.throws(()=>reviseScene(original,{changes:[{id:'M1',section:'parameters',key:'x',value:150}]}));
});
test('v17 native full Fresnel remains incomplete/withheld rather than claiming a complete power tree',async()=>{
 const d=prepare(make());
 for(const p of d.physics.components.filter(x=>x.type==='spherical-lens'))
  p.parameters.partialReflection=true;
 const result=run(d),measured=await evaluateObservables(d,fixture.requests,result.summary);
 assert.equal(result.summary.native.status,'incomplete');
 assert.ok(result.summary.native.truncation>0||result.summary.native.undefinedBehavior>0);
 assert.equal(result.summary.executionPassed,false);
 assert.ok(measured.results.every(x=>x.status==='suppressed'&&x.value===null));
 console.log('V17_NATIVE_FRESNEL_GATING '+JSON.stringify({status:result.summary.native.status,
  truncation:result.summary.native.truncation,undefinedBehavior:result.summary.native.undefinedBehavior,
  requests:measured.results.map(x=>x.status)}));
});

test('v17 composition admits mirror between lenses without manufacturing L2 encounters',async()=>{
 const r=make();c(r,'M1').parameters.x=75;
 const d=prepare(r),raw=inspectNative(d),ids=raw.trace.map(e=>e.id);
 assert.equal(d.schemaVersion,17);
 assert.deepEqual(ids,['D1','L1','L1','M1','L1','L1','D1']);
 assert.equal(raw.diagnostic.interfacesById.L1.interactions,4);
 assert.equal(raw.diagnostic.interfacesById.L2.interactions,0);
 assert.equal(raw.diagnostic.reflectionsById.M1,1);
 assert.equal(raw.diagnostic.detectorsById.D1.crossings,2);
 raw.trace.filter(e=>e.id==='L1').forEach(e=>evidenceFace(e,lens(r,'L1')));
 const s=run(d).summary,measured=await evaluateObservables(d,fixture.requests,s);
 assert.equal(s.native.status,'completed');
 assert.deepEqual(measured.results.map(x=>typeof x.value==='number'?x.value:null),
   [4,0,null,null,1,2]);
 assert.ok(measured.results.every(x=>x.status==='qualified'));
 console.log('V17_NATIVE_TOPOLOGY_CONTROLS '+JSON.stringify({
  topology:'mirror-between-lenses',ids,mirrorAt:75,unhitLens:'L2',
  runStatus:s.native.status
 }));
});
test('v17 genuinely reflects from mirror FIRST, then traverses the two thick lenses',()=>{
 const r=make();
 c(r,'S1').emission.directionDeg=180;
 c(r,'M1').parameters.x=-250;
 Object.assign(c(r,'D1').parameters,{x:350,y:0,length:400,orientationDeg:90});
 const doc=prepare(r),raw=inspectNative(doc),ids=raw.trace.map(x=>x.id);
 assert.deepEqual(ids,['M1','L1','L1','L2','L2','D1']);
 assert.equal(raw.diagnostic.reflectionsById.M1,1);
 assert.equal(raw.diagnostic.interfacesById.L1.interactions,2);
 assert.equal(raw.diagnostic.interfacesById.L2.interactions,2);
 assert.equal(raw.diagnostic.detectorsById.D1.crossings,1);
 raw.trace.filter(x=>x.id==='L1'||x.id==='L2')
  .forEach(e=>evidenceFace(e,lens(r,e.id)));
 const mirror=raw.trace.find(x=>x.id==='M1');
 assert.ok(mirror.incoming.x<0&&mirror.outgoing[0].x>0);
 close(mirror.outgoing[0].x,-mirror.incoming.x);
 close(mirror.outgoing[0].y,mirror.incoming.y);
 console.log('V17_NATIVE_MIRROR_FIRST '+JSON.stringify({
  ids,mirrorPoint:mirror.point,status:'completed'}));
});
test('v17 genuinely misses both finite lenses while reflecting at the finite mirror',async()=>{
 const r=make();c(r,'S1').parameters.y=80;
 const d=prepare(r),raw=inspectNative(d),ids=raw.trace.map(e=>e.id);
 assert.deepEqual(ids,['D1','M1','D1']);
 assert.equal(raw.diagnostic.interfacesById.L1.interactions,0);
 assert.equal(raw.diagnostic.interfacesById.L2.interactions,0);
 assert.equal(raw.diagnostic.reflectionsById.M1,1);
 assert.equal(raw.diagnostic.detectorsById.D1.crossings,2);
 const result=run(d).summary;
 assert.equal(result.native.status,'completed');
 const read=await evaluateObservables(d,fixture.requests,result);
 assert.deepEqual(read.results.map(x=>typeof x.value==='number'?x.value:null),
  [0,0,null,null,1,2]);
 assert.ok(read.results.every(x=>x.status==='qualified'));
 console.log('V17_NATIVE_LENS_MISS '+JSON.stringify({ids,status:result.native.status,
  detectorCrossings:raw.diagnostic.detectorsById.D1.crossings}));
});
test('v17 reverse illumination returns through both native lens bodies from the right',()=>{
 const r=make();
 Object.assign(c(r,'S1').parameters,{x:400,y:0});
 c(r,'S1').emission.directionDeg=180;
 c(r,'M1').parameters.x=-250;
 Object.assign(c(r,'D1').parameters,{x:350,y:0,orientationDeg:90,length:400});
 const d=prepare(r),raw=inspectNative(d),ids=raw.trace.map(e=>e.id);
 assert.deepEqual(ids,['D1','L2','L2','L1','L1','M1','L1','L1','L2','L2','D1']);
 assert.equal(raw.diagnostic.interfacesById.L1.interactions,4);
 assert.equal(raw.diagnostic.interfacesById.L2.interactions,4);
 assert.equal(raw.diagnostic.reflectionsById.M1,1);
 assert.equal(raw.diagnostic.detectorsById.D1.crossings,2);
 raw.trace.filter(e=>e.id==='L1'||e.id==='L2')
  .forEach(e=>evidenceFace(e,lens(r,e.id)));
 console.log('V17_NATIVE_REVERSE_RETURN '+JSON.stringify({
  ids,status:'completed',mirror:raw.trace.find(e=>e.id==='M1').point
 }));
});
