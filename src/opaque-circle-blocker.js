// Native-first opaque 2D disks. This module validates the *authored geometry*
// and compiles PhyDemo's pinned CircleBlocker; it does not trace or route rays.
export const CIRCLE_BLOCKER_TYPE='circle-blocker';
const CLEARANCE_MM=0.01;
export function circleBlockerExtents({x,y,radius}){
  return [{x:x-radius,y},{x:x+radius,y},{x,y:y-radius},{x,y:y+radius}];
}
export function compileCircleBlocker(component){
  const {x,y,radius}=component.parameters;
  return {type:'CircleBlocker',p1:{x,y:-y},p2:{x:x+radius,y:-y},filter:false};
}
// Minimum Euclidean distance to the *finite* segment; testing only the
// supporting line misses overlaps near segment endpoints.
function pointSegmentDistance(p,[a,b]){
  const dx=b.x-a.x,dy=b.y-a.y,lengthSquared=dx*dx+dy*dy;
  const t=lengthSquared===0?0:Math.max(0,Math.min(1,
    ((p.x-a.x)*dx+(p.y-a.y)*dy)/lengthSquared));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
export function validateCircleBlockerGeometry(components,mirrorEndpoints,fail){
  const circles=components.map((c,index)=>({...c,index}))
    .filter(c=>c.type===CIRCLE_BLOCKER_TYPE);
  if(!circles.length)return;
  const sources=components.filter(c=>c.type==='point-source');
  const segments=components.filter(c=>['ideal-lens','plane-mirror','line-blocker','ray-detector'].includes(c.type))
    .map(c=>({id:c.id,line:c.type==='ideal-lens'
      ? [{x:c.parameters.x,y:-c.parameters.apertureHeight/2},
         {x:c.parameters.x,y:c.parameters.apertureHeight/2}]
      : mirrorEndpoints(c.parameters)}));
  for(const [i,circle] of circles.entries()){
    const p=circle.parameters,path='$.physics.components['+circle.index+'].parameters';
    if(Math.abs(p.x)+p.radius>10000||Math.abs(p.y)+p.radius>10000)
      fail(path,'entire opaque circle must remain within +/-10000 mm','UNSUPPORTED_SCOPE');
    if(sources.some(s=>Math.hypot(s.parameters.x-p.x,s.parameters.y-p.y)-p.radius<CLEARANCE_MM))
      fail(path,'each source must be outside opaque circle by at least 0.01 mm','UNSUPPORTED_SCOPE');
    for(const other of circles.slice(0,i)){
      if(Math.hypot(other.parameters.x-p.x,other.parameters.y-p.y)-
          (other.parameters.radius+p.radius)<CLEARANCE_MM)
        fail(path,'opaque circles overlap or touch ('+other.id+' and '+circle.id+')','UNSUPPORTED_SCOPE');
    }
    for(const segment of segments){
      if(pointSegmentDistance(p,segment.line)-p.radius<CLEARANCE_MM)
        fail(path,'opaque circle intersects or nearly touches finite surface '+segment.id,'UNSUPPORTED_SCOPE');
    }
  }
}
