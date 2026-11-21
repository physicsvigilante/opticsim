import {compositionCountsMatch} from './composition-profiles.js';
import {curvedPoints} from './curved-mirrors.js';
import {installAxialFanAudit,nativeFanOffsets} from './axial-native-fan-audit.js';

export const SLAB_ARC_MODEL='native-fan-slab-arc-return-tracing';
const version=31;
const world=p=>[p.x,p.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000);
function arrangement(components){
  const source=components.find(c=>c.type==='point-source');
  const mirror=components.find(c=>c.type==='circular-arc-mirror');
  const detector=components.find(c=>c.type==='ray-detector');
  const faces=components.filter(c=>c.type==='planar-interface').sort((a,b)=>a.parameters.x-b.parameters.x);
  return {source,mirror,detector,faces};
}
export function validateSlabArcReturn(components,density,fail){
  const reject=message=>fail('$.physics.components',message,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,SLAB_ARC_MODEL,version))
    reject('Require a directional source, two plane interfaces, a circular arc mirror and a passive detector.');
  const {source,mirror,detector,faces}=arrangement(components);
  const s=source.parameters,m=mirror.parameters,d=detector.parameters;
  const [front,rear]=faces.map(c=>c.parameters);
  if(faces.some(({parameters:p})=>p.normalDeg!==0||p.partialReflection!==false)||
    front.positiveIndex!==rear.negativeIndex||front.negativeIndex!==rear.positiveIndex||
    !(front.positiveIndex>front.negativeIndex&&front.positiveIndex/front.negativeIndex<=1.6))
    reject('Use parallel rightward normals, one denser matched slab interior, one common exterior and partial reflection disabled.');
  if(m.radius<100||m.radius>400||m.apertureHeight<40||m.apertureHeight>100||
    Math.abs(m.normalDeg)!==180||!curvedPoints(mirror).every(world))
    reject('Use a left-facing concave arc with radius 100–400 mm and aperture 40–100 mm.');
  if(Math.abs(d.orientationDeg)!==90||d.y!==m.y||d.length<40||d.length>200||
    !world({x:d.x,y:d.y-d.length/2})||!world({x:d.x,y:d.y+d.length/2}))
    reject('Use a vertical detector centred on the mirror axis with length 40–200 mm.');
  const arcStart=Math.min(...curvedPoints(mirror).map(p=>p.x));
  if(front.x-s.x<1||rear.x-front.x<1||d.x-rear.x<1||arcStart-d.x<1||
    m.x-s.x>450||Math.abs(s.y-m.y)>5)
    reject('Use separated source, front face, rear face, detector and mirror in that order, with at least 1 mm between them.');
  if(source.emission.mode!=='directional'||source.emission.directionDeg!==0||
    source.emission.angleDeg<1.5||source.emission.angleDeg>2||!Number.isFinite(density)||density<.95||density>1||
    s.brightness>density||nativeFanOffsets(source.emission.angleDeg,density).length<2)
    reject('Use a rightward directional cone of 1.5–2 degrees, density 0.95–1 and unsaturated brightness.');
}

export function slabArcReturnAudit(doc,scene,idMap){
  const {source,mirror,detector,faces}=arrangement(doc.physics.components);
  const [front,rear]=faces;
  return installAxialFanAudit({doc,scene,idMap,source,mirror,detector,faces,
    sequence:[front,rear,detector,mirror,detector,rear,front],key:'v31SlabArcVerified',
    label:'Incomplete slab and curved mirror callback evidence'});
}
