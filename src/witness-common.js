// Shared behavior-preserving helpers for coaxial paraxial <-> native witness
// bridges (v37 coaxial-stack, v38 refractive, v39 hybrid).
// Preserves every version-specific schema, admission, and encounter gate in
// the individual witness modules while eliminating duplicated input parsing,
// emitter/detector/body compilation, and exact binary64-rational ray comparison.
import {
  COAXIAL_STACK_FACTS,
  validateCoaxialStackFacts
} from './coaxial-paraxial-stack.js';
import {
  COAXIAL_STACK_PACKAGE,
  coaxialStackHash,
  verifyCoaxialStackPackage
} from './coaxial-stack-exploration.js';
import {absolute,add,divide,fromBinary64,multiply,subtract,toBinary64} from './binary64-rational.js';
import {isAcceptedExecutionSummary,qualifyRunnerSummary} from './native-observations.js';
import {isRecord} from './qualified-utils.js';

export const WITNESS_SUPPORTED_QUERIES=Object.freeze(['coaxial-stack-conjugate','coaxial-stack-collimated-focus']);
export const WITNESS_MIRROR_MODELS=Object.freeze(['circular-arc-mirror','ideal-curved-mirror']);
export const WITNESS_RUN_POLICIES=Object.freeze(['preview-v1','dense-v1']);
export const WITNESS_STABLE_ID_RE=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export const own=(o,k)=>Object.hasOwn(o,k);
export const witnessFail=(code,message)=>{throw Object.assign(new Error(message),{code});};
export const isPlainObject=v=>isRecord(v)&&Object.getPrototypeOf(v)===Object.prototype;
export const absR=q=>({n:absolute(q.n),d:q.d});
export const negR=q=>({n:-q.n,d:q.d});
export const TWO=fromBinary64(2);

export function checkWitnessFields(value,required,optional,label,code='INVALID_WITNESS_SPEC'){
  if(!isPlainObject(value))witnessFail(code,label+' must be a plain object.');
  const allowed=[...required,...optional];
  const extra=Object.keys(value).filter(k=>!allowed.includes(k));
  if(extra.length)witnessFail(code,label+' has unsupported fields: '+extra.join(', '));
  const missing=required.filter(k=>!own(value,k));
  if(missing.length)witnessFail(code,label+' requires '+missing.join(', ')+'.');
}

export async function resolveWitnessStackInput(input){
  if(!isPlainObject(input)||typeof input.format!=='string')
    witnessFail('UNSUPPORTED_INPUT','Supply either '+COAXIAL_STACK_FACTS+' or '+COAXIAL_STACK_PACKAGE+'.');
  if(input.format===COAXIAL_STACK_PACKAGE){
    const pkg=await verifyCoaxialStackPackage(input);
    return {facts:structuredClone(pkg.currentFacts),stackSha256:pkg.currentSha256,packageIntegritySha256:pkg.integritySha256};
  }
  if(input.format===COAXIAL_STACK_FACTS){
    const facts=structuredClone(input);
    validateCoaxialStackFacts(facts);
    return {facts,stackSha256:await coaxialStackHash(facts),packageIntegritySha256:null};
  }
  witnessFail('UNSUPPORTED_INPUT','Unsupported stack input format: '+input.format);
}

export function validateWitnessDetector(detectorSpec,usedIds){
  checkWitnessFields(detectorSpec,['x','y','orientationDeg','length'],['id'],'Witness detector');
  const detectorId=own(detectorSpec,'id')?detectorSpec.id:'D_witness';
  if(typeof detectorId!=='string'||!WITNESS_STABLE_ID_RE.test(detectorId)||usedIds.has(detectorId))
    witnessFail('INVALID_WITNESS_SPEC','Detector requires a unique valid stable ID distinct from stack and emitter IDs.');
  usedIds.add(detectorId);
  return {
    detectorId,
    detectorComponent:{
      id:detectorId,
      type:'ray-detector',
      parameters:{
        x:detectorSpec.x,
        y:detectorSpec.y,
        orientationDeg:detectorSpec.orientationDeg,
        length:detectorSpec.length
      }
    }
  };
}

export function buildDielectricBodyComponent(pair,bspec,partialReflection,usedIds,index,{includeCategory=false}={}){
  checkWitnessFields(bspec,['id','frontSurfaceId','backSurfaceId','apertureHeight'],[],'bodies['+index+']');
  if(typeof bspec.id!=='string'||!WITNESS_STABLE_ID_RE.test(bspec.id)||usedIds.has(bspec.id))
    witnessFail('INVALID_WITNESS_SPEC','bodies['+index+'].id must be a unique valid stable ID.');
  if(bspec.frontSurfaceId!==pair.front.id||bspec.backSurfaceId!==pair.back.id)
    witnessFail('INVALID_WITNESS_SPEC','bodies['+index+'] surface IDs must match axial pair ('+pair.front.id+', '+pair.back.id+').');
  const ap=bspec.apertureHeight;
  if(typeof ap!=='number'||!Number.isFinite(ap)||ap<1||ap>10000)
    witnessFail('INVALID_WITNESS_SPEC','bodies['+index+'].apertureHeight must be a finite number in [1, 10000] mm.');
  usedIds.add(bspec.id);

  const categoryField=includeCategory?{category:'dielectric-body'}:{};
  if(pair.kind==='spherical-lens'){
    return {
      component:{
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
          partialReflection
        }
      },
      mapping:{
        id:bspec.id,
        ...categoryField,
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
        partialReflection
      }
    };
  }
  const half=ap/2;
  if(2*half!==ap)
    witnessFail('INVALID_WITNESS_SPEC','bodies['+index+'].apertureHeight must bisect cleanly in binary64.');
  return {
    component:{
      id:bspec.id,
      type:'polygon-dielectric',
      parameters:{
        x1:pair.front.x,y1:-half,
        x2:pair.back.x,y2:-half,
        x3:pair.back.x,y3:half,
        x4:pair.front.x,y4:half,
        insideIndex:pair.insideIndex,
        outsideIndex:pair.outsideIndex,
        partialReflection
      }
    },
    mapping:{
      id:bspec.id,
      ...categoryField,
      stackSurfaceIds:[pair.front.id,pair.back.id],
      nativeType:'polygon-dielectric',
      frontX:pair.front.x,
      backX:pair.back.x,
      apertureHeight:ap,
      insideIndex:pair.insideIndex,
      outsideIndex:pair.outsideIndex,
      partialReflection
    }
  };
}

export function buildRefractiveOrHybridEmitters(facts,spec,usedIds,conjugateModeLabel){
  const emitterComponents=[];
  const emitterSummaries=[];
  if(spec.query.kind==='coaxial-stack-conjugate'){
    if(!own(facts,'object'))
      witnessFail('MISSING_FACTS','coaxial-stack-conjugate witness requires object.x on the stack.');
    checkWitnessFields(spec.emitter,['mode','directionDeg','brightness'],['id'],'Conjugate single-ray emitter');
    if(spec.emitter.mode!=='single-ray')
      witnessFail('INVALID_WITNESS_SPEC',conjugateModeLabel+' conjugate witness emitter mode must be "single-ray".');
    const id=own(spec.emitter,'id')?spec.emitter.id:'S_witness';
    if(typeof id!=='string'||!WITNESS_STABLE_ID_RE.test(id)||usedIds.has(id))
      witnessFail('INVALID_WITNESS_SPEC','Emitter requires a unique valid stable ID distinct from stack element IDs.');
    usedIds.add(id);
    const y=own(facts.object,'y')?facts.object.y:0;
    emitterComponents.push({
      id,
      type:'point-source',
      parameters:{x:facts.object.x,y,brightness:spec.emitter.brightness},
      emission:{mode:'single-ray',directionDeg:spec.emitter.directionDeg}
    });
    emitterSummaries.push({id,type:'point-source',mode:'single-ray',x:facts.object.x,y,directionDeg:spec.emitter.directionDeg});
  }else{
    const mode=spec.emitter?.mode;
    const firstElementX=facts.elements[0].x;
    if(mode==='parallel-beam'){
      checkWitnessFields(spec.emitter,['mode','x','y','width','brightness'],['id'],'Collimated parallel-beam emitter');
      const id=own(spec.emitter,'id')?spec.emitter.id:'B_witness';
      if(typeof id!=='string'||!WITNESS_STABLE_ID_RE.test(id)||usedIds.has(id))
        witnessFail('INVALID_WITNESS_SPEC','Emitter requires a unique valid stable ID distinct from stack element IDs.');
      usedIds.add(id);
      if(typeof spec.emitter.x!=='number'||!Number.isFinite(spec.emitter.x)||spec.emitter.x>=firstElementX)
        witnessFail('INVALID_WITNESS_SPEC','Parallel-beam witness emitter x must strictly precede the first stack element.');
      emitterComponents.push({
        id,
        type:'parallel-beam',
        parameters:{x:spec.emitter.x,y:spec.emitter.y,width:spec.emitter.width,directionDeg:0,brightness:spec.emitter.brightness}
      });
      emitterSummaries.push({id,type:'parallel-beam',mode:'parallel-beam',x:spec.emitter.x,y:spec.emitter.y,width:spec.emitter.width,directionDeg:0});
    }else if(mode==='single-ray'){
      checkWitnessFields(spec.emitter,['mode','rays'],[],'Collimated single-ray emitter list');
      if(!Array.isArray(spec.emitter.rays)||spec.emitter.rays.length<1||spec.emitter.rays.length>4)
        witnessFail('INVALID_WITNESS_SPEC','Collimated single-ray emitter requires 1–4 explicit horizontal rays.');
      for(let i=0;i<spec.emitter.rays.length;i++){
        const r=spec.emitter.rays[i];
        checkWitnessFields(r,['x','y','brightness'],['id'],'emitter.rays['+i+']');
        const id=own(r,'id')?r.id:'S_witness_'+(i+1);
        if(typeof id!=='string'||!WITNESS_STABLE_ID_RE.test(id)||usedIds.has(id))
          witnessFail('INVALID_WITNESS_SPEC','emitter.rays['+i+'] requires a unique valid stable ID.');
        usedIds.add(id);
        if(typeof r.x!=='number'||!Number.isFinite(r.x)||r.x>=firstElementX)
          witnessFail('INVALID_WITNESS_SPEC','emitter.rays['+i+'].x must strictly precede the first stack element.');
        emitterComponents.push({
          id,
          type:'point-source',
          parameters:{x:r.x,y:r.y,brightness:r.brightness},
          emission:{mode:'single-ray',directionDeg:0}
        });
        emitterSummaries.push({id,type:'point-source',mode:'single-ray',x:r.x,y:r.y,directionDeg:0});
      }
    }else{
      witnessFail('INVALID_WITNESS_SPEC','coaxial-stack-collimated-focus witness emitter mode must be "parallel-beam" or "single-ray".');
    }
  }
  return {emitterComponents,emitterSummaries};
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

export function qualifyWitnessExecution(doc,expectedSceneSha256,rawSummary){
  const summary=qualifyRunnerSummary(doc,rawSummary);
  const nativeQualified=isAcceptedExecutionSummary(doc,expectedSceneSha256,summary);
  const observableSummary=nativeQualified?summary:{
    canonicalSha256:summary?.canonicalSha256??null,
    executionPassed:false,
    native:{
      status:summary?.native?.status??'incomplete',
      error:summary?.native?.error??'Native witness run did not satisfy complete execution qualification.',
      errors:Array.isArray(summary?.native?.errors)&&summary.native.errors.length
        ?summary.native.errors
        :['Native witness run did not satisfy complete execution qualification.'],
      warnings:Array.isArray(summary?.native?.warnings)?summary.native.warnings:[]
    },
    observations:null,
    measurementState:'withheld-incomplete'
  };
  return {summary,nativeQualified,observableSummary};
}

export function compareQualifiedWitnessHits(paraxialResult,outgoing,nonExitCount,stackEncounters,routeQualification){
  const pv=paraxialResult.value;
  const exitDirection=pv.exitDirection;

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
      routeQualification,
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
      routeQualification,
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
    routeQualification,
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
