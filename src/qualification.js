// Portable sidecar envelope. The canonical v4 scene is unchanged. Integrity
// detects accidental mismatches, NOT authenticity of an author's assertions.
import {validate,LENGTH_PARAMETERS} from './contract.js';
import {validateObservables} from './observables.js';
import {canonicalJSON,sha256Text,sceneHash,isRecord,boundedText} from './qualified-utils.js';
export const bundleFormat='opticsim-qualified-scene-v1';
const hashPattern=/^[a-f0-9]{64}$/;
const textList=(value,label)=>{
  if(!Array.isArray(value)||value.length>32)throw Error(label+' must be a bounded array');
  value.forEach(v=>boundedText(v,label));
};
export function validateInterpretation(value){
  if(value===null)return null;
  if(!isRecord(value)||Object.keys(value).some(k=>!['source','requestedResult','stated','derived','assumptions','unknowns'].includes(k)))throw Error('Invalid interpretation metadata');
  if(value.source!==undefined){
    if(!isRecord(value.source)||Object.keys(value.source).some(k=>!['caseId','path','sha256'].includes(k)))throw Error('Invalid source reference');
    for(const [k,v] of Object.entries(value.source))boundedText(v,'Source '+k,500);
    if(value.source.sha256!==undefined&&!hashPattern.test(value.source.sha256))throw Error('Invalid source SHA-256');
  }
  if(value.requestedResult!==undefined)boundedText(value.requestedResult,'Requested result');
  for(const key of ['stated','derived','assumptions','unknowns'])if(value[key]!==undefined)textList(value[key],key);
  return value;
}
export function initialQualification(doc,problem=null,{inputSha256,interpretation=null}={}){
  validate(doc);validateInterpretation(interpretation);
  if(!hashPattern.test(inputSha256||''))throw Error('Original input hash is required');
  const assumptions=(problem?.appliedChoices||[]).map(c=>{
    const [section,key]=c.path.split('.').slice(-2);
    const component=doc.physics.components.find(x=>x.id===c.componentId);
    if(!component||!Object.hasOwn(component[section]||{},key))throw Error('Assumption does not bind to an authored field');
    return {componentId:c.componentId,section,key,value:component[section][key],
      unit:LENGTH_PARAMETERS.includes(key)?'mm':c.unit,purpose:c.purpose};
  });
  return {format:'opticsim-qualification-v1',origin:{inputSha256,
    preparationStatus:problem?.status||'fully-specified',policyVersion:problem?.policyVersion||null},
    assumptions,interpretation:structuredClone(interpretation),edits:[],
    interpretationAssessment:'author-provided-not-independently-verified'};
}
function validateQualification(q){
  if(!isRecord(q)||q.format!=='opticsim-qualification-v1'||!isRecord(q.origin)||
    !hashPattern.test(q.origin.inputSha256||'')||!Array.isArray(q.assumptions)||q.assumptions.length>42||
    !Array.isArray(q.edits)||q.edits.length>256)throw Error('Invalid or oversized qualification');
  if(!['fully-specified','illustrative','unknown'].includes(q.origin.preparationStatus))throw Error('Invalid origin preparation status');
  if(q.origin.policyVersion!==null)boundedText(q.origin.policyVersion,'Policy version',80);
  if(q.interpretationAssessment!=='author-provided-not-independently-verified')throw Error('Qualification cannot certify author interpretation');
  validateInterpretation(q.interpretation);
  for(const a of q.assumptions){
    if(!isRecord(a)||!['parameters','emission'].includes(a.section))throw Error('Invalid assumption reference');
    for(const key of ['componentId','key','unit','purpose'])boundedText(a[key],'Assumption '+key);
    if(!['string','number'].includes(typeof a.value)||typeof a.value==='number'&&!Number.isFinite(a.value))throw Error('Invalid assumption value');
  }
  for(const e of q.edits){
    if(!isRecord(e)||!['physics','numerics','presentation'].includes(e.kind)||!Array.isArray(e.changes)||e.changes.length>128)throw Error('Invalid edit history');
    for(const c of e.changes){
      if(!isRecord(c)||!Object.hasOwn(c,'before')||!Object.hasOwn(c,'after'))throw Error('Invalid edit record');
      boundedText(c.path,'Edit path',500);
    }
  }
  // Enforce JSON types and depth, including unknown untrusted metadata fields.
  if(canonicalJSON(q).length>200000)throw Error('Qualification exceeds metadata limit');
}
function differences(a,b,path='$',out=[]){
  if(canonicalJSON(a)===canonicalJSON(b))return out;
  if(isRecord(a)&&isRecord(b)){
    for(const key of new Set([...Object.keys(a),...Object.keys(b)]))
      differences(a[key]??null,b[key]??null,path+'.'+key,out);
  }else if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length){
    a.forEach((v,i)=>differences(v,b[i],path+'['+i+']',out));
  }else out.push({path,before:structuredClone(a),after:structuredClone(b)});
  return out;
}
export function recordQualifiedEdit(before,after,qualification){
  validate(before);validate(after);validateQualification(qualification);
  const changes=differences(before,after);
  if(!changes.length)return structuredClone(qualification);
  if(changes.length>128||qualification.edits.length>=256)throw Error('Qualification history limit reached; preserve this package before starting a new documented experiment');
  const next=structuredClone(qualification);
  const kind=changes.some(c=>c.path.startsWith('$.physics'))?'physics':
    changes.some(c=>c.path.startsWith('$.simulation'))?'numerics':'presentation';
  next.edits.push({kind,changes});
  validateQualification(next);return next;
}
export function qualificationSummary(doc,q){
  if(!q)return {status:'unknown',text:'No qualification loaded. Scene values do not reveal whether they were stated, derived or assumed.'};
  validateQualification(q);
  const assumptions=q.assumptions.map(a=>{
    const current=doc.physics.components.find(c=>c.id===a.componentId)?.[a.section]?.[a.key];
    return {...a,current:current??null,changed:current!==a.value};
  });
  const physicsEdited=q.edits.some(e=>e.kind==='physics');
  const status=physicsEdited?'revised':q.origin.preparationStatus;
  return {status,assumptions,physicsEdited,editCount:q.edits.length,
    declaredAssumptions:q.interpretation?.assumptions||[],
    unknowns:q.interpretation?.unknowns||[],requestedResult:q.interpretation?.requestedResult||null,
    text:'Origin: '+q.origin.preparationStatus+'. '+assumptions.length+' policy assumptions; '+
      (q.interpretation?.assumptions?.length||0)+' author-declared assumptions. '+q.edits.length+
      ' recorded edits. Author notes are unverified; completeness is not physical fidelity.'};
}
export async function createQualifiedBundle(doc,qualification,observables=[]){
  validate(doc);validateQualification(qualification);validateObservables(observables);
  const payload={format:bundleFormat,scene:structuredClone(doc),qualification:structuredClone(qualification),
    observables:structuredClone(observables),sceneSha256:await sceneHash(doc)};
  const integritySha256=await sha256Text(canonicalJSON(payload));
  const bundle={...payload,integritySha256};
  if(new TextEncoder().encode(JSON.stringify(bundle)).length>1024*1024)throw Error('Qualified package exceeds 1 MB');
  return bundle;
}
export async function verifyQualifiedBundle(bundle){
  if(!isRecord(bundle)||bundle.format!==bundleFormat||
    Object.keys(bundle).sort().join(',')!==['format','scene','qualification','observables','sceneSha256','integritySha256'].sort().join(','))throw Error('Invalid qualified package fields');
  validate(bundle.scene);validateQualification(bundle.qualification);validateObservables(bundle.observables);
  const {integritySha256,...payload}=bundle;
  if(!hashPattern.test(bundle.sceneSha256)||!hashPattern.test(integritySha256)||
    await sceneHash(bundle.scene)!==bundle.sceneSha256||
    await sha256Text(canonicalJSON(payload))!==integritySha256)throw Error('Qualified package integrity mismatch; scene and assumption history must stay together');
  return structuredClone(bundle);
}
export async function parseQualifiedBundle(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>1024*1024)throw Error('Qualified package exceeds 1 MB');
  return verifyQualifiedBundle(JSON.parse(text));
}
