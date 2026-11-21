// Strictly test-only v27 feasibility: ONE pinned finite Beam, TWO native
// PlaneGlass interfaces, ONE real downstream Mirror, passive Detector.
// Canonical seed is a VALID reviewed v19 two-plane scene. The extra Mirror
// exists only in a RAW CLONE, never qualified as v19 or public v27 authoring.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {prepareScene} from '../src/authoring.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const bytes=readFileSync(new URL('../research/native-parallel-two-plane-mirror-v27/frozen-protocol.json',import.meta.url));
const freeze=JSON.parse(bytes),f=freeze.geometry;
const root=resolve('test-artifacts/llm-authoring/native-two-plane-mirror-v27-research');
mkdirSync(root,{recursive:true});
const out=mkdtempSync(resolve(root,'attempt-'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const save=(name,value)=>{
 const binary=Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
 writeFileSync(resolve(out,name),binary,{flag:'wx'});
 return {name,sha256:digest(binary),size:binary.length};
};
const vec=r=>{
 if(!r?.p1||!r?.p2)return null;
 const dx=r.p2.x-r.p1.x,dy=r.p1.y-r.p2.y,L=Math.hypot(dx,dy);
 return L>1e-15&&Number.isFinite(L)?{x:dx/L,y:dy/L}:null;
};
const power=r=>r?(r.brightness_s??0)+(r.brightness_p??0):null;
const mm=p=>p?{x:p.x,y:-p.y}:null;
const near=(x,y,tol=1e-8)=>assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<=tol,
 String(x)+' != '+String(y)+' tolerance '+String(tol));
function fixture(c){
 const shift=c.offset||{x:0,y:0},material=c.insideIndex??f.slab.first.positiveIndex;
 const direction=c.beamAngleDeg??f.beam.directionDeg;
 const front={...f.slab.first,x:f.slab.first.x+shift.x,y:f.slab.first.y+shift.y,
  positiveIndex:material,partialReflection:false};
 const rear={...f.slab.second,x:f.slab.second.x+shift.x,y:f.slab.second.y+shift.y,
  negativeIndex:material,partialReflection:false};
 const beam={...f.beam,x:f.beam.x+shift.x,y:f.beam.y+shift.y,directionDeg:direction};
 const detector={...f.detector,x:f.detector.x+shift.x,y:f.detector.y+shift.y};
 const source={lengthUnit:'mm',runPolicy:'preview-v1',title:'RAW research seed: native two-plane slab Beam without Mirror',
  components:[
   {id:'B',type:'parallel-beam',parameters:beam},
   {id:'I1',type:'planar-interface',parameters:front},
   {id:'I2',type:'planar-interface',parameters:rear},
   {id:'D',type:'ray-detector',parameters:detector}
  ]};
 const doc=prepareScene(source).document;
 assert.equal(doc.schemaVersion,19,'Two real interfaces are already reviewed v19, not new public v27');
 assert.equal(doc.physics.model,'native-parallel-planar-tracing');
 const compiled=core.compile(doc),raw=structuredClone(compiled.native),ids=compiled.idMap;
 assert.deepEqual(raw.objs.map(x=>x.type),['Beam','PlaneGlass','PlaneGlass','Detector']);
 if(c.firstFresnel===true)raw.objs[ids.get('I1')].partialReflect=true;
 if(c.mirror!==false){
  const gap=c.gapMm??30;
  const x=f.slab.second.x+shift.x+gap,y=f.mirror.y+shift.y;
  const half=f.mirror.length/2;
  raw.objs.push({type:'Mirror',p1:{x,y:-(y-half)},p2:{x,y:-(y+half)},filter:false});
 }
 raw.rayModeDensity=c.rayDensity??f.density;
 raw.maxRayDepth=c.maxRayDepth??f.maxRayDepth;
 return {doc,source,raw,ids,shift,material,direction,
  mirrorGapMm:c.gapMm??30,
  processedRayLimit:c.processedRayLimit??f.processedRayLimit};
}
function execute(c){
 const a=fixture(c),input=save(c.id+'.input.json',a.raw);
 const scene=core.loadNative(a.raw),emitted=[],events=[];
 const source=scene.objs[a.ids.get('B')],start=source.onSimulationStart;
 let overflow=false;
 source.onSimulationStart=function(...args){
  const result=start.apply(this,args);
  for(const ray of result?.newRays??[]){
   if(emitted.length>=200){overflow=true;continue;}
   emitted.push({point:mm(ray.p1),direction:vec(ray),relativeBrightness:power(ray)});
  }
  return result;
 };
 const handles=[['I1',a.ids.get('I1')],['I2',a.ids.get('I2')],['D',a.ids.get('D')]];
 if(c.mirror!==false)handles.push(['M',a.raw.objs.length-1]);
 for(const [id,index] of handles){
  const obj=scene.objs[index],method=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const incoming=vec(args[0]),point=mm(args[2]);
   const response=method.apply(this,args),outgoing=response?.isAbsorbed?null:vec(args[0]);
   if(events.length>=5000){overflow=true;return response;}
   events.push({id,point,incoming,outgoing,relativePower:power(args[0]),
    absorbed:response?.isAbsorbed===true,
    undefined:response?.isUndefinedBehavior===true,
    truncated:response?.isTruncation===true,
    childCount:response?.newRays?.length??0});
   return response;
  };
 }
 const simulator=new core.Simulator(scene,null,null,null,null,null,false,a.processedRayLimit);
 let terminal=null,error=null;
 try{
  simulator.on('simulationComplete',()=>{terminal='simulationComplete';});
  simulator.on('simulationStop',()=>{terminal='simulationStop';});
  simulator.updateSimulation();
 }catch(e){error=String(e?.stack??e)}
 const diagnostics=core.diagnostics(scene,simulator,null,null,null,null,null,{nativeEvent:terminal});
 const status=error?'failed':core.classifyRun(terminal,diagnostics);
 const completed=status==='completed'&&terminal==='simulationComplete'&&
  diagnostics.truncation===0&&diagnostics.undefinedBehavior===0&&
  diagnostics.errors.length===0&&!error&&!overflow;
 const count=id=>events.filter(e=>e.id===id).length;
 const researchOnly=c.gapMm===0||c.gapMm===.005||c.firstFresnel===true||
  c.maxRayDepth===0||c.processedRayLimit===1;
 const result={format:'opticsim-v27-two-plane-mirror-raw-research-v1',
  caseId:c.id,control:c,
  frozenPhysicalSeedHasNoMirror:true,canonicalVersion:19,
  originalJeeQuestionSolved:false,sourceApparatusSynthetic:true,
  publicQualificationGranted:false,nativeImageDetected:false,
  inputSha256:input.sha256,
  native:{status,terminal,completed,overflow,error,
   truncation:diagnostics.truncation,undefinedBehavior:diagnostics.undefinedBehavior,
   errors:diagnostics.errors,warningCount:diagnostics.warnings?.length??0,
   emittedCount:emitted.length,I1:count('I1'),I2:count('I2'),mirror:count('M'),detector:count('D'),
   conservativelyUnqualified:researchOnly},
  emitted,events
 };
 const archive=save(c.id+'.report.json',result);
 console.log('NATIVE_TWO_PLANE_MIRROR_V27_RAW '+JSON.stringify({
  caseId:c.id,status,complete:completed,emitted:emitted.length,
  I1:result.native.I1,I2:result.native.I2,
  mirror:result.native.mirror,detector:result.native.detector,
  truncation:diagnostics.truncation,undefined:diagnostics.undefinedBehavior,
  unqualified:researchOnly
 }));
 return {result,input,archive};
}
test('source and research limits were frozen before executing native two-plane return experiments',()=>{
 assert.equal(freeze.status,'frozen-before-native-execution');
 assert.equal(freeze.baselineMain,'4f81a1625cc45ce731d3ee0e286ff3173f72f4fe');
 assert.equal(freeze.pinnedPhyDemo,'811f508d2b070898c241a568b0c167dcb8645251');
 assert.equal(freeze.frozenCases.length,11);
 assert.equal(freeze.motivation.JEEAnchor.includes('touching mirror'),true);
 assert.equal(freeze.independentGeometry.expectedNativeEmission,8);
});
test('real pinned Beam+two PlaneGlass+Mirror raw feasibility: correct sampled events and qualified refusals',()=>{
 const runs=freeze.frozenCases.map(execute),find=id=>runs.find(x=>x.result.caseId===id).result;
 assert.equal(runs.length,11);
 for(const id of ['baseline-air-gap','translated-gap','normal-incidence','higher-slab-index','denser-source']){
  const r=find(id),expected=id==='denser-source'?16:8;
  assert.equal(r.native.completed,true,JSON.stringify({id,native:r.native}));
  assert.equal(r.native.overflow,false);
  assert.equal(r.native.emittedCount,expected);
  assert.equal(r.native.I1,expected*2);
  assert.equal(r.native.I2,expected*2);
  assert.equal(r.native.mirror,expected);
  assert.equal(r.native.detector,expected*2);
  assert.equal(r.publicQualificationGranted,false);
  assert.equal(r.nativeImageDetected,false);
 }
 const no=find('mirror-absent');
 assert.equal(no.native.completed,true);
 assert.equal(no.native.mirror,0);
 assert.equal(no.native.I1,8);
 assert.equal(no.native.I2,8);
 assert.equal(no.native.detector,8);
 for(const id of ['coincident-mirror-contact','near-coincident-mirror','fresnel-on-first-raw']){
  assert.equal(find(id).native.conservativelyUnqualified,true);
  assert.equal(find(id).publicQualificationGranted,false);
 }
 const depth=find('max-depth-zero');
 assert.equal(depth.native.completed,false);
 assert.ok(depth.native.truncation>0);
 const stop=find('processed-limit-one');
 assert.equal(stop.native.completed,false);
 assert.equal(stop.native.terminal,'simulationStop');
 const base=find('baseline-air-gap');
 const m=base.events.filter(x=>x.id==='M');
 assert.equal(m.length,8);
 for(const ray of m){
  assert.ok(ray.incoming&&ray.outgoing);
  near(ray.incoming.x,-ray.outgoing.x,1e-10);
  near(ray.incoming.y,ray.outgoing.y,1e-10);
  near(ray.point.x,90,1e-7);
 }
 const report={format:'opticsim-native-two-plane-mirror-v27-research-summary-v1',
  frozenProtocolCommit:'e3f18c39bc83cae77d86d8c2e672c2411442627b',
  frozenProtocolSha256:digest(bytes),
  publicRelease:false,nativePin:freeze.pinnedPhyDemo,
  planned:11,attempted:runs.length,
  fullNativeComplete:runs.filter(x=>x.result.native.completed).length,
  rawResearchUnqualified:runs.filter(x=>x.result.native.conservativelyUnqualified).length,
  cases:runs.map(x=>({
   id:x.result.caseId,status:x.result.native.status,
   counts:{emitted:x.result.native.emittedCount,I1:x.result.native.I1,
    I2:x.result.native.I2,mirror:x.result.native.mirror,
    detector:x.result.native.detector},
   input:x.input,report:x.archive
  }))
 };
 save('report.json',report);
});
