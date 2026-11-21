// Conditional paraxial collimated-input focus analysis for a separated coaxial
// train of 1-4 stationary ideal thin lenses in a uniform medium.
// Pure analytical mathematics using exact binary64-rational ABCD propagation;
// no native scene construction, ray routing or image detection.
import {isRecord} from './qualified-utils.js';
import {COMPONENT_BOUNDS} from './contract.js';
import {absolute,add,compare,divide,fromBinary64,multiply,subtract,toBinary64} from './binary64-rational.js';

export const COLLIMATED_FOCUS_FACTS='opticsim-lens-train-collimated-focus-facts-v1';
export const COLLIMATED_FOCUS_QUERY='opticsim-lens-train-collimated-focus-query-v1';
const kind='lens-train-collimated-focus';
const model='coaxial-ideal-thin-lenses';
const convention='x-increasing';
const incidence='collimated-along-axis';
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
  if(!isRecord(value))fail('INVALID_COLLIMATED_FOCUS_FACTS',label+' must be an object.');
  const extra=Object.keys(value).filter(k=>!keys.includes(k));
  if(extra.length)fail('INVALID_COLLIMATED_FOCUS_FACTS',label+' has unsupported fields: '+extra.join(', '));
  const missing=keys.filter(k=>!own(value,k));
  if(missing.length)fail('MISSING_FACTS',label+' requires '+missing.join(', ')+'.');
}

export function collimatedFocusCapabilities(){
  return {
    format:COLLIMATED_FOCUS_QUERY,
    factsFormat:COLLIMATED_FOCUS_FACTS,
    kinds:[kind],
    model,
    signConvention:convention,
    incidence,
    lengthUnits:[...lengthUnits],
    requiredFacts:['format','model','signConvention','incidence','lengthUnit','lenses'],
    lenses:{
      count:[1,4],
      required:['id','x','focalLength'],
      order:'Sorted on a copy by increasing explicit x; caller input is never mutated.'
    },
    states:['downstream','upstream','at-last-lens','afocal'],
    reference:'Signed backFocalDistance and rearPrincipalOffset are measured from the last lens plane along +x.',
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
      boundaries:'Nonzero optical power C (bound sc) or non-afocal exit-height coefficient A (bound sa) within 1e-10 of its scale-invariant positive-monomial bound, or afocal A/D with severe cancellation, returns numerically-indeterminate rather than a brittle state classification.'
    },
    limits:[
      'Conditional first-order ideal thin-lens propagation for an axial collimated beam along +x.',
      'No native scene, beam width, aperture, brightness, aberration or physical image detection is created or certified.',
      'Leaves the finite-object opticsim-lens-train-facts-v1 and axial-preservation contracts unchanged.'
    ]
  };
}

export function analyzeCollimatedFocus(f,q){
  fields(q,['format','kind'],'Lens-train collimated-focus query');
  if(q.format!==COLLIMATED_FOCUS_QUERY||q.kind!==kind)
    fail('UNSUPPORTED_QUERY','Unknown lens-train collimated-focus query.');
  if(!isRecord(f)||f.format!==COLLIMATED_FOCUS_FACTS)
    fail('UNSUPPORTED_FACTS','Use explicit '+COLLIMATED_FOCUS_FACTS+' facts; finite-object facts or native scenes are not silently converted.');
  fields(f,['format','model','signConvention','incidence','lengthUnit','lenses'],'Lens-train collimated-focus facts');
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Only the explicit '+model+' approximation is supported.');
  if(f.signConvention!==convention||f.incidence!==incidence)
    fail('UNSUPPORTED_SCOPE','State x-increasing propagation and collimated-along-axis incidence.');
  if(typeof f.lengthUnit!=='string'||!lengthUnits.includes(f.lengthUnit))
    fail('INVALID_COLLIMATED_FOCUS_FACTS','lengthUnit must be mm, cm, m or scale-unit.');
  if(!Array.isArray(f.lenses))fail('INVALID_COLLIMATED_FOCUS_FACTS','lenses must be an array.');
  if(f.lenses.length<1||f.lenses.length>4)
    fail('UNSUPPORTED_SCOPE','Collimated-focus analysis supports one to four separated ideal thin lenses.');

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
      fail('INVALID_COLLIMATED_FOCUS_FACTS','Every lens requires a unique stable ID.');
    ids.add(lens.id);
    if(typeof lens.x!=='number'||!Number.isFinite(lens.x)||typeof lens.focalLength!=='number'||!Number.isFinite(lens.focalLength))
      fail('INVALID_COLLIMATED_FOCUS_FACTS',lens.id+' requires finite numeric x and focalLength.');
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
  const lastX=lenses.at(-1).x;
  const span=subtract(lastX,lenses[0].x);

  const base={
    format:'opticsim-lens-train-collimated-focus-result-v1',
    kind,
    method:'conditional-analytical',
    model,
    native:{status:'not-run',observations:null},
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    assumptions:[
      'Stationary coaxial ideal thin lenses in a uniform medium, ordered by increasing x with +x collimated axial incidence.',
      'Paraxial propagation assumes the collimated bundle passes through every stated lens without aperture clipping.'
    ],
    limitations:[
      'Conditional first-order focus classification only; no native scene, beam width, aperture throughput, aberration or detected focus is established.',
      'An upstream state denotes a virtual focal point obtained by extending outgoing rays backward from the last lens.',
      ...(isScaleUnit?['All lengths and matrix entries B and C are expressed in the declared unspecified positive common scale unit.']:[])
    ],
    numericalPolicy:collimatedFocusCapabilities().numericalPolicy
  };
  const indeterminate=(reasonCode,reason)=>({...base,status:'numerically-indeterminate',value:null,reasonCode,reason});

  // 1. Guard near-afocal boundary (C != 0 inside relative monomial band).
  if(nearZero(c,sc))return indeterminate('NEAR_AFOCAL_BOUNDARY',
    'The optical power C is nonzero yet within the relative numerical cancellation band; finite back focus versus afocal emergence cannot be reliably classified.');

  const aNum=toBinary64(a),bNum=toBinary64(b),cNum=toBinary64(c),dNum=toBinary64(d),spanNum=toBinary64(span);
  if(![aNum,bNum,cNum,dNum,spanNum].every(Number.isFinite))
    return indeterminate('UNRELIABLE_LENS_MATRIX','The lens-train transfer matrix exceeds finite binary64 representation.');

  const common={
    firstLensId:lenses[0].id,
    referenceLensId:lenses.at(-1).id,
    lensOrder:lenses.map(l=>l.id),
    lengthUnit:f.lengthUnit,
    trainSpan:spanNum,
    systemMatrix:{a:aNum,b:bNum,c:cNum,d:dNum}
  };

  // 2. Exact afocal emergence (C = 0, AD = 1): outgoing beam remains parallel to the axis.
  if(c.n===0n){
    if(nearZero(a,sa)||nearZero(d,sd))return indeterminate('ILL_CONDITIONED_AFOCAL_MATRIX',
      'The afocal beam-scaling coefficients suffer severe cancellation relative to intermediate monomials.');
    return {...base,status:'conditional',reasonCode:null,value:{
      ...common,
      state:'afocal',
      isAfocal:true,
      equivalentPower:0,
      effectiveFocalLength:null,
      backFocalDistance:null,
      backFocusX:null,
      rearPrincipalOffset:null,
      rearPrincipalX:null,
      beamHeightScale:aNum,
      angularScale:dNum
    }};
  }

  // 3. Finite focus (C != 0): outgoing ray has y_out = A*y_in, u_out = C*y_in,
  // crossing the axis at signed distance BFD = -A/C from the last lens plane.
  if(nearZero(a,sa))return indeterminate('NEAR_FOCUS_AT_LAST_LENS',
    'The exit-height coefficient A is nonzero yet within the relative numerical cancellation band; downstream, upstream, and at-last-lens focus states cannot be reliably distinguished.');

  const power=negR(c);
  const effFocal=divide(NEG_ONE,c);
  const bfd=divide(negR(a),c);
  const backFocusX=add(lastX,bfd);
  const rearPrincipalOffset=divide(subtract(ONE,a),c);
  const rearPrincipalX=add(lastX,rearPrincipalOffset);

  const powerNum=toBinary64(power);
  const effFocalNum=toBinary64(effFocal);
  const bfdNum=toBinary64(bfd);
  const backFocusXNum=toBinary64(backFocusX);
  const rearPrincipalOffsetNum=toBinary64(rearPrincipalOffset);
  const rearPrincipalXNum=toBinary64(rearPrincipalX);

  if(![powerNum,effFocalNum,bfdNum,backFocusXNum,rearPrincipalOffsetNum,rearPrincipalXNum].every(Number.isFinite))
    return indeterminate('UNRELIABLE_LENS_MATRIX','Derived focal or principal-plane coordinates exceed finite binary64 representation.');

  const state=bfd.n===0n?'at-last-lens':bfd.n>0n?'downstream':'upstream';
  return {...base,status:'conditional',reasonCode:null,value:{
    ...common,
    state,
    isAfocal:false,
    equivalentPower:powerNum,
    effectiveFocalLength:effFocalNum,
    backFocalDistance:bfdNum,
    backFocusX:backFocusXNum,
    rearPrincipalOffset:rearPrincipalOffsetNum,
    rearPrincipalX:rearPrincipalXNum,
    beamHeightScale:null,
    angularScale:null
  }};
}
