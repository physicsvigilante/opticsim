// Shared behavior-preserving geometry, dielectric-body clearance, and
// route-independent observed native ray-state audit helpers for composable
// native benches (v37 optical, v38 refractive, v39 hybrid).
// Pinned PhyDemo alone owns all ray tracing, intersections, refraction, TIR,
// reflection, lens deflection, and absorption.
import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';
import {curvedFrame,curvedPoints,isCurved} from './curved-mirrors.js';
import {FINITE_APERTURE_TYPE,apertureGeometry} from './finite-aperture.js';
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

export const BENCH_CLEARANCE_MM=0.01;
export const BENCH_NATIVE_STATE_LIMIT=10000;
export const DIELECTRIC_BODY_TYPES=Object.freeze([
  PRISM_TYPE,POLYGON_TYPE,CIRCULAR_TYPE,SPHERICAL_LENS_TYPE
]);

export const delta=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
export const dot=(a,b)=>a.x*b.x+a.y*b.y;
export const cross=(a,b)=>a.x*b.y-a.y*b.x;
export const allowedCoord=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=10000&&Math.abs(y)<=10000;

export function pointSegmentDistance(p,[a,b]){
  const dx=b.x-a.x,dy=b.y-a.y,lenSq=dx*dx+dy*dy;
  const t=lenSq===0?0:Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/lenSq));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

export function signedSupportDistance(point,[a,b]){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(!(len>0&&Number.isFinite(len)))return NaN;
  return (dx*(point.y-a.y)-dy*(point.x-a.x))/len;
}

export function extractNativeRay(ray){
  const p=ray?.p1,q=ray?.p2;
  if(!p||!q||![p.x,p.y,q.x,q.y].every(Number.isFinite))return null;
  const vx=q.x-p.x,vy=-(q.y-p.y),len=Math.hypot(vx,vy);
  if(!(len>1e-12&&Number.isFinite(len)))return null;
  return {origin:{x:p.x,y:-p.y},dir:{x:vx/len,y:vy/len}};
}

export function buildDielectricBody(c,cPath,fail){
  const p=c.parameters;
  if(c.type===PRISM_TYPE){
    const v=prismVertices(p);
    if(v.some(q=>!allowedCoord(q.x,q.y)))
      fail(cPath,'Prism vertices must be finite and within +/-10000 mm.','UNSUPPORTED_SCOPE');
    const faces=finiteGlassFaces(v);
    const twiceArea=Math.abs(cross(delta(v[0],v[1]),delta(v[0],v[2])));
    if(faces.some(f=>f.length<1||twiceArea/f.length<1))
      fail(cPath,'Prism edges and altitudes must be at least 1 mm; collinear or repeated vertices are invalid.','UNSUPPORTED_SCOPE');
    return {kind:'poly',id:c.id,type:c.type,outsideIndex:p.outsideIndex,vertices:v,faces,corners:v,tangentCircles:[]};
  }
  if(c.type===POLYGON_TYPE){
    const v=polygonVertices(p);
    if(v.some(q=>!allowedCoord(q.x,q.y)))
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
    if(p.radius<2||circularExtents(p).some(q=>!allowedCoord(q.x,q.y)))
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
  if(thickLensExtents(p).some(v=>!allowedCoord(v.x,v.y)))
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

export function pointOutsideBody(pt,body,clearance){
  if(body.kind==='circle')
    return Math.hypot(pt.x-body.center.x,pt.y-body.center.y)>=body.radius+clearance;
  return body.faces.some(f=>dot(delta(f.a,pt),f.normal)>=clearance);
}

export function segmentOutsideBody(seg,body,clearance){
  if(body.kind==='circle')
    return pointSegmentDistance(body.center,seg)>=body.radius+clearance;
  return segmentOutsideFiniteGlass(body.faces,seg,clearance);
}

export function circleOutsideBody(circle,body,clearance){
  if(body.kind==='circle')
    return Math.hypot(circle.center.x-body.center.x,circle.center.y-body.center.y)>=circle.radius+body.radius+clearance;
  return body.faces.some(f=>dot(delta(f.a,circle.center),f.normal)>=circle.radius+clearance);
}

export function bodiesDisjoint(a,b,clearance){
  if(a.kind==='circle'&&b.kind==='circle')
    return Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y)>=a.radius+b.radius+clearance;
  if(a.kind==='circle')return circleOutsideBody(a,b,clearance);
  if(b.kind==='circle')return circleOutsideBody(b,a,clearance);
  return a.faces.some(f=>b.vertices.every(v=>dot(delta(f.a,v),f.normal)>=clearance))||
         b.faces.some(f=>a.vertices.every(v=>dot(delta(f.a,v),f.normal)>=clearance));
}

export function componentFiniteEndpoints(c,mirrorEndpoints){
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

export function componentTangentCircles(c){
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

export function componentDielectricCorners(c){
  const p=c.parameters;
  if(c.type===PRISM_TYPE)return prismVertices(p);
  if(c.type===POLYGON_TYPE)return polygonVertices(p);
  if(c.type===SPHERICAL_LENS_TYPE)return thickLensGeometry(p).corners;
  return [];
}

export function validatePointSourceSeparation(points,clearance,path,fail){
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)
    if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<clearance)
      fail(path,'distinct point sources must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');
}

export function validateParallelBeamAdmission(beam,rayDensity,path,fail){
  const p=beam.parameters,g=parallelBeamGeometry(p);
  const beamSeg=[g.p1,g.p2];
  if(!(p.width>=10&&p.width<=100&&beamSeg.every(e=>allowedCoord(e.x,e.y))))
    fail(path,'The complete finite emitting segment must fit within +/-10000 mm; width 10–100 mm.','UNSUPPORTED_SCOPE');
  if(!Number.isFinite(rayDensity)||rayDensity<0.048||rayDensity>1)
    fail('$.simulation.rayDensity','Parallel-beam sampling must use the supported density range.','UNSUPPORTED_SCOPE');
  if(p.brightness>rayDensity)
    fail(path,'Beam brightness must not exceed ray density, avoiding silently saturated native per-ray brightness.','UNSUPPORTED_SCOPE');
  const witness=pinnedBeamAdmissionSamples(p,rayDensity);
  if(witness.nearHalfInteger||witness.samples.length<1||witness.samples.length>100)
    fail(path,'Native Beam requires 1–100 samples and a sample factor clear of a half-integer threshold.','UNSUPPORTED_SCOPE');
  return {beamSeg,beamDir:g.direction,samples:witness.samples};
}

export function validateCoaxialLensPlanes(lenses,points,beamSeg,clearance,path,fail){
  const lensPlanes=lenses.map(c=>c.parameters.x).sort((a,b)=>a-b);
  for(let i=0;i<lensPlanes.length;i++){
    const lx=lensPlanes[i];
    if(i>0&&lx-lensPlanes[i-1]<clearance)
      fail(path,'distinct lens planes must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.abs(lx-s.x)<clearance))
      fail(path,'each point source must be separated from every lens plane by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&!(beamSeg.every(e=>e.x<=lx-BEAM_CLEARANCE_MM)||beamSeg.every(e=>e.x>=lx+BEAM_CLEARANCE_MM)))
      fail(path,'entire parallel emitter must lie at least 0.01 mm on one side of every lens plane','UNSUPPORTED_SCOPE');
  }
}

// Unified route-independent observed native endpoint, dielectric-corner, and
// circular/spherical/arc tangency audit for v37/v38/v39.
// Wraps instance-local methods once, delegates pinned PhyDemo first without
// altering ray routing, and fails closed on emitted, incoming, or outgoing
// near-misses (< clearance), same-body departure grazing, or audit faults.
export function installBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints,{
  versionTag,
  key,
  clearance=BENCH_CLEARANCE_MM,
  stateLimit=BENCH_NATIVE_STATE_LIMIT,
  isRedirector,
  isCountedOptical=null,
  extraKey=null,
  endpointLabel='finite component endpoint',
  surfaceLabel='circular/spherical/arc'
}){
  let fault=null;
  let checkedStates=0;
  const opticalIncidentsById={};
  const endpointTargets=[];
  const endpointById=new Map();
  const circleTargets=[];
  const circleById=new Map();
  const cornerTargets=[];
  for(const c of doc.physics.components){
    if(isCountedOptical?.(c))opticalIncidentsById[c.id]=0;
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
    if(++checkedStates>stateLimit){
      fault??=sourceCompId+': '+versionTag+' native ray-state audit exceeded bounded state limit; measurements withheld.';
      return;
    }
    const state=extractNativeRay(ray);
    if(!state){
      fault??=sourceCompId+': '+versionTag+' native ray state was non-finite or degenerate; measurements withheld.';
      return;
    }
    if(fault)return;
    for(const target of endpointTargets){
      for(const ep of target.endpoints){
        const offset=delta(state.origin,ep);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': '+versionTag+' native endpoint proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<clearance){
          fault=target.id+': observed native ray passes within 0.01 mm of a '+endpointLabel+'; measurements withheld.';
          return;
        }
      }
    }
    for(const target of cornerTargets){
      for(const corner of target.corners){
        const offset=delta(state.origin,corner);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': '+versionTag+' native dielectric corner proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<clearance){
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
          fault=target.id+': '+versionTag+' native '+surfaceLabel+' tangency check was non-finite; measurements withheld.';
          return;
        }
        if((sameBody||ahead>0)&&Math.abs(perp-tc.radius)<clearance){
          fault=target.id+': observed native ray approaches within 0.01 mm of tangency to a '+surfaceLabel+' surface; measurements withheld.';
          return;
        }
      }
    }
  }

  for(const c of doc.physics.components){
    const nativeObj=scene.objs[idMap.get(c.id)];
    if(c.type==='point-source'||c.type===PARALLEL_BEAM_TYPE){
      if(!nativeObj||typeof nativeObj.onSimulationStart!=='function'){
        fault??=c.id+': native emitter method unavailable for '+versionTag+' audit.';
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
          fault??=c.id+': '+versionTag+' native emitter audit failed; measurements withheld.';
        }
        return result;
      };
      continue;
    }

    const counted=!!isCountedOptical?.(c);
    const epTarget=endpointById.get(c.id)||null;
    const cTarget=circleById.get(c.id)||null;
    const redirector=!!isRedirector(c);
    if(!counted&&!epTarget&&!cTarget&&!redirector)continue;
    if(!nativeObj||typeof nativeObj.onRayIncident!=='function'){
      fault??=c.id+': native incident method unavailable for '+versionTag+' audit.';
      continue;
    }
    const original=nativeObj.onRayIncident;
    nativeObj.onRayIncident=function(...args){
      // Snapshot incoming ray state BEFORE pinned PhyDemo mutates ray.p1/p2.
      const inRay=cTarget?extractNativeRay(args[0]):null;
      const incidentPoint=args[2];
      const result=original.apply(this,args);
      if(counted)opticalIncidentsById[c.id]++;
      try{
        if(!fault&&epTarget){
          if(!incidentPoint||!Number.isFinite(incidentPoint.x)||!Number.isFinite(incidentPoint.y)){
            fault=c.id+': native ray incident point was non-finite.';
          }else{
            const x=incidentPoint.x,y=-incidentPoint.y;
            if(epTarget.endpoints.some(ep=>Math.hypot(x-ep.x,y-ep.y)<clearance))
              fault=c.id+': native ray struck within 0.01 mm of a '+endpointLabel+'; measurements withheld.';
          }
        }
        if(!fault&&cTarget){
          if(!inRay){
            fault=c.id+': native incident ray state was non-finite or degenerate; measurements withheld.';
          }else{
            for(const tc of cTarget.circles){
              const b=Math.abs(cross(delta(inRay.origin,tc.center),inRay.dir));
              if(!Number.isFinite(b)||Math.abs(b-tc.radius)<clearance){
                fault=c.id+': native incident ray struck within 0.01 mm of tangency to a '+surfaceLabel+' surface; measurements withheld.';
                break;
              }
            }
          }
        }
        if(redirector){
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
        fault??=c.id+': '+versionTag+' native incident audit failed; measurements withheld.';
      }
      return result;
    };
  }
  return {
    key,
    finish:()=>fault,
    ...(extraKey?{extra:()=>({[extraKey]:{...opticalIncidentsById}})}:{})
  };
}
