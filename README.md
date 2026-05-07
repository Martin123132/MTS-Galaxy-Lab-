MTS Galaxy Lab

Zero-install browser workbench for exploring galaxy rotation curves, transport-response models, framework comparisons, and reproducible support-law experiments.

MTS Galaxy Lab is a local-first scientific sandbox designed for rapid experimentation with real galaxy datasets.

Open a single HTML file, load real SPARC and ATLAS3D systems, test alternate support laws, inspect residual structure, export reproducible evidence packs, and run benchmark suites entirely inside the browser.

No Python.
No Node.
No server.
No cloud dependency.

⸻

Quick Start

Open:

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

⸻

Test Your Own Frameworks

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

Capsules include stable reproducible hashes:

mts-xxxxxxxx

⸻

Modes

Synthetic

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
Gas-rich spiral
CDC-low analogue
Late-load pathological
Outer-infeasible stress

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

⸻

ETG Diagnostics

Stage-4 R80
Stage-4 R85
Stage-4 R90
crossing-window curvature
c1 slope law
ETG S-law diagnostics

⸻

Scientific QA Layer

The lab includes a built-in scientific validation and provenance system.

Scientific QA reports include:

source tracking
file provenance
checksums
schema validation
unit validation
error-bar preservation
stress-test coverage
feature audit rows
failure anatomy
uncertainty linkage

Warnings are intentionally explicit rather than silently ignored.

Examples:

missing covariance
missing reduction pipeline
missing calibration metadata
workspace-no-git provenance state

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

⸻

Comparative Mode

Run framework A vs framework B simultaneously.

Reports:

A RMSE
B RMSE
winner
outer RMSE delta
route preservation

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

⸻

Framework Tournament

Queue multiple support laws and rank them across all LTGs.

Leaderboard reports:

mean RMSE
wins vs MTS
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

heatmap sweeps across all 175 LTGs.

⸻

Visual Diagnostics

Residual Field Overlay

Visual radial haze overlay:

red   = overprediction
cyan  = underprediction

⸻

Galaxy View

Interactive visual controls:

camera tilt
depth lift
particle colouring
gas/star/bulge toggles
guide rings
residual overlays

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

⸻

Experiment Capsules

Portable JSON experiment states include:

active galaxy
framework expressions
benchmark results
uncertainty runs
QA rows
route-space settings
parameter sweeps
view state
forge state
evolution state

Capsules restore directly in-browser.

⸻

Claim Validator

The claim validator recomputes paper-facing checks directly from the bundled data.

Validates:

LTG counts
route memberships
Priority L memberships
supercritical memberships
late-load counts
locked ETG rows
S-law coverage

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

Scientific QA validation includes:

CamB
NGC2685

with reproducibility hash matching across exports.

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

