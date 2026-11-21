import {compositionCountsMatch} from './composition-profiles.js';
import {v26PinnedBeamAdmissionSamples} from './native-beam-planar-mirror-v26.js';
import {V27_SECTION_AGREEMENT_MM} from './native-beam-two-plane-mirror-v27.js';
import {parallelBeamGeometry} from './parallel-beam.js';

export const POST_LENS_MODEL='native-post-lens-aperture-tracing';
export const ENDPOINT_MM=0.1;
export const SECTION_BUDGET_MM=V27_SECTION_AGREEMENT_MM;
export function apertureEdges(p) {
  return [-p.length,-p.openingLength,p.openingLength,p.length].map(n=>p.y+n/2);
}
export function onArm(y,edges) {
  return (y>edges[0] && y<edges[1]) || (y>edges[2] && y<edges[3]);
}
export function postLensWitness(components,density) {
  const part=type=>components.find(c=>c.type===type)?.parameters;
  const beam=part('parallel-beam'),lens=part('ideal-lens'),stop=part('finite-aperture'),detector=part('ray-detector');
  const sampling=v26PinnedBeamAdmissionSamples(beam,density);
  const edges=apertureEdges(stop);
  const samples=sampling.samples.map(({y})=>{
    const slope=-y/lens.focalLength;
    const atStop=y+(stop.x-lens.x)*slope;
    const absorbed=onArm(atStop,edges);
    const atDetector=detector && !absorbed ? y+(detector.x-lens.x)*slope : null;
    return {y,slope,atStop,absorbed,atDetector};
  });
  return {beam,lens,stop,detector,edges,samples,nearHalfInteger:sampling.nearHalfInteger};
}
export function validatePostLensAperture(components,density,endpoints,fail) {
  const reject=why=>fail('$.physics.components',why,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,POST_LENS_MODEL,28))
    reject('v28 requires one Beam, one centered ideal lens, one finite aperture and 0–1 downstream detectors.');
  if(!Number.isFinite(density)||density<.048||density>1)reject('v28 requires density 0.048–1.');
  const {beam,lens,stop,detector,edges,samples,nearHalfInteger}=postLensWitness(components,density);
  const world=n=>Number.isFinite(n)&&Math.abs(n)<=10000;
  const ends=parallelBeamGeometry(beam);
  if(beam.directionDeg!==0||beam.brightness>density||nearHalfInteger||!samples.length||samples.length>100||
      ![ends.p1,ends.p2].every(p=>world(p.x)&&world(p.y)&&lens.x-p.x>=1))
    reject('v28 needs a bounded rightward horizontal Beam at least 1 mm before the lens, unsaturated brightness, and 1–100 unambiguous native samples.');
  for(const segment of [stop,detector].filter(Boolean)){
    if(Math.abs(segment.orientationDeg)!==90||!endpoints(segment).every(p=>world(p.x)&&world(p.y)))
      reject('v28 requires finite vertical aperture and detector segments within the world.');
  }
  if(stop.x-lens.x<1 || (detector && detector.x-stop.x<1))
    reject('v28 requires at least 1 mm between successive lens, aperture and detector planes.');
  const reserve=ENDPOINT_MM+SECTION_BUDGET_MM;
  for(const s of samples) {
    if(lens.apertureHeight/2-Math.abs(s.y)<=reserve || Math.abs(s.slope)>1)
      reject('Every sample must clear the lens rim and have post-lens slope magnitude at most one.');
    if(!world(s.atStop)||edges.some(y=>Math.abs(y-s.atStop)<=reserve))
      reject('v28 aperture endpoint clearance requires >0.1 mm plus a 0.001 mm numerical reserve.');
    if(s.atDetector!==null && (!world(s.atDetector)||
       Math.abs(Math.abs(s.atDetector-detector.y)-detector.length/2)<=reserve))
      reject('v28 detector endpoint clearance requires >0.1 mm plus a 0.001 mm numerical reserve.');
  }
}
