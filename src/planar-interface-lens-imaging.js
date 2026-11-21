import {isRecord} from './qualified-utils.js';
import {fromBinary64,toBinary64,add,subtract,multiply,divide,compare} from './binary64-rational.js';

export const LAYER_LENS_FACTS='opticsim-planar-interface-lens-facts-v1';
export const LAYER_LENS_QUERY='opticsim-planar-interface-lens-query-v1';
const forward='layer-lens-image-distance', inverse='layer-index-from-lens-images';
const model='planar-exit-before-fixed-paraxial-thin-lens';
const units={mm:1,cm:10,m:1000};
const one=fromBinary64(1), four=fromBinary64(4), band=fromBinary64(1e-10);
const abs=x=>x.n<0n?{n:-x.n,d:x.d}:x;
export function layerLensCapabilities(){
  return {format:LAYER_LENS_QUERY,factsFormat:LAYER_LENS_FACTS,kinds:[forward,inverse],model,
    lengthUnits:Object.keys(units),imageReference:'lens plane, positive along incident axis'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,required,optional=[]){
  if(!isRecord(o)||Object.keys(o).some(k=>!required.includes(k)&&!optional.includes(k)))fail('INVALID_LAYER_LENS_FACTS','Unexpected field.');
  for(const k of required)if(!Object.hasOwn(o,k))fail('MISSING_FACTS','Supply '+k+'.');
}
function index(x){
  if(!Number.isFinite(x)||x<1||x>4)fail('INVALID_LAYER_LENS_FACTS','Absolute indices must lie in [1,4].');
  return fromBinary64(x);
}
function length(x,unit,signed=false){
  if(!Number.isFinite(x)||(!signed && x<=0))fail('INVALID_LAYER_LENS_FACTS','Supply a finite length with the declared sign.');
  const value=fromBinary64(x), mm=multiply(unit,abs(value));
  if(compare(mm,one)<0||compare(mm,fromBinary64(10000))>0)fail('UNSUPPORTED_SCOPE','Input length magnitudes must span 1–10000 mm.');
  return value;
}
function nearZero(value,a,b){
  return value.n!==0n && compare(abs(value),multiply(band,compare(abs(a),abs(b))>=0?abs(a):abs(b)))<=0;
}
export function analyzeLayerLens(f,q){
  fields(q,['format','kind']);
  if(q.format!==LAYER_LENS_QUERY||![forward,inverse].includes(q.kind))fail('UNSUPPORTED_QUERY','Unknown layer and lens query.');
  if(f?.format!==LAYER_LENS_FACTS)fail('UNSUPPORTED_FACTS','Supply the fixed lens geometry and reference observation.');
  const input=q.kind===forward?'layerIndex':'filledImageDistance';
  fields(f,['format','model','lengthUnit','objectLensDistance','layerDepth','dryImageDistance','exteriorIndex',input]);
  if(f.model!==model||typeof f.lengthUnit!=='string'||!Object.hasOwn(units,f.lengthUnit))fail('UNSUPPORTED_MODEL','Declare the axial plane-exit thin-lens model and length unit.');
  const unit=fromBinary64(units[f.lengthUnit]), exterior=index(f.exteriorIndex);
  const h=length(f.objectLensDistance,unit), depth=length(f.layerDepth,unit), dry=length(f.dryImageDistance,unit,true);
  const gap=subtract(h,depth);
  if(compare(multiply(gap,unit),one)<0)fail('UNSUPPORTED_SCOPE','Keep at least 1 mm of homogeneous exterior between boundary and lens.');
  const target=q.kind===forward?index(f.layerIndex):length(f.filledImageDistance,unit,true);
  const base={format:'opticsim-planar-interface-lens-result-v1',kind:q.kind,method:'conditional-analytical',
    native:{status:'not-run'},assumptions:['Dry and filled observations use the same axial point, stationary lens and exterior medium.'],
    limitations:['Detector crossings and angular spread require a separately authored finite native geometry.']};
  const uncertain=()=>({...base,status:'numerically-indeterminate',reasonCode:'UNRESOLVED_LAYER_LENS',reason:'A subtraction or distance exceeds the numerical policy.',value:null});
  const noIndex=()=>({...base,status:'unavailable',reasonCode:'NO_ADMISSIBLE_LAYER_INDEX',reason:'The two observations do not identify an index within [1,4] for the supplied positive depth.',value:null});
  const invH=divide(one,h), invDry=divide(one,dry), power=add(invH,invDry);
  if(nearZero(power,invH,invDry))return uncertain();
  if(!power.n)fail('UNSUPPORTED_SCOPE','Calibration requires a powered lens.');
  const distances={lengthUnit:f.lengthUnit,reference:'lens plane, positive along incident axis'};
  if(q.kind===forward){
    const u=add(gap,divide(multiply(depth,exterior),target));
    const invU=divide(one,u), vergence=subtract(power,invU);
    if(!vergence.n)return {...base,status:'conditional',value:{...distances,state:'at-infinity',signedImageDistance:null}};
    if(nearZero(vergence,power,invU))return uncertain();
    const z=divide(one,vergence);
    if(compare(multiply(abs(z),unit),fromBinary64(1e9))>0)return uncertain();
    return {...base,status:'conditional',value:{...distances,state:z.n>0n?'real':'virtual',signedImageDistance:toBinary64(z)}};
  }
  const invImage=divide(one,target), invU=subtract(power,invImage);
  if(nearZero(invU,power,invImage))return uncertain();
  if(invU.n<=0n)return noIndex();
  const u=divide(one,invU), apparentDepth=subtract(u,gap);
  if(nearZero(apparentDepth,u,gap))return uncertain();
  if(apparentDepth.n<=0n)return noIndex();
  const candidate=divide(multiply(depth,exterior),apparentDepth);
  if(compare(candidate,one)<0||compare(candidate,four)>0)return noIndex();
  return {...base,status:'conditional',value:{layerIndex:toBinary64(candidate)}};
}
