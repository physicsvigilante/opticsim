// Presentation-only camera fit. No optical/source/numerical settings are changed.
import {curvedPoints,isCurved} from './curved-mirrors.js';
export const MOTION_VIEW_LIMITS=Object.freeze({minZoom:0.03,maxZoom:10,maxCenter:10000,maxImageCoordinate:10000});
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const fitImage=p=>finitePoint(p)&&Math.max(Math.abs(p.x),Math.abs(p.y))<=MOTION_VIEW_LIMITS.maxImageCoordinate;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function collectMotionView(model){
  if(!model?.baseline?.scene||!Array.isArray(model.times)||model.times.length>241)throw Error('A bounded accepted motion experiment is required');
  const optics=[];
  for(const c of model.baseline.scene.physics.components){
    const p=c.parameters;
    if(c.type==='ideal-lens')optics.push({x:p.x,y:-p.apertureHeight/2},{x:p.x,y:p.apertureHeight/2});
    else if(isCurved(c.type))optics.push(...curvedPoints(c));
    else if(c.type==='ray-detector'||c.type==='plane-mirror'){
      const a=p.orientationDeg*Math.PI/180,h=p.length/2;
      optics.push({x:p.x-h*Math.cos(a),y:p.y-h*Math.sin(a)},
        {x:p.x+h*Math.cos(a),y:p.y+h*Math.sin(a)});
    }
  }
  const objects=[],images=[];let omittedImages=0,nonfiniteImages=0;
  // The range is fixed for the complete sampled experiment. Native ray tracing
  // is not run during fitting, and frame data/caller input is never modified.
  for(let i=0;i<model.times.length;i++){
    const f=model.frame(i);
    if(finitePoint(f.object?.positionMm))objects.push({...f.object.positionMm});
    const p=f.analysis?.globalImageMm;
    if(fitImage(p))images.push({...p});
    else if(finitePoint(p))omittedImages++;
    else nonfiniteImages++;
  }
  return {optics,objects,images,omittedImages,nonfiniteImages};
}

export function fitMotionView(subjects,width,height,{mode='motion',frame=null}={}){
  if(!['motion','frame','apparatus'].includes(mode))throw Error('Unknown camera mode');
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<80||height<80)throw Error('Viewport too small to fit');
  const currentObject=frame?.object?.positionMm,currentImage=frame?.analysis?.globalImageMm;
  const objects=mode==='frame'&&finitePoint(currentObject)?[currentObject]:subjects.objects;
  const images=mode==='apparatus'?[]:mode==='frame'?(fitImage(currentImage)?[currentImage]:[]):subjects.images;
  const points=[...subjects.optics,...objects,...images].filter(finitePoint);
  if(!points.length)throw Error('No finite camera targets');
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  const padding={x:Math.min(64,Math.max(28,width*.09)),y:Math.min(55,Math.max(28,height*.13))};
  const requested=Math.min((width-2*padding.x)/Math.max(1,maxX-minX),
    (height-2*padding.y)/Math.max(1,maxY-minY));
  const view={x:clamp((minX+maxX)/2,-10000,10000),y:clamp((minY+maxY)/2,-10000,10000),
    zoom:clamp(requested,MOTION_VIEW_LIMITS.minZoom,MOTION_VIEW_LIMITS.maxZoom)};
  const camera={scale:view.zoom,origin:{x:width/2-view.x*view.zoom,y:height/2+view.y*view.zoom},width,height};
  return {view,camera,padding,mode,
    clippedTargets:points.filter(p=>!projectMotionPoint(p,camera,16).visible).length,
    omittedImages:mode==='motion'?subjects.omittedImages:mode==='frame'&&finitePoint(currentImage)&&!fitImage(currentImage)?1:0,
    nonfiniteImages:subjects.nonfiniteImages};
}


/**
 * Presentation-only camera controls shared by all supported motion experiments.
 * Relative zoom and pan are measured against whichever automatic fit is
 * selected. They never alter source coordinates, ray optics, numerical budgets
 * or the recorded physical experiment.
 */
export const MOTION_CAMERA_CONTROLS=Object.freeze({
  minRelativeZoom:0.25,maxRelativeZoom:8,zoomStep:1.5
});
export function defaultMotionCameraControl(){
  return {zoomFactor:1,panMm:{x:0,y:0}};
}
function validControl(control){
  if(!control||!Number.isFinite(control.zoomFactor)||
    control.zoomFactor<MOTION_CAMERA_CONTROLS.minRelativeZoom-1e-10||
    control.zoomFactor>MOTION_CAMERA_CONTROLS.maxRelativeZoom+1e-10||
    !finitePoint(control.panMm)||Math.max(Math.abs(control.panMm.x),Math.abs(control.panMm.y))>20000)
    throw Error('Invalid bounded presentation camera control');
}
export function applyMotionCameraControl(fit,control=defaultMotionCameraControl()){
  validControl(control);
  if(!fit?.view||!fit.camera||!Number.isFinite(fit.view.zoom)||fit.view.zoom<=0)
    throw Error('A valid automatic camera fit is required');
  const zoom=clamp(fit.view.zoom*control.zoomFactor,
    MOTION_VIEW_LIMITS.minZoom,MOTION_VIEW_LIMITS.maxZoom);
  const x=clamp(fit.view.x+control.panMm.x,-MOTION_VIEW_LIMITS.maxCenter,MOTION_VIEW_LIMITS.maxCenter);
  const y=clamp(fit.view.y+control.panMm.y,-MOTION_VIEW_LIMITS.maxCenter,MOTION_VIEW_LIMITS.maxCenter);
  const {width,height}=fit.camera;
  const view={x,y,zoom};
  const camera={scale:zoom,origin:{x:width/2-x*zoom,y:height/2+y*zoom},width,height};
  return {view,camera,mode:fit.mode,relativeZoom:zoom/fit.view.zoom,
    zoomFactor:control.zoomFactor};
}
/**
 * Zoom toward the centre (buttons), or keep a pointer's world coordinate at
 * its existing screen pixel (wheel/trackpad). Works with the native ray panel
 * and with the separate analytical coordinate plot.
 */
export function stepMotionCameraZoom(fit,control,direction,anchor=null){
  validControl(control);
  if(direction!==1&&direction!==-1)throw Error('Zoom direction must be +1 or -1');
  const before=applyMotionCameraControl(fit,control);
  const zoomFactor=clamp(control.zoomFactor*
    (direction===1?MOTION_CAMERA_CONTROLS.zoomStep:1/MOTION_CAMERA_CONTROLS.zoomStep),
    MOTION_CAMERA_CONTROLS.minRelativeZoom,MOTION_CAMERA_CONTROLS.maxRelativeZoom);
  let next={zoomFactor,panMm:{...control.panMm}};
  const after=applyMotionCameraControl(fit,next);
  if(Math.abs(after.view.zoom-before.view.zoom)<1e-14)return control;
  if(anchor){
    if(!finitePoint(anchor)||anchor.x<0||anchor.y<0||
      anchor.x>fit.camera.width||anchor.y>fit.camera.height)
      throw Error('Zoom anchor must be a visible pixel position');
    const worldX=(anchor.x-before.camera.origin.x)/before.camera.scale;
    const worldY=(before.camera.origin.y-anchor.y)/before.camera.scale;
    const centerX=worldX-(anchor.x-fit.camera.width/2)/after.camera.scale;
    const centerY=worldY+(anchor.y-fit.camera.height/2)/after.camera.scale;
    next={zoomFactor,panMm:{
      x:clamp(centerX-fit.view.x,-20000,20000),
      y:clamp(centerY-fit.view.y,-20000,20000)}};
  }
  return next;
}
export function panMotionCameraByPixels(fit,control,deltaX,deltaY){
  validControl(control);
  if(!Number.isFinite(deltaX)||!Number.isFinite(deltaY)||
    Math.max(Math.abs(deltaX),Math.abs(deltaY))>4000)
    throw Error('Invalid bounded camera drag displacement');
  const view=applyMotionCameraControl(fit,control);
  const next={zoomFactor:control.zoomFactor,panMm:{
    x:clamp(view.view.x-deltaX/view.camera.scale-fit.view.x,-20000,20000),
    y:clamp(view.view.y+deltaY/view.camera.scale-fit.view.y,-20000,20000)
  }};
  return next;
}

// Native coordinates are y-down; all authored/analytical positions are y-up.
// For ray-panel diagnostics, use the ACTUAL loaded native Scene's transform.
export function projectMotionPoint(point,camera,inset=16){
  if(!finitePoint(point)||!camera)return {visible:false,x:null,y:null};
  const x=camera.origin.x+point.x*camera.scale,y=camera.origin.y-point.y*camera.scale;
  return {x,y,visible:Number.isFinite(x)&&Number.isFinite(y)&&x>=inset&&x<=camera.width-inset&&y>=inset&&y<=camera.height-inset};
}

export function motionGridTicks(min,max,target=5){
  const raw=(max-min)/target;if(!Number.isFinite(raw)||raw<=0)return [];
  const power=10**Math.floor(Math.log10(raw)),fraction=raw/power;
  const step=(fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*power;
  const ticks=[];for(let n=Math.ceil(min/step),i=0;n*step<=max&&i<40;n++,i++)ticks.push(n*step);
  return ticks;
}
