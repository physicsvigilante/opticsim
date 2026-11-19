import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {compositionCapabilities,compositionProfile,compositionModels,compositionSourceModes,
  selectAuthoringComposition,compositionCountsMatch,validateCompositionRules,compositionCapacity} from '../src/composition-profiles.js';
import {prepareScene,capabilities,reviseComponents,reviseScene} from '../src/authoring.js';
import {validate,parseSave,serializeSave,GENERAL_SCOPE,COMPONENT_TYPES} from '../src/contract.js';
import {checkCandidate} from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {createQualifiedBundle,initialQualification,parseQualifiedBundle} from '../src/qualification.js';
import {prepareQualifiedStructure} from '../src/qualified-structure.js';
import {explorationContext} from '../src/exploration.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const fixtures=read('./fixtures/composition-profile-cases.json');
const golden=read('./fixtures/composition-profile-baseline.json');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const hash=text=>createHash('sha256').update(text).digest('hex');
const request=id=>structuredClone(fixtures.cases.find(c=>c.id===id).request);
const scene=id=>prepareScene(request(id)).document;
const byId=(d,id)=>d.physics.components.find(c=>c.id===id);
const finite='finite-dielectric-composition',general='general-component-tracing';
const types=(...values)=>values.map(type=>({type}));
const componentPatch=operations=>({format:'opticsim-component-revision-v1',operations});

test('restored native v14–v18 preserve all original sealed v24 profiles',()=>{
 const c=compositionCapabilities();
 assert.equal(c.profiles.filter(p=>p.schemaVersion<=13).length,18);
 assert.equal(c.profiles.filter(p=>p.schemaVersion<=23&&![14,15,16,17,18].includes(p.schemaVersion)).length,24,
  'The original pre-v24 profiles remain present under their original IDs');
 assert.equal(c.profiles.length,30,'25 old profiles plus five isolated native glass/thick-lens profiles');
 for(const [version,model] of [[14,'two-separated-dielectrics-tracing'],[15,'native-thick-lens-tracing'],
  [16,'native-thick-lens-mirror-tracing'],[17,'native-two-thick-lens-mirror-tracing'],
  [18,'native-two-thick-lens-mirror-aperture-tracing']]){
  assert.deepEqual(compositionModels(version),[model]);
  assert.deepEqual(compositionSourceModes(version),['single-ray']);
 }
 c.profiles=c.profiles.filter(p=>p.schemaVersion<=12);assert.equal(c.profiles.length,17);
 assert.equal(new Set(c.profiles.map(p=>p.id)).size,17);
 assert.deepEqual(compositionModels(1),['ideal-thin-lens-geometric']);
 assert.deepEqual(compositionModels(3),['ideal-thin-lens-geometric','plane-mirror-geometric']);
 assert.deepEqual(compositionModels(4),['ideal-thin-lens-geometric','plane-mirror-geometric','lens-mirror-return-geometric','mixed-lens-mirror-tracing',general]);
 for(const v of [10,11,12])assert.deepEqual(compositionModels(v),[finite]);
 assert.equal(compositionProfile(finite,10).counts['plane-mirror'].max,1);
 assert.equal(compositionProfile(finite,11).counts['plane-mirror'].max,2);
 assert.deepEqual(compositionProfile(finite,12).groups,[{types:['polygon-dielectric','triangular-prism'],min:1,max:1}]);
 for(const v of [0,14,'12',null,NaN])assert.equal(compositionProfile(finite,v),null);
 assert.equal(compositionProfile('unregistered',12),null);
 assert.deepEqual(compositionSourceModes(1),[]);
 assert.deepEqual(compositionSourceModes(4),['full-circle','directional']);
 assert.deepEqual(compositionSourceModes(6),['single-ray','full-circle','directional']);
 assert.deepEqual(compositionModels(19),['native-parallel-lens-tracing','native-parallel-planar-tracing']);
  assert.deepEqual(compositionModels(20),['native-parallel-two-lens-tracing']);
  assert.deepEqual(compositionModels(21),['native-parallel-semicircular-tracing']);
  assert.deepEqual(compositionModels(22),['native-parallel-prism-tracing']);
  assert.deepEqual(compositionModels(23),['native-parallel-circle-tracing']);
 assert.deepEqual(compositionSourceModes(19),[]);
 for(const v of [5,7,8,9,10,11,12])assert.deepEqual(compositionSourceModes(v),['single-ray']);
});

test('capabilities and legacy capacity bounds are defensive views, never mixture permissions',()=>{
 const c=capabilities().composition;assert.equal(c.format,'opticsim-composition-catalog-v1');
 const native=compositionProfile(finite,12);
 assert.ok(Object.isFrozen(native)&&Object.isFrozen(native.counts)&&Object.isFrozen(native.groups[0].types));
 assert.throws(()=>{native.counts['plane-mirror'].max=99;},TypeError);
 c.profiles.find(p=>p.id===native.id).counts['plane-mirror'].max=99;c.selection.length=0;
 assert.equal(capabilities().composition.profiles.find(p=>p.id===native.id).counts['plane-mirror'].max,2);
 assert.ok(capabilities().composition.selection.length>0);
 for(const type of COMPONENT_TYPES)assert.deepEqual(compositionCapacity(type),GENERAL_SCOPE[type]);
 assert.equal(compositionCapacity('unknown'),null);
 assert.equal(compositionCountsMatch(types('point-source','ideal-lens','circular-dielectric'),general,4),false);
});

test('mechanical authoring selects by components rather than title, ID, component order or example name',()=>{
 const expected={'lens-two-mirrors':4,'aperture-detector':4,'planar-mirror-detector':5,'circle-detector':7,
  'prism-two-mirrors':12,'quadrilateral-two-mirrors':11,'curved-plane-detector':6};
 for(const {id,request:r} of fixtures.cases){
  const p=selectAuthoringComposition(r.components);assert.equal(p.schemaVersion,expected[id]);
  assert.deepEqual(selectAuthoringComposition([...r.components].reverse()),p);
  const renamed=structuredClone(r);renamed.title='Not a registered demonstration';renamed.components.forEach((c,i)=>{c.id='different'+i;});
  assert.equal(prepareScene(renamed).document.schemaVersion,p.schemaVersion);
 }
 // The candidate is not permission: conflicting families cannot fall back to
 // a looser model or be repaired by dropping an unwanted component.
 const mixed=request('prism-two-mirrors');mixed.components.push({id:'L',type:'ideal-lens',parameters:{x:-25,focalLength:40,apertureHeight:20}});
 assert.equal(selectAuthoringComposition(mixed.components).schemaVersion,12);
 assert.throws(()=>prepareScene(mixed));
});

test('shared whole-system rules enforce exclusive regions and combined stops/curved limits',()=>{
 const base=types('point-source','triangular-prism','plane-mirror');
 assert.equal(compositionCountsMatch(base,finite,12),true);
 assert.equal(compositionCountsMatch([...base,...types('polygon-dielectric')],finite,12),false);
 assert.equal(compositionCountsMatch(base,finite,11),false);
 assert.equal(compositionCountsMatch([...base,...types('plane-mirror','plane-mirror')],finite,12),false);
 assert.equal(compositionCountsMatch(types('point-source','line-blocker','finite-aperture'),general,4),true);
 assert.equal(compositionCountsMatch(types('point-source','line-blocker','finite-aperture','circle-blocker'),general,4),false);
 const curved=types('point-source','ideal-curved-mirror','circular-arc-mirror');
 assert.equal(compositionCountsMatch(curved,'curved-mirror-tracing',6),true);
 assert.equal(compositionCountsMatch([...curved,...types('ideal-curved-mirror')],'curved-mirror-tracing',6),false);
 assert.equal(compositionCountsMatch(base,'unknown',12),false);
});

test('ordered validation views never remove components from the canonical or native apparatus',()=>{
 const d=scene('prism-two-mirrors'),before=structuredClone(d),calls=[];
 const handlers={
  'finite-composition':cs=>calls.push(['region',cs.map(c=>c.id)]),
  'general-optical':cs=>calls.push(['optics',cs.map(c=>c.id)]),
  detectors:cs=>calls.push(['measurements',cs.map(c=>c.id)])
 };
 validateCompositionRules(d.physics.components,d.physics.model,12,handlers);
 assert.deepEqual(calls,[['region',['S','P','A','B','D']],['optics',['S','A','B']],['measurements',['S','P','A','B','D']]]);
 assert.deepEqual(d,before);
 const loaded=core.loadDocument(d);assert.equal(loaded.scene.objs.length,5);
 assert.deepEqual(loaded.scene.objs.map(o=>o.constructor.type),['SingleRay','Glass','Mirror','Mirror','Detector']);
});

test('unknown or missing rule implementations fail closed before partial dispatch; rule failures stop later checks',()=>{
 const d=scene('circle-detector');let calls=0;
 assert.throws(()=>validateCompositionRules(d.physics.components,d.physics.model,7,{'circular-region':()=>calls++}),/Missing registered composition rule/);
 assert.equal(calls,0);
 assert.throws(()=>validateCompositionRules(d.physics.components,'unknown',7,{}),/Unregistered composition/);
 const error=new Error('intentional geometry rejection');
 assert.throws(()=>validateCompositionRules(d.physics.components,d.physics.model,7,{
  'circular-region':()=>{throw error;},'general-optical':()=>calls++,detectors:()=>calls++
 }),e=>e===error);assert.equal(calls,0);
});

test('seven data-only apparatus assemblies preserve pre-refactor canonical/native/full execution fingerprints',()=>{
 assert.equal(golden.baselineCommit,'3d302858ae99b6afdef233d7459940baa09e79de');
 assert.deepEqual(fixtures.cases.map(c=>c.id),golden.records.map(r=>r.id));
 for(const [i,{id,request:r}] of fixtures.cases.entries()){
  const before=structuredClone(r),d=prepareScene(r).document,text=serializeSave(d),expected=golden.records[i];
  assert.deepEqual(r,before);assert.equal(d.schemaVersion,expected.version);assert.equal(d.physics.model,expected.model);
  assert.equal(hash(text),expected.canonical,id+' canonical');
  assert.equal(hash(core.nativeExport(d)),expected.native,id+' native objects');
  const report=checkCandidate(text,core);assert.equal(hash(JSON.stringify(report)),expected.report,id+' full native/analytical report');
  assert.equal(report.native.status,expected.status);assert.equal(report.executionPassed,true);
  assert.deepEqual(parseSave(text),d);
 }
});

test('count-compatible apparatus still needs geometric and material validation, with no fallback',()=>{
 const original=request('prism-two-mirrors'),before=structuredClone(original);
 for(const mutate of [
  r=>{r.components.find(c=>c.id==='A').parameters.x=5;},
  r=>{r.components.find(c=>c.id==='P').parameters.insideIndex=0;},
  r=>{delete r.components.find(c=>c.id==='A').parameters.orientationDeg;},
  r=>{r.components.find(c=>c.id==='S').emission.mode='full-circle';}
 ]){
  const r=structuredClone(original);mutate(r);assert.equal(compositionCountsMatch(r.components,finite,12),true);
  const untouched=structuredClone(r);assert.throws(()=>prepareScene(r));assert.deepEqual(r,untouched);
 }
 assert.deepEqual(original,before);
});

test('ordinary revisions keep the selected contract and cannot implicitly widen older models',()=>{
 const d=scene('quadrilateral-two-mirrors'),before=structuredClone(d);
 const one=reviseComponents(d,componentPatch([{op:'remove',id:'B'}])).document;
 assert.equal(one.schemaVersion,11);assert.deepEqual(d,before);
 const newMirror={...structuredClone(byId(d,'B')),id:'newMirror'};
 const restored=reviseComponents(one,componentPatch([{op:'add',lengthUnit:'mm',component:newMirror}])).document;
 assert.equal(restored.schemaVersion,11);assert.doesNotThrow(()=>validate(restored));
 const legacy=structuredClone(one);legacy.schemaVersion=legacy.adapterVersion=10;validate(legacy);
 assert.throws(()=>reviseComponents(legacy,componentPatch([{op:'add',lengthUnit:'mm',component:newMirror}])),/one external plane mirror/);
 assert.throws(()=>reviseScene(d,{changes:[{id:'S',section:'emission',key:'mode',value:'directional'}]}));
 assert.equal(parseSave(serializeSave(legacy)).schemaVersion,10);
});

test('shared profiles preserve qualified lineage, retired IDs and unavailable removed-target observations',async()=>{
 const d=scene('quadrilateral-two-mirrors'),observables=[{id:'B-hits',kind:'mirror-reflections',componentId:'B'}];
 const q=initialQualification(d,null,{inputSha256:'b'.repeat(64),interpretation:{assumptions:['Synthetic explicitly specified apparatus.']}});
 const parent=await createQualifiedBundle(d,q,observables),before=structuredClone(parent);
 const removed=await prepareQualifiedStructure(parent,{...componentPatch([{op:'remove',id:'B'}]),expectedSha256:parent.sceneSha256});
 const child=await createQualifiedBundle(removed.document,removed.qualification,removed.observables);
 assert.deepEqual(parent,before);assert.equal(child.scene.schemaVersion,11);
 assert.deepEqual(child.qualification.origin,parent.qualification.origin);assert.deepEqual(await parseQualifiedBundle(JSON.stringify(child)),child);
 const execution=evaluateDocument(child.scene,core);
 const results=(await evaluateObservables(child.scene,child.observables,execution.summary)).results;
 assert.equal(results[0].status,'unavailable');assert.equal(results[0].value,null);
 await assert.rejects(()=>prepareQualifiedStructure(child,{...componentPatch([{op:'add',lengthUnit:'mm',component:byId(d,'B')}]),expectedSha256:child.sceneSha256}),e=>e.issues?.some(i=>i.code==='RETIRED_COMPONENT_ID'));
});

test('shared profiles never change numerical policy or qualify truncated/stale evidence',async()=>{
 const d=scene('prism-two-mirrors'),requests=[{id:'prism',kind:'interface-interactions',componentId:'P'}];
 const baseline=evaluateDocument(d,core);assert.equal(baseline.summary.executionPassed,true);
 for(const change of [x=>{byId(x,'P').parameters.partialReflection=true;},x=>{x.simulation.maxRayDepth=1;}]){
  const changed=structuredClone(d);change(changed);validate(changed);
  const execution=evaluateDocument(changed,core);assert.equal(execution.summary.native.status,'incomplete');
  assert.equal(execution.summary.observations,null);
  const results=(await evaluateObservables(changed,requests,execution.summary)).results;
  assert.ok(results.every(r=>r.status==='suppressed'&&r.value===null));
 }
 const changed=reviseScene(d,{changes:[{id:'A',section:'parameters',key:'y',value:100,unit:'mm'}]}).document;
 assert.ok((await evaluateObservables(changed,requests,baseline.summary)).results.every(r=>r.status==='suppressed'));
 assert.equal(d.simulation.maxRayDepth,8);assert.equal(core.loadDocument(d).scene.colorMode,'default');
});

test('existing model context exports the same composition catalog without a new apparatus language',async()=>{
 const d=scene('prism-two-mirrors');
 const b=await createQualifiedBundle(d,initialQualification(d,null,{inputSha256:'c'.repeat(64)}),[]);
 const context=await explorationContext(b,'Change only mirror A height to 100 mm.');
 assert.deepEqual(context.authoring.composition,compositionCapabilities());
 const r=request('prism-two-mirrors');r.profile='arbitrary-mixture';assert.throws(()=>prepareScene(r));
 delete r.profile;r.route=['P','A','P'];assert.throws(()=>prepareScene(r));
});
