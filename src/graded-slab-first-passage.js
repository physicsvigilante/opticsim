import {isRecord} from './qualified-utils.js';
import {classifySnellTransmission,RAD} from './angular-math.js';

export const GRADED_SLAB_FACTS='opticsim-graded-slab-first-passage-facts-v1';
export const GRADED_SLAB_QUERY='opticsim-graded-slab-first-passage-query-v1';
const kind='graded-slab-first-far-face';
const model='positive-linear-squared-index-slab';
const units=Object.freeze({mm:1,cm:10,m:1000});
export function gradedSlabCapabilities(){
  return {format:GRADED_SLAB_QUERY,factsFormat:GRADED_SLAB_FACTS,kinds:[kind],model,
    coordinates:'Origin at entry. x is parallel to the faces in the forward transverse direction, y is inward normal.',
    geometryScale:['dimensional length and thickness','symbolic-thickness-over-gradient-length at matched grazing entry'],
    entry:['finite-incidence','grazing-entry-limit'],field:'n(y)^2 = baseIndexSquared + y/gradientLength'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_GRADED_SLAB_FACTS','Unexpected graded-slab field.');
  for(const key of keys)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
function unresolved(){
  return {status:'numerically-indeterminate',value:null,reasonCode:'UNCERTAIN_GRADED_SLAB_FIRST_PASSAGE',
    reason:'Near entry degeneracy or excessive transverse travel prevents a bounded position.'};
}
const grid=2**64;
const exactMatch=(squared,index)=>BigInt(squared*grid)*(1n<<64n)===BigInt(index*grid)**2n;
function emerge(q,index,farIndex,angle,grazing){
  if(grazing&&q===index)return {state:'exact-critical-limit',angleLimitDeg:90};
  const result=classifySnellTransmission(q,farIndex,index,angle);
  if(result.uncertainCritical)return {state:'near-critical-unresolved'};
  return result.tir?{state:'total-internal-reflection'}:{state:'transmission',angleFromNormalDeg:result.out};
}
function firstPassage(f,scale,angle,grazing){
  const {baseIndexSquared:a,entryIndex:n,exitIndex,thickness,gradientLength:length}=f;
  const q=grazing?n:n*Math.sin(angle*RAD),cosine=grazing?0:Math.cos(angle*RAD);
  const entryHeadroom=(a-n*n)+(n*cosine)**2;
  if(entryHeadroom<0){
    if(entryHeadroom>=-1e-10*Math.max(a,n*n))return unresolved();
    return {status:'unavailable',value:null,reasonCode:'NO_INWARD_ENTRY',
      reason:'The incident tangential momentum exceeds the index at the entry face.'};
  }
  if(!grazing&&q!==0&&entryHeadroom<=1e-10*Math.max(a,n*n))return unresolved();
  if(grazing&&entryHeadroom<=1e-10*Math.max(a,n*n)&&!exactMatch(a,n))return unresolved();
  const entryRoot=Math.sqrt(entryHeadroom),farRoot=Math.sqrt(entryHeadroom+thickness/length);
  const x=2*q*thickness/(entryRoot+farRoot);
  if(!Number.isFinite(x)||x*scale>1e6)return unresolved();
  const farIndex=Math.sqrt(a+thickness/length);
  const angleAtFarFace=Math.atan2(q,farRoot)/RAD;
  const emergence=emerge(q,exitIndex,farIndex,angleAtFarFace,grazing);
  return {status:'conditional',value:{lengthUnit:f.lengthUnit,tangentialMomentum:q,
    trajectory:q===0?{kind:'normal',x:0}:{kind:'quadratic-y-of-x',linearCoefficient:entryRoot/q,
      quadraticCoefficientPerLengthUnit:1/(4*q*q*length)},
    firstFarFacePoint:{x,y:thickness},emergence}};
}
function symbolic(f){
  fields(f.entry,['kind']);
  if(f.geometryScale!=='symbolic-thickness-over-gradient-length'||f.entry.kind!=='grazing-entry-limit'||
      f.baseIndexSquared>=16||!exactMatch(f.baseIndexSquared,f.entryIndex))
    fail('UNSUPPORTED_SCOPE','Use an explicit matched grazing entry for a symbolic positive thickness-to-gradient-length ratio.');
  const q=f.entryIndex;
  return {status:'conditional',value:{coordinateUnit:'gradient-length',tangentialMomentum:q,
    domain:{thicknessOverGradientLength:{minimumExclusive:0,maximumInclusive:16-f.baseIndexSquared}},
    trajectory:{kind:'quadratic-y-of-x',linearCoefficient:0,quadraticCoefficient:1/(4*q*q)},
    firstFarFacePoint:{xOverGradientLength:{kind:'scaled-square-root-of-thickness-ratio',coefficient:2*q},
      yOverGradientLength:{kind:'thickness-ratio'}},
    emergence:emerge(q,f.exitIndex,null,null,true)}};
}
export function analyzeGradedSlab(f,q){
  if(f?.format!==GRADED_SLAB_FACTS)fail('UNSUPPORTED_FACTS','Explicit graded-slab first-passage facts required.');
  fields(q,['format','kind']);
  if(q.format!==GRADED_SLAB_QUERY||q.kind!==kind)fail('UNSUPPORTED_QUERY','Unknown graded-slab query.');
  const symbolicScale=Object.hasOwn(f,'geometryScale');
  fields(f,['format','model','baseIndexSquared','entryIndex','exitIndex','entry',
    ...(symbolicScale?['geometryScale']:['lengthUnit','gradientLength','thickness'])]);
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare the positive linear squared-index law and a slab with parallel faces.');
  if(![f.entryIndex,f.exitIndex].every(v=>Number.isFinite(v)&&v>=1&&v<=4)||
    !Number.isFinite(f.baseIndexSquared)||f.baseIndexSquared<1||f.baseIndexSquared>16)
    fail('UNSUPPORTED_SCOPE','Use absolute indices in [1,4] and base squared index in [1,16].');
  const base={format:'opticsim-graded-slab-first-passage-result-v1',kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Homogeneous exterior on each side, positive squared-index gradient directed into the slab, forward tangential momentum conserved.'],
    limitations:['The first far-face contact and transmitted limit are distinct quantities. The inward grazing limit does not describe a native external ray crossing.']};
  if(symbolicScale)return {...base,...symbolic(f)};
  if(typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('INVALID_GRADED_SLAB_FACTS','Use mm, cm or m.');
  const scale=units[f.lengthUnit];
  if(![f.gradientLength,f.thickness].every(v=>Number.isFinite(v)&&v*scale>=.001&&v*scale<=10000)||
    f.baseIndexSquared+f.thickness/f.gradientLength>16)
    fail('UNSUPPORTED_SCOPE','Require positive dimensions and indices from 1 to 4 throughout the slab and both exteriors.');
  const grazing=f.entry?.kind==='grazing-entry-limit';
  let angle=90;
  if(grazing)fields(f.entry,['kind']);
  else{
    fields(f.entry,['kind','angleFromNormalDeg']);
    angle=f.entry.angleFromNormalDeg;
    if(f.entry.kind!=='finite-incidence'||!Number.isFinite(angle)||angle<0||angle>=90||(angle>0&&angle<.0001))
      fail('UNSUPPORTED_SCOPE','Use normal incidence or a finite angle from 0.0001 to under 90 degrees.');
  }
  return {...base,...firstPassage(f,scale,angle,grazing)};
}
