import {parseQualifiedBundle} from '../src/qualification.js';
// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'test-artifacts','browser-planar-refraction');
const downloads=join(out,'downloads');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms)), timeout=20000;
async function until(fn,ok,label){
  const end=Date.now()+timeout;let last,err;
  while(Date.now()<end){try{last=await fn();if(ok(last))return last;}catch(e){err=e.message;}await sleep(125);}
  throw Error(label+' timed out: '+JSON.stringify(last)+' '+(err||''));
}
function browserBinary(){
  for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
    const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
    if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
  }
  throw Error('Chrome/Chromium unavailable; no browser validation performed');
}
async function freePort(){
  const server=createServer();
  await new Promise((ok,err)=>server.once('error',err).listen(0,'127.0.0.1',ok));
  const port=server.address().port;
  await new Promise((ok,err)=>server.close(e=>e?err(e):ok()));return port;
}
async function connect(url){
  const ws=new WebSocket(url);
  await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
  let next=0;const pending=new Map(),listeners=new Set();
  ws.addEventListener('message',e=>{let r;try{r=JSON.parse(e.data);}catch{return;}
    if(r.method)for(const listener of listeners)listener(r);
    const done=pending.get(r.id);if(done){pending.delete(r.id);done(r);}
  });
  return {close:()=>ws.close(),onEvent:fn=>listeners.add(fn),
    send:(method,params={})=>new Promise((ok,err)=>{
    const id=++next,timer=setTimeout(()=>{pending.delete(id);err(Error(method+' timeout'));},timeout);
    pending.set(id,r=>{clearTimeout(timer);r.error?err(Error(method+': '+r.error.message)):ok(r.result);});
    ws.send(JSON.stringify({id,method,params}));
  })};
}
async function main(){
 await mkdir(downloads,{recursive:true});const {bin,version}=browserBinary();
 const profile=await mkdtemp(join(out,'profile-')),port=await freePort(),origin='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={browser:version,checks:[],screenshots:[],presentationChecks:[],errors:[]};let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,x=>x===200,'server');
  const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome');
  const targets=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();cdp=await connect(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  cdp.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>evaluate('({title:document.getElementById("title").textContent,status:document.getElementById("status").dataset.state,error:document.getElementById("error").textContent,results:JSON.parse(document.getElementById("observable-results").dataset.results||"null"),text:document.getElementById("observable-results").textContent,saveDisabled:document.getElementById("save-qualified").disabled,fitDisabled:document.getElementById("fit-results").disabled})');
  const upload=async path=>{const dom=await cdp.send('DOM.getDocument',{depth:-1});const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});};
  const shot=async name=>{
    // Native interactions can occur outside an apparatus-only camera. A declared
    // zoom-only edit frames this synthetic demonstration; it is not a ray repair.
    const before=await state();
    await evaluate('(()=>{const e=document.getElementById("zoom");e.value="0.8";e.dispatchEvent(new Event("input",{bubbles:true}));})()');
    const after=await until(state,s=>s.title===before.title&&s.status==='completed'&&s.results?.length===before.results.length&&!s.fitDisabled,'presentation rerun');
    assert.deepEqual(after.results,before.results,'Zoom must not change native observations');
    report.presentationChecks.push({name,zoom:0.8,unchangedRequestedResults:true});
    const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');
  };
  const check=name=>report.checks.push({name,status:'pass'});
  const acceptance=JSON.parse(await readFile(join(root,'test-artifacts/llm-authoring/planar-refraction/acceptance.json'),'utf8')),b=acceptance.browserBundles;
  await cdp.send('Page.navigate',{url:origin});await until(state,s=>s.status==='completed','initial page');
  await upload(b.initial);let s=await until(state,s=>s.status==='completed'&&s.results?.[1]?.value>19&&s.results?.[1]?.value<20,'refraction import');
  assert.equal(s.error,'');assert.equal(s.results[3].value.branches.length,2);check('native refraction package and readable branches');await shot('oblique-refraction');
  await evaluate('(()=>{const e=document.getElementById("S1-directionDeg");if(e.disabled)throw Error("single-ray direction disabled");e.value="60";e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
  s=await until(state,s=>s.status==='completed'&&Math.abs(s.results?.[1]?.value-35.26438968275465)<1e-6,'direction edit');check('single-ray direction edit matches native CLI');
  await evaluate('document.getElementById("save-qualified").click()');
  const file=await until(async()=>{const files=await readdir(downloads);return files.find(f=>f.endsWith('.json'));},Boolean,'qualified export');
  const exported=await parseQualifiedBundle(await readFile(join(downloads,file),'utf8'));assert.equal(exported.scene.schemaVersion,5);assert.equal(exported.scene.physics.components[0].emission.directionDeg,60);
  assert.equal(exported.qualification.edits.at(-1).kind,'physics');await upload(join(downloads,file));await until(state,s=>s.status==='completed'&&Math.abs(s.results?.[1]?.value-35.26438968275465)<1e-6,'reopen');check('v5 qualified export and reopen retain physical edit');
  await upload(b.tir);s=await until(state,s=>s.status==='completed'&&s.results?.[3]?.value?.outcome==='total-internal-reflection','TIR import');assert.equal(s.results[1].status,'unavailable');check('TIR has no fabricated transmitted angle');await shot('total-internal-reflection');
  await upload(b.layers);s=await until(state,s=>s.status==='completed'&&s.results?.length===6,'layer import');assert.equal(s.results[4].status,'qualified');assert.match(s.text,/approximation/);check('layer approximation is explicitly visible');await shot('layered-transmission');
  await evaluate('(()=>{const e=document.getElementById("I2-partialReflection");e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}));})()');
  s=await until(state,s=>s.status==='incomplete','Fresnel switch');assert.match(s.text,/suppressed/);check('physical Fresnel toggle preserves native truncation and suppression');
  await evaluate('(()=>{const e=document.getElementById("I2-positiveIndex");e.value="0";e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
  s=await until(state,s=>s.status==='invalid','invalid index');assert.equal(s.saveDisabled,true);assert.equal(s.fitDisabled,true);check('invalid medium suppresses export and result fitting');
  await upload(b.initial);await until(state,s=>s.status==='completed'&&s.results?.length===4,'restore');await evaluate('document.getElementById("fit-results").click()');await until(state,s=>s.status==='completed'&&!s.fitDisabled,'fit');check('presentation fit retains current interface results');
  assert.deepEqual(report.errors,[]);
 }catch(e){report.errors.push(e.stack);throw e;}
 finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');cdp?.close();browser.kill();server.kill();await rm(profile,{recursive:true,force:true});}
 console.log('Planar refraction browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' native screenshots.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
