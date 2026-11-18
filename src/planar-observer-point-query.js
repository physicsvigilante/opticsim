// Bounded, standalone JEE observer-position query. This is deterministic
// conditional ANALYSIS, not native PhyDemo propagation, a traced backward ray,
// real observer/eye, reconstructed image, or an inferred scene/optical itinerary.
import {RAD} from './angular-math.js';
import {interfaceNormal} from './planar-media.js';
import {isRecord} from './qualified-utils.js';

export const OBSERVER_QUERY_FORMAT='opticsim-planar-observer-point-query-v1';
export const OBSERVER_RESULT_FORMAT='opticsim-planar-observer-point-result-v1';
const SCALE=Object.freeze({mm:1,cm:10,m:1000});
const MAX_MM=10000,MIN_CLEARANCE_MM=.01;
const ROOT_RESIDUAL_LIMIT=1e-12;
const MIN_NORMAL_COSINE=.02; // conservative numerical scope, NOT a physical critical angle
const NEAR_AXIS_MM=1e-10;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const times=(a,s)=>({x:a.x*s,y:a.y*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const within=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  Math.abs(p.x)<=MAX_MM&&Math.abs(p.y)<=MAX_MM;
function record(x,allowed,required,label){
 if(!isRecord(x)||Object.keys(x).some(k=>!allowed.includes(k))||
    required.some(k=>!own(x,k)))throw Error('Invalid '+label+' fields');
}
function finite(x,label){
 if(typeof x!=='number'||!Number.isFinite(x))throw Error(label+' must be a finite number');
 return x;
}
function point(v,unit,label){
 record(v,['x','y'],['x','y'],label);
 const p={x:finite(v.x,label+'.x')*unit,y:finite(v.y,label+'.y')*unit};
 if(!within(p))throw Error(label+' must have finite coordinates inside ±10000 mm');
 return p;
}
function unitVector(x,y){
 const magnitude=Math.hypot(x,y);
 return magnitude>0&&Number.isFinite(magnitude)?
   {x:x/magnitude,y:y/magnitude}:null;
}
function allFinite(...values){return values.every(Number.isFinite);}
function coreResult(){
 return {format:OBSERVER_RESULT_FORMAT,kind:'source-to-observer-transmission',
  native:{status:'not-run',observations:null,nativeImageDetected:false},
  interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine',
  method:'analytical-stationary-optical-path-and-snells-law',
  assumptions:[
   'One infinite oriented plane between two homogeneous, isotropic and nondispersive media.',
   'The normal points from the explicitly specified source medium to the observer medium.',
   'One conditional transmitted ray is selected by two explicit finite endpoints, not by a native inverse solver.',
   'All crossing, ray-direction and apparent-axis coordinates are mathematical predictions, not native measurements.'
  ],
  limitations:[
   'A detector, real eye, field of view, point-spread function, image formation or source provenance is not simulated.',
   'Native PhyDemo is NOT run by this query; any optional native check requires a separately fully authored valid physical scene.',
   'The numerical grazing thresholds are conservative research admission rules, NOT physical critical angles or a universal forward-error guarantee.',
   'No throughput, Fresnel power, wave effects, polarization, diffraction or multi-interface composition is inferred.'
  ]};
}
function unstable(base,reasonCode,reason,diagnostics={}){
 return {...base,status:'numerically-unstable',reasonCode,reason,
  value:null,numericalDiagnostics:diagnostics};
}
export function observerPointCapabilities(){
 return {format:OBSERVER_QUERY_FORMAT,resultFormat:OBSERVER_RESULT_FORMAT,
  requiredFields:['format','kind','lengthUnit','source','observer','interface'],
  kind:'source-to-observer-transmission',
  unitOptions:Object.keys(SCALE),
  indexBounds:[1,4],worldBoundsMm:[-MAX_MM,MAX_MM],
  minimumNormalClearanceMm:MIN_CLEARANCE_MM,
  numericalPolicy:{maxLocalSnellResidual:ROOT_RESIDUAL_LIMIT,
   minIncomingAndOutgoingNormalCosine:MIN_NORMAL_COSINE,
   smallNonzeroAxialDisplacementMm:NEAR_AXIS_MM},
  statuses:['conditional','numerically-unstable'],
  axisInterceptStatuses:['conditional','not-identifiable'],
  native:'not-run',
  limits:coreResult().limitations};
}
export function analyzeObserverPointQuery(query){
 record(query,['format','kind','lengthUnit','source','observer','interface'],
   ['format','kind','lengthUnit','source','observer','interface'],'observer-point query');
 if(query.format!==OBSERVER_QUERY_FORMAT)throw Error('Unsupported observer-point query format');
 if(query.kind!=='source-to-observer-transmission')
  throw Error('Unknown observer-point query kind');
 if(!own(SCALE,query.lengthUnit))throw Error('Explicit lengthUnit must be mm, cm or m');
 const scale=SCALE[query.lengthUnit];
 const S=point(query.source,scale,'source');
 const O=point(query.observer,scale,'observer');
 record(query.interface,['x','y','normalDeg','sourceIndex','observerIndex'],
   ['x','y','normalDeg','sourceIndex','observerIndex'],'oriented plane');
 const P=point({x:query.interface.x,y:query.interface.y},scale,'plane point');
 const normalDeg=finite(query.interface.normalDeg,'normalDeg');
 if(normalDeg< -180||normalDeg>180)throw Error('Plane normalDeg must lie within [-180,180]');
 const ns=finite(query.interface.sourceIndex,'sourceIndex'),
  no=finite(query.interface.observerIndex,'observerIndex');
 if(ns<1||ns>4||no<1||no>4)
  throw Error('Both material indices must be explicitly finite in [1,4]');
 const n=interfaceNormal({normalDeg}),t={x:-n.y,y:n.x};
 const s=subtract(S,P),o=subtract(O,P);
 const ds=-dot(s,n),doo=dot(o,n);
 if(!allFinite(ds,doo)||ds<MIN_CLEARANCE_MM||doo<MIN_CLEARANCE_MM)
  throw Error('Source and observer must be at least 0.01 mm on explicitly opposite sides of the oriented plane');
 const us=dot(s,t),uo=dot(o,t),span=uo-us;
 if(!allFinite(us,uo,span))throw Error('The oriented tangent geometry is nonfinite');
 const base={...coreResult(),sourceIndex:ns,observerIndex:no,
  realDepthMm:ds,observerNormalDistanceMm:doo,
  sourceSide:'negative',observerSide:'positive',normalDeg};
 // Strictly monotone stationary optical length derivative in a single-plane
 // model; local offset v=q-u_s prevents bisection cancellation at y~9000mm.
 const residual=v=>ns*v/Math.hypot(ds,v)-no*(span-v)/Math.hypot(doo,span-v);
 let low=Math.min(0,span),high=Math.max(0,span),v=0;
 if(span!==0){
  for(let i=0;i<110;i++){
   const mid=low+(high-low)/2;
   if(mid===low||mid===high)break; // adjacent binary64 local values
   const difference=residual(mid);
   if(difference===0){low=mid;high=mid;break;}
   if(difference>0)high=mid;else low=mid;
  }
  v=low+(high-low)/2;
 }
 const localResidual=residual(v);
 if(!Number.isFinite(localResidual)||Math.abs(localResidual)>ROOT_RESIDUAL_LIMIT)
  return unstable(base,'LOCAL_ROOT_UNRESOLVED',
   'A stationary root exists in this ideal geometry, but it is not numerically qualified in the local frame.',
   {localSnellResidual:Number.isFinite(localResidual)?localResidual:null});
 const q=us+v,Q=add(P,times(t,q));
 const localIncoming=unitVector(n.x*ds+t.x*v,n.y*ds+t.y*v);
 const localOutgoing=unitVector(n.x*doo+t.x*(span-v),n.y*doo+t.y*(span-v));
 if(!localIncoming||!localOutgoing||!within(Q))
  return unstable(base,'UNREPRESENTABLE_CROSSING',
   'The conditional interface crossing or local direction is outside the supported representable domain.');
 // Reconstructed world crossing is not necessarily precise enough to encode
 // the local root. Check independently, never repair scene/native rays.
 const worldIncoming=unitVector(Q.x-S.x,Q.y-S.y);
 const worldOutgoing=unitVector(O.x-Q.x,O.y-Q.y);
 const worldResidual=worldIncoming&&worldOutgoing?
   ns*dot(worldIncoming,t)-no*dot(worldOutgoing,t):NaN;
 const diagnostics={localSnellResidual:localResidual,
   representedWorldSnellResidual:Number.isFinite(worldResidual)?worldResidual:null};
 if(!Number.isFinite(worldResidual)||Math.abs(worldResidual)>ROOT_RESIDUAL_LIMIT)
  return unstable(base,'WORLD_COORDINATE_ROUNDING',
   'A stationary local ray exists, but the represented world crossing cannot preserve its optical geometry.',
   diagnostics);
 const incomingCos=dot(localIncoming,n),outgoingCos=dot(localOutgoing,n);
 if(!Number.isFinite(incomingCos)||incomingCos<MIN_NORMAL_COSINE)
  return unstable(base,'NEAR_GRAZING_INGRESS',
   'Initial ray direction is too tangent for bounded numerical admission; the physical stationary path may exist.',
   {...diagnostics,incomingNormalCosine:incomingCos,cutoff:MIN_NORMAL_COSINE});
 if(!Number.isFinite(outgoingCos)||outgoingCos<MIN_NORMAL_COSINE)
  return unstable(base,'NEAR_GRAZING_EXIT',
   'Transmitted ray direction is too tangent for bounded numerical admission; the physical stationary path may exist.',
   {...diagnostics,outgoingNormalCosine:outgoingCos,cutoff:MIN_NORMAL_COSINE});
 const axial=span===0;
 if(!axial&&(Math.abs(v)<NEAR_AXIS_MM||Math.abs(span-v)<NEAR_AXIS_MM))
  return unstable(base,'NEAR_AXIAL_INFERENCE',
   'A very small but nonzero transverse displacement makes single-ray apparent-depth inference ill-conditioned.',
   {...diagnostics,smallNonzeroAxisMm:Math.min(Math.abs(v),Math.abs(span-v))});
 const headingDeg=Math.atan2(localIncoming.y,localIncoming.x)/RAD;
 const incidentAngleDeg=Math.atan2(dot(localIncoming,t),incomingCos)/RAD;
 const refractedAngleDeg=Math.atan2(dot(localOutgoing,t),outgoingCos)/RAD;
 const foot=add(P,times(t,us));
 const apparentDepth=axial?null:v*doo/(span-v);
 const apparentPoint=axial?null:subtract(foot,times(n,apparentDepth));
 const paraxialDepth=ds*no/ns;
 if(!allFinite(headingDeg,incidentAngleDeg,refractedAngleDeg,paraxialDepth)||
   !Number.isFinite(apparentDepth===null?0:apparentDepth)||
   (apparentPoint&&!within(apparentPoint)))
  return unstable(base,'UNREPRESENTABLE_AXIS_INTERCEPT',
    'The conditional ideal virtual-axis construction is outside the supported finite coordinate domain.',
    diagnostics);
 return {...base,status:'conditional',reasonCode:null,reason:null,
  numericalDiagnostics:{...diagnostics,incomingNormalCosine:incomingCos,
   outgoingNormalCosine:outgoingCos,cutoff:MIN_NORMAL_COSINE},
  value:{
   interfaceCrossingMm:Q,
   predictedInitialDirectionDeg:headingDeg,
   incidentAngleDeg,refractedAngleDeg,
   outgoingUnit:localOutgoing,
   sourceMm:S,observerMm:O,realDepthMm:ds,
   paraxialLimitMm:paraxialDepth,
   conditionalApparentDepthMm:apparentDepth,
   conditionalAxisInterceptMm:apparentPoint,
   axisInterceptStatus:axial?'not-identifiable':'conditional',
   apparentPointIsNativeHit:false,nativeImageDetected:false,
   crossingIsNativeHit:false,unit:'mm'
  }};
}
