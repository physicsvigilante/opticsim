import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';


const root=fileURLToPath(new URL('../',import.meta.url));
export async function runQualifiedChrome({name,format,logPrefix,exercise}) {
const base=join(root,'test-artifacts',name);
await mkdir(base,{recursive:true});
const out=await mkdtemp(join(base,'attempt-')),downloads=join(out,'downloads');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms)),timeout=25000;
async function until(fn,pred,label){
 const end=Date.now()+timeout;let last,err;
 while(Date.now()<end){try{last=await fn();if(pred(last))return last;}
 catch(e){err=e.message;}await sleep(125);}
 throw Error(label+' timeout: '+JSON.stringify(last)+' '+(err??''));
}
function chromeBinary(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
  if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
 }
 throw Error('Chrome unavailable: browser qualification cannot be skipped');
}
async function freePort(){
 const server=createServer();
 await new Promise((ok,err)=>server.once('error',err).listen(0,'127.0.0.1',ok));
 const port=server.address().port;
 await new Promise(ok=>server.close(ok));return port;
}
async function connect(url){
 const ws=new WebSocket(url);
 await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
 let id=0;const pending=new Map(),listeners=[];
 ws.addEventListener('message',e=>{
  let data;try{data=JSON.parse(e.data);}catch{return;}
  if(data.method)for(const listener of listeners)listener(data);
  const cb=pending.get(data.id);
  if(cb){pending.delete(data.id);cb(data);}
 });
 return {close:()=>ws.close(),onEvent:f=>listeners.push(f),
  send:(method,params={})=>new Promise((ok,err)=>{
   const key=++id,t=setTimeout(()=>{pending.delete(key);err(Error(method+' timeout'));},timeout);
   pending.set(key,v=>{clearTimeout(t);v.error?err(Error(method+': '+v.error.message)):ok(v.result);});
   ws.send(JSON.stringify({id:key,method,params}));
  })};
}

 await mkdir(downloads,{recursive:true});
 const {bin,version}=chromeBinary(),profile=await mkdtemp(join(out,'profile-'));
 const port=await freePort(),origin='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/serve.mjs'],
  {cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const chrome=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={format,
  status:'running',browser:version,checks:[],screenshots:[],
  runtimeErrors:[],network:[],nativeImageDetected:false,originalQuestionSolved:false};
 let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,x=>x===200,'local server');
  const chromePort=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome debugger');
  const target=await until(async()=>(await(await fetch('http://127.0.0.1:'+chromePort+'/json/list')).json())
   .find(x=>x.type==='page'),x=>!!x?.webSocketDebuggerUrl,'Chrome page');
  cdp=await connect(target.webSocketDebuggerUrl);
  for(const m of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(m);
  cdp.onEvent(e=>{
   if(e.method==='Runtime.exceptionThrown')report.runtimeErrors.push(e.params.exceptionDetails.text);
   if(e.method==='Network.requestWillBeSent')report.network.push(e.params.request.url);
  });
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const js=async expr=>{
   const r=await cdp.send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});
   if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
   return r.result?.value;
  };
  const state=()=>js('({status:document.getElementById("status")?.dataset.state,error:document.getElementById("error")?.textContent,model:document.getElementById("model-label")?.textContent,results:JSON.parse(document.getElementById("observable-results")?.dataset.results||"null"),saveDisabled:document.getElementById("save-qualified")?.disabled,fitDisabled:document.getElementById("fit-results")?.disabled})');
  const upload=async path=>{
   const dom=await cdp.send('DOM.getDocument',{depth:-1});
   const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
   await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});
  };
  const edit=async(id,value)=>js('(()=>{const e=document.getElementById('+JSON.stringify(id)+');if(!e||e.disabled)throw Error("Missing enabled physical input "+'+JSON.stringify(id)+');e.value='+JSON.stringify(String(value))+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
  const shot=async name=>{
   const b=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
   await writeFile(join(out,name+'.png'),Buffer.from(b.data,'base64'));
   report.screenshots.push(name+'.png');
  };
  const check=text=>report.checks.push({text,passed:true});
  await exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until});
  assert.deepEqual(report.runtimeErrors,[]);
  const external=report.network.filter(u=>/^https?:/.test(u)&&!u.startsWith(origin+'/'));
  assert.deepEqual(external,[]);
  check('No external model/network call or browser runtime exception');
  report.status='passed';
  console.log(logPrefix+' '+JSON.stringify({
   status:'passed',checks:report.checks.length,screenshots:report.screenshots.length,
   nativeSource:'pinned-PhyDemo',imageDetected:false
  }));
 }catch(e){report.status='failed';report.error=e.stack||e.message;throw e;}
 finally{
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  cdp?.close();chrome.kill('SIGKILL');server.kill('SIGKILL');
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
 }
}
