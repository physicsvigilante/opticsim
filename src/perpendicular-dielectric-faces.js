import {asinAngle,CRITICAL_UNCERTAINTY} from './angular-math.js';
import {isRecord} from './qualified-utils.js';

export const TWO_FACE_FACTS='opticsim-perpendicular-dielectric-facts-v1';
export const TWO_FACE_QUERY='opticsim-perpendicular-dielectric-query-v1';
const grazing='grazing-entry-emergence-limit';
const acceptance='sidewall-tir-launch-limit';
const model='perpendicular-faces-meridional';
const idPattern=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
export function twoFaceCapabilities(){
  return {format:TWO_FACE_QUERY,factsFormat:TWO_FACE_FACTS,model,kinds:[grazing,acceptance],
    required:['model','entryFaceId','wallFaceId','materials'],
    materials:{'symbolic-common-exterior':'A symbolic core/exterior index ratio m>1.',
      'common-exterior':'Explicit numerical coreToExteriorRatio in (1,4].',
      'absolute-indices':'Explicit entranceIndex, coreIndex and wallExteriorIndex, each in [1,4].'},
    scope:'Homogeneous core, principal meridional angles to face normals, conditional on entry followed by an encounter with the named perpendicular wall.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(value,required,optional=[]){
  if(!isRecord(value)||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))
    fail('INVALID_TWO_FACE_FACTS','Expected a bounded object with only registered fields.');
  for(const key of required)if(!Object.hasOwn(value,key))fail('MISSING_FACTS','Missing '+key);
}
function index(value){
  if(!Number.isFinite(value)||value<1||value>4)fail('INVALID_TWO_FACE_FACTS','Indices must be finite numbers in [1,4].');
  return value;
}
function readMaterials(m){
  if(m?.basis==='symbolic-common-exterior'){
    fields(m,['basis']);
    return null;
  }
  if(m?.basis==='common-exterior'){
    fields(m,['basis','coreToExteriorRatio']);
    const ratio=index(m.coreToExteriorRatio);
    if(ratio<=1)fail('UNSUPPORTED_SCOPE','A denser core is required.');
    // Normalized index units throughout. No absolute outside index is inferred.
    return {entrance:1,core:ratio,wall:1};
  }
  if(!isRecord(m)||!Object.hasOwn(m,'basis'))fail('MISSING_FACTS','Explicit material basis required.');
  if(m.basis!=='absolute-indices')fail('INVALID_TWO_FACE_FACTS','Unknown material basis.');
  fields(m,['basis','entranceIndex','coreIndex','wallExteriorIndex']);
  const entrance=index(m.entranceIndex),core=index(m.coreIndex),wall=index(m.wallExteriorIndex);
  if(core<=wall||core<entrance)fail('UNSUPPORTED_SCOPE','Require coreIndex > wallExteriorIndex and coreIndex >= entranceIndex.');
  return {entrance,core,wall};
}
const symbolicGrazing=()=>({parameter:'m = nCore / nExterior > 1',
  criticalAngle:'alpha = asin(1/m)',emergenceRelation:'sin(theta) = sqrt(m^2 - 1) = cot(alpha)',
  upperRelativeIndex:'sqrt(2)',below:'transmission in the grazing-entry limit',
  equal:'grazing emergence in the limit',above:'total internal reflection in the limit'});
const symbolicLaunch=()=>({parameter:'m = nCore / nExterior > 1',limitSine:'sqrt(m^2 - 1)',
  strictTir:'0 < launch < 90 degrees and sin(launch) < sqrt(m^2 - 1)',
  equality:'Critical wall incidence at an interior equality. For m >= sqrt(2) every interior launch qualifies.'});
const indeterminate=()=>({status:'numerically-indeterminate',value:null,reasonCode:'UNRESOLVED_TWO_FACE_BOUNDARY',
  reason:'Numerical proximity to a material or angular boundary prevents a qualified branch decision.'});

// Perpendicular normals exchange the internal tangential and normal components.
// The factored difference preserves precision for close positive indices.
const complementaryComponent=(core,component)=>Math.sqrt((core-component)*(core+component));
function numerical(kind,{core,entrance,wall}){
  if(kind===grazing&&entrance!==wall)fail('UNSUPPORTED_SCOPE','This grazing-entry relation requires a common exterior index.');
  if((core-wall)/core<=CRITICAL_UNCERTAINTY)return indeterminate();
  const ratio=kind===grazing?complementaryComponent(core,entrance)/wall:complementaryComponent(core,wall)/entrance;
  if(Math.abs(ratio-1)<=CRITICAL_UNCERTAINTY){
    // The domain [1,4] makes every represented index an integer multiple of
    // 2^-52. Distinguish an exact Pythagorean equality from a rounded quotient.
    const square=n=>BigInt(n*2**52)**2n;
    if(kind===acceptance&&square(core)===square(wall)+square(entrance))
      return {status:'conditional',value:{launchSupremumDeg:90,allInteriorLaunches:true,
        strictTirInterval:'open from zero to launchSupremumDeg',upperBoundary:'wall critical only at excluded grazing-entry limit'}};
    return indeterminate();
  }
  if(kind===grazing)return {status:'conditional',value:{...symbolicGrazing(),
    limitingWallOutcome:ratio<1?'transmission':'total-internal-reflection',
    emergenceAngleDeg:ratio<1?asinAngle(ratio):null}};
  return {status:'conditional',value:{launchSupremumDeg:ratio<1?asinAngle(ratio):90,
    allInteriorLaunches:ratio>1,strictTirInterval:'open from zero to launchSupremumDeg',
    upperBoundary:ratio<1?'critical wall incidence':'grazing entry excluded'}};
}
export function analyzeTwoFaceQuery(facts,query){
  fields(query,['format','kind']);
  if(query.format!==TWO_FACE_QUERY||![grazing,acceptance].includes(query.kind))fail('UNSUPPORTED_QUERY','Unknown two-face query.');
  if(facts?.format!==TWO_FACE_FACTS)fail('UNSUPPORTED_FACTS','Explicit perpendicular-face facts required.');
  fields(facts,['format','model','entryFaceId','wallFaceId','materials']);
  if(facts.model!==model)fail('UNSUPPORTED_MODEL','Require the perpendicular meridional model.');
  if(![facts.entryFaceId,facts.wallFaceId].every(id=>typeof id==='string'&&idPattern.test(id))||facts.entryFaceId===facts.wallFaceId)
    fail('INVALID_TWO_FACE_FACTS','Require two distinct stable face IDs.');
  const indices=readMaterials(facts.materials);
  const result=indices?numerical(query.kind,indices):{status:'conditional',value:query.kind===grazing?symbolicGrazing():symbolicLaunch()};
  return {format:'opticsim-perpendicular-dielectric-result-v1',kind:query.kind,method:'conditional-analytical',
    entryFaceId:facts.entryFaceId,wallFaceId:facts.wallFaceId,native:{status:'not-run',observations:null},nativePathVerified:false,
    assumptions:['Homogeneous isotropic media. Principal meridional angles measured from the respective normals. The incident plane contains both normals.'],
    limitations:['Finite face reach is conditional. Axial rays do not strike the wall. Exact grazing and critical equality supply limiting conditions only.'],...result};
}
