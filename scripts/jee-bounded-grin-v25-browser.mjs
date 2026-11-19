// Real Chrome checks for held native v25 GRIN: real rays, fail-closed numerical measurements.
// Canvas uses pinned native PhyDemo. No drawn or synthesized rays are supplied.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const top=join(root,'test-artifacts/browser-jee-bounded-grin-v25');
await mkdir(top,{recursive:true});
const out=await mkdtemp(join(top,'attempt-')),downloads=join(out,'downloads');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms)),timeout=25000;
async function until(fn,pred,label){
 const end=Date.now()+timeout;let last,error;
 while(Date.now()<end){try{last=await fn();if(pred(last))return last;}catch(e){error=e.message;}await pause(120);}
 throw Error(label+' timeout: '+JSON.stringify(last)+' '+(error||''));
}
function chromeBinary(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
  if(!r.error&&r.status===0)return {bin,version:r.stdout.trim()};
 }
 throw Error('No Chrome executable; real browser validation MUST fail');
}
async function freePort(){
 const server=createServer();await new Promise((ok,no)=>server.once('error',no).listen(0,'127.0.0.1',ok));
 const port=server.address().port;await new Promise(ok=>server.close(ok));return port;
}
async function connect(url){
 const ws=new WebSocket(url),pending=new Map(),events=[];let n=0;
 await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{let r;try{r=JSON.parse(e.data);}catch{return;}
  if(r.method)for(const f of events)f(r);
  const cb=pending.get(r.id);if(cb){pending.delete(r.id);cb(r);}
 });
 return {close:()=>ws.close(),on:f=>events.push(f),send:(method,params={})=>new Promise((ok,no)=>{
  const id=++n,t=setTimeout(()=>{pending.delete(id);no(Error(method+' timeout'));},timeout);
  pending.set(id,r=>{clearTimeout(t);r.error?no(Error(method+': '+r.error.message)):ok(r.result);});
  ws.send(JSON.stringify({id,method,params}));
 })};
}
async function main(){
 await mkdir(downloads,{recursive:true});
 const {bin,version}=chromeBinary(),port=await freePort(),origin='http://127.0.0.1:'+port;
 const profile=await mkdtemp(join(out,'profile-'));
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={format:'opticsim-jee-bounded-grin-v25-real-chrome-v1',status:'running',browser:version,
  checks:[],screenshots:[],runtimeErrors:[],network:[],originalQuestionSolved:false,nativeImageDetected:false};
 let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,s=>s===200,'local server');
  const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome debugger');
  const target=await until(async()=>(await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json()).find(x=>x.type==='page'),x=>!!x?.webSocketDebuggerUrl,'page target');
  cdp=await connect(target.webSocketDebuggerUrl);
  for(const method of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(method);
  cdp.on(e=>{if(e.method==='Runtime.exceptionThrown')report.runtimeErrors.push(e.params.exceptionDetails?.text);
   if(e.method==='Network.requestWillBeSent')report.network.push(e.params.request.url);});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const js=async expr=>{const r=await cdp.send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});
   if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>js('({title:document.getElementById("title")?.textContent,status:document.getElementById("status")?.dataset.state,error:document.getElementById("error")?.textContent,results:JSON.parse(document.getElementById("observable-results")?.dataset.results||"null"),saveDisabled:document.getElementById("save-qualified")?.disabled,fitDisabled:document.getElementById("fit-results")?.disabled,model:document.getElementById("model-label")?.textContent})');
  const upload=async path=>{const dom=await cdp.send('DOM.getDocument',{depth:-1});
   const id=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
   await cdp.send('DOM.setFileInputFiles',{nodeId:id.nodeId,files:[path]});};
  const edit=(id,value)=>js('(()=>{const e=document.getElementById('+JSON.stringify(id)+');if(!e||e.disabled)throw Error("Missing physical field");e.value='+JSON.stringify(String(value))+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
  const shot=async name=>{const img=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
   await writeFile(join(out,name+'.png'),Buffer.from(img.data,'base64'));report.screenshots.push(name+'.png');};
  const check=name=>report.checks.push({name,passed:true});
  const folder=join(root,'test-artifacts/llm-authoring/jee-bounded-grin-v25');
  const pkg=join(folder,'baseline','qualified-scene.json');
  await cdp.send('Page.navigate',{url:origin});
  await until(state,x=>x.status==='completed'&&!x.error,'initial app');
  await upload(pkg);
  let s=await until(state,x=>x.status==='completed'&&x.results?.length===3&&
   x.results[0].value===1&&x.results[1].value===1&&x.results[2].value?.length===1,
   'v25 genuine GRIN baseline');
  assert.equal(s.error,'');assert.equal(s.saveDisabled,false);
  assert.match(s.model,/graded-index Glass/i);
  const physical=await js('document.getElementById("physical-note")?.textContent');
  assert.match(physical,/0.002 mm/);
  check('Imported actual native GRIN source and one detector produces qualified bounded readings');
  const controls=await js('({source:!!document.getElementById("S1-mode-single-ray"),noFullCircle:!document.getElementById("S1-mode-full-circle"),glass:!!document.getElementById("G1-indexSquaredAtAxis"),gradient:!!document.getElementById("G1-gradientLength"),detector:!!document.getElementById("D1-x"),sourceX:!!document.getElementById("S1-x")})');
  assert.ok(Object.values(controls).every(Boolean),JSON.stringify(controls));
  check('v25 exposes one exact source and scalar GRIN parameters, but no arbitrary equation editor');
  const cam=await js('({zoom:Number(document.getElementById("zoom").value),max:Number(document.getElementById("zoom").max),fitDisabled:document.getElementById("fit-results").disabled})');
  assert.equal(cam.zoom,80,'GRIN body needs a native mm-scale close-up');
  assert.equal(cam.max,100,'Only v25 exposes extended presentation zoom');
  assert.equal(cam.fitDisabled,false);
  check('v25 camera begins at a legible 80 pixels/mm without changing physical inputs');
  const beforeFit=JSON.stringify(s.results[2].value);
  await js('document.getElementById("fit-results").click()');
  const fitted=await until(async()=>({zoom:Number(await js('document.getElementById("zoom").value')),scene:await state()}),
    x=>x.zoom>80&&x.zoom<=100&&x.scene.status==='completed'&&x.scene.results?.[2]?.value?.length===1,
    'presentation-only GRIN fit');
  assert.equal(JSON.stringify(fitted.scene.results[2].value),beforeFit,
    'Zoom cannot change actual pinned-native crossing measurements');
  check('Fitting tiny physical GRIN scene increases zoom and preserves the native detector crossing');
  await shot('v25-grin-fit-closeup');
  await shot('v25-grin-baseline');
  const originalHits=JSON.stringify(s.results[2].value);
  await edit('S1-x',.2);
  s=await until(state,x=>x.status==='completed'&&x.results?.[2]?.value?.length===1&&
   JSON.stringify(x.results[2].value)!==originalHits,'native source revision');
  assert.equal(s.results[1].value,1);
  check('Source position edit recomputes actual native Euler ray and detector hit');
  await shot('v25-grin-source-edited');
  await js('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>(await readdir(downloads)).find(x=>x.endsWith('.json')),Boolean,'qualified GRIN export');
  const exported=join(downloads,filename);
  const bundle=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.equal(bundle.scene.schemaVersion,25);
  assert.equal(bundle.scene.physics.components.find(x=>x.id==='S1').parameters.x,.2);
  assert.equal(Object.hasOwn(bundle,'results'),false);
  check('Qualified export preserves the physical source edit but not cached native readings');
  await edit('S1-x',0);
  s=await until(state,x=>x.status==='invalid'&&x.results===null,'source-boundary refusal');
  assert.equal(s.saveDisabled,true);
  check('Invalid source on the GRIN boundary invalidates the whole scene and withholds results');
  await shot('v25-grin-boundary-refused');
  await upload(exported);
  s=await until(state,x=>x.status==='completed'&&x.results?.[2]?.value?.length===1,
   'qualified reopen');
  assert.equal(s.error,'');
  check('Reopening edited qualified scene recomputes native GRIN rather than reusing old measurements');
  assert.deepEqual(report.runtimeErrors,[]);
  assert.deepEqual(report.network.filter(u=>/^https?:/i.test(u)&&!u.startsWith(origin+'/')),[]);
  check('No JavaScript exceptions and no requests to another origin');
  report.status='passed';
  console.log('JEE_BOUNDED_GRIN_V25_CHROME PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots; '+version);
 }catch(e){report.status='failed';report.error=e.stack||e.message;throw e;}
 finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  cdp?.close();browser.kill('SIGKILL');server.kill('SIGKILL');
  await rm(profile,{recursive:true,force:true}).catch(()=>{});}
}
main().catch(e=>{console.error('JEE GRIN v25 BROWSER FAILED:',e.stack||e.message);process.exitCode=1;});
