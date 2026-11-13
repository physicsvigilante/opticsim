// Reuse canonical scene fields in the motion page. Validation and provenance
// belong to motion-ray-controls, not local DOM event handlers.
import {motionRayControls} from './motion-ray-controls.js';
const $=id=>document.getElementById(id);
const ids=['ray-brightness','ray-brightness-slider','ray-sampling','ray-custom-density',
 'ray-source-mode','ray-direction','ray-opening','ray-view','ray-grid','ray-depth','ray-limit',
 'mirror-aperture-cm','mirror-aperture-slider'];
const numeric=id=>{
 const raw=$(id).value.trim(),value=raw?Number(raw):NaN;
 if(!Number.isFinite(value))throw Error('A finite number is required for '+id);
 return value;
};
export class MotionRayUI{
 constructor({getModel,onChange}){
  this.getModel=getModel;this.onChange=onChange;this.busy=false;this.directionExplicit=false;
  this.revision=0;this.bind();this.sync();
 }
 error(e){
  $('ray-control-error').hidden=!e;
  $('ray-control-error').textContent=e?String(e.message||e):'';
 }
 reset(){this.revision++;this.busy=false;this.directionExplicit=false;this.error(null);this.sync();}
 async apply(change){
  if(this.busy||!this.getModel())return false;
  const revision=this.revision,request=structuredClone(change);
  this.busy=true;this.error(null);this.sync();
  try{
   const accepted=await this.onChange(request);
   if(revision!==this.revision||accepted===false)return false;
   // Only a successfully validated direction can authorize conversion from an
   // omnidirectional source. An invalid number must not confirm an old value.
   if(request.emissionMode==='full-circle')this.directionExplicit=false;
   else if(Object.hasOwn(request,'directionDeg'))this.directionExplicit=true;
   return true;
  }catch(error){if(revision===this.revision)this.error(error);return false;}
  finally{if(revision===this.revision){this.busy=false;this.sync();}}
 }
 submitNumber(id,key){
  try{this.apply({[key]:numeric(id)});}
  catch(error){this.error(error);this.sync();}
 }
 sync(){
  const model=this.getModel(),v=model?motionRayControls(model.baseline.scene):null;
  for(const id of ids)$(id).disabled=!v||this.busy;
  if(!v){$('ray-custom-wrap').hidden=true;return;}
  $('ray-brightness').value=v.brightness;
  $('ray-brightness-slider').value=v.brightness;
  $('ray-sampling').value=v.densityPreset;
  $('ray-custom-wrap').hidden=v.densityPreset!=='custom';
  $('ray-custom-density').value=v.rayDensity;
  $('ray-custom-density').disabled=this.busy||v.densityPreset!=='custom';
  $('ray-source-mode').value=v.emissionMode;
  // The historical strict v4 thin-lens scene supports full-circle and
  // directional emission; v6 curved scenes also support a native single ray.
  $('ray-source-mode').querySelector('option[value="single-ray"]').disabled=
   v.mirrorType==='ideal-lens';
  $('ray-direction').value=v.directionDeg;
  $('ray-opening').value=v.angleDeg;
  $('ray-opening').disabled=this.busy||v.emissionMode!=='directional';
  $('ray-view').value=v.presentationMode;
  $('ray-grid').checked=v.grid;
  $('ray-depth').value=v.maxRayDepth;
  $('ray-limit').value=v.processedRayLimit;
  // Only the browser label uses cm; canonical optical geometry stays in mm.
  const apertureCm=v.mirrorApertureHeightMm/10;
  $('mirror-aperture-cm').value=String(apertureCm);
  const slider=$('mirror-aperture-slider');
  // Quick adjustment is 1–20 cm for typical scenes, but a valid imported
  // mirror need not fit that range; preserve its precise authored size.
  slider.min=String(apertureCm<1?Math.max(.1,Math.floor(apertureCm*10)/10):1);
  slider.max=String(Math.max(20,Math.ceil(apertureCm*2)/2));
  slider.step=apertureCm<1?'0.1':'0.5';
  slider.value=String(apertureCm);
  $('mirror-aperture-kind').textContent=v.mirrorType==='ideal-lens'?
   'Ideal thin lens · native refraction':v.mirrorType==='circular-arc-mirror'?
   'Circular arc · local-normal native reflection':'Ideal Gaussian curved mirror';
  document.querySelector('label[for="mirror-aperture-cm"]').textContent=
   v.mirrorType==='ideal-lens'?'Lens aperture height (cm) — physical size':
   'Mirror aperture height (cm) — physical size';
  $('mirror-aperture-note').textContent=
   'Quick slider is typically 1–20 cm; precise number accepts any supported size. '+
   (v.mirrorType==='ideal-lens'?'This changes the native lens aperture, not zoom. Focal length and source motion remain fixed; the source must remain left of the lens.':
    'This changes the reflecting surface, not zoom. Focal length/radius and source motion remain unchanged. Circular geometry and the entire trajectory may impose stricter bounds.');
  const edits=model.baseline.qualification.edits.length;
  $('ray-control-note').textContent='Brightness and emission are physical; density and limits affect native ray sampling; grid and extended view are presentation. '+
   (v.emissionMode==='single-ray'?'One exact ray: density will not make a cone. ':
    v.emissionMode==='full-circle'?'The stored direction is inactive; enter one explicitly before switching to a single ray. ':'')+
   edits+' qualified baseline edit'+(edits===1?'':'s')+
   '. Save experiment preserves them and the original interpretation.';
 }
 bind(){
  $('ray-brightness-slider').oninput=()=>{$('ray-brightness').value=$('ray-brightness-slider').value;};
  $('ray-brightness-slider').onchange=()=>this.submitNumber('ray-brightness-slider','brightness');
  $('ray-brightness').onchange=()=>this.submitNumber('ray-brightness','brightness');
  $('ray-sampling').onchange=()=>{
   const value=$('ray-sampling').value;
   if(value==='custom'){
    $('ray-custom-wrap').hidden=false;$('ray-custom-density').disabled=false;
    $('ray-custom-density').focus();return;
   }
   this.apply({densityPreset:value});
  };
  $('ray-custom-density').onchange=()=>this.submitNumber('ray-custom-density','rayDensity');
  $('ray-direction').onchange=()=>{
   try{const directionDeg=numeric('ray-direction');
    this.apply({directionDeg});}
   catch(error){this.error(error);this.sync();}
  };
  $('ray-opening').onchange=()=>this.submitNumber('ray-opening','angleDeg');
  $('ray-source-mode').onchange=()=>{
   const scene=this.getModel()?.baseline.scene;
   if(!scene)return;
   const current=motionRayControls(scene),mode=$('ray-source-mode').value;
   if(current.emissionMode==='full-circle'&&mode==='single-ray'&&!this.directionExplicit){
    this.error(Error('Enter a direction explicitly before converting a full-circle source to a single ray.'));
    this.sync();return;
   }
   const change={emissionMode:mode};
   if(current.emissionMode==='full-circle'&&mode==='single-ray'){
    try{change.directionDeg=numeric('ray-direction');}
    catch(error){this.error(error);this.sync();return;}
   }
   this.apply(change);
  };
  $('ray-view').onchange=()=>this.apply({presentationMode:$('ray-view').value});
  $('ray-grid').onchange=()=>this.apply({grid:$('ray-grid').checked});
  $('ray-depth').onchange=()=>this.submitNumber('ray-depth','maxRayDepth');
  $('ray-limit').onchange=()=>this.submitNumber('ray-limit','processedRayLimit');
  // One existing native geometry parameter; the shared validator rejects
  // source-path collisions and unsupported circular minor arcs.
  const editAperture=id=>{
   try{this.apply({mirrorApertureHeightMm:numeric(id)*10});}
   catch(error){this.error(error);this.sync();}
  };
  $('mirror-aperture-slider').oninput=()=>{
   $('mirror-aperture-cm').value=$('mirror-aperture-slider').value;
  };
  $('mirror-aperture-slider').onchange=()=>editAperture('mirror-aperture-slider');
  $('mirror-aperture-cm').onchange=()=>editAperture('mirror-aperture-cm');
 }
}
