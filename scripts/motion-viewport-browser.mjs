// Viewport regression using the real built native bundle and portable file:// page.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'test-artifacts/browser-source-motion/camera');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,ok,label){let last;const end=Date.now()+25000;while(Date.now()<end){last=await fn();if(ok(last))return last;await sleep(60);}throw Error(label+': '+JSON.stringify(last));}
function chrome(){for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
 const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});if(!r.error&&r.status===0)return {bin,version:r.stdout.trim()};}throw Error('Chrome is required');}
async function connect(url){const ws=new WebSocket(url),pending=new Map();let n=0;
 await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data),fn=pending.get(r.id);if(fn){pending.delete(r.id);fn(r);}});
 return {close:()=>ws.close(),send:(method,params={})=>new Promise((ok,err)=>{const id=++n,timer=setTimeout(()=>{pending.delete(id);err(Error(method+' timeout'));},25000);
  pending.set(id,r=>{clearTimeout(timer);r.error?err(Error(r.error.message)):ok(r.result);});ws.send(JSON.stringify({id,method,params}));})};}
async function main(){
 await mkdir(out,{recursive:true});const {bin,version}=chrome(),profile=await mkdtemp(join(out,'profile-'));
 const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 const report={browser:version,checks:[],framesChecked:0,screenshots:[],errors:[]};let cdp;
 try{
  const port=await until(async()=>{try{return Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return 0;}},n=>n>0,'Chrome');
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();cdp=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const state=()=>evaluate(`(()=>{const el=id=>document.getElementById(id);if(!['native-state','time','native-stage','image-plot','native-counts','experiment-hash','plot-note','image-value','zoom-level','zoom-fit'].every(id=>el(id)))return null;return {state:el('native-state').dataset.state,index:el('time').value,viewport:el('native-stage').dataset.viewport?JSON.parse(el('native-stage').dataset.viewport):null,plot:el('image-plot').dataset.viewport?JSON.parse(el('image-plot').dataset.viewport):null,counts:el('native-counts').textContent,hash:el('experiment-hash').textContent,zoom:el('zoom-level')?.textContent,zoomFitDisabled:el('zoom-fit')?.disabled,note:el('plot-note').textContent,image:el('image-value').textContent};})()`);
  const seek=async(i,requireCompleted=true)=>{await evaluate(`(()=>{const e=document.getElementById('time');e.value='${i}';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);return until(state,s=>s&&(requireCompleted?s.state==='completed':s.state!=='running')&&s.index===String(i)&&s.viewport,'native frame '+i);};
  const change=async(id,value)=>{await evaluate(`(()=>{const e=document.getElementById('${id}');e.value='${value}';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);return until(state,s=>s?.state==='completed'&&s.viewport&&(id!=='camera-mode'||s.viewport.mode===value),'change '+id);};
  const contained=s=>{for(const key of ['image','object']){const p=s.viewport[key];assert.equal(p.visible,true);assert.ok(p.x>=16&&p.x<=s.viewport.width-16);assert.ok(p.y>=16&&p.y<=s.viewport.height-16);}assert.equal(s.plot.image.visible,true);};
  const shot=async name=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');};
  for(const width of [1440,390]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
   await cdp.send('Page.navigate',{url:pathToFileURL(join(root,'test-artifacts/motion-demo/index.html')).href});
   await until(state,s=>s?.state==='completed'&&s.viewport,'portable page');
   for(const type of ['ideal','circular']){
    await change('example',type);const first=await seek(0),fixed=first.viewport;
    for(let i=0;i<61;i++){
     const s=await seek(i);contained(s);assert.equal(s.viewport.mode,'motion');
     assert.equal(s.viewport.scale,fixed.scale);assert.deepEqual(s.viewport.origin,fixed.origin);
     assert.equal(s.hash,first.hash);report.framesChecked++;
     if(i===30&&width===1440&&type==='ideal')await shot('whole-motion-midpoint');
    }
    if(type==='ideal'&&width===390)await shot('whole-motion-phone');
    report.checks.push({name:type+' full motion at '+width+'px',status:'pass',frames:61});
   }
  }
  // Camera is a reusable presentation control, not a field in U2 or in
  // source-motion data. Real Chrome replays the same accepted native scene.
  // Restore desktop viewport before testing real pointer interactions.
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate',{url:pathToFileURL(join(root,'test-artifacts/motion-demo/index.html')).href});
  await until(state,s=>s?.state==='completed'&&s.viewport,'zoom interaction page');
  const baseline=await change('camera-mode','motion');
  const beforeZoom=await seek(30),physicalCounts=beforeZoom.counts,originalHash=beforeZoom.hash;
  assert.equal(beforeZoom.zoom,'100%');
  await evaluate("document.getElementById('zoom-in').click()");
  let zoomed=await until(state,s=>s?.state==='completed'&&s.index==='30'&&s.zoom!=='100%'&&s.viewport?.scale>beforeZoom.viewport.scale+1e-9,'zoom-in native repaint');
  assert.ok(zoomed.viewport.scale>beforeZoom.viewport.scale);
  assert.ok(zoomed.plot.scale>beforeZoom.plot.scale);
  assert.equal(zoomed.hash,originalHash);assert.equal(zoomed.counts,physicalCounts);
  const scale=zoomed.viewport.scale,origin=zoomed.viewport.origin;
  const atLast=await seek(60);
  assert.equal(atLast.zoom,zoomed.zoom);
  assert.equal(atLast.viewport.scale,scale);
  assert.deepEqual(atLast.viewport.origin,origin);
  report.checks.push({name:'Zoom-in follows fixed whole-motion camera across time and both views; unchanged physics',status:'pass'});
  const beforeOut=await seek(30);
  await evaluate("document.getElementById('zoom-out').click()");
  const recovered=await until(state,s=>s?.state==='completed'&&s.index==='30'&&s.zoom==='100%'&&Math.abs(s.viewport?.scale-beforeZoom.viewport.scale)<1e-8,'zoom-out');
  assert.equal(recovered.viewport.scale,beforeZoom.viewport.scale);
  assert.deepEqual(recovered.viewport.origin,beforeZoom.viewport.origin);
  report.checks.push({name:'Zoom-out returns to fitted camera without changing native results',status:'pass'});
  await evaluate("(()=>{const e=document.getElementById('native-stage'),r=e.getBoundingClientRect();e.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,clientX:r.left+r.width*.4,clientY:r.top+r.height*.65,bubbles:true,cancelable:true}));})()");
  const wheel=await until(state,s=>s?.state==='completed'&&s.index==='30'&&s.zoom!=='100%'&&s.viewport?.scale>recovered.viewport.scale+1e-9,'wheel zoom');
  assert.ok(wheel.viewport.scale>recovered.viewport.scale);
  assert.equal(wheel.counts,physicalCounts);
  report.checks.push({name:'Wheel zoom at cursor updates camera while preserving native interactions',status:'pass'});
  await evaluate("document.getElementById('zoom-fit').click()");
  const fittedAgain=await until(state,s=>s?.state==='completed'&&s.index==='30'&&s.zoom==='100%'&&Math.abs(s.viewport?.scale-baseline.viewport.scale)<1e-8,'fit reset');
  assert.equal(fittedAgain.viewport.scale,baseline.viewport.scale);
  assert.equal(fittedAgain.zoomFitDisabled,true);
  report.checks.push({name:'Fit resets zoom and pan to the selected automatic camera preset',status:'pass'});
  // Drag real pointer over the canvas; native ray counts and package hashes
  // must remain unchanged when only the view centre changes.
  const rect=await evaluate("(()=>{const r=document.getElementById('native-stage').getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.5};})()");
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x,y:rect.y});
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x,y:rect.y,button:'left',buttons:1,clickCount:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+45,y:rect.y+20,button:'left',buttons:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+45,y:rect.y+20,button:'left',buttons:0,clickCount:1});
  const panned=await until(state,s=>s?.state==='completed'&&s.index==='30'&&s.zoomFitDisabled===false&&Math.abs(s.viewport?.origin.x-fittedAgain.viewport.origin.x)>1,'drag pan repaint');
  assert.equal(panned.hash,originalHash);assert.equal(panned.counts,physicalCounts);
  assert.ok(Math.abs(panned.viewport.origin.x-fittedAgain.viewport.origin.x-45)<2);
  assert.ok(Math.abs(panned.viewport.origin.y-fittedAgain.viewport.origin.y-20)<2);
  report.checks.push({name:'Real pointer drag pans both views without moving an optical component',status:'pass'});
  await evaluate("document.getElementById('zoom-fit').click()");
  await until(state,s=>s?.state==='completed'&&s.zoomFitDisabled===true&&Math.abs(s.viewport?.origin.x-fittedAgain.viewport.origin.x)<1e-8,'fit after drag');
  const before=await seek(30);const close=await change('camera-mode','apparatus');
  assert.equal(close.viewport.image.visible,false,'Apparatus camera does not exclude image: '+JSON.stringify({mode:close.viewport.mode,origin:close.viewport.origin,scale:close.viewport.scale,image:close.viewport.image,prior:before.viewport}));assert.equal(close.counts,before.counts);assert.equal(close.hash,before.hash);
  const follow=await change('camera-mode','frame');contained(follow);assert.equal(follow.counts,before.counts);
  const restored=await change('camera-mode','motion');contained(restored);assert.equal(restored.viewport.scale,before.viewport.scale);
  report.checks.push({name:'camera controls preserve physical results and baseline identity',status:'pass'});
  const dom=await cdp.send('DOM.getDocument',{depth:-1}),input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#open-motion'});
  await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[join(root,'test-artifacts/llm-authoring/source-motion/focal.experiment.json')]});
  await until(state,s=>s?.state==='completed'&&s.index==='0'&&s.viewport,'focal control');
  const f=await seek(2,false);assert.equal(f.viewport.image.visible,false);assert.match(f.note,/infinity|singularity/);
  report.checks.push({name:'focal singularity has no fake finite image guide',status:'pass'});
 }catch(e){report.errors.push(e.stack);throw e;}
 finally{cdp?.close();browser.kill();try{await until(async()=>browser.exitCode!==null||browser.signalCode!==null,Boolean,'shutdown');await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
 console.log('Motion viewport PASS: '+report.checks.length+' checks, '+report.framesChecked+' native frames fit without camera drift.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
