// Browser acceptance through Chromium DevTools Protocol; no npm dependencies.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'test-artifacts/browser-acceptance'), downloads=join(out,'downloads');
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
  let next=0;const pending=new Map();
  ws.addEventListener('message',e=>{let r;try{r=JSON.parse(e.data);}catch{return;}
    const done=pending.get(r.id);if(done){pending.delete(r.id);done(r);}
  });
  return {close:()=>ws.close(),send:(method,params={})=>new Promise((ok,err)=>{
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
 'detector1x:q("detector-1-x")?.value};})()'
].join('\n');

async function main(){
  await mkdir(downloads,{recursive:true});
  const {bin,version}=browserBinary();
  const profile=await mkdtemp(join(tmpdir(),'opticsim-browser-'));
  const port=await freePort();
  const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
  const browser=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--window-size=1440,960','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  let cdp;const report={browser:version,checks:[],screenshots:[],errors:[]};
  try{
    await until(async()=>(await fetch('http://127.0.0.1:'+port+'/')).status,x=>x===200,'server ready');
    const chromePort=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),x=>x>0,'debug port');
    const targets=await until(async()=>await(await fetch('http://127.0.0.1:'+chromePort+'/json/list')).json(),x=>x.some(t=>t.type==='page'),'browser page');
    cdp=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await cdp.send('Page.enable');await cdp.send('Runtime.enable');
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
    await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/'});
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
