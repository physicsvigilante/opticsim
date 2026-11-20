// J08 test-only genuine pinned-PhyDemo mirror-backed slab propagation.
// A supported public v5 planar-interface + finite Mirror + passive Detector
// scene is fully authored with SYNTHETIC exterior index, source and lengths.
// Actual interface-entry/exit events are measured, never imposed on engine.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {analyzeMirrorBackedSlab} from '../src/mirror-backed-slab-displacement.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const original=JSON.parse(readFileSync(new URL('../examples/jee-j08-mirror-backed-slab-synthetic-air-v1.json',import.meta.url),'utf8'));
const frozen=JSON.parse(readFileSync(new URL('../evaluation/jee-j08-mirror-backed-slab-v1/frozen-protocol.json',import.meta.url),'utf8'));
const RAD=Math.PI/180,DEG=180/Math.PI;
const dir=ray=>{
 const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,L=Math.hypot(dx,dy);
 return L>0&&Number.isFinite(L)?{x:dx/L,y:dy/L}:null;
};
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,
 String(a)+' != '+String(b)+' tolerance '+String(t));
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const hash=b=>createHash('sha256').update(b).digest('hex');
const root=resolve('test-artifacts/llm-authoring/jee-j08-slab-native-v1');
mkdirSync(root,{recursive:true});
const output=mkdtempSync(resolve(root,'attempt-'));
const save=(name,value)=>{
 const text=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',bytes=Buffer.from(text);
 writeFileSync(resolve(output,name),bytes,{flag:'wx'});
 return {name,sha256:hash(bytes),size:bytes.length};
};
function physical({i=60,n0=1,n1=1.8,t=60,mirror=true,detector=true,
 fullFresnel=false,maxRayDepth=8,limit=10000,shiftX=0,shiftY=0}={}){
 const sourceY=-100*Math.tan(i*RAD);
 const components=[
  {id:'S',type:'point-source',parameters:{x:-100+shiftX,y:sourceY+shiftY,brightness:.08},
   emission:{mode:'single-ray',directionDeg:i}},
  {id:'I',type:'planar-interface',parameters:{
   x:shiftX,y:shiftY,normalDeg:0,negativeIndex:n0,
   positiveIndex:n1,partialReflection:fullFresnel}},
  ...(mirror?[{id:'M',type:'plane-mirror',parameters:{
   x:t+shiftX,y:shiftY,orientationDeg:90,length:420}}]:[]),
  ...(detector?[{id:'D',type:'ray-detector',parameters:{
   x:-10+shiftX,y:shiftY,orientationDeg:90,length:420}}]:[])
 ];
 const document=prepareScene({lengthUnit:'mm',title:'J08 synthetic planar slab and true backing Mirror',
  runPolicy:'preview-v1',components}).document;
 assert.equal(document.schemaVersion,5);
 document.simulation.maxRayDepth=maxRayDepth;
 document.simulation.processedRayLimit=limit;
 return document;
}
function run(config={}){
 const d=physical(config),loaded=core.loadDocument(d),s=loaded.scene;
 const input=save('j08-native-'+String(config.id||'control')+'.json',
  JSON.stringify(d,null,2)+'\n');
 const meter=core.observeInterfaceSet(d,s,loaded.idMap);
 const emissions=core.observeSourceSet(d,s,loaded.idMap);
 const observed=[];
 for(const [id,type] of [['I','PlaneGlass'],['M','Mirror'],['D','Detector']]){
  const index=loaded.idMap.get(id);
  if(index===undefined)continue;
  const obj=s.objs[index],method=obj.onRayIncident;
  assert.equal(obj.constructor.type,type);
  obj.onRayIncident=function(...args){
   if(observed.length>=32)throw Error('Native event report overflow');
   const before=dir(args[0]),point={x:args[2].x,y:-args[2].y};
   const result=method.apply(this,args);
   const after=result?.isAbsorbed?null:dir(args[0]);
   observed.push({objectId:id,nativeType:type,point,before,after,
    absorbed:result?.isAbsorbed===true,
    undefined:result?.isUndefinedBehavior===true,
    children:(result?.newRays||[]).length});
   return result;
  };
 }
 const sim=new core.Simulator(s,null,null,null,null,null,false,d.simulation.processedRayLimit);
 let terminal=null;
 for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{terminal=name;});
 sim.updateSimulation();
 const diagnostics=core.diagnostics(s,sim,emissions,null,null,meter,{nativeEvent:terminal});
 const status=core.classifyRun(terminal,diagnostics);
 const complete=status==='completed'&&terminal==='simulationComplete'&&
  diagnostics.truncation===0&&diagnostics.undefinedBehavior===0&&
  diagnostics.errors.length===0;
 const r={format:'opticsim-j08-mirror-backed-slab-native-research-v1',
  id:config.id||'control',control:config,inputSha256:input.sha256,
  sourceFactsSuppliedByResearchOnly:['outsideIndex','source position','brightness','mirror width','detector'],
  nativePin:frozen.nativePin,term:terminal,status,complete,
  diagnostics:{truncation:diagnostics.truncation,undefinedBehavior:diagnostics.undefinedBehavior,
   errors:diagnostics.errors},interfaceMeter:meter.byId.I,
  actualCallbacks:observed,qualifiedNativeIllustration:false,
  originalQuestionSourceFullySimulated:false,nativeImageDetected:false};
 const artifact=save('j08-native-'+String(config.id||'control')+'-report.json',r);
 console.log('JEE_J08_SLAB_NATIVE '+JSON.stringify({id:r.id,term:terminal,status,
  nativeComplete:complete,route:observed.map(x=>x.objectId),truncation:diagnostics.truncation,
  sourceOnlyNotSimulated:true}));
 return {...r,input,artifact,doc:d};
}
test('the J08 original source omits outside material and fixture discloses added physical apparatus',()=>{
 assert.equal(frozen.status,'frozen-before-implementation-and-execution');
 assert.equal(frozen.productionBaseline,'cf0366d2b46a0cb88e97bc8d9ec94a29e556ed83');
 assert.equal(frozen.source.caseId,'J08');
 assert.equal(frozen.source.solutionsRead,false);
 assert.ok(frozen.source.notStated.includes('Numeric exterior refractive index'));
 const q=analyzeMirrorBackedSlab(original);
 assert.equal(q.status,'conditional');
 assert.equal(original.outsideIndex,1);
});
test('native complete refraction–Mirror reflection–reverse refraction measures true slab front-surface displacement',()=>{
 const run0=run({id:'air-baseline'});
 assert.equal(run0.complete,true);
 assert.deepEqual(run0.actualCallbacks.map(x=>x.objectId),['D','I','M','I','D']);
 const face=run0.actualCallbacks.filter(x=>x.objectId==='I');
 const mm=analyzeMirrorBackedSlab(original).value.entranceToExitSeparationMm;
 near(face[0].point.x,0);near(face[1].point.x,0);
 near(face[0].point.y,0,1e-7);
 near(face[1].point.y-face[0].point.y,mm,1e-7);
 const mir=run0.actualCallbacks.find(x=>x.objectId==='M');
 near(mir.point.x,60);
 near(mir.point.y-face[0].point.y,mm/2);
 near(mir.after.x,-mir.before.x,1e-11);
 near(mir.after.y,mir.before.y,1e-11);
 near(face[0].before.y,Math.sin(60*RAD),1e-11);
 near(face[1].after.x,-Math.cos(60*RAD),1e-11);
 near(face[1].after.y,Math.sin(60*RAD),1e-11);
 assert.equal(run0.interfaceMeter.interactions,2);
 assert.equal(run0.interfaceMeter.first.incidentIndex,1);
 assert.equal(run0.interfaceMeter.first.destinationIndex,1.8);
 near(run0.interfaceMeter.first.transmittedAngleDeg,
  Math.asin(Math.sin(60*RAD)/1.8)*DEG,1e-7);
 assert.equal(run0.actualCallbacks.filter(x=>x.nativeType==='Detector').length,2);
 for(const e of run0.actualCallbacks){
  assert.equal(e.undefined,false);assert.equal(e.children,0);
 }
});
test('actual native double-crossing displacement is invariant under translation and varies with index and thickness',()=>{
 const cases=[
  {id:'translated',shiftX:100,shiftY:-80},
  {id:'index-1point33',n0:1.33},
  {id:'half-thickness',t:30},
  {id:'normal',i:0}
 ];
 for(const c of cases){
  const r=run(c);assert.equal(r.complete,true,c.id);
  const face=r.actualCallbacks.filter(e=>e.objectId==='I');
  assert.equal(face.length,2,c.id);
  const ref=analyzeMirrorBackedSlab({...original,lengthUnit:'mm',thickness:c.t??60,
   incidentAngleDeg:c.i??60,outsideIndex:c.n0??1}).value;
  near(face[1].point.y-face[0].point.y,ref.entranceToExitSeparationMm,1e-7);
  assert.equal(r.actualCallbacks.filter(e=>e.objectId==='M').length,1);
 }
});
test('native slab with no backing mirror is not a returning ray; incomplete depth suppresses outcomes',()=>{
 const missing=run({id:'no-mirror',mirror:false});
 assert.equal(missing.status,'completed');
 assert.equal(missing.actualCallbacks.filter(e=>e.objectId==='I').length,1);
 assert.equal(missing.actualCallbacks.filter(e=>e.objectId==='M').length,0);
 const truncated=run({id:'depth-zero',maxRayDepth:0});
 assert.equal(truncated.complete,false);
 assert.notEqual(truncated.status,'completed');
 assert.ok(truncated.diagnostics.truncation>0);
 const stopped=run({id:'processed-stop',limit:1});
 assert.equal(stopped.complete,false);
 assert.notEqual(stopped.status,'completed');
 const report={format:'opticsim-j08-native-study-summary-v1',sourceFullySimulated:false,
  pin:frozen.nativePin,allNativeMeasurementsAreResearchOnly:true};
 save('report.json',report);
});
