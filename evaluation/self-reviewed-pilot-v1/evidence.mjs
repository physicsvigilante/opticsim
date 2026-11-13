// Evidence utilities only: never trace, repair, or fabricate native results.
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
export function saveRawResponse(path,raw){
  if(typeof raw!=='string')throw Error('Raw first response must be a string');
  const bytes=Buffer.from(raw,'utf8');
  writeFileSync(path,bytes,{flag:'wx'});
  return createHash('sha256').update(bytes).digest('hex');
}
export function assessNativeCounts(expected,report,requests){
  const observations=(report.results||[]).map(r=>({
    id:r.id,kind:r.kind,componentId:r.componentId??null,status:r.status,value:r.value
  }));
  const kinds={absorptions:'blocker-absorptions',crossings:'detector-crossings'};
  const comparisons=Object.entries(expected||{}).map(([key,value])=>{
    if(!Number.isFinite(value))throw Error('Invalid expected native count: '+key);
    if(key==='emitted')return {key,expected:value,actual:report.native?.emitted??null,
      matches:['completed','completed-with-warnings'].includes(report.native?.status)&&report.native?.emitted===value};
    if(!Object.hasOwn(kinds,key))throw Error('Unknown expected native count: '+key);
    const targets=requests.filter(r=>r.kind===kinds[key]);
    // Legacy shorthand is valid only for one explicit target. Never select
    // one of several same-kind measurements by array order or overwrite.
    if(targets.length!==1||typeof targets[0].componentId!=='string')
      throw Error('Ambiguous expected native count target: '+key);
    const target=targets[0],found=observations.filter(r=>r.id===target.id&&
      r.kind===target.kind&&r.componentId===target.componentId);
    const actual=found.length===1?found[0]:null;
    return {key,componentId:target.componentId,expected:value,actual:actual?.value??null,
      matches:!!actual&&['available','qualified'].includes(actual.status)&&actual.value===value};
  });
  return {observations,comparisons,expectedCountMatch:comparisons.length?comparisons.every(x=>x.matches):null};
}
export function supportedOutcome(score,countAssessment){
  return score.exactAuthoring===true&&countAssessment.expectedCountMatch!==false;
}
