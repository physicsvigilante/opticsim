// Paraxial Stack <-> Native v37 Verification Bridge.
// Compiles supported coaxial-paraxial-stack arrangements (ideal thin lenses +
// optional plane or spherical terminal mirror in homogeneous unit-index mm)
// paired with EXPLICIT finite apertures, witness emitter, and passive detector
// into a validated schema-v37 native PhyDemo scene, traces it through pinned
// PhyDemo with v37EndpointsVerified, and reports side-by-side conditional
// paraxial predictions vs. observed outgoing native ray geometry.
//
// Strictly separates conditional paraxial analysis (nativeObservation: false)
// from sampled native PhyDemo observations (nativeObservation: true). Never
// invents missing apertures/rays or claims native image detection.
import {
  COAXIAL_STACK_QUERY,
  analyzeCoaxialStack
} from './coaxial-paraxial-stack.js';
import {prepareScene} from './authoring.js';
import {divide,fromBinary64,toBinary64} from './binary64-rational.js';
import {GENERAL_BENCH_MODEL,GENERAL_BENCH_VERSION} from './native-general-optical-bench.js';
import {evaluateObservables} from './observables.js';
import {sceneHash} from './qualified-utils.js';
import {
  TWO,
  WITNESS_MIRROR_MODELS as MIRROR_MODELS,
  WITNESS_RUN_POLICIES as RUN_POLICIES,
  WITNESS_STABLE_ID_RE as STABLE_ID_RE,
  WITNESS_SUPPORTED_QUERIES as SUPPORTED_QUERIES,
  checkWitnessFields as checkFields,
  compareQualifiedWitnessHits,
  computeWitnessRayMetrics,
  isPlainObject,
  negR,
  own,
  qualifyWitnessExecution,
  resolveWitnessStackInput as resolveStackInput,
  validateWitnessDetector,
  witnessFail as fail
} from './witness-common.js';

export {computeWitnessRayMetrics};
export const COAXIAL_WITNESS_SPEC='opticsim-coaxial-stack-native-witness-v1';
export const COAXIAL_WITNESS_PLAN='opticsim-coaxial-stack-native-witness-plan-v1';
export const COAXIAL_WITNESS_REPORT='opticsim-coaxial-stack-native-witness-report-v1';

export function coaxialStackNativeWitnessCapabilities(){
  return {
    formats:{
      spec:COAXIAL_WITNESS_SPEC,
      plan:COAXIAL_WITNESS_PLAN,
      report:COAXIAL_WITNESS_REPORT
    },
    targetNativeSchema:{
      schemaVersion:GENERAL_BENCH_VERSION,
      model:GENERAL_BENCH_MODEL
    },
    supportedQueries:[...SUPPORTED_QUERIES],
    supportedStackScope:{
      lengthUnit:'mm',
      incidentIndex:1,
      elements:'1–4 thin-lens in transmission, or 0–3 thin-lens + 1 terminal-mirror (plane or spherical) in return; 4 thin-lens + terminal-mirror returns (>= 10 native encounters including the detector) exceed the v37 maxRayDepth = 8 budget and are refused at build time. Refracting-surface elements are refused because v37 is homogeneous unit-index air.',
      separation:'Distinct component planes must satisfy v37 >= 0.01 mm clearance (co-located elements with gap 0 are refused).'
    },
    requiredWitnessInputs:{
      query:'{format: "opticsim-coaxial-paraxial-stack-query-v1", kind: "coaxial-stack-conjugate" | "coaxial-stack-collimated-focus"}',
      aperturesById:'Explicit finite apertureHeight/length (mm) for EVERY element ID in the stack; no missing or unknown IDs.',
      mirrorModel:'Required ("circular-arc-mirror" | "ideal-curved-mirror") iff the stack has a spherical terminal-mirror; omitted otherwise.',
      emitter:'For conjugate: {mode: "single-ray", directionDeg, brightness} or {mode: "directional", directionDeg, angleDeg, brightness} placed at exact (object.x, object.y ?? 0). For collimated-focus: {mode: "parallel-beam", x, y, width, brightness} with horizontal directionDeg = 0.',
      detector:'Explicit passive witness detector {id?, x, y, orientationDeg, length}; never auto-placed at the analytical image.',
      runPolicy:'Optional "preview-v1" (default) or "dense-v1".'
    },
    guarantees:[
      'Conditional paraxial results (nativeObservation: false) and native PhyDemo results (nativeObservation: true) remain strictly separated.',
      'Native execution is gated on canonical SHA-256 match, v37EndpointsVerified === true, zero truncation/undefinedBehavior/errors, and complete detector-hit-events (<= 32 hits).',
      'Outgoing ray geometry checks (perpendicular miss and intercept at predicted target x) filter hits matching exitDirection (+x transmission / -x return) and never assert native image detection (nativeImageDetected: false).'
    ]
  };
}

export async function buildCoaxialStackNativeWitness(input,spec){
  [input,spec]=structuredClone([input,spec]);
  const {facts,stackSha256,packageIntegritySha256}=await resolveStackInput(input);

  checkFields(spec,['format','query','aperturesById','emitter','detector'],
    ['mirrorModel','runPolicy','title'],'Coaxial stack native witness spec');
  if(spec.format!==COAXIAL_WITNESS_SPEC)
    fail('UNSUPPORTED_WITNESS_SPEC','Expected '+COAXIAL_WITNESS_SPEC+'.');

  checkFields(spec.query,['format','kind'],[],'Witness query','UNSUPPORTED_QUERY');
  if(spec.query.format!==COAXIAL_STACK_QUERY||!SUPPORTED_QUERIES.includes(spec.query.kind))
    fail('UNSUPPORTED_QUERY','Witness bridge supports coaxial-stack-conjugate or coaxial-stack-collimated-focus.');

  const runPolicy=own(spec,'runPolicy')?spec.runPolicy:'preview-v1';
  if(typeof runPolicy!=='string'||!RUN_POLICIES.includes(runPolicy))
    fail('INVALID_WITNESS_SPEC','runPolicy must be preview-v1 or dense-v1.');

  // Enforce strict v37 homogeneous air + reflective/thin-lens scope.
  if(facts.lengthUnit!=='mm')
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v37 witness requires lengthUnit "mm"; no silent unit rescaling is performed.');
  if(facts.incidentIndex!==1)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v37 witness requires incidentIndex === 1 (homogeneous air).');
  if(facts.elements.some(e=>e.type==='refracting-surface'))
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v37 witness does not admit refracting-surface elements.');
  const lenses=facts.elements.filter(e=>e.type==='thin-lens');
  if(lenses.length>4)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v37 witness supports at most 4 ideal-lens elements.');

  const terminalMirror=facts.elements.find(e=>e.type==='terminal-mirror')||null;
  if(terminalMirror&&lenses.length>3)
    fail('UNSUPPORTED_WITNESS_SCOPE','Four thin lenses with a terminal-mirror return require at least 10 native encounters (9 optical + 1 detector), exceeding the v37 maxRayDepth = 8 budget; use 1–4 thin lenses in transmission or 0–3 thin lenses with a terminal-mirror.');
  const hasSphericalMirror=!!terminalMirror&&terminalMirror.signedRadius!=='infinity';
  if(hasSphericalMirror){
    if(!own(spec,'mirrorModel')||!MIRROR_MODELS.includes(spec.mirrorModel))
      fail('INVALID_WITNESS_SPEC','mirrorModel ("circular-arc-mirror" or "ideal-curved-mirror") is required for a spherical terminal-mirror.');
  }else if(own(spec,'mirrorModel')){
    fail('INVALID_WITNESS_SPEC','mirrorModel applies only when the stack has a spherical terminal-mirror.');
  }

  // Validate explicit aperturesById for every element ID.
  if(!isPlainObject(spec.aperturesById))
    fail('INVALID_WITNESS_SPEC','aperturesById must be a plain object mapping every element ID to an explicit aperture (mm).');
  const elemIds=new Set(facts.elements.map(e=>e.id));
  const extraAp=Object.keys(spec.aperturesById).filter(id=>!elemIds.has(id));
  if(extraAp.length)
    fail('INVALID_WITNESS_SPEC','aperturesById contains unknown element IDs: '+extraAp.join(', '));
  for(const el of facts.elements){
    if(!own(spec.aperturesById,el.id))
      fail('MISSING_WITNESS_APERTURE','Explicit aperture (mm) is required for element '+el.id+'.');
    const ap=spec.aperturesById[el.id];
    if(typeof ap!=='number'||!Number.isFinite(ap)||ap<1||ap>10000)
      fail('INVALID_WITNESS_SPEC','aperturesById.'+el.id+' must be a finite number in [1, 10000] mm.');
  }

  // Run conditional paraxial analysis on the authoritative stack facts.
  const paraxialResult=analyzeCoaxialStack(facts,spec.query);

  // Validate explicit emitter and map to v37 component.
  const usedIds=new Set(elemIds);
  const emitterId=own(spec.emitter,'id')?spec.emitter.id:'S_witness';
  if(typeof emitterId!=='string'||!STABLE_ID_RE.test(emitterId)||usedIds.has(emitterId))
    fail('INVALID_WITNESS_SPEC','Emitter requires a unique valid stable ID distinct from stack element IDs.');
  usedIds.add(emitterId);

  let emitterComponent;
  let emitterSummary;
  if(spec.query.kind==='coaxial-stack-conjugate'){
    if(!own(facts,'object'))
      fail('MISSING_FACTS','coaxial-stack-conjugate witness requires object.x on the stack.');
    const mode=spec.emitter?.mode;
    if(mode==='single-ray'){
      checkFields(spec.emitter,['mode','directionDeg','brightness'],['id'],'Conjugate single-ray emitter');
      emitterComponent={
        id:emitterId,
        type:'point-source',
        parameters:{x:facts.object.x,y:own(facts.object,'y')?facts.object.y:0,brightness:spec.emitter.brightness},
        emission:{mode:'single-ray',directionDeg:spec.emitter.directionDeg}
      };
    }else if(mode==='directional'){
      checkFields(spec.emitter,['mode','directionDeg','angleDeg','brightness'],['id'],'Conjugate directional emitter');
      emitterComponent={
        id:emitterId,
        type:'point-source',
        parameters:{x:facts.object.x,y:own(facts.object,'y')?facts.object.y:0,brightness:spec.emitter.brightness},
        emission:{mode:'directional',directionDeg:spec.emitter.directionDeg,angleDeg:spec.emitter.angleDeg}
      };
    }else{
      fail('INVALID_WITNESS_SPEC','coaxial-stack-conjugate witness emitter mode must be "single-ray" or "directional".');
    }
    emitterSummary={id:emitterId,type:'point-source',mode,x:emitterComponent.parameters.x,y:emitterComponent.parameters.y};
  }else{
    checkFields(spec.emitter,['mode','x','y','width','brightness'],['id'],'Collimated parallel-beam emitter');
    if(spec.emitter.mode!=='parallel-beam')
      fail('INVALID_WITNESS_SPEC','coaxial-stack-collimated-focus witness emitter mode must be "parallel-beam".');
    if(typeof spec.emitter.x!=='number'||!Number.isFinite(spec.emitter.x)||spec.emitter.x>=facts.elements[0].x)
      fail('INVALID_WITNESS_SPEC','Parallel-beam witness emitter x must strictly precede the first stack element.');
    emitterComponent={
      id:emitterId,
      type:'parallel-beam',
      parameters:{
        x:spec.emitter.x,
        y:spec.emitter.y,
        width:spec.emitter.width,
        directionDeg:0,
        brightness:spec.emitter.brightness
      }
    };
    emitterSummary={id:emitterId,type:'parallel-beam',mode:'parallel-beam',x:spec.emitter.x,y:spec.emitter.y,width:spec.emitter.width,directionDeg:0};
  }

  // Validate explicit passive detector.
  const {detectorId,detectorComponent}=validateWitnessDetector(spec.detector,usedIds);

  // Compile stack elements into v37 native components with explicit sign mapping.
  const opticalComponents=[];
  const elementMappings=[];
  for(const el of facts.elements){
    const aperture=spec.aperturesById[el.id];
    if(el.type==='thin-lens'){
      opticalComponents.push({
        id:el.id,
        type:'ideal-lens',
        parameters:{x:el.x,focalLength:el.focalLength,apertureHeight:aperture}
      });
      elementMappings.push({id:el.id,stackType:'thin-lens',nativeType:'ideal-lens',x:el.x,focalLength:el.focalLength,apertureHeight:aperture});
    }else if(el.type==='terminal-mirror'){
      if(el.signedRadius==='infinity'){
        opticalComponents.push({
          id:el.id,
          type:'plane-mirror',
          parameters:{x:el.x,y:0,orientationDeg:90,length:aperture}
        });
        elementMappings.push({id:el.id,stackType:'terminal-mirror',nativeType:'plane-mirror',x:el.x,length:aperture});
      }else if(spec.mirrorModel==='circular-arc-mirror'){
        // In coaxial-paraxial-stack, signedRadius < 0 is concave facing +x light.
        // In v37 circular-arc-mirror with normalDeg = 180 (facing -x toward +x light),
        // radius > 0 is concave, so native radius = -signedRadius.
        const nativeRadius=toBinary64(negR(fromBinary64(el.signedRadius)));
        opticalComponents.push({
          id:el.id,
          type:'circular-arc-mirror',
          parameters:{x:el.x,y:0,normalDeg:180,radius:nativeRadius,apertureHeight:aperture}
        });
        elementMappings.push({
          id:el.id,stackType:'terminal-mirror',nativeType:'circular-arc-mirror',
          x:el.x,stackSignedRadius:el.signedRadius,nativeRadius,normalDeg:180,apertureHeight:aperture
        });
      }else{
        // Ideal curved mirror: paraxial focal length f = -signedRadius / 2.
        const nativeFocal=toBinary64(divide(negR(fromBinary64(el.signedRadius)),TWO));
        opticalComponents.push({
          id:el.id,
          type:'ideal-curved-mirror',
          parameters:{x:el.x,y:0,normalDeg:180,focalLength:nativeFocal,apertureHeight:aperture}
        });
        elementMappings.push({
          id:el.id,stackType:'terminal-mirror',nativeType:'ideal-curved-mirror',
          x:el.x,stackSignedRadius:el.signedRadius,nativeFocalLength:nativeFocal,normalDeg:180,apertureHeight:aperture
        });
      }
    }
  }

  const title=own(spec,'title')?spec.title:'Coaxial paraxial stack native v37 witness';
  const prepared=prepareScene({
    title,
    model:GENERAL_BENCH_MODEL,
    lengthUnit:'mm',
    runPolicy,
    components:[emitterComponent,...opticalComponents,detectorComponent]
  });

  const witnessRequests=[
    {id:'witness-emissions',kind:'source-emissions',componentId:emitterId},
    ...(terminalMirror?[{id:'witness-mirror-reflections',kind:'mirror-reflections',componentId:terminalMirror.id}]:[]),
    {id:'witness-detector-crossings',kind:'detector-crossings',componentId:detectorId},
    {id:'witness-detector-power',kind:'detector-signed-power',componentId:detectorId},
    {id:'witness-detector-hits',kind:'detector-hit-events',componentId:detectorId}
  ];

  return {
    format:COAXIAL_WITNESS_PLAN,
    stackSha256,
    packageIntegritySha256,
    query:structuredClone(spec.query),
    document:prepared.document,
    sceneSha256:await sceneHash(prepared.document),
    witnessRequests,
    paraxialResult,
    mapping:{
      emitter:emitterSummary,
      detector:{id:detectorId,...detectorComponent.parameters},
      elements:elementMappings
    },
    native:{status:'not-run',observations:null},
    nativeObservation:false,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine'
  };
}

function summarizeStackEncounters(elements,propagationMode,emitted,outgoingHitCount,opticalIncidentsById){
  const byElementId={};
  const zeroEncounterElementIds=[];
  let allMatch=Number.isSafeInteger(emitted)&&emitted>0&&outgoingHitCount===emitted;
  for(const el of elements){
    const expectedPerFullStackRay=el.stackType==='thin-lens'&&propagationMode==='return'?2:1;
    const expectedForAllEmittedRays=Number.isSafeInteger(emitted)?emitted*expectedPerFullStackRay:null;
    const observedCount=opticalIncidentsById&&own(opticalIncidentsById,el.id)&&Number.isSafeInteger(opticalIncidentsById[el.id])
      ?opticalIncidentsById[el.id]:0;
    if(observedCount===0)zeroEncounterElementIds.push(el.id);
    const matchesAllEmittedRays=expectedForAllEmittedRays!==null&&observedCount===expectedForAllEmittedRays;
    if(!matchesAllEmittedRays)allMatch=false;
    byElementId[el.id]={observedCount,expectedPerFullStackRay,expectedForAllEmittedRays,matchesAllEmittedRays};
  }
  return {
    emitted:Number.isSafeInteger(emitted)?emitted:null,
    outgoingHitCount,
    byElementId,
    zeroEncounterElementIds,
    allElementsEncounteredByAllEmittedRays:allMatch
  };
}

function compareOutgoingHits(paraxialResult,events,exitPlaneX,elements,emitted,opticalIncidentsById){
  const pv=paraxialResult.value;
  if(paraxialResult.status!=='conditional'||!pv){
    return {
      status:'paraxial-not-conditional',
      routeQualification:'not-applicable',
      reason:'Paraxial prediction is '+paraxialResult.status+' ('+(paraxialResult.reasonCode||'no finite value')+').',
      exitDirection:null,
      outgoingHitCount:0,
      nonExitDirectionHitCount:events.length,
      stackEncounters:null,
      targetPointMm:null,
      hits:[]
    };
  }

  const exitDirection=pv.exitDirection; // '+x' or '-x'
  const isPostExitOutgoing=ev=>exitDirection==='+x'
    ?(ev.incomingUnit.x>1e-12&&ev.pointMm.x>exitPlaneX)
    :(ev.incomingUnit.x<-1e-12&&ev.pointMm.x<exitPlaneX);
  const outgoing=events.filter(isPostExitOutgoing);
  const nonExitCount=events.length-outgoing.length;
  const stackEncounters=summarizeStackEncounters(elements,pv.propagationMode,emitted,outgoing.length,opticalIncidentsById);

  if(outgoing.length===0){
    return {
      status:'no-outgoing-detector-hits',
      routeQualification:'no-outgoing-hits',
      reason:'No observed detector hits lay in the post-stack exit half-space travelling along exitDirection ('+exitDirection+').',
      exitDirection,
      outgoingHitCount:0,
      nonExitDirectionHitCount:nonExitCount,
      stackEncounters,
      targetPointMm:null,
      hits:[]
    };
  }

  if(stackEncounters.zeroEncounterElementIds.length>0){
    return {
      status:'stack-optics-not-encountered',
      routeQualification:'zero-encounters-on-declared-optics',
      reason:'Declared stack element(s) recorded zero native ray encounters ('+stackEncounters.zeroEncounterElementIds.join(', ')+'); outgoing detector hits bypassed the declared stack and cannot corroborate it.',
      exitDirection,
      outgoingHitCount:outgoing.length,
      nonExitDirectionHitCount:nonExitCount,
      stackEncounters,
      targetPointMm:null,
      hits:[]
    };
  }

  if(!stackEncounters.allElementsEncounteredByAllEmittedRays){
    return {
      status:'partial-stack-encounters-route-unverified',
      routeQualification:'partial-or-unverified',
      reason:'Observed per-element native encounter counts do not match full-stack traversal by all emitted rays (partial aperture clipping or bypassed rays); aggregate stack corroboration metrics are withheld.',
      exitDirection,
      outgoingHitCount:outgoing.length,
      nonExitDirectionHitCount:nonExitCount,
      stackEncounters,
      targetPointMm:null,
      hits:outgoing.map((ev,i)=>({index:i,pointMm:ev.pointMm,incomingUnit:ev.incomingUnit,routeVerified:false}))
    };
  }

  return compareQualifiedWitnessHits(
    paraxialResult,outgoing,nonExitCount,stackEncounters,'all-emitted-rays-encountered-every-element'
  );
}

export async function runCoaxialStackNativeWitness(input,spec,{execute}={}){
  [input,spec]=structuredClone([input,spec]);
  if(typeof execute!=='function')
    fail('MISSING_EXECUTOR','A native execution function is required.');

  const plan=await buildCoaxialStackNativeWitness(input,spec);
  const rawExecution=await execute(structuredClone(plan.document),structuredClone(plan.witnessRequests));
  const {summary,nativeQualified,observableSummary}=qualifyWitnessExecution(
    plan.document,plan.sceneSha256,rawExecution?.summary
  );
  const observed=await evaluateObservables(plan.document,plan.witnessRequests,observableSummary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));

  const exitEl=plan.mapping.elements.find(e=>e.id===plan.paraxialResult.value?.exitElementId);
  const exitPlaneX=exitEl?exitEl.x:0;

  let comparison;
  if(!nativeQualified){
    comparison={
      status:'native-run-not-qualified',
      reason:'Native v37 witness run did not pass complete endpoint-verified qualification; geometric comparison is withheld.',
      exitDirection:plan.paraxialResult.value?.exitDirection??null,
      outgoingHitCount:0,
      nonExitDirectionHitCount:0,
      targetPointMm:null,
      hits:[]
    };
  }else if(byId['witness-detector-hits']?.status!=='available'&&byId['witness-detector-hits']?.status!=='qualified'){
    comparison={
      status:'hit-events-withheld',
      reason:byId['witness-detector-hits']?.reason||'Bounded detector-hit-events were withheld.',
      exitDirection:plan.paraxialResult.value?.exitDirection??null,
      outgoingHitCount:0,
      nonExitDirectionHitCount:0,
      targetPointMm:null,
      hits:[]
    };
  }else{
    comparison=compareOutgoingHits(
      plan.paraxialResult,
      byId['witness-detector-hits'].value,
      exitPlaneX,
      plan.mapping.elements,
      byId['witness-emissions']?.value??null,
      summary?.observations?.v37OpticalIncidentsById??null
    );
  }

  return {
    format:COAXIAL_WITNESS_REPORT,
    stackSha256:plan.stackSha256,
    packageIntegritySha256:plan.packageIntegritySha256,
    sceneSha256:plan.sceneSha256,
    query:plan.query,
    mapping:plan.mapping,
    paraxial:{
      nativeObservation:false,
      nativeImageDetected:false,
      result:plan.paraxialResult
    },
    native:{
      nativeObservation:true,
      nativeImageDetected:false,
      schemaVersion:GENERAL_BENCH_VERSION,
      model:GENERAL_BENCH_MODEL,
      executionPassed:summary?.executionPassed===true,
      v37EndpointsVerified:summary?.observations?.v37EndpointsVerified===true,
      status:summary?.native?.status??'failed',
      errors:summary?.native?.errors??[],
      warnings:summary?.native?.warnings??[],
      observables:observed.results
    },
    comparison,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    interpretation:'Observed outgoing native ray lines passing near the conditional paraxial target point are geometric witness checks only; they do not establish native image detection, continuous-aperture coverage, or source-question certification.'
  };
}
