// Real Chrome acceptance of bounded v21 semicircular Glass + native Beam.
// Uses the existing static app and public qualified packages; no fake rays.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=join(root,'test-artifacts/browser-jee-semicircular-beam-v21');
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
 const report={format:'opticsim-jee-semicircular-chrome-v1',status:'running',
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
  const folder=join(root,'test-artifacts/llm-authoring/jee-semicircular-beam-v21');
  const pkg=name=>join(folder,name,'qualified-scene.json');
  await cdp.send('Page.navigate',{url:origin});
  await until(state,x=>x.status==='completed'&&!x.error,'initial browser app');
  await upload(pkg('baseline'));
  let s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===4&&
    x.results?.[1]?.value===8&&x.results?.[5]?.value===4,'real native semicircular qualified import');
  assert.match(s.model,/flat \+ curved Glass/i);
  assert.equal(s.error,'');assert.equal(s.results[2].value['face-flat'].interactions,4);
  assert.equal(s.results[2].value['face-arc'].interactions,4);
  assert.equal(s.results[6].value.length,4);
  const oldAngle=s.results[3].value.transmittedAngleDeg;
  assert.ok(Math.abs(oldAngle-30)<1e-6);
  assert.equal(s.saveDisabled,false);
  check('Qualified v21 Beam + native Glass arc imports with 4 real flat entries, curved exits and detector crossings');
  const fields=await evalJS('({beam:!!document.getElementById("B1-directionDeg"),radius:!!document.getElementById("G1-radius"),glassY:!!document.getElementById("G1-y"),index:!!document.getElementById("G1-insideIndex"),fresnel:!!document.getElementById("G1-partialReflection")})');
  assert.ok(fields.beam&&fields.radius&&fields.glassY&&fields.index&&fields.fresnel);
  check('Explicit native source, radius, transverse centre, optical index and Fresnel policy are editable');
  await shot('semicircle-native-baseline');

  await edit('G1-insideIndex',1.5);
  s=await until(state,x=>x.status==='completed'&&x.results?.[3]?.value?.transmittedAngleDeg!=null&&
    Math.abs(x.results[3].value.transmittedAngleDeg-oldAngle)>1,'native refractive-index edit');
  assert.equal(s.results[5].value,4);
  check('Changing the physical glass index retraces a different native transmitted angle');
  await edit('G1-radius',120);
  s=await until(state,x=>x.status==='completed'&&x.results?.[2]?.value?.['face-arc']?.interactions===4,'native radius edit');
  assert.equal(s.results[5].value,4);
  check('Changing semicircle radius redraws the true curved boundary and completes native re-execution');
  await shot('semicircle-native-edits');

  await evalJS('document.getElementById("save-qualified").click()');
  const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified export');
  const exported=join(downloads,name),bundle=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.equal(bundle.scene.schemaVersion,21);
  const glass=bundle.scene.physics.components.find(c=>c.id==='G1').parameters;
  assert.equal(glass.radius,120);
  assert.equal(glass.insideIndex,1.5);
  assert.equal(glass.outsideIndex,1);
  assert.equal(glass.partialReflection,false);
  assert.equal(Object.hasOwn(bundle,'results'),false);
  check('Qualified export retains both native glass physical edits but no stale readings');

  await edit('B1-y',-30);
  s=await until(state,x=>x.status==='invalid'&&x.results===null,'source into enlarged flat/arc seam');
  assert.equal(s.saveDisabled,true);
  check('Invalid near-seam Beam shift clears native readings and blocks qualified save');
  await shot('semicircle-refused-seam');
  await upload(exported);
  s=await until(state,x=>x.status==='completed'&&x.results?.[5]?.value===4,'reopen valid saved glass');
  assert.ok(Math.abs(s.results[3].value.transmittedAngleDeg-oldAngle)>1);
  check('Reopened qualified glass retraces current physical radius and refractive index, not previous hit data');
  await shot('semicircle-reopened');

  await upload(pkg('native-tir'));
  s=await until(state,x=>x.status==='completed'&&x.results?.[4]?.value>0&&x.results?.[5]?.value===0,'real native curved-face TIR');
  assert.deepEqual(s.results[6].value,[]);
  check('Native TIR scene completes with curved-face reflections and a genuine zero sampled detector count');
  await shot('semicircle-tir');
  assert.deepEqual(report.runtimeErrors,[]);
  const external=report.network.filter(u=>/^https?:/i.test(u)&&!u.startsWith(origin+'/'));
  assert.deepEqual(external,[]);
  check('No external HTTP calls or browser runtime exceptions');
  report.status='passed';
  console.log('JEE_SEMICIRCLE_CHROME PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
 }catch(e){report.status='failed';report.error=e.stack||e.message;throw e;}
 finally{
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  cdp?.close();chrome.kill('SIGKILL');server.kill('SIGKILL');
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
 }
}
main().catch(e=>{console.error('JEE semicircular Beam Chrome FAILED:',e.stack||e.message);process.exitCode=1;});
