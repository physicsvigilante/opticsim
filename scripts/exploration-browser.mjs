// Real-Chrome usability/physics regression. Authored development proposals,
// NOT external model inference or evidence of teacher/student effectiveness.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'test-artifacts/browser-exploration');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,accept,label){let last,error;const end=Date.now()+25000;
 while(Date.now()<end){try{last=await fn();if(accept(last))return last;}catch(e){error=e.message;}await pause(120);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(error||''));}
function chrome(){for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
 const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};}throw Error('Chrome unavailable; no browser evidence claimed');}
async function port(){const s=createServer();await new Promise((ok,no)=>s.once('error',no).listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
async function connect(url){const ws=new WebSocket(url),pending=new Map(),listeners=[];let n=0;
 await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method)listeners.forEach(f=>f(r));const cb=pending.get(r.id);if(cb){pending.delete(r.id);cb(r);}});
 return {close:()=>ws.close(),on:fn=>listeners.push(fn),send:(method,params={})=>new Promise((ok,no)=>{const id=++n,t=setTimeout(()=>{pending.delete(id);no(Error(method+' timeout'));},25000);pending.set(id,r=>{clearTimeout(t);r.error?no(Error(JSON.stringify(r.error))):ok(r.result);});ws.send(JSON.stringify({id,method,params}));})};}
await mkdir(out,{recursive:false});
const report={format:'opticsim-browser-exploration-v1',status:'running',checks:[],screenshots:[],requests:[],errors:[],externalModelCalls:0,teacherParticipants:0,studentParticipants:0};
let server,browser,cdp,profile;
try{
 const {bin,version}=chrome();report.browser=version;
 const p=await port(),origin='http://127.0.0.1:'+p;profile=await mkdtemp(join(out,'profile-'));
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(p)},stdio:'ignore'});
 browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1440,1100','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await until(async()=>(await fetch(origin)).status,x=>x===200,'server');
 const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome port');
 const pages=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),x=>x.some(p=>p.type==='page'),'page');
 cdp=await connect(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 cdp.on(e=>{if(e.method==='Network.requestWillBeSent'&&e.params.request.url.startsWith('http'))report.requests.push(e.params.request.url);if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
 for(const m of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(m);
 const js=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const click=id=>js(`document.getElementById(${JSON.stringify(id)}).click()`);
 const set=(id,value)=>js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const state=()=>js(`(()=>{const e=id=>document.getElementById(id);return {native:e('status').dataset.state,revision:e('revision').textContent,error:e('error').textContent,workError:e('explore-error').textContent,workStatus:e('explore-status').textContent,preview:e('explore-changes').textContent,applyDisabled:e('explore-apply').disabled,scenarios:e('exploration-panel').dataset.scenarios,results:JSON.parse(e('observable-results').dataset.results||'null'),comparison:JSON.parse(e('explore-comparison').dataset.report||'null')};})()`);
 const completed=()=>until(state,s=>['completed','completed-with-warnings'].includes(s.native)&&!s.error,'complete actual run');
 const check=(name,detail=null)=>report.checks.push({name,passed:true,detail});
 async function start(){await completed();await js("document.getElementById('exploration-panel').open=true");await click('explore-start');await until(state,s=>s.scenarios==='1'&&s.workStatus.startsWith('Baseline preserved'),'baseline captured');}
 async function context(label,task){const dir=join(out,label);await mkdir(dir);await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await set('explore-question',task);await click('explore-context');await until(state,s=>s.workStatus.startsWith('Context downloaded'),'context download');return until(async()=>{const n=(await readdir(dir)).find(n=>n==='opticsim-exploration-context.json');return n?JSON.parse(await readFile(join(dir,n),'utf8')):null;},Boolean,'context file');}
 const packet=(ctx,extra)=>({format:'opticsim-exploration-proposal-v1',expectedIntegritySha256:ctx.baseline.integritySha256,intent:ctx.question,...extra});
 async function inspect(proposal){await set('explore-proposal',JSON.stringify(proposal));await click('explore-preview');await until(state,s=>s.workStatus.startsWith('Validated')&&!s.applyDisabled,'preview accepted');}
 async function apply(){await click('explore-apply');await until(state,s=>s.workStatus.startsWith('Hypothetical applied')&&['completed','completed-with-warnings'].includes(s.native),'applied and completed');}
 async function capture(label,count){await set('explore-name',label);await click('explore-capture');await until(state,s=>s.scenarios===String(count),'saved scenario '+label);}
 async function restore(index){await js(`document.getElementById('explore-scenarios').value=${JSON.stringify(String(index))}`);await click('explore-restore');await until(state,s=>s.workStatus.startsWith('Loaded ')&&['completed','completed-with-warnings'].includes(s.native),'restored with native rerun');}
 async function shot(name){await js("document.getElementById('exploration-panel').scrollIntoView({block:'start'})");const dims=await cdp.send('Page.getLayoutMetrics'),d=dims.cssContentSize||dims.contentSize;const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:d.width,height:d.height,scale:1}});await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');}
 async function selectExample(name){await js(`(()=>{const e=document.getElementById('examples');e.value=${JSON.stringify(name)};e.dispatchEvent(new Event('change'));})()`);await completed();await start();}
 await cdp.send('Page.navigate',{url:origin+'/?scene=single-lens-detector'});await start();
 const ctx=await context('lens-context','Set only lens-1 focalLength to 150 mm; inspect the new native rays.');
 assert.equal(ctx.baseline.qualification.origin.preparationStatus,'unknown');assert.equal(ctx.baseline.qualification.interpretation,null);
 check('Raw example is immediately usable but its source provenance remains unknown');
 const originalRevision=(await state()).revision;
 const change=packet(ctx,{action:'revise',patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:150,unit:'mm'}]}});
 await inspect(change);assert.equal((await state()).revision,originalRevision);
 assert.equal(await js("document.getElementById('lens-1-focalLength').value"),'100');
 check('Preview shows exact stable-ID physical edits without running or altering the scene');
 await apply();assert.equal(await js("document.getElementById('lens-1-focalLength').value"),'150');await capture('Longer focal length',2);
 await click('explore-compare');const compared=await until(state,s=>!!s.comparison,'saved comparison');
 assert.ok(compared.comparison.evidenceChecks.baseline.accepted&&compared.comparison.evidenceChecks.scenario.accepted);
 assert.equal(compared.comparison.entries.find(r=>r.kind==='detector-crossings').delta,0);
 check('Apply runs actual native optics and keeps original/saved scenario count separate',compared.comparison);
 await set('explore-proposal',JSON.stringify(change));await click('explore-preview');await until(state,s=>s.workError.includes('Stale proposal'),'stale proposal');
 assert.equal(await js("document.getElementById('lens-1-focalLength').value"),'150');assert.equal((await state()).applyDisabled,true);
 check('Reusing an obsolete context cannot silently edit the newer qualified scenario');
 await restore(0);assert.equal(await js("document.getElementById('lens-1-focalLength').value"),'100');check('Original baseline is restored and retraced, not overwritten');
 const baseAgain=await context('baseline-again','Set the focal length to 0 mm.');
 const invalid=packet(baseAgain,{action:'revise',patch:{changes:[{id:'lens-1',section:'parameters',key:'focalLength',value:0}]}});
 const before=(await state()).revision;await set('explore-proposal',JSON.stringify(invalid));await click('explore-preview');await until(state,s=>s.workError.length>0,'invalid preview');
 assert.equal((await state()).revision,before);assert.equal((await state()).native,'completed');check('Invalid proposal is rejected without destroying the usable current simulation');
 await js("(()=>{const e=document.getElementById('sampling');e.value='sparse';e.dispatchEvent(new Event('change'));})()");await completed();await capture('Numerical sampling only',3);await click('explore-compare');
 const sampled=await until(state,s=>s.comparison?.scenarioLabel==='Numerical sampling only','sampling comparison');
 assert.ok(sampled.comparison.entries.every(x=>x.comparison==='not-comparable'&&x.delta===null));check('Changed sampling produces no claimed physical-count delta');
 await shot('lens-scenarios');
 await restore(0);
 const addCtx=await context('detector-context','Add Probe at (80,0) mm, vertical tangent 90 degrees and length 160 mm. Inspect its sampled crossings.');
 await inspect(packet(addCtx,{action:'structure',patch:{format:'opticsim-component-revision-v1',operations:[{op:'add',lengthUnit:'mm',component:{id:'Probe',type:'ray-detector',parameters:{x:80,y:0,orientationDeg:90,length:160}}}]},additionalObservables:[{id:'probe',kind:'detector-crossings',componentId:'Probe'}]}));
 await apply();assert.equal(await js("document.getElementById('Probe-x').value"),'80');await capture('Second detector',4);
 await click('explore-compare');const added=await until(state,s=>s.comparison?.scenarioLabel==='Second detector','new detector comparison');
 assert.equal(added.comparison.entries.find(r=>r.id==='probe').comparison,'not-comparable');check('Structural change rebuilds controls, preserves old detector and does not invent a baseline reading for the new one');
 const exportDir=join(out,'exported');await mkdir(exportDir);await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:exportDir});await click('explore-export');
 const exported=await until(async()=>{try{return await parseQualifiedBundle(await readFile(join(exportDir,'exploration-scene.qualified.json'),'utf8'));}catch{return null;}},Boolean,'qualified export');
 assert.equal(exported.scene.physics.components.length,4);assert.deepEqual(exported.qualification.origin,ctx.baseline.qualification.origin);
 const dom=await cdp.send('DOM.getDocument',{depth:-1}),input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
 await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[join(exportDir,'exploration-scene.qualified.json')]});await completed();
 assert.equal(await js("document.getElementById('Probe-x').value"),'80');check('Saved hypothetical exports and reopens through existing qualified import and native renderer');
 await selectExample('general-two-source-lens');
 const multi=await context('multi-context','Move only S2 up by 25 mm. Preserve S1 and every other field.');
 const s2=multi.baseline.scene.physics.components.find(x=>x.id==='S2'),s1=multi.baseline.scene.physics.components.find(x=>x.id==='S1');
 await inspect(packet(multi,{action:'revise',patch:{changes:[{id:'S2',section:'parameters',key:'y',value:s2.parameters.y+25,unit:'mm'}]}}));await apply();
 assert.equal(Number(await js("document.getElementById('S2-y').value")),s2.parameters.y+25);assert.equal(Number(await js("document.getElementById('S1-y').value")),s1.parameters.y);
 await capture('S2 shifted only',2);check('Same workflow handles an explicit source identity in a multiple-source system');
 await selectExample('circular-dielectric');
 const glass=await context('glass-context','Set only G1 insideIndex to 1.3 without changing its approximation.');
 await inspect(packet(glass,{action:'revise',patch:{changes:[{id:'G1',section:'parameters',key:'insideIndex',value:1.3}]}}));await apply();await capture('Index hypothesis',2);await click('explore-compare');
 const qualified=await until(state,s=>s.comparison?.scenarioLabel==='Index hypothesis','qualified dielectric comparison');
 assert.ok(qualified.results.some(x=>x.status==='qualified'));
 assert.ok(qualified.comparison.entries.every(x=>x.comparison==='not-comparable'));
 check('Circular dielectric works through the same UI and approximation qualifications prevent unqualified deltas');
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:600,height:900,deviceScaleFactor:1,mobile:false});await completed();
 const narrow=await js("(()=>{const r=document.getElementById('exploration-panel').getBoundingClientRect(),p=document.getElementById('explore-proposal').getBoundingClientRect();return {width:innerWidth,right:r.right,left:r.left,proposalRight:p.right};})()");
 assert.ok(narrow.left>=0&&narrow.right<=narrow.width+1&&narrow.proposalRight<=narrow.width+1);check('Proposal editor and scenario panel fit narrow screens',narrow);await shot('dielectric-narrow');
 assert.deepEqual(report.errors,[]);assert.ok(report.requests.every(url=>url.startsWith(origin+'/')));check('No external provider or telemetry requests; no browser exceptions');
 report.status='checks-passed';
}catch(e){report.status='checks-failed';report.failure={message:e.message,stack:e.stack};process.exitCode=1;}
finally{cdp?.close();browser?.kill();server?.kill();await pause(300);if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:150});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure?.message}));}
