// Gaussian image kinematics: conditional mathematics, never native image detection.
import {isRecord} from './qualified-utils.js';
import {prepareScene} from './authoring.js';
import {isCurved,curvedFrame} from './curved-mirrors.js';
export const CURVED_FACTS_FORMAT='opticsim-curved-mirror-facts-v1';
export const CURVED_QUERY_FORMAT='opticsim-curved-mirror-query-v1';
const kinds=['curved-mirror-image','curved-mirror-image-velocity'];
export class CurvedQueryError extends Error{
  constructor(code,message){super(message);this.code=code;}
}
const error=(code,msg)=>{throw new CurvedQueryError(code,msg);};
const own=(o,k)=>Object.hasOwn(o,k);
function object(v,allowed,required,label){
  if(!isRecord(v))error('INVALID_FACTS',label+' must be an object');
  const unknown=Object.keys(v).filter(k=>!allowed.includes(k));
  if(unknown.length)error('INVALID_FACTS',label+' has unknown fields: '+unknown.join(','));
  const missing=required.filter(k=>!own(v,k));
  if(missing.length)error('MISSING_FACTS',label+' requires '+missing.join(','));
}
function number(v,label){if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12)error('INVALID_FACTS',label+' must be finite with magnitude <= 1e12');return v;}
export function curvedQueryCapabilities(){return {format:CURVED_QUERY_FORMAT,factsFormat:CURVED_FACTS_FORMAT,kinds,
  signConvention:'real-positive-local: positive axial distance is in front; concave f>0, convex f<0; transverse axis is fixed',
  models:['ideal-gaussian','spherical-paraxial'],
  requiredFacts:['model','signConvention','focalLength + objectDistance + lengthUnit OR objectDistanceOverFocalLength + curvature'],
  optionalFacts:['objectHeight','objectVelocity','stationaryMirror','fixedFocalLength','timeUnit'],
  velocity:'Requires object height, stationaryMirror=true, fixedFocalLength=true, timeUnit=s and axial/transverse velocity or speed/directionDeg (CCW from +axial toward +transverse).',
  limits:['No moving mirror, changing focal length, propagation delay, relativistic or arbitrary symbolic motion.',
    'No source brightness, aperture, picture coordinates or native scene is fabricated for analytical facts.']};}
function fromScene(input,query){
  const prepared=prepareScene(input),cs=prepared.document.physics.components;
  const sources=cs.filter(c=>c.type==='point-source'),mirrors=cs.filter(c=>isCurved(c.type));
  if(sources.length!==1||mirrors.length!==1||cs.some(c=>!['point-source','ray-detector','ideal-curved-mirror','circular-arc-mirror'].includes(c.type)))
    error('UNSUPPORTED_SCOPE','Image calculation needs one source and one curved mirror; other active optics cannot be removed from the model.');
  const s=sources[0],m=mirrors[0],p=m.parameters,{n,t}=curvedFrame(p);
  if(query.componentId!==undefined&&query.componentId!==m.id)error('INVALID_FACTS','Unknown curved mirror ID');
  const dx=s.parameters.x-p.x,dy=s.parameters.y-p.y,u=dx*n.x+dy*n.y;
  if(u<=0)error('UNSUPPORTED_SCOPE','This point emitter is not on the declared front side; a virtual object cannot be inferred from it.');
  const facts={format:CURVED_FACTS_FORMAT,model:m.type==='ideal-curved-mirror'?'ideal-gaussian':'spherical-paraxial',
    signConvention:'real-positive-local',lengthUnit:'mm',focalLength:m.type==='ideal-curved-mirror'?p.focalLength:p.radius/2,
    objectDistance:u,objectHeight:dx*t.x+dy*t.y};
  return {facts,prepared,mirror:m,frame:{n,t}};
}
export function analyzeCurvedMirrorQuery(input,query){
  object(query,['format','kind','componentId'],['format','kind'],'curved query');
  if(query.format!==CURVED_QUERY_FORMAT||!kinds.includes(query.kind))error('UNSUPPORTED_QUERY','Unknown curved-mirror calculation');
  if(own(query,'componentId')&&(typeof query.componentId!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(query.componentId)))error('INVALID_FACTS','Invalid curved mirror ID');
  let derived=null,facts=input;
  if(input?.format!==CURVED_FACTS_FORMAT){derived=fromScene(input,query);facts=derived.facts;}
  object(facts,['format','model','signConvention','lengthUnit','focalLength','objectDistance','objectDistanceOverFocalLength','curvature','objectHeight','objectVelocity','stationaryMirror','fixedFocalLength','timeUnit'],
    ['format','model','signConvention'],'curved facts');
  if(!['ideal-gaussian','spherical-paraxial'].includes(facts.model))error('UNSUPPORTED_MODEL','Choose ideal-gaussian or spherical-paraxial, not an exact finite-aperture spherical image model.');
  if(facts.signConvention!=='real-positive-local')error('INVALID_FACTS','Explicit real-positive-local sign convention required');
  if(own(facts,'lengthUnit')&&!['mm','cm','m'].includes(facts.lengthUnit))error('INVALID_FACTS','lengthUnit must be mm, cm or m');
  for(const k of ['stationaryMirror','fixedFocalLength'])if(own(facts,k)&&typeof facts[k]!=='boolean')error('INVALID_FACTS',k+' must be boolean');
  if(own(facts,'timeUnit')&&facts.timeUnit!=='s')error('INVALID_FACTS','Velocity uses seconds only');
  const normalized=own(facts,'objectDistanceOverFocalLength');
  if(normalized&&(own(facts,'objectDistance')||own(facts,'focalLength')))error('INVALID_FACTS','Use absolute distances OR normalized distance, not both');
  let f=null,u=null,r;
  if(normalized){
    if(!['concave','convex'].includes(facts.curvature))error('MISSING_FACTS','Normalized distances require concave/convex curvature to classify image reality');
    r=number(facts.objectDistanceOverFocalLength,'u/f');
  }else{
    if(!own(facts,'focalLength')||!own(facts,'objectDistance')||!own(facts,'lengthUnit'))error('MISSING_FACTS','focalLength, objectDistance and lengthUnit are required');
    f=number(facts.focalLength,'focalLength');u=number(facts.objectDistance,'objectDistance');
    if(f===0)error('INVALID_FACTS','Zero focal length is not a mirror model');
    if(own(facts,'curvature')&&facts.curvature!==(f>0?'concave':'convex'))error('INVALID_FACTS','Curvature contradicts focal-length sign');
    r=u/f;
  }
  if((normalized?r===0:u===0))error('UNSUPPORTED_SCOPE','An object at the mirror pole is outside this image model');
  const h=own(facts,'objectHeight')?number(facts.objectHeight,'objectHeight'):null;
  if(h!==null&&!own(facts,'lengthUnit'))error('MISSING_FACTS','A dimensional objectHeight needs lengthUnit');
  let velocity=null;
  if(own(facts,'objectVelocity')){
    const vel=facts.objectVelocity;
    if(!isRecord(vel))error('INVALID_FACTS','objectVelocity must be a data object');
    if(own(vel,'speed')){
      object(vel,['speed','directionDeg'],['speed','directionDeg'],'object velocity');
      const speed=number(vel.speed,'speed'),a=number(vel.directionDeg,'velocity direction');
      if(speed<0||Math.abs(a)>180)error('INVALID_FACTS','Speed nonnegative; direction in [-180,180]');
      velocity={axial:speed*Math.cos(a*Math.PI/180),transverse:speed*Math.sin(a*Math.PI/180)};
    }else{
      object(vel,['axial','transverse'],['axial','transverse'],'object velocity');
      velocity={axial:number(vel.axial,'axial velocity'),transverse:number(vel.transverse,'transverse velocity')};
    }
  }
  const base={format:'opticsim-curved-mirror-result-v1',kind:query.kind,method:'conditional-analytical',model:facts.model,
    native:{status:'not-run',observations:null},questionSupport:'not-assessed-by-engine',
    assumptions:[facts.model==='spherical-paraxial'?'Gaussian/paraxial spherical-mirror approximation; finite-aperture native rays can have spherical aberration.':'Ideal Gaussian mirror mapping; not a claim about an exact spherical surface.',
      'Local axial distances positive in front; transverse coordinate is fixed. No finite-aperture illumination, native image detection or source-question correctness is established.'],
    ...(derived?{canonicalForwardScene:derived.prepared.document,preparation:derived.prepared.preparation}:{}),
    relations:{imageDistance:'v=f*u/(u-f)',magnification:'m=-f/(u-f)',imageHeight:'y_i=m*y_o'}};
  if(query.kind==='curved-mirror-image-velocity'){
    if(normalized)error('MISSING_FACTS','Dimensional velocity needs absolute f and u, not an invented scale');
    if(h===null||!velocity||!own(facts,'stationaryMirror')||!own(facts,'fixedFocalLength')||facts.timeUnit!=='s')
      error('MISSING_FACTS','Velocity requires height, velocity, timeUnit:s, stationaryMirror and fixedFocalLength');
    if(!facts.stationaryMirror||!facts.fixedFocalLength)return {...base,status:'unavailable',value:null,reasonCode:'DYNAMIC_MIRROR_UNSUPPORTED',reason:'Stationary fixed-focal-length derivative does not apply to moving or changing mirrors.'};
  }
  if(normalized?r===1:u===f)return {...base,status:query.kind==='curved-mirror-image'?'conditional':'unavailable',
    value:query.kind==='curved-mirror-image'?{imageKind:'at-infinity',imageDistance:null,magnification:null,imageHeight:null,lengthUnit:facts.lengthUnit??null}:null,
    reasonCode:query.kind==='curved-mirror-image'?null:'NO_FINITE_IMAGE_VELOCITY',reason:'At the focal plane there is no finite image position, magnification or velocity.'};
  if(!Number.isFinite(r)||Math.abs(r-1)<=1e-10*Math.max(1,Math.abs(r)))return {...base,status:'numerically-indeterminate',value:null,reasonCode:'NEAR_FOCAL_SINGULARITY',reason:'The image denominator is too ill-conditioned for a reliable finite result.'};
  const m=-1/(r-1),vf=r/(r-1),v=f===null?null:f*vf,y=h===null?null:m*h;
  const signF=f===null?(facts.curvature==='concave'?1:-1):Math.sign(f);
  const image={imageKind:signF*vf>0?'finite-real':'finite-virtual',imageDistance:v,imageDistanceOverFocalLength:vf,
    magnification:m,imageHeight:y,orientation:m>0?'erect':'inverted',lengthUnit:facts.lengthUnit??null,
    ...(derived&&v!==null?{globalPositionMm:{x:derived.mirror.parameters.x+v*derived.frame.n.x+(y??0)*derived.frame.t.x,
      y:derived.mirror.parameters.y+v*derived.frame.n.y+(y??0)*derived.frame.t.y}}:{})};
  let value=image;
  if(query.kind==='curved-mirror-image-velocity'){
    const axial=-m*m*velocity.axial,mdot=m*m/f*velocity.axial;
    const transverse=m*velocity.transverse+h*mdot;
    value={...image,velocity:{axial,transverse},objectVelocity:velocity,magnificationRate:mdot,velocityUnit:facts.lengthUnit+'/s',
      axes:'axial positive away from mirror on front side; transverse in the fixed declared direction',
      terms:{transverseTransport:m*velocity.transverse,changingMagnification:h*mdot}};
    base.relations={...base.relations,axialVelocity:'dv/dt=-(v/u)^2*du/dt',transverseVelocity:'dy_i/dt=m*dy_o/dt+y_o*dm/dt',magnificationRate:'dm/dt=f*du/dt/(u-f)^2'};
    base.assumptions.push('Stationary mirror, fixed focal length; instantaneous geometrical mapping, not propagation delay.');
  }
  const numbers=[m,vf,...(v===null?[]:[v]),...(y===null?[]:[y]),...(value.velocity?Object.values(value.velocity):[]),...(value.magnificationRate===undefined?[]:[value.magnificationRate])];
  if(!numbers.every(Number.isFinite))return {...base,status:'numerically-indeterminate',value:null,reasonCode:'NONFINITE_CALCULATION',reason:'Finite numerical evaluation failed.'};
  return {...base,status:'conditional',value};
}
