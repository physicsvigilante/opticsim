// Read-only presentation of already validated qualification and current results.
// No inference, scene edits, native calls, result evaluation or HTML from imports.
import {LENGTH_PARAMETERS} from './contract.js';
const complete=state=>['completed','completed-with-warnings'].includes(state);
const plural=(n,one,many=one+'s')=>n+' '+(n===1?one:many);
const text=value=>typeof value==='string'?value:'';
const scalar=value=>{
  if(value===null)return 'null';
  if(['number','boolean'].includes(typeof value))return String(value);
  if(typeof value==='string')return JSON.stringify(value.length>180?value.slice(0,180)+'…':value);
  return '[structured value; inspect qualified package]';
};
const structural=path=>path==='$.physics'||path==='$.physics.components'||
  /^\$\.physics\.components\[\d+\](?:$|\.id$|\.type$)/.test(path);
function changeText(change,doc,history,eventIndex){
  const path=text(change.path),match=/^\$\.physics\.components\[(\d+)\]\.(parameters|emission)\.([A-Za-z][A-Za-z0-9]*)$/.exec(path);
  // Array indices alone do not establish historic component identity after a
  // structural edit. Show the recorded path rather than invent an old ID.
  const stable=match&&!history.slice(eventIndex).some(e=>
    (e.changes||[]).some(c=>structural(text(c.path))));
  const component=stable?doc?.physics?.components?.[Number(match[1])]:null;
  const label=component?component.id+'.'+match[3]:path;
  let unit='';
  if(match){
    const key=match[3];
    if(match[2]==='parameters'&&LENGTH_PARAMETERS.includes(key))unit=' mm';
    else if(['directionDeg','angleDeg','orientationDeg','normalDeg'].includes(key))unit=' degrees';
    else if(key==='brightness')unit=' (relative units)';
  }
  return label+': '+scalar(change.before)+' → '+scalar(change.after)+unit;
}
function latestChange(doc,q,prefix,label){
  if(!q)return label+': no qualified history loaded.';
  const history=Array.isArray(q.edits)?q.edits:[];
  for(let i=history.length-1;i>=0;i--){
    const changes=(history[i].changes||[]).filter(c=>
      text(c.path)===prefix||text(c.path).startsWith(prefix+'.'));
    if(!changes.length)continue;
    return label+' (#'+(i+1)+'): '+changes.slice(0,4).map(c=>changeText(c,doc,history,i)).join('; ')+
      (changes.length>4?'; '+(changes.length-4)+' more changes in the qualified package.':'.');
  }
  return label+': none recorded.';
}
export function evidencePanelView({doc=null,qualification=null,requests=[],state,phase='checking',results=null}){
  const source=qualification?.interpretation?.source;
  const reference=source?[source.caseId,source.path].filter(v=>typeof v==='string'&&v.length).join(' · '):'';
  const view={
    state:'waiting',
    summary:'Checking current-revision readouts…',
    resultLimits:'No previous readouts are being counted as current.',
    source:reference?'Recorded source: '+reference:
      qualification?'Recorded source: not supplied.':'Recorded source: unknown; no qualified package loaded.',
    sourceHash:source?.sha256?'Source SHA-256: '+source.sha256:'Source SHA-256: not recorded.',
    physical:latestChange(doc,qualification,'$.physics','Latest physical edit'),
    numerical:latestChange(doc,qualification,'$.simulation','Latest numerical edit'),
    provenance:state==='invalid'?
      'Historical source and edits below belong to the last accepted scene, not the invalid current input.':
      'Recorded source and edit history are author-provided, not independently verified. Presentation edits are not physical changes.'
  };
  if(!doc||!complete(state)){
    view.state='suppressed';
    view.summary='Current readouts suppressed — '+(text(state)||'no accepted scene')+'.';
    view.resultLimits='No current sampled readings or conditional predictions are claimed. Complete a valid run first.';
    return view;
  }
  if(!requests.length){
    view.state='none';view.summary='No requested readouts — native scene only.';
    view.resultLimits='Tracing does not require an answer target. Any analytical panel is separate from sampled observations.';
    return view;
  }
  if(phase==='error'){
    view.state='error';view.summary='Current readouts unavailable — result evaluation failed.';
    view.resultLimits='Inspect the detailed error below; previous readouts are not current.';return view;
  }
  if(phase!=='ready'||!Array.isArray(results)||results.length!==requests.length)return view;
  let native=0,conditional=0,unavailable=0,suppressed=0,other=0,qualified=0;
  const missing=[];
  for(const r of results){
    if(['available','qualified'].includes(r.status)&&r.method==='native-observation'){
      native++;if(r.status==='qualified')qualified++;
    }else if(r.status==='conditional')conditional++;
    else if(r.status==='unavailable'){unavailable++;missing.push(r);}
    else if(r.status==='suppressed')suppressed++;
    else other++;
  }
  view.state='ready';
  view.summary=[plural(native,'native sampled readout'),plural(conditional,'conditional prediction'),
    plural(unavailable,'unavailable quantity','unavailable quantities'),
    ...(suppressed?[plural(suppressed,'suppressed readout')]:[]),
    ...(other?[plural(other,'other result state')]:[])].join(' · ');
  const missingText=missing.length?' Unavailable: '+missing.slice(0,4)
    .map(r=>r.id+' ('+r.kind+')').join('; ')+(missing.length>4?'; '+(missing.length-4)+' more in details.':'.'):'';
  view.resultLimits='Sampled readings are not continuous irradiance. Conditional predictions are not native image detections.'+
    (qualified?' '+plural(qualified,'native readout')+' qualified by warnings; inspect details.':'')+missingText;
  return view;
}
export function renderEvidencePanel(dom,view){
  // textContent only: source labels, IDs and history are untrusted imported text.
  const fields={summary:'evidence-summary',resultLimits:'evidence-result-limits',
    source:'evidence-source',sourceHash:'evidence-source-hash',physical:'evidence-physical-change',
    numerical:'evidence-numerical-change',provenance:'evidence-provenance-note'};
  for(const [key,id] of Object.entries(fields)){
    const node=dom.getElementById(id);
    if(node)node.textContent=view[key];
  }
  const summary=dom.getElementById('evidence-summary');
  if(summary)summary.dataset.state=view.state;
}
