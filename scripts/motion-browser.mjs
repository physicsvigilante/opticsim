// Actual Chromium checks, including direct file opening of the portable demo.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {prepareMotionExperiment} from '../src/source-motion.js';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'test-artifacts/browser-source-motion');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms)),timeout=25000;
async function until(fn,ok,label){let last,error;const end=Date.now()+timeout;
 while(Date.now()<end){try{last=await fn();if(ok(last))return last;}catch(e){error=e.message;}await sleep(100);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(error||''));}
function chrome(){for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
 const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});if(!r.error&&r.status===0)return {bin,version:r.stdout.trim()};}throw Error('No browser available');}
async function freePort(){const s=createServer();await new Promise((ok,err)=>s.once('error',err).listen(0,'127.0.0.1',ok));const port=s.address().port;await new Promise((ok,err)=>s.close(e=>e?err(e):ok()));return port;}
async function connect(url){const ws=new WebSocket(url),pending=new Map();let n=0;await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data),fn=pending.get(r.id);if(fn){pending.delete(r.id);fn(r);}});
 return {close:()=>ws.close(),send:(method,params={})=>new Promise((ok,err)=>{const id=++n,timer=setTimeout(()=>{pending.delete(id);err(Error(method+' timeout'));},timeout);pending.set(id,r=>{clearTimeout(timer);r.error?err(Error(r.error.message)):ok(r.result);});ws.send(JSON.stringify({id,method,params}));})};}
async function main(){
 const downloads=join(out,'downloads');await mkdir(downloads,{recursive:true});const {bin,version}=chrome();
 const profile=await mkdtemp(join(out,'profile-')),port=await freePort(),origin='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1500,1100','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={browser:version,checks:[],screenshots:[],errors:[]};let cdp;
 try{
  await until(async()=>(await fetch(origin+'/motion.html')).status,x=>x===200,'server');
  const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome');
  const targets=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();cdp=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>evaluate('({state:document.getElementById("native-state").dataset.state,time:document.getElementById("clock").textContent,index:document.getElementById("time").value,object:document.getElementById("object-value").textContent,image:document.getElementById("image-value").textContent,velocity:document.getElementById("velocity-value").textContent,model:document.getElementById("image-model").textContent,note:document.getElementById("plot-note").textContent,error:document.getElementById("error").hidden?null:document.getElementById("error").textContent,saveDisabled:document.getElementById("save-frame").disabled,playing:document.getElementById("play").disabled,assumptions:document.getElementById("assumptions").textContent})');
  const seek=i=>evaluate('(()=>{const e=document.getElementById("time");e.value="'+i+'";e.dispatchEvent(new Event("input",{bubbles:true}));})()');
  const upload=async path=>{const dom=await cdp.send('DOM.getDocument',{depth:-1}),input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#open-motion'});await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});};
  const shot=async name=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');};
  const check=name=>report.checks.push({name,status:'pass'});
  await cdp.send('Page.navigate',{url:origin+'/motion.html'});
  let s=await until(state,s=>s.state==='completed'&&s.index==='0','initial native frame');
  assert.equal(s.error,null);assert.match(s.velocity,/-56\.5685/);assert.match(s.velocity,/-14\.1421/);assert.match(s.assumptions,/constant/i);
  check('U2 initial native frame and separate analytical velocity with explicit assumptions');await shot('motion-initial');
  await evaluate('document.getElementById("play").click()');await until(state,s=>Number(s.index)>=2,'play advances');
  await evaluate('document.getElementById("pause").click()');await sleep(150);const paused=await state();await sleep(400);assert.equal((await state()).index,paused.index);
  check('play advances sequential native frames and pause prevents later time advancement');
  await seek(30);s=await until(state,s=>s.state==='completed'&&s.index==='30','scrub');assert.match(s.time,/0\.250/);assert.match(s.object,/-24\.1161/);
  check('scrub deterministically recomputes t=0.25 rather than adding incremental displacement');await shot('motion-midpoint');
  await evaluate('document.getElementById("save-frame").click()');
  const snap=await until(async()=>(await readdir(downloads)).find(x=>x.endsWith('.qualified.json')),Boolean,'snapshot export');
  const b=await parseQualifiedBundle(await readFile(join(downloads,snap),'utf8'));
  assert.ok(Math.abs(b.scene.physics.components[0].parameters.x-(-250+12.5/Math.SQRT2))<1e-7);
  assert.equal(b.qualification.origin.preparationStatus,'illustrative');assert.match(b.qualification.interpretation.derived.at(-1),/t=0.25/);
  check('static snapshot export keeps assumption history and evaluated time');
  await evaluate('document.getElementById("save-motion").click()');
  const saved=await until(async()=>(await readdir(downloads)).find(x=>x.endsWith('.experiment.json')),Boolean,'experiment export');
  const reloaded=await prepareMotionExperiment(await readFile(join(downloads,saved),'utf8'));assert.equal(reloaded.spec.samples,61);
  await upload(join(downloads,saved));await until(state,s=>s.state==='completed'&&s.index==='0','reopen experiment');
  check('saved experiment reopens with verified baseline and original motion law');
  await seek(60);await until(state,s=>s.state==='completed'&&s.index==='60','last frame');
  await evaluate('document.getElementById("reset").click()');s=await until(state,s=>s.state==='completed'&&s.index==='0','reset');assert.match(s.object,/-25/);
  check('reset restores exact baseline, not a reversed integration');
  await evaluate('(()=>{const e=document.getElementById("example");e.value="circular";e.dispatchEvent(new Event("change",{bubbles:true}));})()');
  s=await until(state,s=>s.state==='completed'&&s.model.includes('Paraxial'),'circular model');assert.match(s.model,/aberration/);
  check('circular native model remains distinct from its paraxial calculated image');await shot('motion-circular');
  await upload(join(root,'test-artifacts/llm-authoring/source-motion/focal.experiment.json'));await until(state,s=>s.index==='0'&&s.state==='completed','focal control load');await seek(2);
  s=await until(state,s=>s.index==='2'&&s.state!=='running','focus frame');
  assert.ok(s.image==='At infinity'||s.image.includes('indeterminate'));assert.match(s.note,/infinity|singularity/);
  check('focal event withholds finite image marker and velocity instead of clipping');
  await upload(join(root,'test-artifacts/llm-authoring/source-motion/tampered.experiment.json'));
  s=await until(state,s=>s.state==='invalid'&&s.error,'tamper rejection');assert.equal(s.saveDisabled,true);assert.match(s.error,/integrity/);
  check('tampered experiment clears current outputs and disables export');
  await cdp.send('Page.navigate',{url:pathToFileURL(join(root,'test-artifacts/motion-demo/index.html')).href});
  s=await until(state,s=>s.state==='completed'&&s.index==='0','portable offline file');assert.equal(s.error,null);
  check('portable demonstration works directly from file:// without an install or model API');

  // The same canonical controls as the static editor are bound to a real
  // qualified motion experiment; this is not visual-only brightness.
  const rayInfo=()=>evaluate("(()=>{const e=id=>document.getElementById(id);return {state:e('native-state').dataset.state,hash:e('experiment-hash').textContent,brightness:e('ray-brightness').value,sampling:e('ray-sampling').value,mode:e('ray-source-mode').value,direction:e('ray-direction').value,opening:e('ray-opening').value,view:e('ray-view').value,grid:e('ray-grid').checked,counts:e('native-counts').textContent,error:e('ray-control-error').hidden?null:e('ray-control-error').textContent,velocity:e('velocity-value').textContent,edits:e('ray-control-note').textContent,expanded:e('ray-settings').open};})()");
  const changeRay=(id,value)=>evaluate("(()=>{const e=document.getElementById("+JSON.stringify(id)+");e.value="+JSON.stringify(value)+";e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  const settled=(r)=>['completed','completed-with-warnings'].includes(r?.state);
  const afterChange=async(previousHash,label)=>until(rayInfo,r=>settled(r)&&r.hash!==previousHash&&r.error===null,label);
  let ray=await until(rayInfo,settled,'initial ray controls');
  assert.equal(ray.brightness,'0.05');assert.equal(ray.sampling,'dense');assert.equal(ray.mode,'directional');
  assert.equal(ray.opening,'40');assert.equal(ray.expanded,false);
  await evaluate("document.querySelector('#ray-settings > summary').click()");
  assert.equal((await rayInfo()).expanded,true);
  check('portable ray settings reuse actual static source and sampling fields');
  const originalHash=ray.hash,initialCount=Number.parseInt(ray.counts,10),oldVelocity=ray.velocity;
  await changeRay('ray-brightness','0.25');
  ray=await afterChange(originalHash,'physical brightness revision');
  assert.equal(ray.brightness,'0.25');assert.equal(ray.velocity,oldVelocity);
  assert.match(ray.edits,/1 qualified baseline edit/);
  check('physical brightness is revised with a new experiment hash and unchanged conditional image motion');
  const brightHash=ray.hash;
  await changeRay('ray-sampling','sparse');
  ray=await afterChange(brightHash,'sparse native sampling');
  assert.equal(ray.sampling,'sparse');
  assert.ok(Number.parseInt(ray.counts,10)<initialCount,'sparse must emit fewer actual native rays');
  assert.equal(ray.velocity,oldVelocity);
  check('Sparse density actually reduces native emitted rays while preserving analytical velocity');
  const sparseHash=ray.hash;
  await changeRay('ray-direction','8');
  ray=await afterChange(sparseHash,'direction revision');
  assert.equal(ray.direction,'8');
  await changeRay('ray-opening','32');
  ray=await afterChange(ray.hash,'cone-opening revision');
  assert.equal(ray.opening,'32');
  check('direction and cone changes are validated physical revisions');
  await changeRay('ray-source-mode','single-ray');
  ray=await afterChange(ray.hash,'one exact native ray');
  assert.equal(ray.mode,'single-ray');
  assert.equal(Number.parseInt(ray.counts,10),1,'single-ray is not enlarged by sampling density');
  check('Single-ray mode emits exactly one native ray despite density controls');
  await changeRay('ray-view','extended');
  ray=await afterChange(ray.hash,'extended-ray display mode');
  assert.equal(ray.view,'extended');
  check('Extended native ray view retains experiment provenance');
  await changeRay('ray-brightness','-1');
  ray=await until(rayInfo,r=>settled(r)&&r.error&&r.error.includes('brightness'),'rejected brightness');
  assert.equal(ray.brightness,'0.25');
  const retained=ray.hash;
  await sleep(100);assert.equal((await rayInfo()).hash,retained);
  check('Invalid physical brightness is rejected without mutating the accepted experiment');
  await rm(join(downloads,saved));
  await evaluate('document.getElementById("save-motion").click()');
  const repack=await until(async()=>(await readdir(downloads)).find(x=>x.endsWith('.experiment.json')),Boolean,'revised experiment export');
  const revised=await prepareMotionExperiment(await readFile(join(downloads,repack),'utf8'));
  const source=revised.baseline.scene.physics.components.find(c=>c.type==='point-source');
  assert.equal(source.parameters.brightness,0.25);
  assert.equal(source.emission.mode,'single-ray');
  assert.equal(source.emission.directionDeg,8);
  assert.equal(source.emission.angleDeg,32);
  assert.equal(revised.baseline.scene.simulation.rayDensity,0.048);
  assert.equal(revised.baseline.scene.presentation.mode,'extended');
  assert.ok(revised.baseline.qualification.edits.some(x=>x.kind==='physics'));
  assert.ok(revised.baseline.qualification.edits.some(x=>x.kind==='numerics'));
  assert.ok(revised.baseline.qualification.edits.some(x=>x.kind==='presentation'));
  assert.equal(revised.spec.samples,61);
  assert.equal(revised.baseline.qualification.origin.preparationStatus,'illustrative');
  check('Revised portable experiment retains original assumptions and complete physics/numeric/presentation edit history');
  await upload(join(downloads,repack));
  ray=await until(rayInfo,r=>settled(r)&&r.hash===retained,'reopen revised ray experiment');
  assert.equal(ray.brightness,'0.25');assert.equal(ray.mode,'single-ray');assert.equal(ray.sampling,'sparse');
  check('Reopening a saved revised motion experiment restores ray controls and native execution');

 }catch(error){report.errors.push(error.stack);throw error;}
 finally{cdp?.close();browser.kill();server.kill();try{await until(async()=>[browser,server].every(p=>p.exitCode!==null||p.signalCode!==null),Boolean,'shutdown');await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
 console.log('Source motion browser PASS: '+report.checks.length+' checks, '+report.screenshots.length+' screenshots.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
