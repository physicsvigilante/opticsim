#!/usr/bin/env python3
"""Research-only exact represented-dyadic audit of PRE-REGISTERED HELD-OUT TAP JSON.

This is independently expressed Python Fraction arithmetic over preserved
binary64 coordinates, not the JS auditRecordedFiniteHit function and NOT
a ray propagation solver. The TAP uses the existing sole native Glass-calling owner, with extra
synchronous diagnostic method capture; native outcomes must NOT be equated
to separate ordinary OFF / ON executions or used as causal proof.

Usage: python3 evaluation/heldout-native-profiles-v1/exact-check.py
            [test-artifacts/llm-authoring/heldout-native-profiles-v1]
Retains every input/case and every mismatch or undecidable hit.
"""
from __future__ import annotations
import json
import hashlib
import math
import pathlib
import sys
from fractions import Fraction

REASON = {
    "invalid": "INVALID_OR_MISSING_NATIVE_HIT",
    "face": "NONUNIQUE_OR_UNGROUNDED_FINITE_FACE",
    "vertex": "REPORTED_HIT_AT_OR_NEAR_VERTEX",
    "degenerate": "DEGENERATE_REPRESENTED_GEOMETRY",
    "parallel": "PARALLEL_OR_COINCIDENT_REPRESENTED_LINES",
    "conditioning": "NEAR_PARALLEL_FINITE_HIT_ILL_CONDITIONED",
    "edgeparam": "UNBOUNDED_FINITE_EDGE_PARAMETER",
    "computedvertex": "COMPUTED_HIT_AT_OR_NEAR_VERTEX",
    "outside": "EXACT_INTERSECTION_OUTSIDE_FINITE_EDGE",
    "backwards": "EXACT_INTERSECTION_NOT_FORWARD",
    "subcutoff": "EXACT_FORWARD_STEP_NOT_BEYOND_NATIVE_CUTOFF",
    "point": "NATIVE_INCIDENT_POINT_AGREEMENT_UNBOUNDED",
    "checked": "EXACT_BINARY64_FINITE_FORWARD_AND_POINT_MATCH",
    "exactfail": "EXACT_ARITHMETIC_OR_CONDITIONING_UNAVAILABLE",
}

def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def ispoint(p):
    return isinstance(p, dict) and all(type(p.get(k)) in (int, float)
        and math.isfinite(p[k]) for k in ("x", "y"))

def distance_segment(p, a, b):
    vx, vy = b["x"]-a["x"], b["y"]-a["y"]
    dx, dy = p["x"]-a["x"], p["y"]-a["y"]
    length2 = vx*vx + vy*vy
    if length2 <= 0:
        return math.inf
    t = max(0., min(1., (dx*vx+dy*vy)/length2))
    return math.hypot(dx-t*vx, dy-t*vy)

def fx(p):
    return (Fraction.from_float(float(p["x"])), Fraction.from_float(float(p["y"])))

def subtract(a,b):
    return a[0]-b[0], a[1]-b[1]

def cross(a,b):
    return a[0]*b[1]-a[1]*b[0]

def square(v):
    return v[0]*v[0]+v[1]*v[1]

def payload(status, reason, **meta):
    return {"status":status, "reasonCode":reason, **meta}

def audit(hit, faces, cutoff):
    if (not isinstance(hit, dict) or any(not ispoint(hit.get(k))
         for k in ("p1","p2","incident")) or len(faces)!=4 or
         not isinstance(cutoff,(int,float)) or not math.isfinite(cutoff) or cutoff<0):
        return payload("unknown",REASON["invalid"])
    reported=hit["incident"]
    y_up={"x":reported["x"],"y":-reported["y"]}
    candidates=[f for f in faces if distance_segment(y_up,f["a"],f["b"])<=1e-5]
    if len(candidates)!=1:
        return payload("unknown",REASON["face"])
    face=candidates[0]
    a={"x":face["a"]["x"],"y":-face["a"]["y"]}
    b={"x":face["b"]["x"],"y":-face["b"]["y"]}
    if min(math.dist((reported["x"],reported["y"]),(a["x"],a["y"])),
           math.dist((reported["x"],reported["y"]),(b["x"],b["y"])))<=.01:
        return payload("unknown",REASON["vertex"],faceId=face["id"])
    try:
        P=fx(hit["p1"]); Q=fx(a)
        r=subtract(fx(hit["p2"]),P)
        e=subtract(fx(b),Q)
        if square(r)==0 or square(e)==0:
            return payload("unknown",REASON["degenerate"],faceId=face["id"])
        det=cross(r,e)
        if det==0:
            return payload("unknown",REASON["parallel"],faceId=face["id"])
        dx=hit["p2"]["x"]-hit["p1"]["x"]
        dy=hit["p2"]["y"]-hit["p1"]["y"]
        ex=b["x"]-a["x"];ey=b["y"]-a["y"]
        nr=math.hypot(dx,dy);ne=math.hypot(ex,ey)
        if not (nr>0 and math.isfinite(nr) and ne>0 and math.isfinite(ne)):
            return payload("unknown","UNBOUNDED_FINITE_HIT_CONDITIONING",faceId=face["id"])
        sine=abs((dx/nr)*(ey/ne)-(dy/nr)*(ex/ne))
        if not math.isfinite(sine) or sine<=math.sqrt(sys.float_info.epsilon):
            return payload("unknown",REASON["conditioning"],faceId=face["id"])
        offset=subtract(Q,P)
        t=cross(offset,e)/det
        u=cross(offset,r)/det
        uf=float(u)
        if not math.isfinite(uf):
            return payload("unknown",REASON["edgeparam"],faceId=face["id"])
        if min(abs(uf),abs(1-uf))*ne<=.01:
            return payload("unknown",REASON["computedvertex"],faceId=face["id"])
        extra={"faceId":face["id"],
               "t":{"approx":float(t),"num":str(t.numerator),"den":str(t.denominator)},
               "u":{"approx":uf,"num":str(u.numerator),"den":str(u.denominator)}}
        if u<0 or u>1:
            return payload("inconsistent",REASON["outside"],**extra)
        if t<=0:
            return payload("inconsistent",REASON["backwards"],**extra)
        if t*t*square(r)<=Fraction.from_float(float(cutoff)):
            return payload("inconsistent",REASON["subcutoff"],**extra)
        intersection=(P[0]+t*r[0],P[1]+t*r[1])
        supplied=fx(reported)
        if intersection!=supplied:
            return payload("unknown",REASON["point"],**extra)
        return payload("checked",REASON["checked"],**extra)
    except (ArithmeticError, OverflowError, TypeError, ValueError):
        return payload("unknown",REASON["exactfail"],faceId=face["id"])

def main():
    root=pathlib.Path(sys.argv[1] if len(sys.argv)>1
        else "test-artifacts/llm-authoring/heldout-native-profiles-v1")
    original=(root/"report.json").read_bytes()
    data=json.loads(original)
    assert data["status"]=="research-complete"
    assert data["provenance"]["protocolCommit"]=="3bd989e17ed47932f218a4b339158d59647c9fb2"
    assert data["plannedTrials"]==data["actualTrials"]==36
    assert data["labelledCounts"]["byMode"]=={
      "ordinary-off":12,"ordinary-on":12,"single-owner-tap":12}
    raw=[r for r in data["records"] if r["mode"]=="single-owner-tap"]
    assert len(raw)==12
    comparisons=[]; mismatches=[]; all_hit_count=0
    for row in raw:
        geometry=row["actualNativeHitCoordinates"]
        already=row["existingExactFunctionClassifications"]
        assert len(geometry)==len(already)==row["rawCapturedCount"]
        assert row["capturedCallbackCount"]>=len(geometry)
        for i,(sample,old) in enumerate(zip(geometry,already)):
            verdict=audit(sample,row["nativeFaceVertices"],row["nativeSegmentCutoffSquared"])
            all_hit_count+=1
            item={"caseId":row["caseId"],"ordinal":row["ordinal"],"hitIndex":i,
                "nativeStatus":row["native"]["status"],
                "jsRecorded":{"status":old["status"],"reasonCode":old["reasonCode"]},
                "independentlyCalculated":verdict}
            comparisons.append(item)
            if old["status"]!=verdict["status"] or old["reasonCode"]!=verdict["reasonCode"]:
                mismatches.append(item)
    assert all_hit_count==data["rawHitEvidenceCount"]
    statuses={}
    for x in comparisons:
        k=x["independentlyCalculated"]["reasonCode"];statuses[k]=statuses.get(k,0)+1
    result={"format":"opticsim-heldout-native-profile-dyadic-reference-v1",
       "method":"Python Fraction.from_float exact represented binary64 dyadic line/finite-face reference; distinct from Opticsim JS",
       "isNativeRaySolver":False,"isSeparateChatReview":False,
       "singleNativeCallingGlassOwner":True,
       "addedSynchronousDiagnosticMethodTap":True,"nativeCausalityCertified":False,
       "sourceReportSha256":sha(original),"samples":len(raw),
       "nativeCapturedEvents":all_hit_count,"verdictReasons":statuses,
       "mismatches":mismatches,"allCases":comparisons}
    output=root/"exact-reference.json"
    with output.open("x",encoding="utf-8") as f:
        json.dump(result,f,indent=2);f.write("\n")
    print("SINGLE_OWNER_EXACT_REFERENCE "+json.dumps({
        "status":"pass" if not mismatches else "mismatch","samples":len(raw),
        "actualPerHitChecks":all_hit_count,"mismatchCount":len(mismatches),
        "reasonCounts":statuses,"output":str(output)}))
    if mismatches:raise SystemExit(1)

if __name__=="__main__":main()
