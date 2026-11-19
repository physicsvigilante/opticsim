# Native v14–v18 integration on reviewed v24 main — draft

**NOT MERGED; combined final CI and independent physics/integration review pending.** Built on exact production base `487314dcb7e74e7f16f5b711f950090e16400780`. Exact source blobs for the 41 additive paths from held PR #171 are preserved, with new shared-engine reconciling v19–v24 rather than adopting the obsolete development branch.

The five isolated versioned native systems are v14 two disjoint convex Glass regions; v15 one/two true biconvex SphericalLens bodies; v16 one thick lens + finite mirror; v17 two thick lenses + mirror (native depth 16); and v18 two thick lenses + mirror + opaque centred-gap Aperture (depth 16 with **mandatory post-refracted-ray aperture-endpoint uncertainty withholding**). All objects use pinned native PhyDemo; paths, Snell refractions and events are not synthesized.

A **native-completed** v18 run does not certify results when an actual outgoing native ray can pass within the documented clearance of any aperture endpoint. `src/native-v18-aperture-corner-guard.js` observes native output states, delegates each native callback exactly once and withholds all qualified evidence on a potentially ambiguous corner or audit fault. No historical v1–v13, v19–v24 schema can inherit this numerical budget or new physical objects without explicit admission.

Do not claim complete JEE textbook solutions, reconstructed physical images, irradiance, 3D optics, arbitrary mixed optical systems or independent model accuracy. Retain original source PNG hashes, original historical reviewed commit/blob IDs and the frozen v18 app SHA. The current browser app is a separately fingerprinted integration, not an old reviewed binary.

**Release gate:** all Node 24/native/real Chrome workflows on a synthetic merge tree identical to the final head; exact artifact and native-input provenance; one focused independent physics/integration review of shared reconciled modules, schema isolation and especially v18 near-endpoint guard, then an owner release decision. No direct merge of held #171.
