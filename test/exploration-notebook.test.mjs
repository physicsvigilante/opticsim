// Browser/Node unit and real native integration for the portable INPUT-ONLY
// notebook. No model provider, student/teacher study or new ray tracing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {explorationBundle,snapshotScenario} from '../src/exploration.js';
import {createQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {reviseScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {canonicalJSON,sha256Text} from '../src/qualified-utils.js';
import {createExplorationNotebook,verifyExplorationNotebook,parseExplorationNotebook,
 EXPLORATION_NOTEBOOK_FORMAT,EXPLORATION_NOTEBOOK_MAX_ENTRIES}
 from '../src/exploration-notebook.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const json=x=>JSON.stringify(x,null,2)+'\n';
const make=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const scenes=[
 {id:'lens',path:'scenes/single-lens-detector.json',
  change:{id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}},
 {id:'mirror',path:'scenes/plane-mirror-detector.json',
  change:{id:'source-1',section:'parameters',key:'y',value:40,unit:'mm'}},
 {id:'glass',path:'scenes/polygon-dielectric.json',
  change:{id:'S1',section:'emission',key:'directionDeg',value:5}}
];
async function completed(doc,bundle,label,extra={}){
 const run=evaluateDocument(doc,core,bundle.observables);
 assert.ok(run.summary.executionPassed,run.summary.native?.status+' '+JSON.stringify(run.summary.native?.errors));
 return snapshotScenario(bundle,run,label,extra);
}
async function pair(f){
 const doc=make(f.path);
 const baseline=await explorationBundle(doc);
 const first=await completed(doc,baseline,'Baseline');
 const revision=reviseScene(doc,{changes:[f.change]}).document;
 const q=recordQualifiedEdit(doc,revision,baseline.qualification);
 const next=await createQualifiedBundle(revision,q,baseline.observables);
 const second=await completed(revision,next,'Teacher what-if',{
  intent:'This is a teacher-hypothetical change, not an original source fact',
  parentIntegritySha256:baseline.integritySha256});
 return [first,second];
}
for(const f of scenes){
 test('Portable '+f.id+' notebook contains original qualified baseline and hypothetical but no native results',async()=>{
  const snapshots=await pair(f),original=JSON.stringify(snapshots);
  const notebook=await createExplorationNotebook(snapshots);
  assert.equal(notebook.format,EXPLORATION_NOTEBOOK_FORMAT);
  assert.equal(notebook.entries.length,2);
  assert.equal(notebook.entries[0].label,'Baseline');
  assert.equal(notebook.baselineIntegritySha256,snapshots[0].bundle.integritySha256);
  assert.equal(notebook.entries[1].parentIntegritySha256,snapshots[0].bundle.integritySha256);
  assert.deepEqual(notebook.entries[1].bundle,snapshots[1].bundle);
  assert.ok(notebook.entries.every(e=>!Object.hasOwn(e,'results')&&
   !Object.hasOwn(e,'execution')&&!Object.hasOwn(e,'native')));
  const parsed=await parseExplorationNotebook(json(notebook));
  assert.deepEqual(parsed,notebook);
  assert.equal(parsed.entries[1].bundle.sceneSha256,snapshots[1].bundle.sceneSha256);
  assert.equal(JSON.stringify(snapshots),original);
  assert.ok(Buffer.byteLength(json(notebook))<4*1024*1024);
  const a=await verifyExplorationNotebook(notebook);
  assert.deepEqual(a,notebook);
  console.log('NOTEBOOK_NATIVE_CASE '+JSON.stringify({
   family:f.id,entries:parsed.entries.length,
   bytes:Buffer.byteLength(json(notebook)),qualifier:'source-claims-not-certified',
   nativeTracesEmbedded:0}));
 });
}
test('Notebook refuses old, wrong, mixed-origin, tampered or non-executed evidence',async()=>{
 const lens=await pair(scenes[0]),mirror=await pair(scenes[1]);
 const good=await createExplorationNotebook(lens);
 const bad1=structuredClone(good);
 bad1.entries[1].bundle.scene.physics.components.find(c=>c.id==='lens-1').parameters.focalLength=77;
 await assert.rejects(()=>verifyExplorationNotebook(bad1),/Qualified package integrity mismatch/);
 const bad2=structuredClone(good);bad2.entries[1].label='Altered';
 await assert.rejects(()=>verifyExplorationNotebook(bad2),/Notebook integrity mismatch/);
 const bad3=structuredClone(good);bad3.entries[1].results=[{trusted:true}];
 await assert.rejects(()=>verifyExplorationNotebook(bad3),/unexpected or missing data/i);
 const bad4=structuredClone(good);bad4.cachedNativeStatus='completed';
 await assert.rejects(()=>verifyExplorationNotebook(bad4),/unexpected or missing data/i);
 const bad5=structuredClone(good);bad5.entries[0].label='Not baseline';
 await assert.rejects(()=>verifyExplorationNotebook(bad5),/unchanged named Baseline/);
 const bad6=structuredClone(good);bad6.baselineIntegritySha256='0'.repeat(64);
 await assert.rejects(()=>verifyExplorationNotebook(bad6),/baseline SHA-256/);
 const bad7=structuredClone(good);bad7.entries[1].bundle=mirror[1].bundle;
 await assert.rejects(()=>verifyExplorationNotebook(bad7),/mixed different declared source origins/);
 await assert.rejects(()=>createExplorationNotebook([lens[0],mirror[1]]),/mixed different declared source origins/);
 await assert.rejects(()=>createExplorationNotebook(Array.from({length:EXPLORATION_NOTEBOOK_MAX_ENTRIES+1},
  ()=>lens[0])),/at most 11/);
 const invalid=structuredClone(lens[1]);invalid.execution.summary.native.status='failed';
 await assert.rejects(()=>createExplorationNotebook([lens[0],invalid]),/individually completed/);
 const wrongLabel=structuredClone(lens[1]);wrongLabel.label='';
 await assert.rejects(()=>createExplorationNotebook([lens[0],wrongLabel]),/Scenario label/);
 const injected=structuredClone(lens[1]);injected.label='<img src=x onerror=alert(1)>';
 const note=await createExplorationNotebook([lens[0],injected]);
 assert.equal((await parseExplorationNotebook(JSON.stringify(note))).entries[1].label,
  '<img src=x onerror=alert(1)>','Untrusted label stays literal text');
 assert.equal(note.entries[1].intent,lens[1].intent);
 await assert.rejects(()=>parseExplorationNotebook(' '.repeat(4*1024*1024+1)),/no larger than 4 MiB/);
 await assert.rejects(()=>parseExplorationNotebook('{malformed'),SyntaxError);
});
test('Verification snapshots original notebook data before async hashes and rejects altered source',async()=>{
 const pairLens=await pair(scenes[0]);
 const original=await createExplorationNotebook(pairLens);
 const changing=structuredClone(original);
 const pending=verifyExplorationNotebook(changing);
 changing.entries[1].bundle.scene.physics.components.find(c=>c.id==='lens-1').parameters.focalLength=999;
 const verified=await pending;
 assert.equal(verified.entries[1].bundle.scene.physics.components.find(c=>c.id==='lens-1').parameters.focalLength,150);
 const tampered=structuredClone(original);
 const {integritySha256,...payload}=tampered;
 tampered.integritySha256=await sha256Text(canonicalJSON({
  ...payload,entries:payload.entries.map((e,i)=>i?{...e,label:'Altered after honest revision'}:e)
 }));
 await assert.rejects(()=>verifyExplorationNotebook(tampered),/Notebook integrity mismatch/);
});
