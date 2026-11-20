// J11 TWO-DIMENSIONAL native Snell/TIR research witnesses only.
// PhyDemo has no 3D disc/observer here. Actual native PlaneGlass callbacks
// are neither routed nor promoted into a 3D all-direction visibility theorem.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {analyzeEscapeDisc} from '../src/axisymmetric-escape-disc.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const freeze=JSON.parse(readFileSync(new URL('../evaluation/jee-j11-escape-disc-v1/frozen-protocol.json',import.meta.url),'utf8'));
const example=JSON.parse(readFileSync(new URL('../examples/jee-j11-escape-disc-synthetic-numeric-v1.json',import.meta.url),'utf8'));
const R=Math.PI/180,DEG=180/Math.PI;
const critical=Math.asin(2/3)*DEG;
const near=(x,y,tol=1e-7)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=tol,
 String(x)+' not near '+String(y)+' within '+String(tol));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=resolve('test-artifacts/llm-authoring/jee-j11-native-meridional-v1');
mkdirSync(root,{recursive:true});
const dir=mkdtempSync(resolve(root,'attempt-'));
function save(name,value){
 const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
 writeFileSync(resolve(dir,name),bytes,{flag:'wx'});
 return {name,sha256:hash(bytes),size:bytes.length};
}
function vec(ray){
 const x=ray.p2.x-ray.p1.x,y=ray.p1.y-ray.p2.y,L=Math.hypot(x,y);
 return Number.isFinite(L)&&L>0?{x:x/L,y:y/L}:null;
}
const dot=(a,b)=>a.x*b.x+a.y*b.y;
function fixture(c){
 const h=c.depthMm??100,shiftX=c.shiftX??0,shiftY=c.shiftY??0;
 const angleDeg=c.angleDeg??0, insideIndex=c.insideIndex??1.5,
  outsideIndex=c.outsideIndex??1;
 const p={lengthUnit:'mm',runPolicy:'preview-v1',title:'J11 two-dimensional meridional native cross-section only',
  components:[
   {id:'S',type:'point-source',
    parameters:{x:shiftX,y:shiftY-h,brightness:.08},
    emission:{mode:'single-ray',directionDeg:90-angleDeg}},
   {id:'I',type:'planar-interface',parameters:{
    x:shiftX,y:shiftY,normalDeg:90,
    negativeIndex:insideIndex,positiveIndex:outsideIndex,
    partialReflection:false}}
  ]};
 const doc=prepareScene(p).document;
 assert.equal(doc.schemaVersion,5);
 if(c.depthLimit!==undefined)doc.simulation.maxRayDepth=c.depthLimit;
 if(c.processedLimit!==undefined)doc.simulation.processedRayLimit=c.processedLimit;
 return {doc,p,h,angleDeg,shiftX,shiftY,insideIndex,outsideIndex};
}
function execute(c){
 const f=fixture(c),input=save(c.id+'.input.json',JSON.stringify(f.doc,null,2)+'\n');
 const {scene,idMap}=core.loadDocument(f.doc),events=[];
 const emissions=core.observeSourceSet(f.doc,scene,idMap);
 const interfaces=core.observeInterfaceSet(f.doc,scene,idMap);
 const glass=scene.objs[idMap.get('I')],onIncident=glass.onRayIncident;
 glass.onRayIncident=function(...args){
  if(events.length>=16)throw Error('Research native callback bound exceeded; cannot silently clip');
  const before=vec(args[0]),point={x:args[2].x,y:-args[2].y},
   result=onIncident.apply(this,args),
   after=result?.isAbsorbed?null:vec(args[0]);
  events.push({point,before,after,absorbed:result?.isAbsorbed===true,
   undefined:result?.isUndefinedBehavior===true,
   children:result?.newRays?.length??0});
  return result;
 };
 const simulator=new core.Simulator(scene,null,null,null,null,null,false,
  f.doc.simulation.processedRayLimit);
 let terminal=null;
 for(const event of ['simulationComplete','simulationStop'])simulator.on(event,()=>{terminal=event;});
 simulator.updateSimulation();
 const diagnostics=core.diagnostics(scene,simulator,emissions,null,null,interfaces,{nativeEvent:terminal});
 const nativeStatus=core.classifyRun(terminal,diagnostics);
 const actualMeter=interfaces.byId.I,actual=actualMeter.first;
 const criticalSineDistance=Math.abs(f.insideIndex*Math.sin(Math.abs(f.angleDeg)*R)-f.outsideIndex);
 const nearCritical=criticalSineDistance<=freeze.admissionPolicy.criticalSineGuardForNative;
 const expectedX=f.shiftX+f.h*Math.tan(f.angleDeg*R);
 const measured=events[0]?.point??null;
 const actualGeometricHit=measured!==null&&
  Math.abs(measured.x-expectedX)<1e-6&&Math.abs(measured.y-f.shiftY)<1e-6;
 const safeNative=terminal==='simulationComplete'&&nativeStatus==='completed'&&
  diagnostics.truncation===0&&diagnostics.undefinedBehavior===0&&
  diagnostics.errors.length===0&&events.length===1&&actualGeometricHit&&
  !nearCritical;
 const witness=safeNative?actual?.outcome:null;
 const report={format:'opticsim-jee-j11-meridional-native-witness-v1',
  id:c.id,control:c,sourceIsSynthetic:true,originalJeeSolved:false,
  physicallySimulated3DDisc:false,threeDimensionalVisibilityCertified:false,
  nativePin:freeze.pinnedNative,inputSha256:input.sha256,
  native:{terminal,status:nativeStatus,complete:safeNative,
   criticalSineDistance,nearCritical,actualGeometricHit,
   firstActualOutcome:actual?.outcome??null,
   firstActualIncidentAngleDeg:actual?.incidentAngleDeg??null,
   firstActualTransmittedAngleDeg:actual?.transmittedAngleDeg??null,
   boundedSafeMeridionalWitness:witness,
   truncation:diagnostics.truncation,
   undefinedBehavior:diagnostics.undefinedBehavior,
   errors:diagnostics.errors},
  physical: f.p,events};
 const archived=save(c.id+'.report.json',report);
 console.log('JEE_J11_MERIDIONAL_NATIVE '+JSON.stringify({id:c.id,status:nativeStatus,
  outcome:actual?.outcome??null,safeWitness:witness,
  interfaceHit:measured,nearCritical,
  truncation:diagnostics.truncation,visibility3DNotCertified:true}));
 return {...report,input,archived};
}
test('frozen J11 source is symbolic and the pinned native probe stays strictly 2D',()=>{
 assert.equal(freeze.status,'pre-implementation-frozen-protocol');
 assert.equal(freeze.source.frozenCase,'J11');
 assert.equal(freeze.source.sourceAnswersOrSolutionsRead,false);
 assert.equal(freeze.native.partialReflection,false);
 assert.equal(freeze.native.syntheticDepthMm,100);
 assert.equal(freeze.geometry.rotationalSymmetry.includes('not 3D validation'),true);
 assert.equal(analyzeEscapeDisc(example).native.native3DVisibilityCertified,false);
 near(critical,Math.asin(1/1.5)*DEG);
});
test('actual pinned SingleRay/PlaneGlass below, at and above critical remain proper meridional evidence only',()=>{
 const samples=[
  {id:'normal',angleDeg:0},
  {id:'below15',angleDeg:15},
  {id:'below30',angleDeg:30},
  {id:'below41',angleDeg:41},
  {id:'near-below',angleDeg:critical-1e-4},
  {id:'critical',angleDeg:critical},
  {id:'near-above',angleDeg:critical+1e-4},
  {id:'above50',angleDeg:50},
  {id:'reverse-azimuth-cross-section',angleDeg:-30},
  {id:'translated',angleDeg:30,shiftX:200,shiftY:-75},
  {id:'depth-zero',angleDeg:30,depthLimit:0},
  {id:'processed-stop',angleDeg:30,processedLimit:1}
 ];
 const results=samples.map(execute);
 assert.equal(results.length,12);
 const get=id=>results.find(x=>x.id===id);
 for(const id of ['normal','below15','below30','below41','near-below','reverse-azimuth-cross-section','translated']){
  const r=get(id);
  assert.equal(r.native.status,'completed',id);
  assert.equal(r.native.boundedSafeMeridionalWitness,'transmission',id);
  assert.equal(r.events.length,1,id);
  near(r.events[0].point.y,r.physical.components[1].parameters.y,1e-7);
  const e=Math.abs(r.control.angleDeg)*R;
  const n0=1,n1=1.5;
  near(r.native.firstActualIncidentAngleDeg,Math.abs(r.control.angleDeg),1e-7);
  near(r.native.firstActualTransmittedAngleDeg,
   Math.asin(n1*Math.sin(e)/n0)*DEG,1e-6);
 }
 for(const id of ['near-above','above50']){
  const r=get(id);
  assert.equal(r.native.status,'completed',id);
  assert.equal(r.native.boundedSafeMeridionalWitness,'total-internal-reflection',id);
  assert.equal(r.native.firstActualTransmittedAngleDeg,null);
 }
 const edge=get('critical');
 assert.equal(edge.native.nearCritical,true);
 assert.equal(edge.native.boundedSafeMeridionalWitness,null);
 assert.equal(edge.threeDimensionalVisibilityCertified,false);
 assert.equal(get('depth-zero').native.complete,false);
 assert.notEqual(get('depth-zero').native.status,'completed');
 assert.equal(get('processed-stop').native.complete,false);
 assert.notEqual(get('processed-stop').native.status,'completed');
 for(const r of results){
  assert.equal(r.physicallySimulated3DDisc,false);
  assert.equal(r.originalJeeSolved,false);
  assert.ok(r.input.sha256&&r.archived.sha256);
 }
 const aggregate={format:'opticsim-jee-j11-meridional-native-evidence-v1',
  frozenProtocolCommit:'bbb40ee6be4d62f910e9e3eefab3d198cd3d4873',
  all3DVisibilityCertifications:false,
  attempts:results.map(x=>({id:x.id,native:x.native,
   input:x.input,report:x.archived})),
  counts:{planned:12,attempted:results.length,
   safeTransmissions:results.filter(x=>x.native.boundedSafeMeridionalWitness==='transmission').length,
   safeTIR:results.filter(x=>x.native.boundedSafeMeridionalWitness==='total-internal-reflection').length,
   withheld:results.filter(x=>!x.native.boundedSafeMeridionalWitness).length}};
 save('report.json',aggregate);
});
