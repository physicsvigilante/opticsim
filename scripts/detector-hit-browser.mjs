// Actual Chrome/Chromium regression for a bounded native hit-position result.
// Uses the ordinary viewer and qualified packages; no browser-side ray tracing.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile,mkdir,mkdtemp,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,process.env.OPTICSIM_DETECTOR_BROWSER_OUTPUT||'test-artifacts/browser-detector-hit');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,match,label){let last,err;const end=Date.now()+25000;
 while(Date.now()<end){try{last=await fn();if(match(last))return last;}catch(e){err=e.message;}await pause(125);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(err||''));}
function chrome(){for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
 const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:2500});if(!r.error&&r.status===0)return {bin,version:r.stdout.trim()};}
 throw Error('Chrome unavailable: no runtime validation performed');}
async function freePort(){const s=createServer();await new Promise((ok,no)=>s.once('error',no).listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise((ok,no)=>s.close(e=>e?no(e):ok()));return p;}
async function connect(url){const ws=new WebSocket(url),callbacks=new Map(),listeners=[];let id=0;
 await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method)listeners.forEach(fn=>fn(r));const done=callbacks.get(r.id);
  if(done){callbacks.delete(r.id);done(r);}});
 return {close:()=>ws.close(),on:fn=>listeners.push(fn),send:(method,params={})=>new Promise((ok,no)=>{
  const n=++id,t=setTimeout(()=>{callbacks.delete(n);no(Error(method+' timed out'));},25000);
  callbacks.set(n,r=>{clearTimeout(t);r.error?no(Error(JSON.stringify(r.error))):ok(r.result);});
  ws.send(JSON.stringify({id:n,method,params}));})};}
async function main(){
 await mkdir(out);const downloads=join(out,'downloads');await mkdir(downloads);
 const {bin,version}=chrome(),profile=await mkdtemp(join(out,'profile-'));
 const p=await freePort(),origin='http://127.0.0.1:'+p;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(p)},stdio:'ignore'});
 const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1450,980','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={format:'opticsim-detector-hit-browser-v1',status:'running',browser:version,checks:[],screenshots:[],errors:[],externalModelCalls:0,teachingParticipants:0};let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,s=>s===200,'local static server');
  const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'DevTools');
  const targets=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),l=>l.some(x=>x.type==='page'),'page');
  cdp=await connect(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  cdp.on(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const js=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>js(`(()=>{const e=id=>document.getElementById(id);return {native:e('status').dataset.state,error:e('error').textContent,results:JSON.parse(e('observable-results').dataset.results||'null'),text:e('observable-results').textContent,saveDisabled:e('save-qualified').disabled,fitDisabled:e('fit-results').disabled};})()`);
  const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1}),n=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});await cdp.send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[file]});};
  const edit=async(id,value)=>js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||e.disabled)throw Error('Field not editable');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  const check=name=>report.checks.push({name,passed:true});
  const shot=async name=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');};
  const dir=join(root,'test-artifacts/llm-authoring/detector-hit-events-v2');
  const bundle=(name)=>join(dir,name,'qualified-scene.json');
  await cdp.send('Page.navigate',{url:origin+'/?scene=single-lens-detector'});
  await until(state,s=>s.native==='completed'&&!s.error,'initial viewer native run');
  await upload(bundle('plate-initial'));
  let s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.length===2&&s.results[1]?.value===2,'qualified plate detector');
  assert.equal(s.error,'');assert.equal(s.results[0].method,'native-hit-event-observation');
  const original=structuredClone(s.results[0].value);
  const n=1.8,inc=60*Math.PI/180,inside=Math.asin(Math.sin(inc)/n),separation=100*Math.tan(inc)+120*Math.tan(inside);
  assert.ok(Math.abs(original[1].pointMm.x-original[0].pointMm.x-separation)<1e-6);
  assert.ok(original[0].incomingUnit.y<0&&original[1].incomingUnit.y>0);
  assert.ok(original.every(e=>!('sourceId'in e)&&!('rayId'in e)));
  assert.match(s.text,/Hit 1.*x=/);assert.match(s.text,/callback order/i);
  check('One native SingleRay gives two actual detector points and distinct incoming directions');await shot('native-plate-two-hits');
  const originalPackage=await parseQualifiedBundle(await readFile(bundle('plate-initial'),'utf8'));
  await edit('I1-positiveIndex',1.6);
  s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.length===2&&Math.abs(s.results[0].value[1].pointMm.x-original[1].pointMm.x)>1,'fresh index revision');
  assert.equal(s.results[1].value,2);check('One physical index edit retraces and changes native hit position, preserving crossing count');await shot('refractive-index-hypothesis');
  await js("document.getElementById('save-qualified').click()");
  const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.qualified.json')),Boolean,'qualified download');
  const exported=join(downloads,name),saved=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.deepEqual(saved.observables,originalPackage.observables);
  assert.deepEqual(saved.qualification.origin,originalPackage.qualification.origin);
  assert.equal(saved.qualification.edits.at(-1).kind,'physics');
  assert.ok(saved.qualification.edits.at(-1).changes.some(x=>JSON.stringify(x).includes('positiveIndex')));
  assert.equal(Object.hasOwn(saved,'execution'),false);check('Qualified export preserves source lineage and hit request but no previous native results');
  await upload(exported);s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.length===2&&Math.abs(s.results[0].value[1].pointMm.x-original[1].pointMm.x)>1,'qualified reopen');
  check('Reopened package obtains fresh matching native hits, not stale evidence');
  await upload(bundle('plate-miss'));s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.length===0,'zero-hit case');
  assert.equal(s.results[1].value,0);check('Native miss is an available empty position list');
  await upload(bundle('over-limit'));s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.status==='unavailable'&&s.results[1].value>32,'bounded overflow');
  assert.equal(s.results[0].value,null);assert.match(s.results[0].reason,/withheld, not clipped/);check('Overflow cannot show a clipped position list as complete');await shot('bounded-overflow');
  await upload(bundle('fresnel-incomplete'));s=await until(state,s=>s.native==='incomplete'&&s.results===null&&s.text.includes('suppressed'),'incomplete Fresnel');
  assert.equal(s.fitDisabled,true);check('Incomplete native branching suppresses all hit positions and detector counts');await shot('fresnel-withheld');
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){
  try{report.debug=await cdp?.send('Runtime.evaluate',{expression:'({url:location.href,title:document.title,text:document.body?.innerText?.slice(0,2000)})',returnByValue:true});
   const screenshot=await cdp?.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
   if(screenshot?.data){await writeFile(join(out,'failure.png'),Buffer.from(screenshot.data,'base64'));report.screenshots.push('failure.png');}}catch{}
  report.errors.push(e.stack);throw e;}
 finally{
  cdp?.close();browser.kill();server.kill();
  try{await until(async()=>[browser,server].every(p=>p.exitCode!==null||p.signalCode!==null),x=>x,'shutdown');}catch{}
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 console.log('Detector hit-position browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
