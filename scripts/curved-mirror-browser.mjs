// Browser regression for calculated-value provenance in existing qualified UI.
// Uses actual Chromium + pinned native PhyDemo, not a DOM mock or fabricated ray.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle,qualificationSummary} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'test-artifacts','browser-curved-mirrors');
const downloads=join(out,'downloads');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms)),timeout=22000;
async function until(fn,accept,label){
 const end=Date.now()+timeout;let last,error;
 while(Date.now()<end){try{last=await fn();if(accept(last))return last;}catch(e){error=e.message;}
   await pause(120);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(error||''));
}
function chrome(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
  if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
 }
 throw Error('No Chrome/Chromium available; browser evidence cannot be claimed');
}
async function port(){
 const s=createServer();
 await new Promise((ok,err)=>s.once('error',err).listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise((ok,err)=>s.close(e=>e?err(e):ok()));return p;
}
async function connect(url){
 const ws=new WebSocket(url),pending=new Map();let n=0;
 await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
 ws.addEventListener('message',e=>{
  let r;try{r=JSON.parse(e.data);}catch{return;}
  const fn=pending.get(r.id);if(fn){pending.delete(r.id);fn(r);}
 });
 return {close:()=>ws.close(),send:(method,params={})=>new Promise((ok,err)=>{
   const id=++n,timer=setTimeout(()=>{pending.delete(id);err(Error(method+' timed out'));},timeout);
   pending.set(id,r=>{clearTimeout(timer);r.error?err(Error(method+': '+r.error.message)):ok(r.result);});
   ws.send(JSON.stringify({id,method,params}));
 })};
}
async function main(){
 await mkdir(downloads,{recursive:true});
 const {bin,version}=chrome(),profile=await mkdtemp(join(out,'profile-'));
 const p=await port(),origin='http://127.0.0.1:'+p;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(p)},stdio:'ignore'});
 const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
   '--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={format:'opticsim-curved-browser-v1',browser:version,checks:[],screenshots:[],errors:[]};let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,x=>x===200,'local app');
  const chromePort=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome port');
  const targets=await(await fetch('http://127.0.0.1:'+chromePort+'/json/list')).json();
  cdp=await connect(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const evaluate=async expression=>{
    const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;
  };
  const state=()=>evaluate('({title:document.getElementById("title").textContent,native:document.getElementById("status").dataset.state,qualification:document.getElementById("qualification-status").dataset.state,details:document.getElementById("qualification-details").textContent,prediction:document.getElementById("prediction").textContent,analysisStatus:document.getElementById("analysis-status").textContent,saveDisabled:document.getElementById("save-qualified").disabled})');
  const upload=async filepath=>{
    const dom=await cdp.send('DOM.getDocument',{depth:-1});
    const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
    await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[filepath]});
  };
  const check=name=>report.checks.push({name,status:'pass'});
  const shot=async name=>{
    const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');
  };
  await cdp.send('Page.navigate',{url:origin});
  await until(state,s=>!!s.native,'initial page');
  const pathFor=name=>join(root,'test-artifacts/llm-authoring/curved-mirrors',name,'qualified-scene.json');
  await upload(pathFor('native-ideal'));
  let s=await until(state,s=>s.native==='completed'&&s.qualification==='calculated'&&s.details.includes('Curved mirror image'),'ideal mirror import');
  assert.match(s.prediction,/conditional curved-mirror calculation/);
  assert.match(s.details,/v = 150/);assert.match(s.details,/Ideal Gaussian mirror/);
  assert.equal(await evaluate('document.getElementById("M1-radius")===null'),true);
  check('Ideal native mirror and Gaussian calculation remain explicitly labelled');await shot('ideal-curved-mirror');
  await evaluate('(()=>{const e=document.getElementById("M1-focalLength");e.value="120";e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
  s=await until(state,s=>s.native==='completed'&&s.qualification==='revised','focal edit');
  assert.match(s.details,/Historical Curved mirror image/);assert.match(s.prediction,/physically revised/);
  check('Physical focal edit leaves prior analytical result historical');
  await evaluate('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>{const xs=await readdir(downloads);return xs.find(x=>x.endsWith('.json'));},Boolean,'export');
  const exported=await parseQualifiedBundle(await readFile(join(downloads,filename),'utf8'));
  assert.equal(exported.scene.schemaVersion,6);assert.equal(exported.scene.physics.components.find(c=>c.id==='M1').parameters.focalLength,120);
  assert.equal(exported.qualification.edits.at(-1).kind,'physics');
  await upload(join(downloads,filename));await until(state,s=>s.native==='completed'&&s.qualification==='revised','reopen');
  check('v6 qualified export/reopen preserves calculated origin and later edit');
  await upload(pathFor('native-circular'));
  s=await until(state,s=>s.native==='completed'&&s.qualification==='calculated'&&s.title.includes('native-circular'),'arc import');
  assert.match(s.details,/paraxial/);
  assert.equal(await evaluate('document.getElementById("M1-focalLength")===null'),true);
  assert.equal(await evaluate('document.getElementById("M1-radius").value'),'200');
  check('Circular radius and paraxial limitation are distinct from ideal focal mapping');await shot('circular-arc-mirror');
  await evaluate('document.getElementById("S1-mode-single-ray").click()');
  await until(state,s=>s.native==='completed','single-ray mode');
  check('v6 single-ray source mode executes without a source-picker crash');
  await evaluate('(()=>{const e=document.getElementById("M1-apertureHeight");e.value="500";e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
  s=await until(state,s=>s.native==='invalid','invalid arc');assert.equal(s.saveDisabled,true);
  check('Invalid arc geometry blocks export and does not silently flatten into a plane');
  await upload(pathFor('native-convex'));s=await until(state,s=>s.native==='completed'&&s.title.includes('native-convex'),'convex import');
  assert.match(s.details,/finite-virtual/);check('Negative circular radius yields explicitly conditional convex virtual image');
 }catch(e){report.errors.push(e.stack);throw e;}
 finally{
  cdp?.close();browser.kill();server.kill();
  try{
   await until(async()=>[browser,server].every(p=>p.exitCode!==null||p.signalCode!==null),Boolean,'shutdown');
   await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }catch(error){report.errors.push('Cleanup: '+error.message);throw error;}
  finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 console.log('Curved mirror browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' actual screenshots.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
