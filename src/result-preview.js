// Presentation only. Conditional coordinates are not native image detections.
import {PRISM_TYPE,prismVertices} from './triangular-prism.js';
import {POLYGON_TYPE,polygonVertices} from './polygon-glass.js';
import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';
import {isCurved,curvedPoints} from './curved-mirrors.js';
import {validate,mirrorEndpoints} from './contract.js';
import {sceneHash} from './qualified-utils.js';
// Presentation limits match the existing canonical validator; the fitted document
// is validated below. These do not expand its accepted camera range.
const CAMERA_BOUNDS={centerMm:[-10000,10000],zoom:[0.03,10]};
const finite=Number.isFinite;
const number=n=>finite(n)?Number(n.toPrecision(8)).toString():'unavailable';
export function formatRequestedResult(r){
  const label=r.method==='native-observation'?'Native sampled observation':
    r.status==='conditional'?'Conditional analytical prediction':'No current value';
  let value=r.reason||'';
  if(r.value!==null&&r.value!==undefined){
    if(r.kind==='ideal-image'){
      const p=r.value,kind=p.imageKind||p.kind;
      value=kind==='at-infinity'?'Image at infinity; no finite position or transverse magnification.':
        `Global image position: x = ${number(p.x)} mm; y = ${number(p.y)} mm.\n`+
        (finite(p.magnification)?`Magnification: ${number(p.magnification)} (dimensionless).\n`:'')+
        `Image type: ${kind}. Not a native image detection.`;
    }else if(r.kind==='interface-face-events'){
      value=Object.entries(r.value).map(([id,f])=>id+': '+f.interactions+' native hits; '+(f.first?
        f.first.from+' → '+f.first.outcome+'; incidence '+number(f.first.incidentAngleDeg)+'°; transmission '+number(f.first.transmittedAngleDeg)+'°; '+
        f.first.branches.map(b=>b.kind+' heading '+number(Math.atan2(b.direction.y,b.direction.x)*180/Math.PI)+'°').join(', '):'no encounter')).join('\n');
    }else if(r.kind==='interface-first-event'){
      const p=r.value;value=`First native encounter: ${p.outcome}. ${p.from} side, index ${number(p.incidentIndex)} → ${number(p.destinationIndex)}.\n`+
        `Incidence: ${number(p.incidentAngleDeg)}°; transmission: ${number(p.transmittedAngleDeg)}°; reflection: ${number(p.reflectedAngleDeg)}°.\n`+
        `Recorded outgoing branches: ${p.branches.map(b=>b.kind+' ('+number(b.relativePower)+' relative power)').join(', ')||'none'}.`;
    }else value=`${number(r.value)} ${r.unit||''}`;
  }
  return `${r.id} — ${r.status}; ${r.method||'no method'}\n${label}\n${value}`+
    (r.assumptions?.length?'\nConditions: '+r.assumptions.join(' '):'')+
    (r.limitation?'\nLimit: '+r.limitation:'')+
    (r.warnings?.length?'\nWarnings: '+r.warnings.join(' '):'');
}
export function apparatusPoints(doc){
  validate(doc);
  return doc.physics.components.flatMap(c=>{
    const p=c.parameters;
    if(c.type===PRISM_TYPE)return prismVertices(p);
    if(c.type===POLYGON_TYPE)return polygonVertices(p);
    if(c.type===CIRCULAR_TYPE)return circularExtents(p);
    if(isCurved(c.type))return curvedPoints(c);
    if(c.type==='ideal-lens')return [{x:p.x,y:-p.apertureHeight/2},{x:p.x,y:p.apertureHeight/2}];
    if(c.type==='plane-mirror'||c.type==='ray-detector')return mirrorEndpoints(p);
    return [{x:p.x,y:p.y}];
  });
}
function cameraFor(points,width,height,padding){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const clamp=(x,[lo,hi])=>Math.max(lo,Math.min(hi,x));
  const view={x:clamp((minX+maxX)/2,CAMERA_BOUNDS.centerMm),
    y:clamp((minY+maxY)/2,CAMERA_BOUNDS.centerMm),
    zoom:clamp(Math.min(2,(width-2*padding)/Math.max(1,maxX-minX),
      (height-2*padding)/Math.max(1,maxY-minY)),CAMERA_BOUNDS.zoom)};
  const fits=points.every(p=>Math.abs((p.x-view.x)*view.zoom)<=width/2-padding+1e-7&&
    Math.abs((p.y-view.y)*view.zoom)<=height/2-padding+1e-7);
  return {view,fits};
}
export async function fitRequestedView(doc,resultReport,width,height){
  validate(doc);
  if(!finite(width)||!finite(height)||width<100||height<100)throw Error('Viewport must be at least 100 by 100 pixels');
  const padding=Math.min(48,width*.12,height*.12),points=apparatusPoints(doc),included=[],excluded=[];
  const fresh=resultReport?.canonicalSha256===await sceneHash(doc);
  for(const r of resultReport?.results||[]){
    if(r.kind!=='ideal-image')continue;
    if(!fresh||r.status!=='conditional'){
      excluded.push({id:r.id,reason:!fresh?'stale result':r.reason||r.status});continue;
    }
    const p=r.value;
    if(!p||!finite(p.x)||!finite(p.y)){
      excluded.push({id:r.id,reason:'infinite or unavailable position; no finite coordinate invented'});continue;
    }
    const candidate=[...points,{x:p.x,y:p.y}];
    if(!cameraFor(candidate,width,height,padding).fits){
      excluded.push({id:r.id,reason:'cannot fit within camera bounds at this viewport size'});continue;
    }
    points.push({x:p.x,y:p.y});included.push(r.id);
  }
  const fitted=cameraFor(points,width,height,padding);
  const next=structuredClone(doc);next.presentation.view=fitted.view;validate(next);
  return {document:next,padding,included,excluded,apparatusFits:fitted.fits,
    note:`Fit includes apparatus and ${included.length} finite conditional result(s). No physics or sampling changed.`+
      (!fitted.fits?' Apparatus exceeds the available camera/viewport bounds.':'')+
      (excluded.length?' Not included: '+excluded.map(x=>x.id+' ('+x.reason+')').join('; '):'')};
}
