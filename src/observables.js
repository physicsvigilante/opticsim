// Requested results are separate from apparatus. Never changes the native scene
// or invents rays. Existing analytical models are used only after scope checks.
import {validate} from './contract.js';
import {predict} from './analysis.js';
import {sceneHash,isRecord,boundedText} from './qualified-utils.js';
const kinds=Object.freeze({
  'interface-interactions':{type:'planar-interface',unit:'sampled interactions'},
  'interface-incidence-angle':{type:'planar-interface',unit:'degrees from normal; first native encounter'},
  'interface-transmission-angle':{type:'planar-interface',unit:'degrees from normal; first native encounter'},
  'interface-reflection-angle':{type:'planar-interface',unit:'degrees from normal; first native encounter'},
  'interface-tir-count':{type:'planar-interface',unit:'native TIR interactions'},
  'interface-first-event':{type:'planar-interface',unit:'native event; directions y-up; power relative'},
  'source-emissions':{type:'point-source',unit:'sampled rays'},
  'mirror-reflections':{type:'plane-mirror',unit:'sampled interactions'},
  'detector-crossings':{type:'ray-detector',unit:'sampled crossings'},
  'detector-signed-power':{type:'ray-detector',unit:'relative native units; not watts'},
  'ideal-image':{type:'point-source',unit:'mm; magnification dimensionless'}
});
export function observableCapabilities(){
  return {format:'opticsim-observables-v1',maxRequests:16,kinds,
    limits:['Native counts are sampled, not continuous coverage.',
      'Ideal image is conditional analysis, never native image detection.',
      'A requested result does not certify interpretation of its source question.']};
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
  validate(doc);validateObservables(requests);
  const canonicalSha256=await sceneHash(doc);
  const fresh=execution?.canonicalSha256===canonicalSha256;
  const complete=fresh&&execution.executionPassed===true&&
    ['completed','completed-with-warnings'].includes(execution.native?.status);
  const warnings=[...(execution?.native?.warnings||[]),...doc.physics.components.filter(c=>c.type==='planar-interface'&&!c.parameters.partialReflection)
    .map(c=>c.id+': explicit transmitted-only approximation omits Fresnel partial reflections; native TIR remains active.')];
  const results=requests.map(r=>{
    const base={...r,status:'unavailable',value:null,method:null,unit:null,reason:null};
    if(!Object.hasOwn(kinds,r.kind))return {...base,reason:'Requested quantity is not exposed by the current result contract.'};
    const spec=kinds[r.kind],component=doc.physics.components.find(c=>c.id===r.componentId);
    if(!component||component.type!==spec.type)return {...base,reason:'Requested component is missing or has the wrong physical type.'};
    if(!complete)return {...base,status:'suppressed',reason:!fresh?
      'Execution evidence does not match the current scene hash.':'Current native run is incomplete, failed, or not yet available.'};
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
    if(spec.type==='planar-interface'){
      const meter=o?.interfacesById?.[r.componentId],event=meter?.first;
      const value=r.kind==='interface-interactions'?meter?.interactions:r.kind==='interface-tir-count'?meter?.totalInternalReflections:
        r.kind==='interface-first-event'?event:r.kind==='interface-incidence-angle'?event?.incidentAngleDeg:
        r.kind==='interface-transmission-angle'?event?.transmittedAngleDeg:event?.reflectedAngleDeg;
      if(value==null||r.kind!=='interface-first-event'&&!Number.isFinite(value))return {...base,unit:spec.unit,
        reason:!event?'No native encounter was recorded.':'The first native encounter has no requested outgoing branch ('+event.outcome+').'};
      return {...base,status:warnings.length?'qualified':'available',value,method:'native-observation',unit:spec.unit,warnings,
        limitation:'First encounter is simulation-order dependent, not source attribution or a whole ray path. Angles use actual native directions; no missing branch is invented.'};
    }
    const value=r.kind==='source-emissions'?o?.emissionsById?.[r.componentId]?.emitted:
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
