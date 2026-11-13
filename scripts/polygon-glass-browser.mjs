import {parseQualifiedBundle} from '../src/qualification.js';
// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'test-artifacts','browser-polygon-glass');
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
  const acceptance=JSON.parse(await readFile(join(root,'test-artifacts/llm-authoring/polygon-glass/acceptance.json'),'utf8')),b=acceptance.browserBundles;
  const faces=s=>s.results?.[1]?.value;
  const entry=s=>faces(s)?.['face-12']?.first;
  const exit=s=>faces(s)?.['face-34']?.first;
  await cdp.send('Page.navigate',{url:origin+'/?scene=glass-polygon'});
  let s=await until(state,s=>s.status==='completed'&&s.model.includes('Convex polygon glass'),'bundled polygon');
  assert.equal(s.error,'');assert.match(s.analysis,/unavailable/);
  check('Bundled convex polygon scene opens in existing viewer without an image solver');
  await upload(b.oblique);
  s=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===2&&exit(s)?.from==='inside','qualified polygon');
  assert.equal(s.results[3].value,1);
  assert.equal(s.results[0].status,'qualified');
  assert.deepEqual(Object.keys(faces(s)),['face-12','face-23','face-34','face-41']);
  assert.equal(faces(s)['face-23'].first,null);assert.equal(faces(s)['face-41'].first,null);
  assert.ok(Math.abs(entry(s).incidentAngleDeg-8)<1e-6);
  assert.ok(Math.abs(exit(s).transmittedAngleDeg-8)<1e-6);
  assert.match(s.text,/approximation/);assert.match(s.text,/face-34/);assert.match(s.text,/heading/);
  assert.match(await evaluate("document.querySelector('label[for=\"G1-x4\"]').textContent"),/Vertex 4 x.*mm/);
  assert.match(await evaluate("document.querySelector('label[for=\"G1-outsideIndex\"]').textContent"),/dimensionless/);
  check('Qualified v9 records native entry/exit faces, independent slab angle and detector hit');
  const pixels=await evaluate("(()=>{const c=document.getElementById('light'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>0)n++;return n;})()");
  assert.ok(pixels>100);report.nativeLightPixels=pixels;
  check('Light canvas contains actual native refracted rays, not annotations');await shot('polygon-native-entry-exit');
  const before=structuredClone(s.results);
  await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,s=>s.status==='completed'&&!s.fitDisabled,'polygon fit');
  assert.deepEqual(s.results,before);
  check('Shared camera Fit changes only viewport, not prism-like finite-face measurements');
  const angleBefore=exit(s).incidentAngleDeg;
  await edit('G1-x3',130);
  s=await until(state,s=>s.status==='completed'&&exit(s)&&Math.abs(exit(s).incidentAngleDeg-angleBefore)>.2,'vertex 3 physical edit');
  check('Vertex 3 physically tilts the right face and changes native exit incidence');
  const changed=exit(s).incidentAngleDeg;
  await edit('G1-x4',110);
  s=await until(state,s=>s.status==='completed'&&Math.abs(exit(s)?.incidentAngleDeg-changed)>.2,'vertex 4 physical edit');
  check('Vertex 4 controls lower edge independently, not a hard-coded rectangular preset');
  await edit('G1-insideIndex',1.4);
  s=await until(state,s=>s.status==='completed'&&exit(s)?.incidentIndex===1.4,'inside index');
  await edit('G1-outsideIndex',1.1);
  s=await until(state,s=>s.status==='completed'&&exit(s)?.destinationIndex===1.1,'outside index');
  check('Both refractive indices remain genuine editable physical parameters');
  await evaluate('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified polygon export');
  const file=join(downloads,filename),saved=await parseQualifiedBundle(await readFile(file,'utf8'));
  const p=saved.scene.physics.components.find(c=>c.id==='G1').parameters;
  assert.equal(saved.scene.schemaVersion,9);assert.equal(p.x3,130);assert.equal(p.x4,110);
  assert.equal(p.insideIndex,1.4);assert.equal(p.outsideIndex,1.1);
  assert.ok(saved.qualification.edits.filter(e=>e.kind==='physics').length>=4);
  assert.ok(saved.qualification.interpretation.assumptions.some(t=>t.includes('synthetic')));
  await upload(file);
  s=await until(state,s=>s.status==='completed'&&exit(s)?.destinationIndex===1.1,'qualified polygon reopen');
  check('Qualified export/reopen preserves independent vertices, media indices, IDs and synthetic origin');
  await edit('S1-directionDeg',-5);
  s=await until(state,s=>s.status==='completed'&&Math.abs(entry(s)?.incidentAngleDeg-5)<1e-6,'source direction');
  check('Existing exact single-ray emission control changes actual refractive path');
  await upload(b['upper-face-tir']);
  s=await until(state,s=>s.status==='completed'&&faces(s)?.['face-23']?.first?.outcome==='total-internal-reflection','upper face TIR');
  assert.equal(faces(s)['face-23'].first.transmittedAngleDeg,null);
  assert.equal(exit(s).from,'inside');
  check('Native TIR at top redirects toward another finite face without invented transmission');await shot('polygon-tir-then-exit');
  await upload(b['outside-tir']);
  s=await until(state,s=>s.status==='completed'&&s.results?.at(-1)?.status==='unavailable','outside-to-low-index TIR');
  assert.equal(s.results.at(-1).value,null);
  check('Outside high-to-low TIR leaves transmission unavailable, never numeric zero');
  await upload(b['full-fresnel']);
  s=await until(state,s=>s.status==='incomplete'&&s.title.endsWith('full-fresnel')&&s.results===null&&s.text.includes('suppressed'),'Fresnel incomplete');
  assert.equal(s.fitDisabled,true);
  check('Full-Fresnel branch truncation clears all accepted measurements');await shot('polygon-fresnel-incomplete');
  await upload(b.miss);
  s=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===0,'polygon miss');
  assert.equal(s.results[2].status,'unavailable');
  assert.ok(Object.values(faces(s)).every(f=>f.interactions===0&&f.first===null));
  check('Native misses remain zero interactions with four truly empty face records');
  await upload(b.oblique);await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===2,'restore initial');
  await edit('G1-x3',0);
  s=await until(state,s=>s.status==='invalid','invalid convexity');
  assert.equal(s.saveDisabled,true);assert.equal(s.fitDisabled,true);assert.equal(s.results,null);
  check('Degenerate or concave physical edit is rejected atomically, stale measurements cleared');
  await upload(b.oblique);await until(state,s=>s.status==='completed'&&s.results?.[0]?.value===2,'restore responsive');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await until(()=>evaluate("(()=>{const r=document.getElementById('stage').getBoundingClientRect();return ['light','below','above','grid'].every(id=>{const c=document.getElementById(id);return c.width===Math.max(200,Math.round(r.width))&&c.height===Math.max(200,Math.round(r.height));});})()"),Boolean,'narrow canvas');
  await until(state,s=>s.status==='completed'&&!s.fitDisabled,'narrow completed');
  await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,s=>s.status==='completed'&&!s.fitDisabled,'narrow fit');
  assert.equal(s.results[0].value,2);assert.equal(s.results[3].value,1);
  check('Phone-width camera Fit retains native surface and detector measurements');await shot('polygon-mobile');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await evaluate("(()=>{const e=document.getElementById('examples');e.value='triangular-prism';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until(state,s=>s.status==='completed'&&s.model.includes('Triangular prism'),'existing prism scene');
  check('Existing v8 triangular prism remains accessible in exactly the same viewer');
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
 console.log('Polygon glass browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
