// Evaluation-only real Chrome tasks. No new renderer, overlays or private state writes.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../../src/qualification.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=resolve(root,'test-artifacts/llm-authoring/teaching-fidelity-v1'),out=join(base,'browser');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,ok,label){
 const end=Date.now()+25000;let last,error;
 while(Date.now()<end){try{last=await fn();if(ok(last))return last;}catch(e){error=e.message;}await sleep(100);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(error||''));
}
function binary(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
 }
 throw Error('Chrome/Chromium unavailable; browser tasks NOT assessed');
}
async function port(){const s=createServer();await new Promise((ok,err)=>s.once('error',err).listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
async function connect(url){
 const ws=new WebSocket(url),pending=new Map(),listeners=[];let next=0;
 await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method)for(const f of listeners)f(r);const callback=pending.get(r.id);if(callback){pending.delete(r.id);callback(r);}});
 return {close:()=>ws.close(),on:f=>listeners.push(f),send:(method,params={})=>new Promise((ok,err)=>{
  const id=++next,timer=setTimeout(()=>{pending.delete(id);err(Error(method+' timeout'));},20000);
  pending.set(id,r=>{clearTimeout(timer);r.error?err(Error(JSON.stringify(r.error))):ok(r.result);});ws.send(JSON.stringify({id,method,params}));})};
}
await mkdir(out,{recursive:false});
const report={format:'opticsim-teaching-browser-evidence-v1',status:'running',checks:[],screenshots:[],
 teacherParticipants:0,studentParticipants:0,educationalEffectiveness:'not-assessed',errors:[],requests:[]};
let browser,server,cdp,profile;
try{
 const evidence=JSON.parse(await readFile(join(base,'report.json'),'utf8'));assert.equal(evidence.status,'checks-passed');
 const row=id=>evidence.cases.find(x=>x.id===id);
 const {bin,version}=binary();report.browserVersion=version;
 const p=await port(),origin='http://127.0.0.1:'+p;
 profile=await mkdtemp(join(out,'profile-'));
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(p),OPTICSIM_BASE_PATH:'/'},stdio:'ignore'});
 browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1440,1100','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await until(async()=>(await fetch(origin)).status,x=>x===200,'server');
 const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome startup');
 const pages=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),x=>x.some(t=>t.type==='page'),'browser page');
 cdp=await connect(pages.find(t=>t.type==='page').webSocketDebuggerUrl);
 cdp.on(e=>{if(e.method==='Network.requestWillBeSent'&&e.params?.request?.url?.startsWith('http'))report.requests.push(e.params.request.url);
  if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails?.text||'JavaScript exception');});
 for(const method of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(method);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const state=()=>evaluate(`(()=>{const e=id=>document.getElementById(id);return {title:e('title')?.textContent,revision:e('revision')?.textContent,status:e('status')?.dataset.state,error:e('error')?.textContent,results:JSON.parse(e('observable-results')?.dataset.results||'null'),resultsText:e('observable-results')?.textContent,qualification:e('qualification-status')?.dataset.state,details:e('qualification-details')?.textContent,fitNote:e('fit-note')?.textContent,fitSequence:e('fit-note')?.dataset.fitSequence,fitDisabled:e('fit-results')?.disabled,saveDisabled:e('save-qualified')?.disabled,sampling:e('sampling')?.value,samplingNote:e('sampling-note')?.textContent};})()`);
 const current=async id=>until(state,s=>{
  if(s.status!=='completed'||s.error||s.saveDisabled)return false;
  try{assert.deepEqual(s.results??[],row(id).results);return s.title==='Teaching pilot: specified ideal lens and passive detector';}catch{return false;}
 },id+' current native/results');
 const upload=async path=>{
  const before=await state();
  const d=await cdp.send('DOM.getDocument',{depth:-1}),e=await cdp.send('DOM.querySelector',{nodeId:d.root.nodeId,selector:'#load'});
  await cdp.send('DOM.setFileInputFiles',{nodeId:e.nodeId,files:[path]});
  await until(state,s=>s.revision!==before.revision&&s.status==='completed','new completed import revision');
 };
 const shot=async name=>{
  const dimensions=await cdp.send('Page.getLayoutMetrics');const size=dimensions.cssContentSize||dimensions.contentSize;
  const img=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:size.width,height:size.height,scale:1}});
  await writeFile(join(out,name+'.png'),Buffer.from(img.data,'base64'),{flag:'wx'});report.screenshots.push(name+'.png');
 };
 const check=(name,details=null)=>report.checks.push({name,passed:true,details});
 const edit=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw Error('Missing physical control');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
 const exportPackage=async label=>{
  const d=join(out,'exports',label);await mkdir(d,{recursive:true});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:d,eventsEnabled:true});
  await evaluate('document.getElementById("save-qualified").click()');
  return until(async()=>{for(const name of await readdir(d)){if(!name.endsWith('.json'))continue;const path=join(d,name);return {path,bundle:await parseQualifiedBundle(await readFile(path,'utf8'))};}return null;},x=>!!x,'qualified export '+label);
 };
 await cdp.send('Page.navigate',{url:origin+'/'});await until(state,s=>s.status==='completed','initial native viewer');
 await upload(join(base,'scene-only','qualified-scene.json'));
 const noAnswer=await current('scene-only');
 assert.match(noAnswer.resultsText,/No explicit result requests|No native requested-result/);
 check('Native scene works without a textbook answer target or dummy observable',noAnswer);await shot('01-scene-only');
 await upload(join(base,'baseline','qualified-scene.json'));const start=await current('baseline');
 assert.match(start.resultsText,/Conditional analytical prediction/);assert.match(start.resultsText,/Native sampled observation/);
 assert.match(start.resultsText,/Not a native image detection/);assert.match(start.samplingNote,/not the optical model/);
 check('Viewer distinguishes conditional images, native samples and numerical sampling',start);
 const seq=start.fitSequence;
 await evaluate('document.getElementById("fit-results").click()');
 await until(state,s=>s.fitSequence&&s.fitSequence!==seq&&s.fitNote.includes('No physics or sampling changed'),'Fit completion');
 await current('baseline');const fitted=await exportPackage('baseline-fit');
 const baseBundle=await parseQualifiedBundle(await readFile(join(base,'baseline','qualified-scene.json'),'utf8'));
 assert.deepEqual(fitted.bundle.scene.physics,baseBundle.scene.physics);assert.deepEqual(fitted.bundle.scene.simulation,baseBundle.scene.simulation);
 check('Fit changes presentation only, retaining exact physical/numerical input');await shot('02-baseline-fit');
 await edit('lens-1-focalLength',150);const edited=await current('focal-150');
 assert.equal(edited.qualification,'revised');const exported=await exportPackage('focal-150');
 const offline=await parseQualifiedBundle(await readFile(join(base,'focal-150','qualified-scene.json'),'utf8'));
 assert.deepEqual(exported.bundle.scene.physics,offline.scene.physics);
 assert.deepEqual(exported.bundle.qualification.origin,baseBundle.qualification.origin);
 assert.deepEqual(exported.bundle.qualification.interpretation,baseBundle.qualification.interpretation);
 assert.equal(exported.bundle.qualification.edits.filter(e=>e.kind==='physics').length,1);
 check('Actual focal-length UI edit agrees with offline native replay and retains origin');await shot('03-focal-length-150');
 await upload(exported.path);await current('focal-150');check('Browser-exported revised package reopens and recomputes');
 await upload(join(base,'coarse-sampling','qualified-scene.json'));const coarse=await current('coarse-sampling');
 assert.equal(coarse.sampling,'custom');await shot('04-coarse-sampling');
 await evaluate(`(()=>{const s=document.getElementById('sampling');s.value='dense';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await current('baseline');const dense=await exportPackage('sampling-back-to-dense');
 assert.deepEqual(dense.bundle.scene.physics,baseBundle.scene.physics);
 assert.deepEqual(dense.bundle.scene.simulation,baseBundle.scene.simulation);
 assert.ok(dense.bundle.qualification.edits.filter(e=>e.kind==='numerics').length>=2);
 assert.equal(dense.bundle.qualification.edits.filter(e=>e.kind==='physics').length,0);
 check('Real sampling control restores dense numerical policy without changing apparatus');
 await upload(join(base,'optional-unavailable','qualified-scene.json'));const partial=await current('optional-unavailable');
 assert.equal(partial.results.at(-1).status,'unavailable');assert.equal(partial.results.at(-1).value,null);
 check('Unsupported material quantity stays visible as unavailable beside valid simulation/readouts');await shot('05-optional-unavailable');
 await edit('lens-1-focalLength',0);
 const invalid=await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled&&s.fitDisabled,'invalid edit suppression');
 check('Invalid physical edit suppresses current result data and qualified export',invalid);await shot('06-invalid-edit');
 await upload(join(base,'baseline','qualified-scene.json'));await current('baseline');check('Original source-backed package restores the accepted configuration');
 assert.deepEqual(report.errors,[]);assert.ok(report.requests.every(u=>u.startsWith(origin+'/')));
 check('Browser runtime uses only local resources and reports no JavaScript exceptions');
 report.status='checks-passed';
}catch(error){report.status='checks-failed';report.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally{
 if(cdp)cdp.close();if(browser)browser.kill();if(server)server.kill();
 await sleep(300);if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:150});
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('Teaching-fidelity browser: '+JSON.stringify({status:report.status,checks:report.checks.length,screenshots:report.screenshots.length,failure:report.failure?.message}));
}
