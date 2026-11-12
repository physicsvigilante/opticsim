import {parseQualifiedBundle} from '../src/qualification.js';
// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const smoke=false;
const qualified=true;
const basePath=process.env.OPTICSIM_BASE_PATH || (smoke ? '/opticsim/' : '/');
const out=join(root,'test-artifacts',qualified?'browser-qualified':smoke?'browser-hosted-smoke':'browser-acceptance');
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
const stateExpression=[
 '(() => {const q=id=>document.getElementById(id),c=q("light");let painted=0;',
 'if(c&&c.width&&c.height){const a=c.getContext("2d").getImageData(0,0,c.width,c.height).data;',
 'for(let y=0;y<c.height;y+=12)for(let x=0;x<c.width;x+=12)if(a[(y*c.width+x)*4+3])painted++;}',
 'return{title:q("title")?.textContent,status:q("status")?.dataset.state,',
 'analysis:q("analysis-status")?.textContent,prediction:q("prediction")?.textContent,',
 'stats:q("stats")?.textContent,error:q("error")?.textContent,',
 'saveDisabled:q("save")?.disabled,extended:q("mode-extended")?.checked,',
 'fields:[...document.querySelectorAll("#controls fieldset legend")].map(x=>x.textContent),',
 'painted,focal:q("lens-2-focalLength")?.value,lensX:q("lens-3-x")?.value,',
 'aperture:q("lens-1-apertureHeight")?.value,mirrorAngle:q("mirror-1-orientationDeg")?.value,',
 'detectorReadouts:q("detector-readouts")?.textContent,detectorHidden:q("detector-readouts")?.hidden,',
 'detectorLength:q("detector-return-length")?.value,detectorY:q("detector-return-y")?.value,',
 'detector1x:q("detector-1-x")?.value,sourceReadout:q("source-emissions")?.textContent,',
 'sourceHidden:q("source-emissions")?.hidden,activeSource:q("active-source")?.value,',
 'revision:q("revision")?.textContent,source2X:q("source-2-x")?.value,',
 'source2Brightness:q("source-2-brightness")?.value,source3Direction:q("source-3-directionDeg")?.value,',
 'source4Brightness:q("source-4-brightness")?.value,sourceMode:document.querySelector("#source-tools .source-picker summary")?.textContent};})()'
].join('\n');

async function main(){
  await mkdir(downloads,{recursive:true});
  const {bin,version}=browserBinary();
  const profile=await mkdtemp(join(tmpdir(),'opticsim-browser-'));
  const port=await freePort();
  const origin='http://127.0.0.1:'+port;
  const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,
    env:{...process.env,PORT:String(port),OPTICSIM_BASE_PATH:basePath,
      OPTICSIM_SERVE_DEMO:smoke?'1':'0'},stdio:'ignore'});
  const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  let cdp;const report={browser:version,checks:[],screenshots:[],errors:[]};
  const requests=[],badResponses=[],javascriptErrors=[];
  try{
    await until(async()=>(await fetch(origin+basePath)).status,x=>x===200,'server ready');
    const chromePort=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'debug port');
    const targets=await until(async()=>await(await fetch('http://127.0.0.1:'+chromePort+'/json/list')).json(),x=>x.some(t=>t.type==='page'),'browser page');
    cdp=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    cdp.onEvent(e=>{
      if(e.method==='Network.requestWillBeSent'&&e.params?.request?.url?.startsWith('http'))
        requests.push(e.params.request.url);
      if(e.method==='Network.responseReceived'&&e.params?.response?.status>=400)
        badResponses.push({url:e.params.response.url,status:e.params.response.status});
      if(e.method==='Runtime.exceptionThrown')javascriptErrors.push(e.params.exceptionDetails?.text||'Script exception');
    });
    await cdp.send('Page.enable');await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
    await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
    async function evaluate(expression){
      const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(r.exceptionDetails)throw Error(r.exceptionDetails.text||JSON.stringify(r.exceptionDetails));
      return r.result?.value;
    }
    const state=()=>evaluate(stateExpression);
    async function completed(title){
      const s=await until(state,x=>x?.title===title&&x.status==='completed'&&x.analysis?.includes('Analysis: available'),title+' completed');
      assert.equal(s.error,'');assert.equal(s.saveDisabled,false);
      assert.ok(s.painted>0,'Native rays not painted');assert.match(s.stats,/rays emitted/);
      return s;
    }
    async function select(name,title,count){
      await evaluate('(() => {const e=document.getElementById("examples");e.value='+JSON.stringify(name)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');
      const s=await completed(title);assert.equal(s.fields.length,count);assert.equal(new Set(s.fields).size,count);
      report.checks.push({name:'load '+name,result:'pass',stats:s.stats,painted:s.painted,prediction:s.prediction});
      return s;
    }
    const edit=(id,value)=>evaluate('(() => {const e=document.getElementById('+JSON.stringify(id)+');if(!e)throw Error("missing parameter");e.value='+JSON.stringify(String(value))+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
    async function shot(name){
      const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');
    }
      await cdp.send('Page.navigate',{url:origin+basePath});
      const evidence=JSON.parse(await readFile(join(root,'test-artifacts/qualified-workflow/acceptance.json'),'utf8'));
      const original=await parseQualifiedBundle(await readFile(evidence.browserBundle,'utf8'));
      const qstate=()=>evaluate('({status:document.getElementById("qualification-status").dataset.state,note:document.getElementById("qualification-note").textContent,details:document.getElementById("qualification-details").textContent,results:document.getElementById("observable-results").textContent,disabled:document.getElementById("save-qualified").disabled})');
      const upload=async filepath=>{
        const dom=await cdp.send('DOM.getDocument',{depth:-1});
        const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
        await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[filepath]});
      };
      await until(state,x=>x.status==='completed','initial scene');
      assert.equal((await qstate()).status,'unknown');assert.equal((await qstate()).disabled,true);
      report.checks.push({name:'bare example has unknown provenance',result:'pass'});
      await upload(evidence.browserBundle);
      await until(state,x=>x.title==='Qualified authoring acceptance'&&x.status==='completed','qualified import');
      const loaded=await until(qstate,x=>x.status==='illustrative'&&x.results.includes('conditional'),'qualified results');
      assert.match(loaded.details,/apertureHeight/);assert.match(loaded.details,/Representative luminous point/);
      assert.equal(loaded.disabled,false);
      report.checks.push({name:'hash-bound package loads with policy and author assumptions',result:'pass'});
      assert.match(loaded.results,/existing-analytical-model/);assert.match(loaded.results,/native-observation/);assert.match(loaded.results,/index — unavailable/);
      report.checks.push({name:'conditional, native and unavailable requested results stay separate',result:'pass'});
      await shot('qualified-assumptions-and-results');
      await evaluate('document.getElementById("grid-toggle").click()');
      await until(state,x=>x.status==='completed','presentation change');
      assert.equal((await qstate()).status,'illustrative');
      report.checks.push({name:'presentation edit does not become a new physical claim',result:'pass'});
      await edit('S1-x',-400);
      await until(qstate,x=>x.status==='revised'&&x.results.includes('133.333'),'physical revision');
      await evaluate('document.getElementById("save-qualified").click()');
      const saved=await until(async()=>{
        for(const name of (await readdir(downloads)).filter(n=>n.startsWith('scene.qualified')&&n.endsWith('.json'))){
          const filepath=join(downloads,name),bundle=await parseQualifiedBundle(await readFile(filepath,'utf8'));
          if(bundle.scene.physics.components.find(c=>c.id==='S1').parameters.x===-400)return {filepath,bundle};
        }
        return null;
      },x=>!!x,'qualified export');
      assert.deepEqual(saved.bundle.qualification.assumptions,original.qualification.assumptions);
      assert.equal(saved.bundle.qualification.origin.preparationStatus,'illustrative');
      assert.ok(saved.bundle.qualification.edits.some(e=>e.kind==='physics'));
      report.checks.push({name:'physical edits and prior assumptions survive qualified export',result:'pass'});
      await upload(saved.filepath);
      await until(qstate,x=>x.status==='revised'&&x.results.includes('133.333'),'qualified reopen');
      report.checks.push({name:'qualified save/open preserves revised history and reruns results',result:'pass'});
      await shot('qualified-revision-history');
      await upload(evidence.browserTampered);
      const refused=await until(state,x=>x.status==='invalid'&&x.error.includes('integrity mismatch'),'tampered package refusal');
      assert.equal(refused.saveDisabled,true);assert.equal((await qstate()).disabled,true);
      assert.match((await qstate()).results,/suppressed/);
      report.checks.push({name:'tampered assumptions rejected without stale results',result:'pass'});
      const raw=join(out,'raw-scene.json');await writeFile(raw,JSON.stringify(original.scene));
      await upload(raw);await until(state,x=>x.status==='completed','bare scene import');
      assert.equal((await qstate()).status,'unknown');assert.equal((await qstate()).disabled,true);
      report.checks.push({name:'raw scene does not inherit previous qualification',result:'pass'});
      assert.deepEqual(javascriptErrors,[]);assert.deepEqual(badResponses,[]);
      console.log('Qualified browser acceptance PASS: '+report.checks.length+' checks; '+report.screenshots.length+' screenshots; '+version);
  }catch(err){
    report.errors.push(err.message);
    try{if(cdp){const x=await cdp.send('Page.captureScreenshot',{format:'png'});await writeFile(join(out,'failure.png'),Buffer.from(x.data,'base64'));}}catch{}
    throw err;
  }finally{
    await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    cdp?.close();for(const child of [browser,server])if(child.exitCode===null)child.kill('SIGTERM');
    await sleep(400);
    try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:250});}
    catch(e){console.warn('Temp browser cleanup: '+e.message);}
  }
}
main().catch(err=>{console.error('Browser acceptance FAILED:',err.stack||err.message);process.exitCode=1;});
