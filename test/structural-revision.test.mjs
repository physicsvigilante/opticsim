import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {prepareScene,reviseScene,reviseComponents,COMPONENT_REVISION_FORMAT,capabilities,AuthoringError} from '../src/authoring.js';
import {validate,serializeSave} from '../src/contract.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const prior=JSON.parse(readFileSync(new URL('../evaluation/teaching-fidelity-v1/plan.json',import.meta.url)));
const source=JSON.parse(readFileSync(new URL('../scenes/single-lens-detector.json',import.meta.url)));
const base=()=>prepareScene(structuredClone(prior.initialRequest)).document;
const detector=(id='detector-2',x=80)=>({id,type:'ray-detector',parameters:{x,y:0,orientationDeg:90,length:160}});
const patch=(operations)=>({format:COMPONENT_REVISION_FORMAT,operations});
const add=(component,lengthUnit='mm')=>({op:'add',lengthUnit,component});
const remove=id=>({op:'remove',id});
const qualified=async doc=>createQualifiedBundle(doc,initialQualification(doc,null,{
 inputSha256:'a'.repeat(64),interpretation:{
 source:{caseId:'original-fixture',path:'scenes/single-lens-detector.json'},
 stated:['This previously exposed source provides the exact original physical geometry.'],
 derived:[],assumptions:[],unknowns:[]
 }}),prior.observables);
const get=(doc,id)=>doc.physics.components.find(c=>c.id===id);
test('a discoverable contract edits structural components atomically without reauthoring original scene',()=>{
 const c=capabilities().structuralRevisions;
 assert.equal(c.format,COMPONENT_REVISION_FORMAT);
 assert.equal(c.maxOperations,8);
 const original=base(),old=serializeSave(original);
 assert.deepEqual(original.physics.components,source.physics.components);
 const p=patch([add(detector())]);
 const {document:next,addedIds,removedIds,operationsApplied}=reviseComponents(original,p);
 assert.equal(operationsApplied,1);
 assert.deepEqual(addedIds,['detector-2']);assert.deepEqual(removedIds,[]);
 assert.equal(next.physics.components.length,4);
 assert.deepEqual(next.physics.components.slice(0,3),original.physics.components);
 assert.deepEqual(next.simulation,original.simulation);
 assert.deepEqual(next.presentation,original.presentation);
 assert.equal(next.physics.model,original.physics.model);
 assert.equal(next.schemaVersion,original.schemaVersion);
 assert.equal(serializeSave(original),old);
 validate(next);
});
test('new passive detector composes with unchanged lens and source in real pinned native tracing',async()=>{
 const old=base(),next=reviseComponents(old,patch([add(detector())])).document;
 const a=evaluateDocument(old,core).summary,b=evaluateDocument(next,core).summary;
 assert.equal(a.native.status,'completed');assert.equal(b.native.status,'completed');
 assert.equal(a.native.truncation,0);assert.equal(b.native.truncation,0);
 assert.equal(b.observations.detectorsById['detector-1'].crossings,
   a.observations.detectorsById['detector-1'].crossings);
 assert.ok(Number.isFinite(b.observations.detectorsById['detector-2'].crossings));
 assert.ok(b.observations.detectorsById['detector-2'].crossings>0);
 const q=await qualified(old),updated=recordQualifiedEdit(old,next,q.qualification);
 const bundle=await createQualifiedBundle(next,updated,[...q.observables,
   {id:'new-detector-crossings',kind:'detector-crossings',componentId:'detector-2'}]);
 assert.deepEqual(await parseQualifiedBundle(JSON.stringify(bundle)),bundle);
 assert.deepEqual(bundle.qualification.origin,q.qualification.origin);
 assert.equal(bundle.qualification.edits.length,1);
 assert.equal(bundle.qualification.edits[0].kind,'physics');
 const results=await evaluateObservables(next,bundle.observables,b);
 assert.equal(results.results.at(-1).method,'native-observation');
 assert.equal(results.results.at(-1).value,b.observations.detectorsById['detector-2'].crossings);
 assert.equal(results.results[0].status,'conditional');
 assert.equal(results.results[0].nativeImageDetected,false);
});
test('new component uses explicit length units, never converts angles or brightness',()=>{
 const original=base(),p=detector('detector-cm',8);p.parameters.length=16;
 const next=reviseComponents(original,patch([add(p,'cm')])).document;
 assert.equal(get(next,'detector-cm').parameters.x,80);
 assert.equal(get(next,'detector-cm').parameters.length,160);
 assert.equal(get(next,'detector-cm').parameters.orientationDeg,90);
 assert.equal(get(original,'detector-cm'),undefined);
 assert.deepEqual(next.simulation,original.simulation);
});
test('multiple generic type additions reuse the same geometry validator; no detector-specific native lowerer',()=>{
 const original=base();
 const operations=[
  add({id:'mirror-2',type:'plane-mirror',parameters:{x:350,y:300,orientationDeg:60,length:75}}),
  add({id:'stop-1',type:'line-blocker',parameters:{x:500,y:-300,orientationDeg:0,length:60}})
 ];
 const next=reviseComponents(original,patch(operations)).document;
 assert.equal(next.physics.components.length,5);
 assert.deepEqual(next.physics.components.slice(0,3),original.physics.components);
 const objects=core.compile(next).native.objs;
 assert.equal(objects.filter(x=>x.type==='Mirror').length,1);
 assert.equal(objects.filter(x=>x.type==='Blocker').length,1);
});
test('add and remove distinct IDs in one atomic operation, preserving survivor identities and no field rewrites',()=>{
 const old=base();
 const out=reviseComponents(old,patch([remove('detector-1'),add(detector('detector-2',80))]));
 assert.deepEqual(out.addedIds,['detector-2']);
 assert.deepEqual(out.removedIds,['detector-1']);
 assert.deepEqual(out.document.physics.components.slice(0,2),old.physics.components.slice(0,2));
 assert.equal(get(out.document,'detector-1'),undefined);
 assert.equal(get(out.document,'detector-2').parameters.x,80);
 const round=reviseComponents(out.document,patch([remove('detector-2')]));
 assert.equal(round.document.physics.components.length,2);
});
test('after a removed target, requested results are unavailable, not silently reassigned',async()=>{
 const old=base(),next=reviseComponents(old,patch([remove('detector-1')])).document;
 const native=evaluateDocument(next,core).summary;
 assert.equal(native.native.status,'completed');
 const results=await evaluateObservables(next,prior.observables,native);
 assert.equal(results.results.find(x=>x.id==='crossings').status,'unavailable');
 assert.equal(results.results.find(x=>x.id==='crossings').value,null);
 assert.equal(results.results.find(x=>x.id==='relative-power').status,'unavailable');
 assert.equal(results.results.find(x=>x.id==='emissions').status,'available');
});
test('full-circle added source may omit inactive directions but not active physical brightness',()=>{
 const old=base();
 const source2={id:'source-2',type:'point-source',parameters:{x:-200,y:300,brightness:0.2},
  emission:{mode:'full-circle'}};
 const next=reviseComponents(old,patch([add(source2)])).document;
 assert.equal(next.physics.components.length,4);
 assert.deepEqual(get(next,'source-2').emission,{mode:'full-circle',directionDeg:0,angleDeg:30});
 assert.equal(get(next,'source-2').parameters.brightness,0.2);
 assert.throws(()=>reviseComponents(old,patch([add({...source2,parameters:{x:-200,y:300}})])),/brightness/);
 for(const wrong of [{mode:'directional',directionDeg:0},{mode:'single-ray'}]){
  assert.throws(()=>reviseComponents(old,patch([add({...source2,emission:wrong})])),/mode|angle|emission/);
 }
});
test('invalid proposed overlap, zero geometry, and unknown fields cannot mutate current baseline',()=>{
 const old=base(),before=serializeSave(old);
 const bad=[
  patch([add(detector('touching-lens',0))]),
  patch([add(detector('zero-length',80))]),
  patch([add({...detector('extra',80),parameters:{x:80,y:0,orientationDeg:90}})]),
  patch([add({...detector('extra',80),parameters:{...detector().parameters,unknown:99}})]),
  patch([add({...detector('extra',80),inventedForce:42})])
 ];
 bad[1].operations[0].component.parameters.length=0;
 for(const proposal of bad)assert.throws(()=>reviseComponents(old,proposal),/./);
 assert.equal(serializeSave(old),before);
});
test('cannot replace stable IDs even by remove-then-add; cannot remove last required source',()=>{
 const old=base(),before=serializeSave(old);
 assert.throws(()=>reviseComponents(old,patch([remove('detector-1'),add(detector('detector-1'))])),/reused|DUPLICATE_ID|replaced/);
 assert.throws(()=>reviseComponents(old,patch([remove('source-1')])),/source|requires|point/);
 assert.throws(()=>reviseComponents(old,patch([remove('nonexistent')])),/absent|unknown|No/);
 assert.equal(serializeSave(old),before);
});
test('cross-family optics cannot leak into a v4 general scene, even if an individual physical component is registered',()=>{
 const old=base(),before=serializeSave(old);
 const prism={id:'glass',type:'triangular-prism',parameters:{
  x1:500,y1:0,x2:600,y2:0,x3:550,y3:100,
  insideIndex:1.5,outsideIndex:1,partialReflection:false
 }};
 assert.throws(()=>reviseComponents(old,patch([add(prism)])),/./);
 assert.equal(serializeSave(old),before);
});
test('reject excessive operations, duplicate IDs, invalid units, unsupported modes and arbitrary replacement',()=>{
 const old=base(),p=detector();
 const malformed=[
  {},{format:'unknown',operations:[add(p)]},
  patch([]),patch(Array.from({length:9},(_,i)=>add(detector('detector-'+(i+2),80+i*20)))),
  patch([add(p),add(p)]),
  patch([{op:'add',component:p}]),
  patch([add(p,'km')]),
  patch([{op:'replace',id:'detector-1',component:p}]),
  patch([{op:'remove',id:'detector-1',reason:'not physical'}]),
  {...patch([add(p)]),ignored:true}
 ];
 for(const x of malformed)assert.throws(()=>reviseComponents(old,x),/./);
 assert.deepEqual(old.physics.components,source.physics.components);
});
test('targeted parameter revisions continue unchanged and enforce distinct operations',()=>{
 const old=base(),changed=reviseScene(old,{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}]});
 assert.equal(get(changed.document,'lens-1').parameters.focalLength,150);
 assert.throws(()=>reviseComponents(old,patch([{op:'edit',id:'lens-1',section:'parameters',key:'focalLength',value:150}])),/Use add or remove/);
});
