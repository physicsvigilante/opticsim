#!/usr/bin/env python3
"""R2 RESEARCH ONLY: replay the pinned native floating-point determinant against
ORIGINAL PR #92 finite Glass callback values. No ray propagation or repairs.

The source operation order is transcribed from pinned ray-optics
src/core/geometry.js linesIntersection (lines 99–106). Test original
incident points and native finite/ray gates against exact dyadic reference.
This is SAME-ASSISTANT research, not independent Chat B verification or a
proved numerical error envelope / valid critical-angle optical branch.
"""
from __future__ import annotations
import hashlib
import json
import math
import pathlib
import struct
import sys
from collections import Counter
from fractions import Fraction

SOURCE_PR92_HEAD = "d8367c2d1bd23f3ee7c574feb45e7cc7e7793ee2"
PINNED_PHYDEMO = "811f508d2b070898c241a568b0c167dcb8645251"
PINNED_GEOMETRY_GIT_BLOB = "d5c3c5b5a4ae97a24bcfe330fb7d752a780cc893"
ORIGINAL_HASHES = {
    "inputs.json": "79be6692d8e107ed5fa2198abbcfe56a0fb97633aac55db573eec021ea37fc45",
    "report.json": "bc0fee95fe8e0d61176aed8adf96081324cfa0ea1846caf1997e9fbc51570960",
    "exact-reference.json": "9e3d386abceaa907063f0c01b3b40fc399e8a6e764da231a1959e6d24c1145ee"
}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def bitpattern(f):
    return struct.pack(">d", f).hex()

def exact(p):
    return (Fraction.from_float(p[0]), Fraction.from_float(p[1]))

def sub(a,b):
    return (a[0]-b[0], a[1]-b[1])

def cross(a,b):
    return a[0]*b[1]-a[1]*b[0]

def distance_to_segment(p,a,b):
    ex,ey=b[0]-a[0],b[1]-a[1]
    denominator=ex*ex+ey*ey
    if denominator<=0:return math.inf
    u=max(0.,min(1.,((p[0]-a[0])*ex+(p[1]-a[1])*ey)/denominator))
    return math.hypot(p[0]-a[0]-u*ex,p[1]-a[1]-u*ey)

def native_intersection(p1,p2,a,b):
    """Exactly the pinned geometry.linesIntersection arithmetic expression order."""
    A=p2[0]*p1[1]-p1[0]*p2[1]
    B=b[0]*a[1]-a[0]*b[1]
    xa=p2[0]-p1[0]
    xb=b[0]-a[0]
    ya=p2[1]-p1[1]
    yb=b[1]-a[1]
    denominator=xa*yb-xb*ya
    return ((A*xb-B*xa)/denominator,(A*yb-B*ya)/denominator)

def gates(h,p1,p2,a,b,cutoff2):
    """Native intersectionIsOnRay, intersectionIsOnSegment and squared cutoff."""
    ray=(p2[0]-p1[0],p2[1]-p1[1])
    edge=(b[0]-a[0],b[1]-a[1])
    raydot=(h[0]-p1[0])*ray[0]+(h[1]-p1[1])*ray[1]
    first=((h[0]-a[0])*edge[0]+(h[1]-a[1])*edge[1])>=0
    last=((h[0]-b[0])*(-edge[0])+(h[1]-b[1])*(-edge[1]))>=0
    d2=(h[0]-p1[0])**2+(h[1]-p1[1])**2
    return {
        "roundedPointPassesNativeRayTest":raydot>=0,
        "roundedPointPassesNativeFiniteSegmentTest":first and last,
        "roundedPointPassesNativeCutoff":d2>cutoff2,
        "roundedRayDot":raydot,
        "roundedReportedStepMm":math.sqrt(d2)
    }

def rational(q):
    return {"num":str(q.numerator),"den":str(q.denominator),"approx":float(q)}

def extent(values):
    values=sorted(values)
    return {"min":values[0],"median":values[len(values)//2],"max":values[-1]} if values else None

def main():
    if len(sys.argv)!=3:
        sys.exit("Usage: analyze.py <original PR92 extracted ZIP directory> <fresh output directory>")
    original_dir=pathlib.Path(sys.argv[1])
    output_dir=pathlib.Path(sys.argv[2])
    original={k:(original_dir/k).read_bytes() for k in ORIGINAL_HASHES}
    for k,data in original.items():
        if sha(data)!=ORIGINAL_HASHES[k]:
            raise ValueError("ORIGINAL_PR92_SOURCE_EVIDENCE_SHA_MISMATCH: "+k)
    research=json.loads(original["report.json"])
    reference=json.loads(original["exact-reference.json"])
    input_data=json.loads(original["inputs.json"])
    assert research["status"]=="research-complete"
    assert len(research["records"])==60
    assert research["rawHitEvidenceCount"]==87
    assert len(reference["allCases"])==87
    assert len(input_data["cases"])==5
    by_case={x["id"]:x for x in input_data["cases"]}
    by_hit={(x["ordinal"],x["hitIndex"]):x for x in reference["allCases"]}
    events=[]
    concerns=[]
    signatures=Counter()
    for record in research["records"]:
        if record["mode"]!="single-owner-tap":
            continue
        assert record["sceneSha256"]==by_case[record["caseId"]]["sceneSha256"]
        assert record["extraNativeCallingWrapperInstalled"] is False
        samples=record["actualNativeHitCoordinates"]
        assert len(samples)==record["rawCapturedCount"]
        for i,s in enumerate(samples):
            prev=by_hit[(record["ordinal"],i)]
            assert prev["caseId"]==record["caseId"]
            p1=(s["p1"]["x"],s["p1"]["y"])
            p2=(s["p2"]["x"],s["p2"]["y"])
            incident=(s["incident"]["x"],s["incident"]["y"])
            candidates=[]
            for f in record["nativeFaceVertices"]:
                # ORIGINAL MISNAMED archive key contains AUTHORED Y-UP polygon faces.
                # Convert faces only; original ray/incident are already NATIVE Y-DOWN.
                a=(f["a"]["x"],-f["a"]["y"])
                b=(f["b"]["x"],-f["b"]["y"])
                if distance_to_segment(incident,a,b)<=1e-5:
                    candidates.append((f["id"],a,b))
            if len(candidates)!=1:
                concerns.append({"ordinal":record["ordinal"],"hitIndex":i,
                                 "problem":"NOT_UNIQUELY_GROUNDED_ON_AUTHORED_FINITE_FACE"})
                continue
            face,a,b=candidates[0]
            try:
                rounded=native_intersection(p1,p2,a,b)
                floats_equal=rounded==incident
                signed_zero_only=floats_equal and any(
                    bitpattern(rounded[j])!=bitpattern(incident[j]) for j in (0,1))
                native_gate=gates(rounded,p1,p2,a,b,record["nativeSegmentCutoffSquared"])
                P=exact(p1)
                E=exact(a)
                ray=sub(exact(p2),P)
                edge=sub(exact(b),E)
                determinant=cross(ray,edge)
                if determinant==0:raise ArithmeticError("EXACT_PARALLEL")
                offset=sub(E,P)
                t=cross(offset,edge)/determinant
                u=cross(offset,ray)/determinant
                star=(P[0]+t*ray[0],P[1]+t*ray[1])
                supplied=exact(incident)
                dx=supplied[0]-star[0]
                dy=supplied[1]-star[1]
                discrepancy=math.hypot(float(dx),float(dy))
                r=(p2[0]-p1[0],p2[1]-p1[1])
                e=(b[0]-a[0],b[1]-a[1])
                crossing_sine=abs(r[0]*e[1]-r[1]*e[0])/(math.hypot(*r)*math.hypot(*e))
                input_max_ulp=max(math.ulp(x) for x in (p1+p2+a+b))
                all_native_filters=all(native_gate[x] for x in [
                    "roundedPointPassesNativeRayTest",
                    "roundedPointPassesNativeFiniteSegmentTest",
                    "roundedPointPassesNativeCutoff"])
                old=prev["independentlyCalculated"]
                if old["faceId"]!=face or (old.get("t") is not None and
                    (str(t.numerator)!=old["t"]["num"] or str(t.denominator)!=old["t"]["den"])):
                    concerns.append({"ordinal":record["ordinal"],"hitIndex":i,
                                     "problem":"SOURCE_EXACT_DYADIC_OR_FACE_DISAGREEMENT"})
                point_signature=tuple(bitpattern(x) for x in p1+p2+incident+a+b)
                signatures[point_signature]+=1
                event={
                    "caseId":record["caseId"],
                    "recordOrdinal":record["ordinal"],
                    "hitIndex":i,"nativeTerminalStatus":record["native"]["status"],
                    "originalReason":old["reasonCode"],
                    "faceId":face,"authoredFacesAreYUp":True,"nativeRayPointsAreYDown":True,
                    "nativeComputedPoint":rounded,
                    "reportedNativePoint":incident,
                    "nativeComputedPointEqualsReportedNumerically":floats_equal,
                    "signedZeroBitDifferenceOnly":signed_zero_only,
                    "nativeReportedPointFilters":native_gate,
                    "allNativeRoundedPointFiltersPass":all_native_filters,
                    "exactRepresentedT":rational(t),
                    "exactRepresentedU":rational(u),
                    "exactTNonforward":t<=0,
                    "exactPStarEqualsReportedPoint":star==supplied,
                    "reportedToExactPStarDistanceMm":discrepancy,
                    "inputMaxUlpMm":input_max_ulp,
                    "pointDiscrepancyOverMaxInputUlp":discrepancy/input_max_ulp,
                    "rayFaceCrossingSineApprox":crossing_sine
                }
                events.append(event)
                if not floats_equal or not all_native_filters or (
                    old["reasonCode"]=="EXACT_INTERSECTION_NOT_FORWARD" and t>0):
                    concerns.append({"ordinal":record["ordinal"],"hitIndex":i,
                                     "problem":"NATIVE_FLOATING_FORMULA_OR_GATE_NOT_REPRODUCED"})
            except Exception as error:
                concerns.append({"ordinal":record["ordinal"],"hitIndex":i,
                                 "problem":"REPLAY_EXCEPTION","message":str(error)})
    nonforward=[e for e in events if e["exactTNonforward"]]
    by_reason=Counter(e["originalReason"] for e in events)
    report={
        "format":"opticsim-pinned-geometry-determinant-roundoff-replay-v1",
        "type":"TEST_ONLY_RESEARCH_NO_PHYSICS_POLICY",
        "source":{"originalPr92Sha":SOURCE_PR92_HEAD,"phyDemoPin":PINNED_PHYDEMO,
                  "geometryGitBlob":PINNED_GEOMETRY_GIT_BLOB,
                  "originalMemberSha256":ORIGINAL_HASHES},
        "claims":{"nativeFormulaTranscribedFromPinnedGeometry":True,
                  "uniquePhysicalCriticalBranchCertified":False,
                  "nativeUpstreamRootCauseProven":False,
                  "validatedIncidentPointToleranceSupplied":False,
                  "nativeRayPropagationChanged":False,
                  "Stage2WithholdingAuthorized":False,
                  "extraSynchronousTapWasInOriginalCapture":True},
        "totalCapturedEventsReplayed":len(events),
        "uniqueExactBinary64HitSignatures":len(signatures),
        "repeatedHitSamples":sum(n-1 for n in signatures.values() if n>1),
        "numericNativeFormulaMatchesRecorded":sum(e["nativeComputedPointEqualsReportedNumerically"] for e in events),
        "signedZeroOnlyDifferences":sum(e["signedZeroBitDifferenceOnly"] for e in events),
        "allNativeRoundedPointGatesPass":sum(e["allNativeRoundedPointFiltersPass"] for e in events),
        "exactRepresentedNonforward":len(nonforward),
        "nonforwardWithAllRoundedNativeGatesPassing":sum(e["allNativeRoundedPointFiltersPass"] for e in nonforward),
        "nonforwardExactlyAtRayStart":sum(e["exactRepresentedT"]["num"]=="0" for e in nonforward),
        "nonforwardBehindRayStart":sum(e["exactRepresentedT"]["num"]!="0" for e in nonforward),
        "reasonCounts":dict(by_reason),
        "displacementMmByOriginalReason":{key:extent([
            e["reportedToExactPStarDistanceMm"] for e in events if e["originalReason"]==key])
            for key in sorted(by_reason)},
        "nonforwardRoundedReportedStepMm":extent([
            e["nativeReportedPointFilters"]["roundedReportedStepMm"] for e in nonforward]),
        "concerns":concerns,"individualOriginalNativeHitReplays":events
    }
    output_dir.mkdir(parents=True,exist_ok=False)
    (output_dir/"analysis.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    (output_dir/"summary.json").write_text(json.dumps(
        {k:v for k,v in report.items() if k not in ("individualOriginalNativeHitReplays","concerns")},
        indent=2)+"\n",encoding="utf-8")
    print("PINNED_NATIVE_DETERMINANT_REPLAY "+json.dumps({
        "status":"pass" if not concerns else "mismatch",
        "originalSamples":len(events),
        "uniqueBinary64HitPatterns":len(signatures),
        "recordedPointEqualsNativeFormula":report["numericNativeFormulaMatchesRecorded"],
        "nativeRaySegmentCutoffGatePasses":report["allNativeRoundedPointGatesPass"],
        "exactNonforward":len(nonforward),
        "nonforwardPassingNativeRoundedGates":report["nonforwardWithAllRoundedNativeGatesPassing"],
        "exactTEqualsZero":report["nonforwardExactlyAtRayStart"],
        "exactTNegative":report["nonforwardBehindRayStart"],
        "concerns":len(concerns)
    }))
    if len(events)!=87 or concerns:raise SystemExit(1)

if __name__=="__main__":main()
