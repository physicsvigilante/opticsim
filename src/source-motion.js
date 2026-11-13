// Quasi-static geometric-optics snapshots, not finite-light-speed dynamics.
// Only one source translates at constant velocity. Every frame starts from a
// verified immutable baseline; native optics and numerical policies are unchanged.
import {validate,serializeSave} from './contract.js';
import {isCurved,curvedFrame,curvedPoints} from './curved-mirrors.js';
import {analyzeCurvedMirrorQuery,CURVED_FACTS_FORMAT,CURVED_QUERY_FORMAT} from './curved-mirror-queries.js';
import {analyzeMovingThinLens} from './motion-thin-lens.js';
import {verifyQualifiedBundle,createQualifiedBundle,recordQualifiedEdit} from './qualification.js';
import {canonicalJSON,sha256Text,isRecord} from './qualified-utils.js';
export const MOTION_FORMAT='opticsim-source-motion-v1';
export const MOTION_PACKAGE_FORMAT='opticsim-motion-experiment-v1';
const scales={'mm/s':1,'cm/s':10,'m/s':1000};
const own=(o,k)=>Object.hasOwn(o,k);
function object(x,keys,label){
 if(!isRecord(x)||Object.keys(x).length!==keys.length||keys.some(k=>!own(x,k)))throw Error('Invalid '+label+' fields');
}
function finite(x,min,max,label){if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw Error('Invalid '+label);}
export function motionCapabilities(){return {
 format:MOTION_FORMAT,packageFormat:MOTION_PACKAGE_FORMAT,
 scope:'One uniformly translating source with one stationary curved mirror (v6, optional passive detectors) OR one stationary ideal thin lens (strict v4 single-lens bench).',
 limits:{maxDurationSeconds:10,maxSamples:241,maxSegmentsPerFrame:10000,maxDepth:8},
 coordinates:'Velocity in global x-right/y-up coordinates; baseline source position is at t=0; seconds only.',
 method:'quasi-static native snapshots plus separate conditional image kinematics',
 notSupported:['moving optics','arbitrary equations','acceleration','finite light propagation time','native image detection']};}
export function validateMotion(scene,spec){
 validate(scene);
 object(spec,['format','sourceId','law','velocity','durationSeconds','samples','continuationAssumption'],'motion');
 if(spec.format!==MOTION_FORMAT||spec.law!=='constant-velocity')throw Error('Unsupported motion law or format');
 const polar=isRecord(spec.velocity)&&own(spec.velocity,'speed');
 object(spec.velocity,polar?['speed','directionDeg','unit']:['x','y','unit'],'velocity');
 if(!own(scales,spec.velocity.unit))throw Error('Velocity unit must be mm/s, cm/s or m/s');
 if(polar){finite(spec.velocity.speed,0,1000,'speed');finite(spec.velocity.directionDeg,-180,180,'velocity direction');}
 else{finite(spec.velocity.x,-1000,1000,'x velocity');finite(spec.velocity.y,-1000,1000,'y velocity');}
 finite(spec.durationSeconds,.000001,10,'duration');finite(spec.samples,2,241,'sample count');
 if(!Number.isInteger(spec.samples))throw Error('Sample count must be an integer');
 if(typeof spec.continuationAssumption!=='string'||!spec.continuationAssumption.trim()||spec.continuationAssumption.length>1200)
  throw Error('Declare the assumption extending motion beyond the stated instant');

 const cs=scene.physics.components,sources=cs.filter(c=>c.type==='point-source'),
  mirrors=cs.filter(c=>isCurved(c.type)),lenses=cs.filter(c=>c.type==='ideal-lens');
 const curved=scene.schemaVersion===6&&scene.physics.model==='curved-mirror-tracing'&&
  sources.length===1&&mirrors.length===1&&lenses.length===0&&
  cs.every(c=>['point-source','ray-detector','ideal-curved-mirror','circular-arc-mirror'].includes(c.type));
 const thinLens=scene.schemaVersion===4&&scene.physics.model==='ideal-thin-lens-geometric'&&
  sources.length===1&&lenses.length===1&&cs.length===2;
 if((!curved&&!thinLens)||sources[0]?.id!==spec.sourceId)
  throw Error('Motion accepts only one source and a stationary single curved mirror (v6) or single ideal thin lens (v4); no substituted apparatus');
 if(scene.simulation.processedRayLimit>10000||scene.simulation.maxRayDepth>8)
  throw Error('Motion requires bounded native per-frame budgets: at most 10000 segments and depth 8');
 const scale=scales[spec.velocity.unit],velocity=polar?
  {x:spec.velocity.speed*scale*Math.cos(spec.velocity.directionDeg*Math.PI/180),
   y:spec.velocity.speed*scale*Math.sin(spec.velocity.directionDeg*Math.PI/180)}:
  {x:spec.velocity.x*scale,y:spec.velocity.y*scale};
 const source=sources[0],p=source.parameters;
 const end={x:p.x+velocity.x*spec.durationSeconds,y:p.y+velocity.y*spec.durationSeconds};
 let optic,n,t;
 if(curved){
  optic=mirrors[0];const m=optic.parameters,axes=curvedFrame(m);n=axes.n;t=axes.t;
  // Existing curved-mirror exclusion rules remain unchanged. A lens cannot
  // accidentally acquire a reflected-ray path from these conditions.
  const speed2=velocity.x**2+velocity.y**2;
  const closest=speed2===0?0:Math.max(0,Math.min(spec.durationSeconds,
   -((p.x-m.x)*velocity.x+(p.y-m.y)*velocity.y)/speed2));
  const q={x:p.x+velocity.x*closest,y:p.y+velocity.y*closest};
  const edge=curvedPoints(optic)[0],r=Math.hypot(edge.x-m.x,edge.y-m.y);
  if(Math.hypot(q.x-m.x,q.y-m.y)<=r+.01)
   throw Error('Motion enters the supported mirror aperture exclusion disk');
  if(Math.min((p.x-m.x)*n.x+(p.y-m.y)*n.y,(end.x-m.x)*n.x+(end.y-m.y)*n.y)<=0)
   throw Error('Motion must remain on the declared front side of the fixed mirror');
  for(const detector of cs.filter(c=>c.type==='ray-detector')){
   const a=detector.parameters.orientationDeg*Math.PI/180,dp=detector.parameters;
   const side=q=>(q.x-dp.x)*(-Math.sin(a))+(q.y-dp.y)*Math.cos(a);
   if(side(p)*side(end)<=0||Math.min(Math.abs(side(p)),Math.abs(side(end)))<.01)
    throw Error('Source trajectory crosses a detector supporting line');
  }
 }else{
  optic=lenses[0];
  // The *existing* v4 strict lens bench has source left of the lens.
  // Its x separation is affine, so endpoint checks cover every instant,
  // including times not selected as native sample frames. Crossing the lens
  // plane or moving to its right needs a separate later capability.
  if(Math.max(p.x,end.x)>optic.parameters.x-.01)
   throw Error('Source trajectory crosses or reaches the supported thin-lens plane');
 }
 // Endpoint validation covers affine-coordinate limits. Sampled states are
 // independently checked, and no ray encounters are prescribed.
 const final=structuredClone(scene);
 Object.assign(final.physics.components.find(c=>c.id===source.id).parameters,end);
 validate(final);
 return {source,mirror:curved?optic:null,lens:thinLens?optic:null,
  opticalFamily:curved?'curved-mirror':'thin-lens',velocity,n,t};
}
export async function createMotionExperiment(baseline,spec){
 // Snapshot caller-owned input before asynchronous hash verification.
 const b=structuredClone(baseline),s=structuredClone(spec);
 await verifyQualifiedBundle(b);validateMotion(b.scene,s);
 const payload={format:MOTION_PACKAGE_FORMAT,baseline:b,motion:s};
 return {...payload,integritySha256:await sha256Text(canonicalJSON(payload))};
}
export async function prepareMotionExperiment(value){
 const experiment=typeof value==='string'?JSON.parse(value):structuredClone(value);
 if(canonicalJSON(experiment).length>1500000)throw Error('Motion package exceeds size bound');
 object(experiment,['format','baseline','motion','integritySha256'],'motion package');
 if(experiment.format!==MOTION_PACKAGE_FORMAT)throw Error('Unsupported motion package');
 const {integritySha256,...payload}=experiment;
 if(await sha256Text(canonicalJSON(payload))!==integritySha256)throw Error('Motion package integrity mismatch');
 await verifyQualifiedBundle(experiment.baseline);
 const baseline=experiment.baseline,spec=experiment.motion,info=validateMotion(baseline.scene,spec);
 const {source,mirror,lens,opticalFamily,velocity,n,t}=info;
 const times=Array.from({length:spec.samples},(_,i)=>spec.durationSeconds*i/(spec.samples-1));
 const sampleAt=time=>{
  finite(time,0,spec.durationSeconds,'time');
  const scene=structuredClone(baseline.scene),p=scene.physics.components.find(c=>c.id===source.id).parameters;
  p.x=source.parameters.x+velocity.x*time;p.y=source.parameters.y+velocity.y*time;
  let status='valid',issues=[];
  try{validate(scene);}catch(error){status='invalid';issues=[String(error.message)];}
  if(status==='invalid')return {timeSeconds:time,status,issues,scene:null,analysis:null,experimentSha256:integritySha256};

  let analysis;
  if(opticalFamily==='thin-lens'){
   const result=analyzeMovingThinLens(scene,velocity);
   analysis={...result,method:'conditional-analytical',nativeImageDetection:false};
  }else{
   const mp=mirror.parameters,dx=p.x-mp.x,dy=p.y-mp.y;
   const facts={format:CURVED_FACTS_FORMAT,
    model:mirror.type==='ideal-curved-mirror'?'ideal-gaussian':'spherical-paraxial',
    signConvention:'real-positive-local',lengthUnit:'mm',
    focalLength:mirror.type==='ideal-curved-mirror'?mp.focalLength:mp.radius/2,
    objectDistance:dx*n.x+dy*n.y,objectHeight:dx*t.x+dy*t.y,
    stationaryMirror:true,fixedFocalLength:true,timeUnit:'s',
    objectVelocity:{axial:velocity.x*n.x+velocity.y*n.y,
     transverse:velocity.x*t.x+velocity.y*t.y}};
   const image=analyzeCurvedMirrorQuery(facts,{format:CURVED_QUERY_FORMAT,kind:'curved-mirror-image'});
   const kinematics=analyzeCurvedMirrorQuery(facts,{format:CURVED_QUERY_FORMAT,kind:'curved-mirror-image-velocity'});
   let globalImage=null,globalImageVelocity=null;
   if(image.status==='conditional'&&Number.isFinite(image.value?.imageDistance)&&Number.isFinite(image.value?.imageHeight))
    globalImage={x:mp.x+n.x*image.value.imageDistance+t.x*image.value.imageHeight,
     y:mp.y+n.y*image.value.imageDistance+t.y*image.value.imageHeight};
   if(kinematics.status==='conditional'&&kinematics.value?.velocity){
    const v=kinematics.value.velocity;
    globalImageVelocity={x:n.x*v.axial+t.x*v.transverse,
     y:n.y*v.axial+t.y*v.transverse};
   }
   analysis={image,kinematics,globalImageMm:globalImage,
    globalImageVelocityMmPerSecond:globalImageVelocity,
    method:'conditional-analytical',nativeImageDetection:false};
  }
  return {timeSeconds:time,status,issues,scene,experimentSha256:integritySha256,
    object:{positionMm:{x:p.x,y:p.y},velocityMmPerSecond:{...velocity}},
    analysis,
    native:{status:'not-run'},assumptions:[spec.continuationAssumption,'Quasi-static snapshots; no finite light propagation time.']};
 };
 return {times:[...times],spec:structuredClone(spec),baseline:structuredClone(baseline),integritySha256,
  sampleAt,
  frame(index){if(!Number.isInteger(index)||index<0||index>=times.length)throw Error('Frame index out of range');return sampleAt(times[index]);},
  async qualifiedFrame(index){const frame=this.frame(index);if(!frame.scene)throw Error('Invalid frame has no scene export');
   const q=recordQualifiedEdit(baseline.scene,frame.scene,baseline.qualification);
   if(!q.interpretation)q.interpretation={};
   q.interpretation.derived=[...(q.interpretation.derived||[]),
     'Source position at t='+frame.timeSeconds+' s from constant-velocity motion package '+integritySha256+'. The static export does not retain playback; retain the experiment package.'];
   return createQualifiedBundle(frame.scene,q,baseline.observables);
  },
  exportExperiment(){return structuredClone(experiment);}
 };
}
// Await each render before scheduling the next. Cancel superseded frames and
// guard callbacks by generation; no native callback may display an older time.
export class MotionPlayer{
 constructor({model,render,onState=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id)}){
  this.model=model;this.render=render;this.onState=onState;this.schedule=schedule;this.unschedule=unschedule;
  this.index=0;this.speed=.1;this.playing=false;this.generation=0;this.state='idle';this.result=null;
 }
 pause(){this.playing=false;this.unschedule(this.timer);this.timer=null;this.onState(this);}
 stop(){
  // Invalidate before notifying: no intermediate notification may resurrect a
  // completed result while a different scene/camera is being prepared.
  this.playing=false;this.unschedule(this.timer);this.timer=null;
  this.generation++;this.abort?.abort();this.state='stopped';this.result=null;this.onState(this);
 }
 setSpeed(speed){if(![.1,.25,.5,1].includes(speed))throw Error('Unsupported playback speed');this.speed=speed;}
 async seek(index,{continuePlaying=false}={}){
  if(!continuePlaying)this.pause();
  this.unschedule(this.timer);this.timer=null;this.abort?.abort();
  const generation=++this.generation;this.abort=new AbortController();
  this.result=null;this.state='running';
  let frame;
  try{
   frame=this.model.frame(index);this.index=index;this.onState(this);
   const result=frame.scene?await this.render(frame,this.abort.signal):{status:'invalid',issues:frame.issues};
   if(generation!==this.generation)return null;
   this.result={frame,native:result};this.state=result.status;this.onState(this);
   if(!['completed','completed-with-warnings'].includes(result.status)){this.pause();return this.result;}
   if(this.playing){if(index+1<this.model.times.length){
     const ms=(this.model.times[index+1]-this.model.times[index])*1000/this.speed;
     this.timer=this.schedule(()=>this.seek(index+1,{continuePlaying:true}),ms);
    }else this.pause();}
   return this.result;
  }catch(error){
   if(generation!==this.generation)return null;
   this.state=frame?'failed':'invalid';
   this.result=frame?{frame,native:{status:'failed',error:String(error.message)}}:null;
   this.pause();return this.result;
  }
 }
 play(){if(this.playing)return;this.playing=true;const start=this.index>=this.model.times.length-1?0:this.index;return this.seek(start,{continuePlaying:true});}
}
