import {IMMERSED_ARC_MODEL,IMMERSED_ARC_VERSION} from './immersed-arc-plane-port.js';
import {GENERAL_BENCH_MODEL,GENERAL_BENCH_VERSION} from './native-general-optical-bench.js';
import {HYBRID_BENCH_MODEL,HYBRID_BENCH_VERSION} from './native-general-hybrid-bench.js';
import {
  OPTICAL_BENCH_V40_MODEL,
  OPTICAL_BENCH_V40_VERSION,
  V40_DEFAULT_RANDOM_SEED,
  V40_MAX_RAY_DEPTH,
  isValidRandomSeed,
  opticalBenchCapabilities
} from './native-optical-bench.js';
export {opticalBenchCapabilities};
import {REFRACTIVE_BENCH_MODEL,REFRACTIVE_BENCH_VERSION} from './native-general-refractive-bench.js';
import {MIRROR_BOX_MODEL,MIRROR_BOX_VERSION} from './native-mirror-box.js';
import {GUIDE_FAN_MODEL,GUIDE_FAN_VERSION} from './finite-guide-fan.js';
import {CAP_TYPE,CAP_MODEL,CAP_VERSION,capExtents} from './finite-circular-cap.js';
import {SLAB_ARC_MODEL} from './slab-arc-return.js';
import {CURVED_BEAM_MODEL} from './curved-entry-beam.js';
import {REFRACTIVE_FAN_MODEL} from './refractive-fan.js';
import {POST_LENS_MODEL} from './post-lens-aperture.js';
import {compositionCapabilities,compositionSourceModes,selectAuthoringComposition} from './composition-profiles.js';
// Small LLM authoring view over the EXISTING strict opticsim scene contract.
// Interpret/choose physics outside this module. No new ray tracing, geometry DSL,
// physical parameter guessing, implicit native JSON or network service.
import {FINITE_COMPOSITION_MODEL,FINITE_COMPOSITION_VERSION,extendedFiniteCompositionPolicy,finiteShapeCompositionPolicy,finiteBlockerCompositionPolicy} from './finite-dielectric-composition.js';
import {NATIVE_OBSERVATION_KEYS} from './native-observations.js';
import {PRISM_TYPE,prismVertices} from './triangular-prism.js';
import {PRISM_BEAM_VERSION,PRISM_BEAM_MODEL,PRISM_BEAM_VERTEX_CLEARANCE_MM} from './native-prism-beam.js';
import {CIRCLE_BEAM_VERSION,CIRCLE_BEAM_MODEL,CIRCLE_BEAM_INITIAL_TRANSVERSE_FRACTION,CIRCLE_BEAM_NATIVE_RADIAL_TOLERANCE_MM,CIRCLE_BEAM_CRITICAL_MARGIN} from './native-circle-beam.js';
import {POLYGON_TYPE,polygonVertices} from './polygon-dielectric.js';
import {SPHERICAL_LENS_TYPE,thickLensExtents} from './spherical-lens.js';
import {TWO_THICK_MIRROR_VERSION,TWO_THICK_MIRROR_MODEL,TWO_THICK_MIRROR_NATIVE_DEPTH} from './two-thick-lens-mirror-composition.js';
import {THICK_APERTURE_VERSION,THICK_APERTURE_MODEL,THICK_APERTURE_NATIVE_DEPTH} from './thick-lens-aperture-composition.js'
import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';
import {SEMICIRCULAR_TYPE,SEMICIRCULAR_VERSION,SEMICIRCULAR_MODEL,SEMICIRCULAR_PARAMETERS,semicircularExtents} from './semicircular-dielectric.js';
import {CIRCLE_BLOCKER_TYPE,circleBlockerExtents} from './opaque-circle-blocker.js';
import {FINITE_APERTURE_TYPE} from './finite-aperture.js';
import {PARALLEL_BEAM_TYPE,PARALLEL_BEAM_VERSION,PARALLEL_LENS_MODEL,PARALLEL_PLANAR_MODEL,parallelBeamGeometry} from './parallel-beam.js';
import {BEAM_PLANAR_MIRROR_VERSION,BEAM_PLANAR_MIRROR_MODEL,BEAM_PLANAR_MIRROR_MIRROR_RIM_CLEARANCE_MM,BEAM_PLANAR_MIRROR_HALF_SAMPLE_GUARD} from './native-beam-planar-mirror-v26.js';
import {BEAM_TWO_PLANE_MIRROR_VERSION,BEAM_TWO_PLANE_MIRROR_MODEL,BEAM_TWO_PLANE_MIRROR_MIN_GAP_MM} from './native-beam-two-plane-mirror-v27.js';
import {DECENTERED_BEAM_VERSION,DECENTERED_BEAM_MODEL} from './decentered-two-lens-beam.js';
import {curvedEntryCapabilities} from './native-curved-entry-observation.js';
import {GRIN_SLAB_MODEL,GRIN_SLAB_VERSION,GRIN_SLAB_POLICY} from './native-entering-graded-slab.js';
import {GRIN_V25_TYPE,GRIN_V25_VERSION,GRIN_V25_POLICY,grinV25Extents,grinV25Capabilities} from './native-grin-v25.js';
import {isCurved,curvedPoints} from './curved-mirrors.js';
import {validate,UPSTREAM,SAMPLING_PRESETS,COMPONENT_TYPES,componentParameterNames,
  GENERAL_SCOPE,MAX_AUTHORING_COMPONENTS,COMPONENT_BOUNDS,LENGTH_PARAMETERS,mirrorEndpoints} from './contract.js';

const lengthScales=Object.freeze({mm:1,cm:10,m:1000});
const policies=Object.freeze({
  'preview-v1':Object.freeze({rayDensity:SAMPLING_PRESETS.medium,maxRayDepth:8,processedRayLimit:10000}),
  'dense-v1':Object.freeze({rayDensity:SAMPLING_PRESETS.dense,maxRayDepth:8,processedRayLimit:10000}),
  'bench-v40':Object.freeze({rayDensity:SAMPLING_PRESETS.medium,maxRayDepth:V40_MAX_RAY_DEPTH,processedRayLimit:10000}),
  'bench-v40-dense':Object.freeze({rayDensity:SAMPLING_PRESETS.dense,maxRayDepth:V40_MAX_RAY_DEPTH,processedRayLimit:10000}),
  // The deeper native limit is restricted to these two older sealed profiles.
  'native-deep-v17':Object.freeze({rayDensity:SAMPLING_PRESETS.medium,maxRayDepth:TWO_THICK_MIRROR_NATIVE_DEPTH,processedRayLimit:10000}),
  'native-deep-v18':Object.freeze({rayDensity:SAMPLING_PRESETS.medium,maxRayDepth:THICK_APERTURE_NATIVE_DEPTH,processedRayLimit:10000}),
  'native-grin-slab-v33':Object.freeze({rayDensity:GRIN_SLAB_POLICY.rayDensity,
    maxRayDepth:GRIN_SLAB_POLICY.maxRayDepth,processedRayLimit:GRIN_SLAB_POLICY.processedRayLimit}),
  'native-grin-fine-v25':Object.freeze({rayDensity:GRIN_V25_POLICY.rayDensity,
    maxRayDepth:GRIN_V25_POLICY.maxRayDepth,processedRayLimit:GRIN_V25_POLICY.processedRayLimit})
});
const prefixes=Object.freeze({
  'point-source':'source',[PARALLEL_BEAM_TYPE]:'beam',[SEMICIRCULAR_TYPE]:'semicircle',[CAP_TYPE]:'cap','ideal-lens':'lens','plane-mirror':'mirror','beam-splitter':'splitter','line-blocker':'blocker',[CIRCLE_BLOCKER_TYPE]:'circle-blocker',[FINITE_APERTURE_TYPE]:'aperture','ray-detector':'detector','planar-interface':'interface','ideal-curved-mirror':'ideal-mirror','circular-arc-mirror':'arc-mirror',[CIRCULAR_TYPE]:'dielectric',[PRISM_TYPE]:'prism',[POLYGON_TYPE]:'glass',[SPHERICAL_LENS_TYPE]:'thick-lens',[GRIN_V25_TYPE]:'grin'
});
const lengthKeys=new Set(LENGTH_PARAMETERS);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const idPattern=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const issue=(path,code,message)=>({path,code,message});
const fail=(issues)=>{throw new AuthoringError(issues);};
function checkObject(value,path,allowed,required=[]) {
  if(!isObject(value))fail([issue(path,'EXPECTED_OBJECT','Expected an object')]);
  const issues=[
    ...Object.keys(value).filter(key=>!allowed.includes(key))
      .map(key=>issue(path+'.'+key,'UNSUPPORTED_FIELD','This field is not in the authoring contract')),
    ...required.filter(key=>!own(value,key))
      .map(key=>issue(path+'.'+key,'MISSING_VALUE','Required information was not provided'))
  ];
  if(issues.length)fail(issues);
}
function units(value,path) {
  if(typeof value!=='string'||!own(lengthScales,value))
    fail([issue(path,'UNSUPPORTED_UNIT','Use mm, cm or m; no unit will be inferred')]);
  return lengthScales[value];
}
function physicalNumber(value,path) {
  if(typeof value!=='number'||!Number.isFinite(value))
    fail([issue(path,'INVALID_VALUE','Expected a finite numeric value, not text or an unlabelled expression')]);
  return value;
}
function canonicalValue(key,value,scale,path,allowFlatRadius=false) {
  if(key==='partialReflection'){if(typeof value!=='boolean')fail([issue(path,'INVALID_VALUE','Expected an explicit boolean')]);return value;}
  if(allowFlatRadius&&['frontRadius','backRadius'].includes(key)&&value===null)return null;
  return physicalNumber(value,path)*(lengthKeys.has(key)?scale:1);
}
export class AuthoringError extends Error {
  constructor(issues){
    super(issues.map(x=>x.path+': '+x.message).join('; '));
    this.name='AuthoringError';this.code='AUTHORING_REJECTED';this.issues=issues;
  }
}
export function capabilities() {
  return {
    composition:compositionCapabilities(),
    opaqueLineBlockers:{model:'general-component-tracing',nativeType:'Blocker',max:2,combinedStopMax:2,scope:'Up to two finite fully opaque line absorbers, sharing the combined two-stop limit with circles. Native sampled absorption counts; no shadow visibility or image inference.'},
    opaqueCircularBlockers:{model:'general-component-tracing',nativeType:'CircleBlocker',max:2,combinedStopMax:2,geometry:'Explicit 2D centre (x,y) and positive radius >=1 mm; entire disk within coordinate bounds; disjoint from sources, finite surfaces, detectors and other opaque circles',scope:'Fully opaque native circle boundaries with no wavelength filter; measured absorbed sampled rays only, not continuous shadow, 3D sphere, image, or visibility.'},
    nativeParallelBeam:{schemaVersion:PARALLEL_BEAM_VERSION,models:[PARALLEL_LENS_MODEL,PARALLEL_PLANAR_MODEL],
      source:'Exactly one finite native Beam with explicit centre x/y, perpendicular width 10–100 mm, directionDeg and brightness. No point-source replacement, randomization or divergence.',
      scope:'Optional one ideal thin lens and/or vertical finite aperture, OR one or two parallel refractive planes; 0–2 passive detectors. No other optics or mixed lens/medium models.',
      geometry:'Entire emission segment lies within coordinate bounds, outside every surface/medium boundary and detector supporting line. First emitted samples near finite stop/lens endpoints are refused. Beam starting medium must be uniform.',
      execution:'Native pinned Beam emits all deterministic samples; density is numerical not a continuous source property. Brightness exceeding ray density is refused to prevent native saturation.',
      limitations:'No image reconstruction, PSF, diffraction, radiometric power, arbitrary composite optics or source-to-detector ancestry.'},
    immersedArcPort:{schemaVersion:IMMERSED_ARC_VERSION,model:IMMERSED_ARC_MODEL,selection:'Select physical.model explicitly and use dense-v1.',scope:'One directional source inside a denser half-space, one immersed concave spherical mirror patch, one planar interface and one exterior detector.'},
    generalOpticalBench:{schemaVersion:GENERAL_BENCH_VERSION,model:GENERAL_BENCH_MODEL,selection:'Set physical.model explicitly to native-general-optical-bench. Unmarked historical requests keep their existing profile selection.',scope:'Either 1–4 point sources (full-circle, directional, or single-ray) OR 1 finite parallel Beam, combined with 0–4 coaxial ideal lenses, 0–4 plane mirrors, 0–2 curved mirrors (ideal-curved-mirror / circular-arc-mirror), 0–2 opaque stops (line-blocker / circle-blocker / finite-aperture), and 0–2 passive ray detectors (max 16 components total). Strict 0.01 mm clearance across all surfaces, emitters, and bounding disks. Pinned PhyDemo traces all rays; no route-independent image prediction or source-specific detector provenance.'},
    generalRefractiveBench:{schemaVersion:REFRACTIVE_BENCH_VERSION,model:REFRACTIVE_BENCH_MODEL,selection:'Set physical.model explicitly to native-general-refractive-bench. Unmarked historical requests keep their existing profile selection.',scope:'Either 1–4 exact single-ray point sources OR 1 finite parallel Beam, combined with 1–2 disjoint finite dielectric bodies (triangular-prism, polygon-dielectric, circular-dielectric, or spherical-lens sharing one explicit outsideIndex), 0–2 plane mirrors, 0–2 opaque stops (line-blocker / circle-blocker / finite-aperture), and 0–2 passive ray detectors (max 12 components total). Strict 0.01 mm clearance, initial corner/tangency/endpoint guards, and observed native endpoint audit (v38EndpointsVerified).'},
    generalHybridBench:{schemaVersion:HYBRID_BENCH_VERSION,model:HYBRID_BENCH_MODEL,selection:'Set physical.model explicitly to native-general-hybrid-bench. Unmarked historical requests keep their existing profile selection.',scope:'Either 1–4 exact single-ray point sources OR 1 finite parallel Beam, combined with 1–2 disjoint finite dielectric bodies (triangular-prism, polygon-dielectric, circular-dielectric, or spherical-lens sharing one explicit outsideIndex), 0–2 coaxial ideal lenses (focalLength in exterior medium outsideIndex), 0–2 curved mirrors (ideal-curved-mirror / circular-arc-mirror), 0–2 plane mirrors, 0–2 opaque stops, and 0–2 passive ray detectors (max 14 components total). Strict 0.01 mm clearance and full emitted/incoming/outgoing endpoint, corner, and tangency audit (v39EndpointsVerified).'},
    opticalBench:opticalBenchCapabilities(),
    mirrorBox:{schemaVersion:MIRROR_BOX_VERSION,model:MIRROR_BOX_MODEL,selection:'Select physical.model explicitly.',scope:'Four separated rectangular mirror walls, one explicit SingleRay and one interior opaque target. Native qualification requires one safe reflection per wall followed by absorption.'},
    guideFan:{schemaVersion:GUIDE_FAN_VERSION,model:GUIDE_FAN_MODEL,selection:'Set physical.model explicitly. Optional physical.rayDensity sets numerical sampling.',scope:'One directional fan through a finite rectangular Glass guide with unit exterior, partial reflection disabled and one exterior vertical detector.'},
    enteringGradedSlab:{schemaVersion:GRIN_SLAB_VERSION,model:GRIN_SLAB_MODEL,selection:'Select physical.model explicitly.',scope:'One finite-angle incoming single ray, one native square-root GRIN rectangle and a horizontal passive detector after the far face.'},
    finiteCircularCap:{schemaVersion:CAP_VERSION,model:CAP_MODEL,selection:'Select physical.model explicitly and use dense-v1.',scope:'An axial directional source inside a finite circular cap and one exterior detector beyond the curved pole.'},
    slabArcReturn:{schemaVersion:31,model:SLAB_ARC_MODEL,selection:'Select physical.model explicitly and use dense-v1.',scope:'One directional fan, two parallel interfaces, a separated concave spherical mirror and one exterior detector.'},
    curvedEntryBeam:{schemaVersion:30,model:CURVED_BEAM_MODEL,selection:'Select physical.model explicitly.',scope:'One horizontal leftward Beam through a finite right semicircular dielectric. Returns sampled flat-face y extrema in mm.'},
    refractiveFan:{schemaVersion:29,model:REFRACTIVE_FAN_MODEL,selection:'Set physical.model explicitly. Optional physical.rayDensity overrides the numerical preset.',scope:'One directional fan below one horizontal interface. Partial reflection disabled. Entire fan withheld at near-critical samples.'},
    postLensAperture:{schemaVersion:28,model:POST_LENS_MODEL,selection:'Set physical.model explicitly. Historical unmarked requests keep their existing selection.',scope:'One rightward horizontal Beam, one centered ideal lens, one downstream vertical finite aperture and 0–1 farther vertical detectors. Minimum plane gap 1 mm. All emitted samples must meet the lens. Aperture and detector finite misses are allowed. Optical clearance >0.1 mm plus 0.001 mm admission reserve, checked at native completion.'},
    nativeBeamTwoPlaneMirror:{schemaVersion:BEAM_TWO_PLANE_MIRROR_VERSION,model:BEAM_TWO_PLANE_MIRROR_MODEL,
      scope:'One finite real native Beam, exactly two vertical native PlaneGlass boundaries forming one finite homogeneous slab, one finite native vertical Mirror strictly beyond the slab, and 0–1 passive source-side detector (two full-return detectors exceed native depth 8).',
      material:'The original outside medium on both sides of the slab must be identical and explicitly declared, with slab index >= exterior. Both planes require partialReflection=false; native TIR remains.',
      geometry:'No touching or near-contact mirror/refracting interface: require >=1mm physical gap after rear face, slab thickness >=1mm, and >0.1mm first-mirror sample rim clearance. No other optics.',
      numerical:'Exact compiled native Beam samples with v26 B1 half-integer withholding (1e-10), 1–100 samples, density 0.048–1 and brightness <=density, 0–60deg forward incidence and depth <=8. Mirror and both detector legs require >0.1 mm physical endpoint clearance plus 0.001 mm admission reserve. Every completed run must verify native cross-sections within 0.001 mm, including detector misses. Missing, inconsistent, stopped, incomplete or stale evidence suppresses results.',
      limitations:'No native 3D image, continuous power, full Fresnel branches, arbitrary third medium, direct-contact mirror, original J08 complete source simulation or source-ray ancestry.',
      minimumMirrorGapMm:BEAM_TWO_PLANE_MIRROR_MIN_GAP_MM,
      nativeHalfIntegerSampleGuard:BEAM_PLANAR_MIRROR_HALF_SAMPLE_GUARD},
    nativeBeamPlanarMirror:{schemaVersion:BEAM_PLANAR_MIRROR_VERSION,model:BEAM_PLANAR_MIRROR_MODEL,
      scope:'One true deterministic finite Beam, one infinite vertical native PlaneGlass, one finite vertical native Mirror entirely inside the second medium and 0–2 passive detectors in the incident/source-side medium. No other optical objects.',
      geometry:'All sample mirror encounters must lie safely within the finite mirror (>0.1 mm from either endpoint), sample source must be fully before the interface; detectors are finite vertical segments between source and interface.',
      materials:'Both absolute indices explicit in [1,4], second index >= first, required partialReflection=false Fresnel-off approximation; native TIR preserved, no full Fresnel branching or weak-ray certification.',
      numerical:'Exact compiled pinned Beam samples 1–100; sampling count within 1e-10 of half-integer native threshold is refused. Beam brightness <= ray density, 0–60 degree forward incidence, native depth <=8. Real native events, misses, endpoint ambiguity, stops and truncation remain native outcomes; unqualified observations are withheld.',
      limits:'No native image reconstruction, physical irradiance, Ray ancestry, original J08 full-source simulation, arbitrary mirror tilt, reverse illumination or extra interfaces.',
      mirrorRimClearanceMm:BEAM_PLANAR_MIRROR_MIRROR_RIM_CLEARANCE_MM,
      nativeHalfIntegerSampleGuard:BEAM_PLANAR_MIRROR_HALF_SAMPLE_GUARD},
    nativeThickLensAperture:{schemaVersion:THICK_APERTURE_VERSION,model:THICK_APERTURE_MODEL,scope:'Exactly two independent finite native biconvex thick lenses, one plane mirror, one centred-gap native aperture, 1–4 exact single rays and 0–2 passive detectors',geometry:'Reuses v17 native lens/mirror/material, finite segment and source guards; entire stop x-plane strictly separated by >=0.01 mm from each lens envelope and other segments',execution:'native-deep-v18 only, depth at most 16; incomplete runs suppress results',limits:'No arbitrary optical mixing, predicted return route, wave/diffraction, reconstructed image or unrestricted corner qualification'},
    nativeTwoThickLensMirror:{schemaVersion:TWO_THICK_MIRROR_VERSION,model:TWO_THICK_MIRROR_MODEL,scope:'Two finite native biconvex lenses and one finite mirror, exact single rays and 0–2 detectors; separate v17 deep native policy',geometry:'Disjoint lens bodies, shared outside material index, mirror outside both thick lens x envelopes',execution:'native-deep-v17 only, depth at most 16; incomplete reads withheld',limits:'No arbitrary path, image solver or continuous power'},
    nativeThickLensMirror:{schemaVersion:16,model:'native-thick-lens-mirror-tracing',scope:'One finite native spherical thick lens plus one independent finite mirror, 1–4 explicit native single rays and two passive detectors',geometry:'Mirror x-plane strictly outside full lens body, finite optical clearances',limits:'Native chooses every true hit and miss, no inferred return or image'},
    nativeThickLensTrain:{schemaVersion:15,model:'native-thick-lens-tracing',scope:'One or two biconvex spherical native thick lenses with explicit aperture, thickness, front/back radii and glass/exterior indices',geometry:'Positive curvatures, strict edge thickness and separated x extents',limits:'No meniscus/tilted lenses, image reconstruction, or full Fresnel power'},
    nativeTwoLensBeam:{schemaVersion:DECENTERED_BEAM_VERSION,model:DECENTERED_BEAM_MODEL,
      lenses:{count:2,parameters:['x','y','focalLength','apertureHeight'],orientation:'vertical with explicit transverse centres'},
      source:'One native finite deterministic horizontal parallel Beam; direction exactly 0, +180 or -180 degrees.',
      geometry:'Both lenses ahead of the Beam, distinct x planes, finite endpoints and post-first-lens sample rim clearances; native chooses each interaction.',
      components:'One Beam, two vertical ideal lenses, 0–2 downstream passive vertical detectors. No stops, tilt, prisms or material lenses.',
      limitations:'Conservative high-angle guard; native misses remain misses. No image reconstruction or continuous irradiance.'},
    nativeCircleBeam:{schemaVersion:CIRCLE_BEAM_VERSION,model:CIRCLE_BEAM_MODEL,
      scope:'One deterministic native finite parallel Beam, one full finite native CircleGlass, and 0–2 external downstream vertical detectors. No other optics, inside emitter, nested media or Fresnel weak branches.',
      beam:'Explicit finite x/y and perpendicular width 10–100 mm; horizontal forward/reverse 0/±180 degrees. Full source within the central 90% transverse circle strip and at least 0.01 mm before the near circular boundary.',
      media:'Required explicit insideIndex and outsideIndex 1–4 in either order, radius >=20 mm and entire circle within +/-10000 mm; partialReflection=false is explicit Fresnel approximation but pinned native TIR remains.',
      safety:'All actual native circular incidents with radial residual over 1e-5 mm, near-tangent cosine under 1e-4, or critical Snell residual within 1e-5 are disqualified; incomplete/stale native runs withhold all measurements. Higher-to-lower-index first entries at/above the critical condition are refused.',
      numerical:{maxSamples:100,transverseFraction:CIRCLE_BEAM_INITIAL_TRANSVERSE_FRACTION,radialToleranceMm:CIRCLE_BEAM_NATIVE_RADIAL_TOLERANCE_MM,criticalMargin:CIRCLE_BEAM_CRITICAL_MARGIN},
      limitations:'Two refracting circle boundaries, not one spherical surface, a 3D sphere, physical image, continuous irradiance, symbolic J15/J16 answer, or general multi-optic apparatus.'},
    nativePrismBeam:{schemaVersion:PRISM_BEAM_VERSION,model:PRISM_BEAM_MODEL,
      scope:'Exactly one deterministic native finite Beam, one real pinned Glass triangle with a flat vertical entrance face, and up to two external passive right-hand detectors; no lenses, mirrors, stops, additional media, sources or mixed profiles.',
      geometry:'Required explicit triangle vertices x1=x2, y1<y2, x3>x1 and y1+1<y3<y2-1; all face lengths/altitudes >=1 mm; only horizontal rightward Beam. The full emitting segment must lie safely left of the flat face, with all sampled initial rays >0.1 mm from any vertex.',
      media:'Explicit insideIndex/outsideIndex [1,4] with inside>outside and partialReflection=false; native TIR persists while Fresnel partial branches are deliberately omitted.',
      execution:'Unmodified pinned native Beam and Glass choose all actual multiple face encounters, TIR, reflections, transmissions, misses and detector counts. Real native callback ambiguity, truncation or undefined behaviour suppress qualified readings.',
      limits:'Only numerical sampled finite 2D paths; no continuous irradiance, physical image, general triangular beam prism family, symbolic inverse or solved original JEE J13/J14 claim.',
      vertexClearanceMm:PRISM_BEAM_VERTEX_CLEARANCE_MM},
    nativeCurvedEntryObservation:curvedEntryCapabilities(),
    nativeGrinV25:grinV25Capabilities(),
    nativeSemicircularBeam:{schemaVersion:SEMICIRCULAR_VERSION,model:SEMICIRCULAR_MODEL,
      shape:'Native finite right semicircle: a flat vertical diameter and one exact circular arc, with explicit x/y centre, radius and two absolute refractive indices.',
      beam:'One deterministic native finite Beam, -60 to +60 degrees; each initial emitted sample must cross the flat segment at least 0.1 mm from its endpoints.',
      scope:'Exactly one Beam, one Glass semicircle, and 0-2 downstream vertical passive detectors. No other sources, optics, nested regions or Fresnel branching.',
      approximation:'partialReflection=false required explicitly; native total internal reflection remains enabled.',
      safety:'Any real native callback at or within 0.1 mm of a flat/arc seam, or indeterminate/tangential encounter, invalidates all qualified measurements even when the native callback says completed.',
      limits:'This is a 2D sectional simulation, not an original J12 answer, a general half-cylinder theory, diffraction, continuous irradiance or image detection.'},
    finiteApertures:{model:'general-component-tracing',nativeType:'Aperture',max:2,combinedStopMax:2,geometry:'Explicit centre x,y, tangent orientationDeg, full length and central openingLength; both opaque arms at least 1 mm; 0.01 mm clearance from other finite surfaces',scope:'Native planar segment with transparent gap; native absorber counts only, not continuous transmission, irradiance, diffraction or detected image.'},
    finiteBlockerComposition:finiteBlockerCompositionPolicy(),
    finiteShapeComposition:finiteShapeCompositionPolicy(),
    extendedFiniteDielectricComposition:extendedFiniteCompositionPolicy(),
    finiteDielectricComposition:{schemaVersion:FINITE_COMPOSITION_VERSION,model:FINITE_COMPOSITION_MODEL,
      scope:'One strictly convex four-vertex dielectric, exactly one external finite plane mirror, 1–4 explicit single rays and 0–2 external detectors; no lenses, stops, other media or motion',
      geometry:'Existing polygon rules; mirror/detectors entirely beyond a separating face by 0.01 mm; external segments mutually separated by 0.01 mm',
      limitations:'No prescribed return route, source-attributed ray history or image prediction. Explicit Fresnel-off is an approximation; truncated runs remain incomplete.'},
    polygonDielectrics:{schemaVersion:9,model:'polygon-dielectric-tracing',scope:'One strictly convex four-vertex dielectric, 1–4 exact rays and 0–2 external detectors; no other optics or nested media',geometry:'Four explicit vertices; edges and altitudes >=1 mm; all four faces are finite'},
    triangularPrisms:{schemaVersion:8,model:'triangular-prism-tracing',scope:'One stationary triangle; 1–4 explicit single rays; 0–2 external detectors; no other optics',geometry:'Three explicit vertices in either winding; edges and altitudes >=1 mm; initial corner rays excluded; no face route supplied'},
    interfaceVersion:1,canonicalFormat:'ray-optics-2d',schemaVersion:4,maxComponents:MAX_AUTHORING_COMPONENTS,
    semicircularDielectric:{schemaVersion:SEMICIRCULAR_VERSION,model:SEMICIRCULAR_MODEL,
      parameters:[...SEMICIRCULAR_PARAMETERS],nativeType:'Glass',faces:['face-flat','face-arc'],
      geometry:'Right semicircle bounded by a flat vertical diameter and one true native circular arc, not a polygon or complete CircleGlass.'},
    circularDielectric:{schemaVersion:7,model:'circular-dielectric-tracing',scope:'Exactly one stationary circular region; 1–4 explicit single rays inside or outside; 0–2 external detectors; no other optics or nested regions',indices:'Required inside/outside absolute indices [1,4]; native ratio inside/outside',radius:'Positive radius >=2 mm; complete circle within coordinate bounds',partialReflection:'Required boolean; false explicitly omits Fresnel partial reflections, not TIR',clearance:'0.01 mm source/boundary and detector/circle separation; initial forward near-tangent rays within 0.01 mm are unsupported'},
    curvedMirrors:{schemaVersion:6,model:'curved-mirror-tracing',scope:'1–2 ideal/circular-arc mirrors; 1–4 sources; 0–2 plane mirrors and detectors; disjoint aperture disks; no lenses or refraction',normal:'Front-facing normal; f>0 or radius>0 means concave toward front; all dimensions explicit'},
    planarMedia:{schemaVersion:5,model:'planar-media-tracing',interfaces:'1–4 parallel consistently oriented planes; matching adjacent indices',sources:'1–4 single-ray emitters',lenses:'unsupported',indices:'absolute positive indices [1,4], normalized as native ratios',partialReflection:'required boolean; false explicitly neglects Fresnel partial reflection, not TIR'},
    structuralRevisions:{
      format:'opticsim-component-revision-v1',
      method:'reviseComponents (atomic, validated, stable-ID add/remove)',
      maxOperations:8,add:{op:'add',lengthUnit:['mm','cm','m'],
        component:{required:['id','type','parameters'],sourceAlsoRequires:'emission.mode; active directional/single-ray angles explicit'}},
      remove:{op:'remove',required:['id']},
      limits:['Valid canonical baseline and admitted family only; component identity cannot be reused in the same revision.',
        'Every new physical parameter is explicit; only inactive full-circle emission angles may use existing mechanical defaults.',
        'No implicit numerical-policy, camera or model-family changes; no automatic result-target reassignment.',
        'Rejected atomic revision does not mutate the baseline or run native optics.']
    },
    model:'general-component-tracing',nativeUpstreamCommit:UPSTREAM,
    lengthUnits:Object.keys(lengthScales),coordinates:'x-right-y-up',
    lengthParameters:[...lengthKeys],
    componentTypes:Object.fromEntries(COMPONENT_TYPES.map(type=>[type,{
      parameters:componentParameterNames(type),
      ...(type==='planar-interface'?{booleanParameters:['partialReflection'],nativeType:'PlaneGlass',normal:'negative to positive side; degrees CCW in y-up'}:{}),
      ...(type===SEMICIRCULAR_TYPE?{booleanParameters:['partialReflection'],nativeType:'Glass',faceIds:['face-flat','face-arc'],geometry:'Native Glass with right-half circular boundary and vertical flat closing segment.'}:{}),
      ...(type===CAP_TYPE?{
        booleanParameters:['partialReflection'],nativeType:'Glass',faceIds:['face-flat','face-arc'],
        geometry:'A circular arc from an explicit base midpoint (x, y) and cap height, closed by a flat chord. Legacy v32 fixes rightward +x orientation (no normalDeg, capHeight <= radius). In v40 (native-optical-bench), normalDeg (y-up degrees) orients the outward apex axis and admits minor caps, hemispheres/semicylinders (capHeight = radius), and major caps / sliced spheres (radius < capHeight < 2*radius).',
        schemaVariants:{
          legacy:{versions:[CAP_VERSION],parameters:componentParameterNames(CAP_TYPE,CAP_VERSION),orientation:'fixed +x rightward'},
          v40:{versions:[OPTICAL_BENCH_V40_VERSION],parameters:componentParameterNames(CAP_TYPE,OPTICAL_BENCH_V40_VERSION),orientation:'explicit normalDeg in [-180, 180]; minor, hemisphere, or major cap (capHeight in [1, 2*radius - 1] mm)'}
        }
      }:{}),
      ...(type===CIRCULAR_TYPE?{booleanParameters:['partialReflection'],nativeType:'CircleGlass',indices:['insideIndex','outsideIndex'],geometry:'Finite 2D circle, not an ideal thin lens or a truncated sphere'}:{}),
      ...(type===PRISM_TYPE?{nativeType:'Glass',booleanParameters:['partialReflection'],faceIds:['face-12','face-23','face-31'],geometry:'Three physical vertices; vertex order defines face labels, not a ray route'}:{}),
      ...(type===POLYGON_TYPE?{nativeType:'Glass',booleanParameters:['partialReflection'],faceIds:['face-12','face-23','face-34','face-41'],geometry:'One strictly convex four-vertex finite region, never a ray route'}:{}),
      ...(type===GRIN_V25_TYPE?{nativeType:'GrinGlass',geometry:'Bounded physical rectangle with fixed positive square-root index field; native Euler inside steps, real exit and passive detector; no arbitrary LaTeX.'}:{}),
      ...(type===SPHERICAL_LENS_TYPE?{
        nativeType:'SphericalLens',booleanParameters:['partialReflection'],
        faceIds:['front-arc','back-arc','top-rim','bottom-rim'],
        geometry:'Native finite 2D spherical lens (outward-convex sign convention; not a thin-lens focal length). Legacy v15–v39 are positive-only biconvex (frontRadius, backRadius >= apertureHeight/2 + 1 mm). In v40 (native-optical-bench), frontRadius and backRadius also admit negative values (concave inward, |radius| >= apertureHeight/2 + 1 mm) and null (flat/planar face, R = infinity); textbook Cartesian equivalents are R1 = frontRadius and R2 = -backRadius. Requires apertureHeight >= 4 mm, centerThickness >= 2 mm, and edgeThickness >= 1 mm.',
        schemaVariants:{
          legacy:{versions:'15–18, 38–39',radii:'positive-only biconvex (>= apertureHeight/2 + 1 mm)'},
          v40:{versions:[OPTICAL_BENCH_V40_VERSION],radii:'signed (+convex outward, -concave inward, |radius| >= apertureHeight/2 + 1 mm) or null (flat/planar face)',nullableParameters:['frontRadius','backRadius']}
        }
      }:{}),
      ...(type==='beam-splitter'?{nativeType:'BeamSplitter',geometry:'Finite broadband partial-reflecting beam splitter (v40 only; filter: false); splits each actual native ray into reflected (1 - transmissionRatio) and transmitted (transmissionRatio) branches'}:{}),
      ...(type==='line-blocker'?{nativeType:'Blocker',geometry:'Opaque finite line segment; centre, tangent orientation, and length are explicit; absorbs each actual native ray incident'}:{}),
      ...(type===CIRCLE_BLOCKER_TYPE?{nativeType:'CircleBlocker',geometry:'Opaque 2D circular boundary with explicit centre and positive radius; absorbs actual native ray incidents; not a 3D body'}:{}),
      ...(type===FINITE_APERTURE_TYPE?{nativeType:'Aperture',geometry:'Opaque 2D line with an explicitly transparent centred opening; no wave diffraction'}:{}),
      ...(type===PARALLEL_BEAM_TYPE?{nativeType:'Beam',geometry:'Entire finite emitting segment, deterministic parallel rays and shared starting medium. Width is perpendicular to propagation.',sampling:'Global numeric ray density, not a physical continuous-ray distribution; no random, Lambertian or divergence variants.'}:{}),
      counts:{...GENERAL_SCOPE[type]},
      ...(isCurved(type)?{nativeType:type==='ideal-curved-mirror'?'IdealMirror':'ArcMirror',model:type==='ideal-curved-mirror'?'ideal Gaussian mapping':'native circular local-normal reflection; analytical image is paraxial'}:{}),
      ...(type==='point-source'?{emission:{mode:['full-circle','directional'],curvedSceneModes:['full-circle','directional','single-ray'],
        directionalFields:['directionDeg','angleDeg'],planarOnlyMode:'single-ray',circularOnlyMode:'single-ray',prismOnlyMode:'single-ray',polygonOnlyMode:'single-ray',curvedEntryOnlyMode:'single-ray',singleRayFields:['directionDeg']}}:{})
    }])),
    bounds:COMPONENT_BOUNDS,
    runPolicies:Object.fromEntries(Object.entries(policies).map(([id,value])=>[id,{...value}])),
    requiredInput:['lengthUnit','components'],optionalInput:['title','runPolicy','model','rayDensity'],
    lensParameterVariants:{legacy:{versions:'1–19, 28, 37, 39',parameters:['x','focalLength','apertureHeight'],centreY:0},decentered:{versions:[DECENTERED_BEAM_VERSION,OPTICAL_BENCH_V40_VERSION],parameters:['x','y','focalLength','apertureHeight'],centreY:'required explicit mm'}},
    physicalPolicy:'All physical parameter values are required. Full-circle inactive angles are explicitly filled, not measured. No optical component or missing physical information is invented.',
    opticalGeometry:'Historical thin lenses are vertical and centred at y=0; v20 two-lens Beam and v40 unified optical bench lenses have explicit independent y; v21 semicircular Glass has a flat diameter and true curved arc; v40 circular-cap-dielectric adds normalDeg and admits minor, hemisphere, and major caps. Mirror, detector and aperture orientationDeg is the tangent in y-up coordinates. Legacy profiles require strict >= 0.01 mm separation across all surfaces; v40 additionally admits clean <= 1e-11 mm coincident flat dielectric layers, coaxial cemented spherical lenses, flush flat/curved silvered mirrors, and non-collinear corner-touching plane mirrors (|sin theta| >= 0.05).',
    observations:[...NATIVE_OBSERVATION_KEYS],
    limitations:['native finite-ray sampling','signed relative detector power is not watts',
      'no image prediction for unconstrained general tracing','no source-specific detector provenance']
  };
}
// Collect independent field problems in one pass. Names and numerical limits
// come from the same live contract used below. Geometry is still validated only
// by the canonical validator once a complete document can be constructed.
export function inspectAuthoringRequest(request){
  const issues=[];
  const object=(value,path,allowed,required=[])=>{
    try{checkObject(value,path,allowed,required);}
    catch(error){if(!(error instanceof AuthoringError))throw error;issues.push(...error.issues);}
    return isObject(value);
  };
  const fanFields=[REFRACTIVE_FAN_MODEL,CURVED_BEAM_MODEL,GUIDE_FAN_MODEL].includes(request?.model)?['rayDensity']:[];
  const isV40=request?.model===OPTICAL_BENCH_V40_MODEL;
  const v40Fields=isV40?['backgroundIndex','randomSeed']:[];
  const requiredTop=['lengthUnit','components',...(isV40?['backgroundIndex']:[])];
  if(!object(request,'$',['lengthUnit','components','title','runPolicy','model',...fanFields,...v40Fields],requiredTop))return issues;
  let scale=null;
  if(own(request,'lengthUnit')){
    try{scale=units(request.lengthUnit,'$.lengthUnit');}
    catch(error){issues.push(...error.issues);}
  }
  if(own(request,'model')&&![POST_LENS_MODEL,REFRACTIVE_FAN_MODEL,CURVED_BEAM_MODEL,SLAB_ARC_MODEL,CAP_MODEL,GRIN_SLAB_MODEL,IMMERSED_ARC_MODEL,MIRROR_BOX_MODEL,GUIDE_FAN_MODEL,GENERAL_BENCH_MODEL,REFRACTIVE_BENCH_MODEL,HYBRID_BENCH_MODEL,OPTICAL_BENCH_V40_MODEL].includes(request.model))issues.push(issue('$.model','UNSUPPORTED_MODEL','Unknown explicit physical model'));
  if(isV40&&own(request,'backgroundIndex')){
    if(typeof request.backgroundIndex!=='number'||!Number.isFinite(request.backgroundIndex))
      issues.push(issue('$.backgroundIndex','INVALID_VALUE','Expected a finite refractive index in [1, 4]'));
    else if(request.backgroundIndex<1||request.backgroundIndex>4)
      issues.push(issue('$.backgroundIndex','INVALID_INPUT','Ambient backgroundIndex must be in [1, 4]'));
  }
  if(isV40&&own(request,'randomSeed')&&!isValidRandomSeed(request.randomSeed))
    issues.push(issue('$.randomSeed','INVALID_VALUE','Expected a nonempty printable seed string (1–64 characters)'));
  if(own(request,'runPolicy')&&(typeof request.runPolicy!=='string'||!own(policies,request.runPolicy)))
    issues.push(issue('$.runPolicy','UNSUPPORTED_POLICY','Use a run policy exposed by capabilities()'));
  if(own(request,'title')&&(typeof request.title!=='string'||request.title.length>120))
    issues.push(issue('$.title','INVALID_TITLE','Expected a title of at most 120 characters'));
  if(!own(request,'components'))return issues;
  if(!Array.isArray(request.components)||request.components.length<1||request.components.length>MAX_AUTHORING_COMPONENTS){
    issues.push(issue('$.components','INVALID_COMPONENTS','Expected 1–'+MAX_AUTHORING_COMPONENTS+' bounded component objects'));
    return issues;
  }
  const number=(key,value,path,type=null)=>{
    if(key==='partialReflection'){if(typeof value!=='boolean')issues.push(issue(path,'INVALID_VALUE','Expected explicit boolean'));return;}
    const signedSpherical=isV40&&type===SPHERICAL_LENS_TYPE&&['frontRadius','backRadius'].includes(key);
    if(signedSpherical&&value===null)return;
    if(typeof value!=='number'||!Number.isFinite(value)){
      issues.push(issue(path,'INVALID_VALUE','Expected a finite numeric value, not text or an unlabelled expression'));return;
    }
    if(lengthKeys.has(key)&&scale===null)return;
    const n=value*(lengthKeys.has(key)?scale:1),b=COMPONENT_BOUNDS;
    const bounds=key==='brightness'?b.brightness:
      key==='transmissionRatio'?b.transmissionRatio:
      ['negativeIndex','positiveIndex','insideIndex','outsideIndex'].includes(key)?b.refractiveIndex:
      key==='normalDeg'?b.orientationDeg:key==='orientationDeg'?b.orientationDeg:key==='directionDeg'?b.directionDeg:
      key==='angleDeg'?b.openingAngleDeg:
      signedSpherical?b.coordinateMm:
      ['length','openingLength','apertureHeight','centerThickness','frontRadius','backRadius',...(isV40?['capHeight']:[])].includes(key)?b.positiveLengthMm:key==='width'?[10,100]:b.coordinateMm;
    const minAbs=signedSpherical?1:key==='focalLength'?b.minimumAbsFocalLengthMm:
      key==='radius'&&!(type===CIRCULAR_TYPE||type===CAP_TYPE||type===SEMICIRCULAR_TYPE||type===CIRCLE_BLOCKER_TYPE)?2:null;
    const minVal=key==='radius'?(type===CIRCULAR_TYPE||type===CAP_TYPE?2:type===SEMICIRCULAR_TYPE?5:type===CIRCLE_BLOCKER_TYPE?1:null):null;
    if(!Number.isFinite(n)||n<bounds[0]||n>bounds[1]||
      (minAbs!==null&&Math.abs(n)<minAbs)||(minVal!==null&&n<minVal)){
      const unit=lengthKeys.has(key)?' mm':'';
      const range=minVal!==null?'['+minVal+', '+bounds[1]+']'+unit:
        minAbs!==null?'['+bounds[0]+', '+bounds[1]+']'+unit+' with |value| >= '+minAbs+unit:
        '['+bounds[0]+', '+bounds[1]+']'+unit;
      issues.push(issue(path,'INVALID_INPUT','Value is outside the live contract bounds'+
        (lengthKeys.has(key)?' after conversion to mm':'')+' (got '+n+unit+'; allowed '+range+')'));
    }
  };
  const selected=request.components.every(c=>isObject(c)&&typeof c.type==='string')
    ?selectRequestComposition(request):null;
  const ids=new Set();
  for(const [i,c] of request.components.entries()){
    const path='$.components['+i+']';
    if(!object(c,path,['id','type','parameters','emission'],['type','parameters']))continue;
    if(own(c,'id')){
      if(typeof c.id!=='string'||!idPattern.test(c.id))
        issues.push(issue(path+'.id','INVALID_ID','ID must begin with a letter and use letters, digits, _ or -'));
      else if(ids.has(c.id))issues.push(issue(path+'.id','DUPLICATE_ID','Component IDs must be unique'));
      else ids.add(c.id);
    }
    if(!own(c,'type'))continue;
    if(!COMPONENT_TYPES.includes(c.type)){
      issues.push(issue(path+'.type','UNSUPPORTED_COMPONENT','Not a supported PhyDemo-backed component'));continue;
    }
    const required=componentParameterNames(c.type,selected?.schemaVersion);
    if(own(c,'parameters')&&object(c.parameters,path+'.parameters',required,required))
      for(const key of required)if(own(c.parameters,key))number(key,c.parameters[key],path+'.parameters.'+key,c.type);
    if(c.type!=='point-source'){
      if(own(c,'emission'))issues.push(issue(path+'.emission','UNSUPPORTED_FIELD','Only sources have emission'));
      continue;
    }
    if(!own(c,'emission')){
      issues.push(issue(path+'.emission','MISSING_VALUE','Source emission must be explicitly specified'));continue;
    }
    if(!object(c.emission,path+'.emission',['mode','directionDeg','angleDeg'],['mode']))continue;
    if(own(c.emission,'mode')&&!['full-circle','directional','single-ray'].includes(c.emission.mode))
      issues.push(issue(path+'.emission.mode','UNSUPPORTED_MODE','Expected full-circle, directional, or schema-supported single-ray'));
    for(const key of ['directionDeg','angleDeg']){
      if(own(c.emission,key))number(key,c.emission[key],path+'.emission.'+key);
      else if(c.emission.mode==='directional'||c.emission.mode==='single-ray'&&key==='directionDeg')issues.push(issue(path+'.emission.'+key,
        'MISSING_VALUE','Directional emission requires the explicit physical angle'));
    }
  }
  return issues;
}
// Bounded camera preparation is presentation-only. It never modifies components.
function camera(components) {
  const vertices=[];
  for(const c of components) {
    const p=c.parameters;
    if(c.type===PARALLEL_BEAM_TYPE){const g=parallelBeamGeometry(p);vertices.push(g.p1,g.p2);}
    else if(c.type==='point-source')vertices.push({x:p.x,y:p.y});
    else if(c.type===CIRCULAR_TYPE)vertices.push(...circularExtents(p));
    else if(c.type===CAP_TYPE)vertices.push(...capExtents(p));
    else if(c.type===SEMICIRCULAR_TYPE)vertices.push(...semicircularExtents(p));
    else if(c.type===CIRCLE_BLOCKER_TYPE)vertices.push(...circleBlockerExtents(p));
    else if(c.type===PRISM_TYPE)vertices.push(...prismVertices(p));
    else if(c.type===POLYGON_TYPE)vertices.push(...polygonVertices(p));
    else if(c.type===SPHERICAL_LENS_TYPE)vertices.push(...thickLensExtents(p));
    else if(c.type===GRIN_V25_TYPE)vertices.push(...grinV25Extents(p));
    else if(isCurved(c.type))vertices.push(...curvedPoints(c));
    else if(c.type==='ideal-lens')vertices.push({x:p.x,y:(p.y??0)-p.apertureHeight/2},
      {x:p.x,y:(p.y??0)+p.apertureHeight/2});
    else if(c.type==='planar-interface')vertices.push({x:p.x,y:p.y});
    else vertices.push(...mirrorEndpoints(p));
  }
  const xs=vertices.map(v=>v.x),ys=vertices.map(v=>v.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=Math.max(320,maxX-minX+120),height=Math.max(240,maxY-minY+120);
  // The v25 GRIN apparatus is approximately one millimetre wide; the
  // historical 2x camera fit renders its native rectangle as two pixels.
  // A display-only 80 CSS-pixel/mm close-up keeps its full 2mm detector in
  // the 240px minimum stage; never change the underlying physical geometry.
  const isGrinV25=components.some(c=>c.type===GRIN_V25_TYPE);
  return {x:(minX+maxX)/2,y:(minY+maxY)/2,
    zoom:isGrinV25?80:Math.max(.03,Math.min(2,.85*1200/width,.85*700/height))};
}
function selectRequestComposition(request) {
  if(request.model===OPTICAL_BENCH_V40_MODEL)return {model:OPTICAL_BENCH_V40_MODEL,schemaVersion:OPTICAL_BENCH_V40_VERSION,adapterVersion:OPTICAL_BENCH_V40_VERSION};
  if(request.model===REFRACTIVE_BENCH_MODEL)return {model:REFRACTIVE_BENCH_MODEL,schemaVersion:REFRACTIVE_BENCH_VERSION,adapterVersion:REFRACTIVE_BENCH_VERSION};
  if(request.model===HYBRID_BENCH_MODEL)return {model:HYBRID_BENCH_MODEL,schemaVersion:HYBRID_BENCH_VERSION,adapterVersion:HYBRID_BENCH_VERSION};
  if(request.model===GENERAL_BENCH_MODEL)return {model:GENERAL_BENCH_MODEL,schemaVersion:GENERAL_BENCH_VERSION,adapterVersion:GENERAL_BENCH_VERSION};
  if(request.model===GUIDE_FAN_MODEL)return {model:GUIDE_FAN_MODEL,schemaVersion:GUIDE_FAN_VERSION,adapterVersion:GUIDE_FAN_VERSION};
  if(request.model===MIRROR_BOX_MODEL)return {model:MIRROR_BOX_MODEL,schemaVersion:MIRROR_BOX_VERSION,adapterVersion:MIRROR_BOX_VERSION};
  if(request.model===IMMERSED_ARC_MODEL)return {model:IMMERSED_ARC_MODEL,schemaVersion:IMMERSED_ARC_VERSION,adapterVersion:IMMERSED_ARC_VERSION};
  if(request.model===GRIN_SLAB_MODEL)return {model:GRIN_SLAB_MODEL,schemaVersion:GRIN_SLAB_VERSION,adapterVersion:GRIN_SLAB_VERSION};
  if(request.model===CAP_MODEL)return {model:CAP_MODEL,schemaVersion:CAP_VERSION,adapterVersion:CAP_VERSION};
  if(request.model===SLAB_ARC_MODEL)return {model:SLAB_ARC_MODEL,schemaVersion:31,adapterVersion:31};
  if(request.model===CURVED_BEAM_MODEL)return {model:CURVED_BEAM_MODEL,schemaVersion:30,adapterVersion:30};
  if(request.model===REFRACTIVE_FAN_MODEL)return {model:REFRACTIVE_FAN_MODEL,schemaVersion:29,adapterVersion:29};
  return request.model===POST_LENS_MODEL ? {model:POST_LENS_MODEL,schemaVersion:28,adapterVersion:28} : selectAuthoringComposition(request.components);
}
export function prepareScene(request) {
  const issues=inspectAuthoringRequest(request);
  if(issues.length)fail(issues);
  const scale=units(request.lengthUnit,'$.lengthUnit');
  const requestedPolicy=own(request,'runPolicy')?request.runPolicy:null;
  const title=own(request,'title')?request.title:'LLM-authored optical scene';
  const selectedComposition=selectRequestComposition(request);
  const knownIds=new Set(request.components.filter(c=>own(c,'id')).map(c=>c.id)),assignedIds=[];
  const components=request.components.map((component,i)=>{
    const path='$.components['+i+']';
    const required=componentParameterNames(component.type,selectedComposition.schemaVersion);
    let id=component.id;
    if(!id) {
      let index=1,prefix=prefixes[component.type];
      while(knownIds.has(prefix+'-'+index))index++;
      id=prefix+'-'+index;knownIds.add(id);assignedIds.push({index:i,id});
    }
    const allowFlatRadius=selectedComposition.schemaVersion===OPTICAL_BENCH_V40_VERSION&&component.type===SPHERICAL_LENS_TYPE;
    const parameters=Object.fromEntries(required.map(key=>[key,canonicalValue(
      key,component.parameters[key],scale,path+'.parameters.'+key,allowFlatRadius)]));
    const result={id,type:component.type,parameters};
    if(component.type==='point-source'){
      result.emission={mode:component.emission.mode,
        directionDeg:own(component.emission,'directionDeg')?component.emission.directionDeg:0,
        angleDeg:own(component.emission,'angleDeg')?component.emission.angleDeg:30};
    }
    return result;
  });
  const {schemaVersion,adapterVersion,model}=selectedComposition;
  const policyName=requestedPolicy??(schemaVersion===OPTICAL_BENCH_V40_VERSION?'bench-v40':
    schemaVersion===TWO_THICK_MIRROR_VERSION?'native-deep-v17':schemaVersion===THICK_APERTURE_VERSION?'native-deep-v18':
    schemaVersion===GRIN_V25_VERSION?'native-grin-fine-v25':schemaVersion===GRIN_SLAB_VERSION?'native-grin-slab-v33':'preview-v1');
  if(((policyName==='bench-v40'||policyName==='bench-v40-dense')&&schemaVersion!==OPTICAL_BENCH_V40_VERSION)||
     (policyName==='native-deep-v17'&&schemaVersion!==TWO_THICK_MIRROR_VERSION)||
     (policyName==='native-deep-v18'&&schemaVersion!==THICK_APERTURE_VERSION)||
     (policyName==='native-grin-fine-v25'&&schemaVersion!==GRIN_V25_VERSION)||
     (schemaVersion===GRIN_V25_VERSION&&policyName!=='native-grin-fine-v25')||
     ((schemaVersion===GRIN_SLAB_VERSION)!==(policyName==='native-grin-slab-v33')))
    fail([issue('$.runPolicy','UNSUPPORTED_POLICY','Use the numerical policy registered for the selected profile.')]);
  const doc={
    format:'ray-optics-2d',schemaVersion,adapterVersion,upstreamCommit:UPSTREAM,
    physics:{lengthUnit:'mm',coordinates:'x-right-y-up',model,
      ...(schemaVersion===OPTICAL_BENCH_V40_VERSION?{backgroundIndex:request.backgroundIndex}:{}),
      components},
    presentation:{title,view:camera(components),mode:'rays',grid:false},
    simulation:{...policies[policyName],
      ...(own(request,'rayDensity')?{rayDensity:request.rayDensity}:{}),
      ...(schemaVersion===OPTICAL_BENCH_V40_VERSION?{randomSeed:own(request,'randomSeed')?request.randomSeed:V40_DEFAULT_RANDOM_SEED}:{})}
  };
  try{validate(doc);}
  catch(error){
    fail([issue(error.path||'$.physics',error.code||'INVALID_SCENE',error.message)]);
  }
  return {document:doc,preparation:{
    suppliedLengthUnit:request.lengthUnit,canonicalLengthUnit:'mm',
    runPolicy:policyName,assignedIds,...(own(request,'rayDensity')?{rayDensity:request.rayDensity}:{}),
    defaulted: [
      ...(own(request,'title')?[]:['presentation.title']),
      ...(own(request,'runPolicy')?[]:['simulation.runPolicy']),
      ...(schemaVersion===OPTICAL_BENCH_V40_VERSION&&!own(request,'randomSeed')?['simulation.randomSeed']:[]),
      'presentation.view','presentation.mode','presentation.grid',
      ...components.filter((c,i)=>c.type==='point-source'&&c.emission.mode==='single-ray'&&!own(request.components[i].emission,'angleDeg')).map(c=>c.id+'.inactiveConeAngle'),
      ...components.filter((c,i)=>c.type==='point-source'&&
        c.emission.mode==='full-circle'&&
        ['directionDeg','angleDeg'].some(key=>!own(request.components[i].emission,key)))
        .map(c=>c.id+'.inactiveEmissionAngles')
    ]
  }};
}
// Atomic targeted revision of an accepted canonical document. No component,
// optical model, ID, simulation setting or unknown field may be rewritten.
export function reviseScene(document,patch){
  try{validate(document);}catch(error){fail([issue(error.path||'$','INVALID_BASE',error.message)]);}
  checkObject(patch,'$',['changes'],['changes']);
  if(!Array.isArray(patch.changes)||!patch.changes.length||patch.changes.length>16)
    fail([issue('$.changes','INVALID_CHANGES','Expected 1–16 targeted changes')]);
  const next=structuredClone(document),seen=new Set(),issues=[];
  for(const [i,change] of patch.changes.entries()){
    const path='$.changes['+i+']';
    checkObject(change,path,['id','section','key','value','unit'],
      ['id','section','key','value']);
    const component=next.physics.components.find(c=>c.id===change.id);
    if(!component){issues.push(issue(path+'.id','UNKNOWN_COMPONENT','No component has that stable ID'));continue;}
    if(!['parameters','emission'].includes(change.section)||
      change.section==='emission'&&component.type!=='point-source'||
      !own(component[change.section],change.key)){
      issues.push(issue(path+'.key','UNKNOWN_PARAMETER','Not a supported parameter or emission field'));continue;
    }
    const identity=change.id+':'+change.section+':'+change.key;
    if(seen.has(identity)){issues.push(issue(path,'DUPLICATE_CHANGE','Update a field only once per revision'));continue;}
    seen.add(identity);
    if(change.section==='emission'&&change.key==='mode'){
      if(own(change,'unit')||!compositionSourceModes(document.schemaVersion).includes(change.value))
        issues.push(issue(path+'.value','INVALID_MODE','Expected full-circle or directional without units'));
      else component.emission.mode=change.value;
      continue;
    }
    if(own(change,'unit')&&!lengthKeys.has(change.key)){
      issues.push(issue(path+'.unit','UNSUPPORTED_UNIT','Units apply only to length parameters'));continue;
    }
    const scale=own(change,'unit')?units(change.unit,path+'.unit'):1;
    const allowFlatRadius=document.schemaVersion===OPTICAL_BENCH_V40_VERSION&&component.type===SPHERICAL_LENS_TYPE;
    component[change.section][change.key]=canonicalValue(change.key,change.value,scale,path+'.value',allowFlatRadius);
  }
  if(issues.length)fail(issues);
  // Inactive full-circle values are never an implicit new directional choice.
  for(const c of next.physics.components.filter(c=>c.type==='point-source')){
    const before=document.physics.components.find(x=>x.id===c.id);
    if(before.emission.mode==='full-circle'&&c.emission.mode==='directional') {
      for(const key of ['directionDeg','angleDeg'])
        if(!seen.has(c.id+':emission:'+key))
          issues.push(issue('$.changes','MISSING_VALUE',
            'Switching '+c.id+' to directional requires an explicit '+key+' in the same revision'));
    }
  }
  for(const c of next.physics.components.filter(c=>c.type==='point-source')){
    const before=document.physics.components.find(x=>x.id===c.id);
    if(before.emission.mode==='full-circle'&&c.emission.mode==='single-ray'&&
       !seen.has(c.id+':emission:directionDeg'))
      issues.push(issue('$.changes','MISSING_VALUE','Switching '+c.id+' to single-ray requires an explicit directionDeg in the same revision'));
    if(document.schemaVersion===OPTICAL_BENCH_V40_VERSION&&
       before.emission.mode==='single-ray'&&c.emission.mode==='directional'&&
       !seen.has(c.id+':emission:angleDeg'))
      issues.push(issue('$.changes','MISSING_VALUE','Switching '+c.id+' to directional requires an explicit angleDeg in the same revision'));
  }
  if(issues.length)fail(issues);
  try{validate(next);}catch(error){fail([issue(error.path||'$',
    error.code||'INVALID_SCENE',error.message)]);}
  return {document:next,changesApplied:patch.changes.length};
}


// Atomic, bounded physical-structure edits to an already validated scene.
// A new component is authored in the SAME minimal physical vocabulary as
// prepareScene, without re-supplying or rebuilding unchanged components.
// The existing strict canonical validator alone determines which arrangements
// are physically/numerically admitted; no cross-family migration is implied.
export const COMPONENT_REVISION_FORMAT='opticsim-component-revision-v1';
export function reviseComponents(document,patch){
  try{validate(document);}catch(error){
    fail([issue(error.path||'$','INVALID_BASE',error.message)]);
  }
  checkObject(patch,'$',['format','operations'],['format','operations']);
  if(patch.format!==COMPONENT_REVISION_FORMAT)
    fail([issue('$.format','UNSUPPORTED_FORMAT','Expected '+COMPONENT_REVISION_FORMAT)]);
  if(!Array.isArray(patch.operations)||patch.operations.length<1||patch.operations.length>8)
    fail([issue('$.operations','INVALID_OPERATIONS','Expected 1–8 atomic add/remove operations')]);
  const next=structuredClone(document);
  const baselineIds=new Set(document.physics.components.map(c=>c.id));
  const touched=new Set(),added=[],removed=[];
  for(const [i,operation] of patch.operations.entries()){
    const path='$.operations['+i+']';
    if(!isObject(operation))fail([issue(path,'EXPECTED_OBJECT','Expected a physical add/remove operation')]);
    if(operation.op==='remove'){
      checkObject(operation,path,['op','id'],['op','id']);
      if(typeof operation.id!=='string'||!idPattern.test(operation.id))
        fail([issue(path+'.id','INVALID_ID','A stable component ID is required')]);
      if(touched.has(operation.id))
        fail([issue(path+'.id','DUPLICATE_OPERATION','One structural operation per component identity')]);
      touched.add(operation.id);
      if(!baselineIds.has(operation.id))
        fail([issue(path+'.id','UNKNOWN_COMPONENT','Cannot remove an absent baseline component')]);
      const index=next.physics.components.findIndex(c=>c.id===operation.id);
      if(index<0)fail([issue(path+'.id','UNKNOWN_COMPONENT','Component is no longer present')]);
      next.physics.components.splice(index,1);
      removed.push(operation.id);
      continue;
    }
    if(operation.op!=='add')
      fail([issue(path+'.op','UNSUPPORTED_OPERATION','Use add or remove; use reviseScene to edit existing fields')]);
    checkObject(operation,path,['op','lengthUnit','component'],['op','lengthUnit','component']);
    const scale=units(operation.lengthUnit,path+'.lengthUnit');
    const author=operation.component,cp=path+'.component';
    checkObject(author,cp,['id','type','parameters','emission'],['id','type','parameters']);
    if(typeof author.id!=='string'||!idPattern.test(author.id))
      fail([issue(cp+'.id','INVALID_ID','An explicitly chosen new stable component ID is required')]);
    if(touched.has(author.id)||baselineIds.has(author.id))
      fail([issue(cp+'.id','DUPLICATE_ID','A component ID cannot be reused or replaced in one structural revision')]);
    touched.add(author.id);
    if(!COMPONENT_TYPES.includes(author.type))
      fail([issue(cp+'.type','UNSUPPORTED_COMPONENT','Not a registered physical component type')]);
    const required=componentParameterNames(author.type,document.schemaVersion);
    checkObject(author.parameters,cp+'.parameters',required,required);
    const allowFlatRadius=document.schemaVersion===OPTICAL_BENCH_V40_VERSION&&author.type===SPHERICAL_LENS_TYPE;
    const parameters=Object.fromEntries(required.map(key=>[key,canonicalValue(
      key,author.parameters[key],scale,cp+'.parameters.'+key,allowFlatRadius)]));
    const component={id:author.id,type:author.type,parameters};
    if(author.type==='point-source'){
      checkObject(author.emission,cp+'.emission',['mode','directionDeg','angleDeg'],['mode']);
      const mode=author.emission.mode;
      const modes=compositionSourceModes(document.schemaVersion);
      if(!modes.includes(mode))
        fail([issue(cp+'.emission.mode','INVALID_MODE','Emission mode not admitted by this optical model')]);
      const requiredAngles=mode==='directional'?['directionDeg','angleDeg']:
        mode==='single-ray'?['directionDeg']:[];
      for(const key of requiredAngles)if(!own(author.emission,key))
        fail([issue(cp+'.emission.'+key,'MISSING_VALUE','The active physical emission angle must be explicit')]);
      component.emission={
        mode,directionDeg:own(author.emission,'directionDeg')?
          canonicalValue('directionDeg',author.emission.directionDeg,1,cp+'.emission.directionDeg'):0,
        angleDeg:own(author.emission,'angleDeg')?
          canonicalValue('angleDeg',author.emission.angleDeg,1,cp+'.emission.angleDeg'):30
      };
    }else if(own(author,'emission'))
      fail([issue(cp+'.emission','UNSUPPORTED_FIELD','Only point sources have emission')]);
    next.physics.components.push(component);
    added.push(author.id);
  }
  // Important: preserve the original model family and all current numerical,
  // source, and presentation state. Re-validation covers interaction/overlap,
  // cardinality, source clearance and supported combinations for ALL components.
  try{validate(next);}catch(error){
    fail([issue(error.path||'$.physics',error.code||'INVALID_SCENE',error.message)]);
  }
  return {document:next,operationsApplied:patch.operations.length,addedIds:added,removedIds:removed};
}
