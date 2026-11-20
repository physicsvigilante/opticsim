// J02 three-mirror enclosure: test-only PINNED PhyDemo finite Mirror rays.
// A finite native ray log is NEVER a complete formal-image enumeration nor
// proof of observer visibility. No public schema, ray steering or native edits.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const frozen=JSON.parse(readFileSync(new URL('../research/jee-j02-mirror-orbits-v1/frozen-protocol.json',import.meta.url),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const origin=frozen.mathematicalWitness.syntheticSourceInsideMm;
const vertices=frozen.mathematicalWitness.verticesYUp;
const root=resolve('test-artifacts/llm-authoring/jee-j02-mirror-native-v1');
mkdirSync(root,{recursive:true});
const dir=mkdtempSync(resolve(root,'attempt-'));
const save=(name,input)=>{
 const bytes=Buffer.from(typeof input==='string'?input:JSON.stringify(input,null,2)+'\n');
 writeFileSync(resolve(dir,name),bytes,{flag:'wx'});
 return {file:name,sha256:sha(bytes),length:bytes.length};
};
const vec=ray=>{
 const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,L=Math.hypot(dx,dy);
 return L>0&&Number.isFinite(L)?{x:dx/L,y:dy/L}:null;
};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const near=(x,y,tol=1e-7)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=tol,
 String(x)+' differs from '+String(y));
const transform=(p,{thetaDeg=0,shiftX=0,shiftY=0}={})=>{
 const t=thetaDeg*Math.PI/180,C=Math.cos(t),S=Math.sin(t);
 return {x:p.x*C-p.y*S+shiftX,y:p.x*S+p.y*C+shiftY};
};
const native=p=>({x:p.x,y:-p.y});
function fixture(c){
 const rotated=vertices.map(p=>transform(p,c));
 const src=transform(c.source||origin,c);
 const theta=(c.thetaDeg||0)+(c.launchDeg||17);
 const start=native(src),p2=native({
  x:src.x+20*Math.cos(theta*Math.PI/180),
  y:src.y+20*Math.sin(theta*Math.PI/180)
 });
 const mirrors=[[0,1],[1,2],[2,0]].map(([a,b])=>({
  type:'Mirror',p1:native(rotated[a]),p2:native(rotated[b]),filter:false
 }));
 return {v:rotated,source:src,native:{
  version:5,name:'TEST ONLY: finite three-mirror J02 enclosure; no image count',
  width:1300,height:900,scale:1,origin:{x:500,y:350},mode:'rays',
  rayModeDensity:.2,maxRayDepth:c.maxRayDepth??8,
  lengthScale:1,simulateColors:false,colorMode:'default',
  objs:[{type:'SingleRay',p1:start,p2,brightness:.08},...mirrors]
 }};
}
function execute(c){
 const {native:sceneInput,v,source}=fixture(c);
 const input=save(c.id+'.input.json',sceneInput);
 const scene=core.loadNative(sceneInput),events=[],emissions=[];
 assert.deepEqual(scene.objs.map(x=>x.constructor.type),
  ['SingleRay','Mirror','Mirror','Mirror']);
 const emitter=scene.objs[0],onStart=emitter.onSimulationStart;
 emitter.onSimulationStart=function(...args){
  const r=onStart.apply(this,args);
  for(const ray of r?.newRays||[])emissions.push({
   start:{x:ray.p1.x,y:-ray.p1.y},direction:vec(ray)
  });
  return r;
 };
 for(let i=1;i<4;i++){
  const mirror=scene.objs[i],original=mirror.onRayIncident;
  mirror.onRayIncident=function(...args){
   assert.ok(events.length<64,'Finite research callback overflow cannot masquerade as complete');
   const incoming=vec(args[0]),p={x:args[2].x,y:-args[2].y};
   const result=original.apply(this,args);
   const outgoing=result?.isAbsorbed?null:vec(args[0]);
   const t={x:v[(i-1+1)%3].x-v[i-1].x,y:v[(i-1+1)%3].y-v[i-1].y};
   const L=Math.hypot(t.x,t.y),unit={x:t.x/L,y:t.y/L};
   const residual=outgoing&&incoming?Math.hypot(
    outgoing.x-(2*dot(incoming,unit)*unit.x-incoming.x),
    outgoing.y-(2*dot(incoming,unit)*unit.y-incoming.y)):null;
   const dp={x:p.x-v[i-1].x,y:p.y-v[i-1].y},along=dot(dp,unit);
   events.push({mirrorId:['AB','BC','CA'][i-1],pointMm:p,
    incoming,outgoing,reflectedResidual:residual,
    actualSegmentDistanceMm:Math.abs(cross(dp,unit)),
    alongMm:along,segmentLengthMm:L,
    absorbed:result?.isAbsorbed===true,
    nativeUndefined:result?.isUndefinedBehavior===true,
    nativeTruncation:result?.isTruncation===true,
    childCount:result?.newRays?.length||0});
   return result;
  };
 }
 const simulator=new core.Simulator(scene,null,null,null,null,null,false,c.processedRayLimit??10000);
 let terminal=null;
 for(const kind of ['simulationComplete','simulationStop'])simulator.on(kind,()=>{terminal=kind;});
 simulator.updateSimulation();
 const diagnostics=core.diagnostics(scene,simulator,null,null,null,null,null,{nativeEvent:terminal});
 const classification=core.classifyRun(terminal,diagnostics);
 const complete=classification==='completed'&&terminal==='simulationComplete'&&
  diagnostics.errors.length===0&&diagnostics.truncation===0&&diagnostics.undefinedBehavior===0;
 const routeEventsSafe=events.every(e=>e.reflectedResidual!==null&&
  e.reflectedResidual<1e-7&&e.actualSegmentDistanceMm<1e-6&&
  e.alongMm>=-1e-6&&e.alongMm<=e.segmentLengthMm+1e-6);
 const report={
  format:'opticsim-jee-j02-mirror-native-research-v1',id:c.id,
  originalSourceNotSimulated:true,syntheticFiniteMirrorApparatus:true,
  inputSha256:input.sha256,nativePin:frozen.pinnedPhyDemo,source,
  native:{terminal,classification,complete,emitted:emissions.length,
   mirrorReflections:events.length,
   truncation:diagnostics.truncation,undefinedBehavior:diagnostics.undefinedBehavior,
   errors:diagnostics.errors,
   eventGeometrySafe:routeEventsSafe},
  emissions,events,
  formalImageCountMeasured:false,observerVisibilityCertified:false,
  qualifiedJeeImageCount:false
 };
 const saved=save(c.id+'.report.json',report);
 console.log('JEE_J02_MIRROR_NATIVE '+JSON.stringify({id:c.id,
  status:classification,complete,emitted:emissions.length,
  reflections:events.length,seq:events.map(e=>e.mirrorId),
  truncation:diagnostics.truncation,undefined:diagnostics.undefinedBehavior,
  physicalImageCountNotMeasured:true}));
 return {report,input,saved};
}
test('J02 native research preserves frozen full three-mirror physical restrictions',()=>{
 assert.equal(frozen.status,'pre-execution-frozen-research');
 assert.equal(frozen.originalSource.solutionsRead,false);
 assert.equal(frozen.nativeStudy.noNewNativeSchema,true);
 assert.equal(frozen.nativeStudy.noSolverOrRayEditing,true);
 assert.equal(frozen.originalSource.notStated.includes('Maximum number of reflections or source emission/sampling'),true);
});
test('the original finite three-Mirror PhyDemo callbacks are recorded, not converted into an image count',()=>{
 const trials=[
  {id:'finite-eight-depth',maxRayDepth:8},
  {id:'finite-three-depth',maxRayDepth:3},
  {id:'finite-zero-depth',maxRayDepth:0},
  {id:'translated',maxRayDepth:8,shiftX:200,shiftY:-100},
  {id:'rotated',maxRayDepth:8,thetaDeg:37}
 ];
 const results=trials.map(execute);
 assert.equal(results.length,5);
 for(const r of results){
  assert.equal(r.report.native.emitted,1);
  assert.ok(r.report.native.mirrorReflections>=0);
  assert.equal(r.report.formalImageCountMeasured,false);
  assert.equal(r.report.observerVisibilityCertified,false);
  assert.equal(r.report.qualifiedJeeImageCount,false);
  assert.equal(r.report.native.eventGeometrySafe,true);
  assert.ok(r.input.sha256&&r.saved.sha256);
 }
 const full=results[0].report;
 assert.ok(full.native.mirrorReflections>0,
  'A real native source inside a finite three-mirror triangle must reach at least one mirror');
 assert.equal(results[2].report.native.complete,false,
  'A zero-depth native simulation cannot be called a complete physical image observation');
 const aggregate={
  format:'opticsim-jee-j02-native-evidence-v1',
  frozenProtocolCommit:'1247be259b50f6654e4af1aff138de713966e3fe',
  frozenProtocolSha256:sha(readFileSync(new URL('../research/jee-j02-mirror-orbits-v1/frozen-protocol.json',import.meta.url))),
  allOriginalJeeImagesCertified:false,
  cases:results.map(r=>({id:r.report.id,
   native:r.report.native,input:r.input,report:r.saved})),
  counts:{planned:5,attempted:results.length,finiteNativeCallbacks:results.reduce((x,r)=>x+r.report.native.mirrorReflections,0)}
 };
 save('report.json',aggregate);
});
