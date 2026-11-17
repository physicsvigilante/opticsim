// Actual Chrome/Chromium regression for opt-in directional sampled detector footprint.
// Uses the ordinary viewer and qualified packages; no browser-side ray tracing.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile,mkdir,mkdtemp,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
import {explorationBundle} from '../src/exploration.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,process.env.OPTICSIM_DETECTOR_BROWSER_OUTPUT||'test-artifacts/browser-detector-directional-footprint');
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
 const report={format:'opticsim-detector-directional-footprint-browser-v1',status:'running',browser:version,checks:[],screenshots:[],errors:[],externalModelCalls:0,teachingParticipants:0};let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,s=>s===200,'local static server');
  const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'DevTools');
  const targets=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),l=>l.some(x=>x.type==='page'),'page');
  cdp=await connect(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  cdp.on(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const js=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>js(`(()=>{const e=id=>document.getElementById(id);return {native:e('status').dataset.state,error:e('error').textContent,results:JSON.parse(e('observable-results').dataset.results||'null'),text:e('observable-results').textContent,evidence:e('evidence-summary').textContent,limits:e('evidence-result-limits').textContent,saveDisabled:e('save-qualified').disabled,fitDisabled:e('fit-results').disabled};})()`);
  const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1}),n=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});await cdp.send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[file]});};
  const edit=async(id,value)=>js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||e.disabled)throw Error('Field not editable');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  const check=name=>report.checks.push({name,passed:true});
  const shot=async name=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');};
  const plate=JSON.parse(await readFile(join(root,'test/fixtures/detector-hit-plate.json'),'utf8'));
  const req=[{id:'foot',kind:'detector-directional-footprint',componentId:'Dhit'},
    {id:'count',kind:'detector-crossings',componentId:'Dhit'}];
  const input=join(out,'directional-footprint.qualified.json');
  await writeFile(input,JSON.stringify(await explorationBundle(plate,null,req),null,2)+'\n');
  await cdp.send('Page.navigate',{url:origin+'/?scene=single-lens-detector'});
  await until(state,s=>s.native==='completed'&&!s.error,'initial viewer native');
  await upload(input);
  let s=await until(state,s=>s.native==='completed'&&
   s.results?.[0]?.value?.observedCount===2&&
   s.results[0].value.towardPositiveNormal.count===1&&
   s.results[0].value.towardNegativeNormal.count===1&&s.results[1]?.value===2,
   'actual refractive plate and mirror native directional footprint');
  assert.equal(s.error,'');assert.equal(s.saveDisabled,false);
  assert.equal(s.results[0].status,'qualified');
  assert.equal(s.results[0].method,'native-detector-directional-footprint');
  const original=structuredClone(s.results[0].value);
  assert.ok(original.towardPositiveNormal.meanPointMm.x>original.towardNegativeNormal.meanPointMm.x);
  assert.equal(original.towardPositiveNormal.rmsSpreadMm,0);
  assert.equal(original.towardNegativeNormal.rmsSpreadMm,0);
  assert.match(s.text,/Toward positive normal/);assert.match(s.text,/RMS sampled spread/);
  assert.match(s.evidence,/^2 native sampled readouts/);assert.doesNotMatch(s.evidence,/other result state/);
  check('Native single ray crossing twice yields separate normal-signed sample centroids');
  check('Evidence panel classifies the derived native footprint as a sampled readout, not an image');
  await shot('plate-two-direction-footprints');

  await edit('I1-positiveIndex',1.6);
  s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.observedCount===2&&
   Math.abs(s.results[0].value.towardPositiveNormal.meanDistanceFromP1Mm-
     original.towardPositiveNormal.meanDistanceFromP1Mm)>1,'native material revision');
  assert.equal(s.results[1].value,2);
  check('Material index edit retraces and updates native detector footprint without changing crossing count');
  await shot('directional-footprint-index-edit');

  await js("document.getElementById('save-qualified').click()");
  const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.qualified.json')),Boolean,'qualified download');
  const exported=join(downloads,name),saved=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.deepEqual(saved.observables,req);
  assert.equal(saved.scene.physics.components.find(c=>c.id==='I1').parameters.positiveIndex,1.6);
  assert.equal(Object.hasOwn(saved,'execution'),false);
  check('Qualified export retains exact footprint request and revised apparatus but no native results');
  await upload(exported);
  s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.observedCount===2&&
   Math.abs(s.results[0].value.towardPositiveNormal.meanDistanceFromP1Mm-
     original.towardPositiveNormal.meanDistanceFromP1Mm)>1,'qualified footprint reopen');
  check('Qualified reopen produces fresh direction-resolved native crossings');

  await edit('S1-directionDeg',180);
  s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.observedCount===0,'genuine native detector miss');
  assert.equal(s.results[1].value,0);
  for(const side of ['towardPositiveNormal','towardNegativeNormal']){
   assert.equal(s.results[0].value[side].count,0);
   assert.equal(s.results[0].value[side].meanPointMm,null);
   assert.equal(s.results[0].value[side].rmsSpreadMm,null);
  }
  check('An actual missed detector has zero sampled hits but NULL centroid and RMS, not a fake zero-size image');
  await shot('zero-hits-null-centroids');

  const fresnel=structuredClone(plate);
  fresnel.physics.components.find(c=>c.type==='planar-interface').parameters.partialReflection=true;
  const incompleteFile=join(out,'incomplete-fresnel.qualified.json');
  await writeFile(incompleteFile,JSON.stringify(await explorationBundle(fresnel,null,req),null,2)+'\n');
  await upload(incompleteFile);
  s=await until(state,s=>s.native==='incomplete'&&s.results===null&&
    s.text.includes('suppressed'),'incomplete Fresnel withholding');
  assert.equal(s.fitDisabled,true);
  check('Incomplete Fresnel branches withhold footprint and detector count, never promoting partial samples');
  await shot('incomplete-fresnel-footprint-withheld');
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
