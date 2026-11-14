// Test-only reference for the intersection of TWO ALREADY RECORDED lines.
// Exact rational arithmetic on represented binary64 endpoints. No ray tracing,
// material laws, geometry repair, or use by the production simulation.
const abs=n=>n<0n?-n:n;
function fraction(n,d=1n){
  if(d===0n)throw Error('Zero denominator');
  if(d<0n){n=-n;d=-d;}
  let a=abs(n),b=d;
  while(b){const r=a%b;a=b;b=r;}
  return {n:n/a,d:d/a};
}
function binary64(x){
  if(!Number.isFinite(x))throw Error('Reference requires finite coordinates');
  const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,x);
  const bits=view.getBigUint64(0),exponent=Number((bits>>52n)&2047n);
  let mantissa=bits&((1n<<52n)-1n);
  if(exponent)mantissa+=1n<<52n;
  if(bits>>63n)mantissa=-mantissa;
  const power=exponent?exponent-1023-52:-1074;
  return power<0?fraction(mantissa,1n<<BigInt(-power)):fraction(mantissa<<BigInt(power));
}
const add=(a,b)=>fraction(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a,b)=>fraction(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a,b)=>fraction(a.n*b.n,a.d*b.d);
const div=(a,b)=>fraction(a.n*b.d,a.d*b.n);
const point=p=>({x:binary64(p.x),y:binary64(p.y)});
const minus=(a,b)=>({x:sub(a.x,b.x),y:sub(a.y,b.y)});
const cross=(a,b)=>sub(mul(a.x,b.y),mul(a.y,b.x));
const norm2=v=>add(mul(v.x,v.x),mul(v.y,v.y));
// Decimal projections are for inspection only; decisions below use BigInts.
const display=r=>({numerator:String(r.n),denominator:String(r.d),approx:Number(r.n)/Number(r.d)});
export function exactLineReference(ray,boundary,minDistanceSquared){
  if(!Number.isFinite(minDistanceSquared)||minDistanceSquared<0)throw Error('Invalid distance cutoff');
  const p=point(ray.p1),q=point(boundary.p1),r=minus(point(ray.p2),p),s=minus(point(boundary.p2),q);
  if(norm2(r).n===0n||norm2(s).n===0n)throw Error('Degenerate reference line');
  const denominator=cross(r,s),offset=minus(q,p);
  if(denominator.n===0n)return {method:'exact-binary64-rational',
    kind:cross(offset,r).n===0n?'coincident':'parallel',forward:false,beyondCutoff:false};
  const t=div(cross(offset,s),denominator),distanceSquared=mul(mul(t,t),norm2(r));
  const cutoff=binary64(minDistanceSquared);
  return {method:'exact-binary64-rational',kind:'unique',forward:t.n>=0n,
    beyondCutoff:t.n>=0n&&distanceSquared.n*cutoff.d>cutoff.n*distanceSquared.d,
    t:display(t),distanceSquared:display(distanceSquared),
    point:{x:display(add(p.x,mul(t,r.x))),y:display(add(p.y,mul(t,r.y)))}};
}
