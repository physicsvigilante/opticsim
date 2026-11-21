import {isRecord} from './qualified-utils.js';
import {analyzeCurvedMirrorQuery,CURVED_FACTS_FORMAT,CURVED_QUERY_FORMAT} from './curved-mirror-queries.js';

export const OSCILLATION_FACTS='opticsim-axial-mirror-oscillation-facts-v1';
export const OSCILLATION_QUERY='opticsim-axial-mirror-oscillation-query-v1';
const kind='cosine-axial-mirror-conjugates';
const model='prescribed-real-axial-cosine-motion';
const grid=1n<<64n;
const encode=x=>BigInt(x*2**64);
export function mirrorOscillationCapabilities(){
  return {format:OSCILLATION_QUERY,factsFormat:OSCILLATION_FACTS,kinds:[kind],model,
    basis:'Object distance and amplitude divided by positive concave mirror focal length. Phase is a fraction of one cycle.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_MIRROR_OSCILLATION_FACTS','Unexpected cyclic mirror field.');
  for(const key of keys)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
function phaseEvents(mean,amplitude,level){
  const offset=BigInt(level)*grid-encode(mean),size=encode(amplitude);
  if(size===0n)return {state:offset===0n?'all-phases':'none',phases:[]};
  if(offset===size||offset===-size)return {state:'finite-set',phases:[offset===size?0:.5]};
  const distance=offset<0n?-offset:offset;
  const gap=Math.abs(Number(distance-size)/2**64);
  if(gap<=1e-10*(1+mean+amplitude))return {state:'numerically-indeterminate',phases:[]};
  if(distance>size)return {state:'none',phases:[]};
  const first=Math.acos(Number(offset)/Number(size))/(2*Math.PI);
  return {state:'finite-set',phases:[first,1-first]};
}
function sample(mean,amplitude,phase){
  const cosine=phase===0?1:phase===.5?-1:phase===.25||phase===.75?0:Math.cos(2*Math.PI*phase);
  const objectDistanceOverFocalLength=mean+amplitude*cosine;
  const base={phase,objectDistanceOverFocalLength};
  const exactCosine=amplitude===0||[0,.25,.5,.75].includes(phase);
  if(exactCosine&&encode(mean)+(amplitude===0?0n:BigInt(cosine)*encode(amplitude))===grid)
    return {...base,state:'afocal',signedImageDistanceOverFocalLength:null,lateralMagnification:null};
  const r=analyzeCurvedMirrorQuery({format:CURVED_FACTS_FORMAT,model:'spherical-paraxial',
    signConvention:'real-positive-local',curvature:'concave',objectDistanceOverFocalLength},
    {format:CURVED_QUERY_FORMAT,kind:'curved-mirror-image'});
  if(r.status!=='conditional'||r.value.imageKind==='at-infinity'||Math.abs(r.value.imageDistanceOverFocalLength)>1e6)
    return {...base,state:'numerically-indeterminate',signedImageDistanceOverFocalLength:null,lateralMagnification:null};
  return {...base,state:r.value.imageKind,signedImageDistanceOverFocalLength:r.value.imageDistanceOverFocalLength,
    lateralMagnification:r.value.magnification};
}
export function analyzeMirrorOscillation(f,q){
  if(f?.format!==OSCILLATION_FACTS)fail('UNSUPPORTED_FACTS','Explicit normalized axial motion and mirror facts required.');
  fields(q,['format','kind']);
  if(q.kind!==kind||q.format!==OSCILLATION_QUERY)fail('UNSUPPORTED_QUERY','Unknown cyclic mirror query.');
  fields(f,['format','model','meanDistanceOverFocalLength','amplitudeOverFocalLength','samplePhases']);
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare the instantaneous paraxial conjugate of a prescribed cosine motion.');
  const mean=f.meanDistanceOverFocalLength,amplitude=f.amplitudeOverFocalLength;
  if(![mean,amplitude].every(v=>Number.isFinite(v)&&v>=0&&v<=1000)||
      mean-amplitude<.001||(amplitude!==0&&amplitude<.001))
    fail('UNSUPPORTED_SCOPE','Require a positive real-object distance throughout the cycle and a bounded normalized amplitude.');
  if(!Array.isArray(f.samplePhases)||f.samplePhases.length>16||
    !f.samplePhases.every(t=>Number.isFinite(t)&&t>=0&&t<1)||new Set(f.samplePhases).size!==f.samplePhases.length)
    fail('INVALID_MIRROR_OSCILLATION_FACTS','Use at most 16 distinct phases in [0,1).');
  const focalEvents=phaseEvents(mean,amplitude,1);
  const coincidenceEvents={...phaseEvents(mean,amplitude,2),levelDistanceOverFocalLength:2};
  const samples=f.samplePhases.map(phase=>sample(mean,amplitude,phase));
  const unresolved=[focalEvents,coincidenceEvents,...samples].some(result=>result.state==='numerically-indeterminate');
  return {format:'opticsim-axial-mirror-oscillation-result-v1',kind,method:'conditional-analytical',
    status:unresolved?'partially-indeterminate':'conditional',native:{status:'not-run'},
    ...(unresolved?{reasonCode:'UNRESOLVED_OSCILLATION_PHASE',
      reason:'A phase event or requested sample is too close to a limiting conjugate for a complete numerical result.'}:{}),
    assumptions:['A stationary concave mirror acts on each phase of a prescribed real axial object position.'],
    limitations:['Conjugates are instantaneous paraxial results. Optical travel time, finite-speed motion and visibility are outside this model.'],
    value:{meanDistanceOverFocalLength:mean,amplitudeOverFocalLength:amplitude,
      relations:{objectDistanceOverFocalLength:'mean + amplitude*cos(2*pi*phase)',
        signedImageDistanceOverFocalLength:'uOverF/(uOverF-1)',lateralMagnification:'-1/(uOverF-1)'},
      focalEvents,coincidenceEvents,samples}};
}
