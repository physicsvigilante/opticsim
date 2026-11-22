// Reviewed schema-v37 composable native optical bench admission and geometry.
// Unifies already-compiled PhyDemo reflective, thin-lens, opaque-stop, passive
// detector, point-source, and finite parallel-beam primitives under one strict
// non-intersection and clearance contract. Pinned PhyDemo alone traces all rays.
import {compositionCountsMatch} from './composition-profiles.js';
import {finiteSurfaceGeometry,pointWithinSupportingLineClearance,segmentsIntersect} from './composition-validation.js';
import {curvedPoints,isCurved} from './curved-mirrors.js';
import {FINITE_APERTURE_TYPE,separatedSegmentDistance} from './finite-aperture.js';
import {CIRCLE_BLOCKER_TYPE} from './opaque-circle-blocker.js';
import {
  BEAM_CLEARANCE_MM,
  PARALLEL_BEAM_TYPE,
  parallelBeamGeometry,
  pinnedBeamAdmissionSamples
} from './parallel-beam.js';

export const GENERAL_BENCH_VERSION=37;
export const GENERAL_BENCH_MODEL='native-general-optical-bench';
export const GENERAL_BENCH_MAX_COMPONENTS=16;
export const GENERAL_BENCH_CLEARANCE_MM=0.01;

const SEGMENT_TYPES=Object.freeze(['ideal-lens','plane-mirror','line-blocker',FINITE_APERTURE_TYPE,'ray-detector']);
const allowed=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=10000&&Math.abs(y)<=10000;

function pointSegmentDistance(p,[a,b]){
  const dx=b.x-a.x,dy=b.y-a.y,lenSq=dx*dx+dy*dy;
  const t=lenSq===0?0:Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/lenSq));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

function signedSupportDistance(point,[a,b]){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(!(len>0&&Number.isFinite(len)))return NaN;
  return (dx*(point.y-a.y)-dy*(point.x-a.x))/len;
}

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
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)
    if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<GENERAL_BENCH_CLEARANCE_MM)
      fail(path,'distinct point sources must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');

  let beamSeg=null;
  if(beams.length===1){
    const beam=beams[0],p=beam.parameters,g=parallelBeamGeometry(p);
    beamSeg=[g.p1,g.p2];
    if(!(p.width>=10&&p.width<=100&&beamSeg.every(e=>allowed(e.x,e.y))))
      fail(path,'The complete finite emitting segment must fit within +/-10000 mm; width 10–100 mm.','UNSUPPORTED_SCOPE');
    if(!Number.isFinite(rayDensity)||rayDensity<0.048||rayDensity>1)
      fail('$.simulation.rayDensity','Parallel-beam sampling must use the supported density range.','UNSUPPORTED_SCOPE');
    if(p.brightness>rayDensity)
      fail(path,'Beam brightness must not exceed ray density, avoiding silently saturated native per-ray brightness.','UNSUPPORTED_SCOPE');
    const witness=pinnedBeamAdmissionSamples(p,rayDensity);
    if(witness.nearHalfInteger||witness.samples.length<1||witness.samples.length>100)
      fail(path,'Native Beam requires 1–100 samples and a sample factor clear of a half-integer threshold.','UNSUPPORTED_SCOPE');
  }

  // Coaxial vertical ideal thin lenses.
  const lenses=components.filter(c=>c.type==='ideal-lens');
  const lensPlanes=lenses.map(c=>c.parameters.x).sort((a,b)=>a-b);
  for(let i=0;i<lensPlanes.length;i++){
    const lx=lensPlanes[i];
    if(i>0&&lx-lensPlanes[i-1]<GENERAL_BENCH_CLEARANCE_MM)
      fail(path,'distinct lens planes must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.abs(lx-s.x)<GENERAL_BENCH_CLEARANCE_MM))
      fail(path,'each point source must be separated from every lens plane by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&!(beamSeg.every(e=>e.x<=lx-BEAM_CLEARANCE_MM)||beamSeg.every(e=>e.x>=lx+BEAM_CLEARANCE_MM)))
      fail(path,'entire parallel emitter must lie at least 0.01 mm on one side of every lens plane','UNSUPPORTED_SCOPE');
  }

  // Curved mirror conservative bounding disks.
  const curveDisks=[];
  for(const [index,c] of components.entries()){
    if(!isCurved(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(c.type==='circular-arc-mirror'&&(Math.abs(p.radius)<2||p.apertureHeight/2>=Math.abs(p.radius)*0.99))
      fail(cPath,'Circular minor arc needs |radius| >= 2 mm and half-aperture < 0.99 |radius|.','UNSUPPORTED_SCOPE');
    const pts=curvedPoints(c);
    if(pts.some(q=>!allowed(q.x,q.y)))
      fail(cPath,'Derived curved-mirror points exceed coordinate bounds.','UNSUPPORTED_SCOPE');
    curveDisks.push({id:c.id,center:{x:p.x,y:p.y},radius:Math.hypot(pts[0].x-p.x,pts[0].y-p.y)});
  }
  for(let i=0;i<curveDisks.length;i++){
    const d=curveDisks[i];
    for(const e of curveDisks.slice(i+1))
      if(Math.hypot(d.center.x-e.center.x,d.center.y-e.center.y)<=d.radius+e.radius+GENERAL_BENCH_CLEARANCE_MM)
        fail(path,'Curved aperture bounding disks must not overlap ('+d.id+' and '+e.id+').','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-d.center.x,s.y-d.center.y)<=d.radius+GENERAL_BENCH_CLEARANCE_MM))
      fail(path,'Point source must lie outside curved aperture bounding disk ('+d.id+').','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(d.center,beamSeg)<=d.radius+GENERAL_BENCH_CLEARANCE_MM)
      fail(path,'Parallel emitter must lie outside curved aperture bounding disk ('+d.id+').','UNSUPPORTED_SCOPE');
  }

  // Opaque circle blockers.
  const circleDisks=[];
  for(const [index,c] of components.entries()){
    if(c.type!==CIRCLE_BLOCKER_TYPE)continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(Math.abs(p.x)+p.radius>10000||Math.abs(p.y)+p.radius>10000)
      fail(cPath,'entire opaque circle must remain within +/-10000 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-p.x,s.y-p.y)-p.radius<GENERAL_BENCH_CLEARANCE_MM))
      fail(cPath,'each source must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(p,beamSeg)-p.radius<GENERAL_BENCH_CLEARANCE_MM)
      fail(cPath,'parallel emitter must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    for(const other of circleDisks)
      if(Math.hypot(other.center.x-p.x,other.center.y-p.y)-(other.radius+p.radius)<GENERAL_BENCH_CLEARANCE_MM)
        fail(cPath,'opaque circles overlap or touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const d of curveDisks)
      if(Math.hypot(d.center.x-p.x,d.center.y-p.y)<=d.radius+p.radius+GENERAL_BENCH_CLEARANCE_MM)
        fail(cPath,'opaque circle overlaps curved mirror bounding disk ('+d.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    circleDisks.push({id:c.id,center:{x:p.x,y:p.y},radius:p.radius});
  }

  // All finite segment components: lenses, plane mirrors, line blockers, finite apertures, detectors.
  const segments=[];
  for(const [index,c] of components.entries()){
    if(!SEGMENT_TYPES.includes(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}]`;
    const {line,segments:arms}=finiteSurfaceGeometry(c,mirrorEndpoints);
    if(line.some(v=>!allowed(v.x,v.y)))
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
        if(pointSegmentDistance(d.center,arm)<=d.radius+GENERAL_BENCH_CLEARANCE_MM)
          fail(cPath,'finite segment enters curved mirror bounding disk ('+d.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      for(const circle of circleDisks)
        if(pointSegmentDistance(circle.center,arm)-circle.radius<GENERAL_BENCH_CLEARANCE_MM)
          fail(cPath,'finite segment intersects or nearly touches opaque circle ('+circle.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      segments.push({id:c.id,line:arm});
    }
  }
}
