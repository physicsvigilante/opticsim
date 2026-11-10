import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validate, setParameter, parseSave, serializeSave } from '../src/contract.js';
import { predict } from '../src/analysis.js';
const { compile, loadDocument, loadNative, nativeExport, Simulator, IdealLens, Scene, diagnostics, Session } = createRequire(import.meta.url)('../dist/test-core.cjs');
const example = name => JSON.parse(readFileSync(new URL(`../scenes/${name}.json`, import.meta.url)));
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const single = (x = -300, focal = 100) => setParameter(setParameter(example('single-lens'), 'source-1', 'x', x), 'lens-1', 'focalLength', focal);

test('declared examples validate and use the same compiler; stable IDs survive saves and native export', () => {
  for (const name of ['single-lens', 'two-lenses', 'diverging-pair']) {
    const doc = validate(example(name));
    assert.deepEqual(parseSave(serializeSave(doc)), doc);
    const loaded = loadDocument(doc);
    assert.equal(loaded.scene.error, null);
    assert.equal(loaded.idMap.get('source-1'), 0);
    assert.equal(loaded.scene.objs[0].y, -10);
    const native = JSON.parse(nativeExport(doc));
    assert.equal(native.version, 5);
    assert.ok(native.objs.every(o => !('id' in o) && !('parameters' in o)));
    const reloaded = loadNative(native);
    assert.deepEqual(reloaded.objs.map(o => o.serialize()), loaded.scene.objs.map(o => o.serialize()));
    assert.equal(doc.upstreamCommit, '811f508d2b070898c241a568b0c167dcb8645251');
  }
  const compiled = compile(single());
  assert.deepEqual(compiled.native.objs[1], { type: 'IdealLens', p1: {x:0,y:-90}, p2:{x:0,y:90}, focalLength:100 });
});
test('reject invalid, unknown, and out-of-scope scenes with paths instead of repairing values', () => {
  const changes = [d => {d.schemaVersion=5;}, d=>{d.upstreamCommit='moving';}, d=>{d.physics.lengthUnit='cm';},
    d=>{d.physics.components[1].id='source-1';}, d=>{d.physics.components[1].type='thick-lens';},
    d=>{d.physics.components[1].parameters.focalLength=0;},d=>{d.physics.components[0].parameters.x=0;},
    d=>{d.physics.components[0].parameters.y=NaN;},d=>{d.physics.components[1].parameters.apertureHeight=-1;},
    d=>{d.physics.components[1].parameters.id='x';}, d=>{d.simulation.maxRayDepth=2.5;},
    d=>{d.physics.components.push({...d.physics.components[1],id:'lens-3'}, {...d.physics.components[1],id:'lens-4'});}];
  for (const change of changes) { const doc = single(); change(doc); assert.throws(()=>validate(doc), /\$/); }
  assert.throws(()=>parseSave(nativeExport(single())), /\$/);
  assert.throws(()=>setParameter(single(),'missing','x',4), /unknown parameter/);
});
test('independent lens-equation cases, virtual image, diverging lens, infinity, and both sides of infinity', () => {
  for (const [x,f,imageX,imageY,m] of [[-300,100,150,-5,-.5],[-50,100,-100,20,2],[-300,-100,-75,2.5,.25]]) {
    const result = predict(single(x,f)); near(result.x,imageX);near(result.y,imageY);near(result.magnification,m);
    assert.equal(result.kind, imageX > 0 ? 'finite-real' : 'finite-virtual');
  }
  assert.deepEqual(predict(single(-100)),{kind:'at-infinity',tolerance:1e-10});
  assert.equal(predict(single(-100.001)).kind,'finite-real');
  assert.equal(predict(single(-99.999)).kind,'finite-virtual');
  const pair = predict(example('two-lenses'));near(pair.x,550);near(pair.y,5);near(pair.magnification,.5);
  const intermediateInfinity=setParameter(example('two-lenses'),'source-1','x',-100);
  near(predict(intermediateInfinity).x,450);near(predict(intermediateInfinity).y,-10);
  const finalInfinity=setParameter(example('two-lenses'),'lens-2','x',250);
  assert.equal(predict(finalInfinity).kind,'at-infinity');
});
test('native lens interactions agree with independent ray slopes and known finite/virtual images', () => {
  for (const [sourceX,f,imageX,imageY] of [[-300,100,150,-5],[-50,100,-100,20],[-300,-100,-75,2.5],[-100,100,null,null]]) {
    const scene = new Scene();
    const lens = new IdealLens(scene,{type:'IdealLens',p1:{x:0,y:-90},p2:{x:0,y:90},focalLength:f});
    for (const h of [-30,0,25]) {
      const ray = {p1:{x:sourceX,y:-10},p2:{x:0,y:-h},brightness_s:.5,brightness_p:.5};
      const point = lens.checkRayIntersects(ray);assert.ok(point);
      lens.onRayIncident(ray,0,point);
      const slope = -(ray.p2.y-ray.p1.y)/(ray.p2.x-ray.p1.x);
      const expected = (h-10)/(-sourceX)-h/f;
      near(slope,expected,1e-9);
      if(imageX===null) near(slope,-.1,1e-9); else near(h+slope*imageX,imageY);
    }
  }
});
// Full native simulation, no ray-history assumption. Detector bins observe individual
// rays at two downstream planes. A separate run for each ray keeps the measurement unambiguous.
test('bounded Simulator + detectors agree with independent forward propagation for real, virtual, infinity and two-lens cases', () => {
  for(const doc of [single(),single(-50),single(-100),single(-300,-100),example('two-lenses'),example('diverging-pair'),setParameter(example('two-lenses'),'source-1','x',-100),setParameter(example('two-lenses'),'lens-2','x',250)]) {
    const compiled=compile(doc).native;
    const source=compiled.objs[0];const lenses=compiled.objs.slice(1).sort((a,b)=>a.p1.x-b.p1.x);
    for(const firstHeight of [-20,20]) {
      const initialSlope=(firstHeight+source.y)/(lenses[0].p1.x-source.x);
      let y=-source.y,x=source.x,slope=initialSlope;
      for(const lens of lenses){y+=slope*(lens.p1.x-x);x=lens.p1.x;slope-=y/lens.focalLength;}
      const planes=[x+50,x+100];
      const detectors=planes.map(px=>({type:'Detector',p1:{x:px,y:-200},p2:{x:px,y:200},irradMap:true,binSize:.01}));
      const native={...compiled,objs:[{type:'SingleRay',p1:{x:source.x,y:source.y},p2:{x:lenses[0].p1.x,y:-firstHeight},brightness:1},...lenses,...detectors]};
      const scene=loadNative(native);const sim=new Simulator(scene,null,null,null,null,null,false,10000);
      let event;sim.on('simulationComplete',()=>{event='complete';});sim.on('simulationStop',()=>{event='stop';});sim.updateSimulation();
      assert.equal(event,'complete');assert.equal(sim.totalTruncation,0);assert.equal(sim.totalUndefinedBehavior,0);
      assert.deepEqual(diagnostics(scene,sim).errors,[]);
      scene.objs.slice(-2).forEach((detector,i)=>{
        const bins=detector.binData.flatMap((v,j)=>v!==0?[j]:[]);assert.equal(bins.length,1);
        const expectedNativeY=-(y+slope*(planes[i]-x));
        const low=-200+bins[0]*.01;
        assert.ok(expectedNativeY>=low-1e-7&&expectedNativeY<=low+.01+1e-7,`${expectedNativeY} outside observed [${low},${low+.01}]`);
      });
    }
  }
});
test('native limits expose stop and interaction-depth truncation', () => {
  for(const [key,value,expected] of [['processedRayLimit',1,'stopped'],['maxRayDepth',0,'incomplete']]) {
    const doc=single();doc.simulation[key]=value;const {scene}=loadDocument(doc);
    const sim=new Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
    let state;for(const event of ['simulationStop','simulationComplete'])sim.on(event,()=>{const d=diagnostics(scene,sim);state=event==='simulationStop'?'stopped':d.truncation>0?'incomplete':'complete';});sim.updateSimulation();
    assert.equal(state,expected);
  }
});
test('session invalidation, run failure, stops/truncation, and late completions never publish stale predictions', () => {
  const callbacks=[];let throws=false;
  const s=new Session(()=>{if(throws)throw Error('native failure');return{cancel(){},run(cb){callbacks.push(cb);}};},()=>{});
  const success={errors:[],warnings:[],processed:2,truncation:0,undefinedBehavior:0};
  s.apply(single());const first=s.revision;s.apply(single(-50));callbacks[0]('simulationComplete',success);
  assert.equal(s.state,'running');assert.ok(s.revision>first);near(s.prediction.x,-100);
  callbacks[1]('simulationComplete',success);assert.equal(s.state,'completed');
  const invalid=single();invalid.physics.components[1].parameters.focalLength=0;s.apply(invalid);
  assert.equal(s.state,'invalid');assert.equal(s.prediction,null);near(s.document.physics.components[0].parameters.x,-50);
  callbacks[1]('simulationComplete',success);assert.equal(s.state,'invalid');
  s.apply(single());s.stop();assert.equal(s.state,'stopped');assert.equal(s.prediction,null);
  s.apply(single());callbacks.at(-1)('simulationComplete',{...success,truncation:1});assert.equal(s.state,'incomplete');assert.equal(s.prediction,null);
  s.apply(single());callbacks.at(-1)('simulationStop',success);assert.equal(s.state,'stopped');assert.equal(s.prediction,null);
  throws=true;s.apply(single());assert.equal(s.state,'invalid');assert.equal(s.prediction,null);
  const failed=new Session(()=>({cancel(){},run(){throw Error('run failed');}}),()=>{});failed.apply(single());assert.equal(failed.state,'failed');assert.equal(failed.prediction,null);
});
