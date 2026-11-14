import {parseQualifiedBundle} from '../src/qualification.js';
// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const baseOut=join(root,'test-artifacts','browser-finite-shape-composition');
await mkdir(baseOut,{recursive:true});
const out=await mkdtemp(join(baseOut,'attempt-'));
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
 const report={browser:version,checks:[],screenshots:[],errors:[],serverMode:'existing static viewer; no public deployment'};let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,s=>s===200,'static server');
  const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),n=>n>0,'Chrome');
  const page=await until(async()=>(await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json()).find(x=>x.type==='page'),x=>!!x?.webSocketDebuggerUrl,'Chrome page target');
  cdp=await connect(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  cdp.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>evaluate('({title:document.getElementById("title").textContent,status:document.getElementById("status").dataset.state,error:document.getElementById("error").textContent,results:JSON.parse(document.getElementById("observable-results").dataset.results||"null"),text:document.getElementById("observable-results").textContent,saveDisabled:document.getElementById("save-qualified").disabled,fitDisabled:document.getElementById("fit-results").disabled,model:document.getElementById("model-label").textContent,analysis:document.getElementById("analysis-status").textContent})');
  const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1});const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});};
  const edit=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||e.disabled)throw Error('Field unavailable');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  const check=name=>report.checks.push({name,status:'pass'});
  const shot=async name=>{const image=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(image.data,'base64'));report.screenshots.push(name+'.png');};

  const acceptance=JSON.parse(await readFile(process.argv[2]||join(root,'test-artifacts/llm-authoring/finite-shape-composition/report.json'),'utf8')),b=acceptance.browserBundles;
  await cdp.send('Page.navigate',{url:origin+'/?scene=prism-mirror-composition'});
  let s=await until(state,x=>x.status==='completed'&&x.model.includes('triangle / quadrilateral'),'bundled shape composition');
  assert.equal(s.error,'');assert.match(s.analysis,/unavailable/);
  assert.equal(await evaluate('document.querySelectorAll(".source-menu button").length'),1);
  assert.equal(await evaluate('!!document.getElementById("S1-mode-single-ray")'),true);
  check('Bundled v12 uses the shared model and only explicit single-ray sources');
  await upload(b.normal);s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===4,'qualified prism composition');
  assert.equal(s.results[2].value,1);assert.equal(s.results[3].value,1);assert.equal(s.results[4].value,1);
  assert.deepEqual(Object.keys(s.results[1].value),['face-12','face-23','face-31']);assert.match(s.text,/approximation/);
  const pixels=await evaluate("(()=>{const c=document.getElementById('light'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>0)n++;return n;})()");
  assert.ok(pixels>100);report.nativeLightPixels=pixels;
  check('Native canvas, three prism faces, mirror and return detector show actual qualified observations');await shot('prism-composition-normal');
  const previous=structuredClone(s.results);await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.status==='completed'&&!x.fitDisabled,'fit');assert.deepEqual(s.results,previous);
  check('Fit changes presentation without changing physical evidence');
  await edit('M1-y',100);s=await until(state,x=>x.status==='completed'&&x.results?.[2]?.value===0,'mirror miss');
  assert.equal(s.results[0].value,2);assert.equal(s.results[3].value,0);
  check('Moving the mirror yields a real miss, not an enforced return');await shot('prism-composition-miss');
  await edit('M1-y',0);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===4,'restore');
  await edit('M1-orientationDeg',85);await until(state,x=>x.status==='completed'&&x.results?.[2]?.value===1,'tilt');
  await edit('P1-insideIndex',1.4);await until(state,x=>x.status==='completed'&&x.results?.[1]?.value?.['face-12']?.first?.destinationIndex===1.4,'material');
  await evaluate('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'export');
  const savedFile=join(downloads,filename),bundle=await parseQualifiedBundle(await readFile(savedFile,'utf8'));
  assert.equal(bundle.scene.schemaVersion,12);assert.equal(bundle.scene.physics.components.find(c=>c.id==='P1').parameters.insideIndex,1.4);
  assert.equal(bundle.scene.physics.components.find(c=>c.id==='M1').parameters.orientationDeg,85);
  assert.equal(bundle.scene.simulation.maxRayDepth,8);assert.ok(bundle.qualification.edits.filter(e=>e.kind==='physics').length>=4);
  assert.ok(bundle.qualification.interpretation.assumptions.some(x=>x.includes('synthetic')));
  await upload(savedFile);await until(state,x=>x.status==='completed'&&x.results?.[1]?.value?.['face-12']?.first?.destinationIndex===1.4,'reopen');
  check('Mirror/material edits and original assumptions survive integrity-verified v12 export/reopen');
  await upload(b.normal);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===4,'source reset');
  await edit('S1-directionDeg',2);await until(state,x=>x.status==='completed'&&Math.abs(x.results?.[1]?.value?.['face-12']?.first?.incidentAngleDeg-2)<1e-6,'source angle');
  check('The source edit produces actual oblique native refraction');
  await upload(b['two-mirrors']);s=await until(state,x=>x.status==='completed'&&x.results?.at(-1)?.id==='second-mirror'&&x.results.at(-1).value===1,'second mirror');
  assert.equal(s.results[2].value,1);assert.equal(await evaluate('!!document.getElementById("M2-x")'),true);
  check('Both external mirrors retain their independent native identities with a prism');
  await upload(b['quadrilateral-branch']);s=await until(state,x=>x.status==='completed'&&x.results?.at(-2)?.id==='quadrilateral'&&x.results.at(-2).value===4,'shape replacement');
  assert.equal(s.results[0].status,'unavailable');assert.equal(s.results[0].value,null);
  assert.equal(Object.keys(s.results.at(-1).value).length,4);
  assert.equal(await evaluate('!!document.getElementById("P1-x1")'),false);assert.equal(await evaluate('!!document.getElementById("G1-x4")'),true);
  check('The same v12 family reopens a quadrilateral branch without rebinding retired prism requests');await shot('prism-composition-quadrilateral');
  await upload(b['outside-tir']);s=await until(state,x=>x.status==='completed'&&x.results?.at(-1)?.id==='transmission','TIR');
  assert.equal(s.results.at(-1).status,'unavailable');assert.equal(s.results.at(-1).value,null);
  assert.equal(s.results[1].value['face-12'].first.outcome,'total-internal-reflection');assert.equal(s.results[2].value,0);
  check('TIR reports no manufactured transmitted ray or mirror hit');
  for(const [name,status] of [['full-fresnel','incomplete'],['nine-interactions','incomplete'],['reflected-corner','failed']]){
   await upload(b[name]);s=await until(state,x=>x.status===status&&x.results===null,name);assert.equal(s.fitDisabled,true);
  }
  check('Truncated and corner-ambiguous runs clear all accepted readings');
  await upload(b.normal);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===4,'reset invalid');
  await edit('M1-x',5);s=await until(state,x=>x.status==='invalid','invalid mirror');
  assert.equal(s.results,null);assert.equal(s.saveDisabled,true);assert.equal(s.fitDisabled,true);
  check('Invalid external geometry clears stale results and disables qualified export');
  await upload(b.normal);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===4,'reset viewport');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await until(()=>evaluate("(()=>{const r=document.getElementById('stage').getBoundingClientRect();return ['light','below','above','grid'].every(id=>{const c=document.getElementById(id);return c.width===Math.max(200,Math.round(r.width))&&c.height===Math.max(200,Math.round(r.height));});})()"),Boolean,'narrow canvas');
  await until(state,x=>x.status==='completed'&&!x.fitDisabled,'narrow ready');await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.status==='completed'&&!x.fitDisabled,'narrow fit');assert.equal(s.results[0].value,4);assert.equal(s.results[3].value,1);
  check('Narrow-screen Fit preserves the apparatus and accepted observations');await shot('prism-composition-mobile');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await evaluate("(()=>{const e=document.getElementById('examples');e.value='triangular-prism';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until(state,x=>x.status==='completed'&&x.model.includes('Triangular prism'),'legacy prism');assert.equal(await evaluate('!!document.getElementById("M1-x")'),false);
  check('The historical v8 prism example remains isolated and usable');
  await evaluate("(()=>{const e=document.getElementById('examples');e.value='finite-glass-two-mirrors';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until(state,x=>x.status==='completed'&&x.model.includes('external mirrors'),'legacy v11');assert.equal(await evaluate('!!document.getElementById("M2-x")'),true);
  check('The historical v11 two-mirror example remains usable');assert.deepEqual(report.errors,[]);
  }catch(error){
  try { report.debug=await cdp.send('Runtime.evaluate',{expression:'({url:location.href,body:document.body?.innerText,html:document.documentElement.outerHTML.slice(0,3000)})',returnByValue:true}); } catch {}
  report.errors.push(error.stack);throw error;
 }
 finally{
  cdp?.close();browser.kill();server.kill();
  try{await until(async()=>[browser,server].every(p=>p.exitCode!==null||p.signalCode!==null),Boolean,'shutdown');await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
  finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 console.log('Finite-shape composition browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
