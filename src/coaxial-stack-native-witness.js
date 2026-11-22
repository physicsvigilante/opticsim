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
  COAXIAL_STACK_FACTS,
  COAXIAL_STACK_QUERY,
  analyzeCoaxialStack,
  validateCoaxialStackFacts
} from './coaxial-paraxial-stack.js';
import {
  COAXIAL_STACK_PACKAGE,
  coaxialStackHash,
  verifyCoaxialStackPackage
} from './coaxial-stack-exploration.js';
import {prepareScene} from './authoring.js';
import {absolute,add,divide,fromBinary64,multiply,subtract,toBinary64} from './binary64-rational.js';
import {GENERAL_BENCH_MODEL,GENERAL_BENCH_VERSION} from './native-general-optical-bench.js';
import {qualifyRunnerSummary} from './native-observations.js';
import {evaluateObservables} from './observables.js';
import {isRecord,sceneHash} from './qualified-utils.js';

export const COAXIAL_WITNESS_SPEC='opticsim-coaxial-stack-native-witness-v1';
export const COAXIAL_WITNESS_PLAN='opticsim-coaxial-stack-native-witness-plan-v1';
export const COAXIAL_WITNESS_REPORT='opticsim-coaxial-stack-native-witness-report-v1';

const SUPPORTED_QUERIES=Object.freeze(['coaxial-stack-conjugate','coaxial-stack-collimated-focus']);
const MIRROR_MODELS=Object.freeze(['circular-arc-mirror','ideal-curved-mirror']);
const RUN_POLICIES=Object.freeze(['preview-v1','dense-v1']);
const STABLE_ID_RE=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

const own=(o,k)=>Object.hasOwn(o,k);
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const isPlainObject=v=>isRecord(v)&&Object.getPrototypeOf(v)===Object.prototype;
const absR=q=>({n:absolute(q.n),d:q.d});
const negR=q=>({n:-q.n,d:q.d});
const TWO=fromBinary64(2);

function checkFields(value,required,optional,label,code='INVALID_WITNESS_SPEC'){
  if(!isPlainObject(value))fail(code,label+' must be a plain object.');
  const allowed=[...required,...optional];
  const extra=Object.keys(value).filter(k=>!allowed.includes(k));
  if(extra.length)fail(code,label+' has unsupported fields: '+extra.join(', '));
  const missing=required.filter(k=>!own(value,k));
  if(missing.length)fail(code,label+' requires '+missing.join(', ')+'.');
}

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
      elements:'1–4 thin-lens and/or 1 optional terminal-mirror (plane or spherical); refracting-surface elements are refused because v37 is homogeneous unit-index air.',
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

async function resolveStackInput(input){
  if(!isPlainObject(input)||typeof input.format!=='string')
    fail('UNSUPPORTED_INPUT','Supply either '+COAXIAL_STACK_FACTS+' or '+COAXIAL_STACK_PACKAGE+'.');
  if(input.format===COAXIAL_STACK_PACKAGE){
    const pkg=await verifyCoaxialStackPackage(input);
    return {facts:structuredClone(pkg.currentFacts),stackSha256:pkg.currentSha256,packageIntegritySha256:pkg.integritySha256};
  }
  if(input.format===COAXIAL_STACK_FACTS){
    const facts=structuredClone(input);
    validateCoaxialStackFacts(facts);
    return {facts,stackSha256:await coaxialStackHash(facts),packageIntegritySha256:null};
  }
  fail('UNSUPPORTED_INPUT','Unsupported stack input format: '+input.format);
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
  checkFields(spec.detector,['x','y','orientationDeg','length'],['id'],'Witness detector');
  const detectorId=own(spec.detector,'id')?spec.detector.id:'D_witness';
  if(typeof detectorId!=='string'||!STABLE_ID_RE.test(detectorId)||usedIds.has(detectorId))
    fail('INVALID_WITNESS_SPEC','Detector requires a unique valid stable ID distinct from stack and emitter IDs.');
  usedIds.add(detectorId);
  const detectorComponent={
    id:detectorId,
    type:'ray-detector',
    parameters:{
      x:spec.detector.x,
      y:spec.detector.y,
      orientationDeg:spec.detector.orientationDeg,
      length:spec.detector.length
    }
  };

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

// Exact binary64-rational ray-line geometry on represented binary64 inputs,
// eliminating product-difference cancellation up to the 1e9 mm target ceiling.
export function computeWitnessRayMetrics(pointMm,incomingUnit,targetPointMm){
  const xh=fromBinary64(pointMm.x),yh=fromBinary64(pointMm.y);
  const ux=fromBinary64(incomingUnit.x),uy=fromBinary64(incomingUnit.y);
  const tx=fromBinary64(targetPointMm.x),ty=fromBinary64(targetPointMm.y);
  const dx=subtract(tx,xh),dy=subtract(ty,yh);
  const perpMiss=toBinary64(absR(subtract(multiply(dx,uy),multiply(dy,ux))));
  const yAtTargetXR=add(yh,divide(multiply(dx,uy),ux));
  const yAtTargetX=toBinary64(yAtTargetXR);
  const deltaY=toBinary64(subtract(yAtTargetXR,ty));
  let xAtTargetY=null,deltaX=null;
  if(Math.abs(incomingUnit.y)>1e-12){
    const xAtTargetYR=add(xh,divide(multiply(dy,ux),uy));
    const xNum=toBinary64(xAtTargetYR);
    const dxNum=toBinary64(subtract(xAtTargetYR,tx));
    if(Number.isFinite(xNum)&&Number.isFinite(dxNum)){xAtTargetY=xNum;deltaX=dxNum;}
  }
  return {
    perpendicularMissMm:Number.isFinite(perpMiss)?perpMiss:null,
    yAtTargetXMm:Number.isFinite(yAtTargetX)?yAtTargetX:null,
    deltaYAtTargetXMm:Number.isFinite(deltaY)?deltaY:null,
    xAtTargetYMm:xAtTargetY,
    deltaXAtTargetYMm:deltaX
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

  // Handle collimated/afocal paraxial output explicitly (no finite target point).
  if(paraxialResult.kind==='coaxial-stack-collimated-focus'&&pv.isAfocal){
    const hitRows=outgoing.map((ev,i)=>{
      const slopeR=divide(fromBinary64(ev.incomingUnit.y),fromBinary64(ev.incomingUnit.x));
      const slope=toBinary64(slopeR);
      const absSlope=toBinary64(absR(slopeR));
      return {
        index:i,
        pointMm:ev.pointMm,
        incomingUnit:ev.incomingUnit,
        slope:Number.isFinite(slope)?slope:null,
        absSlope:Number.isFinite(absSlope)?absSlope:null
      };
    });
    const finiteSlopes=hitRows.map(h=>h.absSlope).filter(v=>typeof v==='number'&&Number.isFinite(v));
    return {
      status:'observed-afocal-collimation-compared',
      routeQualification:'all-emitted-rays-encountered-every-element',
      exitDirection,
      outgoingHitCount:outgoing.length,
      nonExitDirectionHitCount:nonExitCount,
      stackEncounters,
      targetPointMm:null,
      maxAbsOutgoingSlope:finiteSlopes.length===hitRows.length?Math.max(...finiteSlopes):null,
      hits:hitRows
    };
  }
  if(paraxialResult.kind==='coaxial-stack-conjugate'&&pv.imageKind==='at-infinity'){
    return {
      status:'paraxial-at-infinity',
      routeQualification:'all-emitted-rays-encountered-every-element',
      reason:'Paraxial image lies at infinity; outgoing native ray directions are reported without a finite target coordinate.',
      exitDirection,
      outgoingHitCount:outgoing.length,
      nonExitDirectionHitCount:nonExitCount,
      stackEncounters,
      targetPointMm:null,
      hits:outgoing.map((ev,i)=>({index:i,pointMm:ev.pointMm,incomingUnit:ev.incomingUnit}))
    };
  }

  const targetX=paraxialResult.kind==='coaxial-stack-conjugate'?pv.imageX:pv.backFocusX;
  const targetY=paraxialResult.kind==='coaxial-stack-conjugate'?(own(pv,'imageY')?pv.imageY:0):0;
  const targetPointMm={x:targetX,y:targetY};

  const hitRows=outgoing.map((ev,i)=>({
    index:i,
    pointMm:ev.pointMm,
    incomingUnit:ev.incomingUnit,
    ...computeWitnessRayMetrics(ev.pointMm,ev.incomingUnit,targetPointMm)
  }));

  const misses=hitRows.map(h=>h.perpendicularMissMm).filter(v=>typeof v==='number'&&Number.isFinite(v));
  const deltaYs=hitRows.map(h=>h.deltaYAtTargetXMm).filter(v=>typeof v==='number'&&Number.isFinite(v)).map(Math.abs);

  return {
    status:'observed-ray-geometry-compared',
    routeQualification:'all-emitted-rays-encountered-every-element',
    exitDirection,
    outgoingHitCount:outgoing.length,
    nonExitDirectionHitCount:nonExitCount,
    stackEncounters,
    targetPointMm,
    maxPerpendicularMissMm:misses.length===hitRows.length?Math.max(...misses):null,
    maxAbsDeltaYAtTargetXMm:deltaYs.length===hitRows.length?Math.max(...deltaYs):null,
    hits:hitRows
  };
}

export async function runCoaxialStackNativeWitness(input,spec,{execute}={}){
  [input,spec]=structuredClone([input,spec]);
  if(typeof execute!=='function')
    fail('MISSING_EXECUTOR','A native execution function is required.');

  const plan=await buildCoaxialStackNativeWitness(input,spec);
  const rawExecution=await execute(structuredClone(plan.document),structuredClone(plan.witnessRequests));
  const summary=qualifyRunnerSummary(plan.document,rawExecution?.summary);
  const observed=await evaluateObservables(plan.document,plan.witnessRequests,summary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));

  const nativeQualified=summary?.canonicalSha256===plan.sceneSha256&&
    summary?.executionPassed===true&&
    summary?.observations?.v37EndpointsVerified===true&&
    ['completed','completed-with-warnings'].includes(summary?.native?.status);

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
