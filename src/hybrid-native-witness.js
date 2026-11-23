// Hybrid Paraxial Stack <-> Native v39 Verification Bridge.
// Compiles supported coaxial-paraxial-stack arrangements combining 1–2 disjoint
// finite dielectric bodies (biconvex spherical lenses and/or coaxial planar
// slabs sharing one explicit outsideIndex), 0–2 coaxial ideal thin lenses, and
// 0–1 terminal mirror (plane or spherical: circular-arc-mirror / ideal-curved-mirror)
// paired with EXPLICIT finite apertures, partialReflection policy, witness
// emitter(s), and passive detector into a validated schema-v39 native PhyDemo
// scene (`native-general-hybrid-bench`).
//
// Traces through pinned PhyDemo with v39EndpointsVerified, gates corroboration
// on exact per-element native encounter counts across dielectrics, lenses, and
// mirrors, and compares conditional exact binary64-rational ABCD predictions
// (nativeObservation: false) against observed outgoing native ray geometry
// (nativeObservation: true), exposing real finite-aperture/spherical aberration
// without claiming native image detection.
import {
  COAXIAL_STACK_QUERY,
  analyzeCoaxialStack
} from './coaxial-paraxial-stack.js';
import {prepareScene} from './authoring.js';
import {add,divide,fromBinary64,subtract,toBinary64} from './binary64-rational.js';
import {HYBRID_BENCH_MODEL,HYBRID_BENCH_VERSION} from './native-general-hybrid-bench.js';
import {isAcceptedExecutionSummary,qualifyRunnerSummary} from './native-observations.js';
import {evaluateObservables} from './observables.js';
import {sceneHash} from './qualified-utils.js';
import {
  TWO,
  WITNESS_MIRROR_MODELS as MIRROR_MODELS,
  WITNESS_RUN_POLICIES as RUN_POLICIES,
  WITNESS_SUPPORTED_QUERIES as SUPPORTED_QUERIES,
  buildDielectricBodyComponent,
  buildRefractiveOrHybridEmitters,
  checkWitnessFields as checkFields,
  compareQualifiedWitnessHits,
  isPlainObject,
  negR,
  own,
  resolveWitnessStackInput as resolveStackInput,
  validateWitnessDetector,
  witnessFail as fail
} from './witness-common.js';

export const HYBRID_WITNESS_SPEC='opticsim-hybrid-stack-native-witness-v1';
export const HYBRID_WITNESS_PLAN='opticsim-hybrid-stack-native-witness-plan-v1';
export const HYBRID_WITNESS_REPORT='opticsim-hybrid-stack-native-witness-report-v1';

const V39_MAX_RAY_DEPTH=8;

export function hybridNativeWitnessCapabilities(){
  return {
    formats:{
      spec:HYBRID_WITNESS_SPEC,
      plan:HYBRID_WITNESS_PLAN,
      report:HYBRID_WITNESS_REPORT
    },
    targetNativeSchema:{
      schemaVersion:HYBRID_BENCH_VERSION,
      model:HYBRID_BENCH_MODEL
    },
    supportedQueries:[...SUPPORTED_QUERIES],
    supportedStackScope:{
      lengthUnit:'mm',
      outsideIndex:'Any explicit stack incidentIndex in [1, 4]; all dielectric bodies must return to this shared outsideIndex, and all thin lenses / terminal mirrors operate in this shared exterior medium.',
      elements:'1–2 disjoint finite dielectric bodies (biconvex spherical lens: R1 > 0, R2 < 0; or coaxial planar slab: R1 = R2 = "infinity"), 0–2 coaxial thin-lens elements, and 0–1 terminal-mirror (plane or spherical). Total planned native encounters including the witness detector must fit within v39 maxRayDepth = 8 (transmission: 2*bodies + lenses + 1 <= 8; return: 4*bodies + 2*lenses + 2 <= 8). Stacks exceeding maxRayDepth = 8 (such as 2 bodies + mirror, or 1 body + 2 lenses + mirror) and pure thin-lens/mirror stacks with 0 dielectric bodies (v37 scope) are refused at build time.',
      separation:'Distinct native bodies, lenses, mirrors, emitters, and detectors must satisfy v39 >= 0.01 mm clearance.'
    },
    requiredWitnessInputs:{
      query:'{format: "opticsim-coaxial-paraxial-stack-query-v1", kind: "coaxial-stack-conjugate" | "coaxial-stack-collimated-focus"}',
      bodies:'Explicit array of 1–2 body mappings [{id, frontSurfaceId, backSurfaceId, apertureHeight}] matching every refracting-surface pair in axial order.',
      aperturesById:'Explicit object mapping every thin-lens and terminal-mirror ID in the stack to its finite apertureHeight/length (mm). Required whenever the stack has any thin-lens or terminal-mirror.',
      mirrorModel:'Required ("circular-arc-mirror" | "ideal-curved-mirror") iff the stack has a spherical terminal-mirror; omitted otherwise.',
      partialReflection:'Required explicit boolean (false omits Fresnel partial reflections with explicit warning while retaining native TIR; true enables full Fresnel branching).',
      emitter:'For conjugate: {mode: "single-ray", id?, directionDeg, brightness} placed at exact real upstream (object.x, object.y ?? 0). For collimated-focus: {mode: "parallel-beam", id?, x, y, width, brightness} (directionDeg = 0) OR {mode: "single-ray", rays: [{id?, x, y, brightness}]} (1–4 distinct horizontal rays with directionDeg = 0).',
      detector:'Explicit passive witness detector {id?, x, y, orientationDeg, length}; never auto-placed at the analytical image.',
      runPolicy:'Optional "preview-v1" (default) or "dense-v1".'
    },
    guarantees:[
      'Conditional paraxial results (nativeObservation: false) and native PhyDemo hybrid results (nativeObservation: true) remain strictly separated.',
      'Native execution is gated on canonical SHA-256 match, v39EndpointsVerified === true, zero truncation/undefinedBehavior/errors, accepted measurementState, and complete bounded detector-hit-events (<= 32 hits).',
      'Aggregate corroboration requires observed per-element and per-axial-face native encounter counts matching expected stack totals (declared front/back axial faces only with zero lateral-rim hits, zero TIR, zero dielectric reflection, full transmission, matching ideal-lens v39OpticalIncidentsById, and matching terminal-mirror reflectionsById & v39OpticalIncidentsById). For multi-ray witnesses, these are aggregate encounter totals, not per-ray route attribution.',
      'Exact binary64-rational outgoing ray metrics report perpendicular miss, deltaY at predicted target x, and deltaX at predicted target y without claiming native image detection (nativeImageDetected: false).'
    ]
  };
}

function decomposeHybridStack(facts){
  if(facts.lengthUnit!=='mm')
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v39 hybrid witness requires lengthUnit "mm"; no silent unit rescaling is performed.');
  const outsideIndex=facts.incidentIndex;
  const elements=facts.elements;

  const bodies=[];
  const lenses=[];
  let terminalMirror=null;
  let currentIndex=outsideIndex;

  for(let i=0;i<elements.length;){
    const el=elements[i];
    if(el.type==='terminal-mirror'){
      if(currentIndex!==outsideIndex)
        fail('UNSUPPORTED_WITNESS_SCOPE','Terminal mirror '+el.id+' must lie in the shared exterior medium ('+outsideIndex+').');
      terminalMirror=el;
      i+=1;
    }else if(el.type==='thin-lens'){
      if(currentIndex!==outsideIndex)
        fail('UNSUPPORTED_WITNESS_SCOPE','Thin lens '+el.id+' must lie in the shared exterior medium ('+outsideIndex+'), strictly outside finite dielectric bodies.');
      lenses.push(el);
      i+=1;
    }else if(el.type==='refracting-surface'){
      if(currentIndex!==outsideIndex)
        fail('UNSUPPORTED_WITNESS_SCOPE','Refracting surface '+el.id+' must enter from the shared exterior medium ('+outsideIndex+').');
      const back=elements[i+1];
      if(!back||back.type!=='refracting-surface')
        fail('UNSUPPORTED_WITNESS_SCOPE','Refracting surface '+el.id+' must be immediately paired with an exit refracting-surface forming a closed finite dielectric body; unpaired half-spaces or immersed lenses are unsupported.');
      if(!(back.x>el.x))
        fail('UNSUPPORTED_WITNESS_SCOPE','Each finite dielectric body requires strictly positive thickness (back.x > front.x): '+el.id+' -> '+back.id+'.');
      const insideIndex=el.downstreamIndex;
      if(insideIndex===outsideIndex)
        fail('UNSUPPORTED_WITNESS_SCOPE','Finite dielectric body '+el.id+' -> '+back.id+' must have insideIndex distinct from shared outsideIndex ('+outsideIndex+').');
      if(back.downstreamIndex!==outsideIndex)
        fail('UNSUPPORTED_WITNESS_SCOPE','Back surface '+back.id+' must return to shared outsideIndex ('+outsideIndex+'); cemented multi-index doublets are unsupported in v39.');

      const r1=el.signedRadius,r2=back.signedRadius;
      if(r1==='infinity'&&r2==='infinity'){
        bodies.push({kind:'slab',front:el,back,insideIndex,outsideIndex});
      }else if(typeof r1==='number'&&r1>0&&typeof r2==='number'&&r2<0){
        const xFrontR=fromBinary64(el.x),xBackR=fromBinary64(back.x);
        const centerX=toBinary64(divide(add(xFrontR,xBackR),TWO));
        const thickness=toBinary64(subtract(xBackR,xFrontR));
        const leftCheck=centerX-thickness/2,rightCheck=centerX+thickness/2;
        if(leftCheck!==el.x||rightCheck!==back.x)
          fail('UNSUPPORTED_WITNESS_SCOPE','Spherical lens vertices ('+el.x+', '+back.x+') cannot be represented without rounding shift in v39 (centerX, centerThickness) coordinates.');
        bodies.push({
          kind:'spherical-lens',
          front:el,back,insideIndex,outsideIndex,
          centerX,
          centerThickness:thickness,
          frontRadius:r1,
          backRadius:toBinary64(negR(fromBinary64(r2)))
        });
      }else{
        fail('UNSUPPORTED_WITNESS_SCOPE','Surface pair '+el.id+' -> '+back.id+' must be either a planar slab (infinity, infinity) or a biconvex spherical lens (R1 > 0, R2 < 0); plano-convex, meniscus, and biconcave lenses are out of v39 scope.');
      }
      currentIndex=back.downstreamIndex;
      i+=2;
    }else{
      fail('UNSUPPORTED_WITNESS_SCOPE','Unsupported stack element type: '+String(el.type));
    }
  }

  if(bodies.length<1)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v39 hybrid witness requires at least 1 finite dielectric body; pure thin-lens/mirror stacks belong to the v37 witness bridge.');
  if(bodies.length>2)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v39 hybrid witness supports at most 2 finite dielectric bodies.');
  if(lenses.length>2)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v39 hybrid witness supports at most 2 coaxial ideal thin lenses.');

  const totalPlannedEncounters=(terminalMirror
    ?2*(2*bodies.length+lenses.length)+1
    :2*bodies.length+lenses.length)+1;
  if(totalPlannedEncounters>V39_MAX_RAY_DEPTH)
    fail('UNSUPPORTED_WITNESS_SCOPE','Planned hybrid stack traversal requires '+totalPlannedEncounters+' native encounters (including the witness detector), exceeding the v39 maxRayDepth = '+V39_MAX_RAY_DEPTH+' budget.');

  return {outsideIndex,bodies,lenses,terminalMirror,totalPlannedEncounters};
}

export async function buildHybridStackNativeWitness(input,spec){
  [input,spec]=structuredClone([input,spec]);
  const {facts,stackSha256,packageIntegritySha256}=await resolveStackInput(input);

  checkFields(spec,['format','query','bodies','partialReflection','emitter','detector'],
    ['aperturesById','mirrorModel','runPolicy','title'],'Hybrid stack native witness spec');
  if(spec.format!==HYBRID_WITNESS_SPEC)
    fail('UNSUPPORTED_WITNESS_SPEC','Expected '+HYBRID_WITNESS_SPEC+'.');

  checkFields(spec.query,['format','kind'],[],'Witness query','UNSUPPORTED_QUERY');
  if(spec.query.format!==COAXIAL_STACK_QUERY||!SUPPORTED_QUERIES.includes(spec.query.kind))
    fail('UNSUPPORTED_QUERY','Witness bridge supports coaxial-stack-conjugate or coaxial-stack-collimated-focus.');

  if(typeof spec.partialReflection!=='boolean')
    fail('INVALID_WITNESS_SPEC','partialReflection must be an explicit boolean (true or false).');

  const runPolicy=own(spec,'runPolicy')?spec.runPolicy:'preview-v1';
  if(typeof runPolicy!=='string'||!RUN_POLICIES.includes(runPolicy))
    fail('INVALID_WITNESS_SPEC','runPolicy must be preview-v1 or dense-v1.');

  const {bodies,lenses,terminalMirror}=decomposeHybridStack(facts);

  const hasSphericalMirror=!!terminalMirror&&terminalMirror.signedRadius!=='infinity';
  if(hasSphericalMirror){
    if(!own(spec,'mirrorModel')||!MIRROR_MODELS.includes(spec.mirrorModel))
      fail('INVALID_WITNESS_SPEC','mirrorModel ("circular-arc-mirror" or "ideal-curved-mirror") is required for a spherical terminal-mirror.');
  }else if(own(spec,'mirrorModel')){
    fail('INVALID_WITNESS_SPEC','mirrorModel applies only when the stack has a spherical terminal-mirror.');
  }

  // Validate explicit aperturesById for every thin-lens and terminal-mirror in the stack.
  const nonBodyElements=[...lenses,...(terminalMirror?[terminalMirror]:[])];
  const nonBodyIds=new Set(nonBodyElements.map(e=>e.id));
  const aperturesById=own(spec,'aperturesById')?spec.aperturesById:{};
  if(own(spec,'aperturesById')&&!isPlainObject(aperturesById))
    fail('INVALID_WITNESS_SPEC','aperturesById must be a plain object mapping every thin-lens and terminal-mirror ID to an explicit aperture (mm).');
  const extraAp=Object.keys(aperturesById).filter(id=>!nonBodyIds.has(id));
  if(extraAp.length)
    fail('INVALID_WITNESS_SPEC','aperturesById contains unknown or non-lens/mirror element IDs: '+extraAp.join(', '));
  for(const el of nonBodyElements){
    if(!own(aperturesById,el.id))
      fail('MISSING_WITNESS_APERTURE','Explicit aperture (mm) is required in aperturesById for element '+el.id+'.');
    const ap=aperturesById[el.id];
    if(typeof ap!=='number'||!Number.isFinite(ap)||ap<1||ap>10000)
      fail('INVALID_WITNESS_SPEC','aperturesById.'+el.id+' must be a finite number in [1, 10000] mm.');
  }

  // Validate explicit bodies mapping matching every refracting-surface pair in axial order.
  if(!Array.isArray(spec.bodies)||spec.bodies.length!==bodies.length)
    fail('INVALID_WITNESS_SPEC','bodies must be an array of '+bodies.length+' explicit body mapping(s) matching the stack surface pairs in axial order.');

  const usedIds=new Set(nonBodyIds);
  const opticalComponents=[];
  const elementMappings=[];

  for(let i=0;i<bodies.length;i++){
    const built=buildDielectricBodyComponent(bodies[i],spec.bodies[i],spec.partialReflection,usedIds,i,{includeCategory:true});
    opticalComponents.push(built.component);
    elementMappings.push(built.mapping);
  }

  for(const lens of lenses){
    const ap=aperturesById[lens.id];
    opticalComponents.push({
      id:lens.id,
      type:'ideal-lens',
      parameters:{x:lens.x,focalLength:lens.focalLength,apertureHeight:ap}
    });
    elementMappings.push({
      id:lens.id,
      category:'ideal-lens',
      stackType:'thin-lens',
      nativeType:'ideal-lens',
      x:lens.x,
      focalLength:lens.focalLength,
      apertureHeight:ap
    });
  }

  if(terminalMirror){
    const ap=aperturesById[terminalMirror.id];
    if(terminalMirror.signedRadius==='infinity'){
      opticalComponents.push({
        id:terminalMirror.id,
        type:'plane-mirror',
        parameters:{x:terminalMirror.x,y:0,orientationDeg:90,length:ap}
      });
      elementMappings.push({
        id:terminalMirror.id,
        category:'terminal-mirror',
        stackType:'terminal-mirror',
        nativeType:'plane-mirror',
        x:terminalMirror.x,
        length:ap
      });
    }else if(spec.mirrorModel==='circular-arc-mirror'){
      const nativeRadius=toBinary64(negR(fromBinary64(terminalMirror.signedRadius)));
      opticalComponents.push({
        id:terminalMirror.id,
        type:'circular-arc-mirror',
        parameters:{x:terminalMirror.x,y:0,normalDeg:180,radius:nativeRadius,apertureHeight:ap}
      });
      elementMappings.push({
        id:terminalMirror.id,
        category:'terminal-mirror',
        stackType:'terminal-mirror',
        nativeType:'circular-arc-mirror',
        x:terminalMirror.x,
        stackSignedRadius:terminalMirror.signedRadius,
        nativeRadius,
        apertureHeight:ap
      });
    }else{
      const focalLength=toBinary64(divide(negR(fromBinary64(terminalMirror.signedRadius)),TWO));
      opticalComponents.push({
        id:terminalMirror.id,
        type:'ideal-curved-mirror',
        parameters:{x:terminalMirror.x,y:0,normalDeg:180,focalLength,apertureHeight:ap}
      });
      elementMappings.push({
        id:terminalMirror.id,
        category:'terminal-mirror',
        stackType:'terminal-mirror',
        nativeType:'ideal-curved-mirror',
        x:terminalMirror.x,
        stackSignedRadius:terminalMirror.signedRadius,
        focalLength,
        apertureHeight:ap
      });
    }
  }

  // Run conditional paraxial analysis on the authoritative stack facts.
  const paraxialResult=analyzeCoaxialStack(facts,spec.query);

  // Validate explicit emitter(s) and map to v39 component(s).
  const {emitterComponents,emitterSummaries}=buildRefractiveOrHybridEmitters(facts,spec,usedIds,'v39 hybrid');

  // Validate explicit passive detector.
  const {detectorId,detectorComponent}=validateWitnessDetector(spec.detector,usedIds);

  const title=own(spec,'title')&&typeof spec.title==='string'&&spec.title.trim()
    ?spec.title.trim()
    :'Hybrid stack native v39 witness ('+spec.query.kind+')';

  const prepared=prepareScene({
    model:HYBRID_BENCH_MODEL,
    lengthUnit:'mm',
    title,
    runPolicy,
    components:[...emitterComponents,...opticalComponents,detectorComponent]
  });
  const doc=prepared.document;
  const nativeSceneSha256=await sceneHash(doc);

  const witnessRequests=[
    ...emitterSummaries.map((e,i)=>({id:'witness-emissions-'+(i+1),kind:'source-emissions',componentId:e.id})),
    {id:'witness-detector-crossings',kind:'detector-crossings',componentId:detectorId},
    {id:'witness-detector-hits',kind:'detector-hit-events',componentId:detectorId},
    ...elementMappings.filter(e=>e.category==='dielectric-body').map(e=>({
      id:'witness-interface-'+e.id,kind:'interface-interactions',componentId:e.id
    })),
    ...(terminalMirror?[{id:'witness-mirror-'+terminalMirror.id,kind:'mirror-reflections',componentId:terminalMirror.id}]:[])
  ];

  const exitPlaneX=terminalMirror
    ?facts.elements[0].x
    :facts.elements[facts.elements.length-1].x;

  return {
    format:HYBRID_WITNESS_PLAN,
    stackSha256,
    packageIntegritySha256,
    sceneSha256:nativeSceneSha256,
    query:structuredClone(spec.query),
    paraxialResult,
    mapping:{
      targetSchemaVersion:HYBRID_BENCH_VERSION,
      targetModel:HYBRID_BENCH_MODEL,
      runPolicy,
      partialReflection:spec.partialReflection,
      mirrorModel:hasSphericalMirror?spec.mirrorModel:null,
      exitPlaneX,
      emitters:emitterSummaries,
      detector:{id:detectorId,...spec.detector},
      elements:elementMappings
    },
    witnessRequests,
    document:doc
  };
}

function summarizeHybridEncounters(elements,propagationMode,emitted,outgoingHitCount,interfacesById,reflectionsById,opticalIncidentsById){
  const returnMode=propagationMode==='return';
  const byElementId={};
  const zeroEncounterElementIds=[];
  const lateralRimElementIds=[];
  let allMatch=Number.isSafeInteger(emitted)&&emitted>0&&outgoingHitCount===emitted;

  for(const el of elements){
    if(el.category==='dielectric-body'){
      const expectedPerRay=returnMode?4:2;
      const expectedPerAxialFacePerRay=returnMode?2:1;
      const expectedForAllEmittedRays=Number.isSafeInteger(emitted)?expectedPerRay*emitted:null;
      const expectedPerAxialFaceTotal=Number.isSafeInteger(emitted)?expectedPerAxialFacePerRay*emitted:null;
      const stats=interfacesById&&own(interfacesById,el.id)?interfacesById[el.id]:null;
      const interactions=Number.isSafeInteger(stats?.interactions)?stats.interactions:null;
      const transmitted=Number.isSafeInteger(stats?.transmitted)?stats.transmitted:null;
      const reflected=Number.isSafeInteger(stats?.reflected)?stats.reflected:null;
      const totalInternalReflections=Number.isSafeInteger(stats?.totalInternalReflections)?stats.totalInternalReflections:null;

      // Gate on the declared axial front/back optical faces (never lateral rims).
      const frontFaceId=el.nativeType==='spherical-lens'?'front-arc':'face-41';
      const backFaceId=el.nativeType==='spherical-lens'?'back-arc':'face-23';
      const rimFaceIds=el.nativeType==='spherical-lens'?['top-rim','bottom-rim']:['face-12','face-34'];
      const faces=stats?.faces??null;
      const frontFaceInteractions=Number.isSafeInteger(faces?.[frontFaceId]?.interactions)
        ?faces[frontFaceId].interactions:null;
      const backFaceInteractions=Number.isSafeInteger(faces?.[backFaceId]?.interactions)
        ?faces[backFaceId].interactions:null;
      const rimCounts=rimFaceIds.map(id=>faces?.[id]?.interactions);
      const lateralRimInteractions=rimCounts.every(Number.isSafeInteger)
        ?rimCounts.reduce((acc,n)=>acc+n,0):null;

      if(interactions===0||frontFaceInteractions===0||backFaceInteractions===0)
        zeroEncounterElementIds.push(el.id);
      if(lateralRimInteractions!==null&&lateralRimInteractions>0)
        lateralRimElementIds.push(el.id);

      const matches=expectedForAllEmittedRays!==null&&
        expectedPerAxialFaceTotal!==null&&
        interactions===expectedForAllEmittedRays&&
        transmitted===expectedForAllEmittedRays&&
        reflected===0&&
        totalInternalReflections===0&&
        frontFaceInteractions===expectedPerAxialFaceTotal&&
        backFaceInteractions===expectedPerAxialFaceTotal&&
        lateralRimInteractions===0;
      if(!matches)allMatch=false;
      byElementId[el.id]={
        category:el.category,
        nativeType:el.nativeType,
        frontFaceId,
        backFaceId,
        expectedPerRay,
        expectedForAllEmittedRays,
        expectedPerAxialFaceTotal,
        interactions,
        transmitted,
        reflected,
        totalInternalReflections,
        frontFaceInteractions,
        backFaceInteractions,
        lateralRimInteractions,
        matches
      };
    }else if(el.category==='ideal-lens'){
      const expectedPerRay=returnMode?2:1;
      const expectedForAllEmittedRays=Number.isSafeInteger(emitted)?expectedPerRay*emitted:null;
      const incidents=opticalIncidentsById&&Number.isSafeInteger(opticalIncidentsById[el.id])
        ?opticalIncidentsById[el.id]:null;
      if(incidents===0)zeroEncounterElementIds.push(el.id);
      const matches=expectedForAllEmittedRays!==null&&incidents===expectedForAllEmittedRays;
      if(!matches)allMatch=false;
      byElementId[el.id]={
        category:el.category,
        nativeType:el.nativeType,
        expectedPerRay,
        expectedForAllEmittedRays,
        incidents,
        matches
      };
    }else{
      const expectedPerRay=1;
      const expectedForAllEmittedRays=Number.isSafeInteger(emitted)?emitted:null;
      const reflections=reflectionsById&&Number.isSafeInteger(reflectionsById[el.id])
        ?reflectionsById[el.id]:null;
      const incidents=opticalIncidentsById&&Number.isSafeInteger(opticalIncidentsById[el.id])
        ?opticalIncidentsById[el.id]:null;
      if(reflections===0||incidents===0)zeroEncounterElementIds.push(el.id);
      const matches=expectedForAllEmittedRays!==null&&
        reflections===expectedForAllEmittedRays&&
        incidents===expectedForAllEmittedRays;
      if(!matches)allMatch=false;
      byElementId[el.id]={
        category:el.category,
        nativeType:el.nativeType,
        expectedPerRay,
        expectedForAllEmittedRays,
        reflections,
        incidents,
        matches
      };
    }
  }
  return {
    emitted,
    outgoingHitCount,
    propagationMode,
    byElementId,
    zeroEncounterElementIds,
    lateralRimElementIds,
    allAxialFacesAndOpticsMatched:allMatch
  };
}

function compareOutgoingHits(paraxialResult,events,exitPlaneX,elements,emitted,interfacesById,reflectionsById,opticalIncidentsById){
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

  const exitDirection=pv.exitDirection;
  const isPostExitOutgoing=ev=>exitDirection==='+x'
    ?(ev.incomingUnit.x>1e-12&&ev.pointMm.x>exitPlaneX)
    :(ev.incomingUnit.x<-1e-12&&ev.pointMm.x<exitPlaneX);
  const outgoing=events.filter(isPostExitOutgoing);
  const nonExitCount=events.length-outgoing.length;
  const stackEncounters=summarizeHybridEncounters(
    elements,pv.propagationMode,emitted,outgoing.length,interfacesById,reflectionsById,opticalIncidentsById
  );

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

  if(stackEncounters.lateralRimElementIds.length>0){
    return {
      status:'lateral-rim-encounter-route-unverified',
      routeQualification:'lateral-rim-encountered',
      reason:'Native ray(s) struck a lateral dielectric rim face ('+stackEncounters.lateralRimElementIds.join(', ')+') instead of traversing only the declared axial front/back surfaces; geometric corroboration is withheld.',
      exitDirection,
      outgoingHitCount:outgoing.length,
      nonExitDirectionHitCount:nonExitCount,
      stackEncounters,
      targetPointMm:null,
      hits:outgoing.map((ev,i)=>({index:i,pointMm:ev.pointMm,incomingUnit:ev.incomingUnit,routeVerified:false}))
    };
  }

  if(stackEncounters.zeroEncounterElementIds.length>0){
    return {
      status:'stack-optics-not-encountered',
      routeQualification:'zero-encounters-on-declared-optics',
      reason:'Declared hybrid stack element(s) or axial surface(s) recorded zero native ray encounters ('+stackEncounters.zeroEncounterElementIds.join(', ')+'); outgoing detector hits bypassed the declared stack and cannot corroborate it.',
      exitDirection,
      outgoingHitCount:outgoing.length,
      nonExitDirectionHitCount:nonExitCount,
      stackEncounters,
      targetPointMm:null,
      hits:[]
    };
  }

  if(!stackEncounters.allAxialFacesAndOpticsMatched){
    return {
      status:'partial-stack-encounters-route-unverified',
      routeQualification:'partial-or-unverified',
      reason:'Observed per-element and per-axial-face native encounter counts do not match expected stack totals (partial aperture clipping, TIR, or extra Fresnel branches); aggregate corroboration metrics are withheld.',
      exitDirection,
      outgoingHitCount:outgoing.length,
      nonExitDirectionHitCount:nonExitCount,
      stackEncounters,
      targetPointMm:null,
      hits:outgoing.map((ev,i)=>({index:i,pointMm:ev.pointMm,incomingUnit:ev.incomingUnit,routeVerified:false}))
    };
  }

  const routeQualification=emitted===1
    ?'single-ray-axial-faces-and-optics-matched'
    :'aggregate-axial-faces-and-optics-matched';

  return compareQualifiedWitnessHits(paraxialResult,outgoing,nonExitCount,stackEncounters,routeQualification);
}

export async function runHybridStackNativeWitness(input,spec,{execute}={}){
  [input,spec]=structuredClone([input,spec]);
  if(typeof execute!=='function')
    fail('MISSING_EXECUTOR','A native execution function is required.');

  const plan=await buildHybridStackNativeWitness(input,spec);
  const rawExecution=await execute(structuredClone(plan.document),structuredClone(plan.witnessRequests));
  const summary=qualifyRunnerSummary(plan.document,rawExecution?.summary);
  const observed=await evaluateObservables(plan.document,plan.witnessRequests,summary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));

  const nativeQualified=isAcceptedExecutionSummary(plan.document,plan.sceneSha256,summary);

  const emissionResults=plan.mapping.emitters.map((_,i)=>byId['witness-emissions-'+(i+1)]);
  const totalEmitted=emissionResults.every(r=>r&&(r.status==='available'||r.status==='qualified')&&Number.isSafeInteger(r.value))
    ?emissionResults.reduce((acc,r)=>acc+r.value,0)
    :null;

  let comparison;
  if(!nativeQualified){
    comparison={
      status:'native-run-not-qualified',
      reason:'Native v39 hybrid witness run did not pass complete endpoint- and tangency-verified qualification; geometric comparison is withheld.',
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
      summary?.observations?.reflectionsById??null,
      summary?.observations?.v39OpticalIncidentsById??null
    );
  }

  return {
    format:HYBRID_WITNESS_REPORT,
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
      schemaVersion:HYBRID_BENCH_VERSION,
      model:HYBRID_BENCH_MODEL,
      executionPassed:summary?.executionPassed===true,
      v39EndpointsVerified:summary?.observations?.v39EndpointsVerified===true,
      status:summary?.native?.status??'failed',
      errors:summary?.native?.errors??[],
      warnings:summary?.native?.warnings??[],
      observables:observed.results
    },
    comparison,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    interpretation:'Observed outgoing native hybrid ray lines compared against the conditional paraxial ABCD target point are geometric witness checks only (including real spherical/Snell aberration off-axis); they do not establish native image detection, continuous-aperture coverage, or source-question certification.'
  };
}
