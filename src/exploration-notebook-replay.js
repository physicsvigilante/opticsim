// Reconstruct current native evidence for portable, verified notebook INPUTS.
// Never trust or import cached rays, detector measurements or comparisons.
// Native engine and all physical/qualification contracts remain authoritative.
import {verifyExplorationNotebook} from './exploration-notebook.js';
import {qualifyRunnerSummary} from './native-observations.js';
import {snapshotScenario,compareExplorationSnapshots} from './exploration.js';
export const NOTEBOOK_REPLAY_FORMAT='opticsim-notebook-native-replay-v1';

const nativeAccepted=x=>x?.executionPassed===true&&
 ['completed','completed-with-warnings'].includes(x?.native?.status)&&
 x.native.truncation===0&&x.native.undefinedBehavior===0&&
 Array.isArray(x.native.errors)&&x.native.errors.length===0&&!x.native.error&&
 ['complete','qualified-with-warnings','not-requested'].includes(x.measurementState);

export async function replayExplorationNotebook(input,{run,onTrial=async()=>{},onComparison=async()=>{}}={}){
 if(typeof run!=='function'||typeof onTrial!=='function'||typeof onComparison!=='function')
  throw Error('Notebook replay requires explicit native runner and evidence callbacks');
 // Validate ALL notebook input/assumption/observation hashes before *any*
 // native process runs. Guard against input edits during async verification.
 const notebook=await verifyExplorationNotebook(input);
 const rows=[],comparisons=[],snapshots=[];
 let interrupted=false;
 for(const [index,entry] of notebook.entries.entries()){
  const identity={index,label:entry.label,
   intent:entry.intent,parentIntegritySha256:entry.parentIntegritySha256,
   qualifiedIntegritySha256:entry.bundle.integritySha256,
   sceneSha256:entry.bundle.sceneSha256};
  let result,snapshot=null;
  try{
   // No observational defaults, repaired dimensions, changed ray density or
   // new physics: the exact authored qualified scene and requested readouts.
   const executed=await run(structuredClone(entry.bundle.scene),
     structuredClone(entry.bundle.observables),structuredClone(identity));
   if(!executed?.summary?.native)
    throw Error('Native runner returned no actual terminal diagnostics');
   const summary=qualifyRunnerSummary(entry.bundle.scene,structuredClone(executed.summary));
   if(nativeAccepted(summary)){
    // Existing strict snapshot checks bind actual current native hash to the
    // authored scene and reject stale or inconsistent observations.
    snapshot=await snapshotScenario(entry.bundle,executed,entry.label,{
     intent:entry.intent,parentIntegritySha256:entry.parentIntegritySha256});
    result={...identity,status:'native-qualified',nativeStatus:summary.native.status,
     currentNativeSummary:summary,requestedResults:snapshot.results,
     currentFromNewExecution:true};
   }else{
    result={...identity,status:'native-incomplete',
     nativeStatus:summary.native.status??'unknown',
     nativeError:summary.native.error??null,
     nativeIssues:summary.native.errors??[],
     nativeWarnings:summary.native.warnings??[],
     executionPassed:false,currentFromNewExecution:true,
     qualifiedResults:null};
   }
  }catch(error){
   // A thrown *infrastructure* error is not a native-reported failure, and
   // may not be silently skipped; abort after recording this one attempt.
   result={...identity,status:'replay-infrastructure-error',nativeStatus:'not-certified',
    reason:String(error?.message||error),executionPassed:false,
    qualifiedResults:null,currentFromNewExecution:false};
   interrupted=true;
  }
  rows.push(result);snapshots.push(snapshot);
  await onTrial(structuredClone(result),index);
  if(interrupted)break;
 }
 if(!interrupted){
  for(let i=1;i<rows.length;i++){
   const base=rows[0],target=rows[i];
   let comparison;
   if(!snapshots[0]||!snapshots[i]){
    comparison={index:i,status:'not-comparable',baselineLabel:base.label,
     scenarioLabel:target.label,reason:'Missing current, complete qualified native evidence for baseline or scenario.',
     nativeComparisonPerformed:false};
   }else{
    const report=await compareExplorationSnapshots(snapshots[0],snapshots[i]);
    comparison={index:i,status:'compared',nativeComparisonPerformed:true,
     ...report};
   }
   comparisons.push(comparison);
   await onComparison(structuredClone(comparison),i);
  }
 }
 const report={format:NOTEBOOK_REPLAY_FORMAT,
  inputNotebookIntegritySha256:notebook.integritySha256,
  originalBaselineIntegritySha256:notebook.baselineIntegritySha256,
  nativeEngine:'caller-provided pinned Opticsim core; one fresh native execution per attempted entry',
  inputOnly:true,importedResultReuse:false,sourceTruthIndependentlyCertified:false,
  interpretationFidelity:'not-assessed',teacherEducationalUsefulness:'not-assessed',
  plannedEntries:notebook.entries.length,attemptedEntries:rows.length,
  newNativeQualified:rows.filter(x=>x.status==='native-qualified').length,
  nativeIncomplete:rows.filter(x=>x.status==='native-incomplete').length,
  infrastructureErrors:rows.filter(x=>x.status==='replay-infrastructure-error').length,
  comparisonsMade:comparisons.filter(x=>x.status==='compared').length,
  comparisonsWithheld:comparisons.filter(x=>x.status==='not-comparable').length,
  interrupted,status:interrupted?'interrupted':
   rows.every(x=>x.status==='native-qualified')?'all-native-qualified':'partial-native-incomplete',
  rows,comparisons};
 return report;
}
