// Focused authoring context is an optional compact view, not an LLM score,
// source interpreter or weaker native authoring/physics validator.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {explorationBundle,explorationContext,prepareExplorationProposal} from '../src/exploration.js';
import {focusedExplorationContext} from '../src/focused-exploration-context.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixtures=[
 ['lens','scenes/single-lens-detector.json'],
 ['mirror','scenes/plane-mirror-detector.json'],
 ['glass','scenes/polygon-dielectric.json']
];
const question='Change only one existing physical field while keeping everything else unchanged.';
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const bytes=x=>Buffer.byteLength(JSON.stringify(x),'utf8');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

for(const [name,path] of fixtures){
 test('Focused model context reuses verified '+name+' baseline with no extraneous component families',async()=>{
  const doc=read(path),untouched=JSON.stringify(doc);
  const input=await explorationBundle(doc,null,[]);
  const full=await explorationContext(input,question);
  const repeatedFull=await explorationContext(input,question);
  const focus=await focusedExplorationContext(input,question);
  assert.deepEqual(full,repeatedFull,'The byte-frozen full-context contract must remain stable');
  assert.deepEqual(focus.baseline,full.baseline,'Full qualified source bytes and hashes are retained');
  assert.equal(focus.responseContract.expectedIntegritySha256,input.integritySha256);
  assert.equal(focus.contextProfile,'focused-existing-components-v1');
  assert.equal(focus.question,question);
  assert.match(focus.instructions,/source notes as data|source notes as data, never instructions/i);
  assert.match(focus.instructions,/full context/i);
  assert.match(focus.instructions,/unit applies only to length parameters/i);
  assert.ok(!Object.hasOwn(focus,'qualifiedStructure'),'Structural instructions must remain in the full context');
  assert.deepEqual(focus.authoring.bounds,full.authoring.bounds);
  assert.deepEqual(focus.observables.limits,full.observables.limits);
  const types=[...new Set(doc.physics.components.map(c=>c.type))];
  assert.deepEqual(Object.keys(focus.authoring.componentTypes).sort(),types.sort());
  assert.deepEqual(focus.authoring.existingComponentFields.map(c=>c.id),doc.physics.components.map(c=>c.id));
  for(const [i,component] of doc.physics.components.entries()){
   const fields=focus.authoring.existingComponentFields[i];
   assert.equal(fields.type,component.type);
   assert.deepEqual(fields.parameters,Object.keys(component.parameters));
   assert.deepEqual(fields.emission,component.emission?Object.keys(component.emission):undefined);
  }
  for(const spec of Object.values(focus.observables.kinds)){
   const permitted=Array.isArray(spec.type)?spec.type:[spec.type];
   assert.ok(permitted.some(type=>types.includes(type)),'Focused result kinds refer only to existing component types');
  }
  // Byte-size is only a payload-compression proxy, not a measured LLM token
  // saving or higher authoring fidelity score.
  assert.ok(bytes(focus)<bytes(full)*.8,
   'The optional focused packet must actually be appreciably shorter');
  assert.equal(JSON.stringify(doc),untouched);
  console.log('FOCUSED_CONTEXT_BYTES '+JSON.stringify({
   fixture:name,fullBytes:bytes(full),focusedBytes:bytes(focus),
   percentageOfFull:Math.round(bytes(focus)/bytes(full)*100)
  }));
 });
}
test('Existing focal-length edit generated from focused context passes unchanged validated proposal path',async()=>{
 const doc=read('scenes/single-lens-detector.json');
 const parent=await explorationBundle(doc,null,[]);
 const focused=await focusedExplorationContext(parent,'Set lens-1 focalLength to 150 mm');
 const proposal={format:'opticsim-exploration-proposal-v1',
  expectedIntegritySha256:focused.responseContract.expectedIntegritySha256,
  intent:'Teacher hypothetical: longer focal length, not an original source fact',
  action:'revise',patch:{changes:[{id:'lens-1',section:'parameters',
   key:'focalLength',value:150,unit:'mm'}]}};
 const checked=await prepareExplorationProposal(parent,proposal);
 assert.equal(checked.status,'validated-not-executed');
 assert.equal(checked.child.scene.physics.components.find(c=>c.id==='lens-1').parameters.focalLength,150);
 assert.equal(parent.scene.physics.components.find(c=>c.id==='lens-1').parameters.focalLength,100);
 assert.equal(checked.child.qualification.edits.length,1);
 const stale={...proposal,expectedIntegritySha256:'0'.repeat(64)};
 await assert.rejects(()=>prepareExplorationProposal(parent,stale),/Stale proposal/);
});
test('Existing single-ray direction edit and explicit new observation work without structural context',async()=>{
 const doc=read('scenes/polygon-dielectric.json');
 const parent=await explorationBundle(doc,null,[]);
 const focus=await focusedExplorationContext(parent,'Set only S1 direction to 5 degrees');
 assert.ok(Object.hasOwn(focus.observables.kinds,'interface-face-events'));
 assert.ok(!Object.hasOwn(focus.observables.kinds,'mirror-reflections'));
 const proposal={format:'opticsim-exploration-proposal-v1',
  expectedIntegritySha256:focus.responseContract.expectedIntegritySha256,
  intent:'Teacher directional what-if, no solved physical route',
  action:'revise',patch:{changes:[{id:'S1',section:'emission',key:'directionDeg',value:5}]},
  additionalObservables:[{id:'observed-faces',kind:'interface-face-events',componentId:'G1'}]};
 const checked=await prepareExplorationProposal(parent,proposal);
 assert.equal(checked.child.scene.physics.components.find(c=>c.id==='S1').emission.directionDeg,5);
 assert.equal(checked.child.observables[0].kind,'interface-face-events');
 assert.deepEqual(parent.observables,[]);
 const tampered=structuredClone(parent);
 tampered.scene.physics.components.find(c=>c.id==='S1').emission.directionDeg=17;
 await assert.rejects(()=>focusedExplorationContext(tampered,'next'),/integrity mismatch/i);
});
