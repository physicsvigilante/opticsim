// Deterministic post-capture rubric for one trusted, engine-evaluated proposal.
// Never imported by private model capture. This compares a revision against
// independently PRE-COMMITTED source-grounded physical review, not a textbook
// numeric answer or a synthetic "native completion == fidelity" shortcut.
import {canonicalJSON} from '../../src/qualified-utils.js';
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const acceptedStatuses=new Set(['available','qualified','conditional']);
const validComplete=new Set(['completed','completed-with-warnings']);
const targets=items=>(items||[]).map(x=>JSON.stringify([x.kind,x.componentId])).sort();
// A valid but redundant no-op field assignment is still unnecessary LLM
// authoring, and must not be silently credited as the minimal requested delta.
function changedFieldKeys(original,expected){
 const next=new Map(expected.components.map(c=>[c.id,c]));
 const fields=[];
 for(const c of original.components){
   const d=next.get(c.id);if(!d)continue;
   for(const section of ['parameters','emission']){
     const prior=c[section]||{},after=d[section]||{};
     for(const key of new Set([...Object.keys(prior),...Object.keys(after)])){
       if(JSON.stringify(prior[key])!==JSON.stringify(after[key]))
         fields.push(JSON.stringify([c.id,section,key]));
     }
   }
 }
 return fields.sort();
}
function minimalRevisionPatch(baseline,reference,proposal){
 if(reference.expectedAction!=='revise')return true;
 if(proposal?.action!=='revise'||!Array.isArray(proposal.patch?.changes))return false;
 const keys=proposal.patch.changes.map(c=>JSON.stringify([c.id,c.section,c.key])).sort();
 return same(keys,changedFieldKeys(baseline.scene.physics,reference.expectedPhysics));
}
export function scoreExplorationRevision({reference,baseline,proposal,child,addedObservables,execution,requestedResults}){
 if(reference.classification!=='supported')throw Error('Supported revision rubric requires a supported pre-adjudicated case');
 const sc=child?.scene, native=execution?.summary?.native;
 const actionMatch=proposal?.action===reference.expectedAction;
 const physicalMatch=!!sc&&same(sc.physics,reference.expectedPhysics);
 const numericalPolicyPreserved=!!sc&&same(sc.simulation,baseline.scene.simulation);
 const presentationPreserved=!!sc&&same(sc.presentation,baseline.scene.presentation);
 const originalInterpretationPreserved=!!child&&
   same(child.qualification.origin,baseline.qualification.origin)&&
   same(child.qualification.interpretation,baseline.qualification.interpretation)&&
   same(child.qualification.assumptions,baseline.qualification.assumptions);
 const originalReadoutsPreserved=!!child&&
   child.observables.length===baseline.observables.length+(addedObservables?.length||0)&&
   same(child.observables.slice(0,baseline.observables.length),baseline.observables);
 const targetFidelity=same(targets(addedObservables),targets(reference.expectedAdditionalTargets));
 const patchMinimality=minimalRevisionPatch(baseline,reference,proposal);
 const currentExecution=!!sc&&!!native&&
   execution.summary.canonicalSha256===child.sceneSha256&&
   requestedResults?.canonicalSha256===child.sceneSha256;
 const nativeComplete=currentExecution&&execution.summary.executionPassed===true&&
   validComplete.has(native.status)&&native.truncation===0&&native.undefinedBehavior===0;
 const allRequestedReadoutsAvailable=(reference.expectedAdditionalTargets||[]).every(t=>{
   const matching=(addedObservables||[]).find(x=>x.kind===t.kind&&x.componentId===t.componentId);
   const result=matching&&requestedResults?.results?.find(x=>x.id===matching.id);
   return result&&result.kind===t.kind&&acceptedStatuses.has(result.status);
 });
 // A supported task can be physically faithful yet untraceable due to a
 // documented native limitation. Keep those two scores independent.
 const exactRequestedChange=actionMatch&&physicalMatch&&patchMinimality&&numericalPolicyPreserved&&
   presentationPreserved&&originalInterpretationPreserved&&originalReadoutsPreserved&&targetFidelity;
 const supportedQualified=exactRequestedChange&&nativeComplete&&allRequestedReadoutsAvailable;
 return {
   actionMatch,physicalFidelity:physicalMatch,targetFidelity,patchMinimality,
   numericalPolicyPreserved,presentationPreserved,originalInterpretationPreserved,
   originalReadoutsPreserved,exactRequestedChange,
   nativeCompleted:!!nativeComplete,observablesAvailable:!!allRequestedReadoutsAvailable,
   supportedQualified:!!supportedQualified,
   nativeStatus:native?.status||'not-run',nativeWarnings:native?.warnings||[],
   numericalQualifications:native?.warnings?.length?'native-warnings-present':'no-reported-warnings',
   baselineSceneSha256:baseline.sceneSha256,childSceneSha256:child?.sceneSha256||null,
   interpretationFidelity:'not-assessed: independent qualified baseline supplied',
   educationalUsefulness:'not-assessed; human teacher review required',
   textbookAnswerCompleteness:'not-requested',
   limitations:[
     'Physical fidelity is compared to a precommitted expert reference, not inferred from native completion.',
     'Declared expert reviewers require external verification of independence.',
     'Conditional ideal images are not native image detection; sampled crossings are not continuous irradiance.'
   ]
 };
}
export function scoreExplorationDecline(reference,reason){
 return {
   responseKind:'declined',provisionalDecline:reference.classification!=='supported',
   reason,exactRequestedChange:false,nativeCompleted:false,providerCallsInReview:0,
   manualExplanationReview:'required',automaticallyVerifiedNegative:false,
   interpretationFidelity:'not-assessed',educationalUsefulness:'not-assessed',
   note:'A missing/ambiguous/unsupported refusal is not independently approved until a subject-matter reviewer examines the actual reason.'
 };
}
export function summarizeExploration(rows,reference){
 const supported=rows.filter((_,i)=>reference.cases[i].classification==='supported');
 const negative=rows.filter((_,i)=>reference.cases[i].classification!=='supported');
 return {
   selected:rows.length,supported:supported.length,negative:negative.length,
   responsesWithProposal:rows.filter(x=>x.responseKind==='proposal').length,
   responsesDeclined:rows.filter(x=>x.responseKind==='declined').length,
   invalidResponseEnvelopes:rows.filter(x=>x.responseKind==='invalid').length,
   exactRequestedChanges:supported.filter(x=>x.exactRequestedChange===true).length,
   nativeCompletedAmongSupported:supported.filter(x=>x.nativeCompleted===true).length,
   supportedQualified:supported.filter(x=>x.supportedQualified===true).length,
   engineRejectedProposals:rows.filter(x=>x.engineRejected===true).length,
   provisionalNegativeDeclines:negative.filter(x=>x.provisionalDecline===true).length,
   automaticNegativeApprovals:0,
   reviewedTeacherLearningOutcomes:0,
   overallModelAccuracy:null
 };
}
