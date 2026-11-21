import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {mirrorEndpoints} from '../src/contract.js';
import {compileFiniteAperture} from '../src/finite-aperture.js';

const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const bytes=readFileSync(new URL('../research/native-post-lens-aperture/frozen-protocol.json',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const protocol=JSON.parse(bytes);
const tolerance=1e-6;
const sorted=values=>[...values].sort((a,b)=>a-b);
function agree(observed,expected) {
  const a=sorted(observed),b=sorted(expected);
  return a.length===b.length && a.every((v,i)=>Math.abs(v-b[i])<=tolerance);
}
function components(p) {
  const shift=p.translateX??0;
  return [
    {id:'B',type:'parallel-beam',parameters:{x:p.beamX+shift,y:p.beamY,width:p.beamWidth,directionDeg:p.directionDeg,brightness:p.brightness}},
    {id:'L',type:'ideal-lens',parameters:{x:p.lensX+shift,focalLength:p.focalLength,apertureHeight:p.lensHeight}},
    {id:'A',type:'finite-aperture',parameters:{x:p.stopX+shift,y:p.stopY,orientationDeg:p.orientationDeg,length:p.length,openingLength:p.openingLength}},
    {id:'D',type:'ray-detector',parameters:{x:p.detectorX+shift,y:p.detectorY,orientationDeg:90,length:p.detectorLength}}
  ];
}
function apparatus(p) {
  const parts=components(p),request={lengthUnit:'mm',title:'Synthetic downstream aperture research',runPolicy:'preview-v1',components:parts};
  // The existing public profile must continue to refuse the complete apparatus.
  assert.throws(()=>prepareScene(request),/downstream of a forward ideal lens/);
  const seed=prepareScene({...request,components:parts.filter(c=>c.id!=='A')}).document;
  assert.equal(seed.schemaVersion,19);
  seed.simulation.rayDensity=p.density;
  const {native}=core.compile(seed);
  native.objs.push(compileFiniteAperture(parts.find(c=>c.id==='A'),mirrorEndpoints));
  native.maxRayDepth=p.maxRayDepth;
  return native;
}
function execute(native,p) {
  const scene=core.loadNative(native);
  const [source,lens,detector,stop]=scene.objs;
  const emissions=[],lensOutput=[],absorbed=[],detected=[];
  const start=source.onSimulationStart;
  source.onSimulationStart=function(...args) {
    const result=start.apply(this,args);
    emissions.push(...result.newRays.map(ray=>-ray.p1.y));
    return result;
  };
  for(const target of [lens,stop,detector]) {
    const original=target.onRayIncident;
    target.onRayIncident=function(ray,index,point,...rest) {
      const location={x:point.x,y:-point.y};
      const result=original.call(this,ray,index,point,...rest);
      if(target===lens)lensOutput.push({hit:location,p1:{x:ray.p1.x,y:-ray.p1.y},p2:{x:ray.p2.x,y:-ray.p2.y}});
      if(target===detector)detected.push(location);
      if(target===stop && result?.isAbsorbed===true)absorbed.push(location);
      return result;
    };
  }
  const simulator=new core.Simulator(scene,null,null,null,null,null,false,p.processedRayLimit);
  let terminal=null;
  for(const event of ['simulationComplete','simulationStop'])simulator.on(event,()=>{terminal=event;});
  simulator.updateSimulation();
  const d=core.diagnostics(scene,simulator);
  const status=core.classifyRun(terminal,d);
  const stopX=p.stopX+(p.translateX??0);
  const project=({p1,p2})=>p1.y+(stopX-p1.x)*(p2.y-p1.y)/(p2.x-p1.x);
  const actualSection=lensOutput.map(project);
  const endpoints=[-p.length/2,-p.openingLength/2,p.openingLength/2,p.length/2].map(y=>p.stopY+y);
  const minimumClearance=actualSection.length?Math.min(...actualSection.flatMap(y=>endpoints.map(edge=>Math.abs(edge-y)))):null;
  let withheld=null;
  if(terminal==='simulationStop')withheld='stopped';
  else if(terminal!=='simulationComplete'||status!=='completed'||d.warnings.length)withheld='incomplete';
  else if(!emissions.length||!agree(lensOutput.map(h=>h.hit.y),emissions))withheld='finite-lens-miss';
  else if(!(minimumClearance>0.1))withheld='endpoint';
  else {
    // Independent thin-lens reference at both planes. An outer miss continues
    // through free space just like a ray through the opening. Only the pinned
    // Aperture callback establishes actual absorption.
    const ideal=(y,x)=>y*(1-(x-p.lensX)/p.focalLength);
    const expectArms=[],expectScreen=[],expectSection=[];
    for(const y of emissions) {
      const stopY=ideal(y,p.stopX),radius=Math.abs(stopY-p.stopY);
      expectSection.push(stopY);
      if(radius>p.openingLength/2 && radius<p.length/2)expectArms.push(stopY);
      else expectScreen.push(ideal(y,p.detectorX));
    }
    if(!agree(actualSection,expectSection)||!agree(absorbed.map(v=>v.y),expectArms)||
       !agree(detected.map(v=>v.y),expectScreen))withheld='cross-section-disagreement';
  }
  return {terminal,status,diagnostics:d,emissions,lensOutput,actualSection,absorbed,detected,minimumClearance,withheld};
}
test('downstream finite aperture: frozen 12-case raw PhyDemo feasibility experiment',()=>{
  assert.equal(sha(bytes),'84cd0d49b44cfc8ed72b454135813c23e61fcf4df6bb50049895311837a67979');
  const root=resolve('test-artifacts/llm-authoring/native-post-lens-aperture');
  mkdirSync(root,{recursive:true});
  const out=mkdtempSync(join(root,'attempt-')),cases=[];
  function save(name,data) {
    const payload=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data,null,2)+'\n');
    writeFileSync(join(out,name),payload,{flag:'wx'});
    return {file:name,sha256:sha(payload)};
  }
  const frozen=save('frozen-protocol.json',bytes);
  for(const c of protocol.cases) {
    const p={...protocol.baseline,...c},native=apparatus(p);
    const input=save(c.id+'.native.json',{native,processedRayLimit:p.processedRayLimit});
    const run=execute(native,p);
    const evidence=save(c.id+'.observations.json',run);
    cases.push({id:c.id,input,evidence,withheld:run.withheld});
    assert.equal(run.withheld,c.withhold??null,c.id);
    if(!c.withhold) {
      assert.equal(run.emissions.length,c.expectedAbsorbed+c.expectedDetector,c.id);
      assert.equal(run.absorbed.length,c.expectedAbsorbed,c.id);
      assert.equal(run.detected.length,c.expectedDetector,c.id);
    }
  }
  save('manifest.json',{frozen,productionBase:protocol.productionBase,phyDemoPin:protocol.phyDemoPin,publicScene:false,cases});
});
