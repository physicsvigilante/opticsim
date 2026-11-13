import {parseQualifiedBundle} from '../src/qualification.js';
// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'test-artifacts','browser-polygon-dielectric');
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

  const acceptance=JSON.parse(await readFile(join(root,'test-artifacts/llm-authoring/polygon-dielectric/acceptance.json'),'utf8')),b=acceptance.browserBundles;
  const exit=s=>s.results?.[1]?.value?.['face-34']?.first;
  await cdp.send('Page.navigate',{url:origin+'/?scene=polygon-dielectric'});
  let s=await until(state,x=>x.status==='completed'&&x.model.includes('Convex polygon'),'bundled polygon');
  assert.equal(s.error,'');assert.match(s.analysis,/unavailable/);
  check('Same viewer loads the new convex quadrilateral without asserting an image');
  await upload(b.normal);
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===2&&exit(x)?.from==='inside','qualified polygon');
  assert.equal(s.results[3].value,1);assert.equal(s.results[1].value['face-23'].interactions,0);
  assert.equal(s.results[1].value['face-41'].first,null);assert.equal(exit(s).transmittedAngleDeg,0);
  assert.match(s.text,/face-34/);assert.match(s.text,/approximation/);
  assert.match(await evaluate("document.querySelector('label[for=\"G1-x4\"]').textContent"),/Vertex 4 x.*mm/);
  check('Qualified polygon shows actual entry/exit, all four face summaries and native detector reading');
  const pixels=await evaluate("(()=>{const c=document.getElementById('light'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>0)n++;return n;})()");
  assert.ok(pixels>100);report.nativeLightPixels=pixels;
  check('Real PhyDemo rays are drawn on the light canvas');await shot('polygon-native-refraction');
  const previous=structuredClone(s.results);
  await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.status==='completed'&&!x.fitDisabled,'polygon fit');
  assert.deepEqual(s.results,previous);check('Shared camera Fit does not change polygon physics or readings');
  await edit('G1-x3',160);s=await until(state,x=>x.status==='completed'&&exit(x)?.incidentAngleDeg>1,'polygon corner physical edit');
  check('Vertex edit changes native exit face angle');
  await edit('G1-insideIndex',1.4);s=await until(state,x=>x.status==='completed'&&exit(x)?.incidentIndex===1.4,'inside-index');
  await edit('G1-outsideIndex',1.1);s=await until(state,x=>x.status==='completed'&&exit(x)?.destinationIndex===1.1,'outside-index');
  check('Both refractive indices edit real native material properties');
  await evaluate('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified export');
  const savedFile=join(downloads,filename),bundle=await parseQualifiedBundle(await readFile(savedFile,'utf8'));
  const material=bundle.scene.physics.components.find(c=>c.id==='G1').parameters;
  assert.equal(bundle.scene.schemaVersion,9);assert.equal(material.x3,160);
  assert.equal(material.insideIndex,1.4);assert.equal(material.outsideIndex,1.1);
  assert.ok(bundle.qualification.edits.filter(e=>e.kind==='physics').length>=3);
  assert.ok(bundle.qualification.interpretation?.assumptions?.some(x=>x.includes('Synthetic')));
  await upload(savedFile);
  s=await until(state,x=>x.status==='completed'&&exit(x)?.destinationIndex===1.1,'qualified reopen');
  check('Qualified JSON export/reopen retains vertices, material indices and original assumptions');
  await edit('S1-directionDeg',-5);
  s=await until(state,x=>x.status==='completed'&&Math.abs(x.results?.[2]?.value.incidentAngleDeg-5)<1e-6,'physical source direction');
  check('Single native source direction edit changes incidence, not emission density');
  await upload(b['inside-tir']);
  s=await until(state,x=>x.status==='completed'&&x.results?.[1]?.value&&
     Object.values(x.results[1].value).some(f=>f.first?.outcome==='total-internal-reflection'),'native polygon TIR');
  assert.ok(Object.values(s.results[1].value).some(f=>f.first?.outcome==='total-internal-reflection'&&f.first.transmittedAngleDeg===null));
  check('Actual total internal reflection has no fabricated transmitted branch');
  await shot('polygon-native-tir');
  await upload(b['full-fresnel']);
  s=await until(state,x=>x.status==='incomplete'&&x.results===null&&x.text.includes('suppressed'),'incomplete Fresnel');
  assert.equal(s.fitDisabled,true);check('Truncated native Fresnel run clears all accepted readings');
  await shot('polygon-fresnel-suppressed');
  await upload(b.miss);s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===0,'native miss');
  assert.equal(s.results[2].status,'unavailable');
  assert.ok(Object.values(s.results[1].value).every(f=>f.interactions===0&&f.first===null));
  check('True native miss retains zero interactions and unavailable first event');
  await upload(b.normal);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===2,'restore normal');
  await edit('G1-x4',0);s=await until(state,x=>x.status==='invalid','invalid repeated vertex');
  assert.equal(s.saveDisabled,true);assert.equal(s.fitDisabled,true);assert.equal(s.results,null);
  check('Degenerate polygon is rejected, not approximated as a different glass object');
  await upload(b.normal);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===2,'restore viewport');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await until(()=>evaluate("(()=>{const r=document.getElementById('stage').getBoundingClientRect();return ['light','below','above','grid'].every(id=>{const c=document.getElementById(id);return c.width===Math.max(200,Math.round(r.width))&&c.height===Math.max(200,Math.round(r.height));});})()"),Boolean,'narrow canvas');
  await until(state,x=>x.status==='completed'&&!x.fitDisabled,'narrow ready');
  await evaluate('document.getElementById("fit-results").click()');s=await until(state,x=>x.status==='completed'&&!x.fitDisabled,'narrow fit');
  assert.equal(s.results[0].value,2);assert.equal(s.results[3].value,1);
  check('Mobile viewport Fit retains native polygon and detector readings');await shot('polygon-mobile');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await evaluate("(()=>{const e=document.getElementById('examples');e.value='triangular-prism';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until(state,x=>x.status==='completed'&&x.model.includes('Triangular prism'),'old prism');
  check('Existing triangular prism still loads unchanged in shared viewer');
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
 console.log('Polygon dielectric browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
