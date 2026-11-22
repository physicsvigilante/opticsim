// Reviewed schema-v38 composable native refractive bench admission, geometry,
// and route-independent observed native endpoint qualification.
// Unifies already-compiled PhyDemo finite dielectric bodies (triangular-prism,
// polygon-dielectric, circular-dielectric, spherical-lens) with external plane
// mirrors, opaque stops, passive detectors, single-ray point sources, and
// finite parallel beams under one strict non-overlapping clearance contract.
// Pinned PhyDemo alone owns all ray intersections, Snell/Fresnel refraction,
// TIR, reflection, and absorption.
import {compositionCountsMatch} from './composition-profiles.js';
import {finiteSurfaceGeometry,pointWithinSupportingLineClearance,segmentsIntersect} from './composition-validation.js';
import {FINITE_APERTURE_TYPE,separatedSegmentDistance} from './finite-aperture.js';
import {CIRCLE_BLOCKER_TYPE} from './opaque-circle-blocker.js';
import {BEAM_CLEARANCE_MM,PARALLEL_BEAM_TYPE} from './parallel-beam.js';
import {
  BENCH_CLEARANCE_MM,
  BENCH_NATIVE_STATE_LIMIT,
  DIELECTRIC_BODY_TYPES,
  allowedCoord,
  bodiesDisjoint,
  buildDielectricBody,
  circleOutsideBody,
  componentFiniteEndpoints,
  cross,
  delta,
  dot,
  installBenchEndpointAudit,
  pointOutsideBody,
  pointSegmentDistance,
  segmentOutsideBody,
  signedSupportDistance,
  validateParallelBeamAdmission,
  validatePointSourceSeparation
} from './native-bench-common.js';

export const REFRACTIVE_BENCH_VERSION=38;
export const REFRACTIVE_BENCH_MODEL='native-general-refractive-bench';
export const REFRACTIVE_BENCH_MAX_COMPONENTS=12;
export const REFRACTIVE_BENCH_CLEARANCE_MM=BENCH_CLEARANCE_MM;
export const V38_NATIVE_STATE_LIMIT=BENCH_NATIVE_STATE_LIMIT;
export const REFRACTIVE_BODY_TYPES=DIELECTRIC_BODY_TYPES;

const EXTERNAL_SEGMENT_TYPES=Object.freeze(['plane-mirror','line-blocker',FINITE_APERTURE_TYPE,'ray-detector']);

export function validateGeneralRefractiveBench(components,rayDensity,mirrorEndpoints,fail){
  const path='$.physics.components';
  if(!compositionCountsMatch(components,REFRACTIVE_BENCH_MODEL,REFRACTIVE_BENCH_VERSION)||
     components.length>REFRACTIVE_BENCH_MAX_COMPONENTS)
    fail(path,'v38 refractive bench supports either 1–4 single-ray sources or 1 parallel beam, 1–2 disjoint finite dielectrics, 0–2 plane mirrors, 0–2 opaque stops and 0–2 detectors (max 12 components).','UNSUPPORTED_SCOPE');

  const sources=components.filter(c=>c.type==='point-source');
  const beams=components.filter(c=>c.type===PARALLEL_BEAM_TYPE);
  if(!((sources.length>=1&&beams.length===0)||(sources.length===0&&beams.length===1)))
    fail(path,'v38 refractive bench requires either 1–4 single-ray point sources or 1 parallel beam, not both.','UNSUPPORTED_SCOPE');

  const points=sources.map(c=>c.parameters);
  validatePointSourceSeparation(points,REFRACTIVE_BENCH_CLEARANCE_MM,path,fail);

  const initialRays=[];
  for(const s of sources){
    if(s.emission.mode!=='single-ray')
      fail(path,'v38 point sources require explicit single-ray emission.','UNSUPPORTED_SCOPE');
    const a=s.emission.directionDeg*Math.PI/180;
    initialRays.push({origin:{x:s.parameters.x,y:s.parameters.y},dir:{x:Math.cos(a),y:Math.sin(a)}});
  }

  let beamSeg=null;
  if(beams.length===1){
    const admitted=validateParallelBeamAdmission(beams[0],rayDensity,path,fail);
    beamSeg=admitted.beamSeg;
    for(const origin of admitted.samples)initialRays.push({origin,dir:admitted.beamDir});
  }

  // Validate 1-2 finite dielectric bodies, shared outsideIndex, and mutual disjointness.
  const bodies=[];
  for(const [index,c] of components.entries()){
    if(!REFRACTIVE_BODY_TYPES.includes(c.type))continue;
    bodies.push(buildDielectricBody(c,`${path}[${index}].parameters`,fail));
  }
  if(bodies.some(b=>b.outsideIndex!==bodies[0].outsideIndex))
    fail(path,'All finite dielectric bodies in v38 must share one explicit outsideIndex.','UNSUPPORTED_SCOPE');
  if(bodies.length===2&&!bodiesDisjoint(bodies[0],bodies[1],REFRACTIVE_BENCH_CLEARANCE_MM))
    fail(path,'Finite dielectric bodies must be disjoint with at least 0.01 mm clearance ('+bodies[0].id+' and '+bodies[1].id+').','UNSUPPORTED_SCOPE');

  // Keep all emitters strictly external to every dielectric body (>= 0.01 mm).
  for(const body of bodies){
    if(points.some(s=>!pointOutsideBody(s,body,REFRACTIVE_BENCH_CLEARANCE_MM)))
      fail(path,'Point sources must lie outside every dielectric body by at least 0.01 mm ('+body.id+').','UNSUPPORTED_SCOPE');
    if(beamSeg&&!segmentOutsideBody(beamSeg,body,REFRACTIVE_BENCH_CLEARANCE_MM))
      fail(path,'Parallel emitter must lie completely outside every dielectric body by at least 0.01 mm ('+body.id+').','UNSUPPORTED_SCOPE');
  }

  // Opaque circle blockers (>= 0.01 mm clearance from emitters, bodies, and each other).
  const circleDisks=[];
  for(const [index,c] of components.entries()){
    if(c.type!==CIRCLE_BLOCKER_TYPE)continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(Math.abs(p.x)+p.radius>10000||Math.abs(p.y)+p.radius>10000)
      fail(cPath,'entire opaque circle must remain within +/-10000 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<p.radius+REFRACTIVE_BENCH_CLEARANCE_MM))
      fail(cPath,'each source must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(p,beamSeg)<p.radius+REFRACTIVE_BENCH_CLEARANCE_MM)
      fail(cPath,'parallel emitter must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    const disk={id:c.id,center:{x:p.x,y:p.y},radius:p.radius};
    for(const other of circleDisks)
      if(Math.hypot(other.center.x-p.x,other.center.y-p.y)<other.radius+p.radius+REFRACTIVE_BENCH_CLEARANCE_MM)
        fail(cPath,'opaque circles overlap or touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const body of bodies)
      if(!circleOutsideBody(disk,body,REFRACTIVE_BENCH_CLEARANCE_MM))
        fail(cPath,'opaque circle must lie outside dielectric body by at least 0.01 mm ('+body.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    circleDisks.push(disk);
  }

  // External finite segments: plane mirrors, line blockers, finite apertures, detectors.
  const segments=[];
  for(const [index,c] of components.entries()){
    if(!EXTERNAL_SEGMENT_TYPES.includes(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}]`;
    const {line,segments:arms}=finiteSurfaceGeometry(c,mirrorEndpoints);
    if(line.some(v=>!allowedCoord(v.x,v.y)))
      fail(cPath+'.parameters','segment endpoints exceed coordinate bounds','UNSUPPORTED_SCOPE');
    if(points.some(s=>pointWithinSupportingLineClearance(s,p,REFRACTIVE_BENCH_CLEARANCE_MM)))
      fail(cPath+'.parameters','each source must be at least 0.01 mm from finite surface supporting line','UNSUPPORTED_SCOPE');
    if(beamSeg){
      const signed=beamSeg.map(v=>signedSupportDistance(v,line));
      if(signed.some(v=>!Number.isFinite(v)||Math.abs(v)<BEAM_CLEARANCE_MM)||signed[0]*signed[1]<=0)
        fail(cPath+'.parameters','entire parallel emitter must lie on one safe side of supporting line ('+c.id+')','UNSUPPORTED_SCOPE');
    }
    for(const body of bodies)
      if(!segmentOutsideBody(line,body,REFRACTIVE_BENCH_CLEARANCE_MM))
        fail(cPath,'external segment must lie outside dielectric body by at least 0.01 mm ('+body.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const arm of arms){
      for(const other of segments){
        if(other.id===c.id)continue;
        if(segmentsIntersect(other.line,arm)||separatedSegmentDistance(other.line,arm)<REFRACTIVE_BENCH_CLEARANCE_MM)
          fail(cPath,'external segments intersect or nearly touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      }
      for(const circle of circleDisks)
        if(pointSegmentDistance(circle.center,arm)<circle.radius+REFRACTIVE_BENCH_CLEARANCE_MM)
          fail(cPath,'external segment intersects or nearly touches opaque circle ('+circle.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      segments.push({id:c.id,line:arm});
    }
  }

  // Initial forward ray corner/vertex, circle/lens/blocker-tangency, and external-endpoint guards.
  for(const {origin,dir} of initialRays){
    for(const body of bodies){
      for(const corner of body.corners){
        const offset=delta(origin,corner);
        if(dot(offset,dir)>0&&Math.abs(cross(offset,dir))<REFRACTIVE_BENCH_CLEARANCE_MM)
          fail(path,'Initial forward ray passes within 0.01 mm of a dielectric corner/vertex ('+body.id+').','UNSUPPORTED_SCOPE');
      }
      for(const tc of body.tangentCircles){
        const offset=delta(origin,tc.center);
        if(dot(offset,dir)>0&&Math.abs(Math.abs(cross(offset,dir))-tc.radius)<REFRACTIVE_BENCH_CLEARANCE_MM)
          fail(path,'Initial forward ray is within 0.01 mm of tangency to a dielectric circular/spherical surface ('+body.id+').','UNSUPPORTED_SCOPE');
      }
    }
    for(const circle of circleDisks){
      const offset=delta(origin,circle.center);
      if(dot(offset,dir)>0&&Math.abs(Math.abs(cross(offset,dir))-circle.radius)<REFRACTIVE_BENCH_CLEARANCE_MM)
        fail(path,'Initial forward ray is within 0.01 mm of tangency to opaque circle blocker ('+circle.id+').','UNSUPPORTED_SCOPE');
    }
    for(const c of components){
      for(const ep of componentFiniteEndpoints(c,mirrorEndpoints)){
        const offset=delta(origin,ep);
        if(dot(offset,dir)>0&&Math.abs(cross(offset,dir))<REFRACTIVE_BENCH_CLEARANCE_MM)
          fail(path,'Initial forward ray passes within 0.01 mm of a finite external endpoint ('+c.id+').','UNSUPPORTED_SCOPE');
      }
    }
  }
}

export function installGeneralRefractiveBenchAudit(doc,scene,idMap,mirrorEndpoints){
  return installBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints,{
    versionTag:'v38',
    key:'v38EndpointsVerified',
    clearance:REFRACTIVE_BENCH_CLEARANCE_MM,
    stateLimit:V38_NATIVE_STATE_LIMIT,
    isRedirector:c=>REFRACTIVE_BODY_TYPES.includes(c.type)||c.type==='plane-mirror',
    endpointLabel:'finite external endpoint',
    surfaceLabel:'circular/spherical'
  });
}
