// Evaluation-only real Chrome tasks. Historical PR #54 artifacts stay unchanged.
// This prospective follow-up checks actual text geometry, not only DOM data.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle,createQualifiedBundle} from '../../src/qualification.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=resolve(root,'test-artifacts/llm-authoring/teaching-fidelity-v1'),out=join(base,'browser');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,ok,label){
 const end=Date.now()+25000;let last,error;
 while(Date.now()<end){try{last=await fn();if(ok(last))return last;}catch(e){error=e.message;}await sleep(100);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(error||''));
}
function binary(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
 }
 throw Error('Chrome/Chromium unavailable; browser tasks NOT assessed');
}
async function port(){const s=createServer();await new Promise((ok,err)=>s.once('error',err).listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
async function connect(url){
 const ws=new WebSocket(url),pending=new Map(),listeners=[];let next=0;
 await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method)for(const f of listeners)f(r);const callback=pending.get(r.id);if(callback){pending.delete(r.id);callback(r);}});
 return {close:()=>ws.close(),on:f=>listeners.push(f),send:(method,params={})=>new Promise((ok,err)=>{
  const id=++next,timer=setTimeout(()=>{pending.delete(id);err(Error(method+' timeout'));},20000);
  pending.set(id,r=>{clearTimeout(timer);r.error?err(Error(JSON.stringify(r.error))):ok(r.result);});ws.send(JSON.stringify({id,method,params}));})};
}
await mkdir(out,{recursive:false});
const report={format:'opticsim-teaching-browser-evidence-v1',review:'prospective-evidence-panel-followup',status:'running',checks:[],screenshots:[],visibility:[],
 teacherParticipants:0,studentParticipants:0,educationalEffectiveness:'not-assessed',errors:[],requests:[]};
let browser,server,cdp,profile;
try{
 const evidence=JSON.parse(await readFile(join(base,'report.json'),'utf8'));assert.equal(evidence.status,'checks-passed');
 const row=id=>evidence.cases.find(x=>x.id===id);
 const {bin,version}=binary();report.browserVersion=version;
 const p=await port(),origin='http://127.0.0.1:'+p;
 profile=await mkdtemp(join(out,'profile-'));
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(p),OPTICSIM_BASE_PATH:'/'},stdio:'ignore'});
 browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1440,1100','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await until(async()=>(await fetch(origin)).status,x=>x===200,'server');
 const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome startup');
 const pages=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),x=>x.some(t=>t.type==='page'),'browser page');
 cdp=await connect(pages.find(t=>t.type==='page').webSocketDebuggerUrl);
 cdp.on(e=>{if(e.method==='Network.requestWillBeSent'&&e.params?.request?.url?.startsWith('http'))report.requests.push(e.params.request.url);
  if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails?.text||'JavaScript exception');});
 for(const method of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(method);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const state=()=>evaluate(`(()=>{const e=id=>document.getElementById(id);return {title:e('title')?.textContent,revision:e('revision')?.textContent,status:e('status')?.dataset.state,error:e('error')?.textContent,results:JSON.parse(e('observable-results')?.dataset.results||'null'),resultsText:e('observable-results')?.textContent,qualification:e('qualification-status')?.dataset.state,details:e('qualification-details')?.textContent,fitNote:e('fit-note')?.textContent,fitSequence:e('fit-note')?.dataset.fitSequence,fitDisabled:e('fit-results')?.disabled,saveDisabled:e('save-qualified')?.disabled,sampling:e('sampling')?.value,samplingNote:e('sampling-note')?.textContent,evidenceSummary:e('evidence-summary')?.textContent,evidenceState:e('evidence-summary')?.dataset.state,source:e('evidence-source')?.textContent,sourceHash:e('evidence-source-hash')?.textContent,physical:e('evidence-physical-change')?.textContent,numerical:e('evidence-numerical-change')?.textContent};})()`);
 const current=async id=>until(state,s=>{
  if(s.status!=='completed'||s.error||s.saveDisabled)return false;
  try{assert.deepEqual(s.results??[],row(id).results);return s.title==='Teaching pilot: specified ideal lens and passive detector'&&s.evidenceState===(id==='scene-only'?'none':'ready');}catch{return false;}
 },id+' current native/results');
 const upload=async path=>{
  const before=await state();
  const d=await cdp.send('DOM.getDocument',{depth:-1}),e=await cdp.send('DOM.querySelector',{nodeId:d.root.nodeId,selector:'#load'});
  await cdp.send('DOM.setFileInputFiles',{nodeId:e.nodeId,files:[path]});
  await until(state,s=>s.revision!==before.revision&&s.status==='completed','new completed import revision');
 };
 const shot=async(name,viewport=false)=>{
  let params={format:'png',captureBeyondViewport:false};
  if(!viewport){const dimensions=await cdp.send('Page.getLayoutMetrics'),size=dimensions.cssContentSize||dimensions.contentSize;
   params={format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:size.width,height:size.height,scale:1}};}
  const img=await cdp.send('Page.captureScreenshot',params);
  await writeFile(join(out,name+'.png'),Buffer.from(img.data,'base64'),{flag:'wx'});report.screenshots.push(name+'.png');
 };
 const check=(name,details=null)=>report.checks.push({name,passed:true,details});
 const edit=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw Error('Missing physical control');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
 const exportPackage=async label=>{
  const d=join(out,'exports',label);await mkdir(d,{recursive:true});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:d,eventsEnabled:true});
  await evaluate('document.getElementById("save-qualified").click()');
  return until(async()=>{for(const name of await readdir(d)){if(!name.endsWith('.json'))continue;const path=join(d,name);return {path,bundle:await parseQualifiedBundle(await readFile(path,'utf8'))};}return null;},x=>!!x,'qualified export '+label);
 };
 // Page scroll is a presentation action only. Do not change native state or
 // manufacture a visible value. Test text-range rectangles against viewport,
 // clipping ancestors and the sticky toolbar; DOM presence alone is not enough.
 const show=async id=>{
  await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)}),t=document.querySelector('.ray-toolbar');window.scrollBy(0,e.getBoundingClientRect().top-t.getBoundingClientRect().height-24);})()`);
  await evaluate('new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)))');
 };
 const visible=async(id,needle)=>{
  const measured=await evaluate(`(()=>{
   const e=document.getElementById(${JSON.stringify(id)}),needle=${JSON.stringify(needle)};
   const n=e.firstChild,start=n?.textContent.indexOf(needle)??-1;
   if(start<0||n.nodeType!==Node.TEXT_NODE)return {visible:false,reason:'text missing'};
   const range=document.createRange();range.setStart(n,start);range.setEnd(n,start+needle.length);
   const rects=Array.from(range.getClientRects()).filter(r=>r.width>0&&r.height>0);
   const toolbar=document.querySelector('.ray-toolbar').getBoundingClientRect();
   const ancestors=[];for(let a=e;a;a=a.parentElement){const c=getComputedStyle(a),b=a.getBoundingClientRect();ancestors.push({id:a.id,tag:a.tagName,display:c.display,visibility:c.visibility,opacity:c.opacity,overflowX:c.overflowX,overflowY:c.overflowY,rect:{left:b.left,top:b.top,right:b.right,bottom:b.bottom}});}
   const okay=rects.length>0&&rects.every(r=>r.left>=-1&&r.right<=innerWidth+1&&r.top>=Math.max(0,toolbar.bottom)-1&&r.bottom<=innerHeight+1&&ancestors.every(a=>a.display!=='none'&&a.visibility!=='hidden'&&Number(a.opacity)>0&&(!['hidden','auto','scroll','clip'].includes(a.overflowY)||r.top>=a.rect.top-1&&r.bottom<=a.rect.bottom+1)&&(!['hidden','auto','scroll','clip'].includes(a.overflowX)||r.left>=a.rect.left-1&&r.right<=a.rect.right+1)));
   return {visible:okay,viewport:{width:innerWidth,height:innerHeight},rects:rects.map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),scroll:{page:scrollY,panel:e.scrollTop},ancestors};
  })()`);
  report.visibility.push({id,needle,...measured});assert.equal(measured.visible,true,id+' text is clipped or outside the viewport: '+JSON.stringify(measured));
  return measured;
 };
 await cdp.send('Page.navigate',{url:origin+'/'});await until(state,s=>s.status==='completed','initial native viewer');
 await upload(join(base,'scene-only','qualified-scene.json'));
 const noAnswer=await current('scene-only');
 assert.match(noAnswer.resultsText,/No explicit result requests|No native requested-result/);
 assert.equal(noAnswer.evidenceSummary,'No requested readouts — native scene only.');
 await show('evidence-summary');await visible('evidence-summary','No requested readouts');
 check('Native scene works without an answer target and says no readouts requested',noAnswer);await shot('01-scene-only');
 await upload(join(base,'baseline','qualified-scene.json'));const start=await current('baseline');
 assert.match(start.resultsText,/Conditional analytical prediction/);assert.match(start.resultsText,/Native sampled observation/);
 assert.match(start.resultsText,/Not a native image detection/);assert.match(start.samplingNote,/not the optical model/);
 assert.equal(start.evidenceSummary,'3 native sampled readouts · 1 conditional prediction · 0 unavailable quantities');
 const baseBundle=await parseQualifiedBundle(await readFile(join(base,'baseline','qualified-scene.json'),'utf8'));
 await show('evidence-summary');await visible('evidence-summary',start.evidenceSummary);
 await visible('evidence-source','scenes/single-lens-detector.json');
 await visible('evidence-source-hash',baseBundle.qualification.interpretation.source.sha256);
 const unchanged=await exportPackage('overview-read-only');assert.deepEqual(unchanged.bundle,baseBundle);
 check('Visible source/hash and result summary require no JSON inspection and leave the complete package unchanged',start);
 await shot('evidence-baseline-desktop',true);
 const seq=start.fitSequence;
 await evaluate('document.getElementById("fit-results").click()');
 await until(state,s=>s.fitSequence&&s.fitSequence!==seq&&s.fitNote.includes('No physics or sampling changed'),'Fit completion');
 await current('baseline');const fitted=await exportPackage('baseline-fit');
 assert.deepEqual(fitted.bundle.scene.physics,baseBundle.scene.physics);assert.deepEqual(fitted.bundle.scene.simulation,baseBundle.scene.simulation);
 check('Fit changes presentation only, retaining exact physical/numerical input');await shot('02-baseline-fit');
 await edit('lens-1-focalLength',150);const edited=await current('focal-150');
 assert.equal(edited.qualification,'revised');assert.match(edited.physical,/lens-1\.focalLength: 100 → 150 mm/);
 const exported=await exportPackage('focal-150');
 const offline=await parseQualifiedBundle(await readFile(join(base,'focal-150','qualified-scene.json'),'utf8'));
 assert.deepEqual(exported.bundle.scene.physics,offline.scene.physics);
 assert.deepEqual(exported.bundle.qualification.origin,baseBundle.qualification.origin);
 assert.deepEqual(exported.bundle.qualification.interpretation,baseBundle.qualification.interpretation);
 assert.equal(exported.bundle.qualification.edits.filter(e=>e.kind==='physics').length,1);
 await show('evidence-summary');await visible('evidence-physical-change','lens-1.focalLength: 100 → 150 mm');
 check('Actual focal-length edit shows exact before/after values and preserves source provenance');await shot('03-focal-length-150');await shot('evidence-focal-edit',true);
 // Verify the existing second Fit explicitly, without adding auto-reframing.
 const beforeSecond=(await state()).fitSequence;
 await evaluate('document.getElementById("fit-results").click()');
 await until(state,s=>s.fitSequence&&s.fitSequence!==beforeSecond&&s.fitNote.includes('No physics or sampling changed'),'second Fit');
 await current('focal-150');const refitted=await exportPackage('focal-150-refit');
 assert.deepEqual(refitted.bundle.scene.physics,exported.bundle.scene.physics);
 assert.deepEqual(refitted.bundle.scene.simulation,exported.bundle.scene.simulation);
 assert.deepEqual(refitted.bundle.observables,exported.bundle.observables);
 assert.deepEqual(refitted.bundle.qualification.interpretation,exported.bundle.qualification.interpretation);
 assert.equal(refitted.bundle.qualification.edits.filter(e=>e.kind==='physics').length,1);
 const size=await evaluate('({width:document.getElementById("light").width,height:document.getElementById("light").height})');
 const image=row('focal-150').results.find(r=>r.kind==='ideal-image').value,v=refitted.bundle.scene.presentation.view;
 const pixel={x:size.width/2+(image.x-v.x)*v.zoom,y:size.height/2-(image.y-v.y)*v.zoom};
 assert.ok(pixel.x>0&&pixel.x<size.width&&pixel.y>0&&pixel.y<size.height);
 check('Second existing Fit contains the revised conditional image without physical, numerical or result changes',{canvas:size,pixel,view:v});
 await upload(exported.path);await current('focal-150');check('Browser-exported revised package reopens and recomputes');
 await upload(join(base,'coarse-sampling','qualified-scene.json'));const coarse=await current('coarse-sampling');
 assert.equal(coarse.sampling,'custom');assert.match(coarse.numerical,/rayDensity: 1 → 0.25/);assert.match(coarse.physical,/none recorded/);
 await show('evidence-summary');await visible('evidence-numerical-change','rayDensity: 1 → 0.25');
 check('Numerical-only intervention is labelled separately from physical history');await shot('04-coarse-sampling');
 await evaluate(`(()=>{const s=document.getElementById('sampling');s.value='dense';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const restored=await current('baseline');assert.match(restored.numerical,/rayDensity: 0.25 → 1/);
 const dense=await exportPackage('sampling-back-to-dense');
 assert.deepEqual(dense.bundle.scene.physics,baseBundle.scene.physics);
 assert.deepEqual(dense.bundle.scene.simulation,baseBundle.scene.simulation);
 assert.ok(dense.bundle.qualification.edits.filter(e=>e.kind==='numerics').length>=2);
 assert.equal(dense.bundle.qualification.edits.filter(e=>e.kind==='physics').length,0);
 check('Sampling restoration retains numerical history without a physical edit');
 await upload(join(base,'optional-unavailable','qualified-scene.json'));const partial=await current('optional-unavailable');
 assert.equal(partial.results.at(-1).status,'unavailable');assert.equal(partial.results.at(-1).value,null);
 assert.equal(partial.evidenceSummary,'3 native sampled readouts · 1 conditional prediction · 1 unavailable quantity');
 const beforeInspect=await exportPackage('optional-before-inspect');
 await show('evidence-summary');await visible('evidence-summary',partial.evidenceSummary);
 await visible('evidence-result-limits','material-index (refractive-index)');
 const panelTop=await evaluate('document.getElementById("observable-results").scrollTop');
 assert.equal(panelTop,0,'Summary should not depend on scrolling detailed results');
 check('Unavailable count AND quantity name are visibly rendered outside the unscrolled detail panel');
 await shot('05-optional-unavailable');await shot('evidence-optional-desktop',true);
 await show('observable-results');
 await evaluate('document.getElementById("observable-results").scrollTop=document.getElementById("observable-results").scrollHeight');
 await visible('observable-results','material-index — unavailable');
 const afterInspect=await exportPackage('optional-after-inspect');assert.deepEqual(afterInspect.bundle,beforeInspect.bundle);
 assert.deepEqual((await state()).results,partial.results);
 check('Explicit scrolling reveals unavailable detail without altering package or any result');
 await shot('evidence-unavailable-detail',true);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:600,height:900,deviceScaleFactor:1,mobile:false});
 await current('optional-unavailable');await show('evidence-summary');
 await visible('evidence-summary',partial.evidenceSummary);await visible('evidence-result-limits','material-index (refractive-index)');
 check('Wrapped summary and unavailable name are visibly readable in a 600px viewport');await shot('evidence-optional-narrow',true);
 await show('evidence-source');await visible('evidence-source','scenes/single-lens-detector.json');
 await show('evidence-source-hash');await visible('evidence-source-hash',baseBundle.qualification.interpretation.source.sha256);
 check('Full recorded source and hash wrap without horizontal clipping at narrow width');
 await edit('lens-1-focalLength',0);
 const invalid=await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled&&s.fitDisabled&&s.evidenceState==='suppressed','invalid edit suppression');
 assert.doesNotMatch(invalid.evidenceSummary,/3 native/);
 await show('evidence-summary');await visible('evidence-summary','Current readouts suppressed');
 check('Invalid edits clear current summary counts and explicitly qualify historical metadata',invalid);await shot('06-invalid-edit');
 await upload(join(base,'baseline','qualified-scene.json'));await current('baseline');check('Original package restores the accepted configuration');
 const injected=structuredClone(baseBundle.qualification);injected.interpretation.source.path='<img id="evidence-injection" src=x onerror="window.EVIDENCE_INJECTED=true">';
 const injectionBundle=await createQualifiedBundle(baseBundle.scene,injected,baseBundle.observables),injectionPath=join(out,'literal-source-test.json');
 await writeFile(injectionPath,JSON.stringify(injectionBundle,null,2)+'\n',{flag:'wx'});await upload(injectionPath);await current('baseline');
 assert.equal(await evaluate('document.getElementById("evidence-injection")===null&&window.EVIDENCE_INJECTED===undefined'),true);
 assert.match((await state()).source,/<img id="evidence-injection"/);
 check('Untrusted source labels remain literal text, not markup or executable content');
 await upload(join(base,'baseline','scene.json'));await until(state,s=>s.qualification==='unknown'&&s.evidenceState==='none','raw import resets provenance');
 assert.match((await state()).source,/unknown/);assert.match((await state()).physical,/no qualified history/);
 check('Raw scene import cannot inherit previously displayed source or edit history');
 await upload(join(base,'baseline','qualified-scene.json'));await current('baseline');
 assert.deepEqual(report.errors,[]);assert.ok(report.requests.every(u=>u.startsWith(origin+'/')));
 check('Browser runtime uses only local resources and reports no JavaScript exceptions');
 report.status='checks-passed';
}catch(error){report.status='checks-failed';report.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally{
 if(cdp)cdp.close();if(browser)browser.kill();if(server)server.kill();
 await sleep(300);if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:150});
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('Teaching-fidelity evidence panel: '+JSON.stringify({status:report.status,checks:report.checks.length,visibilityChecks:report.visibility.length,screenshots:report.screenshots.length,failure:report.failure?.message}));
}
