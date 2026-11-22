// Conditional inverse paraxial reconstruction of a single stationary ideal thin
// lens on the optical axis (y = 0) from an explicit off-axis real point object
// O = (xO, yO) and its conjugate image point I = (xI, yI) in +x propagation.
// Pure analytical mathematics using exact binary64-rational arithmetic; no
// native scene construction, ray routing or image detection.
import {isRecord} from './qualified-utils.js';
import {COMPONENT_BOUNDS} from './contract.js';
import {absolute,add,compare,divide,fromBinary64,multiply,subtract,toBinary64} from './binary64-rational.js';

export const CONJUGATE_RECONSTRUCTION_FACTS='opticsim-thin-lens-conjugate-reconstruction-facts-v1';
export const CONJUGATE_RECONSTRUCTION_QUERY='opticsim-thin-lens-conjugate-reconstruction-query-v1';
const kind='thin-lens-conjugate-reconstruction';
const model='coaxial-ideal-thin-lens-real-object-inverse';
const convention='x-increasing';
const physicalScales=Object.freeze({mm:1,cm:10,m:1000});
const lengthUnits=Object.freeze(['mm','cm','m','scale-unit']);
const ONE=fromBinary64(1);
const EPS=divide(ONE,fromBinary64(1e10));
const DERIVED_CAP=fromBinary64(1e9);
const MIN_PHYS_COORD=fromBinary64(COMPONENT_BOUNDS.coordinateMm[0]);
const MAX_PHYS_COORD=fromBinary64(COMPONENT_BOUNDS.coordinateMm[1]);
const MIN_PHYS_SEP=divide(ONE,fromBinary64(100));
const MIN_SCALE_COORD=fromBinary64(-10000);
const MAX_SCALE_COORD=fromBinary64(10000);
const MIN_SCALE_SEP=divide(ONE,fromBinary64(1000));

const own=(o,k)=>Object.hasOwn(o,k);
const absR=q=>({n:absolute(q.n),d:q.d});
const negR=q=>({n:-q.n,d:q.d});
const nearZero=(q,scale)=>q.n!==0n&&compare(absR(q),multiply(EPS,scale))<=0;
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};

function fields(value,keys,label){
  if(!isRecord(value))fail('INVALID_CONJUGATE_RECONSTRUCTION_FACTS',label+' must be an object.');
  const extra=Object.keys(value).filter(k=>!keys.includes(k));
  if(extra.length)fail('INVALID_CONJUGATE_RECONSTRUCTION_FACTS',label+' has unsupported fields: '+extra.join(', '));
  const missing=keys.filter(k=>!own(value,k));
  if(missing.length)fail('MISSING_FACTS',label+' requires '+missing.join(', ')+'.');
}

export function conjugateReconstructionCapabilities(){
  return {
    format:CONJUGATE_RECONSTRUCTION_QUERY,
    factsFormat:CONJUGATE_RECONSTRUCTION_FACTS,
    kinds:[kind],
    model,
    signConvention:convention,
    opticalAxis:'y = 0',
    lengthUnits:[...lengthUnits],
    requiredFacts:['format','model','signConvention','lengthUnit','object','image'],
    pointFields:['x','y'],
    lensTypes:['converging','diverging'],
    imageKinds:['real','virtual'],
    imageOrientations:['upright','inverted'],
    bounds:{
      physicalMm:{
        coordinateMm:[...COMPONENT_BOUNDS.coordinateMm],
        minimumOffAxisAbsYMm:COMPONENT_BOUNDS.sourcePlaneSeparationMm,
        minimumDerivedPlaneSeparationMm:COMPONENT_BOUNDS.sourcePlaneSeparationMm,
        maximumDerivedMagnitudeMm:1e9
      },
      scaleUnit:{
        coordinate:[-10000,10000],
        minimumOffAxisAbsY:0.001,
        minimumDerivedPlaneSeparation:0.001,
        maximumDerivedMagnitude:1e9
      }
    },
    numericalPolicy:{
      exactArithmetic:'binary64-rational exact optical-centre intersection and Gaussian thin-lens inversion',
      relativeIndeterminacyTolerance:1e-10,
      boundaries:'Nonzero height difference (yI-yO) within 1e-10*(|yO|+|yI|), nonzero axial separation (xI-xO) within 1e-10*(|xO|+|xI|), derived |u| or |v| below minimum separation, or derived magnitudes above 1e9 return numerically-indeterminate.'
    },
    limits:[
      'Conditional first-order single ideal thin-lens inverse for a real off-axis object propagating along +x.',
      'Requires off-axis object and image points so the undeviated central ray uniquely intersects the optical axis y = 0.',
      'No native scene, aperture, brightness, aberration, or physical image detection is created or certified.'
    ]
  };
}

export function analyzeConjugateReconstruction(f,q){
  fields(q,['format','kind'],'Thin-lens conjugate-reconstruction query');
  if(q.format!==CONJUGATE_RECONSTRUCTION_QUERY||q.kind!==kind)
    fail('UNSUPPORTED_QUERY','Unknown thin-lens conjugate-reconstruction query.');
  if(!isRecord(f)||f.format!==CONJUGATE_RECONSTRUCTION_FACTS)
    fail('UNSUPPORTED_FACTS','Use explicit '+CONJUGATE_RECONSTRUCTION_FACTS+' facts; forward lens facts or native scenes are not silently converted.');
  fields(f,['format','model','signConvention','lengthUnit','object','image'],'Thin-lens conjugate-reconstruction facts');
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Only the explicit '+model+' model is supported.');
  if(f.signConvention!==convention)fail('UNSUPPORTED_SCOPE','State x-increasing propagation from the real object toward the lens.');
  if(typeof f.lengthUnit!=='string'||!lengthUnits.includes(f.lengthUnit))
    fail('INVALID_CONJUGATE_RECONSTRUCTION_FACTS','lengthUnit must be mm, cm, m or scale-unit.');

  const isScaleUnit=f.lengthUnit==='scale-unit';
  const unitScale=isScaleUnit?ONE:fromBinary64(physicalScales[f.lengthUnit]);
  const minCoord=isScaleUnit?MIN_SCALE_COORD:MIN_PHYS_COORD;
  const maxCoord=isScaleUnit?MAX_SCALE_COORD:MAX_PHYS_COORD;
  const minSep=isScaleUnit?MIN_SCALE_SEP:MIN_PHYS_SEP;

  function parsePoint(point,label){
    fields(point,['x','y'],label);
    if(typeof point.x!=='number'||!Number.isFinite(point.x)||typeof point.y!=='number'||!Number.isFinite(point.y))
      fail('INVALID_CONJUGATE_RECONSTRUCTION_FACTS',label+' requires finite numeric x and y coordinates.');
    const x=fromBinary64(point.x),y=fromBinary64(point.y);
    const xScaled=multiply(x,unitScale),yScaled=multiply(y,unitScale);
    if(compare(xScaled,minCoord)<0||compare(xScaled,maxCoord)>0||compare(yScaled,minCoord)<0||compare(yScaled,maxCoord)>0)
      fail('UNSUPPORTED_SCOPE',label+' coordinates lie outside the supported domain bounds.');
    if(compare(absR(yScaled),minSep)<0)
      fail('UNSUPPORTED_SCOPE',label+'.y must lie strictly off the optical axis y = 0 so the central ray uniquely locates the lens plane.');
    return {x,y};
  }

  const obj=parsePoint(f.object,'object');
  const img=parsePoint(f.image,'image');

  const base={
    format:'opticsim-thin-lens-conjugate-reconstruction-result-v1',
    kind,
    method:'conditional-analytical',
    model,
    native:{status:'not-run',observations:null},
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    assumptions:[
      'Single stationary ideal thin lens perpendicular to the optical axis y = 0 in a uniform medium.',
      'Incident paraxial light propagates in +x from a real off-axis point object O through the lens to conjugate point I.'
    ],
    limitations:[
      'Conditional Gaussian thin-lens inverse only; no native scene, aperture diameter, brightness, aberration or physical image detection is created or certified.',
      'Does not reconstruct multi-lens trains, mirrors, thick lenses, or virtual-object configurations.',
      ...(isScaleUnit?['All coordinates, distances and focal lengths are expressed in the declared unspecified positive common scale unit.']:[])
    ],
    numericalPolicy:conjugateReconstructionCapabilities().numericalPolicy
  };
  const unavailable=(reasonCode,reason)=>({...base,status:'unavailable',value:null,reasonCode,reason});
  const indeterminate=(reasonCode,reason)=>({...base,status:'numerically-indeterminate',value:null,reasonCode,reason});

  const dx=subtract(img.x,obj.x);
  const dy=subtract(img.y,obj.y);
  const yScale=add(absR(obj.y),absR(img.y));
  const xScale=add(absR(obj.x),absR(img.x));

  // 1. Guard exact/near-parallel line OI (yI == yO or near unit upright magnification).
  if(nearZero(dy,yScale))return indeterminate('NEAR_UNIT_UPRIGHT_MAGNIFICATION',
    'Object and image transverse heights are nearly equal within the relative numerical band; the optical centre intersection cannot be reliably determined.');
  if(dy.n===0n){
    if(dx.n===0n)return unavailable('COINCIDENT_OBJECT_AND_IMAGE',
      'Object and image coincide identically; any thin lens at this plane maps the point to itself regardless of focal length.');
    if(nearZero(dx,xScale))return indeterminate('NEAR_COINCIDENT_AXIAL_PLANES',
      'Object and image share equal height with nearly coincident axial planes.');
    return unavailable('NO_FINITE_LENS_SOLUTION',
      'Line OI is parallel to the optical axis with distinct axial positions; no finite thin lens can form this conjugate pair.');
  }

  // 2. Guard exact/near-coincident axial planes (xI == xO while yI != yO).
  if(dx.n===0n)return unavailable('COINCIDENT_AXIAL_PLANES',
    'Object and image share the same axial plane with distinct heights; no single thin lens can form this conjugate pair.');
  if(nearZero(dx,xScale))return indeterminate('NEAR_COINCIDENT_AXIAL_PLANES',
    'Object and image axial planes are nearly coincident within the relative numerical band; focal length and lens placement cannot be reliably determined.');

  // 3. Exact rational reconstruction:
  //    u = xO - xL = yO * dx / dy,  v = xI - xL = yI * dx / dy,
  //    xL = xO - u,  m = yI / yO = v / u,  f = -yO * yI * dx / dy^2.
  const u=divide(multiply(obj.y,dx),dy);
  const v=divide(multiply(img.y,dx),dy);
  const lensX=subtract(obj.x,u);
  const magnification=divide(img.y,obj.y);
  const focalLength=divide(negR(multiply(multiply(obj.y,img.y),dx)),multiply(dy,dy));
  const frontFocusX=subtract(lensX,focalLength);
  const rearFocusX=add(lensX,focalLength);

  // 4. Real-object admissibility in +x propagation requires xO < xL (u < 0).
  if(u.n>=0n)return unavailable('VIRTUAL_OBJECT_REQUIRED',
    'The reconstructed lens plane does not lie downstream of the object in +x propagation; no single thin lens can form this image from a real object.');

  // 5. Derived plane-separation and finite-range checks.
  const uScaled=absR(multiply(u,unitScale));
  const vScaled=absR(multiply(v,unitScale));
  if(compare(uScaled,minSep)<0||compare(vScaled,minSep)<0)
    return indeterminate('NEAR_COINCIDENT_LENS_PLANE',
      'The reconstructed lens plane lies closer to the object or image plane than the minimum qualified axial separation.');

  for(const quantity of [lensX,u,v,focalLength,frontFocusX,rearFocusX]){
    if(compare(absR(multiply(quantity,unitScale)),DERIVED_CAP)>0)
      return indeterminate('DERIVED_COORDINATE_OUT_OF_RANGE',
        'A reconstructed lens coordinate or focal length exceeds the qualified numerical magnitude ceiling.');
  }

  const lensXNum=toBinary64(lensX);
  const uNum=toBinary64(u);
  const vNum=toBinary64(v);
  const magNum=toBinary64(magnification);
  const fNum=toBinary64(focalLength);
  const frontFocusXNum=toBinary64(frontFocusX);
  const rearFocusXNum=toBinary64(rearFocusX);
  const objYNum=toBinary64(obj.y);

  if(![lensXNum,uNum,vNum,magNum,fNum,frontFocusXNum,rearFocusXNum,objYNum].every(Number.isFinite)||fNum===0)
    return indeterminate('UNRELIABLE_RECONSTRUCTION','A reconstructed quantity exceeds finite binary64 representation.');

  return {...base,status:'conditional',reasonCode:null,value:{
    lengthUnit:f.lengthUnit,
    lensType:focalLength.n>0n?'converging':'diverging',
    lensX:lensXNum,
    focalLength:fNum,
    frontFocusX:frontFocusXNum,
    rearFocusX:rearFocusXNum,
    objectDistance:uNum,
    imageDistance:vNum,
    magnification:magNum,
    imageKind:v.n>0n?'real':'virtual',
    imageOrientation:magnification.n>0n?'upright':'inverted',
    rayConstruction:{
      opticalCentre:{x:lensXNum,y:0},
      parallelRayLensHit:{x:lensXNum,y:objYNum},
      rearFocalPoint:{x:rearFocusXNum,y:0}
    }
  }};
}
