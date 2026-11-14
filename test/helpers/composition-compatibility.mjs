// Fixed regression inputs for the composition-validation extraction.
// These are software controls, not independent interpretations of source problems.
import {readFileSync} from 'node:fs';
import {prepareScene} from '../../src/authoring.js';
import {parseSave} from '../../src/contract.js';
const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
export function compositionCompatibilityCases(){
  const cases=[];
  const add=(id,document)=>cases.push({id,document});
  // Membership was frozen with PR #66; newer scenes have separate feature tests.
  const names=JSON.parse(read('test/fixtures/composition-compatibility-baseline.json')).records
    .filter(r=>r.id.startsWith('scene/')).map(r=>r.id.slice(6));
  for(const name of names)
    add('scene/'+name,JSON.parse(read('scenes/'+name)));
  for(const name of ['legacy-v1','legacy-v2','legacy-v3-lens','legacy-v3-mirror'])
    cases.push({id:'legacy/'+name,text:read('test/fixtures/'+name+'.json')});
  for(const name of ['circle-blocker-detector','finite-aperture-detector'])
    add('example/'+name,prepareScene(JSON.parse(read('examples/'+name+'.json')).physical).document);
  const source={id:'S',type:'point-source',parameters:{x:-50,y:7,brightness:1},emission:{mode:'single-ray',directionDeg:0}};
  for(const [name,optic] of [
    ['planar',{id:'I',type:'planar-interface',parameters:{x:0,y:0,normalDeg:0,negativeIndex:1,positiveIndex:1.5,partialReflection:false}}],
    ['curved',{id:'M',type:'ideal-curved-mirror',parameters:{x:0,y:0,normalDeg:180,focalLength:25,apertureHeight:20}}]
  ])add('synthetic/'+name,prepareScene({lengthUnit:'mm',components:[source,optic]}).document);
  const general=JSON.parse(read('scenes/general-source-detector.json'));
  const finite=JSON.parse(read('scenes/finite-dielectric-composition.json'));
  const mutate=(id,doc,fn)=>{const copy=structuredClone(doc);fn(copy);add('mutation/'+id,copy);};
  const components=d=>d.physics.components;
  mutate('no-source',general,d=>{d.physics.components=components(d).filter(c=>c.type!=='point-source');});
  mutate('duplicate-id',general,d=>{components(d)[1].id=components(d)[0].id;});
  mutate('unknown-type',general,d=>{components(d)[1].type='unsupported-optic';});
  mutate('three-detectors',general,d=>{const det=components(d).find(c=>c.type==='ray-detector');components(d).push({...structuredClone(det),id:'extra1'},{...structuredClone(det),id:'extra2'});});
  mutate('v10-two-mirrors',finite,d=>{const mirror=structuredClone(components(d).find(c=>c.type==='plane-mirror'));mirror.id='M2';mirror.parameters.y+=100;components(d).push(mirror);});
  mutate('v9-cannot-acquire-mirror',finite,d=>{d.schemaVersion=d.adapterVersion=9;d.physics.model='polygon-dielectric-tracing';});
  mutate('full-fresnel',finite,d=>{components(d).find(c=>c.type==='polygon-dielectric').parameters.partialReflection=true;});
  mutate('two-detector-depth',finite,d=>{const det=structuredClone(components(d).find(c=>c.type==='ray-detector'));det.id='D2';det.parameters.x=-20;components(d).push(det);});
  mutate('native-stop',finite,d=>{d.simulation.processedRayLimit=1;});
  for(const offset of [0,.009,.01,.011]){
    mutate('detector-source-clearance-'+offset,general,d=>{
      const s=components(d).find(c=>c.type==='point-source').parameters,det=components(d).find(c=>c.type==='ray-detector').parameters;
      Object.assign(det,{orientationDeg:0,y:s.y+offset});
    });
    mutate('mirror-detector-clearance-'+offset,finite,d=>{
      const m=components(d).find(c=>c.type==='plane-mirror').parameters,det=components(d).find(c=>c.type==='ray-detector').parameters;
      Object.assign(det,{orientationDeg:90,x:m.x+offset,y:m.y});
    });
  }
  return cases;
}
export function compatibilityInput(entry){
  return entry.text===undefined?structuredClone(entry.document):parseSave(entry.text);
}
