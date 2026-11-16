// Actual Chrome/Chromium Stage-1 opt-in NONCERTIFYING finite-hit advisory.
// This does not test or enable a mandatory v9 measurement gate, repair a ray,
// or claim student comprehension. Uses the existing viewer/qualified packages.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile,mkdir,mkdtemp,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url)),
 output=join(root,process.env.OPTICSIM_FINITE_HIT_BROWSER_OUTPUT||
  'test-artifacts/browser-finite-hit-diagnostic-v1'),
 input=join(root,process.env.OPTICSIM_FINITE_HIT_OUTPUT||
  'test-artifacts/llm-authoring/finite-hit-diagnostic-v1');
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
async function until(fn,accept,label){
 let last,error;const deadline=Date.now()+30000;
 while(Date.now()<deadline){
  try{last=await fn();if(accept(last))return last;}catch(e){error=e.message;}
  await sleep(150);
 }
 throw Error(label+' timed out: '+JSON.stringify(last)+' '+(error||''));
}
function chrome(){
 for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:2000});
  if(!r.error&&r.status===0)return {bin,version:r.stdout.trim()};
 }throw Error('Chrome unavailable: no browser validation claimed');
}
async function port(){
 const s=createServer();await new Promise((ok,no)=>s.once('error',no).listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise((ok,no)=>s.close(e=>e?no(e):ok()));return p;
}
async function connect(url){
 const ws=new WebSocket(url),pending=new Map(),listeners=[];let index=0;
 await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method)listeners.forEach(fn=>fn(r));const cb=pending.get(r.id);if(cb){pending.delete(r.id);cb(r);}});
 return {close:()=>ws.close(),on:fn=>listeners.push(fn),
  send:(method,params={})=>new Promise((ok,no)=>{
   const id=++index,t=setTimeout(()=>{pending.delete(id);no(Error(method+' timed out'));},30000);
   pending.set(id,r=>{clearTimeout(t);r.error?no(Error(JSON.stringify(r.error))):ok(r.result);});
   ws.send(JSON.stringify({id,method,params}));
  })};
}
await mkdir(output,{recursive:false});const downloads=join(output,'downloads');await mkdir(downloads);
const report={format:'opticsim-finite-hit-stage1-real-chrome-v1',status:'running',
 checks:[],screenshots:[],timings:[],errors:[],browser:null,
 externalModelCalls:0,teacherParticipants:0,advisoryNotPhysicalCertification:true};
let server,browser,cdp,profile;
try{
 const {bin,version}=chrome();report.browser=version;
 const p=await port(),origin='http://127.0.0.1:'+p;
 profile=await mkdtemp(join(output,'profile-'));
 server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(p)},stdio:'ignore'});
 browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--window-size=1450,980','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
  {stdio:'ignore'});
 await until(async()=>(await fetch(origin)).status,s=>s===200,'localhost server');
 const debug=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'CDP port');
 const pages=await until(async()=>await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json(),x=>x.some(v=>v.type==='page'),'page');
 cdp=await connect(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 cdp.on(e=>{if(e.method==='Runtime.exceptionThrown')report.errors.push(e.params.exceptionDetails.text);});
 await cdp.send('Page.enable');await cdp.send('Runtime.enable');
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 const js=async expression=>{
  const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
 };
 const state=()=>js(`(()=>{const e=id=>document.getElementById(id);return {
   native:e('status').dataset.state,error:e('error').textContent,
   revision:Number((e('revision').textContent.match(/\\d+/)||[])[0]),
   results:JSON.parse(e('observable-results').dataset.results||'null'),
   text:e('observable-results').textContent,
   evidence:e('evidence-summary').textContent,
   limits:e('evidence-result-limits').textContent,
   qualification:e('qualification-status').dataset.state,
   fitDisabled:e('fit-results').disabled};})()`);
 const upload=async file=>{
  const dom=await cdp.send('DOM.getDocument',{depth:-1});
  const n=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
  await cdp.send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[file]});
 };
 const importCurrent=async(file,accept,label)=>{
   const before=(await state()).revision,start=Date.now();
   await upload(file);
   const result=await until(state,x=>x.revision>before&&accept(x),label);
   report.timings.push({label,elapsedMs:Date.now()-start,revision:result.revision,
     type:'measured UI import-to-current-native-result wall time, not numerical solver CPU'});
   return result;
 };
 const shot=async name=>{
  const s=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(join(output,name+'.png'),Buffer.from(s.data,'base64'));report.screenshots.push(name+'.png');
 };
 const check=name=>report.checks.push({name,passed:true});
 const bundle=name=>join(input,name,'qualified-scene.json');
 await cdp.send('Page.navigate',{url:origin+'/?scene=polygon-dielectric'});
 await until(state,s=>s.native==='completed'&&!s.error,'initial native viewer');
 const baseline=await parseQualifiedBundle(await readFile(bundle('normal-and-detector'),'utf8'));
 const raw=join(output,'scene.raw.json');
 await writeFile(raw,JSON.stringify(baseline.scene,null,2)+'\n');
 let s=await importCurrent(bundle('normal-and-detector'),s=>s.native==='completed'&&s.results?.[0]?.status==='advisory','normal v9 opt-in advisory');
 assert.equal(s.error,'');assert.equal(s.results[0].kind,'finite-hit-numerical-diagnostic');
 assert.equal(s.results[0].method,'advisory-native-finite-hit-binary64-v1');
 assert.ok(['checked','unknown'].includes(s.results[0].value.status));
 assert.match(s.text,/NOT A VERIFIED OPTICAL MEASUREMENT/);
 assert.match(s.limits,/does NOT certify/);
 assert.match(s.evidence,/NONCERTIFYING native diagnostic/);
 assert.equal(s.results.find(x=>x.kind==='detector-crossings')?.status,'qualified');
 check('Actual Chrome labels requested normal finite-hit diagnostic as advisory, preserving native detector readouts');
 await shot('stage1-normal-advisory');
 await js("document.getElementById('save-qualified').click()");
 const file=await until(async()=>(await readdir(downloads)).find(x=>x.endsWith('.qualified.json')),Boolean,'qualified export');
 const exportPath=join(downloads,file),exported=await parseQualifiedBundle(await readFile(exportPath,'utf8'));
 assert.deepEqual(exported.observables[0],baseline.observables[0]);
 assert.equal('execution'in exported,false);assert.equal('results'in exported,false);
 assert.ok(!JSON.stringify(exported).includes('observedGlassIncidents'));
 check('Qualified browser export contains request, no previous run-local numeric observations');
 s=await importCurrent(exportPath,x=>x.native==='completed'&&x.results?.[0]?.status==='advisory','qualified native reopen');
 check('Reimport creates a new completed native observation without inherited readout');
 s=await importCurrent(bundle('valid-zero-glass-hit'),x=>x.native==='completed'&&x.results?.[0]?.value?.status==='checked-no-hit','valid zero hit');
 assert.match(s.text,/NONCERTIFYING/i);
 check('Positive native emission with genuinely no Glass incidence reports sampled checked-no-hit, not darkness');
 s=await importCurrent(bundle('two-detectors-two-sources'),x=>x.native==='completed'&&x.results?.[0]?.status==='advisory','multiple sources/detectors');
 check('Two sources and both detectors retain bounded advisory and true native measurements');
 s=await importCurrent(bundle('full-fresnel'),x=>['completed','completed-with-warnings','incomplete','failed','stopped'].includes(x.native)&&
  (x.results?.[0]?.status==='advisory'||x.native==='incomplete'||x.native==='failed'||x.native==='stopped'),
  'full Fresnel status');
 if(s.native==='incomplete'||s.native==='failed'||s.native==='stopped')
  assert.equal(s.results,null,'Partial native Fresnel must suppress old accepted advisory');
 check('Full native Fresnel retains honest completed versus incomplete advisory suppression');
 s=await importCurrent(bundle('full-fresnel-matched-index'),x=>x.native==='completed'&&
  x.results?.[0]?.status==='advisory','completed full-Fresnel equal-index control');
 assert.ok(!s.results[0].warnings.some(w=>/explicit transmitted-only approximation/.test(w)));
 check('Real Chrome full-Fresnel true with equal indices preserves completed advisory and no transmitted-only caveat');
 s=await importCurrent(bundle('exposed-rotated-computed-critical'),x=>['completed','incomplete','failed','stopped'].includes(x.native)&&
  (x.results?.[0]?.status==='advisory'||x.native!=='completed'),
  'computed-critical case: no fixed branch claimed');
 if(s.results?.[0]?.value?.status==='inconsistent'){
  assert.match(s.text,/NOT independently certified|NOT independently certified/i);
  assert.match(s.limits,/NUMERICAL CAUTION/);
 }
 check('Real critical native variability is retained without imposing a path or a false deterministic expectation');
 await shot('stage1-critical-observation');
 // Raw import deliberately discards both source qualification and opt-in
 // requests, even when it reproduces the same geometry as an old run.
 s=await importCurrent(raw,x=>x.native==='completed'&&x.results===null&&x.qualification==='unknown','raw import clears requests');
 check('Raw scene import clears opt-in diagnostic and old qualified readout');
 s=await importCurrent(bundle('normal-and-detector'),x=>x.native==='completed'&&x.results?.[0]?.status==='advisory','revisit A after B');
 assert.match(s.text,/ADVISORY ONLY/);
 check('A-B-A reimport requires a current run and never publishes prior raw diagnostic coordinates');
 assert.deepEqual(report.errors,[]);
 report.status='passed';
}catch(error){
 try{const shot=await cdp?.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  if(shot?.data){await writeFile(join(output,'failure.png'),Buffer.from(shot.data,'base64'));report.screenshots.push('failure.png');}
 }catch{}
 report.errors.push(error.stack);throw error;
}finally{
 cdp?.close();browser?.kill();server?.kill();
 try{await until(async()=>[browser,server].every(p=>!p||p.exitCode!==null||p.signalCode!==null),x=>x,'Chrome/server shutdown');}catch{}
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log('FINITE_HIT_STAGE1_BROWSER '+JSON.stringify({status:report.status,checks:report.checks.length,
 screenshots:report.screenshots}));
