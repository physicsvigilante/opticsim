// Reviewed schema-v37 composable native optical bench admission, geometry, and
// route-independent observed native endpoint qualification.
// Unifies already-compiled PhyDemo reflective, thin-lens, opaque-stop, passive
// detector, point-source, and finite parallel-beam primitives under one strict
// non-intersection and clearance contract. Pinned PhyDemo alone traces all rays.
import {compositionCountsMatch} from './composition-profiles.js';
import {finiteSurfaceGeometry,pointWithinSupportingLineClearance,segmentsIntersect} from './composition-validation.js';
import {curvedFrame,curvedPoints,isCurved} from './curved-mirrors.js';
import {FINITE_APERTURE_TYPE,apertureGeometry,separatedSegmentDistance} from './finite-aperture.js';
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

  let beamSeg=null,beamDir=null,beamSamples=null;
  if(beams.length===1){
    const beam=beams[0],p=beam.parameters,g=parallelBeamGeometry(p);
    beamSeg=[g.p1,g.p2];
    beamDir=g.direction;
    if(!(p.width>=10&&p.width<=100&&beamSeg.every(e=>allowed(e.x,e.y))))
      fail(path,'The complete finite emitting segment must fit within +/-10000 mm; width 10–100 mm.','UNSUPPORTED_SCOPE');
    if(!Number.isFinite(rayDensity)||rayDensity<0.048||rayDensity>1)
      fail('$.simulation.rayDensity','Parallel-beam sampling must use the supported density range.','UNSUPPORTED_SCOPE');
    if(p.brightness>rayDensity)
      fail(path,'Beam brightness must not exceed ray density, avoiding silently saturated native per-ray brightness.','UNSUPPORTED_SCOPE');
    const witness=pinnedBeamAdmissionSamples(p,rayDensity);
    if(witness.nearHalfInteger||witness.samples.length<1||witness.samples.length>100)
      fail(path,'Native Beam requires 1–100 samples and a sample factor clear of a half-integer threshold.','UNSUPPORTED_SCOPE');
    beamSamples=witness.samples;
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

  // Curved mirror conservative bounding disks (>= 0.01 mm clearance).
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

export const V37_NATIVE_STATE_LIMIT=10000;

const delta=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;

function extractNativeRay(ray){
  const p=ray?.p1,q=ray?.p2;
  if(!p||!q||![p.x,p.y,q.x,q.y].every(Number.isFinite))return null;
  const vx=q.x-p.x,vy=-(q.y-p.y),len=Math.hypot(vx,vy);
  if(!(len>1e-12&&Number.isFinite(len)))return null;
  return {origin:{x:p.x,y:-p.y},dir:{x:vx/len,y:vy/len}};
}

function componentTangentCircles(c){
  const p=c.parameters;
  if(c.type===CIRCLE_BLOCKER_TYPE)
    return [{center:{x:p.x,y:p.y},radius:p.radius}];
  if(c.type==='circular-arc-mirror'){
    const {n}=curvedFrame(p);
    return [{center:{x:p.x+p.radius*n.x,y:p.y+p.radius*n.y},radius:Math.abs(p.radius)}];
  }
  return [];
}

// Route-independent observed native endpoint and tangency audit for v37:
// delegates every pinned PhyDemo emitter/incident callback exactly once, counts
// actual native optical encounters per stable element ID, and fails closed if
// any emitted, incoming, or outgoing native ray state approaches within 0.01 mm
// of a finite component endpoint (including transparent aperture gaps) or a
// circle-blocker / circular-arc-mirror tangency.
export function installGeneralBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints){
  let fault=null;
  let checkedStates=0;
  const opticalIncidentsById={};
  const endpointTargets=[];
  const endpointById=new Map();
  const circleTargets=[];
  const circleById=new Map();
  for(const c of doc.physics.components){
    const isOptical=c.type==='ideal-lens'||c.type==='plane-mirror'||isCurved(c.type);
    if(isOptical)opticalIncidentsById[c.id]=0;
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
  }

  function auditRayState(ray,sourceCompId){
    if(++checkedStates>V37_NATIVE_STATE_LIMIT){
      fault??=sourceCompId+': v37 native ray-state audit exceeded bounded state limit; measurements withheld.';
      return;
    }
    const state=extractNativeRay(ray);
    if(!state){
      fault??=sourceCompId+': v37 native ray state was non-finite or degenerate; measurements withheld.';
      return;
    }
    if(fault)return;
    for(const target of endpointTargets){
      for(const ep of target.endpoints){
        const offset=delta(state.origin,ep);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': v37 native endpoint proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<GENERAL_BENCH_CLEARANCE_MM){
          fault=target.id+': observed native ray passes within 0.01 mm of a finite component endpoint; measurements withheld.';
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
          fault=target.id+': v37 native circular/arc tangency check was non-finite; measurements withheld.';
          return;
        }
        if((sameBody||ahead>0)&&Math.abs(perp-tc.radius)<GENERAL_BENCH_CLEARANCE_MM){
          fault=target.id+': observed native ray approaches within 0.01 mm of tangency to a circular/arc surface; measurements withheld.';
          return;
        }
      }
    }
  }

  for(const c of doc.physics.components){
    const nativeObj=scene.objs[idMap.get(c.id)];
    if(c.type==='point-source'||c.type===PARALLEL_BEAM_TYPE){
      if(!nativeObj||typeof nativeObj.onSimulationStart!=='function'){
        fault??=c.id+': native emitter method unavailable for v37 audit.';
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
          fault??=c.id+': v37 native emitter audit failed; measurements withheld.';
        }
        return result;
      };
      continue;
    }

    const isOptical=c.type==='ideal-lens'||c.type==='plane-mirror'||isCurved(c.type);
    const epTarget=endpointById.get(c.id)||null;
    const cTarget=circleById.get(c.id)||null;
    if(!isOptical&&!epTarget&&!cTarget)continue;
    if(!nativeObj||typeof nativeObj.onRayIncident!=='function'){
      fault??=c.id+': native incident method unavailable for v37 audit.';
      continue;
    }
    const original=nativeObj.onRayIncident;
    nativeObj.onRayIncident=function(...args){
      const inRay=cTarget?extractNativeRay(args[0]):null;
      const incidentPoint=args[2];
      const result=original.apply(this,args);
      if(isOptical)opticalIncidentsById[c.id]++;
      try{
        if(!fault&&epTarget){
          if(!incidentPoint||!Number.isFinite(incidentPoint.x)||!Number.isFinite(incidentPoint.y)){
            fault=c.id+': native ray incident point was non-finite.';
          }else{
            const x=incidentPoint.x,y=-incidentPoint.y;
            if(epTarget.endpoints.some(ep=>Math.hypot(x-ep.x,y-ep.y)<GENERAL_BENCH_CLEARANCE_MM))
              fault=c.id+': native ray struck within 0.01 mm of a finite component endpoint; measurements withheld.';
          }
        }
        if(!fault&&cTarget){
          if(!inRay){
            fault=c.id+': native incident ray state was non-finite or degenerate; measurements withheld.';
          }else{
            for(const tc of cTarget.circles){
              const b=Math.abs(cross(delta(inRay.origin,tc.center),inRay.dir));
              if(!Number.isFinite(b)||Math.abs(b-tc.radius)<GENERAL_BENCH_CLEARANCE_MM){
                fault=c.id+': native incident ray struck within 0.01 mm of tangency to a circular/arc surface; measurements withheld.';
                break;
              }
            }
          }
        }
        if(isOptical){
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
        fault??=c.id+': v37 native incident audit failed; measurements withheld.';
      }
      return result;
    };
  }
  return {
    key:'v37EndpointsVerified',
    finish:()=>fault,
    extra:()=>({v37OpticalIncidentsById:{...opticalIncidentsById}})
  };
}
