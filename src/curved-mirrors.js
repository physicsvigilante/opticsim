// Geometry preparation only; native PhyDemo selects intersections and reflected rays.
export const CURVED_TYPES=Object.freeze(['ideal-curved-mirror','circular-arc-mirror']);
export const isCurved=type=>CURVED_TYPES.includes(type);
export const CURVED_PARAMETERS=Object.freeze({
  'ideal-curved-mirror':['x','y','normalDeg','focalLength','apertureHeight'],
  'circular-arc-mirror':['x','y','normalDeg','radius','apertureHeight']
});
export function curvedFrame(p){
  const a=p.normalDeg*Math.PI/180;
  return {n:{x:Math.cos(a),y:Math.sin(a)},t:{x:-Math.sin(a),y:Math.cos(a)}};
}
export function curvedPoints(c){
  const p=c.parameters,{n,t}=curvedFrame(p),h=p.apertureHeight/2;
  // Rationalized sag avoids subtracting nearly equal radii for narrow apertures.
  const r=Math.abs(p.radius),sag=c.type==='circular-arc-mirror'?
    Math.sign(p.radius)*h*h/(r+Math.sqrt((r-h)*(r+h))):0;
  return [{x:p.x+sag*n.x-h*t.x,y:p.y+sag*n.y-h*t.y},
    {x:p.x+sag*n.x+h*t.x,y:p.y+sag*n.y+h*t.y},{x:p.x,y:p.y}];
}
export function compileCurved(c){
  const [a,b,v]=curvedPoints(c),flip=p=>({x:p.x,y:-p.y});
  return c.type==='ideal-curved-mirror'?
    {type:'IdealMirror',p1:flip(a),p2:flip(b),focalLength:c.parameters.focalLength,filter:false}:
    {type:'ArcMirror',p1:flip(a),p2:flip(b),p3:flip(v),filter:false};
}
function pointSegmentDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function validateCurvedGeometry(components,endpoints,fail){
  const path='$.physics.components',sources=components.filter(c=>c.type==='point-source'),curves=components.filter(c=>isCurved(c.type));
  if(sources.length<1||sources.length>4||curves.length<1||curves.length>2||
    components.filter(c=>c.type==='plane-mirror').length>2||components.filter(c=>c.type==='ray-detector').length>2||
    components.some(c=>!['point-source','plane-mirror','ray-detector',...CURVED_TYPES].includes(c.type)))
    fail(path,'Curved scope: 1–4 sources, 1–2 curved reflectors, 0–2 plane mirrors, 0–2 detectors; no lenses or refractive surfaces.','UNSUPPORTED_SCOPE');
  const disks=curves.map(c=>{
    const p=c.parameters;
    if(c.type==='circular-arc-mirror'&&(Math.abs(p.radius)<2||p.apertureHeight/2>=Math.abs(p.radius)*.99))
      fail(path+'.'+c.id,'Circular minor arc needs |radius| >= 2 mm and half-aperture < 0.99 |radius|.');
    const points=curvedPoints(c);
    if(points.some(q=>![q.x,q.y].every(Number.isFinite)||Math.abs(q.x)>10000||Math.abs(q.y)>10000))
      fail(path+'.'+c.id,'Derived curved-mirror points exceed coordinate bounds.');
    return {id:c.id,p,r:Math.hypot(points[0].x-p.x,points[0].y-p.y)};
  });
  // Deliberately conservative scope, not a new intersection algorithm: each
  // aperture fits inside a disk about its vertex. Other objects must avoid it.
  for(let i=0;i<disks.length;i++){
    const d=disks[i];
    for(const e of disks.slice(i+1))if(Math.hypot(d.p.x-e.p.x,d.p.y-e.p.y)<=d.r+e.r+.01)
      fail(path,'Curved aperture bounding disks must not overlap.','UNSUPPORTED_SCOPE');
    for(const c of components){
      const p=c.parameters;
      if(c.type==='point-source'&&Math.hypot(p.x-d.p.x,p.y-d.p.y)<=d.r+.01)
        fail(path,'Source must be outside each curved aperture bounding disk.','UNSUPPORTED_SCOPE');
      if(['plane-mirror','ray-detector'].includes(c.type)&&pointSegmentDistance(d.p,...endpoints(p))<=d.r+.01)
        fail(path,'Finite segments must lie outside curved aperture bounding disks.','UNSUPPORTED_SCOPE');
    }
  }
}
