// Qualified structure preparation: no native execution or inferred geometry.
// Plain reviseComponents has no historical context; this boundary preserves it.
import {reviseComponents,AuthoringError} from './authoring.js';
import {verifyQualifiedBundle,recordQualifiedEdit} from './qualification.js';
const stable=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
function recordedIds(bundle){
 const ids=new Set(bundle.scene.physics.components.map(c=>c.id));
 const add=id=>{if(typeof id==='string'&&stable.test(id))ids.add(id);};
 const components=value=>{if(Array.isArray(value))for(const c of value)add(c?.id);};
 for(const edit of bundle.qualification.edits)for(const c of edit.changes){
  for(const value of [c.before,c.after]){
   if(c.path==='$.physics.components')components(value);
   else if(c.path==='$.physics')components(value?.components);
   else if(c.path==='$')components(value?.physics?.components);
   else if(/^\$\.physics\.components\[\d+\]$/.test(c.path))add(value?.id);
   else if(/^\$\.physics\.components\[\d+\]\.id$/.test(c.path))add(value);
  }
 }
 return ids;
}
export async function prepareQualifiedStructure(input,patch){
 // Capture both inputs before hash verification yields.
 input=structuredClone(input);patch=structuredClone(patch);
 const parent=await verifyQualifiedBundle(input);
 if(!patch||patch.expectedSha256!==parent.sceneSha256)
  throw new AuthoringError([{path:'$.expectedSha256',code:'STALE_REVISION',message:'expectedSha256 must match the qualified scene'}]);
 const {expectedSha256,...changes}=patch;
 const result=reviseComponents(parent.scene,changes);
 const ever=recordedIds(parent),present=new Set(parent.scene.physics.components.map(c=>c.id));
 for(const id of result.addedIds)if(ever.has(id)&&!present.has(id))
  throw new AuthoringError([{path:'$.operations',code:'RETIRED_COMPONENT_ID',
   message:'Component '+id+' occurred in this recorded lineage; use a new ID or branch from its earlier qualified scene. Old requests must not bind to a replacement.'}]);
 return {document:result.document,qualification:recordQualifiedEdit(parent.scene,result.document,parent.qualification),
  observables:structuredClone(parent.observables),parentIntegritySha256:parent.integritySha256,
  addedIds:result.addedIds,removedIds:result.removedIds};
}
