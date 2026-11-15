// Actual Chrome regression for opt-in observed native ray object parentage.
// No UI-only tracer, ray routing, external provider or teacher participants.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile,mkdir,mkdtemp,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,process.env.OPTICSIM_PARENTAGE_BROWSER_OUTPUT||'test-artifacts/browser-ray-parentage');
const input=join(root,process.env.OPTICSIM_PARENTAGE_ACCEPTANCE_OUTPUT||
 'test-artifacts/llm-authoring/native-ray-parentage-v1');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,match,label){
 let last,err;const end=Date.now()+25000;
 while(Date.now()<end){try{last=await fn();if(match(last))return last;}catch(e){err=e.message;}await pause(125);}
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(err||''));}
function chrome(){for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
 const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
 if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
}throw Error('Chrome unavailable: no real browser verification performed');}
async function freePort(){const s=createServer();await new Promise((ok,no)=>s.once('error',no).listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise((ok,no)=>s.close(e=>e?no(e):ok()));return p;}
async function connect(url){const ws=new WebSocket(url),callbacks=new Map(),listeners=[];let id=0;
 await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method)listeners.forEach(fn=>fn(r));const done=callbacks.get(r.id);
 if(done){callbacks.delete(r.id);done(r);}});
 return {close:()=>ws.close(),on:fn=>listeners.push(fn),send:(method,params={})=>new Promise((ok,no)=>{
 const n=++id,t=setTimeout(()=>{callbacks.delete(n);no(Error(method+' timeout'));},25000);
 callbacks.set(n,r=>{clearTimeout(t);r.error?no(Error(JSON.stringify(r.error))):ok(r.result);});
 ws.send(JSON.stringify({id:n,method,params}));})};}
await mkdir(out,{recursive:false});
const report={format:'opticsim-native-parentage-chrome-v1',status:'running',checks:[],
  screenshots:[],errors:[],externalModelCalls:0,teacherParticipants:0},downloads=join(out,'downloads');
await mkdir(downloads);let browser,server,cdp,profile;
try{
 const {bin,version}=chrome();report.browser=version;
 const port=await freePort(),origin='http://127.0.0.1:'+port;profile=await mkdtemp(join(out,'profile-'));
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1450,980',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await until(async()=>(await fetch(origin)).status,s=>s===200,'local server');
 const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'DevTools');
 const pages=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),x=>x.some(y=>y.type==='page'),'page');
 cdp=await connect(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 cdp.on(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
 await cdp.send('Page.enable');await cdp.send('Runtime.enable');
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 const js=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const state=()=>js(`(()=>{const e=id=>document.getElementById(id);
 return {native:e('status').dataset.state,error:e('error').textContent,
 results:JSON.parse(e('observable-results').dataset.results||'null'),
 text:e('observable-results').textContent,qualification:e('qualification-status').dataset.state};})()`);
 const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1});
  const n=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
  await cdp.send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[file]});};
 const shot=async label=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(join(out,label+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(label+'.png');};
 const check=name=>report.checks.push({name,passed:true});
 const bundle=name=>join(input,name,'qualified-scene.json');
 await cdp.send('Page.navigate',{url:origin+'/?scene=single-lens-detector'});
 await until(state,s=>s.native==='completed','initial viewer');
 await upload(bundle('two-source-fresnel'));
 let s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.crossings?.length===2&&
  s.results?.[1]?.value?.crossings?.length===2,'two-source Fresnel native browser');
 assert.equal(s.error,'');
 assert.ok(s.results.every(x=>x.method==='native-observed-object-parentage'));
 assert.equal(s.results[1].value.nodes.filter(n=>n.parentToken!==null).length,2);
 assert.match(s.text,/Direct observed spawn relationships/);
 assert.match(s.text,/source SunRay/);
 check('Real Chrome renders two source-attributed Fresnel native detector parent graphs');
 await shot('native-parentage');
 // Export must preserve requests and assumptions, NOT old accepted run-local tokens.
 await js("document.getElementById('save-qualified').click()");
 const name=await until(async()=>(await readdir(downloads)).find(x=>x.endsWith('.qualified.json')),Boolean,'qualified export');
 const downloaded=join(downloads,name),saved=await parseQualifiedBundle(await readFile(downloaded,'utf8'));
 assert.equal(saved.observables.length,2);
 assert.equal(JSON.stringify(saved).includes('parentToken'),false);
 assert.equal('execution'in saved,false);
 check('Portable qualified export keeps requested kinds but no stored ray-token graph');
 await upload(downloaded);
 s=await until(state,x=>x.native==='completed'&&x.results?.[1]?.value?.nodes?.length===4,'qualified reopen');
 check('Reopened same physics reruns native and constructs a fresh source/child object ledger');
 await upload(bundle('physical-source-revision'));
 s=await until(state,x=>x.native==='completed'&&x.results?.[1]?.value?.nodes?.length===4,'physical source revision');
 check('Edited physical source scene requalifies parentage from its actual native callbacks');
 // A -> B -> A: rapid successive whole-scene imports, old result cannot publish under fresh A.
 await upload(bundle('two-source-fresnel'));
 s=await until(state,x=>x.native==='completed'&&x.results?.[1]?.value?.nodes?.length===4,'fresh original after revision');
 assert.equal(s.results[1].status,'available');
 check('A-B-A native rerun reports current parentage without an accepted stale graph');
 await upload(bundle('transmitted-only'));
 s=await until(state,x=>x.native==='completed'&&x.results?.[1]?.status==='qualified'&&
  x.results?.[1]?.value?.crossings?.length===0,'transmitted-only');
 assert.match(s.results[1].warnings.join(' '),/transmitted-only/);
 check('Transmitted-only approximation retains model-only caution without invented reflected children');
 await upload(bundle('clean-zero-hit'));
 s=await until(state,x=>x.native==='completed'&&x.results?.[0]?.value?.nodes?.length===0,'valid empty');
 assert.equal(s.results[0].status,'qualified');
 check('Valid no-hit source emits one native ray yet has an available empty sampled detector list');
 await upload(bundle('weak-fresnel-incomplete'));
 s=await until(state,x=>x.native==='incomplete'&&x.results===null&&x.text.includes('suppressed'),'incomplete Fresnel');
 check('Incomplete native Fresnel run leaves no raw parentage in browser results');
 await shot('parentage-suppressed');
 await upload(join(input,'raw-scene.json'));
 s=await until(state,x=>x.native==='completed'&&x.results===null&&x.qualification==='unknown','raw import');
 check('Raw scene import clears qualified source and parentage requests');
 assert.deepEqual(report.errors,[]);
 report.status='passed';
}catch(e){
 try{const screen=await cdp?.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
 if(screen?.data){await writeFile(join(out,'failure.png'),Buffer.from(screen.data,'base64'));report.screenshots.push('failure.png');}}catch{}
 report.errors.push(e.stack);throw e;
}finally{
 cdp?.close();browser?.kill();server?.kill();
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log('NATIVE_RAY_PARENTAGE_BROWSER '+JSON.stringify({status:report.status,checks:report.checks.length,
 screenshots:report.screenshots}));
