// Versioned portable INPUT-ONLY exploration notebook. Qualified physical
// scenes/observations and teacher labels, never cached native execution results.
// The original exploration.js and native PhyDemo physics stay untouched.
import {verifyQualifiedBundle} from './qualification.js';
import {canonicalJSON,sha256Text,isRecord,boundedText} from './qualified-utils.js';
export const EXPLORATION_NOTEBOOK_FORMAT='opticsim-exploration-notebook-v1';
export const EXPLORATION_NOTEBOOK_MAX_BYTES=4*1024*1024;
export const EXPLORATION_NOTEBOOK_MAX_ENTRIES=12;
const hex=/^[a-f0-9]{64}$/;
const same=(x,y)=>canonicalJSON(x)===canonicalJSON(y);
const exactly=(value,keys)=>{
 if(!isRecord(value)||Object.keys(value).sort().join('|')!==keys.slice().sort().join('|'))
  throw Error('Invalid exploration notebook fields; unexpected or missing data');
};
const fileSize=value=>new TextEncoder().encode(JSON.stringify(value)).length;
function limit(value){
 if(fileSize(value)>EXPLORATION_NOTEBOOK_MAX_BYTES)
  throw Error('Exploration notebook exceeds 4 MiB; export smaller qualified scenes');
}
function textOrNull(value,label,max){
 if(value===null)return null;
 return boundedText(value,label,max);
}
function entryShape(input,index){
 exactly(input,['label','intent','parentIntegritySha256','bundle']);
 const label=boundedText(input.label,'Scenario label',80);
 const intent=textOrNull(input.intent,'Teacher hypothetical intent',1200);
 const parent=input.parentIntegritySha256;
 if(parent!==null&&(typeof parent!=='string'||!hex.test(parent)))
  throw Error('Notebook parent integrity must be a SHA-256 or null');
 if(index===0&&(label!=='Baseline'||intent!==null||parent!==null))
  throw Error('Notebook first entry must be the unchanged named Baseline');
 return {label,intent,parentIntegritySha256:parent};
}
async function validateEntries(entries,baselineSha){
 if(!Array.isArray(entries)||entries.length<1||entries.length>EXPLORATION_NOTEBOOK_MAX_ENTRIES)
  throw Error('Notebook must contain 1–12 separately saved scenarios');
 let sourceOrigin=null;const output=[];
 for(const [index,input] of entries.entries()){
  const fields=entryShape(input,index);
  const bundle=await verifyQualifiedBundle(input.bundle);
  if(index===0){
   if(bundle.integritySha256!==baselineSha)
    throw Error('Notebook baseline SHA-256 does not match first qualified bundle');
   sourceOrigin=bundle.qualification.origin;
  }else if(!same(sourceOrigin,bundle.qualification.origin))
   throw Error('Notebook mixed different declared source origins; do not merge unrelated scenes');
  // Nothing resembling a native run, cached results, a ray path or physics answer
  // is allowed inside the notebook entry, even when it would be "helpful".
  output.push({...fields,bundle});
 }
 return output;
}
export async function createExplorationNotebook(saved){
 if(!Array.isArray(saved)||saved.length<1||saved.length>EXPLORATION_NOTEBOOK_MAX_ENTRIES)
  throw Error('Save a baseline and at most 11 completed investigation scenarios first');
 // A notebook created by the viewer must be derived only from completed saved
 // snapshots. The notebook does NOT carry or authenticate those native results.
 const entries=[];
 for(const item of saved){
  const summary=item?.execution?.summary;
  if(summary?.canonicalSha256!==item?.bundle?.sceneSha256||
     summary?.executionPassed!==true||
     !['completed','completed-with-warnings'].includes(summary?.native?.status)||
     summary?.native?.truncation!==0||summary?.native?.undefinedBehavior!==0||
     !Array.isArray(summary?.native?.errors)||summary.native.errors.length||
     summary?.native?.error)
   throw Error('Notebook export requires individually completed saved scenarios, not imported or failed traces');
  entries.push({
   label:item.label,intent:item.intent??null,
   parentIntegritySha256:item.parentIntegritySha256??null,bundle:item.bundle
  });
 }
 const payload={format:EXPLORATION_NOTEBOOK_FORMAT,
  baselineIntegritySha256:entries[0].bundle?.integritySha256,entries};
 limit(payload);
 const clean=await validateNotebookPayload(payload);
 const notebook={...clean,integritySha256:await sha256Text(canonicalJSON(clean))};
 limit(notebook);
 return notebook;
}
async function validateNotebookPayload(payload){
 exactly(payload,['format','baselineIntegritySha256','entries']);
 if(payload.format!==EXPLORATION_NOTEBOOK_FORMAT)
  throw Error('Unsupported exploration notebook format');
 if(typeof payload.baselineIntegritySha256!=='string'||!hex.test(payload.baselineIntegritySha256))
  throw Error('Invalid notebook baseline identity');
 const entries=await validateEntries(payload.entries,payload.baselineIntegritySha256);
 return {format:EXPLORATION_NOTEBOOK_FORMAT,baselineIntegritySha256:payload.baselineIntegritySha256,entries};
}
export async function verifyExplorationNotebook(input){
 // Snapshot BEFORE asynchronous hashing. Reject unknown/cached-result fields.
 const copy=structuredClone(input);
 limit(copy);
 exactly(copy,['format','baselineIntegritySha256','entries','integritySha256']);
 if(typeof copy.integritySha256!=='string'||!hex.test(copy.integritySha256))
  throw Error('Notebook integrity SHA-256 missing or invalid');
 const {integritySha256,...payload}=copy;
 const clean=await validateNotebookPayload(payload);
 if(await sha256Text(canonicalJSON(clean))!==integritySha256)
  throw Error('Exploration notebook integrity mismatch; labels and qualified scenes must stay together');
 return structuredClone({...clean,integritySha256});
}
export async function parseExplorationNotebook(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>EXPLORATION_NOTEBOOK_MAX_BYTES)
  throw Error('Exploration notebook file must be JSON and no larger than 4 MiB');
 return verifyExplorationNotebook(JSON.parse(text));
}
