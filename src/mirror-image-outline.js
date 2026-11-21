import {isRecord} from './qualified-utils.js';
import {absolute,fromBinary64,subtract,multiply,divide} from './binary64-rational.js';

export const OUTLINE_FACTS='opticsim-mirror-image-outline-facts-v1';
export const OUTLINE_QUERY='opticsim-mirror-image-outline-query-v1';
const kind='concave-mirror-outline-conjugate';
const model='paraxial-concave-mirror-outline';
const units=Object.freeze({mm:1,cm:10,m:1000});
const idPattern=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
export function mirrorOutlineCapabilities(){
  return {format:OUTLINE_QUERY,factsFormat:OUTLINE_FACTS,kinds:[kind],model,
    geometries:['ordered-convex-polygon','axis-based-trapezoid-beyond-centre'],
    coordinates:'Pole origin, axial distance positive toward the object, transverse height positive up.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_MIRROR_OUTLINE_FACTS','Unexpected mirror outline field.');
  for(const key of keys)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
function idsAreUnique(ids){
  return ids.every(id=>typeof id==='string'&&idPattern.test(id))&&new Set(ids).size===ids.length;
}
function trapezoid(g){
  fields(g,['kind','farBaseId','farTopId','nearTopId','nearBaseId','upperEdgeRelation']);
  const {farBaseId,farTopId,nearTopId,nearBaseId}=g,order=[farBaseId,farTopId,nearTopId,nearBaseId];
  if(!idsAreUnique(order)||!['rises-toward-mirror','parallel-to-axis'].includes(g.upperEdgeRelation))
    fail('UNSUPPORTED_SCOPE','Use four distinct IDs with a taller or equally high side closer to the mirror.');
  return {status:'conditional',value:{kind:'inverted-trapezoid',axialImageInterval:'between-focus-and-centre',
    orderedVertexIds:order,axisVertexIds:[farBaseId,nearBaseId],belowAxisVertexIds:[farTopId,nearTopId],
    parallelEdges:[[farBaseId,farTopId],[nearTopId,nearBaseId]],
    nearestImageBaseId:farBaseId,fartherImageBaseId:nearBaseId,tallerImageSide:[nearTopId,nearBaseId]}};
}
function winding(points){
  let orientation=null;
  for(const [i,a] of points.entries()){
    const j=(i+1)%points.length,b=points[j];
    const dx=b.distance-a.distance,dy=b.height-a.height;
    for(const [k,c] of points.entries()){
      if(k===i||k===j)continue;
      const ex=c.distance-a.distance,ey=c.height-a.height;
      const cross=dx*ey-dy*ex,scale=Math.hypot(dx,dy)*Math.hypot(ex,ey);
      if(Math.abs(cross)<=1e-10*scale||orientation!==null&&Math.sign(cross)!==orientation)return null;
      orientation=Math.sign(cross);
    }
  }
  return orientation;
}
function uncertain(){
  return {status:'numerically-indeterminate',value:null,reasonCode:'UNCERTAIN_IMAGE_OUTLINE',
    reason:'Near focal or transverse degeneracy prevents a well-conditioned closed image outline.'};
}
function projectableLocalGeometry(inputs,outputs,f){
  const focus=fromBinary64(f);
  const exact=inputs.map(v=>{
    const gap=subtract(fromBinary64(v.distance),focus);
    const ratio=divide(focus,gap);
    return {x:multiply(fromBinary64(v.distance),ratio),y:multiply(fromBinary64(-v.height),ratio)};
  });
  // Use one rounded coordinate for each exactly equal image height.
  const heightKeys=exact.map(({y})=>y.n+'/'+y.d);
  const equalHeights=new Map();
  for(const [i,v] of outputs.entries()){
    const key=heightKeys[i],previous=equalHeights.get(key);
    equalHeights.set(key,previous===undefined?v.height:Math.min(previous,v.height));
  }
  const reported=outputs.map((v,i)=>{
    v.height=equalHeights.get(heightKeys[i]);
    return {x:fromBinary64(v.distance),y:fromBinary64(v.height)};
  });
  const offset=(points,a,b,key)=>subtract(points[b][key],points[a][key]);
  const area=(points,a,b,c)=>subtract(
    multiply(offset(points,a,b,'x'),offset(points,a,c,'y')),
    multiply(offset(points,a,b,'y'),offset(points,a,c,'x')));
  const preserves=(actual,reference)=>{
    const error=subtract(actual,reference);
    // Keep exact equalities and limit relative error in nonzero local geometry.
    return 100n*absolute(error.n)*reference.d<=absolute(reference.n)*error.d;
  };
  for(let a=0;a<inputs.length-1;a++)for(let b=a+1;b<inputs.length;b++){
    if(!['x','y'].every(key=>preserves(offset(reported,a,b,key),offset(exact,a,b,key))))return false;
    for(let c=b+1;c<inputs.length;c++)
      if(!preserves(area(reported,a,b,c),area(exact,a,b,c)))return false;
  }
  return true;
}
function polygon(g){
  fields(g,['kind','lengthUnit','focalLength','vertices']);
  if(typeof g.lengthUnit!=='string'||!Object.hasOwn(units,g.lengthUnit))
    fail('INVALID_MIRROR_OUTLINE_FACTS','Use mm, cm or m.');
  const scale=units[g.lengthUnit],f=g.focalLength;
  if(!Number.isFinite(f)||f*scale<1||f*scale>10000||
    !Array.isArray(g.vertices)||g.vertices.length<3||g.vertices.length>6)
    fail('UNSUPPORTED_SCOPE','Supply focal length 1–10000 mm and an ordered polygon with three to six corners.');
  for(const point of g.vertices){
    fields(point,['id','distance','height']);
    if(![point.distance,point.height].every(Number.isFinite)||point.distance<=f||point.distance*scale>10000||
      Math.abs(point.height)/point.distance>.05)
      fail('UNSUPPORTED_SCOPE','All vertices must lie strictly beyond the focal plane, with bounded paraxial heights.');
  }
  if(!idsAreUnique(g.vertices.map(v=>v.id)))fail('INVALID_MIRROR_OUTLINE_FACTS','Require distinct stable vertex IDs.');
  const order=winding(g.vertices);
  if(order===null)return uncertain();
  const vertices=[];
  for(const v of g.vertices){
    const gap=v.distance-f;
    if(gap<=1e-10*v.distance)return uncertain();
    const distance=f+f*(f/gap),height=(-f*v.height)/gap;
    if(!Number.isFinite(distance)||!Number.isFinite(height)||distance*scale>1e6||Math.abs(height)*scale>1e6)
      return uncertain();
    vertices.push({id:v.id,distance,height});
  }
  if(!projectableLocalGeometry(g.vertices,vertices,f)||winding(vertices)!==order)return uncertain();
  return {status:'conditional',value:{kind:'ordered-real-image-outline',lengthUnit:g.lengthUnit,vertices}};
}
export function analyzeMirrorOutline(f,q){
  if(f?.format!==OUTLINE_FACTS)fail('UNSUPPORTED_FACTS','Explicit mirror and ordered outline facts required.');
  fields(q,['format','kind']);
  if(q.format!==OUTLINE_QUERY||q.kind!==kind)fail('UNSUPPORTED_QUERY','Unknown mirror outline query.');
  fields(f,['format','model','geometry']);
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare the first paraxial concave-mirror conjugate.');
  if(!['ordered-convex-polygon','axis-based-trapezoid-beyond-centre'].includes(f.geometry?.kind))
    fail('UNSUPPORTED_SCOPE','Specify the ordered numeric outline or the bounded axis-based trapezoid.');
  return {format:'opticsim-mirror-image-outline-result-v1',kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Stationary concave spherical mirror, first reflected paraxial conjugate, object rays reach the mirror.'],
    limitations:['Visibility and finite-aperture illumination are separate from the projected outline.'],
    ...(f.geometry.kind==='ordered-convex-polygon'?polygon(f.geometry):trapezoid(f.geometry))};
}
