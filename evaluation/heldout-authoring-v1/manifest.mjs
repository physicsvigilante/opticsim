// Shared *data-only* private manifest validation. No model calls or native core.
// Questions and independent reference are never put in git or a public artifact.
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,relative,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const HOLDOUT_ROOT=resolve(ROOT,'test-artifacts/llm-evaluation/private-heldout');
export const sha256=b=>createHash('sha256').update(b).digest('hex');
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hex=/^[a-f0-9]{64}$/;
const keys=(x,expected)=>isObject(x)&&Object.keys(x).every(k=>expected.includes(k));
const validId=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(x);
const asString=(x,n)=>typeof x==='string'&&x.trim().length>=n&&x.length<=12000;
function uniqueCases(cases){
 if(!Array.isArray(cases)||cases.length<1||cases.length>12)throw Error('Expected 1–12 private cases');
 const ids=new Set();
 for(const x of cases){
  if(!validId(x?.id)||ids.has(x.id))throw Error('Invalid or duplicate private case ID');
  ids.add(x.id);
 }
 return [...ids];
}
export function validateQuestions(obj){
 if(!keys(obj,['format','cases'])||obj.format!=='opticsim-heldout-questions-v1')
  throw Error('Expected strict opticsim-heldout-questions-v1 object, no reference keys');
 uniqueCases(obj.cases);
 for(const c of obj.cases){
  if(!keys(c,['id','prompt'])||!asString(c.prompt,15))
   throw Error(c.id+': one original, nonempty private text prompt is required');
 }
 return obj;
}
export function validateReference(obj,questions){
 if(!keys(obj,['format','cases','reviewers'])||obj.format!=='opticsim-heldout-reference-v1')
  throw Error('Expected strict heldout reference');
 // Reviewer strings are *declared* identities, not independently authenticated.
 if(!Array.isArray(obj.reviewers)||obj.reviewers.length<2||
    obj.reviewers.some(x=>!asString(x,2)||x.length>100)||
    new Set(obj.reviewers).size!==obj.reviewers.length)
  throw Error('Reference requires at least two distinct declared reviewers');
 const ids=uniqueCases(obj.cases);
 if(ids.join('|')!==questions.cases.map(x=>x.id).join('|'))
  throw Error('Reference must contain the exact precommitted case IDs, in order');
 const classifications=['supported','missing','unsupported','ambiguous','invalid'];
 const expected=['native-ready','blocked','invalid-input','no-native-required'];
 for(const c of obj.cases){
  if(!keys(c,['id','classification','expectedPhysical','requestKinds','expectedPreflight','expectedFirstStatus','reasonCode','reviewNote','requiredComponentIds','expectedTargets'])||
     !classifications.includes(c.classification)||
     !expected.includes(c.expectedPreflight)||
     !Array.isArray(c.requestKinds)||c.requestKinds.length<1||c.requestKinds.length>16||
     c.requestKinds.some(x=>typeof x!=='string'||!x||x.length>80)||
     (c.expectedPhysical!==null&&!isObject(c.expectedPhysical))||
     (c.expectedFirstStatus!==undefined&&!['needs-information','unavailable','invalid-input'].includes(c.expectedFirstStatus))||
     (c.reasonCode!==undefined&&(!asString(c.reasonCode,1)||c.reasonCode.length>100))||
     (c.reviewNote!==undefined&&!asString(c.reviewNote,5)))
   throw Error(c.id+': invalid adjudicated reference row');
  if(c.classification==='supported'&&
     (c.expectedPreflight!=='native-ready'||!isObject(c.expectedPhysical)))
    throw Error(c.id+': supported case must declare native-ready apparatus');
  if(c.classification!=='supported'&&c.expectedPreflight==='native-ready')
    throw Error(c.id+': negative reference cannot declare native-ready');
  // Empty arrays certify that the question states no component IDs or targets.
  if(c.classification==='supported'&&
     (!Array.isArray(c.requiredComponentIds)||!Array.isArray(c.expectedTargets)))
    throw Error(c.id+': supported reference requires adjudicated ID and target lists');
  if(c.classification!=='supported'&&c.expectedFirstStatus===undefined)
    throw Error(c.id+': negative reference requires expectedFirstStatus');
  if(c.requiredComponentIds!==undefined&&(!Array.isArray(c.requiredComponentIds)||
     c.requiredComponentIds.some(id=>!validId(id))||
     new Set(c.requiredComponentIds).size!==c.requiredComponentIds.length))
    throw Error(c.id+': invalid stated component IDs');
  if(c.expectedTargets!==undefined&&(!Array.isArray(c.expectedTargets)||
     c.expectedTargets.some(t=>!keys(t,['kind','componentId'])||
       Object.keys(t).length!==2||typeof t.kind!=='string'||
       !c.requestKinds.includes(t.kind)||!validId(t.componentId))||
     new Set(c.expectedTargets.map(t=>JSON.stringify([t.kind,t.componentId]))).size!==c.expectedTargets.length))
    throw Error(c.id+': invalid expected measurement targets');
  if(c.classification==='supported'){
    const components=Array.isArray(c.expectedPhysical.components)?c.expectedPhysical.components:[];
    const ids=new Set(components.map(x=>x.id));
    if(c.requiredComponentIds.some(id=>!ids.has(id))||
       c.expectedTargets.some(t=>!ids.has(t.componentId)))
      throw Error(c.id+': reviewed IDs and targets must exist in expected apparatus');
  }
 }
 return obj;
}
export function readJSON(path,max=512000){
 const b=readFileSync(resolve(path));
 if(b.length>max)throw Error('Private input exceeds declared byte budget');
 return {bytes:b,value:JSON.parse(b.toString('utf8')),digest:sha256(b)};
}
export function makeCommitment(questions,reference,questionBytes,referenceBytes){
 validateQuestions(questions);validateReference(reference,questions);
 return {format:'opticsim-heldout-commitment-v1',
  questionsSha256:sha256(questionBytes),referenceSha256:sha256(referenceBytes),
  ids:questions.cases.map(x=>x.id),numberOfCases:questions.cases.length,
  note:'SHA-256 commitments prove byte equality only, not independent authorship or correctness. Reference must be independently reviewed before inference.'};
}
export function checkCommitment(obj,questionsBytes,referenceBytes=null){
 if(!keys(obj,['format','questionsSha256','referenceSha256','ids','numberOfCases','note'])||
    obj.format!=='opticsim-heldout-commitment-v1'||
    !hex.test(obj.questionsSha256)||!hex.test(obj.referenceSha256)||
    !Array.isArray(obj.ids)||obj.ids.length<1||obj.ids.length>12||
    obj.ids.some(id=>!validId(id))||obj.numberOfCases!==obj.ids.length)
    throw Error('Invalid private SHA commitment');
 if(obj.questionsSha256!==sha256(questionsBytes))throw Error('Question bytes changed after commitment');
 if(referenceBytes!==null&&obj.referenceSha256!==sha256(referenceBytes))
    throw Error('Independent reference bytes changed after commitment');
 return obj;
}
export function checkedNewOutput(path){
 const absolute=resolve(path),rel=relative(HOLDOUT_ROOT,absolute);
 if(!rel||rel==='.'||rel==='..'||rel.startsWith('..'+sep)||rel.startsWith(sep))
   throw Error('Evidence must be a fresh descendant of ignored test-artifacts/llm-evaluation/private-heldout');
 if(existsSync(absolute))throw Error('Existing evidence path is immutable; use a new directory');
 // Refuse symlink ancestors and non-directory ancestors.
 let dir=dirname(absolute);
 while(dir!==dirname(dir)){
  if(existsSync(dir)){
   const stat=lstatSync(dir);
   if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('Unsafe evidence output ancestor');
  }
  dir=dirname(dir);
 }
 mkdirSync(absolute,{recursive:true});
 return absolute;
}
export function requirePrivateInput(path){
 // To reduce accidental publication, private input files must live beneath
 // the ignored test-artifacts area (not committed repository source).
 const abs=resolve(path),rel=relative(resolve(ROOT,'test-artifacts'),abs);
 if(!rel||rel==='..'||rel.startsWith('..'+sep)||rel.startsWith(sep))
  throw Error('Private cases, reference and commitment must be in ignored test-artifacts/');
 let dir=abs;
 while(dir!==dirname(dir)){
  if(existsSync(dir)&&lstatSync(dir).isSymbolicLink())
   throw Error('Private input must not traverse symbolic links');
  dir=dirname(dir);
 }
 return abs;
}
