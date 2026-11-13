// Post-capture held-out scoring. The capture process NEVER imports this file.
import {scoreAuthoring,physicalSignatures} from '../cross-family-prospective-v3/replay.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function namedSignatures(physical,ids){
  if(!physical||!Array.isArray(physical.components))return null;
  return physicalSignatures({lengthUnit:physical.lengthUnit,
    components:physical.components.filter(c=>ids.includes(c.id))},
    {includeIds:true,validateSupported:false});
}
function targetsMatch(expected,results){
  const seen=new Map();
  for(const r of results||[]){
    if(typeof r.componentId!=='string')continue;
    const key=JSON.stringify([r.kind,r.componentId]);
    seen.set(key,(seen.get(key)||0)+1);
  }
  for(const t of expected){
    const key=JSON.stringify([t.kind,t.componentId]);
    if(!seen.get(key))return false;
    seen.set(key,seen.get(key)-1);
  }
  return true;
}
export function scoreHeldout(reference,attempt,preflight,run){
  const scored=scoreAuthoring(reference,attempt,preflight,run,{strictNegativeIds:[]});
  const ids=reference.requiredComponentIds||[],targets=reference.expectedTargets||[];
  const referenceIds=ids.length?namedSignatures(reference.expectedPhysical,ids):null;
  const authoredIds=ids.length?namedSignatures(attempt.response.physical,ids):null;
  const statedIdsFaithful=ids.length?referenceIds!==null&&same(referenceIds,authoredIds):null;
  const targetFidelity=targets.length?targetsMatch(targets,run.report.results):null;
  const exactAuthoring=scored.physicalFidelity&&scored.kindFidelity&&
    scored.preflightCorrect&&(!ids.length||statedIdsFaithful===true)&&
    targetFidelity!==false&&
    (reference.classification==='supported'
      ?scored.nativeComplete&&scored.resultCorrect
      :scored.negativeDiscipline);
  return {...scored,statedIdsFaithful,targetFidelity,
    requiredStatedIds:ids.length,adjudicatedTargets:targets.length,exactAuthoring};
}
