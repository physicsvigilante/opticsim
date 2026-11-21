import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-pre-transfer-audit',format:'opticsim-audit-chrome-v1',
 logPrefix:'AUDIT_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,check,until}){
  await cdp.send('Page.navigate',{url:origin+'/?scene=single-lens'});
  await until(state,s=>s.status==='completed','initial example');
  const selectMirror="const picker=document.getElementById('examples');picker.value='plane-mirror';const load=picker.onchange;picker.onchange=e=>{picker.onchange=load;window.exampleFinished=load(e)};picker.dispatchEvent(new Event('change'));";
  for(const succeed of [true,false]){
   // Hold a buffered, genuine bundled response after fetching from the local server.
   await js("(async()=>{const response=await fetch('scenes/plane-mirror.json');const body=await response.text();const original=window.fetch;window.fetch=()=>new Promise(resolve=>{window.releaseExample=()=>{window.fetch=original;resolve(new Response(body,{status:"+ (succeed?200:503) +"}));};});"+selectMirror+"})()");
   const value=succeed?42:43;
   await edit('source-1-y',value);
   await until(state,s=>s.status==='completed','newer physical edit completed');
   await js("(async()=>{releaseExample();await window.exampleFinished})()");
   const readout=await js("({y:document.getElementById('source-1-y')?.value,example:document.getElementById('examples').value,scene:new URL(location.href).searchParams.get('scene')})");
   assert.deepEqual(readout,{y:String(value),example:'single-lens',scene:'single-lens'});
   assert.equal((await state()).status,'completed');
   check('A stale '+(succeed?'success':'failure')+' preserves the accepted edit and starting example');
  }
  await js('(()=>{'+selectMirror+'})()');
  await until(state,s=>s.status==='completed'&&s.model.includes('Plane mirror'),'current request loads normally');
  for(const [name,label,geometry] of [
   ['native-parallel-planar-mirror-v26','planar interface and return mirror','dielectric interface'],
   ['native-parallel-two-plane-mirror-v27','dielectric slab and return mirror','at least 1 mm'],
   ['native-post-lens-aperture-v28','ideal lens and downstream aperture','opaque arms']
  ]){
   const problem=JSON.parse(await readFile(join(root,'examples',name+'.json'),'utf8'));
   const path=join(downloads,name+'.json');
   await writeFile(path,JSON.stringify(prepareScene(problem.physical).document));
   await upload(path);
   await until(state,s=>s.status==='completed'&&s.model.includes(label),name+' label');
   const guidance=await js("document.getElementById('parameter-guidance').textContent");
   const scope=await js("document.getElementById('physical-note').textContent");
   assert.ok(guidance.includes(geometry));
   assert.ok(scope.includes(name.endsWith('v28')?'sampled':'Fresnel'));
   check(name+' shows its own geometry and reflection policy');
  }
 }});
