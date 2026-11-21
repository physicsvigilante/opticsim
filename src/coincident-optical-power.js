import {isRecord} from './qualified-utils.js';

export const POWER_FACTS='opticsim-coincident-power-facts-v1';
export const POWER_QUERY='opticsim-coincident-power-query-v1';
const equivalent='contact-equivalent-power',forward='outgoing-vergence';
const inverse='required-component-power',refocus='fixed-output-power-change';
const kinds=[equivalent,forward,inverse,refocus];
const planes=['common-optical-plane','zero-vertex-relaxed-eye-plane','coincident-cornea-and-eye-lens-plane'];
const model='ideal-thin-powers-in-unit-index-air';
export function powerCapabilities(){
  return {format:POWER_QUERY,factsFormat:POWER_FACTS,kinds:[...kinds],model,referencePlanes:[...planes],
    convention:'Distances in metres from the declared common plane, positive along propagation. Power and vergence in dioptres.',
    conditions:['forward','conjugate-pair','fixed-outgoing-vergence'],
    elements:'One to four unique IDs, each with powerD, focalLengthM or unknown:true. At most one unknown.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,required,optional=[]){
  if(!isRecord(o)||Object.keys(o).some(k=>!required.includes(k)&&!optional.includes(k)))
    fail('INVALID_POWER_FACTS','Unexpected object or field in thin-power contract.');
  for(const k of required)if(!Object.hasOwn(o,k))fail('MISSING_FACTS','Missing '+k);
}
const stableId=id=>typeof id==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id);
function term(number,reciprocal=false){
  if(!Number.isFinite(number)||(reciprocal?(Math.abs(number)<.001||Math.abs(number)>1e6):
    (Math.abs(number)>1000||(number!==0&&Math.abs(number)<1e-6))))
    fail('INVALID_POWER_FACTS','Finite power must be zero or 1e-6–1000 D in magnitude; finite distance must be 0.001–1e6 m in magnitude.');
  return {number,reciprocal};
}
function conjugate(o){
  if(o==='infinity')return term(0);
  fields(o,['signedDistanceM']);return term(o.signedDistanceM,true);
}
const neg=t=>({...t,number:-t.number});
const dioptres=t=>t.reciprocal?1/t.number:t.number;
// Within the input bounds all binary64 terms are multiples of 2^-72.
// Check cancellation BEFORE rounding reciprocals to a dioptre value.
function exactlyZero(terms){
  const scale=1n<<72n;
  let numerator=0n,denominator=1n;
  for(const t of terms){
    const coefficient=BigInt(t.number*2**72);
    const n=t.reciprocal?scale:coefficient,d=t.reciprocal?coefficient:scale;
    numerator=numerator*d+n*denominator;
    denominator*=d;
  }
  return numerator===0n;
}
function sum(terms){
  const values=terms.map(dioptres);
  const total=values.reduce((a,b)=>a+b,0);
  const scale=values.reduce((a,b)=>a+Math.abs(b),0);
  if(Math.abs(total)<=1e-10*Math.max(1,scale)){
    if(exactlyZero(terms))return 0;
    fail('ILL_CONDITIONED_POWER','Near-cancelling powers or vergences cannot establish a stable output.');
  }
  return total;
}
const distance=p=>p===0?{kind:'at-infinity'}:{kind:'finite',signedDistanceM:1/p};
function validate(f){
  if(f?.format!==POWER_FACTS)fail('UNSUPPORTED_FACTS','Explicit common-plane signed-power facts required.');
  fields(f,['format','model','referencePlane','elements'],['condition']);
  if(f.model!==model||!planes.includes(f.referencePlane))fail('UNSUPPORTED_MODEL','Declare a supported thin-power model and reference plane.');
  if(!Array.isArray(f.elements)||f.elements.length<1||f.elements.length>4)fail('UNSUPPORTED_SCOPE','Specify one to four optical powers.');
  const powers=new Map();
  for(const e of f.elements){
    fields(e,['id'],['powerD','focalLengthM','unknown']);
    if(!stableId(e.id)||powers.has(e.id)||Object.keys(e).length!==2)fail('INVALID_POWER_FACTS','Require unique ID and exactly one power specification.');
    let t=null;
    if(Object.hasOwn(e,'powerD'))t=term(e.powerD);
    else if(Object.hasOwn(e,'focalLengthM'))t=term(e.focalLengthM,true);
    else if(e.unknown!==true)fail('INVALID_POWER_FACTS','Unknown component power requires unknown:true.');
    powers.set(e.id,t);
  }
  const unknown=[...powers.keys()].filter(id=>powers.get(id)===null);
  if(unknown.length>1)fail('UNSUPPORTED_SCOPE','At most one component power may be unknown.');
  const c=f.condition;
  if(Object.hasOwn(f,'condition')){
    if(c?.kind==='forward'){fields(c,['kind','incoming']);conjugate(c.incoming);}
    else if(c?.kind==='conjugate-pair'){fields(c,['kind','incoming','outgoing']);conjugate(c.incoming);conjugate(c.outgoing);}
    else if(c?.kind==='fixed-outgoing-vergence'){
      fields(c,['kind','initialIncoming','finalIncoming','adjustId']);
      conjugate(c.initialIncoming);conjugate(c.finalIncoming);
      if(!powers.has(c.adjustId))fail('INVALID_POWER_FACTS','Adjustable ID must identify an existing power.');
    }else fail('INVALID_POWER_FACTS','Unknown conjugate condition.');
    if(c.kind==='conjugate-pair'?unknown.length!==1:unknown.length!==0)
      fail('INVALID_POWER_FACTS','The given powers and unknowns must match the declared conjugate condition.');
  }
  return {powers,unknown};
}
export function analyzePowerQuery(f,q){
  fields(q,['format','kind']);
  if(q.format!==POWER_QUERY||!kinds.includes(q.kind))fail('UNSUPPORTED_QUERY','Unknown thin-power request.');
  const {powers,unknown}=validate(f),c=f.condition,known=[...powers.values()].filter(Boolean);
  const base={format:'opticsim-coincident-power-result-v1',kind:q.kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:[model,f.referencePlane,'Stationary paraxial powers at one plane; propagation is in the positive direction.'],
    limitations:['No finite-thickness or separated anatomy, physiological model, native contact or measured image.']};
  let value;
  try{
    if(q.kind===equivalent){
      if(unknown.length)fail('MISSING_FACTS','Equivalent power requires known component powers.');
      const powerD=sum(known);
      value={powerD,focalLength:distance(powerD)};
    }else if(q.kind===forward&&c?.kind==='forward'){
      const incoming=conjugate(c.incoming),outgoingD=sum([...known,incoming]);
      value={incomingD:dioptres(incoming),outgoingD,image:distance(outgoingD)};
    }else if(q.kind===inverse&&c?.kind==='conjugate-pair'){
      const requiredD=sum([conjugate(c.outgoing),neg(conjugate(c.incoming)),...known.map(neg)]);
      value={componentId:unknown[0],requiredD,focalLength:distance(requiredD)};
    }else if(q.kind===refocus&&c?.kind==='fixed-outgoing-vergence'){
      const initial=powers.get(c.adjustId),before=conjugate(c.initialIncoming),after=conjugate(c.finalIncoming);
      const fixedOutgoingD=sum([...known,before]);
      if(f.referencePlane==='coincident-cornea-and-eye-lens-plane'&&fixedOutgoingD<=0)
        fail('UNSUPPORTED_SCOPE','A finite downstream retinal conjugate requires positive output vergence.');
      value={componentId:c.adjustId,initialD:dioptres(initial),finalD:sum([initial,before,neg(after)]),
        changeD:sum([before,neg(after)]),fixedOutgoingD};
    }else fail(c?'UNSUPPORTED_SCOPE':'MISSING_FACTS','Specify the conjugate condition appropriate to the requested quantity.');
  }catch(e){
    if(e.code!=='ILL_CONDITIONED_POWER')throw e;
    return {...base,status:'numerically-indeterminate',value:null,reasonCode:e.code,reason:e.message};
  }
  return {...base,status:'conditional',value:{referencePlane:f.referencePlane,...value}};
}
