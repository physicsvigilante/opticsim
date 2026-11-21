import {isRecord} from './qualified-utils.js';

export const SURFACE_FOCUS_FACTS='opticsim-two-surface-focus-facts-v1';
export const SURFACE_FOCUS_QUERY='opticsim-two-surface-focus-query-v1';
const kind='two-surface-back-focus';
const scales={mm:.001,cm:.01,m:1};
export function surfaceFocusCapabilities(){
  return {format:SURFACE_FOCUS_QUERY,factsFormat:SURFACE_FOCUS_FACTS,kinds:[kind],
    incidence:'collimated-positive-x',geometry:['sphere','two-coaxial-spherical-surfaces'],
    units:Object.keys(scales),distanceOrigin:'rear pole',signedRadius:'positive if centre lies downstream'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_SURFACE_FACTS','Unexpected field in two-surface focus facts.');
  for(const k of keys)if(!Object.hasOwn(o,k))fail('MISSING_FACTS','Missing '+k);
}
const uncertain=()=>({status:'numerically-indeterminate',value:null,reasonCode:'ILL_CONDITIONED_SURFACE_FOCUS',
  reason:'Near material matching, cancellation or excessive conjugate distance prevents a qualified value.'});
const tiny=(x,scale)=>x!==0&&Math.abs(x)<=1e-10*scale;
const tolerance=1e-10;
// The bounded radii, thicknesses and indices are integer multiples of 2^-64
// in their authored units. Exact polynomials separate zeros from rounded zeros.
function evaluate(n0,n,n2,r1,r2,d){
  const p1=(n-n0)/r1,p2=(n2-n)/r2;
  const bend=d*p1/n,a=1-bend,p=p1+a*p2;
  const [i0,i,i2,front,rear,thickness]=[n0,n,n2,r1,r2,d].map(x=>BigInt(x*2**64));
  const height=i*front-thickness*(i-i0);
  const power=(i-i0)*i*rear+(i2-i)*height;
  if(tiny(n-n0,Math.max(n,n0))||tiny(n2-n,Math.max(n2,n)))return null;
  if(height!==0n&&Math.abs(a)<=tolerance*(1+Math.abs(bend)))return null;
  if(power!==0n&&Math.abs(p)<=tolerance*(Math.abs(p1)+Math.abs(a*p2)))return null;
  if(power===0n)return {state:'afocal',back:null,power:0};
  // numerator has one extra factor of 2^64 relative to the denominator.
  const back=Number(i2*height*rear)/Number(power)/2**64;
  return {state:height===0n?'at-rear-pole':back>0?'downstream':'upstream',back,power:Number(power)/Number(i*front*rear)};
}
function sphere(g){
  if(g.materialBasis==='symbolic-relative-index'){
    fields(g,['kind','materialBasis']);
    return {status:'conditional',value:{parameter:'m = nCore/nExterior > 0',radius:'R > 0',
      forNonUnitRatio:{signedDistanceFromRearPoleOverR:'(2-m)/(2*(m-1))',signedDistanceFromCentreOverR:'m/(2*(m-1))'},
      matched:'afocal at m=1',rearPole:'focus at rear pole for m=2'}};
  }
  fields(g,['kind','materialBasis','coreToExteriorRatio']);
  if(g.materialBasis!=='relative-index')fail('UNSUPPORTED_SCOPE','Declare a common exterior relative-index basis.');
  const m=g.coreToExteriorRatio;
  if(!Number.isFinite(m)||m<.25||m>4)fail('INVALID_SURFACE_FACTS','Relative index must be in [0.25,4].');
  const s=evaluate(1,m,1,1,-1,2);
  if(!s)return uncertain();
  return {status:'conditional',value:{state:s.state,signedDistanceFromRearPoleOverR:s.back,
    signedDistanceFromCentreOverR:s.back===null?null:1+s.back}};
}
function lens(g){
  fields(g,['kind','lengthUnit','entranceIndex','coreIndex','exitIndex','front','rear','axialThickness']);
  if(typeof g.lengthUnit!=='string'||!Object.hasOwn(scales,g.lengthUnit))fail('INVALID_SURFACE_FACTS','Use mm, cm or m.');
  const scale=scales[g.lengthUnit];
  for(const n of [g.entranceIndex,g.coreIndex,g.exitIndex])
    if(!Number.isFinite(n)||n<1||n>4)fail('INVALID_SURFACE_FACTS','Absolute indices must be in [1,4].');
  for(const face of [g.front,g.rear]){
    fields(face,['id','signedRadius']);
    if(typeof face.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(face.id))fail('INVALID_SURFACE_FACTS','Invalid face ID.');
    if(!Number.isFinite(face.signedRadius))fail('INVALID_SURFACE_FACTS','Specify signed numeric radii.');
  }
  if(g.front.id===g.rear.id)fail('INVALID_SURFACE_FACTS','Use distinct face IDs.');
  for(const length of [g.axialThickness,Math.abs(g.front.signedRadius),Math.abs(g.rear.signedRadius)])
    if(!Number.isFinite(length)||length*scale<.001||length*scale>10)fail('INVALID_SURFACE_FACTS','Thickness and radius magnitudes must span 1–10000 mm.');
  const s=evaluate(g.entranceIndex,g.coreIndex,g.exitIndex,g.front.signedRadius,g.rear.signedRadius,g.axialThickness);
  if(!s||Math.abs(s.back)*scale>1e6)return uncertain();
  return {status:'conditional',value:{state:s.state,signedBackFocalDistance:s.back,lengthUnit:g.lengthUnit,
    referenceFaceId:g.rear.id,entranceFaceId:g.front.id,systemPowerD:s.power/scale}};
}
export function analyzeSurfaceFocus(f,q){
  fields(q,['format','kind']);
  if(q.format!==SURFACE_FOCUS_QUERY||q.kind!==kind)fail('UNSUPPORTED_QUERY','Unknown two-surface query.');
  if(f?.format!==SURFACE_FOCUS_FACTS)fail('UNSUPPORTED_FACTS','Explicit two-surface focus facts required.');
  fields(f,['format','incidence','geometry']);
  if(f.incidence!=='collimated-positive-x')fail('UNSUPPORTED_SCOPE','Requires collimated paraxial input along +x.');
  const g=f.geometry;
  if(!['sphere','two-coaxial-spherical-surfaces'].includes(g?.kind))fail('UNSUPPORTED_SCOPE','Declare the surface geometry.');
  return {format:'opticsim-two-surface-focus-result-v1',kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Two coaxial spherical refractions with homogeneous propagation between poles and a transmitted paraxial pencil.'],
    limitations:['No finite-aperture focus, measured image, aberration, irradiance or visibility determination.'],
    ...(g.kind==='sphere'?sphere(g):lens(g))};
}
