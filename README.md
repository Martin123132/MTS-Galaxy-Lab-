# MTS Galaxy Lab
<img width="1290" height="1950" alt="011cfd35-2a6a-4e69-a86b-de92547dc2ee" src="https://github.com/user-attachments/assets/221e0a9e-be0b-42f2-9ff2-2d7a27158eda" />
Zero-install browser workbench for exploring galaxy rotation curves, transport-response models, framework comparisons, and reproducible support-law experiments.
MTS Galaxy Lab is a local-first scientific sandbox designed for rapid experimentation with real galaxy datasets.
Open a single HTML file, load real SPARC and ATLAS3D systems, test alternate support laws, inspect residual structure, export reproducible evidence packs, and run benchmark suites entirely inside the browser.
No Python.  
No Node.  
No server.  
No cloud dependency.
---
## Quick Start
Open:
```text
index.html

That is it.

The application is static HTML/CSS/JavaScript and runs locally in the browser.

⸻

What You Can Do

Explore Real Galaxy Data

The lab includes:

175 SPARC LTGs
16 ATLAS3D ETGs

Features include:

* rotation-curve overlays
* residual analysis
* route classification
* transport diagnostics
* uncertainty trials
* framework comparisons
* parameter sweeps
* reproducible experiment exports
* population statistics
* claim validation
* scientific QA
* capsule diffing and local branch history

⸻

Test Your Own Frameworks

<img width="1440" height="1200" alt="qa-claims-desktop" src="https://github.com/user-attachments/assets/0607d177-a347-4d5a-990a-3a8253bebd28" />

Enter your own support-law equation directly in the browser.

Example:

Name = support_law_v2

The framework test rig can:

* score against all 175 LTGs
* compare against the locked MTS baseline
* inspect residual structure
* measure route preservation
* export benchmark tables
* run framework tournaments

⸻

Formulae Implemented

V_bar^2 = V_gas^2 + 0.5 V_disk^2 + 0.7 V_bulge^2
S_mem = (0.9 / pi) * (r_out / h)
memory_load = (1 - f_gas_out) * (r_out / h)
L_eff = 1.8 h * (1 + S_mem * (1 - exp(-memory_load / S_mem)))
V_model^2(r) = V_bar^2(r) + Gamma0 * L_eff * (1 - exp(-(r / L_eff)^q))
u(r) = (V_obs^2 - 0.5 V_disk^2 - 0.7 V_bulge^2) / (Gamma0 * r * Rmax)

For synthetic mode, V_obs is the generated MTS model.
For ROTMOD mode, V_obs is the observed SPARC value.

⸻

Export Reproducible Evidence

The app exports:

CSV
JSON capsules
SVG figures
HTML trust reports
case files
QA reports
benchmark tables
parameter sweeps
population tables
capsule libraries

Capsules include stable reproducible hashes:

mts-xxxxxxxx

The hash is computed from a stable ordering of the capsule while excluding volatile generated/export timestamps.

⸻

Modes

Synthetic

<img width="1460" height="950" alt="qa-forge-desktop" src="https://github.com/user-attachments/assets/8d968a90-d445-45fa-a90b-2ee7324a1dfd" />

Generate controlled toy systems using sliders for:

* disk
* gas
* bulge
* memory load
* q
* morphology
* evolution tracks

Includes Galaxy Forge presets such as:

LSB disk
Dwarf irregular
Gas-rich spiral
Bulge-dominated LTG
Compact ETG-like
CDC-low analogue
Late-load pathological
Outer-infeasible stress

Synthetic mode also includes controlled time-evolution tracks:

Late-load build
Gas depletion
Bulge compaction
Gas rebuild

The epoch slider and playback button update the synthetic galaxy controls live, recompute the transport curve, refresh route diagnostics, and periodically refresh the particle cloud.

⸻

LTG Mode

Loads all bundled SPARC LTGs generated from:

Rotmod_LTG (4).zip

Supports:

* route filtering
* residual inspection
* Priority L diagnostics
* single-crossing hunts
* benchmark sweeps
* uncertainty analysis
* route-space mapping
* population statistics
* claim validation

The SPARC Browser indexes all 175 LTGs and supports:

search by galaxy name
filter by route class
sort by RMSE, u_out, Priority L MAE, x_cross, or name
quick hunts: Late-load, CDC, Single, Infeasible, Worst, Best
route summary chips: low, upward, single, infeasible, CDC-low, late flag

⸻

ETG Mode

Loads all bundled ATLAS3D ETGs generated from:

Rotmod_ETG.zip

Includes:

* Stage-4 diagnostics
* R80/R85/R90 geometry rows
* ETG curvature diagnostics
* S-law diagnostics
* locked v18 table values

The app uses locked v18 table values for ETG h, R80, R85, R90, Sigma80-100, and logy where available.

R85 is exposed as the primary Stage-4 geometry signal, while the R80/R90 rows remain available for continuity.

⸻

Locked Constants

Gamma0 = 809.956
Rmax = 1.758948
ML_disk = 0.5
ML_bulge = 0.7
q = 0.77

⸻

Implemented Diagnostics

LTG Diagnostics

Priority L
Priority L3
u_0.75
single-crossing diagnostics
late-load diagnostics
CDC-low diagnostics
inverse-sqrt curvature A
S-law completion

v18 implemented values:

Priority L MAE ~= -10.315 + 8.645*g + 10.508*L_gap
Priority L3 diagnostic ~= -28.012 + 6.609*g + 11.214*L_gap + 28.625*u_0.75
Priority L3 is diagnostic only, not canonical
LTG curvature A ~= -2.671 + 2.735/sqrt(u_0.75)
supercritical late-load flag = u_0.75 > 1

Inner S-law completion diagnostic:

Q12 = Vbar^2(0.5h) / Vbar^2(h)
Q14 = Vbar^2(0.25h) / Vbar^2(h)
S = Q14 / (1-Q12)
LTG Umax ~= 0.2391 - 0.0697*ln(S)
ETG Umax ~= 0.2325 - 0.0578*ln(S)

⸻

ETG Diagnostics

Stage-4 R80
Stage-4 R85
Stage-4 R90
crossing-window curvature
c1 slope law
ETG S-law diagnostics

Current ETG diagnostic rows:

Stage-4 R80 row: logy ~= 4.313 + 0.808*log(Sigma80-100) + 1.732*log(r_out/R80)
Stage-4 R90 row: logy ~= 4.7556 + 0.8348*log(Sigma80-100) + 1.7153*log(r_out/R90)
Stage-4 R85 geometry: v18 empirical clean-HL preference, strongest row HL11 minus NGC3998 with LOO = 0.156
c1 slope law = -(1-u_out)/(1-x_cross)
ETG curvature A ~= -0.015 + 1.029*(1-x_cross)

⸻

Scientific QA Layer

The lab includes a built-in scientific validation and provenance system.

Scientific QA reports include:

* source tracking
* file provenance
* checksums
* schema validation
* unit validation
* error-bar preservation
* stress-test coverage
* feature audit rows
* failure anatomy
* uncertainty linkage

Warnings are intentionally explicit rather than silently ignored.

Examples:

missing covariance
missing reduction pipeline
missing calibration metadata
workspace-no-git provenance state

The schema validator checks whether the active record is scientifically usable, not just parseable:

radius unit = kpc
velocity unit = km/s
finite monotone radii
r_out lock against the final parsed point
finite positive h and compact geometry
gas fraction in a physical range
errV preservation
missing covariance, redshift frame, and reduction pipeline warnings

⸻

Framework Research Tools

Framework Test Rig

Compare alternate support laws against the locked baseline.

Features:

* custom support-law parser
* restricted safe math expressions
* residual analysis
* outer-RMSE diagnostics
* route preservation checks
* batch scoring over all 175 LTGs

Bundled presets:

MTS baseline
Baryon only
Soft radial support
Outer gate support
Observed residual check

Allowed formula variables:

r, x, h, rOut, fGas, fGasOut, leff, memory, q
gamma0, rMax, mlDisk, mlBulge
vGas, vDisk, vBulge, vBar, vObs, uObs
pi, e

Allowed math functions:

abs, sqrt, pow, exp, log, log10, min, max
sin, cos, tan, tanh, atan, atan2, floor, ceil, round

The formula editor accepts restricted math expressions, not general JavaScript.

⸻

Comparative Mode

Run framework A vs framework B simultaneously.

Reports:

A RMSE
B RMSE
winner
outer RMSE delta
route preservation

The rotation curve plot draws B as a gold dashed line and the residual plot can draw A and B together.

⸻

Formula Registry

The Formula Registry lets users save, reload, import, and export support laws.

Save A
Load to A
Load to B
Export Registry
Import Registry

This makes support laws shareable without turning the app into a server-backed system.

⸻

Benchmark Suite

Run reproducible benchmark packs:

All LTGs
Late-load systems
CDC-low systems
Single-crossing systems
Outer-infeasible systems
Worst baseline systems
Best baseline systems

The suite reports A/B wins, mean RMSE, route preservation rate, and strongest case-by-case deltas.

⸻

Framework Tournament

Queue multiple support laws and rank them across all LTGs.

Leaderboard reports:

mean RMSE
median delta versus MTS
wins versus MTS
route preservation
outer RMSE
invalid points

⸻

Parameter Landscape

Grid-search the MTS-family parameter space over:

Gamma0
q

Supports:

9x7
13x9
17x11

The heatmap reports:

best cell
mean RMSE
mean outer RMSE
wins versus locked baseline
robust cells within 3 percent of best mean RMSE

Clicking a heatmap cell sends that parameterized support law into the Framework Test Rig.

⸻

Visual Diagnostics

Residual Field Overlay

Visual radial haze overlay:

red   = overprediction
cyan  = underprediction

Available field modes:

Off
MTS residual
Test rig residual
Comparator residual
Test minus comparator

The field is visual evidence only; the numeric source of truth remains the plotted residuals, CSV exports, and score panels.

⸻

Galaxy View

<img width="1440" height="1200" alt="qa-layers-etg" src="https://github.com/user-attachments/assets/f551e72f-1f48-487e-9ae9-0c1c99de0820" />

Interactive visual controls:

* camera tilt
* depth lift
* particle colouring
* gas/star/bulge toggles
* guide rings
* residual overlays

Particle generation labels render components as stars, gas, or bulge material. The layer toggles affect only the visual scene, not the rotation-curve diagnostics, capsule state, or exported metrics.

⸻

Fit Correlation and Residual Bands

Observed and ETG modes include a Fit Correlation panel that plots V_obs against V_model, draws the one-to-one line, and adds plus/minus RMSE bands.

It reports:

point count
r_fit
RMSE
mean bias

The Residual Bands panel splits the active observed fit into inner, middle, and outer radius thirds.

For each band it reports:

RMSE
mean bias
point count
strongest residual location

The table also lists the worst individual residual points.

⸻

Uncertainty Lab

Perturbation testing system supporting:

velocity noise
M/L jitter
32 / 64 / 128 trials

Reports:

route stability
dominant perturbed route
median RMSE
u_out range
trial-by-trial behaviour

The results are included in capsules, case files, diagnostic sheets, trust reports, and Export Robustness CSV files when the active curve and uncertainty settings match the run.

⸻

Experiment Capsules

Portable JSON experiment states include:

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

Capsules restore directly in-browser.

⸻

Capsule Library

The Capsule Library turns experiment capsules into a local, searchable branch history:

Save Snapshot
Load A
Diff A/B
Publish Active
Export Library
Delete A

It can compare selected snapshots across:

galaxy identity
route state
RMSE
u_out
u_max
x_cross
memory
L_eff
formulas
QA
uncertainty
population correlation

This is intended for reproducibility, review, and collaboration.

⸻

Claim Validator

The claim validator recomputes paper-facing checks directly from the bundled data.

Validates:

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

Passing rows show pass; rows needing attention show review with expected and actual values available in the row tooltip.

⸻

Galaxy Case Files

The Galaxy Case File panel follows the active curve and records the local evidence for that specific galaxy:

identity, mode, route, point count
capsule hash
u0, u_out, u_max, x_cross
paper membership flags
LTG Priority L, L3, u_0.75, curvature, S-law diagnostics
ETG R80/R85/R90, r_out/R85, logy, curvature, S-law diagnostics
active formula A/B scores when present
forge and evolution metadata for synthetic cases

Export Case File writes a standalone HTML file with the case table, active plots, a human-readable case note, and embedded diagnostic JSON.

⸻

Custom Data Import

Observed mode includes a custom normalizer for user-supplied galaxy tables.

It accepts:

headered CSV
JSON arrays
JSON objects with rows/data/points
whitespace text tables
ROTMOD-like numeric rows

Recognized column names include:

r, radius, rad
Vobs, Vrot, velocity
errV, err, sigma
Vgas, Vdisk, Vbul, Vbulge
SBdisk, SBbul

The normalizer can convert radii from kpc, pc, or arcsec, apply a distance scale, convert arcseconds using distance in Mpc, and deproject observed or all velocities using supplied inclination.

The normalized curve then enters the same pipeline as bundled LTGs.

⸻

Route-Space Map

The route-space map projects the LTG dataset into diagnostic coordinates.

Supported axes:

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

Points are color-coded by route class and sized by RMSE. Clicking a point loads that galaxy.

⸻

Population Explorer

Observed mode includes population statistics for the LTG sample or current browser subset.

It can correlate:

memory
RMSE
u_0.75
LTG curvature A
S-law S
u_max
x_cross
L_eff/h

The panel reports:

sample size
Pearson correlation
bootstrap interval
dominant route
strongest pairwise correlations
jackknife stability

Export Population writes the active population rows plus summary correlation, bootstrap, and jackknife columns as CSV.

⸻

v18 Structure Panel

The right rail includes a compact v18 diagnostic panel.

For LTGs and synthetic curves it shows:

canonical Priority L
diagnostic Priority L3
LTG inverse-sqrt curvature A
S-law Umax residual

For ETGs it switches to:

R85
r_out/R85
ETG crossing-window curvature A
S-law Umax residual

Named v18 outlier notes are shown for:

NGC3626
NGC3838
NGC3998

⸻

Failure Anatomy

The failure panel explains the active custom framework score, including:

worst residual
worst residual radius
dominant failing radial band
outer RMSE
outer bias
route preservation or route break
x_cross error
invalid point count

This is intended to stop comparisons from becoming single-score arguments.

⸻

Repository Structure

index.html
/scripts/
data/
exports/
capsules/

⸻

Regenerating Bundled Samples

LTGs

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-samples.ps1 -ZipPath "C:\path\to\Rotmod_LTG (4).zip"

ETGs

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-etg-samples.ps1 -ZipPath "C:\path\to\Rotmod_ETG.zip"

⸻

Verification

Validated locally using Microsoft Edge headless rendering and automated interaction tests.

Verified systems include:

Framework Test Rig
Framework Tournament
Parameter Landscape
Comparative Mode
Galaxy Forge
Time Evolution
Scientific QA
Claim Validator
Uncertainty Lab
Capsule Library
Custom Import
Population Explorer
Fit Correlation
Residual Bands

Rendered screenshots include:

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

Automated checks confirmed:

Framework Test Rig over all 175 LTGs
four-entry Framework Tournament
13 x 9 parameter landscape across all 175 LTGs
synthetic late-load evolution route flip
A/B comparative mode on CamB
comparator residual field
outer-infeasible forge preset with u_out = 1.852
trust fingerprint generation
Benchmark Suite on 20-galaxy best-baseline pack
Formula Registry save/load path
UGC06786 supercritical u_0.75 single-crossing case
NGC3626 named R85 sensitivity ETG
15/15 claim validation pass
matching Trust Fingerprint and Galaxy Case File hashes
gas and residual-field layer toggles
64 perturbation trials on CamB
Scientific QA on CamB
ETG Scientific QA on NGC2685
custom import normalization
Population Explorer memory vs RMSE correlation
Capsule Library save/diff/publish/restore/export path
Fit correlation and residual-band panels
mobile layout at 390 px width

Specific verification outputs included:

CamB uncertainty:
route stability = 100 percent
dominant route = CDC-low-load
median RMSE = 15.84
u_out range = 0.07-0.17
CamB Scientific QA:
qa locked
provenance warn
schema 10p/3w/0f
error bars 9/9
stress 2p/3w/0f
claim status 15/15 pass
NGC2685 ETG Scientific QA:
qa locked
schema 10p/3w/0f
error bars 220/220
Population Explorer:
memory vs RMSE
r = 0.498
bootstrap = 0.42-0.59
dominant route = low-load
175 plotted points
Capsule Library:
CamB and D512-2 snapshots saved
10/17 changed fields in diff
published report preserved diff
CamB restored as CDC-low-load
Fit/residual QA on CamB:
points = 9
r_fit = 0.941
RMSE = 15.82
bias = +15.71

The Edge console emitted browser-internal task-manager/sync warnings, but screenshots and DOM checks showed the app loaded, plotted data, and computed the ROTMOD overlays.

⸻

Status

Current browser workbench aligned with:

v18 diagnostics
Paper v15 state

Including:

* Priority L/L3 diagnostics
* ETG Stage-4 diagnostics
* Scientific QA layer
* uncertainty exports
* framework tournament system
* reproducible evidence packs
* stable capsule hashing
* custom import normalization
* capsule library and diffing
* population explorer
* fit correlation and residual bands

⸻

Data Sources

SPARC Database

LTG rotation-curve data and ROTMOD decompositions are derived from the SPARC database:

SPARC
The SPARC Database

Reference:

Lelli, F., McGaugh, S. S., & Schombert, J. M. (2016)
SPARC: Mass Models for 175 Disk Galaxies with Spitzer Photometry and Accurate Rotation Curves
Astronomical Journal, 152, 157
doi:10.3847/0004-6256/152/6/157

The bundled LTG browser samples were generated from:

Rotmod_LTG (4).zip

using locally exported ROTMOD tables.

⸻

ATLAS3D / ETG Data

ETG high-resolution decompositions are derived from:

ATLAS3D

Reference:

Cappellari, M. et al. (2011)
The ATLAS3D project – I. A volume-limited sample of 260 nearby early-type galaxies
Monthly Notices of the Royal Astronomical Society, 413, 813–836
doi:10.1111/j.1365-2966.2010.18174.x

The bundled ETG browser samples were generated from:

Rotmod_ETG.zip

including high-resolution disk and bulge component tables.

⸻

Notes

The browser workbench redistributes processed local exports and derived diagnostic tables used for reproducible experimentation inside the static app.

Original survey ownership, calibration methodology, and observational provenance remain with the respective survey authors and collaborations.

⸻

Philosophy

Most galaxy-framework experimentation is hidden behind:

* notebooks
* custom pipelines
* plotting scripts
* undocumented preprocessing
* large codebases

MTS Galaxy Lab tries to lower that barrier.

Bring your own maths.

You should not need to build an entire pipeline just to test an idea.
