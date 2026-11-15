// Disposable native identity boundary study. No production API, no optics reimplementation.
// Every tagged ray must originate in an observed PhyDemo emission or real newRays return.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../../src/authoring.js';
import {serializeSave,validate} from '../../src/contract.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const OUTPUT=resolve(ROOT,'test-artifacts/llm-authoring/native-lineage-boundaries-v1');
const core=createRequire(import.meta.url)(resolve(ROOT,'dist/test-core.cjs'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const mm=(x,y)=>({x,y});
const source=(id,x,y,directionDeg,brightness=1)=>({
  id,type:'point-source',parameters:{x,y,brightness},
  emission:{mode:'single-ray',directionDeg}
});
const face=(id,x,y,normalDeg,negativeIndex,positiveIndex,partialReflection=true)=>({
  id,type:'planar-interface',parameters:{x,y,normalDeg,negativeIndex,positiveIndex,partialReflection}
});
const detector=(id,x,y,orientationDeg,length)=>({
  id,type:'ray-detector',parameters:{x,y,orientationDeg,length}
});
const asDoc=components=>prepareScene({
  lengthUnit:'mm',title:'Explicit synthetic native-ray identity test',
  runPolicy:'preview-v1',components
}).document;
const mirror=()=>asDoc([
  {id:'S1',type:'point-source',parameters:{x:100,y:0,brightness:.08},
    emission:{mode:'directional',directionDeg:10,angleDeg:2}},
  {id:'M1',type:'plane-mirror',parameters:{x:0,y:0,orientationDeg:90,length:600}},
  {id:'M2',type:'plane-mirror',parameters:{x:400,y:0,orientationDeg:90,length:600}}
]);
const fresnel=(two=true,brightness=1)=>asDoc([
  source('SunRay',-100,100,-45,brightness),
  ...(two?[source('SunRay2',-150,100,-45,brightness)]:[]),
  face('AirWater',0,0,90,4/3,1),
  detector('LakeBottomDetector',50,-100,0,400),
  detector('ReflectedDetector',200,200,0,500)
]);
const critical=incidence=>asDoc([
  source('FromWater',-100,-100,90-incidence,1),
  face('Surface',0,0,90,4/3,1),
  detector('AirDetector',300,200,0,2400),
  detector('WaterDetector',300,-200,0,2400)
]);
const slab=()=>{
  const original=JSON.parse(readFileSync(resolve(ROOT,'evaluation/planar-refraction-v1/first-request.json')));
  const r=structuredClone(original.request);
  const second=structuredClone(r.components.find(c=>c.id==='I1'));
  second.id='I2'; second.parameters.x=10;
  second.parameters.negativeIndex=1.5; second.parameters.positiveIndex=1.33;
  r.components.push(second);
  return prepareScene(r).document;
};
const dense=()=>{
  const doc=JSON.parse(readFileSync(resolve(ROOT,'scenes/general-source-detector.json')));
  doc.simulation.rayDensity=1;
  const s=doc.physics.components.find(c=>c.id==='S1');
  s.parameters.brightness=.5;
  const second=structuredClone(s);
  second.id='S2';second.parameters.y=50;second.parameters.brightness=.25;
  doc.physics.components.push(second);
  validate(doc);return doc;
};
const direction=ray=>{
  if(!ray?.p1||!ray?.p2)return null;
  const dx=ray.p2.x-ray.p1.x,dy=-(ray.p2.y-ray.p1.y),m=Math.hypot(dx,dy);
  return m>0&&Number.isFinite(m)?mm(dx/m,dy/m):null;
};

// Observation is strictly per loaded scene instance. No native prototype mutation.
// Missing a source callback is an explicit negative-control fault injection.
function nativeRun(doc,{instrument=true,omitSourceId=null}={}){
  const {scene,idMap}=core.loadDocument(doc);
  const seen=new WeakMap(),emissions=[],events=[],byId={};
  let token=0,emittedCount=0,incidentCount=0,unknown=0,duplicate=0;
  let eventOverflow=0,emissionOverflow=0;
  const captureLimit=192;
  if(instrument){
    for(const c of doc.physics.components.filter(c=>c.type==='point-source'&&c.id!==omitSourceId)){
      const native=scene.objs[idMap.get(c.id)],fn=native.onSimulationStart;
      native.onSimulationStart=function(...args){
        const result=fn.apply(this,args);
        for(const ray of result?.newRays??[]){
          emittedCount++;
          if(seen.has(ray))duplicate++;
          else{
            const identity={token:++token,sourceId:c.id,parentToken:null};
            seen.set(ray,identity);
            if(emissions.length<captureLimit)emissions.push({...identity,direction:direction(ray)});
            else emissionOverflow++;
          }
        }
        return result;
      };
    }
    for(const c of doc.physics.components.filter(c=>c.type!=='point-source')){
      const native=scene.objs[idMap.get(c.id)],fn=native.onRayIncident;
      native.onRayIncident=function(...args){
        incidentCount++;byId[c.id]=(byId[c.id]??0)+1;
        const ray=args[0],parent=seen.get(ray),incoming=direction(ray);
        if(!parent)unknown++;
        const result=fn.apply(this,args); // Delegate real physics exactly once.
        const children=[];
        for(const child of result?.newRays??[]){
          if(seen.has(child)){
            duplicate++;
            children.push({duplicate:true});
          }else{
            const identity={token:++token,sourceId:parent?.sourceId??null,
              parentToken:parent?.token??null};
            seen.set(child,identity);
            children.push({...identity,direction:direction(child)});
          }
        }
        if(events.length<captureLimit)events.push({
          componentId:c.id,type:c.type,rayIndex:args[1],
          token:parent?.token??null,sourceId:parent?.sourceId??null,
          incoming,primaryAfter:direction(ray),children,
          nativeReturn:result===undefined?'undefined':result===null?'null':'object',
          absorbed:result?.isAbsorbed===true,
          undefinedBehavior:result?.isUndefinedBehavior===true
        });
        else eventOverflow++;
        return result;
      };
    }
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let event=null;
  for(const kind of ['simulationComplete','simulationStop'])sim.on(kind,()=>{event=kind;});
  sim.updateSimulation();
  return {event,processed:sim.processedRayCount,truncation:sim.totalTruncation,
    undefinedBehavior:sim.totalUndefinedBehavior,sceneError:scene.error??null,
    simulatorError:sim.error??null,nativeWarning:sim.warning??null,
    observed:{emittedCount,emissions,incidentCount,events,byId,unknown,duplicate,
      eventOverflow,emissionOverflow,omittedSourceObserver:omitSourceId}};
}
function qualify(record){
  const b=record.baseline,n=record.observedNative,o=n.observed;
  const reasons=[];
  if(n.event!=='simulationComplete')reasons.push('NATIVE_DID_NOT_COMPLETE');
  if(n.truncation!==0)reasons.push('NATIVE_TRUNCATION');
  if(n.undefinedBehavior!==0)reasons.push('NATIVE_UNDEFINED_BEHAVIOR');
  if(n.sceneError||n.simulatorError)reasons.push('NATIVE_ERROR');
  if(b.native.status!=='completed'||!b.executionPassed)reasons.push('OFFICIAL_NATIVE_NOT_CLEAN');
  if(b.native.warnings?.length)reasons.push('NATIVE_WARNINGS');
  if(o.unknown>0)reasons.push('UNOBSERVED_PRIMARY_OR_PARENT');
  if(o.duplicate>0)reasons.push('DUPLICATE_RAY_OBJECT');
  if(o.eventOverflow>0||o.emissionOverflow>0)reasons.push('TEST_EVENT_BUFFER_OVERFLOW');
  if(o.omittedSourceObserver)reasons.push('SOURCE_CALLBACK_INTENTIONALLY_OMITTED');
  return {decision:reasons.length?'withheld':'bounded-observed-in-this-test',reasons};
}
function study(doc,label,options={}){
  validate(doc);
  const original=serializeSave(doc),nativeUnwrapped=nativeRun(doc,{instrument:false});
  const baseline=evaluateDocument(doc,core);
  const observedNative=nativeRun(doc,options);
  const report={label,documentSha256:hash(original),document:doc,
    baseline:{native:baseline.summary.native,executionPassed:baseline.summary.executionPassed,
      detectorsById:baseline.summary.observations?.detectorsById??null},
    nativeUnwrapped:{event:nativeUnwrapped.event,processed:nativeUnwrapped.processed,
      truncation:nativeUnwrapped.truncation,undefinedBehavior:nativeUnwrapped.undefinedBehavior},
    observedNative};
  // Baseline comparison is invariant even for stopped or incomplete tracing.
  for(const field of ['event','processed','truncation','undefinedBehavior'])
    assert.equal(observedNative[field],nativeUnwrapped[field],
      label+': instrumented native '+field+' deviated from untouched native run');
  assert.equal(observedNative.processed,baseline.summary.native.processed,
    label+': instrumented processed segments differ from official checker');
  assert.equal(observedNative.truncation,baseline.summary.native.truncation,
    label+': instrumented truncation differs from official checker');
  assert.equal(observedNative.undefinedBehavior,baseline.summary.native.undefinedBehavior,
    label+': instrumented undefined behavior differs from official checker');
  if(baseline.summary.observations?.detectorsById){
    for(const [id,reading] of Object.entries(baseline.summary.observations.detectorsById))
      assert.equal(observedNative.observed.byId[id]??0,reading.crossings,
        label+': actual observed detector callbacks must equal official crossings');
  }
  report.qualification=qualify(report);
  return report;
}
const trace=(r,type,id)=>r.observedNative.observed.events
  .filter(e=>e.type===type&&(!id||e.componentId===id));
const close=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,
  JSON.stringify({actual:a,expected:b,t}));
function recordExperiment(report,id,doc,options={}){
  const r=study(doc,id,options);report.cases.push(r);
  return r;
}
async function main(){
  assert.equal(process.version,'v24.19.0','Run only on supported pinned Node 24.19.0');
  mkdirSync(OUTPUT,{recursive:true});
  const report={format:'opticsim-native-ray-lineage-boundaries-research-v1',
    mainParent:'00e6211d6d40c0db8c62910f9e57b910b6aeb6f5',
    checkoutSha:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,
    node:process.version,source:'Actual pinned PhyDemo object identity in test-only wrappers',
    scope:'Synthetic native observations only; no public provenance API, no source-image interpretation',
    cases:[],rejections:[],limitations:[]};
  let failed=null;
  try{
    const mirrors=recordExperiment(report,'finite-mirrors',mirror());
    assert.equal(mirrors.qualification.decision,'bounded-observed-in-this-test');
    const mirrorEvents=trace(mirrors,'plane-mirror');
    assert.equal(mirrorEvents.length,4);
    assert.equal(new Set(mirrorEvents.map(e=>e.token)).size,1);
    assert.ok(mirrorEvents.every(e=>e.sourceId==='S1'&&e.children.length===0));

    const dual=recordExperiment(report,'two-source-fresnel',fresnel());
    assert.equal(dual.qualification.decision,'bounded-observed-in-this-test');
    const interfaceEvents=trace(dual,'planar-interface','AirWater');
    const through=trace(dual,'ray-detector','LakeBottomDetector');
    const reflections=trace(dual,'ray-detector','ReflectedDetector');
    assert.equal(interfaceEvents.length,2);
    assert.equal(through.length,2);assert.equal(reflections.length,2);
    assert.deepEqual(interfaceEvents.map(e=>e.children.length),[1,1]);
    assert.deepEqual(through.map(e=>e.token),interfaceEvents.map(e=>e.token));
    assert.deepEqual(reflections.map(e=>e.token),interfaceEvents.map(e=>e.children[0].token));
    assert.deepEqual(reflections.map(e=>e.sourceId),['SunRay','SunRay2']);

    // Distinctly author high-to-low-index native cases, not assumed extensions
    // of the initial air-to-water experiment.
    const criticalDeg=Math.asin(3/4)*180/Math.PI;
    for(const [name,angle] of [
      ['tir-below',criticalDeg-.25],['tir-above',criticalDeg+.25],
      ['near-critical-below',criticalDeg-1e-5],
      ['near-critical-above',criticalDeg+1e-5],
      ['critical-exact',criticalDeg]
    ]){
      const r=recordExperiment(report,name,critical(angle));
      assert.ok(trace(r,'planar-interface','Surface').length>=1,
        'Physical native interface must be reached for '+name);
      // Retain native return/children/status even for grazing re-hits,
      // incomplete rays and numerical anomalies. Never repair them.
    }

    const weak=recordExperiment(report,'fresnel-minimum-valid-brightness',
      fresnel(false,.01));
    assert.equal(weak.observedNative.observed.emissions.length,1);

    const layered=recordExperiment(report,'two-interface-weak-truncation',slab());
    assert.ok(trace(layered,'planar-interface').length>0);

    const limited=mirror();limited.simulation.processedRayLimit=1;
    const stopped=recordExperiment(report,'forced-processed-ray-stop',limited);
    assert.equal(stopped.qualification.decision,'withheld',
      'A 1-segment quota must not certify the multi-bounce lineages');

    const many=recordExperiment(report,'dense-two-source-warning',dense());
    assert.ok(many.observedNative.observed.emittedCount>0);
    assert.ok(many.observedNative.observed.byId.D1>0);

    const missing=recordExperiment(report,'omitted-source-callback-negative-control',
      fresnel(),{omitSourceId:'SunRay2'});
    assert.ok(missing.observedNative.observed.unknown>0,
      'A native ray with intentionally missing emission observer must remain unknown');
    assert.equal(missing.qualification.decision,'withheld');

    // Coincident media are invalid authoring, not an opportunity to invent
    // an intersection order or attribute a nonexistent observed branch.
    const invalid=asDoc; // Keep same strict public preparation boundary.
    const candidate=[
      source('FromAir',-100,100,-45),
      face('Plane1',0,0,90,4/3,1),
      face('Plane2',0,0,90,4/3,1)
    ];
    let rejection=null;
    try{invalid(candidate);}catch(e){rejection={name:e.name,code:e.code??null,message:e.message,
      issues:e.issues??null};}
    assert.ok(rejection,'Coincident interface scene must be rejected before any native simulation');
    report.rejections.push({label:'coincident-interfaces',nativeCalls:0,rejection});

    report.limitations=[
      'Object identity is per scene instance; JS tokens are not persistent PhyDemo path IDs',
      'Source labels here derive only from actual tracked emissions and actual newRays children',
      'Native truncation, stopped runs, missing callbacks, warnings and event-buffer overflow withhold lineage qualification',
      'A detector callback attributed within this test is not a production source-attributed measurement',
      'Finite source fan coverage does not certify arbitrary many-ray systems or browser races',
      'Critical-angle outcomes, numerical path failures and incomplete branches are not reinterpreted or repaired',
      'No scene or answer was inferred from an original textbook image'
    ];
  }catch(e){failed={message:e.message,stack:e.stack};report.failure=failed;}
  finally{
    writeFileSync(resolve(OUTPUT,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log('NATIVE_LINEAGE_BOUNDARY_RESEARCH '+JSON.stringify({
      node:report.node,cases:report.cases.map(c=>({label:c.label,
        native:c.baseline.native.status,observed:c.qualification.decision,
        reasons:c.qualification.reasons,processed:c.observedNative.processed,
        truncation:c.observedNative.truncation,unknown:c.observedNative.observed.unknown,
        children:c.observedNative.observed.events.reduce((sum,e)=>sum+e.children.length,0)})),
      rejections:report.rejections.length,failed:!!failed}));
  }
  if(failed)throw Error('Native lineage boundary study failed: '+failed.stack);
}
main().catch(error=>{console.error('NATIVE_LINEAGE_BOUNDARIES_FAILURE '+(error.stack||error));process.exitCode=1});
