import {parseQualifiedBundle} from '../src/qualification.js';
// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'test-artifacts','browser-circular-dielectric');
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
  const targets=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();cdp=await connect(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  cdp.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>evaluate('({title:document.getElementById("title").textContent,status:document.getElementById("status").dataset.state,error:document.getElementById("error").textContent,results:JSON.parse(document.getElementById("observable-results").dataset.results||"null"),text:document.getElementById("observable-results").textContent,saveDisabled:document.getElementById("save-qualified").disabled,fitDisabled:document.getElementById("fit-results").disabled,model:document.getElementById("model-label").textContent,analysis:document.getElementById("analysis-status").textContent})');
  const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1});const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});};
  const edit=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||e.disabled)throw Error('Field unavailable');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  const check=name=>report.checks.push({name,status:'pass'});
  const shot=async name=>{const image=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(image.data,'base64'));report.screenshots.push(name+'.png');};
  const acceptance=JSON.parse(await readFile(join(root,'test-artifacts/llm-authoring/circular-dielectric/acceptance.json'),'utf8')),b=acceptance.browserBundles;
  await cdp.send('Page.navigate',{url:origin+'/?scene=circular-dielectric'});
  let s=await until(state,s=>s.status==='completed'&&s.model.includes('Circular dielectric'),'bundled circular scene');
  assert.equal(s.error,'');assert.match(s.analysis,/unavailable/);check('Same viewer opens data-only circular example without a lens image prediction');
  await upload(b.oblique);s=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===2,'qualified circular import');
  assert.equal(s.results[3].value,1);assert.equal(s.results[2].value.from,'outside');assert.match(s.text,/approximation/);assert.match(s.text,/local|normal/);
  assert.equal(await evaluate("document.querySelectorAll('#S1-mode').length"),1);
  assert.equal(await evaluate("document.getElementById('S1-directionDeg').disabled"),false);
  assert.match(await evaluate("document.querySelector('label[for=\"G1-outsideIndex\"]').textContent"),/dimensionless/);
  check('Qualified v7 import reports native entry/exit, detector crossing, explicit outside index and source direction');
  const pixels=await evaluate("(()=>{const c=document.getElementById('light'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>0)n++;return n;})()");
  assert.ok(pixels>100,'Actual native light canvas must contain rays, not only glass fill or annotations');
  report.nativeLightPixels=pixels;check('Native light canvas contains visible refracted rays');await shot('circular-oblique-native');
  const before=structuredClone(s.results);
  await evaluate('document.getElementById("fit-results").click()');s=await until(state,s=>s.status==='completed'&&!s.fitDisabled,'fit full circle');
  assert.deepEqual(s.results,before);check('Existing Fit uses entire circular boundary and changes presentation only');
  await edit('G1-radius',80);s=await until(state,s=>s.status==='completed'&&Math.abs(s.results?.[1]?.value-Math.asin(.25)*180/Math.PI)<1e-6,'radius revision');
  check('Physical radius edits deterministically change native local incidence');
  await edit('G1-insideIndex',2);s=await until(state,s=>s.status==='completed'&&s.results?.[2]?.value.incidentIndex===1&&s.results?.[2]?.value.destinationIndex===2,'inside index');
  await edit('G1-outsideIndex',1.5);s=await until(state,s=>s.status==='completed'&&s.results?.[2]?.value.incidentIndex===1.5,'outside index');
  check('Inside and outside indices remain physical facts, not browser-only shading');
  await evaluate('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified export');
  const file=join(downloads,filename),saved=await parseQualifiedBundle(await readFile(file,'utf8'));
  const p=saved.scene.physics.components.find(c=>c.id==='G1').parameters;
  assert.equal(saved.scene.schemaVersion,7);assert.equal(p.radius,80);assert.equal(p.insideIndex,2);assert.equal(p.outsideIndex,1.5);
  assert.ok(saved.qualification.edits.length>=3);assert.ok(saved.qualification.edits.filter(e=>e.kind==='physics').length>=3);
  assert.ok(saved.qualification.interpretation.assumptions.some(s=>s.includes('synthetic')));
  await upload(file);s=await until(state,s=>s.status==='completed'&&s.results?.[2]?.value.incidentIndex===1.5,'qualified reopen');
  check('Shared qualified save/reopen preserves v7 geometry, both indices and original synthetic assumptions');
  await edit('S1-directionDeg',-5);s=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===2&&Math.abs(s.results?.[1]?.value-before[1].value)>1e-4,'source direction');
  check('Existing source-direction control changes native rays without adding a new control panel');
  await upload(b['outside-tir']);s=await until(state,s=>s.status==='completed'&&s.results?.[2]?.value.outcome==='total-internal-reflection','outside TIR');
  assert.equal(s.results[1].status,'unavailable');assert.equal(s.results[1].value,null);assert.equal(s.results[3].value,1);
  check('Native TIR at lower-index region shows reflected ray and no fabricated transmission');await shot('circular-outside-tir');
  await upload(b['full-fresnel']);s=await until(state,s=>s.status==='incomplete'&&s.results?.every(r=>r.status==='suppressed'),'full Fresnel truncation');
  assert.ok(s.results.every(r=>r.value===null));check('Full Fresnel truncation suppresses accepted native measurements');await shot('circular-fresnel-incomplete');
  await upload(b['trapped-tir']);s=await until(state,s=>s.status==='incomplete'&&s.results?.length===3&&s.results.every(r=>r.status==='suppressed'),'trapped interior TIR');
  check('Repeated interior TIR respects native depth limits and cannot display stale results');
  await upload(b.miss);s=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===0,'native miss');
  assert.equal(s.results[1].status,'unavailable');assert.equal(s.results[2].status,'unavailable');check('A finite-circle miss reports zero interactions rather than a fake ray encounter');
  await upload(b.oblique);await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===2,'restore');
  await edit('G1-radius',-100);s=await until(state,s=>s.status==='invalid','invalid radius');assert.equal(s.saveDisabled,true);assert.equal(s.fitDisabled,true);
  assert.ok(!s.results||s.results.every(r=>!['available','qualified'].includes(r.status)));check('Invalid geometry clears old qualified readings and blocks export');
  await upload(b.oblique);await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===2,'restore for resize');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await until(state,s=>s.status==='completed'&&!s.fitDisabled,'narrow view');
  await evaluate('document.getElementById("fit-results").click()');s=await until(state,s=>s.status==='completed'&&!s.fitDisabled,'narrow fit');
  assert.equal(s.results[0].value,2);assert.equal(s.results[3].value,1);check('Narrow viewport and fit preserve actual native readings');await shot('circular-mobile');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await evaluate("(()=>{const e=document.getElementById('examples');e.value='single-lens';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until(state,s=>s.status==='completed'&&s.model.includes('Ideal lenses'),'legacy lens restored');
  check('Legacy lens example reopens in the same viewer after circular scenes');
  assert.deepEqual(report.errors,[]);
  }catch(error){
  try { report.debug=await cdp.send('Runtime.evaluate',{expression:'({url:location.href,body:document.body?.innerText,html:document.documentElement.outerHTML.slice(0,3000)})',returnByValue:true}); } catch {}
  report.errors.push(error.stack);throw error;
 }
 finally{
  cdp?.close();browser.kill();server.kill();
  try{await until(async()=>[browser,server].every(p=>p.exitCode!==null||p.signalCode!==null),Boolean,'shutdown');await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
  finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 console.log('Circular dielectric browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
