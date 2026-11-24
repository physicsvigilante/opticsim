// Unified Coaxial Paraxial Stack <-> Native v40 Optical Bench Witness Bridge.
// Compiles supported coaxial-paraxial-stack arrangements into a validated
// schema-v40 native PhyDemo scene (`native-optical-bench`, maxRayDepth = 16):
//   - 0–2 finite dielectric bodies: planar slabs, biconvex, plano-convex,
//     plano-concave, meniscus, or biconcave spherical lenses; disjoint,
//     touching layered flat contact, or coaxial cemented doublets
//   - 0–4 coaxial ideal thin lenses (in shared exterior medium)
//   - 0–1 terminal mirror: separated (plane or spherical) OR flush silvered
//     directly on the final dielectric body's flat or curved back face
//
// Traces through pinned PhyDemo with v40EndpointsVerified, gates corroboration
// on exact per-element and per-axial-face native encounter counts (accounting
// for PhyDemo surfaceMergingObjs callback ownership on touching glass and flush
// silvered mirrors), and compares conditional exact binary64-rational ABCD
// predictions (nativeObservation: false) against observed outgoing native ray
// geometry (nativeObservation: true) without claiming native image detection.
import {
  COAXIAL_STACK_QUERY,
  analyzeCoaxialStack
} from './coaxial-paraxial-stack.js';
import {prepareScene} from './authoring.js';
import {add,divide,fromBinary64,subtract,toBinary64} from './binary64-rational.js';
import {
  OPTICAL_BENCH_V40_MODEL,
  OPTICAL_BENCH_V40_VERSION,
  V40_DEFAULT_RANDOM_SEED,
  V40_MAX_RAY_DEPTH,
  isValidRandomSeed
} from './native-optical-bench.js';
import {evaluateObservables} from './observables.js';
import {sceneHash} from './qualified-utils.js';
import {
  TWO,
  WITNESS_MIRROR_MODELS as MIRROR_MODELS,
  WITNESS_STABLE_ID_RE,
  WITNESS_SUPPORTED_QUERIES as SUPPORTED_QUERIES,
  buildDielectricBodyComponent,
  buildRefractiveOrHybridEmitters,
  checkWitnessFields as checkFields,
  compareQualifiedWitnessHits,
  isPlainObject,
  negR,
  own,
  qualifyWitnessExecution,
  resolveWitnessStackInput as resolveStackInput,
  validateWitnessDetector,
  witnessFail as fail
} from './witness-common.js';

export const OPTICAL_BENCH_WITNESS_SPEC='opticsim-optical-bench-native-witness-v1';
export const OPTICAL_BENCH_WITNESS_PLAN='opticsim-optical-bench-native-witness-plan-v1';
export const OPTICAL_BENCH_WITNESS_REPORT='opticsim-optical-bench-native-witness-report-v1';

const V40_WITNESS_RUN_POLICIES=Object.freeze(['bench-v40','bench-v40-dense']);

export function opticalBenchNativeWitnessCapabilities(){
  return {
    formats:{
      spec:OPTICAL_BENCH_WITNESS_SPEC,
      plan:OPTICAL_BENCH_WITNESS_PLAN,
      report:OPTICAL_BENCH_WITNESS_REPORT
    },
    targetNativeSchema:{
      schemaVersion:OPTICAL_BENCH_V40_VERSION,
      model:OPTICAL_BENCH_V40_MODEL,
      maxRayDepth:V40_MAX_RAY_DEPTH
    },
    supportedQueries:[...SUPPORTED_QUERIES],
    supportedStackScope:{
      lengthUnit:'mm',
      outsideIndex:'Any explicit stack incidentIndex in [1, 4], mapped directly to v40 physics.backgroundIndex. All dielectric bodies share this exterior index, and all thin lenses / separated mirrors operate in this shared exterior medium.',
      elements:'0–2 finite dielectric bodies (planar slabs or signed/flat spherical lenses: biconvex, plano-convex, plano-concave, meniscus, biconcave; disjoint, touching layered flat contact, or coaxial cemented doublets), 0–4 coaxial thin-lens elements, and 0–1 terminal-mirror (separated plane/spherical OR flush flat/curved silvered on the final dielectric body). Planned native encounters per ray must fit within v40 maxRayDepth = 16.',
      touchingAndSilvered:'Touching layered slabs or coaxial cemented doublets may be authored either with a single shared interior refracting-surface [S1, S2, S3] or a zero-gap matched surface pair [S1, S2a, S2b, S3]. Flush silvered optics may be authored either directly as a terminal-mirror closing the final body [..., S_front, M] or as a zero-gap matched mirror on its back face [..., S_front, S_back, M]. Flush curved silvering requires mirrorModel "circular-arc-mirror".'
    },
    requiredWitnessInputs:{
      query:'{format: "opticsim-coaxial-paraxial-stack-query-v1", kind: "coaxial-stack-conjugate" | "coaxial-stack-collimated-focus"}',
      bodies:'Required when stack has 1–2 dielectric bodies (omitted or [] when 0 bodies): array of [{id, frontSurfaceId, backSurfaceId, apertureHeight}] matching every compiled dielectric body in axial order.',
      aperturesById:'Required whenever the stack has any thin-lens or terminal-mirror: maps each thin-lens and terminal-mirror ID to its explicit finite apertureHeight/length (mm).',
      mirrorModel:'Required iff the stack has a spherical terminal-mirror ("circular-arc-mirror" | "ideal-curved-mirror" for separated mirrors; "circular-arc-mirror" only for flush curved silvered faces); omitted otherwise.',
      partialReflection:'Required explicit boolean iff the stack has >= 1 dielectric body; omitted when 0 bodies. Shared across touching/cemented bodies so the shared interface has one unambiguous Fresnel policy.',
      emitter:'For conjugate: {mode: "single-ray", id?, directionDeg, brightness} or {mode: "directional", id?, directionDeg, angleDeg, brightness} placed at exact real upstream (object.x, object.y ?? 0). For collimated-focus: {mode: "parallel-beam", id?, x, y, width, brightness} (directionDeg = 0) OR {mode: "single-ray", rays: [{id?, x, y, brightness}]} (1–4 distinct horizontal rays with directionDeg = 0).',
      detector:'Explicit passive witness detector {id?, x, y, orientationDeg, length}; never auto-placed at the analytical image.',
      runPolicy:'Optional "bench-v40" (default) or "bench-v40-dense".',
      rayDensity:'Optional explicit rayDensity override passed to v40 prepareScene.',
      randomSeed:'Optional deterministic v40 simulation.randomSeed (defaults to "opticsim-v40-seed-v1").'
    },
    guarantees:[
      'Conditional paraxial results (nativeObservation: false) and native PhyDemo v40 results (nativeObservation: true) remain strictly separated.',
      'Native execution is gated on canonical SHA-256 match, v40EndpointsVerified === true (including grazing, near-critical, and failed-merge guards), zero truncation/undefinedBehavior/errors, accepted measurementState, and complete bounded detector-hit-events (<= 32 hits).',
      'Encounter gating accounts for exact pinned PhyDemo surfaceMergingObjs callback ownership on touching glass–glass contacts (primary body back face owns the merged hit with observed mergedWithId) and flush silvered mirrors (mirror owns the merged reflection; dielectric back face records 0 callbacks), while rejecting lateral-rim hits, TIR, extra Fresnel branches, or bypassed optics.',
      'Exact binary64-rational outgoing ray metrics report perpendicular miss, deltaY at predicted target x, and deltaX at predicted target y without claiming native image detection (nativeImageDetected: false).'
    ]
  };
}

function makeBodyRecord(front,back,insideIndex,outsideIndex,flags={}){
  if(!(back.x>front.x))
    fail('UNSUPPORTED_WITNESS_SCOPE','Each finite dielectric body requires strictly positive thickness (back.x > front.x): '+front.id+' -> '+back.id+'.');
  const r1=front.signedRadius,r2=back.signedRadius;
  if(r1==='infinity'&&r2==='infinity'){
    return {
      kind:'slab',
      front,back,insideIndex,outsideIndex,
      mergedFrontWithPrev:flags.mergedFrontWithPrev===true,
      mergedBackWithNext:flags.mergedBackWithNext===true,
      silveredBack:flags.silveredBack===true
    };
  }
  const xFrontR=fromBinary64(front.x),xBackR=fromBinary64(back.x);
  const centerX=toBinary64(divide(add(xFrontR,xBackR),TWO));
  const thickness=toBinary64(subtract(xBackR,xFrontR));
  const leftCheck=centerX-thickness/2,rightCheck=centerX+thickness/2;
  if(leftCheck!==front.x||rightCheck!==back.x)
    fail('UNSUPPORTED_WITNESS_SCOPE','Spherical lens vertices ('+front.x+', '+back.x+') cannot be represented without rounding shift in v40 (centerX, centerThickness) coordinates.');
  return {
    kind:'spherical-lens',
    front,back,insideIndex,outsideIndex,
    centerX,
    centerThickness:thickness,
    frontRadius:r1==='infinity'?null:r1,
    backRadius:r2==='infinity'?null:toBinary64(negR(fromBinary64(r2))),
    mergedFrontWithPrev:flags.mergedFrontWithPrev===true,
    mergedBackWithNext:flags.mergedBackWithNext===true,
    silveredBack:flags.silveredBack===true
  };
}

function decomposeOpticalBenchStack(facts){
  if(facts.lengthUnit!=='mm')
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v40 optical-bench witness requires lengthUnit "mm"; no silent unit rescaling is performed.');
  const outsideIndex=facts.incidentIndex;
  const elements=facts.elements;

  const bodies=[];
  const lenses=[];
  let terminalMirror=null;
  let flushMirrorBodyIndex=null;
  let currentIndex=outsideIndex;
  let lastElement=null;
  let lastWasBodyBack=false;

  for(let i=0;i<elements.length;){
    const el=elements[i];
    if(el.type==='thin-lens'){
      if(currentIndex!==outsideIndex)
        fail('UNSUPPORTED_WITNESS_SCOPE','Thin lens '+el.id+' must lie in the shared exterior medium ('+outsideIndex+'), strictly outside finite dielectric bodies.');
      if(lastElement&&el.x===lastElement.x)
        fail('UNSUPPORTED_WITNESS_SCOPE','Thin lens '+el.id+' cannot be co-located (zero gap) with '+lastElement.id+' in native v40; supply >= 0.01 mm separation.');
      lenses.push(el);
      lastElement=el;
      lastWasBodyBack=false;
      i+=1;
    }else if(el.type==='terminal-mirror'){
      if(currentIndex!==outsideIndex)
        fail('UNSUPPORTED_WITNESS_SCOPE','Terminal mirror '+el.id+' could not be paired with an open dielectric body.');
      if(lastWasBodyBack&&el.x===lastElement.x){
        if(el.signedRadius!==lastElement.signedRadius)
          fail('UNSUPPORTED_WITNESS_SCOPE','Co-located terminal-mirror '+el.id+' must match the curvature of back surface '+lastElement.id+' for flush silvering.');
        const prevIdx=bodies.length-1;
        bodies[prevIdx].silveredBack=true;
        flushMirrorBodyIndex=prevIdx;
      }else if(lastElement&&el.x===lastElement.x){
        fail('UNSUPPORTED_WITNESS_SCOPE','Terminal mirror '+el.id+' cannot be co-located (zero gap) with '+lastElement.id+' in native v40.');
      }
      terminalMirror=el;
      lastElement=el;
      lastWasBodyBack=false;
      i+=1;
    }else if(el.type==='refracting-surface'){
      if(currentIndex!==outsideIndex)
        fail('UNSUPPORTED_WITNESS_SCOPE','Refracting surface '+el.id+' must enter from the shared exterior medium ('+outsideIndex+').');
      let mergedFrontWithPrev=false;
      if(lastElement&&el.x===lastElement.x){
        if(!lastWasBodyBack)
          fail('UNSUPPORTED_WITNESS_SCOPE','Refracting surface '+el.id+' cannot be co-located (zero gap) with '+lastElement.id+' in native v40.');
        if(el.signedRadius!==lastElement.signedRadius)
          fail('UNSUPPORTED_WITNESS_SCOPE','Zero-gap touching surface '+el.id+' must match the curvature of preceding back surface '+lastElement.id+'.');
        mergedFrontWithPrev=true;
        bodies[bodies.length-1].mergedBackWithNext=true;
      }
      const next=elements[i+1];
      if(!next)
        fail('UNSUPPORTED_WITNESS_SCOPE','Refracting surface '+el.id+' is unpaired; every finite dielectric body must be closed by an exit refracting-surface or a flush silvered terminal-mirror.');
      const n1=el.downstreamIndex;
      if(next.type==='terminal-mirror'){
        // Direct silvered single body: [S1, M1]
        bodies.push(makeBodyRecord(el,next,n1,outsideIndex,{mergedFrontWithPrev,silveredBack:true}));
        terminalMirror=next;
        flushMirrorBodyIndex=bodies.length-1;
        currentIndex=outsideIndex;
        lastElement=next;
        lastWasBodyBack=false;
        i+=2;
      }else if(next.type==='refracting-surface'&&next.downstreamIndex===outsideIndex){
        // Standard closed body returning to exterior medium: [S1, S2]
        bodies.push(makeBodyRecord(el,next,n1,outsideIndex,{mergedFrontWithPrev}));
        currentIndex=outsideIndex;
        lastElement=next;
        lastWasBodyBack=true;
        i+=2;
      }else if(next.type==='refracting-surface'){
        // Touching 2-layer slab or coaxial cemented doublet: [S1, S2, S3] or [S1, S2, M1]
        const third=elements[i+2];
        if(!third)
          fail('UNSUPPORTED_WITNESS_SCOPE','Shared interior surface '+next.id+' must be closed by a third exit refracting-surface or a flush silvered terminal-mirror.');
        const n2=next.downstreamIndex;
        if(third.type==='terminal-mirror'){
          bodies.push(makeBodyRecord(el,next,n1,outsideIndex,{mergedFrontWithPrev,mergedBackWithNext:true}));
          bodies.push(makeBodyRecord(next,third,n2,outsideIndex,{mergedFrontWithPrev:true,silveredBack:true}));
          terminalMirror=third;
          flushMirrorBodyIndex=bodies.length-1;
          currentIndex=outsideIndex;
          lastElement=third;
          lastWasBodyBack=false;
          i+=3;
        }else if(third.type==='refracting-surface'&&third.downstreamIndex===outsideIndex){
          bodies.push(makeBodyRecord(el,next,n1,outsideIndex,{mergedFrontWithPrev,mergedBackWithNext:true}));
          bodies.push(makeBodyRecord(next,third,n2,outsideIndex,{mergedFrontWithPrev:true}));
          currentIndex=outsideIndex;
          lastElement=third;
          lastWasBodyBack=true;
          i+=3;
        }else{
          fail('UNSUPPORTED_WITNESS_SCOPE','Native v40 optical-bench witness supports at most 2 touching finite dielectric bodies before returning to outsideIndex ('+outsideIndex+') or a flush terminal-mirror.');
        }
      }else{
        fail('UNSUPPORTED_WITNESS_SCOPE','Refracting surface '+el.id+' must be followed by a closing refracting-surface or flush terminal-mirror, not '+next.type+'.');
      }
    }else{
      fail('UNSUPPORTED_WITNESS_SCOPE','Unsupported stack element type: '+String(el.type));
    }
  }

  if(bodies.length>2)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v40 optical-bench witness supports at most 2 finite dielectric bodies.');
  if(lenses.length>4)
    fail('UNSUPPORTED_WITNESS_SCOPE','Native v40 optical-bench witness supports at most 4 coaxial ideal thin lenses.');
  if(bodies.length===0&&lenses.length===0&&!terminalMirror)
    fail('UNSUPPORTED_WITNESS_SCOPE','Coaxial stack must contain at least one optical element.');

  const returnMode=!!terminalMirror;
  let opticalEncountersPerRay=returnMode?1:0;
  for(const b of bodies){
    if(!b.mergedFrontWithPrev)opticalEncountersPerRay+=returnMode?2:1;
    if(!b.silveredBack)opticalEncountersPerRay+=returnMode?2:1;
  }
  opticalEncountersPerRay+=(returnMode?2:1)*lenses.length;

  const minPlannedEncounters=opticalEncountersPerRay+1;
  if(minPlannedEncounters>V40_MAX_RAY_DEPTH)
    fail('UNSUPPORTED_WITNESS_SCOPE','Planned v40 stack traversal requires at least '+minPlannedEncounters+' native encounters per ray (including the witness detector), exceeding v40 maxRayDepth = '+V40_MAX_RAY_DEPTH+'.');

  return {
    outsideIndex,
    bodies,
    lenses,
    terminalMirror,
    flushMirrorBodyIndex,
    opticalEncountersPerRay,
    minPlannedEncounters
  };
}

function buildV40WitnessEmitters(facts,spec,usedIds){
  if(spec.query.kind==='coaxial-stack-conjugate'&&spec.emitter?.mode==='directional'){
    if(!own(facts,'object'))
      fail('MISSING_FACTS','coaxial-stack-conjugate witness requires object.x on the stack.');
    checkFields(spec.emitter,['mode','directionDeg','angleDeg','brightness'],['id'],'Conjugate directional emitter');
    const id=own(spec.emitter,'id')?spec.emitter.id:'S_witness';
    if(typeof id!=='string'||!WITNESS_STABLE_ID_RE.test(id)||usedIds.has(id))
      fail('INVALID_WITNESS_SPEC','Emitter requires a unique valid stable ID distinct from stack element IDs.');
    usedIds.add(id);
    const y=own(facts.object,'y')?facts.object.y:0;
    return {
      emitterComponents:[{
        id,
        type:'point-source',
        parameters:{x:facts.object.x,y,brightness:spec.emitter.brightness},
        emission:{mode:'directional',directionDeg:spec.emitter.directionDeg,angleDeg:spec.emitter.angleDeg}
      }],
      emitterSummaries:[{
        id,type:'point-source',mode:'directional',
        x:facts.object.x,y,
        directionDeg:spec.emitter.directionDeg,
        angleDeg:spec.emitter.angleDeg
      }]
    };
  }
  return buildRefractiveOrHybridEmitters(facts,spec,usedIds,'v40 optical-bench');
}

export async function buildOpticalBenchNativeWitness(input,spec){
  [input,spec]=structuredClone([input,spec]);
  const {facts,stackSha256,packageIntegritySha256}=await resolveStackInput(input);

  checkFields(spec,['format','query','emitter','detector'],
    ['bodies','aperturesById','mirrorModel','partialReflection','runPolicy','rayDensity','randomSeed','title'],
    'Optical bench native witness spec');
  if(spec.format!==OPTICAL_BENCH_WITNESS_SPEC)
    fail('UNSUPPORTED_WITNESS_SPEC','Expected '+OPTICAL_BENCH_WITNESS_SPEC+'.');

  checkFields(spec.query,['format','kind'],[],'Witness query','UNSUPPORTED_QUERY');
  if(spec.query.format!==COAXIAL_STACK_QUERY||!SUPPORTED_QUERIES.includes(spec.query.kind))
    fail('UNSUPPORTED_QUERY','Witness bridge supports coaxial-stack-conjugate or coaxial-stack-collimated-focus.');

  const runPolicy=own(spec,'runPolicy')?spec.runPolicy:'bench-v40';
  if(typeof runPolicy!=='string'||!V40_WITNESS_RUN_POLICIES.includes(runPolicy))
    fail('INVALID_WITNESS_SPEC','runPolicy must be "bench-v40" or "bench-v40-dense".');

  const randomSeed=own(spec,'randomSeed')?spec.randomSeed:V40_DEFAULT_RANDOM_SEED;
  if(!isValidRandomSeed(randomSeed))
    fail('INVALID_WITNESS_SPEC','randomSeed must be a non-empty printable string (<= 64 chars).');

  if(own(spec,'rayDensity')&&(typeof spec.rayDensity!=='number'||!Number.isFinite(spec.rayDensity)))
    fail('INVALID_WITNESS_SPEC','rayDensity must be a finite number when supplied.');

  const {
    outsideIndex,
    bodies,
    lenses,
    terminalMirror,
    flushMirrorBodyIndex,
    opticalEncountersPerRay
  }=decomposeOpticalBenchStack(facts);

  // Strict partialReflection and bodies rules (no silently ignored fields).
  let partialReflection=null;
  if(bodies.length>0){
    if(!own(spec,'partialReflection')||typeof spec.partialReflection!=='boolean')
      fail('INVALID_WITNESS_SPEC','partialReflection (explicit boolean) is required when the stack has >= 1 finite dielectric body.');
    partialReflection=spec.partialReflection;
    if(!own(spec,'bodies')||!Array.isArray(spec.bodies)||spec.bodies.length!==bodies.length)
      fail('INVALID_WITNESS_SPEC','bodies must be an array of '+bodies.length+' explicit body mapping(s) matching the stack dielectric bodies in axial order.');
  }else{
    if(own(spec,'partialReflection'))
      fail('INVALID_WITNESS_SPEC','partialReflection applies only when the stack has at least one finite dielectric body.');
    if(own(spec,'bodies')&&(!Array.isArray(spec.bodies)||spec.bodies.length!==0))
      fail('INVALID_WITNESS_SPEC','bodies must be empty or omitted when the stack has no finite dielectric bodies.');
  }

  const hasSphericalMirror=!!terminalMirror&&terminalMirror.signedRadius!=='infinity';
  const isFlushCurvedMirror=hasSphericalMirror&&flushMirrorBodyIndex!==null;
  if(hasSphericalMirror){
    if(!own(spec,'mirrorModel')||!MIRROR_MODELS.includes(spec.mirrorModel))
      fail('INVALID_WITNESS_SPEC','mirrorModel ("circular-arc-mirror" or "ideal-curved-mirror") is required for a spherical terminal-mirror.');
    if(isFlushCurvedMirror&&spec.mirrorModel!=='circular-arc-mirror')
      fail('INVALID_WITNESS_SPEC','Flush silvering on a curved dielectric face requires mirrorModel "circular-arc-mirror" (ideal-curved-mirror is a flat chord and cannot merge with a spherical glass face).');
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

  const usedIds=new Set(nonBodyIds);
  const opticalComponents=[];
  const elementMappings=[];
  const bodyIds=[];

  for(let i=0;i<bodies.length;i++){
    const built=buildDielectricBodyComponent(bodies[i],spec.bodies[i],partialReflection,usedIds,i,{includeCategory:true});
    opticalComponents.push(built.component);
    bodyIds.push(built.mapping.id);
    elementMappings.push({
      ...built.mapping,
      mergedFrontWithPrev:bodies[i].mergedFrontWithPrev,
      mergedBackWithNext:bodies[i].mergedBackWithNext,
      silveredBack:bodies[i].silveredBack,
      mergedBackWithNextId:null
    });
  }
  for(let i=0;i<bodies.length;i++){
    if(bodies[i].mergedBackWithNext&&i+1<bodyIds.length)
      elementMappings[i].mergedBackWithNextId=bodyIds[i+1];
  }

  for(const lens of lenses){
    const ap=aperturesById[lens.id];
    opticalComponents.push({
      id:lens.id,
      type:'ideal-lens',
      parameters:{x:lens.x,y:0,focalLength:lens.focalLength,apertureHeight:ap}
    });
    elementMappings.push({
      id:lens.id,
      category:'ideal-lens',
      stackType:'thin-lens',
      nativeType:'ideal-lens',
      x:lens.x,
      y:0,
      focalLength:lens.focalLength,
      apertureHeight:ap
    });
  }

  if(terminalMirror){
    const ap=aperturesById[terminalMirror.id];
    const silveredBodyId=flushMirrorBodyIndex!==null?bodyIds[flushMirrorBodyIndex]:null;
    if(flushMirrorBodyIndex!==null&&ap>elementMappings[flushMirrorBodyIndex].apertureHeight)
      fail('INVALID_WITNESS_SPEC','Flush silvered terminal-mirror '+terminalMirror.id+' aperture ('+ap+' mm) must not exceed the silvered dielectric body '+silveredBodyId+' aperture ('+elementMappings[flushMirrorBodyIndex].apertureHeight+' mm).');
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
        length:ap,
        flushSilveredBodyId:silveredBodyId
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
        apertureHeight:ap,
        flushSilveredBodyId:silveredBodyId
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
        apertureHeight:ap,
        flushSilveredBodyId:null
      });
    }
  }

  // Run conditional paraxial analysis on the authoritative stack facts.
  const paraxialResult=analyzeCoaxialStack(facts,spec.query);

  // Validate explicit emitter(s) and map to v40 component(s).
  const {emitterComponents,emitterSummaries}=buildV40WitnessEmitters(facts,spec,usedIds);

  // Validate explicit passive detector.
  const {detectorId,detectorComponent}=validateWitnessDetector(spec.detector,usedIds);

  // In return mode, a detector whose horizontal span overlaps (minEmitterX, entranceX)
  // can be crossed twice (forward +x and returning -x), consuming 2 depth slots.
  const minEmitterX=Math.min(...emitterSummaries.map(e=>e.x));
  const detHalfSpanX=Math.abs((spec.detector.length/2)*Math.cos(spec.detector.orientationDeg*Math.PI/180));
  const detMinX=spec.detector.x-detHalfSpanX,detMaxX=spec.detector.x+detHalfSpanX;
  const detectorDoubleCrossRisk=!!terminalMirror&&detMaxX>minEmitterX&&detMinX<facts.elements[0].x;
  const plannedEncountersPerRay=opticalEncountersPerRay+(detectorDoubleCrossRisk?2:1);
  if(plannedEncountersPerRay>V40_MAX_RAY_DEPTH)
    fail('UNSUPPORTED_WITNESS_SCOPE','Planned v40 return traversal with an interior detector requires '+plannedEncountersPerRay+' native encounters per ray, exceeding v40 maxRayDepth = '+V40_MAX_RAY_DEPTH+'.');

  const title=own(spec,'title')&&typeof spec.title==='string'&&spec.title.trim()
    ?spec.title.trim()
    :'Optical bench native v40 witness ('+spec.query.kind+')';

  const prepared=prepareScene({
    model:OPTICAL_BENCH_V40_MODEL,
    lengthUnit:'mm',
    backgroundIndex:outsideIndex,
    title,
    runPolicy,
    ...(own(spec,'rayDensity')?{rayDensity:spec.rayDensity}:{}),
    randomSeed,
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
    format:OPTICAL_BENCH_WITNESS_PLAN,
    stackSha256,
    packageIntegritySha256,
    sceneSha256:nativeSceneSha256,
    query:structuredClone(spec.query),
    paraxialResult,
    mapping:{
      targetSchemaVersion:OPTICAL_BENCH_V40_VERSION,
      targetModel:OPTICAL_BENCH_V40_MODEL,
      backgroundIndex:outsideIndex,
      runPolicy,
      randomSeed,
      partialReflection,
      mirrorModel:hasSphericalMirror?spec.mirrorModel:null,
      plannedEncountersPerRay,
      exitPlaneX,
      emitters:emitterSummaries,
      detector:{id:detectorId,...spec.detector},
      elements:elementMappings
    },
    witnessRequests,
    document:doc
  };
}

function summarizeOpticalBenchEncounters(elements,propagationMode,emitted,outgoingHitCount,interfacesById,reflectionsById,opticalIncidentsById){
  const returnMode=propagationMode==='return';
  const byElementId={};
  const zeroEncounterElementIds=[];
  const lateralRimElementIds=[];
  let allMatch=Number.isSafeInteger(emitted)&&emitted>0&&outgoingHitCount===emitted;

  for(const el of elements){
    if(el.category==='dielectric-body'){
      const expectedFrontPerRay=el.mergedFrontWithPrev?0:(returnMode?2:1);
      const expectedBackPerRay=el.silveredBack?0:(returnMode?2:1);
      const expectedPerRay=expectedFrontPerRay+expectedBackPerRay;
      const expectedForAllEmittedRays=Number.isSafeInteger(emitted)?expectedPerRay*emitted:null;
      const expectedFrontFaceTotal=Number.isSafeInteger(emitted)?expectedFrontPerRay*emitted:null;
      const expectedBackFaceTotal=Number.isSafeInteger(emitted)?expectedBackPerRay*emitted:null;
      const stats=interfacesById&&own(interfacesById,el.id)?interfacesById[el.id]:null;
      const interactions=Number.isSafeInteger(stats?.interactions)?stats.interactions:null;
      const transmitted=Number.isSafeInteger(stats?.transmitted)?stats.transmitted:null;
      const reflected=Number.isSafeInteger(stats?.reflected)?stats.reflected:null;
      const totalInternalReflections=Number.isSafeInteger(stats?.totalInternalReflections)?stats.totalInternalReflections:null;

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
      const observedMergedBackPartnerId=faces?.[backFaceId]?.first?.mergedWithId??null;
      const mergedBackPartnerMatches=!el.mergedBackWithNextId||
        (expectedBackFaceTotal>0&&observedMergedBackPartnerId===el.mergedBackWithNextId);

      if((expectedPerRay>0&&interactions===0)||
         (expectedFrontPerRay>0&&frontFaceInteractions===0)||
         (expectedBackPerRay>0&&backFaceInteractions===0))
        zeroEncounterElementIds.push(el.id);
      if(lateralRimInteractions!==null&&lateralRimInteractions>0)
        lateralRimElementIds.push(el.id);

      const matches=expectedForAllEmittedRays!==null&&
        expectedFrontFaceTotal!==null&&
        expectedBackFaceTotal!==null&&
        interactions===expectedForAllEmittedRays&&
        transmitted===expectedForAllEmittedRays&&
        reflected===0&&
        totalInternalReflections===0&&
        frontFaceInteractions===expectedFrontFaceTotal&&
        backFaceInteractions===expectedBackFaceTotal&&
        lateralRimInteractions===0&&
        mergedBackPartnerMatches;
      if(!matches)allMatch=false;

      byElementId[el.id]={
        category:el.category,
        nativeType:el.nativeType,
        frontFaceId,
        backFaceId,
        mergedFrontWithPrev:el.mergedFrontWithPrev,
        mergedBackWithNext:el.mergedBackWithNext,
        mergedBackWithNextId:el.mergedBackWithNextId,
        observedMergedBackPartnerId,
        silveredBack:el.silveredBack,
        expectedPerRay,
        expectedForAllEmittedRays,
        expectedFrontFaceTotal,
        expectedBackFaceTotal,
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
        flushSilveredBodyId:el.flushSilveredBodyId,
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
  const stackEncounters=summarizeOpticalBenchEncounters(
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
      reason:'Declared optical-bench stack element(s) or axial surface(s) recorded zero native ray encounters ('+stackEncounters.zeroEncounterElementIds.join(', ')+'); outgoing detector hits bypassed the declared stack and cannot corroborate it.',
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
      reason:'Observed per-element and per-axial-face native encounter counts do not match expected stack totals (partial aperture clipping, TIR, unmerged contact, or extra Fresnel branches); aggregate corroboration metrics are withheld.',
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

export async function runOpticalBenchNativeWitness(input,spec,{execute}={}){
  [input,spec]=structuredClone([input,spec]);
  if(typeof execute!=='function')
    fail('MISSING_EXECUTOR','A native execution function is required.');

  const plan=await buildOpticalBenchNativeWitness(input,spec);
  const rawExecution=await execute(structuredClone(plan.document),structuredClone(plan.witnessRequests));
  const {summary,nativeQualified,observableSummary}=qualifyWitnessExecution(
    plan.document,plan.sceneSha256,rawExecution?.summary
  );
  const observed=await evaluateObservables(plan.document,plan.witnessRequests,observableSummary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));

  const emissionResults=plan.mapping.emitters.map((_,i)=>byId['witness-emissions-'+(i+1)]);
  const totalEmitted=emissionResults.every(r=>r&&(r.status==='available'||r.status==='qualified')&&Number.isSafeInteger(r.value))
    ?emissionResults.reduce((acc,r)=>acc+r.value,0)
    :null;

  let comparison;
  if(!nativeQualified){
    comparison={
      status:'native-run-not-qualified',
      reason:'Native v40 optical-bench witness run did not pass complete endpoint-, grazing-, critical-, and merge-verified qualification; geometric comparison is withheld.',
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
      summary?.observations?.v40OpticalIncidentsById??null
    );
  }

  return {
    format:OPTICAL_BENCH_WITNESS_REPORT,
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
      schemaVersion:OPTICAL_BENCH_V40_VERSION,
      model:OPTICAL_BENCH_V40_MODEL,
      executionPassed:summary?.executionPassed===true,
      v40EndpointsVerified:summary?.observations?.v40EndpointsVerified===true,
      status:summary?.native?.status??'failed',
      errors:summary?.native?.errors??[],
      warnings:summary?.native?.warnings??[],
      observables:observed.results
    },
    comparison,
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    interpretation:'Observed outgoing native v40 ray lines compared against the conditional paraxial ABCD target point are geometric witness checks only (including real spherical/Snell aberration off-axis); they do not establish native image detection, continuous-aperture coverage, or source-question certification.'
  };
}
