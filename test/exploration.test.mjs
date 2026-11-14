import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {EXPLORATION_PROPOSAL,explorationBundle,explorationContext,parseExplorationProposal,
 prepareExplorationProposal,browserExecution,snapshotScenario,compareExplorationSnapshots,nativeComparisonReadouts} from '../src/exploration.js';
import {initialQualification,createQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {sceneHash} from '../src/qualified-utils.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url)));
const doc=read('scenes/single-lens-detector.json');
const requests=[{id:'rays',kind:'source-emissions',componentId:'source-1'},
 {id:'crossings',kind:'detector-crossings',componentId:'detector-1'},
 {id:'image',kind:'ideal-image',componentId:'source-1'}];
async function baseline(){return explorationBundle(doc,initialQualification(doc,null,{inputSha256:'a'.repeat(64),interpretation:{
 source:{path:'test source',sha256:'b'.repeat(64)},stated:['Known fixture; not independent source evidence.'],assumptions:[],unknowns:[]}}),requests);}
const proposal=(bundle,extra={})=>({format:EXPLORATION_PROPOSAL,expectedIntegritySha256:bundle.integritySha256,
 intent:'Change the lens focal length to 150 mm as a hypothetical.',action:'revise',
 patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}]},...extra});
async function snapshot(b,label='fixture'){return snapshotScenario(b,evaluateDocument(b.scene,core),label);}
test('raw scenes retain unknown provenance and existing qualified origin is never upgraded',async()=>{
 const b=await explorationBundle(doc);assert.equal(b.qualification.origin.preparationStatus,'unknown');
 assert.equal(b.qualification.interpretation,null);assert.deepEqual(b.scene,doc);
 const q=await baseline(),copy=await explorationBundle(q.scene,q.qualification,q.observables);
 assert.deepEqual(q,copy);
});
test('LLM handoff is source-bound data, uses live contracts and requires a specific investigation',async()=>{
 const b=await baseline(),c=await explorationContext(b,'Move the lens focal length to 150 mm.');
 assert.equal(c.responseContract.expectedIntegritySha256,b.integritySha256);
 assert.deepEqual(c.baseline,b);assert.ok(c.authoring.structuralRevisions);assert.ok(c.observables.kinds['source-emissions']);
 assert.match(c.privacy,/Nothing is sent/);assert.match(c.instructions,/Never guess/);
 await assert.rejects(explorationContext(b,''),/Investigation/);
 c.baseline.scene.physics.components[0].parameters.x=999;assert.notEqual(b.scene.physics.components[0].parameters.x,999);
});
test('proposal preview is purely preparatory and preserves physical source state and assumptions',async()=>{
 const b=await baseline(),bytes=JSON.stringify(b),preview=await prepareExplorationProposal(b,proposal(b));
 assert.equal(preview.status,'validated-not-executed');assert.equal(preview.child.scene.physics.components[1].parameters.focalLength,150);
 assert.deepEqual(preview.child.qualification.origin,b.qualification.origin);
 assert.deepEqual(preview.child.qualification.interpretation,b.qualification.interpretation);
 assert.deepEqual(preview.child.observables,b.observables);assert.deepEqual(preview.child.scene.simulation,b.scene.simulation);
 assert.deepEqual(preview.changes,[{componentId:'lens-1',field:'parameters.focalLength',before:100,after:150}]);
 assert.equal(JSON.stringify(b),bytes);
});
test('invalid physics, guessed targets and full-scene replacement are rejected without mutating baseline',async()=>{
 const b=await baseline(),original=JSON.stringify(b);
 const bad=[proposal(b,{patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:0}]}}),
  proposal(b,{patch:{changes:[{id:'unknown',section:'parameters',key:'x',value:4}]}}),
  proposal(b,{document:b.scene}),proposal(b,{action:'guess'}),proposal(b,{expectedIntegritySha256:'f'.repeat(64)}),
  proposal(b,{additionalObservables:[{id:'rays',kind:'source-emissions',componentId:'source-1'}]})];
 for(const p of bad)await assert.rejects(prepareExplorationProposal(b,p));
 assert.equal(JSON.stringify(b),original);assert.throws(()=>parseExplorationProposal('```json\n{}\n```'));
 assert.throws(()=>parseExplorationProposal(' '.repeat(64001)),/64 KB/);
});
test('stale metadata-only proposals fail even when the scene hash has not changed',async()=>{
 const b=await baseline(),p=proposal(b);
 const q=structuredClone(b.qualification);q.interpretation.unknowns.push('Another unresolved source condition');
 const changed=await createQualifiedBundle(b.scene,q,b.observables);
 assert.equal(changed.sceneSha256,b.sceneSha256);
 await assert.rejects(prepareExplorationProposal(changed,p),/Stale proposal/);
});
test('structural add/remove uses qualified lineage and never silently rebinds removed targets',async()=>{
 const b=await baseline();
 const remove=await prepareExplorationProposal(b,proposal(b,{action:'structure',patch:{format:'opticsim-component-revision-v1',operations:[{op:'remove',id:'detector-1'}]}}));
 const run=evaluateDocument(remove.child.scene,core);
 const saved=await snapshot(remove.child);
 assert.equal(run.summary.executionPassed,true);assert.equal(saved.results.results.find(x=>x.id==='crossings').status,'unavailable');
 const component=doc.physics.components.find(c=>c.id==='detector-1');
 await assert.rejects(prepareExplorationProposal(remove.child,proposal(remove.child,{action:'structure',patch:{format:'opticsim-component-revision-v1',operations:[{op:'add',lengthUnit:'mm',component}]}})),/occurred in this recorded lineage/);
});
test('passive observation selection changes neither physical scene nor sampling and preserves valid zero',async()=>{
 const b=await baseline(),p=proposal(b,{action:'observe',additionalObservables:[{id:'power',kind:'detector-signed-power',componentId:'detector-1'}]});delete p.patch;
 const next=await prepareExplorationProposal(b,p);assert.equal(next.child.sceneSha256,b.sceneSha256);assert.deepEqual(next.changes,[]);
 const snapshot=await snapshotScenario(next.child,evaluateDocument(next.child.scene,core),'extra-readout');
 assert.equal(snapshot.results.results.at(-1).method,'native-observation');
 const bad=proposal(b,{action:'observe',additionalObservables:[]});delete bad.patch;
 await assert.rejects(prepareExplorationProposal(b,bad),/Observe requires/);
});
test('browser projection uses actual diagnostics and rejects incomplete, stale or clipped evidence promotion',async()=>{
 const b=await baseline(),run=evaluateDocument(b.scene,core),d=run.report.native.diagnostics;
 const execution=await browserExecution(b.scene,run.summary.native.status,d);
 const s=await snapshotScenario(b,execution,'browser actual');assert.equal(s.results.results[1].value,46);
 await assert.rejects(browserExecution(b.scene,'running',d),/complete current/);
 await assert.rejects(browserExecution(b.scene,'completed',{...d,truncation:1}),/complete current/);
 await assert.rejects(snapshotScenario(b,{summary:{...execution.summary,canonicalSha256:'a'.repeat(64)}},'stale'),/stale/);
});
test('real native baseline and physical hypothesis are independently sampled before guarded comparison',async()=>{
 const b=await baseline(),a=await snapshot(b,'baseline');
 const next=(await prepareExplorationProposal(b,proposal(b))).child,c=await snapshot(next,'hypothesis');
 const comparison=await compareExplorationSnapshots(a,c);
 assert.equal(comparison.evidenceChecks.baseline.accepted,true);assert.equal(comparison.evidenceChecks.scenario.accepted,true);
 assert.equal(comparison.entries.find(x=>x.id==='crossings').delta,0);
 assert.equal(comparison.entries.find(x=>x.id==='image').comparison,'conditional-ideal-comparison');
 assert.equal(comparison.entries.find(x=>x.id==='image').baselineValue.x,150);
 assert.equal(comparison.entries.find(x=>x.id==='image').scenarioValue.x,300);
 const tampered=structuredClone(c);tampered.results.results[0].value=999;
 const blocked=await compareExplorationSnapshots(a,tampered);assert.equal(blocked.evidenceChecks.scenario.accepted,false);
 assert.ok(blocked.entries.every(e=>e.comparison==='not-comparable'&&e.delta===undefined));
});
test('sampling-only edit cannot yield a physical-count delta, even with successful native completion',async()=>{
 const b=await baseline(),low=structuredClone(b.scene);low.simulation.rayDensity=.25;
 const revised=await createQualifiedBundle(low,recordQualifiedEdit(b.scene,low,b.qualification),b.observables);
 const a=await snapshot(b),c=await snapshot(revised),report=await compareExplorationSnapshots(a,c);
 assert.equal(c.results.results.find(x=>x.id==='crossings').value,12);
 assert.equal(report.entries.find(x=>x.id==='crossings').comparison,'not-comparable');
 assert.equal(report.entries.find(x=>x.id==='crossings').delta,null);
 assert.equal(report.entries.find(x=>x.id==='image').comparison,'conditional-ideal-comparison');
});
test('snapshots before async hashing prevent late caller mutations from altering accepted proposals',async()=>{
 const b=await baseline(),p=proposal(b),pending=prepareExplorationProposal(b,p);
 p.patch.changes[0].value=200;b.scene.physics.components[0].parameters.x=-999;
 const next=await pending;assert.equal(next.child.scene.physics.components[1].parameters.focalLength,150);
 assert.equal(next.child.scene.physics.components[0].parameters.x,-300);
});
test('default comparison counters use registry types and are observation-only across three families',async()=>{
 for(const name of ['single-lens-detector','general-two-source-lens','circular-dielectric']){
  const d=read('scenes/'+name+'.json'),copy=JSON.stringify(d),selected=nativeComparisonReadouts(d);
  const b=await explorationBundle(d,null,selected),saved=await snapshot(b,name);
  assert.equal(JSON.stringify(d),copy);assert.ok(selected.length>0);
  assert.ok(saved.results.results.every(r=>['available','qualified'].includes(r.status)),name);
  assert.ok(saved.results.results.every(r=>r.method==='native-observation'));
 }
});
