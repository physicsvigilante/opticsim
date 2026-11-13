import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeU2Motion} from '../src/motion-example.js';
import {prepareMotionExperiment,MotionPlayer,motionCapabilities} from '../src/source-motion.js';
import {reviseMotionRayExperiment} from '../src/motion-ray-controls.js';
import {MotionRayUI} from '../src/motion-ray-ui.js';
import {verifyQualifiedBundle} from '../src/qualification.js';
import {canonicalJSON} from '../src/qualified-utils.js';
const example=JSON.parse(readFileSync(new URL('../examples/u2-motion.json',import.meta.url)));
const source=scene=>scene.physics.components.find(x=>x.type==='point-source');
const make=()=>makeU2Motion(example);

test('ray revision snapshots caller intent before asynchronous integrity verification',async()=>{
 const pkg=await make(),original=canonicalJSON(pkg),change={brightness:.2};
 const pending=reviseMotionRayExperiment(pkg,change);
 change.brightness=.9;change.mirrorApertureHeightMm=1000;
 const revised=await pending;
 assert.equal(source(revised.baseline.scene).parameters.brightness,.2);
 assert.equal(revised.baseline.scene.physics.components.find(x=>x.type.includes('mirror')).parameters.apertureHeight,60);
 assert.equal(canonicalJSON(pkg),original);
 assert.ok(revised.baseline.qualification.edits.at(-1).changes.every(x=>!x.path.includes('apertureHeight')));
});

test('qualified verification cannot return unverified data mutated during the final digest',async()=>{
 const pkg=await make(),input=pkg.baseline,original=structuredClone(input);
 const digest=crypto.subtle.digest;
 let calls=0;
 crypto.subtle.digest=function(...args){
  const pending=digest.apply(this,args);
  return ++calls===2?pending.then(hash=>{
   source(input.scene).parameters.brightness=.81;
   input.qualification.interpretation.assumptions.push('Caller mutation during final digest');
   return hash;
  }):pending;
 };
 let verified;
 try{verified=await verifyQualifiedBundle(input);}finally{crypto.subtle.digest=digest;}
 assert.equal(calls,2);
 assert.deepEqual(verified,original);
 assert.equal(source(input.scene).parameters.brightness,.81);
 assert.equal(source(verified.scene).parameters.brightness,.05);
 await verifyQualifiedBundle(verified);
});

test('qualified verification snapshots before the first digest as well as the final one',async()=>{
 const pkg=await make(),baseline=structuredClone(pkg.baseline);
 const pending=verifyQualifiedBundle(baseline);
 source(baseline.scene).parameters.brightness=.3;
 const checked=await pending;
 assert.deepEqual(checked,pkg.baseline);
 await assert.rejects(verifyQualifiedBundle(baseline),/integrity/);
});

test('stopping playback publishes only invalidated state, not a preceding completed result',async()=>{
 const model=await prepareMotionExperiment(await make()),events=[];
 const player=new MotionPlayer({model,render:async()=>({status:'completed'}),
  onState:p=>events.push({state:p.state,hasResult:!!p.result,playing:p.playing})});
 await player.seek(0);events.length=0;
 player.stop();
 assert.deepEqual(events,[{state:'stopped',hasResult:false,playing:false}]);
});

test('bad frame requests clear previous accepted results and stop playback',async()=>{
 const model=await prepareMotionExperiment(await make());
 let renders=0;
 const player=new MotionPlayer({model,render:async()=>{renders++;return {status:'completed'};}});
 for(const bad of [-1,NaN,1.1,61]){
  await player.seek(0);assert.ok(player.result);
  const before=renders,result=await player.seek(bad);
  assert.equal(result,null);assert.equal(player.state,'invalid');
  assert.equal(player.result,null);assert.equal(player.playing,false);assert.equal(renders,before);
 }
});

test('superseded native callbacks still cannot publish after stop or later seek',async()=>{
 const model=await prepareMotionExperiment(await make()),resolvers=[];
 const player=new MotionPlayer({model,render:()=>new Promise(resolve=>resolvers.push(resolve))});
 const older=player.seek(0);player.stop();const latest=player.seek(30);
 resolvers[0]({status:'completed',stale:true});await older;
 assert.equal(player.result,null);
 resolvers[1]({status:'completed',stale:false});await latest;
 assert.equal(player.index,30);assert.equal(player.result.native.stale,false);
});

test('motion capability advertises the enforced canonical depth bound rather than 16',async()=>{
 const m=await prepareMotionExperiment(await make());
 assert.equal(motionCapabilities().limits.maxDepth,8);
 await assert.rejects(reviseMotionRayExperiment(m.exportExperiment(),{maxRayDepth:9}),/8/);
});

async function withUI(run){
 const documentBefore=globalThis.document;
 const nodes=new Map();
 globalThis.document={getElementById(id){
  if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,textContent:'',checked:false,focus(){}});
  return nodes.get(id);
 }};
 let model=await prepareMotionExperiment(await make());
 const context={nodes,getModel:()=>model,setModel:value=>{model=value;}};
 try{await run(context);}finally{if(documentBefore===undefined)delete globalThis.document;else globalThis.document=documentBefore;}
}

test('an invalid entered direction cannot authorize the old full-circle direction as an exact ray',async()=>{
 await withUI(async ctx=>{
  ctx.setModel(await prepareMotionExperiment(await reviseMotionRayExperiment(ctx.getModel().exportExperiment(),{emissionMode:'full-circle'})));
  const ui=new MotionRayUI({getModel:ctx.getModel,onChange:async change=>{
   ctx.setModel(await prepareMotionExperiment(await reviseMotionRayExperiment(ctx.getModel().exportExperiment(),change)));return true;
  }});
  assert.equal(ui.directionExplicit,false);
  assert.equal(await ui.apply({directionDeg:999}),false);
  assert.equal(ui.directionExplicit,false);
  ctx.nodes.get('ray-source-mode').value='single-ray';ctx.nodes.get('ray-source-mode').onchange();
  assert.equal(source(ctx.getModel().baseline.scene).emission.mode,'full-circle');
  assert.match(ctx.nodes.get('ray-control-error').textContent,/Enter a direction/);
  assert.equal(await ui.apply({directionDeg:17}),true);assert.equal(ui.directionExplicit,true);
  assert.equal(await ui.apply({emissionMode:'single-ray',directionDeg:17}),true);
  assert.equal(source(ctx.getModel().baseline.scene).emission.directionDeg,17);
 });
});

test('late UI rejection cannot attach errors or direction confirmation to a replacement experiment',async()=>{
 await withUI(async ctx=>{
  let reject;
  const ui=new MotionRayUI({getModel:ctx.getModel,onChange:()=>new Promise((resolve,fail)=>{reject=fail;})});
  const pending=ui.apply({directionDeg:10});
  assert.equal(ui.busy,true);
  ui.reset();
  reject(Error('Late rejection from previous experiment'));await pending;
  assert.equal(ui.busy,false);assert.equal(ui.directionExplicit,false);
  assert.equal(ctx.nodes.get('ray-control-error').hidden,true);
  assert.equal(ctx.nodes.get('ray-control-error').textContent,'');
 });
});

test('late successful UI edit does not confirm a direction after a new experiment is loaded',async()=>{
 await withUI(async ctx=>{
  let resolve;
  const ui=new MotionRayUI({getModel:ctx.getModel,onChange:()=>new Promise(ok=>{resolve=ok;})});
  const pending=ui.apply({directionDeg:10});ui.reset();resolve(true);
  assert.equal(await pending,false);assert.equal(ui.directionExplicit,false);
 });
});
