// Deterministic dispatch only. Physics, angular algebra, qualification and
// native result gating stay in their existing implementations.
import {analyzeCurvedMirrorQuery,curvedQueryCapabilities,CURVED_FACTS_FORMAT,CURVED_QUERY_FORMAT} from './curved-mirror-queries.js';
import {problemCapabilities,resolveProblemRequest} from './problem-authoring.js';
import {analyzePlanarAngleQuery,angularCapabilities,ANGLE_QUERY_FORMAT,ANGLE_FACTS_FORMAT} from './planar-angle-queries.js';
import {analyzePlaneMirrorAngleQuery,mirrorAngularCapabilities,MIRROR_FACTS_FORMAT,MIRROR_QUERY_FORMAT} from './mirror-angle-queries.js';
import {observableCapabilities,validateObservables} from './observables.js';
import {validateInterpretation} from './qualification.js';
import {canonicalJSON,isRecord,boundedText} from './qualified-utils.js';
export const PROBLEM_FORMAT='opticsim-problem-v1';
const own=(x,k)=>Object.hasOwn(x,k);
const curvedKinds=new Set(curvedQueryCapabilities().kinds);
const angularKinds=new Set(angularCapabilities().kinds);
const mirrorKinds=new Set(mirrorAngularCapabilities().kinds);
const observableKinds=observableCapabilities().kinds;
const empty=(r,status,code,reason)=>({id:r.id,kind:r.kind,status,value:null,method:null,reasonCode:code,reason});
export function problemWorkflowCapabilities(){
  return {format:PROBLEM_FORMAT,version:1,maxRequests:16,maxCalculations:4,
    required:['format','physical','requests'],optional:['interpretation','illustration','verifyNative'],
    physical:'Existing minimal authoring request, existing reduced planar-angular facts, or null when unsupported. No new apparatus fields.',
    requestKinds:{...Object.fromEntries(curvedQueryCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:CURVED_QUERY_FORMAT}])),
      ...Object.fromEntries(angularCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:ANGLE_QUERY_FORMAT}])),
      ...Object.fromEntries(mirrorAngularCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:MIRROR_QUERY_FORMAT}])),
      ...Object.fromEntries(Object.entries(observableKinds).map(([k,v])=>[k,{...v,route:k==='ideal-image'?'existing-analysis-with-native-gate':'native-observation'}]))},
    authoring:problemCapabilities(),curvedMirrors:curvedQueryCapabilities(),angular:angularCapabilities(),mirrorAngular:mirrorAngularCapabilities(),observables:observableCapabilities(),
    policy:'One request file; route by kind, never by answers or expected values. Native componentId may be omitted only when exactly one compatible authored component exists; its binding is recorded, not guessed from geometry or ray paths. Ambiguous or absent targets remain unresolved. No physical repairs or method fallback. Angular-only requests do not trigger native work unless verifyNative is true. Interpretation remains author-provided and unverified.'};
}
function validateEnvelope(input){
  if(!isRecord(input)||Object.keys(input).some(k=>!['format','physical','requests','interpretation','illustration','verifyNative'].includes(k))||
     input.format!==PROBLEM_FORMAT||!own(input,'physical')||!Array.isArray(input.requests)||
     input.requests.length<1||input.requests.length>16)throw Error('Invalid problem envelope: format, physical and 1–16 requests are required');
  if(input.physical!==null&&!isRecord(input.physical))throw Error('physical must be an existing request/facts object or null');
  for(const k of ['illustration','verifyNative'])if(own(input,k)&&typeof input[k]!=='boolean')throw Error(k+' must be explicit boolean');
  validateInterpretation(input.interpretation??null);
  const ids=new Set();let angularCount=0;
  for(const r of input.requests){
    if(!isRecord(r))throw Error('Invalid requested quantity');
    boundedText(r.id,'Request ID',64);boundedText(r.kind,'Request kind',80);
    if(ids.has(r.id))throw Error('Duplicate request ID');ids.add(r.id);
    if(curvedKinds.has(r.kind)||mirrorKinds.has(r.kind)||angularKinds.has(r.kind)){if(++angularCount>4)throw Error('At most four analytical calculations per problem');}
    if(curvedKinds.has(r.kind)){
      if(Object.keys(r).some(k=>!['id','kind','componentId'].includes(k)))throw Error('Unsupported curved-mirror request field');
    }else if(mirrorKinds.has(r.kind)){
      const keys=['id','kind','referenceMirrorId','outgoingRelation','angleConvention'];
      if(Object.keys(r).some(k=>!keys.includes(k)))throw Error('Unsupported plane-mirror analytical request field');
    }else if(angularKinds.has(r.kind)){
      const keys=r.kind==='critical-input-angle'?['id','kind','sourceId','boundaryId','approach','tangentSide']:['id','kind','sourceId','branches'];
      if(Object.keys(r).some(k=>!keys.includes(k)))throw Error('Unsupported analytical request field');
    }else validateObservables([r]); // Also validates data-only unknown quantities.
  }
  if(new TextEncoder().encode(canonicalJSON(input)).length>1024*1024)throw Error('Problem JSON exceeds 1 MB');
}
export function planProblem(input){
  validateEnvelope(input);
  // Snapshot now, before any asynchronous run or observer can see caller edits.
  const request=structuredClone(input),physical=request.physical;
  const authoredNativeRequests=request.requests.filter(r=>own(observableKinds,r.kind));
  const needsNative=authoredNativeRequests.length>0||request.verifyNative===true;
  let preparation=null,scene=null,sceneConflict=false;
  if(physical&&physical.format!==ANGLE_FACTS_FORMAT&&physical.format!==MIRROR_FACTS_FORMAT&&physical.format!==CURVED_FACTS_FORMAT){
    preparation=resolveProblemRequest(physical,{illustration:request.illustration===true});
    scene=preparation.prepared?.document??null;
  }
  const calculations=[],results=[];
  for(const r of request.requests){
    if(curvedKinds.has(r.kind)){
      if(!physical){results.push(empty(r,'needs-information','MISSING_FACTS','Curved mirror properties and object data are required.'));continue;}
      const {id,...fields}=r,query={format:CURVED_QUERY_FORMAT,...fields};
      try{
        const result=analyzeCurvedMirrorQuery(physical,query);
        calculations.push({id,query,result});
        results.push({id,kind:r.kind,status:result.status,value:result.value??null,method:result.method,
          reasonCode:result.reasonCode??null,reason:result.reason??null,assumptions:result.assumptions,nativeObservation:false});
        if(result.canonicalForwardScene){
          if(scene&&canonicalJSON(scene.physics)!==canonicalJSON(result.canonicalForwardScene.physics))sceneConflict=true;
          else if(!scene)scene=result.canonicalForwardScene;
        }
      }catch(e){results.push(empty(r,e.code==='MISSING_FACTS'?'needs-information':e.code==='UNSUPPORTED_SCOPE'||e.code==='UNSUPPORTED_MODEL'?'unavailable':'invalid-input',e.code||'INVALID_CURVED_FACTS',e.message));}
    }else if(mirrorKinds.has(r.kind)){
      if(!physical){
        results.push(empty(r,'needs-information','NO_PHYSICAL_FACTS',
          'The angular relation needs stated mirror inclinations and reflection order.'));continue;
      }
      try{
        const {id,...fields}=r,query={format:MIRROR_QUERY_FORMAT,...fields};
        const result=analyzePlaneMirrorAngleQuery(physical,query);
        calculations.push({id,query,result});
        results.push({id,kind:r.kind,status:result.status,value:result.value,
          ...(result.status==='multiple-solutions'?{candidateIncidenceAnglesDeg:result.candidateIncidenceAnglesDeg}:{}),
          method:result.method,reasonCode:result.reasonCode,assumptions:result.assumptions,
          nativeObservation:false,limitations:result.limitations});
      }catch(error){
        const missing=/required|Invalid mirror angular query fields|Expected one|Unknown reference|undefined/i.test(error.message);
        results.push(empty(r,missing?'needs-information':'invalid-input',
          missing?'MISSING_MIRROR_ANGLE_FACTS':'INVALID_MIRROR_ANGLE_FACTS',error.message));
      }
    }else if(angularKinds.has(r.kind)){
      const {id,...rest}=r,query={format:ANGLE_QUERY_FORMAT,...rest};
      if(!physical){results.push(empty(r,'needs-information','NO_PHYSICAL_FACTS','No physical facts were supplied for this known calculation.'));continue;}
      let result;
      try{result=analyzePlanarAngleQuery(physical,query);}
      catch(error){
        const issues=error.issues||[];
        // Missing facts are not physical impossibility. All other rejection
        // diagnostics retain their underlying reason rather than guessing.
        const missing=issues.length&&issues.every(x=>x.code==='MISSING_VALUE');
        results.push({...empty(r,missing?'needs-information':'invalid-input',missing?'MISSING_FACTS':'ANALYTICAL_REQUEST_REJECTED',error.message),issues});
        continue;
      }
      calculations.push({id,query,result});
      results.push({id,kind:r.kind,status:result.status,value:result.value??null,
        ...(result.results?{branches:result.results}:{}),method:result.method,
        reason:result.reason??null,reasonCode:result.reasonCode??null,
        assumptions:result.assumptions||[],nativeObservation:false});
      const candidate=result.proposedForwardScene||result.canonicalForwardScene;
      if(candidate){
        if(scene&&canonicalJSON(scene.physics)!==canonicalJSON(candidate.physics))sceneConflict=true;
        else if(!scene)scene=candidate;
      }
    }else if(own(observableKinds,r.kind)){
      results.push(empty(r,'pending','AWAITING_NATIVE','Requested result needs the existing native-completion gate.'));
    }else results.push(empty(r,'unavailable','UNSUPPORTED_QUANTITY','No registered calculation or observation provides this requested quantity.'));
  }
  const invalid=results.some(r=>r.status==='invalid-input')||preparation?.status==='invalid-input';
  const diagnostics=[];
  if(sceneConflict){scene=null;diagnostics.push({code:'CONFLICTING_FORWARD_SCENES',message:'Different calculations imply different physical scenes. Results are separate; no native scene or package is selected automatically.'});}
  if(invalid){scene=null;diagnostics.push({code:'INVALID_PROBLEM_INPUT',message:'At least one known request or supplied physical field was invalid; no native work or package is authorized.'});}
  if(needsNative&&!scene){
    const reason=diagnostics[0]?.message||preparation?.issues?.map(i=>i.message).join('; ')||
      'No complete native scene. Reduced analytical facts do not supply brightness, coordinates or native policies.';
    for(let i=0;i<results.length;i++)if(results[i].status==='pending')results[i]={...results[i],
      status:invalid?'invalid-input':preparation?.status==='unsupported'?'unavailable':'needs-information',
      reasonCode:invalid?'INVALID_PROBLEM_INPUT':sceneConflict?'CONFLICTING_FORWARD_SCENES':'NATIVE_SCENE_REQUIRED',reason};
  }

  // One deterministic reduction in LLM work: when a request names its quantity
  // but not an ID, bind it ONLY if the prepared, unchanged scene contains
  // exactly one component of a compatible physical type. This is not optical
  // path reconstruction, source attribution or a guessed apparatus.
  // The original submitted request remains byte-bound to inputSha256.
  const nativeRequests=[],targetBindings=[];
  if(scene&&!invalid){
    for(const r of authoredNativeRequests){
      const type=observableKinds[r.kind].type,types=Array.isArray(type)?type:[type];
      const candidates=scene.physics.components.filter(c=>types.includes(c.type));
      if(own(r,'componentId')){
        const target=scene.physics.components.find(c=>c.id===r.componentId);
        if(target&&types.includes(target.type)){nativeRequests.push(r);continue;}
        // An explicit target is an authored choice: never redirect it to the
        // sole compatible component. Diagnose it before costly native work.
        const index=results.findIndex(x=>x.id===r.id);
        results[index]={...empty(r,target?'unavailable':'needs-information',
          target?'INCOMPATIBLE_COMPONENT_TARGET':'UNKNOWN_COMPONENT_TARGET',
          target?'The named component has the wrong physical type for this measurement.':
            'The named measurement component is not present; supply an existing componentId.'),
          componentId:r.componentId,candidateComponentIds:candidates.map(c=>c.id)};
        continue;
      }
      if(candidates.length===1){
        const componentId=candidates[0].id;
        nativeRequests.push({...r,componentId});
        targetBindings.push({requestId:r.id,kind:r.kind,componentId,
          rule:'sole-compatible-authored-component'});
      }else{
        const index=results.findIndex(x=>x.id===r.id);
        results[index]={...empty(r,candidates.length?'needs-information':'unavailable',
          candidates.length?'AMBIGUOUS_COMPONENT_TARGET':'NO_COMPATIBLE_COMPONENT',
          candidates.length?'Specify componentId: multiple compatible components are authored.':
            'No compatible physical component is present in this scene.'),
          candidateComponentIds:candidates.map(c=>c.id)};
      }
    }
  }
  const canRun=needsNative&&!!scene&&!invalid&&
    (request.verifyNative===true||nativeRequests.length>0);
  const {prepared:ignored,...prep}=preparation||{};
  return {format:'opticsim-problem-plan-v1',request,results,calculations,
    preparation:preparation?prep:null,scene,diagnostics,targetBindings,
    native:{required:needsNative,canRun,
      reason:!needsNative?'No registered native result or verification requested.':!scene?'No unambiguous validated forward scene.':!canRun?'No uniquely determined native measurement target.':null},
    nativeRequests,interpretation:'author-provided-not-independently-verified',
    questionSupport:'not-assessed-by-engine'};
}
export function resultCoverage(results){
  const available=results.filter(r=>['available','qualified','conditional'].includes(r.status));
  return {requested:results.length,available:available.length,
    status:available.length===results.length?'all-requested-quantities-available':available.length?'partially-available':'none-available',
    meaning:'Coverage of authored requests only, never proof that the original question was faithfully interpreted or answered.'};
}
