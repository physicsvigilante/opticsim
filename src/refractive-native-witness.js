// Refractive Paraxial Stack <-> Native v38 Verification Bridge.
// Compiles supported coaxial-paraxial-stack arrangements (1-2 disjoint finite
// dielectric bodies: biconvex spherical lenses and/or coaxial planar slabs,
// sharing one explicit ambient outsideIndex, plus optional terminal plane
// mirror, in mm) paired with EXPLICIT body apertures, partialReflection policy,
// witness emitter(s), and passive detector into a validated schema-v38 native
// PhyDemo scene (`native-general-refractive-bench`).
//
// Traces through pinned PhyDemo with v38EndpointsVerified, gates corroboration
// on exact per-element native encounter counts, and compares conditional exact
// binary64-rational ABCD predictions (nativeObservation: false) against observed
// outgoing native Snell ray geometry (nativeObservation: true), exposing real
// thick-lens / slab spherical aberration without claiming native image detection.
import {
  COAXIAL_STACK_QUERY,
  analyzeCoaxialStack
} from './coaxial-paraxial-stack.js';
import {prepareScene} from './authoring.js';
import {add,divide,fromBinary64,subtract,toBinary64} from './binary64-rational.js';
import {REFRACTIVE_BENCH_MODEL,REFRACTIVE_BENCH_VERSION} from './native-general-refractive-bench.js';
import {isAcceptedExecutionSummary,qualifyRunnerSummary} from './native-observations.js';
import {evaluateObservables} from './observables.js';
import {sceneHash} from './qualified-utils.js';
import {
  TWO,
  WITNESS_RUN_POLICIES as RUN_POLICIES,
  WITNESS_SUPPORTED_QUERIES as SUPPORTED_QUERIES,
  buildDielectricBodyComponent,
  buildRefractiveOrHybridEmitters,
  checkWitnessFields as checkFields,
  compareQualifiedWitnessHits,
  negR,
  own,
  resolveWitnessStackInput as resolveStackInput,
  validateWitnessDetector,
  witnessFail as fail
} from './witness-common.js';

export const REFRACTIVE_WITNESS_SPEC='opticsim-refractive-stack-native-witness-v1';
export const REFRACTIVE_WITNESS_PLAN='opticsim-refractive-stack-native-witness-plan-v1';
export const REFRACTIVE_WITNESS_REPORT='opticsim-refractive-stack-native-witness-report-v1';

export function refractiveNativeWitnessCapabilities(){
  return {
    formats:{
      spec:REFRACTIVE_WITNESS_SPEC,
      plan:REFRACTIVE_WITNESS_PLAN,
      report:REFRACTIVE_WITNESS_REPORT
    },
    targetNativeSchema:{
      schemaVersion:REFRACTIVE_BENCH_VERSION,
      model:REFRACTIVE_BENCH_MODEL
    },
    supportedQueries:[...SUPPORTED_QUERIES],
    supportedStackScope:{
      lengthUnit:'mm',
      outsideIndex:'Any explicit stack incidentIndex in [1, 4]; all dielectric bodies must return to this shared outsideIndex.',
      elements:'1–2 disjoint finite dielectric bodies in transmission, or 1 finite dielectric body + 1 planar terminal-mirror (signedRadius = "infinity") in return, formed by consecutive refracting-surface pairs (biconvex spherical lens: R1 > 0, R2 < 0; or coaxial planar slab: R1 = R2 = "infinity"). Two-body terminal-mirror returns (>= 9 optical encounters) exceed the v38 maxRayDepth = 8 budget and are refused at build time, as are thin lenses, curved mirrors, meniscus/plano-convex/biconcave surfaces, cemented multi-index doublets, and unpaired half-spaces.',
      separation:'Distinct native bodies, mirrors, emitters, and detectors must satisfy v38 >= 0.01 mm clearance.'
    },
    requiredWitnessInputs:{
      query:'{format: "opticsim-coaxial-paraxial-stack-query-v1", kind: "coaxial-stack-conjugate" | "coaxial-stack-collimated-focus"}',
      bodies:'Explicit array of 1–2 body mappings [{id, frontSurfaceId, backSurfaceId, apertureHeight}] matching every refracting-surface pair in axial order.',
      mirrorLength:'Required explicit finite plane-mirror length (mm) iff the stack includes a planar terminal-mirror; omitted otherwise.',
      partialReflection:'Required explicit boolean (false omits Fresnel partial reflections with explicit warning while retaining native TIR; true enables full Fresnel branching).',
      emitter:'For conjugate: {mode: "single-ray", id?, directionDeg, brightness} placed at exact real upstream (object.x, object.y ?? 0). For collimated-focus: {mode: "parallel-beam", id?, x, y, width, brightness} (directionDeg = 0) OR {mode: "single-ray", rays: [{id?, x, y, brightness}]} (1–4 distinct horizontal rays with directionDeg = 0).',
      detector:'Explicit passive witness detector {id?, x, y, orientationDeg, length}; never auto-placed at the analytical image.',
      runPolicy:'Optional "preview-v1" (default) or "dense-v1".'
    },
    guarantees:[
      'Conditional paraxial results (nativeObservation: false) and native PhyDemo Snell results (nativeObservation: true) remain strictly separated.',
      'Native execution is gated on canonical SHA-256 match, v38EndpointsVerified === true, zero truncation/undefinedBehavior/errors, and complete bounded detector-hit-events (<= 32 hits).',
      'Aggregate corroboration requires observed per-element native encounter counts matching full-stack traversal by every emitted ray (2 per body in transmission, 4 per body + 1 mirror reflection in return), preventing bypassed or TIR-trapped rays from falsely corroborating the stack.',
      'Exact binary64-rational outgoing ray metrics report perpendicular miss, deltaY at predicted target x, and deltaX at predicted target y (exposing longitudinal and transverse spherical aberration) without claiming native image detection (nativeImageDetected: false).'
    ]
  };
}

function decomposeRefractiveStack(facts){
  if(facts.lengthUnit!=='mm')
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v38 refractive witness requires lengthUnit "mm"; no silent unit rescaling is performed.');
  const outsideIndex=facts.incidentIndex;
  const elements=facts.elements;

  let terminalMirror=null;
  let opticalElements=elements;
  const last=elements[elements.length-1];
  if(last.type==='terminal-mirror'){
    if(last.signedRadius!=='infinity')
      fail('UNSUPPORTED_WITNESS_SCOPE','Native v38 refractive witness supports planar terminal-mirror (signedRadius "infinity") only; curved mirrors are out of v38 scope.');
    terminalMirror=last;
    opticalElements=elements.slice(0,-1);
  }
  if(opticalElements.some(e=>e.type!=='refracting-surface'))
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v38 refractive witness admits only refracting-surface pairs plus an optional planar terminal-mirror; thin-lens elements belong to the v37 witness bridge.');
  if(opticalElements.length<2||opticalElements.length%2!==0)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v38 refractive witness requires 1–2 complete finite dielectric surface pairs (2 or 4 refracting-surface elements); unpaired half-spaces are unsupported.');
  const pairCount=opticalElements.length/2;
  if(pairCount>2)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v38 refractive witness supports at most 2 finite dielectric bodies.');
  if(pairCount===2&&terminalMirror)
    fail('UNSUPPORTED_WITNESS_SCOPE','Two finite dielectric bodies with a terminal-mirror return require at least 9 native optical encounters, exceeding the v38 maxRayDepth = 8 budget; use 1–2 bodies in transmission or 1 body with a planar terminal-mirror.');

  const pairs=[];
  for(let i=0;i<opticalElements.length;i+=2){
    const front=opticalElements[i],back=opticalElements[i+1];
    if(!(back.x>front.x))
      fail('UNSUPPORTED_WITNESS_SCOPE','Each finite dielectric body requires strictly positive thickness (back.x > front.x): '+front.id+' -> '+back.id+'.');
    const insideIndex=front.downstreamIndex;
    if(insideIndex===outsideIndex)
      fail('UNSUPPORTED_WITNESS_SCOPE','Finite dielectric body '+front.id+' -> '+back.id+' must have insideIndex distinct from shared outsideIndex ('+outsideIndex+').');
    if(back.downstreamIndex!==outsideIndex)
      fail('UNSUPPORTED_WITNESS_SCOPE','Back surface '+back.id+' must return to shared outsideIndex ('+outsideIndex+'); cemented multi-index doublets are unsupported in v38.');

    const r1=front.signedRadius,r2=back.signedRadius;
    if(r1==='infinity'&&r2==='infinity'){
      pairs.push({kind:'slab',front,back,insideIndex,outsideIndex});
    }else if(typeof r1==='number'&&r1>0&&typeof r2==='number'&&r2<0){
      const xFrontR=fromBinary64(front.x),xBackR=fromBinary64(back.x);
      const centerX=toBinary64(divide(add(xFrontR,xBackR),TWO));
      const thickness=toBinary64(subtract(xBackR,xFrontR));
      const leftCheck=centerX-thickness/2,rightCheck=centerX+thickness/2;
      if(leftCheck!==front.x||rightCheck!==back.x)
        fail('UNSUPPORTED_WITNESS_SCOPE','Spherical lens vertices ('+front.x+', '+back.x+') cannot be represented without rounding shift in v38 (centerX, centerThickness) coordinates.');
      pairs.push({
        kind:'spherical-lens',
        front,back,insideIndex,outsideIndex,
        centerX,
        centerThickness:thickness,
        frontRadius:r1,
        backRadius:toBinary64(negR(fromBinary64(r2)))
      });
    }else{
      fail('UNSUPPORTED_WITNESS_SCOPE','Surface pair '+front.id+' -> '+back.id+' must be either a planar slab (infinity, infinity) or a biconvex spherical lens (R1 > 0, R2 < 0); plano-convex, meniscus, and biconcave lenses are out of v38 scope.');
    }
  }
  return {outsideIndex,pairs,terminalMirror};
}

export async function buildRefractiveStackNativeWitness(input,spec){
  [input,spec]=structuredClone([input,spec]);
  const {facts,stackSha256,packageIntegritySha256}=await resolveStackInput(input);

  checkFields(spec,['format','query','bodies','partialReflection','emitter','detector'],
    ['mirrorLength','runPolicy','title'],'Refractive stack native witness spec');
  if(spec.format!==REFRACTIVE_WITNESS_SPEC)
    fail('UNSUPPORTED_WITNESS_SPEC','Expected '+REFRACTIVE_WITNESS_SPEC+'.');

  checkFields(spec.query,['format','kind'],[],'Witness query','UNSUPPORTED_QUERY');
  if(spec.query.format!==COAXIAL_STACK_QUERY||!SUPPORTED_QUERIES.includes(spec.query.kind))
    fail('UNSUPPORTED_QUERY','Witness bridge supports coaxial-stack-conjugate or coaxial-stack-collimated-focus.');

  if(typeof spec.partialReflection!=='boolean')
    fail('INVALID_WITNESS_SPEC','partialReflection must be an explicit boolean (true or false).');

  const runPolicy=own(spec,'runPolicy')?spec.runPolicy:'preview-v1';
  if(typeof runPolicy!=='string'||!RUN_POLICIES.includes(runPolicy))
    fail('INVALID_WITNESS_SPEC','runPolicy must be preview-v1 or dense-v1.');

  const {pairs,terminalMirror}=decomposeRefractiveStack(facts);

  if(terminalMirror){
    if(!own(spec,'mirrorLength')||typeof spec.mirrorLength!=='number'||!Number.isFinite(spec.mirrorLength)||spec.mirrorLength<1||spec.mirrorLength>10000)
      fail('INVALID_WITNESS_SPEC','mirrorLength (finite number in [1, 10000] mm) is required when the stack has a planar terminal-mirror.');
  }else if(own(spec,'mirrorLength')){
    fail('INVALID_WITNESS_SPEC','mirrorLength applies only when the stack has a planar terminal-mirror.');
  }

  if(!Array.isArray(spec.bodies)||spec.bodies.length!==pairs.length)
    fail('INVALID_WITNESS_SPEC','bodies must be an array of '+pairs.length+' explicit body mapping(s) matching the stack surface pairs in axial order.');

  const usedIds=new Set();
  if(terminalMirror)usedIds.add(terminalMirror.id);

  const opticalComponents=[];
  const elementMappings=[];
  for(let i=0;i<pairs.length;i++){
    const built=buildDielectricBodyComponent(pairs[i],spec.bodies[i],spec.partialReflection,usedIds,i);
    opticalComponents.push(built.component);
    elementMappings.push(built.mapping);
  }

  if(terminalMirror){
    opticalComponents.push({
      id:terminalMirror.id,
      type:'plane-mirror',
      parameters:{x:terminalMirror.x,y:0,orientationDeg:90,length:spec.mirrorLength}
    });
    elementMappings.push({
      id:terminalMirror.id,
      stackSurfaceIds:[terminalMirror.id],
      nativeType:'plane-mirror',
      x:terminalMirror.x,
      length:spec.mirrorLength
    });
  }

  // Run conditional paraxial analysis on the authoritative stack facts.
  const paraxialResult=analyzeCoaxialStack(facts,spec.query);

  // Validate explicit witness emitter(s).
  const {emitterComponents,emitterSummaries}=buildRefractiveOrHybridEmitters(facts,spec,usedIds,'v38');

  // Validate explicit passive detector.
  const {detectorId,detectorComponent}=validateWitnessDetector(spec.detector,usedIds);

  const title=own(spec,'title')?spec.title:'Refractive paraxial stack native v38 witness';
  const prepared=prepareScene({
    title,
    model:REFRACTIVE_BENCH_MODEL,
    lengthUnit:'mm',
    runPolicy,
    components:[...emitterComponents,...opticalComponents,detectorComponent]
  });

  const witnessRequests=[
    ...emitterComponents.map((e,i)=>({id:'witness-emissions-'+(i+1),kind:'source-emissions',componentId:e.id})),
    ...elementMappings.filter(m=>m.nativeType!=='plane-mirror').map(m=>({id:'witness-interface-'+m.id,kind:'interface-interactions',componentId:m.id})),
    ...(terminalMirror?[{id:'witness-mirror-reflections',kind:'mirror-reflections',componentId:terminalMirror.id}]:[]),
    {id:'witness-detector-crossings',kind:'detector-crossings',componentId:detectorId},
    {id:'witness-detector-power',kind:'detector-signed-power',componentId:detectorId},
    {id:'witness-detector-hits',kind:'detector-hit-events',componentId:detectorId}
  ];

  const exitPlaneX=terminalMirror?pairs[0].front.x:pairs[pairs.length-1].back.x;

  return {
    format:REFRACTIVE_WITNESS_PLAN,
    stackSha256,
    packageIntegritySha256,
    query:structuredClone(spec.query),
    document:prepared.document,
    sceneSha256:await sceneHash(prepared.document),
    witnessRequests,
    paraxialResult,
    mapping:{
      emitters:emitterSummaries,
      detector:{id:detectorId,...detectorComponent.parameters},
      elements:elementMappings,
      exitPlaneX,
      partialReflection:spec.partialReflection
    },
    native:{status:'not-run',observations:null},
    nativeObservation:false,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine'
  };
}

function summarizeRefractiveEncounters(elements,propagationMode,emitted,outgoingHitCount,interfacesById,reflectionsById){
  const byElementId={};
  const zeroEncounterElementIds=[];
  let allMatch=Number.isSafeInteger(emitted)&&emitted>0&&outgoingHitCount===emitted;
  for(const el of elements){
    const isMirror=el.nativeType==='plane-mirror';
    const expectedPerFullStackRay=isMirror?1:(propagationMode==='return'?4:2);
    const expectedForAllEmittedRays=Number.isSafeInteger(emitted)?emitted*expectedPerFullStackRay:null;
    if(isMirror){
      const observedCount=reflectionsById&&own(reflectionsById,el.id)&&Number.isSafeInteger(reflectionsById[el.id])?reflectionsById[el.id]:0;
      if(observedCount===0)zeroEncounterElementIds.push(el.id);
      const matchesAllEmittedRays=expectedForAllEmittedRays!==null&&observedCount===expectedForAllEmittedRays;
      if(!matchesAllEmittedRays)allMatch=false;
      byElementId[el.id]={nativeType:el.nativeType,observedCount,expectedPerFullStackRay,expectedForAllEmittedRays,matchesAllEmittedRays};
    }else{
      const iface=interfacesById&&own(interfacesById,el.id)?interfacesById[el.id]:null;
      const observedCount=iface&&Number.isSafeInteger(iface.interactions)?iface.interactions:0;
      const transmitted=iface&&Number.isSafeInteger(iface.transmitted)?iface.transmitted:0;
      const reflected=iface&&Number.isSafeInteger(iface.reflected)?iface.reflected:0;
      const totalInternalReflections=iface&&Number.isSafeInteger(iface.totalInternalReflections)?iface.totalInternalReflections:0;
      if(observedCount===0)zeroEncounterElementIds.push(el.id);
      const [frontFaceId,backFaceId,rimFaceA,rimFaceB]=el.nativeType==='spherical-lens'
        ?['front-arc','back-arc','top-rim','bottom-rim']
        :['face-41','face-23','face-12','face-34'];
      const faceCount=fid=>iface?.faces&&own(iface.faces,fid)&&Number.isSafeInteger(iface.faces[fid]?.interactions)?iface.faces[fid].interactions:0;
      const frontInteractions=faceCount(frontFaceId);
      const backInteractions=faceCount(backFaceId);
      const rimInteractions=faceCount(rimFaceA)+faceCount(rimFaceB);
      const expectedPerOpticalFace=Number.isSafeInteger(emitted)?emitted*(propagationMode==='return'?2:1):null;
      const matchesAllEmittedRays=expectedForAllEmittedRays!==null&&
        observedCount===expectedForAllEmittedRays&&
        transmitted===expectedForAllEmittedRays&&
        reflected===0&&
        totalInternalReflections===0&&
        frontInteractions===expectedPerOpticalFace&&
        backInteractions===expectedPerOpticalFace&&
        rimInteractions===0;
      if(!matchesAllEmittedRays)allMatch=false;
      byElementId[el.id]={
        nativeType:el.nativeType,
        observedCount,
        transmitted,
        reflected,
        totalInternalReflections,
        expectedPerFullStackRay,
        expectedForAllEmittedRays,
        frontFaceId,frontInteractions,
        backFaceId,backInteractions,
        rimInteractions,
        matchesAllEmittedRays
      };
    }
  }
  return {
    emitted:Number.isSafeInteger(emitted)?emitted:null,
    outgoingHitCount,
    byElementId,
    zeroEncounterElementIds,
    allElementsEncounteredByAllEmittedRays:allMatch
  };
}

function compareOutgoingHits(paraxialResult,events,exitPlaneX,elements,emitted,interfacesById,reflectionsById){
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
  const stackEncounters=summarizeRefractiveEncounters(elements,pv.propagationMode,emitted,outgoing.length,interfacesById,reflectionsById);

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
      reason:'Declared refractive stack element(s) recorded zero native ray encounters ('+stackEncounters.zeroEncounterElementIds.join(', ')+'); outgoing detector hits bypassed the declared stack and cannot corroborate it.',
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
      reason:'Observed per-element native encounter counts do not match full-stack traversal by all emitted rays (partial aperture clipping, TIR, or extra Fresnel branches); aggregate corroboration metrics are withheld.',
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

export async function runRefractiveStackNativeWitness(input,spec,{execute}={}){
  [input,spec]=structuredClone([input,spec]);
  if(typeof execute!=='function')
    fail('MISSING_EXECUTOR','A native execution function is required.');

  const plan=await buildRefractiveStackNativeWitness(input,spec);
  const rawExecution=await execute(structuredClone(plan.document),structuredClone(plan.witnessRequests));
  const summary=qualifyRunnerSummary(plan.document,rawExecution?.summary);
  const observed=await evaluateObservables(plan.document,plan.witnessRequests,summary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));

  const nativeQualified=isAcceptedExecutionSummary(plan.document,plan.sceneSha256,summary);

  // Sum exact emitted counts across all authored witness emitters.
  const emissionResults=plan.mapping.emitters.map((_,i)=>byId['witness-emissions-'+(i+1)]);
  const totalEmitted=emissionResults.every(r=>r&&(r.status==='available'||r.status==='qualified')&&Number.isSafeInteger(r.value))
    ?emissionResults.reduce((acc,r)=>acc+r.value,0)
    :null;

  let comparison;
  if(!nativeQualified){
    comparison={
      status:'native-run-not-qualified',
      reason:'Native v38 refractive witness run did not pass complete endpoint- and tangency-verified qualification; geometric comparison is withheld.',
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
      plan.mapping.exitPlaneX,
      plan.mapping.elements,
      totalEmitted,
      summary?.observations?.interfacesById??null,
      summary?.observations?.reflectionsById??null
    );
  }

  return {
    format:REFRACTIVE_WITNESS_REPORT,
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
      schemaVersion:REFRACTIVE_BENCH_VERSION,
      model:REFRACTIVE_BENCH_MODEL,
      executionPassed:summary?.executionPassed===true,
      v38EndpointsVerified:summary?.observations?.v38EndpointsVerified===true,
      status:summary?.native?.status??'failed',
      errors:summary?.native?.errors??[],
      warnings:summary?.native?.warnings??[],
      observables:observed.results
    },
    comparison,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    interpretation:'Observed outgoing native Snell ray lines compared against the conditional paraxial ABCD target point are geometric witness checks only (including spherical aberration off-axis); they do not establish native image detection, continuous-aperture coverage, or source-question certification.'
  };
}
