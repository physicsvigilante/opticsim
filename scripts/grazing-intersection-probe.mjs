// Test-only localization of the pinned planar near-critical defect. Observers
// delegate exactly once; exact-line queries inspect captured endpoints AFTER
// native execution and never feed intersections or rays back to the simulator.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../src/authoring.js';
import {serializeSave,UPSTREAM,validate} from '../src/contract.js';
import {exactLineReference} from './exact-line-reference.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const complete=status=>['completed','completed-with-warnings'].includes(status);
const line=ray=>structuredClone({p1:ray.p1,p2:ray.p2});
const wrap=a=>a>=-180&&a<=180?a:((a+180)%360+360)%360-180;
export function grazingProbeInputs(){
  const criticalDirection=90-Math.asin(1.3/1.6)*180/Math.PI;
  const transforms=[['base',1,0,0,0],['small',.1,0,0,0],['large',10,0,0,0],
    ['translated',1,0,250,-75],['rotated37',1,37,0,0],['quarter-turn',1,90,0,0]];
  return transforms.flatMap(([name,scale,rotation,tx,ty])=>
    [['normal',90],['below',criticalDirection-.001],['critical',criticalDirection],['above',criticalDirection+.001]]
    .map(([angleCase,direction])=>{
      const a=rotation*Math.PI/180;
      const point=(x,y)=>({x:tx+scale*(x*Math.cos(a)-y*Math.sin(a)),y:ty+scale*(x*Math.sin(a)+y*Math.cos(a))});
      return {id:name+'-'+angleCase,transform:{scale,rotationDeg:rotation,tx,ty},angleCase,
        request:{lengthUnit:'mm',title:'Synthetic planar grazing diagnostic: '+name+' '+angleCase,components:[
          {id:'S1',type:'point-source',parameters:{...point(-100,-100),brightness:1},
            emission:{mode:'single-ray',directionDeg:wrap(direction+rotation)}},
          {id:'I12',type:'planar-interface',parameters:{...point(0,0),normalDeg:wrap(90+rotation),
            negativeIndex:1.6,positiveIndex:1.8,partialReflection:false}},
          {id:'I23',type:'planar-interface',parameters:{...point(0,100),normalDeg:wrap(90+rotation),
            negativeIndex:1.8,positiveIndex:1.3,partialReflection:false}}
        ]}};
    }));
}
export function captureGrazingProbe(doc,core,mode){
  validate(doc);
  if(!['default','linear'].includes(mode))throw Error('Explicit native mode required');
  const before=serializeSave(doc),loaded=core.loadDocument(structuredClone(doc));
  assert.equal(loaded.scene.colorMode,'default');loaded.scene.colorMode=mode;
  const emissions=core.observeSourceSet(doc,loaded.scene,loaded.idMap);
  const interfaces=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
  const entries=[];let totalEvents=0;
  for(const component of doc.physics.components.filter(c=>c.type==='planar-interface')){
    const obj=loaded.scene.objs[loaded.idMap.get(component.id)],original=obj.onRayIncident;
    obj.onRayIncident=function(...args){
      const incoming=line(args[0]),point=structuredClone(args[2]);
      const outcome=original.apply(this,args);totalEvents++;
      if(entries.length<32)entries.push({interfaceId:component.id,rayIndex:args[1],
        incidentPoint:point,before:incoming,after:line(args[0]),
        primarySurvived:!outcome?.isAbsorbed,newRayCount:outcome?.newRays?.length??0});
      return outcome;
    };
  }
  const simulator=new core.Simulator(loaded.scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
  let event=null;
  for(const name of ['simulationComplete','simulationStop'])simulator.on(name,()=>{event=name;});
  simulator.updateSimulation();
  assert.ok(event,'Expected synchronous headless native completion/stop');
  const diagnostic=core.diagnostics(loaded.scene,simulator,emissions,null,null,interfaces);
  const status=core.classifyRun(event,diagnostic);
  assert.equal(serializeSave(doc),before,'Probe must not mutate the authored scene');
  const index=entries.findIndex(e=>e.interfaceId==='I23'),first=entries[index];
  assert.ok(first,'Synthetic probe must reach I23');
  const obj=loaded.scene.objs[loaded.idMap.get('I23')],boundary=line(obj);
  const captured=line(first.after),copy=structuredClone(captured);
  const candidate=obj.checkRayIntersects(copy)??null;
  assert.deepEqual(copy,captured,'Native intersection inspection must be read-only');
  const cutoffSquared=core.Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED*loaded.scene.lengthScale**2;
  assert.ok(Number.isFinite(cutoffSquared)&&cutoffSquared>0);
  const exact=exactLineReference(captured,boundary,cutoffSquared);
  const nativeDistanceSquared=candidate?
    (candidate.x-captured.p1.x)**2+(candidate.y-captured.p1.y)**2:null;
  const next=entries.slice(index+1).find(e=>e.rayIndex===first.rayIndex);
  return {mode,status,complete:complete(status),canonicalSha256:hash(before),canonicalDocument:structuredClone(doc),
    nativeEvent:event,diagnostic,coordinateConvention:'native x-right-y-down; lengths mm',
    trace:{maxEvents:32,totalEvents,eventsOmitted:totalEvents-entries.length,entries},
    intersectionCheck:{boundary,ray:captured,nativeCandidate:candidate,nativeDistanceSquared,cutoffSquared,
      nativeBeyondCutoff:candidate!==null&&nativeDistanceSquared>cutoffSquared,exact,
      sameInterfaceRehitObserved:!!next&&next.interfaceId===first.interfaceId,
      nextNativeInterface:next?.interfaceId??null},
    scope:'Synthetic headless diagnostic; partial reflections explicitly omitted. Not canonical execution or an accepted requested measurement.'};
}
export function assertGrazingProbe(record){
  const {angleCase,id,diagnostic,intersectionCheck:c}=record;
  assert.equal(record.complete,complete(record.status));
  assert.deepEqual(diagnostic.errors,[]);assert.equal(diagnostic.undefinedBehavior,0);
  assert.ok(record.trace.entries.length<=32);
  if(angleCase!=='critical'){
    assert.equal(record.complete,true,id+' control must complete');assert.equal(diagnostic.truncation,0);
    const first=diagnostic.interfacesById.I23.first;
    if(angleCase==='below')assert.equal(first.outcome,'total-internal-reflection');
    if(angleCase==='normal')assert.ok(Math.abs(first.transmittedAngleDeg)<1e-6);
    if(angleCase==='above'){
      const incident=Math.asin(1.3/1.6)*180/Math.PI-.001;
      const expected=Math.asin(1.6/1.3*Math.sin(incident*Math.PI/180))*180/Math.PI;
      assert.ok(Math.abs(first.transmittedAngleDeg-expected)<1e-5,id+' independent Snell control');
    }
  }
  if(id==='base-critical'){
    // Pin the defect as a reproducible finding, NOT as correct physical output.
    assert.equal(record.status,'incomplete');assert.ok(diagnostic.truncation>0);
    assert.equal(c.sameInterfaceRehitObserved,true);assert.equal(c.nativeBeyondCutoff,true);
    assert.equal(c.exact.kind,'unique');assert.equal(c.exact.forward,true);
    assert.equal(c.exact.beyondCutoff,false,'Exact represented geometry is below the native segment cutoff');
  }
}
async function main(){
  if(process.argv.length>3)throw Error('Usage: node scripts/grazing-intersection-probe.mjs [fresh-output-directory]');
  const output=reserveAuthoringOutput(process.argv[2]||'test-artifacts/llm-authoring/grazing-intersection',root);
  const inputs=grazingProbeInputs(),inputBytes=JSON.stringify(inputs,null,2)+'\n';writeEvidence(output.input,inputBytes);
  const vendor=resolve(root,'vendor/ray-optics');
  assert.equal(execFileSync('git',['-C',vendor,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),UPSTREAM);
  assert.equal(execFileSync('git',['-C',vendor,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'');
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  const records=[];
  for(const input of inputs)for(const mode of ['default','linear']){
    const doc=prepareScene(input.request).document;
    records.push({...input,...captureGrazingProbe(doc,core,mode)});
  }
  const report={format:'opticsim-grazing-intersection-audit-v1',upstreamCommit:UPSTREAM,
    inputSha256:hash(inputBytes),nativeRuns:records.length,records,
    limitation:'Exact reference concerns represented straight lines only, not a corrected critical-angle solver. No native source was modified.'};
  // Preserve actual observations even if an acceptance assertion later fails.
  writeEvidence(output.report,JSON.stringify(report,null,2)+'\n');
  for(const record of records)assertGrazingProbe(record);
  console.log(JSON.stringify({status:'pass',nativeRuns:records.length,
    completeRuns:records.filter(r=>r.complete).length,incompleteRuns:records.filter(r=>!r.complete).length,
    baseCritical:records.filter(r=>r.id==='base-critical').map(r=>({mode:r.mode,status:r.status,
      nativeStepMm:Math.sqrt(r.intersectionCheck.nativeDistanceSquared),
      exactStepMm:Math.sqrt(r.intersectionCheck.exact.distanceSquared.approx),
      cutoffMm:Math.sqrt(r.intersectionCheck.cutoffSquared)})),report:output.report},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
