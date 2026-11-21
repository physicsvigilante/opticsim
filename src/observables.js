// Requested results are separate from apparatus. Never changes the native scene
// or invents rays. Existing analytical models are used only after scope checks.
import {validate} from './contract.js';
import {hasEndpointEvidence,MISSING_V27_ENDPOINTS} from './native-observations.js';
import {predict} from './analysis.js';
import {sceneHash,isRecord,boundedText} from './qualified-utils.js';
import {supportsNativeRayParentage} from './native-ray-parentage.js';
import {supportsFiniteHitDiagnostic,FINITE_DIAGNOSTIC_METHOD} from './native-finite-hit-diagnostic.js';
const kinds=Object.freeze({
  'interface-interactions':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric','semicircular-dielectric','circular-cap-dielectric','spherical-lens'],unit:'sampled interactions'},
  'interface-incidence-angle':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric','semicircular-dielectric','circular-cap-dielectric','spherical-lens'],unit:'degrees from normal; first native encounter'},
  'interface-transmission-angle':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric','semicircular-dielectric','circular-cap-dielectric','spherical-lens'],unit:'degrees from normal; first native encounter'},
  'interface-reflection-angle':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric','semicircular-dielectric','circular-cap-dielectric','spherical-lens'],unit:'degrees from normal; first native encounter'},
  'interface-tir-count':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric','semicircular-dielectric','circular-cap-dielectric','spherical-lens'],unit:'native TIR interactions'},
  'interface-first-event':{type:['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric','semicircular-dielectric','circular-cap-dielectric','spherical-lens'],unit:'native event; directions y-up; power relative'},
  'interface-face-events':{type:['triangular-prism','polygon-dielectric','semicircular-dielectric','circular-cap-dielectric','spherical-lens'],unit:'bounded first native encounter and total count per finite face'},
  'source-emissions':{type:['point-source','parallel-beam'],unit:'sampled rays'},
  'blocker-absorptions':{type:['line-blocker','circle-blocker','finite-aperture'],unit:'sampled absorbed rays'},
  'mirror-reflections':{type:['plane-mirror','ideal-curved-mirror','circular-arc-mirror'],unit:'sampled interactions'},
  'detector-crossings':{type:'ray-detector',unit:'sampled crossings'},
  'detector-hit-events':{type:'ray-detector',unit:'mm positions and unitless incoming directions; native sampled events'},
  'detector-ray-provenance':{type:'ray-detector',unit:'native observed object ancestry; tokens are run-local'},
  'finite-hit-numerical-diagnostic':{type:'polygon-dielectric',unit:'advisory represented binary64 finite-hit consistency; not physical correctness'},
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
      'Semicircular face readings use only real native callbacks; any near-joint or tangential ambiguity suppresses the complete run rather than certifying a junction result.',
      'Native spherical thick-lens face/rim angles use only real native incidents, never inferred rays or a detected image; near-edge events remain subject to native completeness and finite-face qualification.',
      'Detector hit-event order is native callback order, not source attribution, a ray history, a continuous footprint or image detection. More than 32 hits or uncertain endpoints withhold the entire position list.',
      'Opt-in detector ray provenance is observed direct native parentage in one complete v5 single-interface run, not a physical path, image, or continuous irradiance. Tokens are not stable across runs.',
      'Opt-in v9 finite-hit diagnostic is NONCERTIFYING advisory evidence; it never changes canonical native measurements or makes an original question answered. Unknown point error is not an accepted forward hit.']};
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
    hasEndpointEvidence(doc,execution.observations)&&
    ['completed','completed-with-warnings'].includes(execution.native?.status);
  const warnings=[...(execution?.native?.warnings||[]),...doc.physics.components.filter(c=>['planar-interface','circular-dielectric','triangular-prism','polygon-dielectric','semicircular-dielectric','circular-cap-dielectric','spherical-lens','graded-index-rectangle'].includes(c.type)&&!c.parameters.partialReflection)
    .map(c=>c.id+': explicit transmitted-only approximation omits Fresnel partial reflections; native TIR remains active.')];
  const results=requests.map(r=>{
    const base={...r,status:'unavailable',value:null,method:null,unit:null,reason:null};
    if(!Object.hasOwn(kinds,r.kind))return {...base,reason:'Requested quantity is not exposed by the current result contract.'};
    const spec=kinds[r.kind],component=doc.physics.components.find(c=>c.id===r.componentId);
    if(!component||!(Array.isArray(spec.type)?spec.type.includes(component.type):component.type===spec.type))return {...base,reason:'Requested component is missing or has the wrong physical type.'};
    if(!complete)return {...base,status:'suppressed',
      ...(r.kind==='detector-ray-provenance'?{reasonCode:!fresh?
        'STALE_PROVENANCE_EXECUTION':'NATIVE_PROVENANCE_INCOMPLETE'}:{}),
      ...(r.kind==='finite-hit-numerical-diagnostic'?{reasonCode:!fresh?
        'STALE_FINITE_HIT_DIAGNOSTIC':'NATIVE_FINITE_HIT_DIAGNOSTIC_INCOMPLETE'}:{}),
      reason:!fresh?'Execution evidence does not match the current scene hash.':
        execution.executionPassed===true && !hasEndpointEvidence(doc,execution.observations)?MISSING_V27_ENDPOINTS:
        'Current native run is incomplete, failed, or not yet available.'};
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
    if(r.kind==='finite-hit-numerical-diagnostic'){
      if(!supportsFiniteHitDiagnostic(doc))
        return {...base,reasonCode:'FINITE_HIT_DIAGNOSTIC_SCOPE_UNSUPPORTED',
          reason:'Diagnostic is available only for an already valid v9 single convex four-vertex native Glass scene.'};
      const advisory=o?.finiteHitDiagnostic;
      if(!advisory||advisory.method!==FINITE_DIAGNOSTIC_METHOD)
        return {...base,reasonCode:'NATIVE_FINITE_HIT_DIAGNOSTIC_NOT_CAPTURED',
          reason:'No opt-in, complete, native finite-hit diagnostic was captured on this exact run.'};
      // Never count this advisory as an answered optical question or native
      // measurement. Stage 2 measurement withholding is NOT implemented.
      return {...base,status:'advisory',value:structuredClone(advisory),
        method:FINITE_DIAGNOSTIC_METHOD,reasonCode:advisory.reasonCode,unit:spec.unit,
        warnings:[...warnings,
          advisory.status==='inconsistent'?
            'NATIVE NUMERICAL CAUTION: this run contains an observed represented finite-edge contradiction. Existing native measurements are NOT independently certified by this diagnostic.':
            advisory.status!=='checked'&&advisory.status!=='checked-no-hit'?
              'NATIVE NUMERICAL CAUTION: this advisory lacks complete confirmation. Existing native measurements are NOT independently certified by this diagnostic.':
              'This diagnostic is NONCERTIFYING even when its bounded necessary checks pass.'],
        limitation:'Opt-in advisory only. Does NOT change canonical native status, detector counts, interface or other measurements; does not certify physical rays, Snell/Fresnel accuracy, image detection or original source truth. Exact binary64 reported-hit point disagreement without a validated error envelope is UNKNOWN, never checked.'};
    }
    if(r.kind==='detector-ray-provenance'){
      if(!supportsNativeRayParentage(doc))return {...base,reasonCode:'UNSUPPORTED_PROVENANCE_SCOPE',
        reason:'Parentage requires one planar interface, one or two exact single-ray sources, one or two passive detectors, and no other objects.'};
      const observed=o?.detectorRayProvenanceById?.[r.componentId];
      if(!observed||observed.status!=='complete'||!observed.value){
        return {...base,reasonCode:observed?.reasonCode??'PROVENANCE_UNKNOWN_OR_INCONSISTENT',
          reason:'No fully qualified native source and direct-child identity ledger exists for this detector.'};
      }
      // Native warnings always withhold provenance; a deliberate transmitted-only
      // model caveat is not a native warning.
      if(execution.native?.warnings?.length)return {...base,reasonCode:'NATIVE_PROVENANCE_UNQUALIFIED',
        reason:'Native runtime warnings prevent reliable complete provenance.'};
      const approximation=doc.physics.components.find(c=>c.type==='planar-interface')?.parameters.partialReflection===false;
      return {...base,status:approximation?'qualified':'available',
        value:structuredClone(observed.value),unit:spec.unit,method:'native-observed-object-parentage',
        warnings:approximation?warnings:[],
        limitation:'Only directly observed native source/parent object identity at actual sampled detector crossings; same-object optical interactions have no edges. Tokens are local to this run; no complete path, material inference, physical image, continuous illumination or source-image authenticity.'};
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
