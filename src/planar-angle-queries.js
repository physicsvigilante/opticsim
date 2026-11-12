// Deterministic ideal-model angular constraints for validated, parallel v5
// media. These are CONDITIONAL analytical relationships, NOT native ray paths,
// detector observations, an inverse ray tracer or hidden authoring defaults.
import {prepareScene,inspectAuthoringRequest,AuthoringError} from './authoring.js';
import {interfaceNormal,signedSide} from './planar-media.js';
import {isRecord} from './qualified-utils.js';
export const ANGLE_QUERY_FORMAT='opticsim-planar-angle-query-v1';
export const ANGLE_RESULT_FORMAT='opticsim-planar-angle-result-v1';
const RAD=Math.PI/180;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function record(x,keys,required,label){
  if(!isRecord(x)||Object.keys(x).some(k=>!keys.includes(k))||
     required.some(k=>!own(x,k)))throw Error('Invalid '+label+' fields');
}
function token(x,label){
  if(typeof x!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(x))throw Error('Invalid '+label);
}
function direction(x){if(!['positive','negative'].includes(x))throw Error('Expected positive or negative normal direction');return x==='positive'?1:-1;}
function asinAngle(s){
  // Tiny overshoot from valid trigonometric rounding is clipped; a genuinely
  // impossible angle is NOT clamped into a valid physical solution.
  if(!Number.isFinite(s)||s<0||s>1+2e-12)return null;
  return Math.asin(Math.min(1,s))/RAD;
}
function invalid(reason){return {status:'unavailable',value:null,reason};}
function layout(request,sourceId){
  record(request,['lengthUnit','title','runPolicy','components'],['lengthUnit','components'],'scene request');
  if(!['mm','cm','m'].includes(request.lengthUnit))throw Error('Explicit lengthUnit must be mm, cm or m');
  if(!Array.isArray(request.components)||request.components.length>8)throw Error('Expected at most eight scene components for the angular model');
  if(request.components.some(c=>!isRecord(c)||!['point-source','planar-interface'].includes(c.type)))
    throw Error('Angular model requires only explicit single-ray sources and parallel planar interfaces; no other optical elements may be omitted from analysis');
  const sources=request.components.filter(c=>c.type==='point-source');
  const interfaces=request.components.filter(c=>c.type==='planar-interface');
  if(sources.length!==1||interfaces.length<1||interfaces.length>4)
    throw Error('Angular analysis requires exactly one single-ray source and 1–4 planar boundaries');
  const source=sources.find(c=>c.id===sourceId);
  if(!source)throw Error('Unknown or ambiguous source ID');
  const ids=new Set();
  for(const c of request.components){
    token(c.id,'stable component ID');
    if(ids.has(c.id))throw Error('Duplicate component ID');ids.add(c.id);
    if(!isRecord(c.parameters))throw Error('Missing explicit component parameters');
  }
  if(source.emission?.mode!=='single-ray')throw Error('Angular analysis needs an explicit single-ray source mode');
  const ref=interfaces[0].parameters;
  if(!Number.isFinite(ref.normalDeg)||ref.normalDeg< -180||ref.normalDeg>180)throw Error('Invalid boundary normal');
  const normal=interfaceNormal(ref);
  for(const c of interfaces){
    const p=c.parameters;
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.normalDeg)||
       !Number.isFinite(p.negativeIndex)||!Number.isFinite(p.positiveIndex)||
       p.negativeIndex<1||p.positiveIndex<1||p.negativeIndex>4||p.positiveIndex>4||
       typeof p.partialReflection!=='boolean')throw Error('All media positions, [1,4] indices and reflection policies must be explicit');
    if((p.normalDeg-ref.normalDeg)!==0&&Math.abs(p.normalDeg-ref.normalDeg)!==360)
      throw Error('Angular model does not infer a route across nonparallel boundaries');
  }
  if(!Number.isFinite(source.parameters.x)||!Number.isFinite(source.parameters.y))throw Error('Source location is required');
  const planes=[...interfaces].sort((a,b)=>signedSide(ref,a.parameters)-signedSide(ref,b.parameters));
  for(let i=1;i<planes.length;i++){
    if(planes[i-1].parameters.positiveIndex!==planes[i].parameters.negativeIndex)
      throw Error('Inconsistent shared medium index between adjacent interfaces');
  }
  const regions=[planes[0].parameters.negativeIndex,...planes.map(c=>c.parameters.positiveIndex)];
  const signedPosition=signedSide(ref,source.parameters);
  const distances=planes.map(c=>signedSide(ref,c.parameters));
  if(distances.some(x=>Math.abs(signedPosition-x)<1e-12))
    throw Error('Source lies on an interface');
  const scale={mm:1,cm:10,m:1000}[request.lengthUnit];
  if(distances.some(x=>Math.abs(signedPosition-x)*scale<.01))
    throw Error('Source must be at least 0.01 mm from each interface');
  for(let i=1;i<distances.length;i++)if((distances[i]-distances[i-1])*scale<.01)
    throw Error('Parallel interface planes must be separated by at least 0.01 mm');
  const startRegion=distances.filter(x=>x<signedPosition).length;
  return {source,planes,regions,normal,startRegion};
}
function base(kind){
  return {format:ANGLE_RESULT_FORMAT,kind,method:'conditional-analytical',
    native:{status:'not-run',observations:null},
    numericalGuarantee:'none: mathematical relationships are not native ray observations',
    interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'};
}
function assumptions(){
  return ['Parallel infinite boundaries, homogeneous isotropic nondispersive media.',
    'Geometrical Snell/reflection constraints, with unsigned angles measured from each normal.',
    'Declared branches are analytical conditions, not observed or prescribed native ray routes.',
    'No claims about throughput, Fresnel power, phase, path length, or exact-critical native completion.'];
}
function solveCritical(request,query,l){
  record(query,['format','kind','sourceId','boundaryId','approach','tangentSide'],
    ['format','kind','sourceId','boundaryId','approach','tangentSide'],'critical inverse query');
  const travel=direction(query.approach),side=direction(query.tangentSide);
  if(own(l.source.emission,'directionDeg'))
    throw Error('Critical inverse requires directionDeg to be genuinely unknown, not overwritten');
  const boundaryIndex=l.planes.findIndex(c=>c.id===query.boundaryId);
  if(boundaryIndex<0)throw Error('Target critical boundary ID does not exist');
  const start=l.startRegion;
  if((travel===1&&boundaryIndex<start)||(travel===-1&&boundaryIndex>=start))
    return {...base(query.kind),...invalid('Target boundary is behind the declared initial propagation direction.'),assumptions:assumptions()};
  const incidentRegion=travel===1?boundaryIndex:boundaryIndex+1;
  const outgoingRegion=incidentRegion+travel;
  const incidentIndex=l.regions[incidentRegion],outgoingIndex=l.regions[outgoingRegion],initialIndex=l.regions[start];
  if(incidentIndex<=outgoingIndex)
    return {...base(query.kind),...invalid('The selected boundary is not a higher-to-lower-index critical interface.'),assumptions:assumptions()};
  const initialAngle=asinAngle(outgoingIndex/initialIndex),criticalAngle=asinAngle(outgoingIndex/incidentIndex);
  if(initialAngle===null||criticalAngle===null)
    return {...base(query.kind),...invalid('The required transverse index invariant exceeds the initial medium index; no propagating initial ray exists.'),assumptions:assumptions()};
  // All intervening media must propagate a ray with invariant n_out.
  const intermediate=[];
  for(let r=start;r!==incidentRegion;r+=travel){
    const next=r+travel;
    const priorAngle=asinAngle(outgoingIndex/l.regions[r]);
    const afterAngle=asinAngle(outgoingIndex/l.regions[next]);
    if(priorAngle===null||afterAngle===null||afterAngle>=90-1e-9)
      return {...base(query.kind),...invalid('An earlier boundary is evanescent or grazing; the ray cannot reach the requested critical interface as specified.'),assumptions:assumptions()};
    const iface=l.planes[travel===1?r:next];
    intermediate.push({interfaceId:iface.id,fromIndex:l.regions[r],toIndex:l.regions[next],
      incidenceAngleDeg:priorAngle,transmissionAngleDeg:afterAngle});
  }
  const t={x:-l.normal.y,y:l.normal.x},a=initialAngle*RAD;
  const dx=travel*l.normal.x*Math.cos(a)+side*t.x*Math.sin(a);
  const dy=travel*l.normal.y*Math.cos(a)+side*t.y*Math.sin(a);
  const sourceDirectionDeg=Math.atan2(dy,dx)/RAD;
  const derived=structuredClone(request);
  derived.components.find(c=>c.id===query.sourceId).emission.directionDeg=sourceDirectionDeg;
  // The calculated value is the only filled physical field. Canonical
  // validation checks all original supplied geometry and indices; no native run.
  const prepared=prepareScene(derived);
  return {...base(query.kind),status:'conditional',
    value:{initialIncidenceAngleDeg:initialAngle,criticalIncidenceAngleDeg:criticalAngle,
      sourceDirectionDeg,initialIndex,criticalIncidentIndex:incidentIndex,
      criticalDestinationIndex:outgoingIndex,transverseIndexInvariant:outgoingIndex,
      decreasingInitialIncidence:{range:'0 <= initial incidence < '+initialAngle+' degrees',
        target:'propagating transmission is allowed at the target boundary',
        condition:'n_start*sin(initial incidence) < critical destination index',
        qualification:'Assuming the same homogeneous parallel media and no additional intervening obstruction.'},
      angleConvention:'unsigned degrees from plane normal; critical outgoing ray is grazing'},
    targetBoundaryId:query.boundaryId,intermediate,
    resultMethod:'conservation of n*sin(angle) across parallel transmitted boundaries; critical angle at target',
    assumptions:assumptions(),derivedOnly:[{componentId:query.sourceId,section:'emission',key:'directionDeg',
      value:sourceDirectionDeg,purpose:'computed inverse answer, NOT supplied source problem data'}],
    proposedForwardScene:prepared.document,preparation:prepared.preparation,
    nativeCaveat:'Proposed forward scene has not been executed; PhyDemo may truncate at exact critical incidence.'};
}
function branchResults(request,query,l){
  record(query,['format','kind','sourceId','branches'],['format','kind','sourceId','branches'],'branch query');
  const prepared=prepareScene(request),theta=l.source.emission.directionDeg;
  if(!Number.isFinite(theta))throw Error('Branch analysis requires a stated single-ray direction');
  if(!Array.isArray(query.branches)||query.branches.length<1||query.branches.length>4)
    throw Error('Expected 1–4 explicitly declared analytical branches');
  const dir={x:Math.cos(theta*RAD),y:Math.sin(theta*RAD)};
  const along=dir.x*l.normal.x+dir.y*l.normal.y;
  if(Math.abs(along)<1e-12)throw Error('Source ray is parallel to all boundaries; no finite crossing can be derived');
  const initialAngle=Math.atan2(Math.abs(dir.x*l.normal.y-dir.y*l.normal.x),Math.abs(along))/RAD;
  const initialIndex=l.regions[l.startRegion],transverse=initialIndex*Math.sin(initialAngle*RAD);
  const seen=new Set();
  const results=query.branches.map(b=>{
    record(b,['id','events'],['id','events'],'branch');
    token(b.id,'branch ID');
    if(seen.has(b.id))throw Error('Duplicate branch ID');seen.add(b.id);
    if(!Array.isArray(b.events)||b.events.length<1||b.events.length>8)
      throw Error('A branch must have 1–8 bounded interface events');
    let region=l.startRegion,travel=Math.sign(along),angle=initialAngle;
    const events=[];
    for(const e of b.events){
      record(e,['interfaceId','action'],['interfaceId','action'],'branch event');
      token(e.interfaceId,'interface ID');
      if(!['transmit','reflect'].includes(e.action))throw Error('Expected declared reflect or transmit choice');
      const next=region+travel;
      if(next<0||next>=l.regions.length)return {id:b.id,...invalid('Declared branch exits the available media before its next event.'),events};
      const iface=l.planes[travel===1?region:next];
      if(e.interfaceId!==iface.id)return {id:b.id,...invalid('Branch skips or misorders the next physical interface ('+iface.id+').'),events};
      const n1=l.regions[region],n2=l.regions[next];
      const ratio=transverse/n2;
      const at=asinAngle(transverse/n1);
      if(at===null)return {id:b.id,...invalid('Previous branch is evanescent.'),events};
      const tir=ratio>1+2e-12;
      const critical=Math.abs(ratio-1)<=2e-12;
      const out=asinAngle(ratio);
      const step={interfaceId:iface.id,action:e.action,fromIndex:n1,toIndex:n2,
        incidenceAngleDeg:at,totalInternalReflection:tir,
        nativeBranchStatus:'not-checked'};
      if(e.action==='transmit'){
        if(tir||critical||out===null)return {id:b.id,...invalid(tir?
          'Requested transmitted branch is absent under total internal reflection.':
          'Critical/grazing transmission is a limiting angle, not a reliable finite propagating ray.'),events:[...events,step]};
        step.outgoingAngleDeg=out;region=next;angle=out;
      }else{
        if(!tir&&(n1===n2||!iface.parameters.partialReflection))
          return {id:b.id,...invalid('Requested weak/reflected branch is absent under the explicitly selected transmitted-only or equal-index model.'),events:[...events,step]};
        step.outgoingAngleDeg=at;step.reflectionKind=tir?'total-internal-reflection':'fresnel-conditional';
        angle=at;travel=-travel;
      }
      events.push(step);
    }
    return {id:b.id,status:'conditional',value:{exitAngleDeg:angle,
      exitMediumIndex:l.regions[region],exitRegion:region,travelDirection:travel===1?'positive':'negative',
      transverseIndexInvariant:transverse},events,
      method:'analytical-snells-law-plus-specular-reflection',
      limitation:'This declared ray branch is conditional geometry; PhyDemo might truncate or omit it.'};
  });
  return {...base(query.kind),status:results.every(r=>r.status==='conditional')?'conditional':'partially-unavailable',
    initial:{sourceId:query.sourceId,incidenceAngleDeg:initialAngle,index:initialIndex,
      region:l.startRegion,transverseIndexInvariant:transverse},
    results,assumptions:assumptions(),
    canonicalForwardScene:prepared.document,preparation:prepared.preparation,
    nativeCaveat:'The native run has not been executed and can omit weak Fresnel branches.'};
}
export function analyzePlanarAngleQuery(request,query){
  record(query,['format','kind','sourceId','boundaryId','approach','tangentSide','branches'],
    ['format','kind','sourceId'],'planar angular query');
  if(query.format!==ANGLE_QUERY_FORMAT)throw Error('Unsupported planar angular query format');
  if(!['critical-input-angle','branch-angles'].includes(query.kind))throw Error('Unsupported angular query kind');
  token(query.sourceId,'source ID');
  // Reuse live minimal-authoring completeness/range validation. The one
  // intentional exception is the explicitly requested inverse unknown.
  const sourceIndex=Array.isArray(request?.components)?
    request.components.findIndex(c=>c?.id===query.sourceId&&c?.type==='point-source'):-1;
  const unknownPath='$.components['+sourceIndex+'].emission.directionDeg';
  const issues=inspectAuthoringRequest(request).filter(e=>!(query.kind==='critical-input-angle'&&
    e.path===unknownPath&&e.code==='MISSING_VALUE'));
  if(issues.length)throw new AuthoringError(issues);
  const l=layout(request,query.sourceId);
  return query.kind==='critical-input-angle'?solveCritical(request,query,l):branchResults(request,query,l);
}
export function angularCapabilities(){
  return {format:ANGLE_QUERY_FORMAT,kinds:['critical-input-angle','branch-angles'],
    physicalInput:'existing v5 minimal authoring request with explicit single-ray source and 1–4 parallel refractive boundaries',
    critical:'requires missing source direction plus explicit approach and tangentSide; solves one critical target via transmissions only',
    branches:'known source direction plus 1–4 conditional branches of 1–8 ordered reflect/transmit events by actual interface ID',
    noGuessing:'Indices, source, interface geometry, reflection policy, unknown status and branch choices are never inferred',
    claims:'conditional ideal-model angles only; never native Fresnel power, native branch detection or complete question correctness'};
}
