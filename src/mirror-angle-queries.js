// Bounded plane-mirror angular relations, separate from finite native tracing.
// Mirror tangent angles are specified by unsigned consecutive inclinations;
// the first tangent is the angular coordinate gauge (0°), not authored geometry.
// Every sign and outgoing parallel direction is enumerated: none is guessed.
export const MIRROR_FACTS_FORMAT='opticsim-plane-mirror-angular-facts-v1';
export const MIRROR_QUERY_FORMAT='opticsim-plane-mirror-angular-query-v1';
export const MIRROR_RESULT_FORMAT='opticsim-plane-mirror-angular-result-v1';
const eps=1e-9;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=message=>{throw Error(message);};
function exactObject(x,fields,required,where){
  if(!object(x)||Object.keys(x).some(k=>!fields.includes(k))||required.some(k=>!own(x,k)))
    fail('Invalid '+where+' fields');
}
function id(s){if(typeof s!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(s))fail('Expected a stable mirror ID');}
function boundedFinite(v,min,max,name){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(name+' must be finite in ['+min+', '+max+']');}
const wrap360=deg=>((deg%360)+360)%360;
const fold180=deg=>{const v=wrap360(deg)%180;return v<=90?v:180-v;};
// The ray heading is a directed vector; the line's tangent is not. Incidence
// is unsigned from the normal, matching the standard optics convention.
const incidenceFromNormal=(heading,tangent)=>90-fold180(heading-tangent);
function reflectHeading(heading,tangent){return wrap360(2*tangent-heading);}
function near(a,b){return Math.abs(a-b)<eps;}
export function mirrorAngularCapabilities(){
  return {format:MIRROR_QUERY_FORMAT,factsFormat:MIRROR_FACTS_FORMAT,
    kinds:['mirror-incidence-from-output-direction'],
    requiredFacts:['mirrorIds','consecutiveInclinationsDeg'],
    requiredQuery:['referenceMirrorId','outgoingRelation','angleConvention'],
    scope:'2–4 consecutive infinite ideal two-sided plane mirror reflection interactions in stated order, with unsigned 0–90 degree line inclinations',
    policy:'Do not invent absolute mirror orientation, coordinates, source position, power, incident ray side, output direction sign, or finite-ray interception. Enumerate allowed signs and distinguish unique, multiple, grazing or unavailable solutions.',
    physicalLimitations:['Conditional on the ray actually striking the mirrors in the stated order.',
      'The angle between undirected mirror lines is unsigned; its signed orientation is not silently assumed.',
      'A matching angular solution does not certify finite-mirror visibility, ray provenance or a native trace.']};
}
export function analyzePlaneMirrorAngleQuery(facts,query){
  exactObject(facts,['format','mirrorIds','consecutiveInclinationsDeg'],
    ['format','mirrorIds','consecutiveInclinationsDeg'],'plane-mirror facts');
  if(facts.format!==MIRROR_FACTS_FORMAT)fail('Unsupported plane-mirror facts format');
  if(!Array.isArray(facts.mirrorIds)||facts.mirrorIds.length<2||facts.mirrorIds.length>4)
    fail('Expected 2–4 ordered plane-mirror IDs');
  const seen=new Set();
  for(const item of facts.mirrorIds){id(item);if(seen.has(item))fail('Duplicate plane mirror ID');seen.add(item);}
  if(!Array.isArray(facts.consecutiveInclinationsDeg)||
    facts.consecutiveInclinationsDeg.length!==facts.mirrorIds.length-1)
    fail('Expected one unsigned inclination for each consecutive mirror pair');
  for(const value of facts.consecutiveInclinationsDeg)
    boundedFinite(value,0,90,'Consecutive mirror inclination');
  exactObject(query,['format','kind','referenceMirrorId','outgoingRelation','angleConvention'],
    ['format','kind','referenceMirrorId','outgoingRelation','angleConvention'],'mirror angular query');
  if(query.format!==MIRROR_QUERY_FORMAT||query.kind!=='mirror-incidence-from-output-direction')
    fail('Unsupported mirror angular query kind or format');
  id(query.referenceMirrorId);
  const reference=facts.mirrorIds.indexOf(query.referenceMirrorId);
  if(reference<0)fail('Unknown reference mirror ID');
  if(!['parallel','perpendicular'].includes(query.outgoingRelation))fail('Unsupported outgoing line condition');
  if(query.angleConvention!=='from-normal')fail('Angle of incidence must be explicitly measured from mirror normal');
  const configurations=[];
  const walk=(tangents,signs,index)=>{
    if(index===facts.consecutiveInclinationsDeg.length){configurations.push({tangents,signs});return;}
    const inclination=facts.consecutiveInclinationsDeg[index];
    for(const sign of (inclination===0||inclination===90?[1]:[1,-1]))
      walk([...tangents,tangents.at(-1)+sign*inclination],[...signs,sign],index+1);
  };
  walk([0],[],0);
  const options=[],grazing=[];
  for(const c of configurations){
    // A line-condition has two directed outgoing headings. Preserve them
    // separately even if both lead to the same normal-incidence angle.
    for(const parallelRayOrientationDeg of [0,180]){
      const shift=query.outgoingRelation==='parallel'?0:90;
      const output=wrap360(c.tangents[reference]+shift+parallelRayOrientationDeg);
      let heading=output;
      const reverseSteps=[];
      for(let k=c.tangents.length-1;k>=0;k--){
        const outgoing=heading;
        heading=reflectHeading(outgoing,c.tangents[k]);
        reverseSteps.push({mirrorId:facts.mirrorIds[k],incidentHeadingDeg:heading,
          outgoingHeadingDeg:outgoing,incidenceFromNormalDeg:incidenceFromNormal(heading,c.tangents[k])});
      }
      const steps=reverseSteps.reverse();
      const graze=steps.some(s=>s.incidenceFromNormalDeg>=90-eps);
      const entry={mirrorOrientationsRelativeDeg:c.tangents.map(wrap360),
        inclinationSigns:c.signs,inputHeadingRelativeDeg:heading,
        outgoingHeadingRelativeDeg:output,steps,
        firstIncidenceFromNormalDeg:steps[0].incidenceFromNormalDeg,
        firstIncidenceFromSurfaceDeg:90-steps[0].incidenceFromNormalDeg,
        finiteMirrorHitsVerified:false};
      if(graze)grazing.push({...entry,reasonCode:'GRAZING_MIRROR_INTERACTION'});
      else options.push(entry);
    }
  }
  const sorted=options.map(o=>o.firstIncidenceFromNormalDeg).sort((a,b)=>a-b),unique=[];
  for(const x of sorted)if(!unique.some(v=>near(v,x)))unique.push(x);
  const status=!unique.length?'unavailable':unique.length===1?'conditional':'multiple-solutions';
  return {format:MIRROR_RESULT_FORMAT,kind:query.kind,status,
    method:'conditional-analytical-specular-reflections',
    value:status==='conditional'?{incidenceAngleDeg:unique[0],
      complementarySurfaceAngleDeg:90-unique[0],unit:'degrees',
      convention:'unsigned incoming incidence from first mirror normal'}:null,
    candidateIncidenceAnglesDeg:unique,
    enumeratedCases:options,
    discardedGrazingCases:grazing,
    orientationConfigurations:configurations.length,
    assumptions:['Ideal two-sided specular plane mirrors and the stated sequential reflection order.',
      'Consecutive inclinations are unsigned angles between mirror lines; all consistent orientation signs and both output directions are considered.',
      'No finite source/surface positions were supplied, so actual interception/order is not established.'],
    native:{status:'not-run',observations:null},
    interpretiveStatus:'author-interpretation-not-independently-assessed',
    reasonCode:status==='unavailable'?'NO_NONGRAZING_SOLUTION':status==='multiple-solutions'?'AMBIGUOUS_INCIDENCE':null,
    limitations:'Angular reflection relation only; no native ray, source, finite-mirror hit, detector or signed output direction is asserted.'};
}
