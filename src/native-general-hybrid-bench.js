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
import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';
import {curvedFrame,curvedPoints,isCurved} from './curved-mirrors.js';
import {FINITE_APERTURE_TYPE,apertureGeometry,separatedSegmentDistance} from './finite-aperture.js';
import {finiteGlassFaces,segmentOutsideFiniteGlass} from './finite-glass-geometry.js';
import {CIRCLE_BLOCKER_TYPE} from './opaque-circle-blocker.js';
import {
  BEAM_CLEARANCE_MM,
  PARALLEL_BEAM_TYPE,
  parallelBeamGeometry,
  pinnedBeamAdmissionSamples
} from './parallel-beam.js';
import {POLYGON_TYPE,polygonVertices} from './polygon-dielectric.js';
import {SPHERICAL_LENS_TYPE,thickLensExtents,thickLensGeometry} from './spherical-lens.js';
import {PRISM_TYPE,prismVertices} from './triangular-prism.js';

export const HYBRID_BENCH_VERSION=39;
export const HYBRID_BENCH_MODEL='native-general-hybrid-bench';
export const HYBRID_BENCH_MAX_COMPONENTS=14;
export const HYBRID_BENCH_CLEARANCE_MM=0.01;
export const V39_NATIVE_STATE_LIMIT=10000;

export const HYBRID_DIELECTRIC_TYPES=Object.freeze([
  PRISM_TYPE,POLYGON_TYPE,CIRCULAR_TYPE,SPHERICAL_LENS_TYPE
]);
const SEGMENT_TYPES=Object.freeze(['ideal-lens','plane-mirror','line-blocker',FINITE_APERTURE_TYPE,'ray-detector']);

const delta=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
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

function buildDielectricBody(c,cPath,fail){
  const p=c.parameters;
  if(c.type===PRISM_TYPE){
    const v=prismVertices(p);
    if(v.some(q=>!allowed(q.x,q.y)))
      fail(cPath,'Prism vertices must be finite and within +/-10000 mm.','UNSUPPORTED_SCOPE');
    const faces=finiteGlassFaces(v);
    const twiceArea=Math.abs(cross(delta(v[0],v[1]),delta(v[0],v[2])));
    if(faces.some(f=>f.length<1||twiceArea/f.length<1))
      fail(cPath,'Prism edges and altitudes must be at least 1 mm; collinear or repeated vertices are invalid.','UNSUPPORTED_SCOPE');
    return {kind:'poly',id:c.id,type:c.type,outsideIndex:p.outsideIndex,vertices:v,faces,corners:v,tangentCircles:[]};
  }
  if(c.type===POLYGON_TYPE){
    const v=polygonVertices(p);
    if(v.some(q=>!allowed(q.x,q.y)))
      fail(cPath,'All four polygon vertices must be finite and within +/-10000 mm.','UNSUPPORTED_SCOPE');
    const turns=v.map((a,i)=>cross(delta(a,v[(i+1)%4]),delta(v[(i+1)%4],v[(i+2)%4])));
    const winding=Math.sign(turns[0]);
    if(!winding||turns.some(t=>winding*t<=0))
      fail(cPath,'Quadrilateral must be strictly convex with consistent vertex winding.','UNSUPPORTED_SCOPE');
    const faces=finiteGlassFaces(v);
    if(faces.some((f,i)=>f.length<1||v.some((q,j)=>j!==i&&j!==(i+1)%4&&
         Math.abs(cross(delta(f.a,f.b),delta(f.a,q)))/f.length<1)))
      fail(cPath,'All polygon edges and opposite-vertex altitudes must be at least 1 mm.','UNSUPPORTED_SCOPE');
    return {kind:'poly',id:c.id,type:c.type,outsideIndex:p.outsideIndex,vertices:v,faces,corners:v,tangentCircles:[]};
  }
  if(c.type===CIRCULAR_TYPE){
    if(p.radius<2||circularExtents(p).some(q=>!allowed(q.x,q.y)))
      fail(cPath,'Circular dielectric requires radius >= 2 mm and must fit within +/-10000 mm.','UNSUPPORTED_SCOPE');
    const center={x:p.x,y:p.y};
    return {kind:'circle',id:c.id,type:c.type,outsideIndex:p.outsideIndex,center,radius:p.radius,corners:[],tangentCircles:[{center,radius:p.radius}]};
  }
  const half=p.apertureHeight/2;
  if(!(p.apertureHeight>=4&&p.centerThickness>=2&&p.frontRadius>=half+1&&p.backRadius>=half+1))
    fail(cPath,'Spherical lens requires aperture >= 4 mm, thickness >= 2 mm and each radius >= half-aperture + 1 mm.','UNSUPPORTED_SCOPE');
  const g=thickLensGeometry(p);
  if(!Number.isFinite(g.edgeThickness)||g.edgeThickness<1)
    fail(cPath,'Spherical lens faces must retain edge thickness >= 1 mm.','UNSUPPORTED_SCOPE');
  if(thickLensExtents(p).some(v=>!allowed(v.x,v.y)))
    fail(cPath,'Entire native spherical lens must lie within +/-10000 mm.','UNSUPPORTED_SCOPE');
  const boxVertices=[
    {x:g.left,y:g.bottom},{x:g.right,y:g.bottom},
    {x:g.right,y:g.top},{x:g.left,y:g.top}
  ];
  return {
    kind:'poly',id:c.id,type:c.type,outsideIndex:p.outsideIndex,
    vertices:boxVertices,faces:finiteGlassFaces(boxVertices),corners:g.corners,
    tangentCircles:[
      {center:g.frontCenter,radius:p.frontRadius},
      {center:g.backCenter,radius:p.backRadius}
    ]
  };
}

function pointOutsideBody(pt,body,clearance){
  if(body.kind==='circle')
    return Math.hypot(pt.x-body.center.x,pt.y-body.center.y)>=body.radius+clearance;
  return body.faces.some(f=>dot(delta(f.a,pt),f.normal)>=clearance);
}

function segmentOutsideBody(seg,body,clearance){
  if(body.kind==='circle')
    return pointSegmentDistance(body.center,seg)>=body.radius+clearance;
  return segmentOutsideFiniteGlass(body.faces,seg,clearance);
}

function circleOutsideBody(circle,body,clearance){
  if(body.kind==='circle')
    return Math.hypot(circle.center.x-body.center.x,circle.center.y-body.center.y)>=circle.radius+body.radius+clearance;
  return body.faces.some(f=>dot(delta(f.a,circle.center),f.normal)>=circle.radius+clearance);
}

function bodiesDisjoint(a,b,clearance){
  if(a.kind==='circle'&&b.kind==='circle')
    return Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y)>=a.radius+b.radius+clearance;
  if(a.kind==='circle')return circleOutsideBody(a,b,clearance);
  if(b.kind==='circle')return circleOutsideBody(b,a,clearance);
  return a.faces.some(f=>b.vertices.every(v=>dot(delta(f.a,v),f.normal)>=clearance))||
         b.faces.some(f=>a.vertices.every(v=>dot(delta(f.a,v),f.normal)>=clearance));
}

function componentFiniteEndpoints(c,mirrorEndpoints){
  const p=c.parameters;
  if(c.type==='ideal-lens'){
    const h=p.apertureHeight/2;
    return [{x:p.x,y:-h},{x:p.x,y:h}];
  }
  if(c.type===FINITE_APERTURE_TYPE){
    const g=apertureGeometry(p,mirrorEndpoints);
    return [g.p1,g.p2,g.p3,g.p4];
  }
  if(['plane-mirror','line-blocker','ray-detector'].includes(c.type))
    return mirrorEndpoints(p);
  if(isCurved(c.type)){
    const pts=curvedPoints(c);
    return [pts[0],pts[1]];
  }
  return [];
}

function componentTangentCircles(c){
  const p=c.parameters;
  if(c.type===CIRCULAR_TYPE||c.type===CIRCLE_BLOCKER_TYPE)
    return [{center:{x:p.x,y:p.y},radius:p.radius}];
  if(c.type===SPHERICAL_LENS_TYPE){
    const g=thickLensGeometry(p);
    return [{center:g.frontCenter,radius:p.frontRadius},{center:g.backCenter,radius:p.backRadius}];
  }
  if(c.type==='circular-arc-mirror'){
    const {n}=curvedFrame(p);
    return [{center:{x:p.x+p.radius*n.x,y:p.y+p.radius*n.y},radius:Math.abs(p.radius)}];
  }
  return [];
}

function componentDielectricCorners(c){
  const p=c.parameters;
  if(c.type===PRISM_TYPE)return prismVertices(p);
  if(c.type===POLYGON_TYPE)return polygonVertices(p);
  if(c.type===SPHERICAL_LENS_TYPE)return thickLensGeometry(p).corners;
  return [];
}

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
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)
    if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<HYBRID_BENCH_CLEARANCE_MM)
      fail(path,'distinct point sources must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');

  const initialRays=[];
  for(const s of sources){
    if(s.emission.mode!=='single-ray')
      fail(path,'v39 point sources require explicit single-ray emission.','UNSUPPORTED_SCOPE');
    const a=s.emission.directionDeg*Math.PI/180;
    initialRays.push({origin:{x:s.parameters.x,y:s.parameters.y},dir:{x:Math.cos(a),y:Math.sin(a)}});
  }

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
    for(const origin of witness.samples)initialRays.push({origin,dir:g.direction});
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
  const lensPlanes=lenses.map(c=>c.parameters.x).sort((a,b)=>a-b);
  for(let i=0;i<lensPlanes.length;i++){
    const lx=lensPlanes[i];
    if(i>0&&lx-lensPlanes[i-1]<HYBRID_BENCH_CLEARANCE_MM)
      fail(path,'distinct lens planes must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.abs(lx-s.x)<HYBRID_BENCH_CLEARANCE_MM))
      fail(path,'each point source must be separated from every lens plane by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&!(beamSeg.every(e=>e.x<=lx-BEAM_CLEARANCE_MM)||beamSeg.every(e=>e.x>=lx+BEAM_CLEARANCE_MM)))
      fail(path,'entire parallel emitter must lie at least 0.01 mm on one side of every lens plane','UNSUPPORTED_SCOPE');
  }

  // Curved mirror conservative bounding disks (>= 0.01 mm clearance from emitters, bodies, and each other).
  const curveDisks=[];
  for(const [index,c] of components.entries()){
    if(!isCurved(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(c.type==='circular-arc-mirror'&&(Math.abs(p.radius)<2||p.apertureHeight/2>=Math.abs(p.radius)*0.99))
      fail(cPath,'Circular minor arc needs |radius| >= 2 mm and half-aperture < 0.99 |radius|.','UNSUPPORTED_SCOPE');
    const pts=curvedPoints(c);
    if(pts.some(q=>!allowed(q.x,q.y)))
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
    if(line.some(v=>!allowed(v.x,v.y)))
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
      const eps=componentFiniteEndpoints(c,mirrorEndpoints);
      for(const ep of eps){
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

function extractNativeRay(ray){
  const p=ray?.p1,q=ray?.p2;
  if(!p||!q||![p.x,p.y,q.x,q.y].every(Number.isFinite))return null;
  const vx=q.x-p.x,vy=-(q.y-p.y),len=Math.hypot(vx,vy);
  if(!(len>1e-12&&Number.isFinite(len)))return null;
  return {origin:{x:p.x,y:-p.y},dir:{x:vx/len,y:vy/len}};
}

// Route-independent observed native endpoint, corner, and tangency audit for v39.
// Wraps instance-local methods once, delegates pinned PhyDemo first without
// altering ray routing, and fails closed on emitted, incoming, or outgoing
// near-misses (< 0.01 mm), same-body departure grazing, or audit faults.
export function installGeneralHybridBenchAudit(doc,scene,idMap,mirrorEndpoints){
  let fault=null;
  let checkedStates=0;
  const endpointTargets=[];
  const endpointById=new Map();
  const circleTargets=[];
  const circleById=new Map();
  const cornerTargets=[];
  for(const c of doc.physics.components){
    const eps=componentFiniteEndpoints(c,mirrorEndpoints);
    if(eps.length){
      const target={id:c.id,type:c.type,endpoints:eps};
      endpointTargets.push(target);
      endpointById.set(c.id,target);
    }
    const circles=componentTangentCircles(c);
    if(circles.length){
      const target={id:c.id,type:c.type,circles};
      circleTargets.push(target);
      circleById.set(c.id,target);
    }
    const corners=componentDielectricCorners(c);
    if(corners.length)cornerTargets.push({id:c.id,type:c.type,corners});
  }

  function auditRayState(ray,sourceCompId){
    if(++checkedStates>V39_NATIVE_STATE_LIMIT){
      fault??=sourceCompId+': v39 native ray-state audit exceeded bounded state limit; measurements withheld.';
      return;
    }
    const state=extractNativeRay(ray);
    if(!state){
      fault??=sourceCompId+': v39 native ray state was non-finite or degenerate; measurements withheld.';
      return;
    }
    if(fault)return;
    for(const target of endpointTargets){
      for(const ep of target.endpoints){
        const offset=delta(state.origin,ep);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': v39 native endpoint proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<HYBRID_BENCH_CLEARANCE_MM){
          fault=target.id+': observed native ray passes within 0.01 mm of a finite component endpoint; measurements withheld.';
          return;
        }
      }
    }
    for(const target of cornerTargets){
      for(const corner of target.corners){
        const offset=delta(state.origin,corner);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': v39 native dielectric corner proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<HYBRID_BENCH_CLEARANCE_MM){
          fault=target.id+': observed native ray passes within 0.01 mm of a finite dielectric corner/vertex; measurements withheld.';
          return;
        }
      }
    }
    for(const target of circleTargets){
      const sameBody=target.id===sourceCompId;
      for(const tc of target.circles){
        const offset=delta(state.origin,tc.center);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': v39 native circular/spherical/arc tangency check was non-finite; measurements withheld.';
          return;
        }
        if((sameBody||ahead>0)&&Math.abs(perp-tc.radius)<HYBRID_BENCH_CLEARANCE_MM){
          fault=target.id+': observed native ray approaches within 0.01 mm of tangency to a circular/spherical/arc surface; measurements withheld.';
          return;
        }
      }
    }
  }

  for(const c of doc.physics.components){
    const nativeObj=scene.objs[idMap.get(c.id)];
    if(c.type==='point-source'||c.type===PARALLEL_BEAM_TYPE){
      if(!nativeObj||typeof nativeObj.onSimulationStart!=='function'){
        fault??=c.id+': native emitter method unavailable for v39 audit.';
        continue;
      }
      const originalStart=nativeObj.onSimulationStart;
      nativeObj.onSimulationStart=function(...args){
        const result=originalStart.apply(this,args);
        try{
          if(!result||!Array.isArray(result.newRays)){
            fault??=c.id+': native emitter did not return an inspectable ray list; measurements withheld.';
          }else{
            for(const ray of result.newRays)auditRayState(ray,c.id);
          }
        }catch{
          fault??=c.id+': v39 native emitter audit failed; measurements withheld.';
        }
        return result;
      };
      continue;
    }

    const epTarget=endpointById.get(c.id)||null;
    const cTarget=circleById.get(c.id)||null;
    const isRedirector=HYBRID_DIELECTRIC_TYPES.includes(c.type)||c.type==='ideal-lens'||c.type==='plane-mirror'||isCurved(c.type);
    if(!epTarget&&!cTarget&&!isRedirector)continue;
    if(!nativeObj||typeof nativeObj.onRayIncident!=='function'){
      fault??=c.id+': native incident method unavailable for v39 audit.';
      continue;
    }
    const original=nativeObj.onRayIncident;
    nativeObj.onRayIncident=function(...args){
      const inRay=cTarget?extractNativeRay(args[0]):null;
      const incidentPoint=args[2];
      const result=original.apply(this,args);
      try{
        if(!fault&&epTarget){
          if(!incidentPoint||!Number.isFinite(incidentPoint.x)||!Number.isFinite(incidentPoint.y)){
            fault=c.id+': native ray incident point was non-finite.';
          }else{
            const x=incidentPoint.x,y=-incidentPoint.y;
            if(epTarget.endpoints.some(ep=>Math.hypot(x-ep.x,y-ep.y)<HYBRID_BENCH_CLEARANCE_MM))
              fault=c.id+': native ray struck within 0.01 mm of a finite component endpoint; measurements withheld.';
          }
        }
        if(!fault&&cTarget){
          if(!inRay){
            fault=c.id+': native incident ray state was non-finite or degenerate; measurements withheld.';
          }else{
            for(const tc of cTarget.circles){
              const b=Math.abs(cross(delta(inRay.origin,tc.center),inRay.dir));
              if(!Number.isFinite(b)||Math.abs(b-tc.radius)<HYBRID_BENCH_CLEARANCE_MM){
                fault=c.id+': native incident ray struck within 0.01 mm of tangency to a circular/spherical/arc surface; measurements withheld.';
                break;
              }
            }
          }
        }
        if(isRedirector){
          if(!result?.isAbsorbed)auditRayState(args[0],c.id);
          if(result?.newRays!==undefined){
            if(!Array.isArray(result.newRays)){
              fault??=c.id+': native incident returned non-array newRays; measurements withheld.';
            }else{
              for(const child of result.newRays)auditRayState(child,c.id);
            }
          }
        }
      }catch{
        fault??=c.id+': v39 native incident audit failed; measurements withheld.';
      }
      return result;
    };
  }
  return {
    key:'v39EndpointsVerified',
    finish:()=>fault
  };
}
