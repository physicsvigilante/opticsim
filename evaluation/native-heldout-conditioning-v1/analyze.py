#!/usr/bin/env python3
"""Research-only exact represented geometry from frozen new native TAP records.

Independently expressed in Python fractions; not a real-ray or optics solver,
not a justified tolerance, and not an independent Chat B peer review.
"""
from __future__ import annotations
from collections import Counter,defaultdict
from fractions import Fraction
from pathlib import Path
from hashlib import sha256
import json,math,struct,sys

LOCKED_DESIGN_COMMIT="f5a2557f06f35896fc9003803a0a329d8d541db4"
LOCKED_BLOB="a3e48bd3efb02ebb263ae86066cb2e74290704a2"
BASE="50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518"
NATIVE="811f508d2b070898c241a568b0c167dcb8645251"
RESIDUAL_MM=1e-5
VERTEX_GUARD_MM=.01

def load(path):
    data=path.read_bytes()
    return json.loads(data),sha256(data).hexdigest()

def xy(point):
    return (float(point["x"]),float(point["y"]))

def exact(p):
    return (Fraction.from_float(p[0]),Fraction.from_float(p[1]))

def subtract(a,b):
    return (a[0]-b[0],a[1]-b[1])

def cross(a,b):
    return a[0]*b[1]-a[1]*b[0]

def ieee(x):
    return struct.pack(">d",float(x)).hex()

def closest_point_distance(p,a,b):
    ex=b[0]-a[0]
    ey=b[1]-a[1]
    denominator=ex*ex+ey*ey
    if not denominator>0:return math.inf
    u=max(0.0,min(1.0,((p[0]-a[0])*ex+(p[1]-a[1])*ey)/denominator))
    return math.hypot(p[0]-a[0]-u*ex,p[1]-a[1]-u*ey)

def floating_intersection(p1,p2,a,b):
    """The global determinant expression order of pinned upstream JS, on float64."""
    A=p2[0]*p1[1]-p1[0]*p2[1]
    B=b[0]*a[1]-a[0]*b[1]
    xa=p2[0]-p1[0];xb=b[0]-a[0]
    ya=p2[1]-p1[1];yb=b[1]-a[1]
    den=xa*yb-xb*ya
    return ((A*xb-B*xa)/den,(A*yb-B*ya)/den)

def pinned_filters(h,p1,p2,a,b,cutoff):
    dx=p2[0]-p1[0];dy=p2[1]-p1[1]
    ex=b[0]-a[0];ey=b[1]-a[1]
    forward=(h[0]-p1[0])*dx+(h[1]-p1[1])*dy>=0
    start=(h[0]-a[0])*ex+(h[1]-a[1])*ey>=0
    finish=(h[0]-b[0])*(-ex)+(h[1]-b[1])*(-ey)>=0
    d2=(h[0]-p1[0])**2+(h[1]-p1[1])**2
    return {"nativeForward":forward,"nativeFace":start and finish,
            "nativeMinStep":d2>cutoff,"stepMm":math.sqrt(d2)}

def rational(q):
    return {"num":str(q.numerator),"den":str(q.denominator)}

def process_hit(row,index,sample):
    rec={"ordinal":row["ordinal"],"caseId":row["caseId"],
         "mode":"single-owner-tap","hitIndex":index,
         "nativeTerminalStatus":row["native"]["status"],
         "classification":"unknown","nativeFormulaNumericMatch":None,
         "representedForwardStatus":"unknown"}
    try:
        p1,p2,h=(xy(sample["p1"]),xy(sample["p2"]),xy(sample["incident"]))
        candidates=[]
        for face in row["nativeFaceVertices"]:
            # Archived face vertices are authored y-UP; actual native ray/hit y-DOWN.
            # Coerce source numbers to float64 BEFORE calculating sign-sensitive zero.
            a=(float(face["a"]["x"]),-float(face["a"]["y"]))
            b=(float(face["b"]["x"]),-float(face["b"]["y"]))
            distance=closest_point_distance(h,a,b)
            if distance<=RESIDUAL_MM:candidates.append((face["id"],a,b,distance))
        if len(candidates)!=1:
            rec["classification"]="unknown-face-ambiguity"
            rec["groundingCount"]=len(candidates)
            return rec
        face_id,a,b,residual=candidates[0]
        rec["faceId"]=face_id
        rec["faceProximityMm"]=residual
        rec["selectedFaceProvenance"]="inferred-from-reported-point-proximity-not-native-face-loop-index"
        calc=floating_intersection(p1,p2,a,b)
        rec["nativeFormulaNumericMatch"]=calc==h
        rec["signedZeroBitDifferenceVsSerialized"]=bool(calc==h and any(
            ieee(calc[i])!=ieee(h[i]) for i in range(2)))
        rec["roundedPointNativeGates"]=pinned_filters(calc,p1,p2,a,b,
                                                     row["nativeSegmentCutoffSquared"])
        r=subtract(exact(p2),exact(p1))
        edge=subtract(exact(b),exact(a))
        den=cross(r,edge)
        if den==0:
            rec["classification"]="unknown-exact-parallel"
            return rec
        offset=subtract(exact(a),exact(p1))
        t=cross(offset,edge)/den
        u=cross(offset,r)/den
        rec["representedT"]=rational(t)
        rec["representedU"]=rational(u)
        rec["representedForwardStatus"]="nonforward" if t<=0 else "forward"
        star=(exact(p1)[0]+t*r[0],exact(p1)[1]+t*r[1])
        discrepancy=math.hypot(float(star[0]-exact(h)[0]),
                               float(star[1]-exact(h)[1]))
        rec["reportedToExactRepresentedIntersectionMm"]=discrepancy
        rec["maxInputUlpMm"]=max(math.ulp(v) for v in p1+p2+a+b)
        rec["conditioningInputScaleRatio"]=discrepancy/rec["maxInputUlpMm"]
        rx,ry=p2[0]-p1[0],p2[1]-p1[1]
        ex,ey=b[0]-a[0],b[1]-a[1]
        magnitude=math.hypot(rx,ry)*math.hypot(ex,ey)
        rec["crossingSineApprox"]=abs(rx*ey-ry*ex)/magnitude if magnitude>0 else None
        vertex_clearance=min(math.hypot(h[0]-a[0],h[1]-a[1]),
                             math.hypot(h[0]-b[0],h[1]-b[1]))
        rec["reportedVertexClearanceMm"]=vertex_clearance
        if not rec["nativeFormulaNumericMatch"]:
            rec["classification"]="unknown-source-formula-point-disagreement"
        elif vertex_clearance<=VERTEX_GUARD_MM:
            rec["classification"]="unknown-near-vertex"
        elif rec["crossingSineApprox"] is None or rec["crossingSineApprox"]<=math.sqrt(sys.float_info.epsilon):
            rec["classification"]="unknown-near-parallel"
        elif u<0 or u>1:
            rec["classification"]="represented-outside-finite-edge"
        elif t<=0:
            rec["classification"]="represented-nonforward"
        elif star==exact(h):
            rec["classification"]="exact-represented-point-match"
        else:
            rec["classification"]="unknown-nonzero-point-discrepancy"
        return rec
    except Exception as error:
        rec["classification"]="unknown-arithmetic-exception"
        rec["analysisException"]=type(error).__name__+": "+str(error)
        return rec

def main():
    if len(sys.argv)!=3:raise SystemExit("Usage: analyze.py INPUT_DIR NEW_OUTPUT_DIR")
    directory=Path(sys.argv[1])
    output=Path(sys.argv[2])
    inputs,input_hash=load(directory/"inputs.json")
    report,report_hash=load(directory/"report.json")
    assert report["status"]=="executed-all-frozen-trials"
    assert inputs["designOnlyCommit"]==report["provenance"]["designOnlyCommit"]==LOCKED_DESIGN_COMMIT
    assert inputs["lockedDesignGitBlob"]==report["provenance"]["lockedDesignGitBlob"]==LOCKED_BLOB
    assert inputs["sourceBase"]==report["provenance"]["sourceBase"]==BASE
    assert inputs["nativePin"]==report["provenance"]["pinnedNative"]==NATIVE
    assert input_hash==report["provenance"]["inputsSha256"]
    cases=inputs["cases"]
    assert len(cases)==20 and len({c["id"] for c in cases})==20
    assert len(report["records"])==len(report["schedule"])==120
    assert report["plannedTrials"]==report["actualRecordedTrials"]==120
    assert report["errors"]==[]
    table={c["id"]:c for c in cases}
    seen=Counter()
    tapped=[]
    summaries=defaultdict(Counter)
    for i,row in enumerate(report["records"]):
        assert row["ordinal"]==i+1
        assert row["processKind"]=="fresh Node 24 OS process"
        assert row["schedule"]==report["schedule"][i]
        assert row["caseId"] in table
        assert row["sceneSha256"]==table[row["caseId"]]["sceneSha256"]
        assert row["mode"]==row["schedule"]["mode"]
        assert row["mode"] in inputs["profileDefinitions"]
        seen[(row["caseId"],row["mode"])]+=1
        assert row["native"]["status"] in ("completed","completed-with-warnings","failed","stopped")
        expected_completed=row["native"]["status"] in ("completed","completed-with-warnings")
        assert row["native"]["completed"]==expected_completed
        if row["mode"]!="single-owner-tap":
            assert row["extraCaptureInstalled"] is False
            assert row["extraNativeCallingWrapperInstalled"] is False
            if row["mode"]=="ordinary-off": assert row["advisory"] is None
        else:
            assert row["extraCaptureInstalled"] is True
            assert row["extraNativeCallingWrapperInstalled"] is False
            assert row["captureFaults"]==[]
            assert row["capturedCallbackCount"]==row["native"]["glass"]["interactions"]
            assert row["rawCapturedCount"]==len(row["actualNativeHitCoordinates"])
            for j,s in enumerate(row["actualNativeHitCoordinates"]):
                rec=process_hit(row,j,s)
                rec["shape"]=table[row["caseId"]]["shape"]
                rec["regime"]=table[row["caseId"]]["regime"]
                rec["transform"]=table[row["caseId"]]["transform"]
                tapped.append(rec)
                summaries[(rec["shape"],rec["regime"])][rec["classification"]]+=1
    assert all(seen[(case["id"],mode)]==2 for case in cases for mode in inputs["profileDefinitions"])
    assert len(tapped)==report["rawTapHitCount"]
    statuses={mode:dict(Counter(r["native"]["status"] for r in report["records"]
                                 if r["mode"]==mode)) for mode in inputs["profileDefinitions"]}
    assert all(sum(counts.values())==40 for counts in statuses.values())
    classifications=Counter(x["classification"] for x in tapped)
    numerics=Counter(str(x["nativeFormulaNumericMatch"]) for x in tapped)
    forward=Counter(x["representedForwardStatus"] for x in tapped)
    patterns=Counter()
    for row in report["records"]:
        if row["mode"]!="single-owner-tap":continue
        for s in row["actualNativeHitCoordinates"]:
            patterns[tuple(ieee(float(s[key][c])) for key in ("p1","p2","incident")
                           for c in ("x","y"))]+=1
    summary={
      "format":"opticsim-native-heldout-independent-language-summary-v1",
      "evidenceType":"test-only-not-independent-review",
      "originalDesignGitBlob":LOCKED_BLOB,
      "originalDesignCommit":LOCKED_DESIGN_COMMIT,
      "sourceBase":BASE,"nativePin":NATIVE,
      "unchangedInputSha256":input_hash,"originalNativeReportSha256":report_hash,
      "actualTrialCount":len(report["records"]),
      "trueNativeStatusByProfile":statuses,
      "nativeProfileCountsAreDistinct":True,
      "tapCallbackCount":len(tapped),
      "uniqueSixScalarRawHitPatterns":len(patterns),
      "classificationCounts":dict(classifications),
      "nativeFormulaNumericalMatches":dict(numerics),
      "representedForwardCounts":dict(forward),
      "byShapeAndRegime":[{"shape":k[0],"regime":k[1],"counts":dict(v)}
                           for k,v in sorted(summaries.items())],
      "actualFarControlDisagreements":report["scalarControlDiscrepancies"],
      "claims":{"nativeUninstrumentedHitCoordinatesCertified":False,
                "tapNeutralityProven":False,"safeErrorBoundKnown":False,
                "upstreamCausalRootProven":False,
                "idealCriticalBranchCertified":False,
                "stage2WithholdingAuthorized":False}
    }
    output.mkdir(parents=True,exist_ok=False)
    (output/"analysis.json").write_text(json.dumps(tapped,indent=2)+"\n")
    (output/"summary.json").write_text(json.dumps(summary,indent=2)+"\n")
    print("HELDOUT_EXACT_DYADIC "+json.dumps({
      "trials":len(report["records"]),"tapHits":len(tapped),
      "statusProfiles":statuses,"classifications":dict(classifications),
      "representedForward":dict(forward),
      "nativeFormulaNumericMatches":dict(numerics),
      "uniqueRawPatterns":len(patterns),
      "farControlDisagreements":len(report["scalarControlDiscrepancies"])
    }))
if __name__=="__main__":
    main()
