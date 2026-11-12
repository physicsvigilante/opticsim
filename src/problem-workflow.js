// Deterministic dispatch only. Physics, angular algebra, qualification and
// native result gating stay in their existing implementations.
import {problemCapabilities,resolveProblemRequest} from './problem-authoring.js';
import {analyzePlanarAngleQuery,angularCapabilities,ANGLE_QUERY_FORMAT,ANGLE_FACTS_FORMAT} from './planar-angle-queries.js';
import {analyzePlaneMirrorAngleQuery,mirrorAngularCapabilities,MIRROR_FACTS_FORMAT,MIRROR_QUERY_FORMAT} from './mirror-angle-queries.js';
import {observableCapabilities,validateObservables} from './observables.js';
import {validateInterpretation} from './qualification.js';
import {canonicalJSON,isRecord,boundedText} from './qualified-utils.js';
export const PROBLEM_FORMAT='opticsim-problem-v1';
const own=(x,k)=>Object.hasOwn(x,k);
const angularKinds=new Set(angularCapabilities().kinds);
const mirrorKinds=new Set(mirrorAngularCapabilities().kinds);
const observableKinds=observableCapabilities().kinds;
const empty=(r,status,code,reason)=>({id:r.id,kind:r.kind,status,value:null,method:null,reasonCode:code,reason});
export function problemWorkflowCapabilities(){
  return {format:PROBLEM_FORMAT,version:1,maxRequests:16,maxCalculations:4,
    required:['format','physical','requests'],optional:['interpretation','illustration','verifyNative'],
    physical:'Existing minimal authoring request, existing reduced planar-angular facts, or null when unsupported. No new apparatus fields.',
    requestKinds:{...Object.fromEntries(angularCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:ANGLE_QUERY_FORMAT}])),
      ...Object.fromEntries(mirrorAngularCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:MIRROR_QUERY_FORMAT}])),
      ...Object.fromEntries(Object.entries(observableKinds).map(([k,v])=>[k,{...v,route:k==='ideal-image'?'existing-analysis-with-native-gate':'native-observation'}]))},
    authoring:problemCapabilities(),angular:angularCapabilities(),mirrorAngular:mirrorAngularCapabilities(),observables:observableCapabilities(),
    policy:'One request file; route by kind, never by answers or expected values. Unknown kinds remain unavailable. No physical repairs or method fallback. Angular-only requests do not trigger native work unless verifyNative is true. Interpretation remains author-provided and unverified.'};
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
    if(mirrorKinds.has(r.kind)){
      const keys=['id','kind','referenceMirrorId','outgoingRelation','angleConvention'];
      if(Object.keys(r).some(k=>!keys.includes(k)))throw Error('Unsupported plane-mirror analytical request field');
    }else if(angularKinds.has(r.kind)){
      if(++angularCount>4)throw Error('At most four angular queries per problem');
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
  const nativeRequests=request.requests.filter(r=>own(observableKinds,r.kind));
  const needsNative=nativeRequests.length>0||request.verifyNative===true;
  let preparation=null,scene=null,sceneConflict=false;
  if(physical&&physical.format!==ANGLE_FACTS_FORMAT&&physical.format!==MIRROR_FACTS_FORMAT){
    preparation=resolveProblemRequest(physical,{illustration:request.illustration===true});
    scene=preparation.prepared?.document??null;
  }
  const calculations=[],results=[];
  for(const r of request.requests){
    if(mirrorKinds.has(r.kind)){
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
  const {prepared:ignored,...prep}=preparation||{};
  return {format:'opticsim-problem-plan-v1',request,results,calculations,
    preparation:preparation?prep:null,scene,diagnostics,
    native:{required:needsNative,canRun:needsNative&&!!scene&&!invalid,
      reason:!needsNative?'No registered native result or verification requested.':!scene?'No unambiguous validated forward scene.':null},
    nativeRequests,interpretation:'author-provided-not-independently-verified',
    questionSupport:'not-assessed-by-engine'};
}
export function resultCoverage(results){
  const available=results.filter(r=>['available','qualified','conditional'].includes(r.status));
  return {requested:results.length,available:available.length,
    status:available.length===results.length?'all-requested-quantities-available':available.length?'partially-available':'none-available',
    meaning:'Coverage of authored requests only, never proof that the original question was faithfully interpreted or answered.'};
}
