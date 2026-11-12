// A bounded deterministic experiment over the existing revision/result contracts.
// Every sample is a fresh copy of ONE verified baseline, never the prior sample.
import {LENGTH_PARAMETERS} from './contract.js';
import {reviseScene} from './authoring.js';
import {validateObservables,evaluateObservables} from './observables.js';
import {verifyQualifiedBundle,recordQualifiedEdit,createQualifiedBundle} from './qualification.js';
import {isRecord,canonicalJSON} from './qualified-utils.js';
export const SWEEP_LIMITS=Object.freeze({samples:25,processedRayLimit:10000,maxRayDepth:8,rayDensity:1});
function keys(value,allowed,label){
  if(!isRecord(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Invalid '+label+' fields');
}
export function validateSweep(spec,baseline){
  keys(spec,['format','expectedSceneSha256','parameter','values','observables','plot'],'sweep');
  if(spec.format!=='opticsim-parameter-sweep-v1')throw Error('Unsupported sweep format');
  if(spec.expectedSceneSha256!==baseline.sceneSha256)throw Error('STALE_BASELINE: sweep hash does not match the baseline scene');
  const p=spec.parameter;
  keys(p,['id','section','key','unit'],'sweep parameter');
  const component=baseline.scene.physics.components.find(c=>c.id===p.id);
  if(!component||!['parameters','emission'].includes(p.section)||
    !Object.hasOwn(component[p.section]||{},p.key)||typeof component[p.section][p.key]!=='number')
    throw Error('Sweep target must be one existing numeric physical field');
  if(LENGTH_PARAMETERS.includes(p.key)){
    if(!['mm','cm','m'].includes(p.unit))throw Error('Length sweep requires explicit mm, cm or m');
  }else if(p.unit!==undefined)throw Error('Non-length fields use existing native units, without a unit override');
  if(!Array.isArray(spec.values)||!spec.values.length||spec.values.length>SWEEP_LIMITS.samples||
    spec.values.some(v=>typeof v!=='number'||!Number.isFinite(v))||new Set(spec.values).size!==spec.values.length)
    throw Error('Supply 1–25 distinct finite numeric values; no ranges or executable expressions');
  const requests=spec.observables??baseline.observables;validateObservables(requests);
  if(!requests.length)throw Error('A sweep needs at least one requested observable');
  for(const [key,maximum] of Object.entries(SWEEP_LIMITS)){
    if(key!=='samples'&&baseline.scene.simulation[key]>maximum)
      throw Error('Sweep budget exceeded: '+key+' must be <= '+maximum+'; baseline is not silently changed');
  }
  if(spec.plot!==undefined){
    keys(spec.plot,['observableId','field'],'plot');
    if(!requests.some(r=>r.id===spec.plot.observableId)||
      !['value','x','y','distance','normalDistance','magnification'].includes(spec.plot.field))
      throw Error('Plot must name a requested observable and a supported numeric field');
  }
  return requests;
}
export async function runParameterSweep(bundle,spec,{execute,onSample=async()=>{}}={}){
  // Snapshot both caller-owned inputs before the first async boundary.
  // Verification and native execution may yield while a caller edits its inputs.
  bundle=structuredClone(bundle);spec=structuredClone(spec);
  const baseline=await verifyQualifiedBundle(bundle);
  const requests=validateSweep(spec,baseline);
  if(typeof execute!=='function')throw Error('Native execution function is required');
  const report={format:'opticsim-sweep-report-v1',baselineSceneSha256:baseline.sceneSha256,
    baselineIntegritySha256:baseline.integritySha256,specification:spec,limits:SWEEP_LIMITS,
    plannedSamples:spec.values.length,samples:[],questionSupport:'not-assessed-by-engine'};
  const baselineState=canonicalJSON(baseline);
  for(const [index,value] of spec.values.entries()){
    const changes={changes:[{...spec.parameter,value}]};
    let document=null,qualified=null,execution=null,requestedResults=null,status='invalid-input',error=null,stage='validation';
    try{
      document=reviseScene(baseline.scene,changes).document;
      qualified=await createQualifiedBundle(document,
        recordQualifiedEdit(baseline.scene,document,baseline.qualification),requests);
      stage='execution';
      execution=await execute(structuredClone(document));
      requestedResults=await evaluateObservables(document,requests,execution.summary);
      status=execution.summary.executionPassed?'completed':'incomplete';
    }catch(e){
      error={message:e.message,issues:e.issues||[]};
      status=stage==='validation'?'invalid-input':'execution-failed';
    }
    const sample={index,value,status,changes,baselineSceneSha256:baseline.sceneSha256,
      sceneSha256:qualified?.sceneSha256||null,native:execution?.summary?.native||{status:stage==='validation'?'not-run':'failed'},
      requestedResults,error};
    // Evidence-write failures abort the run; never relabel them as bad physics.
    await onSample(structuredClone(sample),{bundle:qualified,execution});
    report.samples.push(sample);
  }
  if(canonicalJSON(baseline)!==baselineState)throw Error('Baseline mutation detected');
  report.completedSamples=report.samples.filter(s=>s.status==='completed').length;
  report.failedSamples=report.samples.length-report.completedSamples;
  report.status=report.failedSamples?'completed-with-failed-samples':'completed';
  return report;
}
export function plotSamples(report){
  const plot=report.specification.plot;
  if(!plot)return [];
  return report.samples.map(s=>{
    const r=s.requestedResults?.results.find(r=>r.id===plot.observableId);
    const n=plot.field==='value'?r?.value:r?.value?.[plot.field];
    const value=s.status==='completed'&&['available','qualified','conditional'].includes(r?.status)&&Number.isFinite(n)?n:null;
    return {index:s.index,x:s.value,y:value,status:r?.status||s.status,
      reason:value===null?(r?.reason||s.error?.message||'No finite numeric value (including infinity)'):null};
  });
}
