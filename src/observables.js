// Requested results are separate from apparatus. Never changes the native scene
// or invents rays. Existing analytical models are used only after scope checks.
import {validate} from './contract.js';
import {predict} from './analysis.js';
import {sceneHash,isRecord,boundedText} from './qualified-utils.js';
import {provenanceScope,PROVENANCE_OBJECT_LIMIT,PROVENANCE_HIT_LIMIT,
  PROVENANCE_METHOD,PROVENANCE_LIMITATION} from './ray-provenance.js';
const kinds=Object.freeze({
  'interface-interactions':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric'],unit:'sampled interactions'},
  'interface-incidence-angle':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric'],unit:'degrees from normal; first native encounter'},
  'interface-transmission-angle':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric'],unit:'degrees from normal; first native encounter'},
  'interface-reflection-angle':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric'],unit:'degrees from normal; first native encounter'},
  'interface-tir-count':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric'],unit:'native TIR interactions'},
  'interface-first-event':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric'],unit:'native event; directions y-up; power relative'},
  'interface-face-events':{type:['triangular-prism','polygon-dielectric'],unit:'bounded first native encounter and total count per finite face'},
  'source-emissions':{type:'point-source',unit:'sampled rays'},
  'blocker-absorptions':{type:['line-blocker','circle-blocker','finite-aperture'],unit:'sampled absorbed rays'},
  'mirror-reflections':{type:['plane-mirror','ideal-curved-mirror','circular-arc-mirror'],unit:'sampled interactions'},
  'detector-crossings':{type:'ray-detector',unit:'sampled crossings'},
  'detector-hit-events':{type:'ray-detector',unit:'mm positions and unitless incoming directions; native sampled events'},
  'detector-ray-provenance':{type:'ray-detector',unit:'observed per-run native ray object ancestry'},
  'detector-signed-power':{type:'ray-detector',unit:'relative native units; not watts'},
  'ideal-image':{type:'point-source',unit:'mm; magnification dimensionless'}
});
export function observableCapabilities(){
  return {format:'opticsim-observables-v1',maxRequests:16,kinds:structuredClone(kinds),
    limits:['Native counts are sampled, not continuous coverage.',
      'Ideal image is conditional analysis, never native image detection.',
      'A requested result does not certify interpretation of its source question.',
      'Blocker absorption is a sampled native incident count; a zero detector count is not proof of continuous shadow or invisibility.',
      'Circular dielectric angles are relative to the local normal at the first actual native hit, not a whole path or detected image.',
      'Detector hit-event order is native callback order, not source attribution, a ray history, a continuous footprint or image detection. More than 32 hits or uncertain endpoints withhold the entire position list.',
      'Opt-in detector ray provenance reports direct native object parentage only in a bounded v5 one-interface single-ray scene; tokens are per-run, never full paths or detected images.']};
}
export function validateObservables(requests){
  if(!Array.isArray(requests)||requests.length>16)throw Error('Expected at most 16 observable requests');
  const ids=new Set();
  for(const r of requests){
    if(!isRecord(r)||Object.keys(r).some(k=>!['id','kind','componentId'].includes(k)))throw Error('Invalid observable request fields');
    boundedText(r.id,'Observable id',64);boundedText(r.kind,'Observable kind',80);
    if(ids.has(r.id))throw Error('Duplicate observable id');ids.add(r.id);
    if(r.componentId!==undefined)boundedText(r.componentId,'Observable componentId',64);
  }
  return requests;
}
// Defend the public result boundary even when handed a malformed execution
// snapshot. Internal report hashes provide integrity, not external signatures.
function validProvenanceValue(value,count,doc){
 if(!isRecord(value)||Object.keys(value).sort().join(',')!=='crossings,nodes'||
    !Array.isArray(value.nodes)||!Array.isArray(value.crossings)||
    value.nodes.length>PROVENANCE_OBJECT_LIMIT||value.crossings.length>PROVENANCE_HIT_LIMIT||
    value.crossings.length!==count)return false;
 const byToken=new Map(),sources=new Set(doc.physics.components.filter(c=>c.type==='point-source').map(c=>c.id));
 const interfaceId=doc.physics.components.find(c=>c.type==='planar-interface')?.id;
 for(const node of value.nodes){
   if(!isRecord(node)||Object.keys(node).sort().join(',')!=='origin,parentToken,sourceId,spawnComponentId,token'||
      typeof node.token!=='string'||!/^r[1-9][0-9]{0,3}$/.test(node.token)||byToken.has(node.token)||
      !sources.has(node.sourceId))return false;
   if(node.origin==='native-emission'){
     if(node.parentToken!==null||node.spawnComponentId!==null)return false;
   }else if(node.origin==='native-spawn'){
     if(typeof node.parentToken!=='string'||node.spawnComponentId!==interfaceId)return false;
   }else return false;
   byToken.set(node.token,node);
 }
 const used=new Set();
 for(const event of value.crossings){
   if(!isRecord(event)||Object.keys(event).join(',')!=='rayToken'||!byToken.has(event.rayToken))return false;
   let ray=byToken.get(event.rayToken),chain=new Set();
   while(ray){
     if(chain.has(ray.token))return false;
     chain.add(ray.token);used.add(ray.token);
     if(ray.parentToken===null)break;
     const parent=byToken.get(ray.parentToken);
     if(!parent||parent.sourceId!==ray.sourceId)return false;
     ray=parent;
   }
 }
 return used.size===byToken.size;
}
function conditionalImage(doc){
  const components=doc.physics.components;
  const count=type=>components.filter(c=>c.type===type).length;
  if(count('point-source')!==1)return {reason:'Existing image analysis requires exactly one source; no per-source image provenance is inferred.'};
  const models=count('plane-mirror')===0&&count('ideal-lens')>0?['ideal-thin-lens-geometric']:
    count('plane-mirror')===1&&count('ideal-lens')===0?['plane-mirror-geometric']:
    count('plane-mirror')===1&&count('ideal-lens')===1?['lens-mirror-return-geometric']:[];
  for(const model of models){
    const analysisDoc=structuredClone(doc);analysisDoc.physics.model=model;
    try{validate(analysisDoc);}catch{continue;}
    const value=predict(analysisDoc);
    if(value.kind==='unavailable')return {reason:value.reason};
    const assumptions=model==='ideal-thin-lens-geometric'?
      ['Ideal thin-lens mapping through every lens in increasing x order.',
       'Finite apertures, source emission and sampling may miss some or all of that route.']:
      model==='plane-mirror-geometric'?
      ['Virtual image across the two-sided mirror supporting line, conditional on hitting the finite segment.']:
      ['Lens -> perpendicular mirror -> SAME lens; left-going return.',
       'The analytical route is not enforced or proven by reflection counts.'];
    return {value,model,assumptions};
  }
  return {reason:'No existing analytical model satisfies this complete arrangement. No component is removed or replaced.'};
}
export async function evaluateObservables(doc,requests,execution){
  // Bind all reads to one invocation before the asynchronous scene hash.
  // A caller may begin the next revision while the digest is outstanding.
  [doc,requests,execution]=structuredClone([doc,requests,execution]);
  validate(doc);validateObservables(requests);
  const canonicalSha256=await sceneHash(doc);
  const fresh=execution?.canonicalSha256===canonicalSha256;
  const complete=fresh&&execution.executionPassed===true&&
    ['completed','completed-with-warnings'].includes(execution.native?.status);
  const warnings=[...(execution?.native?.warnings||[]),...doc.physics.components.filter(c=>['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric'].includes(c.type)&&!c.parameters.partialReflection)
    .map(c=>c.id+': explicit transmitted-only approximation omits Fresnel partial reflections; native TIR remains active.')];
  const results=requests.map(r=>{
    const base={...r,status:'unavailable',value:null,method:null,unit:null,reason:null};
    if(!Object.hasOwn(kinds,r.kind))return {...base,reason:'Requested quantity is not exposed by the current result contract.'};
    const spec=kinds[r.kind],component=doc.physics.components.find(c=>c.id===r.componentId);
    if(!component||!(Array.isArray(spec.type)?spec.type.includes(component.type):component.type===spec.type))return {...base,reason:'Requested component is missing or has the wrong physical type.'};
    if(!complete)return {...base,status:'suppressed',
      ...(r.kind==='detector-ray-provenance'?{reasonCode:!fresh?'STALE_PROVENANCE_EXECUTION':'NATIVE_PROVENANCE_INCOMPLETE'}:{}),
      reason:!fresh?'Execution evidence does not match the current scene hash.':'Current native run is incomplete, failed, or not yet available.'};
    if(r.kind==='detector-ray-provenance'&&!provenanceScope(doc,r.componentId))
      return {...base,reasonCode:'UNSUPPORTED_PROVENANCE_SCOPE',
        reason:'Only v5 with exactly one planar interface, one or two explicit single-ray sources, one or two passive detectors, and no other optics supports this observation.'};
    if(r.kind==='ideal-image'){
      try{
        const result=conditionalImage(doc);
        return result.reason?{...base,reason:result.reason}:
          {...base,status:'conditional',value:result.value,method:'existing-analytical-model',
            analysisModel:result.model,unit:spec.unit,assumptions:result.assumptions,
            nativeImageDetected:false,warnings};
      }catch(error){return {...base,reason:'Analytical calculation unavailable: '+error.message};}
    }
    const o=execution.observations;
    if(r.kind==='detector-ray-provenance'){
      const stored=o?.detectorRayProvenanceById?.[r.componentId];
      const nativeWarnings=execution.native?.warnings??[];
      if(nativeWarnings.length)return {...base,reasonCode:'NATIVE_PROVENANCE_UNQUALIFIED',
        reason:'The native run reports warnings; observed parentage is withheld, not promoted to a qualified graph.'};
      if(!stored||stored.status!=='complete'||stored.reasonCode!==null){
        const code=stored?.reasonCode??'PROVENANCE_UNKNOWN_OR_INCONSISTENT';
        return {...base,reasonCode:code,reason:'No complete native source, parent and detector callback evidence exists ('+code+').'};
      }
      const count=o?.detectorsById?.[r.componentId]?.crossings;
      if(!validProvenanceValue(stored.value,count,doc))
        return {...base,reasonCode:'PROVENANCE_UNKNOWN_OR_INCONSISTENT',
          reason:'Native ancestry graph or detector counts are incomplete or inconsistent.'};
      const approximated=doc.physics.components.some(c=>c.type==='planar-interface'&&!c.parameters.partialReflection);
      return {...base,status:approximated?'qualified':'available',
        value:stored.value,method:PROVENANCE_METHOD,unit:spec.unit,
        ...(approximated?{warnings:warnings.filter(s=>s.includes('transmitted-only approximation'))}:{}),
        limitation:PROVENANCE_LIMITATION};
    }
    if(r.kind==='detector-hit-events'){
      const sample=o?.detectorHitEventsById?.[r.componentId],count=o?.detectorsById?.[r.componentId]?.crossings;
      if(!sample||sample.status!=='complete'||!Array.isArray(sample.events)||
        sample.events.length!==count||sample.observedCount!==count){
        return {...base,reason:sample?.reasonCode==='HIT_EVENT_LIMIT_EXCEEDED'?
          'More than 32 actual detector hits: the bounded position list is withheld, not clipped.':
          sample?.reasonCode==='AMBIGUOUS_DETECTOR_HIT'?
          'At least one native hit is too close to a detector endpoint or is geometrically/numerically ambiguous.':
          'No complete, count-matched native hit-event evidence exists for this detector.'};
      }
      return {...base,status:warnings.length?'qualified':'available',value:sample.events,
        method:'native-hit-event-observation',unit:spec.unit,warnings,
        limitation:'Positions are native crossing coordinates in x-right/y-up mm. List order is native callback order, not one ray path or per-source attribution. No continuous illumination, physical image or inferred input/output pairing.'};
    }
    if(r.kind.startsWith('interface-')){
      const meter=o?.interfacesById?.[r.componentId],event=meter?.first;
      const value=r.kind==='interface-face-events'?meter?.faces:r.kind==='interface-interactions'?meter?.interactions:r.kind==='interface-tir-count'?meter?.totalInternalReflections:
        r.kind==='interface-first-event'?event:r.kind==='interface-incidence-angle'?event?.incidentAngleDeg:
        r.kind==='interface-transmission-angle'?event?.transmittedAngleDeg:event?.reflectedAngleDeg;
      if(value==null||!['interface-first-event','interface-face-events'].includes(r.kind)&&!Number.isFinite(value))return {...base,unit:spec.unit,
        reason:!event?'No native encounter was recorded.':'The first native encounter has no requested outgoing branch ('+event.outcome+').'};
      return {...base,status:warnings.length?'qualified':'available',value,method:'native-observation',unit:spec.unit,warnings,
        limitation:'First encounter (per face when requested) is simulation-order dependent, not source attribution or a whole ray path. Angles use actual native directions; no missing branch is invented.'};
    }
    const value=r.kind==='blocker-absorptions'?o?.blockersById?.[r.componentId]?.absorptions:
      r.kind==='source-emissions'?o?.emissionsById?.[r.componentId]?.emitted:
      r.kind==='mirror-reflections'?o?.reflectionsById?.[r.componentId]:
      r.kind==='detector-crossings'?o?.detectorsById?.[r.componentId]?.crossings:
      o?.detectorsById?.[r.componentId]?.signedPower;
    if(!Number.isFinite(value))return {...base,reason:'No complete native observation exists for this component.'};
    return {...base,status:warnings.length?'qualified':'available',value,unit:spec.unit,
      method:'native-observation',warnings,
      limitation:'Sampled native observation; not a continuous coverage, source attribution or image-detection claim.'};
  });
  return {format:'opticsim-observable-results-v1',canonicalSha256,
    questionSupport:'not-assessed-by-engine',results};
}
