import {compositionCountsMatch} from './composition-profiles.js';
import {curvedPoints} from './curved-mirrors.js';
import {installAxialFanAudit,nativeFanOffsets} from './axial-native-fan-audit.js';

export const IMMERSED_ARC_VERSION=34;
export const IMMERSED_ARC_MODEL='native-immersed-arc-plane-port';
const inWorld=({x,y})=>[x,y].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000);
function parts(components){
  return {
    source:components.find(c=>c.type==='point-source'),
    face:components.find(c=>c.type==='planar-interface'),
    mirror:components.find(c=>c.type==='circular-arc-mirror'),
    detector:components.find(c=>c.type==='ray-detector')
  };
}
export function validateImmersedArcPort(components,density,fail){
  const reject=message=>fail('$.physics.components',message,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,IMMERSED_ARC_MODEL,IMMERSED_ARC_VERSION))
    reject('Require one planar face, one immersed concave mirror, one directional source and one exterior detector.');
  const {source,face,mirror,detector}=parts(components);
  const s=source.parameters,f=face.parameters,m=mirror.parameters,d=detector.parameters;
  if(f.normalDeg!==0||f.partialReflection!==false||f.positiveIndex<=f.negativeIndex||
    f.positiveIndex/f.negativeIndex>1.6)
    reject('Use the denser half-space on the right, a positive x interface normal and partial reflection disabled.');
  if(m.radius<50||m.radius>250||m.apertureHeight<30||m.apertureHeight>100||
    m.apertureHeight>m.radius||Math.abs(m.normalDeg)!==180||m.x-f.x>300||!curvedPoints(mirror).every(inWorld))
    reject('Use a finite left-facing concave spherical patch with radius 50–250 mm, a width up to its radius and a pole within 300 mm of the plane.');
  const leftmost=Math.min(...curvedPoints(mirror).map(point=>point.x));
  if(s.x-f.x<1||leftmost-s.x<1||s.y!==m.y||
    source.emission.mode!=='directional'||![0,180,-180].includes(source.emission.directionDeg)||
    source.emission.angleDeg<1.5||source.emission.angleDeg>2||
    !Number.isFinite(density)||density<.95||density>1||s.brightness>density||
    nativeFanOffsets(source.emission.angleDeg,density).length<2)
    reject('Use an axial directional source between the plane and the whole mirror, with 1 mm gaps, a 1.5–2 degree cone, and unsaturated density 0.95–1.');
  if(Math.abs(d.orientationDeg)!==90||d.y!==m.y||f.x-d.x<1||f.x-d.x>100||
    d.length<30||d.length>100||![{x:d.x,y:d.y-d.length/2},{x:d.x,y:d.y+d.length/2}].every(inWorld))
    reject('Use a vertical detector centred on the axis, 1–100 mm outside the plane and 30–100 mm long.');
}
export function immersedArcPortAudit(doc,scene,idMap){
  const {source,face,mirror,detector}=parts(doc.physics.components);
  return installAxialFanAudit({doc,scene,idMap,source,mirror,detector,faces:[face],
    sequence:source.emission.directionDeg===0?[mirror,face,detector]:[face,detector],
    key:'v34ImmersedArcVerified',label:'Incomplete native immersed mirror and port evidence'});
}
