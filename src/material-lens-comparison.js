import {isRecord} from './qualified-utils.js';
import {paraxialSurfacePair} from './two-surface-focus.js';

export const MATERIAL_FACTS='opticsim-material-lens-facts-v1';
export const MATERIAL_QUERY='opticsim-material-lens-query-v1';
const kind='compare-same-shape-material-lenses';
export function materialLensCapabilities(){
  return {format:MATERIAL_QUERY,factsFormat:MATERIAL_FACTS,kinds:[kind],
    model:'thin-lenses-of-identical-shape',shape:['positive-curvature-factor','negative-curvature-factor','signed-radii-metres'],
    comparison:'Two independent lens materials in each of one to four common exterior media. Ratio is first focal length divided by second.'};
}
function reject(message){throw Object.assign(new Error(message),{code:'INVALID_MATERIAL_LENS_FACTS'});}
function fields(o,names){
  if(!isRecord(o)||Object.keys(o).some(k=>!names.includes(k)))
    reject('Expected fields '+names.join(', '));
  const missing=names.find(k=>!Object.hasOwn(o,k));
  if(missing)throw Object.assign(new Error('Missing '+missing),{code:'MISSING_FACTS'});
}
function validateList(list,min,max){
  if(!Array.isArray(list)||list.length<min||list.length>max)reject('Unexpected number of materials or media.');
  const ids=new Set();
  for(const item of list){
    fields(item,['id','index']);
    if(typeof item.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(item.id)||ids.has(item.id))
      reject('Supply distinct stable IDs in each material or medium list.');
    if(!Number.isFinite(item.index)||item.index<1||item.index>4)reject('Absolute indices must be in [1,4].');
    ids.add(item.id);
  }
}
function lensResult(material,medium,shape) {
  const contrast=material.index-medium.index;
  if(contrast!==0 && Math.abs(contrast)<=1e-10*Math.max(material.index,medium.index))return null;
  if(shape.kind==='signed-radii-metres'){
    const pair=paraxialSurfacePair(medium.index,material.index,medium.index,shape.front,shape.rear,0);
    if(!pair||Math.abs(pair.back)>1e6)return null;
    return {id:material.id,action:pair.power===0?'afocal':pair.power>0?'converging':'diverging',
      powerD:pair.power,signedFocalLengthM:pair.back};
  }
  const sign=shape.kind==='positive-curvature-factor'?1:-1;
  const action=contrast===0?'afocal':contrast*sign>0?'converging':'diverging';
  return contrast===0?{id:material.id,action,powerD:0,signedFocalLengthM:null}:{id:material.id,action};
}
export function analyzeMaterialLens(f,q){
  fields(q,['kind','format']);
  if(q.kind!==kind||q.format!==MATERIAL_QUERY)reject('Unsupported material-lens query.');
  if(f?.format!==MATERIAL_FACTS)throw Object.assign(new Error('Explicit common-shape material facts required.'),{code:'UNSUPPORTED_FACTS'});
  fields(f,['format','model','shape','materials','media']);
  if(f.model!=='thin-lenses-of-identical-shape')throw Object.assign(new Error('Declare the shared thin model explicitly.'),{code:'UNSUPPORTED_MODEL'});
  validateList(f.materials,2,2);validateList(f.media,1,4);
  const s=f.shape;
  if(s?.kind==='signed-radii-metres'){
    fields(s,['kind','front','rear']);
    if(![s.front,s.rear].every(r=>Number.isFinite(r)&&Math.abs(r)>=.001&&Math.abs(r)<=10))
      reject('Supply signed radii in metres, magnitude 0.001–10.');
  }else{
    fields(s,['kind']);
    if(!['positive-curvature-factor','negative-curvature-factor'].includes(s.kind))reject('Unknown common curvature factor.');
  }
  const base={format:'opticsim-material-lens-result-v1',kind,method:'conditional-analytical',native:{status:'not-run'},
    assumptions:['Each independent lens has the same paraxial thin shape and a homogeneous exterior on both sides.'],
    limitations:['Ray bending refers to off-axis parallel input. An axial ray stays axial.']};
  const comparisons=[];
  for(const medium of f.media){
    const lenses=f.materials.map(m=>lensResult(m,medium,s));
    if(lenses.some(v=>!v))return {...base,status:'numerically-indeterminate',value:null,reasonCode:'ILL_CONDITIONED_MATERIAL_LENS',
      reason:'Near index matching, surface-power cancellation or an excessive focal distance prevents a stable comparison.'};
    const ratio=lenses.some(l=>l.action==='afocal')?null:
      (f.materials[1].index-medium.index)/(f.materials[0].index-medium.index);
    comparisons.push({mediumId:medium.id,lenses,firstOverSecondFocalLength:ratio,
      ratioState:ratio===null?'unavailable-afocal':'finite'});
  }
  return {...base,status:'conditional',value:{comparisons}};
}
