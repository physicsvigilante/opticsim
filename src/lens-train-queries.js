// Reduced physical facts for the EXISTING forward ideal-lens mathematics.
// Not a native scene, inverse method, material-lens model or image detector.
import {isRecord} from './qualified-utils.js';
import {COMPONENT_BOUNDS} from './contract.js';
import {calculateLensTrain,LENS_INFINITY_TOLERANCE,LENS_MAGNIFICATION_TOLERANCE} from './lens-train-matrix.js';
export const LENS_FACTS_FORMAT='opticsim-lens-train-facts-v1';
export const LENS_QUERY_FORMAT='opticsim-lens-train-query-v1';
const model='coaxial-ideal-thin-lenses';
const convention='x-increasing';
const kinds=Object.freeze(['lens-train-image','lens-train-image-height']);
const scales=Object.freeze({mm:1,cm:10,m:1000});
const own=(o,k)=>Object.hasOwn(o,k);
export class LensTrainQueryError extends Error {
  constructor(code,message){super(message);this.name='LensTrainQueryError';this.code=code;}
}
const fail=(code,message)=>{throw new LensTrainQueryError(code,message);};
function fields(value,allowed,required,label){
  if(!isRecord(value))fail('INVALID_LENS_FACTS',label+' must be an object');
  const extra=Object.keys(value).filter(k=>!allowed.includes(k));
  if(extra.length)fail('INVALID_LENS_FACTS',label+' has unsupported fields: '+extra.join(', '));
  const missing=required.filter(k=>!own(value,k));
  if(missing.length)fail('MISSING_FACTS',label+' requires '+missing.join(', '));
}
function length(value,scale,label){
  if(typeof value!=='number'||!Number.isFinite(value))fail('INVALID_LENS_FACTS',label+' must be an explicit finite number');
  const mm=value*scale;
  if(!Number.isFinite(mm)||mm<COMPONENT_BOUNDS.coordinateMm[0]||mm>COMPONENT_BOUNDS.coordinateMm[1])
    fail('UNSUPPORTED_SCOPE',label+' must lie within +/-10000 mm in this bounded analytical contract');
  return mm;
}
export function lensTrainCapabilities(){
  return {format:LENS_QUERY_FORMAT,factsFormat:LENS_FACTS_FORMAT,kinds:[...kinds],
    model,signConvention:convention,lengthUnits:Object.keys(scales),maxLenses:4,
    requiredFacts:['format','model','signConvention','lengthUnit','objectX','lenses'],
    lenses:{count:[1,4],required:['id','x','focalLength'],order:'Derived from increasing explicit x; the submitted list is never mutated.'},
    optionalFacts:['objectHeight'],height:'objectHeight is required only by lens-train-image-height; lens-train-image never supplies imageHeight.',
    signs:'Propagation is +x, positive focal length converges, imageDistance is signed from the last lens; positive height is along one fixed transverse axis.',
    scope:'Finite real initial object before 1-4 separated stationary coaxial ideal thin lenses in a uniform medium; intermediate virtual objects and collimation are supported.',
    bounds:{coordinateMm:[...COMPONENT_BOUNDS.coordinateMm],minimumAbsFocalLengthMm:COMPONENT_BOUNDS.minimumAbsFocalLengthMm,
      minimumAxialSeparationMm:COMPONENT_BOUNDS.sourcePlaneSeparationMm},
    numericalPolicy:{canonicalLengthUnit:'mm',infinityTolerance:LENS_INFINITY_TOLERANCE,magnificationRelativeTolerance:LENS_MAGNIFICATION_TOLERANCE,
      nearZero:'A nonzero D within the existing infinity threshold is numerically-indeterminate, not a certified infinite image.',
      zeroD:'A computed zero D must also retain -B*C=1 within the existing magnification tolerance.'},
    limits:['No source emission, brightness, aperture, object height or scene is invented.',
      'Not an inverse, thick/material-lens, telescope, mixed-optics, aperture-throughput or native image-detection operation.',
      'No automatic native rendering, legacy request substitution, saved-scene migration or qualification upgrade.']};
}
export function analyzeLensTrainQuery(input,query){
  fields(query,['format','kind'],['format','kind'],'Lens-train query');
  if(query.format!==LENS_QUERY_FORMAT||!kinds.includes(query.kind))fail('UNSUPPORTED_QUERY','Unknown forward lens-train query');
  if(!isRecord(input)||input.format!==LENS_FACTS_FORMAT)
    fail('UNSUPPORTED_FACTS','Use explicit '+LENS_FACTS_FORMAT+' facts; a native apparatus is not reduced by deleting other components');
  fields(input,['format','model','signConvention','lengthUnit','objectX','objectHeight','lenses'],
    ['format','model','signConvention','lengthUnit','objectX','lenses'],'Lens-train facts');
  if(input.model!==model)fail('UNSUPPORTED_MODEL','Only the explicit '+model+' approximation is supported');
  if(input.signConvention!==convention)fail('UNSUPPORTED_SCOPE','State x-increasing propagation; no sign or reflection path is inferred');
  if(typeof input.lengthUnit!=='string'||!own(scales,input.lengthUnit))fail('INVALID_LENS_FACTS','lengthUnit must be mm, cm or m');
  const scale=scales[input.lengthUnit],objectX=length(input.objectX,scale,'objectX');
  if(!Array.isArray(input.lenses)||input.lenses.length<1||input.lenses.length>4)
    fail('UNSUPPORTED_SCOPE','Forward analysis supports one to four explicitly located ideal thin lenses');
  const ids=new Set();
  const lenses=input.lenses.map((lens,i)=>{
    fields(lens,['id','x','focalLength'],['id','x','focalLength'],'Lens '+i);
    if(typeof lens.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(lens.id)||ids.has(lens.id))
      fail('INVALID_LENS_FACTS','Every lens requires a unique stable ID');
    ids.add(lens.id);
    const x=length(lens.x,scale,lens.id+'.x'),focalLength=length(lens.focalLength,scale,lens.id+'.focalLength');
    if(Math.abs(focalLength)<COMPONENT_BOUNDS.minimumAbsFocalLengthMm)
      fail('UNSUPPORTED_SCOPE','Focal-length magnitude must be at least 1 mm; zero is not a thin-lens model');
    return {id:lens.id,x,focalLength};
  }).sort((a,b)=>a.x-b.x);
  let previous=objectX;
  for(const lens of lenses){
    if(lens.x-previous<COMPONENT_BOUNDS.sourcePlaneSeparationMm)
      fail('UNSUPPORTED_SCOPE','The real initial object must precede the lens train; successive planes require at least 0.01 mm separation');
    previous=lens.x;
  }
  const hasHeight=own(input,'objectHeight');
  const objectHeight=hasHeight?length(input.objectHeight,scale,'objectHeight'):undefined;
  const wantsHeight=query.kind==='lens-train-image-height';
  if(wantsHeight&&!hasHeight)fail('MISSING_FACTS','objectHeight is required for image height, not for the axial image calculation');
  const {matrix,prediction}=calculateLensTrain(objectX,lenses,wantsHeight?objectHeight:undefined);
  const base={format:'opticsim-lens-train-result-v1',kind:query.kind,method:'conditional-analytical',model,
    native:{status:'not-run',observations:null},nativeImageDetected:false,questionSupport:'not-assessed-by-engine',
    assumptions:['Stationary coaxial ideal thin lenses, uniform intervening medium and paraxial imaging in the +x direction.',
      'The calculation is conditional on a transmitted pencil interacting with every stated lens; finite-aperture illumination is not established.'],
    limitations:['No native scene or rays were prepared or executed; no detected image, physical throughput, aberration or source interpretation is certified.',
      'The initial object is finite and real; intermediate images may be real, virtual or at infinity.',
      'Coordinates and focal lengths are normalized to mm for the existing numerical policy; results use the declared length unit.'],
    numericalPolicy:lensTrainCapabilities().numericalPolicy};
  if(prediction.kind==='unavailable')return {...base,status:'numerically-indeterminate',value:null,
    reasonCode:'UNRELIABLE_LENS_MATRIX',reason:prediction.reason};
  if(prediction.kind==='at-infinity'&&matrix.d!==0)return {...base,status:'numerically-indeterminate',value:null,
    reasonCode:'NEAR_FOCAL_SINGULARITY',reason:'A nonzero angular coefficient D is inside the existing infinity tolerance. No reliable finite or exactly infinite image is reported.'};
  // Zero after floating-point cancellation is not sufficient for a usable
  // infinite-image claim. Apply the same unit-determinant consistency criterion
  // used by the existing finite magnification check, without changing legacy output.
  if(prediction.kind==='at-infinity'&&Math.abs(-matrix.b*matrix.c-1)>LENS_MAGNIFICATION_TOLERANCE)
    return {...base,status:'numerically-indeterminate',value:null,reasonCode:'UNRELIABLE_LENS_MATRIX',
      reason:'The zero-D matrix fails determinant consistency; numerical cancellation can mimic an infinite image.'};
  if(prediction.kind==='at-infinity'&&wantsHeight)return {...base,status:'unavailable',value:null,
    reasonCode:'NO_FINITE_IMAGE_HEIGHT',reason:'There is no finite transverse image height when the computed image is at infinity.'};
  const last=lenses.at(-1),atInfinity=prediction.kind==='at-infinity';
  const value={imageKind:prediction.kind,imageX:atInfinity?null:prediction.x/scale,
    imageDistance:atInfinity?null:prediction.distance/scale,magnification:atInfinity?null:prediction.magnification,
    referenceLensId:last.id,lengthUnit:input.lengthUnit,
    ...(wantsHeight?{imageHeight:prediction.y/scale}:{}),
    ...(atInfinity?{infinityClassification:'zero D in the computed ideal matrix; not a native detection'}:{})};
  return {...base,status:'conditional',value,reasonCode:null};
}
