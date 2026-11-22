// Composable exploration engine for opticsim-coaxial-paraxial-stack-facts-v1:
// canonical baseline hashing, tamper-evident lineage packages, SHA-guarded
// targeted parameter revisions, SHA-guarded atomic structural revisions
// (add/remove elements and optional object with retired-ID guards), bounded
// 1-25 value parameter sweeps from one unchanged baseline, and guarded
// baseline-vs-variant comparison.
//
// Conditional first-order paraxial analysis only: no native PhyDemo scene,
// ray trace, finite aperture, Fresnel reflection, or detected image is created.
import {
  COAXIAL_STACK_FACTS,
  COAXIAL_STACK_QUERY,
  analyzeCoaxialStack,
  coaxialStackCapabilities,
  validateCoaxialStackFacts
} from './coaxial-paraxial-stack.js';
import {fromBinary64,subtract,toBinary64} from './binary64-rational.js';
import {boundedText,canonicalJSON,isRecord,sha256Text} from './qualified-utils.js';

export const COAXIAL_STACK_PACKAGE='opticsim-coaxial-stack-package-v1';
export const COAXIAL_STACK_PARAM_REVISION='opticsim-coaxial-stack-revision-v1';
export const COAXIAL_STACK_STRUCTURE_REVISION='opticsim-coaxial-stack-structure-v1';
export const COAXIAL_STACK_SWEEP='opticsim-coaxial-stack-sweep-v1';
export const COAXIAL_STACK_SWEEP_REPORT='opticsim-coaxial-stack-sweep-report-v1';
export const COAXIAL_STACK_COMPARISON='opticsim-coaxial-stack-comparison-v1';

export const COAXIAL_STACK_SWEEP_LIMITS=Object.freeze({minSamples:1,maxSamples:25});
export const COAXIAL_STACK_EXPLORATION_LIMITS=Object.freeze({
  maxEdits:64,
  maxChangesPerRevision:16,
  maxOperationsPerStructure:8,
  maxTextLength:1200,
  maxAssumptions:16
});

const ELEMENT_FIELDS=Object.freeze({
  'thin-lens':Object.freeze(['x','focalLength']),
  'refracting-surface':Object.freeze(['x','signedRadius','downstreamIndex']),
  'terminal-mirror':Object.freeze(['x','signedRadius'])
});

const PLOT_FIELDS_BY_KIND=Object.freeze({
  'coaxial-stack-conjugate':Object.freeze(['imageDistance','imageX','magnification','imageY']),
  'coaxial-stack-collimated-focus':Object.freeze([
    'equivalentPower','effectiveFocalLength','backFocalDistance','backFocusX',
    'rearPrincipalOffset','rearPrincipalX','beamHeightScale','angularScale'
  ]),
  'coaxial-stack-transfer':Object.freeze([
    'equivalentPower','effectiveFocalLength','transverseMagnification',
    'transverseMagnificationMagnitude','longitudinalMagnification','axialShift'
  ])
});

const METRIC_SPECS_BY_KIND=Object.freeze({
  'coaxial-stack-conjugate':Object.freeze([
    {field:'imageX',scope:'global',unitKind:'length'},
    {field:'imageDistance',scope:'exit-relative',unitKind:'length'},
    {field:'magnification',scope:'global',unitKind:'dimensionless'},
    {field:'imageY',scope:'global',unitKind:'length',optional:true}
  ]),
  'coaxial-stack-collimated-focus':Object.freeze([
    {field:'equivalentPower',scope:'global',unitKind:'inverse-length'},
    {field:'effectiveFocalLength',scope:'global',unitKind:'length'},
    {field:'backFocusX',scope:'global',unitKind:'length'},
    {field:'backFocalDistance',scope:'exit-relative',unitKind:'length'},
    {field:'rearPrincipalX',scope:'global',unitKind:'length'},
    {field:'rearPrincipalOffset',scope:'exit-relative',unitKind:'length'},
    {field:'beamHeightScale',scope:'global',unitKind:'dimensionless'},
    {field:'angularScale',scope:'global',unitKind:'dimensionless'}
  ]),
  'coaxial-stack-transfer':Object.freeze([
    {field:'equivalentPower',scope:'global',unitKind:'inverse-length'},
    {field:'effectiveFocalLength',scope:'global',unitKind:'length'},
    {field:'transverseMagnification',scope:'global',unitKind:'dimensionless'},
    {field:'transverseMagnificationMagnitude',scope:'global',unitKind:'dimensionless'},
    {field:'longitudinalMagnification',scope:'global',unitKind:'dimensionless'},
    {field:'axialShift',scope:'global',unitKind:'length'}
  ])
});

const PROVENANCE_STATUS='author-declared-not-verified';
const INTERPRETATION_NOTE='Package hashes detect tampering or drift, not source fidelity or textbook truth.';
const SHA256_RE=/^[0-9a-f]{64}$/;
const STABLE_ID_RE=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const QUERY_KINDS=Object.freeze(coaxialStackCapabilities().kinds);

const own=(o,k)=>Object.hasOwn(o,k);
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const isPlainObject=v=>isRecord(v)&&Object.getPrototypeOf(v)===Object.prototype;
const isSha256=v=>typeof v==='string'&&SHA256_RE.test(v);
const isStableId=v=>typeof v==='string'&&STABLE_ID_RE.test(v);
const sameJson=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const normalizeZero=v=>Object.is(v,-0)?0:v;

function checkFields(value,required,optional,label,code='INVALID_EXPLORATION_INPUT'){
  if(!isPlainObject(value))fail(code,label+' must be a plain object.');
  const allowed=[...required,...optional];
  const extra=Object.keys(value).filter(k=>!allowed.includes(k));
  if(extra.length)fail(code,label+' has unsupported fields: '+extra.join(', '));
  const missing=required.filter(k=>!own(value,k));
  if(missing.length)fail(code,label+' requires '+missing.join(', ')+'.');
}

function validateOptionalText(value,label,code='INVALID_EXPLORATION_INPUT'){
  if(value===undefined||value===null)return null;
  try{
    return boundedText(value,label,COAXIAL_STACK_EXPLORATION_LIMITS.maxTextLength);
  }catch(err){
    fail(code,err.message);
  }
}

function validateMetadata(raw){
  if(raw===undefined)return {};
  checkFields(raw,[],['sourceNote','assumptions'],'Package metadata','INVALID_PACKAGE');
  const out={};
  if(own(raw,'sourceNote')){
    out.sourceNote=validateOptionalText(raw.sourceNote,'sourceNote','INVALID_PACKAGE');
    if(out.sourceNote===null)fail('INVALID_PACKAGE','sourceNote must be nonempty bounded text when present.');
  }
  if(own(raw,'assumptions')){
    if(!Array.isArray(raw.assumptions)||raw.assumptions.length>COAXIAL_STACK_EXPLORATION_LIMITS.maxAssumptions)
      fail('INVALID_PACKAGE','assumptions must be an array of at most '+COAXIAL_STACK_EXPLORATION_LIMITS.maxAssumptions+' bounded strings.');
    out.assumptions=raw.assumptions.map((item,i)=>{
      const text=validateOptionalText(item,'assumptions['+i+']','INVALID_PACKAGE');
      if(text===null)fail('INVALID_PACKAGE','assumptions['+i+'] must be nonempty bounded text.');
      return text;
    });
  }
  return out;
}

function validateQuerySpec(query){
  checkFields(query,['format','kind'],[],'Coaxial stack query','UNSUPPORTED_QUERY');
  if(query.format!==COAXIAL_STACK_QUERY||!QUERY_KINDS.includes(query.kind))
    fail('UNSUPPORTED_QUERY','Unknown coaxial paraxial stack query.');
}

async function computePackageIntegrity(core){
  return sha256Text(canonicalJSON({
    format:core.format,
    provenanceStatus:core.provenanceStatus,
    interpretationNote:core.interpretationNote,
    nativeObservation:core.nativeObservation,
    nativeImageDetected:core.nativeImageDetected,
    baselineFacts:core.baselineFacts,
    baselineSha256:core.baselineSha256,
    currentFacts:core.currentFacts,
    currentSha256:core.currentSha256,
    retiredIds:core.retiredIds,
    edits:core.edits,
    metadata:core.metadata
  }));
}

function computeAmbientIndexShifts(beforeMeta,afterMeta,afterFacts){
  const byId=new Map(afterFacts.elements.map(e=>[e.id,e]));
  const shifts=[];
  for(const id of afterMeta.elementIds){
    if(!own(beforeMeta.ambientIndicesById,id))continue;
    const beforeIndex=beforeMeta.ambientIndicesById[id];
    const afterIndex=afterMeta.ambientIndicesById[id];
    if(beforeIndex!==afterIndex){
      const el=byId.get(id);
      shifts.push({
        id,
        type:el.type,
        beforeAmbientIndex:beforeIndex,
        afterAmbientIndex:afterIndex,
        note:el.type==='thin-lens'
          ?'Local ambient refractive index changed; thin-lens focalLength remains interpreted in its local ambient medium.'
          :'Incident refractive index at this element changed.'
      });
    }
  }
  return shifts;
}

export function coaxialStackExplorationCapabilities(){
  return {
    formats:{
      facts:COAXIAL_STACK_FACTS,
      query:COAXIAL_STACK_QUERY,
      package:COAXIAL_STACK_PACKAGE,
      parameterRevision:COAXIAL_STACK_PARAM_REVISION,
      structureRevision:COAXIAL_STACK_STRUCTURE_REVISION,
      sweep:COAXIAL_STACK_SWEEP,
      sweepReport:COAXIAL_STACK_SWEEP_REPORT,
      comparison:COAXIAL_STACK_COMPARISON
    },
    limits:{
      sweep:{...COAXIAL_STACK_SWEEP_LIMITS},
      exploration:{...COAXIAL_STACK_EXPLORATION_LIMITS}
    },
    editableTargets:{
      stack:['incidentIndex'],
      object:['x','y'],
      element:{
        'thin-lens':[...ELEMENT_FIELDS['thin-lens']],
        'refracting-surface':[...ELEMENT_FIELDS['refracting-surface']],
        'terminal-mirror':[...ELEMENT_FIELDS['terminal-mirror']]
      }
    },
    structuralOperations:[
      'add-element (optional position: "end" | "start" | {beforeId} | {afterId})',
      'remove-element ({id})',
      'add-object ({object})',
      'remove-object ({})'
    ],
    plotFieldsByQuery:structuredClone(PLOT_FIELDS_BY_KIND),
    guards:[
      'Baseline facts are validated by the canonical coaxial-paraxial-stack parser before hashing.',
      'Parameter revisions require expectedSha256 (plus expectedIntegritySha256 for packages), reject no-op or duplicate-target patches, and reject silent element reordering or unit/type/ID edits.',
      'Structural revisions enforce atomic add/remove with retired-ID guards across single batches and package lineage; no disguised component replacement.',
      'Parameter sweeps revalidate every sample independently from the unchanged baseline and retain invalid-input, at-infinity, afocal, and numerically-indeterminate samples explicitly.',
      'Baseline-vs-variant comparisons require identical lengthUnit and flag exit-reference-plane shifts (element ID, type, axial x, or exit direction) so exit-relative distances are never delta-compared across moved reference planes.'
    ],
    nativeObservation:false,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine'
  };
}

export async function coaxialStackHash(facts){
  facts=structuredClone(facts);
  validateCoaxialStackFacts(facts);
  return sha256Text(canonicalJSON(facts));
}

export async function createCoaxialStackPackage(facts,metadata={}){
  [facts,metadata]=structuredClone([facts,metadata]);
  validateCoaxialStackFacts(facts);
  const cleanMetadata=validateMetadata(metadata);
  const baselineSha256=await sha256Text(canonicalJSON(facts));
  const core={
    format:COAXIAL_STACK_PACKAGE,
    provenanceStatus:PROVENANCE_STATUS,
    interpretationNote:INTERPRETATION_NOTE,
    nativeObservation:false,
    nativeImageDetected:false,
    baselineFacts:structuredClone(facts),
    baselineSha256,
    currentFacts:structuredClone(facts),
    currentSha256:baselineSha256,
    retiredIds:[],
    edits:[],
    metadata:cleanMetadata
  };
  const integritySha256=await computePackageIntegrity(core);
  return {...core,integritySha256};
}

export async function verifyCoaxialStackPackage(pkg){
  pkg=structuredClone(pkg);
  checkFields(pkg,[
    'format','provenanceStatus','interpretationNote','nativeObservation','nativeImageDetected',
    'baselineFacts','baselineSha256','currentFacts','currentSha256','retiredIds','edits',
    'metadata','integritySha256'
  ],[],'Coaxial stack package','INVALID_PACKAGE');

  if(pkg.format!==COAXIAL_STACK_PACKAGE)
    fail('UNSUPPORTED_PACKAGE','Expected '+COAXIAL_STACK_PACKAGE+'.');
  if(pkg.provenanceStatus!==PROVENANCE_STATUS||pkg.interpretationNote!==INTERPRETATION_NOTE)
    fail('INVALID_PACKAGE','Package provenance declaration has been altered.');
  if(pkg.nativeObservation!==false||pkg.nativeImageDetected!==false)
    fail('INVALID_PACKAGE','Conditional analytical packages cannot assert native observations or detected images.');
  if(!isSha256(pkg.baselineSha256)||!isSha256(pkg.currentSha256)||!isSha256(pkg.integritySha256))
    fail('INVALID_PACKAGE','Package digests must be 64-character lowercase hex SHA-256 strings.');

  validateMetadata(pkg.metadata);
  const baseMeta=validateCoaxialStackFacts(pkg.baselineFacts);
  const currMeta=validateCoaxialStackFacts(pkg.currentFacts);
  if(pkg.baselineFacts.model!==pkg.currentFacts.model||
     pkg.baselineFacts.signConvention!==pkg.currentFacts.signConvention||
     pkg.baselineFacts.lengthUnit!==pkg.currentFacts.lengthUnit)
    fail('CORRUPT_PACKAGE','Package baselineFacts and currentFacts must share model, signConvention, and lengthUnit.');
  const baseTypesById=new Map(pkg.baselineFacts.elements.map(e=>[e.id,e.type]));
  for(const el of pkg.currentFacts.elements){
    if(baseTypesById.has(el.id)&&baseTypesById.get(el.id)!==el.type)
      fail('CORRUPT_PACKAGE','Package element '+el.id+' changed type without retirement.');
  }

  const expectedBaseSha=await sha256Text(canonicalJSON(pkg.baselineFacts));
  if(pkg.baselineSha256!==expectedBaseSha)
    fail('CORRUPT_PACKAGE','baselineSha256 does not match baselineFacts.');
  const expectedCurrSha=await sha256Text(canonicalJSON(pkg.currentFacts));
  if(pkg.currentSha256!==expectedCurrSha)
    fail('CORRUPT_PACKAGE','currentSha256 does not match currentFacts.');

  if(!Array.isArray(pkg.retiredIds)||!pkg.retiredIds.every(isStableId))
    fail('INVALID_PACKAGE','retiredIds must be an array of stable component IDs.');
  if(!Array.isArray(pkg.edits)||pkg.edits.length>COAXIAL_STACK_EXPLORATION_LIMITS.maxEdits)
    fail('INVALID_PACKAGE','edits must be an array of at most '+COAXIAL_STACK_EXPLORATION_LIMITS.maxEdits+' entries.');

  const activeIds=new Set(baseMeta.elementIds);
  const retired=new Set();
  let expectedParent=pkg.baselineSha256;

  if(pkg.edits.length===0){
    if(pkg.currentSha256!==pkg.baselineSha256||!sameJson(pkg.baselineFacts,pkg.currentFacts))
      fail('CORRUPT_PACKAGE','Package currentFacts differs from baselineFacts without recorded edits.');
    if(pkg.retiredIds.length!==0)
      fail('CORRUPT_PACKAGE','Package has retiredIds without recorded structural edits.');
  }else{
    for(let i=0;i<pkg.edits.length;i++){
      const edit=pkg.edits[i];
      checkFields(edit,['index','kind','parentSha256','resultSha256','intent','addedIds','removedIds','changes'],
        [],'Package edit '+i,'INVALID_PACKAGE');
      if(edit.index!==i+1)fail('CORRUPT_PACKAGE','Edit index sequence is invalid.');
      if(edit.kind!=='parameter-revision'&&edit.kind!=='structural-revision')
        fail('INVALID_PACKAGE','Unsupported edit kind: '+String(edit.kind));
      if(edit.parentSha256!==expectedParent)
        fail('CORRUPT_PACKAGE','Edit hash chain mismatch at edit '+edit.index+'.');
      if(!isSha256(edit.resultSha256)||edit.resultSha256===edit.parentSha256)
        fail('CORRUPT_PACKAGE','Edit resultSha256 is invalid or represents a no-op edit.');
      if(edit.intent!==null)validateOptionalText(edit.intent,'edit.intent','INVALID_PACKAGE');
      if(!Array.isArray(edit.addedIds)||!Array.isArray(edit.removedIds)||!Array.isArray(edit.changes))
        fail('INVALID_PACKAGE','Edit arrays are malformed.');
      if(edit.changes.length<1||edit.changes.length>32)fail('INVALID_PACKAGE','Edit change summary must contain 1 to 32 entries.');
      const addSet=new Set(),remSet=new Set();
      for(const id of edit.removedIds){
        if(!isStableId(id)||remSet.has(id))fail('INVALID_PACKAGE','Invalid or duplicate removedId in edit '+edit.index+'.');
        remSet.add(id);
      }
      for(const id of edit.addedIds){
        if(!isStableId(id)||addSet.has(id)||remSet.has(id))
          fail('CORRUPT_PACKAGE','Invalid, duplicate, or same-edit replaced ID in edit '+edit.index+'.');
        addSet.add(id);
      }
      if(edit.kind==='parameter-revision'&&(addSet.size||remSet.size))
        fail('CORRUPT_PACKAGE','Parameter revision edit cannot record added or removed element IDs.');
      for(const id of remSet){
        if(!activeIds.has(id))fail('CORRUPT_PACKAGE','Edit '+edit.index+' removes inactive element '+id+'.');
        activeIds.delete(id);
        retired.add(id);
      }
      for(const id of addSet){
        if(activeIds.has(id)||retired.has(id))
          fail('CORRUPT_PACKAGE','Edit '+edit.index+' reuses an active or retired element ID: '+id+'.');
        activeIds.add(id);
      }
      expectedParent=edit.resultSha256;
    }
    if(expectedParent!==pkg.currentSha256)
      fail('CORRUPT_PACKAGE','Final edit resultSha256 does not match currentSha256.');
  }

  const currentIdSet=new Set(currMeta.elementIds);
  if(activeIds.size!==currentIdSet.size||[...currentIdSet].some(id=>!activeIds.has(id)))
    fail('CORRUPT_PACKAGE','Recorded lineage active element IDs do not match currentFacts.');
  const expectedRetired=[...retired].sort();
  if(expectedRetired.length!==pkg.retiredIds.length||expectedRetired.some((id,i)=>pkg.retiredIds[i]!==id))
    fail('CORRUPT_PACKAGE','retiredIds does not match the recorded edit lineage.');

  const expectedIntegrity=await computePackageIntegrity(pkg);
  if(pkg.integritySha256!==expectedIntegrity)
    fail('CORRUPT_PACKAGE','Package integritySha256 verification failed.');

  return pkg;
}

async function resolveInput(input){
  if(!isPlainObject(input)||typeof input.format!=='string')
    fail('UNSUPPORTED_INPUT','Supply either '+COAXIAL_STACK_FACTS+' or '+COAXIAL_STACK_PACKAGE+'.');
  if(input.format===COAXIAL_STACK_PACKAGE){
    const pkg=await verifyCoaxialStackPackage(input);
    return {
      isPackage:true,
      pkg,
      facts:structuredClone(pkg.currentFacts),
      sha256:pkg.currentSha256,
      integritySha256:pkg.integritySha256,
      retiredIds:new Set(pkg.retiredIds)
    };
  }
  if(input.format===COAXIAL_STACK_FACTS){
    const facts=structuredClone(input);
    validateCoaxialStackFacts(facts);
    const sha256=await sha256Text(canonicalJSON(facts));
    return {
      isPackage:false,
      pkg:null,
      facts,
      sha256,
      integritySha256:null,
      retiredIds:new Set()
    };
  }
  fail('UNSUPPORTED_INPUT','Unsupported input format: '+input.format);
}

function assertShaGuards(resolved,patch){
  if(!isSha256(patch.expectedSha256)||patch.expectedSha256!==resolved.sha256)
    fail('STALE_REVISION','expectedSha256 does not match the current coaxial stack hash.');
  if(resolved.isPackage){
    if(!own(patch,'expectedIntegritySha256')||patch.expectedIntegritySha256!==resolved.integritySha256)
      fail('STALE_PACKAGE','expectedIntegritySha256 is required and must match the verified package integrity hash.');
  }else if(own(patch,'expectedIntegritySha256')){
    fail('INVALID_REVISION','expectedIntegritySha256 applies only to '+COAXIAL_STACK_PACKAGE+' inputs.');
  }
}

function applySingleParameterChange(facts,change,label){
  if(!isPlainObject(change))fail('INVALID_REVISION',label+' must be a plain object.');
  if(change.target==='stack'){
    checkFields(change,['target','field','value'],[],label,'INVALID_REVISION');
    if(change.field!=='incidentIndex')
      fail('UNSUPPORTED_REVISION_TARGET',label+' only supports stack field incidentIndex; format, model, signConvention, and lengthUnit cannot be silently revised.');
    const before=normalizeZero(facts.incidentIndex);
    const after=normalizeZero(change.value);
    facts.incidentIndex=after;
    return {targetKey:'stack.incidentIndex',delta:{target:'stack',field:'incidentIndex',before,after}};
  }
  if(change.target==='object'){
    checkFields(change,['target','field','value'],[],label,'INVALID_REVISION');
    if(!own(facts,'object'))
      fail('UNKNOWN_REVISION_TARGET',label+' targets object, which is absent; use structural add-object first.');
    if(change.field!=='x'&&change.field!=='y')
      fail('UNSUPPORTED_REVISION_TARGET',label+' only supports object fields x or y.');
    const before=own(facts.object,change.field)?normalizeZero(facts.object[change.field]):null;
    const after=normalizeZero(change.value);
    facts.object[change.field]=after;
    return {targetKey:'object.'+change.field,delta:{target:'object',field:change.field,before,after}};
  }
  if(change.target==='element'){
    checkFields(change,['target','id','field','value'],[],label,'INVALID_REVISION');
    if(!isStableId(change.id))fail('INVALID_REVISION',label+' requires a valid element id.');
    const el=facts.elements.find(e=>e.id===change.id);
    if(!el)fail('UNKNOWN_REVISION_TARGET',label+' references unknown element id: '+change.id+'.');
    const allowed=ELEMENT_FIELDS[el.type];
    if(!allowed||!allowed.includes(change.field))
      fail('UNSUPPORTED_REVISION_TARGET',label+' field '+String(change.field)+' is not editable on '+el.type+'.');
    const before=normalizeZero(el[change.field]);
    const after=normalizeZero(change.value);
    el[change.field]=after;
    return {targetKey:'element.'+change.id+'.'+change.field,delta:{target:'element',id:change.id,field:change.field,before,after}};
  }
  fail('UNSUPPORTED_REVISION_TARGET',label+' target must be stack, object, or element.');
}

async function appendPackageEdit(resolved,nextFacts,nextSha256,editRecord){
  const pkg=structuredClone(resolved.pkg);
  if(pkg.edits.length>=COAXIAL_STACK_EXPLORATION_LIMITS.maxEdits)
    fail('EDIT_HISTORY_LIMIT','Package edit history reached the maximum bound of '+COAXIAL_STACK_EXPLORATION_LIMITS.maxEdits+' edits.');
  const retired=new Set(pkg.retiredIds);
  for(const id of editRecord.removedIds)retired.add(id);
  pkg.currentFacts=structuredClone(nextFacts);
  pkg.currentSha256=nextSha256;
  pkg.retiredIds=[...retired].sort();
  pkg.edits.push({index:pkg.edits.length+1,...editRecord});
  pkg.integritySha256=await computePackageIntegrity(pkg);
  return pkg;
}

export async function reviseCoaxialStack(input,patch){
  [input,patch]=structuredClone([input,patch]);
  const resolved=await resolveInput(input);
  checkFields(patch,['format','expectedSha256','changes'],['expectedIntegritySha256','intent'],
    'Coaxial stack parameter revision','INVALID_REVISION');
  if(patch.format!==COAXIAL_STACK_PARAM_REVISION)
    fail('UNSUPPORTED_REVISION','Expected '+COAXIAL_STACK_PARAM_REVISION+'.');
  assertShaGuards(resolved,patch);
  const intent=own(patch,'intent')?validateOptionalText(patch.intent,'intent','INVALID_REVISION'):null;
  if(own(patch,'intent')&&intent===null)fail('INVALID_REVISION','intent must be nonempty bounded text when present.');

  if(!Array.isArray(patch.changes)||!patch.changes.length)
    fail('EMPTY_REVISION','Parameter revision requires at least one change.');
  if(patch.changes.length>COAXIAL_STACK_EXPLORATION_LIMITS.maxChangesPerRevision)
    fail('REVISION_LIMIT','Parameter revision supports at most '+COAXIAL_STACK_EXPLORATION_LIMITS.maxChangesPerRevision+' changes.');

  const beforeMeta=validateCoaxialStackFacts(resolved.facts);
  const nextFacts=structuredClone(resolved.facts);
  const seenTargets=new Set();
  const applied=[];
  for(let i=0;i<patch.changes.length;i++){
    const {targetKey,delta}=applySingleParameterChange(nextFacts,patch.changes[i],'changes['+i+']');
    if(seenTargets.has(targetKey))
      fail('DUPLICATE_REVISION_TARGET','Duplicate parameter revision target: '+targetKey+'.');
    seenTargets.add(targetKey);
    if(delta.before!==delta.after)applied.push(delta);
  }

  const afterMeta=validateCoaxialStackFacts(nextFacts);
  const nextSha256=await sha256Text(canonicalJSON(nextFacts));
  if(applied.length===0||nextSha256===resolved.sha256)
    fail('NO_EFFECTIVE_CHANGE','Parameter revision produced no effective change from the current stack.');

  const ambientIndexShifts=computeAmbientIndexShifts(beforeMeta,afterMeta,nextFacts);
  const nextPkg=resolved.isPackage
    ?await appendPackageEdit(resolved,nextFacts,nextSha256,{
      kind:'parameter-revision',
      parentSha256:resolved.sha256,
      resultSha256:nextSha256,
      intent,
      addedIds:[],
      removedIds:[],
      changes:applied
    })
    :null;

  return {
    format:'opticsim-coaxial-stack-revision-result-v1',
    parentSha256:resolved.sha256,
    sha256:nextSha256,
    changed:true,
    changes:applied,
    ambientIndexShifts,
    facts:nextFacts,
    ...(nextPkg?{package:nextPkg}:{}),
    native:{status:'not-run',observations:null},
    nativeObservation:false,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine'
  };
}

function resolveInsertionIndex(elements,position,label){
  if(position===undefined||position==='end')return elements.length;
  if(position==='start')return 0;
  if(isPlainObject(position)){
    const keys=Object.keys(position);
    if(keys.length===1&&keys[0]==='beforeId'&&isStableId(position.beforeId)){
      const idx=elements.findIndex(e=>e.id===position.beforeId);
      if(idx<0)fail('UNKNOWN_ANCHOR_ELEMENT',label+' beforeId '+position.beforeId+' was not found in the current stack.');
      return idx;
    }
    if(keys.length===1&&keys[0]==='afterId'&&isStableId(position.afterId)){
      const idx=elements.findIndex(e=>e.id===position.afterId);
      if(idx<0)fail('UNKNOWN_ANCHOR_ELEMENT',label+' afterId '+position.afterId+' was not found in the current stack.');
      return idx+1;
    }
  }
  fail('INVALID_STRUCTURE_REVISION',label+' position must be "start", "end", {beforeId}, or {afterId}.');
}

export async function reviseCoaxialStackStructure(input,patch){
  [input,patch]=structuredClone([input,patch]);
  const resolved=await resolveInput(input);
  checkFields(patch,['format','expectedSha256','operations'],['expectedIntegritySha256','intent'],
    'Coaxial stack structural revision','INVALID_STRUCTURE_REVISION');
  if(patch.format!==COAXIAL_STACK_STRUCTURE_REVISION)
    fail('UNSUPPORTED_REVISION','Expected '+COAXIAL_STACK_STRUCTURE_REVISION+'.');
  assertShaGuards(resolved,patch);
  const intent=own(patch,'intent')?validateOptionalText(patch.intent,'intent','INVALID_STRUCTURE_REVISION'):null;
  if(own(patch,'intent')&&intent===null)fail('INVALID_STRUCTURE_REVISION','intent must be nonempty bounded text when present.');

  if(!Array.isArray(patch.operations)||!patch.operations.length)
    fail('EMPTY_REVISION','Structural revision requires at least one operation.');
  if(patch.operations.length>COAXIAL_STACK_EXPLORATION_LIMITS.maxOperationsPerStructure)
    fail('REVISION_LIMIT','Structural revision supports at most '+COAXIAL_STACK_EXPLORATION_LIMITS.maxOperationsPerStructure+' operations.');

  const beforeMeta=validateCoaxialStackFacts(resolved.facts);
  const nextFacts=structuredClone(resolved.facts);
  const addedIds=[];
  const removedIds=[];
  const addedSet=new Set();
  const removedSet=new Set();
  let objectOp=null;
  const changeSummaries=[];

  for(let i=0;i<patch.operations.length;i++){
    const op=patch.operations[i];
    const label='operations['+i+']';
    if(!isPlainObject(op)||typeof op.op!=='string')
      fail('INVALID_STRUCTURE_REVISION',label+' must be an object with an op field.');

    if(op.op==='add-element'){
      checkFields(op,['op','element'],['position'],label,'INVALID_STRUCTURE_REVISION');
      if(!isPlainObject(op.element)||!isStableId(op.element.id))
        fail('INVALID_STRUCTURE_REVISION',label+'.element must be a plain object with a valid stable id.');
      const id=op.element.id;
      if(resolved.retiredIds.has(id)||removedSet.has(id))
        fail('RETIRED_ELEMENT_ID','Element ID '+id+' was previously removed and cannot be reused; use a new stable ID.');
      if(addedSet.has(id)||nextFacts.elements.some(e=>e.id===id))
        fail('DUPLICATE_ELEMENT_ID','Element ID '+id+' already exists in the stack.');
      const idx=resolveInsertionIndex(nextFacts.elements,op.position,label);
      const cleanEl=structuredClone(op.element);
      for(const k of Object.keys(cleanEl))if(typeof cleanEl[k]==='number')cleanEl[k]=normalizeZero(cleanEl[k]);
      nextFacts.elements.splice(idx,0,cleanEl);
      addedSet.add(id);
      addedIds.push(id);
      changeSummaries.push({op:'add-element',id,type:typeof cleanEl.type==='string'?cleanEl.type:null,insertIndex:idx});
    }else if(op.op==='remove-element'){
      checkFields(op,['op','id'],[],label,'INVALID_STRUCTURE_REVISION');
      if(!isStableId(op.id))fail('INVALID_STRUCTURE_REVISION',label+'.id must be a valid stable id.');
      if(addedSet.has(op.id))
        fail('CONFLICTING_STRUCTURE_OPERATION',label+' cannot remove element '+op.id+' added in the same batch.');
      if(removedSet.has(op.id))
        fail('DUPLICATE_STRUCTURE_OPERATION',label+' removes element '+op.id+' more than once.');
      const idx=nextFacts.elements.findIndex(e=>e.id===op.id);
      if(idx<0)fail('UNKNOWN_ELEMENT_ID',label+' cannot remove unknown element '+op.id+'.');
      const [removed]=nextFacts.elements.splice(idx,1);
      removedSet.add(op.id);
      removedIds.push(op.id);
      changeSummaries.push({op:'remove-element',id:op.id,type:removed.type});
    }else if(op.op==='add-object'){
      checkFields(op,['op','object'],[],label,'INVALID_STRUCTURE_REVISION');
      if(objectOp!==null)
        fail('CONFLICTING_STRUCTURE_OPERATION','Cannot combine multiple object structure operations in one batch.');
      if(own(nextFacts,'object'))
        fail('OBJECT_ALREADY_PRESENT','object already exists; use reviseCoaxialStack to edit object.x or object.y.');
      if(!isPlainObject(op.object))fail('INVALID_STRUCTURE_REVISION',label+'.object must be a plain object.');
      const cleanObj=structuredClone(op.object);
      for(const k of Object.keys(cleanObj))if(typeof cleanObj[k]==='number')cleanObj[k]=normalizeZero(cleanObj[k]);
      nextFacts.object=cleanObj;
      objectOp='added';
      changeSummaries.push({op:'add-object',after:cleanObj});
    }else if(op.op==='remove-object'){
      checkFields(op,['op'],[],label,'INVALID_STRUCTURE_REVISION');
      if(objectOp!==null)
        fail('CONFLICTING_STRUCTURE_OPERATION','Cannot combine multiple object structure operations in one batch.');
      if(!own(nextFacts,'object'))
        fail('OBJECT_ABSENT','object is not present on the current stack.');
      const prev=structuredClone(nextFacts.object);
      delete nextFacts.object;
      objectOp='removed';
      changeSummaries.push({op:'remove-object',before:prev});
    }else{
      fail('UNSUPPORTED_STRUCTURE_OPERATION','Unsupported structural operation: '+op.op);
    }
  }

  const afterMeta=validateCoaxialStackFacts(nextFacts);
  const nextSha256=await sha256Text(canonicalJSON(nextFacts));
  const ambientIndexShifts=computeAmbientIndexShifts(beforeMeta,afterMeta,nextFacts);
  const nextPkg=resolved.isPackage
    ?await appendPackageEdit(resolved,nextFacts,nextSha256,{
      kind:'structural-revision',
      parentSha256:resolved.sha256,
      resultSha256:nextSha256,
      intent,
      addedIds,
      removedIds,
      changes:changeSummaries
    })
    :null;

  return {
    format:'opticsim-coaxial-stack-structure-result-v1',
    parentSha256:resolved.sha256,
    sha256:nextSha256,
    addedIds,
    removedIds,
    objectChange:objectOp,
    changes:changeSummaries,
    ambientIndexShifts,
    facts:nextFacts,
    ...(nextPkg?{package:nextPkg}:{}),
    native:{status:'not-run',observations:null},
    nativeObservation:false,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine'
  };
}

function validateSweepSpec(spec,resolved){
  checkFields(spec,['format','expectedSha256','parameter','values','query'],
    ['expectedIntegritySha256','plot'],'Coaxial stack sweep','INVALID_SWEEP');
  if(spec.format!==COAXIAL_STACK_SWEEP)
    fail('UNSUPPORTED_SWEEP','Expected '+COAXIAL_STACK_SWEEP+'.');
  assertShaGuards(resolved,spec);
  validateQuerySpec(spec.query);

  if(spec.query.kind==='coaxial-stack-conjugate'&&!own(resolved.facts,'object'))
    fail('MISSING_FACTS','coaxial-stack-conjugate sweep requires object.x on the baseline stack.');

  const p=spec.parameter;
  if(!isPlainObject(p)||typeof p.target!=='string')
    fail('INVALID_SWEEP','Sweep parameter must be a plain object with target.');

  let allowsInfinity=false;
  let baselineValue;
  if(p.target==='stack'){
    checkFields(p,['target','field'],[],'Sweep parameter','INVALID_SWEEP');
    if(p.field!=='incidentIndex')
      fail('UNKNOWN_SWEEP_TARGET','Stack sweep only supports field incidentIndex.');
    baselineValue=resolved.facts.incidentIndex;
  }else if(p.target==='object'){
    checkFields(p,['target','field'],[],'Sweep parameter','INVALID_SWEEP');
    if(!own(resolved.facts,'object'))
      fail('UNKNOWN_SWEEP_TARGET','Baseline stack has no object; add object before sweeping object fields.');
    if(p.field!=='x'&&p.field!=='y')
      fail('UNKNOWN_SWEEP_TARGET','Object sweep only supports fields x or y.');
    baselineValue=own(resolved.facts.object,p.field)?resolved.facts.object[p.field]:null;
  }else if(p.target==='element'){
    checkFields(p,['target','id','field'],[],'Sweep parameter','INVALID_SWEEP');
    if(!isStableId(p.id))fail('INVALID_SWEEP','Sweep element id must be a valid stable id.');
    const el=resolved.facts.elements.find(e=>e.id===p.id);
    if(!el)fail('UNKNOWN_SWEEP_TARGET','Sweep target element '+p.id+' does not exist in baseline.');
    const allowed=ELEMENT_FIELDS[el.type];
    if(!allowed||!allowed.includes(p.field))
      fail('UNKNOWN_SWEEP_TARGET','Field '+String(p.field)+' is not sweepable on '+el.type+'.');
    allowsInfinity=p.field==='signedRadius';
    baselineValue=el[p.field];
  }else{
    fail('UNKNOWN_SWEEP_TARGET','Sweep target must be stack, object, or element.');
  }

  if(!Array.isArray(spec.values)||spec.values.length<COAXIAL_STACK_SWEEP_LIMITS.minSamples||
     spec.values.length>COAXIAL_STACK_SWEEP_LIMITS.maxSamples)
    fail('INVALID_SWEEP','Supply between '+COAXIAL_STACK_SWEEP_LIMITS.minSamples+' and '+COAXIAL_STACK_SWEEP_LIMITS.maxSamples+' explicit sweep values.');

  const seen=new Set();
  const normalizedValues=[];
  for(let i=0;i<spec.values.length;i++){
    const rawVal=spec.values[i];
    const isFiniteNum=typeof rawVal==='number'&&Number.isFinite(rawVal);
    const isInfStr=allowsInfinity&&rawVal==='infinity';
    if(!isFiniteNum&&!isInfStr)
      fail('INVALID_SWEEP','values['+i+'] must be '+(allowsInfinity?'a finite number or "infinity".':'a finite number.'));
    const val=isFiniteNum?normalizeZero(rawVal):rawVal;
    const key=isInfStr?'str:infinity':'num:'+String(val);
    if(seen.has(key))fail('INVALID_SWEEP','Sweep values must be distinct; duplicate at index '+i+'.');
    seen.add(key);
    normalizedValues.push(val);
  }

  if(own(spec,'plot')){
    checkFields(spec.plot,['field'],[],'Sweep plot','INVALID_SWEEP');
    const allowedPlots=PLOT_FIELDS_BY_KIND[spec.query.kind];
    if(!allowedPlots.includes(spec.plot.field))
      fail('INVALID_SWEEP','Unsupported plot field '+String(spec.plot.field)+' for '+spec.query.kind+'.');
    if(spec.plot.field==='imageY'&&!own(resolved.facts.object||{},'y')&&!(p.target==='object'&&p.field==='y'))
      fail('INVALID_SWEEP','Plotting imageY requires object.y on the baseline or sweeping object.y.');
  }

  return {baselineValue,normalizedValues};
}

export async function runCoaxialStackSweep(input,spec){
  [input,spec]=structuredClone([input,spec]);
  const resolved=await resolveInput(input);
  const {baselineValue,normalizedValues}=validateSweepSpec(spec,resolved);

  const baselineFacts=resolved.facts;
  const baselineSnapshot=canonicalJSON(baselineFacts);
  const baselineResult=analyzeCoaxialStack(baselineFacts,spec.query);
  const samples=[];

  for(let index=0;index<normalizedValues.length;index++){
    const value=normalizedValues[index];
    const candidate=structuredClone(baselineFacts);
    let status='invalid-input';
    let sampleSha256=null;
    let result=null;
    let error=null;
    try{
      applySingleParameterChange(candidate,{...spec.parameter,value},'sweep.sample['+index+']');
      validateCoaxialStackFacts(candidate);
      sampleSha256=await sha256Text(canonicalJSON(candidate));
      result=analyzeCoaxialStack(candidate,spec.query);
      status=result.status;
    }catch(err){
      status='invalid-input';
      error={code:err.code||'INVALID_STACK_FACTS',message:err.message};
    }
    samples.push({
      index,
      value,
      matchesBaselineValue:value===baselineValue,
      status,
      baselineSha256:resolved.sha256,
      sampleSha256,
      result,
      error
    });
  }

  if(canonicalJSON(baselineFacts)!==baselineSnapshot)
    fail('BASELINE_MUTATION','Baseline stack mutated unexpectedly during parameter sweep.');

  const conditionalSamples=samples.filter(s=>s.status==='conditional').length;
  const indeterminateSamples=samples.filter(s=>s.status==='numerically-indeterminate').length;
  const invalidSamples=samples.filter(s=>s.status==='invalid-input').length;
  const status=invalidSamples
    ?'completed-with-invalid-samples'
    :indeterminateSamples
      ?'completed-with-indeterminate-samples'
      :'completed';

  return {
    format:COAXIAL_STACK_SWEEP_REPORT,
    status,
    baselineSha256:resolved.sha256,
    baselineIntegritySha256:resolved.integritySha256,
    lengthUnit:baselineFacts.lengthUnit,
    specification:{...spec,values:normalizedValues},
    limits:COAXIAL_STACK_SWEEP_LIMITS,
    plannedSamples:normalizedValues.length,
    conditionalSamples,
    indeterminateSamples,
    invalidSamples,
    baselineResult,
    samples,
    native:{status:'not-run',observations:null},
    nativeObservation:false,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine'
  };
}

function sampleClassification(sample){
  if(sample.status!=='conditional'||!sample.result?.value)return sample.status;
  const v=sample.result.value;
  if(own(v,'imageKind'))return v.imageKind;
  if(own(v,'state'))return v.state;
  if(own(v,'isAfocal'))return v.isAfocal?'afocal':'non-afocal';
  return 'conditional';
}

export function plotCoaxialStackSweep(report){
  if(!isPlainObject(report)||report.format!==COAXIAL_STACK_SWEEP_REPORT||!Array.isArray(report.samples))
    fail('INVALID_SWEEP_REPORT','Expected '+COAXIAL_STACK_SWEEP_REPORT+' with a samples array.');
  const plot=report.specification?.plot;
  if(!plot)return [];
  return report.samples.map(sample=>{
    const classification=sampleClassification(sample);
    if(sample.status==='invalid-input'){
      return {index:sample.index,x:sample.value,y:null,status:sample.status,classification,
        reason:sample.error?.message||'Inadmissible sample parameter.'};
    }
    if(sample.status==='numerically-indeterminate'){
      return {index:sample.index,x:sample.value,y:null,status:sample.status,classification,
        reason:sample.result?.reason||'Sample is numerically indeterminate.'};
    }
    const raw=sample.result?.value?.[plot.field];
    if(typeof raw==='number'&&Number.isFinite(raw)){
      return {index:sample.index,x:sample.value,y:raw,status:sample.status,classification,reason:null};
    }
    const reason=classification==='at-infinity'
      ?'Image lies at infinity; no finite numeric value.'
      :classification==='afocal'
        ?'Stack is afocal; '+plot.field+' is not finite.'
        :'No finite numeric value for '+plot.field+' in state '+classification+'.';
    return {index:sample.index,x:sample.value,y:null,status:sample.status,classification,reason};
  });
}

function diffStacks(baseFacts,varFacts){
  const stackChanges=[];
  for(const key of ['model','signConvention','lengthUnit','incidentIndex']){
    if(baseFacts[key]!==varFacts[key]){
      stackChanges.push({field:key,before:baseFacts[key],after:varFacts[key]});
    }
  }

  let objectChanges=null;
  const hasBaseObj=own(baseFacts,'object'),hasVarObj=own(varFacts,'object');
  if(!hasBaseObj&&hasVarObj){
    objectChanges={status:'added',after:structuredClone(varFacts.object)};
  }else if(hasBaseObj&&!hasVarObj){
    objectChanges={status:'removed',before:structuredClone(baseFacts.object)};
  }else if(hasBaseObj&&hasVarObj){
    const fields=[];
    for(const key of ['x','y']){
      const b=own(baseFacts.object,key)?baseFacts.object[key]:null;
      const v=own(varFacts.object,key)?varFacts.object[key]:null;
      if(b!==v)fields.push({field:key,before:b,after:v});
    }
    if(fields.length)objectChanges={status:'modified',fields};
  }

  const baseById=new Map(baseFacts.elements.map(e=>[e.id,e]));
  const varById=new Map(varFacts.elements.map(e=>[e.id,e]));
  const addedIds=varFacts.elements.filter(e=>!baseById.has(e.id)).map(e=>e.id);
  const removedIds=baseFacts.elements.filter(e=>!varById.has(e.id)).map(e=>e.id);
  const sharedBaseOrder=baseFacts.elements.filter(e=>varById.has(e.id)).map(e=>e.id);
  const sharedVarOrder=varFacts.elements.filter(e=>baseById.has(e.id)).map(e=>e.id);
  const reorderedSharedIds=sharedBaseOrder.some((id,i)=>sharedVarOrder[i]!==id);

  const elementChanges=[];
  let reusedIdWithChangedType=false;
  for(const id of sharedBaseOrder){
    const b=baseById.get(id),v=varById.get(id);
    if(b.type!==v.type){
      reusedIdWithChangedType=true;
      elementChanges.push({id,typeChanged:true,beforeType:b.type,afterType:v.type,before:structuredClone(b),after:structuredClone(v)});
      continue;
    }
    const fieldDiffs=[];
    for(const field of ELEMENT_FIELDS[b.type]){
      if(b[field]!==v[field])fieldDiffs.push({field,before:b[field],after:v[field]});
    }
    if(fieldDiffs.length)elementChanges.push({id,type:b.type,typeChanged:false,fields:fieldDiffs});
  }

  return {
    stackChanges,
    objectChanges,
    addedIds,
    removedIds,
    reorderedSharedIds,
    reusedIdWithChangedType,
    elementChanges
  };
}

function metricUnit(unitKind,lengthUnit){
  if(unitKind==='dimensionless')return 'dimensionless';
  if(unitKind==='inverse-length')return '1/'+lengthUnit;
  return lengthUnit;
}

function exitElementOf(facts){
  const last=facts.elements.at(-1);
  return last.type==='terminal-mirror'?facts.elements[0]:last;
}

function computeExactDelta(baseVal,varVal){
  const delta=toBinary64(subtract(fromBinary64(varVal),fromBinary64(baseVal)));
  return Number.isFinite(delta)?normalizeZero(delta):null;
}

export async function compareCoaxialStackResults(baselineInput,variantInput,query){
  [baselineInput,variantInput,query]=structuredClone([baselineInput,variantInput,query]);
  validateQuerySpec(query);
  const base=await resolveInput(baselineInput);
  const variant=await resolveInput(variantInput);

  const baselineResult=analyzeCoaxialStack(base.facts,query);
  const variantResult=analyzeCoaxialStack(variant.facts,query);
  const diff=diffStacks(base.facts,variant.facts);

  const sameModel=base.facts.model===variant.facts.model;
  const sameSignConvention=base.facts.signConvention===variant.facts.signConvention;
  const sameLengthUnit=base.facts.lengthUnit===variant.facts.lengthUnit;
  const bothConditional=baselineResult.status==='conditional'&&variantResult.status==='conditional';

  const baseExit=exitElementOf(base.facts);
  const varExit=exitElementOf(variant.facts);
  const baseMode=base.facts.elements.at(-1).type==='terminal-mirror'?'return':'transmission';
  const varMode=variant.facts.elements.at(-1).type==='terminal-mirror'?'return':'transmission';
  const samePropagationMode=baseMode===varMode;
  const sameExitReference=samePropagationMode&&
    baseExit.id===varExit.id&&
    baseExit.type===varExit.type&&
    baseExit.x===varExit.x;

  const sameSourceBaseline=base.isPackage&&variant.isPackage
    ?base.pkg.baselineSha256===variant.pkg.baselineSha256
    :null;

  const warnings=[];
  if(diff.reusedIdWithChangedType)
    warnings.push('One or more element IDs appear with different element types between baseline and variant.');
  if(diff.reorderedSharedIds)
    warnings.push('Shared element IDs appear in a different axial encounter order between baseline and variant.');
  if(!sameLengthUnit)
    warnings.push('Baseline and variant declare different lengthUnit values; numeric deltas are withheld without implicit unit conversion.');
  if(!sameExitReference)
    warnings.push('Exit reference plane or exit direction changed; exit-relative distances are withheld from numeric delta comparison.');
  const baseExitIdx=baselineResult.value?.exitIndex??null;
  const varExitIdx=variantResult.value?.exitIndex??null;
  if(baseExitIdx!==null&&varExitIdx!==null&&baseExitIdx!==varExitIdx)
    warnings.push('Exit medium refractive index changed from '+baseExitIdx+' to '+varExitIdx+'.');

  const statusTransitions={
    status:{baseline:baselineResult.status,variant:variantResult.status,changed:baselineResult.status!==variantResult.status},
    propagationMode:{baseline:baseMode,variant:varMode,changed:baseMode!==varMode},
    exitDirection:{
      baseline:baseMode==='return'?'-x':'+x',
      variant:varMode==='return'?'-x':'+x',
      changed:baseMode!==varMode
    }
  };
  const bv=baselineResult.value,vv=variantResult.value;
  if(query.kind==='coaxial-stack-conjugate'){
    for(const key of ['imageKind','imageOrientation']){
      const b=bv?.[key]??null,v=vv?.[key]??null;
      statusTransitions[key]={baseline:b,variant:v,changed:b!==v};
    }
  }else if(query.kind==='coaxial-stack-collimated-focus'){
    for(const key of ['state','isAfocal']){
      const b=bv?.[key]??null,v=vv?.[key]??null;
      statusTransitions[key]={baseline:b,variant:v,changed:b!==v};
    }
  }else{
    for(const key of [
      'isAfocal','imageOrientation','constantTransverseMagnification',
      'preservesTransverseSize','constantAxialShift','preservesAxialImagePosition'
    ]){
      const b=bv?.[key]??null,v=vv?.[key]??null;
      statusTransitions[key]={baseline:b,variant:v,changed:b!==v};
    }
    const bCount=Array.isArray(bv?.selfConjugateObjects)?bv.selfConjugateObjects.length:null;
    const vCount=Array.isArray(vv?.selfConjugateObjects)?vv.selfConjugateObjects.length:null;
    statusTransitions.selfConjugateCount={baseline:bCount,variant:vCount,changed:bCount!==vCount};
  }

  const metrics=[];
  for(const spec of METRIC_SPECS_BY_KIND[query.kind]){
    const bPresent=bv!==null&&own(bv,spec.field);
    const vPresent=vv!==null&&own(vv,spec.field);
    if(spec.optional&&!bPresent&&!vPresent)continue;

    const bVal=bPresent?bv[spec.field]:null;
    const vVal=vPresent?vv[spec.field]:null;
    const unit=sameLengthUnit?metricUnit(spec.unitKind,base.facts.lengthUnit):null;

    let comparison='not-comparable';
    let delta=null;
    let reason=null;

    if(!sameModel||!sameSignConvention||!sameLengthUnit){
      reason='Baseline and variant differ in model, sign convention, or lengthUnit; no silent unit conversion is applied.';
    }else if(!bothConditional){
      const detail=[
        baselineResult.status!=='conditional'?'baseline is '+baselineResult.status+' ('+baselineResult.reasonCode+')':null,
        variantResult.status!=='conditional'?'variant is '+variantResult.status+' ('+variantResult.reasonCode+')':null
      ].filter(Boolean).join('; ');
      reason='Numeric comparison requires both sides to be conditional ('+detail+').';
    }else if(spec.scope==='exit-relative'&&!sameExitReference){
      reason='Exit reference plane (element ID, type, axial x, or exit direction) changed; compare global coordinates (imageX / backFocusX / rearPrincipalX) instead.';
    }else if(typeof bVal!=='number'||!Number.isFinite(bVal)||typeof vVal!=='number'||!Number.isFinite(vVal)){
      reason='At least one side has no finite numeric value (for example at-infinity, afocal, or omitted object.y).';
    }else{
      const exactDelta=computeExactDelta(bVal,vVal);
      if(exactDelta===null){
        reason='Exact binary64 delta overflowed finite representation.';
      }else{
        comparison='comparable';
        delta=exactDelta;
      }
    }

    metrics.push({
      field:spec.field,
      scope:spec.scope,
      unit,
      comparison,
      baseline:bVal,
      variant:vVal,
      delta,
      ...(reason?{reason}:{})
    });
  }

  const selfConjugateComparison=query.kind==='coaxial-stack-transfer'
    ?{
      baseline:bv?.selfConjugateObjects??null,
      variant:vv?.selfConjugateObjects??null,
      note:'Return self-conjugate root lists are shown side-by-side without fabricating pairings across changing root counts or modes.'
    }
    :null;

  return {
    format:COAXIAL_STACK_COMPARISON,
    query:structuredClone(query),
    method:'conditional-analytical-comparison',
    baseline:{
      sha256:base.sha256,
      integritySha256:base.integritySha256,
      result:baselineResult
    },
    variant:{
      sha256:variant.sha256,
      integritySha256:variant.integritySha256,
      result:variantResult
    },
    diff,
    compatibility:{
      sameModel,
      sameSignConvention,
      sameLengthUnit,
      samePropagationMode,
      sameExitReference,
      bothConditional,
      sameSourceBaseline,
      reusedIdWithChangedType:diff.reusedIdWithChangedType
    },
    warnings,
    statusTransitions,
    metrics,
    ...(selfConjugateComparison?{selfConjugateComparison}:{}),
    native:{status:'not-run',observations:null},
    nativeObservation:false,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    interpretation:'Conditional paraxial comparison only; matching digests and comparable metrics do not certify source interpretation, finite-aperture visibility, or native ray-trace agreement.'
  };
}
