// Reproducible native evidence re-evaluation of portable INPUT notebooks.
// Exposed fixture family controls, not unseen model/teacher/physics fidelity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {explorationBundle,snapshotScenario} from '../src/exploration.js';
import {createExplorationNotebook} from '../src/exploration-notebook.js';
import {replayExplorationNotebook,NOTEBOOK_REPLAY_FORMAT}
 from '../src/exploration-notebook-replay.js';
import {reviseScene} from '../src/authoring.js';
import {createQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const scene=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const families=[
 ['lens','scenes/single-lens-detector.json',{id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}],
 ['mirror','scenes/plane-mirror-detector.json',{id:'source-1',section:'parameters',key:'y',value:40,unit:'mm'}],
 ['glass','scenes/polygon-dielectric.json',{id:'S1',section:'emission',key:'directionDeg',value:5}]
];
async function pair(path,change,readouts=[]){
 const source=scene(path),bundle=await explorationBundle(source,null,readouts),
  old=evaluateDocument(source,core,bundle.observables);
 assert.ok(old.summary.executionPassed,'Known baseline native fixture must complete');
 const baseline=await snapshotScenario(bundle,old,'Baseline');
 const doc=reviseScene(source,{changes:[change]}).document,
  q=recordQualifiedEdit(source,doc,bundle.qualification),
  child=await createQualifiedBundle(doc,q,bundle.observables),
  native=evaluateDocument(doc,core,bundle.observables);
 assert.ok(native.summary.executionPassed,'Known teacher what-if fixture must complete');
 const updated=await snapshotScenario(child,native,'Teacher hypothetical',
  {intent:'Explicit teacher variation, not original source fact',
   parentIntegritySha256:bundle.integritySha256});
 return {notebook:await createExplorationNotebook([baseline,updated]),source};
}
for(const [name,path,change] of families){
 test('Fresh notebook replay for '+name+' preserves qualified inputs and creates only newly observed evidence',async()=>{
  const {notebook,source}=await pair(path,change,
   name==='lens'?[{id:'emissions',kind:'source-emissions',componentId:'source-1'}]:
   name==='mirror'?[{id:'reflections',kind:'mirror-reflections',componentId:'mirror-1'}]:
    [{id:'events',kind:'interface-interactions',componentId:'G1'}]);
  const bytes=JSON.stringify(notebook),inputSource=JSON.stringify(source);
  const observed=[],compared=[];let calls=0;
  const result=await replayExplorationNotebook(notebook,{
   run:(doc,requests,identity)=>{calls++;assert.equal(identity.index,calls-1);
    assert.deepEqual(requests,notebook.entries[identity.index].bundle.observables);
    assert.equal(identity.sceneSha256,notebook.entries[identity.index].bundle.sceneSha256);
    return evaluateDocument(doc,core,requests);},
   onTrial:async r=>observed.push(r),
   onComparison:async r=>compared.push(r)
  });
  assert.equal(result.format,NOTEBOOK_REPLAY_FORMAT);
  assert.equal(result.status,'all-native-qualified');
  assert.equal(result.attemptedEntries,2);assert.equal(result.newNativeQualified,2);
  assert.equal(result.nativeIncomplete,0);assert.equal(result.infrastructureErrors,0);
  assert.equal(result.comparisonsMade,1);assert.equal(result.comparisonsWithheld,0);
  assert.equal(calls,2);assert.equal(observed.length,2);
  assert.equal(compared.length,1);assert.equal(compared[0].nativeComparisonPerformed,true);
  for(let i=0;i<2;i++){
   assert.equal(result.rows[i].sceneSha256,notebook.entries[i].bundle.sceneSha256);
   assert.equal(result.rows[i].qualifiedIntegritySha256,notebook.entries[i].bundle.integritySha256);
   assert.equal(result.rows[i].status,'native-qualified');
   assert.equal(result.rows[i].currentFromNewExecution,true);
   assert.equal(result.rows[i].currentNativeSummary.canonicalSha256,notebook.entries[i].bundle.sceneSha256);
   assert.deepEqual(result.rows[i].requestedResults.results.map(x=>x.id),
    notebook.entries[i].bundle.observables.map(x=>x.id));
  }
  assert.equal(JSON.stringify(notebook),bytes,'Original notebook immutable');
  assert.equal(JSON.stringify(source),inputSource,'Original source immutable');
  assert.equal(result.inputOnly,true);
  assert.equal(result.importedResultReuse,false);
  assert.equal(result.interpretationFidelity,'not-assessed');
  assert.equal(result.teacherEducationalUsefulness,'not-assessed');
  console.log('NATIVE_NOTEBOOK_REPLAY '+JSON.stringify({family:name,attempts:calls,
   qualified:result.newNativeQualified,comparisons:result.comparisonsMade}));
 });
}
test('Native-failed scenario remains incomplete, never gets stale requested results or an automatic delta',async()=>{
 const {notebook}=await pair(families[0][1],families[0][2]);
 let n=0;const rows=[];
 const r=await replayExplorationNotebook(notebook,{
  run:(doc,req)=>{n++;const old=evaluateDocument(doc,core,req);
   if(n===2){old.summary.executionPassed=false;old.summary.native.status='failed';
    old.summary.native.errors=['Synthesized native failure for test only'];
    old.summary.measurementState='withheld-incomplete';}
   return old;},
  onTrial:async row=>rows.push(row)
 });
 assert.equal(r.status,'partial-native-incomplete');
 assert.equal(r.newNativeQualified,1);
 assert.equal(r.nativeIncomplete,1);assert.equal(r.infrastructureErrors,0);
 assert.equal(r.rows[1].status,'native-incomplete');
 assert.equal(r.rows[1].qualifiedResults,null);
 assert.equal(r.rows[1].nativeStatus,'failed');
 assert.equal(r.rows[1].currentFromNewExecution,true);
 assert.equal(r.comparisonsMade,0);assert.equal(r.comparisonsWithheld,1);
 assert.equal(r.comparisons[0].nativeComparisonPerformed,false);
 assert.equal(rows.length,2);
});
test('Unexpected runner error is separately recorded and stops, not counted as a native failure',async()=>{
 const {notebook}=await pair(families[0][1],families[0][2]);
 let calls=0;const rows=[];
 const r=await replayExplorationNotebook(notebook,{
  run:(doc,req)=>{calls++;if(calls===2)throw Error('Test-only runner fault');
   return evaluateDocument(doc,core,req);},
  onTrial:async row=>rows.push(row)
 });
 assert.equal(r.status,'interrupted');assert.equal(r.interrupted,true);
 assert.equal(r.attemptedEntries,2);assert.equal(r.newNativeQualified,1);
 assert.equal(r.infrastructureErrors,1);assert.equal(r.nativeIncomplete,0);
 assert.match(r.rows[1].reason,/Test-only runner fault/);
 assert.equal(r.rows[1].currentFromNewExecution,false);
 assert.equal(r.comparisonsMade,0);assert.equal(r.comparisonsWithheld,0);
 assert.equal(rows.length,2);
});
test('All child inputs are verified before even the first native attempt',async()=>{
 const {notebook}=await pair(families[0][1],families[0][2]);
 let runs=0;const tampered=structuredClone(notebook);
 tampered.entries[1].bundle.scene.physics.components.find(c=>c.id==='lens-1').parameters.focalLength=1;
 await assert.rejects(()=>replayExplorationNotebook(tampered,{
  run:()=>{runs++;return null;}
 }),/Qualified package integrity mismatch/);
 assert.equal(runs,0);
});
test('Completed-but-stale native summary does not become a qualified optical measurement',async()=>{
 const {notebook}=await pair(families[0][1],families[0][2]);
 let n=0;
 const r=await replayExplorationNotebook(notebook,{
  run:(doc,req)=>{n++;const o=evaluateDocument(doc,core,req);
   if(n===2)o.summary.canonicalSha256='0'.repeat(64);
   return o;}
 });
 assert.equal(r.status,'interrupted');
 assert.equal(r.newNativeQualified,1);
 assert.equal(r.infrastructureErrors,1);
 assert.match(r.rows[1].reason,/missing, stale or incomplete/i);
 assert.equal(r.rows[1].qualifiedResults,null);
});
test('Replay does not allow a result-less/injected runner to appear native complete',async()=>{
 const {notebook}=await pair(families[0][1],families[0][2]);
 let n=0;
 const r=await replayExplorationNotebook(notebook,{
  run:()=>{n++;return {summary:{executionPassed:true}};}
 });
 assert.equal(n,1);
 assert.equal(r.status,'interrupted');
 assert.equal(r.rows[0].nativeStatus,'not-certified');
 assert.equal(r.rows[0].currentFromNewExecution,false);
 assert.equal(r.rows[0].qualifiedResults,null);
});
