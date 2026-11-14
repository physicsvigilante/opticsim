// Prospective same-assistant revision transfer. No provider inference, production
// feature or answer-key solver. Decisions stay byte-frozen even when they fail.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validate,serializeSave} from '../../src/contract.js';
import {reviseScene} from '../../src/authoring.js';
import {prepareQualifiedStructure} from '../../src/qualified-structure.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,parseQualifiedBundle} from '../../src/qualification.js';
import {evaluateObservables} from '../../src/observables.js';
import {canonicalJSON} from '../../src/qualified-utils.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {reserveAuthoringOutput} from '../../scripts/authoring-evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),folder=resolve(root,'evaluation/revision-transfer-v1');
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
const text=x=>JSON.stringify(x,null,2)+'\n';
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
export const PINS=Object.freeze({prompts:'2d07fb32b0811668def5e43c7106826e479d653e',decisions:'a0b6cdef3df367901105fb14f057a0498923972b'});
export function reviewPhysicalChange(baseline,proposed,rule){
 // The post-freeze review describes source/prompt facts, never native answers.
 const expected=structuredClone(baseline),change=rule.expectedChange;
 if(!change)return null;
 if(change.kind==='add')expected.physics.components.push(structuredClone(change.component));
 else if(change.kind==='remove')expected.physics.components=expected.physics.components.filter(c=>c.id!==change.id);
 else{
  const c=expected.physics.components.find(c=>c.id===change.id);
  if(!c)throw Error('Review names absent source component');
  if(change.kind==='field-delta')c[change.section][change.key]+=change.deltaMm;
  else if(change.kind==='field-value')c[change.section][change.key]=change.value;
  else throw Error('Unsupported review constraint');
 }
 return {exactRequestedState:same(expected,proposed),unchangedNumerics:same(baseline.simulation,proposed.simulation),
  unchangedPresentation:same(baseline.presentation,proposed.presentation),unchangedModelFamily:baseline.physics.model===proposed.physics.model,
  reviewer:'same-assistant, not independent',scope:'The exact declared physical change, not new source-model interpretation or teaching effectiveness'};
}
export async function runTransfer({outputPath=resolve(root,'test-artifacts/llm-authoring/revision-transfer-v1')}={}){
 const promptsBytes=readFileSync(resolve(folder,'prompts.json')),decisionBytes=readFileSync(resolve(folder,'first-decisions.json'));
 assert.equal(blob(promptsBytes),PINS.prompts);assert.equal(blob(decisionBytes),PINS.decisions);
 const prompts=JSON.parse(promptsBytes),decisions=JSON.parse(decisionBytes),review=JSON.parse(readFileSync(resolve(folder,'review.json')));
 assert.equal(decisions.promptsFreezeCommit,'0c111037b5a8d9b4a7604312432c393b256520f1');
 assert.equal(review.firstDecisionsFreezeCommit,'e83cb9135fa8655c27e1e718c519a0604b5cbcf0');
 assert.deepEqual(prompts.cases.map(c=>c.id),decisions.cases.map(c=>c.id));assert.deepEqual(prompts.cases.map(c=>c.id),review.cases.map(c=>c.id));
 const out=reserveAuthoringOutput(outputPath,root).directory;
 const write=(name,value)=>writeFileSync(resolve(out,name),Buffer.isBuffer(value)||typeof value==='string'?value:text(value),{flag:'wx'});
 write('prompts.json',promptsBytes);write('first-decisions.json',decisionBytes);write('review.json',review);
 const report={format:'opticsim-revision-transfer-report-v1',status:'running',firstDecisionFreezeCommit:review.firstDecisionsFreezeCommit,
  promptsSha256:hash(promptsBytes),decisionsSha256:hash(decisionBytes),sourceModels:[],cases:[],
  nativeCalls:{baselines:0,revisions:0,unexecuted:0},externalModelCalls:0,repairs:0,
  independentModel:false,independentReview:false,teacherParticipants:0,studentParticipants:0,
  exposure:prompts.exposure,educationalUsefulness:'not-assessed',textbookAnswerCompleteness:'not-requested',
  originalModelInterpretation:'not-assessed; source documents supplied directly',
  executionCommit:process.env.GITHUB_SHA||'local',workflowRun:process.env.GITHUB_RUN_ID||null};
 const models=new Map();
 try{
 for(const source of prompts.sourceModels){
  const bytes=readFileSync(resolve(root,source.path));assert.equal(blob(bytes),source.gitBlob);
  const doc=JSON.parse(bytes);validate(doc);
  const requests=doc.physics.components.filter(c=>c.type==='point-source').map(c=>({id:c.id+'-emissions',kind:'source-emissions',componentId:c.id}));
  for(const c of doc.physics.components.filter(c=>c.type==='ray-detector'))requests.push({id:c.id+'-crossings',kind:'detector-crossings',componentId:c.id});
  const qualification=initialQualification(doc,null,{inputSha256:hash(bytes),interpretation:{
   source:{caseId:source.id,path:source.path,sha256:hash(bytes)},
   stated:['The canonical source document supplies this entire physical baseline and its numerical/presentation settings.'],
   derived:[],assumptions:['New proposals are hypothetical classroom investigations, not original source facts.'],
   unknowns:['Independent interpretation accuracy, continuous irradiance and learning effectiveness are not established.']}});
  const bundle=await createQualifiedBundle(doc,qualification,requests);
  report.nativeCalls.baselines++;const execution=evaluateDocument(doc,core);
  assert.equal(execution.summary.executionPassed,true,'Baseline fixture must actually execute');
  const results=await evaluateObservables(doc,requests,execution.summary);
  const dir=resolve(out,source.id);mkdirSync(dir);
  write(source.id+'/source.json',bytes);write(source.id+'/qualified-scene.json',bundle);write(source.id+'/execution.json',execution.summary);write(source.id+'/results.json',results);
  models.set(source.id,{bundle,immutable:canonicalJSON(bundle),sourceSha256:hash(bytes)});
  report.sourceModels.push({...source,sha256:hash(bytes),sceneSha256:bundle.sceneSha256,integritySha256:bundle.integritySha256,nativeStatus:execution.summary.native.status});
 }
 for(let i=0;i<decisions.cases.length;i++){
  const decision=decisions.cases[i],prompt=prompts.cases[i],rule=review.cases[i],model=models.get(decision.model);
  assert.equal(decision.id,prompt.id);assert.equal(decision.model,prompt.model);assert.ok(model);
  const parent=await parseQualifiedBundle(text(model.bundle));
  const caseDir=resolve(out,decision.id);mkdirSync(caseDir);
  write(decision.id+'/decision.json',decision);
  const row={id:decision.id,sourceModel:decision.model,decisionSha256:hash(Buffer.from(text(decision))),
   parentSceneSha256:parent.sceneSha256,parentIntegritySha256:parent.integritySha256,sourceGiven:false,
   expectedDisposition:rule.expectedDisposition,requestedChangeFidelity:null,nativeCalls:0,
   educationalUsefulness:'not-assessed',textbookAnswerCompleteness:'not-requested'};
  if(decision.action==='needs-information'){
   row.outcome='unexecuted-needs-information';row.reason=decision.explanation;row.missing=decision.missing;
   row.responseReview={status:'provisional-same-assistant',note:rule.reviewNote};
   row.native={status:'not-run'};
  }else{
   let document,qualification,requests;
   try{
    if(decision.action==='revise'){
     document=reviseScene(parent.scene,decision.patch).document;
     qualification=recordQualifiedEdit(parent.scene,document,parent.qualification);requests=parent.observables;
    }else if(decision.action==='structure'){
     assert.equal(Object.hasOwn(decision.patch,'expectedSha256'),false,'Model hash binding is mechanical and explicit');
     const structural=await prepareQualifiedStructure(parent,{...decision.patch,expectedSha256:parent.sceneSha256});
     document=structural.document;qualification=structural.qualification;requests=structural.observables;
    }else throw Error('Unknown authored action');
    requests=[...requests,...(decision.additionalObservables??[])];
    validate(document);
    row.requestedChangeFidelity=reviewPhysicalChange(parent.scene,document,rule);
    row.observationSelectionMatchesReview=same(decision.additionalObservables??[],rule.expectedAdditionalObservables??[]);
   }catch(error){
    row.outcome='engine-rejection';row.native={status:'not-run'};
    row.rejection={name:error.name,message:error.message,code:error.code??null,issues:error.issues??[]};
   }
   if(document&&row.outcome!=='engine-rejection'){
    const before=serializeSave(document);
    report.nativeCalls.revisions++;row.nativeCalls++;
    const execution=evaluateDocument(document,core);
    const results=await evaluateObservables(document,requests,execution.summary);
    const bundle=await createQualifiedBundle(document,qualification,requests);
    assert.deepEqual(await parseQualifiedBundle(text(bundle)),bundle);
    assert.equal(serializeSave(document),before);
    assert.deepEqual(bundle.qualification.origin,parent.qualification.origin);
    assert.deepEqual(bundle.qualification.interpretation,parent.qualification.interpretation);
    row.outcome=execution.summary.executionPassed?'native-completed':'native-incomplete';
    row.native=execution.summary.native;row.results=results.results;row.observations=execution.summary.observations;
    row.sceneSha256=bundle.sceneSha256;row.integritySha256=bundle.integritySha256;
    row.qualifiedPackage=decision.id+'/qualified-scene.json';
    row.simulationCoverage={admittedModel:document.physics.model,retainedSourceModel:true,sourceComponentsBefore:parent.scene.physics.components.length,componentsAfter:document.physics.components.length};
    row.physicalNumericalEvidence={executionPassed:execution.summary.executionPassed,measurementState:execution.summary.measurementState,
     qualification:'Existing pinned native model and regression coverage; no new independent optics oracle or source-interpretation certificate.'};
    if(rule.mustRemainUnavailable){const r=results.results.find(r=>r.id===rule.mustRemainUnavailable);
     row.removedTargetRetainedUnavailable=!!r&&r.status==='unavailable'&&r.value===null;}
    write(decision.id+'/qualified-scene.json',bundle);write(decision.id+'/execution.json',execution.summary);write(decision.id+'/results.json',results);
   }
  }
  assert.equal(canonicalJSON(model.bundle),model.immutable,'An attempt mutated the source baseline');
  row.baselinePreserved=true;report.cases.push(row);write(decision.id+'/report.json',row);
 }
 report.counts={firstDecisions:report.cases.length,
  executedRevisions:report.cases.filter(c=>c.nativeCalls>0).length,
  completeNativeRevisions:report.cases.filter(c=>c.outcome==='native-completed').length,
  exactRequestedStateAmongExecuted:report.cases.filter(c=>c.nativeCalls>0&&c.requestedChangeFidelity?.exactRequestedState&&c.observationSelectionMatchesReview).length,
  engineRejections:report.cases.filter(c=>c.outcome==='engine-rejection').length,
  unexecutedNeedsInformation:report.cases.filter(c=>c.outcome==='unexecuted-needs-information').length};
 report.status='recorded';
 write('report.json',report);return report;
 }catch(error){report.status='infrastructure-or-contract-error';report.failure={message:error.message,stack:error.stack};write('failure.json',report);throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runTransfer().then(r=>console.log('Revision transfer recorded: '+JSON.stringify({counts:r.counts,nativeCalls:r.nativeCalls}))).catch(e=>{console.error(e.stack);process.exitCode=1;});
