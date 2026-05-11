# MTS Galaxy Lab

Zero-install browser prototype for exploring the Motion-Timespace galaxy law as an interactive transport-response simulator.

## Open

Open this file in a browser:

```text
C:\Users\ollet\OneDrive\Documents\mts-galaxy-lab\index.html
```

The app is static HTML/CSS/JavaScript. It does not need Node, Python, npm, or a local server.

## Modes

- Synthetic: builds a toy disk from slider-controlled disk, gas, bulge, and memory-load parameters.
- LTG: loads all 175 bundled SPARC samples generated from `Rotmod_LTG (4).zip`, or accepts a pasted/imported ROTMOD `.dat` file.
- ETG: loads all 16 bundled ATLAS3D ETGs from `Rotmod_ETG.zip`, including high-resolution disk and bulge components.

## Locked Constants

```text
Gamma0 = 809.956
Rmax = 1.758948
ML_disk = 0.5
ML_bulge = 0.7
q = 0.77 for ROTMOD mode
```

## Formulae Implemented

```text
V_bar^2 = V_gas^2 + 0.5 V_disk^2 + 0.7 V_bulge^2

S_mem = (0.9 / pi) * (r_out / h)
memory_load = (1 - f_gas_out) * (r_out / h)
L_eff = 1.8 h * (1 + S_mem * (1 - exp(-memory_load / S_mem)))

V_model^2(r) = V_bar^2(r) + Gamma0 * L_eff * (1 - exp(-(r / L_eff)^q))

u(r) = (V_obs^2 - 0.5 V_disk^2 - 0.7 V_bulge^2) / (Gamma0 * r * Rmax)
```

For synthetic mode, `V_obs` is the generated MTS model. For ROTMOD mode, `V_obs` is the observed SPARC value.

## v17 / Paper v15 Diagnostics

LTG single-crossing diagnostics:

```text
L_gap = L_sat - L_exact
g = memory_load * x_cross
Priority L MAE ~= -10.4 + 8.6*g + 10.5*L_gap
late-load final flag = u_out > 0.64 AND h/r_out > 0.095
LTG curvature A ~= 2.210 - 2.028*u_0.75
```

v18 updates now implemented in the lab:

```text
Priority L MAE ~= -10.315 + 8.645*g + 10.508*L_gap
Priority L3 diagnostic ~= -28.012 + 6.609*g + 11.214*L_gap + 28.625*u_0.75
Priority L3 is diagnostic only, not canonical
LTG curvature A ~= -2.671 + 2.735/sqrt(u_0.75)
supercritical late-load flag = u_0.75 > 1
```

The active curve also reports the inner S-law completion diagnostic:

```text
Q12 = Vbar^2(0.5h) / Vbar^2(h)
Q14 = Vbar^2(0.25h) / Vbar^2(h)
S = Q14 / (1-Q12)
LTG Umax ~= 0.2391 - 0.0697*ln(S)
ETG Umax ~= 0.2325 - 0.0578*ln(S)
```

ETG diagnostics:

```text
Stage-4 R80 row: logy ~= 4.313 + 0.808*log(Sigma80-100) + 1.732*log(r_out/R80)
Stage-4 R90 row: logy ~= 4.7556 + 0.8348*log(Sigma80-100) + 1.7153*log(r_out/R90)
Stage-4 R85 geometry: v18 empirical clean-HL preference, strongest row HL11 minus NGC3998 with LOO = 0.156
c1 slope law = -(1-u_out)/(1-x_cross)
ETG curvature A ~= -0.015 + 1.029*(1-x_cross)
```

The app uses locked v18 table values for ETG `h`, `R80`, `R85`, `R90`, `Sigma80-100`, and `logy` where available. `R85` is exposed as the primary Stage-4 geometry signal, while the R80/R90 rows remain available for continuity.

## Regenerate Bundled Samples

If the LTG archive moves, pass a new path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-samples.ps1 -ZipPath "C:\path\to\Rotmod_LTG (4).zip"
```

The SPARC Browser indexes all 175 LTGs and supports:

```text
search by galaxy name
filter by route class
sort by RMSE, u_out, Priority L MAE, x_cross, or name
quick hunts: Late-load, CDC, Single, Infeasible, Worst, Best
route summary chips: low, upward, single, infeasible, CDC-low, late flag
```

## Evidence Pack

The left rail now includes export tools:

```text
Current CSV: active curve point table with r, velocities, err_v, u(r), and residual
Normalized CSV: custom imported curve after unit/distance/inclination preprocessing
LTG Index CSV: current filtered/sorted SPARC browser diagnostics
Summary JSON: active galaxy constants, curve state, route state, and browser filters
Plot SVG: standalone rotation-curve SVG with embedded plot styling
Export Capsule: portable JSON experiment state with a reproducible hash in the filename
Diagnostic Sheet: standalone HTML sheet with metrics, rotation curve, u(r), and residual view
Trust Report: standalone HTML report with capsule hash, plots, active scores, benchmark/tournament summaries, and embedded capsule JSON
Figure Pack: print-friendly HTML figure sheet for paper notes and sharing
Capsule Library: local snapshot browser for saving, diffing, loading, publishing, and exporting experiment branches
```

The reproducibility controls add two audit-facing exports:

```text
Run Claims: validates locked LTG/ETG counts, Priority L memberships, supercritical u_0.75 memberships, and R85 locks
Export Claims: standalone HTML paper-claim validator report
Export Case File: standalone HTML active-galaxy case file with diagnostics, plots, flags, and diagnostic JSON
Export Robustness: active-galaxy uncertainty trial table as CSV
Run Scientific QA: validates provenance, physical schema, stress coverage, and feature audit rows
Export QA Report: standalone HTML scientific provenance and validation report
Export QA CSV: machine-readable provenance/schema/audit/stress rows
Export Population: population correlation rows with bootstrap and jackknife summary columns
```

The right rail also includes a residual plot:

```text
Synthetic mode: MTS support share
LTG mode: V_model - V_observed in km/s
ETG mode: Stage-4 log residual markers
```

## Custom Data Import

Observed mode includes a custom normalizer for user-supplied galaxy tables. It accepts:

```text
headered CSV
JSON arrays
JSON objects with rows/data/points
whitespace text tables
ROTMOD-like numeric rows
```

Recognized column names include:

```text
r, radius, rad
Vobs, Vrot, velocity
errV, err, sigma
Vgas, Vdisk, Vbul, Vbulge
SBdisk, SBbul
```

The normalizer can convert radii from `kpc`, `pc`, or `arcsec`, apply a distance scale, convert arcseconds using distance in Mpc, and deproject observed or all velocities using the supplied inclination. The normalized curve then enters the same pipeline as bundled LTGs: baryonic `V_bar^2`, MTS support, `u(r)`, route class, Scientific QA, case file, capsule hash, and CSV exports.

## Claim Validator

The Claim Validator panel recomputes locked paper-facing checks from the live bundled data. It currently validates:

```text
175 LTG sample count
route counts: low incl CDC, CDC-low, upward, single, outer-infeasible
Priority L strict N=19 membership
Priority L clean N=18 membership
Priority L top-five membership
supercritical u_0.75 membership
late-load final count
15 locked ETG R85 rows
NGC3626 and NGC3998 R85 values
live inner S-law coverage
```

Passing rows show `pass`; rows needing attention show `review` with expected and actual values available in the row tooltip. `Export Claims` writes a portable HTML report with the full table plus active plots and the route-space map.

## Galaxy Case Files

The Galaxy Case File panel follows the active curve and records the local evidence for that specific galaxy:

```text
identity, mode, route, point count
capsule hash
u0, u_out, u_max, x_cross
paper membership flags
LTG Priority L, L3, u_0.75, curvature, S-law diagnostics
ETG R80/R85/R90, r_out/R85, logy, curvature, S-law diagnostics
active formula A/B scores when present
forge and evolution metadata for synthetic cases
```

`Export Case File` writes a standalone HTML file with the case table, active plots, a human-readable case note, and embedded diagnostic JSON.

## Framework Test Rig

The app can test alternate frameworks without overwriting the locked MTS baseline. Enter a support-law expression for `v2` in `(km/s)^2`, run it on the active galaxy, then batch-score it against all 175 LTGs.

Bundled presets:

```text
MTS baseline
Baryon only
Soft radial support
Outer gate support
Observed residual check
```

Allowed formula variables:

```text
r, x, h, rOut, fGas, fGasOut, leff, memory, q
gamma0, rMax, mlDisk, mlBulge
vGas, vDisk, vBulge, vBar, vObs, uObs
u0, uOut, uMax, u075, xCross, hOverRout, leffOverH
lockedU0, lockedUOut, lockedUMax, lockedU075, lockedXCross
routeLow, routeCdc, routeUpward, routeSingle, routeOuterInfeasible
routeHard, routeNonLow, outerViable
lockedRouteLow, lockedRouteCdc, lockedRouteUpward, lockedRouteSingle
lockedRouteOuterInfeasible, lockedRouteHard, lockedRouteNonLow
outerHeadroom, routeMargin, routeBreakRisk
pi, e
```

Allowed math functions:

```text
abs, sqrt, pow, exp, log, log10, min, max
sin, cos, tan, tanh, atan, atan2, floor, ceil, round
```

The formula editor accepts restricted math expressions, not general JavaScript. The current custom curve is drawn as a white dashed overlay, the residual plot switches to custom residuals, and `Export Framework Scores` writes the latest 175-LTG batch table as CSV.

## Comparative Mode

Comparative mode adds a second active support law, called comparator B, beside the Framework Test Rig formula A. It uses the same restricted expression parser and the same scoring code as the main test rig.

The right rail reports:

```text
A RMSE
B RMSE
winner
A minus B outer RMSE
baseline / A / B route states
```

The rotation curve plot draws B as a gold dashed line and the residual plot can draw A and B together. Current CSV exports include comparator velocity, comparator residual, and `custom_minus_compare_kms`.

## Formula Registry

The Formula Registry lets users save, reload, import, and export support laws. Built-in presets are always present, and saved formulas are kept in browser storage for the local static app.

```text
Save A: stores the active Framework Test Rig expression
Load to A: sends a selected formula into the test rig
Load to B: sends a selected formula into comparator B
Export Registry: writes saved formulas as JSON
Import registry: loads shared formula JSON packs
```

This makes support laws shareable without turning the app into a server-backed system.

## High-RMSE Research Harness

The Python harness in `scripts/mts-failure-lab.py` runs a locked-baseline research cycle for the difficult SPARC LTGs. It keeps canonical MTS unchanged, searches only invariant-gated state candidates, and writes review artifacts under `research-output/high-rmse`.

```powershell
python .\scripts\mts-failure-lab.py --mode baseline
python .\scripts\mts-failure-lab.py --mode discover
python .\scripts\mts-failure-lab.py --mode validate
python .\scripts\mts-failure-lab.py --mode report
python .\scripts\mts-failure-lab.py --mode diagnose
```

The split is route-stratified with seed `20260511`. Candidate formulas may use MTS state gates such as memory, `u_0.75`, `u_out`, route class, locked-baseline route variables, and route-safety headroom, but not galaxy names, raw RMSE, residual signs, or lookup rules.

Discovery writes two ranked tracks:

```text
mts-high-rmse-discovery-strict.csv
mts-high-rmse-discovery-frontier.csv
mts-high-rmse-discovery.csv
```

Strict candidates must preserve locked-MTS route states at `>= 95%` before they can rank in the strict track. Frontier candidates stay useful for failure anatomy, but remain rejected until holdout guardrails pass.

Report mode writes:

```text
mts-high-rmse-scores.csv
mts-high-rmse-report.md
mts-high-rmse-report.html
mts-high-rmse-candidate.json
```

Candidate capsules include `selectionTier`, `routeBreaks`, `guardrailFailures`, `nearestPassingCandidate`, and the best frontier candidate. The browser app can import `mts-high-rmse-candidate.json` in the Research Candidate panel. Imported candidates can be loaded into formula A or queued into the tournament, but their status remains `frontier`, `rejected`, or `promoted for review`; they never replace locked MTS silently.

Diagnose mode writes a support-deficit anatomy pack:

```text
mts-support-deficit.csv
mts-support-deficit-proxy-scores.csv
mts-support-deficit-report.md
mts-support-deficit-model.json
```

This mode is not a candidate search. It keeps the MTS radial shape fixed, solves the scalar support multiplier each galaxy would need, computes the route-safe amplitude interval that preserves the locked MTS model route, separates likely route-closure bottlenecks from radial-shape residuals and scalar support deficits, runs a diagnostic `q`-shape probe for residual kernel failures, and tests whether stubborn post-`q` cases need a second radial support scale.

## Benchmark Suite

The Benchmark Suite runs formula A against comparator B on reproducible SPARC packs:

```text
All 175 LTGs
Late-load hunt
CDC-low systems
Single-crossing systems
Outer-infeasible systems
Worst baseline RMSE
Best baseline RMSE
```

The suite reports A/B wins, mean RMSE, route preservation rate, and the strongest case-by-case deltas. `Export Suite` writes the latest benchmark table as CSV.

## Residual Field Overlay

The galaxy canvas can now render a residual field as radial haze:

```text
red: selected model overpredicts
cyan: selected model underpredicts
stronger haze: larger residual magnitude
```

Available field modes:

```text
Off
MTS residual
Test rig residual
Comparator residual
Test minus comparator
```

The field is visual evidence only; the numeric source of truth remains the plotted residuals, CSV exports, and score panels.

## Fit Correlation and Residual Bands

Observed and ETG modes include a Fit Correlation panel that plots `V_obs` against `V_model`, draws the one-to-one line, and adds plus/minus RMSE bands. It reports point count, fit correlation `r_fit`, RMSE, and mean bias.

The Residual Bands panel splits the active observed fit into inner, middle, and outer radius thirds. For each band it reports RMSE, mean bias, point count, and the strongest residual location. The same table also lists the worst individual residual points, so the user can see whether a score is being driven by a central mismatch, an outer collapse, or one pathological measurement.

## Galaxy View

The canvas view can be adjusted independently of the physics state:

```text
camera tilt
depth lift
particle colour by component, velocity, or residual
toggle stars, gas, bulge, guide rings, core marker, and residual field
```

The depth lift uses the existing particle cloud thickness, so forged disks, compact spheroids, and irregular systems read as spatial structures instead of flat painted disks.

Particle generation now labels render components as stars, gas, or bulge material. The layer toggles affect only the visual scene, not the rotation-curve diagnostics, capsule state, or exported metrics.

## Uncertainty Lab

The Uncertainty Lab runs active-galaxy perturbation trials:

```text
velocity noise
M/L jitter
32, 64, or 128 trials
```

Each trial perturbs `Vobs` and disk/bulge mass-to-light scaling, recomputes the active route diagnostics, and reports:

```text
route stability
dominant perturbed route
median RMSE
u_out range
trial-by-trial route, RMSE, u_out, and flip/same status
```

The results are included in capsules, case files, diagnostic sheets, trust reports, and `Export Robustness` CSV files when the active curve and uncertainty settings match the run.

## Scientific QA

The Scientific QA panel adds the astronomy-trust layer:

```text
repo/source, file path, commit-hash status, retrieval date
parser version
raw file checksum
processed feature checksum
catalogue/release and calibration status
```

The schema validator checks whether the active record is scientifically usable, not just parseable:

```text
radius unit = kpc
velocity unit = km/s
finite monotone radii
r_out lock against the final parsed point
finite positive h and compact geometry
gas fraction in a physical range
errV preservation
missing covariance, redshift frame, and reduction pipeline warnings
```

The same report includes:

```text
feature audit: route driver, missing features, domain-prior warning, label ambiguity, residual anatomy
uncertainty link: uses the active robustness run when present
out-of-domain stress ledger: ROTMOD tables, FITS-like metadata, simulation snapshots, irregular observational tables, and non-astronomy config data
```

Bundled local data is intentionally flagged with a `workspace-no-git` commit warning until the project is published with an actual repository commit. Missing covariance, calibration, reduction, and redshift/frame metadata are also visible warnings rather than silent assumptions.

## Galaxy Forge

Synthetic mode includes a deterministic morphology generator for stress testing frameworks on controlled systems. A forged galaxy records its morphology, seed, intended stress target, actual route class, and recipe note in the right rail and export capsules.

Forge presets:

```text
LSB disk
Dwarf irregular
Gas-rich spiral
Bulge-dominated LTG
Compact ETG-like
CDC-low analogue
Outer-infeasible stress
Late-load pathological
```

The forge controls set the same physical sliders used by manual synthetic mode, then rebuild the particle cloud with morphology-specific rendering:

```text
spiral arm count and twist
gas particle fraction
disk thickness
outer rings
central concentration
irregular/lopsided scatter
```

`Next Seed` advances the deterministic seed by one and rebuilds the same morphology family. Current CSV exports include `forge_preset`, `forge_seed`, and `forge_stress` columns when a forged galaxy is active.

## Time Evolution Mode

Synthetic mode includes controlled evolution tracks:

```text
Late-load build
Gas depletion
Bulge compaction
Gas rebuild
```

The epoch slider and playback button update the synthetic galaxy controls live, recompute the transport curve, refresh route diagnostics, and periodically refresh the particle cloud. The right rail includes an `Evolution Track` timeline with route-coloured bands, `u_max`, `u_out`, current epoch, gas fraction, q, and route flip count.

## Framework Tournament

The tournament queue compares many support laws against the same 175 LTGs. Put one framework per line:

```text
Name = support_law_v2
```

The leaderboard ranks by mean RMSE and reports:

```text
mean RMSE
median delta versus MTS
wins versus MTS
route preservation rate
mean outer RMSE
invalid point count
```

`Export Board` writes the latest tournament leaderboard as CSV.

## Parameter Landscape

The parameter landscape scans the MTS-family support law over `Gamma0` scale and `q`:

```text
Gamma min / max
q min / max
9 x 7, 13 x 9, or 17 x 11 grid
```

Each cell is scored over all 175 bundled LTGs. The heatmap reports the best cell, mean RMSE, mean outer RMSE, wins versus the locked baseline, and the number of robust cells within 3 percent of the best mean RMSE. Clicking a heatmap cell sends that parameterized support law into the Framework Test Rig. `Export Sweep` writes the landscape as CSV.

## Route-Space Map

The route-space map projects the LTG dataset into diagnostic coordinates. The map currently supports:

```text
x_cross
u_out
memory
h/r_out
RMSE
Priority L
Priority L3
L_eff/h
u_0.75
LTG curvature A
S-law S
S-law dU
```

Points are color-coded by route class and sized by RMSE. Clicking a point loads that galaxy.

## Population Explorer

Observed mode includes population statistics for the LTG sample or current browser subset. It can correlate:

```text
memory
RMSE
u_0.75
LTG curvature A
S-law S
u_max
x_cross
L_eff/h
```

The panel reports sample size, Pearson correlation, bootstrap interval, dominant route, strongest pairwise correlations, and jackknife stability. `Export Population` writes the active population rows plus summary correlation, bootstrap, and jackknife columns as CSV. Population results are included in capsules, summary JSON, trust reports, and figure packs when run.

## v18 Structure Panel

The right rail includes a compact v18 diagnostic panel. For LTGs and synthetic curves it shows:

```text
canonical Priority L
diagnostic Priority L3
LTG inverse-sqrt curvature A
S-law Umax residual
```

For ETGs it switches to:

```text
R85
r_out/R85
ETG crossing-window curvature A
S-law Umax residual
```

Named v18 outlier notes are shown for NGC3626, NGC3838, and NGC3998.

## Failure Anatomy

The failure panel explains the active custom framework score, including:

```text
worst residual
worst residual radius
dominant failing radial band
outer RMSE
outer bias
route preservation or route break
x_cross error
invalid point count
```

This is intended to stop comparisons from becoming single-score arguments.

## Experiment Capsules

`Export Capsule` writes a portable JSON experiment state:

```text
mode
active galaxy selection
synthetic controls
galaxy view tilt, depth, and particle colour mode
galaxy forge preset, seed, and active recipe
framework expression
comparative expression and residual-field mode
benchmark pack and results
tournament queue and results
time-evolution track and epoch
LTG browser filters
route-space axes
parameter landscape config and results
current diagnostics
uncertainty config and active robustness results
scientific QA provenance, schema, audit, and stress rows
custom import normalization summary
population statistics summary and correlation rows
baseline fit-correlation summary
```

Loading the capsule restores the experiment state in the browser.

## Capsule Library

The Capsule Library turns experiment capsules into a local, searchable branch history:

```text
Save Snapshot: stores the active experiment in browser storage
Load A: restores the selected snapshot A into the workbench
Diff A/B: compares selected snapshots across galaxy identity, route state, RMSE, u_out, u_max, x_cross, memory, L_eff, formulas, QA, uncertainty, and population correlation
Publish Active: saves the active experiment and writes a standalone HTML report with plots, diagnostics, capsule JSON, and the current diff when present
Export Library: writes the saved snapshot library as JSON
Delete A: removes the selected local snapshot
```

This is intended for reproducibility, review, and collaboration: a user can keep multiple branches of the same galaxy or framework law, compare what changed, reload the exact state, and publish a self-contained report without needing a backend service.

The `Trust Fingerprint` panel and exported capsule filename include an `mts-xxxxxxxx` hash. The hash is computed from a stable ordering of the capsule while excluding volatile generated/export timestamps.

## Regenerate ETG Samples

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-etg-samples.ps1 -ZipPath "C:\path\to\Rotmod_ETG.zip"
```

## Verification

Rendered locally with Microsoft Edge headless:

```text
qa-desktop.png
qa-observed.png
qa-observed-v2.png
qa-etg-v2.png
qa-mobile.png
qa-evidence-observed.png
qa-evidence-etg.png
qa-evidence-mobile.png
qa-framework-observed-v2.png
qa-framework-mobile.png
qa-framework-batch-v3.png
qa-trust-observed.png
qa-trust-mobile.png
qa-trust-tournament.png
qa-sweep-observed.png
qa-sweep-mobile.png
qa-sweep-heatmap.png
qa-evolution-desktop.png
qa-evolution-mobile.png
qa-comparison-desktop.png
qa-comparison-mobile.png
qa-forge-desktop.png
qa-forge-mobile.png
qa-serious-bundle-desktop.png
qa-serious-bundle-mobile-emulated.png
qa-v18-observed.png
qa-v18-etg.png
qa-v18-mobile.png
qa-claims-desktop.png
qa-case-etg.png
qa-claims-mobile.png
qa-uncertainty-desktop.png
qa-layers-etg.png
qa-uncertainty-mobile.png
qa-scienceqa-desktop.png
qa-scienceqa-mobile.png
qa-custom-import.png
qa-population-explorer.png
qa-capsule-diff.png
qa-capsule-library.png
qa-fit-correlation.png
qa-residual-bands.png
```

The Edge console emitted browser-internal task-manager/sync warnings, but the screenshots and DOM showed the app loaded, plotted data, and computed the ROTMOD overlays. CDP click tests ran the Framework Test Rig over all 175 LTGs, ran the four-entry Framework Tournament, scanned the 13 x 9 parameter landscape across all 175 LTGs, scrubbed the synthetic late-load evolution track to confirm a live route flip, ran A/B comparative mode on CamB with the comparator residual field enabled, forged the outer-infeasible stress preset with `u_out = 1.852`, generated a trust fingerprint, ran the Benchmark Suite on the 20-galaxy best-baseline pack, switched the galaxy view to velocity colouring, and saved a formula into the Formula Registry. v18 checks loaded UGC06786 as a supercritical `u_0.75` single-crossing case and NGC3626 as the named R85 sensitivity ETG. Reproducibility checks reported `15/15 pass`, and the Trust Fingerprint and Galaxy Case File capsule hashes matched after claim generation. Layer toggles were exercised for gas and residual-field visibility. Uncertainty checks ran 64 perturbation trials on CamB with 100 percent route stability, dominant route `CDC-low-load`, median RMSE `15.84`, and `u_out` range `0.07-0.17`; Trust and Case hashes matched afterward. Scientific QA on CamB reported `qa locked`, provenance `warn`, schema `10p/3w/0f`, error bars `9/9`, stress `2p/3w/0f`, kept `15/15 pass` claim status, and exported both HTML and CSV QA reports. ETG Scientific QA on NGC2685 reported `qa locked`, schema `10p/3w/0f`, and error bars `220/220` after the interpolated ETG radius grid was made strictly increasing. Custom import QA normalized a seven-row CSV galaxy to kpc and km/s, classified it as `outer-infeasible`, locked Scientific QA, and exported normalized CSV. Population Explorer on all 175 LTGs reported `memory vs RMSE`, `r = 0.498`, bootstrap `0.42-0.59`, dominant route `low-load`, 175 plotted points, and exported population CSV. Mobile emulation reported `innerWidth = 390`, `bodyScrollWidth = 375`, and `documentElement.scrollWidth = 375`. Capsule Library QA saved CamB and D512-2 snapshots, diffed them with `10/17` changed fields, preserved the diff through `Publish Active`, restored the CamB snapshot with route `CDC-low-load`, exported `mts-capsule-library-2026-05-07.json`, and rechecked mobile layout at `innerWidth = 390`, `bodyScrollWidth = 390`, and `documentElement.scrollWidth = 390`. Fit/residual QA on CamB confirmed 9 points, `r_fit = 0.941`, RMSE `15.82`, bias `+15.71`, residual bands populated, no runtime exceptions, and mobile layout at `innerWidth = 390`, `bodyScrollWidth = 390`, `documentElement.scrollWidth = 390`.
