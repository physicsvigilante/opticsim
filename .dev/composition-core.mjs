import {readFileSync as read,writeFileSync as write} from 'node:fs';
function patch(path,from,to){const s=read(path,'utf8');if(!s.includes(from))throw Error('Missing anchor '+path+' '+from);write(path,s.replace(from,to));}
patch('src/finite-glass-geometry.js','export function compileFiniteGlass',`// A conservative separating-face proof for a complete external finite segment.
// This checks authored geometry only; it never computes a ray intersection.
export function segmentOutsideFiniteGlass(faces,line,clearanceMm){
 return faces.some(f=>line.every(q=>dot(delta(f.a,q),f.normal)>=clearanceMm));
}
export function compileFiniteGlass`);
patch('src/polygon-dielectric.js','finiteGlassEncounter}', 'finiteGlassEncounter,segmentOutsideFiniteGlass}');
patch('src/polygon-dielectric.js','!faces.some(f=>line.every(q=>dot(delta(f.a,q),f.normal)>=POLYGON_CLEARANCE_MM))','!segmentOutsideFiniteGlass(faces,line,POLYGON_CLEARANCE_MM)');
write('src/finite-dielectric-composition.js',`// Bounded composition of EXISTING native components, not a new ray solver.
import {POLYGON_TYPE,POLYGON_CLEARANCE_MM,polygonFaces,validatePolygonGeometry} from './polygon-dielectric.js';
import {segmentOutsideFiniteGlass} from './finite-glass-geometry.js';
import {separatedSegmentDistance} from './finite-aperture.js';
export const FINITE_COMPOSITION_MODEL='finite-dielectric-composition';
export const FINITE_COMPOSITION_VERSION=10;
export function validateFiniteDielectricComposition(components,endpoints,fail){
  const path='$.physics.components',mirrors=components.filter(c=>c.type==='plane-mirror');
  if(mirrors.length!==1||components.some(c=>!['point-source',POLYGON_TYPE,'plane-mirror','ray-detector'].includes(c.type)))
    fail(path,'Finite dielectric composition requires one convex quadrilateral, one external plane mirror, 1–4 single rays and 0–2 external detectors; no other optics or media.','UNSUPPORTED_SCOPE');
  // Reuse the unchanged region/source/detector checks. No component is removed
  // from the canonical scene, its native compilation or result qualification.
  validatePolygonGeometry(components.filter(c=>c.type!=='plane-mirror'),endpoints,fail);
  const glass=components.find(c=>c.type===POLYGON_TYPE),faces=polygonFaces(glass.parameters);
  if(!segmentOutsideFiniteGlass(faces,endpoints(mirrors[0].parameters),POLYGON_CLEARANCE_MM))
    fail(path,'Mirror must lie entirely outside the dielectric and at least 0.01 mm beyond a common separating face.','UNSUPPORTED_SCOPE');
  const segments=components.filter(c=>['plane-mirror','ray-detector'].includes(c.type));
  for(let i=0;i<segments.length;i++)for(let j=0;j<i;j++){
    if(separatedSegmentDistance(endpoints(segments[i].parameters),endpoints(segments[j].parameters))<POLYGON_CLEARANCE_MM)
      fail(path,'External mirror/detector segments need 0.01 mm mutual clearance.','UNSUPPORTED_SCOPE');
  }
}
`);
patch('src/contract.js',"import {PRISM_TYPE", "import {FINITE_COMPOSITION_MODEL,FINITE_COMPOSITION_VERSION,validateFiniteDielectricComposition} from './finite-dielectric-composition.js';\nimport {PRISM_TYPE");
patch('src/contract.js','doc?.schemaVersion===9?9:', 'doc?.schemaVersion===FINITE_COMPOSITION_VERSION?FINITE_COMPOSITION_VERSION:doc?.schemaVersion===9?9:');
patch('src/contract.js',"const models = version===9?", "const models = version===FINITE_COMPOSITION_VERSION?[FINITE_COMPOSITION_MODEL]:version===9?");
patch('src/contract.js','version===8||version===9)', 'version===8||version===9||version===FINITE_COMPOSITION_VERSION)');
patch('src/contract.js',"if(p.model==='polygon-dielectric-tracing'){",`if(p.model===FINITE_COMPOSITION_MODEL){
    validateFiniteDielectricComposition(p.components,mirrorEndpoints,fail);
    validateMixedTraceScope(opticalComponents.filter(c=>c.type!==POLYGON_TYPE),true);
  }
  else if(p.model==='polygon-dielectric-tracing'){`);
patch('src/authoring.js',"import {NATIVE_OBSERVATION_KEYS}","import {FINITE_COMPOSITION_MODEL,FINITE_COMPOSITION_VERSION} from './finite-dielectric-composition.js';\nimport {NATIVE_OBSERVATION_KEYS}");
patch('src/authoring.js','    polygonDielectrics:',`    finiteDielectricComposition:{schemaVersion:FINITE_COMPOSITION_VERSION,model:FINITE_COMPOSITION_MODEL,
      scope:'One strictly convex four-vertex dielectric, exactly one external finite plane mirror, 1–4 explicit single rays and 0–2 external detectors; no lenses, stops, other media or motion',
      geometry:'Existing polygon rules; mirror/detectors entirely beyond a separating face by 0.01 mm; external segments mutually separated by 0.01 mm',
      limitations:'No prescribed return route, source-attributed ray history or image prediction. Explicit Fresnel-off is an approximation; truncated runs remain incomplete.'},
    polygonDielectrics:`);
patch('src/authoring.js',"  const doc={\n    format:'ray-optics-2d',schemaVersion:polygon?9", "  const finiteComposition=polygon&&components.some(c=>c.type==='plane-mirror');\n  const doc={\n    format:'ray-optics-2d',schemaVersion:finiteComposition?FINITE_COMPOSITION_VERSION:polygon?9");
patch('src/authoring.js','adapterVersion:polygon?9','adapterVersion:finiteComposition?FINITE_COMPOSITION_VERSION:polygon?9');
patch('src/authoring.js',"model:polygon?'polygon-dielectric-tracing'", "model:finiteComposition?FINITE_COMPOSITION_MODEL:polygon?'polygon-dielectric-tracing'");
patch('src/authoring.js','document.schemaVersion===8||document.schemaVersion===9)', 'document.schemaVersion===8||document.schemaVersion===9||document.schemaVersion===FINITE_COMPOSITION_VERSION)');
patch('src/authoring.js','[5,7,8,9].includes(document.schemaVersion)', '[5,7,8,9,FINITE_COMPOSITION_VERSION].includes(document.schemaVersion)');
patch('src/app.js',"'triangular-prism-tracing','polygon-dielectric-tracing'].includes", "'triangular-prism-tracing','polygon-dielectric-tracing','finite-dielectric-composition'].includes");
patch('src/app.js',"   const polygon = session.document.physics.model === 'polygon-dielectric-tracing';", "  const composition = session.document.physics.model === 'finite-dielectric-composition';\n  const polygon = composition || session.document.physics.model === 'polygon-dielectric-tracing';");
patch('src/app.js','[5,7,8,9].includes(session.document.schemaVersion)', '[5,7,8,9,10].includes(session.document.schemaVersion)');
