// Qualified structure preparation: no native execution or inferred geometry.
// Plain reviseComponents has no historical context; this boundary preserves it.
import {reviseComponents,AuthoringError,COMPONENT_REVISION_FORMAT} from './authoring.js';
import {verifyQualifiedBundle,recordQualifiedEdit} from './qualification.js';
import {FINITE_COMPOSITION_MODEL,FINITE_COMPOSITION_VERSION,FINITE_COMPOSITION_EXTENDED_VERSION} from './finite-dielectric-composition.js';
// Qualified upgrade metadata belongs here, not to the same-version raw editor.
export function qualifiedStructureCapabilities(){
 return {format:COMPONENT_REVISION_FORMAT,method:'prepareQualifiedStructure',
  sameVersion:'Existing atomic add/remove operations; expectedSha256 is required.',
  upgrade:{field:'upgradeToSchemaVersion',model:FINITE_COMPOSITION_MODEL,
   fromSchemaVersion:FINITE_COMPOSITION_VERSION,toSchemaVersion:FINITE_COMPOSITION_EXTENDED_VERSION,
   requiredHashes:['expectedSha256','expectedIntegritySha256'],
   condition:'Explicit v10 to v11 extension producing two mirrors; all geometry and retired-ID checks still apply. No automatic migration or inherited execution.'}};
}
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
 const upgrading=Object.hasOwn(patch,'upgradeToSchemaVersion');
 const {expectedSha256,expectedIntegritySha256,upgradeToSchemaVersion,...changes}=patch;
 // A contract extension is bound to the complete source/history/readout package,
 // not merely the same physical scene. Ordinary revisions retain their contract.
 if((upgrading||Object.hasOwn(patch,'expectedIntegritySha256'))&&expectedIntegritySha256!==parent.integritySha256)
  throw new AuthoringError([{path:'$.expectedIntegritySha256',code:'STALE_QUALIFICATION',
   message:'expectedIntegritySha256 must match the complete qualified package for a contract upgrade'}]);
 let base=parent.scene;
 if(upgrading){
  if(parent.scene.physics.model!==FINITE_COMPOSITION_MODEL||parent.scene.schemaVersion!==FINITE_COMPOSITION_VERSION||
     upgradeToSchemaVersion!==FINITE_COMPOSITION_EXTENDED_VERSION)
   throw new AuthoringError([{path:'$.upgradeToSchemaVersion',code:'UNSUPPORTED_CONTRACT_UPGRADE',
    message:'Only an explicitly requested finite-composition v10 to v11 extension is supported'}]);
  base=structuredClone(parent.scene);
  base.schemaVersion=base.adapterVersion=FINITE_COMPOSITION_EXTENDED_VERSION;
 }
 // reviseComponents validates the upgraded base and the entire proposed final
 // apparatus. It cannot change existing physical fields, camera or numerics.
 const result=reviseComponents(base,changes);
 if(upgrading&&result.document.physics.components.filter(c=>c.type==='plane-mirror').length!==2)
  throw new AuthoringError([{path:'$.operations',code:'UPGRADE_REQUIRES_SECOND_MIRROR',
   message:'The explicit v10 to v11 upgrade must add a second mirror; a version-only change is not a physical investigation'}]);
 const ever=recordedIds(parent),present=new Set(parent.scene.physics.components.map(c=>c.id));
 for(const id of result.addedIds)if(ever.has(id)&&!present.has(id))
  throw new AuthoringError([{path:'$.operations',code:'RETIRED_COMPONENT_ID',
   message:'Component '+id+' occurred in this recorded lineage; use a new ID or branch from its earlier qualified scene. Old requests must not bind to a replacement.'}]);
 return {document:result.document,qualification:recordQualifiedEdit(parent.scene,result.document,parent.qualification),
  observables:structuredClone(parent.observables),parentIntegritySha256:parent.integritySha256,
  addedIds:result.addedIds,removedIds:result.removedIds,
  ...(upgrading?{contractUpgrade:{fromSchemaVersion:FINITE_COMPOSITION_VERSION,
   toSchemaVersion:FINITE_COMPOSITION_EXTENDED_VERSION,model:FINITE_COMPOSITION_MODEL}}:{})};
}
