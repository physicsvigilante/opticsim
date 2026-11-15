import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {prepareScene,reviseScene,reviseComponents,capabilities} from '../src/authoring.js';
import {validate,parseSave,serializeSave,UPSTREAM} from '../src/contract.js';
import {compositionCapabilities} from '../src/composition-profiles.js';
import {finiteCompositionVersionFor} from '../src/finite-dielectric-composition.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {prepareQualifiedStructure} from '../src/qualified-structure.js';
import {prepareExplorationProposal,explorationContext,snapshotScenario,compareExplorationSnapshots,EXPLORATION_PROPOSAL} from '../src/exploration.js';
import {inspectExternalSurfaceScene,transformExternalScene} from './helpers/external-surface-inspection.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const fixtures=['external-blocker-composition','external-blocker-return'].map(n=>read('examples/'+n+'.json'));
const request=(i=0)=>structuredClone(fixtures[i].physical);
const part=(r,id)=>r.components.find(c=>c.id===id);
const document=(r=request())=>prepareScene(r).document;
const execute=d=>evaluateDocument(d,core);
const patch=operations=>({format:'opticsim-component-revision-v1',operations});
const bundle=async(i=0)=>{const d=document(request(i));return createQualifiedBundle(d,initialQualification(d,null,{inputSha256:'b'.repeat(64),interpretation:fixtures[i].interpretation}),fixtures[i].requests);};

test('external blocker policy adds one prospective contract without altering any historical profile or selection',()=>{
 const historical=read('test/fixtures/external-blocker-historical-policy.json'),c=compositionCapabilities();
 c.profiles=c.profiles.filter(p=>p.schemaVersion<=12);c.selection=c.selection.filter(p=>p.version<=12);
 assert.equal(createHash('sha256').update(JSON.stringify(c)).digest('hex'),historical.catalogSha256);
 const r=request(),before=structuredClone(r),d=document(r);assert.deepEqual(r,before);assert.equal(d.schemaVersion,13);assert.equal(d.adapterVersion,13);
 assert.equal(d.physics.model,'finite-dielectric-composition');assert.equal(d.upstreamCommit,UPSTREAM);assert.equal(finiteCompositionVersionFor(r.components),13);
 assert.deepEqual(parseSave(serializeSave(d)),d);
 const cap=capabilities().finiteBlockerComposition;assert.equal(cap.counts['line-blocker'].max,1);assert.equal(cap.counts['plane-mirror'].max,1);
 cap.counts['line-blocker'].max=99;cap.groups[0].types.length=0;
 assert.equal(capabilities().finiteBlockerComposition.counts['line-blocker'].max,1);assert.equal(capabilities().finiteBlockerComposition.groups[0].types.length,2);
 for(const i of [0,1])for(const v of [4,5,6,7,8,9,10,11,12,14,'13']){const bad=document(request(i));bad.schemaVersion=bad.adapterVersion=v;assert.throws(()=>validate(bad));}
});

test('both motivating arrangements compile whole apparatus normally and expose actual native absorption',()=>{
 for(const i of [0,1]){
  const d=document(request(i)),native=core.loadDocument(d),out=execute(d),o=out.summary.observations;
  assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.analysis.status,'unavailable');
  assert.equal(native.scene.objs.length,d.physics.components.length);
  assert.equal(native.scene.objs[native.idMap.get('B1')].constructor.type,'Blocker');
  const glass=i?'G1':'P1';assert.equal(o.interfacesById[glass].interactions,i?4:2);assert.equal(o.blockersById.B1.absorptions,1);assert.equal(o.detectorsById.D1.crossings,0);
  if(i)assert.equal(o.reflectionsById.M1,1);
  const checked=inspectExternalSurfaceScene(d);assert.equal(checked.trace.at(-1).id,'B1');assert.equal(checked.trace.at(-1).absorbed,true);
  const control=reviseComponents(d,patch([{op:'remove',id:'B1'}])).document;assert.equal(control.schemaVersion,13);
  const clear=inspectExternalSurfaceScene(control);assert.equal(clear.diagnostic.detectorsById.D1.crossings,1);
  assert.deepEqual(checked.trace.slice(0,-1),clear.trace.slice(0,-1));
 }
});

test('one common policy verifies both shapes over 24 transformed material configurations and their controls',()=>{
 let count=0;
 for(const i of [0,1])for(const angle of [0,37,-90])for(const scale of [.25,4])for(const indices of [[1.5,1],[1.7,1.1]]){
  const r=request(i),g=r.components.find(c=>['triangular-prism','polygon-dielectric'].includes(c.type));
  Object.assign(g.parameters,{insideIndex:indices[0],outsideIndex:indices[1]});transformExternalScene(r,angle,scale,110,-80);
  const d=document(r),checked=inspectExternalSurfaceScene(d);assert.equal(checked.status,'completed');assert.equal(checked.diagnostic.blockersById.B1.absorptions,1);
  const control=reviseComponents(d,patch([{op:'remove',id:'B1'}])).document;assert.equal(inspectExternalSurfaceScene(control).diagnostic.detectorsById.D1.crossings,1);count++;
 }assert.equal(count,24);
});

test('finite misses, internal illumination and blocker-first encounters are not prescribed routes',()=>{
 for(const i of [0,1]){
  const r=request(i);Object.assign(part(r,'B1').parameters,{y:100,length:20});const o=inspectExternalSurfaceScene(document(r)).diagnostic;
  assert.equal(o.blockersById.B1.absorptions,0);assert.equal(o.detectorsById.D1.crossings,1);
 }
 const inside=request();Object.assign(part(inside,'S1').parameters,{x:10,y:8});part(inside,'S1').emission.directionDeg=0;
 const ci=inspectExternalSurfaceScene(document(inside));assert.equal(ci.diagnostic.interfacesById.P1.interactions,1);assert.equal(ci.diagnostic.blockersById.B1.absorptions,1);
 const first=request(1);part(first,'S1').emission.directionDeg=180;const cf=inspectExternalSurfaceScene(document(first));
 assert.deepEqual(cf.trace.map(e=>e.id),['B1']);assert.equal(cf.diagnostic.interfacesById.G1.interactions,0);
 const mirrorMiss=request(1);part(mirrorMiss,'M1').parameters.y=100;const cm=inspectExternalSurfaceScene(document(mirrorMiss));
 assert.equal(cm.diagnostic.reflectionsById.M1,0);assert.equal(cm.diagnostic.blockersById.B1.absorptions,0);assert.equal(cm.diagnostic.interfacesById.G1.interactions,2);
});

test('external blocker after native TIR does not invent a transmitted branch',async()=>{
 const r=request(1);Object.assign(part(r,'G1').parameters,{insideIndex:1,outsideIndex:1.5});
 Object.assign(part(r,'S1').parameters,{y:-40*Math.tan(50*Math.PI/180)});part(r,'S1').emission.directionDeg=50;
 part(r,'B1').parameters.y=100;const d=document(r),out=execute(d);assert.equal(out.summary.executionPassed,true);
 assert.equal(inspectExternalSurfaceScene(d).diagnostic.interfacesById.G1.totalInternalReflections,1);
 const result=(await evaluateObservables(d,[{id:'t',kind:'interface-transmission-angle',componentId:'G1'}],out.summary)).results[0];
 assert.equal(result.status,'unavailable');assert.equal(result.value,null);
});

test('shared whole-segment separation rejects internal, touching, intersecting and long unproved geometry',()=>{
 for(const [i,changes]of [[0,{x:5,length:60}],[0,{length:160}],[1,{x:20.009,length:50}],[1,{x:-100}],[1,{x:60,length:70}],[1,{x:-40}],[1,{x:-40.005}]]){
  const r=request(i);Object.assign(part(r,'B1').parameters,changes);const before=structuredClone(r);assert.throws(()=>document(r));assert.deepEqual(r,before);
 }
 const near=request(1);Object.assign(part(near,'B1').parameters,{x:20.011,length:50});
 const checked=inspectExternalSurfaceScene(document(near));assert.equal(checked.diagnostic.interfacesById.G1.interactions,2);assert.equal(checked.diagnostic.reflectionsById.M1,0);assert.equal(checked.diagnostic.blockersById.B1.absorptions,1);
 const corner=request();part(corner,'S1').parameters.y=0;part(corner,'S1').emission.directionDeg=0;assert.throws(()=>document(corner),/vertex/);
});

test('counts, material facts, source mode and unrelated families remain strict rather than silently repaired',()=>{
 const mutations=[r=>r.components.push({...structuredClone(part(r,'B1')),id:'B2'}),r=>r.components.push({...structuredClone(part(r,'P1')),id:'P2'}),
  r=>r.components.push({id:'L',type:'ideal-lens',parameters:{x:-20,focalLength:20,apertureHeight:20}}),
  r=>{part(r,'B1').type='circle-blocker';part(r,'B1').parameters={x:45,y:0,radius:10};},
  r=>{part(r,'B1').type='finite-aperture';part(r,'B1').parameters.openingLength=10;},
  r=>{part(r,'P1').parameters.insideIndex=0;},r=>{part(r,'S1').emission.mode='directional';},
  r=>{delete part(r,'B1').parameters.length;},r=>{delete part(r,'P1').parameters.partialReflection;},r=>{delete part(r,'S1').emission.directionDeg;}];
 for(const mutate of mutations){const r=request();mutate(r);assert.throws(()=>document(r));}
 const two=request(1);two.components.push({...structuredClone(part(two,'M1')),id:'M2',parameters:{x:120,y:100,orientationDeg:90,length:20}});assert.throws(()=>document(two),/v13/);
 const noRegion=request();noRegion.components=noRegion.components.filter(c=>c.type!=='triangular-prism');const saved=document();saved.physics.components=noRegion.components;assert.throws(()=>validate(saved));
});

test('full Fresnel, depth and processing limits suppress requested readings; eight encounters differs from nine',async()=>{
 for(const mutate of [d=>{d.physics.components.find(c=>c.id==='G1').parameters.partialReflection=true;},d=>{d.simulation.maxRayDepth=2;},d=>{d.simulation.processedRayLimit=1;}]){
  const d=document(request(1));mutate(d);validate(d);const out=execute(d);assert.ok(['incomplete','stopped'].includes(out.summary.native.status));assert.equal(out.summary.observations,null);
  const results=(await evaluateObservables(d,fixtures[1].requests,out.summary)).results;assert.ok(results.every(r=>r.status==='suppressed'&&r.value===null));
 }
 const eight=request(1);eight.components.push({id:'D2',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:30}});
 const d8=document(eight),out8=execute(d8);assert.equal(out8.summary.executionPassed,true);assert.equal(inspectExternalSurfaceScene(d8).trace.length,8);
 const nine=structuredClone(eight);part(nine,'D1').parameters.x=-50;const d9=document(nine),out9=execute(d9);assert.equal(out9.summary.native.status,'incomplete');
 assert.ok((await evaluateObservables(d9,fixtures[1].requests,out9.summary)).results.every(r=>r.status==='suppressed'&&r.value===null));
 assert.equal(d8.simulation.maxRayDepth,8);assert.equal(core.loadDocument(d8).scene.colorMode,'default');
});

test('qualified structural removal preserves v13, old targets, history and retired identities',async()=>{
 const b=await bundle(),before=structuredClone(b),remove={...patch([{op:'remove',id:'B1'}]),expectedSha256:b.sceneSha256};
 const out=await prepareQualifiedStructure(b,remove),child=await createQualifiedBundle(out.document,out.qualification,out.observables);
 assert.deepEqual(b,before);assert.equal(child.scene.schemaVersion,13);assert.deepEqual(child.qualification.origin,b.qualification.origin);
 const results=(await evaluateObservables(child.scene,child.observables,execute(child.scene).summary)).results;
 assert.equal(results.find(r=>r.id==='absorbed').status,'unavailable');assert.equal(results.find(r=>r.id==='crossings').value,1);
 const add={...patch([{op:'add',lengthUnit:'mm',component:part(request(),'B1')}]),expectedSha256:child.sceneSha256};
 await assert.rejects(()=>prepareQualifiedStructure(child,add),e=>e.issues?.some(i=>i.code==='RETIRED_COMPONENT_ID'));
 add.operations[0].component.id='Bnew';const next=await prepareQualifiedStructure(child,add);assert.equal(next.document.schemaVersion,13);
 assert.equal(next.observables.find(r=>r.id==='absorbed').componentId,'B1');assert.equal(execute(next.document).summary.observations.blockersById.Bnew.absorptions,1);
 assert.deepEqual(await parseQualifiedBundle(JSON.stringify(child)),child);
});

test('ordinary exploration previews, observations, comparison and package reopening reuse the new contract',async()=>{
 const b=await bundle(),before=structuredClone(b),execution=execute(b.scene);
 const proposal={format:EXPLORATION_PROPOSAL,expectedIntegritySha256:b.integritySha256,intent:'Move the external absorber out of the beam.',action:'revise',
  patch:{changes:[{id:'B1',section:'parameters',key:'y',value:100,unit:'mm'},{id:'B1',section:'parameters',key:'length',value:20,unit:'mm'}]}};
 const preview=await prepareExplorationProposal(b,proposal);assert.equal(preview.status,'validated-not-executed');assert.deepEqual(b,before);
 assert.ok((await evaluateObservables(preview.child.scene,b.observables,execution.summary)).results.every(r=>r.status==='suppressed'));
 const fresh=execute(preview.child.scene);assert.equal(fresh.summary.observations.blockersById.B1.absorptions,0);
 const base=await snapshotScenario(b,execution,'baseline'),next=await snapshotScenario(preview.child,fresh,'blocker miss');
 const comparison=await compareExplorationSnapshots(base,next);assert.ok(comparison.evidenceChecks.baseline.accepted&&comparison.evidenceChecks.scenario.accepted);
 assert.deepEqual(preview.child.qualification.origin,b.qualification.origin);assert.deepEqual(preview.child.qualification.assumptions,b.qualification.assumptions);
 assert.deepEqual(await parseQualifiedBundle(JSON.stringify(preview.child)),preview.child);
 const observed=await prepareExplorationProposal(b,{format:EXPLORATION_PROPOSAL,expectedIntegritySha256:b.integritySha256,intent:'Inspect the first native entry event without changing physics.',action:'observe',additionalObservables:[{id:'event',kind:'interface-first-event',componentId:'P1'}]});
 assert.deepEqual(observed.child.scene,b.scene);assert.equal(observed.child.sceneSha256,b.sceneSha256);
 assert.equal((await explorationContext(b,'Move only blocker B1.')).authoring.finiteBlockerComposition.schemaVersion,13);
 await assert.rejects(()=>prepareExplorationProposal(preview.child,proposal),/Stale proposal/);
});

test('unsupported cross-version addition is not an implicit migration and no new qualified upgrade path is granted',async()=>{
 for(const i of [0,1]){
  const r=request(i),blocker=part(r,'B1');r.components=r.components.filter(c=>c.id!=='B1');const old=document(r);assert.equal(old.schemaVersion,i?10:8);
  assert.throws(()=>reviseComponents(old,patch([{op:'add',lengthUnit:'mm',component:blocker}])));
  const b=await createQualifiedBundle(old,initialQualification(old,null,{inputSha256:'c'.repeat(64)}),[]);
  await assert.rejects(()=>prepareQualifiedStructure(b,{...patch([{op:'add',lengthUnit:'mm',component:blocker}]),expectedSha256:b.sceneSha256,expectedIntegritySha256:b.integritySha256,upgradeToSchemaVersion:13}));
 }
});

test('units, winding, component order and four sources use the same policy and native instances',()=>{
 for(const i of [0,1])for(const unit of ['cm','m']){
  const r=request(i);r.lengthUnit=unit;const divisor=unit==='cm'?10:1000;
  for(const c of r.components)for(const key of capabilities().lengthParameters)if(key in c.parameters)c.parameters[key]/=divisor;
  r.components.reverse();const o=inspectExternalSurfaceScene(document(r)).diagnostic;assert.equal(o.blockersById.B1.absorptions,1);
 }
 for(const i of [0,1]){
  const r=request(i),g=r.components.find(c=>['triangular-prism','polygon-dielectric'].includes(c.type)),n=i?4:3;
  const vertices=Array.from({length:n},(_,k)=>[g.parameters['x'+(k+1)],g.parameters['y'+(k+1)]]).reverse();
  vertices.forEach(([x,y],k)=>{g.parameters['x'+(k+1)]=x;g.parameters['y'+(k+1)]=y;});assert.equal(inspectExternalSurfaceScene(document(r)).diagnostic.blockersById.B1.absorptions,1);
 }
 const multiple=request(1);for(let i=2;i<=4;i++){const s=structuredClone(part(multiple,'S1'));s.id='S'+i;s.parameters.y=2*(i-1);multiple.components.push(s);}
 const out=execute(document(multiple));assert.equal(out.summary.executionPassed,true);assert.equal(out.summary.observations.blockersById.B1.absorptions,4);
});
