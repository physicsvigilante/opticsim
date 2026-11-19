// Real Chrome regression for draft v15 pinned SphericalLens thick-lens train.
// Do not treat green browser pixels as independently certified optics.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,mkdir,mkdtemp,readdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../src/authoring.js';
import {explorationBundle} from '../src/exploration.js';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url)),
 out=join(root,'test-artifacts/browser-native-thick-lenses');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,accept,label){
 let last,reason='';const deadline=Date.now()+25000;
 while(Date.now()<deadline){try{last=await fn();if(accept(last))return last;}catch(e){reason=e.message;}await pause(125);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+reason);
}
function chrome(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
  if(!p.error&&p.status===0)return{bin,version:p.stdout.trim()};
 }
 throw Error('Chrome/Chromium unavailable; cannot certify browser test');
}
async function port(){
 const s=createServer();await new Promise((ok,no)=>s.once('error',no).listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise(ok=>s.close(ok));return p;
}
async function connect(url){
 const ws=new WebSocket(url),callbacks=new Map(),listeners=[];let n=0;
 await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{
  const data=JSON.parse(e.data);if(data.method)listeners.forEach(f=>f(data));
  const cb=callbacks.get(data.id);if(cb){callbacks.delete(data.id);cb(data);}
 });
 return {close:()=>ws.close(),on:f=>listeners.push(f),
  send:(method,params={})=>new Promise((ok,no)=>{
   const id=++n,t=setTimeout(()=>{callbacks.delete(id);no(Error('CDP '+method+' timed out'));},25000);
   callbacks.set(id,x=>{clearTimeout(t);x.error?no(Error(x.error.message)):ok(x.result);});
   ws.send(JSON.stringify({id,method,params}));
  })};
}
await mkdir(out,{recursive:false});
const report={format:'opticsim-native-thick-lenses-browser-v1',status:'running',
 checks:[],screenshots:[],errors:[],requests:[],externalModelCalls:0,
 teacherParticipants:0,physicsIndependentlyCertified:false};
let server,browser,cdp,profile;
try{
 const {bin,version}=chrome();report.browser=version;
 const example=JSON.parse(await readFile(join(root,'examples/native-thick-lens-train.json'),'utf8'));
 const prepared=prepareScene(example.physical),doc=prepared.document;
 assert.equal(doc.schemaVersion,15);
 const bundle=await explorationBundle(doc,null,example.requests);
 const filename=join(out,'native-thick-lenses-qualified.json');
 await writeFile(filename,JSON.stringify(bundle,null,2)+'\n');
 const p=await port(),origin='http://127.0.0.1:'+p;
 profile=await mkdtemp(join(out,'chrome-profile-'));
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(p)},stdio:'ignore'});
 browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--window-size=1440,1050','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await until(async()=>(await fetch(origin)).status,s=>s===200,'local static viewer');
 const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),n=>n>0,'debugging port');
 const pages=await until(async()=>await (await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),
  x=>Array.isArray(x)&&x.some(t=>t.type==='page'),'Chrome page');
 cdp=await connect(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 cdp.on(e=>{
  if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);
  if(e.method==='Network.requestWillBeSent')report.requests.push(e.params.request.url);
 });
 for(const m of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(m);
 const js=async expression=>{
  const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;
 };
 const state=()=>js(`(()=>{const g=id=>document.getElementById(id);return {
  status:g('status').dataset.state,error:g('error').textContent,
  results:JSON.parse(g('observable-results').dataset.results||'null'),
  saveDisabled:g('save-qualified').disabled,
  model:g('model-label').textContent,
  analysis:g('analysis-status').textContent
 };})()`);
 const upload=async f=>{
  const dom=await cdp.send('DOM.getDocument',{depth:-1});
  const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
  assert.ok(input.nodeId);await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[f]});
 };
 const edit=(id,value)=>js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw Error('Missing form field: '+${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
 const check=(name,detail=null)=>report.checks.push({name,passed:true,detail});
 const shot=async name=>{
  const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');
 };
 await cdp.send('Page.navigate',{url:origin+'/?scene=polygon-dielectric'});
 await until(state,s=>s.status==='completed','existing viewer startup');
 await upload(filename);
 const original=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===2&&
  s.results?.[1]?.value===2&&s.results?.[4]?.value===1,'native thick-lens face evidence');
 assert.equal(original.error,'');assert.equal(original.saveDisabled,false);
 assert.match(original.analysis,/unavailable/i);
 assert.equal(original.results[2].value['front-arc'].interactions,1);
 assert.equal(original.results[3].value['back-arc'].interactions,1);
 check('Both native thick lenses report real curved-arc entry/exit events and detector crossing');
 const pixels=await js(`(()=>{const c=document.getElementById('light'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>0)n++;return n;})()`);
 assert.ok(pixels>100);check('Native two-region rays render visibly in actual Chrome',{pixels});await shot('thick-lens-native-ray');
 const fields=await js("(()=>({first:!!document.getElementById('L1-frontRadius'),second:!!document.getElementById('L2-backRadius'),sourceMode:document.getElementById('S1-mode')?.textContent??'',sampling:document.getElementById('sampling-note').textContent,model:document.getElementById('model-label').textContent}))()");
 assert.equal(fields.first,true);assert.equal(fields.second,true);
 assert.match(fields.sourceMode,/Single ray/);assert.match(fields.sampling,/one exact native ray/);
 assert.match(fields.model,/Thick spherical lens train/);
 check('v15 rebuilt both spherical-lens physical input sets and native single-ray controls',fields);
 await edit('L2-insideIndex',1.4);
 const revised=await until(state,s=>s.status==='completed'&&s.results?.[1]?.value===2&&
  s.results?.[3]?.value?.['front-arc']?.first?.destinationIndex===1.4,'L2 physical index edit');
 assert.equal(revised.results[2].value['front-arc'].first.destinationIndex,1.5);
 check('Independent material edit changes L2 native Snell while retaining L1 index');
 const downloads=join(out,'downloads');await mkdir(downloads);
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await js("document.getElementById('save-qualified').click()");
 const exportName=await until(async()=>{const n=(await readdir(downloads)).find(v=>v.endsWith('.json'));return n||null;},Boolean,'qualified download');
 const exported=join(downloads,exportName),read=await parseQualifiedBundle(await readFile(exported,'utf8'));
 assert.equal(read.scene.schemaVersion,15);
 assert.equal(read.scene.physics.components.find(c=>c.id==='L2').parameters.insideIndex,1.4);
 assert.equal(read.scene.physics.components.find(c=>c.id==='L1').parameters.insideIndex,1.5);
 check('Qualified v15 export preserves both thick-lens identities and authored materials');
 await edit('L2-x',25);
 const invalid=await until(state,s=>s.status==='invalid','thick-lens overlap refusal');
 assert.equal(invalid.saveDisabled,true);assert.equal(invalid.results,null);
 check('Overlapping thick-lens edit refuses and hides old native measurements');
 await upload(exported);
 await until(state,s=>s.status==='completed'&&s.results?.[1]?.value===2,'v15 qualified reopen');
 check('Reopening qualified v15 package retraces native curved rays');
 await edit('S1-directionDeg',80);
 const miss=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===0&&
  s.results?.[1]?.value===0,'true native miss');
 assert.equal(miss.results[4].value,0);
 check('Native ray can miss both thick lenses without manufactured surface events');
 await shot('thick-lenses-miss');
 // Chrome reports in-memory blob: download URLs as requests too. They do
 // not contact a provider. Check actual HTTP(S) requests for external hosts,
 // rather than falsely interpreting local qualified-file exports as telemetry.
 const httpRequests=report.requests.filter(u=>/^https?:/i.test(u));
 const externalHttpRequests=httpRequests.filter(u=>!u.startsWith(origin+'/'));
 assert.deepEqual(externalHttpRequests,[],'Unexpected external HTTP(S) request');
 report.requestSummary={localHttpRequests:httpRequests.length,
  localBlobOrDataRequests:report.requests.filter(u=>/^(blob:|data:)/i.test(u)).length,
  otherNonHttpRequests:report.requests.filter(u=>!/^https?:|^blob:|^data:/i.test(u))};
 assert.deepEqual(report.errors,[]);
 check('All HTTP(S) requests stay on the local viewer origin; blob: downloads are not provider calls',{httpRequests:httpRequests.length,externalHttpRequests});
 report.status='checks-passed';
}catch(e){report.status='checks-failed';report.error={message:e.message,stack:e.stack};process.exitCode=1;}
finally{
 cdp?.close();browser?.kill();server?.kill();await pause(300);
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:150});
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error?.message}));
}
