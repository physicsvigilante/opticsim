// Deterministic audit of already frozen original kinds and existing software
// controls. No external model, source-image reading, solutions or ray tracing.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {planProblem} from '../src/problem-workflow.js';
const root=resolve('.');
const read=path=>readFileSync(resolve(root,path));
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const historical=[
 ['evaluation/real-ten-v1/first-attempts.json','f149779dfc638a99b723dfb8a224d595f6f3afe7','engineRequest'],
 ['evaluation/reduced-inverse-original-v1/first-attempts.json','b57d10d9688380d92dffc047aea0a47c4d2c493f','submittedRequest']
];
const out=resolve(root,'test-artifacts/llm-authoring/method-suitability-v1');
mkdirSync(out,{recursive:true});
const observations={format:'opticsim-method-suitability-acceptance-v1',
  evaluation:'Deterministic typed-contract audit, not language model selection accuracy',
  externalModelCalls:0,repairs:0,nativeCalls:0,
  historical:{totalCases:0,totalRequestedKinds:0,unregistered:0,sourceHashes:{}},
  existingControls:{totalCases:0,conditional:0,unresolved:0},
  nativeSoftwareControls:{totalCases:0,pendingNative:0},rows:[]};
for(const [path,pin,key] of historical){
 const bytes=read(path);assert.equal(blob(bytes),pin,'Frozen original attempts changed');
 observations.historical.sourceHashes[path]=sha(bytes);
 const attempts=JSON.parse(bytes);
 for(const original of attempts.cases){
  const p=planProblem(original[key]);
  assert.equal(p.scene,null);assert.equal(p.native.canRun,false);
  assert.equal(p.methodSuitability.unregisteredRequests,original[key].requests.length);
  assert.ok(p.methodSuitability.entries.every(x=>!x.registered&&x.readiness==='unregistered-kind'));
  observations.historical.totalCases++;
  observations.historical.totalRequestedKinds+=original[key].requests.length;
  observations.historical.unregistered+=p.methodSuitability.unregisteredRequests;
  observations.rows.push({caseId:original.id,group:'historical-first-attempt',
    rawKindStatuses:p.methodSuitability.entries.map(e=>({kind:e.kind,readiness:e.readiness})),
    nativeCalls:0,authoringAccuracy:null});
 }
}
assert.equal(observations.historical.totalCases,16);
assert.equal(observations.historical.totalRequestedKinds,19);
assert.equal(observations.historical.unregistered,19);
const controls=JSON.parse(read('evaluation/reduced-inverse-v1/controls.json'));
assert.equal(controls.cases.length,9);
for(const example of controls.cases){
 const p=planProblem(example.request);
 const entry=p.methodSuitability.entries[0];
 assert.equal(entry.registered,true);assert.equal(entry.planResultStatus,example.status);
 assert.equal(p.native.canRun,false);assert.equal(p.scene,null);
 observations.existingControls.totalCases++;
 if(entry.readiness==='conditional-result')observations.existingControls.conditional++;
 else observations.existingControls.unresolved++;
 observations.rows.push({caseId:example.id,group:'published-reduced-inverse-control',
  method:entry.kind,readiness:entry.readiness,nativeCalls:0,authoringAccuracy:null});
}
assert.equal(observations.existingControls.conditional,3);
assert.equal(observations.existingControls.unresolved,6);
const pilot=JSON.parse(read('evaluation/self-reviewed-pilot-v1/first-attempts.json'));
assert.equal(pilot.independentModel,false);assert.equal(pilot.externalProviderCalls,0);
for(const raw of pilot.attempts.filter(x=>x.kind==='request')){
 const p=planProblem(JSON.parse(raw.rawOutput).request);
 assert.equal(p.native.canRun,true);
 assert.ok(p.methodSuitability.entries.every(e=>e.readiness==='requires-native-execution'));
 observations.nativeSoftwareControls.totalCases++;
 observations.nativeSoftwareControls.pendingNative+=p.methodSuitability.pendingNativeRequests;
 observations.rows.push({caseId:raw.id,group:'published-native-synthetic-control',
  readiness:'requires-native-execution',pending:p.methodSuitability.pendingNativeRequests,
  nativeCalls:0,authoringAccuracy:null});
}
assert.equal(observations.nativeSoftwareControls.totalCases,2);
assert.equal(observations.nativeSoftwareControls.pendingNative,6);
const resultFile=resolve(out,'report.json');
writeFileSync(resultFile,JSON.stringify(observations,null,2)+'\n',{flag:'wx'});
console.log('Method suitability acceptance PASS: 16 original development first attempts (19 unregistered exact kinds), 9 registered inverse controls and 2 native-ready synthetic plans; no model/native execution.');
