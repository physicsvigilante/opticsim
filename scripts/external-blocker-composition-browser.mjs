import {parseQualifiedBundle} from '../src/qualification.js';
// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const outputRoot=join(root,'test-artifacts','browser-external-blocker-composition');
let out,downloads;
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
 await mkdir(outputRoot,{recursive:true});out=await mkdtemp(join(outputRoot,'attempt-'));downloads=join(out,'downloads');await mkdir(downloads);
 const {bin,version}=browserBinary();
 const profile=await mkdtemp(join(out,'profile-')),port=await freePort(),origin='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={browser:version,checks:[],screenshots:[],errors:[],serverMode:'existing static viewer; no public deployment'};let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,s=>s===200,'static server');
  const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),n=>n>0,'Chrome');
  const targets=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();cdp=await connect(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  cdp.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>evaluate('({status:document.getElementById("status").dataset.state,error:document.getElementById("error").textContent,results:JSON.parse(document.getElementById("observable-results").dataset.results||"null"),text:document.getElementById("observable-results").textContent,saveDisabled:document.getElementById("save-qualified").disabled,fitDisabled:document.getElementById("fit-results").disabled,model:document.getElementById("model-label").textContent})');
  const result=(s,kind)=>s.results?.find(r=>r.kind===kind);
  const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1});const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});};
  const edit=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||e.disabled)throw Error('Field unavailable');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  const check=name=>report.checks.push({name,status:'pass'});
  const shot=async name=>{const image=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(image.data,'base64'));report.screenshots.push(name+'.png');};
  const acceptance=JSON.parse(await readFile(join(root,'test-artifacts/llm-authoring/external-blocker-composition/acceptance.json'),'utf8')),b=acceptance.browserBundles;
  await cdp.send('Page.navigate',{url:origin+'/?scene=external-blocker-composition'});
  let s=await until(state,x=>x.status==='completed'&&x.model.includes('opaque surface'),'bundled opaque surface');
  assert.equal(s.error,'');assert.equal(await evaluate('!!document.getElementById("S1-mode-single-ray")'),true);
  assert.equal(await evaluate('document.querySelectorAll(".source-menu button").length'),1);
  check('Bundled v13 scene uses existing native viewer and the single-ray contract');
  await upload(b['prism-blocked']);
  s=await until(state,x=>x.status==='completed'&&result(x,'blocker-absorptions')?.value===1,'qualified prism');
  assert.equal(result(s,'interface-interactions').value,2);assert.equal(result(s,'detector-crossings').value,0);assert.match(s.text,/approximation/);
  const pixels=await evaluate("(()=>{const c=document.getElementById('light'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>0)n++;return n;})()");
  assert.ok(pixels>100);report.nativeLightPixels=pixels;check('Native glass and absorber readings render actual rays');await shot('blocker-prism-normal');
  const before=structuredClone(s.results);await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.status==='completed'&&!x.fitDisabled,'camera fit');assert.deepEqual(s.results,before);check('Camera Fit leaves measurements unchanged');
  await edit('B1-length',20);await until(state,x=>x.status==='completed','short blocker');
  await edit('B1-y',100);s=await until(state,x=>x.status==='completed'&&result(x,'blocker-absorptions')?.value===0,'finite miss');
  assert.equal(result(s,'detector-crossings').value,1);check('Moving the blocker produces a native miss and downstream crossing');await shot('blocker-prism-miss');
  await edit('B1-y',0);await until(state,x=>x.status==='completed','restore centre');await edit('B1-length',80);
  await until(state,x=>x.status==='completed'&&result(x,'blocker-absorptions')?.value===1,'restore absorber');
  await edit('P1-insideIndex',1.4);await until(state,x=>x.status==='completed','material edit');
  await edit('S1-directionDeg',4);s=await until(state,x=>x.status==='completed'&&result(x,'blocker-absorptions')?.value===1,'direction edit');
  await evaluate('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified export');
  const savedFile=join(downloads,filename),saved=await parseQualifiedBundle(await readFile(savedFile,'utf8'));
  const original=await parseQualifiedBundle(await readFile(b['prism-blocked'],'utf8'));
  assert.equal(saved.scene.schemaVersion,13);assert.equal(saved.scene.physics.components.find(c=>c.id==='P1').parameters.insideIndex,1.4);
  assert.equal(saved.scene.physics.components.find(c=>c.id==='S1').emission.directionDeg,4);
  assert.deepEqual(saved.qualification.origin,original.qualification.origin);assert.deepEqual(saved.qualification.interpretation,original.qualification.interpretation);
  assert.ok(saved.qualification.edits.length>=6);assert.deepEqual(saved.observables,original.observables);
  await upload(savedFile);await until(state,x=>x.status==='completed'&&result(x,'blocker-absorptions')?.value===1,'reopen');
  check('Physical edits, original assumptions and observation targets survive qualified export/reopen');
  await upload(b['return-blocked']);s=await until(state,x=>x.status==='completed'&&result(x,'interface-interactions')?.value===4,'quadrilateral return');
  assert.equal(result(s,'mirror-reflections').value,1);assert.equal(result(s,'blocker-absorptions').value,1);assert.equal(result(s,'detector-crossings').value,0);
  check('Same viewer and rule support glass re-entry before external return-path absorption');await shot('blocker-quadrilateral-return');
  await upload(b.removed);s=await until(state,x=>x.status==='completed'&&result(x,'blocker-absorptions')?.status==='unavailable','removed target');
  assert.equal(result(s,'detector-crossings').value,1);assert.equal(await evaluate('!!document.getElementById("B1-x")'),false);
  await upload(b.replacement);s=await until(state,x=>x.status==='completed'&&x.results?.at(-1)?.value===1,'new identity');
  assert.equal(result(s,'blocker-absorptions').status,'unavailable');assert.equal(await evaluate('!!document.getElementById("Bnew-x")'),true);
  check('Structural branch imports retain missing old targets and new blocker identity');
  await upload(b['outside-tir']);s=await until(state,x=>x.status==='completed'&&x.results?.at(-1)?.status==='unavailable','TIR');
  assert.equal(s.results.at(-1).value,null);check('Native TIR does not manufacture transmission');
  for(const name of ['full-fresnel','ninth-interaction']){
   await upload(b[name]);s=await until(state,x=>x.status==='incomplete'&&x.results===null&&x.text.includes('suppressed'),name);
   assert.equal(s.fitDisabled,true);
  }check('Incomplete Fresnel and depth-limited execution suppress accepted readouts');
  await upload(b['return-blocked']);await until(state,x=>x.status==='completed'&&result(x,'interface-interactions')?.value===4,'restore for invalid');
  await edit('B1-x',10);s=await until(state,x=>x.status==='invalid','contained blocker');assert.equal(s.results,null);assert.equal(s.saveDisabled,true);
  check('Invalid blocker containment clears stale readouts and disables qualified export');
  await upload(b['prism-blocked']);await until(state,x=>x.status==='completed'&&result(x,'blocker-absorptions')?.value===1,'narrow initial');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await until(()=>evaluate("(()=>{const r=document.getElementById('stage').getBoundingClientRect();return ['light','below','above','grid'].every(id=>{const c=document.getElementById(id);return c.width===Math.max(200,Math.round(r.width))&&c.height===Math.max(200,Math.round(r.height));});})()"),Boolean,'narrow canvas');
  await until(state,x=>x.status==='completed'&&!x.fitDisabled,'narrow ready');await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.status==='completed'&&!x.fitDisabled,'narrow fit');assert.equal(result(s,'blocker-absorptions').value,1);
  check('Narrow viewport Fit retains native measurements');await shot('blocker-mobile');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await evaluate("(()=>{const e=document.getElementById('examples');e.value='prism-mirror-composition';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until(state,x=>x.status==='completed'&&x.model.includes('Finite triangle / quadrilateral + mirrors'),'legacy v12');
  check('Historical v12 composition remains available without migration');assert.deepEqual(report.errors,[]);
 }catch(error){
  try{report.debug=await cdp.send('Runtime.evaluate',{expression:'({url:location.href,body:document.body?.innerText,html:document.documentElement.outerHTML.slice(0,3000)})',returnByValue:true});}catch{}
  report.errors.push(error.stack);throw error;
 }finally{
  cdp?.close();browser.kill();server.kill();
  try{await until(async()=>[browser,server].every(p=>p.exitCode!==null||p.signalCode!==null),Boolean,'shutdown');await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
  finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 console.log('External blocker browser PASS: '+report.checks.length+' checks. Evidence: '+out);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
