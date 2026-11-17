# v18 + directional detector footprint — **research-only integration**

This temporary branch composes two *independently held and not yet released* candidates:
- v18 physical engine PR #120, exact parent `1c566103842cc6c4841aa97360cc893b0ed710c4`
- main-based footprint readout PR #118, exact original `7d44e52d2c4c5db30d91e4e87970b706c18a90f6`

It does **not** merge either PR into production or alter either reviewed source head. Only the common browser/observables interface and historical provenance assertions were reconciled in this disposable branch, with a new separate app Git-blob pin. Original frozen and reviewed-source pins are preserved, not reclassified as blind evaluations.

The combined system must produce native positional evidence from a real two-thick-lens/mirror return, keep opposite detector-normal crossings separate, produce null—not zero-width—sampled footprint statistics for a true aperture-blocked miss, capture the footprint when requested alone, and withhold all measurements if depth limits make native propagation incomplete.

The footprint is an **unweighted 2D sampled detector statistic**, not an optical image, PSF, brightness-weighted power, source-identified path or continuous irradiance. Passing code/Chrome CI only verifies this candidate combination in tested arrangements; it is not independent native re-execution, an expert optics certification or owner release authorization. The separate v14–v18 physics and footprint release holds remain unchanged.
