// Bounded native numerical DIAGNOSTIC, not a repaired canonical simulation.
// The only native difference is PhyDemo's documented scene.colorMode.
// It controls the native weak-ray cutoff as well as appearance; never report
// the variant as if the original native default completed.
import {validate,serializeSave} from './contract.js';
export const NATIVE_REPLAY_MODES=Object.freeze({
  default:Object.freeze({nativeColorMode:'default',weakReflectedRayCutoff:0.01}),
  linear:Object.freeze({nativeColorMode:'linear',weakReflectedRayCutoff:0.000001})
});
export function nativeNumericalReplay(doc,core,mode='default'){
  validate(doc);
  if(!Object.hasOwn(NATIVE_REPLAY_MODES,mode))throw Error('Unsupported native numerical replay mode');
  if(doc.schemaVersion!==5||doc.physics.model!=='planar-media-tracing')
    throw Error('Native color-mode comparison is currently scoped to v5 planar media only');
  if(!core||typeof core.loadDocument!=='function'||typeof core.Simulator!=='function')
    throw Error('A pinned built native core is required');
  // Never mutate the authored document or its canonical numerical settings.
  const original=serializeSave(doc),loaded=core.loadDocument(structuredClone(doc));
  if(loaded.scene.colorMode!=='default')throw Error('Unexpected native scene default; re-audit upstream pin');
  loaded.scene.colorMode=NATIVE_REPLAY_MODES[mode].nativeColorMode;
  const emission=core.observeSourceSet(doc,loaded.scene,loaded.idMap);
  const mirror=core.observeMirrorSet(doc,loaded.scene,loaded.idMap);
  const detector=core.observeDetectorSet(doc,loaded.scene,loaded.idMap);
  const interfaces=core.observeInterfaceSet(doc,loaded.scene,loaded.idMap);
  const simulator=new core.Simulator(loaded.scene,null,null,null,null,null,false,
    doc.simulation.processedRayLimit);
  let event=null;
  for(const name of ['simulationComplete','simulationStop']){
    simulator.on(name,()=>{event=name;});
  }
  simulator.updateSimulation();
  const diagnostics=core.diagnostics(loaded.scene,simulator,emission,mirror,detector,interfaces);
  const status=event?core.classifyRun(event,diagnostics):'no-completion-event';
  const complete=['completed','completed-with-warnings'].includes(status);
  if(serializeSave(doc)!==original)throw Error('Numerical replay mutated the canonical scene');
  const nativeScene=JSON.parse(loaded.scene.toJSON());
  if((nativeScene.colorMode??'default')!==mode)throw Error('Native replay mode did not survive serialization');
  return {
    format:'opticsim-native-numerical-replay-v1',
    mode,upstreamColorMode:mode,
    nativeWeakBranchThreshold:NATIVE_REPLAY_MODES[mode].weakReflectedRayCutoff,
    scope:'headless v5 native-planar diagnostic only; not canonical scene execution',
    alteredNativeProperties:['colorMode'],
    canonicalDocument:structuredClone(doc),
    nativeSceneColorMode:nativeScene.colorMode??'default',
    status,complete,
    diagnostic:{
      nativeEvent:event,
      // These MAY be partial! Never expose as requested final measurements
      // without completion and current matching native execution evidence.
      ...diagnostics
    },
    observations:complete?{
      emissionsById:diagnostics.emissionsById,
      reflectionsById:diagnostics.reflectionsById,
      detectorsById:diagnostics.detectorsById,
      interfacesById:diagnostics.interfacesById
    }:null,
    interpretation:'not-assessed-by-engine',
    questionSupport:'not-assessed-by-engine'
  };
}
