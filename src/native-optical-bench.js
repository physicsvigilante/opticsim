// Unified schema-v40 composable native optical bench.
// Composes 0-2 finite dielectric bodies (disjoint >= 0.01 mm, clean coincident
// flat-face contact, or coaxial cemented doublets; supporting zero-body deletion
// closure, index-matched neutral bodies, and exact interior-or-ambient point
// source placement inside circles, prisms, and convex quads) with explicit
// ambient backgroundIndex, deterministic simulation.randomSeed, 0-4 vertical
// ideal lenses (independent x, y including vertically separated split lenses),
// 0-2 curved mirrors (disjoint or concentric curved-silvered), 0-2 plane mirrors
// (disjoint or flat-silvered), 0-2 opaque stops, 0-2 passive detectors, and
// either 1-4 point sources (single-ray, directional, or full-circle) or 1
// external parallel beam (max 16 components, maxRayDepth <= 16).
// Pinned PhyDemo alone owns all ray intersections, refraction, TIR, reflection,
// lens deflection, and absorption.
import {compositionCountsMatch} from './composition-profiles.js';
import {finiteSurfaceGeometry,segmentsIntersect} from './composition-validation.js';
import {curvedFrame,curvedPoints,isCurved} from './curved-mirrors.js';
import {FINITE_APERTURE_TYPE,separatedSegmentDistance} from './finite-aperture.js';
import {CIRCLE_BLOCKER_TYPE} from './opaque-circle-blocker.js';
import {BEAM_CLEARANCE_MM,PARALLEL_BEAM_TYPE} from './parallel-beam.js';
import {
  BENCH_CLEARANCE_MM,
  BENCH_CONTACT_TOL_MM,
  BENCH_NATIVE_STATE_LIMIT,
  DIELECTRIC_BODY_TYPES,
  OPTICAL_BENCH_V40_VERSION,
  allowedCoord,
  arcMirrorCoincidentWithBody,
  bodiesDisjointExact,
  bodiesShareFlatContact,
  buildDielectricBody,
  circleOutsideBodyExact,
  componentFiniteEndpoints,
  componentTangentCircles,
  cross,
  delta,
  dielectricEncounter,
  dot,
  extractNativeRay,
  installBenchEndpointAudit,
  planeMirrorCoincidentWithBody,
  pointSegmentDistance,
  resolveMergedDielectricIndices,
  resolveSourceMembership,
  segmentOutsideBodyExact,
  sphericalLensesCemented,
  validateParallelBeamAdmission,
  validatePointSourceSeparation
} from './native-bench-common.js';

export {OPTICAL_BENCH_V40_VERSION,dielectricEncounter,resolveMergedDielectricIndices};
export const OPTICAL_BENCH_V40_MODEL='native-optical-bench';
export const OPTICAL_BENCH_V40_MAX_COMPONENTS=16;
export const OPTICAL_BENCH_V40_CLEARANCE_MM=BENCH_CLEARANCE_MM;
export const V40_MAX_RAY_DEPTH=16;
export const V40_DEFAULT_RANDOM_SEED='opticsim-v40-seed-v1';
export const V40_NATIVE_STATE_LIMIT=BENCH_NATIVE_STATE_LIMIT;
export const V40_GRAZING_MIN_COS=1e-4;
export const V40_CRITICAL_MIN_MARGIN=1e-6;
export const V40_DIELECTRIC_TYPES=DIELECTRIC_BODY_TYPES;

const SEGMENT_TYPES=Object.freeze(['ideal-lens','plane-mirror','line-blocker',FINITE_APERTURE_TYPE,'ray-detector']);

export function isValidRandomSeed(seed){
  return typeof seed==='string'&&seed.length>=1&&seed.length<=64&&
    seed.trim().length>=1&&!/[\u0000-\u001f\u007f]/.test(seed);
}

export function validateNativeOpticalBenchV40(components,backgroundIndex,rayDensity,mirrorEndpoints,fail){
  const path='$.physics.components';
  if(!compositionCountsMatch(components,OPTICAL_BENCH_V40_MODEL,OPTICAL_BENCH_V40_VERSION)||
     components.length>OPTICAL_BENCH_V40_MAX_COMPONENTS)
    fail(path,'v40 optical bench supports either 1–4 point sources (single-ray, directional, or full-circle) or 1 external parallel beam, 0–2 finite dielectrics (disjoint, coincident flat contact, or coaxial cemented doublet), 0–4 vertical ideal lenses, 0–2 curved mirrors, 0–2 plane mirrors, 0–2 opaque stops and 0–2 detectors (max 16 components).','UNSUPPORTED_SCOPE');

  const sources=components.filter(c=>c.type==='point-source');
  const beams=components.filter(c=>c.type===PARALLEL_BEAM_TYPE);
  if(!((sources.length>=1&&beams.length===0)||(sources.length===0&&beams.length===1)))
    fail(path,'v40 optical bench requires either 1–4 point sources or 1 parallel beam, not both.','UNSUPPORTED_SCOPE');

  const points=sources.map(c=>c.parameters);
  validatePointSourceSeparation(points,OPTICAL_BENCH_V40_CLEARANCE_MM,path,fail);

  const initialRays=[];
  for(const s of sources){
    if(!['single-ray','directional','full-circle'].includes(s.emission.mode))
      fail(path,'v40 point sources support single-ray, directional, or full-circle emission.','UNSUPPORTED_SCOPE');
    if(s.emission.mode==='single-ray'){
      const a=s.emission.directionDeg*Math.PI/180;
      initialRays.push({origin:{x:s.parameters.x,y:s.parameters.y},dir:{x:Math.cos(a),y:Math.sin(a)}});
    }
  }

  let beamSeg=null;
  if(beams.length===1){
    const admitted=validateParallelBeamAdmission(beams[0],rayDensity,path,fail);
    beamSeg=admitted.beamSeg;
    for(const origin of admitted.samples)initialRays.push({origin,dir:admitted.beamDir});
  }

  // 0-2 finite dielectric bodies; each body's outsideIndex must match physics.backgroundIndex.
  // v40 admits signed/flat radii on spherical-lens (+ convex outward, - concave inward, null flat).
  const bodies=[],bodyComps=[];
  for(const [index,c] of components.entries()){
    if(!V40_DIELECTRIC_TYPES.includes(c.type))continue;
    const body=buildDielectricBody(c,`${path}[${index}].parameters`,fail,{allowSignedSpherical:true});
    if(body.outsideIndex!==backgroundIndex)
      fail(`${path}[${index}].parameters.outsideIndex`,'Every finite dielectric body in v40 must match physics.backgroundIndex ('+backgroundIndex+').','UNSUPPORTED_SCOPE');
    bodies.push(body);
    bodyComps.push(c);
  }
  if(bodies.length===2&&!bodiesDisjointExact(bodies[0],bodies[1],OPTICAL_BENCH_V40_CLEARANCE_MM)){
    if(!bodiesShareFlatContact(bodies[0],bodies[1])&&!sphericalLensesCemented(bodies[0],bodies[1]))
      fail(path,'Finite dielectric bodies must be disjoint (>= 0.01 mm clearance), share a clean coincident flat boundary, or form a coaxial cemented doublet ('+bodies[0].id+' and '+bodies[1].id+').','UNSUPPORTED_SCOPE');
    if(bodyComps[0].parameters.partialReflection!==bodyComps[1].parameters.partialReflection)
      fail(path,'Touching or cemented dielectric bodies require matching partialReflection flags so the shared interface has one unambiguous Fresnel policy ('+bodies[0].id+' and '+bodies[1].id+').','UNSUPPORTED_SCOPE');
  }

  // Point sources may start in ambient medium OR strictly inside a circle, prism, or convex quad (>= 0.01 mm clearance).
  // Spherical lenses remain exterior-only in v40; parallel beams must lie strictly outside all bodies.
  for(const s of sources){
    const m=resolveSourceMembership(s.parameters,bodies,backgroundIndex,OPTICAL_BENCH_V40_CLEARANCE_MM);
    if(m.status==='boundary')
      fail(path,'Point source '+s.id+' must be at least 0.01 mm from dielectric body boundary ('+m.bodyId+').','UNSUPPORTED_SCOPE');
    if(m.status==='unsupported-interior')
      fail(path,'Point source '+s.id+' must lie outside spherical-lens bodies by at least 0.01 mm ('+m.bodyId+').','UNSUPPORTED_SCOPE');
    if(m.status==='ambiguous')
      fail(path,'Point source '+s.id+' has ambiguous dielectric membership ('+m.bodyId+').','UNSUPPORTED_SCOPE');
  }
  if(beamSeg){
    for(const body of bodies)
      if(!segmentOutsideBodyExact(beamSeg,body,OPTICAL_BENCH_V40_CLEARANCE_MM))
        fail(path,'Parallel emitter must lie completely outside every dielectric body by at least 0.01 mm ('+body.id+').','UNSUPPORTED_SCOPE');
  }

  // Curved mirrors (>= 0.01 mm clearance from emitters, bodies, and each other).
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
      if(Math.hypot(other.center.x-disk.center.x,other.center.y-disk.center.y)<other.radius+disk.radius+OPTICAL_BENCH_V40_CLEARANCE_MM)
        fail(path,'Curved aperture bounding disks must be separated by at least 0.01 mm ('+other.id+' and '+disk.id+').','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-disk.center.x,s.y-disk.center.y)<disk.radius+OPTICAL_BENCH_V40_CLEARANCE_MM))
      fail(path,'Point source must lie at least 0.01 mm outside curved aperture bounding disk ('+disk.id+').','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(disk.center,beamSeg)<disk.radius+OPTICAL_BENCH_V40_CLEARANCE_MM)
      fail(path,'Parallel emitter must lie at least 0.01 mm outside curved aperture bounding disk ('+disk.id+').','UNSUPPORTED_SCOPE');
    for(const body of bodies)
      if(!circleOutsideBodyExact(disk,body,OPTICAL_BENCH_V40_CLEARANCE_MM)&&!arcMirrorCoincidentWithBody(c,body))
        fail(path,'Curved mirror bounding disk must lie outside dielectric body by at least 0.01 mm or silver a coincident curved face ('+body.id+' and '+c.id+').','UNSUPPORTED_SCOPE');
    curveDisks.push(disk);
  }

  // Opaque circle blockers (>= 0.01 mm clearance from emitters, bodies, curved disks, and each other).
  const circleDisks=[];
  for(const [index,c] of components.entries()){
    if(c.type!==CIRCLE_BLOCKER_TYPE)continue;
    const p=c.parameters,cPath=`${path}[${index}].parameters`;
    if(Math.abs(p.x)+p.radius>10000||Math.abs(p.y)+p.radius>10000)
      fail(cPath,'entire opaque circle must remain within +/-10000 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<p.radius+OPTICAL_BENCH_V40_CLEARANCE_MM))
      fail(cPath,'each source must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&pointSegmentDistance(p,beamSeg)<p.radius+OPTICAL_BENCH_V40_CLEARANCE_MM)
      fail(cPath,'parallel emitter must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    const disk={id:c.id,center:{x:p.x,y:p.y},radius:p.radius};
    for(const other of circleDisks)
      if(Math.hypot(other.center.x-p.x,other.center.y-p.y)<other.radius+p.radius+OPTICAL_BENCH_V40_CLEARANCE_MM)
        fail(path,'opaque circles overlap or touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const d of curveDisks)
      if(Math.hypot(d.center.x-p.x,d.center.y-p.y)<d.radius+p.radius+OPTICAL_BENCH_V40_CLEARANCE_MM)
        fail(path,'opaque circle overlaps curved mirror bounding disk ('+d.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const body of bodies)
      if(!circleOutsideBodyExact(disk,body,OPTICAL_BENCH_V40_CLEARANCE_MM))
        fail(path,'opaque circle must lie outside dielectric body by at least 0.01 mm ('+body.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    circleDisks.push(disk);
  }

  // Finite segment components: ideal lenses, plane mirrors, line blockers, finite apertures, detectors.
  // Emitters require >= 0.01 mm clearance from every actual finite segment (not its infinite line extension),
  // admitting side-by-side / L-shaped JEE setups while endpoint and runtime audits still fail closed on grazing rays.
  const segments=[];
  for(const [index,c] of components.entries()){
    if(!SEGMENT_TYPES.includes(c.type))continue;
    const cPath=`${path}[${index}]`;
    const {line,segments:arms}=finiteSurfaceGeometry(c,mirrorEndpoints);
    if(line.some(v=>!allowedCoord(v.x,v.y)))
      fail(cPath+'.parameters','segment endpoints exceed coordinate bounds','UNSUPPORTED_SCOPE');
    for(const body of bodies)
      if(!segmentOutsideBodyExact(line,body,OPTICAL_BENCH_V40_CLEARANCE_MM)&&
         !(c.type==='plane-mirror'&&planeMirrorCoincidentWithBody(line,body)))
        fail(cPath,'finite segment must lie outside dielectric body by at least 0.01 mm or (for a plane-mirror) sit flush on a flat dielectric face ('+body.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const arm of arms){
      if(points.some(s=>pointSegmentDistance(s,arm)<OPTICAL_BENCH_V40_CLEARANCE_MM))
        fail(cPath+'.parameters','each source must be at least 0.01 mm from finite segment ('+c.id+')','UNSUPPORTED_SCOPE');
      if(beamSeg&&(segmentsIntersect(beamSeg,arm)||separatedSegmentDistance(beamSeg,arm)<BEAM_CLEARANCE_MM))
        fail(cPath+'.parameters','parallel emitter must keep at least 0.01 mm clearance from finite segment ('+c.id+')','UNSUPPORTED_SCOPE');
      for(const other of segments){
        if(other.id===c.id)continue;
        if(segmentsIntersect(other.line,arm)||separatedSegmentDistance(other.line,arm)<OPTICAL_BENCH_V40_CLEARANCE_MM)
          fail(cPath,'finite segments intersect or nearly touch ('+other.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      }
      for(const d of curveDisks)
        if(pointSegmentDistance(d.center,arm)<d.radius+OPTICAL_BENCH_V40_CLEARANCE_MM)
          fail(cPath,'finite segment enters curved mirror bounding disk ('+d.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      for(const circle of circleDisks)
        if(pointSegmentDistance(circle.center,arm)<circle.radius+OPTICAL_BENCH_V40_CLEARANCE_MM)
          fail(cPath,'finite segment intersects or nearly touches opaque circle ('+circle.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
      segments.push({id:c.id,line:arm});
    }
  }

  // Initial forward ray corner/vertex, circle/lens/arc/blocker-tangency, and finite-endpoint guards.
  for(const {origin,dir} of initialRays){
    for(const body of bodies){
      for(const corner of body.corners){
        const offset=delta(origin,corner);
        if(dot(offset,dir)>0&&Math.abs(cross(offset,dir))<OPTICAL_BENCH_V40_CLEARANCE_MM)
          fail(path,'Initial forward ray passes within 0.01 mm of a dielectric corner/vertex ('+body.id+').','UNSUPPORTED_SCOPE');
      }
    }
    for(const c of components){
      for(const tc of componentTangentCircles(c)){
        const offset=delta(origin,tc.center);
        if(dot(offset,dir)>0&&Math.abs(Math.abs(cross(offset,dir))-tc.radius)<OPTICAL_BENCH_V40_CLEARANCE_MM)
          fail(path,'Initial forward ray is within 0.01 mm of tangency to a circular/spherical/arc surface ('+c.id+').','UNSUPPORTED_SCOPE');
      }
      for(const ep of componentFiniteEndpoints(c,mirrorEndpoints)){
        const offset=delta(origin,ep);
        if(dot(offset,dir)>0&&Math.abs(cross(offset,dir))<OPTICAL_BENCH_V40_CLEARANCE_MM)
          fail(path,'Initial forward ray passes within 0.01 mm of a finite component endpoint ('+c.id+').','UNSUPPORTED_SCOPE');
      }
      if(c.type==='ideal-lens'&&Math.abs(dir.x)>1e-12){
        const tPlane=(c.parameters.x-origin.x)/dir.x;
        if(tPlane>0){
          const yHit=origin.y+tPlane*dir.y;
          if(Math.abs(Math.abs(yHit-(c.parameters.y??0))-c.parameters.apertureHeight/2)<OPTICAL_BENCH_V40_CLEARANCE_MM)
            fail(path,'Initial forward ray meets finite ideal-lens rim within 0.01 mm ('+c.id+').','UNSUPPORTED_SCOPE');
        }
      }
    }
  }
}

export function installNativeOpticalBenchV40Audit(doc,scene,idMap,mirrorEndpoints){
  const isOptical=c=>c.type==='ideal-lens'||c.type==='plane-mirror'||isCurved(c.type);
  const baseAudit=installBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints,{
    versionTag:'v40',
    key:'v40EndpointsVerified',
    clearance:OPTICAL_BENCH_V40_CLEARANCE_MM,
    stateLimit:V40_NATIVE_STATE_LIMIT,
    isRedirector:c=>V40_DIELECTRIC_TYPES.includes(c.type)||isOptical(c),
    isCountedOptical:isOptical,
    extraKey:'v40OpticalIncidentsById',
    surfaceLabel:'circular/spherical/arc'
  });

  let guardFault=null;
  if(scene.randomSeed!==doc.simulation.randomSeed)
    guardFault='v40 deterministic randomSeed was not applied to the native scene; measurements withheld.';

  const nativeToComp=new Map(doc.physics.components.map(c=>[scene.objs[idMap.get(c.id)],c]));

  // Precompute admitted touching/silvered contact pairs so the runtime audit fails closed
  // if an intended coincident surface fails to trigger PhyDemo surfaceMergingObjs.
  const auditBodies=[];
  for(const c of doc.physics.components){
    if(!V40_DIELECTRIC_TYPES.includes(c.type))continue;
    const body=buildDielectricBody(c,'$',()=>{},{allowSignedSpherical:true});
    auditBodies.push({comp:c,body});
  }
  const touchingPartnerById=new Map();
  if(auditBodies.length===2&&!bodiesDisjointExact(auditBodies[0].body,auditBodies[1].body,OPTICAL_BENCH_V40_CLEARANCE_MM)){
    touchingPartnerById.set(auditBodies[0].comp.id,auditBodies[1].comp);
    touchingPartnerById.set(auditBodies[1].comp.id,auditBodies[0].comp);
  }
  const flushMirrorsByBodyId=new Map();
  for(const c of doc.physics.components){
    if(c.type==='plane-mirror'){
      const seg=mirrorEndpoints(c.parameters);
      for(const {comp,body} of auditBodies){
        if(!segmentOutsideBodyExact(seg,body,OPTICAL_BENCH_V40_CLEARANCE_MM)&&planeMirrorCoincidentWithBody(seg,body)){
          if(!flushMirrorsByBodyId.has(comp.id))flushMirrorsByBodyId.set(comp.id,[]);
          flushMirrorsByBodyId.get(comp.id).push({kind:'plane',id:c.id,seg});
        }
      }
    }else if(c.type==='circular-arc-mirror'){
      const p=c.parameters,{n}=curvedFrame(p),pts=curvedPoints(c);
      const disk={center:{x:p.x,y:p.y},radius:Math.hypot(pts[0].x-p.x,pts[0].y-p.y)};
      const center={x:p.x+p.radius*n.x,y:p.y+p.radius*n.y},radius=Math.abs(p.radius);
      const sgn=Math.sign(p.radius);
      const uVertex={x:-sgn*n.x,y:-sgn*n.y};
      const halfAngle=Math.asin(Math.min(1,p.apertureHeight/(2*radius)));
      for(const {comp,body} of auditBodies){
        if(!circleOutsideBodyExact(disk,body,OPTICAL_BENCH_V40_CLEARANCE_MM)&&arcMirrorCoincidentWithBody(c,body)){
          if(!flushMirrorsByBodyId.has(comp.id))flushMirrorsByBodyId.set(comp.id,[]);
          flushMirrorsByBodyId.get(comp.id).push({kind:'arc',id:c.id,center,radius,uVertex,halfAngle});
        }
      }
    }
  }
  function pointOnFlushMirror(pt,m){
    const eps=1e-5;
    if(m.kind==='plane')return pointSegmentDistance(pt,m.seg)<=eps;
    const dx=pt.x-m.center.x,dy=pt.y-m.center.y,r=Math.hypot(dx,dy);
    if(!(r>0)||Math.abs(r-m.radius)>eps)return false;
    // Exact angular arc inclusion around center (arc-length overhang strictly <= eps):
    const uPt={x:dx/r,y:dy/r};
    const angle=Math.atan2(Math.abs(cross(m.uVertex,uPt)),dot(m.uVertex,uPt));
    return angle<=m.halfAngle+eps/m.radius;
  }

  // Proportionate dielectric incidence check on each finite glass body:
  // fails closed on near-grazing (|d·n| <= 1e-4), high-to-low near-critical
  // (|n_i sin(theta_i) - n_t| <= 1e-6), or unmerged hits on an intended touching/silvered contact
  // without hooking private PhyDemo internals.
  for(const c of doc.physics.components){
    if(!V40_DIELECTRIC_TYPES.includes(c.type))continue;
    const nativeObj=scene.objs[idMap.get(c.id)];
    if(!nativeObj||typeof nativeObj.onRayIncident!=='function'){
      guardFault??=c.id+': native dielectric incident method unavailable for v40 audit.';
      continue;
    }
    const partner=touchingPartnerById.get(c.id)||null;
    const flushMirrors=flushMirrorsByBodyId.get(c.id)||[];
    const previous=nativeObj.onRayIncident;
    nativeObj.onRayIncident=function(...args){
      const inRay=extractNativeRay(args[0]);
      const incidentPoint=args[2];
      const mergedObjs=args[3];
      const result=previous.apply(this,args);
      if(!guardFault){
        try{
          if(!inRay||!incidentPoint||!Number.isFinite(incidentPoint.x)||!Number.isFinite(incidentPoint.y)){
            guardFault=c.id+': v40 dielectric incident ray or hit point was non-finite; measurements withheld.';
          }else{
            const enc=dielectricEncounter(c,incidentPoint,inRay.dir);
            const eff=resolveMergedDielectricIndices(c,enc,incidentPoint,inRay.dir,mergedObjs,nativeToComp);
            const hitYUp={x:incidentPoint.x,y:-incidentPoint.y};
            const bypassedMirror=flushMirrors.find(m=>pointOnFlushMirror(hitYUp,m));
            if(bypassedMirror){
              guardFault=c.id+': observed hit on silvered face ('+bypassedMirror.id+') bypassed native mirror merge; measurements withheld.';
            }else if(partner&&(!Array.isArray(mergedObjs)||mergedObjs.length===0)&&
                     !dielectricEncounter(partner,incidentPoint,inRay.dir)?.invalid){
              guardFault=c.id+': observed hit on shared contact boundary with '+partner.id+' did not merge in native simulator; measurements withheld.';
            }else if(!enc||enc.invalid||eff.invalid||![enc.normal?.x,enc.normal?.y].every(Number.isFinite)){
              guardFault=c.id+': v40 dielectric encounter was ambiguous or near a vertex; measurements withheld.';
            }else{
              const cosTheta=Math.abs(dot(inRay.dir,enc.normal));
              if(!(cosTheta>V40_GRAZING_MIN_COS)){
                guardFault=c.id+': observed native ray approached dielectric surface within grazing tolerance (|d·n| <= '+V40_GRAZING_MIN_COS+'); measurements withheld.';
              }else if(eff.incidentIndex>eff.destinationIndex){
                const sinTheta=Math.abs(cross(inRay.dir,enc.normal));
                const margin=Math.abs(eff.incidentIndex*sinTheta-eff.destinationIndex);
                if(!(margin>V40_CRITICAL_MIN_MARGIN))
                  guardFault=c.id+': observed native ray fell within near-critical TIR margin (|n_i sin(theta) - n_t| <= '+V40_CRITICAL_MIN_MARGIN+'); measurements withheld.';
              }
            }
          }
        }catch{
          guardFault=c.id+': v40 dielectric incidence audit failed; measurements withheld.';
        }
      }
      return result;
    };
  }

  return {
    key:'v40EndpointsVerified',
    finish:()=>guardFault||baseAudit.finish(),
    extra:()=>baseAudit.extra()
  };
}

// Focused, self-contained v40 capability summary for independent LLMs and teachers
// who want to author, revise, and explore physical scenes without learning v1-v39 history.
export function opticalBenchCapabilities(){
  return {
    format:'opticsim-optical-bench-capabilities-v40',
    schemaVersion:OPTICAL_BENCH_V40_VERSION,
    model:OPTICAL_BENCH_V40_MODEL,
    coordinates:'x-right-y-up',
    lengthUnits:['mm','cm','m'],
    requiredRequestFields:['model','lengthUnit','backgroundIndex','components'],
    optionalRequestFields:['title','runPolicy','randomSeed'],
    backgroundIndex:{range:[1,4],rule:'Explicit ambient refractive index preserved across body additions/deletions; every finite dielectric body must use this exact value as its outsideIndex.'},
    randomSeed:{default:V40_DEFAULT_RANDOM_SEED,rule:'Deterministic seed passed to pinned PhyDemo Scene.randomSeed; required in canonical saved v40 JSON.'},
    runPolicies:{
      'bench-v40':{rayDensity:0.2,maxRayDepth:V40_MAX_RAY_DEPTH,processedRayLimit:10000,default:true},
      'bench-v40-dense':{rayDensity:1,maxRayDepth:V40_MAX_RAY_DEPTH,processedRayLimit:10000},
      'preview-v1':{rayDensity:0.2,maxRayDepth:8,processedRayLimit:10000},
      'dense-v1':{rayDensity:1,maxRayDepth:8,processedRayLimit:10000}
    },
    maxComponents:OPTICAL_BENCH_V40_MAX_COMPONENTS,
    maxRayDepth:V40_MAX_RAY_DEPTH,
    clearanceMm:OPTICAL_BENCH_V40_CLEARANCE_MM,
    contactToleranceMm:BENCH_CONTACT_TOL_MM,
    emitters:{
      rule:'Choose EITHER 1–4 point-source (single-ray, directional, or full-circle) OR 1 external parallel-beam (not both).',
      'point-source':{parameters:['x','y','brightness'],emission:{modes:['single-ray','directional','full-circle'],singleRayRequired:['directionDeg'],directionalRequired:['directionDeg','angleDeg']},interiorPlacement:'Allowed in ambient medium OR strictly inside circular-dielectric, triangular-prism, or polygon-dielectric (>= 0.01 mm from boundary). Exterior-only for spherical-lens.'},
      'parallel-beam':{parameters:['x','y','width','directionDeg','brightness'],interiorPlacement:'Must lie completely outside all finite dielectric bodies (>= 0.01 mm).'}
    },
    components:{
      finiteDielectrics:{groupCount:[0,2],note:'Zero-body deletion closure (2 -> 1 -> 0) and equal-index neutral bodies admitted. Two bodies may be disjoint (>= 0.01 mm), share a clean coincident flat boundary (<= 1e-11 mm, overlap >= 1 mm; layered slabs, water-on-glass, prism-on-slab, flat lens on slab), or form a coaxial cemented doublet (<= 1e-11 mm matching opposite-signed curvature at shared apex). Touching or cemented glass-glass pairs require matching partialReflection flags so the shared interface has one unambiguous Fresnel policy. Native PhyDemo surfaceMergingObjs (1e-6 mm hit-point merge threshold) owns merged refraction/TIR; callbacks fire on the primary body only, reporting true merged incident/destination indices, and unmerged hits on a shared contact boundary fail closed.',types:{
        'circular-dielectric':{parameters:['x','y','radius','insideIndex','outsideIndex','partialReflection']},
        'triangular-prism':{parameters:['x1','y1','x2','y2','x3','y3','insideIndex','outsideIndex','partialReflection']},
        'polygon-dielectric':{parameters:['x1','y1','x2','y2','x3','y3','x4','y4','insideIndex','outsideIndex','partialReflection']},
        'spherical-lens':{parameters:['x','y','apertureHeight','centerThickness','frontRadius','backRadius','insideIndex','outsideIndex','partialReflection'],note:'Signed outward-convex convention: positive radius bulges outward (convex), negative curves inward (concave), null is a flat/planar face (R = infinity). Supports biconvex, plano-convex, plano-concave, meniscus, biconcave, and flat-flat shapes. Textbook Cartesian equivalents: R1 = frontRadius, R2 = -backRadius. Requires |radius| >= apertureHeight/2 + 1 mm (or null), centerThickness >= 2 mm, edgeThickness >= 1 mm; exterior sources only.'}
      }},
      'ideal-lens':{count:[0,4],parameters:['x','y','focalLength','apertureHeight'],note:'Vertical thin lens with independent transverse centre y (split lenses at the same x are admitted when vertically separated by >= 0.01 mm); focalLength defined in ambient medium backgroundIndex.'},
      'plane-mirror':{count:[0,2],parameters:['x','y','orientationDeg','length'],note:'May sit >= 0.01 mm clear of dielectrics OR flush on a physical flat dielectric face (silvered slab, silvered prism, flat-silvered lens, or mirror table) via native PhyDemo mergesWithGlass.'},
      curvedMirrors:{groupCount:[0,2],note:'circular-arc-mirror may sit >= 0.01 mm clear of dielectrics OR concentric and flush on a curved spherical-lens face or circular-dielectric boundary (curved-silvered lens / silvered sphere) via native PhyDemo mergesWithGlass.',types:{
        'ideal-curved-mirror':{parameters:['x','y','normalDeg','focalLength','apertureHeight']},
        'circular-arc-mirror':{parameters:['x','y','normalDeg','radius','apertureHeight']}
      }},
      opaqueStops:{groupCount:[0,2],types:{
        'line-blocker':{parameters:['x','y','orientationDeg','length']},
        'circle-blocker':{parameters:['x','y','radius']},
        'finite-aperture':{parameters:['x','y','orientationDeg','length','openingLength']}
      }},
      'ray-detector':{count:[0,2],parameters:['x','y','orientationDeg','length']}
    },
    revisions:{
      targeted:'reviseScene(doc, {changes:[{id, section, key, value, unit?}]})',
      structural:'reviseComponents(doc, {format:"opticsim-component-revision-v1", operations:[{op:"add", lengthUnit, component} | {op:"remove", id}]})',
      closure:'Adding or removing bodies within 0–2 preserves physics.backgroundIndex and simulation.randomSeed.'
    },
    observables:[
      'source-emissions','interface-interactions','interface-incidence-angle',
      'interface-transmission-angle','interface-reflection-angle','interface-tir-count',
      'interface-first-event','interface-face-events','mirror-reflections',
      'blocker-absorptions','detector-crossings','detector-signed-power','detector-hit-events'
    ],
    safeguards:[
      'Disjoint finite bodies and >= 0.01 mm surface/endpoint/vertex clearances.',
      'Observed native endpoint, corner, circular/spherical/arc tangency, near-grazing (|d·n| <= 1e-4), and high-to-low near-critical (|n_i sin(theta) - n_t| <= 1e-6) guards fail closed (v40EndpointsVerified).',
      'Pinned PhyDemo owns all ray tracing; partialReflection=false explicitly omits Fresnel partial reflections while keeping native TIR.'
    ]
  };
}
