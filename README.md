# MTS Galaxy Lab

A zero-install browser workbench for exploring galaxy rotation curves, transport-response models, framework comparisons, and reproducible support-law experiments.

MTS Galaxy Lab is designed as a local-first scientific sandbox:

* open a single HTML file,
* load real SPARC/ATLAS3D galaxies,
* test your own equations,
* compare frameworks visually,
* export reproducible experiment capsules,
* and run benchmark suites without needing Python, Node, servers, or cloud infrastructure.

This is not just a static plot viewer.
It is an interactive galaxy-analysis environment built for experimentation.

---

# Why This Exists

Most galaxy-framework experimentation is locked behind:

* custom pipelines,
* notebooks,
* plotting scripts,
* hidden preprocessing,
* or large codebases.

MTS Galaxy Lab tries to lower that barrier.

The goal is simple:

> Bring your own maths.

You do not need to build a plotting engine or a SPARC processing pipeline just to test an idea.

The lab lets users:

* load real galaxies,
* compare support laws,
* inspect residual structure,
* classify route behaviour,
* stress-test frameworks,
* and export reproducible evidence packs.

Everything runs locally in the browser.

---

# Quick Start

Open:

```text
index.html
```

That is it.

The app is static HTML/CSS/JavaScript and does not require:

```text
Node
Python
npm
local servers
internet access
```

---

# Main Modes

## Synthetic Mode

Build controlled toy galaxies using live sliders:

* disk scale length
* outer radius
* gas load
* bulge load
* gas fraction
* transport exponent q
* particle speed
* support-only mode

Synthetic mode supports:

* deterministic galaxy forging
* time evolution tracks
* morphology presets
* route-flip testing
* residual visualisation
* parameter sweeps

Useful for:

* stress testing frameworks
* intuition building
* controlled experiments
* visual demonstrations

---

## LTG Mode

Loads all 175 bundled SPARC late-type galaxies.

Supports:

* live ROTMOD overlays
* pasted/imported `.dat` files
* SPARC browser
* route diagnostics
* framework comparisons
* benchmark scoring
* residual analysis
* evidence export

The SPARC Browser supports:

```text
search by galaxy name
filter by route class
sort by RMSE, u_out, Priority L MAE, x_cross, or name
quick hunts:
  - Late-load
  - CDC
  - Single-crossing
  - Infeasible
  - Worst-fit
  - Best-fit
```

---

## ETG Mode

Loads all 16 bundled ATLAS3D ETGs from `Rotmod_ETG.zip`.

Includes:

* high-resolution disk profiles
* Stage-4 diagnostics
* R80 / R90 analysis
* curvature laws
* residual tracking
* outer-chain diagnostics

---

# Core Features

## Framework Test Rig

Test alternate support laws without modifying the locked MTS baseline.

Enter a custom support-law expression in `(km/s)^2` and run it against:

* the active galaxy,
* or all 175 LTGs.

The app computes:

* RMSE
* outer RMSE
* residual structure
* route preservation
* invalid point counts
* benchmark deltas

Bundled presets include:

```text
MTS baseline
Baryon only
Soft radial support
Outer gate support
Observed residual check
```

---

## Comparative Mode

Run two competing support laws side-by-side.

The interface reports:

```text
A RMSE
B RMSE
winner
A minus B outer RMSE
route preservation state
```

Plots can overlay:

* baseline
* framework A
* framework B
* residual differences

Useful for:

* MOND comparisons
* custom support laws
* transport-law tuning
* framework tournaments

---

## Framework Tournament

Queue many frameworks at once:

```text
Name = support_law_v2
```

The tournament system ranks frameworks by:

```text
mean RMSE
median delta vs MTS
wins vs MTS
route preservation rate
mean outer RMSE
invalid point count
```

Exportable as CSV.

---

## Benchmark Suite

Run reproducible benchmark packs:

```text
All 175 LTGs
Late-load systems
CDC-low systems
Single-crossing systems
Outer-infeasible systems
Worst baseline RMSE
Best baseline RMSE
```

The suite reports:

* A/B wins
* mean RMSE
* strongest deltas
* route preservation rate

---

## Parameter Landscape

Scan framework performance across:

```text
Gamma0 scale
q exponent
```

Grid options:

```text
9 x 7
13 x 9
17 x 11
```

The heatmap computes:

* best parameter cell
* robust regions
* wins versus baseline
* outer RMSE behaviour

Clicking a heatmap cell loads that framework directly into the test rig.

---

## Route-Space Map

Visualise the LTG dataset in diagnostic coordinates:

```text
x_cross
u_out
memory
h/r_out
RMSE
Priority L
L_eff/h
```

Points are:

* colour-coded by route class
* scaled by RMSE
* clickable for direct galaxy loading

---

## Failure Anatomy

Framework scores are not reduced to a single number.

Failure Anatomy reports:

```text
worst residual
worst residual radius
dominant failing radial band
outer RMSE
outer bias
route preservation/break
x_cross error
invalid point count
```

---

# Residual Field Overlay

The galaxy canvas can render residual structure as radial haze:

```text
red   = overprediction
cyan  = underprediction
```

Field modes:

```text
Off
MTS residual
Test rig residual
Comparator residual
Test minus comparator
```

The field is visual only.

Numeric truth remains:

* plotted residuals
* CSV exports
* benchmark scores
* diagnostic panels

---

# Galaxy Forge

Synthetic mode includes deterministic morphology generation.

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

Morphologies control:

```text
spiral arm count
gas fraction
disk thickness
outer rings
central concentration
lopsided scatter
```

Useful for controlled framework stress-testing.

---

# Time Evolution Mode

Synthetic galaxies can evolve through controlled tracks:

```text
Late-load build
Gas depletion
Bulge compaction
Gas rebuild
```

The app updates:

* transport curves
* route diagnostics
* particle cloud structure
* evolution timelines

in real time.

---

# Experiment Capsules

The lab supports portable experiment-state export.

Capsules store:

```text
mode
selected galaxy
synthetic controls
framework equations
comparative mode state
benchmark results
tournament queues
parameter sweeps
route-space axes
evolution state
view settings
diagnostics
```

Capsules restore directly in-browser.

---

# Trust Fingerprints

Capsules include stable reproducibility hashes:

```text
mts-xxxxxxxx
```

The hash excludes volatile timestamps while preserving:

* equations
* framework states
* diagnostics
* benchmark configs
* experiment structure

---

# Evidence Pack Exports

The left rail includes export tools for reproducibility and sharing.

Exports include:

```text
Current CSV
LTG Index CSV
Summary JSON
Plot SVG
Export Capsule
Diagnostic Sheet
Trust Report
Figure Pack
```

---

# Formula Registry

Support laws can be:

```text
saved
reloaded
imported
exported
shared
```

No backend required.

Everything is stored locally in browser storage.

---

# Physics / Formulae

## Locked Constants

```text
Gamma0   = 809.956
Rmax     = 1.758948
ML_disk  = 0.5
ML_bulge = 0.7
q        = 0.77
```

## Core Relations

```text
V_bar^2 =
  V_gas^2
  + 0.5 V_disk^2
  + 0.7 V_bulge^2

S_mem =
  (0.9 / pi) * (r_out / h)

memory_load =
  (1 - f_gas_out) * (r_out / h)

L_eff =
  1.8 h * (
    1 + S_mem * (
      1 - exp(-memory_load / S_mem)
    )
  )

V_model^2(r) =
  V_bar^2(r)
  + Gamma0 * L_eff * (
      1 - exp(-(r / L_eff)^q)
    )

u(r) =
  (
    V_obs^2
    - 0.5 V_disk^2
    - 0.7 V_bulge^2
  )
  / (
    Gamma0 * r * Rmax
  )
```

---

# Allowed Formula Variables

```text
r, x, h, rOut, fGas, fGasOut
leff, memory, q
gamma0, rMax
mlDisk, mlBulge
vGas, vDisk, vBulge
vBar, vObs, uObs
pi, e
```

Allowed functions:

```text
abs
sqrt
pow
exp
log
log10
min
max
sin
cos
tan
tanh
atan
atan2
floor
ceil
round
```

The parser accepts restricted mathematical expressions only.

No arbitrary JavaScript execution.

---

# Regenerate LTG Samples

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\export-samples.ps1 `
  -ZipPath "C:\path\to\Rotmod_LTG (4).zip"
```

---

# Regenerate ETG Samples

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\export-etg-samples.ps1 `
  -ZipPath "C:\path\to\Rotmod_ETG.zip"
```

---

# Verification

The app has been locally rendered and tested using Microsoft Edge headless rendering and CDP automation.

Verified systems include:

* LTG rendering
* ETG rendering
* Framework Test Rig
* Tournament mode
* Benchmark Suite
* Parameter Landscape
* Comparative Mode
* Residual overlays
* Trust Fingerprints
* Evolution tracks
* Galaxy Forge
* Formula Registry
* Mobile rendering

Representative QA renders:

```text
qa-desktop.png
qa-mobile.png
qa-framework-observed-v2.png
qa-sweep-heatmap.png
qa-comparison-desktop.png
qa-forge-desktop.png
qa-serious-bundle-desktop.png
```

Mobile emulation verified:

```text
innerWidth = 390
bodyScrollWidth = 390
documentElement.scrollWidth = 390
```

The app loaded, plotted data, restored capsules, ran framework batches, generated tournament boards, computed parameter sweeps, restored evolution tracks, and exported evidence packs successfully.
