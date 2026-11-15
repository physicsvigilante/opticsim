// Actual Chrome qualified-result regression: native ancestry, fresh rerun and non-leakage.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile,mkdir,mkdtemp,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {sceneHash} from '../src/qualified-utils.js';
import {createQualifiedBundle,initialQualification,parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,process.env.OPTICSIM_PROVENANCE_BROWSER_OUTPUT||'test-artifacts/browser-ray-provenance');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,pred,label){let last,error;const end=Date.now()+25000;
 while(Date.now()<end){try{last=await fn();if(pred(last))return last;}catch(e){error=e.message;}await sleep(125);}
 throw Error(label+' timeout: '+JSON.stringify(last)+' '+(error||''));}
function chrome(){for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
 const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:2500});if(!r.error&&r.status===0)return {bin,version:r.stdout.trim()};}
 throw Error('Chrome unavailable: no browser acceptance was performed');}
async function port(){const s=createServer();await new Promise((ok,no)=>s.once('error',no).listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
async function connect(url){const ws=new WebSocket(url),pending=new Map(),listeners=[];let id=0;
 await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method)listeners.forEach(fn=>fn(r));
 const fn=pending.get(r.id);if(fn){pending.delete(r.id);fn(r);}});
 return {close:()=>ws.close(),on:fn=>listeners.push(fn),send:(method,params={})=>new Promise((ok,no)=>{
 const n=++id,t=setTimeout(()=>{pending.delete(n);no(Error(method+' timed out'));},25000);
 pending.set(n,r=>{clearTimeout(t);r.error?no(Error(JSON.stringify(r.error))):ok(r.result);});
 ws.send(JSON.stringify({id:n,method,params}));})};}
const components=()=>{
 const source=(id,x)=>({id,type:'point-source',parameters:{x,y:100,brightness:1},
  emission:{mode:'single-ray',directionDeg:-45}});
 return [source('S1',-100),source('S2',-150),
  {id:'AirWater',type:'planar-interface',parameters:{x:0,y:0,normalDeg:90,
   negativeIndex:4/3,positiveIndex:1,partialReflection:true}},
  {id:'Lower',type:'ray-detector',parameters:{x:50,y:-100,orientationDeg:0,length:400}},
  {id:'Upper',type:'ray-detector',parameters:{x:200,y:200,orientationDeg:0,length:500}}];
};
const document=()=>prepareScene({lengthUnit:'mm',title:'Native direct ancestry browser check',
 runPolicy:'preview-v1',components:components()}).document;
const requests=[{id:'upper',kind:'detector-ray-provenance',componentId:'Upper'},
 {id:'lower',kind:'detector-ray-provenance',componentId:'Lower'}];
await mkdir(out);
const report={format:'opticsim-native-ray-provenance-browser-v1',status:'running',
 checks:[],screenshots:[],errors:[],teacherParticipants:0,externalModelCalls:0};
let server,browser,cdp,profile;
try{
 const doc=document(),weak=structuredClone(doc);
 weak.physics.components.filter(c=>c.type==='point-source').forEach(c=>c.parameters.brightness=.01);
 const packageFor=async(name,scene)=>{
  const bundle=await createQualifiedBundle(scene,initialQualification(scene,null,
   {inputSha256:await sceneHash(scene)}),requests);
  const file=join(out,name+'.qualified.json');await writeFile(file,JSON.stringify(bundle,null,2)+'\n');
  return file;
 };
 const input=await packageFor('complete',doc),incomplete=await packageFor('incomplete',weak);
 const raw=join(out,'raw-scene.json');await writeFile(raw,serializeSave(doc));
 const downloads=join(out,'downloads');await mkdir(downloads);
 const {bin,version}=chrome();report.browser=version;
 const p=await port(),origin='http://127.0.0.1:'+p;profile=await mkdtemp(join(out,'profile-'));
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(p)},stdio:'ignore'});
 browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--window-size=1450,980','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await until(async()=>(await fetch(origin)).status,x=>x===200,'static server');
 const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'Chrome port');
 const pages=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),l=>l.some(x=>x.type==='page'),'CDP page');
 cdp=await connect(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 cdp.on(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
 await cdp.send('Page.enable');await cdp.send('Runtime.enable');
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 const js=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const state=()=>js(["(()=>{const e=id=>document.getElementById(id);return {",
  "native:e('status').dataset.state,error:e('error').textContent,revision:e('revision').textContent,",
  "text:e('observable-results').textContent,",
  "results:JSON.parse(e('observable-results').dataset.results||'null'),",
  "qualification:e('qualification-status').dataset.state};})()"].join(''));
 const upload=async file=>{const dom=await cdp.send('DOM.getDocument',{depth:-1});
  const q=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
  await cdp.send('DOM.setFileInputFiles',{nodeId:q.nodeId,files:[file]});};
 const edit=async(id,value)=>js("(()=>{const e=document.getElementById("+JSON.stringify(id)+
  ");if(!e||e.disabled)throw Error('Field not editable');e.value="+JSON.stringify(String(value))+
  ";e.dispatchEvent(new Event('input',{bubbles:true}));"+
  "e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()");
 const check=name=>report.checks.push({name,passed:true});
 const shot=async name=>{const s=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(join(out,name+'.png'),Buffer.from(s.data,'base64'));report.screenshots.push(name+'.png');};
 await cdp.send('Page.navigate',{url:origin+'/?scene=single-lens-detector'});
 await until(state,s=>s.native==='completed'&&!s.error,'initial native scene');
 await upload(input);
 let s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.crossings?.length===2&&
  s.results?.[1]?.value?.crossings?.length===2,'two-source actual native Fresnel ancestry');
 assert.equal(s.results[0].status,'available');
 assert.equal(s.results[0].method,'native-observed-object-parentage');
 assert.equal(s.results[0].value.nodes.length,4);assert.equal(s.results[1].value.nodes.length,2);
 assert.match(s.text,/actual spawned child/);assert.match(s.text,/Same-object optical interactions are not graph edges/);
 check('Real Chrome displays transmitted primaries and actual native spawned children, no paths');
 await shot('complete-ancestry');
 const initialRevision=s.revision;
 await edit('S1-x',-110);
 s=await until(state,x=>x.native==='completed'&&x.revision!==initialRevision&&
  x.results?.[0]?.value?.crossings?.length===2,'physical source displacement');
 assert.equal(s.results[0].status,'available');
 const changedRevision=s.revision;
 check('Physical source edit invalidates the old graph and requires actual native retracing');
 await edit('S1-x',-100);
 s=await until(state,x=>x.native==='completed'&&x.revision!==changedRevision&&
  x.results?.[0]?.value?.crossings?.length===2,'A to B to A physical revert');
 assert.equal(s.results[0].status,'available');
 assert.doesNotMatch(s.text,/stale|STALE_OLD_RUN/);
 check('Reverting to original scene creates fresh current-run provenance, not a cached old graph');
 await js("document.getElementById('save-qualified').click()");
 const name=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.qualified.json')),
  Boolean,'qualified download');
 const exported=join(downloads,name),saved=await parseQualifiedBundle(await readFile(exported,'utf8'));
 assert.deepEqual(saved.observables,requests);
 assert.equal(Object.hasOwn(saved,'execution'),false);assert.equal(Object.hasOwn(saved,'results'),false);
 assert.doesNotMatch(JSON.stringify(saved),/rayToken/);
 check('Qualified export retains request but contains no previous native graph');
 await upload(exported);
 s=await until(state,s=>s.native==='completed'&&s.results?.[0]?.value?.crossings?.length===2,'reopen');
 assert.equal(s.results[0].status,'available');
 check('Reopen reruns native optics instead of importing old execution evidence');
 await upload(incomplete);
 s=await until(state,s=>s.native==='incomplete'&&s.results===null&&s.text.includes('suppressed'),
  'incomplete native refraction');
 assert.doesNotMatch(s.text,/rayToken|native-spawn/);
 check('Native truncation suppresses ancestry and does not display a partial graph');
 await shot('truncated-withheld');
 await upload(raw);
 s=await until(state,s=>s.native==='completed'&&s.results===null&&s.text.includes('No explicit result requests'),
  'raw scene import');
 assert.equal(s.qualification,'unknown');assert.doesNotMatch(s.text,/rayToken|native-spawn/);
 check('Raw scene import clears qualified requests and old provenance results');
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){
 report.status='failed';report.errors.push(e.stack||String(e));
 try{const s=await cdp?.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  if(s?.data){await writeFile(join(out,'failure.png'),Buffer.from(s.data,'base64'));report.screenshots.push('failure.png');}}catch{}
 throw e;
}finally{
 cdp?.close();browser?.kill();server?.kill();
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log('Native detector parentage browser PASS: '+report.checks.length+' checks.');
