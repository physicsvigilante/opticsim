// Reviewed schema-v39 composable hybrid native optical & refractive bench.
// Unifies v37 (coaxial ideal thin lenses, plane & curved mirrors, opaque stops,
// passive detectors) and v38 (1-2 disjoint finite dielectric bodies: prism,
// convex quadrilateral, circular dielectric, biconvex spherical lens sharing
// one explicit outsideIndex) with external single-ray point sources or one
// finite parallel beam under one strict >= 0.01 mm non-overlapping contract.
// Pinned PhyDemo alone owns all ray intersections, refraction, TIR, reflection,
// lens deflection, and absorption.
import {compositionCountsMatch} from './composition-profiles.js';
import {finiteSurfaceGeometry,pointWithinSupportingLineClearance,segmentsIntersect} from './composition-validation.js';
import {curvedPoints,isCurved} from './curved-mirrors.js';
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
  componentTangentCircles,
  cross,
  delta,
  dot,
  installBenchEndpointAudit,
  pointOutsideBody,
  pointSegmentDistance,
  segmentOutsideBody,
  signedSupportDistance,
  validateCoaxialLensPlanes,
  validateParallelBeamAdmission,
  validatePointSourceSeparation
} from './native-bench-common.js';

export const HYBRID_BENCH_VERSION=39;
export const HYBRID_BENCH_MODEL='native-general-hybrid-bench';
export const HYBRID_BENCH_MAX_COMPONENTS=14;
export const HYBRID_BENCH_CLEARANCE_MM=BENCH_CLEARANCE_MM;
export const V39_NATIVE_STATE_LIMIT=BENCH_NATIVE_STATE_LIMIT;
export const HYBRID_DIELECTRIC_TYPES=DIELECTRIC_BODY_TYPES;

const SEGMENT_TYPES=Object.freeze(['ideal-lens','plane-mirror','line-blocker',FINITE_APERTURE_TYPE,'ray-detector']);

export function validateGeneralHybridBench(components,rayDensity,mirrorEndpoints,fail){
  const path='$.physics.components';
  if(!compositionCountsMatch(components,HYBRID_BENCH_MODEL,HYBRID_BENCH_VERSION)||
     components.length>HYBRID_BENCH_MAX_COMPONENTS)
    fail(path,'v39 hybrid bench supports either 1–4 single-ray sources or 1 parallel beam, 1–2 disjoint finite dielectrics, 0–2 coaxial ideal lenses, 0–2 curved mirrors, 0–2 plane mirrors, 0–2 opaque stops and 0–2 detectors (max 14 components).','UNSUPPORTED_SCOPE');

  const sources=components.filter(c=>c.type==='point-source');
  const beams=components.filter(c=>c.type===PARALLEL_BEAM_TYPE);
  if(!((sources.length>=1&&beams.length===0)||(sources.length===0&&beams.length===1)))
    fail(path,'v39 hybrid bench requires either 1–4 single-ray point sources or 1 parallel beam, not both.','UNSUPPORTED_SCOPE');

  const points=sources.map(c=>c.parameters);
  validatePointSourceSeparation(points,HYBRID_BENCH_CLEARANCE_MM,path,fail);

  const initialRays=[];
  for(const s of sources){
    if(s.emission.mode!=='single-ray')
      fail(path,'v39 point sources require explicit single-ray emission.','UNSUPPORTED_SCOPE');
    const a=s.emission.directionDeg*Math.PI/180;
    initialRays.push({origin:{x:s.parameters.x,y:s.parameters.y},dir:{x:Math.cos(a),y:Math.sin(a)}});
  }

  let beamSeg=null;
  if(beams.length===1){
    const admitted=validateParallelBeamAdmission(beams[0],rayDensity,path,fail);
    beamSeg=admitted.beamSeg;
    for(const origin of admitted.samples)initialRays.push({origin,dir:admitted.beamDir});
  }

  // 1-2 disjoint finite dielectric bodies sharing one explicit outsideIndex.
  const bodies=[];
  for(const [index,c] of components.entries()){
    if(!HYBRID_DIELECTRIC_TYPES.includes(c.type))continue;
    bodies.push(buildDielectricBody(c,`${path}[${index}].parameters`,fail));
  }
  if(bodies.some(b=>b.outsideIndex!==bodies[0].outsideIndex))
    fail(path,'All finite dielectric bodies in v39 must share one explicit outsideIndex.','UNSUPPORTED_SCOPE');
  if(bodies.length===2&&!bodiesDisjoint(bodies[0],bodies[1],HYBRID_BENCH_CLEARANCE_MM))
    fail(path,'Finite dielectric bodies must be disjoint with at least 0.01 mm clearance ('+bodies[0].id+' and '+bodies[1].id+').','UNSUPPORTED_SCOPE');

  // Emitters must lie strictly outside every dielectric body (>= 0.01 mm).
  for(const body of bodies){
    if(points.some(s=>!pointOutsideBody(s,body,HYBRID_BENCH_CLEARANCE_MM)))
      fail(path,'Point sources must lie outside every dielectric body by at least 0.01 mm ('+body.id+').','UNSUPPORTED_SCOPE');
    if(beamSeg&&!segmentOutsideBody(beamSeg,body,HYBRID_BENCH_CLEARANCE_MM))
      fail(path,'Parallel emitter must lie completely outside every dielectric body by at least 0.01 mm ('+body.id+').','UNSUPPORTED_SCOPE');
  }

  // Coaxial vertical ideal thin lenses (in exterior medium outsideIndex).
  const lenses=components.filter(c=>c.type==='ideal-lens');
  validateCoaxialLensPlanes(lenses,points,beamSeg,HYBRID_BENCH_CLEARANCE_MM,path,fail);

  // Curved mirror conservative bounding disks (>= 0.01 mm clearance from emitters, bodies, and each other).
  const curveDisks=[];
  for(const [index,c] of components.entries()){
    if(!isCurved(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(c.type==='circular-arc-mirror'&&(Math.abs(p.radius)<2||p.apertureHeight/2>=Math.abs(p.radius)*0.99))
      fail(cPath,'Circular minor arc needs |radius| >= 2 mm and half-aperture < 0.99 |radius|.','UNSUPPORTED_SCOPE');
    const pts=curvedPoints(c);
    if(pts.some(q=>!allowedCoord(q.x,q.y)))
      fail(cPath,'Derived curved-mirror points exceed coordinate bounds.','UNSUPPORTED_SCOPE');
    const disk={id:c.id,center:{x:p.x,y:p.y},radius:Math.hypot(pts[0].x-p.x,pts[0].y-p.y)};
    for(const other of curveDisks)
      if(Math.hypot(other.center.x-disk.center.x,other.center.y-disk.center.y)<other.radius+disk.radius+HYBRID_BENCH_CLEARANCE_MM)
        fail(path,'Curved aperture bounding disks must be separated by at least 0.01 mm ('+other.id+' and '+disk.id+').','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-disk.center.x,s.y-disk.center.y)<disk.radius+HYBRID_BENCH_CLEARANCE_MM))
      fail(path,'Point source must lie at least 0.01 mm outside curved aperture bounding disk ('+disk.id+').','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(disk.center,beamSeg)<disk.radius+HYBRID_BENCH_CLEARANCE_MM)
      fail(path,'Parallel emitter must lie at least 0.01 mm outside curved aperture bounding disk ('+disk.id+').','UNSUPPORTED_SCOPE');
    for(const body of bodies)
      if(!circleOutsideBody(disk,body,HYBRID_BENCH_CLEARANCE_MM))
        fail(path,'Curved mirror bounding disk must lie outside dielectric body by at least 0.01 mm ('+body.id+' and '+disk.id+').','UNSUPPORTED_SCOPE');
    curveDisks.push(disk);
  }

  // Opaque circle blockers (>= 0.01 mm clearance from emitters, bodies, curved disks, and each other).
  const circleDisks=[];
  for(const [index,c] of components.entries()){
    if(c.type!==CIRCLE_BLOCKER_TYPE)continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(Math.abs(p.x)+p.radius>10000||Math.abs(p.y)+p.radius>10000)
      fail(cPath,'entire opaque circle must remain within +/-10000 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<p.radius+HYBRID_BENCH_CLEARANCE_MM))
      fail(cPath,'each source must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(p,beamSeg)<p.radius+HYBRID_BENCH_CLEARANCE_MM)
      fail(cPath,'parallel emitter must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    const disk={id:c.id,center:{x:p.x,y:p.y},radius:p.radius};
    for(const other of circleDisks)
      if(Math.hypot(other.center.x-p.x,other.center.y-p.y)<other.radius+p.radius+HYBRID_BENCH_CLEARANCE_MM)
        fail(cPath,'opaque circles overlap or touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const d of curveDisks)
      if(Math.hypot(d.center.x-p.x,d.center.y-p.y)<d.radius+p.radius+HYBRID_BENCH_CLEARANCE_MM)
        fail(cPath,'opaque circle overlaps curved mirror bounding disk ('+d.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const body of bodies)
      if(!circleOutsideBody(disk,body,HYBRID_BENCH_CLEARANCE_MM))
        fail(cPath,'opaque circle must lie outside dielectric body by at least 0.01 mm ('+body.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    circleDisks.push(disk);
  }

  // Finite segment components: ideal lenses, plane mirrors, line blockers, finite apertures, detectors.
  const segments=[];
  for(const [index,c] of components.entries()){
    if(!SEGMENT_TYPES.includes(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}]`;
    const {line,segments:arms}=finiteSurfaceGeometry(c,mirrorEndpoints);
    if(line.some(v=>!allowedCoord(v.x,v.y)))
      fail(cPath+'.parameters','segment endpoints exceed coordinate bounds','UNSUPPORTED_SCOPE');
    if(c.type!=='ideal-lens'){
      if(points.some(s=>pointWithinSupportingLineClearance(s,p,HYBRID_BENCH_CLEARANCE_MM)))
        fail(cPath+'.parameters','each source must be at least 0.01 mm from finite surface supporting line','UNSUPPORTED_SCOPE');
      if(beamSeg){
        const signed=beamSeg.map(v=>signedSupportDistance(v,line));
        if(signed.some(v=>!Number.isFinite(v)||Math.abs(v)<BEAM_CLEARANCE_MM)||signed[0]*signed[1]<=0)
          fail(cPath+'.parameters','entire parallel emitter must lie on one safe side of supporting line ('+c.id+')','UNSUPPORTED_SCOPE');
      }
    }
    for(const body of bodies)
      if(!segmentOutsideBody(line,body,HYBRID_BENCH_CLEARANCE_MM))
        fail(cPath,'finite segment must lie outside dielectric body by at least 0.01 mm ('+body.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const arm of arms){
      for(const other of segments){
        if(other.id===c.id)continue;
        if(segmentsIntersect(other.line,arm)||separatedSegmentDistance(other.line,arm)<HYBRID_BENCH_CLEARANCE_MM)
          fail(cPath,'finite segments intersect or nearly touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      }
      for(const d of curveDisks)
        if(pointSegmentDistance(d.center,arm)<d.radius+HYBRID_BENCH_CLEARANCE_MM)
          fail(cPath,'finite segment enters curved mirror bounding disk ('+d.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      for(const circle of circleDisks)
        if(pointSegmentDistance(circle.center,arm)<circle.radius+HYBRID_BENCH_CLEARANCE_MM)
          fail(cPath,'finite segment intersects or nearly touches opaque circle ('+circle.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      segments.push({id:c.id,line:arm});
    }
  }

  // Initial forward ray corner/vertex, circle/lens/arc/blocker-tangency, and finite-endpoint guards.
  for(const {origin,dir} of initialRays){
    for(const body of bodies){
      for(const corner of body.corners){
        const offset=delta(origin,corner);
        if(dot(offset,dir)>0&&Math.abs(cross(offset,dir))<HYBRID_BENCH_CLEARANCE_MM)
          fail(path,'Initial forward ray passes within 0.01 mm of a dielectric corner/vertex ('+body.id+').','UNSUPPORTED_SCOPE');
      }
    }
    for(const c of components){
      for(const tc of componentTangentCircles(c)){
        const offset=delta(origin,tc.center);
        if(dot(offset,dir)>0&&Math.abs(Math.abs(cross(offset,dir))-tc.radius)<HYBRID_BENCH_CLEARANCE_MM)
          fail(path,'Initial forward ray is within 0.01 mm of tangency to a circular/spherical/arc surface ('+c.id+').','UNSUPPORTED_SCOPE');
      }
      for(const ep of componentFiniteEndpoints(c,mirrorEndpoints)){
        const offset=delta(origin,ep);
        if(dot(offset,dir)>0&&Math.abs(cross(offset,dir))<HYBRID_BENCH_CLEARANCE_MM)
          fail(path,'Initial forward ray passes within 0.01 mm of a finite component endpoint ('+c.id+').','UNSUPPORTED_SCOPE');
      }
      if(c.type==='ideal-lens'&&Math.abs(dir.x)>1e-12){
        const tPlane=(c.parameters.x-origin.x)/dir.x;
        if(tPlane>0){
          const yHit=origin.y+tPlane*dir.y;
          if(Math.abs(Math.abs(yHit)-c.parameters.apertureHeight/2)<HYBRID_BENCH_CLEARANCE_MM)
            fail(path,'Initial forward ray meets finite ideal-lens rim within 0.01 mm ('+c.id+').','UNSUPPORTED_SCOPE');
        }
      }
    }
  }
}

export function installGeneralHybridBenchAudit(doc,scene,idMap,mirrorEndpoints){
  const isOptical=c=>c.type==='ideal-lens'||c.type==='plane-mirror'||isCurved(c.type);
  return installBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints,{
    versionTag:'v39',
    key:'v39EndpointsVerified',
    clearance:HYBRID_BENCH_CLEARANCE_MM,
    stateLimit:V39_NATIVE_STATE_LIMIT,
    isRedirector:c=>HYBRID_DIELECTRIC_TYPES.includes(c.type)||isOptical(c),
    isCountedOptical:isOptical,
    extraKey:'v39OpticalIncidentsById',
    surfaceLabel:'circular/spherical/arc'
  });
}
