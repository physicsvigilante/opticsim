// Real Chrome acceptance of bounded v23 complete CircleGlass + finite Beam.
// Uses the existing static app and public qualified packages; no fake rays.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=join(root,'test-artifacts/browser-jee-circle-beam-v23');
await mkdir(base,{recursive:true});
const out=await mkdtemp(join(base,'attempt-')),downloads=join(out,'downloads');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms)),timeout=20000;
async function until(fn,pred,label){
 const limit=Date.now()+timeout;let last,err;
 while(Date.now()<limit){try{last=await fn();if(pred(last))return last;}catch(e){err=e.message;}await sleep(125);}
 throw Error(label+' timeout: '+JSON.stringify(last)+' '+(err??''));
}
function browserBinary(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
  if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
 }
 throw Error('Chrome/Chromium unavailable; no browser validation performed');
}
async function freePort(){
 const server=createServer();await new Promise((ok,err)=>server.once('error',err).listen(0,'127.0.0.1',ok));
 const port=server.address().port;await new Promise((ok,err)=>server.close(e=>e?err(e):ok()));return port;
}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((ok,err)=>{
  ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});
 });
 let n=0;const pending=new Map(),listeners=new Set();
 ws.addEventListener('message',e=>{
  let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.method)for(const f of listeners)f(m);
  const f=pending.get(m.id);if(f){pending.delete(m.id);f(m);}
 });
 return {close:()=>ws.close(),onEvent:f=>listeners.add(f),
  send:(method,params={})=>new Promise((ok,err)=>{
   const id=++n,t=setTimeout(()=>{pending.delete(id);err(Error(method+' timeout'));},timeout);
   pending.set(id,r=>{clearTimeout(t);r.error?err(Error(method+': '+r.error.message)):ok(r.result);});
   ws.send(JSON.stringify({id,method,params}));
  })};
}
async function main(){
 await mkdir(downloads,{recursive:true});const {bin,version}=browserBinary();
 const profile=await mkdtemp(join(out,'profile-')),port=await freePort(),origin='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const chrome=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={format:'opticsim-jee-circle-beam-chrome-v1',status:'running',
  browser:version,checks:[],screenshots:[],runtimeErrors:[],network:[],externalModelCalls:0,physicsIndependentlyCertified:false};
 let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,x=>x===200,'local server');
  const portChrome=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome');
  const page=await until(async()=>(await(await fetch('http://127.0.0.1:'+portChrome+'/json/list')).json()).find(x=>x.type==='page'),x=>!!x?.webSocketDebuggerUrl,'page target');
  cdp=await connect(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Network.enable');
  cdp.onEvent(e=>{
   if(e.method==='Runtime.exceptionThrown')report.runtimeErrors.push(e.params.exceptionDetails.text);
   if(e.method==='Network.requestWillBeSent')report.network.push(e.params.request.url);
  });
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const evalJS=async expr=>{
   const r=await cdp.send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});
   if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
   return r.result?.value;
  };
  const state=()=>evalJS('({title:document.getElementById("title").textContent,status:document.getElementById("status").dataset.state,error:document.getElementById("error").textContent,model:document.getElementById("model-label").textContent,results:JSON.parse(document.getElementById("observable-results").dataset.results||"null"),text:document.getElementById("observable-results").textContent,saveDisabled:document.getElementById("save-qualified").disabled,fitDisabled:document.getElementById("fit-results").disabled})');
  const upload=async path=>{
   const dom=await cdp.send('DOM.getDocument',{depth:-1});
   const target=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
   await cdp.send('DOM.setFileInputFiles',{nodeId:target.nodeId,files:[path]});
  };
  const edit=async(id,value)=>evalJS(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||e.disabled)throw Error('Missing enabled field '+${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  const check=name=>report.checks.push({name,status:'pass'});
  const shot=async name=>{const s=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(s.data,'base64'));report.screenshots.push(name+'.png');};
  const folder=join(root,'test-artifacts/llm-authoring/jee-circle-beam-v23');
  const pkg=name=>join(folder,name,'qualified-scene.json');
  await cdp.send('Page.navigate',{url:origin});
  await until(state,x=>x.status==='completed'&&!x.error,'initial viewer');
  await upload(pkg('native-forward'));
  let s=await until(state,x=>x.status==='completed'&&
    x.results?.[0]?.value===4&&x.results?.[1]?.value===8&&
    x.results?.[4]?.value===4&&x.results?.[5]?.value?.length===4,
    'native circle Beam with four real entry-exit pairs');
  assert.match(s.model,/complete circular Glass refraction/i);
  assert.equal(s.error,'');
  assert.equal(s.results[3].value,0);
  assert.equal(s.saveDisabled,false);
  const previousRefraction=s.results[2].value.transmittedAngleDeg;
  check('Qualified v23 native Beam and full CircleGlass load with 4 emissions, 8 actual surface callbacks, 4 detector hits');
  const fields=await evalJS('({width:!!document.getElementById("B1-width"),dir:!!document.getElementById("B1-directionDeg"),radius:!!document.getElementById("G1-radius"),glassY:!!document.getElementById("G1-y"),inside:!!document.getElementById("G1-insideIndex"),outside:!!document.getElementById("G1-outsideIndex"),fresnel:!!document.getElementById("G1-partialReflection")})');
  assert.ok(Object.values(fields).every(Boolean));
  check('Beam direction/width and real circular radius, material pair and Fresnel controls are editable');
  await shot('circle-native-baseline');

  await edit('G1-insideIndex',1.3);
  s=await until(state,x=>x.status==='completed'&&x.results?.[1]?.value===8&&
    x.results?.[4]?.value===4&&Math.abs(x.results?.[2]?.value?.transmittedAngleDeg-previousRefraction)>.1,
    'native circular material-index physical edit');
  assert.equal(s.error,'');
  check('Editing explicit circular refractive index retraces a different native Snell direction');
  await edit('G1-radius',80);
  s=await until(state,x=>x.status==='completed'&&x.results?.[1]?.value===8&&
    x.results?.[4]?.value===4,'native radius edit');
  check('Changing true native circular radius retraces actual two-surface refraction');
  await shot('circle-native-physical-edits');

  await evalJS('document.getElementById("save-qualified").click()');
  const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified scene export');
  const exported=join(downloads,name),bundle=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.equal(bundle.scene.schemaVersion,23);
  assert.equal(bundle.scene.physics.model,'native-parallel-circle-tracing');
  const circle=bundle.scene.physics.components.find(c=>c.id==='G1').parameters;
  assert.equal(circle.radius,80);assert.equal(circle.insideIndex,1.3);
  assert.equal(circle.outsideIndex,1);assert.equal(circle.partialReflection,false);
  assert.equal(Object.hasOwn(bundle,'results'),false);
  check('Qualified saved circular scene preserves real physical edits, no stale result cache');

  await edit('B1-y',72);
  s=await until(state,x=>x.status==='invalid'&&x.results===null,
    'unsafe source near tangent rim after radius edit');
  assert.equal(s.saveDisabled,true);
  check('Near-tangent native Beam refused, old results cleared and qualified export disabled');
  await shot('circle-refused-near-tangent');

  await upload(exported);
  s=await until(state,x=>x.status==='completed'&&x.results?.[1]?.value===8&&
    x.results?.[4]?.value===4,'qualified saved circle reopen');
  check('Reopening qualified circle scene re-executes current native radius and material, not old evidence');
  await shot('circle-reopened');

  await upload(pkg('lower-index-region'));
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===4&&
    x.results?.[1]?.value===8&&x.results?.[2]?.value?.incidentIndex===1.5&&
    x.results?.[2]?.value?.destinationIndex===1,
    'bubble-like lower-index region');
  assert.equal(s.results[4].value,4);
  check('Real native lower-index circular-region control reopens with proper outside-to-inside Snell direction');
  await shot('circle-lower-index');

  await upload(pkg('native-reverse'));
  s=await until(state,x=>x.status==='completed'&&x.results?.[1]?.value===8&&
    x.results?.[4]?.value===4,'real reverse native circle');
  assert.ok(s.results[5].value.every(h=>h.incomingUnit.x<0));
  check('Real reverse-illuminated circular system preserves four native finite detector crossings');
  await shot('circle-reverse');
  assert.deepEqual(report.runtimeErrors,[]);
  const external=report.network.filter(u=>/^https?:/i.test(u)&&!u.startsWith(origin+'/'));
  assert.deepEqual(external,[]);
  check('No external HTTP calls or browser runtime exceptions');
  report.status='passed';
  console.log('JEE_CIRCLE_BEAM_CHROME PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
 }catch(e){report.status='failed';report.error=e.stack||e.message;throw e;}
 finally{
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  cdp?.close();chrome.kill('SIGKILL');server.kill('SIGKILL');
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
 }
}
main().catch(e=>{console.error('JEE circle Beam Chrome FAILED:',e.stack||e.message);process.exitCode=1;});
