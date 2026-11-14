// Evidence-only CLI acceptance of a minimal structural delta, not a new simulator.
// The baseline source, physical values, other components and source notes remain immutable.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene,COMPONENT_REVISION_FORMAT} from '../src/authoring.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {reserveAuthoringOutput} from './authoring-evidence.mjs';
import {serializeSave} from '../src/contract.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
const text=x=>JSON.stringify(x,null,2)+'\n';
const fixture=readFileSync(resolve(root,'scenes/single-lens-detector.json'));
const prior=JSON.parse(readFileSync(resolve(root,'evaluation/teaching-fidelity-v1/plan.json')));
const scene=prepareScene(prior.initialRequest).document;
assert.deepEqual(scene.physics.components,JSON.parse(fixture).physics.components);
const initial=Buffer.from(text(prior.initialRequest));
const qualification=initialQualification(scene,null,{inputSha256:hash(initial),
 interpretation:{source:{caseId:'structural-authoring-v1',path:'scenes/single-lens-detector.json',sha256:hash(fixture)},
   stated:['The three original component fields come from the already exposed repository source fixture.'],
   derived:[],assumptions:['The added detector is a teacher proposal, not a source fact.'],
   unknowns:['No ideal-lens material refractive index is specified.']}});
const original=await createQualifiedBundle(scene,qualification,prior.observables);
const out=reserveAuthoringOutput(resolve(root,'test-artifacts/llm-authoring/structural-revision-v1'),root).directory;
const write=(name,x)=>{
 const path=resolve(out,name);writeFileSync(path,Buffer.isBuffer(x)?x:typeof x==='string'?x:text(x),{flag:'wx'});
 return path;
};
const input=write('baseline-qualified.json',original),originSha=hash(readFileSync(input));
const detector={id:'detector-2',type:'ray-detector',parameters:{x:80,y:0,orientationDeg:90,length:160}};
const patch=(operations,sha=original.sceneSha256)=>({expectedSha256:sha,format:COMPONENT_REVISION_FORMAT,operations});
const cases=[];
function cli(name,change){
 const source=write(name+'.changes.json',change),dest=resolve(out,name);
 const result=spawnSync(process.execPath,['scripts/qualified-scene.mjs','structure',input,source,'--out',dest],{
   cwd:root,encoding:'utf8',timeout:120000,env:{...process.env}});
 if(result.error)throw result.error;
 let summary;
 try{summary=JSON.parse(result.stdout);}catch{
   throw Error(name+' CLI did not return a JSON evidence summary: '+result.stdout+' '+result.stderr);
 }
 cases.push({id:name,exitCode:result.status,native:summary.native,status:summary.executionPassed,
   requestedResults:summary.requestedResults?.results?.map(r=>({id:r.id,status:r.status,method:r.method,value:r.value})),
   issues:summary.issues??null,sourceChangeSha256:hash(readFileSync(source)),evidence:summary.outputs??null});
 return {result,summary,dest};
}
const added=cli('added-detector',patch([{op:'add',lengthUnit:'mm',component:detector}]));
assert.equal(added.result.status,0);
assert.equal(added.summary.native.status,'completed');
assert.ok(added.summary.executionPassed);
assert.equal(added.summary.native.truncation,0);
assert.equal(added.summary.native.undefinedBehavior,0);
const b=await parseQualifiedBundle(readFileSync(resolve(added.dest,'qualified-scene.json'),'utf8'));
assert.equal(b.scene.physics.components.length,scene.physics.components.length+1);
assert.deepEqual(b.scene.physics.components.slice(0,-1),scene.physics.components);
assert.deepEqual(b.scene.physics.components.at(-1),detector);
assert.deepEqual(b.scene.simulation,scene.simulation);
assert.deepEqual(b.scene.presentation,scene.presentation);
assert.deepEqual(b.qualification.origin,qualification.origin);
assert.deepEqual(b.qualification.interpretation,qualification.interpretation);
assert.deepEqual(b.observables,prior.observables);
assert.equal(b.qualification.edits.length,1);
assert.equal(b.qualification.edits[0].kind,'physics');
assert.ok(Number.isFinite(added.summary.observations?.detectorsById?.['detector-2']?.crossings));
assert.ok(added.summary.observations.detectorsById['detector-2'].crossings>0);
assert.equal(added.summary.requestedResults.results.find(r=>r.id==='crossings').method,'native-observation');
assert.equal(added.summary.requestedResults.results.find(r=>r.id==='predicted-image').nativeImageDetected,false);
const removed=cli('removed-original-detector',patch([{op:'remove',id:'detector-1'}]));
assert.equal(removed.result.status,0);
assert.equal(removed.summary.native.status,'completed');
assert.equal(removed.summary.requestedResults.results.find(r=>r.id==='crossings').status,'unavailable');
assert.equal(removed.summary.requestedResults.results.find(r=>r.id==='crossings').value,null);
const r=await parseQualifiedBundle(readFileSync(resolve(removed.dest,'qualified-scene.json'),'utf8'));
assert.equal(r.scene.physics.components.length,scene.physics.components.length-1);
assert.equal(r.scene.physics.components.find(x=>x.id==='detector-1'),undefined);
assert.deepEqual(r.observables,prior.observables); // No silent target substitution.
const overlap=cli('rejected-overlap',patch([{op:'add',lengthUnit:'mm',
 component:{...detector,id:'colliding-detector',parameters:{...detector.parameters,x:0}}}]));
assert.notEqual(overlap.result.status,0);
assert.equal(overlap.summary.native.status,'not-run');
assert.equal(existsSync(resolve(overlap.dest,'qualified-scene.json')),false);
const stale=cli('rejected-stale',patch([{op:'add',lengthUnit:'mm',component:detector}],'b'.repeat(64)));
assert.notEqual(stale.result.status,0);
assert.equal(stale.summary.native.status,'not-run');
assert.equal(existsSync(resolve(stale.dest,'qualified-scene.json')),false);
assert.equal(hash(readFileSync(input)),originSha);
assert.equal(serializeSave(scene),serializeSave(original.scene));
const report={
 format:'opticsim-structural-revision-evidence-v1',status:'checks-passed',
 source:{path:'scenes/single-lens-detector.json',sha256:hash(fixture),classification:'previously exposed synthetic source'},
 baselineSceneSha256:original.sceneSha256,baselineIntegritySha256:original.integritySha256,
 baselineInputSha256:originSha,
 cases,nativeSuccessfulCases:2,nativeRejectedCases:0,externalModelCalls:0,
 modelInterpretation:'not-assessed',teacherParticipants:0,studentParticipants:0,
 notes:['Both supported structural proposals execute genuine pinned native PhyDemo.',
  'The missing removed-detector result remains explicitly unavailable; unchanged requests are not silently rebound.',
  'All new component dimensions were explicitly supplied in the valid add operation.',
  'The original source, numerical policy, model family and qualification origin are unchanged.',
  'Neither this code nor the source fixture establishes unfamiliar LLM selection or classroom learning.']
};
write('report.json',report);
console.log('Structural revision CLI acceptance '+JSON.stringify({
 status:report.status,cases:cases.length,successful:report.nativeSuccessfulCases,rejected:2,sourceSha256:report.source.sha256}));
