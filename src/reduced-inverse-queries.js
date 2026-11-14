// Reduced-facts inverse optics. Pure conditional mathematics: NOT a native
// PhyDemo simulation, ray intersection solver, or apparatus reconstruction.
// This module never invents source brightness, aperture, or ray directions.
export const INVERSE_FACTS_FORMAT='opticsim-reduced-inverse-facts-v1';
export const INVERSE_QUERY_FORMAT='opticsim-reduced-inverse-query-v1';
export const INVERSE_RESULT_FORMAT='opticsim-reduced-inverse-result-v1';
const kinds=['plane-mirror-reflection-point','paraxial-focal-length-inverse'];
const units=Object.freeze({mm:1,cm:10,m:1000});
const own=(x,k)=>Object.hasOwn(x,k);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export class ReducedInverseError extends Error{
  constructor(code,message){super(message);this.code=code;}
}
function fail(code,message){throw new ReducedInverseError(code,message);}
function fields(value,allowed,required,label){
  if(!record(value))fail('INVALID_FACTS',label+' must be an object');
  const unknown=Object.keys(value).filter(k=>!allowed.includes(k));
  if(unknown.length)fail('INVALID_FACTS',label+' has unknown fields: '+unknown.join(', '));
  const missing=required.filter(k=>!own(value,k));
  if(missing.length)fail('MISSING_FACTS',label+' requires '+missing.join(', '));
}
function number(value,label,max=1e9){
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>max)
    fail('INVALID_FACTS',label+' must be a bounded, finite number');
  return value;
}
function positive(value,label,max=1e9){
  const v=number(value,label,max);
  if(v<=0)fail('INVALID_FACTS',label+' must be positive');
  return v;
}
function coord(value,label,scale){
  const v=number(value,label);
  if(Math.abs(v*scale)>1e9)fail('INVALID_FACTS',label+' exceeds the 1e9 mm reduced-facts bound');
  return v;
}
function point(value,label,scale){
  fields(value,['x','y'],['x','y'],label);
  return {x:coord(value.x,label+'.x',scale),y:coord(value.y,label+'.y',scale)};
}
function final(status,value,{reason=null,reasonCode=null,candidates=null,assumptions=[],limitations=[],model=null}={}){
  return {format:INVERSE_RESULT_FORMAT,status,value,method:'conditional-analytical',
    model,native:{status:'not-run'},questionSupport:'not-assessed-by-engine',
    ...(candidates?{candidates}:{}),reason,reasonCode,assumptions,limitations};
}
export function reducedInverseCapabilities(){
  return {format:INVERSE_QUERY_FORMAT,factsFormat:INVERSE_FACTS_FORMAT,kinds:[...kinds],
    models:['plane-mirror','ideal-thin-lens','spherical-mirror-paraxial'],
    lengthUnits:Object.keys(units),
    reflectionPoint:'Requires two distinct named point coordinates and a declared mirror supporting line. Optional finite length checks actual segment containment. Same-side specular reflection only.',
    paraxialInverse:'Requires 1–4 real-object distances and either signedMagnification or absoluteMagnification, with optional imageOrientation (erect/inverted) for unsigned values. Multiple observations must share one focal length.',
    signConvention:'real-object-positive: u>0 on the incident/front side, m=-v/u, v>0 for a real image; f=uv/(u+v). Mirror f>0 is concave, f<0 convex.',
    policy:'Conditional ideal/paraxial relations only; no source/aperture/brightness/position or native image is inferred. Multiple physically valid candidates are not selected automatically; no 3D visibility, lens-maker or chromatic inverse.'};
}
function reflectionPoint(facts,scale){
  fields(facts,['format','model','lengthUnit','mirror','points'],
    ['format','model','lengthUnit','mirror','points'],'reflection facts');
  fields(facts.mirror,['x','y','tangentDeg','length'],
    ['x','y','tangentDeg'],'mirror supporting line');
  fields(facts.points,['A','B'],['A','B'],'reflection points');
  const c=point({x:facts.mirror.x,y:facts.mirror.y},'mirror centre',scale);
  const a=point(facts.points.A,'A',scale),b=point(facts.points.B,'B',scale);
  const angle=number(facts.mirror.tangentDeg,'mirror tangentDeg',180);
  const theta=angle*Math.PI/180,t={x:Math.cos(theta),y:Math.sin(theta)};
  const normal={x:-t.y,y:t.x};
  const proj=(p,v)=>(p.x-c.x)*v.x+(p.y-c.y)*v.y;
  const sA=proj(a,normal),sB=proj(b,normal),aT=proj(a,t),bT=proj(b,t);
  const dist=Math.hypot(a.x-b.x,a.y-b.y);
  if(dist<=1e-10/scale)return final('unavailable',null,{model:facts.model,
    reason:'The declared two points coincide; there is no unique two-point reflection path.',
    reasonCode:'DEGENERATE_TWO_POINT_PATH'});
  if(Math.min(Math.abs(sA),Math.abs(sB))*scale<1e-8)return final('unavailable',null,{
    model:facts.model,reason:'A point lies on or numerically indistinguishable from the mirror line.',
    reasonCode:'POINT_ON_MIRROR'});
  if(Math.sign(sA)!==Math.sign(sB))return final('unavailable',null,{
    model:facts.model,reason:'A single specular reflection on this line requires both endpoints on the same side.',
    reasonCode:'OPPOSITE_MIRROR_SIDES'});
  const hitT=(aT*Math.abs(sB)+bT*Math.abs(sA))/(Math.abs(sA)+Math.abs(sB));
  if(own(facts.mirror,'length')){
    const len=positive(facts.mirror.length,'mirror length');
    if(len*scale<1)fail('INVALID_FACTS','Finite mirror length must be at least 1 mm');
    if(Math.abs(hitT)>len/2+1e-10/scale)return final('unavailable',null,{
      model:facts.model,reason:'The conditional specular point is outside the authored finite segment.',
      reasonCode:'REFLECTION_MISSES_FINITE_MIRROR'});
    if(Math.abs(Math.abs(hitT)-len/2)*scale<1e-8)return final('numerically-indeterminate',null,{
      model:facts.model,reason:'The reflection point is at a finite segment endpoint.',
      reasonCode:'ENDPOINT_REFLECTION_AMBIGUITY'});
  }
  const hit={x:c.x+t.x*hitT,y:c.y+t.y*hitT};
  const angleDeg=Math.atan2(Math.abs(bT-aT),Math.abs(sA)+Math.abs(sB))*180/Math.PI;
  const pathLength=Math.hypot(bT-aT,Math.abs(sA)+Math.abs(sB));
  return final('conditional',{
    reflectionPoint:hit,
    distanceFromProjectionA:Math.abs(hitT-aT),
    distanceFromProjectionB:Math.abs(hitT-bT),
    distanceAlongTangentFromCentre:hitT,
    incidenceAngleFromNormalDeg:angleDeg,
    pathLength,lengthUnit:facts.lengthUnit
  },{model:facts.model,
    assumptions:['Ideal, two-sided specular reflection on the stated straight supporting line.',
      'Coordinates are x-right/y-up; tangentDeg is the angle from +x to the mirror surface tangent.'],
    limitations:own(facts.mirror,'length')?
      ['This geometric solution applies only to the declared finite mirror segment; it is not a measured native ray.']:
      ['The mirror extent is unspecified. This is a reflection on an infinite supporting line, not proof that a finite mirror is struck.']});
}
function candidate(u,m,obsId){
  if(m===1)return {special:'no-finite-focal-length'};
  if(Math.abs(m-1)<=1e-10*Math.max(1,Math.abs(m)))return {special:'near-unit-magnification'};
  const v=-m*u, f=u*m/(m-1);
  if(!Number.isFinite(f)||!Number.isFinite(v)||Math.abs(f)>1e12||Math.abs(v)>1e12)
    return {special:'ill-conditioned'};
  return {observationId:obsId,objectDistance:u,magnification:m,
    imageDistance:v,focalLength:f,orientation:m>0?'erect':'inverted',
    imageKind:m>0?'virtual':'real'};
}
function close(a,b){
  return Math.abs(a-b)<=1e-10*Math.max(Math.abs(a),Math.abs(b),1e-6)+1e-9;
}
function paraxial(facts,scale){
  fields(facts,['format','model','lengthUnit','signConvention','observations'],
    ['format','model','lengthUnit','signConvention','observations'],'paraxial inverse facts');
  if(facts.signConvention!=='real-object-positive')
    fail('INVALID_FACTS','Explicit real-object-positive sign convention required');
  if(!Array.isArray(facts.observations)||facts.observations.length<1||facts.observations.length>4)
    fail('INVALID_FACTS','Supply 1–4 stated real-object observations');
  const ids=new Set(), options=[];
  let nearSingular=false,noFinite=false;
  for(const o of facts.observations){
    fields(o,['id','objectDistance','signedMagnification','absoluteMagnification','imageOrientation'],
      ['id','objectDistance'],'image observation');
    if(typeof o.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(o.id)||ids.has(o.id))
      fail('INVALID_FACTS','Observations require distinct bounded IDs');
    ids.add(o.id);
    const u=positive(o.objectDistance,'objectDistance')*scale;
    if(u>1e9)fail('INVALID_FACTS','Object distance exceeds 1e9 mm');
    const signed=own(o,'signedMagnification'),absolute=own(o,'absoluteMagnification');
    if(signed===absolute)fail('MISSING_FACTS','Supply exactly one signedMagnification or absoluteMagnification');
    if(signed&&own(o,'imageOrientation'))fail('INVALID_FACTS','Signed magnification already defines orientation');
    if(own(o,'imageOrientation')&&!['erect','inverted'].includes(o.imageOrientation))
      fail('INVALID_FACTS','imageOrientation must be erect or inverted');
    const m=signed?number(o.signedMagnification,'signedMagnification',1e6):
      positive(o.absoluteMagnification,'absoluteMagnification',1e6);
    if(m===0)fail('INVALID_FACTS','Zero Gaussian magnification is not a finite image constraint');
    const magnifications=signed?[m]:o.imageOrientation==='erect'?[m]:
      o.imageOrientation==='inverted'?[-m]:[-m,m];
    const candidates=[];
    for(const mag of magnifications){
      const c=candidate(u,mag,o.id);
      if(c.special){if(c.special==='no-finite-focal-length')noFinite=true;else nearSingular=true;}
      else candidates.push(c);
    }
    options.push(candidates);
  }
  if(options.some(xs=>xs.length===0))return final(nearSingular?'numerically-indeterminate':'unavailable',null,{
    model:facts.model,reason:nearSingular?'The magnification is too close to the unit-magnification singularity for a reliable finite focal length.':
      'The stated constraints do not define a finite Gaussian focal length.',
    reasonCode:nearSingular?'NEAR_UNIT_MAGNIFICATION':'NO_FINITE_FOCAL_LENGTH'});
  let combinations=options[0].map(c=>({focalLength:c.focalLength,observations:[c]}));
  for(const next of options.slice(1)){
    combinations=combinations.flatMap(prev=>next.filter(c=>close(c.focalLength,prev.focalLength))
      .map(c=>({focalLength:prev.focalLength,observations:[...prev.observations,c]})));
    if(!combinations.length)return final('unavailable',null,{model:facts.model,
      reason:'No single focal length satisfies every stated observation and allowed orientation.',
      reasonCode:'INCONSISTENT_PARAXIAL_OBSERVATIONS'});
  }
  // Each candidate records the signs implied by all observations. If the
  // magnitudes admit different focal lengths, never silently pick one.
  const distinct=[];
  for(const c of combinations)if(!distinct.some(x=>close(x.focalLength,c.focalLength)))
    distinct.push(c);
  const convert=c=>{
    const f=c.focalLength/scale;
    const type=facts.model==='spherical-mirror-paraxial'
      ?(f>0?'concave':'convex'):(f>0?'converging':'diverging');
    return {focalLength:f,lengthUnit:facts.lengthUnit,opticalClassification:type,
      ...(facts.model==='spherical-mirror-paraxial'?{signedRadiusOfCurvature:2*f}:{}),
      observations:c.observations.map(o=>({
        id:o.observationId,objectDistance:o.objectDistance/scale,
        imageDistance:o.imageDistance/scale,signedMagnification:o.magnification,
        orientation:o.orientation,imageKind:o.imageKind
      }))};
  };
  const common={model:facts.model,assumptions:[
    'Ideal Gaussian/paraxial conjugate formula: 1/f=1/u+1/v, with real-object-positive u and signed magnification m=-v/u.',
    'For lenses a real image is on the transmitted side; for mirrors a real image is on the reflecting/front side.',
    'All observations refer to the same static ideal optic with a real object.'
  ],limitations:[
    'No finite aperture, source brightness, material dispersion, spherical aberration, image detector or native ray interaction is inferred.',
    ...(noFinite?['An erect +1 magnification branch has no finite focal length and is excluded.']:[])
  ]};
  if(distinct.length>1)return final('multiple-solutions',null,{
    ...common,reason:'Unsigned magnification permits multiple finite focal lengths; provide image orientation or another independent observation.',
    reasonCode:'AMBIGUOUS_IMAGE_ORIENTATION',candidates:distinct.map(convert)});
  return final('conditional',convert(distinct[0]),common);
}
export function analyzeReducedInverseQuery(facts,query){
  fields(query,['format','kind'],['format','kind'],'inverse query');
  if(query.format!==INVERSE_QUERY_FORMAT||!kinds.includes(query.kind))
    fail('UNSUPPORTED_QUERY','Unknown reduced inverse calculation');
  fields(facts,['format','model','lengthUnit','mirror','points','signConvention','observations'],
    ['format','model','lengthUnit'],'reduced inverse facts');
  if(facts.format!==INVERSE_FACTS_FORMAT)fail('UNSUPPORTED_MODEL','Only explicit reduced inverse facts are accepted');
  const scale=units[facts.lengthUnit];
  if(!scale)fail('INVALID_FACTS','lengthUnit must be mm, cm or m');
  if(query.kind==='plane-mirror-reflection-point'){
    if(facts.model!=='plane-mirror')fail('UNSUPPORTED_MODEL','Reflection-point query requires the plane-mirror model');
    return reflectionPoint(facts,scale);
  }
  if(!['ideal-thin-lens','spherical-mirror-paraxial'].includes(facts.model))
    fail('UNSUPPORTED_MODEL','Focal-length query requires an ideal thin lens or paraxial spherical mirror');
  return paraxial(facts,scale);
}
