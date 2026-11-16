// Developmental teaching software regression: same LLM proposal/qualified
// exploration workflow across a NEW supported family (finite native prism).
// Uses already exposed synthetic source fixture, NOT a blind JEE interpretation.
// Native Snell checks below are a separate test oracle, never a ray solver.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {EXPLORATION_PROPOSAL,explorationBundle,explorationContext,
  prepareExplorationProposal,snapshotScenario,compareExplorationSnapshots,
  nativeComparisonReadouts} from '../src/exploration.js';

const fixtureBytes=readFileSync(new URL('../examples/triangular-prism.json',import.meta.url));
const fixture=JSON.parse(fixtureBytes);
const sourceSha256=createHash('sha256').update(fixtureBytes).digest('hex');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const get=(doc,id)=>doc.physics.components.find(c=>c.id===id);
const proposal=(bundle,{intent='Inspect an explicitly authored prism hypothesis.',
  action='revise',patch={changes:[{id:'P1',section:'parameters',key:'insideIndex',value:1.6}]},
  additionalObservables}={})=>({
   format:EXPLORATION_PROPOSAL,expectedIntegritySha256:bundle.integritySha256,
   intent,action,...(action==='observe'?{}:{patch}),
   ...(additionalObservables?{additionalObservables}:{}),
  });
const run=async(bundle,name)=>{
 const current=evaluateDocument(bundle.scene,core,bundle.observables);
 assert.equal(current.summary.native.status,'completed',name+' original native run');
 assert.equal(current.summary.executionPassed,true,name+' native execution gate');
 return snapshotScenario(bundle,current,name);
};
const face=(snapshot,id='face-23')=>snapshot.results.results.find(r=>r.id==='faces')?.value?.[id]?.first;
const deg=rad=>rad*180/Math.PI;

test('prism is preserved as complete native physics; raw fixture has unknown source provenance',async()=>{
 const authored=structuredClone(fixture.physical);
 const prepared=prepareScene(authored);
 const doc=prepared.document;
 assert.equal(doc.schemaVersion,8);
 assert.equal(doc.physics.components.length,3);
 assert.equal(get(doc,'P1').parameters.insideIndex,1.5);
 assert.equal(get(doc,'P1').parameters.outsideIndex,1);
 assert.equal(get(doc,'P1').parameters.partialReflection,false);
 assert.equal(get(doc,'S1').emission.mode,'single-ray');
 assert.deepEqual(authored,fixture.physical);
 const physicalBytes=serializeSave(doc);
 const selected=nativeComparisonReadouts(doc);
 assert.ok(selected.some(r=>r.kind==='interface-interactions'&&r.componentId==='P1'));
 const b=await explorationBundle(doc,null,selected);
 assert.equal(b.qualification.origin.preparationStatus,'unknown');
 assert.equal(b.qualification.interpretation,null);
 assert.equal(serializeSave(doc),physicalBytes);
 const c=await explorationContext(b,'Inspect entrance/exit prism faces as a classroom question.');
 assert.equal(c.baseline.integritySha256,b.integritySha256);
 assert.equal(c.responseContract.expectedIntegritySha256,b.integritySha256);
 assert.match(c.instructions,/Never guess/);
 assert.match(c.qualification,/not proof of source truth/);
 assert.match(sourceSha256,/^[a-f0-9]{64}$/);
});

test('observe-first and one-index hypothetical reuse the SAME original finite prism and native face meter',async()=>{
 const doc=prepareScene(fixture.physical).document;
 const physical=serializeSave(doc);
 const initial=await explorationBundle(doc,null,nativeComparisonReadouts(doc));
 const readFace={id:'faces',kind:'interface-face-events',componentId:'P1'};
 const observing=proposal(initial,{action:'observe',additionalObservables:[readFace],
    intent:'Read the actual first native encounter on each finite prism face.'});
 const passive=await prepareExplorationProposal(initial,observing);
 assert.equal(passive.status,'validated-not-executed');
 assert.equal(passive.child.sceneSha256,initial.sceneSha256);
 assert.equal(passive.changes.length,0);
 assert.deepEqual(passive.child.scene.physics,doc.physics);
 assert.deepEqual(passive.child.scene.simulation,doc.simulation);
 const baseline=await run(passive.child,'prism source baseline');
 const baselineFaces=baseline.results.results.find(r=>r.id==='faces');
 assert.equal(baselineFaces.status,'qualified'); // Explicit Fresnel-off approximation.
 assert.equal(baselineFaces.method,'native-observation');
 assert.equal(baselineFaces.value['face-12'].interactions,1);
 assert.equal(baselineFaces.value['face-23'].interactions,1);
 assert.equal(baselineFaces.value['face-31'].interactions,0);
 assert.equal(face(baseline).from,'inside');
 assert.equal(face(baseline).outcome,'transmission');
 assert.ok(Math.abs(face(baseline).transmittedAngleDeg-deg(Math.asin(0.75)))<1e-6,
    'Independent local Snell-angle reference on baseline');
 assert.equal(baseline.results.results.find(r=>r.kind==='detector-crossings').value,1);
 const revise=proposal(passive.child);
 const inspected=await prepareExplorationProposal(passive.child,revise);
 assert.equal(inspected.status,'validated-not-executed');
 assert.deepEqual(inspected.changes,[{
   componentId:'P1',field:'parameters.insideIndex',before:1.5,after:1.6
 }]);
 assert.equal(inspected.child.qualification.origin.preparationStatus,'unknown');
 assert.deepEqual(inspected.child.qualification.origin,passive.child.qualification.origin);
 assert.equal(inspected.child.scene.simulation.rayDensity,passive.child.scene.simulation.rayDensity);
 assert.deepEqual(inspected.child.scene.physics.components.filter(c=>c.id!=='P1'),
   passive.child.scene.physics.components.filter(c=>c.id!=='P1'));
 assert.equal(get(inspected.child.scene,'P1').parameters.outsideIndex,1);
 assert.equal(get(inspected.child.scene,'P1').parameters.partialReflection,false);
 assert.equal(serializeSave(doc),physical,'Original source physically unchanged');
 const changed=await run(inspected.child,'higher material index hypothetical');
 const afterFace=face(changed);
 assert.equal(afterFace.from,'inside');
 assert.equal(afterFace.outcome,'transmission');
 assert.equal(afterFace.incidentIndex,1.6);
 assert.equal(afterFace.destinationIndex,1);
 assert.ok(Math.abs(afterFace.transmittedAngleDeg-deg(Math.asin(0.8)))<1e-6,
   'Independent local Snell-angle reference on revised material');
 assert.ok(afterFace.transmittedAngleDeg>face(baseline).transmittedAngleDeg+4,
   'Changing refractive index changed observed native exit direction');
 assert.equal(changed.results.results.find(r=>r.kind==='interface-interactions').value,2);
 assert.equal(changed.results.results.find(r=>r.kind==='detector-crossings').value,1);
 const compared=await compareExplorationSnapshots(baseline,changed);
 assert.equal(compared.evidenceChecks.baseline.accepted,true);
 assert.equal(compared.evidenceChecks.scenario.accepted,true);
 assert.equal(compared.samePhysics,false);
 assert.equal(compared.sameNumerics,true);
 const facesCompared=compared.entries.find(r=>r.id==='faces');
 assert.equal(facesCompared.comparison,'not-comparable');
 assert.equal(facesCompared.delta,null);
 assert.equal(facesCompared.conditions.samePhysicalModel,true);
 assert.match(facesCompared.reason,/warning|qualification/i);
 assert.equal(facesCompared.baselineValue['face-23'].first.outcome,'transmission');
 assert.equal(facesCompared.scenarioValue['face-23'].first.outcome,'transmission');
 assert.match(compared.notice,/not detected|not a live result/i);
 // The comparison engine refuses a tampered stored face reading; no
 // automatic scalar delta or fabricated complete ray path is published.
 const tampered=structuredClone(changed);
 tampered.results.results.find(r=>r.id==='faces').value['face-23'].first.transmittedAngleDeg=9999;
 const blocked=await compareExplorationSnapshots(baseline,tampered);
 assert.equal(blocked.evidenceChecks.scenario.accepted,false);
 assert.ok(blocked.entries.every(e=>e.comparison==='not-comparable'));
 // Original model did not contain an answer or native ray route as input.
 assert.equal(serializeSave(doc),physical);
 await assert.rejects(prepareExplorationProposal(inspected.child,revise),/Stale proposal/);
});

test('invalid material and incomplete Fresnel trace cannot be saved as completed classroom evidence',async()=>{
 const doc=prepareScene(fixture.physical).document,b=await explorationBundle(doc);
 const baseline=serializeSave(doc),input=JSON.stringify(fixture);
 const bad=[{id:'P1',section:'parameters',key:'insideIndex',value:0},
  {id:'P1',section:'parameters',key:'insideIndex',value:5},
  {id:'unknown-prism',section:'parameters',key:'insideIndex',value:1.7},
  {id:'P1',section:'parameters',key:'imaginaryExitFace',value:2}];
 for(const change of bad)await assert.rejects(prepareExplorationProposal(
  b,proposal(b,{patch:{changes:[change]}})),
  'Invalid/materially unsupported change must fail before executing native');
 const fresnel=await prepareExplorationProposal(b,proposal(b,{
   patch:{changes:[{id:'P1',section:'parameters',key:'partialReflection',value:true}]},
   intent:'Consider optional full Fresnel reflection, retaining its actual native incompleteness.'}));
 assert.equal(get(fresnel.child.scene,'P1').parameters.partialReflection,true);
 const native=evaluateDocument(fresnel.child.scene,core,fresnel.child.observables);
 assert.equal(native.summary.native.status,'incomplete');
 assert.equal(native.summary.executionPassed,false);
 await assert.rejects(snapshotScenario(fresnel.child,native,'incomplete Fresnel proposal'),
  /missing, stale or incomplete/);
 assert.equal(serializeSave(doc),baseline);
 assert.equal(JSON.stringify(fixture),input);
});
