// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const smoke=process.argv.includes('--hosted-smoke');
const basePath=process.env.OPTICSIM_BASE_PATH || (smoke ? '/opticsim/' : '/');
const out=join(root,'test-artifacts',smoke?'browser-hosted-smoke':'browser-acceptance');
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
 'source4Brightness:q("source-4-brightness")?.value,sourceMode:document.querySelector("#source-tools .source-picker summary")?.textContent,',
 'modelLabel:q("model-label")?.textContent,samplingNote:q("sampling-note")?.textContent,',
 'sourceChoices:[...document.querySelectorAll("#source-tools .source-picker button strong")].map(x=>x.textContent)};})()'
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
    if(smoke){
      await cdp.send('Page.navigate',{url:origin+basePath+'?scene=multi-source-four&private_query=not_for_sharing'});
      const ready=await until(state,x=>x?.title==='Four-source mixed optical ensemble'&&
        x.status==='completed'&&x.painted>0&&!x.sourceHidden,'hosted query scene');
      assert.equal(ready.fields.length,10);
      assert.match(ready.sourceReadout,/source-4: [0-9]+ native rays/);
      assert.equal(ready.error,'');
      const share=await evaluate('document.getElementById("example-link").href');
      const shared=new URL(share);
      assert.equal(shared.origin,origin);
      assert.equal(shared.pathname,basePath);
      assert.equal(shared.searchParams.get('scene'),'multi-source-four');
      assert.deepEqual([...shared.searchParams.keys()],['scene']);
      assert.deepEqual([...new URL(await evaluate('location.href')).searchParams.keys()],['scene']);
      report.checks.push({name:'nested static URL loads real four-source simulation',result:'pass',stats:ready.stats});
      await shot('hosted-subpath-rays');
      await evaluate('(() => {const e=document.getElementById("source-2-brightness");e.value="0.13";e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));})()');
      const edited=await until(state,x=>x?.title===ready.title&&x.status==='completed'&&
        x.source2Brightness==='0.13','hosted source edit');
      assert.ok(edited.painted>0);
      assert.equal(new URL(await evaluate('document.getElementById("example-link").href')).searchParams.get('scene'),'multi-source-four');
      report.checks.push({name:'hosted editable native rays; sharing never includes edited parameters',result:'pass'});
      await evaluate('document.getElementById("save").click()');
      const saved=await until(async()=>JSON.parse(await readFile(join(downloads,'scene.ray-optics-2d.json'),'utf8')),
        x=>x?.presentation?.title===ready.title,'hosted sandbox download');
      assert.equal(saved.physics.components.find(c=>c.id==='source-2').parameters.brightness,.13);
      report.checks.push({name:'hosted browser downloads exact edited sandbox JSON',result:'pass'});
      await cdp.send('Page.navigate',{url:origin+basePath+'?scene=%2E%2E%2F.env'});
      const fallback=await until(state,x=>x?.title==='Single converging lens'&&x.status==='completed'&&
        x.painted>0,'reject unknown scene slug');
      assert.equal(fallback.error,'');
      assert.equal(new URL(await evaluate('document.getElementById("example-link").href')).searchParams.get('scene'),'single-lens');
      report.checks.push({name:'invalid URL parameter cannot load arbitrary assets',result:'pass'});
      for(const requested of requests){
        const parsed=new URL(requested);
        assert.equal(parsed.origin,origin,'Unexpected external network access');
        assert.ok(parsed.pathname.startsWith(basePath),'Request outside hosted prefix: '+requested);
        assert.ok(!parsed.pathname.includes('.env'),'Attempted to fetch private file');
      }
      assert.deepEqual(badResponses,[]);
      assert.deepEqual(javascriptErrors,[]);
      report.checks.push({name:'static page only requests its own packaged origin; no JS errors',result:'pass',
        requests:requests.length});
      console.log('Hosted demo smoke PASS: '+report.checks.length+
        ' checks; '+report.screenshots.length+' screenshot; '+version);
      return;
    }
    await cdp.send('Page.navigate',{url:origin+basePath});
    await completed('Single converging lens');
    const first=await select('three-lenses','Three-lens mixed train',4);
    assert.match(first.prediction,/Virtual image/);await shot('three-lenses-rays');
    await edit('lens-2-focalLength',120);
    const afterF=await completed('Three-lens mixed train');
    assert.notEqual(afterF.prediction,first.prediction);assert.equal(afterF.focal,'120');
    await edit('lens-3-x',270);assert.equal((await completed('Three-lens mixed train')).lensX,'270');
    await edit('lens-1-apertureHeight',160);assert.equal((await completed('Three-lens mixed train')).aperture,'160');
    report.checks.push({name:'focal, position and aperture edits',result:'pass'});
    await edit('lens-2-focalLength',0);
    const invalid=await until(state,x=>x?.status==='invalid','invalid edit');
    assert.equal(invalid.saveDisabled,true);assert.match(invalid.analysis,/suppressed/);assert.match(invalid.error,/focalLength/);
    await edit('lens-2-focalLength',120);await completed('Three-lens mixed train');
    report.checks.push({name:'invalid edit suppresses stale result; recovery',result:'pass'});
    await evaluate('document.getElementById("mode-extended").click()');
    await until(state,x=>x?.status==='completed'&&x.extended&&x.painted>0,'extended rays');
    await shot('three-lenses-extended');
    report.checks.push({name:'extended ray view',result:'pass'});
    await evaluate('document.getElementById("save").click()');
    const file=join(downloads,'scene.ray-optics-2d.json');
    const saved=await until(async()=>JSON.parse(await readFile(file,'utf8')),x=>x?.presentation?.title==='Three-lens mixed train','saved sandbox JSON');
    const p=id=>saved.physics.components.find(c=>c.id===id).parameters;
    assert.equal(p('lens-2').focalLength,120);assert.equal(p('lens-3').x,270);
    assert.equal(p('lens-1').apertureHeight,160);assert.equal(saved.presentation.mode,'extended');
    report.checks.push({name:'real browser file download',result:'pass',ids:saved.physics.components.map(c=>c.id)});
    const fourth=await select('four-lenses','Four-lens mixed train',5);
    assert.match(fourth.prediction,/Real image/);await shot('four-lenses-rays');
    const dom=await cdp.send('DOM.getDocument',{depth:-1});
    const input=await cdp.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#load'});
    assert.ok(input.nodeId);
    await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});
    const recovered=await until(state,x=>x?.title==='Three-lens mixed train'&&x.status==='completed'&&x.focal==='120'&&x.lensX==='270'&&x.aperture==='160'&&x.extended,'real file reopen');
    assert.equal(recovered.fields.length,4);assert.ok(recovered.painted>0);
    report.checks.push({name:'Open sandbox restores saved scene',result:'pass'});
    await evaluate('document.getElementById("export").click()');
    const native=await until(async()=>JSON.parse(await readFile(join(downloads,'scene.phydemo.json'),'utf8')),x=>x?.version===5&&x.objs?.length===4,'native JSON export');
    assert.ok(native.objs.every(x=>!('id' in x)&&!('parameters' in x)));
    report.checks.push({name:'native PhyDemo export',result:'pass'});
    async function mixed(name,title,count){
      await evaluate('(() => {const e=document.getElementById("examples");e.value='+JSON.stringify(name)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');
      const s=await until(state,x=>x?.title===title&&x?.status==='completed'&&x.analysis?.includes('Analysis: unavailable'),title+' trace');
      assert.equal(s.fields.length,count);assert.equal(new Set(s.fields).size,count);
      assert.ok(s.painted>0);assert.match(s.stats,/native reflections/);
      assert.match(s.stats,/mirror-1:/);assert.match(s.stats,/mirror-2:/);
      assert.equal(s.saveDisabled,false);
      report.checks.push({name:'mixed tracing '+name,result:'pass',stats:s.stats,painted:s.painted});
      return s;
    }
    await mixed('mixed-two-lens-two-mirror','Mixed two lenses and two mirrors',5);
    await shot('mixed-two-lens-two-mirror-rays');
    await edit('mirror-1-orientationDeg',40);
    const changed=await until(state,x=>x?.title==='Mixed two lenses and two mirrors'&&
      x.status==='completed'&&x.mirrorAngle==='40'&&x.analysis?.includes('unavailable'),'mixed mirror edit');
    assert.ok(changed.painted>0);assert.equal(changed.saveDisabled,false);
    report.checks.push({name:'mixed mirror orientation edit',result:'pass'});
    await mixed('mixed-reverse-source','Mixed right-side source and mirrors',4);
    await shot('mixed-reverse-source-rays');
    const det=await mixed('mixed-detectors','Mixed beam with two authored ray detectors',7);
    assert.equal(det.detectorHidden,false);
    assert.match(det.detectorReadouts,/detector-early: [0-9]+ native crossings/);
    assert.match(det.detectorReadouts,/detector-return: [0-9]+ native crossings/);
    assert.match(det.detectorReadouts,/signed detector power/);
    await shot('mixed-detectors-rays');
    await edit('detector-return-y',140);
    const adjusted=await until(state,x=>x?.title==='Mixed beam with two authored ray detectors'&&
      x?.status==='completed'&&x.detectorY==='140'&&!x.detectorHidden,'detector position edit');
    assert.match(adjusted.detectorReadouts,/detector-return/);
    await edit('detector-return-length',0);
    const badDetector=await until(state,x=>x?.status==='invalid','invalid detector length');
    assert.equal(badDetector.detectorHidden,true);
    assert.equal(badDetector.saveDisabled,true);
    await edit('detector-return-length',150);
    const restoredDetector=await until(state,x=>x?.status==='completed'&&
      x.detectorLength==='150'&&!x.detectorHidden,'valid detector restored');
    assert.match(restoredDetector.detectorReadouts,/detector-return/);
    report.checks.push({name:'detector edit, invalid-state suppression and recovery',result:'pass'});
    const reverse=await mixed('mixed-detectors-reverse','Reverse beam with two authored ray detectors',6);
    assert.match(reverse.detectorReadouts,/detector-away: 0 native crossings/);
    await shot('mixed-detectors-reverse-rays');
    const onlyLens=await select('single-lens-detector','Single lens with authored ray detector',3);
    assert.equal(onlyLens.detectorHidden,false);
    assert.match(onlyLens.detectorReadouts,/detector-1: [0-9]+ native crossings/);
    assert.match(onlyLens.prediction,/Real image/);
    await shot('single-lens-detector-rays');
    await edit('detector-1-x',180);
    const editedLensDetector=await until(state,x=>x?.title==='Single lens with authored ray detector'&&
      x?.status==='completed'&&x.detector1x==='180'&&!x.detectorHidden,'lens-only detector edit');
    assert.match(editedLensDetector.prediction,/Real image/);
    report.checks.push({name:'detector measurement layer preserves lens equation during edit',result:'pass'});
    const onlyMirror=await select('plane-mirror-detector','Plane mirror with authored ray detector',3);
    assert.equal(onlyMirror.detectorHidden,false);
    assert.match(onlyMirror.detectorReadouts,/detector-1: [0-9]+ native crossings/);
    assert.match(onlyMirror.prediction,/Analytical virtual-image prediction/);
    await shot('plane-mirror-detector-rays');
    async function multi(name,title,count,ids) {
      await evaluate('(() => {const e=document.getElementById("examples");e.value='+JSON.stringify(name)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');
      const current=await until(state,x=>x?.title===title&&x.status==='completed'&&
        x.analysis?.includes('Analysis: unavailable')&&!x.sourceHidden,
        title+' multi-source native trace');
      assert.equal(current.fields.length,count);
      for(const id of ids)assert.match(current.sourceReadout,new RegExp(id+': [0-9]+ native rays'));
      assert.match(current.stats,/rays emitted/);
      assert.match(current.detectorReadouts,/native crossings/);
      assert.equal(current.saveDisabled,false);
      report.checks.push({name:'multi-source '+name,result:'pass',stats:current.stats,
        sources:current.sourceReadout});
      return current;
    }
    const three=await multi('multi-source-mixed','Three-source lens and mirror ensemble',9,
      ['source-1','source-2','source-3']);
    assert.equal(three.activeSource,'source-1');
    await shot('multi-source-three-rays');
    await edit('source-2-brightness',.16);
    const bright=await until(state,x=>x?.title===three.title&&x.status==='completed'&&
      x.source2Brightness==='0.16'&&!x.sourceHidden,'source-2 brightness edit');
    assert.match(bright.sourceReadout,/source-2:/);
    const originalRevision=bright.revision;
    await evaluate('(() => {const e=document.getElementById("active-source");e.value="source-3";e.dispatchEvent(new Event("change",{bubbles:true}));})()');
    const chosen=await state();
    assert.equal(chosen.activeSource,'source-3');
    assert.equal(chosen.revision,originalRevision);
    assert.match(chosen.sourceMode,/source-3/);
    await edit('source-3-directionDeg',175);
    const directed=await until(state,x=>x?.title===three.title&&x.status==='completed'&&
      x.source3Direction==='175','source-3 direction edit');
    assert.equal(directed.source2Brightness,'0.16');
    await edit('source-2-x',0);
    const invalidSource=await until(state,x=>x?.status==='invalid','source on lens plane');
    assert.equal(invalidSource.sourceHidden,true);
    assert.equal(invalidSource.saveDisabled,true);
    await edit('source-2-x',-330);
    await until(state,x=>x?.title===three.title&&x.status==='completed'&&
      !x.sourceHidden&&x.source2X==='-330','recover source position');
    report.checks.push({name:'per-source editing, UI selection and invalid-source recovery',result:'pass'});
    const four=await multi('multi-source-four','Four-source mixed optical ensemble',10,
      ['source-1','source-2','source-3','source-4']);
    await shot('multi-source-four-rays');
    await evaluate('(() => {const e=document.getElementById("active-source");e.value="source-4";e.dispatchEvent(new Event("change",{bubbles:true}));})()');
    const selectedFour=await state();
    assert.equal(selectedFour.activeSource,'source-4');
    assert.match(selectedFour.sourceMode,/360/);
    await evaluate('document.getElementById("source-4-mode-directional").click()');
    const newMode=await until(state,x=>x?.title===four.title&&x.status==='completed'&&
      x.sourceMode?.includes('directional'),'source-4 directional mode');
    assert.match(newMode.sourceReadout,/source-4:/);
    await evaluate('document.getElementById("source-4-mode-full-circle").click()');
    await until(state,x=>x?.title===four.title&&x.status==='completed'&&
      x.sourceMode?.includes('360'),'source-4 full-circle mode');
    await edit('source-4-brightness',.17);
    const changedFour=await until(state,x=>x?.title===four.title&&x.status==='completed'&&
      x.source4Brightness==='0.17','source-4 brightness edit');
    assert.match(changedFour.sourceReadout,/source-4:/);
    report.checks.push({name:'four independent sources: native counts, modes and brightness',result:'pass'});
    await evaluate('document.getElementById("save").click()');
    const multiSaved=await until(async()=>{
      for(const filename of (await readdir(downloads)).filter(n=>n.startsWith('scene.ray-optics-2d')&&n.endsWith('.json'))){
        const filepath=join(downloads,filename),value=JSON.parse(await readFile(filepath,'utf8'));
        if(value.presentation?.title===four.title)return {filepath,doc:value};
      }
      return null;
    },x=>!!x,'save multi-source JSON');
    assert.equal(multiSaved.doc.physics.components.filter(c=>c.type==='point-source').length,4);
    assert.equal(multiSaved.doc.physics.components.find(c=>c.id==='source-4').parameters.brightness,.17);
    const fromSaved=multiSaved.doc.physics.components.find(c=>c.id==='source-4').emission.mode;
    assert.equal(fromSaved,'full-circle');
    await select('single-lens','Single converging lens',2);
    const domReload=await cdp.send('DOM.getDocument',{depth:-1});
    const chooser=await cdp.send('DOM.querySelector',{nodeId:domReload.root.nodeId,selector:'#load'});
    assert.ok(chooser.nodeId);
    await cdp.send('DOM.setFileInputFiles',{nodeId:chooser.nodeId,files:[multiSaved.filepath]});
    const reloaded=await until(state,x=>x?.title===four.title&&x.status==='completed'&&
      !x.sourceHidden&&x.source4Brightness==='0.17','reopen multi-source save');
    assert.equal(reloaded.fields.length,10);
    assert.match(reloaded.sourceReadout,/source-4:/);
    report.checks.push({name:'multi-source Save/Open JSON round trip',result:'pass'});
    await shot('multi-source-reloaded-rays');
    async function general(name,title,count){
      await evaluate('(() => {const e=document.getElementById("examples");e.value='+JSON.stringify(name)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');
      const s=await until(state,x=>x?.title===title&&x.status==='completed'&&
        x.analysis?.includes('Analysis: unavailable')&&x.painted>0,title+' general trace');
      assert.equal(s.fields.length,count);
      assert.equal(new Set(s.fields).size,count);
      assert.equal(s.error,'');
      assert.equal(s.saveDisabled,false);
      report.checks.push({name:'general '+name,result:'pass',stats:s.stats});
      return s;
    }
    const sourceDetector=await general('general-source-detector',
      'General tracing: source and detector',2);
    assert.match(sourceDetector.detectorReadouts,/D1: [0-9]+ native crossings/);
    await shot('general-source-detector-rays');
    await edit('D1-x',160);
    const detectorEdit=await until(state,x=>x?.title==='General tracing: source and detector'&&
      x?.status==='completed'&&x.detectorReadouts?.includes('D1:')&&x.painted>0,
      'general detector edit');
    assert.ok(detectorEdit.detectorReadouts.includes('signed detector power'));
    report.checks.push({name:'general detector edit',result:'pass'});
    const twoSourceLens=await general('general-two-source-lens',
      'General tracing: two sources and one lens',3);
    assert.match(twoSourceLens.sourceReadout,/S1: [0-9]+ native rays/);
    assert.match(twoSourceLens.sourceReadout,/S2: [0-9]+ native rays/);
    await shot('general-two-source-lens-rays');
    await general('general-mirror-pair','General tracing: plane mirrors without a lens',3);
    async function assertSelectorBounds(label){
      const b=await evaluate('(() => {const a=document.querySelector("aside").getBoundingClientRect();const s=document.getElementById("examples").getBoundingClientRect();const t=document.getElementById("title").getBoundingClientRect();return {aside:{left:a.left,right:a.right},select:{left:s.left,right:s.right,width:s.width},title:{left:t.left,right:t.right},viewport:window.innerWidth};})()');
      assert.ok(b.select.width>0,label+': #examples must have positive width');
      assert.ok(b.select.left>=b.aside.left-0.5,label+': #examples left overflows aside');
      assert.ok(b.select.right<=b.aside.right+0.5,label+': #examples right ('+b.select.right+') overflows aside ('+b.aside.right+')');
      assert.ok(b.select.right<=b.title.left+0.5,label+': #examples right ('+b.select.right+') overlaps #title left ('+b.title.left+')');
      return b;
    }
    await assertSelectorBounds('general-mirror-pair@1440');
    await shot('general-mirror-pair-rays');

    // Modern composable native bench starters (v37, v38, v39) + v39 single-ray UI guidance/picker check.
    async function composableStarter(name,expectedLabel,expectedStatuses){
      await evaluate('(() => {const e=document.getElementById("examples");e.value='+JSON.stringify(name)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');
      const s=await until(state,x=>x?.modelLabel===expectedLabel&&expectedStatuses.includes(x.status)&&x.painted>0,name+' starter');
      assert.equal(s.error,'');
      assert.equal(s.saveDisabled,false);
      assert.match(s.detectorReadouts,/D1: [0-9]+ native crossings/);
      await assertSelectorBounds(name+'@1440');
      report.checks.push({name:'composable starter '+name,result:'pass',status:s.status,stats:s.stats});
      return s;
    }
    await composableStarter('native-general-optical-bench','Composable native optical bench · v37',['completed']);
    await shot('v37-optical-bench-starter');
    await composableStarter('native-general-refractive-bench','Composable native refractive bench · v38',['completed','completed-with-warnings']);
    await shot('v38-refractive-bench-starter');
    const v39Starter=await composableStarter('native-general-hybrid-bench','Composable hybrid optical & refractive bench · v39',['completed','completed-with-warnings']);
    assert.match(v39Starter.detectorReadouts,/D1: 4 native crossings/);
    await shot('v39-hybrid-bench-starter');
    const v40Starter=await composableStarter('native-optical-bench','Unified optical bench · v40',['completed','completed-with-warnings']);
    assert.match(v40Starter.detectorReadouts,/D1: 4 native crossings/);
    assert.deepEqual(v40Starter.sourceChoices,['Point source (360°)','Point source (directional)','Single ray (native)']);
    await shot('v40-unified-bench-starter');

    // PR #262 P2-1 regression: real keyboard input on v40 nullable signed spherical-lens frontRadius.
    // Partial/malformed number text ("-", "1e-") yields value==="" with validity.badInput===true and MUST
    // invalidate the draft (across 75 ms throttle, Enter, and sampling change) instead of committing flat null.
    const v40LensPath=join(profile,'v40-signed-lens.json');
    await writeFile(v40LensPath,JSON.stringify({
      format:'ray-optics-2d',schemaVersion:40,adapterVersion:40,
      upstreamCommit:'811f508d2b070898c241a568b0c167dcb8645251',
      physics:{lengthUnit:'mm',coordinates:'x-right-y-up',model:'native-optical-bench',backgroundIndex:1,components:[
        {id:'S1',type:'point-source',parameters:{x:-60,y:8,brightness:0.2},emission:{mode:'single-ray',directionDeg:0,angleDeg:30}},
        {id:'TL1',type:'spherical-lens',parameters:{x:0,y:0,apertureHeight:40,centerThickness:12,frontRadius:50,backRadius:50,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
        {id:'D1',type:'ray-detector',parameters:{x:120,y:0,orientationDeg:90,length:200}}
      ]},
      presentation:{title:'v40 signed lens keyboard check',view:{x:20,y:0,zoom:2},mode:'rays',grid:false},
      simulation:{rayDensity:0.2,maxRayDepth:16,processedRayLimit:10000,randomSeed:'opticsim-v40-seed-v1'}
    },null,2));
    const domV40Lens=await cdp.send('DOM.getDocument',{depth:-1});
    const loadV40Lens=await cdp.send('DOM.querySelector',{nodeId:domV40Lens.root.nodeId,selector:'#load'});
    await cdp.send('DOM.setFileInputFiles',{nodeId:loadV40Lens.nodeId,files:[v40LensPath]});
    const v40LensLoaded=await until(state,x=>x?.title==='v40 signed lens keyboard check'&&['completed','completed-with-warnings'].includes(x.status)&&x.detectorReadouts?.includes('D1: 1 native crossings'),'v40 signed lens load');
    assert.equal(v40LensLoaded.saveDisabled,false);
    const keyTap=async(key,code,vk)=>{
      await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
      await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
    };
    const clearAndType=async(selector,text)=>{
      await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select();})()`);
      await keyTap('Backspace','Backspace',8);
      for(const ch of text)await cdp.send('Input.insertText',{text:ch});
    };
    // 1. Lone minus "-": badInput === true -> MUST stay invalid across throttle, Enter, and sampling change!
    await clearAndType('#TL1-frontRadius','-');
    const minusDom=await evaluate('(() => {const e=document.getElementById("TL1-frontRadius");return {value:e.value,badInput:e.validity.badInput};})()');
    assert.equal(minusDom.value,'');
    assert.equal(minusDom.badInput,true);
    await sleep(220);
    const afterMinus=await state();
    assert.equal(afterMinus.status,'invalid');
    assert.equal(afterMinus.saveDisabled,true);
    await keyTap('Enter','Enter',13);
    await sleep(120);
    assert.equal((await state()).status,'invalid');
    await evaluate('(() => {const e=document.getElementById("sampling");e.value="dense";e.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await sleep(120);
    assert.equal((await state()).status,'invalid');
    // 2. Incomplete exponent "1e-": badInput === true -> MUST stay invalid across throttle!
    await keyTap('Backspace','Backspace',8);
    await clearAndType('#TL1-frontRadius','1e-');
    const expDom=await evaluate('(() => {const e=document.getElementById("TL1-frontRadius");return {value:e.value,badInput:e.validity.badInput};})()');
    assert.equal(expDom.value,'');
    assert.equal(expDom.badInput,true);
    await sleep(220);
    assert.equal((await state()).status,'invalid');
    // 3. Deliberate clear to truly empty (badInput === false) -> commits flat null!
    for(let i=0;i<4;i++)await keyTap('Backspace','Backspace',8);
    const emptyDom=await evaluate('(() => {const e=document.getElementById("TL1-frontRadius");return {value:e.value,badInput:e.validity.badInput};})()');
    assert.equal(emptyDom.value,'');
    assert.equal(emptyDom.badInput,false);
    const afterFlat=await until(state,x=>x?.title==='v40 signed lens keyboard check'&&['completed','completed-with-warnings'].includes(x.status)&&x.saveDisabled===false,'v40 deliberate flat clear');
    assert.match(afterFlat.detectorReadouts,/D1: 1 native crossings/);
    for(const f of (await readdir(downloads)).filter(n=>n.startsWith('scene.ray-optics-2d')))await rm(join(downloads,f),{force:true});
    await evaluate('document.getElementById("save").click()');
    const savedFlat=await until(async()=>{
      for(const f of (await readdir(downloads)).filter(n=>n.startsWith('scene.ray-optics-2d')&&n.endsWith('.json'))){
        const v=JSON.parse(await readFile(join(downloads,f),'utf8'));
        if(v.presentation?.title==='v40 signed lens keyboard check')return v;
      }
      return null;
    },x=>!!x,'save v40 flat lens');
    assert.equal(savedFlat.physics.components.find(c=>c.id==='TL1').parameters.frontRadius,null);
    // 4. Enter valid negative radius "-50" -> commits signed -50!
    await clearAndType('#TL1-frontRadius','-50');
    const afterNeg=await until(state,x=>x?.title==='v40 signed lens keyboard check'&&['completed','completed-with-warnings'].includes(x.status)&&x.saveDisabled===false,'v40 signed negative radius');
    assert.match(afterNeg.detectorReadouts,/D1: 1 native crossings/);
    for(const f of (await readdir(downloads)).filter(n=>n.startsWith('scene.ray-optics-2d')))await rm(join(downloads,f),{force:true});
    await evaluate('document.getElementById("save").click()');
    const savedNeg=await until(async()=>{
      for(const f of (await readdir(downloads)).filter(n=>n.startsWith('scene.ray-optics-2d')&&n.endsWith('.json'))){
        const v=JSON.parse(await readFile(join(downloads,f),'utf8'));
        if(v.presentation?.title==='v40 signed lens keyboard check')return v;
      }
      return null;
    },x=>!!x,'save v40 negative lens');
    assert.equal(savedNeg.physics.components.find(c=>c.id==='TL1').parameters.frontRadius,-50);
    report.checks.push({name:'v40 signed/flat spherical-lens keyboard badInput, deliberate clear (null), and negative radius',result:'pass'});
    await shot('v40-signed-lens-keyboard');

    // Load a v39 single-ray scene via #load to verify single-ray sourcePicker isolation and sampling-note guidance.
    const v39SinglePath=join(profile,'v39-single-ray.json');
    await writeFile(v39SinglePath,JSON.stringify({
      format:'ray-optics-2d',schemaVersion:39,adapterVersion:39,
      upstreamCommit:'811f508d2b070898c241a568b0c167dcb8645251',
      physics:{lengthUnit:'mm',coordinates:'x-right-y-up',model:'native-general-hybrid-bench',components:[
        {id:'S1',type:'point-source',parameters:{x:-120,y:0,brightness:0.5},emission:{mode:'single-ray',directionDeg:0,angleDeg:30}},
        {id:'L1',type:'ideal-lens',parameters:{x:-60,focalLength:120,apertureHeight:60}},
        {id:'C1',type:'circular-dielectric',parameters:{x:10,y:0,radius:20,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
        {id:'D1',type:'ray-detector',parameters:{x:80,y:0,orientationDeg:90,length:80}}
      ]},
      presentation:{title:'v39 single-ray UI check',view:{x:0,y:0,zoom:1.5},mode:'rays',grid:false},
      simulation:{rayDensity:0.2,maxRayDepth:8,processedRayLimit:10000}
    },null,2));
    const domV39=await cdp.send('DOM.getDocument',{depth:-1});
    const loadV39=await cdp.send('DOM.querySelector',{nodeId:domV39.root.nodeId,selector:'#load'});
    await cdp.send('DOM.setFileInputFiles',{nodeId:loadV39.nodeId,files:[v39SinglePath]});
    const v39Single=await until(state,x=>x?.title==='v39 single-ray UI check'&&['completed','completed-with-warnings'].includes(x.status)&&x.detectorReadouts?.includes('D1: 1 native crossings'),'v39 single-ray load');
    assert.deepEqual(v39Single.sourceChoices,['Single ray (native)']);
    assert.match(v39Single.samplingNote,/Each single-ray source emits one exact native ray/);
    assert.doesNotMatch(v39Single.samplingNote,/sparsely sampled/);
    await assertSelectorBounds('v39-single-ray-loaded@1440');
    report.checks.push({name:'v39 single-ray sourcePicker and sampling-note guidance',result:'pass'});
    await shot('v39-single-ray-ui');

    // Verify scene selector stays inside sidebar at a narrower desktop width (860px triggers @media(max-width:900px)).
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:860,height:960,deviceScaleFactor:1,mobile:false});
    const narrowImported=await assertSelectorBounds('v39-single-ray-loaded@860');
    await evaluate('(() => {const e=document.getElementById("examples");e.value="native-general-hybrid-bench";e.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await until(state,x=>x?.modelLabel==='Composable hybrid optical & refractive bench · v39'&&['completed','completed-with-warnings'].includes(x.status),'v39 narrow reload');
    const narrowV39=await assertSelectorBounds('native-general-hybrid-bench@860');
    report.checks.push({name:'scene selector bounds at 1440px and 860px',result:'pass',narrowImported,narrowV39});
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});

    // Verify curated v40 JEE browser starters load, paint, and report detector crossings cleanly in real Chrome (closes PR #265 P3-2).
    const v40Starters=[
      ['v40-billet-split-lens','JEE Billet split-lens: two decentered lenses forming twin real images (v40)',4],
      ['v40-snell-window',"JEE Snell's window: underwater fan splitting into transmission cone and TIR (v40)",3],
      ['v40-silvered-plano-convex','JEE Silvered plano-convex lens: curved-face silvering return focus (v40)',4],
      ['v40-cemented-doublet','JEE Cemented doublet: coaxial crown and flint glass lenses (v40)',4],
      ['v40-layered-mirror-tank','JEE Layered mirror tank: water on glass resting on a flush mirror (v40)',5],
      ['v40-silvered-hemisphere','v40 JEE: Silvered glass hemisphere (internal bubble)',4]
    ];
    for(const [slug,title,fieldCount] of v40Starters){
      await evaluate('(() => {const e=document.getElementById("examples");e.value='+JSON.stringify(slug)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');
      const s=await until(state,x=>x?.title===title&&['completed','completed-with-warnings'].includes(x.status)&&x.painted>0&&x.detectorReadouts?.includes('D1:'),slug+' loaded');
      assert.equal(s.error,'',slug+' had UI error');
      assert.equal(s.saveDisabled,false,slug+' disabled save');
      assert.equal(s.fields.length,fieldCount,slug+' field count mismatch');
      assert.equal(s.modelLabel,'Unified optical bench · v40');
      if(slug==='v40-silvered-hemisphere'){
        const radiusLabel=await evaluate('document.querySelector(\'label[for="H1-radius"]\')?.textContent || document.getElementById("H1-radius")?.closest("label")?.textContent || ""');
        assert.match(radiusLabel,/Glass radius \(positive\)/);
        // Classroom UX checks: toolbar must never overlap #stage even when scrolled,
        // v40 starters sit in the first optgroup, and collapsible scope keeps S1 above the fold.
        const layout=await evaluate('(() => { window.scrollTo(0, 420); const tb=document.querySelector(".ray-toolbar").getBoundingClientRect(), st=document.getElementById("stage").getBoundingClientRect(), fs=document.querySelector("#controls fieldset").getBoundingClientRect(), det=document.querySelector(".guidance-disclosure"), groups=[...document.querySelectorAll("#examples optgroup")].map(g=>({label:g.label,count:g.querySelectorAll("option").length})); window.scrollTo(0, 0); const topFs=document.querySelector("#controls fieldset").getBoundingClientRect(), detOpenBefore=det.open; det.querySelector("summary").click(); const detOpenAfter=det.open, guidanceText=document.getElementById("parameter-guidance").textContent; det.querySelector("summary").click(); return {scrolledToolbarBottom:tb.bottom,scrolledStageTop:st.top,topFirstFieldsetY:topFs.top,detOpenBefore,detOpenAfter,guidanceText,groups}; })()');
        assert.ok(layout.scrolledToolbarBottom<=layout.scrolledStageTop+1,'Toolbar must not overlap #stage when scrolled: '+JSON.stringify(layout));
        assert.equal(layout.detOpenBefore,false,'Guidance disclosure should start collapsed so component controls sit beside canvas');
        assert.equal(layout.detOpenAfter,true,'Clicking guidance disclosure should expand scope rules');
        assert.match(layout.guidanceText,/Ambient n₀ = 1/);
        assert.ok(layout.topFirstFieldsetY<700,'First component fieldset should start above the fold, got y='+layout.topFirstFieldsetY);
        assert.equal(layout.groups[0].label,'Unified Optical Bench (v40 JEE Starters)');
        assert.equal(layout.groups[0].count,7);
        await shot('v40-silvered-hemisphere');
      }
      report.checks.push({name:'v40 starter '+slug,result:'pass',stats:s.stats,painted:s.painted});
    }

    console.log('Browser acceptance PASS: '+report.checks.length+' checks; '+report.screenshots.length+' screenshots; '+version);
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
