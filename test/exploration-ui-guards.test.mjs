// Focused UI orchestration tests: the apply callback is a spy, not a native
// physics result. Native tracing is covered by the browser and core tests.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ExplorationUI} from '../src/exploration-ui.js';
import {explorationBundle,prepareExplorationProposal,EXPLORATION_PROPOSAL} from '../src/exploration.js';

async function harness(){
 const doc=JSON.parse(readFileSync(new URL('../scenes/single-lens-detector.json',import.meta.url)));
 const bundle=await explorationBundle(doc);
 const proposal={format:EXPLORATION_PROPOSAL,expectedIntegritySha256:bundle.integritySha256,
  intent:'Investigate a 150 mm focal length, preserving other physics.',action:'revise',
  patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}]}};
 const prepared=await prepareExplorationProposal(bundle,proposal);
 const ui=Object.create(ExplorationUI.prototype),applications=[];
 Object.assign(ui,{session:{document:bundle.scene,state:'completed',revision:1},
  qualified:{qualification:bundle.qualification,requests:bundle.observables},hasPending:()=>false,
  proposal:{value:JSON.stringify(proposal)},previewText:{textContent:''},status:{textContent:''},intent:null,
  applyBundle:child=>{applications.push(child);return true;}});
 ui.preview={token:ui.token(),rawText:ui.proposal.value,prepared};
 const token=ui.token();let release;
 ui.current=()=>new Promise(resolve=>{release=()=>resolve({bundle,token});});
 return {ui,bundle,applications,release:()=>release()};
}

test('Apply rejects an editor change while final qualified validation is pending',async()=>{
 const h=await harness(),before=JSON.stringify(h.bundle),pending=h.ui.apply();
 h.ui.proposal.value='{"replacement":"not the previewed proposal"}';
 h.ui.invalidatePreview();h.release();
 await assert.rejects(pending,/Proposal text changed during validation/);
 assert.equal(h.applications.length,0);assert.equal(h.ui.intent,null);
 assert.equal(JSON.stringify(h.bundle),before);
});

test('Restoring identical text does not resurrect a preview invalidated during Apply',async()=>{
 const h=await harness(),text=h.ui.proposal.value,pending=h.ui.apply();
 h.ui.proposal.value=text+' ';h.ui.invalidatePreview();h.ui.proposal.value=text;
 h.release();
 await assert.rejects(pending,/Preview it again before applying/);
 assert.equal(h.applications.length,0);assert.equal(h.ui.intent,null);
});

test('An unchanged explicitly previewed proposal reaches Apply exactly once after validation',async()=>{
 const h=await harness(),pending=h.ui.apply();h.release();await pending;
 assert.equal(h.applications.length,1);
 assert.equal(h.applications[0].scene.physics.components.find(c=>c.id==='lens-1').parameters.focalLength,150);
 assert.equal(h.bundle.scene.physics.components.find(c=>c.id==='lens-1').parameters.focalLength,100);
 assert.equal(h.ui.intent.parentIntegritySha256,h.bundle.integritySha256);
 assert.equal(h.ui.preview,null);
});

test('A scene change during Apply remains rejected even when proposal text is unchanged',async()=>{
 const h=await harness(),pending=h.ui.apply();h.ui.session.revision++;h.release();
 await assert.rejects(pending,/Current model changed during this action/);
 assert.equal(h.applications.length,0);assert.equal(h.ui.intent,null);
});
