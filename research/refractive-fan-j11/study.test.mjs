import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../../src/authoring.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
const bytes=readFileSync(new URL('./frozen-protocol.json',import.meta.url));
const protocol=JSON.parse(bytes),a=protocol.apparatus,tol=protocol.limits;
const hash=b=>createHash('sha256').update(b).digest('hex');
const rad=Math.PI/180;
const near=(x,y,t,label)=>assert.ok(Number.isFinite(x)&&Math.abs(x-y)<=t,label+': '+x+' vs '+y);
const unit=ray=>{
  const x=ray.p2.x-ray.p1.x,y=ray.p1.y-ray.p2.y,length=Math.hypot(x,y);
  return {x:x/length,y:y/length};
};
const angle=u=>Math.atan2(u.x,u.y)/rad;
function compareVector(u,v) {
  for(const k of ['x','y'])near(u[k],v[k],tol.unitVectorTolerance,k);
}
function input(c,incidence=null) {
  const fan=incidence===null;
  const source={id:'S',type:'point-source',parameters:{x:a.sourceMm[0],y:a.sourceMm[1],brightness:a.referenceBrightness},
    emission:{mode:'single-ray',directionDeg:90-(incidence??c.axisIncidenceDeg)}};
  const plane={id:'I',type:'planar-interface',parameters:{x:a.planeMm[0],y:a.planeMm[1],normalDeg:a.normalDeg,
    negativeIndex:a.negativeIndex,positiveIndex:a.positiveIndex,partialReflection:a.partialReflection}};
  const request=components=>({lengthUnit:'mm',runPolicy:'preview-v1',components});
  const doc=prepareScene(request([source,plane])).document;
  assert.equal(doc.schemaVersion,5);
  doc.simulation.rayDensity=c.density;doc.simulation.maxRayDepth=a.maxRayDepth;
  const raw=core.compile(doc).native;
  if(fan){
    const directional={...source,parameters:{...source.parameters,brightness:a.fanBrightness},
      emission:{mode:'directional',directionDeg:90-c.axisIncidenceDeg,angleDeg:c.coneDeg}};
    assert.throws(()=>prepareScene(request([directional,plane])),/single-ray|emission mode/i);
    raw.objs[0]=core.compile(prepareScene(request([directional])).document).native.objs[0];
  }
  assert.deepEqual(raw.objs.map(o=>o.type),[fan?'AngleSource':'SingleRay','PlaneGlass']);
  return {raw,processedRayLimit:a.processedRayLimit};
}
function execute({raw,processedRayLimit}) {
  const scene=core.loadNative(raw),[source,glass]=scene.objs;
  const emitted=[],events=[];
  const start=source.onSimulationStart,incident=glass.onRayIncident;
  source.onSimulationStart=function(...args){
    const result=start.apply(this,args);
    for(const ray of result.newRays)emitted.push({origin:{x:ray.p1.x,y:-ray.p1.y},direction:unit(ray)});
    return result;
  };
  glass.onRayIncident=function(ray,index,p,...rest){
    const incoming=unit(ray),point={x:p.x,y:-p.y};
    const result=incident.call(this,ray,index,p,...rest);
    const outgoing=unit(ray);
    const outcome=result===undefined&&outgoing.y<0?'TIR':
      result!==undefined&&outgoing.y>0?'transmission':'unresolved';
    events.push({point,incoming,outgoing,outcome,returnedUndefined:result===undefined,
      absorbed:result?.isAbsorbed===true,undefinedBehavior:result?.isUndefinedBehavior===true,
      children:result?.newRays?.length??0});
    return result;
  };
  const sim=new core.Simulator(scene,null,null,null,null,null,false,processedRayLimit);
  let terminal=null;
  for(const event of ['simulationComplete','simulationStop'])sim.on(event,()=>{terminal=event;});
  sim.updateSimulation();
  return {terminal,diagnostics:core.diagnostics(scene,sim),emitted,events};
}
function checkRun(r,directions) {
  assert.equal(r.terminal,'simulationComplete');
  assert.deepEqual(r.diagnostics.errors,[]);assert.deepEqual(r.diagnostics.warnings,[]);
  assert.equal(r.diagnostics.truncation,0);assert.equal(r.diagnostics.undefinedBehavior,0);
  const starts=[...r.emitted].sort((p,q)=>angle(p.direction)-angle(q.direction));
  const events=[...r.events].sort((p,q)=>angle(p.incoming)-angle(q.incoming));
  assert.equal(starts.length,directions.length);assert.equal(events.length,directions.length);
  for(const [i,d] of directions.entries()){
    const e=events[i];
    near(starts[i].origin.x,0,tol.pointToleranceMm,'source x');
    near(starts[i].origin.y,-100,tol.pointToleranceMm,'source y');
    near(angle(starts[i].direction),d,tol.angleToleranceDeg,'emission');
    near(angle(e.incoming),d,tol.angleToleranceDeg,'incidence');
    near(e.point.x,100*Math.tan(d*rad),tol.pointToleranceMm,'impact x');
    near(e.point.y,0,tol.pointToleranceMm,'impact y');
    assert.ok(!e.absorbed&&!e.undefinedBehavior&&e.children===0);
  }
  return events;
}
test('frozen AngleSource / PlaneGlass study versus J11 SingleRay controls',()=>{
  assert.equal(hash(bytes),'e4fb5230ca74bb1fdf4ddbec823224e0f5de6b0afaac72db3cf45e0a3bc0b91b');
  const base=resolve(root,'test-artifacts/refractive-fan-j11');
  mkdirSync(base,{recursive:true});
  const out=mkdtempSync(join(base,'attempt-')),files=[];
  function save(name,value){
    const b=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+'\n');
    writeFileSync(join(out,name),b,{flag:'wx'});files.push({name,sha256:hash(b)});
  }
  save('frozen-protocol.json',bytes);
  // Isolate the legacy control's working directory so its outputs belong to
  // this attempt even when another experiment runs concurrently.
  const env={...process.env};
  delete env.NODE_TEST_CONTEXT;
  const log=execFileSync(process.execPath,['--test',join(root,'test/jee-j11-escape-disc-meridional-native.test.mjs')],{cwd:out,env});
  save('j11-test.log',log);
  const jroot=join(out,'test-artifacts/llm-authoring/jee-j11-native-meridional-v1');
  const [trial]=readdirSync(jroot);const jdir=join(jroot,trial);
  const legacy=JSON.parse(readFileSync(join(jdir,'report.json')));
  const comparisons=[];
  function run(name,settings){
    save(name+'.input.json',settings);
    const report=execute(settings);
    save(name+'.native.json',report);
    return report;
  }
  for(const c of protocol.cases){
    const fan=checkRun(run(c.id,input(c)),c.incidencesDeg);
    const rows=c.incidencesDeg.map((d,i)=>{
      const e=fan[i],s=checkRun(run(c.id+'-single-'+i,input(c,d)),[d])[0];
      compareVector(e.incoming,s.incoming);
      near(e.point.x,s.point.x,tol.pointToleranceMm,'matched x');
      near(e.point.y,s.point.y,tol.pointToleranceMm,'matched y');
      const guard=v=>Math.abs(a.negativeIndex*Math.abs(v.x)-a.positiveIndex)<=tol.criticalSineGuard;
      const withheld=guard(e.incoming);
      assert.equal(guard(s.incoming),withheld);
      const witness=withheld?'withheld':e.outcome;
      assert.equal(witness,c.expected[i]);
      if(!withheld){
        assert.equal(s.outcome,e.outcome);compareVector(e.outgoing,s.outgoing);
        const sin=a.negativeIndex/a.positiveIndex*Math.sin(d*rad);
        const expected=Math.abs(sin)>1?{x:Math.sin(d*rad),y:-Math.cos(d*rad)}:{x:sin,y:Math.sqrt(1-sin*sin)};
        compareVector(e.outgoing,expected);
      }
      const oldId=({'0':'normal','15':'below15','30':'below30','41':'below41','50':'above50','41.81031489577859':'critical'})[d];
      if(oldId){
        const old=legacy.attempts.find(v=>v.id===oldId);
        const raw=readFileSync(join(jdir,old.report.name));assert.equal(hash(raw),old.report.sha256);
        const oldEvent=JSON.parse(raw).events[0];
        near(e.point.x,oldEvent.point.x,tol.pointToleranceMm,oldId);
        near(e.point.y,oldEvent.point.y,tol.pointToleranceMm,oldId);
        compareVector(e.incoming,oldEvent.before);
        assert.equal(old.native.boundedSafeMeridionalWitness,withheld?null:e.outcome==='TIR'?'total-internal-reflection':'transmission');
        if(!withheld)compareVector(e.outgoing,oldEvent.after);
      }
      return {incidenceDeg:d,fanRaw:e.outcome,singleRaw:s.outcome,witness,j11Control:oldId??null};
    });
    const caseWitness=rows.some(r=>r.witness==='withheld')?'withheld':'qualified';
    assert.equal(caseWitness,c.caseWitness);
    comparisons.push({id:c.id,caseWitness,rows});
  }
  save('comparisons.json',comparisons);
  save('manifest.json',{base:protocol.productionBase,pin:protocol.phyDemoPin,legacyReport:join('test-artifacts','llm-authoring','jee-j11-native-meridional-v1',trial,'report.json'),legacyReportSha256:hash(readFileSync(join(jdir,'report.json'))),files:[...files]});
  console.log(out);
});
