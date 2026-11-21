// Real Chrome acceptance of versioned v27 Beam+PlaneGlass+Mirror return.
// The unchanged browser imports a public qualified scene and PhyDemo
// supplies actual rays. No DOM-drawn light path, fake optics, or image count.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
import {beamTwoPlaneMirrorSafetyWitness} from '../src/native-beam-two-plane-mirror-v27.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=join(root,'test-artifacts/browser-native-two-plane-mirror-v27');
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
async function main(){
 await mkdir(downloads,{recursive:true});
 const {bin,version}=chromeBinary(),profile=await mkdtemp(join(out,'profile-'));
 const port=await freePort(),origin='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/serve.mjs'],
  {cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const chrome=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={format:'opticsim-native-two-plane-slab-mirror-v27-chrome-v1',
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
  const pkg=join(root,'test-artifacts/llm-authoring/native-two-plane-mirror-v27/baseline-separated-mirror/qualified-scene.json');
  await cdp.send('Page.navigate',{url:origin});
  await until(state,s=>s.status==='completed'&&!s.error,'initial viewer');
  await upload(pkg);
  let current=await until(state,s=>s.status==='completed'&&!s.error&&
   s.results?.[0]?.value===8&&s.results?.[1]?.value===16&&
   s.results?.[3]?.value===16&&s.results?.[4]?.value===8&&
   s.results?.[5]?.value===16&&s.results?.[6]?.value?.length===16,
   'import real native v27 Beam through two-plane slab and separated Mirror');
  assert.equal(current.saveDisabled,false);
  check('Qualified v27 Beam imports 8 true rays, 16 encounters at each of two PlaneGlass surfaces, 8 Mirror reflections and 16 detector crossings');
  const controls=await js('({beam:!!document.getElementById("B1-width"),angle:!!document.getElementById("B1-directionDeg"),front:!!document.getElementById("I1-positiveIndex"),rear:!!document.getElementById("I2-negativeIndex"),mirror:!!document.getElementById("M1-x"),detector:!!document.getElementById("D1-x"),fresnel:!!document.getElementById("I2-partialReflection")})');
  assert.ok(Object.values(controls).every(Boolean),JSON.stringify(controls));
  check('Native Beam width/direction, both real glass interfaces, physical index fields, separated finite Mirror and source-side detector controls exist');
  await shot('v27-original-real-return');
  const baseline=(await parseQualifiedBundle(await readFile(pkg,'utf8'))).scene;
  const samples=beamTwoPlaneMirrorSafetyWitness(baseline.physics.components,baseline.simulation.rayDensity).samples;
  for(const [id,upper] of [['M1',Math.max(...samples.map(s=>s.mirrorY))],
    ['D1',Math.max(...samples.map(s=>s.detectorY[0].outbound))]]) {
   const target=baseline.physics.components.find(c=>c.id===id).parameters;
   await edit(id+'-y',upper+.1005-target.length/2);
   await until(state,s=>s.status==='invalid' && s.results===null && s.saveDisabled && s.error.includes('0.001 mm'),id+' numerical endpoint refusal');
   check(id+' endpoint edit inside the numerical reserve refuses and clears prior readings');
   await upload(pkg);
   await until(state,s=>s.status==='completed' && s.results?.[5]?.value===16,'restore baseline after endpoint refusal');
  }
  await edit('B1-width',20);
  current=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===4&&
   s.results?.[1]?.value===8&&s.results?.[3]?.value===8&&
   s.results?.[4]?.value===4&&s.results?.[5]?.value===8,
   'physical Beam width edit must retrace both native slab surfaces and Mirror');
  check('Editing Beam width changes real native source emission and matching return event counts');
  await shot('v27-width20-returns');
  await edit('I1-positiveIndex',1.8);
  current=await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled===true,
   'changing only first slab interface index must be refused as inconsistent material');
  check('Single-face material edit refuses mismatched slab and clears old qualified readings');
  await edit('I2-negativeIndex',1.8);
  current=await until(state,s=>s.status==='completed'&&s.results?.[4]?.value===4&&
   s.results?.[5]?.value===8&&s.results?.[2]?.value?.destinationIndex===1.8,
   'changing BOTH slab interface indices returns genuine two-plane Snell propagation');
  assert.equal(current.saveDisabled,false);
  check('Coherent two-surface material change retraces actual native slab and mirror return');
  await shot('v27-index1point8');
  await js('document.getElementById("save-qualified").click()');
  const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
  const exported=join(downloads,name),bundle=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.equal(bundle.scene.schemaVersion,27);
  assert.equal(bundle.scene.physics.model,'native-parallel-slab-mirror-tracing');
  const byId=id=>bundle.scene.physics.components.find(c=>c.id===id).parameters;
  assert.equal(byId('B1').width,20);
  assert.equal(byId('I1').positiveIndex,1.8);
  assert.equal(byId('I2').negativeIndex,1.8);
  assert.equal(byId('I2').positiveIndex,1);
  assert.equal(byId('I1').partialReflection,false);
  assert.equal(byId('I2').partialReflection,false);
  assert.equal(byId('M1').x,90);
  assert.equal(byId('M1').length,420);
  assert.equal(Object.hasOwn(bundle,'results'),false);
  check('Qualified export retains all true native components and exact edited physical data, not cached ray positions');
  await edit('M1-x',60);
  current=await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled===true,
   'co-planar touching mirror and rear interface must be rejected');
  check('Mirror directly touching the second PlaneGlass is refused, preventing the raw coincident collision-order anomaly');
  await shot('v27-contact-mirror-refused');
  await upload(exported);
  current=await until(state,s=>s.status==='completed'&&s.results?.[4]?.value===4,
   'restore complete two-plane Mirror after rejected contact');
  await edit('M1-length',72);
  current=await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled===true,
   'too-short finite Mirror must fail v27 before native output');
  check('Clipped downstream finite Mirror refuses and suppresses stale native readings');
  await shot('v27-clipped-mirror-refused');
  await upload(exported);
  current=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===4&&
   s.results?.[1]?.value===8&&s.results?.[3]?.value===8&&
   s.results?.[4]?.value===4&&s.results?.[5]?.value===8,
   'reopen qualified v27 after invalid edits');
  assert.equal(current.saveDisabled,false);
  check('Reopened qualified v27 scene retraces actual native Beam+Mirror rather than reusing stale measurements');
  await shot('v27-reopen-qualified');
  assert.deepEqual(report.runtimeErrors,[]);
  const external=report.network.filter(u=>/^https?:/.test(u)&&!u.startsWith(origin+'/'));
  assert.deepEqual(external,[]);
  check('No external model/network call or browser runtime exception');
  report.status='passed';
  console.log('NATIVE_TWO_PLANE_MIRROR_V27_CHROME '+JSON.stringify({
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
main().catch(e=>{console.error('NATIVE BEAM PLANAR MIRROR V27 CHROME FAILED:',e.stack||e.message);process.exitCode=1;});
