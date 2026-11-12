// Real browser import/edit/export checks for the supported demonstrations.
// Screenshots use the native renderer; no constructed ray paths or overlays.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const demoRoot=resolve(root,process.argv[2]||'test-artifacts/llm-authoring/supported-demos');
const out=join(demoRoot,'browser'),downloads=join(out,'downloads');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(fn,ok,label){
  const end=Date.now()+20000;let last,error;
  while(Date.now()<end){try{last=await fn();if(ok(last))return last;}catch(e){error=e.message;}await sleep(125);}
  throw Error(label+' timed out: '+JSON.stringify(last)+' '+(error||''));
}
function browserBinary(){
  for(const bin of [process.env.OPTICSIM_CHROME,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
    const p=spawnSync(bin,['--version'],{encoding:'utf8',timeout:3000});
    if(!p.error&&p.status===0)return {bin,version:p.stdout.trim()};
  }
  throw Error('Chrome/Chromium unavailable; browser checks were not performed');
}
async function freePort(){
  const server=createServer();
  await new Promise((ok,err)=>server.once('error',err).listen(0,'127.0.0.1',ok));
  const port=server.address().port;await new Promise(ok=>server.close(ok));return port;
}
async function connect(url){
  const ws=new WebSocket(url),pending=new Map(),listeners=new Set();let next=0;
  await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
  ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.method)for(const f of listeners)f(r);
    const done=pending.get(r.id);if(done){pending.delete(r.id);done(r);}});
  return {close:()=>ws.close(),onEvent:f=>listeners.add(f),send:(method,params={})=>new Promise((ok,err)=>{
    const id=++next,timer=setTimeout(()=>{pending.delete(id);err(Error(method+' timeout'));},20000);
    pending.set(id,r=>{clearTimeout(timer);r.error?err(Error(JSON.stringify(r.error))):ok(r.result);});
    ws.send(JSON.stringify({id,method,params}));
  })};
}
function checkResults(text,expected){
  const blocks=text.split('\n\n');
  for(const r of expected){
    const block=blocks.find(b=>b.startsWith(r.id+' — '));assert.ok(block,'Missing result '+r.id);
    assert.equal(block.split('\n')[0],r.id+' — '+r.status+'; '+r.method);
    assert.deepEqual(JSON.parse(block.split('\n')[1]),r.value);
  }
}
async function main(){
  const demos=JSON.parse(await readFile(join(demoRoot,'report.json'),'utf8'));
  const attempts=JSON.parse(await readFile(join(demoRoot,'first-attempt.json'),'utf8'));
  assert.equal(demos.status,'pass');await mkdir(downloads,{recursive:true});
  const {bin,version}=browserBinary();const port=await freePort(),origin='http://127.0.0.1:'+port;
  const profile=await mkdtemp(join(out,'profile-'));
  const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port),OPTICSIM_BASE_PATH:'/'},stdio:'ignore'});
  const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  const report={browser:version,status:'running',checks:[],screenshots:[],viewportChecks:[],errors:[]};
  let cdp;const requests=[],badResponses=[],javascriptErrors=[];
  try{
    await until(async()=>(await fetch(origin)).status,x=>x===200,'server ready');
    const chromePort=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'debug port');
    const targets=await until(async()=>await(await fetch('http://127.0.0.1:'+chromePort+'/json/list')).json(),x=>x.some(t=>t.type==='page'),'browser page');
    cdp=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    cdp.onEvent(e=>{
      if(e.method==='Network.requestWillBeSent'&&e.params?.request?.url?.startsWith('http'))requests.push(e.params.request.url);
      if(e.method==='Network.responseReceived'&&e.params.response.status>=400)badResponses.push(e.params.response.url);
      if(e.method==='Runtime.exceptionThrown')javascriptErrors.push(e.params.exceptionDetails?.text);
    });
    for(const method of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(method);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
    await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
    const evaluate=async expression=>{
      const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;
    };
    const ui=()=>evaluate('({title:document.getElementById("title").textContent,state:document.getElementById("status").dataset.state,qualification:document.getElementById("qualification-status").dataset.state,results:document.getElementById("observable-results").textContent,error:document.getElementById("error").textContent,disabled:document.getElementById("save-qualified").disabled,width:document.getElementById("light").width,height:document.getElementById("light").height})');
    const upload=async path=>{
      const dom=await cdp.send('DOM.getDocument',{depth:-1});
      const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
      await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});
    };
    const current=(title,qualification,results)=>until(ui,s=>{
      if(s.title!==title||s.state!=='completed'||s.qualification!==qualification||s.disabled||s.error)return false;
      try{checkResults(s.results,results);return true;}catch{return false;}
    },title+' '+qualification+' results');
    const shot=async name=>{
      const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');
    };
    function viewport(id,phase,bundle,state,results){
      const image=results.find(r=>r.kind==='ideal-image');if(!image)return false;
      const v=bundle.scene.presentation.view;
      const pixel={x:state.width/2+(image.value.x-v.x)*v.zoom,y:state.height/2-(image.value.y-v.y)*v.zoom};
      report.viewportChecks.push({id,phase,canvas:{width:state.width,height:state.height},view:v,
        conditionalImagePixel:pixel,inside:pixel.x>=0&&pixel.x<=state.width&&pixel.y>=0&&pixel.y<=state.height,
        meaning:'Screen location of a conditional analytical coordinate, not native image detection.'});
      return true;
    }
    await cdp.send('Page.navigate',{url:origin+'/'});await until(ui,s=>s.state==='completed','browser ready');
    for(const c of demos.cases){
      const attempt=attempts.cases.find(x=>x.id===c.id);
      const first=await parseQualifiedBundle(await readFile(join(demoRoot,c.initial.bundle),'utf8'));
      const next=await parseQualifiedBundle(await readFile(join(demoRoot,c.revised.bundle),'utf8'));
      await upload(join(demoRoot,c.initial.bundle));
      const loaded=await current(attempt.request.title,'fully-specified',c.initial.results);
      if(viewport(c.id,'initial',first,loaded,c.initial.results)){
        // Explicit presentation-only adjustment for screenshots, recorded in
        // export history. Never alter the sealed physical first request.
        await evaluate('(()=>{const z=document.getElementById("zoom");z.value="0.6";z.dispatchEvent(new Event("input",{bubbles:true}));})()');
        await current(attempt.request.title,'fully-specified',c.initial.results);
      }
      report.checks.push({name:c.id+' initial package and current results',result:'pass'});await shot(c.id+'-initial');
      const change=attempt.revisionChanges[0],value=next.scene.physics.components.find(x=>x.id===change.id)[change.section][change.key];
      await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(change.id+'-'+change.key)+');e.value='+JSON.stringify(String(value))+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
      await current(attempt.request.title,'revised',c.revised.results);
      report.checks.push({name:c.id+' one physical edit recalculates results',result:'pass'});
      const previous=new Set(await readdir(downloads));await evaluate('document.getElementById("save-qualified").click()');
      const saved=await until(async()=>{
        for(const name of (await readdir(downloads)).filter(n=>!previous.has(n)&&n.endsWith('.json'))){
          const path=join(downloads,name),bundle=await parseQualifiedBundle(await readFile(path,'utf8'));
          if(bundle.scene.presentation.title===attempt.request.title)return {path,bundle};
        }return null;
      },x=>!!x,'fresh qualified download');
      assert.deepEqual(saved.bundle.scene.physics,next.scene.physics);
      assert.deepEqual(saved.bundle.qualification.origin,first.qualification.origin);
      assert.deepEqual(saved.bundle.qualification.assumptions,first.qualification.assumptions);
      assert.deepEqual(saved.bundle.qualification.interpretation,first.qualification.interpretation);
      assert.equal(saved.bundle.qualification.edits.filter(e=>e.kind==='physics').length,1);
      report.checks.push({name:c.id+' exported package preserves origin and edit',result:'pass'});
      await upload(saved.path);await current(attempt.request.title,'revised',c.revised.results);
      report.checks.push({name:c.id+' browser export reopens and recomputes',result:'pass'});await shot(c.id+'-revised');
      await upload(join(demoRoot,c.revised.bundle));
      const revised=await current(attempt.request.title,'revised',c.revised.results);
      viewport(c.id,'revised',next,revised,c.revised.results);
      report.checks.push({name:c.id+' CLI-revised package matches browser physical results',result:'pass'});
    }
    assert.deepEqual(javascriptErrors,[]);assert.deepEqual(badResponses,[]);
    assert.ok(requests.every(url=>url.startsWith(origin+'/')),'Unexpected external browser request');
    report.status='pass';
    console.log('Supported demo browser PASS: '+report.checks.length+' checks; '+report.screenshots.length+' screenshots; '+version);
  }catch(error){report.status='failed';report.errors.push(error.message);throw error;}
  finally{
    await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    cdp?.close();for(const child of [browser,server])if(child.exitCode===null)child.kill('SIGTERM');
    await sleep(400);await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:250});
  }
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
