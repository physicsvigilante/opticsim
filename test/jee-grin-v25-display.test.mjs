import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installGrinV25DisplayScale,GRIN_V25_DISPLAY_METHOD}
 from '../src/grin-v25-display.js';

const v25={schemaVersion:25,physics:{model:'native-bounded-grin-tracing'}};
const old={schemaVersion:24,physics:{model:'native-curved-entry-observation-tracing'}};
function mock(scale=80){
 const calls=[],physicalState={rayCount:1,indexSquared:1.5};
 const objs=['SingleRay','GrinGlass','Detector'].map(type=>({
  type,physicalState,
  onRayIncident(){return {isAbsorbed:false};},
  draw(renderer){
   calls.push({type,markerWorldLength:renderer.lengthScale,indexSquared:this.physicalState.indexSquared});
   return 'pinned-'+type;
  }
 }));
 const scene={scale,lengthScale:1,objs},renderer={lengthScale:1};
 const simulator={scene,dpr:1,canvasRendererMain:{lengthScale:1},
  canvasRendererBelowLight:renderer,canvasRendererAboveLight:{lengthScale:1}};
 return {scene,renderer,simulator,calls,priorPhysics:objs.map(o=>o.onRayIncident),
  originalState:structuredClone(physicalState)};
}
test('v25 per-instance draw adapts ONLY screen pen size and delegates pinned original drawings exactly once',()=>{
 const m=mock(),meta=installGrinV25DisplayScale(v25,m.scene,m.simulator);
 assert.equal(meta.method,GRIN_V25_DISPLAY_METHOD);
 assert.equal(meta.visualMarkerWorldLength,1/80);
 for(const obj of m.scene.objs)assert.equal(obj.draw(m.renderer),'pinned-'+obj.type);
 assert.equal(m.calls.length,3);
 assert.ok(m.calls.every(c=>c.markerWorldLength===1/80));
 assert.equal(m.simulator.canvasRendererMain.lengthScale,1/80);
 assert.equal(m.simulator.canvasRendererAboveLight.lengthScale,1/80);
 assert.equal(m.scene.lengthScale,1,'Native geometry tolerance must remain unchanged');
 assert.deepEqual(m.scene.objs.map(o=>o.onRayIncident),m.priorPhysics);
 assert.deepEqual(m.scene.objs[0].physicalState,m.originalState);
 m.simulator.canvasRendererMain={lengthScale:1};
 const next={lengthScale:1};assert.equal(m.scene.objs[1].draw(next),'pinned-GrinGlass');
 assert.equal(m.simulator.canvasRendererMain.lengthScale,1/80);
 assert.equal(m.calls.length,4);
});
test('v25 rendering does not modify older schemas or half-wrap malformed native objects',()=>{
 const m=mock(),draws=m.scene.objs.map(x=>x.draw);
 assert.equal(installGrinV25DisplayScale(old,m.scene,m.simulator),null);
 assert.deepEqual(m.scene.objs.map(x=>x.draw),draws);
 assert.equal(m.simulator.canvasRendererMain.lengthScale,1);
 const bad=mock(),first=bad.scene.objs[0].draw;
 bad.scene.objs[1].draw=null;
 assert.throws(()=>installGrinV25DisplayScale(v25,bad.scene,bad.simulator),/drawing delegate/);
 assert.equal(bad.scene.objs[0].draw,first,'Atomic installation refuses before partial replacement');
});
