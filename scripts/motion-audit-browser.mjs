// Regression for asynchronous edits, stale evidence and failed imports.
// The real portable bundle and native core run unmodified; only WebCrypto
// completion is delayed by the test to deterministically exercise concurrency.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeU2Motion} from '../src/motion-example.js';
import {reviseMotionRayExperiment} from '../src/motion-ray-controls.js';
const root=resolve('.'),out=resolve('test-artifacts/browser-source-motion/audit');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,accept,label){let last,error;const end=Date.now()+25000;
 while(Date.now()<end){try{last=await fn();if(accept(last))return last;}catch(e){error=e.message;}await sleep(50);}
 throw Error(label+': '+JSON.stringify(last)+' '+(error||''));}
function chrome(){for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
 const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};}throw Error('Chrome required');}
async function connect(url){const ws=new WebSocket(url),pending=new Map();let n=0;
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
 ws.addEventListener('message',({data})=>{const r=JSON.parse(data),fn=pending.get(r.id);if(fn){pending.delete(r.id);fn(r);}});
 return {close:()=>ws.close(),send:(method,params={})=>new Promise((ok,fail)=>{
  const id=++n,timer=setTimeout(()=>{pending.delete(id);fail(Error(method+' timeout'));},25000);
  pending.set(id,r=>{clearTimeout(timer);r.error?fail(Error(r.error.message)):ok(r.result);});ws.send(JSON.stringify({id,method,params}));})};}
async function main(){
 await mkdir(out,{recursive:true});const {bin,version}=chrome(),profile=await mkdtemp(join(out,'profile-'));
 const example=JSON.parse(await readFile('examples/u2-motion.json','utf8'));
 const imported=await reviseMotionRayExperiment(await makeU2Motion(example),{brightness:.15});
 const importFile=join(out,'replacement.experiment.json');await writeFile(importFile,JSON.stringify(imported));
 const oversized=join(out,'oversized.json');await writeFile(oversized,' '.repeat(1500001));
 const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1440,1100','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={browser:version,checks:[],screenshots:[],errors:[]};let cdp;
 try{
  const port=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'debug port');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();cdp=await connect(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.bringToFront');
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>evaluate(`(()=>{const e=id=>document.getElementById(id);if(!['native-state','native-stage','ray-brightness','save-report','ray-source-mode'].every(e))return null;return {state:e('native-state').dataset.state,hash:e('experiment-hash').textContent,brightness:e('ray-brightness').value,sourceMode:e('ray-source-mode').value,direction:e('ray-direction').value,error:e('ray-control-error').hidden?null:e('ray-control-error').textContent,loadError:e('error').hidden?null:e('error').textContent,playDisabled:e('play').disabled,timeDisabled:e('time').disabled,saveDisabled:e('save-motion').disabled,frameDisabled:e('save-frame').disabled,reportDisabled:e('save-report').disabled,viewport:e('native-stage').dataset.viewport?JSON.parse(e('native-stage').dataset.viewport):null};})()`);
  const done=s=>s&&['completed','completed-with-warnings'].includes(s.state);
  const change=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1});const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#open-motion'});await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});};
  const check=name=>report.checks.push({name,status:'pass'});
  const gate=()=>evaluate(`(()=>{const original=crypto.subtle.digest;let held=false,release;crypto.subtle.digest=function(...args){const result=original.apply(this,args);if(held)return result;held=true;return new Promise(resolve=>{release=()=>result.then(resolve);});};globalThis.releaseAuditDigest=()=>{crypto.subtle.digest=original;release?.();};})()`);
  const release=()=>evaluate('releaseAuditDigest()');
  await cdp.send('Page.navigate',{url:pathToFileURL(resolve('test-artifacts/motion-demo/index.html')).href});
  let s=await until(state,done,'portable initial frame');
  assert.equal(s.loadError,null);
  await evaluate("document.getElementById('ray-settings').open=true");
  assert.deepEqual(await evaluate(`(()=>{const e=document.getElementById('ray-custom-wrap');return {hidden:e.hidden,display:getComputedStyle(e).display};})()`),{hidden:true,display:'none'});
  await change('ray-sampling','custom');
  assert.equal(await evaluate("getComputedStyle(document.getElementById('ray-custom-wrap')).display==='none'"),false);
  await change('ray-sampling','dense');
  check('Custom sampling fields follow the hidden attribute rather than leaking through flex styling');

  const oldHash=s.hash;
  await gate();await change('ray-brightness','0.2');
  s=await state();assert.equal(s.state,'validating');
  for(const key of ['playDisabled','timeDisabled','saveDisabled','frameDisabled','reportDisabled'])assert.equal(s[key],true,key+' while edit pending');
  assert.equal(s.viewport,null);
  await evaluate("document.getElementById('play').click()");
  assert.equal((await state()).state,'validating');
  await release();s=await until(state,r=>done(r)&&r.hash!==oldHash&&r.brightness==='0.2','finished physical edit');
  check('Pending physical edits disable playback and export and clear earlier frame evidence');

  const beforeZoom=s.viewport;
  await evaluate("document.getElementById('zoom-in').click()");
  const pendingCamera=await state();assert.equal(pendingCamera.reportDisabled,true);assert.equal(pendingCamera.frameDisabled,true);assert.equal(pendingCamera.viewport,null);
  s=await until(state,r=>done(r)&&r.viewport?.scale>beforeZoom.scale,'new native camera');
  assert.equal(s.viewport.zoomFactor,1.5);assert.ok(Math.abs(s.viewport.relativeZoom-1.5)<1e-10);
  check('A queued camera change immediately withholds stale reports until the actual transform is rendered');

  await change('ray-source-mode','full-circle');s=await until(state,r=>done(r)&&r.sourceMode==='full-circle','full circle');
  const fullHash=s.hash;
  await change('ray-direction','999');s=await until(state,r=>done(r)&&r.error,'rejected direction');
  assert.equal(s.hash,fullHash);
  await change('ray-source-mode','single-ray');s=await until(state,r=>done(r)&&/Enter a direction/.test(r.error||''),'unconfirmed direction');
  assert.equal(s.sourceMode,'full-circle');assert.equal(s.hash,fullHash);
  check('Rejected direction input cannot silently authorize a previous direction for a single ray');

  await gate();await change('ray-brightness','2');assert.equal((await state()).state,'validating');
  await upload(importFile);s=await until(state,r=>done(r)&&r.hash==='Experiment SHA-256: '+imported.integritySha256,'replacement during old edit');
  await release();await sleep(150);s=await state();
  assert.equal(s.hash,'Experiment SHA-256: '+imported.integritySha256);assert.equal(s.brightness,'0.15');assert.equal(s.error,null);
  check('A late failed edit cannot overwrite a newly loaded experiment or attach its error to that experiment');

  await upload(oversized);s=await until(state,r=>r?.state==='invalid'&&r.loadError,'oversized import');
  assert.match(s.loadError,/1.5 MB/);
  for(const key of ['playDisabled','timeDisabled','saveDisabled','frameDisabled','reportDisabled'])assert.equal(s[key],true,key+' after invalid import');
  assert.equal(s.viewport,null);assert.equal(s.hash,'');
  const painted=await evaluate(`['light','below','above','grid','guides','image-plot'].map(id=>{const c=document.getElementById(id),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {id,painted:data.some((v,i)=>i%4===3&&v!==0)};})`);
  assert.ok(painted.every(x=>!x.painted),JSON.stringify(painted));
  check('Oversized imports clear native canvases under their real transforms and disable all stale exports');

  await upload(importFile);s=await until(state,r=>done(r)&&r.brightness==='0.15','recovery after bad import');
  assert.equal(s.loadError,null);assert.equal(s.saveDisabled,false);
  await evaluate("document.getElementById('ray-settings').open=true");
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(join(out,'corrected-controls.png'),Buffer.from(shot.data,'base64'));report.screenshots.push('corrected-controls.png');
  check('A valid experiment can be reopened after a rejected import without stale ray settings');
 }catch(error){report.errors.push(error.stack);throw error;}
 finally{
  cdp?.close();browser.kill();
  try{await until(async()=>browser.exitCode!==null||browser.signalCode!==null,Boolean,'shutdown');await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
  finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 console.log('Motion correction audit PASS: '+report.checks.length+' real-browser checks.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
