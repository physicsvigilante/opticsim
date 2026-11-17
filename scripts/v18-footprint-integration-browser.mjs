// Research-only REAL Chrome regression: combined v18 native optics plus opt-in directional footprint.
// Uses the ordinary viewer and qualified packages; no browser-side ray tracing.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile,mkdir,mkdtemp,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
import {prepareScene} from '../src/authoring.js';
import {explorationBundle} from '../src/exploration.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'test-artifacts/browser-v18-footprint-integration');
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
 const report={format:'opticsim-v18-footprint-integration-browser-v1',status:'running',browser:version,checks:[],screenshots:[],errors:[],requests:[],externalModelCalls:0,teachingParticipants:0,physicsIndependentlyCertified:false};let cdp;
 try{
  await until(async()=>(await fetch(origin)).status,s=>s===200,'local static server');
  const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'DevTools');
  const targets=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),l=>l.some(x=>x.type==='page'),'page');
  cdp=await connect(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Network.enable');
  cdp.on(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);
   if(e.method==='Network.requestWillBeSent')report.requests.push(e.params.request.url);});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const js=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>js(`(()=>{const e=id=>document.getElementById(id);return {native:e('status').dataset.state,error:e('error').textContent,results:JSON.parse(e('observable-results').dataset.results||'null'),text:e('observable-results').textContent,evidence:e('evidence-summary').textContent,limits:e('evidence-result-limits').textContent,saveDisabled:e('save-qualified').disabled,fitDisabled:e('fit-results').disabled,model:e('model-label').textContent};})()`);
  const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1}),n=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});await cdp.send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[file]});};
  const edit=async(id,value)=>js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||e.disabled)throw Error('Field not editable');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  const check=name=>report.checks.push({name,passed:true});
  const shot=async name=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');};

  // The only qualified request is the derived footprint. This is a real v18
  // thick-lens + mirror + finite-Aperture scene, not the v5 plate fixture.
  const example=JSON.parse(await readFile(join(root,'examples/native-thick-lens-aperture-v18.json'),'utf8'));
  const v18=prepareScene(example.physical).document;
  const req=[{id:'foot',kind:'detector-directional-footprint',componentId:'D1'}];
  assert.equal(v18.schemaVersion,18);
  assert.equal(v18.simulation.maxRayDepth,16);
  const input=join(out,'v18-footprint-only.qualified.json');
  await writeFile(input,JSON.stringify(await explorationBundle(v18,null,req),null,2)+'\n');
  await cdp.send('Page.navigate',{url:origin+'/?scene=polygon-dielectric'});
  await until(state,s=>s.native==='completed'&&!s.error,'initial scene startup');
  await upload(input);
  let s=await until(state,s=>s.native==='completed'&&s.results?.length===1&&
    s.results[0].kind==='detector-directional-footprint'&&s.results[0].value?.observedCount===2&&
    s.results[0].value.towardPositiveNormal.count===1&&
    s.results[0].value.towardNegativeNormal.count===1,
    'v18 native two-lens mirror return, footprint-only capture');
  assert.equal(s.error,'');
  assert.equal(s.results[0].status,'qualified');
  assert.equal(s.results[0].method,'native-detector-directional-footprint');
  assert.equal(s.saveDisabled,false);
  assert.match(s.model,/two thick lenses/i);
  assert.match(s.text,/Toward positive normal/i);
  assert.match(s.evidence,/native sampled readout/i);
  assert.match(s.results[0].limitation,/No physical image/i);
  for(const direction of ['towardPositiveNormal','towardNegativeNormal']){
    assert.equal(s.results[0].value[direction].rmsSpreadMm,0,'One observed sample, not a physical image width');
  }
  check('Only the derived footprint requested: real native +x and -x detector crossings are grouped separately');
  check('A v18 two-thick-lens optical return is rendered as a sampled readout, not an image');
  await shot('v18-two-direction-return');

  // Shift the already authored finite gap; the y=0 native ray is actually
  // absorbed before reaching detector or glass. No stale previous footprint.
  await edit('A1-y',30);
  s=await until(state,s=>s.native==='completed'&&s.results?.length===1&&
    s.results[0].value?.observedCount===0,'v18 gap shifted: native detector miss');
  assert.equal(s.results[0].status,'qualified');
  assert.equal(s.saveDisabled,false);
  for(const direction of ['towardPositiveNormal','towardNegativeNormal']){
    const group=s.results[0].value[direction];
    assert.equal(group.count,0);
    for(const key of ['meanPointMm','meanDistanceFromP1Mm','spanMm','rmsSpreadMm'])
      assert.equal(group[key],null,key+' must be unavailable in an empty sample group');
  }
  check('Moving finite aperture opening produces actual detector miss with null centroid and RMS, never an invented zero-width image');
  await shot('v18-aperture-blocked-null-footprint');

  // Export the revised scene; only provenance and the footprint request
  // are portable. The native measured value is never stored in this bundle.
  await js("document.getElementById('save-qualified').click()");
  const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.qualified.json')),
    Boolean,'qualified v18 footprint export');
  const exported=join(downloads,name),saved=await parseQualifiedBundle(await readFile(exported,'utf8'));
  assert.equal(saved.scene.schemaVersion,18);
  assert.equal(saved.scene.physics.components.find(c=>c.id==='A1').parameters.y,30);
  assert.deepEqual(saved.observables,req);
  assert.equal(Object.hasOwn(saved,'execution'),false);
  assert.equal(Object.hasOwn(saved,'results'),false);
  check('Qualified v18 export retains scene/revision and footprint-only request, never past native measurements');

  // Invalid stop overlapping lens envelope must suppress all old UI results.
  await edit('A1-x',0);
  s=await until(state,s=>s.native==='invalid'&&s.results===null,
    'invalid glass-stop overlap hides old footprint');
  assert.equal(s.saveDisabled,true);
  check('Invalid optical geometry hides old footprint and blocks qualified export');
  await shot('v18-invalid-stop-overlap');

  await upload(exported);
  s=await until(state,s=>s.native==='completed'&&s.results?.length===1&&
    s.results[0].value?.observedCount===0,'reopen qualified blocked v18 footprint');
  assert.equal(s.error,'');
  check('Reopening revised qualified v18 scene freshly recomputes its zero-hit footprint');
  await shot('v18-reopened-blocked');

  await edit('A1-y',0);
  s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.observedCount===2&&
    s.results[0].value.towardPositiveNormal.count===1&&s.results[0].value.towardNegativeNormal.count===1,
    'restored aperture permits fresh native two-direction return');
  check('Restoring the aperture retraces both original real detector directions');
  await shot('v18-return-restored');

  // Full native Fresnel propagation is deliberately incomplete at depth 16.
  // The footprint-only request must not publish a partial sample when the
  // native solver reports an incomplete branch tree.
  const fresnelPhysical=structuredClone(example.physical);
  for(const id of ['L1','L2']){
    fresnelPhysical.components.find(c=>c.id===id).parameters.partialReflection=true;
  }
  const fresnelDoc=prepareScene(fresnelPhysical).document;
  const incomplete=join(out,'v18-fresnel-incomplete.qualified.json');
  await writeFile(incomplete,JSON.stringify(await explorationBundle(fresnelDoc,null,req),null,2)+'\n');
  await upload(incomplete);
  s=await until(state,s=>s.native==='incomplete'&&s.results===null&&
    s.text.includes('suppressed'),'v18 full-Fresnel incomplete: measurement withheld');
  assert.equal(s.fitDisabled,true);
  check('Combined v18 full Fresnel incomplete run withholds footprint rather than reporting partial hits');
  await shot('v18-fresnel-footprint-withheld');

  const http=report.requests.filter(url=>/^https?:/i.test(url));
  assert.deepEqual(http.filter(url=>!url.startsWith(origin+'/')),[],
    'Browser must not contact a remote HTTP provider');
  check('No external HTTP(S) calls; native physics remains browser-local');
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
 console.log('V18 footprint integration Chrome PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
