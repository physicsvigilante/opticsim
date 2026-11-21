import {isRecord} from './qualified-utils.js';

export const SLAB_MIRROR_FACTS='opticsim-slab-mirror-conjugate-facts-v1';
export const SLAB_MIRROR_QUERY='opticsim-slab-mirror-conjugate-query-v1';
const kind='compare-curved-mirror-conjugates-with-slab';
const units=Object.freeze({mm:1,cm:10,m:1000});
const model='paraxial-concave-mirror-with-parallel-plate';
export function slabMirrorCapabilities(){
  return {format:SLAB_MIRROR_QUERY,factsFormat:SLAB_MIRROR_FACTS,kinds:[kind],model,
    convention:'Positive axial distance from the mirror toward the real object. Signed transverse magnification.',
    placement:['explicit-near-face','between-centre-and-object']};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_SLAB_MIRROR_FACTS','Unexpected slab-mirror field.');
  for(const key of keys)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
const grid=2**64;
const encode=value=>BigInt(value*grid);
function readFacts(f){
  fields(f,['format','model','lengthUnit','mirrorRadius','objectDistance','plate']);
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare a stationary paraxial concave mirror and homogeneous parallel plate.');
  if(typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('INVALID_SLAB_MIRROR_FACTS','Supply mm, cm or m.');
  const mm=units[f.lengthUnit],p=f.plate;
  fields(p,['thickness','exteriorIndex','glassIndex','placement']);
  for(const v of [f.mirrorRadius,f.objectDistance,p.thickness])
    if(!Number.isFinite(v)||v*mm<1||v*mm>10000)fail('UNSUPPORTED_SCOPE','Use positive dimensions between 1 and 10000 mm.');
  if(![p.exteriorIndex,p.glassIndex].every(v=>Number.isFinite(v)&&v>=1&&v<=4)||p.glassIndex<p.exteriorIndex)
    fail('UNSUPPORTED_SCOPE','Use explicit indices in [1,4] with glass index at least the exterior index.');
  const R=encode(f.mirrorRadius),U=encode(f.objectDistance),T=encode(p.thickness);
  let face=null;
  if(p.placement?.kind==='between-centre-and-object'){
    fields(p.placement,['kind']);
    if(U-R-T<=0n)fail('UNSUPPORTED_SCOPE','The plate needs positive clearance between the centre of curvature and object.');
  }else{
    fields(p.placement,['kind','nearDistance']);
    if(p.placement.kind!=='explicit-near-face')fail('UNSUPPORTED_SCOPE','Declare the mirror-side face distance or the centre-to-object region.');
    const distance=p.placement.nearDistance;
    if(!Number.isFinite(distance)||distance*mm<1||distance*mm>10000)
      fail('UNSUPPORTED_SCOPE','The near face must have a positive distance of 1–10000 mm.');
    face=encode(distance);
    if(face+T>=U)fail('UNSUPPORTED_SCOPE','Keep the real object exterior and separated from the far plate face.');
  }
  return {mm,R,U,T,face,exterior:encode(p.exteriorIndex),glass:encode(p.glassIndex)};
}
function conjugate({R,U,T,exterior,glass,face,mm},withPlate){
  const effective=U*glass-(withPlate?T*(glass-exterior):0n);
  const numerator=R*effective,denominator=2n*effective-R*glass;
  if(denominator===0n)return {result:{state:'afocal',signedDistance:null,magnification:null}};
  if(Math.abs(Number(denominator))<=1e-10*Number(2n*effective+R*glass))return null;
  const reduced=Number(numerator)/Number(denominator)/grid;
  const magnification=-Number(R*glass)/Number(denominator);
  function finite(state,n=numerator,d=denominator){
    const distance=Number(n)/Number(d)/grid;
    if(Math.abs(distance)*mm>1e8||Math.abs(magnification)>1e6)return null;
    return {fraction:[n,d],result:{state,signedDistance:distance,magnification}};
  }
  if(denominator<0n)return finite('virtual-behind-mirror');
  if(!withPlate||face===null)return finite('real-in-exterior');
  const nearDifference=numerator-face*denominator;
  const farReduced=face*glass+T*exterior;
  const farDifference=numerator*glass-farReduced*denominator;
  const near=Number(face)/grid;
  const far=Number(face+T)/grid;
  const nearOffset=Number(nearDifference)/Number(denominator)/grid;
  const farOffset=Number(farDifference)/Number(denominator*glass)/grid;
  if(nearDifference===0n)return finite('at-near-face',face,1n);
  if(farDifference===0n)return finite('at-far-face',face+T,1n);
  const clearance=1e-10*Math.max(1/mm,near,far,Math.abs(reduced));
  if(Math.min(Math.abs(nearOffset),Math.abs(farOffset))<=clearance)return null;
  if(nearDifference<0n)return finite('real-in-exterior');
  if(farDifference<0n)return finite('real-in-plate',face*denominator*exterior+nearDifference*glass,denominator*exterior);
  return finite('real-beyond-plate',(face+T)*denominator*glass+farDifference,denominator*glass);
}
function comparison(bare,inserted,lengthUnit){
  let positionChange=null,sizeRatio=null;
  if(bare.fraction&&inserted.fraction){
    const [bn,bd]=bare.fraction,[an,ad]=inserted.fraction;
    positionChange=Number(an*bd-bn*ad)/Number(ad*bd)/grid;
    sizeRatio=Math.abs(inserted.result.magnification/bare.result.magnification);
  }
  return {lengthUnit,bare:bare.result,inserted:inserted.result,positionChange,sizeRatio};
}
export function analyzeSlabMirror(f,q){
  if(f?.format!==SLAB_MIRROR_FACTS)fail('UNSUPPORTED_FACTS','Explicit slab and concave mirror facts required.');
  fields(q,['format','kind']);
  if(q.format!==SLAB_MIRROR_QUERY||q.kind!==kind)fail('UNSUPPORTED_QUERY','Unknown slab-mirror comparison.');
  const geometry=readFacts(f);
  const bare=conjugate(geometry,false),inserted=conjugate(geometry,true);
  return {format:'opticsim-slab-mirror-conjugate-result-v1',kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Paraxial axial real object and first specular reflection. Direct transmission at each slab encounter.'],
    limitations:['Image size is given relative to the same small object. Virtual distance is a local continuation of the reflected bundle at the mirror.'],
    ...(bare&&inserted?{status:'conditional',value:comparison(bare,inserted,f.lengthUnit)}:
      {status:'numerically-indeterminate',value:null,reasonCode:'ILL_CONDITIONED_SLAB_MIRROR',
        reason:'Near-focus, near-interface or excessive conjugate requires more precise facts.'})};
}
