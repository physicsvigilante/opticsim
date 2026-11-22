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
import {computeWitnessRayMetrics} from './coaxial-stack-native-witness.js';
import {prepareScene} from './authoring.js';
import {absolute,add,divide,fromBinary64,subtract,toBinary64} from './binary64-rational.js';
import {REFRACTIVE_BENCH_MODEL,REFRACTIVE_BENCH_VERSION} from './native-general-refractive-bench.js';
import {qualifyRunnerSummary} from './native-observations.js';
import {evaluateObservables} from './observables.js';
import {isRecord,sceneHash} from './qualified-utils.js';

export const REFRACTIVE_WITNESS_SPEC='opticsim-refractive-stack-native-witness-v1';
export const REFRACTIVE_WITNESS_PLAN='opticsim-refractive-stack-native-witness-plan-v1';
export const REFRACTIVE_WITNESS_REPORT='opticsim-refractive-stack-native-witness-report-v1';

const SUPPORTED_QUERIES=Object.freeze(['coaxial-stack-conjugate','coaxial-stack-collimated-focus']);
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
      elements:'1–2 disjoint finite dielectric bodies formed by consecutive refracting-surface pairs (biconvex spherical lens: R1 > 0, R2 < 0; or coaxial planar slab: R1 = R2 = "infinity"), plus 0–1 optional planar terminal-mirror (signedRadius = "infinity"). Thin lenses, curved mirrors, meniscus/plano-convex/biconcave surfaces, cemented multi-index doublets, and unpaired half-spaces are refused.',
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
    const pair=pairs[i],bspec=spec.bodies[i];
    checkFields(bspec,['id','frontSurfaceId','backSurfaceId','apertureHeight'],[],'bodies['+i+']');
    if(typeof bspec.id!=='string'||!STABLE_ID_RE.test(bspec.id)||usedIds.has(bspec.id))
      fail('INVALID_WITNESS_SPEC','bodies['+i+'].id must be a unique valid stable ID.');
    if(bspec.frontSurfaceId!==pair.front.id||bspec.backSurfaceId!==pair.back.id)
      fail('INVALID_WITNESS_SPEC','bodies['+i+'] surface IDs must match axial pair ('+pair.front.id+', '+pair.back.id+').');
    const ap=bspec.apertureHeight;
    if(typeof ap!=='number'||!Number.isFinite(ap)||ap<1||ap>10000)
      fail('INVALID_WITNESS_SPEC','bodies['+i+'].apertureHeight must be a finite number in [1, 10000] mm.');
    usedIds.add(bspec.id);

    if(pair.kind==='spherical-lens'){
      opticalComponents.push({
        id:bspec.id,
        type:'spherical-lens',
        parameters:{
          x:pair.centerX,
          y:0,
          apertureHeight:ap,
          centerThickness:pair.centerThickness,
          frontRadius:pair.frontRadius,
          backRadius:pair.backRadius,
          insideIndex:pair.insideIndex,
          outsideIndex:pair.outsideIndex,
          partialReflection:spec.partialReflection
        }
      });
      elementMappings.push({
        id:bspec.id,
        stackSurfaceIds:[pair.front.id,pair.back.id],
        nativeType:'spherical-lens',
        frontX:pair.front.x,
        backX:pair.back.x,
        centerX:pair.centerX,
        centerThickness:pair.centerThickness,
        frontRadius:pair.frontRadius,
        backRadius:pair.backRadius,
        apertureHeight:ap,
        insideIndex:pair.insideIndex,
        outsideIndex:pair.outsideIndex,
        partialReflection:spec.partialReflection
      });
    }else{
      const half=ap/2;
      if(2*half!==ap)
        fail('INVALID_WITNESS_SPEC','bodies['+i+'].apertureHeight must bisect cleanly in binary64.');
      opticalComponents.push({
        id:bspec.id,
        type:'polygon-dielectric',
        parameters:{
          x1:pair.front.x,y1:-half,
          x2:pair.back.x,y2:-half,
          x3:pair.back.x,y3:half,
          x4:pair.front.x,y4:half,
          insideIndex:pair.insideIndex,
          outsideIndex:pair.outsideIndex,
          partialReflection:spec.partialReflection
        }
      });
      elementMappings.push({
        id:bspec.id,
        stackSurfaceIds:[pair.front.id,pair.back.id],
        nativeType:'polygon-dielectric',
        frontX:pair.front.x,
        backX:pair.back.x,
        apertureHeight:ap,
        insideIndex:pair.insideIndex,
        outsideIndex:pair.outsideIndex,
        partialReflection:spec.partialReflection
      });
    }
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
  if(!isPlainObject(spec.emitter))fail('INVALID_WITNESS_SPEC','emitter must be a plain object.');
  const emitterComponents=[];
  const emitterSummaries=[];
  if(spec.query.kind==='coaxial-stack-conjugate'){
    if(!own(facts,'object'))
      fail('MISSING_FACTS','coaxial-stack-conjugate witness requires object.x on the stack.');
    const ox=facts.object.x,oy=own(facts.object,'y')?facts.object.y:0;
    if(!(ox<facts.elements[0].x))
      fail('UNSUPPORTED_WITNESS_SCOPE','Native point-source conjugate witness requires a real upstream object (object.x < first surface x).');
    checkFields(spec.emitter,['mode','directionDeg','brightness'],['id'],'Conjugate single-ray emitter');
    if(spec.emitter.mode!=='single-ray')
      fail('INVALID_WITNESS_SPEC','coaxial-stack-conjugate v38 witness emitter mode must be "single-ray".');
    const id=own(spec.emitter,'id')?spec.emitter.id:'S_witness';
    if(typeof id!=='string'||!STABLE_ID_RE.test(id)||usedIds.has(id))
      fail('INVALID_WITNESS_SPEC','Conjugate emitter requires a unique valid stable ID.');
    usedIds.add(id);
    emitterComponents.push({
      id,
      type:'point-source',
      parameters:{x:ox,y:oy,brightness:spec.emitter.brightness},
      emission:{mode:'single-ray',directionDeg:spec.emitter.directionDeg}
    });
    emitterSummaries.push({id,type:'point-source',mode:'single-ray',x:ox,y:oy,directionDeg:spec.emitter.directionDeg});
  }else{
    const mode=spec.emitter.mode;
    if(mode==='parallel-beam'){
      checkFields(spec.emitter,['mode','x','y','width','brightness'],['id'],'Collimated parallel-beam emitter');
      const id=own(spec.emitter,'id')?spec.emitter.id:'B_witness';
      if(typeof id!=='string'||!STABLE_ID_RE.test(id)||usedIds.has(id))
        fail('INVALID_WITNESS_SPEC','Parallel-beam emitter requires a unique valid stable ID.');
      if(typeof spec.emitter.x!=='number'||!Number.isFinite(spec.emitter.x)||spec.emitter.x>=facts.elements[0].x)
        fail('INVALID_WITNESS_SPEC','Parallel-beam witness emitter x must strictly precede the first stack surface.');
      usedIds.add(id);
      emitterComponents.push({
        id,
        type:'parallel-beam',
        parameters:{x:spec.emitter.x,y:spec.emitter.y,width:spec.emitter.width,directionDeg:0,brightness:spec.emitter.brightness}
      });
      emitterSummaries.push({id,type:'parallel-beam',mode:'parallel-beam',x:spec.emitter.x,y:spec.emitter.y,width:spec.emitter.width,directionDeg:0});
    }else if(mode==='single-ray'){
      checkFields(spec.emitter,['mode','rays'],[],'Collimated single-ray emitter');
      if(!Array.isArray(spec.emitter.rays)||spec.emitter.rays.length<1||spec.emitter.rays.length>4)
        fail('INVALID_WITNESS_SPEC','emitter.rays must contain 1–4 explicit horizontal single-ray entries.');
      for(let i=0;i<spec.emitter.rays.length;i++){
        const r=spec.emitter.rays[i];
        checkFields(r,['x','y','brightness'],['id'],'emitter.rays['+i+']');
        const id=own(r,'id')?r.id:'S_witness_'+(i+1);
        if(typeof id!=='string'||!STABLE_ID_RE.test(id)||usedIds.has(id))
          fail('INVALID_WITNESS_SPEC','emitter.rays['+i+'] requires a unique valid stable ID.');
        if(typeof r.x!=='number'||!Number.isFinite(r.x)||r.x>=facts.elements[0].x)
          fail('INVALID_WITNESS_SPEC','Collimated single-ray emitter x must strictly precede the first stack surface.');
        usedIds.add(id);
        emitterComponents.push({
          id,
          type:'point-source',
          parameters:{x:r.x,y:r.y,brightness:r.brightness},
          emission:{mode:'single-ray',directionDeg:0}
        });
        emitterSummaries.push({id,type:'point-source',mode:'single-ray',x:r.x,y:r.y,directionDeg:0});
      }
    }else{
      fail('INVALID_WITNESS_SPEC','coaxial-stack-collimated-focus v38 witness emitter mode must be "parallel-beam" or "single-ray".');
    }
  }

  // Validate explicit passive detector.
  checkFields(spec.detector,['x','y','orientationDeg','length'],['id'],'Witness detector');
  const detectorId=own(spec.detector,'id')?spec.detector.id:'D_witness';
  if(typeof detectorId!=='string'||!STABLE_ID_RE.test(detectorId)||usedIds.has(detectorId))
    fail('INVALID_WITNESS_SPEC','Detector requires a unique valid stable ID distinct from body, mirror, and emitter IDs.');
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
        frontInteractions===expectedPerOpticalFace&&
        backInteractions===expectedPerOpticalFace&&
        rimInteractions===0;
      if(!matchesAllEmittedRays)allMatch=false;
      byElementId[el.id]={
        nativeType:el.nativeType,
        observedCount,
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

export async function runRefractiveStackNativeWitness(input,spec,{execute}={}){
  [input,spec]=structuredClone([input,spec]);
  if(typeof execute!=='function')
    fail('MISSING_EXECUTOR','A native execution function is required.');

  const plan=await buildRefractiveStackNativeWitness(input,spec);
  const rawExecution=await execute(structuredClone(plan.document),structuredClone(plan.witnessRequests));
  const summary=qualifyRunnerSummary(plan.document,rawExecution?.summary);
  const observed=await evaluateObservables(plan.document,plan.witnessRequests,summary);
  const byId=Object.fromEntries(observed.results.map(r=>[r.id,r]));

  const nativeQualified=summary?.canonicalSha256===plan.sceneSha256&&
    summary?.executionPassed===true&&
    summary?.observations?.v38EndpointsVerified===true&&
    ['completed','completed-with-warnings'].includes(summary?.native?.status);

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
