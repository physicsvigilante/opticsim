// Presentation only. Conditional coordinates are not native image detections.
import {PRISM_TYPE,prismVertices} from './triangular-prism.js';
import {POLYGON_TYPE,polygonVertices} from './polygon-dielectric.js';
import {SPHERICAL_LENS_TYPE,thickLensExtents} from './spherical-lens.js';
import {GRIN_V25_TYPE,grinV25Extents} from './native-grin-v25.js';
import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';
import {SEMICIRCULAR_TYPE,semicircularExtents} from './semicircular-dielectric.js';
import {CIRCLE_BLOCKER_TYPE,circleBlockerExtents} from './opaque-circle-blocker.js';
import {isCurved,curvedPoints} from './curved-mirrors.js';
import {validate,mirrorEndpoints} from './contract.js';
import {sceneHash} from './qualified-utils.js';
// Presentation limits match the existing canonical validator; the fitted document
// is validated below. These do not expand its accepted camera range.
const CAMERA_BOUNDS={centerMm:[-10000,10000],zoom:[0.03,10]};
const finite=Number.isFinite;
const number=n=>finite(n)?Number(n.toPrecision(8)).toString():'unavailable';
export function formatRequestedResult(r){
  const label=r.kind==='finite-hit-numerical-diagnostic'?'ADVISORY ONLY — NOT A VERIFIED OPTICAL MEASUREMENT':
    ['native-observation','native-hit-event-observation','native-observed-object-parentage'].includes(r.method)?'Native sampled observation':
    r.status==='conditional'?'Conditional analytical prediction':'No current value';
  let value=r.reason||'';
  if(r.value!==null&&r.value!==undefined){
    if(r.kind==='ideal-image'){
      const p=r.value,kind=p.imageKind||p.kind;
      value=kind==='at-infinity'?'Image at infinity; no finite position or transverse magnification.':
        `Global image position: x = ${number(p.x)} mm; y = ${number(p.y)} mm.\n`+
        (finite(p.magnification)?`Magnification: ${number(p.magnification)} (dimensionless).\n`:'')+
        `Image type: ${kind}. Not a native image detection.`;
    }else if(r.kind==='finite-hit-numerical-diagnostic'){
      const q=r.value;
      value='Noncertifying native finite-hit advisory: '+q.status+
        '; reason '+q.reasonCode+'.\nActual sampled Glass callbacks: '+q.observedGlassIncidents+
        '; audited: '+q.analyzedGlassIncidents+
        '; exact matches: '+q.checked+
        '; contradictions: '+q.conflicting+
        '; unknown: '+q.unknown+'.\n'+
        (q.status==='inconsistent'?
          'NUMERICAL CAUTION: reported native geometry contradicts the recorded represented finite ray/edge. '+
          'Existing native measurements are NOT independently certified by this advisory.':
          q.status==='unknown'?'NUMERICAL UNCERTAINTY: diagnostic coverage, point agreement or native conditions are unproven; existing measurements are NOT independently certified.':
            'A bounded necessary check passed. This does NOT certify optical correctness or complete ray history.');
    }else if(r.kind==='interface-face-events'){
      value=Object.entries(r.value).map(([id,f])=>id+': '+f.interactions+' native hits; '+(f.first?
        f.first.from+' → '+f.first.outcome+'; incidence '+number(f.first.incidentAngleDeg)+'°; transmission '+number(f.first.transmittedAngleDeg)+'°; '+
        f.first.branches.map(b=>b.kind+' heading '+number(Math.atan2(b.direction.y,b.direction.x)*180/Math.PI)+'°').join(', '):'no encounter')).join('\n');
    }else if(r.kind==='detector-hit-events'){
      value=!r.value.length?'No sampled detector hits.':r.value.map((e,i)=>
        `Hit ${i+1} (native callback order): x=${number(e.pointMm.x)}, y=${number(e.pointMm.y)} mm; `+
        `distance from detector p1=${number(e.distanceFromP1Mm)} mm; `+
        `incoming direction=(${number(e.incomingUnit.x)}, ${number(e.incomingUnit.y)}).`).join('\n');
    }else if(r.kind==='detector-ray-provenance'){
      value=!r.value.crossings.length?'No sampled detector crossings with a complete observed source ledger.':
        'Native crossing identities: '+r.value.crossings.map((crossing,i)=>{
          const node=r.value.nodes.find(n=>n.token===crossing.rayToken);
          return 'Hit '+(i+1)+': '+crossing.rayToken+' from authored source '+(node?.sourceId??'unknown');
        }).join('; ')+'.\n'+
        'Direct observed spawn relationships: '+(r.value.nodes.filter(n=>n.parentToken!==null)
          .map(n=>n.parentToken+' → '+n.token+' at '+n.spawnComponentId).join('; ')||'none observed');
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
    if(c.type===SEMICIRCULAR_TYPE)return semicircularExtents(p);
    if(c.type===SPHERICAL_LENS_TYPE)return thickLensExtents(p);
    if(c.type===GRIN_V25_TYPE)return grinV25Extents(p);
    if(c.type===CIRCLE_BLOCKER_TYPE)return circleBlockerExtents(p);
    if(isCurved(c.type))return curvedPoints(c);
    if(c.type==='ideal-lens')return [{x:p.x,y:(p.y??0)-p.apertureHeight/2},{x:p.x,y:(p.y??0)+p.apertureHeight/2}];
    if(c.type==='plane-mirror'||c.type==='ray-detector'||c.type==='line-blocker'||c.type==='finite-aperture')return mirrorEndpoints(p);
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
