// Conditional paraxial transfer analysis for a coaxial ideal thin-lens train:
// tests whether the train preserves axial image position for arbitrary finite
// objects before the first lens and how it transforms transverse magnification.
// Pure analytical mathematics using exact binary64-rational arithmetic; no
// native scene construction, ray routing or image detection.
import {isRecord} from './qualified-utils.js';
import {COMPONENT_BOUNDS} from './contract.js';
import {absolute,add,compare,divide,fromBinary64,multiply,subtract,toBinary64} from './binary64-rational.js';

export const AXIAL_PRESERVATION_FACTS='opticsim-lens-train-axial-preservation-facts-v1';
export const AXIAL_PRESERVATION_QUERY='opticsim-lens-train-axial-preservation-query-v1';
const kind='lens-train-axial-preservation';
const model='coaxial-ideal-thin-lenses';
const convention='x-increasing';
const physicalScales=Object.freeze({mm:1,cm:10,m:1000});
const lengthUnits=Object.freeze(['mm','cm','m','scale-unit']);
const ZERO=fromBinary64(0),ONE=fromBinary64(1),NEG_ONE=fromBinary64(-1);
const EPS=divide(ONE,fromBinary64(1e10));
const MIN_PHYS_COORD=fromBinary64(COMPONENT_BOUNDS.coordinateMm[0]);
const MAX_PHYS_COORD=fromBinary64(COMPONENT_BOUNDS.coordinateMm[1]);
const MIN_PHYS_FOCAL=fromBinary64(COMPONENT_BOUNDS.minimumAbsFocalLengthMm);
const MAX_PHYS_FOCAL=fromBinary64(10000);
const MIN_PHYS_SEP=divide(ONE,fromBinary64(100));
const MIN_SCALE_COORD=fromBinary64(-10000);
const MAX_SCALE_COORD=fromBinary64(10000);
const MIN_SCALE_FOCAL=divide(ONE,fromBinary64(1000));
const MAX_SCALE_FOCAL=fromBinary64(10000);
const MIN_SCALE_SEP=divide(ONE,fromBinary64(1000));

const own=(o,k)=>Object.hasOwn(o,k);
const absR=q=>({n:absolute(q.n),d:q.d});
const negR=q=>({n:-q.n,d:q.d});
const nearZero=(q,scale)=>q.n!==0n&&compare(absR(q),multiply(EPS,scale))<=0;
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};

function fields(value,keys,label){
  if(!isRecord(value))fail('INVALID_AXIAL_PRESERVATION_FACTS',label+' must be an object.');
  const extra=Object.keys(value).filter(k=>!keys.includes(k));
  if(extra.length)fail('INVALID_AXIAL_PRESERVATION_FACTS',label+' has unsupported fields: '+extra.join(', '));
  const missing=keys.filter(k=>!own(value,k));
  if(missing.length)fail('MISSING_FACTS',label+' requires '+missing.join(', ')+'.');
}

export function axialPreservationCapabilities(){
  return {
    format:AXIAL_PRESERVATION_QUERY,
    factsFormat:AXIAL_PRESERVATION_FACTS,
    kinds:[kind],
    model,
    signConvention:convention,
    lengthUnits:[...lengthUnits],
    requiredFacts:['format','model','signConvention','lengthUnit','lenses'],
    lenses:{
      count:[1,4],
      required:['id','x','focalLength'],
      order:'Sorted on a copy by increasing explicit x; caller input is never mutated.'
    },
    bounds:{
      physicalMm:{
        coordinateMm:[...COMPONENT_BOUNDS.coordinateMm],
        absFocalLengthMm:[COMPONENT_BOUNDS.minimumAbsFocalLengthMm,10000],
        minimumSeparationMm:COMPONENT_BOUNDS.sourcePlaneSeparationMm
      },
      scaleUnit:{
        coordinate:[-10000,10000],
        absFocalLength:[0.001,10000],
        minimumSeparation:0.001
      }
    },
    numericalPolicy:{
      exactArithmetic:'binary64-rational exact ABCD propagation from first lens plane to last lens plane',
      relativeIndeterminacyTolerance:1e-10,
      boundaries:'Nonzero optical power C (bound sc), non-afocal orientation coefficient D (bound sd), unit-magnification residual A^2-1 (bound sa^2+1), or constant axial shift L-A*B (expanded monomial bound L+sa*sb) within 1e-10 of its scale-invariant positive-monomial bound returns numerically-indeterminate rather than a brittle classification.'
    },
    limits:[
      'Conditional first-order ideal thin-lens transfer for finite axial objects preceding the first lens.',
      'No native scene, aperture, brightness, emission or physical image detection is created or certified.',
      'Preserves the historical per-object opticsim-lens-train-facts-v1 contract unchanged.'
    ]
  };
}

export function analyzeAxialPreservation(f,q){
  fields(q,['format','kind'],'Lens-train axial-preservation query');
  if(q.format!==AXIAL_PRESERVATION_QUERY||q.kind!==kind)
    fail('UNSUPPORTED_QUERY','Unknown lens-train axial-preservation query.');
  if(!isRecord(f)||f.format!==AXIAL_PRESERVATION_FACTS)
    fail('UNSUPPORTED_FACTS','Use explicit '+AXIAL_PRESERVATION_FACTS+' facts; historical per-object facts or native scenes are not silently converted.');
  fields(f,['format','model','signConvention','lengthUnit','lenses'],'Lens-train axial-preservation facts');
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Only the explicit '+model+' approximation is supported.');
  if(f.signConvention!==convention)fail('UNSUPPORTED_SCOPE','State x-increasing propagation; no reverse or reflection route is inferred.');
  if(typeof f.lengthUnit!=='string'||!lengthUnits.includes(f.lengthUnit))
    fail('INVALID_AXIAL_PRESERVATION_FACTS','lengthUnit must be mm, cm, m or scale-unit.');
  if(!Array.isArray(f.lenses))fail('INVALID_AXIAL_PRESERVATION_FACTS','lenses must be an array.');
  if(f.lenses.length<1||f.lenses.length>4)
    fail('UNSUPPORTED_SCOPE','Axial-preservation analysis supports one to four separated ideal thin lenses.');

  const isScaleUnit=f.lengthUnit==='scale-unit';
  const unitScale=isScaleUnit?ONE:fromBinary64(physicalScales[f.lengthUnit]);
  const minCoord=isScaleUnit?MIN_SCALE_COORD:MIN_PHYS_COORD;
  const maxCoord=isScaleUnit?MAX_SCALE_COORD:MAX_PHYS_COORD;
  const minAbsF=isScaleUnit?MIN_SCALE_FOCAL:MIN_PHYS_FOCAL;
  const maxAbsF=isScaleUnit?MAX_SCALE_FOCAL:MAX_PHYS_FOCAL;
  const minSep=isScaleUnit?MIN_SCALE_SEP:MIN_PHYS_SEP;

  const ids=new Set();
  const lenses=f.lenses.map((lens,i)=>{
    fields(lens,['id','x','focalLength'],'Lens '+i);
    if(typeof lens.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(lens.id)||ids.has(lens.id))
      fail('INVALID_AXIAL_PRESERVATION_FACTS','Every lens requires a unique stable ID.');
    ids.add(lens.id);
    if(typeof lens.x!=='number'||!Number.isFinite(lens.x)||typeof lens.focalLength!=='number'||!Number.isFinite(lens.focalLength))
      fail('INVALID_AXIAL_PRESERVATION_FACTS',lens.id+' requires finite numeric x and focalLength.');
    const x=fromBinary64(lens.x),focal=fromBinary64(lens.focalLength);
    const xScaled=multiply(x,unitScale),absFScaled=absR(multiply(focal,unitScale));
    if(compare(xScaled,minCoord)<0||compare(xScaled,maxCoord)>0)
      fail('UNSUPPORTED_SCOPE',lens.id+'.x lies outside the supported axial coordinate bounds.');
    if(compare(absFScaled,minAbsF)<0||compare(absFScaled,maxAbsF)>0)
      fail('UNSUPPORTED_SCOPE',lens.id+'.focalLength magnitude lies outside the supported thin-lens bounds.');
    return {id:lens.id,x,f:focal};
  }).sort((u,v)=>compare(u.x,v.x));

  for(let i=1;i<lenses.length;i++){
    const gapScaled=multiply(subtract(lenses[i].x,lenses[i-1].x),unitScale);
    if(compare(gapScaled,minSep)<0)
      fail('UNSUPPORTED_SCOPE','Successive lens planes must be strictly separated by at least the minimum axial separation.');
  }

  // Exact ABCD matrix from immediately before first lens to immediately after
  // last lens, with scale-invariant positive monomial upper bounds (sa..sd).
  let a=ONE,b=ZERO,c=ZERO,d=ONE;
  let sa=ONE,sb=ZERO,sc=ZERO,sd=ONE;
  for(let i=0;i<lenses.length;i++){
    if(i>0){
      const gap=subtract(lenses[i].x,lenses[i-1].x);
      a=add(a,multiply(gap,c));
      b=add(b,multiply(gap,d));
      sa=add(sa,multiply(gap,sc));
      sb=add(sb,multiply(gap,sd));
    }
    const p=divide(ONE,lenses[i].f),ap=absR(p);
    c=subtract(c,multiply(a,p));
    d=subtract(d,multiply(b,p));
    sc=add(sc,multiply(sa,ap));
    sd=add(sd,multiply(sb,ap));
  }
  const span=subtract(lenses.at(-1).x,lenses[0].x);

  const base={
    format:'opticsim-lens-train-axial-preservation-result-v1',
    kind,
    method:'conditional-analytical',
    model,
    native:{status:'not-run',observations:null},
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    assumptions:[
      'Stationary coaxial ideal thin lenses in a uniform medium, ordered by increasing x with +x propagation.',
      'Transfer relations apply to paraxial rays from a finite axial object preceding the first lens that pass through every stated lens without aperture clipping.'
    ],
    limitations:[
      'Conditional analytical classification only; no native scene or rays were executed, and no finite-aperture illumination, aberration or physical image detection is established.',
      'Intermediate images may be real, virtual or at infinity; axial position preservation does not imply a real image plane outside the lens train.',
      ...(isScaleUnit?['All lengths and matrix entries B and C are expressed in the declared unspecified positive common scale unit.']:[])
    ],
    numericalPolicy:axialPreservationCapabilities().numericalPolicy
  };
  const indeterminate=(reasonCode,reason)=>({...base,status:'numerically-indeterminate',value:null,reasonCode,reason});

  // 1. Near-afocal boundary: C != 0 yet within relative cancellation band.
  if(nearZero(c,sc))return indeterminate('NEAR_AFOCAL_BOUNDARY',
    'The optical power C is nonzero yet within the relative numerical cancellation band; afocal magnification and axial-shift invariance cannot be reliably classified.');

  const aNum=toBinary64(a),bNum=toBinary64(b),cNum=toBinary64(c),dNum=toBinary64(d),spanNum=toBinary64(span);
  if(![aNum,bNum,cNum,dNum,spanNum].every(Number.isFinite))
    return indeterminate('UNRELIABLE_LENS_MATRIX','The lens-train transfer matrix exceeds finite binary64 representation.');

  const common={
    firstLensId:lenses[0].id,
    lastLensId:lenses.at(-1).id,
    lensOrder:lenses.map(l=>l.id),
    lengthUnit:f.lengthUnit,
    trainSpan:spanNum,
    systemMatrix:{a:aNum,b:bNum,c:cNum,d:dNum}
  };

  // 2. Non-afocal lens train (C != 0): neither magnification nor axial shift is constant across object positions.
  // For objects preceding the first lens (s = x1 - x_obj > 0), m(s) = 1 / (C*s + D):
  // sign is always upright if C>0, D>=0; always inverted if C<0, D<=0; object-dependent if C*D<0.
  if(c.n!==0n){
    if(nearZero(d,sd))return indeterminate('NEAR_FRONT_FOCUS_AT_FIRST_LENS',
      'The matrix coefficient D is nonzero yet within the relative numerical cancellation band; non-afocal orientation for objects preceding the first lens cannot be reliably classified.');
    const powerNum=toBinary64(negR(c)),focalNum=toBinary64(divide(NEG_ONE,c));
    if(!Number.isFinite(powerNum)||!Number.isFinite(focalNum))
      return indeterminate('UNRELIABLE_LENS_MATRIX','Equivalent power or focal length exceeds finite binary64 representation.');
    const orientation=c.n>0n&&d.n>=0n?'upright':c.n<0n&&d.n<=0n?'inverted':'object-dependent';
    return {...base,status:'conditional',reasonCode:null,value:{
      ...common,
      isAfocal:false,
      equivalentPower:powerNum,
      equivalentFocalLength:focalNum,
      constantTransverseMagnification:false,
      transverseMagnification:null,
      transverseMagnificationMagnitude:null,
      imageOrientation:orientation,
      preservesTransverseSize:false,
      longitudinalMagnification:null,
      constantAxialShift:false,
      axialShift:null,
      preservesAxialImagePosition:false
    }};
  }

  // 3. Afocal lens train (exact C = 0, so AD = 1): constant m = A and m_long = A^2.
  if(nearZero(a,sa)||nearZero(d,sd))return indeterminate('ILL_CONDITIONED_AFOCAL_MATRIX',
    'The afocal magnification coefficients suffer severe cancellation relative to intermediate monomials.');
  const a2=multiply(a,a),a2Minus1=subtract(a2,ONE),unitMagScale=add(multiply(sa,sa),ONE);
  if(nearZero(a2Minus1,unitMagScale))return indeterminate('NEAR_UNIT_MAGNIFICATION_BOUNDARY',
    'This afocal train has transverse magnification magnitude near 1 within the relative numerical band; constant versus position-dependent axial shift cannot be reliably classified.');

  const unitMag=a2Minus1.n===0n;
  const a2Num=toBinary64(a2),absANum=toBinary64(absR(a));
  if(!Number.isFinite(a2Num)||!Number.isFinite(absANum))
    return indeterminate('UNRELIABLE_LENS_MATRIX','Afocal magnification exceeds finite binary64 representation.');

  // 4. Afocal with |m| = 1 (A = +1 or A = -1): constant axial shift deltaX = L_span - A*B.
  // Guard with the fully expanded positive-monomial bound L_span + sa*sb so
  // upstream cancellation in A is retained alongside B.
  let deltaX=null,deltaXNum=null;
  if(unitMag){
    deltaX=subtract(span,multiply(a,b));
    if(nearZero(deltaX,add(span,multiply(sa,sb))))return indeterminate('NEAR_ZERO_AXIAL_SHIFT',
      'This unit-magnification afocal train has a nonzero axial shift within the expanded relative monomial band; exact axial position preservation cannot be reliably classified.');
    deltaXNum=toBinary64(deltaX);
    if(!Number.isFinite(deltaXNum))
      return indeterminate('UNRELIABLE_LENS_MATRIX','Computed constant axial shift exceeds finite binary64 representation.');
  }

  return {...base,status:'conditional',reasonCode:null,value:{
    ...common,
    isAfocal:true,
    equivalentPower:0,
    equivalentFocalLength:null,
    constantTransverseMagnification:true,
    transverseMagnification:aNum,
    transverseMagnificationMagnitude:absANum,
    imageOrientation:a.n>0n?'upright':'inverted',
    preservesTransverseSize:unitMag,
    longitudinalMagnification:a2Num,
    constantAxialShift:unitMag,
    axialShift:deltaXNum,
    preservesAxialImagePosition:unitMag&&deltaX.n===0n
  }};
}
