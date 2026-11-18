// JEE first: explicit analytical apparent-depth query, independent of scenes.
// A virtual point is a CONDITIONAL geometric construction, not a native hit,
// source attribution, real image, observed observer or ray propagated backwards.
import {RAD,classifySnellTransmission} from './angular-math.js';
import {interfaceNormal} from './planar-media.js';
import {isRecord} from './qualified-utils.js';

export const APPARENT_DEPTH_QUERY_FORMAT='opticsim-planar-apparent-depth-query-v1';
export const APPARENT_DEPTH_RESULT_FORMAT='opticsim-planar-apparent-depth-result-v1';
const UNIT_MM=Object.freeze({mm:1,cm:10,m:1000});
const BOUND_MM=10000,BOUNDARY_CLEARANCE_MM=.01;
const NEAR_AXIS_DEG=1e-6,NEAR_GRAZING_COS=1e-8;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function fields(x,allowed,required,label){
 if(!isRecord(x)||Object.keys(x).some(k=>!allowed.includes(k))||
    required.some(k=>!own(x,k)))throw Error('Invalid '+label+' fields');
}
function finite(x,label){
 if(typeof x!=='number'||!Number.isFinite(x))throw Error(label+' must be a finite number');
 return x;
}
function point(value,scale,label){
 fields(value,['x','y'],['x','y'],label);
 const x=finite(value.x,label+'.x')*scale,y=finite(value.y,label+'.y')*scale;
 if(Math.abs(x)>BOUND_MM||Math.abs(y)>BOUND_MM)
  throw Error(label+' must fit inside ±10000 mm');
 return {x,y};
}
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const along=(p,v,d)=>({x:p.x+v.x*d,y:p.y+v.y*d});
const inBounds=p=>[p.x,p.y].every(x=>Number.isFinite(x)&&Math.abs(x)<=BOUND_MM);
function base(){
 return {format:APPARENT_DEPTH_RESULT_FORMAT,
   native:{status:'not-run',observations:null,nativeImageDetected:false},
   interpretation:'not-assessed-by-engine',
   questionSupport:'not-assessed-by-engine',
   limitations:[
     'An axis intercept is a conditional reverse mathematical extension, never a native backward ray or detector-detected image.',
     'No physical observer position, continuous irradiance, Fresnel throughput, phase, wavelength or image sharpness is inferred.',
     'Analytical geometry cannot attest to a native ray path. Native verification requires a separately authored complete scene.'
   ]};
}
function withheld(result,status,reasonCode,reason){
 return {...result,status,resultKind:null,value:null,reasonCode,reason};
}
export function apparentDepthCapabilities(){
 return {format:APPARENT_DEPTH_QUERY_FORMAT,
   input:'Exactly one known point source and one ideal infinite planar boundary; boundary normal points from source medium toward observer medium.',
   fields:{
     lengthUnit:['mm','cm','m'],
     source:['x','y'],
     interface:['x','y','normalDeg','sourceIndex','observerIndex'],
     observation:[
       {kind:'finite-incidence-angle',incidentAngleDeg:'signed degrees from the source-to-observer normal in the y-up frame'},
       {kind:'paraxial-limit',condition:'explicitly requested zero-angle limit, not a measured ray'}
     ]},
   indexBounds:[1,4],minimumSourcePlaneDistanceMm:BOUNDARY_CLEARANCE_MM,
   methods:['analytical-snells-law-conditional-axis-intercept','paraxial-snells-law-limit'],
   statuses:['conditional','not-identifiable','TIR-no-transmission','numerically-unstable'],
   native:'not-run: no brightness, Fresnel policy, detector, source attribution or optical image is invented',
   limitations:base().limitations};
}
export function analyzeApparentDepth(query){
 fields(query,['format','lengthUnit','source','interface','observation'],
   ['format','lengthUnit','source','interface','observation'],'apparent-depth query');
 if(query.format!==APPARENT_DEPTH_QUERY_FORMAT)throw Error('Unsupported apparent-depth query format');
 if(!own(UNIT_MM,query.lengthUnit))throw Error('Explicit mm/cm/m length unit is required');
 const scale=UNIT_MM[query.lengthUnit];
 const S=point(query.source,scale,'source');
 fields(query.interface,['x','y','normalDeg','sourceIndex','observerIndex'],
   ['x','y','normalDeg','sourceIndex','observerIndex'],'plane');
 const P=point({x:query.interface.x,y:query.interface.y},scale,'plane');
 const normalDeg=finite(query.interface.normalDeg,'normalDeg');
 if(normalDeg< -180||normalDeg>180)throw Error('Plane normal must lie in [-180,180] degrees');
 const n=interfaceNormal({normalDeg}),t={x:-n.y,y:n.x};
 for(const key of ['sourceIndex','observerIndex']){
  const v=finite(query.interface[key],key);
  if(v<1||v>4)throw Error(key+' must be an explicit refractive index in [1,4]');
 }
 const ns=query.interface.sourceIndex,no=query.interface.observerIndex;
 const sourceSigned=dot(minus(S,P),n);
 if(sourceSigned>=0)throw Error('The stated source must be on the negative side of the explicitly oriented plane normal; do not infer or reverse the normal');
 const realDepth=-sourceSigned;
 if(realDepth<BOUNDARY_CLEARANCE_MM)
  throw Error('Source must be at least 0.01 mm from its interface');
 const foot=along(P,t,dot(minus(S,P),t));
 const common={...base(),realDepthMm:realDepth,
   sourceIndex:ns,observerIndex:no,
   sourceSide:'negative',observerSide:'positive',
   normalDeg,assumptions:[
     'One ideal infinite planar boundary separates homogeneous isotropic nondispersive media with the stated explicit indices.',
     'The plane normal points from the stated source toward the observer medium.',
     'No intervening optical element or obstructing boundary is modelled; no actual detector/observer location is asserted.'
   ]};
 fields(query.observation,['kind','incidentAngleDeg'],['kind'],'observation');
 const kind=query.observation.kind;
 if(kind==='paraxial-limit'){
  if(own(query.observation,'incidentAngleDeg'))
   throw Error('Paraxial limit must not disguise a stated finite-angle ray');
  const depth=realDepth*no/ns,point=along(foot,n,-depth);
  if(!inBounds(point))return withheld(common,'numerically-unstable',
    'OUT_OF_BOUNDS_AXIS_INTERCEPT','The computed ideal limit exceeds the supported ±10000 mm coordinate bounds');
  return {...common,status:'conditional',resultKind:'paraxial-limit',
    method:'paraxial-snells-law-limit',reasonCode:null,reason:null,
    value:{realDepthMm:realDepth,apparentDepthMm:depth,
      apparentPointMm:point,paraxialLimitMm:depth,
      unit:'mm',nativeImageDetected:false},
    qualification:'Only the paraxial limit is calculated; no single axial ray locates this point and no native ray was run.'};
 }
 if(kind!=='finite-incidence-angle')throw Error('Unsupported observation kind');
 if(!own(query.observation,'incidentAngleDeg'))throw Error('Finite-angle calculation requires incidentAngleDeg');
 const iDeg=finite(query.observation.incidentAngleDeg,'incidentAngleDeg');
 if(!(iDeg> -90&&iDeg<90))throw Error('Incident angle must be strictly between -90 and +90 degrees');
 const ai=Math.abs(iDeg),cosI=Math.cos(ai*RAD);
 if(ai===0)return withheld(common,'not-identifiable','AXIAL_SINGLE_RAY',
   'One exactly normal-incidence ray cannot determine a unique apparent point; request an explicit paraxial limit instead.');
 if(ai<NEAR_AXIS_DEG||cosI<=NEAR_GRAZING_COS)
  return withheld(common,'numerically-unstable','ILL_CONDITIONED_BACKPROJECTION',
   'A near-axial or near-grazing single-ray extrapolation cannot be certified under this numerical policy.');
 const snell=classifySnellTransmission(ns*Math.sin(ai*RAD),ns,no,ai);
 if(snell.uncertainCritical)
  return withheld(common,'numerically-unstable','NEAR_CRITICAL_NUMERIC',
    'The transmitted grazing boundary is numerically indeterminate; no finite outgoing ray is asserted.');
 if(snell.tir)
  return withheld(common,'TIR-no-transmission','TOTAL_INTERNAL_REFLECTION',
    'Ideal Snell transmission is unavailable; do not infer a transmitted ray or apparent position.');
 if(!Number.isFinite(snell.out)||snell.out>=90)
  return withheld(common,'numerically-unstable','INDETERMINATE_TRANSMISSION',
    'No stable finite refracted direction exists for this query.');
 const tRad=snell.out*RAD,cosT=Math.cos(tRad);
 // Stable equivalent of depth*tan(i)/tan(t); direct tan/tan is 0/0
 // near axis. No route is simulated, no native hit is asserted.
 const depth=realDepth*(no/ns)*(cosT/cosI);
 const angleSign=Math.sign(iDeg);
 const interfaceCrossing=along(foot,t,realDepth*Math.tan(iDeg*RAD));
 const apparentPoint=along(foot,n,-depth);
 if(!Number.isFinite(depth)||depth<=0||!inBounds(interfaceCrossing)||!inBounds(apparentPoint))
  return withheld(common,'numerically-unstable','UNBOUNDED_PROJECTION',
    'The ideal line extension is nonfinite or outside the supported coordinate domain.');
 const transmissionDeg=angleSign*snell.out;
 return {...common,status:'conditional',resultKind:'conditional-axis-intercept',
   method:'analytical-snells-law-conditional-axis-intercept',reasonCode:null,reason:null,
   value:{realDepthMm:realDepth,apparentDepthMm:depth,
     apparentPointMm:apparentPoint,interfaceCrossingMm:interfaceCrossing,
     incidentAngleDeg:iDeg,refractedAngleDeg:transmissionDeg,
     paraxialLimitMm:realDepth*no/ns,unit:'mm',nativeImageDetected:false},
   qualification:'A finite-angle ray would appear to originate at this axis intercept if transmitted. This is a conditional mathematical extension, not an optical image observation.'};
}
