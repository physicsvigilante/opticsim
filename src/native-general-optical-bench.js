// Reviewed schema-v37 composable native optical bench admission, geometry, and
// route-independent observed native endpoint qualification.
// Unifies already-compiled PhyDemo reflective, thin-lens, opaque-stop, passive
// detector, point-source, and finite parallel-beam primitives under one strict
// non-intersection and clearance contract. Pinned PhyDemo alone traces all rays.
import {compositionCountsMatch} from './composition-profiles.js';
import {finiteSurfaceGeometry,pointWithinSupportingLineClearance,segmentsIntersect} from './composition-validation.js';
import {curvedPoints,isCurved} from './curved-mirrors.js';
import {FINITE_APERTURE_TYPE,separatedSegmentDistance} from './finite-aperture.js';
import {CIRCLE_BLOCKER_TYPE} from './opaque-circle-blocker.js';
import {BEAM_CLEARANCE_MM,PARALLEL_BEAM_TYPE} from './parallel-beam.js';
import {
  BENCH_CLEARANCE_MM,
  BENCH_NATIVE_STATE_LIMIT,
  allowedCoord,
  componentFiniteEndpoints,
  installBenchEndpointAudit,
  pointSegmentDistance,
  signedSupportDistance,
  validateCoaxialLensPlanes,
  validateParallelBeamAdmission,
  validatePointSourceSeparation
} from './native-bench-common.js';

export const GENERAL_BENCH_VERSION=37;
export const GENERAL_BENCH_MODEL='native-general-optical-bench';
export const GENERAL_BENCH_MAX_COMPONENTS=16;
export const GENERAL_BENCH_CLEARANCE_MM=BENCH_CLEARANCE_MM;
export const V37_NATIVE_STATE_LIMIT=BENCH_NATIVE_STATE_LIMIT;

const SEGMENT_TYPES=Object.freeze(['ideal-lens','plane-mirror','line-blocker',FINITE_APERTURE_TYPE,'ray-detector']);

export function validateGeneralOpticalBench(components,rayDensity,mirrorEndpoints,fail){
  const path='$.physics.components';
  if(!compositionCountsMatch(components,GENERAL_BENCH_MODEL,GENERAL_BENCH_VERSION)||
     components.length>GENERAL_BENCH_MAX_COMPONENTS)
    fail(path,'v37 general optical bench supports either 1–4 point sources or 1 parallel beam, 0–4 coaxial lenses, 0–4 plane mirrors, 0–2 curved mirrors, 0–2 opaque stops and 0–2 detectors (max 16 total components).','UNSUPPORTED_SCOPE');

  const sources=components.filter(c=>c.type==='point-source');
  const beams=components.filter(c=>c.type===PARALLEL_BEAM_TYPE);
  if(!((sources.length>=1&&beams.length===0)||(sources.length===0&&beams.length===1)))
    fail(path,'v37 general optical bench requires either 1–4 point sources or 1 parallel beam, not both.','UNSUPPORTED_SCOPE');

  const points=sources.map(c=>c.parameters);
  validatePointSourceSeparation(points,GENERAL_BENCH_CLEARANCE_MM,path,fail);

  let beamSeg=null,beamDir=null,beamSamples=null;
  if(beams.length===1){
    const admitted=validateParallelBeamAdmission(beams[0],rayDensity,path,fail);
    beamSeg=admitted.beamSeg;beamDir=admitted.beamDir;beamSamples=admitted.samples;
  }

  // Coaxial vertical ideal thin lenses.
  const lenses=components.filter(c=>c.type==='ideal-lens');
  validateCoaxialLensPlanes(lenses,points,beamSeg,GENERAL_BENCH_CLEARANCE_MM,path,fail);

  // Curved mirror conservative bounding disks (>= 0.01 mm clearance).
  const curveDisks=[];
  for(const [index,c] of components.entries()){
    if(!isCurved(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(c.type==='circular-arc-mirror'&&(Math.abs(p.radius)<2||p.apertureHeight/2>=Math.abs(p.radius)*0.99))
      fail(cPath,'Circular minor arc needs |radius| >= 2 mm and half-aperture < 0.99 |radius|.','UNSUPPORTED_SCOPE');
    const pts=curvedPoints(c);
    if(pts.some(q=>!allowedCoord(q.x,q.y)))
      fail(cPath,'Derived curved-mirror points exceed coordinate bounds.','UNSUPPORTED_SCOPE');
    curveDisks.push({id:c.id,center:{x:p.x,y:p.y},radius:Math.hypot(pts[0].x-p.x,pts[0].y-p.y)});
  }
  for(let i=0;i<curveDisks.length;i++){
    const d=curveDisks[i];
    for(const e of curveDisks.slice(i+1))
      if(Math.hypot(d.center.x-e.center.x,d.center.y-e.center.y)<d.radius+e.radius+GENERAL_BENCH_CLEARANCE_MM)
        fail(path,'Curved aperture bounding disks must be separated by at least 0.01 mm ('+d.id+' and '+e.id+').','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-d.center.x,s.y-d.center.y)<d.radius+GENERAL_BENCH_CLEARANCE_MM))
      fail(path,'Point source must lie at least 0.01 mm outside curved aperture bounding disk ('+d.id+').','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(d.center,beamSeg)<d.radius+GENERAL_BENCH_CLEARANCE_MM)
      fail(path,'Parallel emitter must lie at least 0.01 mm outside curved aperture bounding disk ('+d.id+').','UNSUPPORTED_SCOPE');
  }

  // Opaque circle blockers (>= 0.01 mm clearance).
  const circleDisks=[];
  for(const [index,c] of components.entries()){
    if(c.type!==CIRCLE_BLOCKER_TYPE)continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(Math.abs(p.x)+p.radius>10000||Math.abs(p.y)+p.radius>10000)
      fail(cPath,'entire opaque circle must remain within +/-10000 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<p.radius+GENERAL_BENCH_CLEARANCE_MM))
      fail(cPath,'each source must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(p,beamSeg)<p.radius+GENERAL_BENCH_CLEARANCE_MM)
      fail(cPath,'parallel emitter must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    for(const other of circleDisks)
      if(Math.hypot(other.center.x-p.x,other.center.y-p.y)<other.radius+p.radius+GENERAL_BENCH_CLEARANCE_MM)
        fail(cPath,'opaque circles overlap or touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const d of curveDisks)
      if(Math.hypot(d.center.x-p.x,d.center.y-p.y)<d.radius+p.radius+GENERAL_BENCH_CLEARANCE_MM)
        fail(cPath,'opaque circle overlaps curved mirror bounding disk ('+d.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    circleDisks.push({id:c.id,center:{x:p.x,y:p.y},radius:p.radius});
  }

  // All finite segment components: lenses, plane mirrors, line blockers, finite apertures, detectors.
  const segments=[];
  for(const [index,c] of components.entries()){
    if(!SEGMENT_TYPES.includes(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}]`;
    const {line,segments:arms}=finiteSurfaceGeometry(c,mirrorEndpoints);
    if(line.some(v=>!allowedCoord(v.x,v.y)))
      fail(cPath+'.parameters','segment endpoints exceed coordinate bounds','UNSUPPORTED_SCOPE');
    if(c.type!=='ideal-lens'){
      if(points.some(s=>pointWithinSupportingLineClearance(s,p,GENERAL_BENCH_CLEARANCE_MM)))
        fail(cPath+'.parameters','each source must be at least 0.01 mm from finite surface supporting line','UNSUPPORTED_SCOPE');
      if(beamSeg){
        const signed=beamSeg.map(v=>signedSupportDistance(v,line));
        if(signed.some(v=>!Number.isFinite(v)||Math.abs(v)<BEAM_CLEARANCE_MM)||signed[0]*signed[1]<=0)
          fail(cPath+'.parameters','entire parallel emitter must lie on one safe side of supporting line ('+c.id+')','UNSUPPORTED_SCOPE');
      }
    }
    for(const arm of arms){
      for(const other of segments){
        if(other.id===c.id)continue;
        if(segmentsIntersect(other.line,arm)||separatedSegmentDistance(other.line,arm)<GENERAL_BENCH_CLEARANCE_MM)
          fail(cPath,'optical or detector segments intersect or nearly touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      }
      for(const d of curveDisks)
        if(pointSegmentDistance(d.center,arm)<d.radius+GENERAL_BENCH_CLEARANCE_MM)
          fail(cPath,'finite segment enters curved mirror bounding disk ('+d.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      for(const circle of circleDisks)
        if(pointSegmentDistance(circle.center,arm)<circle.radius+GENERAL_BENCH_CLEARANCE_MM)
          fail(cPath,'finite segment intersects or nearly touches opaque circle ('+circle.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      segments.push({id:c.id,line:arm});
    }
  }

  // Direct Beam -> finite endpoint rim guard (perpendicular and oblique incidence).
  if(beamSamples){
    for(const c of components){
      const eps=componentFiniteEndpoints(c,mirrorEndpoints);
      if(!eps.length)continue;
      const isLens=c.type==='ideal-lens';
      const lensX=isLens?c.parameters.x:0;
      const lensHalf=isLens?c.parameters.apertureHeight/2:0;
      for(const origin of beamSamples){
        for(const ep of eps){
          const dx=ep.x-origin.x,dy=ep.y-origin.y;
          const forward=dx*beamDir.x+dy*beamDir.y;
          if(forward<=0)continue;
          const perp=Math.abs(beamDir.x*dy-beamDir.y*dx);
          if(perp<=GENERAL_BENCH_CLEARANCE_MM)
            fail(path,'A native beam sample passes within 0.01 mm of a finite component endpoint ('+c.id+').','UNSUPPORTED_SCOPE');
        }
        if(isLens&&Math.abs(beamDir.x)>1e-12){
          const tPlane=(lensX-origin.x)/beamDir.x;
          if(tPlane>0){
            const yHit=origin.y+tPlane*beamDir.y;
            if(Math.abs(Math.abs(yHit)-lensHalf)<=GENERAL_BENCH_CLEARANCE_MM)
              fail(path,'A native beam sample meets finite lens rim within 0.01 mm ('+c.id+').','UNSUPPORTED_SCOPE');
          }
        }
      }
    }
  }
}

export function installGeneralBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints){
  const isOptical=c=>c.type==='ideal-lens'||c.type==='plane-mirror'||isCurved(c.type);
  return installBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints,{
    versionTag:'v37',
    key:'v37EndpointsVerified',
    clearance:GENERAL_BENCH_CLEARANCE_MM,
    stateLimit:V37_NATIVE_STATE_LIMIT,
    isRedirector:isOptical,
    isCountedOptical:isOptical,
    extraKey:'v37OpticalIncidentsById',
    surfaceLabel:'circular/arc'
  });
}
