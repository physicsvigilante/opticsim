import {readFileSync,writeFileSync} from 'node:fs';
import {prepareScene} from '../src/authoring.js';
let app=readFileSync('src/app.js','utf8');
app=app.replace(".textContent = polygon?'Convex polygon", ".textContent = composition?'Finite dielectric + external mirror · native composition':polygon?'Convex polygon")
 .replace("${polygon?'One strictly", "${composition?'One convex four-vertex glass region, one external plane mirror, 1–4 exact rays and up to 2 external detectors. External surfaces need 0.01 mm clearance; no other optics.':polygon?'One strictly")
 .replace(".textContent = polygon?'Native Glass", ".textContent = composition?'Native Glass and Mirror choose each encounter, including misses and returns. Fresnel-off is explicit; TIR remains active. No return route or image is inferred. The unchanged depth limit may truncate repeated encounters and then suppress readings.':polygon?'Native Glass");
writeFileSync('src/app.js',app);
const physical={lengthUnit:'mm',title:'Synthetic finite glass and external mirror',components:[
 {id:'S1',type:'point-source',parameters:{x:-40,y:0,brightness:1},emission:{mode:'single-ray',directionDeg:0}},
 {id:'G1',type:'polygon-dielectric',parameters:{x1:0,y1:-30,x2:0,y2:30,x3:20,y3:30,x4:20,y4:-30,insideIndex:1.5,outsideIndex:1,partialReflection:false}},
 {id:'M1',type:'plane-mirror',parameters:{x:60,y:0,orientationDeg:90,length:50}},
 {id:'D1',type:'ray-detector',parameters:{x:40,y:0,orientationDeg:90,length:40}}
]};
const requests=[
 {id:'glass',kind:'interface-interactions',componentId:'G1'},
 {id:'faces',kind:'interface-face-events',componentId:'G1'},
 {id:'mirror',kind:'mirror-reflections',componentId:'M1'},
 {id:'detector',kind:'detector-crossings',componentId:'D1'},
 {id:'power',kind:'detector-signed-power',componentId:'D1'}
];
const example={format:'opticsim-problem-v1',physical,requests,interpretation:{
 requestedResult:'Investigate actual native refraction, reflection and return encounters in a declared finite optical system.',stated:[],derived:[],
 assumptions:['Synthetic fully specified 2D configuration, not a textbook interpretation.','One stationary homogeneous convex quadrilateral in an explicitly indexed exterior and one external ideal plane mirror.','partialReflection=false explicitly omits Fresnel partial reflections; native TIR remains active.'],
 unknowns:['No detected image, continuous angular coverage, source-specific ray history or 3D claim is established.']},illustration:false,verifyNative:false};
writeFileSync('examples/finite-dielectric-composition.json',JSON.stringify(example,null,2)+'\n');
writeFileSync('scenes/finite-dielectric-composition.json',JSON.stringify(prepareScene(physical).document,null,2)+'\n');
let html=readFileSync('public/index.html','utf8');
const anchor='<option value="polygon-dielectric"';
if(!html.includes(anchor))throw Error('Missing menu');
html=html.replace(anchor,'<option value="finite-dielectric-composition">Finite glass + external mirror</option>\n            '+anchor);
writeFileSync('public/index.html',html);
