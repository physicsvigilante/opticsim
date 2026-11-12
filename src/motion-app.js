import example from '../examples/u2-motion.json';
import {makeU2Motion} from './motion-example.js';
import {prepareMotionExperiment,MotionPlayer} from './source-motion.js';
import {loadDocument,Simulator,diagnostics,classifyRun,observeSourceSet,observeMirrorSet,observeDetectorSet} from './adapter.js';
const $=id=>document.getElementById(id),layers=['light','below','above','grid'].map($);
let model=null,player=null,loadGeneration=0,currentIndex=null,currentEvidence=null;
const number=x=>Number.isFinite(x)?Number(x.toFixed(4)).toString():'unavailable';
const pair=(v,scale=10)=>v?'x '+number(v.x/scale)+'  ·  y '+number(v.y/scale):'Unavailable';
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearRays(){for(const canvas of layers)canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
function drawPlot(frame){
 const canvas=$('image-plot'),rect=canvas.getBoundingClientRect();canvas.width=Math.round(rect.width);canvas.height=Math.round(rect.height);
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 // A fixed, clearly labelled schematic scale; never clamp an infinite or
 // out-of-view result onto a finite coordinate. No analytical rays are drawn.
 const left=48,right=w-24,top=30,bottom=h-42,xmin=-1600,xmax=100,ymin=-220,ymax=110;
 const x=p=>left+(p-xmin)/(xmax-xmin)*(right-left),y=p=>bottom-(p-ymin)/(ymax-ymin)*(bottom-top);
 ctx.clearRect(0,0,w,h);ctx.font='11px system-ui';ctx.strokeStyle='#283b50';ctx.fillStyle='#9fb1c9';ctx.lineWidth=1;
 for(const v of [-1500,-1000,-500,0]){ctx.beginPath();ctx.moveTo(x(v),top);ctx.lineTo(right===left?left:x(v),bottom);ctx.stroke();ctx.fillText(v/10+' cm',x(v)-18,bottom+22);}
 for(const v of [-200,-100,0,100]){ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();ctx.fillText(v/10+'',8,y(v)+4);}
 ctx.fillText('y / cm',9,15);ctx.fillText('x / cm',w-54,h-7);
 const mirror=model?.baseline.scene.physics.components.find(c=>c.type.includes('mirror'));
 if(mirror){const mp=mirror.parameters;if(mp.x>=xmin&&mp.x<=xmax){ctx.strokeStyle='#e3c88b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x(mp.x),y(mp.y)-23);ctx.lineTo(x(mp.x),y(mp.y)+23);ctx.stroke();ctx.fillStyle='#e3c88b';ctx.fillText('mirror',x(mp.x)-40,y(mp.y)-31);}}
 $('plot-note').textContent='Separate conditional position diagram. Axes: global x-right/y-up. No analytical ray path is drawn.';
 if(!frame?.analysis)return;
 function point(p,label,color){
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
  if(p.x<xmin||p.x>xmax||p.y<ymin||p.y>ymax)return false;
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(x(p.x),y(p.y),5,0,Math.PI*2);ctx.fill();ctx.fillText(label,Math.max(left,Math.min(right-80,x(p.x)+10)),y(p.y)-10);return true;
 }
 point(frame.object.positionMm,'object','#85d6bc');
 const image=frame.analysis.image;
 if(!point(frame.analysis.globalImageMm,'calculated image','#adbcff')){
  const why=image.value?.imageKind==='at-infinity'?'Image at infinity — no finite marker.':
   image.status==='numerically-indeterminate'?'Near focal singularity — finite position withheld.':
   frame.analysis.globalImageMm?'Calculated image is outside this fixed plot. It has not been clipped into view.':'No finite calculated image position.';
  $('plot-note').textContent=why;
 }
}
function ui(p){
 if(p!==player)return;
 const time=p.model.times[p.index];$('clock').textContent=time.toFixed(3)+' s';$('time').value=p.index;
 $('sample').textContent='Frame '+(p.index+1)+' / '+p.model.times.length;
 $('native-state').dataset.state=p.state;$('native-state').textContent='Native: '+p.state;
 $('play').disabled=p.playing;$('pause').disabled=!p.playing;$('reset').disabled=false;$('time').disabled=false;
 if(!p.result){currentIndex=null;currentEvidence=null;$('native-counts').textContent='Current frame pending — previous readings cleared';
  for(const id of ['object-value','image-value','velocity-value'])$(id).textContent='Pending current frame';
  $('save-frame').disabled=true;$('save-report').disabled=true;drawPlot(null);return;}
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
 drawPlot(frame);
 currentEvidence={format:'opticsim-motion-frame-evidence-v1',experimentSha256:model.integritySha256,
  timeSeconds:frame.timeSeconds,frameIndex:p.index,source:frame.object,analysis:frame.analysis,native,
  conditions:frame.assumptions,questionSupport:'not-assessed-by-engine'};
 $('save-frame').disabled=!frame.scene;$('save-report').disabled=false;
}
async function render(frame,signal){
 clearRays();
 const rect=$('native-stage').getBoundingClientRect(),width=Math.round(rect.width),height=Math.round(rect.height);
 for(const canvas of layers){canvas.width=width;canvas.height=height;}
 const view=structuredClone(frame.scene);
 // Presentation only: resize the camera to keep the authored apparatus region
 // visible. Source, aperture, emission and native budgets never depend on zoom.
 view.presentation.view.zoom=Math.max(.2,Math.min(2,width/420));
 const {scene,idMap}=loadDocument(view,width,height),emission=observeSourceSet(view,scene,idMap),
  reflections=observeMirrorSet(view,scene,idMap),detectors=observeDetectorSet(view,scene,idMap);
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
 const token=++loadGeneration;player?.stop();clearRays();currentIndex=null;currentEvidence=null;drawPlot(null);
 for(const id of ['play','pause','reset','time','save-motion','save-frame','save-report'])$(id).disabled=true;
 try{
  const candidate=await prepareMotionExperiment(await value);if(token!==loadGeneration)return;
  model=candidate;player=new MotionPlayer({model,render,onState:ui});
  $('time').max=model.times.length-1;$('speed').value='0.1';player.setSpeed(.1);
  $('assumptions').textContent=[model.spec.continuationAssumption,...(model.baseline.qualification.interpretation?.assumptions||[])].join('\n');
  $('experiment-hash').textContent='Experiment SHA-256: '+model.integritySha256;
  $('error').hidden=true;$('save-motion').disabled=false;await player.seek(0);
 }catch(error){if(token!==loadGeneration)return;model=null;player=null;drawPlot(null);$('native-state').dataset.state='invalid';$('native-state').textContent='Native: not run — invalid experiment';$('error').hidden=false;$('error').textContent=error.message;
  for(const id of ['play','pause','reset','time','save-motion','save-frame','save-report'])$(id).disabled=true;}
}
$('play').onclick=()=>player?.play();$('pause').onclick=()=>player?.pause();$('reset').onclick=()=>player?.seek(0);
$('time').oninput=()=>player?.seek(Number($('time').value));$('speed').onchange=()=>player?.setSpeed(Number($('speed').value));
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
