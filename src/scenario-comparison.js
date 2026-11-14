// Shared comparison guard. It verifies saved evidence, not source truth.
// No native execution, new physical formula, implicit normalization or repair.
import {verifyQualifiedBundle} from './qualification.js';
import {evaluateObservables} from './observables.js';
import {canonicalJSON} from './qualified-utils.js';
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const accepted=new Set(['available','qualified','conditional']);
const sources=d=>d.physics.components.filter(c=>c.type==='point-source');
async function checked(input){
 try{
  const bundle=await verifyQualifiedBundle(input.bundle);
  if(!same(input.doc,bundle.scene))throw Error('The compared document differs from its verified package');
  const summary=input.execution?.summary;
  if(summary?.canonicalSha256!==bundle.sceneSha256)throw Error('Native evidence is absent or bound to a different scene');
  if(summary.executionPassed!==true||!['completed','completed-with-warnings'].includes(summary.native?.status)||
     summary.native.truncation!==0||summary.native.undefinedBehavior!==0||
     !Array.isArray(summary.native.errors)||summary.native.errors.length||summary.native.error||!['complete','qualified-with-warnings','not-requested'].includes(summary.measurementState))
    throw Error('Native evidence is not complete and accepted');
  // 'not-requested' describes absent detector measurements, not missing source
  // emission evidence. Warnings remain on each result and prohibit numeric deltas.
  const results=await evaluateObservables(bundle.scene,bundle.observables,summary);
  if(!same(results,input.results))throw Error('Stored result values/statuses do not match current qualified evidence');
  return {ok:true,bundle,doc:bundle.scene,summary,results};
 }catch(e){return {ok:false,reason:e.message};}
}
function clearSampling(e){
 if(!e.ok||!Array.isArray(e.summary.native.warnings)||e.summary.native.warnings.length)return false;
 return sources(e.doc).every(s=>{
  const v=e.summary.observations?.emissionsById?.[s.id];
  return v&&Number.isFinite(v.emitted)&&v.emitted>=0&&v.brightnessScale===1;
 });
}
function emissionPolicy(e){return sources(e.doc).map(c=>({id:c.id,brightness:c.parameters.brightness,emission:c.emission})).sort((a,b)=>a.id.localeCompare(b.id));}
function interpretationScope(e){return {origin:e.bundle.qualification.origin,
 assumptions:e.bundle.qualification.assumptions,
 source:e.bundle.qualification.interpretation?.source??null,
 declaredAssumptions:e.bundle.qualification.interpretation?.assumptions??[]};}
export async function compareScenario(baseline,scenario){
 // Snapshot both arguments before verification can yield to a later revision.
 baseline=structuredClone(baseline);scenario=structuredClone(scenario);
 const [a,b]=await Promise.all([checked(baseline),checked(scenario)]);
 const valid=a.ok&&b.ok;
 const samePhysics=valid&&same(a.doc.physics,b.doc.physics);
 const sameNumerics=valid&&same(a.doc.simulation,b.doc.simulation);
 const sameModel=valid&&a.doc.upstreamCommit===b.doc.upstreamCommit&&a.doc.schemaVersion===b.doc.schemaVersion&&a.doc.physics.model===b.doc.physics.model;
 const sameUnit=valid&&a.doc.physics.lengthUnit===b.doc.physics.lengthUnit&&a.doc.physics.coordinates===b.doc.physics.coordinates;
 const sameScope=valid&&same(interpretationScope(a),interpretationScope(b));
 const compatibleEmission=valid&&same(emissionPolicy(a),emissionPolicy(b));
 const unclipped=valid&&clearSampling(a)&&clearSampling(b);
 const rows=b.ok?b.results.results:(scenario.results?.results??[]);
 const entries=rows.map(r=>{
  const orig=a.ok?a.results.results.find(x=>x.id===r.id&&x.kind===r.kind&&x.componentId===r.componentId):null;
  const ca=orig&&a.doc.physics.components.find(c=>c.id===orig.componentId),cb=b.ok&&b.doc.physics.components.find(c=>c.id===r.componentId);
  const conditions={currentCompleteEvidence:!!valid,matchingTarget:!!orig&&!!ca&&!!cb&&ca.type===cb.type,
   sameMethod:!!orig&&typeof r.method==='string'&&orig.method===r.method,
   sameUnit:!!orig&&typeof r.unit==='string'&&orig.unit===r.unit,
   samePhysicalModel:!!sameModel,sameLengthUnit:!!sameUnit,sameNumericalPolicy:!!sameNumerics,
   sameDeclaredAssumptions:!!sameScope,compatibleSourceEmission:!!compatibleEmission,unclippedWarningFreeSamples:!!unclipped};
  let comparison='not-comparable',reason;
  if(!valid)reason='Missing, stale, incomplete or inconsistent execution/result evidence.';
  else if(!conditions.matchingTarget)reason='No exact named request and component target in baseline; no counterpart is invented.';
  else if(!accepted.has(orig.status)||!accepted.has(r.status)||orig.value===null||r.value===null)
   reason='At least one result is unavailable, suppressed, pending or otherwise not accepted.';
  else if(!conditions.sameMethod||!conditions.sameUnit||!sameModel||!sameUnit||!sameScope)
   reason='Methods, units, declared assumptions, source lineage or physical model differ.';
  else if(r.status==='conditional'&&orig.status==='conditional'&&r.method==='existing-analytical-model'&&
    r.nativeImageDetected===false&&orig.nativeImageDetected===false&&
    typeof r.analysisModel==='string'&&r.analysisModel===orig.analysisModel&&same(r.assumptions??[],orig.assumptions??[]))
   comparison='conditional-ideal-comparison';
  else if(r.method==='native-observation'){
   if(!sameNumerics)reason='Native sampled counts/power use different numerical policies; not a physical change claim.';
   else if(!compatibleEmission||!unclipped||r.status==='qualified'||orig.status==='qualified'||
      (r.warnings?.length??0)||(orig.warnings?.length??0))
    reason='Source emission, brightness clipping or warning qualifications prevent an unqualified sampled comparison.';
   else comparison='sampled-native-comparison';
  }else reason='Result provenance is not an agreed comparison contract.';
  return {id:r.id,kind:r.kind,conditions,comparison,...(reason?{reason}:{}),
   ...(comparison!=='not-comparable'?{baselineStatus:orig.status,scenarioStatus:r.status}:{}),
   interpretation:'Eligibility within declared contracts only; not source fidelity, continuous flux or a physical causal law.'};
 });
 return {baselineSceneSha256:baseline.bundle?.sceneSha256??null,scenarioSceneSha256:scenario.bundle?.sceneSha256??null,
  evidenceChecks:{baseline:a.ok?{accepted:true}:{accepted:false,reason:a.reason},scenario:b.ok?{accepted:true}:{accepted:false,reason:b.reason}},
  samePhysics,sameNumerics,entries};
}
