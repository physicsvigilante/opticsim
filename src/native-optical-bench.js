// Unified schema-v40 composable native optical bench.
// Composes 0-2 disjoint finite dielectric bodies (supporting zero-body deletion
// closure, index-matched neutral bodies, and exact interior-or-ambient single-ray
// source placement inside circles, prisms, and convex quads) with explicit
// ambient backgroundIndex, deterministic simulation.randomSeed, 0-4 coaxial
// ideal lenses, 0-2 curved mirrors, 0-2 plane mirrors, 0-2 opaque stops,
// 0-2 passive detectors, and either 1-4 single-ray sources or 1 external
// parallel beam (max 16 components, maxRayDepth <= 16).
// Pinned PhyDemo alone owns all ray intersections, refraction, TIR, reflection,
// lens deflection, and absorption.
import {CIRCULAR_TYPE,circularEncounter} from './circular-dielectric.js';
import {compositionCountsMatch} from './composition-profiles.js';
import {finiteSurfaceGeometry,pointWithinSupportingLineClearance,segmentsIntersect} from './composition-validation.js';
import {curvedPoints,isCurved} from './curved-mirrors.js';
import {FINITE_APERTURE_TYPE,separatedSegmentDistance} from './finite-aperture.js';
import {CIRCLE_BLOCKER_TYPE} from './opaque-circle-blocker.js';
import {BEAM_CLEARANCE_MM,PARALLEL_BEAM_TYPE} from './parallel-beam.js';
import {POLYGON_TYPE,polygonEncounter} from './polygon-dielectric.js';
import {SPHERICAL_LENS_TYPE,sphericalLensEncounter} from './spherical-lens.js';
import {PRISM_TYPE,prismEncounter} from './triangular-prism.js';
import {
  BENCH_CLEARANCE_MM,
  BENCH_NATIVE_STATE_LIMIT,
  DIELECTRIC_BODY_TYPES,
  allowedCoord,
  bodiesDisjointExact,
  buildDielectricBody,
  circleOutsideBodyExact,
  componentFiniteEndpoints,
  componentTangentCircles,
  cross,
  delta,
  dot,
  extractNativeRay,
  installBenchEndpointAudit,
  pointSegmentDistance,
  resolveSourceMembership,
  segmentOutsideBodyExact,
  signedSupportDistance,
  validateParallelBeamAdmission,
  validatePointSourceSeparation
} from './native-bench-common.js';

export const OPTICAL_BENCH_V40_VERSION=40;
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
    fail(path,'v40 optical bench supports either 1–4 point sources (single-ray, directional, or full-circle) or 1 external parallel beam, 0–2 disjoint finite dielectrics, 0–4 vertical ideal lenses, 0–2 curved mirrors, 0–2 plane mirrors, 0–2 opaque stops and 0–2 detectors (max 16 components).','UNSUPPORTED_SCOPE');

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

  // 0-2 disjoint finite dielectric bodies; each body's outsideIndex must match physics.backgroundIndex.
  const bodies=[];
  for(const [index,c] of components.entries()){
    if(!V40_DIELECTRIC_TYPES.includes(c.type))continue;
    const body=buildDielectricBody(c,`${path}[${index}].parameters`,fail);
    if(body.outsideIndex!==backgroundIndex)
      fail(`${path}[${index}].parameters.outsideIndex`,'Every finite dielectric body in v40 must match physics.backgroundIndex ('+backgroundIndex+').','UNSUPPORTED_SCOPE');
    bodies.push(body);
  }
  if(bodies.length===2&&!bodiesDisjointExact(bodies[0],bodies[1],OPTICAL_BENCH_V40_CLEARANCE_MM))
    fail(path,'Finite dielectric bodies must be disjoint with at least 0.01 mm clearance ('+bodies[0].id+' and '+bodies[1].id+').','UNSUPPORTED_SCOPE');

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

  // 0-4 independently centered vertical ideal thin lenses (x, y; focalLength in backgroundIndex).
  // Emitters stay >= 0.01 mm off each lens plane; vertically separated lenses at the same x
  // (e.g. Billet split lenses) are admitted when their finite segments are disjoint by >= 0.01 mm.
  for(const lens of components.filter(c=>c.type==='ideal-lens')){
    const lx=lens.parameters.x;
    if(points.some(s=>Math.abs(lx-s.x)<OPTICAL_BENCH_V40_CLEARANCE_MM))
      fail(path,'each point source must be separated from every lens plane by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&!(beamSeg.every(e=>e.x<=lx-BEAM_CLEARANCE_MM)||beamSeg.every(e=>e.x>=lx+BEAM_CLEARANCE_MM)))
      fail(path,'entire parallel emitter must lie at least 0.01 mm on one side of every lens plane','UNSUPPORTED_SCOPE');
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
      if(!circleOutsideBodyExact(disk,body,OPTICAL_BENCH_V40_CLEARANCE_MM))
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
  const segments=[];
  for(const [index,c] of components.entries()){
    if(!SEGMENT_TYPES.includes(c.type))continue;
    const p=c.parameters,cPath=`${path}[${index}]`;
    const {line,segments:arms}=finiteSurfaceGeometry(c,mirrorEndpoints);
    if(line.some(v=>!allowedCoord(v.x,v.y)))
      fail(cPath+'.parameters','segment endpoints exceed coordinate bounds','UNSUPPORTED_SCOPE');
    if(c.type!=='ideal-lens'){
      if(points.some(s=>pointWithinSupportingLineClearance(s,p,OPTICAL_BENCH_V40_CLEARANCE_MM)))
        fail(cPath+'.parameters','each source must be at least 0.01 mm from finite surface supporting line','UNSUPPORTED_SCOPE');
      if(beamSeg){
        const signed=beamSeg.map(v=>signedSupportDistance(v,line));
        if(signed.some(v=>!Number.isFinite(v)||Math.abs(v)<BEAM_CLEARANCE_MM)||signed[0]*signed[1]<=0)
          fail(cPath+'.parameters','entire parallel emitter must lie on one safe side of supporting line ('+c.id+')','UNSUPPORTED_SCOPE');
      }
    }
    for(const body of bodies)
      if(!segmentOutsideBodyExact(line,body,OPTICAL_BENCH_V40_CLEARANCE_MM))
        fail(cPath,'finite segment must lie outside dielectric body by at least 0.01 mm ('+body.id+' and '+c.id+')','UNSUPPORTED_SCOPE');
    for(const arm of arms){
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

function dielectricEncounter(component,nativePoint,incoming){
  if(component.type===CIRCULAR_TYPE)return circularEncounter(component,nativePoint,incoming);
  if(component.type===PRISM_TYPE)return prismEncounter(component,nativePoint,incoming);
  if(component.type===POLYGON_TYPE)return polygonEncounter(component,nativePoint,incoming);
  if(component.type===SPHERICAL_LENS_TYPE)return sphericalLensEncounter(component,nativePoint,incoming);
  return null;
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

  // Proportionate dielectric incidence check on each finite glass body:
  // fails closed on near-grazing (|d·n| <= 1e-4) or high-to-low near-critical
  // (|n_i sin(theta_i) - n_t| <= 1e-6) encounters without hooking private PhyDemo internals.
  for(const c of doc.physics.components){
    if(!V40_DIELECTRIC_TYPES.includes(c.type))continue;
    const nativeObj=scene.objs[idMap.get(c.id)];
    if(!nativeObj||typeof nativeObj.onRayIncident!=='function'){
      guardFault??=c.id+': native dielectric incident method unavailable for v40 audit.';
      continue;
    }
    const previous=nativeObj.onRayIncident;
    nativeObj.onRayIncident=function(...args){
      const inRay=extractNativeRay(args[0]);
      const incidentPoint=args[2];
      const result=previous.apply(this,args);
      if(!guardFault){
        try{
          if(!inRay||!incidentPoint||!Number.isFinite(incidentPoint.x)||!Number.isFinite(incidentPoint.y)){
            guardFault=c.id+': v40 dielectric incident ray or hit point was non-finite; measurements withheld.';
          }else{
            const enc=dielectricEncounter(c,incidentPoint,inRay.dir);
            if(!enc||enc.invalid||![enc.normal?.x,enc.normal?.y].every(Number.isFinite)){
              guardFault=c.id+': v40 dielectric encounter was ambiguous or near a vertex; measurements withheld.';
            }else{
              const cosTheta=Math.abs(dot(inRay.dir,enc.normal));
              if(!(cosTheta>V40_GRAZING_MIN_COS)){
                guardFault=c.id+': observed native ray approached dielectric surface within grazing tolerance (|d·n| <= '+V40_GRAZING_MIN_COS+'); measurements withheld.';
              }else if(enc.incidentIndex>enc.destinationIndex){
                const sinTheta=Math.abs(cross(inRay.dir,enc.normal));
                const margin=Math.abs(enc.incidentIndex*sinTheta-enc.destinationIndex);
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
    emitters:{
      rule:'Choose EITHER 1–4 point-source (single-ray, directional, or full-circle) OR 1 external parallel-beam (not both).',
      'point-source':{parameters:['x','y','brightness'],emission:{modes:['single-ray','directional','full-circle'],singleRayRequired:['directionDeg'],directionalRequired:['directionDeg','angleDeg']},interiorPlacement:'Allowed in ambient medium OR strictly inside circular-dielectric, triangular-prism, or polygon-dielectric (>= 0.01 mm from boundary). Exterior-only for spherical-lens.'},
      'parallel-beam':{parameters:['x','y','width','directionDeg','brightness'],interiorPlacement:'Must lie completely outside all finite dielectric bodies (>= 0.01 mm).'}
    },
    components:{
      finiteDielectrics:{groupCount:[0,2],note:'Zero-body deletion closure supported (2 -> 1 -> 0). Equal insideIndex === outsideIndex (index-matched neutral body) is admitted.',types:{
        'circular-dielectric':{parameters:['x','y','radius','insideIndex','outsideIndex','partialReflection']},
        'triangular-prism':{parameters:['x1','y1','x2','y2','x3','y3','insideIndex','outsideIndex','partialReflection']},
        'polygon-dielectric':{parameters:['x1','y1','x2','y2','x3','y3','x4','y4','insideIndex','outsideIndex','partialReflection']},
        'spherical-lens':{parameters:['x','y','apertureHeight','centerThickness','frontRadius','backRadius','insideIndex','outsideIndex','partialReflection'],note:'Biconvex positive radii; exterior sources only.'}
      }},
      'ideal-lens':{count:[0,4],parameters:['x','y','focalLength','apertureHeight'],note:'Vertical thin lens with independent transverse centre y (split lenses at the same x are admitted when vertically separated by >= 0.01 mm); focalLength defined in ambient medium backgroundIndex.'},
      'plane-mirror':{count:[0,2],parameters:['x','y','orientationDeg','length']},
      curvedMirrors:{groupCount:[0,2],types:{
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
