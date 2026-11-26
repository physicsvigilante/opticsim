// Shared behavior-preserving geometry, dielectric-body clearance, and
// route-independent observed native ray-state audit helpers for composable
// native benches (v37 optical, v38 refractive, v39 hybrid).
// Pinned PhyDemo alone owns all ray tracing, intersections, refraction, TIR,
// reflection, lens deflection, and absorption.
import {CIRCULAR_TYPE,circularEncounter,circularExtents} from './circular-dielectric.js';
import {segmentsIntersect} from './composition-validation.js';
import {curvedFrame,curvedPoints,isCurved} from './curved-mirrors.js';
import {FINITE_APERTURE_TYPE,apertureGeometry,separatedSegmentDistance} from './finite-aperture.js';
import {CAP_TYPE,capEncounter,capExtents,capGeometry} from './finite-circular-cap.js';
import {finiteGlassFaces,segmentOutsideFiniteGlass} from './finite-glass-geometry.js';
import {CIRCLE_BLOCKER_TYPE} from './opaque-circle-blocker.js';
import {
  BEAM_CLEARANCE_MM,
  PARALLEL_BEAM_TYPE,
  parallelBeamGeometry,
  pinnedBeamAdmissionSamples
} from './parallel-beam.js';
import {POLYGON_TYPE,polygonEncounter,polygonVertices} from './polygon-dielectric.js';
import {SPHERICAL_LENS_TYPE,sphericalLensEncounter,thickLensExtents,thickLensGeometry} from './spherical-lens.js';
import {PRISM_TYPE,prismEncounter,prismVertices} from './triangular-prism.js';

export const BENCH_CLEARANCE_MM=0.01;
export const BENCH_CONTACT_TOL_MM=1e-11;
export const BENCH_MIN_CONTACT_OVERLAP_MM=1;
export const BENCH_NATIVE_STATE_LIMIT=10000;
export const OPTICAL_BENCH_V40_VERSION=40;
export const DIELECTRIC_BODY_TYPES=Object.freeze([
  PRISM_TYPE,POLYGON_TYPE,CIRCULAR_TYPE,SPHERICAL_LENS_TYPE
]);
export const V40_DIELECTRIC_BODY_TYPES=Object.freeze([
  ...DIELECTRIC_BODY_TYPES,CAP_TYPE
]);

export const delta=(a,b)=>({x:b.x-a.x,y:b.y-a.y});
export const dot=(a,b)=>a.x*b.x+a.y*b.y;
export const cross=(a,b)=>a.x*b.y-a.y*b.x;
export const allowedCoord=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=10000&&Math.abs(y)<=10000;

export function pointSegmentDistance(p,[a,b]){
  const dx=b.x-a.x,dy=b.y-a.y,lenSq=dx*dx+dy*dy;
  const t=lenSq===0?0:Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/lenSq));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

export function signedSupportDistance(point,[a,b]){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(!(len>0&&Number.isFinite(len)))return NaN;
  return (dx*(point.y-a.y)-dy*(point.x-a.x))/len;
}

export function extractNativeRay(ray){
  const p=ray?.p1,q=ray?.p2;
  if(!p||!q||![p.x,p.y,q.x,q.y].every(Number.isFinite))return null;
  const vx=q.x-p.x,vy=-(q.y-p.y),len=Math.hypot(vx,vy);
  if(!(len>1e-12&&Number.isFinite(len)))return null;
  return {origin:{x:p.x,y:-p.y},dir:{x:vx/len,y:vy/len}};
}

export function buildDielectricBody(c,cPath,fail,{allowSignedSpherical=false}={}){
  const p=c.parameters;
  if(c.type===PRISM_TYPE){
    const v=prismVertices(p);
    if(v.some(q=>!allowedCoord(q.x,q.y)))
      fail(cPath,'Prism vertices must be finite and within +/-10000 mm.','UNSUPPORTED_SCOPE');
    const faces=finiteGlassFaces(v);
    const twiceArea=Math.abs(cross(delta(v[0],v[1]),delta(v[0],v[2])));
    if(faces.some(f=>f.length<1||twiceArea/f.length<1))
      fail(cPath,'Prism edges and altitudes must be at least 1 mm; collinear or repeated vertices are invalid.','UNSUPPORTED_SCOPE');
    return {kind:'poly',id:c.id,type:c.type,insideIndex:p.insideIndex,outsideIndex:p.outsideIndex,vertices:v,faces,flatFaces:faces,corners:v,tangentCircles:[]};
  }
  if(c.type===POLYGON_TYPE){
    const v=polygonVertices(p);
    if(v.some(q=>!allowedCoord(q.x,q.y)))
      fail(cPath,'All four polygon vertices must be finite and within +/-10000 mm.','UNSUPPORTED_SCOPE');
    const turns=v.map((a,i)=>cross(delta(a,v[(i+1)%4]),delta(v[(i+1)%4],v[(i+2)%4])));
    const winding=Math.sign(turns[0]);
    if(!winding||turns.some(t=>winding*t<=0))
      fail(cPath,'Quadrilateral must be strictly convex with consistent vertex winding.','UNSUPPORTED_SCOPE');
    const faces=finiteGlassFaces(v);
    if(faces.some((f,i)=>f.length<1||v.some((q,j)=>j!==i&&j!==(i+1)%4&&
         Math.abs(cross(delta(f.a,f.b),delta(f.a,q)))/f.length<1)))
      fail(cPath,'All polygon edges and opposite-vertex altitudes must be at least 1 mm.','UNSUPPORTED_SCOPE');
    return {kind:'poly',id:c.id,type:c.type,insideIndex:p.insideIndex,outsideIndex:p.outsideIndex,vertices:v,faces,flatFaces:faces,corners:v,tangentCircles:[]};
  }
  if(c.type===CIRCULAR_TYPE){
    if(p.radius<2||circularExtents(p).some(q=>!allowedCoord(q.x,q.y)))
      fail(cPath,'Circular dielectric requires radius >= 2 mm and must fit within +/-10000 mm.','UNSUPPORTED_SCOPE');
    const center={x:p.x,y:p.y};
    return {kind:'circle',id:c.id,type:c.type,insideIndex:p.insideIndex,outsideIndex:p.outsideIndex,center,radius:p.radius,flatFaces:[],corners:[],tangentCircles:[{center,radius:p.radius}]};
  }
  if(c.type===CAP_TYPE){
    if(!(p.radius>=2&&p.capHeight>=1&&2*p.radius-p.capHeight>=1))
      fail(cPath,'Circular cap requires radius >= 2 mm and capHeight in [1, 2*radius - 1] mm.','UNSUPPORTED_SCOPE');
    const g=capGeometry(p),extents=capExtents(p);
    if(!(Number.isFinite(g.halfChord)&&g.halfChord>=1)||extents.some(q=>!allowedCoord(q.x,q.y)))
      fail(cPath,'Circular cap requires chord length >= 2 mm and must fit completely within +/-10000 mm.','UNSUPPORTED_SCOPE');
    return {
      kind:'cap',id:c.id,type:c.type,insideIndex:p.insideIndex,outsideIndex:p.outsideIndex,
      base:g.base,u:g.u,t:g.t,center:g.center,radius:g.radius,capHeight:g.capHeight,
      halfChord:g.halfChord,p1:g.p1,p2:g.p2,apex:g.apex,capHalfAngle:g.capHalfAngle,
      vertices:extents,
      flatFaces:[{a:g.p1,b:g.p2,normal:g.flatNormal,length:2*g.halfChord}],
      corners:[g.p1,g.p2],
      tangentCircles:[{center:g.center,radius:g.radius}]
    };
  }
  // SPHERICAL_LENS_TYPE: conservative convex AABB contains the complete physical lens
  // (biconvex, plano-convex, plano-concave, meniscus, biconcave, or flat-flat in v40);
  // curved generating circles are retained for tangency admission and runtime qualification.
  const half=p.apertureHeight/2;
  const radiusOk=r=>allowSignedSpherical
    ?(r===null||(Number.isFinite(r)&&Math.abs(r)>=half+1&&Math.abs(r)<=10000))
    :(Number.isFinite(r)&&r>=half+1);
  if(!(p.apertureHeight>=4&&p.centerThickness>=2&&radiusOk(p.frontRadius)&&radiusOk(p.backRadius)))
    fail(cPath,allowSignedSpherical
      ?'Spherical lens requires aperture >= 4 mm, thickness >= 2 mm, and each face radius either null (flat) or |radius| >= half-aperture + 1 mm.'
      :'Spherical lens requires aperture >= 4 mm, thickness >= 2 mm and each radius >= half-aperture + 1 mm.','UNSUPPORTED_SCOPE');
  const g=thickLensGeometry(p);
  if(!Number.isFinite(g.edgeThickness)||g.edgeThickness<1)
    fail(cPath,'Spherical lens faces must retain edge thickness >= 1 mm.','UNSUPPORTED_SCOPE');
  if(thickLensExtents(p).some(v=>!allowedCoord(v.x,v.y)))
    fail(cPath,'Entire native spherical lens must lie within +/-10000 mm.','UNSUPPORTED_SCOPE');
  const boxVertices=[
    {x:g.left,y:g.bottom},{x:g.right,y:g.bottom},
    {x:g.right,y:g.top},{x:g.left,y:g.top}
  ];
  const tangentCircles=[];
  if(p.frontRadius!==null)tangentCircles.push({center:g.frontCenter,radius:Math.abs(p.frontRadius)});
  if(p.backRadius!==null)tangentCircles.push({center:g.backCenter,radius:Math.abs(p.backRadius)});
  const flatFaces=[];
  if(p.frontRadius===null){
    flatFaces.push({
      a:{x:g.frontApex,y:g.bottom},b:{x:g.frontApex,y:g.top},
      normal:{x:-1,y:0},length:p.apertureHeight
    });
  }
  if(p.backRadius===null){
    flatFaces.push({
      a:{x:g.backApex,y:g.top},b:{x:g.backApex,y:g.bottom},
      normal:{x:1,y:0},length:p.apertureHeight
    });
  }
  return {
    kind:'poly',id:c.id,type:c.type,insideIndex:p.insideIndex,outsideIndex:p.outsideIndex,
    vertices:boxVertices,faces:finiteGlassFaces(boxVertices),flatFaces,corners:g.corners,
    lensParams:p,lensGeom:g,tangentCircles
  };
}

export function pointCapArcDistance(pt,cap){
  const dx=pt.x-cap.center.x,dy=pt.y-cap.center.y,d=Math.hypot(dx,dy);
  if(d>0){
    const qx=cap.center.x+cap.radius*dx/d,qy=cap.center.y+cap.radius*dy/d;
    if((qx-cap.base.x)*cap.u.x+(qy-cap.base.y)*cap.u.y>=0)return Math.abs(d-cap.radius);
  }
  return Math.min(Math.hypot(pt.x-cap.p1.x,pt.y-cap.p1.y),Math.hypot(pt.x-cap.p2.x,pt.y-cap.p2.y));
}

function circularArcMirrorGeom(arcMirror){
  const p=arcMirror.parameters,{n}=curvedFrame(p),pts=curvedPoints(arcMirror);
  const center={x:p.x+p.radius*n.x,y:p.y+p.radius*n.y},radius=Math.abs(p.radius);
  const sgn=Math.sign(p.radius),uVertex={x:-sgn*n.x,y:-sgn*n.y};
  const halfAngle=Math.asin(Math.min(1,p.apertureHeight/(2*radius)));
  return {center,radius,uVertex,halfAngle,p1:pts[0],p2:pts[1]};
}

export function pointCircularArcMirrorDistance(pt,arcMirror){
  const g=circularArcMirrorGeom(arcMirror);
  const dx=pt.x-g.center.x,dy=pt.y-g.center.y,d=Math.hypot(dx,dy);
  if(d>0){
    const uPt={x:dx/d,y:dy/d};
    const angle=Math.atan2(Math.abs(cross(g.uVertex,uPt)),dot(g.uVertex,uPt));
    if(angle<=g.halfAngle)return Math.abs(d-g.radius);
  }
  return Math.min(Math.hypot(pt.x-g.p1.x,pt.y-g.p1.y),Math.hypot(pt.x-g.p2.x,pt.y-g.p2.y));
}

export function segmentOutsideCircularArcMirror(seg,arcMirror,clearance){
  if(pointCircularArcMirrorDistance(seg[0],arcMirror)<clearance||
     pointCircularArcMirrorDistance(seg[1],arcMirror)<clearance)return false;
  const g=circularArcMirrorGeom(arcMirror);
  const [a,b]=seg,v=delta(a,b),lenSq=dot(v,v);
  if(pointSegmentDistance(g.p1,seg)<clearance||pointSegmentDistance(g.p2,seg)<clearance)return false;
  const sFoot=lenSq>0?Math.max(0,Math.min(1,dot(delta(a,g.center),v)/lenSq)):0;
  const pFoot={x:a.x+sFoot*v.x,y:a.y+sFoot*v.y};
  const dFoot=Math.hypot(pFoot.x-g.center.x,pFoot.y-g.center.y);
  if(dFoot>=g.radius+clearance)return true;
  const onArc=q=>{
    const dx=q.x-g.center.x,dy=q.y-g.center.y,r=Math.hypot(dx,dy);
    if(!(r>0))return false;
    return Math.atan2(Math.abs(cross(g.uVertex,{x:dx/r,y:dy/r})),dot(g.uVertex,{x:dx/r,y:dy/r}))<=g.halfAngle;
  };
  if(dFoot<=g.radius){
    if(lenSq>0){
      const w=delta(g.center,a),b2=dot(w,v),c0=dot(w,w)-g.radius*g.radius;
      const disc=Math.max(0,b2*b2-lenSq*c0),root=Math.sqrt(disc);
      for(const s of [(-b2-root)/lenSq,(-b2+root)/lenSq]){
        if(s>=0&&s<=1&&onArc({x:a.x+s*v.x,y:a.y+s*v.y}))return false;
      }
    }
    // Check if the foot on the interior side of the circle is within clearance of the arc itself.
    if(dFoot>g.radius-clearance&&onArc(pFoot))return false;
    return true;
  }
  return !onArc(pFoot);
}

// Exact Euclidean clearance between a circular-arc-mirror minor arc and a finite dielectric body
// (circular-dielectric, circular-cap-dielectric, convex triangular-prism/polygon-dielectric, or
// spherical-lens conservative convex AABB). Rejects interior containment, intersections, and < clearance gaps.
export function circularArcMirrorOutsideBodyExact(arcMirror,body,clearance=BENCH_CLEARANCE_MM){
  if(body.kind==='circle')
    return pointCircularArcMirrorDistance(body.center,arcMirror)>=body.radius+clearance;
  const p=arcMirror.parameters,vertex={x:p.x,y:p.y},g=circularArcMirrorGeom(arcMirror);
  if(body.kind==='cap'){
    if(pointBodyMembership(vertex,body,clearance)!=='outside'||
       pointBodyMembership(g.p1,body,clearance)!=='outside'||
       pointBodyMembership(g.p2,body,clearance)!=='outside')return false;
    if(!segmentOutsideCircularArcMirror([body.p1,body.p2],arcMirror,clearance))return false;
    const dx=body.center.x-g.center.x,dy=body.center.y-g.center.y,dist=Math.hypot(dx,dy);
    if(dist>=g.radius+body.radius+clearance)return true;
    if(dist<=1e-12){
      if(Math.abs(g.radius-body.radius)<clearance){
        const sep=Math.atan2(Math.abs(cross(g.uVertex,body.u)),dot(g.uVertex,body.u));
        if(sep<=g.halfAngle+body.capHalfAngle)return false;
      }
      return true;
    }
    const onArc=q=>{
      const qx=q.x-g.center.x,qy=q.y-g.center.y,r=Math.hypot(qx,qy);
      if(!(r>0))return false;
      return Math.atan2(Math.abs(cross(g.uVertex,{x:qx/r,y:qy/r})),dot(g.uVertex,{x:qx/r,y:qy/r}))<=g.halfAngle;
    };
    const e={x:dx/dist,y:dy/dist},ep={x:-e.y,y:e.x};
    if(Math.abs(g.radius-body.radius)<=dist&&dist<=g.radius+body.radius){
      const ax=(g.radius*g.radius-body.radius*body.radius+dist*dist)/(2*dist);
      const h=Math.sqrt(Math.max(0,g.radius*g.radius-ax*ax));
      for(const sgn of [-1,1]){
        const q={x:g.center.x+ax*e.x+sgn*h*ep.x,y:g.center.y+ax*e.y+sgn*h*ep.y};
        if(onArc(q)&&dot(delta(body.base,q),body.u)>=0)return false;
      }
    }
    for(const sA of [-1,1])for(const sB of [-1,1]){
      const qA={x:g.center.x+sA*g.radius*e.x,y:g.center.y+sA*g.radius*e.y};
      const qB={x:body.center.x+sB*body.radius*e.x,y:body.center.y+sB*body.radius*e.y};
      if(onArc(qA)&&dot(delta(body.base,qB),body.u)>=0&&
         Math.hypot(qA.x-qB.x,qA.y-qB.y)<clearance)return false;
    }
    return true;
  }
  // Convex polygon (triangular-prism, polygon-dielectric, or spherical-lens conservative AABB):
  for(const pt of [vertex,g.p1,g.p2])
    if(body.faces.every(f=>dot(delta(f.a,pt),f.normal)<=0))return false;
  for(const f of body.faces)
    if(!segmentOutsideCircularArcMirror([f.a,f.b],arcMirror,clearance))return false;
  return true;
}

// Exact point membership relative to an admitted finite dielectric body.
// - circular-dielectric: exact radial distance vs radius +/- clearance
// - circular-cap-dielectric: exact disk intersection with flat-base half-plane
// - triangular-prism / polygon-dielectric: exact signed half-space distance inside,
//   exact Euclidean edge distance outside
// - spherical-lens: exterior-only in v40 (conservative bounding-box clearance)
export function pointBodyMembership(pt,body,clearance=BENCH_CLEARANCE_MM){
  if(body.kind==='circle'){
    const d=Math.hypot(pt.x-body.center.x,pt.y-body.center.y);
    if(Math.abs(d-body.radius)<clearance)return 'boundary';
    return d<body.radius?'inside':'outside';
  }
  if(body.kind==='cap'){
    const axial=dot(delta(body.base,pt),body.u);
    const d=Math.hypot(pt.x-body.center.x,pt.y-body.center.y);
    if(d<=body.radius-clearance&&axial>=clearance)return 'inside';
    if(d<=body.radius&&axial>=0)return 'boundary';
    const dist=Math.min(pointSegmentDistance(pt,[body.p1,body.p2]),pointCapArcDistance(pt,body));
    return dist<clearance?'boundary':'outside';
  }
  if(body.type===SPHERICAL_LENS_TYPE)
    return pointOutsideBody(pt,body,clearance)?'outside':'unsupported-interior';
  let maxSigned=-Infinity;
  for(const f of body.faces){
    const s=dot(delta(f.a,pt),f.normal);
    if(s>maxSigned)maxSigned=s;
  }
  if(maxSigned<=-clearance)return 'inside';
  if(maxSigned<=0)return 'boundary';
  let minEdge=Infinity;
  for(const f of body.faces){
    const d=pointSegmentDistance(pt,[f.a,f.b]);
    if(d<minEdge)minEdge=d;
  }
  return minEdge<clearance?'boundary':'outside';
}

export function resolveSourceMembership(pt,bodies,backgroundIndex,clearance=BENCH_CLEARANCE_MM){
  let host=null;
  for(const body of bodies){
    const status=pointBodyMembership(pt,body,clearance);
    if(status==='boundary'||status==='unsupported-interior')return {status,bodyId:body.id};
    if(status==='inside'){
      if(host)return {status:'ambiguous',bodyId:body.id};
      host=body;
    }
  }
  return host
    ?{status:'inside',regionId:host.id,body:host,mediumIndex:host.insideIndex}
    :{status:'ambient',regionId:'ambient',body:null,mediumIndex:backgroundIndex};
}

export function pointOutsideBody(pt,body,clearance){
  if(body.kind==='circle')
    return Math.hypot(pt.x-body.center.x,pt.y-body.center.y)>=body.radius+clearance;
  if(body.kind==='cap')
    return pointBodyMembership(pt,body,clearance)==='outside';
  return body.faces.some(f=>dot(delta(f.a,pt),f.normal)>=clearance);
}

export function segmentOutsideBody(seg,body,clearance){
  if(body.kind==='circle')
    return pointSegmentDistance(body.center,seg)>=body.radius+clearance;
  if(body.kind==='cap')
    return segmentOutsideCapExact(seg,body,clearance);
  return segmentOutsideFiniteGlass(body.faces,seg,clearance);
}

function segmentOutsideCapExact(seg,cap,clearance){
  const [a,b]=seg;
  if(pointBodyMembership(a,cap,clearance)!=='outside'||
     pointBodyMembership(b,cap,clearance)!=='outside')return false;
  const chord=[cap.p1,cap.p2];
  if(segmentsIntersect(seg,chord)||separatedSegmentDistance(seg,chord)<clearance)return false;
  const v=delta(a,b),lenSq=dot(v,v);
  const sFoot=lenSq>0?Math.max(0,Math.min(1,dot(delta(a,cap.center),v)/lenSq)):0;
  const pFoot={x:a.x+sFoot*v.x,y:a.y+sFoot*v.y};
  const dFoot=Math.hypot(pFoot.x-cap.center.x,pFoot.y-cap.center.y);
  if(dFoot>=cap.radius+clearance)return true;
  if(dFoot<=cap.radius){
    if(dot(delta(cap.base,pFoot),cap.u)>=0)return false;
    if(lenSq>0){
      const w=delta(cap.center,a),b2=dot(w,v),c0=dot(w,w)-cap.radius*cap.radius;
      const disc=Math.max(0,b2*b2-lenSq*c0),root=Math.sqrt(disc);
      for(const s of [(-b2-root)/lenSq,(-b2+root)/lenSq]){
        if(s>=0&&s<=1&&dot(delta(cap.base,{x:a.x+s*v.x,y:a.y+s*v.y}),cap.u)>=0)return false;
      }
    }
    return true;
  }
  const qx=cap.center.x+cap.radius*(pFoot.x-cap.center.x)/dFoot;
  const qy=cap.center.y+cap.radius*(pFoot.y-cap.center.y)/dFoot;
  return (qx-cap.base.x)*cap.u.x+(qy-cap.base.y)*cap.u.y<0;
}

// Exact Euclidean clearance between a finite segment and a convex body
// (circle, circular cap, or convex polygon / thick-lens AABB). Unlike single-face
// separation, this admits tall vertical lenses/mirrors/detectors cleanly separated
// from slanted faces or curved caps.
export function segmentOutsideBodyExact(seg,body,clearance){
  if(body.kind==='circle')
    return pointSegmentDistance(body.center,seg)>=body.radius+clearance;
  if(body.kind==='cap')
    return segmentOutsideCapExact(seg,body,clearance);
  for(const pt of seg)
    if(body.faces.every(f=>dot(delta(f.a,pt),f.normal)<=0))return false;
  for(const f of body.faces){
    const edge=[f.a,f.b];
    if(segmentsIntersect(edge,seg)||separatedSegmentDistance(edge,seg)<clearance)return false;
  }
  return true;
}

export function circleOutsideBody(circle,body,clearance){
  if(body.kind==='circle')
    return Math.hypot(circle.center.x-body.center.x,circle.center.y-body.center.y)>=circle.radius+body.radius+clearance;
  if(body.kind==='cap')
    return pointBodyMembership(circle.center,body,circle.radius+clearance)==='outside';
  return body.faces.some(f=>dot(delta(f.a,circle.center),f.normal)>=circle.radius+clearance);
}

// Exact Euclidean interior containment for a finite segment inside an admitted convex dielectric body
// (circular-dielectric, circular-cap-dielectric, triangular-prism, or polygon-dielectric).
// Because every admitted body's clearance-eroded interior is convex, both endpoints strictly inside
// by >= clearance guarantees every point of the segment is >= clearance from the boundary.
// spherical-lens stays exterior-only (conservative AABB does not certify lens interior).
export function segmentInsideBodyExact(seg,body,clearance=BENCH_CLEARANCE_MM){
  if(body.type===SPHERICAL_LENS_TYPE)return false;
  return pointBodyMembership(seg[0],body,clearance)==='inside'&&
         pointBodyMembership(seg[1],body,clearance)==='inside';
}

// Exact Euclidean interior containment for a closed disk/circle inside an admitted convex dielectric body
// (circular-dielectric, circular-cap-dielectric, triangular-prism, or polygon-dielectric).
// spherical-lens stays exterior-only.
export function circleInsideBodyExact(circle,body,clearance=BENCH_CLEARANCE_MM){
  if(body.type===SPHERICAL_LENS_TYPE)return false;
  const margin=circle.radius+clearance;
  if(body.kind==='circle')
    return Math.hypot(circle.center.x-body.center.x,circle.center.y-body.center.y)<=body.radius-margin;
  if(body.kind==='cap'){
    const axial=dot(delta(body.base,circle.center),body.u);
    const d=Math.hypot(circle.center.x-body.center.x,circle.center.y-body.center.y);
    return d<=body.radius-margin&&axial>=margin;
  }
  return body.faces.every(f=>dot(delta(f.a,circle.center),f.normal)<=-margin);
}

// Exact Euclidean clearance between a circle/disk and a convex body
// (circle, circular cap, convex polygon, or spherical-lens conservative AABB).
// Excludes centers inside/on the body (no nesting), then compares the
// center's exact boundary distance against radius + clearance.
export function circleOutsideBodyExact(circle,body,clearance){
  if(body.kind==='circle')
    return Math.hypot(circle.center.x-body.center.x,circle.center.y-body.center.y)>=circle.radius+body.radius+clearance;
  if(body.kind==='cap')
    return pointBodyMembership(circle.center,body,circle.radius+clearance)==='outside';
  if(body.faces.every(f=>dot(delta(f.a,circle.center),f.normal)<=0))return false;
  for(const f of body.faces)
    if(pointSegmentDistance(circle.center,[f.a,f.b])<circle.radius+clearance)return false;
  return true;
}

function capsDisjointExact(a,b,clearance){
  if(pointBodyMembership(a.apex,b,clearance)!=='outside'||
     pointBodyMembership(b.apex,a,clearance)!=='outside')return false;
  if(!segmentOutsideCapExact([a.p1,a.p2],b,clearance)||
     !segmentOutsideCapExact([b.p1,b.p2],a,clearance))return false;
  const dx=b.center.x-a.center.x,dy=b.center.y-a.center.y,dist=Math.hypot(dx,dy);
  if(dist>=a.radius+b.radius+clearance)return true;
  if(dist<=1e-12){
    if(Math.abs(a.radius-b.radius)<clearance){
      const sep=Math.atan2(Math.abs(cross(a.u,b.u)),dot(a.u,b.u));
      if(sep<=a.capHalfAngle+b.capHalfAngle)return false;
    }
    return true;
  }
  const e={x:dx/dist,y:dy/dist},ep={x:-e.y,y:e.x};
  if(Math.abs(a.radius-b.radius)<=dist&&dist<=a.radius+b.radius){
    const ax=(a.radius*a.radius-b.radius*b.radius+dist*dist)/(2*dist);
    const h=Math.sqrt(Math.max(0,a.radius*a.radius-ax*ax));
    for(const sgn of [-1,1]){
      const q={x:a.center.x+ax*e.x+sgn*h*ep.x,y:a.center.y+ax*e.y+sgn*h*ep.y};
      if(dot(delta(a.base,q),a.u)>=0&&dot(delta(b.base,q),b.u)>=0)return false;
    }
  }
  for(const sA of [-1,1])for(const sB of [-1,1]){
    const qA={x:a.center.x+sA*a.radius*e.x,y:a.center.y+sA*a.radius*e.y};
    const qB={x:b.center.x+sB*b.radius*e.x,y:b.center.y+sB*b.radius*e.y};
    if(dot(delta(a.base,qA),a.u)>=0&&dot(delta(b.base,qB),b.u)>=0&&
       Math.hypot(qA.x-qB.x,qA.y-qB.y)<clearance)return false;
  }
  return true;
}

function capOutsidePolyExact(cap,poly,clearance){
  if(poly.vertices.some(v=>pointBodyMembership(v,cap,clearance)!=='outside'))return false;
  if(poly.faces.every(f=>dot(delta(f.a,cap.apex),f.normal)<=0))return false;
  for(const f of poly.faces)
    if(!segmentOutsideCapExact([f.a,f.b],cap,clearance))return false;
  return true;
}

export function bodiesDisjoint(a,b,clearance){
  if(a.kind==='circle'&&b.kind==='circle')
    return Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y)>=a.radius+b.radius+clearance;
  if(a.kind==='circle')return circleOutsideBody(a,b,clearance);
  if(b.kind==='circle')return circleOutsideBody(b,a,clearance);
  if(a.kind==='cap'||b.kind==='cap')return bodiesDisjointExact(a,b,clearance);
  return a.faces.some(f=>b.vertices.every(v=>dot(delta(f.a,v),f.normal)>=clearance))||
         b.faces.some(f=>a.vertices.every(v=>dot(delta(f.a,v),f.normal)>=clearance));
}

export function bodiesDisjointExact(a,b,clearance){
  if(a.kind==='circle'&&b.kind==='circle')
    return Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y)>=a.radius+b.radius+clearance;
  if(a.kind==='circle')return circleOutsideBodyExact(a,b,clearance);
  if(b.kind==='circle')return circleOutsideBodyExact(b,a,clearance);
  if(a.kind==='cap'&&b.kind==='cap')return capsDisjointExact(a,b,clearance);
  if(a.kind==='cap')return capOutsidePolyExact(a,b,clearance);
  if(b.kind==='cap')return capOutsidePolyExact(b,a,clearance);
  if(a.vertices.some(v=>b.faces.every(f=>dot(delta(f.a,v),f.normal)<=0)))return false;
  if(b.vertices.some(v=>a.faces.every(f=>dot(delta(f.a,v),f.normal)<=0)))return false;
  for(const fa of a.faces){
    const ea=[fa.a,fa.b];
    for(const fb of b.faces){
      const eb=[fb.a,fb.b];
      if(segmentsIntersect(ea,eb)||separatedSegmentDistance(ea,eb)<clearance)return false;
    }
  }
  return true;
}

function collinearOverlapMm(a,b,c,d){
  const vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy);
  if(!(len>0&&Number.isFinite(len)))return 0;
  const tx=vx/len,ty=vy/len;
  const pc=(c.x-a.x)*tx+(c.y-a.y)*ty,pd=(d.x-a.x)*tx+(d.y-a.y)*ty;
  return Math.min(len,Math.max(pc,pd))-Math.max(0,Math.min(pc,pd));
}

// Exact clean flat-face contact between two disjoint-interior dielectric bodies
// (e.g. stacked slabs, water-on-glass, prism-on-slab, or flat face of a spherical lens on a slab).
// Contact tolerance 1e-11 mm stays 10x below PhyDemo's 1e-6 mm MIN_RAY_SEGMENT_LENGTH merge threshold
// across the admitted dielectric angular envelope (|d·n| > 1e-4) while rejecting near-contact gaps.
export function bodiesShareFlatContact(a,b,tol=BENCH_CONTACT_TOL_MM,minOverlap=BENCH_MIN_CONTACT_OVERLAP_MM){
  if(!a.flatFaces?.length||!b.flatFaces?.length)return false;
  for(const fa of a.flatFaces){
    for(const fb of b.flatFaces){
      if(dot(fa.normal,fb.normal)>-1+1e-9)continue;
      if(Math.abs(dot(delta(fa.a,fb.a),fa.normal))>tol||Math.abs(dot(delta(fa.a,fb.b),fa.normal))>tol)continue;
      if(b.vertices.some(v=>dot(delta(fa.a,v),fa.normal)<-tol))continue;
      if(a.vertices.some(v=>dot(delta(fb.a,v),fb.normal)<-tol))continue;
      if(collinearOverlapMm(fa.a,fa.b,fb.a,fb.b)>=minOverlap)return true;
    }
  }
  return false;
}

// Exact coaxial cemented-doublet contact between two spherical-lens bodies:
// left lens back face and right lens front face share identical apex and opposite-signed curvature
// (or both flat), guaranteeing disjoint interiors across both apertures.
export function sphericalLensesCemented(a,b,tol=BENCH_CONTACT_TOL_MM){
  if(a.type!==SPHERICAL_LENS_TYPE||b.type!==SPHERICAL_LENS_TYPE)return false;
  const pairs=[[a,b],[b,a]];
  for(const [left,right] of pairs){
    const pL=left.lensParams,pR=right.lensParams,gL=left.lensGeom,gR=right.lensGeom;
    if(Math.abs(pL.y-pR.y)>tol)continue;
    if(Math.abs(gL.backApex-gR.frontApex)>tol)continue;
    const bothFlat=pL.backRadius===null&&pR.frontRadius===null;
    const matchedCurved=pL.backRadius!==null&&pR.frontRadius!==null&&
      Math.abs(pL.backRadius+pR.frontRadius)<=tol;
    if(bothFlat||matchedCurved)return true;
  }
  return false;
}

// Exact flush silvering of a plane mirror on a physical flat dielectric face
// (e.g. silvered slab, silvered prism, flat-silvered plano-convex/plano-concave lens, or mirror table).
export function planeMirrorCoincidentWithBody(mirrorSeg,body,tol=BENCH_CONTACT_TOL_MM,minOverlap=BENCH_MIN_CONTACT_OVERLAP_MM){
  if(!body.flatFaces?.length)return false;
  const [m1,m2]=mirrorSeg;
  for(const f of body.flatFaces){
    if(Math.abs(dot(delta(f.a,m1),f.normal))>tol||Math.abs(dot(delta(f.a,m2),f.normal))>tol)continue;
    if(body.vertices.some(v=>dot(delta(f.a,v),f.normal)>tol))continue;
    if(collinearOverlapMm(f.a,f.b,m1,m2)>=minOverlap)return true;
  }
  return false;
}

// Clean corner-touching contact between two non-collinear finite plane mirrors
// (e.g. kaleidoscope, corner reflector, equilateral mirror triangle, or 4-wall mirror box).
// Requires exactly one shared endpoint within tol (1e-11 mm), corner angle >= ~2.86 deg
// (|uA x uB| >= 0.05), and both opposite endpoints strictly >= 0.01 mm clear of the other mirror.
// Rejects X-crossings, T-junctions, collinear splices, grazing slivers, and near-corner gaps.
export function planeMirrorsShareCleanCorner(segA,segB,tol=BENCH_CONTACT_TOL_MM){
  const vA=delta(segA[0],segA[1]),vB=delta(segB[0],segB[1]);
  const lenA=Math.hypot(vA.x,vA.y),lenB=Math.hypot(vB.x,vB.y);
  if(!(lenA>0&&lenB>0&&Number.isFinite(lenA)&&Number.isFinite(lenB)))return false;
  const sinAngle=Math.abs(cross(vA,vB))/(lenA*lenB);
  if(!(sinAngle>=0.05))return false;
  const matches=[];
  for(let i=0;i<2;i++)for(let j=0;j<2;j++)
    if(Math.hypot(segA[i].x-segB[j].x,segA[i].y-segB[j].y)<=tol)matches.push([i,j]);
  if(matches.length!==1)return false;
  const [iShared,jShared]=matches[0];
  const aOther=segA[1-iShared],bOther=segB[1-jShared];
  return pointSegmentDistance(aOther,segB)>=BENCH_CLEARANCE_MM&&
         pointSegmentDistance(bOther,segA)>=BENCH_CLEARANCE_MM;
}

// Exact flush silvering of a circular-arc-mirror on a curved spherical-lens face, circular-dielectric, or circular-cap-dielectric boundary.
export function arcMirrorCoincidentWithBody(arcMirror,body,tol=BENCH_CONTACT_TOL_MM){
  if(arcMirror.type!=='circular-arc-mirror')return false;
  const p=arcMirror.parameters,{n}=curvedFrame(p);
  const mCenter={x:p.x+p.radius*n.x,y:p.y+p.radius*n.y},mR=Math.abs(p.radius);
  const pts=curvedPoints(arcMirror);
  if(body.type===CIRCULAR_TYPE){
    return Math.abs(mR-body.radius)<=tol&&
      Math.hypot(mCenter.x-body.center.x,mCenter.y-body.center.y)<=tol;
  }
  if(body.type===CAP_TYPE){
    if(Math.abs(mR-body.radius)>tol||Math.hypot(mCenter.x-body.center.x,mCenter.y-body.center.y)>tol)return false;
    const sgn=Math.sign(p.radius),uMirror={x:-sgn*n.x,y:-sgn*n.y};
    const mirrorHalfAngle=Math.asin(Math.min(1,p.apertureHeight/(2*mR)));
    const centerSep=Math.atan2(Math.abs(cross(body.u,uMirror)),dot(body.u,uMirror));
    return centerSep+mirrorHalfAngle<=body.capHalfAngle+tol/mR;
  }
  if(body.type===SPHERICAL_LENS_TYPE){
    const lp=body.lensParams,g=body.lensGeom;
    const faces=[];
    if(lp.frontRadius!==null)faces.push({center:g.frontCenter,radius:lp.frontRadius,isFront:true});
    if(lp.backRadius!==null)faces.push({center:g.backCenter,radius:lp.backRadius,isFront:false});
    for(const f of faces){
      if(Math.abs(mR-Math.abs(f.radius))>tol)continue;
      if(Math.hypot(mCenter.x-f.center.x,mCenter.y-f.center.y)>tol)continue;
      const sgn=Math.sign(f.radius);
      const onFace=pts.every(q=>{
        if(q.y<g.bottom-tol||q.y>g.top+tol)return false;
        return f.isFront
          ?(sgn>0?q.x<=f.center.x+tol:q.x>=f.center.x-tol)
          :(sgn>0?q.x>=f.center.x-tol:q.x<=f.center.x+tol);
      });
      if(onFace)return true;
    }
  }
  return false;
}

export function dielectricEncounter(component,nativePoint,incoming){
  if(component.type===CIRCULAR_TYPE)return circularEncounter(component,nativePoint,incoming);
  if(component.type===CAP_TYPE)return capEncounter(component,nativePoint,incoming,BENCH_CLEARANCE_MM);
  if(component.type===PRISM_TYPE)return prismEncounter(component,nativePoint,incoming);
  if(component.type===POLYGON_TYPE)return polygonEncounter(component,nativePoint,incoming);
  if(component.type===SPHERICAL_LENS_TYPE)return sphericalLensEncounter(component,nativePoint,incoming);
  return null;
}

// Resolve effective (incidentIndex, destinationIndex) for a v40 dielectric encounter
// when PhyDemo passes non-empty surfaceMergingObjs (touching/cemented glass bodies).
export function resolveMergedDielectricIndices(component,encounter,nativePoint,incoming,surfaceMergingObjs,nativeToComp){
  if(!encounter||encounter.invalid)return {incidentIndex:NaN,destinationIndex:NaN,mergedWithId:null,invalid:true};
  const merged=Array.isArray(surfaceMergingObjs)?surfaceMergingObjs:[];
  if(!merged.length)
    return {incidentIndex:encounter.incidentIndex,destinationIndex:encounter.destinationIndex,mergedWithId:null,invalid:false};
  if(merged.length!==1)return {incidentIndex:NaN,destinationIndex:NaN,mergedWithId:null,invalid:true};
  const other=nativeToComp.get(merged[0]);
  if(!other||!V40_DIELECTRIC_BODY_TYPES.includes(other.type))
    return {incidentIndex:NaN,destinationIndex:NaN,mergedWithId:null,invalid:true};
  const encOther=dielectricEncounter(other,nativePoint,incoming);
  if(!encOther||encOther.invalid||encounter.from===encOther.from)
    return {incidentIndex:NaN,destinationIndex:NaN,mergedWithId:null,invalid:true};
  return encounter.from==='inside'
    ?{incidentIndex:component.parameters.insideIndex,destinationIndex:other.parameters.insideIndex,mergedWithId:other.id,invalid:false}
    :{incidentIndex:other.parameters.insideIndex,destinationIndex:component.parameters.insideIndex,mergedWithId:other.id,invalid:false};
}

export function componentFiniteEndpoints(c,mirrorEndpoints){
  const p=c.parameters;
  if(c.type==='ideal-lens'){
    const cy=p.y??0,h=p.apertureHeight/2;
    return [{x:p.x,y:cy-h},{x:p.x,y:cy+h}];
  }
  if(c.type===FINITE_APERTURE_TYPE){
    const g=apertureGeometry(p,mirrorEndpoints);
    return [g.p1,g.p2,g.p3,g.p4];
  }
  if(['plane-mirror','beam-splitter','line-blocker','ray-detector'].includes(c.type))
    return mirrorEndpoints(p);
  if(isCurved(c.type)){
    const pts=curvedPoints(c);
    return [pts[0],pts[1]];
  }
  return [];
}

export function componentTangentCircles(c){
  const p=c.parameters;
  if(c.type===CIRCULAR_TYPE||c.type===CIRCLE_BLOCKER_TYPE)
    return [{center:{x:p.x,y:p.y},radius:p.radius}];
  if(c.type===CAP_TYPE){
    const g=capGeometry(p);
    return [{center:g.center,radius:g.radius,cap:{base:g.base,u:g.u}}];
  }
  if(c.type===SPHERICAL_LENS_TYPE){
    const g=thickLensGeometry(p),circles=[];
    if(p.frontRadius!==null)circles.push({center:g.frontCenter,radius:Math.abs(p.frontRadius)});
    if(p.backRadius!==null)circles.push({center:g.backCenter,radius:Math.abs(p.backRadius)});
    return circles;
  }
  if(c.type==='circular-arc-mirror'){
    const {n}=curvedFrame(p);
    return [{center:{x:p.x+p.radius*n.x,y:p.y+p.radius*n.y},radius:Math.abs(p.radius)}];
  }
  return [];
}

// Shared tangency proximity predicate for full circles/lenses/arcs and circular caps.
// For circular-cap-dielectric (tc.cap present), restricts tangency to the retained
// physical arc plus its clearance neighborhood (axial(pClosest) >= -clearance) so rays
// missing on the absent portion of the generating circle are never falsely flagged.
// Returns null on non-finite geometry, true on tangency proximity, false otherwise.
export function rayNearTangentCircle(origin,dir,tc,clearance,allowBehind=false){
  const offset=delta(origin,tc.center);
  const ahead=dot(offset,dir),perp=Math.abs(cross(offset,dir));
  if(!Number.isFinite(ahead)||!Number.isFinite(perp))return null;
  if(!((allowBehind||ahead>0)&&Math.abs(perp-tc.radius)<clearance))return false;
  if(!tc.cap)return true;
  const pClosest={x:origin.x+ahead*dir.x,y:origin.y+ahead*dir.y};
  return dot(delta(tc.cap.base,pClosest),tc.cap.u)>=-clearance;
}

export function componentDielectricCorners(c){
  const p=c.parameters;
  if(c.type===CAP_TYPE){const g=capGeometry(p);return [g.p1,g.p2];}
  if(c.type===PRISM_TYPE)return prismVertices(p);
  if(c.type===POLYGON_TYPE)return polygonVertices(p);
  if(c.type===SPHERICAL_LENS_TYPE)return thickLensGeometry(p).corners;
  return [];
}

export function validatePointSourceSeparation(points,clearance,path,fail){
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)
    if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<clearance)
      fail(path,'distinct point sources must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');
}

export function validateParallelBeamAdmission(beam,rayDensity,path,fail){
  const p=beam.parameters,g=parallelBeamGeometry(p);
  const beamSeg=[g.p1,g.p2];
  if(!(p.width>=10&&p.width<=100&&beamSeg.every(e=>allowedCoord(e.x,e.y))))
    fail(path,'The complete finite emitting segment must fit within +/-10000 mm; width 10–100 mm.','UNSUPPORTED_SCOPE');
  if(!Number.isFinite(rayDensity)||rayDensity<0.048||rayDensity>1)
    fail('$.simulation.rayDensity','Parallel-beam sampling must use the supported density range.','UNSUPPORTED_SCOPE');
  if(p.brightness>rayDensity)
    fail(path,'Beam brightness must not exceed ray density, avoiding silently saturated native per-ray brightness.','UNSUPPORTED_SCOPE');
  const witness=pinnedBeamAdmissionSamples(p,rayDensity);
  if(witness.nearHalfInteger||witness.samples.length<1||witness.samples.length>100)
    fail(path,'Native Beam requires 1–100 samples and a sample factor clear of a half-integer threshold.','UNSUPPORTED_SCOPE');
  return {beamSeg,beamDir:g.direction,samples:witness.samples};
}

export function validateCoaxialLensPlanes(lenses,points,beamSeg,clearance,path,fail){
  const lensPlanes=lenses.map(c=>c.parameters.x).sort((a,b)=>a-b);
  for(let i=0;i<lensPlanes.length;i++){
    const lx=lensPlanes[i];
    if(i>0&&lx-lensPlanes[i-1]<clearance)
      fail(path,'distinct lens planes must be separated by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(points.some(s=>Math.abs(lx-s.x)<clearance))
      fail(path,'each point source must be separated from every lens plane by at least 0.01 mm','UNSUPPORTED_SCOPE');
    if(beamSeg&&!(beamSeg.every(e=>e.x<=lx-BEAM_CLEARANCE_MM)||beamSeg.every(e=>e.x>=lx+BEAM_CLEARANCE_MM)))
      fail(path,'entire parallel emitter must lie at least 0.01 mm on one side of every lens plane','UNSUPPORTED_SCOPE');
  }
}

// Unified route-independent observed native endpoint, dielectric-corner, and
// circular/spherical/arc tangency audit for v37/v38/v39.
// Wraps instance-local methods once, delegates pinned PhyDemo first without
// altering ray routing, and fails closed on emitted, incoming, or outgoing
// near-misses (< clearance), same-body departure grazing, or audit faults.
export function installBenchEndpointAudit(doc,scene,idMap,mirrorEndpoints,{
  versionTag,
  key,
  clearance=BENCH_CLEARANCE_MM,
  stateLimit=BENCH_NATIVE_STATE_LIMIT,
  isRedirector,
  isCountedOptical=null,
  extraKey=null,
  endpointLabel='finite component endpoint',
  surfaceLabel='circular/spherical/arc'
}){
  let fault=null;
  let checkedStates=0;
  const opticalIncidentsById={};
  const endpointTargets=[];
  const endpointById=new Map();
  const circleTargets=[];
  const circleById=new Map();
  const cornerTargets=[];
  for(const c of doc.physics.components){
    if(isCountedOptical?.(c))opticalIncidentsById[c.id]=0;
    const eps=componentFiniteEndpoints(c,mirrorEndpoints);
    if(eps.length){
      const target={id:c.id,type:c.type,endpoints:eps};
      endpointTargets.push(target);
      endpointById.set(c.id,target);
    }
    const circles=componentTangentCircles(c);
    if(circles.length){
      const target={id:c.id,type:c.type,circles};
      circleTargets.push(target);
      circleById.set(c.id,target);
    }
    const corners=componentDielectricCorners(c);
    if(corners.length)cornerTargets.push({id:c.id,type:c.type,corners});
  }

  function auditRayState(ray,sourceCompId){
    if(++checkedStates>stateLimit){
      fault??=sourceCompId+': '+versionTag+' native ray-state audit exceeded bounded state limit; measurements withheld.';
      return;
    }
    const state=extractNativeRay(ray);
    if(!state){
      fault??=sourceCompId+': '+versionTag+' native ray state was non-finite or degenerate; measurements withheld.';
      return;
    }
    if(fault)return;
    for(const target of endpointTargets){
      for(const ep of target.endpoints){
        const offset=delta(state.origin,ep);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': '+versionTag+' native endpoint proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<clearance){
          fault=target.id+': observed native ray passes within 0.01 mm of a '+endpointLabel+'; measurements withheld.';
          return;
        }
      }
    }
    for(const target of cornerTargets){
      for(const corner of target.corners){
        const offset=delta(state.origin,corner);
        const ahead=dot(offset,state.dir),perp=Math.abs(cross(offset,state.dir));
        if(!Number.isFinite(ahead)||!Number.isFinite(perp)){
          fault=target.id+': '+versionTag+' native dielectric corner proximity check was non-finite; measurements withheld.';
          return;
        }
        if(ahead>0&&perp<clearance){
          fault=target.id+': observed native ray passes within 0.01 mm of a finite dielectric corner/vertex; measurements withheld.';
          return;
        }
      }
    }
    for(const target of circleTargets){
      const sameBody=target.id===sourceCompId;
      for(const tc of target.circles){
        const sameCurvedFace=sameBody&&(!tc.cap||dot(delta(tc.cap.base,state.origin),tc.cap.u)>1e-5);
        const near=rayNearTangentCircle(state.origin,state.dir,tc,clearance,sameCurvedFace);
        if(near===null){
          fault=target.id+': '+versionTag+' native '+surfaceLabel+' tangency check was non-finite; measurements withheld.';
          return;
        }
        if(near){
          fault=target.id+': observed native ray approaches within 0.01 mm of tangency to a '+surfaceLabel+' surface; measurements withheld.';
          return;
        }
      }
    }
  }

  for(const c of doc.physics.components){
    const nativeObj=scene.objs[idMap.get(c.id)];
    if(c.type==='point-source'||c.type===PARALLEL_BEAM_TYPE){
      if(!nativeObj||typeof nativeObj.onSimulationStart!=='function'){
        fault??=c.id+': native emitter method unavailable for '+versionTag+' audit.';
        continue;
      }
      const originalStart=nativeObj.onSimulationStart;
      nativeObj.onSimulationStart=function(...args){
        const result=originalStart.apply(this,args);
        try{
          if(!result||!Array.isArray(result.newRays)){
            fault??=c.id+': native emitter did not return an inspectable ray list; measurements withheld.';
          }else{
            for(const ray of result.newRays)auditRayState(ray,c.id);
          }
        }catch{
          fault??=c.id+': '+versionTag+' native emitter audit failed; measurements withheld.';
        }
        return result;
      };
      continue;
    }

    const counted=!!isCountedOptical?.(c);
    const epTarget=endpointById.get(c.id)||null;
    const cTarget=circleById.get(c.id)||null;
    const redirector=!!isRedirector(c);
    if(!counted&&!epTarget&&!cTarget&&!redirector)continue;
    if(!nativeObj||typeof nativeObj.onRayIncident!=='function'){
      fault??=c.id+': native incident method unavailable for '+versionTag+' audit.';
      continue;
    }
    const original=nativeObj.onRayIncident;
    nativeObj.onRayIncident=function(...args){
      // Snapshot incoming ray state BEFORE pinned PhyDemo mutates ray.p1/p2.
      const inRay=cTarget?extractNativeRay(args[0]):null;
      const incidentPoint=args[2];
      const result=original.apply(this,args);
      if(counted)opticalIncidentsById[c.id]++;
      try{
        if(!fault&&epTarget){
          if(!incidentPoint||!Number.isFinite(incidentPoint.x)||!Number.isFinite(incidentPoint.y)){
            fault=c.id+': native ray incident point was non-finite.';
          }else{
            const x=incidentPoint.x,y=-incidentPoint.y;
            if(epTarget.endpoints.some(ep=>Math.hypot(x-ep.x,y-ep.y)<clearance))
              fault=c.id+': native ray struck within 0.01 mm of a '+endpointLabel+'; measurements withheld.';
          }
        }
        if(!fault&&cTarget){
          if(!inRay){
            fault=c.id+': native incident ray state was non-finite or degenerate; measurements withheld.';
          }else{
            const hitYUp=incidentPoint&&Number.isFinite(incidentPoint.x)&&Number.isFinite(incidentPoint.y)
              ?{x:incidentPoint.x,y:-incidentPoint.y}:null;
            for(const tc of cTarget.circles){
              // Flat-chord encounters on a circular cap are not curved-arc tangency events.
              if(tc.cap&&hitYUp&&Math.abs(dot(delta(tc.cap.base,hitYUp),tc.cap.u))<=1e-5)continue;
              const near=rayNearTangentCircle(inRay.origin,inRay.dir,tc,clearance,true);
              if(near===null||near){
                fault=c.id+': native incident ray struck within 0.01 mm of tangency to a '+surfaceLabel+' surface; measurements withheld.';
                break;
              }
            }
          }
        }
        if(redirector){
          if(!result?.isAbsorbed)auditRayState(args[0],c.id);
          if(result?.newRays!==undefined){
            if(!Array.isArray(result.newRays)){
              fault??=c.id+': native incident returned non-array newRays; measurements withheld.';
            }else{
              for(const child of result.newRays)auditRayState(child,c.id);
            }
          }
        }
      }catch{
        fault??=c.id+': '+versionTag+' native incident audit failed; measurements withheld.';
      }
      return result;
    };
  }
  return {
    key,
    finish:()=>fault,
    ...(extraKey?{extra:()=>({[extraKey]:{...opticalIncidentsById}})}:{})
  };
}
