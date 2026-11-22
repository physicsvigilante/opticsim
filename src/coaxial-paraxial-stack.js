// Composable coaxial paraxial optical stack in exact binary64-rational
// reduced-slope (y, q = n*u) ABCD coordinates (unimodular det(M) = 1).
// Supports 1-8 ordered coaxial elements (thin-lens, planar or spherical
// refracting-surface, and optional terminal-mirror for symmetric return)
// with reusable conjugate, collimated-focus, and system-transfer queries.
// Pure conditional analytical mathematics; no native scene construction,
// ray routing, or physical image detection.
import {isRecord} from './qualified-utils.js';
import {COMPONENT_BOUNDS} from './contract.js';
import {absolute,add,compare,divide,fromBinary64,multiply,subtract,toBinary64} from './binary64-rational.js';

export const COAXIAL_STACK_FACTS='opticsim-coaxial-paraxial-stack-facts-v1';
export const COAXIAL_STACK_QUERY='opticsim-coaxial-paraxial-stack-query-v1';
const CONJUGATE='coaxial-stack-conjugate';
const COLLIMATED='coaxial-stack-collimated-focus';
const TRANSFER='coaxial-stack-transfer';
const kinds=Object.freeze([CONJUGATE,COLLIMATED,TRANSFER]);
const model='coaxial-paraxial-optical-stack';
const convention='x-increasing';
const physicalScales=Object.freeze({mm:1,cm:10,m:1000});
const lengthUnits=Object.freeze(['mm','cm','m','scale-unit']);
const ZERO=fromBinary64(0),ONE=fromBinary64(1),TWO=fromBinary64(2),FOUR=fromBinary64(4),NEG_ONE=fromBinary64(-1);
const EPS=divide(ONE,fromBinary64(1e10));
const DERIVED_CAP=fromBinary64(1e9);
const MIN_PHYS_COORD=fromBinary64(COMPONENT_BOUNDS.coordinateMm[0]);
const MAX_PHYS_COORD=fromBinary64(COMPONENT_BOUNDS.coordinateMm[1]);
const MIN_PHYS_OPTICAL=fromBinary64(COMPONENT_BOUNDS.minimumAbsFocalLengthMm);
const MAX_PHYS_OPTICAL=fromBinary64(10000);
const MIN_PHYS_SEP=divide(ONE,fromBinary64(100));
const MIN_SCALE_COORD=fromBinary64(-10000);
const MAX_SCALE_COORD=fromBinary64(10000);
const MIN_SCALE_OPTICAL=divide(ONE,fromBinary64(1000));
const MAX_SCALE_OPTICAL=fromBinary64(10000);
const MIN_SCALE_SEP=divide(ONE,fromBinary64(1000));

const own=(o,k)=>Object.hasOwn(o,k);
const absR=q=>({n:absolute(q.n),d:q.d});
const negR=q=>({n:-q.n,d:q.d});
const nearZero=(q,scale)=>q.n!==0n&&compare(absR(q),multiply(EPS,scale))<=0;
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const stableId=id=>typeof id==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id);

function fields(value,required,optional,label){
  if(!isRecord(value))fail('INVALID_STACK_FACTS',label+' must be an object.');
  const allowed=[...required,...optional];
  const extra=Object.keys(value).filter(k=>!allowed.includes(k));
  if(extra.length)fail('INVALID_STACK_FACTS',label+' has unsupported fields: '+extra.join(', '));
  const missing=required.filter(k=>!own(value,k));
  if(missing.length)fail('MISSING_FACTS',label+' requires '+missing.join(', ')+'.');
}

export function coaxialStackCapabilities(){
  return {
    format:COAXIAL_STACK_QUERY,
    factsFormat:COAXIAL_STACK_FACTS,
    kinds:[...kinds],
    model,
    signConvention:convention,
    lengthUnits:[...lengthUnits],
    requiredFacts:['format','model','signConvention','lengthUnit','incidentIndex','elements'],
    optionalFacts:['object'],
    objectSpec:'object: {x, y?} is required only by coaxial-stack-conjugate (validated whenever supplied). y is optional; imageY is reported only when y is supplied.',
    elements:{
      count:[1,8],
      order:'Must be supplied in non-decreasing axial x encounter order; consecutive gaps must be 0 (explicit co-located thin/silvered contact) or >= minimum separation.',
      types:{
        'thin-lens':'{id, type, x, focalLength} — ideal thin lens with signed focalLength in its local ambient medium n.',
        'refracting-surface':'{id, type, x, signedRadius: number | "infinity", downstreamIndex} — planar or spherical refracting interface; positive radius has centre downstream (+x).',
        'terminal-mirror':'{id, type, x, signedRadius: number | "infinity"} — optional single final element (plane or spherical; negative radius is concave facing +x light) triggering symmetric return pass.'
      }
    },
    bounds:{
      index:[1,4],
      physicalMm:{coordinateMm:[...COMPONENT_BOUNDS.coordinateMm],absFocalOrRadiusMm:[1,10000],minimumNonZeroSeparationMm:0.01,maximumDerivedMagnitudeMm:1e9},
      scaleUnit:{coordinate:[-10000,10000],absFocalOrRadius:[0.001,10000],minimumNonZeroSeparation:0.001,maximumDerivedMagnitude:1e9}
    },
    numericalPolicy:{
      exactArithmetic:'binary64-rational exact reduced-slope (y, n*u) unimodular ABCD propagation (det=1 identically; A=D identically for return stacks)',
      relativeIndeterminacyTolerance:1e-10,
      boundaries:'Nonzero boundary residuals (C, A, D, D_full, B_full, longitudinal magnification residual, expanded axial shift L-n_out*A*B, or return self-conjugate numerators A+-1 / B) within 1e-10 of their scale-invariant positive-monomial bounds, or return self-conjugate roots that are ill-conditioned in D_full/B_full or indistinguishable after binary64 rounding, return numerically-indeterminate.'
    },
    limits:[
      'Conditional first-order coaxial paraxial stack only; no native scene, finite aperture, brightness, Fresnel reflection loss, aberration, or detected image is created or certified.',
      'Thin-lens focalLength refers to its local ambient medium index; lens-material refraction requires explicit refracting-surface elements.',
      'Return propagation models a single reflection at one optional terminal-mirror followed by reverse traversal through the preceding elements.'
    ]
  };
}

function parseIndex(value,label){
  if(typeof value!=='number'||!Number.isFinite(value))fail('INVALID_STACK_FACTS',label+' must be a finite number.');
  const r=fromBinary64(value);
  if(compare(r,ONE)<0||compare(r,FOUR)>0)fail('UNSUPPORTED_SCOPE',label+' must lie within [1, 4].');
  return r;
}

function parseStack(f){
  if(!isRecord(f)||f.format!==COAXIAL_STACK_FACTS)
    fail('UNSUPPORTED_FACTS','Use explicit '+COAXIAL_STACK_FACTS+' facts; legacy contracts or native scenes are not silently converted.');
  fields(f,['format','model','signConvention','lengthUnit','incidentIndex','elements'],['object'],'Coaxial stack facts');
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Only the explicit '+model+' approximation is supported.');
  if(f.signConvention!==convention)fail('UNSUPPORTED_SCOPE','State x-increasing propagation for incident light.');
  if(typeof f.lengthUnit!=='string'||!lengthUnits.includes(f.lengthUnit))
    fail('INVALID_STACK_FACTS','lengthUnit must be mm, cm, m or scale-unit.');
  if(!Array.isArray(f.elements))fail('INVALID_STACK_FACTS','elements must be an array.');
  if(f.elements.length<1||f.elements.length>8)
    fail('UNSUPPORTED_SCOPE','Coaxial paraxial stack supports one to eight ordered elements.');

  const isScaleUnit=f.lengthUnit==='scale-unit';
  const unitScale=isScaleUnit?ONE:fromBinary64(physicalScales[f.lengthUnit]);
  const minCoord=isScaleUnit?MIN_SCALE_COORD:MIN_PHYS_COORD;
  const maxCoord=isScaleUnit?MAX_SCALE_COORD:MAX_PHYS_COORD;
  const minOpt=isScaleUnit?MIN_SCALE_OPTICAL:MIN_PHYS_OPTICAL;
  const maxOpt=isScaleUnit?MAX_SCALE_OPTICAL:MAX_PHYS_OPTICAL;
  const minSep=isScaleUnit?MIN_SCALE_SEP:MIN_PHYS_SEP;

  function parseCoord(value,label){
    if(typeof value!=='number'||!Number.isFinite(value))fail('INVALID_STACK_FACTS',label+' must be a finite number.');
    const r=fromBinary64(value),scaled=multiply(r,unitScale);
    if(compare(scaled,minCoord)<0||compare(scaled,maxCoord)>0)
      fail('UNSUPPORTED_SCOPE',label+' lies outside the supported coordinate bounds.');
    return r;
  }

  function parseOpticalMagnitude(value,label){
    if(typeof value!=='number'||!Number.isFinite(value))fail('INVALID_STACK_FACTS',label+' must be a finite number.');
    const r=fromBinary64(value),scaled=absR(multiply(r,unitScale));
    if(compare(scaled,minOpt)<0||compare(scaled,maxOpt)>0)
      fail('UNSUPPORTED_SCOPE',label+' magnitude lies outside the supported optical bounds.');
    return r;
  }

  const incidentIndex=parseIndex(f.incidentIndex,'incidentIndex');
  const ids=new Set();
  const parsed=[];
  let currentIndex=incidentIndex;
  let hasTerminalMirror=false;

  for(let i=0;i<f.elements.length;i++){
    const raw=f.elements[i];
    if(!isRecord(raw))fail('INVALID_STACK_FACTS','Element '+i+' must be an object.');
    if(!own(raw,'type'))fail('MISSING_FACTS','Element '+i+' requires type.');
    if(hasTerminalMirror)fail('UNSUPPORTED_SCOPE','terminal-mirror must be the final element in the coaxial stack.');
    const type=raw.type;
    let elem;
    if(type==='thin-lens'){
      fields(raw,['id','type','x','focalLength'],[],'Element '+i);
      if(!stableId(raw.id)||ids.has(raw.id))fail('INVALID_STACK_FACTS','Every element requires a unique stable ID.');
      ids.add(raw.id);
      const x=parseCoord(raw.x,raw.id+'.x');
      const focalLength=parseOpticalMagnitude(raw.focalLength,raw.id+'.focalLength');
      elem={id:raw.id,type,x,focalLength,ambientIndex:currentIndex,downstreamIndex:currentIndex};
    }else if(type==='refracting-surface'){
      fields(raw,['id','type','x','signedRadius','downstreamIndex'],[],'Element '+i);
      if(!stableId(raw.id)||ids.has(raw.id))fail('INVALID_STACK_FACTS','Every element requires a unique stable ID.');
      ids.add(raw.id);
      const x=parseCoord(raw.x,raw.id+'.x');
      const signedRadius=raw.signedRadius==='infinity'?null:parseOpticalMagnitude(raw.signedRadius,raw.id+'.signedRadius');
      const downstreamIndex=parseIndex(raw.downstreamIndex,raw.id+'.downstreamIndex');
      elem={id:raw.id,type,x,signedRadius,upstreamIndex:currentIndex,downstreamIndex};
      currentIndex=downstreamIndex;
    }else if(type==='terminal-mirror'){
      fields(raw,['id','type','x','signedRadius'],[],'Element '+i);
      if(!stableId(raw.id)||ids.has(raw.id))fail('INVALID_STACK_FACTS','Every element requires a unique stable ID.');
      ids.add(raw.id);
      const x=parseCoord(raw.x,raw.id+'.x');
      const signedRadius=raw.signedRadius==='infinity'?null:parseOpticalMagnitude(raw.signedRadius,raw.id+'.signedRadius');
      elem={id:raw.id,type,x,signedRadius,ambientIndex:currentIndex,downstreamIndex:currentIndex};
      hasTerminalMirror=true;
    }else{
      fail('UNSUPPORTED_SCOPE','Unsupported element type: '+String(type));
    }
    if(i>0){
      const gap=subtract(elem.x,parsed[i-1].x);
      if(gap.n<0n)fail('UNSUPPORTED_SCOPE','Elements must be ordered by non-decreasing axial x.');
      if(gap.n>0n&&compare(multiply(gap,unitScale),minSep)<0)
        fail('UNSUPPORTED_SCOPE','Nonzero consecutive element separation must meet the minimum axial clearance.');
    }
    parsed.push(elem);
  }

  let obj=null;
  if(own(f,'object')){
    fields(f.object,['x'],['y'],'object');
    const ox=parseCoord(f.object.x,'object.x');
    const sep=subtract(parsed[0].x,ox);
    if(sep.n<=0n||compare(multiply(sep,unitScale),minSep)<0)
      fail('UNSUPPORTED_SCOPE','Real initial object must strictly precede the first element by at least the minimum axial separation.');
    const oy=own(f.object,'y')?parseCoord(f.object.y,'object.y'):undefined;
    obj={x:ox,y:oy};
  }

  return {
    lengthUnit:f.lengthUnit,isScaleUnit,unitScale,minSep,
    incidentIndex,elements:parsed,hasTerminalMirror,object:obj
  };
}

function propagateStack(stack){
  // Exact unimodular propagation in reduced-slope (y, q = n*u) coordinates
  // alongside scale-invariant positive-monomial upper bounds (sa..sd).
  let a=ONE,b=ZERO,c=ZERO,d=ONE;
  let sa=ONE,sb=ZERO,sc=ZERO,sd=ONE;

  function applyDrift(gap,index){
    if(gap.n===0n)return;
    const g=divide(gap,index); // strictly positive
    a=add(a,multiply(g,c));
    b=add(b,multiply(g,d));
    sa=add(sa,multiply(g,sc));
    sb=add(sb,multiply(g,sd));
  }
  function applyPower(power,powerBound){
    if(power.n===0n&&powerBound.n===0n)return;
    c=subtract(c,multiply(power,a));
    d=subtract(d,multiply(power,b));
    sc=add(sc,multiply(powerBound,sa));
    sd=add(sd,multiply(powerBound,sb));
  }
  function elementPower(el){
    if(el.type==='thin-lens'){
      const p=divide(el.ambientIndex,el.focalLength);
      return {power:p,bound:absR(p)};
    }
    if(el.type==='refracting-surface'){
      if(el.signedRadius===null)return {power:ZERO,bound:ZERO};
      const rAbs=absR(el.signedRadius);
      // Expand (n2 - n1)/R as positive-monomial bound (n2 + n1)/|R| so near-matched
      // indices across a curved surface cannot hide cancellation.
      return {
        power:divide(subtract(el.downstreamIndex,el.upstreamIndex),el.signedRadius),
        bound:divide(add(el.downstreamIndex,el.upstreamIndex),rAbs)
      };
    }
    // terminal-mirror: K = [[1,0],[2*n/R,1]] corresponds to q' = q - (-2*n/R)*y
    if(el.signedRadius===null)return {power:ZERO,bound:ZERO};
    const p=divide(negR(multiply(TWO,el.ambientIndex)),el.signedRadius);
    return {power:p,bound:absR(p)};
  }

  const els=stack.elements;
  for(let i=0;i<els.length;i++){
    if(i>0)applyDrift(subtract(els[i].x,els[i-1].x),els[i-1].downstreamIndex);
    const {power,bound}=elementPower(els[i]);
    applyPower(power,bound);
  }
  if(stack.hasTerminalMirror){
    for(let i=els.length-2;i>=0;i--){
      applyDrift(subtract(els[i+1].x,els[i].x),els[i].downstreamIndex);
      // Returning through thin-lens or refracting-surface has identical power:
      // -(n1 - n2)/(-R) = (n2 - n1)/R.
      const {power,bound}=elementPower(els[i]);
      applyPower(power,bound);
    }
  }

  const isReturn=stack.hasTerminalMirror;
  const entranceElement=els[0];
  const exitElement=isReturn?els[0]:els.at(-1);
  const exitIndex=isReturn?stack.incidentIndex:els.at(-1).downstreamIndex;
  const span=subtract(els.at(-1).x,els[0].x);
  return {
    a,b,c,d,sa,sb,sc,sd,
    isReturn,
    propagationMode:isReturn?'return':'transmission',
    exitDirection:isReturn?'-x':'+x',
    entranceElement,exitElement,
    entranceIndex:stack.incidentIndex,exitIndex,
    span
  };
}

export function analyzeCoaxialStack(f,q){
  fields(q,['format','kind'],[],'Coaxial stack query');
  if(q.format!==COAXIAL_STACK_QUERY||!kinds.includes(q.kind))
    fail('UNSUPPORTED_QUERY','Unknown coaxial paraxial stack query.');

  const stack=parseStack(f);
  if(q.kind===CONJUGATE&&!stack.object)
    fail('MISSING_FACTS','object.x is required for coaxial-stack-conjugate.');

  const prop=propagateStack(stack);
  const {a,b,c,d,sa,sb,sc,sd,isReturn,propagationMode,exitDirection,entranceElement,exitElement,entranceIndex,exitIndex,span}=prop;

  const base={
    format:'opticsim-coaxial-paraxial-stack-result-v1',
    kind:q.kind,
    method:'conditional-analytical',
    model,
    native:{status:'not-run',observations:null},
    nativeImageDetected:false,
    questionSupport:'not-assessed-by-engine',
    assumptions:[
      'Stationary coaxial paraxial elements in declared homogeneous media along +x.',
      isReturn
        ?'Symmetric round-trip propagation through all preceding elements with a single reflection at the terminal mirror.'
        :'Forward paraxial propagation through every declared element in order without aperture clipping.'
    ],
    limitations:[
      'Conditional first-order paraxial analysis only; no native scene, finite aperture, Fresnel reflectance, aberration, or detected image is established.',
      'Thin-lens focalLength is interpreted in its local ambient refractive index.',
      ...(stack.isScaleUnit?['All lengths and matrix entries B and C are expressed in the declared unspecified positive common scale unit.']:[])
    ],
    numericalPolicy:coaxialStackCapabilities().numericalPolicy
  };
  const indeterminate=(reasonCode,reason)=>({...base,status:'numerically-indeterminate',value:null,reasonCode,reason});

  const withinCap=val=>compare(absR(multiply(val,stack.unitScale)),DERIVED_CAP)<=0;
  const toSafeNum=val=>{
    if(!withinCap(val))return null;
    const num=toBinary64(val);
    return Number.isFinite(num)?num:null;
  };

  // Sanity invariants: det(M) === 1 always, and A === D for symmetric return.
  if(compare(subtract(multiply(a,d),multiply(b,c)),ONE)!==0||(isReturn&&compare(a,d)!==0))
    return indeterminate('UNRELIABLE_STACK_MATRIX','Internal transfer-matrix invariant check failed.');

  const aNum=toBinary64(a),bNum=toBinary64(b),cNum=toBinary64(c),dNum=toBinary64(d),spanNum=toBinary64(span);
  if(![aNum,bNum,cNum,dNum,spanNum].every(Number.isFinite))
    return indeterminate('UNRELIABLE_STACK_MATRIX','The stack transfer matrix exceeds finite binary64 representation.');

  const common={
    propagationMode,
    exitDirection,
    entranceElementId:entranceElement.id,
    exitElementId:exitElement.id,
    elementOrder:stack.elements.map(e=>e.id),
    lengthUnit:stack.lengthUnit,
    incidentIndex:toBinary64(entranceIndex),
    exitIndex:toBinary64(exitIndex),
    stackSpan:spanNum,
    reducedSystemMatrix:{a:aNum,b:bNum,c:cNum,d:dNum}
  };

  if(q.kind===CONJUGATE){
    const obj=stack.object;
    const s=subtract(entranceElement.x,obj.x);
    const sRed=divide(s,entranceIndex);
    const bFull=add(multiply(a,sRed),b);
    const dFull=add(multiply(c,sRed),d);
    const sbFull=add(multiply(sa,sRed),sb);
    const sdFull=add(multiply(sc,sRed),sd);

    if(nearZero(dFull,sdFull))return indeterminate('NEAR_FOCAL_SINGULARITY',
      'The object lies within the relative numerical band of the front focal plane; finite image versus infinity cannot be reliably classified.');

    if(dFull.n===0n){
      if(nearZero(bFull,sbFull)||nearZero(c,sc))return indeterminate('UNRELIABLE_STACK_MATRIX',
        'Severe matrix cancellation prevents reliable classification of the infinite image.');
      return {...base,status:'conditional',reasonCode:null,value:{
        ...common,
        imageKind:'at-infinity',
        imageDistance:null,
        imageX:null,
        magnification:null,
        imageOrientation:null,
        ...(obj.y===undefined?{}:{imageY:null})
      }};
    }

    if(nearZero(bFull,sbFull))return indeterminate('NEAR_IMAGE_AT_EXIT_PLANE',
      'The image lies within the relative numerical band of the exit plane; real, virtual, and at-exit-plane states cannot be reliably distinguished.');

    const z=divide(multiply(negR(exitIndex),bFull),dFull);
    const imageX=isReturn?subtract(exitElement.x,z):add(exitElement.x,z);
    const mag=divide(ONE,dFull);
    const imageY=obj.y===undefined?undefined:multiply(mag,obj.y);

    const zNum=toSafeNum(z),xNum=toSafeNum(imageX),mNum=toBinary64(mag);
    const yNum=imageY===undefined?undefined:toSafeNum(imageY);
    if(zNum===null||xNum===null||!Number.isFinite(mNum)||(imageY!==undefined&&yNum===null))
      return indeterminate('DERIVED_COORDINATE_OUT_OF_RANGE','Computed image coordinate or magnification exceeds qualified numerical bounds.');

    return {...base,status:'conditional',reasonCode:null,value:{
      ...common,
      imageKind:z.n===0n?'at-exit-plane':z.n>0n?'finite-real':'finite-virtual',
      imageDistance:zNum,
      imageX:xNum,
      magnification:mNum,
      imageOrientation:mag.n>0n?'upright':'inverted',
      ...(imageY===undefined?{}:{imageY:yNum})
    }};
  }

  if(q.kind===COLLIMATED){
    if(nearZero(c,sc))return indeterminate('NEAR_AFOCAL_BOUNDARY',
      'The optical power C is nonzero yet within the relative numerical cancellation band; finite focus versus afocal emergence cannot be reliably classified.');

    if(c.n===0n){
      if(nearZero(a,sa)||nearZero(d,sd))return indeterminate('ILL_CONDITIONED_AFOCAL_MATRIX',
        'Afocal beam-scaling coefficients suffer severe cancellation relative to intermediate monomials.');
      const angularRatio=divide(multiply(entranceIndex,d),exitIndex);
      const angNum=toBinary64(angularRatio);
      if(!Number.isFinite(angNum))return indeterminate('UNRELIABLE_STACK_MATRIX','Afocal angular scaling exceeds finite binary64 representation.');
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
        angularScale:angNum
      }};
    }

    if(nearZero(a,sa))return indeterminate('NEAR_FOCUS_AT_EXIT_PLANE',
      'The exit-height coefficient A is nonzero yet within the relative numerical cancellation band; real, virtual, and at-exit-plane focus states cannot be reliably distinguished.');

    const power=negR(c);
    const efl=divide(negR(exitIndex),c);
    const bfd=divide(multiply(negR(exitIndex),a),c);
    const backFocusX=isReturn?subtract(exitElement.x,bfd):add(exitElement.x,bfd);
    const principalOffset=divide(multiply(exitIndex,subtract(ONE,a)),c);
    const principalX=isReturn?subtract(exitElement.x,principalOffset):add(exitElement.x,principalOffset);

    const powerNum=toBinary64(power),eflNum=toSafeNum(efl),bfdNum=toSafeNum(bfd);
    const bfXNum=toSafeNum(backFocusX),pOffNum=toSafeNum(principalOffset),pXNum=toSafeNum(principalX);
    if(!Number.isFinite(powerNum)||eflNum===null||bfdNum===null||bfXNum===null||pOffNum===null||pXNum===null)
      return indeterminate('DERIVED_COORDINATE_OUT_OF_RANGE','Computed focal or principal-plane coordinate exceeds qualified numerical bounds.');

    return {...base,status:'conditional',reasonCode:null,value:{
      ...common,
      state:bfd.n===0n?'at-exit-plane':bfd.n>0n?'real-focus':'virtual-focus',
      isAfocal:false,
      equivalentPower:powerNum,
      effectiveFocalLength:eflNum,
      backFocalDistance:bfdNum,
      backFocusX:bfXNum,
      rearPrincipalOffset:pOffNum,
      rearPrincipalX:pXNum,
      beamHeightScale:null,
      angularScale:null
    }};
  }

  // q.kind === TRANSFER
  if(nearZero(c,sc))return indeterminate('NEAR_AFOCAL_BOUNDARY',
    'The optical power C is nonzero yet within the relative numerical cancellation band; afocal transfer invariance cannot be reliably classified.');

  // Helper for symmetric return self-conjugate real objects (C*t^2 + 2*A*t + B = 0, t = s/n0 > 0).
  // Every published root must be well-conditioned in D_full/B_full, preserve
  // self-conjugacy after binary64 rounding, and remain distinct from any second root.
  const ROUNDTRIP_TOL=divide(ONE,fromBinary64(1e7));
  function qualifySelfConjugateRoot(s,exactMag){
    if(compare(multiply(s,stack.unitScale),stack.minSep)<0)
      return {ok:false,code:'NEAR_SELF_CONJUGATE_AT_ENTRANCE_PLANE',
        reason:'A positive self-conjugate object distance lies below the minimum qualified axial separation.'};
    const sRed=divide(s,entranceIndex);
    const dFull=add(multiply(c,sRed),d),sdFull=add(multiply(sc,sRed),sd);
    const bFull=add(multiply(a,sRed),b),sbFull=add(multiply(sa,sRed),sb);
    if(nearZero(dFull,sdFull)||dFull.n===0n||nearZero(bFull,sbFull))
      return {ok:false,code:'ILL_CONDITIONED_SELF_CONJUGATE_ROOT',
        reason:'A return self-conjugate root suffers severe cancellation in D_full or B_full relative to its positive-monomial bound.'};
    const objX=subtract(entranceElement.x,s);
    const sNum=toSafeNum(s),xNum=toSafeNum(objX),mNum=toBinary64(exactMag);
    if(sNum===null||xNum===null||!Number.isFinite(mNum))
      return {ok:false,code:'DERIVED_COORDINATE_OUT_OF_RANGE',
        reason:'A self-conjugate object distance exceeds the qualified numerical magnitude ceiling.'};
    // Verify the published rounded binary64 objectX remains well-conditioned and
    // self-conjugate when re-evaluated by coaxial-stack-conjugate.
    const xRounded=fromBinary64(xNum);
    const sRounded=subtract(entranceElement.x,xRounded);
    if(sRounded.n<=0n||compare(multiply(sRounded,stack.unitScale),stack.minSep)<0)
      return {ok:false,code:'ILL_CONDITIONED_SELF_CONJUGATE_ROOT',
        reason:'Binary64 rounding pushes a self-conjugate root onto or past the entrance plane.'};
    const sRedR=divide(sRounded,entranceIndex);
    const dFullR=add(multiply(c,sRedR),d),sdFullR=add(multiply(sc,sRedR),sd);
    const bFullR=add(multiply(a,sRedR),b),sbFullR=add(multiply(sa,sRedR),sb);
    if(nearZero(dFullR,sdFullR)||dFullR.n===0n||nearZero(bFullR,sbFullR))
      return {ok:false,code:'ILL_CONDITIONED_SELF_CONJUGATE_ROOT',
        reason:'The rounded binary64 self-conjugate coordinate is numerically indeterminate under conjugate evaluation.'};
    const zR=divide(multiply(negR(exitIndex),bFullR),dFullR);
    const imgXR=subtract(exitElement.x,zR);
    const magR=divide(ONE,dFullR);
    const posScale=add(add(absR(sRounded),absR(xRounded)),divide(ONE,stack.unitScale));
    if(compare(absR(subtract(imgXR,xRounded)),multiply(ROUNDTRIP_TOL,posScale))>0||
       compare(absR(subtract(magR,exactMag)),multiply(ROUNDTRIP_TOL,absR(exactMag)))>0)
      return {ok:false,code:'ILL_CONDITIONED_SELF_CONJUGATE_ROOT',
        reason:'Binary64 rounding destroys self-conjugacy or magnification stability for this return root.'};
    return {ok:true,entry:{s,objectDistanceFromEntrance:sNum,objectX:xNum,magnification:mNum}};
  }
  function computeReturnSelfConjugates(){
    if(!isReturn)return {ok:true,items:null};
    const candidates=[];
    if(c.n!==0n){
      for(const [sign,exactMag] of [[ONE,NEG_ONE],[NEG_ONE,ONE]]){
        const num=add(a,sign);
        if(nearZero(num,add(sa,ONE)))return {ok:false,code:'NEAR_SELF_CONJUGATE_AT_ENTRANCE_PLANE',
          reason:'A self-conjugate root lies within the relative numerical band of the entrance plane.'};
        if(num.n===0n)continue;
        const s=divide(multiply(negR(entranceIndex),num),c);
        if(s.n<=0n)continue;
        const qualified=qualifySelfConjugateRoot(s,exactMag);
        if(!qualified.ok)return qualified;
        candidates.push(qualified.entry);
      }
    }else{
      if(nearZero(b,sb))return {ok:false,code:'NEAR_SELF_CONJUGATE_AT_ENTRANCE_PLANE',
        reason:'The afocal return self-conjugate root lies within the relative numerical band of the entrance plane.'};
      if(b.n!==0n){
        const s=divide(multiply(negR(entranceIndex),b),multiply(TWO,a));
        if(s.n>0n){
          const qualified=qualifySelfConjugateRoot(s,a);
          if(!qualified.ok)return qualified;
          candidates.push(qualified.entry);
        }
      }
    }
    candidates.sort((u,v)=>compare(u.s,v.s));
    if(candidates.length===2){
      const [r0,r1]=candidates;
      if(r0.objectDistanceFromEntrance===r1.objectDistanceFromEntrance||
         r0.objectX===r1.objectX||
         Math.abs(r1.objectDistanceFromEntrance-r0.objectDistanceFromEntrance)<=1e-10*Math.max(r0.objectDistanceFromEntrance,r1.objectDistanceFromEntrance))
        return {ok:false,code:'UNRESOLVABLE_SELF_CONJUGATE_ROOTS',
          reason:'Distinct exact return self-conjugate roots collapse within binary64 resolution.'};
    }
    return {ok:true,items:candidates.map(({objectDistanceFromEntrance,objectX,magnification})=>({objectDistanceFromEntrance,objectX,magnification}))};
  }

  if(c.n!==0n){
    if(nearZero(d,sd))return indeterminate('NEAR_FRONT_FOCUS_AT_ENTRANCE_PLANE',
      'The matrix coefficient D is nonzero yet within the relative numerical cancellation band; non-afocal orientation for objects preceding the stack cannot be reliably classified.');
    const selfConj=computeReturnSelfConjugates();
    if(!selfConj.ok)return indeterminate(selfConj.code,selfConj.reason);
    const powerNum=toBinary64(negR(c)),eflNum=toSafeNum(divide(negR(exitIndex),c));
    if(!Number.isFinite(powerNum)||eflNum===null)
      return indeterminate('DERIVED_COORDINATE_OUT_OF_RANGE','Equivalent focal length exceeds qualified numerical bounds.');
    const orientation=c.n>0n&&d.n>=0n?'upright':c.n<0n&&d.n<=0n?'inverted':'object-dependent';
    return {...base,status:'conditional',reasonCode:null,value:{
      ...common,
      isAfocal:false,
      equivalentPower:powerNum,
      effectiveFocalLength:eflNum,
      constantTransverseMagnification:false,
      transverseMagnification:null,
      transverseMagnificationMagnitude:null,
      imageOrientation:orientation,
      preservesTransverseSize:false,
      longitudinalMagnification:null,
      constantAxialShift:false,
      axialShift:null,
      preservesAxialImagePosition:false,
      selfConjugateObjects:selfConj.items
    }};
  }

  // Exact afocal (C = 0, AD = 1): constant transverse magnification m = A.
  if(nearZero(a,sa)||nearZero(d,sd))return indeterminate('ILL_CONDITIONED_AFOCAL_MATRIX',
    'Afocal magnification coefficients suffer severe cancellation relative to intermediate monomials.');
  const selfConj=computeReturnSelfConjugates();
  if(!selfConj.ok)return indeterminate(selfConj.code,selfConj.reason);

  const a2=multiply(a,a);
  const a2Minus1=subtract(a2,ONE);
  const unitTransverseScale=add(multiply(sa,sa),ONE);
  if(nearZero(a2Minus1,unitTransverseScale))return indeterminate('NEAR_UNIT_MAGNIFICATION_BOUNDARY',
    'This afocal stack has transverse magnification magnitude near 1 within the relative numerical band.');
  const unitTransverse=a2Minus1.n===0n;

  // Longitudinal magnification dx_img / dx_obj: +(n_out/n_in)*A^2 for transmission, -A^2 for return.
  const indexRatio=divide(exitIndex,entranceIndex);
  const mLongMag=multiply(indexRatio,a2);
  const mLong=isReturn?negR(mLongMag):mLongMag;

  let constantAxialShift=false,axialShiftNum=null,preservesAxial=false;
  if(!isReturn){
    const longResidual=subtract(mLongMag,ONE);
    const longScale=add(multiply(indexRatio,multiply(sa,sa)),ONE);
    if(nearZero(longResidual,longScale))return indeterminate('NEAR_UNIT_LONGITUDINAL_MAGNIFICATION',
      'This afocal transmission stack has longitudinal magnification near 1 within the relative numerical band; constant versus object-dependent axial shift cannot be reliably classified.');
    if(longResidual.n===0n){
      constantAxialShift=true;
      // Constant axial shift deltaX = L_span - n_out*A*B, guarded by expanded monomial bound L_span + n_out*sa*sb.
      const deltaX=subtract(span,multiply(exitIndex,multiply(a,b)));
      const shiftScale=add(span,multiply(exitIndex,multiply(sa,sb)));
      if(nearZero(deltaX,shiftScale))return indeterminate('NEAR_ZERO_AXIAL_SHIFT',
        'This unit-longitudinal-magnification afocal stack has a nonzero axial shift within the expanded relative monomial band; exact axial preservation cannot be reliably classified.');
      axialShiftNum=toSafeNum(deltaX);
      if(axialShiftNum===null)return indeterminate('DERIVED_COORDINATE_OUT_OF_RANGE','Computed constant axial shift exceeds qualified numerical bounds.');
      preservesAxial=deltaX.n===0n;
    }
  }

  const absANum=toBinary64(absR(a)),mLongNum=toBinary64(mLong);
  if(!Number.isFinite(absANum)||!Number.isFinite(mLongNum))
    return indeterminate('UNRELIABLE_STACK_MATRIX','Afocal magnification exceeds finite binary64 representation.');

  return {...base,status:'conditional',reasonCode:null,value:{
    ...common,
    isAfocal:true,
    equivalentPower:0,
    effectiveFocalLength:null,
    constantTransverseMagnification:true,
    transverseMagnification:aNum,
    transverseMagnificationMagnitude:absANum,
    imageOrientation:a.n>0n?'upright':'inverted',
    preservesTransverseSize:unitTransverse,
    longitudinalMagnification:mLongNum,
    constantAxialShift,
    axialShift:axialShiftNum,
    preservesAxialImagePosition:preservesAxial,
    selfConjugateObjects:selfConj.items
  }};
}
