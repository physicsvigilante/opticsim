// Strict analytical mirror-image ORBIT mechanics; NO native ray or observed image.
// Infinite supporting lines give a formal affine-reflection orbit. Finite mirror
// segments, pupil/observer visibility, optical attenuation and native ray paths
// are NEVER inferred from these mathematical points.
export const MIRROR_ORBIT_QUERY_FORMAT='opticsim-plane-mirror-formal-orbit-v1';
export const MIRROR_ORBIT_RESULT_FORMAT='opticsim-plane-mirror-formal-orbit-result-v1';
export const MIRROR_ORBIT_MODEL='ideal-infinite-supporting-line-specular-orbit';
const KIND_STRUCTURE='equilateral-three-mirror-orbit-structure';
const KIND_SAMPLE='equilateral-three-mirror-bounded-formal-points';
const TOPOLOGY='three-equal-sides-enclosing-object';
const RELATION='unlimited-ideal-reflections';
const MIN_SIDE=10,MAX_SIDE=2000,WORLD=10000,MAX_DEPTH=8;
const REL_EQ_TOL=1e-9,BOUNDARY_CLEARANCE=0.01,DEDUP_TOL=1e-7;
const TRANSLATION_WORD=['AB','BC','AB','CA'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
export class MirrorOrbitQueryError extends Error {
 constructor(code,message){super(message);this.name='MirrorOrbitQueryError';this.code=code;}
}
const fail=(code,message)=>{throw new MirrorOrbitQueryError(code,message);};
const strict=(o,allowed,required,name)=>{
 if(!record(o))fail('INVALID_QUERY',name+' must be a JSON object');
 const extra=Object.keys(o).filter(k=>!allowed.includes(k));
 if(extra.length)fail('INVALID_QUERY',name+' has unsupported keys: '+extra.join(','));
 const missing=required.filter(k=>!own(o,k));
 if(missing.length)fail('MISSING_FACTS',name+' requires: '+missing.join(','));
};
const finite=(n,name)=>{
 if(typeof n!=='number'||!Number.isFinite(n))fail('INVALID_FACTS',name+' must be an explicit finite JSON number');
 if(Math.abs(n)>WORLD)fail('UNSUPPORTED_SCOPE',name+' is outside +/-10000 mm');
 return n;
};
const vector=(p,q)=>({x:q.x-p.x,y:q.y-p.y});
const cross=(u,v)=>u.x*v.y-u.y*v.x;
const dot=(u,v)=>u.x*v.x+u.y*v.y;
const mag=(u)=>Math.hypot(u.x,u.y);
const dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
const canonicalPoint=(q,name)=>{
 strict(q,['x','y'],['x','y'],name);
 return {x:finite(q.x,name+'.x'),y:finite(q.y,name+'.y')};
};
const reflect=(p,a,b)=>{
 const d=vector(a,b),L2=dot(d,d),relative=vector(a,p),t=dot(relative,d)/L2;
 return {x:2*(a.x+t*d.x)-p.x,y:2*(a.y+t*d.y)-p.y};
};
const base=kind=>({
 format:MIRROR_ORBIT_RESULT_FORMAT,kind,model:MIRROR_ORBIT_MODEL,
 topology:TOPOLOGY,reflectionPolicy:RELATION,
 status:'conditional-formal-orbit',
 native:{status:'not-run',observations:null,nativeImageDetected:false,
  finiteMirrorPathsVerified:false,observerVisibilityCertified:false},
 originalQuestionSolved:false,
 assumptions:[
  'Three geometrically ideal two-sided specular lines support an equilateral triangular enclosure.',
  'The object lies strictly inside the triangular enclosure, but its metric position is not specified by the original source.',
  'All finite-length, brightness, image-order cutoff, line-of-sight, observer and native propagation constraints are excluded from the formal orbit.'
 ],
 limitations:[
  'An infinite formal reflection-group orbit is not proof that infinitely many images are visible through finite mirror segments from a particular eye.',
  'Each bounded-depth reflected point is a mathematical candidate, not a native ray intersection or measured optical image.',
  'The numerical count at a finite reflection order is NOT the total number of visible or physically reachable images.',
  'No mirror dimensions, source position, brightness, optical power, finite visual aperture or ray density are invented for the original JEE problem.',
  'A specific finite textbook image-counting convention may differ. This API does not assume a two-mirror-pair-only count or read Solutions.'
 ]
});
const validateVertices=(q)=>{
 if(!Array.isArray(q)||q.length!==3)fail('INVALID_FACTS','Three ordered vertices A,B,C must be explicit');
 const [a,b,c]=q.map((v,i)=>canonicalPoint(v,['A','B','C'][i]));
 const ab=dist(a,b),bc=dist(b,c),ca=dist(c,a);
 const s=(ab+bc+ca)/3;
 if(s<MIN_SIDE||s>MAX_SIDE)fail('UNSUPPORTED_SCOPE','Mean equilateral side must be 10–2000 mm');
 if(Math.max(Math.abs(ab-s),Math.abs(bc-s),Math.abs(ca-s))>REL_EQ_TOL*s)
  fail('UNSUPPORTED_SCOPE','Three mirror segments must form a genuinely equilateral, nondegenerate triangle');
 const area2=Math.abs(cross(vector(a,b),vector(a,c)));
 if(!(area2>0.1*s*s))
  fail('UNSUPPORTED_SCOPE','The equilateral triangle must not be degenerate');
 return {a,b,c,s,area2,lines:{AB:[a,b],BC:[b,c],CA:[c,a]}};
};
const validateInside=(p,t)=>{
 const {a,b,c,area2,s}=t;
 const sub=[Math.abs(cross(vector(p,a),vector(p,b))),
  Math.abs(cross(vector(p,b),vector(p,c))),
  Math.abs(cross(vector(p,c),vector(p,a)))];
 const sum=sub.reduce((x,y)=>x+y,0);
 if(Math.abs(sum-area2)>1e-9*Math.max(area2,1))
  fail('UNSUPPORTED_SCOPE','The explicitly authored source must be inside the triangle');
 if(Math.min(...sub)/s<=BOUNDARY_CLEARANCE)
  fail('UNSUPPORTED_SCOPE','Source must be strictly inside and at least 0.01 mm from every mirror supporting line');
};
const wordPoint=(p,t)=>{
 let x=p;
 for(const id of TRANSLATION_WORD)x=reflect(x,...t.lines[id]);
 return x;
};
const proof=(t,p)=>{
 const newP=wordPoint(p,t),delta=vector(p,newP),n=mag(delta);
 const probe={x:p.x+t.s*.07,y:p.y+t.s*.09},probe2=wordPoint(probe,t);
 const change=vector(probe,probe2);
 if(!(n>0.5*t.s)||Math.abs(n-Math.sqrt(3)*t.s)>1e-8*t.s||
   Math.hypot(change.x-delta.x,change.y-delta.y)>1e-8*t.s)
  fail('NUMERIC_UNCERTAINTY','The declared four-reflection word did not produce a reliably nonzero point-independent translation');
 return {word:[...TRANSLATION_WORD],verifiedTranslationVectorMm:delta,
  verifiedTranslationLengthMm:n,
  argument:'The four face reflections compose to a nonzero translation. Iterating it moves any interior point by k times this vector, giving infinitely many distinct formal image points.',
  infinitelyManyDistinctFormalPositions:true,notFiniteVisibilityProof:true};
};
const dedup=(array,p)=>array.some(x=>dist(x.point,p)<DEDUP_TOL);
const layerOrbit=(p,t,maxDepth)=>{
 const positions=[{point:p,firstDepth:0}],layers=[{depth:0,newPositions:1}];
 let frontier=[p];
 for(let depth=1;depth<=maxDepth;depth++){
  const next=[];
  for(const q of frontier)for(const name of ['AB','BC','CA']){
   const r=reflect(q,...t.lines[name]);
   if(!Number.isFinite(r.x)||!Number.isFinite(r.y))
    fail('NUMERIC_UNCERTAINTY','Formal orbit coordinates became non-finite');
   if(dedup(positions,r))continue;
   positions.push({point:r,firstDepth:depth});
   next.push(r);
   if(positions.length>1000)fail('UNSUPPORTED_SCOPE','Bounded orbit exceeded conservative 1000-position cap');
  }
  layers.push({depth,newPositions:next.length});
  frontier=next;
 }
 return {positions,layers};
};
export function mirrorOrbitCapabilities(){
 return {format:MIRROR_ORBIT_QUERY_FORMAT,resultFormat:MIRROR_ORBIT_RESULT_FORMAT,
  kinds:[KIND_STRUCTURE,KIND_SAMPLE],model:MIRROR_ORBIT_MODEL,
  topology:TOPOLOGY,reflectionPolicy:RELATION,
  structuralRequired:['format','kind','model','topology','reflectionPolicy'],
  numericAdditionalRequired:['vertices','source','maxReflectionOrder'],
  policy:{minSideMm:MIN_SIDE,maxSideMm:MAX_SIDE,maxAbsCoordinateMm:WORLD,
   minSourceClearanceMm:BOUNDARY_CLEARANCE,maxReflectionOrder:MAX_DEPTH,
   numericalPositionDedupMm:DEDUP_TOL},
  native:'not-run',limitations:base(KIND_STRUCTURE).limitations};
}
export function analyzeMirrorFormalOrbit(input){
 const required=['format','kind','model','topology','reflectionPolicy'];
 const sample=input?.kind===KIND_SAMPLE;
 strict(input,sample?[...required,'vertices','source','maxReflectionOrder']:required,
  sample?[...required,'vertices','source','maxReflectionOrder']:required,'Mirror orbit query');
 if(input.format!==MIRROR_ORBIT_QUERY_FORMAT||
  ![KIND_STRUCTURE,KIND_SAMPLE].includes(input.kind))
  fail('UNSUPPORTED_QUERY','Unsupported formal orbit query format/kind');
 if(input.model!==MIRROR_ORBIT_MODEL||input.topology!==TOPOLOGY||input.reflectionPolicy!==RELATION)
  fail('UNSUPPORTED_SCOPE','This query requires declared ideal supporting lines, equilateral enclosure and unbounded ideal reflections');
 const summary={...base(input.kind),value:{
  formalOrbitCardinality:'unbounded',physicalVisibleImageCount:null,
  sourceInsideAssumed:true,numberOfVisibleImagesCertified:false,
  constructiveWord:[...TRANSLATION_WORD],nonzeroTranslationProvenForEquilateralTriangle:true,
  arbitraryFiniteReflectionOrderNotTotalCount:true
 }};
 if(!sample)return summary;
 const vertices=validateVertices(input.vertices),source=canonicalPoint(input.source,'source');
 validateInside(source,vertices);
 const maxReflectionOrder=input.maxReflectionOrder;
 if(typeof maxReflectionOrder!=='number'||!Number.isSafeInteger(maxReflectionOrder)||
    maxReflectionOrder<0||maxReflectionOrder>MAX_DEPTH)
  fail('UNSUPPORTED_SCOPE','maxReflectionOrder must be an explicit integer 0–8');
 const translation=proof(vertices,source),orbit=layerOrbit(source,vertices,maxReflectionOrder);
 const points=orbit.positions.filter(v=>v.firstDepth>0);
 return {...summary,value:{...summary.value,
  authoredGeometryNotOriginalSource:true,triangleVerticesMm:input.vertices,
  sourceMm:source,sideLengthMm:vertices.s,
  maxReflectionOrder,finiteDepthFormalImagePositions:points,
  finiteDepthUniquePositionCount:points.length,
  countsByFirstDepth:orbit.layers,
  translationProof:translation,
  nativeImageDetected:false,completeVisibleImageCount:false},
  qualification:'Only a finite-depth set of mathematical reflection points is enumerated; actual finite-mirror images, ray paths and observer visibility remain unverified.'};
}
