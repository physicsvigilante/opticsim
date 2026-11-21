import {isRecord} from './qualified-utils.js';
import {fromBinary64} from './binary64-rational.js';

export const FOUR_WALL_FACTS='opticsim-four-wall-mirror-facts-v1';
export const FOUR_WALL_QUERY='opticsim-four-wall-mirror-query-v1';
const kind='four-wall-mirror-launch-directions';
const model='specular-rectangle-once-per-wall';
const units=Object.freeze({mm:1,cm:10,m:1000});
const exactGrid=1n<<64n,grid=Number(exactGrid);
const encode=x=>BigInt(x*grid);
const abs=x=>x<0n?-x:x;
const signs=[[-1,-1],[-1,1],[1,-1],[1,1]];
export function fourWallCapabilities(){
  return {format:FOUR_WALL_QUERY,factsFormat:FOUR_WALL_FACTS,kinds:[kind],model,
    geometries:['symbolic-rectangle','numeric-rectangle'],coordinates:'Bottom-left corner is origin. x right, y up.'};
}
function fail(code,message){throw Object.assign(new Error(message),{code});}
function fields(o,keys){
  if(!isRecord(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('INVALID_FOUR_WALL_FACTS','Unexpected mirror-box field.');
  for(const key of keys)if(!Object.hasOwn(o,key))fail('MISSING_FACTS','Missing '+key);
}
function symbolic(g){
  fields(g,['kind']);
  return {kind:'symbolic-directions',branches:signs.map(([x,y])=>({signs:[x,y],
    forwardVector:{x:'Bx-Ax '+(x<0?'-':'+')+' 2W',y:'By-Ay '+(y<0?'-':'+')+' 2H'},
    reverse:'Opposite of the corresponding forward vector if the four contacts clear all corners.'}))};
}
function axisEvents(start,delta,width,choice,negative,positive,axis){
  const den=abs(delta);
  const boundaries=choice>0?[[width,positive],[2n*width,negative]]:[[0n,negative],[-width,positive]];
  return boundaries.map(([wall,label])=>({label,axis,num:abs(wall-start),den}));
}
function fold(numerator,denominator,span){
  const period=2n*span*denominator;
  const position=((numerator%period)+period)%period;
  return position<=span*denominator?position:period-position;
}
const clearsCorner=(position,span)=>{
  const nearest=position<span-position?position:span-position;
  return nearest*10_000_000_000n>span;
};
function unfoldedContacts(ax,ay,width,height,dx,dy,xSign,ySign){
  const events=[...axisEvents(ax,dx,width,xSign,'left','right','x'),
    ...axisEvents(ay,dy,height,ySign,'bottom','top','y')];
  const compare=(a,b)=>{
    const diff=a.num*b.den-b.num*a.den;
    return diff<0n?-1:diff>0n?1:0;
  };
  events.sort(compare);
  if(events.slice(1).some((e,i)=>compare(events[i],e)===0))return {reason:'CORNER_CONTACT'};
  const contacts=[];
  for(const {label,axis,num,den} of events){
    const extent=axis==='x'?height:width;
    const offset=axis==='x'?fold(ay*den+dy*num,den,height):fold(ax*den+dx*num,den,width);
    if(!clearsCorner(offset,extent*den))return {reason:'NEAR_CORNER_CONTACT'};
    contacts.push({label,axis,extent,offset,den});
  }
  return {contacts};
}
function candidate(geometry,[xSign,ySign]){
  const {ax,ay,bx,by,width,height}=geometry;
  const dx=bx-ax+2n*BigInt(xSign)*width,dy=by-ay+2n*BigInt(ySign)*height;
  const base={signs:[xSign,ySign]},near={...base,status:'numerically-indeterminate',reasonCode:'NEAR_CORNER_CONTACT'};
  const {reason,contacts}=unfoldedContacts(ax,ay,width,height,dx,dy,xSign,ySign);
  if(reason==='CORNER_CONTACT')return {...base,status:'unavailable',reasonCode:reason};
  if(reason)return near;
  const points=[];
  for(const {label,axis,extent,offset,den} of contacts){
    const along=Number(offset)/Number(den)/grid;
    const rounded=fromBinary64(along);
    if(!clearsCorner(rounded.n*exactGrid,extent*rounded.d))return near;
    // The fixed coordinate is the exact authored plane. Only the coordinate
    // along the wall needs division and rounding.
    const fixed=label==='left'||label==='bottom'?0:Number(axis==='x'?width:height)/grid;
    points.push(axis==='x'?{wall:label,x:fixed,y:along}:{wall:label,x:along,y:fixed});
  }
  const x=Number(dx)/grid,y=Number(dy)/grid,norm=Math.hypot(x,y);
  const forward={x:x/norm,y:y/norm,wallOrder:contacts.map(e=>e.label)};
  const reverse={x:-forward.x,y:-forward.y,wallOrder:[...forward.wallOrder].reverse()};
  // Recheck the public binary64 headings as exact represented ratios. The
  // opposite heading starts at B, so it needs its own clearance proof.
  const rx=fromBinary64(forward.x),ry=fromBinary64(forward.y);
  const scaledX=rx.n*ry.d,scaledY=ry.n*rx.d;
  const supportForward=unfoldedContacts(ax,ay,width,height,scaledX,scaledY,xSign,ySign);
  const supportReverse=unfoldedContacts(bx,by,width,height,-scaledX,-scaledY,-xSign,-ySign);
  if(!supportForward.contacts?.every((entry,i)=>entry.label===forward.wallOrder[i])||
    !supportReverse.contacts?.every((entry,i)=>entry.label===reverse.wallOrder[i]))return near;
  return {...base,status:'conditional',forward,reverse,reflectionPoints:points};
}
function numeric(g){
  fields(g,['kind','lengthUnit','width','height','from','to']);
  if(typeof g.lengthUnit!=='string'||!Object.hasOwn(units,g.lengthUnit))fail('INVALID_FOUR_WALL_FACTS','Supply mm, cm or m.');
  const scale=units[g.lengthUnit];
  if(![g.width,g.height].every(d=>Number.isFinite(d)&&d*scale>=3&&d*scale<=10000))
    fail('UNSUPPORTED_SCOPE','Use a 3–10000 mm rectangle in each dimension.');
  for(const p of [g.from,g.to]){
    fields(p,['x','y']);
    if(![p.x,p.y].every(Number.isFinite)||Math.min(p.x,p.y,g.width-p.x,g.height-p.y)*scale<1)
      fail('UNSUPPORTED_SCOPE','Both points need at least 1 mm clearance from every wall.');
  }
  if(g.from.x===g.to.x&&g.from.y===g.to.y)fail('UNSUPPORTED_SCOPE','Use two distinct interior points.');
  const geometry={ax:encode(g.from.x),ay:encode(g.from.y),bx:encode(g.to.x),by:encode(g.to.y),width:encode(g.width),height:encode(g.height)};
  return {kind:'numeric-directions',lengthUnit:g.lengthUnit,branches:signs.map(s=>candidate(geometry,s))};
}
export function analyzeFourWall(f,q){
  if(f?.format!==FOUR_WALL_FACTS)fail('UNSUPPORTED_FACTS','Explicit rectangle and specular wall facts required.');
  fields(q,['kind','format']);
  if(q.kind!==kind||q.format!==FOUR_WALL_QUERY)fail('UNSUPPORTED_QUERY','Unknown mirror-box query.');
  fields(f,['format','model','geometry']);
  if(f.model!==model)fail('UNSUPPORTED_MODEL','Declare one reflection from each straight wall of a rectangle.');
  if(!['symbolic-rectangle','numeric-rectangle'].includes(f.geometry?.kind))fail('UNSUPPORTED_SCOPE','Supply a symbolic or fully dimensioned rectangle.');
  const value=f.geometry.kind==='numeric-rectangle'?numeric(f.geometry):symbolic(f.geometry);
  const pending=value.branches.some(c=>c.status==='numerically-indeterminate');
  const resolved=value.branches.some(c=>c.status==='conditional');
  const status=value.kind==='symbolic-directions'?'conditional':
    pending?(resolved?'partially-indeterminate':'numerically-indeterminate'):resolved?'conditional':'unavailable';
  return {format:'opticsim-four-wall-mirror-result-v1',kind,method:'conditional-analytical',status,native:{status:'not-run'},
    ...(pending?{reasonCode:'UNRESOLVED_CORNER_CLEARANCE',reason:'Corner proximity withholds one or more numeric branches.'}:{}),
    assumptions:['Two-dimensional ideal specular reflection with finite straight walls and both points inside.'],
    limitations:['A near or exact corner contact is withheld. Native traces and a physical absorbing target are separate evidence.'],
    value};
}
