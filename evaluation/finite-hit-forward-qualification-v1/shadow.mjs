// TEST-ONLY SHADOW QUALIFIER — no change to production callbacks, ray paths,
// native completion status or public observables. Every computed ray-line
// intersection uses exact BigInt rationals of ACTUAL binary64 callback inputs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../../src/authoring.js';
import {serializeSave,UPSTREAM} from '../../src/contract.js';
import {polygonFaces,polygonVertices} from '../../src/polygon-dielectric.js';
import {distanceToFiniteSegment} from '../../src/finite-glass-geometry.js';
import {exactLineReference} from '../../scripts/exact-line-reference.mjs';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from '../../scripts/authoring-evidence.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const hash=text=>createHash('sha256').update(text).digest('hex');
const high=1.6,low=1.3,critical=Math.asin(low/high)*180/Math.PI;
const regimes=[['normal',0],['below5',critical-5],['below001',critical-.001],
  ['exact-computed',critical],['above001',critical+.001],['above5',critical+5]];
const transforms=[{id:'base',scale:1,deg:0,tx:0,ty:0},
  {id:'small01',scale:.1,deg:0,tx:0,ty:0},
  {id:'translated',scale:1,deg:0,tx:245,ty:-170},
  {id:'rotated37',scale:1,deg:37,tx:0,ty:0}];
const cbLimit=128,hitResidualMm=1e-5,vertexExclusionMm=.01;
const wrap=deg=>((deg+180)%360+360)%360-180;
function transform(point,t){
  const a=t.deg*Math.PI/180;
  return {x:t.tx+t.scale*(point.x*Math.cos(a)-point.y*Math.sin(a)),
    y:t.ty+t.scale*(point.x*Math.sin(a)+point.y*Math.cos(a))};
}
function source(point,deg){
  return {id:'S',type:'point-source',parameters:{...point,brightness:1},
    emission:{mode:'single-ray',directionDeg:wrap(deg)}};
}
function glass(t){
  const vertices=[[-3000,-1000],[3000,-1000],[3000,0],[-3000,0]]
    .map(([x,y])=>transform({x,y},t));
  const params=Object.fromEntries(vertices.flatMap((p,i)=>
    [['x'+(i+1),p.x],['y'+(i+1),p.y]]));
  return {id:'Boundary',type:'polygon-dielectric',
    parameters:{...params,insideIndex:high,outsideIndex:low,partialReflection:false}};
}
function inputs(){
  return regimes.flatMap(([regime,incidenceDeg])=>transforms.map(t=>({
    id:'quadrilateral-'+regime+'-'+t.id,regime,incidenceDeg,transform:t,
    request:{lengthUnit:'mm',title:'Test-only finite-Glass forward-hit shadow '+regime+' '+t.id,
      runPolicy:'preview-v1',components:[
        source(transform({x:0,y:-100},t),90-incidenceDeg+t.deg),glass(t)
      ]}
  })));
}
const snapshot=ray=>ray?.p1&&ray?.p2?{p1:{x:ray.p1.x,y:ray.p1.y},
  p2:{x:ray.p2.x,y:ray.p2.y}}:null;
function nativeObservation(doc,core){
  const loaded=core.loadDocument(doc),sources=core.observeSourceSet(doc,loaded.scene,loaded.idMap),
    interfaceMeter=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
  const boundary=loaded.scene.objs[loaded.idMap.get('Boundary')],
    original=boundary.onRayIncident;
  let actual=0,overflow=false,delegates=0;const events=[];
  boundary.onRayIncident=function(...args){
    const before=snapshot(args[0]);
    const hitPoint=args[2]?{x:args[2].x,y:args[2].y}:null;
    const result=original.apply(this,args);delegates++;actual++;
    if(events.length<cbLimit)events.push({before,hitPoint});
    else overflow=true;
    return result;
  };
  const sim=new core.Simulator(loaded.scene,null,null,null,null,null,false,
    doc.simulation.processedRayLimit);
  let terminal=null;
  for(const event of ['simulationComplete','simulationStop'])
    sim.on(event,()=>{terminal=event});
  sim.updateSimulation();
  assert.ok(terminal,'Pinned PhyDemo did not report a native terminal event');
  const diagnostic=core.diagnostics(loaded.scene,sim,sources,null,null,interfaceMeter);
  return {status:core.classifyRun(terminal,diagnostic),terminal,
    metrics:{errors:diagnostic.errors,warnings:diagnostic.warnings,
      processed:diagnostic.processed,truncation:diagnostic.truncation,
      undefinedBehavior:diagnostic.undefinedBehavior,
      emissionsById:diagnostic.emissionsById,
      interface:diagnostic.interfacesById.Boundary},
    actual,delegates,overflow,events,cutoffSquared:
      core.Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED*loaded.scene.lengthScale**2};
}
function faceEvidence(e,parameters,cutoffSquared){
  if(!e.before||!e.hitPoint||
     ![e.before.p1.x,e.before.p1.y,e.before.p2.x,e.before.p2.y,
       e.hitPoint.x,e.hitPoint.y].every(Number.isFinite))
    return {state:'unknown',reason:'MALFORMED_NATIVE_EVENT'};
  const p={x:e.hitPoint.x,y:-e.hitPoint.y},faces=polygonFaces(parameters),
    vertices=polygonVertices(parameters);
  const near=faces.filter(f=>distanceToFiniteSegment(p,f.a,f.b)<=hitResidualMm);
  if(near.length!==1||
    vertices.some(v=>Math.hypot(p.x-v.x,p.y-v.y)<vertexExclusionMm))
    return {state:'unknown',reason:'AMBIGUOUS_NATIVE_FINITE_FACE',
      faceCandidates:near.length};
  const f=near[0],line={p1:{x:f.a.x,y:-f.a.y},p2:{x:f.b.x,y:-f.b.y}};
  let exact;
  try{exact=exactLineReference(e.before,line,cutoffSquared);}
  catch(err){return {state:'unknown',reason:'EXACT_REFERENCE_UNAVAILABLE',
    error:String(err.message)};}
  const nativeDistance=Math.hypot(e.hitPoint.x-e.before.p1.x,
    e.hitPoint.y-e.before.p1.y);
  const nativePassesCutoff=nativeDistance**2>cutoffSquared;
  const incidentClass=exact.kind!=='unique'?
    'EXACT_PARALLEL_OR_COINCIDENT_WITH_NATIVE_HIT':
    !exact.forward?'EXACT_NONFORWARD_NATIVE_HIT':
    !exact.beyondCutoff?'EXACT_SUBCUTOFF_NATIVE_HIT':
    !nativePassesCutoff?'NATIVE_SUBCUTOFF_HIT':'CHECKED_FORWARD_BEYOND_CUTOFF';
  return {state:incidentClass==='CHECKED_FORWARD_BEYOND_CUTOFF'?'checked':'contradiction',
    reason:incidentClass,face:f.id,actualHitPointMm:p,
    nativeDistanceMm:nativeDistance,nativePassesCutoff,
    exactKind:exact.kind,exactForward:exact.forward,exactBeyondCutoff:exact.beyondCutoff,
    exactStepMm:exact.distanceSquared?Math.sqrt(exact.distanceSquared.approx):null,
    exactRayParameter:exact.t?.approx??null};
}
function analyze(row,core){
  const doc=prepareScene(row.request).document,bytes=serializeSave(doc),
    instrumented=nativeObservation(doc,core),regular=evaluateDocument(doc,core);
  assert.equal(serializeSave(doc),bytes,'Authored input was mutated');
  const n=regular.report.native,d=n.diagnostics,m=instrumented.metrics;
  assert.equal(n.status,instrumented.status,row.id+' changed native completion');
  for(const k of ['processed','truncation','undefinedBehavior'])
    assert.equal(d[k],m[k],row.id+' observer changed '+k);
  assert.deepEqual(d.emissionsById,m.emissionsById,row.id+' changed source readings');
  for(const k of ['interactions','invalidObservations','transmitted',
      'reflected','totalInternalReflections'])
    assert.equal(d.interfacesById.Boundary[k],m.interface[k],row.id+' changed '+k);
  assert.equal(d.interfacesById.Boundary.first?.outcome,m.interface.first?.outcome);
  assert.equal(instrumented.actual,instrumented.delegates,'Native callbacks not delegated once');
  assert.equal(instrumented.actual,m.interface.interactions,'Native observer lost interface callback');
  assert.equal(m.emissionsById.S.emitted,1,'SingleRay source emission unexpected');
  const faces=instrumented.events.map((e,j)=>({callback:j+1,
    ...faceEvidence(e,doc.physics.components.find(c=>c.id==='Boundary').parameters,
      instrumented.cutoffSquared)}));
  const contradictions=faces.filter(e=>e.state==='contradiction'),
    unknown=faces.filter(e=>e.state==='unknown');
  // This is a counterfactual SHADOW qualification decision; no actual
  // canonical or browser result gets changed by this test-only module.
  const shadowDecision=!['completed','completed-with-warnings'].includes(n.status)?
    'withheld-native-run':instrumented.overflow||unknown.length?
      'withheld-audit-unknown':contradictions.length?
        'withheld-forward-inconsistency':'candidate-clean-forward-only';
  return {id:row.id,regime:row.regime,transform:row.transform,
    canonicalHash:hash(bytes),nativeStatus:n.status,shadowDecision,
    canonicalReadoutStatus:regular.summary.observations===null?'withheld':'present',
    nativeMetrics:{processed:d.processed,truncation:d.truncation,
      undefinedBehavior:d.undefinedBehavior,interfaceCount:m.interface.interactions,
      interfaceInvalidObservations:m.interface.invalidObservations},
    audit:{callbackCount:instrumented.actual,overflow:instrumented.overflow,
      checked:faces.filter(e=>e.state==='checked').length,
      contradictions:contradictions.length,unknown:unknown.length,
      events:faces},
    method:'retrospective read-only exact-binary64 forward-intersection audit; no production changes'};
}
async function main(){
  if(process.argv.length>3)throw Error('Usage: node shadow.mjs [fresh-output-dir]');
  const output=reserveAuthoringOutput(process.argv[2]||
    'test-artifacts/llm-authoring/finite-hit-forward-qualification-v1',root);
  const list=inputs(),input=JSON.stringify(list,null,2)+'\n';
  writeEvidence(output.input,input);
  const vendor=resolve(root,'vendor/ray-optics');
  assert.equal(execFileSync('git',['-C',vendor,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),UPSTREAM);
  assert.equal(execFileSync('git',['-C',vendor,'status','--porcelain','--untracked-files=no'],
    {encoding:'utf8'}).trim(),'');
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  const results=[],errors=[];
  for(const row of list){
    try{results.push(analyze(row,core));}
    catch(err){errors.push({id:row.id,message:err.message});}
  }
  const tally={};
  for(const r of results)tally[r.shadowDecision]=(tally[r.shadowDecision]||0)+1;
  const report={format:'opticsim-finite-forward-shadow-v1',
    origin:'Synthetic seeded PR #87 v9 native critical probes plus four new normal controls; exposed developmental input, not blind transfer',
    baseMain:'fa158fc78da7a35b6a02eaed58c0cdbd4b699220',upstream:UPSTREAM,
    inputSha256:hash(input),cases:list.length,actualRuns:results.length*2,
    exactCheckCount:results.reduce((n,r)=>n+r.audit.checked+r.audit.contradictions,0),
    tally,errors,results,
    limit:'Only actual represented-ray finite-line forward/cutoff consistency checked. This is not a general physics-accuracy oracle, a production gate, new solver, repaired native path, or source interpretation review.'};
  writeEvidence(output.report,JSON.stringify(report,null,2)+'\n');
  assert.equal(errors.length,0,'Shadow audit setup or native parity failed; inspect retained report');
  assert.equal(results.length,24,'Expected 20 original geometry variants plus four normal controls');
  const contradictions=results.filter(r=>r.audit.contradictions>0).map(r=>r.id).sort();
  assert.deepEqual(contradictions,[
    'quadrilateral-exact-computed-rotated37',
    'quadrilateral-exact-computed-translated'
  ]);
  const nativeCompletedButWithheld=results.filter(r=>r.nativeStatus==='completed'&&
    r.shadowDecision==='withheld-forward-inconsistency').map(r=>r.id);
  assert.deepEqual(nativeCompletedButWithheld,['quadrilateral-exact-computed-rotated37']);
  assert.equal(results.filter(r=>r.regime==='normal'&&r.shadowDecision!=='candidate-clean-forward-only').length,
    0,'Ordinary fully declared normal incidence must remain accepted by shadow safety check');
  assert.equal(results.filter(r=>['below5','above5'].includes(r.regime)&&
    r.shadowDecision!=='candidate-clean-forward-only').length,0,
    'Far-from-critical native controls must not acquire false geometry refusals');
  console.log('FINITE_FORWARD_SHADOW '+JSON.stringify({status:'pass',cases:results.length,
    actualNativeRuns:report.actualRuns,tally,contradictions,
    otherUnknown:results.filter(r=>r.audit.unknown).map(r=>({id:r.id,unknown:r.audit.unknown})),
    retained:output.report}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();
