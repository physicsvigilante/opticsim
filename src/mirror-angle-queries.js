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

export const MIRROR_HEADING_FACTS='opticsim-plane-mirror-heading-facts-v1';
export const MIRROR_LINE_RELATION_FACTS='opticsim-two-mirror-line-relation-facts-v1';
export const MIRROR_HEADING_QUERY='opticsim-plane-mirror-heading-inverse-query-v1';
const headingsKind='mirror-incidence-from-headings';
const linesKind='two-mirror-inclination-and-deviation';
const turnDeg=(a,b)=>wrap360(b-a+180)-180;
export function mirrorHeadingCapabilities(){
  return {format:MIRROR_HEADING_QUERY,kinds:[headingsKind,linesKind],
    facts:{[headingsKind]:MIRROR_HEADING_FACTS,[linesKind]:MIRROR_LINE_RELATION_FACTS},
    angleConvention:'Degrees, counterclockwise in y-up. Incidence from the normal. Net deviation is the shortest directed heading change.',
    scope:'One plane mirror with explicit incoming and outgoing directions, or two nonparallel plane mirrors with crossed endpoint line constraints.'};
}

function unitDirection(v){
  exactObject(v,['x','y'],['x','y'],'direction');
  for(const a of [v.x,v.y])boundedFinite(a,-1e9,1e9,'Direction component');
  const norm=Math.hypot(v.x,v.y);
  if(norm<1e-9)fail('Direction must have a norm of at least 1e-9');
  return {x:v.x/norm,y:v.y/norm};
}
function fromHeadings(facts){
  exactObject(facts,['format','mirrorId','incoming','outgoing'],['format','mirrorId','incoming','outgoing'],'plane-mirror heading facts');
  if(facts.format!==MIRROR_HEADING_FACTS)fail('Expected single-plane-mirror heading facts');
  id(facts.mirrorId);
  const a=unitDirection(facts.incoming), b=unitDirection(facts.outgoing);
  const dx=b.x-a.x,dy=b.y-a.y,change=Math.hypot(dx,dy);
  if(change<=eps)return {status:'numerically-indeterminate',value:null,reasonCode:'DIRECTIONS_UNRESOLVED_AT_GRAZING'};
  const turn=Math.atan2(Math.abs(a.x*b.y-a.y*b.x),a.x*b.x+a.y*b.y)*180/Math.PI;
  return {status:'conditional',reasonCode:null,value:{mirrorId:facts.mirrorId,
    incidenceAngleDeg:(180-turn)/2,principalDeviationMagnitudeDeg:turn,
    normalLineDirection:{x:dx/change,y:dy/change}}};
}
function crossedLineRelations(facts){
  const keys=['format','mirrorIds','incomingToSecond','outgoingToFirst'];
  exactObject(facts,keys,keys,'two-mirror line relation facts');
  if(facts.format!==MIRROR_LINE_RELATION_FACTS)fail('Expected crossed two-mirror line relations');
  if(!Array.isArray(facts.mirrorIds)||facts.mirrorIds.length!==2||facts.mirrorIds[0]===facts.mirrorIds[1])
    fail('Supply two distinct mirror IDs in reflection order');
  for(const mirror of facts.mirrorIds)id(mirror);
  const relations={parallel:0,perpendicular:90};
  const [p,q]=[facts.incomingToSecond,facts.outgoingToFirst].map(r=>{
    if(typeof r!=='string'||!own(relations,r))fail('Use parallel or perpendicular endpoint line relations');
    return relations[r];
  });
  const candidates=[];
  // With the first tangent at zero, beta_in = theta + p (mod 180).
  // Two reflections give beta_out = 3 theta + p (mod 180).
  // Keep one representative per nonparallel line in (-90, 90].
  for(const k of [-1,0,1,2]){
    const theta=(q-p+180*k)/3;
    if(theta<=-90||theta>90||theta===0)continue;
    for(const offset of [0,180]){
      const input=wrap360(theta+p+offset);
      const intermediate=reflectHeading(input,0);
      const output=reflectHeading(intermediate,theta);
      const incidence=[incidenceFromNormal(input,0),incidenceFromNormal(intermediate,theta)];
      if(incidence.includes(90))continue;
      const turns=[turnDeg(input,intermediate),turnDeg(intermediate,output)];
      candidates.push({secondTangentRelativeDeg:theta,headingSequenceDeg:[input,intermediate,output],
        incidenceFromNormalDeg:incidence,signedTurnsDeg:turns,
        signedPrincipalDeviationDeg:turnDeg(input,output)});
    }
  }
  if(candidates.length===0)return {status:'unavailable',value:null,reasonCode:'NO_NONGRAZING_SOLUTION'};
  const [first]=candidates;
  return {status:'conditional',reasonCode:null,value:{mirrorIds:[...facts.mirrorIds],
    angleBetweenMirrorsDeg:Math.abs(first.secondTangentRelativeDeg),
    principalDeviationMagnitudeDeg:Math.abs(first.signedPrincipalDeviationDeg),
    sumOfTurnMagnitudesDeg:first.signedTurnsDeg.reduce((sum,angle)=>sum+Math.abs(angle),0),
    candidates}};
}
export function analyzeMirrorHeadingInverse(facts,query){
  exactObject(query,['format','kind'],['format','kind'],'mirror heading inverse query');
  if(query.format!==MIRROR_HEADING_QUERY||![headingsKind,linesKind].includes(query.kind))
    fail('Unsupported mirror heading inverse query');
  const result=query.kind===headingsKind?fromHeadings(facts):crossedLineRelations(facts);
  return {format:'opticsim-plane-mirror-heading-inverse-result-v1',kind:query.kind,
    method:'conditional-analytical-specular-reflections',...result,native:{status:'not-run'},
    assumptions:['Ideal 2D specular two-sided plane mirrors and the stated reflection order.'],
    limitations:['The angular facts leave physical extent, location and interception unresolved.']};
}
