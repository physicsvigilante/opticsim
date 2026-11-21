// Deterministic dispatch only. Physics, angular algebra, qualification and
// native result gating stay in their existing implementations.
import {analyzePrismAngleQuery,prismAngleCapabilities,PRISM_FACTS_FORMAT,PRISM_QUERY_FORMAT} from './prism-angle-queries.js';
import {analyzePrismLimit,prismLimitCapabilities,PRISM_LIMIT_FACTS,PRISM_LIMIT_QUERY} from './prism-critical-minimum.js';
import {analyzeTwoFaceQuery,twoFaceCapabilities,TWO_FACE_FACTS,TWO_FACE_QUERY} from './perpendicular-dielectric-faces.js';
import {analyzePowerQuery,powerCapabilities,POWER_FACTS,POWER_QUERY} from './coincident-optical-power.js';
import {analyzeFocus,focusCapabilities,FOCUS_FACTS,FOCUS_QUERY} from './separated-lens-focus.js';
import {analyzeSurfaceFocus,surfaceFocusCapabilities,SURFACE_FOCUS_FACTS,SURFACE_FOCUS_QUERY} from './two-surface-focus.js';
import {analyzeMirrorOscillation,mirrorOscillationCapabilities,OSCILLATION_FACTS,OSCILLATION_QUERY} from './axial-mirror-oscillation.js';
import {analyzeMirrorMagnification,mirrorMagnificationCapabilities,MIRROR_MAGNIFICATION_FACTS,MIRROR_MAGNIFICATION_QUERY} from './mirror-magnification-inverse.js';
import {analyzeMirrorOutline,mirrorOutlineCapabilities,OUTLINE_FACTS,OUTLINE_QUERY} from './mirror-image-outline.js';
import {analyzeGradedSlab,gradedSlabCapabilities,GRADED_SLAB_FACTS,GRADED_SLAB_QUERY} from './graded-slab-first-passage.js';
import {analyzeCapObserver,capObserverCapabilities,CAP_OBSERVER_FACTS,CAP_OBSERVER_QUERY} from './cap-observer-conjugate.js';
import {analyzeMirrorPlanePort,mirrorPlanePortCapabilities,PORT_FACTS,PORT_QUERY} from './mirror-plane-port.js';
import {analyzeSlabMirror,slabMirrorCapabilities,SLAB_MIRROR_FACTS,SLAB_MIRROR_QUERY} from './slab-mirror-conjugate.js';
import {analyzeOffsetFocus,offsetFocusCapabilities,OFFSET_FACTS,OFFSET_QUERY} from './offset-pair-focus.js';
import {analyzeBoundaryInterval,boundaryIntervalCapabilities,INTERVAL_FACTS,INTERVAL_QUERY} from './semicircular-boundary-intervals.js';
import {analyzeMaterialLens,materialLensCapabilities,MATERIAL_FACTS,MATERIAL_QUERY} from './material-lens-comparison.js';
import {analyzeLensTrainQuery,lensTrainCapabilities,LENS_FACTS_FORMAT,LENS_QUERY_FORMAT} from './lens-train-queries.js';
import {analyzeCurvedMirrorQuery,curvedQueryCapabilities,CURVED_FACTS_FORMAT,CURVED_QUERY_FORMAT} from './curved-mirror-queries.js';
import {assessMethodSuitability,METHOD_SUITABILITY_FORMAT} from './method-suitability.js';
import {analyzeReducedInverseQuery,reducedInverseCapabilities,INVERSE_FACTS_FORMAT,INVERSE_QUERY_FORMAT} from './reduced-inverse-queries.js';
import {problemCapabilities,resolveProblemRequest} from './problem-authoring.js';
import {analyzePlanarAngleQuery,angularCapabilities,ANGLE_QUERY_FORMAT,ANGLE_FACTS_FORMAT} from './planar-angle-queries.js';
import {analyzePlaneMirrorAngleQuery,mirrorAngularCapabilities,MIRROR_FACTS_FORMAT,MIRROR_QUERY_FORMAT} from './mirror-angle-queries.js';
import {observableCapabilities,validateObservables} from './observables.js';
import {validateInterpretation} from './qualification.js';
import {canonicalJSON,isRecord,boundedText} from './qualified-utils.js';
export const PROBLEM_FORMAT='opticsim-problem-v1';
const own=(x,k)=>Object.hasOwn(x,k);
const prismKinds=new Set(prismAngleCapabilities().kinds);
const twoFaceKinds=new Set(twoFaceCapabilities().kinds);
const reducedAngularAndPowerRoutes=new Map();
for(const [kinds,format,analyze,missing] of [
  [mirrorOscillationCapabilities().kinds,OSCILLATION_QUERY,analyzeMirrorOscillation,'Explicit normalized cosine motion and requested phases required.'],
  [mirrorMagnificationCapabilities().kinds,MIRROR_MAGNIFICATION_QUERY,analyzeMirrorMagnification,'Explicit signed focal length and signed or magnitude-only magnification required.'],
  [mirrorOutlineCapabilities().kinds,OUTLINE_QUERY,analyzeMirrorOutline,'Explicit ordered vertices or axis-based trapezoid facts required.'],
  [gradedSlabCapabilities().kinds,GRADED_SLAB_QUERY,analyzeGradedSlab,'Explicit squared-index profile, entry angle or limit and both exterior indices required.'],
  [capObserverCapabilities().kinds,CAP_OBSERVER_QUERY,analyzeCapObserver,'Explicit cap, axial object and observer location required.'],
  [mirrorPlanePortCapabilities().kinds,PORT_QUERY,analyzeMirrorPlanePort,'Explicit axial source, exit plane and concave mirror facts required.'],
  [prismLimitCapabilities().kinds,PRISM_LIMIT_QUERY,analyzePrismLimit,'Explicit common exterior, apex and grazing or material facts required.'],
  [slabMirrorCapabilities().kinds,SLAB_MIRROR_QUERY,analyzeSlabMirror,'Explicit curved mirror, object and slab facts required.'],
  [offsetFocusCapabilities().kinds,OFFSET_QUERY,analyzeOffsetFocus,'Explicit thin lens spacing and signed focal ratios required.'],
  [boundaryIntervalCapabilities().kinds,INTERVAL_QUERY,analyzeBoundaryInterval,'Explicit semicircular material, launch and geometry facts are required.'],
  [materialLensCapabilities().kinds,MATERIAL_QUERY,analyzeMaterialLens,'Explicit common shape, lens materials and exterior media are required.'],
  [surfaceFocusCapabilities().kinds,SURFACE_FOCUS_QUERY,analyzeSurfaceFocus,'Explicit two-surface geometry and material facts are required.'],
  [focusCapabilities().kinds,FOCUS_QUERY,analyzeFocus,'Explicit separated lenses, conjugate condition and angular reference are required.'],
  [prismKinds,PRISM_QUERY_FORMAT,analyzePrismAngleQuery,'Explicit prism angle, incidence, material indices or deviation facts are required.'],
  [twoFaceKinds,TWO_FACE_QUERY,analyzeTwoFaceQuery,'Explicit face and material facts are required.'],
  [powerCapabilities().kinds,POWER_QUERY,analyzePowerQuery,'Explicit optical powers and conjugate facts are required.']
])for(const kind of kinds)reducedAngularAndPowerRoutes.set(kind,{format,analyze,missing});
const lensKinds=new Set(lensTrainCapabilities().kinds);
const curvedKinds=new Set(curvedQueryCapabilities().kinds);
const inverseKinds=new Set(reducedInverseCapabilities().kinds);
const angularKinds=new Set(angularCapabilities().kinds);
const mirrorKinds=new Set(mirrorAngularCapabilities().kinds);
const observableKinds=observableCapabilities().kinds;
// References the live fact/query formats, not a second physics validator.
const factContracts=Object.freeze({
 [OSCILLATION_QUERY]:[OSCILLATION_FACTS],
 [MIRROR_MAGNIFICATION_QUERY]:[MIRROR_MAGNIFICATION_FACTS],
 [OUTLINE_QUERY]:[OUTLINE_FACTS],
 [GRADED_SLAB_QUERY]:[GRADED_SLAB_FACTS],
 [CAP_OBSERVER_QUERY]:[CAP_OBSERVER_FACTS],
 [PORT_QUERY]:[PORT_FACTS],
 [PRISM_LIMIT_QUERY]:[PRISM_LIMIT_FACTS],
 [SLAB_MIRROR_QUERY]:[SLAB_MIRROR_FACTS],
 [OFFSET_QUERY]:[OFFSET_FACTS],
 [INTERVAL_QUERY]:[INTERVAL_FACTS],
 [MATERIAL_QUERY]:[MATERIAL_FACTS],
 [PRISM_QUERY_FORMAT]:[PRISM_FACTS_FORMAT],
 [TWO_FACE_QUERY]:[TWO_FACE_FACTS],
 [POWER_QUERY]:[POWER_FACTS],
 [FOCUS_QUERY]:[FOCUS_FACTS],
 [SURFACE_FOCUS_QUERY]:[SURFACE_FOCUS_FACTS],
 [LENS_QUERY_FORMAT]:[LENS_FACTS_FORMAT],
 [CURVED_QUERY_FORMAT]:[CURVED_FACTS_FORMAT,'authoring-scene'],
 [INVERSE_QUERY_FORMAT]:[INVERSE_FACTS_FORMAT],
 [ANGLE_QUERY_FORMAT]:[ANGLE_FACTS_FORMAT,'authoring-scene'],
 [MIRROR_QUERY_FORMAT]:[MIRROR_FACTS_FORMAT]
});
const requestKindRegistry=()=>({
 ...Object.fromEntries(mirrorOscillationCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:OSCILLATION_QUERY}])),
 ...Object.fromEntries(mirrorMagnificationCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:MIRROR_MAGNIFICATION_QUERY}])),
 ...Object.fromEntries(mirrorOutlineCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:OUTLINE_QUERY}])),
 ...Object.fromEntries(gradedSlabCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:GRADED_SLAB_QUERY}])),
 ...Object.fromEntries(capObserverCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:CAP_OBSERVER_QUERY}])),
 ...Object.fromEntries(mirrorPlanePortCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:PORT_QUERY}])),
 ...Object.fromEntries(prismLimitCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:PRISM_LIMIT_QUERY}])),
 ...Object.fromEntries(slabMirrorCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:SLAB_MIRROR_QUERY}])),
 ...Object.fromEntries(offsetFocusCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:OFFSET_QUERY}])),
 ...Object.fromEntries(boundaryIntervalCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:INTERVAL_QUERY}])),
 ...Object.fromEntries(materialLensCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:MATERIAL_QUERY}])),
 ...Object.fromEntries(surfaceFocusCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:SURFACE_FOCUS_QUERY}])),
 ...Object.fromEntries(focusCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:FOCUS_QUERY}])),
 ...Object.fromEntries(powerCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:POWER_QUERY}])),
 ...Object.fromEntries([...twoFaceKinds].map(k=>[k,{route:'conditional-analytical',contract:TWO_FACE_QUERY}])),
 ...Object.fromEntries(prismAngleCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:PRISM_QUERY_FORMAT}])),
 ...Object.fromEntries(lensTrainCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:LENS_QUERY_FORMAT}])),
 ...Object.fromEntries(reducedInverseCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:INVERSE_QUERY_FORMAT}])),
 ...Object.fromEntries(curvedQueryCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:CURVED_QUERY_FORMAT}])),
 ...Object.fromEntries(angularCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:ANGLE_QUERY_FORMAT}])),
 ...Object.fromEntries(mirrorAngularCapabilities().kinds.map(k=>[k,{route:'conditional-analytical',contract:MIRROR_QUERY_FORMAT}])),
 ...Object.fromEntries(Object.entries(observableKinds).map(([k,v])=>[k,{...v,route:k==='ideal-image'?'existing-analysis-with-native-gate':'native-observation'}]))
});
const empty=(r,status,code,reason)=>({id:r.id,kind:r.kind,status,value:null,method:null,reasonCode:code,reason});
export function problemWorkflowCapabilities(){
  // Capability consumers must not be able to mutate dispatcher target types,
  // nested fact contracts, or a solver's shared list of registered kinds.
  return structuredClone({format:PROBLEM_FORMAT,version:1,maxRequests:16,maxCalculations:4,
    required:['format','physical','requests'],optional:['interpretation','illustration','verifyNative'],
    physical:'Existing minimal authoring request, reduced prism/lens-train/angular/mirror/inverse facts, or null. No invented apparatus fields.',
    requestKinds:requestKindRegistry(),
    perpendicularDielectricFaces:twoFaceCapabilities(),
    coincidentOpticalPower:powerCapabilities(),
    separatedLensFocus:focusCapabilities(),
    twoSurfaceFocus:surfaceFocusCapabilities(),
    mirrorOscillation:mirrorOscillationCapabilities(),
    mirrorMagnification:mirrorMagnificationCapabilities(),
    mirrorOutline:mirrorOutlineCapabilities(),
    gradedSlabFirstPassage:gradedSlabCapabilities(),
    capObserver:capObserverCapabilities(),
    mirrorPlanePort:mirrorPlanePortCapabilities(),
    prismAngularLimits:prismLimitCapabilities(),
    slabMirrorConjugate:slabMirrorCapabilities(),
    offsetPairFocus:offsetFocusCapabilities(),
    semicircularBoundaryIntervals:boundaryIntervalCapabilities(),
    materialLensComparison:materialLensCapabilities(),
    methodSuitability:{format:METHOD_SUITABILITY_FORMAT,mode:'exact-typed-request-diagnostic',
      contractFamilies:structuredClone(factContracts),
      limits:['No natural-language interpretation, image parsing or automatic method aliasing.',
        'Known method does not prove original question fidelity; wrong or unregistered kinds stay unrepresented.',
        'An authoring-scene fact family match is not sufficient for physical validity or native run completion.']},
    authoring:problemCapabilities(),prismAngular:prismAngleCapabilities(),lensTrain:lensTrainCapabilities(),curvedMirrors:curvedQueryCapabilities(),reducedInverse:reducedInverseCapabilities(),angular:angularCapabilities(),mirrorAngular:mirrorAngularCapabilities(),observables:observableCapabilities(),
    policy:'One request file; route by kind, never by answers or expected values. Native componentId may be omitted only when exactly one compatible authored component exists; its binding is recorded, not guessed from geometry or ray paths. Ambiguous or absent targets remain unresolved. No physical repairs or method fallback. Angular-only requests do not trigger native work unless verifyNative is true. Interpretation remains author-provided and unverified.'});
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
    if(reducedAngularAndPowerRoutes.has(r.kind)||lensKinds.has(r.kind)||curvedKinds.has(r.kind)||inverseKinds.has(r.kind)||mirrorKinds.has(r.kind)||angularKinds.has(r.kind)){if(++angularCount>4)throw Error('At most four analytical calculations per problem');}
    if(twoFaceKinds.has(r.kind)){
      if(Object.keys(r).some(k=>!['id','kind'].includes(k)))throw Error('Unsupported perpendicular-face request field');
    }else if(prismKinds.has(r.kind)){
      if(Object.keys(r).some(k=>!['id','kind'].includes(k)))throw Error('Unsupported prism-angle request field');
    }else if(reducedAngularAndPowerRoutes.has(r.kind)){
      if(Object.keys(r).some(k=>!['id','kind'].includes(k)))throw Error('Unsupported optical calculation request field');
    }else if(lensKinds.has(r.kind)){
      if(Object.keys(r).some(k=>!['id','kind'].includes(k)))throw Error('Unsupported lens-train request field');
    }else if(inverseKinds.has(r.kind)){
      if(Object.keys(r).some(k=>!['id','kind'].includes(k)))throw Error('Unsupported inverse request field');
    }else if(curvedKinds.has(r.kind)){
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
  if(physical&&!Object.values(factContracts).some(formats=>formats.includes(physical.format)&&physical.format!=='authoring-scene')){
    preparation=resolveProblemRequest(physical,{illustration:request.illustration===true});
    scene=preparation.prepared?.document??null;
  }
  const calculations=[],results=[];
  for(const r of request.requests){
    if(reducedAngularAndPowerRoutes.has(r.kind)){
      const route=reducedAngularAndPowerRoutes.get(r.kind);
      if(!physical){results.push(empty(r,'needs-information','NO_PHYSICAL_FACTS',route.missing));continue;}
      const {id,...fields}=r,query={format:route.format,...fields};
      try{
        const result=route.analyze(physical,query);
        calculations.push({id,query,result});
        results.push({id,kind:r.kind,status:result.status,value:result.value??null,method:result.method,
          reasonCode:result.reasonCode??null,reason:result.reason??null,
          ...(result.candidates?{candidates:result.candidates}:{}),...(result.branches?{branches:result.branches}:{}),
          ...(result.boundary?{boundary:result.boundary}:{}),assumptions:result.assumptions,
          limitations:result.limitations,nativeObservation:false,nativePathVerified:false});
      }catch(e){results.push(empty(r,e.code==='MISSING_FACTS'?'needs-information':
        ['UNSUPPORTED_FACTS','UNSUPPORTED_MODEL','UNSUPPORTED_SCOPE'].includes(e.code)?'unavailable':'invalid-input',e.code||'INVALID_ANALYTICAL_FACTS',e.message));}
    }else if(lensKinds.has(r.kind)){
      if(!physical){results.push(empty(r,'needs-information','NO_PHYSICAL_FACTS','Explicit object position, focal lengths and lens locations are required.'));continue;}
      const {id,...fields}=r,query={format:LENS_QUERY_FORMAT,...fields};
      try{
        const result=analyzeLensTrainQuery(physical,query);
        calculations.push({id,query,result});
        results.push({id,kind:r.kind,status:result.status,value:result.value??null,method:result.method,
          reasonCode:result.reasonCode??null,reason:result.reason??null,assumptions:result.assumptions,
          limitations:result.limitations,nativeObservation:false,nativeImageDetected:false});
      }catch(e){results.push(empty(r,e.code==='MISSING_FACTS'?'needs-information':
        ['UNSUPPORTED_FACTS','UNSUPPORTED_MODEL','UNSUPPORTED_SCOPE'].includes(e.code)?'unavailable':'invalid-input',e.code||'INVALID_LENS_FACTS',e.message));}
    }else if(inverseKinds.has(r.kind)){
      if(!physical){results.push(empty(r,'needs-information','NO_PHYSICAL_FACTS','Reduced inverse calculation requires explicitly stated physical facts.'));continue;}
      const {id,...fields}=r,query={format:INVERSE_QUERY_FORMAT,...fields};
      try{
        const result=analyzeReducedInverseQuery(physical,query);
        calculations.push({id,query,result});
        results.push({id,kind:r.kind,status:result.status,value:result.value??null,method:result.method,
          reasonCode:result.reasonCode??null,reason:result.reason??null,
          ...(result.candidates?{candidates:result.candidates}:{}),
          assumptions:result.assumptions,limitations:result.limitations,nativeObservation:false});
      }catch(e){results.push(empty(r,e.code==='MISSING_FACTS'?'needs-information':e.code==='UNSUPPORTED_MODEL'||e.code==='UNSUPPORTED_SCOPE'?'unavailable':'invalid-input',e.code||'INVALID_INVERSE_FACTS',e.message));}
    }else if(curvedKinds.has(r.kind)){
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
  const native={required:needsNative,canRun,
    reason:!needsNative?'No registered native result or verification requested.':!scene?'No unambiguous validated forward scene.':!canRun?'No uniquely determined native measurement target.':null};
  const plan={format:'opticsim-problem-plan-v1',request,results,calculations,
    preparation:preparation?prep:null,scene,diagnostics,targetBindings,
    native,nativeRequests,interpretation:'author-provided-not-independently-verified',
    questionSupport:'not-assessed-by-engine'};
  return {...plan,methodSuitability:assessMethodSuitability(plan,requestKindRegistry(),factContracts)};
}
export function resultCoverage(results){
  const available=results.filter(r=>['available','qualified','conditional'].includes(r.status));
  return {requested:results.length,available:available.length,
    status:available.length===results.length?'all-requested-quantities-available':available.length?'partially-available':'none-available',
    meaning:'Coverage of authored requests only, never proof that the original question was faithfully interpreted or answered.'};
}
