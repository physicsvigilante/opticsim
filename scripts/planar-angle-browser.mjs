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
const out=join(root,'test-artifacts','browser-planar-angular');
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
 const report={format:'opticsim-angular-browser-v1',browser:version,checks:[],screenshots:[],errors:[]};let cdp;
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
  const state=()=>evaluate('({native:document.getElementById("status").dataset.state,qualification:document.getElementById("qualification-status").dataset.state,details:document.getElementById("qualification-details").textContent,prediction:document.getElementById("prediction").textContent,analysisStatus:document.getElementById("analysis-status").textContent,saveDisabled:document.getElementById("save-qualified").disabled})');
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
  const original=join(root,'test-artifacts/llm-authoring/planar-angle-acceptance/B05-inverse/derived-forward-scene.qualified.json');
  const rawBundle=await parseQualifiedBundle(await readFile(original,'utf8'));
  assert.equal(rawBundle.qualification.calculations[0].kind,'critical-input-angle');
  await upload(original);
  let s=await until(state,s=>s.native==='incomplete'&&s.qualification==='calculated'&&s.details.includes('Derived S1.emission.directionDeg'),'B05 qualified calculation');
  assert.match(s.details,/query SHA-256/);assert.equal(s.saveDisabled,false);
  assert.match(s.details,/Calculated initial incidence: 54\.3409/);
  assert.match(s.prediction,/separate conditional angular calculation/);
  assert.match(s.analysisStatus,/General image analysis:/);
  assert.doesNotMatch(s.prediction,/Prediction unavailable/);
  check('B05 calculated direction and query provenance remain visible despite incomplete native ray tracing');
  await shot('inverse-calculated-before-edit');
  const originalDirection=rawBundle.scene.physics.components.find(x=>x.id==='S1').emission.directionDeg;
  await evaluate('(()=>{const e=document.getElementById("S1-directionDeg");if(!e||e.disabled)throw Error("Calculated source field not editable");e.value="35.1";e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
  s=await until(state,s=>s.qualification==='revised'&&s.details.includes('physically revised'),'physical edit');
  assert.match(s.details,/Historical calculated initial incidence/);
  assert.match(s.prediction,/physically revised/);
  check('Edited direction explicitly differs from the historically calculated direction');
  await evaluate('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>{const xs=await readdir(downloads);return xs.find(x=>x.endsWith('.json'));},Boolean,'qualified export');
  const exported=await parseQualifiedBundle(await readFile(join(downloads,filename),'utf8'));
  assert.notEqual(exported.scene.physics.components.find(x=>x.id==='S1').emission.directionDeg,originalDirection);
  assert.equal(exported.qualification.calculations[0].computedFields[0].value,originalDirection);
  assert.equal(exported.qualification.edits.at(-1).kind,'physics');
  assert.equal(qualificationSummary(exported.scene,exported.qualification).calculated[0].computedFields[0].changed,true);
  check('Exported package preserves computed source direction, original query and recorded physical edit');
  await upload(join(downloads,filename));
  s=await until(state,s=>s.qualification==='revised'&&s.details.includes('physically revised'),'reopen changed derived package');
  check('Browser reopen retains calculated-versus-revised distinction');
  const b06=join(root,'test-artifacts/llm-authoring/planar-angle-acceptance/B06-two-branches/derived-forward-scene.qualified.json');
  await upload(b06);
  s=await until(state,s=>s.qualification==='calculated'&&s.details.includes('Calculated (branch-angles, conditional)'),'B06 qualified branch calculation');
  assert.equal(s.saveDisabled,false);
  assert.match(s.details,/Calculated branch theta4: 26\.6331/);
  assert.match(s.details,/Calculated branch theta5: 40\.5416/);
  assert.match(s.prediction,/separate conditional angular calculation/);
  check('B06 analytical branches remain labelled as calculations despite incomplete native Fresnel tracing');
  await shot('branch-calculated');
 }catch(e){report.errors.push(e.stack);throw e;}
 finally{
  cdp?.close();browser.kill();server.kill();
  try{
   await until(async()=>[browser,server].every(p=>p.exitCode!==null||p.signalCode!==null),Boolean,'shutdown');
   await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }catch(error){report.errors.push('Cleanup: '+error.message);throw error;}
  finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 console.log('Angular qualified provenance browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' actual screenshots.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
