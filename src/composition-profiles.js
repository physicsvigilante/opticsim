// Reviewed whole-system compatibility data. No ray propagation, executable user
// rules, example names, physical defaults, or implicit saved-scene migration.
// A profile is an admission contract, NOT a prescribed optical encounter order.
const source='point-source',beam='parallel-beam',mirror='plane-mirror',detector='ray-detector';
const lens='ideal-lens',prism='triangular-prism',polygon='polygon-dielectric';
const circle='circular-dielectric',semicircle='semicircular-dielectric',plane='planar-interface';
const curves=['ideal-curved-mirror','circular-arc-mirror'];
const stops=['line-blocker','circle-blocker','finite-aperture'];
const finite='finite-dielectric-composition';
const range=(min,max)=>({min,max});
const group=(types,min,max)=>({types,min,max});
const rule=(name,excludeTypes=[])=>({name,excludeTypes});
const optical=(name,...excluded)=>rule(name,[detector,...excluded]);
const count=(components,types)=>components.filter(c=>types.includes(c.type)).length;
function freeze(value){
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
const definitions=[];
function define(schemaVersion,model,counts,groups,rules,sourceModes){
  definitions.push({id:`${model}@${schemaVersion}`,schemaVersion,adapterVersion:schemaVersion,
    model,counts,groups,sourceModes,validationRules:[...rules,rule('detectors'),
      ...(model==='general-component-tracing'?[rule('opaque-circles')]:[])]});
}
const fan=['full-circle','directional'],single=['single-ray'];
for(const version of [1,2,3,4]){
  const detectors=version>=4?{[detector]:range(0,2)}:{};
  define(version,'ideal-thin-lens-geometric',{
    [source]:range(1,1),[lens]:range(1,version>=4?4:2),...detectors
  },[],[optical('lens-bench')],version===1?[]:fan);
  if(version>=3)define(version,'plane-mirror-geometric',{
    [source]:range(1,1),[mirror]:range(1,1),...detectors
  },[],[optical('plane-mirror')],fan);
  if(version===4){
    define(4,'lens-mirror-return-geometric',{
      [source]:range(1,1),[lens]:range(1,1),[mirror]:range(1,1),...detectors
    },[],[optical('lens-mirror-return')],fan);
    define(4,'mixed-lens-mirror-tracing',{
      [source]:range(1,4),[lens]:range(1,4),[mirror]:range(1,4),...detectors
    },[],[optical('mixed-optical')],fan);
    define(4,'general-component-tracing',{
      [source]:range(1,4),[lens]:range(0,4),[mirror]:range(0,4),
      ...Object.fromEntries(stops.map(t=>[t,range(0,2)])),...detectors
    },[group(stops,0,2)],[optical('general-optical')],fan);
  }
}
define(5,'planar-media-tracing',{
  [source]:range(1,4),[plane]:range(1,4),[mirror]:range(0,4),[detector]:range(0,2)
},[],[rule('planar-media'),optical('general-optical',plane)],single);
define(6,'curved-mirror-tracing',{
  [source]:range(1,4),...Object.fromEntries(curves.map(t=>[t,range(0,2)])),
  [mirror]:range(0,2),[detector]:range(0,2)
},[group(curves,1,2)],[rule('curved-mirrors'),optical('general-optical',...curves)],['single-ray',...fan]);
for(const [version,model,type,geometry] of [
  [7,'circular-dielectric-tracing',circle,'circular-region'],
  [8,'triangular-prism-tracing',prism,'prism-region'],
  [9,'polygon-dielectric-tracing',polygon,'polygon-region']
])define(version,model,{[source]:range(1,4),[type]:range(1,1),[detector]:range(0,2)},[],
  [rule(geometry),optical('general-optical',type)],single);
for(const version of [10,11,12])define(version,finite,{
  [source]:range(1,4),[polygon]:range(version===12?0:1,1),
  ...(version===12?{[prism]:range(0,1)}:{}),
  [mirror]:range(1,version===10?1:2),[detector]:range(0,2)
},version===12?[group([polygon,prism],1,1)]:[],
  [rule('finite-composition'),optical('general-optical',polygon,prism)],single);
// Prospective external-surface policy. Historical profiles above stay frozen.
// Zero blocker/mirror permits ordinary removal within this contract, not an
// implicit migration of older scenes. Exactly one finite region is mandatory.
define(13,finite,{
  [source]:range(1,4),[polygon]:range(0,1),[prism]:range(0,1),
  [mirror]:range(0,1),'line-blocker':range(0,1),[detector]:range(0,2)
},[group([polygon,prism],1,1)],
  [rule('finite-composition'),optical('general-optical',polygon,prism)],single);
// v19 is deliberately reserved for a separate JEE-first source family while
// v14–v18 remain held. It never upgrades or broadens old saved profiles.
// It admits one true finite native Beam, not a point-source mode or a route.
define(19,'native-parallel-lens-tracing',{
  [beam]:range(1,1),[lens]:range(0,1),'finite-aperture':range(0,1),[detector]:range(0,2)
},[],[rule('native-parallel-beam')],[]);
define(19,'native-parallel-planar-tracing',{
  [beam]:range(1,1),[plane]:range(1,2),[detector]:range(0,2)
},[],[rule('native-parallel-beam')],[]);
// Independently validated v20 offset lenses and v21 semicircle, without
// changing the meaning of v19 or any historical saved composition.
define(20,'native-parallel-two-lens-tracing',{
  [beam]:range(1,1),[lens]:range(2,2),[detector]:range(0,2)
},[],[rule('native-decentered-two-lens')],[]);
define(21,'native-parallel-semicircular-tracing',{
  [beam]:range(1,1),[semicircle]:range(1,1),[detector]:range(0,2)
},[],[rule('native-semicircular-beam')],[]);
freeze(definitions);
const byKey=new Map(definitions.map(p=>[p.id,p]));

// Selection preserves existing minimal-authoring precedence, even for rejected
// mixtures. It identifies a candidate contract, never certifies it or retries
// a more permissive profile after geometry/material validation fails.
const selection=freeze([
  {model:'native-parallel-semicircular-tracing',version:21,when:[group([semicircle],1,32)]},
  {model:'native-parallel-planar-tracing',version:19,when:[group([beam],1,32),group([plane],1,32)]},
  {model:'native-parallel-two-lens-tracing',version:20,when:[group([beam],1,32),group([lens],2,32)]},
  {model:'native-parallel-lens-tracing',version:19,when:[group([beam],1,32)]},
  {model:finite,version:13,when:[group([polygon,prism],1,32),group(['line-blocker'],1,32)]},
  {model:finite,version:12,when:[group([prism],1,32),group([mirror],1,32)]},
  {model:finite,version:11,when:[group([polygon],1,32),group([mirror],2,32)]},
  {model:finite,version:10,when:[group([polygon],1,32),group([mirror],1,32)]},
  {model:'polygon-dielectric-tracing',version:9,when:[group([polygon],1,32)]},
  {model:'triangular-prism-tracing',version:8,when:[group([prism],1,32)]},
  {model:'circular-dielectric-tracing',version:7,when:[group([circle],1,32)]},
  {model:'curved-mirror-tracing',version:6,when:[group(curves,1,32)]},
  {model:'planar-media-tracing',version:5,when:[group([plane],1,32)]},
  {model:'general-component-tracing',version:4,when:[]}
]);
export function compositionProfile(model,version){
  // Strict numeric versions: do not let string concatenation admit "11".
  return Number.isInteger(version)?byKey.get(`${model}@${version}`)||null:null;
}
export function compositionModels(version){
  return definitions.filter(p=>p.schemaVersion===version).map(p=>p.model);
}
export function compositionSourceModes(version){
  return [...(definitions.find(p=>p.schemaVersion===version)?.sourceModes||[])];
}
export function selectAuthoringComposition(components){
  if(!Array.isArray(components)||components.length>32||components.some(c=>!c||typeof c.type!=='string'))
    throw new TypeError('Composition selection requires a bounded component list');
  const entry=selection.find(s=>s.when.every(g=>{
    const n=count(components,g.types);return n>=g.min&&n<=g.max;
  }));
  const p=compositionProfile(entry.model,entry.version);
  return {model:p.model,schemaVersion:p.schemaVersion,adapterVersion:p.adapterVersion};
}
export function compositionCardinalitiesMatch(components,counts,groups=[]){
  if(components.some(c=>!Object.hasOwn(counts,c.type)))return false;
  return Object.entries(counts).every(([type,{min,max}])=>{
    const n=components.filter(c=>c.type===type).length;return n>=min&&n<=max;
  })&&groups.every(({types,min,max})=>{
    const n=count(components,types);return n>=min&&n<=max;
  });
}
export function compositionCountsMatch(components,model,version){
  const p=compositionProfile(model,version);
  return !!p&&compositionCardinalitiesMatch(components,p.counts,p.groups);
}
export function compositionCountWithin(model,version,type,n){
  const limits=compositionProfile(model,version)?.counts[type];
  return !!limits&&n>=limits.min&&n<=limits.max;
}
export function validateCompositionRules(components,model,version,handlers){
  const p=compositionProfile(model,version);
  if(!p)throw new TypeError('Unregistered composition contract');
  // Check all dependencies first: no partially dispatched unknown rule.
  for(const {name} of p.validationRules)if(!Object.hasOwn(handlers,name)||typeof handlers[name]!=='function')
    throw new TypeError('Missing registered composition rule: '+name);
  for(const {name,excludeTypes} of p.validationRules){
    const subset=excludeTypes.length?components.filter(c=>!excludeTypes.includes(c.type)):components;
    handlers[name](subset);
  }
}
export function compositionCapabilities(){
  return {format:'opticsim-composition-catalog-v1',profiles:structuredClone(definitions),
    selection:structuredClone(selection),
    scope:'Whole-system contracts, not pairwise permissions or apparatus templates. Counts alone never certify physical geometry or native completion.',
    preservation:'Saved contracts are validated as declared. Authoring selection is for new requests only, not automatic migration or fallback.',
    validation:'Ordered rule names invoke existing geometry/material validators; component subsets are read-only validation views, never changes to native scene contents.',
    extension:'New arrangements within a profile need only explicit component data. Compatibility outside these profiles requires physical verification and an explicitly reviewed contract change.'};
}

// Legacy per-component capacity metadata is the envelope across all reviewed
// profiles. It is not permission to combine the maxima into one apparatus.
export function compositionCapacity(type){
  if(!definitions.some(p=>Object.hasOwn(p.counts,type)))return null;
  return {min:Math.min(...definitions.map(p=>p.counts[type]?.min||0)),
    max:Math.max(...definitions.map(p=>p.counts[type]?.max||0))};
}
