// Private revision-task manifest validation. No provider calls and no reference
// import from model capture. Model baselines must be qualified, not raw scenes.
// Reuses the existing private evidence, bytes and SHA-256 commitment policy.
import {verifyQualifiedBundle} from '../../src/qualification.js';
import {validate} from '../../src/contract.js';
import {canonicalJSON} from '../../src/qualified-utils.js';
import {sha256,checkCommitment} from '../heldout-authoring-v1/manifest.mjs';

export const QUESTIONS_FORMAT='opticsim-heldout-exploration-questions-v1';
export const REFERENCE_FORMAT='opticsim-heldout-exploration-reference-v1';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hasOnly=(x,keys)=>isObject(x)&&Object.keys(x).every(k=>keys.includes(k));
const idPattern=/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/;
const validText=(s,max=5000)=>typeof s==='string'&&s.trim().length>=5&&s.length<=max;
const names=new Set(['supported','missing','ambiguous','unsupported','invalid']);
const dispositions=new Set(['needs-information','unavailable','invalid-input']);

export async function validateExplorationQuestions(input){
 if(!hasOnly(input,['format','cases'])||input.format!==QUESTIONS_FORMAT||
   !Array.isArray(input.cases)||input.cases.length<1||input.cases.length>12)
   throw Error('Expected 1–12 strictly private revision questions');
 const used=new Set();
 for(const c of input.cases){
   if(!hasOnly(c,['id','task','baseline'])||!idPattern.test(c.id||'')||
      used.has(c.id)||!validText(c.task,12000))
     throw Error('Invalid/duplicate question identity or task; reference data is not accepted');
   used.add(c.id);
   // Snapshot before each asynchronous SHA operation. The trusted package
   // verifier checks BOTH canonical scene and accompanying qualification hash.
   const baseline=await verifyQualifiedBundle(structuredClone(c.baseline));
   if(!baseline.qualification.interpretation?.source?.sha256)
     throw Error(c.id+': reference to a declared source hash is required for the baseline');
   if(!Array.isArray(baseline.scene.physics.components)||!baseline.scene.physics.components.length)
     throw Error(c.id+': baseline must represent an actual physical system');
 }
 return input;
}

export function validateExplorationReference(ref,questions){
 if(!hasOnly(ref,['format','reviewers','cases'])||ref.format!==REFERENCE_FORMAT)
   throw Error('Invalid independent exploration reference format');
 if(!Array.isArray(ref.reviewers)||ref.reviewers.length<2||
    ref.reviewers.some(x=>typeof x!=='string'||x.trim().length<2||x.length>100)||
    new Set(ref.reviewers).size!==ref.reviewers.length)
   throw Error('At least two distinct declared expert reviewers are required (not verified independence)');
 if(!Array.isArray(ref.cases)||ref.cases.length!==questions.cases.length)
   throw Error('Reference case count must equal committed question count');
 for(const [i,row] of ref.cases.entries()){
   const q=questions.cases[i];
   if(!hasOnly(row,['id','classification','expectedAction','expectedPhysics','expectedAdditionalTargets',
    'expectedFirstStatus','reviewNote','reasonCode','sourceNamedNewComponentIds'])||
     row.id!==q.id||!names.has(row.classification)||!validText(row.reviewNote))
     throw Error(q.id+': invalid reference adjudication or case order');
   if(row.classification==='supported'){
     if(!['revise','structure','observe'].includes(row.expectedAction)||
       !isObject(row.expectedPhysics)||!Array.isArray(row.expectedAdditionalTargets)||
       row.expectedAdditionalTargets.length>16||
       row.expectedFirstStatus!==undefined||row.reasonCode!==undefined)
       throw Error(q.id+': supported reference requires exact reviewed model and requested targets');
     for(const x of row.expectedAdditionalTargets){
       if(!hasOnly(x,['kind','componentId'])||Object.keys(x).length!==2||
         typeof x.kind!=='string'||!x.kind||x.kind.length>80||
         typeof x.componentId!=='string'||!idPattern.test(x.componentId))
         throw Error(q.id+': malformed reviewed observation target');
     }
     const targetSet=new Set(row.expectedAdditionalTargets.map(x=>JSON.stringify([x.kind,x.componentId])));
     if(targetSet.size!==row.expectedAdditionalTargets.length)
       throw Error(q.id+': duplicate adjudicated target');
     if(row.expectedAction==='observe'&&row.expectedAdditionalTargets.length===0)
       throw Error(q.id+': observation-only case must request a new measurement');
     // The existing canonical validator defines what is physically admitted.
     // No new schema, graph language or post-hoc answer simulator.
     const doc=structuredClone(q.baseline.scene);
     doc.physics=structuredClone(row.expectedPhysics);
     validate(doc);
     if(doc.physics.model!==q.baseline.scene.physics.model||
       doc.physics.lengthUnit!==q.baseline.scene.physics.lengthUnit)
       throw Error(q.id+': reference cannot silently migrate a physical model family or length gauge');
     const oldComponents=q.baseline.scene.physics.components,newComponents=doc.physics.components;
     const priorIds=new Set(oldComponents.map(x=>x.id)),nextIds=new Set(newComponents.map(x=>x.id));
     if(row.expectedAction!=='structure'&&row.sourceNamedNewComponentIds!==undefined)
       throw Error(q.id+': sourceNamedNewComponentIds applies only to explicit structural references');
     if(row.expectedAction==='observe'&&canonicalJSON(doc.physics)!==canonicalJSON(q.baseline.scene.physics))
       throw Error(q.id+': observation-only reference cannot modify physics');
     if(row.expectedAction==='revise'){
       if(oldComponents.length!==newComponents.length||
          oldComponents.some((x,i)=>newComponents[i]?.id!==x.id||newComponents[i]?.type!==x.type)||
          canonicalJSON(doc.physics)===canonicalJSON(q.baseline.scene.physics))
         throw Error(q.id+': targeted parameter reference must change existing physical fields without restructuring the system');
     }
     if(row.expectedAction==='structure'){
       const alteredIds=[...priorIds].filter(id=>!nextIds.has(id)),newIds=[...nextIds].filter(id=>!priorIds.has(id));
       // v1 scores structural equality by stable ID. Unnamed new components
       // have author-assigned IDs and need a separate identity-isomorphism
       // rubric; do not falsely grade them as physical mistakes.
       const named=row.sourceNamedNewComponentIds;
       if(!Array.isArray(named)||named.some(id=>typeof id!=='string'||!idPattern.test(id))||
          new Set(named).size!==named.length||
          canonicalJSON([...named].sort())!==canonicalJSON([...newIds].sort()))
         throw Error(q.id+': structural v1 reference requires all new component IDs explicitly source-named and adjudicated; unnamed new IDs need a separate matching rubric');
       if(!alteredIds.length&&!newIds.length)
         throw Error(q.id+': structural reference must add or remove at least one stable component identity');
       const retainedOld=oldComponents.filter(x=>nextIds.has(x.id));
       const retainedNew=newComponents.filter(x=>priorIds.has(x.id));
       if(canonicalJSON(retainedOld)!==canonicalJSON(retainedNew))
         throw Error(q.id+': structural reference must preserve every surviving component and their original order');
     }
     const expectedIds=new Set(doc.physics.components.map(x=>x.id));
     if(row.expectedAdditionalTargets.some(x=>!expectedIds.has(x.componentId)))
       throw Error(q.id+': reviewed target not present in expected apparatus');
   }else{
     if(row.expectedAction!==undefined||row.expectedPhysics!==undefined||
       row.expectedAdditionalTargets!==undefined||!dispositions.has(row.expectedFirstStatus)||
       row.reasonCode!==undefined&&(typeof row.reasonCode!=='string'||row.reasonCode.length>100))
       throw Error(q.id+': negative reference cannot claim an authored supported model');
   }
 }
 return ref;
}

export async function makeExplorationCommitment(questions,reference,questionsBytes,referenceBytes){
 await validateExplorationQuestions(questions);
 validateExplorationReference(reference,questions);
 if(!Buffer.isBuffer(questionsBytes)||!Buffer.isBuffer(referenceBytes))
   throw Error('Private commitment requires exact byte buffers');
 return {format:'opticsim-heldout-commitment-v1',
   questionsSha256:sha256(questionsBytes),referenceSha256:sha256(referenceBytes),
   ids:questions.cases.map(x=>x.id),numberOfCases:questions.cases.length,
   note:'Exploration protocol: SHA-256 proves bytes only; independent expert adjudication and chronological freeze must be externally verified.'};
}
export const verifyExplorationCommitment=(commitment,questionBytes,referenceBytes=null)=>
 checkCommitment(commitment,questionBytes,referenceBytes);
