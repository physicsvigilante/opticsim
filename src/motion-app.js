import example from '../examples/u2-motion.json';
import {makeU2Motion} from './motion-example.js';
import {prepareMotionExperiment,MotionPlayer} from './source-motion.js';
import {loadDocument,Simulator,diagnostics,classifyRun,observeSourceSet,observeMirrorSet,observeDetectorSet} from './adapter.js';
import {collectMotionView,fitMotionView,projectMotionPoint,motionGridTicks} from './motion-viewport.js';
import {curvedPoints,isCurved} from './curved-mirrors.js';
const $=id=>document.getElementById(id),layers=['light','below','above','grid'].map($);
let model=null,player=null,loadGeneration=0,currentIndex=null,currentEvidence=null;
let viewSubjects=null,nativeCamera=null;
const number=x=>Number.isFinite(x)?Number(x.toFixed(4)).toString():'unavailable';
const pair=(v,scale=10)=>v?'x '+number(v.x/scale)+'  ·  y '+number(v.y/scale):'Unavailable';
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearRays(){for(const canvas of [...layers,$('guides')])canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);delete $('native-stage').dataset.viewport;}
function cameraMode(){return $('camera-mode').value;}
function imageNote(frame){
 const image=frame?.analysis?.image;
 return image?.value?.imageKind==='at-infinity'?'Image at infinity — no finite marker.':
  image?.status==='numerically-indeterminate'?'Near focal singularity — finite position withheld.':
  frame?.analysis?.globalImageMm?'Calculated image is outside the supported camera range; it has not been moved or clipped into view.':'No finite calculated image position.';
}
function pointLabel(ctx,p,label,color,w,h,{guide=false}={}){
 if(!p.visible)return;
 ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.6;
 ctx.beginPath();if(guide){ctx.setLineDash([3,3]);ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.stroke();}
 else {ctx.arc(p.x,p.y,4.5,0,Math.PI*2);ctx.fill();}
 ctx.setLineDash([]);ctx.font='11px system-ui';const textWidth=ctx.measureText(label).width;
 const x=Math.max(8,Math.min(w-textWidth-8,p.x+12));const y=Math.max(18,Math.min(h-28,p.y-13));
 ctx.fillStyle='rgba(8,13,20,0.88)';ctx.fillRect(x-3,y-12,textWidth+6,17);
 ctx.fillStyle=color;ctx.fillText(label,x,y);ctx.restore();
}
function drawNativeGuides(frame){
 const canvas=$('guides');canvas.width=nativeCamera?.width||1;canvas.height=nativeCamera?.height||1;
 const ctx=canvas.getContext('2d');if(!frame||!nativeCamera)return;
 const object=projectMotionPoint(frame.object?.positionMm,nativeCamera),image=projectMotionPoint(frame.analysis?.globalImageMm,nativeCamera);
 pointLabel(ctx,object,'object','#85d6bc',canvas.width,canvas.height);
 pointLabel(ctx,image,'calculated image guide','#adbcff',canvas.width,canvas.height,{guide:true});
 // Annotation only. Never inject a ray or modify the native rendering layers.
 const evidence={...nativeCamera,object,image,mode:cameraMode()};
 $('native-stage').dataset.viewport=JSON.stringify(evidence);
 const mode=cameraMode()==='motion'?'Whole-motion view — scale stays fixed during playback.':cameraMode()==='frame'?'Current-frame view — scale follows this frame.':'Apparatus close-up — the image may lie outside this view.';
 $('native-view-note').textContent=mode+' Dashed image guide = conditional calculation, not native detection.'+
  (!image.visible?(cameraMode()==='apparatus'&&frame.analysis?.globalImageMm?' Select Whole motion to include the image.':' '+imageNote(frame)):'');
 $('camera-note').textContent=(cameraMode()==='motion'?'Fitted to apparatus and finite images across all sampled times. ':'')+
  (viewSubjects?.omittedImages?'Extreme finite images beyond the supported camera range are excluded from fitting. ':'')+
  'Camera changes affect presentation only.';
}
function drawPlot(frame){
 const canvas=$('image-plot'),rect=canvas.getBoundingClientRect();canvas.width=Math.round(rect.width);canvas.height=Math.round(rect.height);
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
 if(!viewSubjects||w<80||h<80)return;
 const fitted=fitMotionView(viewSubjects,w,h,{mode:cameraMode(),frame}),camera=fitted.camera;
 const left=40,right=w-16,top=24,bottom=h-32;
 const x=p=>camera.origin.x+p*camera.scale,y=p=>camera.origin.y-p*camera.scale;
 const xmin=(left-camera.origin.x)/camera.scale,xmax=(right-camera.origin.x)/camera.scale;
 const ymin=(camera.origin.y-bottom)/camera.scale,ymax=(camera.origin.y-top)/camera.scale;
 ctx.font='11px system-ui';ctx.strokeStyle='#283b50';ctx.fillStyle='#9fb1c9';ctx.lineWidth=1;
 for(const v of motionGridTicks(xmin,xmax,w<400?3:5)){ctx.beginPath();ctx.moveTo(x(v),top);ctx.lineTo(x(v),bottom);ctx.stroke();ctx.fillText(number(v/10),x(v)-10,bottom+19);}
 for(const v of motionGridTicks(ymin,ymax,4)){ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();ctx.fillText(number(v/10),5,y(v)+4);}
 ctx.fillText('y / cm',8,14);ctx.fillText('x / cm',w-53,h-4);
 const mirror=model?.baseline.scene.physics.components.find(c=>isCurved(c.type));
 if(mirror){const [a,b]=curvedPoints(mirror),mp=mirror.parameters;
  ctx.strokeStyle='#e3c88b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x(a.x),y(a.y));ctx.lineTo(x(b.x),y(b.y));ctx.stroke();
  pointLabel(ctx,projectMotionPoint(mp,camera),'mirror','#e3c88b',w,h);
 }
 $('plot-note').textContent='Separate conditional calculation. Global x-right/y-up, equal x/y scale; no analytical ray paths.';
 if(!frame)return;
 pointLabel(ctx,projectMotionPoint(frame.object?.positionMm,camera),'object','#85d6bc',w,h);
 const p=projectMotionPoint(frame.analysis?.globalImageMm,camera);
 pointLabel(ctx,p,'calculated image','#adbcff',w,h,{guide:true});
 if(!p.visible)$('plot-note').textContent=cameraMode()==='apparatus'&&frame.analysis?.globalImageMm?
  'Close-up excludes the calculated image. Select Whole motion to include it.':imageNote(frame);
 canvas.dataset.viewport=JSON.stringify({...camera,image:p});
}

function ui(p){
 if(p!==player)return;
 const time=p.model.times[p.index];$('clock').textContent=time.toFixed(3)+' s';$('time').value=p.index;
 $('sample').textContent='Frame '+(p.index+1)+' / '+p.model.times.length;
 $('native-state').dataset.state=p.state;$('native-state').textContent='Native: '+p.state;
 $('play').disabled=p.playing;$('pause').disabled=!p.playing;$('reset').disabled=false;$('time').disabled=false;
 if(!p.result){currentIndex=null;currentEvidence=null;$('native-counts').textContent='Current frame pending — previous readings cleared';
  for(const id of ['object-value','image-value','velocity-value'])$(id).textContent='Pending current frame';
  $('save-frame').disabled=true;$('save-report').disabled=true;drawPlot(null);$('guides').getContext('2d').clearRect(0,0,$('guides').width,$('guides').height);return;}
 const {frame,native}=p.result;currentIndex=p.index;
 const d=native.diagnostics,complete=['completed','completed-with-warnings'].includes(native.status);
 $('native-counts').textContent=complete?d.emitted+' emitted · '+d.reflections+' reflections · '+d.processed+' segments':
  'No completed native observations. '+(native.error||native.issues?.join('; ')||'Frame is incomplete.');
 $('object-value').textContent=frame.object?pair(frame.object.positionMm)+' cm':'Invalid source position';
 const im=frame.analysis?.image,vel=frame.analysis?.kinematics;
 $('image-value').textContent=im?.value?.imageKind==='at-infinity'?'At infinity':frame.analysis?.globalImageMm?
  pair(frame.analysis.globalImageMm)+' cm\nm = '+number(im.value.magnification):(im?.status||'unavailable');
 $('velocity-value').textContent=pair(frame.analysis?.globalImageVelocityMmPerSecond);
 $('image-model').textContent=im?.model==='spherical-paraxial'?'Paraxial calculation; circular rays may exhibit aberration':'Ideal Gaussian calculation — not native detection';
 if(vel?.status==='unavailable')$('velocity-value').textContent='No finite image velocity';
 if(vel?.status==='numerically-indeterminate')$('velocity-value').textContent='Numerically indeterminate';
 drawPlot(frame);drawNativeGuides(frame);
 currentEvidence={format:'opticsim-motion-frame-evidence-v1',experimentSha256:model.integritySha256,
  timeSeconds:frame.timeSeconds,frameIndex:p.index,source:frame.object,analysis:frame.analysis,native,
  presentationCamera:nativeCamera,conditions:frame.assumptions,questionSupport:'not-assessed-by-engine'};
 $('save-frame').disabled=!frame.scene;$('save-report').disabled=false;
}
async function render(frame,signal){
 clearRays();
 const rect=$('native-stage').getBoundingClientRect(),width=Math.round(rect.width),height=Math.round(rect.height);
 for(const canvas of layers){canvas.width=width;canvas.height=height;}
 const view=structuredClone(frame.scene);
 // Fit the image as well as the apparatus. The baseline, physical scene and
 // simulation budgets remain untouched; only this rendering copy has a new camera.
 const fitted=fitMotionView(viewSubjects,width,height,{mode:cameraMode(),frame});
 view.presentation.view={...fitted.view};
 const {scene,idMap}=loadDocument(view,width,height),emission=observeSourceSet(view,scene,idMap),
  reflections=observeMirrorSet(view,scene,idMap),detectors=observeDetectorSet(view,scene,idMap);
 nativeCamera={origin:{...scene.origin},scale:scene.scale,width,height};
 const sim=new Simulator(scene,...layers.map(c=>c.getContext('2d')),null,true,view.simulation.processedRayLimit);
 return new Promise((resolve,reject)=>{
  let settled=false,timer;
  const cancel=()=>{if(sim.simulationTimerId!==-1)clearTimeout(sim.simulationTimerId);sim.simulationTimerId=-1;sim.shouldSimulatorStop=true;};
  const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);resolve(result);};
  const abort=()=>{cancel();finish({status:'cancelled'});};
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
  timer=setTimeout(()=>{cancel();finish({status:'stopped',error:'Native frame exceeded the 10-second wall-time bound.'});},10000);
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{
   if(signal.aborted){abort();return;}
   const d=diagnostics(scene,sim,emission,reflections,detectors);
   finish({status:classifyRun(event,d),diagnostics:d,observationMeaning:'Sampled native events, not image detection.'});
  });
  try{sim.updateSimulation(false,false);}catch(error){cancel();finish({status:'failed',error:String(error.message)});}
 });
}
async function load(value){
 const token=++loadGeneration;player?.stop();clearRays();currentIndex=null;currentEvidence=null;viewSubjects=null;nativeCamera=null;drawPlot(null);
 for(const id of ['play','pause','reset','time','save-motion','save-frame','save-report'])$(id).disabled=true;
 try{
  const candidate=await prepareMotionExperiment(await value);if(token!==loadGeneration)return;
  model=candidate;viewSubjects=collectMotionView(model);$('camera-mode').value='motion';player=new MotionPlayer({model,render,onState:ui});
  $('time').max=model.times.length-1;$('speed').value='0.1';player.setSpeed(.1);
  $('assumptions').textContent=[model.spec.continuationAssumption,...(model.baseline.qualification.interpretation?.assumptions||[])].join('\n');
  $('experiment-hash').textContent='Experiment SHA-256: '+model.integritySha256;
  $('error').hidden=true;$('save-motion').disabled=false;await player.seek(0);
 }catch(error){if(token!==loadGeneration)return;model=null;player=null;drawPlot(null);$('native-state').dataset.state='invalid';$('native-state').textContent='Native: not run — invalid experiment';$('error').hidden=false;$('error').textContent=error.message;
  for(const id of ['play','pause','reset','time','save-motion','save-frame','save-report'])$(id).disabled=true;}
}
$('play').onclick=()=>player?.play();$('pause').onclick=()=>player?.pause();$('reset').onclick=()=>player?.seek(0);
$('time').oninput=()=>player?.seek(Number($('time').value));$('speed').onchange=()=>player?.setSpeed(Number($('speed').value));
$('camera-mode').onchange=()=>{player?.pause();if(player)player.seek(player.index);};
$('example').onchange=()=>load(makeU2Motion(example,{circular:$('example').value==='circular'}));
$('open-motion').onchange=async()=>{const file=$('open-motion').files[0];if(!file)return;player?.stop();
 if(file.size>1500000){$('error').hidden=false;$('error').textContent='Experiment file exceeds 1.5 MB';return;}
 await load(file.text());};
$('save-motion').onclick=()=>model&&download('source-motion.experiment.json',model.exportExperiment());
$('save-report').onclick=()=>currentEvidence&&download('motion-frame-evidence.json',currentEvidence);
$('save-frame').onclick=async()=>{const currentModel=model,index=currentIndex,token=loadGeneration;
 if(index===null)return;try{const b=await currentModel.qualifiedFrame(index);if(token===loadGeneration)download('motion-frame.qualified.json',b);}catch(error){$('error').hidden=false;$('error').textContent=error.message;}};
let resizeTimer;window.addEventListener('resize',()=>{player?.pause();clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>player?.seek(player.index),120);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)player?.pause();});
load(makeU2Motion(example)).catch(error=>{$('error').hidden=false;$('error').textContent=error.message;});
