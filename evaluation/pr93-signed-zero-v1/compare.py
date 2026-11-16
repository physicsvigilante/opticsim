#!/usr/bin/env python3
"""TEST-ONLY cross-language signed-zero report correction, not native optical inference."""
import hashlib,json,pathlib,struct,sys
src,out=map(pathlib.Path,sys.argv[1:3])
hashes={
 'inputs.json':'79be6692d8e107ed5fa2198abbcfe56a0fb97633aac55db573eec021ea37fc45',
 'report.json':'bc0fee95fe8e0d61176aed8adf96081324cfa0ea1846caf1997e9fbc51570960',
 'exact-reference.json':'9e3d386abceaa907063f0c01b3b40fc399e8a6e764da231a1959e6d24c1145ee'
}
for file,digest in hashes.items():
 assert hashlib.sha256((src/file).read_bytes()).hexdigest()==digest,file
report=json.loads((src/'report.json').read_bytes())
js=json.loads(out.read_bytes())
def bits(v):return struct.pack('>d',v).hex()
def native(p1,p2,a,b):
 A=p2[0]*p1[1]-p1[0]*p2[1]
 B=b[0]*a[1]-a[0]*b[1]
 xa=p2[0]-p1[0];xb=b[0]-a[0];ya=p2[1]-p1[1];yb=b[1]-a[1]
 d=xa*yb-xb*ya
 return ((A*xb-B*xa)/d,(A*yb-B*ya)/d)
def distance(p,a,b):
 import math
 dx=b[0]-a[0];dy=b[1]-a[1]
 u=max(0.,min(1.,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
 return math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy)
events=[]
for row in report['records']:
 if row['mode']!='single-owner-tap':continue
 for index,s in enumerate(row['actualNativeHitCoordinates']):
  # Preserve original Python JSON int/float coercion for historical 18-count comparison.
  p1=(s['p1']['x'],s['p1']['y']);p2=(s['p2']['x'],s['p2']['y'])
  incident=(s['incident']['x'],s['incident']['y'])
  faces=[(f['id'],(f['a']['x'],-f['a']['y']),(f['b']['x'],-f['b']['y'])) for f in row['nativeFaceVertices']]
  candidates=[face for face in faces if distance(incident,face[1],face[2])<=1e-5]
  assert len(candidates)==1
  face,a,b=candidates[0]
  legacy=native(p1,p2,a,b)
  # Explicit float64 coercion BEFORE negation and arithmetic, as native JS Number.
  p1f=tuple(map(float,p1));p2f=tuple(map(float,p2))
  native_f=next(f for f in row['nativeFaceVertices'] if f['id']==face)
  af=(float(native_f['a']['x']),-float(native_f['a']['y']))
  bf=(float(native_f['b']['x']),-float(native_f['b']['y']))
  normalized=native(p1f,p2f,af,bf)
  assert legacy==normalized==incident
  j=js['events'][len(events)]
  assert (j['ordinal'],j['hitIndex'],j['faceId'])==(row['ordinal'],index,face)
  assert [bits(x) for x in normalized]==j['pointBits'],(row['ordinal'],index)
  assert [bits(x) for x in incident]==j['recordedBits']
  legacy_diff=any(bits(x)!=bits(y) for x,y in zip(legacy,incident))
  normalized_diff=any(bits(x)!=bits(y) for x,y in zip(normalized,incident))
  events.append((row['ordinal'],index,legacy_diff,normalized_diff))
assert len(events)==js['count']==87
legacy_count=sum(x[2] for x in events)
normalized_count=sum(x[3] for x in events)
extra=[(x[0],x[1]) for x in events if x[2] and not x[3]]
assert legacy_count==18,(legacy_count,extra)
assert normalized_count==js['signedZeroDifferencesVsSerializedJSON']==12
assert extra==[(2,0),(3,0),(6,0),(8,0),(9,0),(11,0)],extra
print('SIGNED_ZERO_CROSS_LANGUAGE_PASS '+json.dumps({
 'originalHits':87,
 'nativeJsNumericMatches':87,
 'legacyPythonVsSerializedSignDifferences':legacy_count,
 'precoercedPythonAndJsVsSerializedSignDifferences':normalized_count,
 'pythonOnlyExtraOriginalHits':extra,
 'nativeInMemorySignBitsKnown':False,
 'physicalOrNativePolicyChanged':False
}))
