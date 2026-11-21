import {isRecord} from './qualified-utils.js';
import {calculateLensTrain} from './lens-train-matrix.js';

export const OFFSET_FACTS='opticsim-offset-pair-facts-v1';
export const OFFSET_QUERY='opticsim-offset-pair-query-v1';
const kind='offset-pair-collimated-focus';
export function offsetFocusCapabilities(){
  return {format:OFFSET_QUERY,factsFormat:OFFSET_FACTS,kinds:[kind],model:'parallel-axes-ideal-thin-pair',
    coordinates:'Origin at first lens centre, positive x along propagation, signed transverse shift from first centre to second.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,names){
  if(!isRecord(o)||Object.keys(o).some(k=>!names.includes(k)))fail('INVALID_OFFSET_FACTS','Unexpected offset-pair field.');
  for(const key of names)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
function indeterminate(){
  return {status:'numerically-indeterminate',value:null,reasonCode:'ILL_CONDITIONED_OFFSET_FOCUS',
    reason:'Near cancellation or excessive normalized extrapolation prevents a stable coordinate.'};
}
function focus(k,q){
  // Lengths use the positive first focal length as their common scale. The
  // same ABCD kernel acts on heights relative to the first lens axis.
  const {matrix:{a,c}}=calculateLensTrain(0,[{x:0,focalLength:1},{x:k,focalLength:q}]);
  // In this bounded binary64 domain all input ratios are multiples of 2^-64.
  const unit=1n<<64n,K=BigInt(k*2**64),Q=BigInt(q*2**64);
  const denominator=K-unit-Q;
  if(denominator===0n)return {status:'conditional',value:{state:'afocal',xOverFrontFocalLength:null,
    transverseOffsetCoefficient:null,outputSlopeCoefficientOfOffsetOverFrontFocalLength:1/q}};
  if(Math.abs(k-1-q)<=1e-10*(1+k+Math.abs(q))||
      (K!==unit&&Math.abs(a)<=1e-10*(1+k)))return indeterminate();
  const z=-a/c;
  const x=k+z;
  const exactFirstPlane=K*(K-unit)===Q*unit;
  if(!exactFirstPlane&&Math.abs(x)<=1e-10*(k+Math.abs(z)))return indeterminate();
  if(![x,z,z/q].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6))return indeterminate();
  // The axial ray through the first centre acquires slope offset/f2 at
  // the second lens. At the focus the input-height dependence vanishes.
  return {status:'conditional',value:{state:K===unit?'at-second-lens':z>0?'downstream':'upstream',
    xOverFrontFocalLength:exactFirstPlane?0:x,backDistanceOverFrontFocalLength:K===unit?0:z,
    transverseOffsetCoefficient:K===unit?0:z/q}};
}
export function analyzeOffsetFocus(f,q){
  if(f?.format!==OFFSET_FACTS)fail('UNSUPPORTED_FACTS','Explicit offset-pair facts required.');
  fields(q,['kind','format']);
  if(q.kind!==kind||q.format!==OFFSET_QUERY)fail('UNSUPPORTED_QUERY','Unknown offset-pair query.');
  fields(f,['format','model','input','frontLensId','rearLensId','gapOverFrontFocalLength','rearOverFrontFocalLength']);
  if(f.model!=='parallel-axes-ideal-thin-pair'||f.input!=='collimated-along-positive-x')
    fail('UNSUPPORTED_MODEL','Require parallel thin lenses, positive first focal length and horizontal collimated input.');
  if(![f.frontLensId,f.rearLensId].every(id=>typeof id==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id))||f.frontLensId===f.rearLensId)
    fail('INVALID_OFFSET_FACTS','Require two distinct stable lens IDs in encounter order.');
  const k=f.gapOverFrontFocalLength,r=f.rearOverFrontFocalLength;
  if(!Number.isFinite(k)||k<.001||k>1000||!Number.isFinite(r)||Math.abs(r)<.001||Math.abs(r)>1000)
    fail('UNSUPPORTED_SCOPE','Require gap and absolute rear focal length ratios from 0.001 to 1000.');
  return {format:'opticsim-offset-pair-result-v1',kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Two separated parallel ideal thin lenses, a paraxial collimated bundle and encounter with both apertures. The first focal length is positive.'],
    limitations:['Finite-aperture misses can produce multiple outgoing bundles. Native detection of an image is outside this query.'],
    ...focus(k,r)};
}
