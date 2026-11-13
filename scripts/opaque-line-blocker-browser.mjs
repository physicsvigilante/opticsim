import {parseQualifiedBundle} from '../src/qualification.js';
// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'test-artifacts','browser-opaque-line-blocker');
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

  const acceptance=JSON.parse(await readFile(join(root,'test-artifacts/llm-authoring/opaque-line-blocker/acceptance.json'),'utf8'));
  const b=acceptance.browserBundles;
  await cdp.send('Page.navigate',{url:origin+'/?scene=blocker-detector'});
  let s=await until(state,x=>x.status==='completed'&&x.model.includes('opaque stops supported'),'bundled stop');
  assert.equal(s.error,'');check('Main viewer loads real native Blocker in its general composition family');
  await upload(b.blocked);
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===6&&x.results?.[2]?.value===0,'qualified stop blocked');
  assert.equal(s.results[1].value,6);assert.equal(s.results[3].value,0);
  assert.match(s.text,/sampled absorbed rays/);
  assert.match(await evaluate('document.getElementById("stats").textContent'),/B1: 6 absorbed native rays/);
  check('Six real sampled absorptions and zero downstream crossings, not a continuous-visibility assertion');
  const pixels=await evaluate("(()=>{const c=document.getElementById('light'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>0)n++;return n;})()");
  assert.ok(pixels>100);report.nativeLightPixels=pixels;
  check('Real native source rays are visible on the light canvas');await shot('native-blocked');
  const before=structuredClone(s.results);
  await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.status==='completed'&&!x.fitDisabled,'fit stop');
  assert.deepEqual(s.results,before);check('Same Fit control retains native absorption evidence');
  await edit('B1-y',100);
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===0&&x.results?.[2]?.value===4,'shifted stop');
  assert.ok(Number.isFinite(s.results[3].value));assert.equal(s.results[1].value,6);
  check('Moving finite stop changes real absorptions to zero and detector crossings to four');await shot('native-clear');
  await evaluate('document.getElementById("save-qualified").click()');
  const filename=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified export');
  const file=join(downloads,filename),saved=await parseQualifiedBundle(await readFile(file,'utf8'));
  assert.equal(saved.scene.schemaVersion,4);
  assert.equal(saved.scene.physics.components.find(c=>c.id==='B1').parameters.y,100);
  assert.ok(saved.qualification.edits.some(e=>e.kind==='physics'));
  assert.ok(saved.qualification.interpretation.assumptions.some(x=>x.includes('Synthetic')));
  await upload(file);s=await until(state,x=>x.status==='completed'&&x.results?.[2]?.value===4,'stop reopen');
  check('Portable qualified export/reopen preserves physical stop edit and provenance');
  await upload(b.blocked);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===6,'restore');
  await edit('B1-x',100);s=await until(state,x=>x.status==='invalid','detector overlap');
  assert.equal(s.saveDisabled,true);assert.equal(s.fitDisabled,true);assert.equal(s.results,null);
  check('Intersecting blocker and detector invalidates the scene rather than silently rerouting light');
  await upload(b.blocked);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===6,'restore mobile');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await until(()=>evaluate("(()=>{const r=document.getElementById('stage').getBoundingClientRect();return ['light','below','above','grid'].every(id=>{const c=document.getElementById(id);return c.width===Math.max(200,Math.round(r.width))&&c.height===Math.max(200,Math.round(r.height));});})()"),Boolean,'narrow canvas');
  await until(state,x=>x.status==='completed'&&!x.fitDisabled,'narrow stop');
  await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===6,'narrow fit');
  check('Narrow viewport keeps native blocked-ray counts and Fit');await shot('native-mobile');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await evaluate("(()=>{const e=document.getElementById('examples');e.value='triangular-prism';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until(state,x=>x.status==='completed'&&x.model.includes('Triangular prism'),'old glass scene');
  check('Same viewer still opens unchanged finite prism');
  // Reuse the same native browser harness and qualified import path for circles.
  const circularAcceptance=JSON.parse(await readFile(join(root,
    'test-artifacts/llm-authoring/opaque-circle-blocker/acceptance.json'),'utf8'));
  const circleBundles=circularAcceptance.browserBundles;
  await upload(circleBundles.blocked);
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===6&&x.results?.[2]?.value===0,'native circle blocked');
  assert.equal(s.error,'');assert.equal(s.results[1].value,6);
  assert.match(await evaluate('document.getElementById("stats").textContent'),/B1: 6 absorbed native rays/);
  check('Native CircleBlocker qualified import records six sampled absorptions and no detector crossings');
  await shot('native-circle-blocked');
  const circleBefore=structuredClone(s.results);
  await evaluate('document.getElementById("fit-results").click()');
  s=await until(state,x=>x.status==='completed'&&!x.fitDisabled,'circle fit');
  assert.deepEqual(s.results,circleBefore);
  check('Circle boundary extents fit without altering native observations');
  await edit('B1-radius',10);
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value>0&&x.results?.[0]?.value<6,'partial circle');
  check('Editing physical radius changes native sampled absorption rather than painting rays');
  await edit('B1-y',100);
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===0&&x.results?.[2]?.value===4,'clear circle');
  check('Moving the circular stop yields zero absorptions and four crossings');
  await shot('native-circle-clear');
  const filesBefore=new Set(await readdir(downloads));
  await evaluate('document.getElementById("save-qualified").click()');
  const circleName=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')&&!filesBefore.has(n)),
    Boolean,'circle qualified export');
  const circleFile=join(downloads,circleName),circleSaved=await parseQualifiedBundle(await readFile(circleFile,'utf8'));
  assert.equal(circleSaved.scene.physics.components.find(c=>c.id==='B1').type,'circle-blocker');
  assert.deepEqual(circleSaved.scene.physics.components.find(c=>c.id==='B1').parameters,{x:0,y:100,radius:10});
  assert.ok(circleSaved.qualification.edits.some(e=>e.kind==='physics'));
  await upload(circleFile);
  s=await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===0&&x.results?.[2]?.value===4,'circle reopen');
  check('Portable circular stop export/reopen preserves radius, centre and qualification history');
  await upload(circleBundles.blocked);await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===6,'restore circle');
  await edit('B1-x',60);
  s=await until(state,x=>x.status==='invalid','circle detector tangency');
  assert.equal(s.saveDisabled,true);assert.equal(s.fitDisabled,true);assert.equal(s.results,null);
  check('Tangent circular stop and detector reject the revision before simulation');
  await upload(circleBundles.blocked);
  await until(state,x=>x.status==='completed'&&x.results?.[0]?.value===6,'circle restore final');
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
 console.log('Opaque line blocker browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
