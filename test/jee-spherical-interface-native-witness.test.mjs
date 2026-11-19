// RESEARCH ONLY. Real pinned PhyDemo propagation, NOT new canonical admission.
// Entry fixture: a true circular Glass arc, explicitly retained remote closure,
// two passive detectors inside the medium, and a genuine absorbing Blocker.
// Exit fixture: an inside SingleRay exits a complete CircleGlass exactly once.
// No ray is steered, manually cut off, or exported as a qualified public scene.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {analyzeSphericalInterface,SPHERICAL_INTERFACE_QUERY_FORMAT}
 from '../src/spherical-interface-paraxial-query.js';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const PIN='811f508d2b070898c241a568b0c167dcb8645251';
const RAD=Math.PI/180;
const near=(a,b,tol=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<=tol,`${a} != ${b} (tolerance ${tol})`);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const vector=ray=>{const x=ray.p2.x-ray.p1.x,y=ray.p1.y-ray.p2.y;
 const len=Math.hypot(x,y);return {x:x/len,y:y/len};};
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const parent=resolve('test-artifacts/llm-authoring');
mkdirSync(parent,{recursive:true});
const output=mkdtempSync(resolve(parent,'spherical-native-witness-v1-'));
let archived=0;
function archive(label,payload){
 const dir=resolve(output,String(++archived).padStart(3,'0')+'-'+label);
 mkdirSync(dir);
 writeFileSync(resolve(dir,'raw-native-input.json'),payload.inputBytes);
 const {inputBytes,...rest}=payload;
 writeFileSync(resolve(dir,'research-report.json'),JSON.stringify({
  format:'opticsim-single-surface-native-witness-research-v1',
  researchOnly:true,canonicalAuthoringAvailable:false,
  originalProblemSolved:false,nativeImageDetected:false,
  upstreamCommit:PIN,rawNativeInputSha256:hash(inputBytes),...rest
 },null,2)+'\n');
}
function fixture({kind='entry',height=1,angleDeg=0,radius=100,n1=1,n2=4/3,
 sourceX=null,sourceY=null,closureX=600,stopX=60,blocker=true,
 partialReflection=false,maxRayDepth=8,reverse=false,shiftX=0,shiftY=0}={}){
 assert.ok(['entry','exit'].includes(kind));
 const sx=sourceX??(kind==='entry'?-60:-100);
 const sy=sourceY??(kind==='entry'?height:0);
 const source={type:'SingleRay',p1:{x:sx,y:-sy},
  p2:{x:sx+20*Math.cos(angleDeg*RAD),y:-sy-20*Math.sin(angleDeg*RAD)},brightness:1};
 const optic=kind==='entry'?{type:'Glass',refIndex:n2/n1,partialReflect:partialReflection,
  notDone:false,path:[
   {x:radius,y:-radius,arc:false},{x:0,y:0,arc:true},
   {x:radius,y:radius,arc:false},{x:closureX,y:radius,arc:false},
   {x:closureX,y:-radius,arc:false}]}:
  {type:'CircleGlass',p1:{x:-radius,y:0},p2:{x:0,y:0},
   refIndex:n1/n2,partialReflect:partialReflection};
 const objects=[source,optic,
  {type:'Detector',p1:{x:20,y:-80},p2:{x:20,y:80},irradMap:false},
  {type:'Detector',p1:{x:40,y:-80},p2:{x:40,y:80},irradMap:false},
  ...(blocker?[{type:'Blocker',p1:{x:stopX,y:-80},p2:{x:stopX,y:80},filter:false}]:[])];
 const sign=reverse?-1:1;
 const transform=p=>({...p,x:sign*p.x+shiftX,y:p.y-shiftY});
 for(const obj of objects){
  for(const key of ['p1','p2'])if(obj[key])obj[key]=transform(obj[key]);
  if(obj.path)obj.path=obj.path.map(transform);
 }
 return {native:{version:5,name:'RESEARCH: one observed curved crossing; no canonical scope',
  width:1200,height:700,scale:1,origin:{x:500,y:350},mode:'rays',
  rayModeDensity:.2,maxRayDepth,lengthScale:1,simulateColors:false,
  colorMode:'default',objs:objects},
  spec:{kind,height,angleDeg,radius,n1,n2,sourceX:sx,sourceY:sy,
   closureX:kind==='entry'?closureX:null,stopX,blocker,partialReflection,maxRayDepth,
   reverse,shiftX,shiftY}};
}
function localPoint(p,s){return {x:(p.x-s.shiftX)*(s.reverse?-1:1),y:p.y-s.shiftY};}
function localVector(v,s){return {x:v.x*(s.reverse?-1:1),y:v.y};}
function execute(f,{processedRayLimit=10000}={}){
 const inputBytes=JSON.stringify(f.native,null,2)+'\n';
 const scene=core.loadNative(f.native),events=[],emissions=[];
 const source=scene.objs[0],start=source.onSimulationStart;
 let starts=0;
 source.onSimulationStart=function(...args){
  const r=start.apply(this,args);starts++;
  for(const ray of r?.newRays??[])emissions.push({
   pointMm:{x:ray.p1.x,y:-ray.p1.y},direction:vector(ray)});
  return r;
 };
 for(let index=1;index<scene.objs.length;index++){
  const obj=scene.objs[index],fn=obj.onRayIncident;
  obj.onRayIncident=function(...args){
   const before=vector(args[0]),pointMm={x:args[2].x,y:-args[2].y};
   const result=fn.apply(this,args); // Delegate the actual native callback ONCE.
   assert.ok(events.length<128,'Research capture overflow must fail, never clip');
   events.push({objectIndex:index,nativeType:obj.constructor.type,pointMm,before,
    after:result?.isAbsorbed?null:vector(args[0]),
    absorbed:result?.isAbsorbed===true,secondaryRays:(result?.newRays??[]).length});
   return result;
  };
 }
 const sim=new core.Simulator(scene,null,null,null,null,null,false,processedRayLimit);
 let terminal=null;
 for(const type of ['simulationComplete','simulationStop'])sim.on(type,()=>{terminal=type;});
 sim.updateSimulation();
 const diagnostics=core.diagnostics(scene,sim,null,null,null,null,null,{nativeEvent:terminal});
 const status=core.classifyRun(terminal,diagnostics);
 assert.equal(starts,1);assert.equal(JSON.stringify(f.native,null,2)+'\n',inputBytes);
 const surface=events.filter(e=>e.objectIndex===1);
 const detectors=events.filter(e=>e.nativeType==='Detector');
 const absorptions=events.filter(e=>e.nativeType==='Blocker'&&e.absorbed);
 // This gate is deliberately narrower than native completion and is TEST ONLY.
 // Extra later crossings, Fresnel branches, missing screens or partial runs
 // cannot be described as a complete single-crossing transmission witness.
 const usable=status==='completed'&&diagnostics.errors.length===0&&
  diagnostics.warnings.length===0&&emissions.length===1&&surface.length===1&&
  detectors.length===2&&detectors[0].objectIndex===2&&detectors[1].objectIndex===3&&
  absorptions.length===1&&events.every(e=>e.secondaryRays===0)&&
  events.map(e=>e.objectIndex).join(',')==='1,2,3,4';
 let derived=null;
 if(usable){
  const a=localPoint(detectors[0].pointMm,f.spec),b=localPoint(detectors[1].pointMm,f.spec);
  const dy=b.y-a.y,dx=b.x-a.x;
  derived={method:'mathematical-axis-intercept-of-two-native-detector-points',
   nativeImageDetected:false,signedAxisInterceptMm:dy===0?null:a.x-a.y*dx/dy,
   axisInterceptStatus:dy===0?'not-identifiable':'conditional',
   detectorPointsMm:[a,b]};
 }
 const report={inputBytes,spec:f.spec,status,terminal,diagnostics,
  emissions,rawDiagnosticEvents:events,singleCrossingWitnessUsable:usable,derived};
 archive(f.spec.kind+'-'+status,report);
 return report;
}
function complete(r){
 assert.equal(r.status,'completed');assert.equal(r.terminal,'simulationComplete');
 assert.deepEqual(r.diagnostics.errors,[]);assert.deepEqual(r.diagnostics.warnings,[]);
 assert.equal(r.diagnostics.truncation,0);assert.equal(r.diagnostics.undefinedBehavior,0);
 assert.equal(r.singleCrossingWitnessUsable,true);
 assert.equal(r.rawDiagnosticEvents.length,4);
 const e=r.rawDiagnosticEvents[0],s=r.spec;
 const p=localPoint(e.pointMm,s),a=localVector(e.before,s),b=localVector(e.after,s);
 const centre=s.kind==='entry'?s.radius:-s.radius;
 const nx=p.x-centre,ny=p.y,len=Math.hypot(nx,ny),normal={x:nx/len,y:ny/len};
 near(len,s.radius,1e-7);
 assert.ok(s.kind==='entry'?dot(a,normal)<0:dot(a,normal)>0);
 assert.ok(dot(a,normal)*dot(b,normal)>0,'A transmission witness cannot be TIR');
 near(s.n1*cross(a,normal),s.n2*cross(b,normal),1e-10);
 for(const d of r.rawDiagnosticEvents.filter(x=>x.nativeType==='Detector')){
  const incoming=localVector(d.before,s);
  near(incoming.x,b.x,1e-10);near(incoming.y,b.y,1e-10);
 }
 return r.derived.signedAxisInterceptMm;
}
function query(n1,n2,R,u=null){return {format:SPHERICAL_INTERFACE_QUERY_FORMAT,
 kind:u===null?'surface-power':'real-object-conjugate',
 signConvention:'positive-along-incident-light',lengthUnit:'mm',
 incidentIndex:n1,transmittedIndex:n2,signedRadius:R,
 ...(u===null?{}:{signedObjectDistance:u})};}
function decreasing(errors){
 for(let i=1;i<errors.length;i++)assert.ok(errors[i]<errors[i-1]*.32,
  'Paraxial-limit discrepancy should fall quadratically here: '+JSON.stringify(errors));
}

test('native entry arc has exactly one material encounter, two detector hits and real absorption',()=>{
 const analytical=analyzeSphericalInterface(query(1,4/3,100));
 near(analytical.value.signedImageSpaceFocalDistanceMm,400);
 const series=[];
 for(const height of [8,4,2,1,.5]){
  const r=execute(fixture({height})),intercept=complete(r);
  assert.equal(r.rawDiagnosticEvents[0].nativeType,'Glass');
  series.push({heightMm:height,interceptMm:intercept,errorMm:Math.abs(intercept-400)});
 }
 decreasing(series.map(x=>x.errorMm));
 assert.ok(series.at(-1).errorMm<.002);
 assert.ok(series[0].errorMm>.1,'Finite-height exact refraction is not the paraxial result');
 assert.equal(analytical.native.status,'not-run');
 console.log('SPHERICAL_NATIVE_ENTRY '+JSON.stringify({series,analyticalNative:'not-run',
  measuredImage:false,evidenceDirectory:output}));
});
test('native inside-source circle exits once and converges to the curved virtual conjugate',()=>{
 const a=analyzeSphericalInterface(query(1.5,1,-150,-100));
 const target=-600/7;near(a.value.signedImageDistanceMm,target);
 const series=[];
 for(const angleDeg of [4,2,1,.5,.25]){
  const r=execute(fixture({kind:'exit',radius:150,n1:1.5,n2:1,angleDeg}));
  const intercept=complete(r);
  assert.equal(r.rawDiagnosticEvents[0].nativeType,'CircleGlass');
  series.push({angleDeg,interceptMm:intercept,errorMm:Math.abs(intercept-target)});
 }
 decreasing(series.map(x=>x.errorMm));assert.ok(series.at(-1).errorMm<.001);
 assert.ok(Math.abs(series.at(-1).interceptMm-(-100/1.5))>10);
 assert.equal(a.native.status,'not-run');
 console.log('SPHERICAL_NATIVE_EXIT '+JSON.stringify({series,analyticalNative:'not-run',
  exteriorIndexIsAddedAssumption:true,measuredImage:false}));
});
test('native signed-height, propagation reversal, translation and remote closure controls preserve local evidence',()=>{
 const ref=complete(execute(fixture({height:2})));
 for(const change of [{height:-2},{reverse:true},{shiftX:730,shiftY:-260},
  {closureX:1500},{stopX:80}]){
  const value=complete(execute(fixture({height:2,...change})));
  near(value,ref,1e-6);
 }
 const neg=execute(fixture({height:1,n1:1.5,n2:1}));
 const value=complete(neg),prediction=analyzeSphericalInterface(query(1.5,1,100));
 assert.ok(value<0);near(value,prediction.value.signedImageSpaceFocalDistanceMm,.02);
});
test('finite real-object native entry converges to the paraxial conjugate without authoring a focal hit',()=>{
 const a=analyzeSphericalInterface(query(1,1.5,100,-300));
 near(a.value.signedImageDistanceMm,900);
 const errors=[];
 for(const angleDeg of [.8,.4,.2,.1]){
  const r=execute(fixture({height:0,sourceX:-300,sourceY:0,angleDeg,n2:1.5}));
  errors.push(Math.abs(complete(r)-900));
 }
 decreasing(errors);assert.ok(errors.at(-1)<.1);
});
test('axial native ray has two genuine hits but does not locate an image',()=>{
 const r=execute(fixture({height:0}));complete(r);
 assert.equal(r.derived.axisInterceptStatus,'not-identifiable');
 assert.equal(r.derived.signedAxisInterceptMm,null);
});
test('extra boundary crossings and later screens cannot pass the single-crossing witness gate',()=>{
 for(const change of [{blocker:false},{stopX:700}]){
  const r=execute(fixture({height:1,...change}));
  assert.equal(r.status,'completed');
  assert.ok(r.rawDiagnosticEvents.filter(e=>e.objectIndex===1).length>=2);
  assert.equal(r.singleCrossingWitnessUsable,false);assert.equal(r.derived,null);
 }
});
test('depth exhaustion, stop, Fresnel and trapped TIR do not publish a single-surface comparison',()=>{
 const cases=[
  execute(fixture({maxRayDepth:0})),
  execute(fixture(),{processedRayLimit:1}),
  execute(fixture({partialReflection:true})),
  execute(fixture({kind:'exit',radius:150,n1:1.5,n2:1,sourceX:-150,sourceY:120}))
 ];
 for(const r of cases){
  assert.equal(r.singleCrossingWitnessUsable,false);assert.equal(r.derived,null);
 }
 assert.notEqual(cases[0].status,'completed');assert.notEqual(cases[1].status,'completed');
 assert.ok(cases[3].rawDiagnosticEvents.filter(e=>e.objectIndex===1).length>1);
});
test('existing public v7 inside-circle evidence remains qualified and rejects stale/incomplete reuse',async()=>{
 const request={lengthUnit:'mm',title:'Synthetic J16 meridional witness; explicit exterior n=1',
  runPolicy:'preview-v1',components:[
   {id:'S1',type:'point-source',parameters:{x:-100,y:0,brightness:1},
    emission:{mode:'single-ray',directionDeg:.5}},
   {id:'G1',type:'circular-dielectric',parameters:{x:-150,y:0,radius:150,
    insideIndex:1.5,outsideIndex:1,partialReflection:false}},
   {id:'D1',type:'ray-detector',parameters:{x:20,y:0,length:160,orientationDeg:90}},
   {id:'D2',type:'ray-detector',parameters:{x:40,y:0,length:160,orientationDeg:90}}]};
 const doc=prepareScene(request).document;
 assert.equal(doc.schemaVersion,7);assert.equal(doc.upstreamCommit,PIN);
 const asks=[{id:'event',kind:'interface-first-event',componentId:'G1'},
  {id:'h1',kind:'detector-hit-events',componentId:'D1'},
  {id:'h2',kind:'detector-hit-events',componentId:'D2'}];
 const summary=evaluateDocument(doc,core,asks).summary;
 assert.equal(summary.native.status,'completed');
 assert.equal(summary.observations.interfacesById.G1.interactions,1);
 const values=await evaluateObservables(doc,asks,summary);
 assert.ok(values.results.every(x=>x.status==='qualified'));
 assert.equal(values.results[0].value.from,'inside');
 const p=values.results[1].value[0].pointMm,q=values.results[2].value[0].pointMm;
 const intercept=p.x-p.y*(q.x-p.x)/(q.y-p.y);
 near(intercept,-600/7,.01);
 const changed=structuredClone(doc);changed.physics.components[1].parameters.insideIndex=1.6;
 const stale=await evaluateObservables(changed,asks,summary);
 assert.ok(stale.results.every(x=>x.status==='suppressed'&&x.value===null));
 const shallow=structuredClone(doc);shallow.simulation.maxRayDepth=0;
 const limited=evaluateDocument(shallow,core,asks).summary;
 const withheld=await evaluateObservables(shallow,asks,limited);
 assert.ok(withheld.results.every(x=>x.status==='suppressed'&&x.value===null));
 const dir=resolve(output,'public-v7');mkdirSync(dir);
 for(const [name,value] of Object.entries({request,document:doc,requests:asks,
  summary,measurements:values,stale,withheld}))
  writeFileSync(resolve(dir,name+'.json'),JSON.stringify(value,null,2)+'\n');
});
test('spherical-query unit enum does not accept arrays, boxed strings or coercion objects',()=>{
 for(const lengthUnit of [['cm'],['mm'],new String('cm'),{toString:()=> 'cm'},null,1,true]){
  assert.throws(()=>analyzeSphericalInterface({...query(1,4/3,100),lengthUnit}));
 }
});
test('native witness is additive research and keeps the pinned upstream unchanged',()=>{
 const pin=JSON.parse(readFileSync(new URL('../upstream-pin.json',import.meta.url)));
 assert.equal(pin.commit,PIN);
 assert.equal(analyzeSphericalInterface(query(1,4/3,100)).native.status,'not-run');
});
