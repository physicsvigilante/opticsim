// Advisory finite-Glass geometry check, NOT a ray tracer or native-intersection
// replacement. Every arithmetic decision is exact on the already recorded
// binary64 inputs. No tolerance means UNKNOWN, never a false "checked" result.
import {distanceToFiniteSegment} from './finite-glass-geometry.js';
import {fromBinary64 as bits,add,subtract as sub,multiply as mul,divide as div,compare as cmp} from './binary64-rational.js';
export const FINITE_HIT_CAP=128;
export const FINITE_HIT_FACE_RESIDUAL_MM=1e-5;
export const FINITE_HIT_VERTEX_CLEARANCE_MM=.01;
// This is a CONSERVATIVE classification-only angular conditioning budget,
// not a PhyDemo intersection tolerance, change to any physical ray, or a
// derived error bound for comparing two incident points. sqrt(binary64 eps)
// flags nearly singular ray/face crossings where small coordinate rounding
// can magnify computed hit-position uncertainty. UNKNOWN, never "checked".
export const FINITE_HIT_MIN_CROSSING_SINE=Math.sqrt(Number.EPSILON);

const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const point=p=>({x:bits(p.x),y:bits(p.y)});
const subtract=(a,b)=>({x:sub(a.x,b.x),y:sub(a.y,b.y)});
const cross=(a,b)=>sub(mul(a.x,b.y),mul(a.y,b.x));
const squared=v=>add(mul(v.x,v.x),mul(v.y,v.y));
const zero={n:0n,d:1n},one={n:1n,d:1n};
const approx=x=>Number(x.n)/Number(x.d);
const advisory=(status,reasonCode)=>({status,reasonCode});
const unknown=reason=>advisory('unknown',reason);
const inconsistent=reason=>advisory('inconsistent',reason);

// All points in *actual native* x-right / y-down coordinates. "face" is an
// authored native finite segment with native x/y, not an infinite glass plane.
export function auditRecordedFiniteHit(sample,faces,cutoffSquared){
  if(!sample||!finitePoint(sample.p1)||!finitePoint(sample.p2)||
    !finitePoint(sample.incident)||!Array.isArray(faces)||faces.length!==4||
    !Number.isFinite(cutoffSquared)||cutoffSquared<0)
    return unknown('INVALID_OR_MISSING_NATIVE_HIT');
  const toUp=p=>({x:p.x,y:-p.y}),reportedUp=toUp(sample.incident);
  const candidates=faces.filter(f=>distanceToFiniteSegment(reportedUp,f.a,f.b)<=FINITE_HIT_FACE_RESIDUAL_MM);
  if(candidates.length!==1)return unknown('NONUNIQUE_OR_UNGROUNDED_FINITE_FACE');
  const face=candidates[0],a={x:face.a.x,y:-face.a.y},b={x:face.b.x,y:-face.b.y};
  const reported=sample.incident;
  if(Math.min(Math.hypot(reported.x-a.x,reported.y-a.y),
    Math.hypot(reported.x-b.x,reported.y-b.y))<=FINITE_HIT_VERTEX_CLEARANCE_MM)
    return unknown('REPORTED_HIT_AT_OR_NEAR_VERTEX');
  try{
    const p=point(sample.p1),q=point(a),r=subtract(point(sample.p2),p),
      edge=subtract(point(b),q);
    if(squared(r).n===0n||squared(edge).n===0n)return unknown('DEGENERATE_REPRESENTED_GEOMETRY');
    const denom=cross(r,edge);
    if(denom.n===0n)return unknown('PARALLEL_OR_COINCIDENT_REPRESENTED_LINES');
    // An EXACT nonzero determinant does not establish NUMERICAL STABILITY.
    // A nearly parallel intersection is ill-conditioned under even tiny
    // native binary64 endpoint rounding. Use a scale-independent angular
    // classifier: sine(theta)=|cross(unit(ray), unit(face))|. This may
    // conservatively withhold genuinely valid near-parallel hits; it does not
    // change PhyDemo's actual geometry, cutoff or propagation at all.
    const rx=sample.p2.x-sample.p1.x,ry=sample.p2.y-sample.p1.y;
    const ex=b.x-a.x,ey=b.y-a.y;
    const rayLength=Math.hypot(rx,ry),edgeLengthNative=Math.hypot(ex,ey);
    if(!(rayLength>0&&Number.isFinite(rayLength)&&edgeLengthNative>0&&Number.isFinite(edgeLengthNative)))
      return unknown('UNBOUNDED_FINITE_HIT_CONDITIONING');
    const crossingSine=Math.abs((rx/rayLength)*(ey/edgeLengthNative)-
      (ry/rayLength)*(ex/edgeLengthNative));
    if(!Number.isFinite(crossingSine)||crossingSine<=FINITE_HIT_MIN_CROSSING_SINE)
      return unknown('NEAR_PARALLEL_FINITE_HIT_ILL_CONDITIONED');
    const offset=subtract(q,p),t=div(cross(offset,edge),denom),
      u=div(cross(offset,r),denom);
    // Any exact finite crossing at or outside a vertex is conservatively
    // unknown within the retained 0.01 mm corner exclusion.
    const edgeLength=Math.hypot(b.x-a.x,b.y-a.y);
    const uc=approx(u);
    if(!Number.isFinite(uc)||!(edgeLength>0))return unknown('UNBOUNDED_FINITE_EDGE_PARAMETER');
    if(Math.min(Math.abs(uc),Math.abs(1-uc))*edgeLength<=FINITE_HIT_VERTEX_CLEARANCE_MM)
      return unknown('COMPUTED_HIT_AT_OR_NEAR_VERTEX');
    if(cmp(u,zero)<0||cmp(u,one)>0)return inconsistent('EXACT_INTERSECTION_OUTSIDE_FINITE_EDGE');
    if(cmp(t,zero)<=0)return inconsistent('EXACT_INTERSECTION_NOT_FORWARD');
    const travel=mul(mul(t,t),squared(r));
    if(cmp(travel,bits(cutoffSquared))<=0)return inconsistent('EXACT_FORWARD_STEP_NOT_BEYOND_NATIVE_CUTOFF');
    // Compare the *independently computed* intersection P* to the actual
    // engine-supplied incident point. A nonzero binary64 discrepancy requires
    // an independently justified, scale/conditioning-aware uncertainty
    // envelope. Stage 1 has no validated envelope, so NEVER guess a tolerance.
    const star={x:add(p.x,mul(t,r.x)),y:add(p.y,mul(t,r.y))};
    const supplied=point(reported);
    if(cmp(star.x,supplied.x)!==0||cmp(star.y,supplied.y)!==0)
      return unknown('NATIVE_INCIDENT_POINT_AGREEMENT_UNBOUNDED');
    return advisory('checked','EXACT_BINARY64_FINITE_FORWARD_AND_POINT_MATCH');
  }catch{
    return unknown('EXACT_ARITHMETIC_OR_CONDITIONING_UNAVAILABLE');
  }
}
