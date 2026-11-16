// Test-only real Chrome cross-family task checks. No physics, scoring or UI changes.
// Browser task completion is software evidence, NOT actual teacher participation.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../../src/qualification.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const base=resolve(root,process.env.OPTICSIM_CROSS_FAMILY_OUTPUT||
 'test-artifacts/llm-authoring/teaching-cross-family-v1');
const out=join(base,'browser');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,ok,label){
 const end=Date.now()+35000;let last,error;
 while(Date.now()<end){try{last=await fn();if(ok(last))return last;}catch(e){error=e.message;}await sleep(110);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(error||''));
}
function findChrome(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable',
  'chromium','chromium-browser'].filter(Boolean)){
  const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
  if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
 }
 throw Error('No Chrome/Chromium available; browser task validation NOT passed');
}
async function freePort(){
 const s=createServer();
 await new Promise((ok,err)=>s.once('error',err).listen(0,'127.0.0.1',ok));
 const n=s.address().port;await new Promise(ok=>s.close(ok));return n;
}
async function connect(url){
 const ws=new WebSocket(url),pending=new Map(),listeners=[];let seq=0;
 await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
 ws.addEventListener('message',e=>{
  const r=JSON.parse(e.data);
  if(r.method)for(const f of listeners)f(r);
  const cb=pending.get(r.id);if(cb){pending.delete(r.id);cb(r);}
 });
 return {close:()=>ws.close(),on:f=>listeners.push(f),
  send:(method,params={})=>new Promise((ok,err)=>{
   const id=++seq,t=setTimeout(()=>{pending.delete(id);err(Error(method+' timeout'));},25000);
   pending.set(id,r=>{clearTimeout(t);r.error?err(Error(JSON.stringify(r.error))):ok(r.result);});
   ws.send(JSON.stringify({id,method,params}));
  })};
}
await mkdir(out);const report={
 format:'opticsim-cross-family-real-chrome-evidence-v1',status:'running',
 browser:null,checks:[],screenshots:[],errors:[],requests:[],
 teacherParticipants:0,studentParticipants:0,classroomEffectiveness:'not-assessed',
 models:['ideal-thin-lens-geometric','plane-mirror-geometric','polygon-dielectric-tracing']
};
let browser,server,cdp,profile;
const record=(caseId,name,details=null)=>report.checks.push({caseId,name,passed:true,details});
try{
 const main=JSON.parse(await readFile(join(base,'report.json'),'utf8'));
 assert.equal(main.status,'checks-passed','Source/native software evidence must pass before browser task');
 const plan=JSON.parse(await readFile(join(base,'PLAN.json'),'utf8'));
 const {bin,version}=findChrome();report.browser=version;
 const p=await freePort(),origin='http://127.0.0.1:'+p;
 profile=await mkdtemp(join(out,'profile-'));
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,
  env:{...process.env,PORT:String(p),OPTICSIM_BASE_PATH:'/'},stdio:'ignore'});
 browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--window-size=1440,1050','--remote-debugging-port=0',
  '--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await until(async()=>(await fetch(origin)).status,x=>x===200,'local viewer server');
 const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome startup');
 const pages=await until(async()=>(await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json()),x=>x.some(t=>t.type==='page'),'Chrome page');
 cdp=await connect(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 cdp.on(e=>{if(e.method==='Network.requestWillBeSent'&&e.params?.request?.url?.startsWith('http'))
   report.requests.push(e.params.request.url);
   if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails?.text||'JavaScript exception');});
 for(const m of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(m);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 const js=async expression=>{
  const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
 };
 const state=()=>js(`(()=>{const e=id=>document.getElementById(id),r=e('revision')?.textContent||'';
  return {revision:Number((r.match(/\\d+/)||[])[0]||0),native:e('status')?.dataset.state,
   error:e('error')?.textContent||'',title:e('title')?.textContent||'',
   results:JSON.parse(e('observable-results')?.dataset.results||'null'),
   readoutText:e('observable-results')?.textContent||'',
   qualification:e('qualification-status')?.dataset.state,
   source:e('evidence-source')?.textContent||'',
   sourceHash:e('evidence-source-hash')?.textContent||'',
   physicsHistory:e('evidence-physical-change')?.textContent||'',
   limits:e('evidence-result-limits')?.textContent||'',
   summary:e('evidence-summary')?.textContent||'',
   fitNote:e('fit-note')?.textContent||'',
   fitSequence:e('fit-note')?.dataset.fitSequence||null,
   fitDisabled:e('fit-results')?.disabled,saveDisabled:e('save-qualified')?.disabled
  };})()`);
 const upload=async path=>{
  const prior=(await state()).revision;
  const document=await cdp.send('DOM.getDocument',{depth:-1});
  const input=await cdp.send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#load'});
  if(!input.nodeId)throw Error('Qualified package import input missing');
  await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});
  return until(state,s=>s.revision>prior&&s.native==='completed'&&!s.error&&!s.saveDisabled,
   'qualified package import '+path);
 };
 const saveShot=async label=>{
  const response=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  const filename=label+'.png';
  await writeFile(join(out,filename),Buffer.from(response.data,'base64'),{flag:'wx'});
  report.screenshots.push(filename);
 };
 const exportPackage=async label=>{
  const d=join(out,'exports',label);await mkdir(d,{recursive:true});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:d,eventsEnabled:true});
  await js('document.getElementById("save-qualified").click()');
  return until(async()=>{
   for(const file of await readdir(d)){
    if(!file.endsWith('.json'))continue;
    const path=join(d,file);
    try{return {path,bundle:await parseQualifiedBundle(await readFile(path,'utf8'))};}catch{}
   }return null;
  },Boolean,'saved qualified package '+label);
 };
 const edit=async(id,value)=>js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e||e.disabled)throw Error('Missing or disabled physical control ${id}');
  e.value=${JSON.stringify(String(value))};
  e.dispatchEvent(new Event('input',{bubbles:true}));
  e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  return true;})()`);
 await cdp.send('Page.navigate',{url:origin+'/?scene=single-lens'});
 await until(state,s=>s.native==='completed','initial pinned viewer');
 for(const c of plan.cases){
  const caseDir=join(base,c.id);
  const original=await parseQualifiedBundle(await readFile(join(caseDir,'baseline','qualified-scene.json'),'utf8'));
  const hypothetical=await parseQualifiedBundle(await readFile(join(caseDir,'what-if','qualified-scene.json'),'utf8'));
  const cbase=main.cases.find(r=>r.id===c.id+'/baseline');
  const cwhat=main.cases.find(r=>r.id===c.id+'/what-if');
  let s=await upload(join(caseDir,'baseline','qualified-scene.json'));
  s=await until(state,x=>x.results?.length===c.requests.length&&x.source.includes(c.path)&&x.native==='completed',
   c.id+' source and requested results rendered');
  assert.equal(s.sourceHash,original.qualification.interpretation.source.sha256);
  assert.equal(s.results.length,c.requests.length);
  assert.deepEqual(s.results.map(x=>x.kind),c.requests.map(x=>x.kind));
  assert.ok(s.results.every(x=>x.status!=='suppressed'));
  if(c.id==='lens'||c.id==='mirror'){
   assert.equal(s.results.find(x=>x.kind==='ideal-image')?.status,'conditional');
   assert.match(s.readoutText,/Conditional analytical prediction/);
   assert.match(s.readoutText,/Not a native image detection/);
  }else{
   assert.equal(s.results.find(x=>x.kind==='ideal-image')?.status,'unavailable');
   assert.equal(s.results.find(x=>x.kind==='finite-hit-numerical-diagnostic')?.status,'advisory');
   assert.match(s.readoutText,/NONCERTIFYING|ADVISORY ONLY/);
   assert.match(s.limits,/NONCERTIFYING|NUMERICAL CAUTION|does NOT certify/i);
  }
  assert.equal(cbase.native.status,'completed');
  record(c.id,'Real Chrome shows distinct source/conditional/native/unavailable/advisory semantics',
   {status:s.native,source:s.source,readoutStatuses:s.results.map(x=>({kind:x.kind,status:x.status}))});
  await saveShot(c.id+'-baseline');

  const seq=s.fitSequence;
  await js('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.fitSequence&&x.fitSequence!==seq&&
   x.fitNote.includes('No physics or sampling changed')&&x.native==='completed',c.id+' fit');
  const fitted=await exportPackage(c.id+'-baseline-fit');
  assert.deepEqual(fitted.bundle.scene.physics,original.scene.physics);
  assert.deepEqual(fitted.bundle.scene.simulation,original.scene.simulation);
  assert.deepEqual(fitted.bundle.observables,original.observables);
  assert.deepEqual(fitted.bundle.qualification,original.qualification);
  record(c.id,'Fit changes only presentation and retains source and requested results');
  await saveShot(c.id+'-fit');

  // Edit the current native scene using actual existing form controls, not JS internals.
  const change=c.whatIf.changes[0];
  const control=change.id+'-'+change.key;
  await edit(control,change.value);
  const expectedHistory=change.id+'.'+change.key;
  s=await until(state,x=>x.native==='completed'&&x.qualification==='revised'&&
   x.physicsHistory.includes(expectedHistory)&&x.results?.length===c.requests.length,
   c.id+' teacher what-if edit');
  const exported=await exportPackage(c.id+'-what-if-edited');
  assert.deepEqual(exported.bundle.scene.physics,hypothetical.scene.physics,
   c.id+' browser physics differs from the independently validated teacher what-if');
  assert.deepEqual(exported.bundle.scene.simulation,original.scene.simulation);
  assert.deepEqual(exported.bundle.qualification.origin,original.qualification.origin);
  assert.equal(exported.bundle.qualification.edits.filter(e=>e.kind==='physics').length,1);
  assert.equal(cwhat.native.status,'completed');
  record(c.id,'Actual form edit creates validated physical hypothetical and preserves original qualification',
   {physicalChange:expectedHistory,intervention:change.value,qualification:s.qualification});
  await saveShot(c.id+'-what-if');

  // Reopen the browser-exported qualified package and require a fresh completed result.
  s=await upload(exported.path);
  assert.equal(s.qualification,'revised');
  assert.equal(s.results?.length,c.requests.length);
  assert.equal(s.sourceHash,original.qualification.interpretation.source.sha256);
  record(c.id,'Exported teacher hypothetical reopens and reruns native optics with original source provenance');
  // Also reopen original baseline, instead of letting current variant overwrite source.
  s=await upload(join(caseDir,'baseline','qualified-scene.json'));
  assert.equal(s.results?.length,c.requests.length);
  assert.ok(s.qualification!=='revised');
  record(c.id,'Original source baseline remains separately accessible and is not overwritten');
 }
 // A raw scene export does NOT contain qualification or passive observable selection.
 const originalGlass=await readFile(join(base,'glass','baseline','scene.json'),'utf8');
 const rawPath=join(out,'glass-raw-source.json');
 await writeFile(rawPath,originalGlass,{flag:'wx'});
 await upload(rawPath);
 const raw=await until(state,s=>s.qualification==='unknown'&&s.results===null&&s.native==='completed',
  'raw scene import must reset qualification');
 assert.match(raw.source,/unknown/i);
 record('shared','Raw scene import drops old source qualification and requested results without inventing provenance');
 assert.deepEqual(report.errors,[]);
 assert.ok(report.requests.every(u=>u.startsWith(origin+'/')),
  'Chrome made a non-local network request');
 record('shared','Real Chrome reported no JS exceptions and used localhost-only resources');
 report.status='checks-passed';
}catch(e){report.status='checks-failed';report.failure={message:e.message,stack:e.stack};process.exitCode=1;}
finally{
 cdp?.close();browser?.kill();server?.kill();await sleep(350);
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:150});
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('CROSS_FAMILY_CHROME '+JSON.stringify({status:report.status,checks:report.checks.length,
  screenshots:report.screenshots.length,teacherParticipants:0,failure:report.failure?.message}));
}
