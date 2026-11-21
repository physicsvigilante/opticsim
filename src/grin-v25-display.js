// Instance-local presentation scaling for native v25 millimetre GRIN optics.
// Pinned CanvasRenderer uses its lengthScale for source glyphs and ray strokes.
// NEVER change scene.lengthScale (native geometry/tolerance) or any ray callback.
export const GRIN_V25_DISPLAY_METHOD='v25-visual-canvas-marker-scale-only-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const renderers=['canvasRendererMain','canvasRendererBelowLight','canvasRendererAboveLight'];
export function installGrinV25DisplayScale(doc,scene,simulator){
 const legacy=doc?.schemaVersion===25&&doc?.physics?.model==='native-bounded-grin-tracing';
 const entering=doc?.schemaVersion===33&&doc?.physics?.model==='native-entering-graded-slab';
 if(!legacy&&!entering)return null;
 if(!scene||!simulator||simulator.scene!==scene||!Array.isArray(scene.objs)||
    scene.objs.length!==3||!finite(scene.scale)||!finite(scene.lengthScale)||
    !finite(simulator.dpr))
  throw Error('v25 visual adapter requires a bounded valid per-run native renderer');
 const markerScale=1/(scene.scale*simulator.dpr);
 if(!finite(markerScale))throw Error('v25 visual scale is not finite and positive');
 // Check ALL original native draw delegates before installing ANY adapter.
 const originals=scene.objs.map(obj=>obj?.draw);
 if(originals.some(f=>typeof f!=='function'))
  throw Error('v25 native optical object has no drawing delegate');
 const sceneNumericalLengthScale=scene.lengthScale;
 for(const [i,obj] of scene.objs.entries()){
  const original=originals[i];
  obj.draw=function(...args){
   // New renderers are created every updateSimulation, before object drawing.
   // Ray and material rendering later use the same instance-local renderers.
   for(const key of renderers){
    const renderer=simulator[key];
    if(renderer){
     if(!finite(renderer.lengthScale))
      throw Error('v25 drawing renderer has invalid length scale');
     renderer.lengthScale=markerScale;
    }
   }
   return original.apply(this,args); // delegate pinned native drawing ONCE
  };
 }
 return Object.freeze({method:legacy?GRIN_V25_DISPLAY_METHOD:'v33-visual-canvas-marker-scale-only-v1',
  visualMarkerWorldLength:markerScale,
  originalNativeSceneLengthScale:sceneNumericalLengthScale,
  altersNativeGeometry:false,altersRayPropagation:false});
}
