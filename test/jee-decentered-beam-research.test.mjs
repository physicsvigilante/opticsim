// Research only. Native Beam/IdealLens/Detector and Simulator own every ray.
// No new canonical document, public observable, qualification or upstream edit.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareScene} from '../src/authoring.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root=new URL('../',import.meta.url);
const bytes=await readFile(new URL('research/jee-decentered-beam-v1/protocol.json',root));
const protocol=JSON.parse(bytes);
const hash=b=>createHash('sha256').update(b).digest('hex');
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const yup=p=>({x:p.x,y:-p.y});
function direction(ray){
  const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,n=Math.hypot(dx,dy);
  assert.ok(Number.isFinite(n)&&n>0,'Native ray direction must be finite and nonzero');
  return {x:dx/n,y:dy/n};
}
function nativeInput(c){
  const lens=(x,y,h)=>({type:'IdealLens',p1:{x,y:-y-h/2},p2:{x,y:-y+h/2},focalLength:c.f});
  const x=c.x0-c.sign*c.f;
  const entries=[['B1',{type:'Beam',p1:{x,y:-c.y0-c.sign*c.width/2},
    p2:{x,y:-c.y0+c.sign*c.width/2},brightness:c.brightness,emisAngle:0,random:false,lambert:false}]];
  if(c.include1)entries.push(['L1',lens(c.x0,c.y0,c.aperture1)]);
  if(c.include2)entries.push(['L2',lens(c.x0+c.sign*3*c.f,c.y0+c.d,c.aperture2)]);
  for(const [id,k] of [['D1',4],['D2',6]]){
    const dx=c.x0+c.sign*k*c.f;
    entries.push([id,{type:'Detector',p1:{x:dx,y:-c.y0-c.f},p2:{x:dx,y:-c.y0+c.f},irradMap:false}]);
  }
  return {ids:entries.map(([id])=>id),native:{version:5,name:'Research only: '+c.id,
    objs:entries.map(([,obj])=>obj),width:1200,height:700,scale:1,origin:{x:600,y:350},
    mode:'rays',showGrid:false,gridSize:50,lockObjs:true,rayModeDensity:c.density,
    maxRayDepth:8,simulateColors:false,colorMode:'default',lengthScale:1}};
}
function run(c,{observe=true}={}){
  const {native,ids}=nativeInput(c),serialized=JSON.stringify(native);
  const scene=core.loadNative(native),emissions=[],events=[],rayIds=new WeakMap();
  let starts=0;
  if(observe){
    const source=scene.objs[0],start=source.onSimulationStart;
    source.onSimulationStart=function(...args){
      const out=start.apply(this,args);starts++;
      assert.ok(out.newRays.length>0&&out.newRays.length<=64,'Never clip emission evidence');
      near(out.brightnessScale,1);
      for(const ray of out.newRays){
        const rayId=emissions.length;assert.ok(!rayIds.has(ray));rayIds.set(ray,rayId);
        emissions.push({rayId,point:yup(ray.p1),direction:direction(ray),
          relativePower:ray.brightness_s+ray.brightness_p});
      }
      return out;
    };
    ids.forEach((id,i)=>{
      if(id==='B1')return;
      const obj=scene.objs[i],incident=obj.onRayIncident;
      obj.onRayIncident=function(...args){
        const ray=args[0],rayId=rayIds.get(ray),point=yup(args[2]),incoming=direction(ray);
        assert.ok(Number.isInteger(rayId),'No invented attribution for an unknown native ray');
        const out=incident.apply(this,args); // exactly one unchanged native delegation
        assert.ok(events.length<512,'Never silently clip incident evidence');
        assert.ok(!out?.isAbsorbed&&!out?.newRays?.length,'Unexpected native branching in this bounded probe');
        events.push({rayId,id,point,incoming,outgoing:direction(ray)});
        return out;
      };
    });
  }
  const sim=new core.Simulator(scene,null,null,null,null,null,false,c.processedRayLimit);
  const terminal=[];
  for(const type of ['simulationComplete','simulationStop'])sim.on(type,()=>terminal.push(type));
  sim.updateSimulation();
  assert.equal(terminal.length,1,'Require one terminal native callback');
  if(observe)assert.equal(starts,1);
  assert.equal(JSON.stringify(native),serialized,'Observer must not mutate native input');
  const stats={event:terminal[0],processed:sim.processedRayCount,truncation:sim.totalTruncation,
    undefinedBehavior:sim.totalUndefinedBehavior,
    errors:[scene.error,sim.error,...scene.objs.map(o=>o.getError())].filter(Boolean),
    warnings:[scene.warning,sim.warning,...scene.objs.map(o=>o.getWarning())].filter(Boolean),
    detectorPower:Object.fromEntries(ids.flatMap((id,i)=>id.startsWith('D')?[[id,scene.objs[i].power]]:[]))};
  const complete=stats.event==='simulationComplete'&&stats.truncation===0&&stats.undefinedBehavior===0&&stats.errors.length===0;
  return {id:c.id,config:c,native,nativeSha256:hash(serialized),stats,complete,emissions,events,
    coordinateConvention:'mm, y-up',researchOnly:true,publicQualification:false};
}
// Independent algebraic fit of observed outgoing lines. No expected focal
// coordinate is supplied. Parallel/singleton/partial-run data has no fit.
function intersection(observations){
  if(observations.length<2)return null;
  const lines=observations.map(e=>{
    const m=e.incoming.y/e.incoming.x;
    return {m,b:e.point.y-m*e.point.x};
  });
  assert.ok(lines.every(e=>Number.isFinite(e.m)&&Number.isFinite(e.b)));
  const mean=k=>lines.reduce((n,e)=>n+e[k],0)/lines.length;
  const m=mean('m'),b=mean('b');
  const den=lines.reduce((n,e)=>n+(e.m-m)**2,0);
  if(den<1e-20)return null;
  const x=-lines.reduce((n,e)=>n+(e.m-m)*(e.b-b),0)/den,y=m*x+b;
  return {x,y,maxResidual:Math.max(...lines.map(e=>Math.abs(e.m*x+e.b-y))),count:lines.length,
    meaning:'least-squares line intersection estimate; residual determines concurrence, not physical image detection'};
}
function evaluate(r){
  if(!r.complete)return {...r,qualifiedResearchFit:null,analysisWithheld:'incomplete-native-run'};
  const {config:c}=r;
  assert.deepEqual(r.stats.errors,[]);assert.deepEqual(r.stats.warnings,[]);
  const expectedCount=Math.floor(c.width*c.density+.5);
  assert.equal(r.emissions.length,expectedCount);
  const bothIds=[];
  for(const s of r.emissions){
    near(s.direction.x,c.sign);near(s.direction.y,0);
    near(s.point.x,c.x0-c.sign*c.f);
    const events=r.events.filter(e=>e.rayId===s.rayId),names=events.map(e=>e.id);
    assert.equal(names.filter(id=>id==='D1').length,1);
    assert.equal(names.filter(id=>id==='D2').length,1);
    assert.deepEqual(names,[...(['L1','L2'].filter(id=>names.includes(id))),'D1','D2']);
    const a=s.point.y-c.y0,l1=events.find(e=>e.id==='L1'),l2=events.find(e=>e.id==='L2');
    assert.equal(Boolean(l1),c.include1,'Every emitted sample fits first-lens aperture in these fixtures');
    if(l1){near(l1.point.y-c.y0,a);near(l1.outgoing.y/(c.sign*l1.outgoing.x),-a/c.f);}
    if(l2){
      near(l2.point.y-c.y0,l1?-2*a:a);
      near(l2.outgoing.y/(c.sign*l2.outgoing.x),l1?(a+c.d)/c.f:(c.d-a)/c.f);
    }
    if(l1&&l2)bothIds.push(s.rayId);
    // Compare actual detector events with separate scalar references, including
    // rays that passed outside a finite lens. Missing a lens never absorbs a ray.
    for(const [id,k] of [['D1',4],['D2',6]]){
      const e=events.find(e=>e.id===id);
      const y=l1?(l2?-2*a+(k-3)*(a+c.d):a*(1-k)):(l2?a+(k-3)*(c.d-a):a);
      near(e.point.x,c.x0+c.sign*k*c.f);near(e.point.y,c.y0+y);
    }
  }
  assert.equal(bothIds.length,c.both);
  const observed=r.events.filter(e=>e.id==='D1'&&bothIds.includes(e.rayId));
  const fit=intersection(observed);
  if(c.both>=2){
    assert.ok(fit);near(fit.x,c.x0+c.sign*5*c.f);near(fit.y,c.y0+2*c.d);near(fit.maxResidual,0);
  }else assert.equal(fit,null);
  return {...r,bothLensRayIds:bothIds,qualifiedResearchFit:fit,
    allRayDiagnosticIntersection:intersection(r.events.filter(e=>e.id==='D1'))};
}

test('research native decentered two-lens beam: signed offsets, invariance, real finite misses and incomplete suppression',async()=>{
  const pin=JSON.parse(await readFile(new URL('upstream-pin.json',root)));
  assert.equal(pin.commit,protocol.upstreamCommit);
  const output=new URL('test-artifacts/llm-authoring/jee-decentered-beam-research-v1/',root);
  await mkdir(output,{recursive:true});
  await writeFile(new URL('protocol.json',output),bytes,{flag:'wx'});
  const results=[];
  try{
    for(const item of protocol.cases){
      const c={...protocol.defaults,...item},raw=run(c);
      // Save raw evidence BEFORE assertions, including failures and stopped runs.
      await writeFile(new URL(item.id+'.json',output),JSON.stringify(raw,null,2)+'\n',{flag:'wx'});
      if(c.incomplete){
        assert.equal(raw.complete,false);assert.equal(raw.stats.event,'simulationStop');
        const r=evaluate(raw);assert.equal(r.qualifiedResearchFit,null);results.push(r);
      }else{
        assert.equal(raw.complete,true,'Expected complete native trace: '+c.id);
        results.push(evaluate(raw));
      }
      const r=results.at(-1);
      console.log('DECENTERED_NATIVE_RESEARCH '+JSON.stringify({id:r.id,complete:r.complete,
        emitted:r.emissions.length,both:r.bothLensRayIds?.length??null,fit:r.qualifiedResearchFit,
        nativeSha256:r.nativeSha256,researchOnly:true,publicQualification:false}));
    }
    const baseline=results.find(r=>r.id==='positive-offset');
    const repeat=run(baseline.config);
    assert.deepEqual(repeat.emissions,baseline.emissions);assert.deepEqual(repeat.events,baseline.events);
    for(const id of ['positive-offset','finite-second-lens-misses']){
      const observed=results.find(r=>r.id===id),unobserved=run(observed.config,{observe:false});
      assert.deepEqual(observed.stats,unobserved.stats,'Observation must not change native aggregate behavior');
    }
    const noLens=results.find(r=>r.id==='free-space');assert.equal(noLens.allRayDiagnosticIntersection,null);
    const oneLens=results.find(r=>r.id==='first-lens-only');
    near(oneLens.allRayDiagnosticIntersection.x,oneLens.config.f);
    near(oneLens.allRayDiagnosticIntersection.y,0);
    const mixed=results.find(r=>r.id==='finite-second-lens-misses');
    assert.ok(mixed.allRayDiagnosticIntersection.maxResidual>.1,'A mixed bypass beam must not fake a common focus');
    await writeFile(new URL('report.json',output),JSON.stringify({status:'passed',researchOnly:true,
      productionSupportClaim:false,originalJ19SolvedClaim:false,protocolSha256:hash(bytes),
      upstreamCommit:pin.commit,baselineCommit:protocol.baselineCommit,node:process.version,
      executionCommit:process.env.GITHUB_SHA??null,results},null,2)+'\n',{flag:'wx'});
  }catch(error){
    await writeFile(new URL('failure.json',output),JSON.stringify({status:'failed',message:String(error),
      stack:error.stack,completedCaseIds:results.map(r=>r.id),protocolSha256:hash(bytes)},null,2)+'\n',{flag:'wx'});
    throw error;
  }
});

test('research does not widen public centered-lens or v19 single-lens beam admission',async()=>{
  const example=JSON.parse(await readFile(new URL('examples/jee-parallel-lens-v19.json',root)));
  assert.doesNotThrow(()=>prepareScene(example.physical));
  const offset=structuredClone(example.physical);
  offset.components.find(c=>c.type==='ideal-lens').parameters.y=2;
  assert.throws(()=>prepareScene(offset));
  const multi=structuredClone(example.physical);
  multi.components.push({id:'L2',type:'ideal-lens',parameters:{x:300,focalLength:100,apertureHeight:100}});
  assert.throws(()=>prepareScene(multi));
});
