import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validate, parseSave, serializeSave, ValidationError } from '../src/contract.js';
import { predict } from '../src/analysis.js';
const { compile, loadDocument, loadNative, nativeExport, Simulator, diagnostics, Session } =
  createRequire(import.meta.url)('../dist/test-core.cjs');
const example = name => JSON.parse(readFileSync(new URL('../scenes/' + name + '.json', import.meta.url)));
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a-b) <= epsilon, String(a) + ' != ' + String(b));
const source = d => d.physics.components.find(c => c.type === 'point-source');
const lenses = d => d.physics.components.filter(c => c.type === 'ideal-lens').sort((a,b) => a.parameters.x - b.parameters.x);

test('v4 accepts data-only three/four-lens trains and preserves IDs and compiler order', () => {
  for (const name of ['three-lenses', 'four-lenses']) {
    const d = example(name), n = lenses(d).length;
    assert.equal(n, name === 'three-lenses' ? 3 : 4);
    assert.equal(validate(d), d);
    assert.deepEqual(parseSave(serializeSave(d)), d);
    const reordered = structuredClone(d);
    reordered.physics.components.reverse();
    assert.deepEqual(predict(reordered), predict(d));
    const native = compile(reordered);
    assert.deepEqual([...native.idMap.keys()], reordered.physics.components.map(c => c.id));
    for (const [id,index] of native.idMap) assert.equal(reordered.physics.components[index].id, id);
    assert.equal(native.native.objs.filter(o => o.type === 'IdealLens').length, n);
    assert.deepEqual(loadDocument(reordered).scene.objs.map(o=>o.serialize()),
      loadNative(JSON.parse(nativeExport(reordered))).objs.map(o=>o.serialize()));
    assert.ok(JSON.parse(nativeExport(reordered)).objs.every(o => !('id' in o) && !('parameters' in o)));
  }
});

test('five correctly spaced lenses reject on count, independently of geometry and IDs', () => {
  const d = example('four-lenses');
  d.physics.components.push({id:'lens-5',type:'ideal-lens',
    parameters:{x:550,focalLength:125,apertureHeight:180}});
  assert.equal(new Set(d.physics.components.map(c=>c.id)).size, 6);
  const xs = lenses(d).map(l=>l.parameters.x);
  assert.ok(xs.every((x,i)=>i===0 || x-xs[i-1]>=0.01));
  assert.throws(() => validate(d), error => error instanceof ValidationError &&
    error.code === 'UNSUPPORTED_SCOPE' && error.path === '$.physics.components');
  for(const change of [
    a=>a.physics.components[2].parameters.x=a.physics.components[1].parameters.x,
    a=>source(a).parameters.x=0,
    a=>a.physics.components[2].id=a.physics.components[1].id,
    a=>a.physics.components.push({id:'mirror-1',type:'plane-mirror',parameters:{x:700,y:0,orientationDeg:90,length:200}})
  ]) {
    const bad = example('three-lenses');change(bad);
    assert.throws(()=>validate(bad), /\$/);
  }
});

test('old versions never acquire three-lens scope by migration', () => {
  for (const version of [1,2,3]) {
    const doc = example('three-lenses');
    doc.schemaVersion = doc.adapterVersion = version;
    if(version === 1) {
      delete source(doc).parameters.brightness;
      delete source(doc).emission;
      doc.presentation.brightness = 0.5;
      doc.simulation.rayDensity = 0.1;
    }
    assert.throws(() => parseSave(JSON.stringify(doc)), error =>
      error.code === 'UNSUPPORTED_SCOPE' && error.path === '$.physics.components');
  }
  for(const version of [1,2,3]) {
    const d = example('two-lenses');
    d.schemaVersion=d.adapterVersion=version;
    if(version === 1) {
      delete source(d).parameters.brightness;
      delete source(d).emission;
      d.presentation.brightness=.073219;
      d.simulation.rayDensity=.1; // Version 1 had a minimum density of 0.1.
    } else d.simulation.rayDensity=.137891;
    const migrated=parseSave(JSON.stringify(d));
    assert.equal(migrated.schemaVersion,4);
    assert.deepEqual(migrated.physics.components.map(c=>c.id),d.physics.components.map(c=>c.id));
    assert.equal(migrated.simulation.rayDensity,d.simulation.rayDensity);
    if(version === 1) assert.equal(source(migrated).parameters.brightness,.073219);
  }
});

test('three/four-lens ABCD predictions match fixed independent scalar expectations', () => {
  const three = predict(example('three-lenses'));
  assert.equal(three.kind, 'finite-virtual');
  near(three.x, 260 - 6600/73);
  near(three.magnification, -50/219);
  near(three.y, -500/219);
  const four = predict(example('four-lenses'));
  assert.equal(four.kind,'finite-real');
  near(four.x,820);
  near(four.magnification,3);
  near(four.y,30);

  const collimatedBetween = example('four-lenses');
  source(collimatedBetween).parameters.x=-100; // Parallel output after first lens, not necessarily at the last.
  assert.equal(predict(collimatedBetween).kind, 'finite-real');
  near(predict(collimatedBetween).x,460);
  const infinity=example('three-lenses');
  const infLenses=lenses(infinity);
  infLenses[0].parameters.focalLength=100;
  infLenses[1].parameters.focalLength=-100;
  infLenses[1].parameters.x=150;
  infLenses[2].parameters.x=300;
  infLenses[2].parameters.focalLength=150;
  const p=predict(infinity);
  assert.equal(p.kind,'at-infinity');
  assert.equal('x' in p,false);
  assert.equal('magnification' in p,false);
});

test('numerically ill-conditioned lens train withholds analysis without rejecting native scene', () => {
  const d=example('three-lenses');
  source(d).parameters.x=-9000;
  for (const [i,l] of lenses(d).entries()) {
    l.parameters.x=i*150;
    l.parameters.focalLength=1;
  }
  const analysis=predict(d);
  assert.equal(analysis.kind,'unavailable');
  assert.match(analysis.reason,/numerically unreliable/);
  assert.equal(validate(d),d);
  const loaded=loadDocument(d);
  assert.equal(loaded.scene.error,null);
  assert.equal(JSON.parse(nativeExport(d)).objs.length,4);
  const completed={errors:[],warnings:[],processed:10,truncation:0,undefinedBehavior:0};
  const session=new Session(()=>({cancel(){},run(cb){cb('simulationComplete',completed);}}),()=>{});
  assert.equal(session.apply(d),true);
  assert.equal(session.state,'completed');
  assert.equal(session.analysisStatus,'unavailable');
  assert.equal(session.prediction,null);
});

test('native detectors and lens incident observers verify traversal for composed lens trains', () => {
  for(const name of ['three-lenses','four-lenses']) {
    const authored=example(name);
    authored.physics.components.reverse();
    const compiled=compile(authored), sorted=lenses(authored);
    const orderedNative=sorted.map(l=>compiled.native.objs[compiled.idMap.get(l.id)]);
    for(const h0 of [-20,20]) {
      const s=source(authored).parameters;
      const probe={type:'SingleRay',p1:{x:s.x,y:-s.y},p2:{x:sorted[0].parameters.x,y:-h0},brightness:1};
      const [after1,after2]=[sorted.at(-1).parameters.x+50,sorted.at(-1).parameters.x+100];
      const detectors=[after1,after2].map(x=>({type:'Detector',p1:{x,y:-200},p2:{x,y:200},irradMap:true,binSize:.01}));
      const scene=loadNative({...compiled.native,objs:[probe,...orderedNative,...detectors]});
      const hits=[];
      for(const [i,obj] of scene.objs.slice(1,sorted.length+1).entries()){
        const nativeIncident=obj.onRayIncident;
        obj.onRayIncident=function (...args){ hits.push(sorted[i].id);return nativeIncident.apply(this,args); };
      }
      const simulator=new Simulator(scene,null,null,null,null,null,false,10000);
      let event=null;simulator.on('simulationComplete',()=>{event='simulationComplete';});
      simulator.on('simulationStop',()=>{event='simulationStop';});
      simulator.updateSimulation();
      const data=diagnostics(scene,simulator);
      assert.equal(event,'simulationComplete');
      assert.deepEqual(data.errors,[]);
      assert.equal(data.truncation,0);
      assert.equal(data.undefinedBehavior,0);
      assert.deepEqual(hits,sorted.map(l=>l.id));
      let x=s.x,y=s.y,slope=(h0-s.y)/(sorted[0].parameters.x-s.x);
      for(const lens of sorted) {
        y+=slope*(lens.parameters.x-x);
        x=lens.parameters.x;
        slope-=y/lens.parameters.focalLength;
      }
      for(const [i,detector] of scene.objs.slice(-2).entries()){
        const nativeExpectedY=-(y+slope*([after1,after2][i]-x));
        const bins=detector.binData.flatMap((v,j)=>v!==0?[j]:[]);
        assert.equal(bins.length,1);
        const low=-200+bins[0]*.01;
        assert.ok(nativeExpectedY>=low-1e-7 && nativeExpectedY<=low+.01+1e-7);
      }
    }
  }
});

test('finite aperture miss occurs naturally without enforcing the idealized full-lens path',()=>{
  const d=example('three-lenses'), ordered=lenses(d);
  ordered[1].parameters.apertureHeight=1;
  const n=compile(d).native;
  const s=source(d).parameters;
  const probe={type:'SingleRay',p1:{x:s.x,y:-s.y},p2:{x:ordered[0].parameters.x,y:-20},brightness:1};
  const scene=loadNative({...n,objs:[probe,...n.objs.slice(1)]}),hits=[];
  for(const [i,obj] of scene.objs.slice(1).entries()){
    const original=obj.onRayIncident;
    obj.onRayIncident=function (...args){hits.push(ordered[i].id);return original.apply(this,args);};
  }
  const sim=new Simulator(scene,null,null,null,null,null,false,10000);
  sim.updateSimulation();
  assert.equal(hits[0],'lens-1');
  assert.ok(!hits.includes('lens-2'));
  assert.equal(predict(d).kind,'finite-virtual'); // A prediction, not measured throughput.
});


test('native tracing is invariant to authored component ordering without reordering PhyDemo objects', () => {
  // This tests the actual authored -> compiler -> native route. Only the source
  // is replaced by a test-only SingleRay; all lenses retain authored object order.
  for (const name of ['three-lenses', 'four-lenses']) {
    const base = example(name);
    const normal = base.physics.components.map(c => c.id);
    const shuffled = name === 'three-lenses'
      ? ['lens-3', 'source-1', 'lens-1', 'lens-2']
      : ['lens-4', 'lens-2', 'source-1', 'lens-1', 'lens-3'];
    assert.deepEqual(new Set(shuffled), new Set(normal));
    assert.notDeepEqual(shuffled.filter(id => id !== 'source-1'), lenses(base).map(l => l.id));
    const outcomes = [];

    for (const order of [normal, shuffled]) {
      const doc = structuredClone(base);
      const components = new Map(doc.physics.components.map(c => [c.id, c]));
      doc.physics.components = order.map(id => components.get(id));
      validate(doc);
      const { native, idMap } = compile(doc);
      assert.deepEqual([...idMap.keys()], order);
      assert.equal(idMap.get('source-1'), order.indexOf('source-1'));
      const physical = lenses(doc), src = source(doc).parameters;
      const first = physical[0], last = physical.at(-1);
      const planes = [last.parameters.x + 50, last.parameters.x + 100];
      const observedCases = [];

      for (const height of [-20, 20]) {
        const objs = native.objs.slice(); // Retain native authored order exactly.
        objs[idMap.get('source-1')] = { type: 'SingleRay',
          p1: { x: src.x, y: -src.y },
          p2: { x: first.parameters.x, y: -height }, brightness: 1 };
        objs.push(...planes.map(x => ({type:'Detector',
          p1:{x,y:-200},p2:{x,y:200},irradMap:true,binSize:.01})));
        const scene = loadNative({ ...native, objs });
        assert.equal(scene.objs[idMap.get('source-1')].constructor.type, 'SingleRay');
        const hits = [];

        for (const lens of physical) {
          const object = scene.objs[idMap.get(lens.id)];
          assert.equal(object.constructor.type, 'IdealLens');
          const incident = object.onRayIncident;
          object.onRayIncident = function (ray, index, point, ...rest) {
            const entering = -(ray.p2.y-ray.p1.y)/(ray.p2.x-ray.p1.x);
            const result = incident.call(this, ray, index, point, ...rest);
            const leaving = -(ray.p2.y-ray.p1.y)/(ray.p2.x-ray.p1.x);
            hits.push({id:lens.id, x:point.x, y:-point.y, entering, leaving});
            return result;
          };
        }

        const sim = new Simulator(scene,null,null,null,null,null,false,10000);
        let finished = null;
        sim.on('simulationComplete', () => { finished = 'completed'; });
        sim.on('simulationStop', () => { finished = 'stopped'; });
        sim.updateSimulation();
        const data = diagnostics(scene,sim);
        assert.equal(finished,'completed');
        assert.deepEqual(data.errors,[]);
        assert.equal(data.truncation,0);
        assert.equal(data.undefinedBehavior,0);
        assert.deepEqual(hits.map(hit => hit.id),physical.map(lens => lens.id));

        // Independent paraxial heights and slopes, in semantic y-up units.
        let x = src.x, y = src.y, slope = (height-src.y)/(first.parameters.x-src.x);
        for (const [i,lens] of physical.entries()) {
          y += slope * (lens.parameters.x-x);
          x = lens.parameters.x;
          near(hits[i].x,x,1e-7);
          near(hits[i].y,y,1e-7);
          near(hits[i].entering,slope,1e-9);
          slope -= y/lens.parameters.focalLength;
          near(hits[i].leaving,slope,1e-9);
        }

        const binsForBothDetectors = [];
        for (const [i, detector] of scene.objs.slice(-2).entries()) {
          const bins = detector.binData.flatMap((power, j) => power !== 0 ? [j] : []);
          assert.equal(bins.length,1);
          const expectedY = -(y+slope*(planes[i]-x));
          const binStart = -200+bins[0]*.01;
          assert.ok(expectedY>=binStart-1e-7 && expectedY<=binStart+.01+1e-7);
          binsForBothDetectors.push(bins[0]);
        }
        observedCases.push({hitIds:hits.map(hit=>hit.id),bins:binsForBothDetectors});
      }
      outcomes.push(observedCases);
    }
    assert.deepEqual(outcomes[1],outcomes[0],name+' reordered native rays differ');
  }
});
