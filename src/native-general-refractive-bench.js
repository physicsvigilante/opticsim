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
import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';
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

export const REFRACTIVE_BENCH_VERSION=38;
export const REFRACTIVE_BENCH_MODEL='native-general-refractive-bench';
export const REFRACTIVE_BENCH_MAX_COMPONENTS=12;
export const REFRACTIVE_BENCH_CLEARANCE_MM=0.01;

export const REFRACTIVE_BODY_TYPES=Object.freeze([
  PRISM_TYPE,POLYGON_TYPE,CIRCULAR_TYPE,SPHERICAL_LENS_TYPE
]);
const EXTERNAL_SEGMENT_TYPES=Object.freeze(['plane-mirror','line-blocker',FINITE_APERTURE_TYPE,'ray-detector']);

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
  // SPHERICAL_LENS_TYPE: conservative convex AABB contains the complete physical biconvex lens;
  // both native generating circles are retained for tangency admission and runtime qualification.
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

function externalComponentEndpoints(c,mirrorEndpoints){
  const p=c.parameters;
  if(c.type===FINITE_APERTURE_TYPE){
    const g=apertureGeometry(p,mirrorEndpoints);
    return [g.p1,g.p2,g.p3,g.p4];
  }
  if(['plane-mirror','line-blocker','ray-detector'].includes(c.type))
    return mirrorEndpoints(p);
  return [];
}

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
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)
    if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<REFRACTIVE_BENCH_CLEARANCE_MM)
      fail(path,'distinct point sources must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');

  const initialRays=[];
  for(const s of sources){
    if(s.emission.mode!=='single-ray')
      fail(path,'v38 point sources require explicit single-ray emission.','UNSUPPORTED_SCOPE');
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
    if(line.some(v=>!allowed(v.x,v.y)))
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
      const eps=externalComponentEndpoints(c,mirrorEndpoints);
      for(const ep of eps){
        const offset=delta(origin,ep);
        if(dot(offset,dir)>0&&Math.abs(cross(offset,dir))<REFRACTIVE_BENCH_CLEARANCE_MM)
          fail(path,'Initial forward ray passes within 0.01 mm of a finite external endpoint ('+c.id+').','UNSUPPORTED_SCOPE');
      }
    }
  }
}

export const V38_NATIVE_STATE_LIMIT=10000;

function extractNativeRay(ray){
  const p=ray?.p1,q=ray?.p2;
  if(!p||!q||![p.x,p.y,q.x,q.y].every(Number.isFinite))return null;
  const vx=q.x-p.x,vy=-(q.y-p.y),len=Math.hypot(vx,vy);
  if(!(len>1e-12&&Number.isFinite(len)))return null;
  return {origin:{x:p.x,y:-p.y},dir:{x:vx/len,y:vy/len}};
}

function componentTangentCircles(c){
  const p=c.parameters;
  if(c.type===CIRCULAR_TYPE||c.type===CIRCLE_BLOCKER_TYPE)
    return [{center:{x:p.x,y:p.y},radius:p.radius}];
  if(c.type===SPHERICAL_LENS_TYPE){
    const g=thickLensGeometry(p);
    return [{center:g.frontCenter,radius:p.frontRadius},{center:g.backCenter,radius:p.backRadius}];
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

// Route-independent observed native endpoint and tangency audit for v38.
// Wraps instance-local methods once, delegates pinned PhyDemo first without
// altering ray routing, and fails closed on initial/secondary endpoint/corner
// near-misses, circular/spherical/circle-blocker near-tangencies (< 0.01 mm), or audit faults.
export function installGeneralRefractiveBenchAudit(doc,scene,idMap,mirrorEndpoints){
  let fault=null;
  let checkedStates=0;
  const endpointTargets=[];
  const endpointById=new Map();
  const circleTargets=[];
  const circleById=new Map();
  const cornerTargets=[];
  for(const c of doc.physics.components){
    const eps=externalComponentEndpoints(c,mirrorEndpoints);
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
    if(++checkedStates>V38_NATIVE_STATE_LIMIT){
      fault??=sourceCompId+': v38 native ray-state audit exceeded bounded state limit; measurements withheld.';
      return;
    }
    const state=extractNativeRay(ray);
    if(!state){
      fault??=sourceCompId+': v38 native ray state was non-finite or degenerate; measurements withheld.';
      return;
    }
    if(fault)return;
    for(const target of endpointTargets){
      for(const ep of target.endpoints){
        const offset=delta(state.origin,ep);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': v38 native endpoint proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<REFRACTIVE_BENCH_CLEARANCE_MM){
          fault=target.id+': observed native ray passes within 0.01 mm of a finite external endpoint; measurements withheld.';
          return;
        }
      }
    }
    for(const target of cornerTargets){
      for(const corner of target.corners){
        const offset=delta(state.origin,corner);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': v38 native dielectric corner proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<REFRACTIVE_BENCH_CLEARANCE_MM){
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
          fault=target.id+': v38 native circular/spherical tangency check was non-finite; measurements withheld.';
          return;
        }
        if((sameBody||ahead>0)&&Math.abs(perp-tc.radius)<REFRACTIVE_BENCH_CLEARANCE_MM){
          fault=target.id+': observed native ray approaches within 0.01 mm of tangency to a circular/spherical surface; measurements withheld.';
          return;
        }
      }
    }
  }

  for(const c of doc.physics.components){
    const nativeObj=scene.objs[idMap.get(c.id)];
    if(c.type==='point-source'||c.type===PARALLEL_BEAM_TYPE){
      if(!nativeObj||typeof nativeObj.onSimulationStart!=='function'){
        fault??=c.id+': native emitter method unavailable for v38 audit.';
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
          fault??=c.id+': v38 native emitter audit failed; measurements withheld.';
        }
        return result;
      };
      continue;
    }

    const epTarget=endpointById.get(c.id)||null;
    const cTarget=circleById.get(c.id)||null;
    const isRedirector=REFRACTIVE_BODY_TYPES.includes(c.type)||c.type==='plane-mirror';
    if(!epTarget&&!cTarget&&!isRedirector)continue;
    if(!nativeObj||typeof nativeObj.onRayIncident!=='function'){
      fault??=c.id+': native incident method unavailable for v38 audit.';
      continue;
    }
    const original=nativeObj.onRayIncident;
    nativeObj.onRayIncident=function(...args){
      // Snapshot incoming ray state BEFORE pinned PhyDemo mutates ray.p1/p2.
      const inRay=cTarget?extractNativeRay(args[0]):null;
      const incidentPoint=args[2];
      const result=original.apply(this,args);
      try{
        if(!fault&&epTarget){
          if(!incidentPoint||!Number.isFinite(incidentPoint.x)||!Number.isFinite(incidentPoint.y)){
            fault=c.id+': native ray incident point was non-finite.';
          }else{
            const x=incidentPoint.x,y=-incidentPoint.y;
            if(epTarget.endpoints.some(ep=>Math.hypot(x-ep.x,y-ep.y)<REFRACTIVE_BENCH_CLEARANCE_MM))
              fault=c.id+': native ray struck within 0.01 mm of a finite external endpoint; measurements withheld.';
          }
        }
        if(!fault&&cTarget){
          if(!inRay){
            fault=c.id+': native incident ray state was non-finite or degenerate; measurements withheld.';
          }else{
            for(const tc of cTarget.circles){
              const b=Math.abs(cross(delta(inRay.origin,tc.center),inRay.dir));
              if(!Number.isFinite(b)||Math.abs(b-tc.radius)<REFRACTIVE_BENCH_CLEARANCE_MM){
                fault=c.id+': native incident ray struck within 0.01 mm of tangency to a circular/spherical surface; measurements withheld.';
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
        fault??=c.id+': v38 native incident audit failed; measurements withheld.';
      }
      return result;
    };
  }
  return {
    key:'v38EndpointsVerified',
    finish:()=>fault
  };
}
