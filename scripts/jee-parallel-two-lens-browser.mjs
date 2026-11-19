// Real Chrome acceptance of schema v20 Beam and two independently centred lenses.
// Uses the existing static app and public qualified packages; no fake rays.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,writeFile,rm,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=join(root,'test-artifacts/browser-jee-parallel-two-lens-v20');
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
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
 const report={format:'opticsim-jee-two-lens-chrome-v1',status:'running',
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
  const folder=join(root,'test-artifacts/llm-authoring/jee-parallel-two-lens-v20');
  const pkg=name=>join(folder,name,'qualified-scene.json');
  const mean=events=>events.reduce((v,h)=>v+h.pointMm.y,0)/events.length;
  await cdp.send('Page.navigate',{url:origin});
  await until(state,s=>s.status==='completed'&&!s.error,'initial viewer');
  await upload(pkg('baseline'));
  let s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===8&&
    x.results?.[1]?.value===8&&x.results?.[2]?.value===8,'v20 native baseline');
  assert.match(s.model,/offset two-lens/i);
  assert.equal(s.results[3].value.length,8);assert.equal(s.results[4].value.length,8);
  assert.equal(s.saveDisabled,false);
  const firstMean=mean(s.results[3].value);
  check('Qualified two-offset-lens Beam loads with eight real native detector samples per detector');
  const fields=await evalJS('({b:!!document.getElementById("B1-width"),a:!!document.getElementById("L1-y"),c:!!document.getElementById("L2-y"),f:!!document.getElementById("L2-focalLength"),h:!!document.getElementById("L2-apertureHeight")})');
  assert.ok(fields.a&&fields.b&&fields.c&&fields.f&&fields.h);
  check('Both independent transverse lens centres and lens geometry are editable');
  await shot('two-lens-baseline');

  await edit('L2-y',3);
  s=await until(state,x=>x.status==='completed'&&x.results?.[3]?.value?.length===8&&
    Math.abs(mean(x.results[3].value)-firstMean)>1,'native transverse-centre edit');
  assert.equal(s.saveDisabled,false);
  check('Physical second-lens y edit changes native measured detector positions');
  await shot('two-lens-y-edited');
  await evalJS('document.getElementById("save-qualified").click()');
  const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'saved qualified scene');
  const exported=join(downloads,name),bundle=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.equal(bundle.scene.schemaVersion,20);
  assert.equal(bundle.scene.physics.components.find(c=>c.id==='L2').parameters.y,3);
  assert.equal(bundle.scene.physics.components.find(c=>c.id==='L1').parameters.y,0);
  assert.equal(Object.hasOwn(bundle,'results'),false);
  check('Qualified saved scene retains actual offset edit but contains no stale native readings');

  await edit('L2-apertureHeight',70);
  await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===8,'narrowed lens before rim contact');
  await edit('L2-y',0);
  s=await until(state,x=>x.status==='invalid'&&x.results===null,'refracted sample second rim refusal');
  assert.equal(s.saveDisabled,true);
  check('Risky refracted second-lens rim contact blocks export and suppresses prior readings');
  await shot('two-lens-invalid-rim');
  await upload(exported);
  s=await until(state,x=>x.status==='completed'&&x.results?.[3]?.value?.length===8,'qualified v20 reopen');
  assert.ok(Math.abs(mean(s.results[3].value)-firstMean)>1);
  check('Reopened qualified v20 scene retraces edited native optics instead of inheriting stale evidence');
  await shot('two-lens-reopened');
  // Reviewer F-01: Fit Results must include both REAL native offset segments,
  // even when native rays miss one lens completely. Test the viewer's actual
  // saved camera, not a repeat of apparatusPoints' own predicted endpoints.
  await upload(pkg('strong-offset-fit'));
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===8&&
    x.results?.[1]?.value===0&&x.results?.[2]?.value===0&&!x.fitDisabled,
    'independently displaced native lenses');
  assert.equal(s.saveDisabled,false);
  await evalJS('document.getElementById("fit-results").click()');
  const fitNote=await until(()=>evalJS('document.getElementById("fit-note").textContent'),
    x=>x.includes('Fit includes apparatus'),'actual Fit Results button');
  assert.doesNotMatch(fitNote,/Apparatus exceeds/);
  const viewport=await evalJS('({width:document.getElementById("light").width,height:document.getElementById("light").height})');
  await until(state,x=>x.status==='completed'&&!x.fitDisabled&&!x.saveDisabled,'completed fitted v20 viewer');
  // Preserve the earlier physical-edit package under a distinct evidence name.
  // Chrome can reuse a filename when exporting again; a renamed first file
  // makes the second downloaded package unambiguous without changing the app.
  await rename(exported,join(downloads,'pre-fit-qualified-scene.json'));
  const previousDownloads=new Set(await readdir(downloads));
  await evalJS('document.getElementById("save-qualified").click()');
  const fittedName=await until(async()=>(await readdir(downloads))
    .find(n=>n.endsWith('.json')&&!previousDownloads.has(n)),Boolean,'fitted qualified download');
  const fittedBundle=await parseQualifiedBundle(await readFile(join(downloads,fittedName),'utf8'));
  assert.equal(fittedBundle.scene.schemaVersion,20);
  const centred=id=>fittedBundle.scene.physics.components.find(c=>c.id===id).parameters.y;
  assert.equal(centred('L1'),720);
  assert.equal(centred('L2'),-650);
  const actual=core.compile(fittedBundle.scene).native.objs.filter(c=>c.type==='IdealLens');
  assert.equal(actual.length,2);
  const camera=fittedBundle.scene.presentation.view;
  const padding=Math.min(48,viewport.width*.12,viewport.height*.12);
  for(const lens of actual)for(const tip of [lens.p1,lens.p2]){
    const x=(tip.x-camera.x)*camera.zoom,y=(-tip.y-camera.y)*camera.zoom;
    assert.ok(Math.abs(x)<=viewport.width/2-padding+1e-7,'fitted native lens endpoint out of horizontal viewport');
    assert.ok(Math.abs(y)<=viewport.height/2-padding+1e-7,
      'fitted native offset endpoint out of vertical viewport: '+JSON.stringify({tip,camera,viewport}));
  }
  assert.equal(Object.hasOwn(fittedBundle,'results'),false);
  check('Real Chrome Fit Results includes both strongly offset native finite lenses with a truthful saved viewport');
  await shot('two-lens-strongly-offset-fit');
  assert.deepEqual(report.runtimeErrors,[]);
  const external=report.network.filter(u=>/^https?:/i.test(u)&&!u.startsWith(origin+'/'));
  assert.deepEqual(external,[]);
  check('No external HTTP calls or browser runtime exceptions');
  report.status='passed';
  console.log('JEE_TWO_LENS_CHROME PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
 }catch(e){report.status='failed';report.error=e.stack||e.message;throw e;}
 finally{
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  cdp?.close();chrome.kill('SIGKILL');server.kill('SIGKILL');
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
 }
}
main().catch(e=>{console.error('JEE two-lens Chrome FAILED:',e.stack||e.message);process.exitCode=1;});
