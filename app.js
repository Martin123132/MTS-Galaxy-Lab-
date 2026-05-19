(function () {
  "use strict";

  var CONST = {
    gamma0: 809.956,
    rMax: 1.758948,
    cConst: 0.459411,
    mlDisk: 0.5,
    mlBulge: 0.7,
    uStar: 0.201803,
    r90OverH: 3.88972016986743,
    qDefault: 0.77
  };

  var V17STATE_EXACT_TOKEN = "__MTS_V17_97_RADIAL_REPAIR_STATE_RESPONSE__";
  var V18REVIEW_TOKEN = "__MTS_V18_01_PROMOTION_GATE_REVIEW__";
  var V18_REVIEW_GATE_FALLBACK = {
    candidateId: "observed-state-response-v18.01-promotion-gate",
    verdict: "v18 candidate ready for review",
    nominalHighGainPct: 68.07867961334428,
    nominalCleanGainPct: 43.737260426360244,
    holdoutHighGainPct: 66.67923997034711,
    stressAbove20: 0,
    stressMinHighGainPct: 59.47261043333803,
    nullMarginKmS: 26.105578965995377,
    activeProtectedWorseCount: 0,
    nominalDiffVsV1797Count: 0
  };
  var V18_REVIEW_GATE = (
    window.MTS_V18_01_REVIEW_CANDIDATE &&
    window.MTS_V18_01_REVIEW_CANDIDATE.metadata &&
    window.MTS_V18_01_REVIEW_CANDIDATE.metadata.reviewGate
  ) || V18_REVIEW_GATE_FALLBACK;
  var V17STATE_LEGACY_TOKENS = {
    "__MTS_V17_96_REMAINING_STRESS_STATE_RESPONSE__": true,
    "__MTS_V17_95_STRESS_POLISH_STATE_RESPONSE__": true,
    "__MTS_V17_94_SCALE_ROBUST_STATE_RESPONSE__": true,
    "__MTS_V17_93_RELEASE_CANDIDATE_TRANSFER_GUARD__": true,
    "__MTS_V17_92_ROUTE_BOUNDARY_GUARD_ROUTE_SAFE__": true,
    "__MTS_V17_91_LOWLOAD_TAIL_SELECTOR_ROUTE_SAFE__": true,
    "__MTS_V17_90_LOWLOAD_FAMILY_COLLAPSE_ROUTE_SAFE__": true,
    "__MTS_V17_89_FAMILY_MERGED_ROUTE_SAFE__": true,
    "__MTS_V17_88_SPINE_FREE_ROUTE_SAFE__": true,
    "__MTS_V17_87_ROUTE_SAFE_PROJECTED__": true,
    "__MTS_V17_86_ROBUSTNESS_PASSED__": true,
    "__MTS_V17_85_TRANSFER_HARDENED__": true
  };

  var FRAMEWORK_PRESETS = {
    mts: "gamma0 * leff * (1 - exp(-pow(r / leff, q)))",
    v17state: V17STATE_EXACT_TOKEN,
    v18review: V18REVIEW_TOKEN,
    baryon: "0",
    soft: "gamma0 * leff * (1 - exp(-r / leff))",
    outer: "gamma0 * leff * pow(max(0, x), 0.75) * (1 - exp(-memory / 2))",
    residual: "max(0, pow(vObs, 2) - pow(vBar, 2))"
  };

  var FRAMEWORK_PRESET_LABELS = {
    mts: "MTS baseline",
    v17state: "MTS v17.97 radial-repair state response",
    v18review: "MTS v18.01 review candidate",
    baryon: "Baryon only",
    soft: "Soft radial support",
    outer: "Outer gate support",
    residual: "Observed residual check"
  };

  var REGISTRY_KEY = "mts-galaxy-lab-formula-registry-v1";
  var CAPSULE_LIBRARY_KEY = "mts-galaxy-lab-capsule-library-v1";

  var EVOLUTION_TRACKS = {
    "late-load": {
      label: "Late-load build",
      note: "A compact, gas-fed outer disk grows memory load until the route leaves low-load space.",
      params: function (e) {
        return {
          h: mix(6.8, 2.0, e),
          rOut: mix(26, 56, e),
          diskAmp: mix(122, 172, e),
          gasAmp: mix(24, 98, e),
          bulgeAmp: mix(18, 42, e),
          fGas: mix(0.18, 0.34, e),
          q: mix(0.92, 0.54, e)
        };
      }
    },
    "gas-depletion": {
      label: "Gas depletion",
      note: "A gas-rich disk burns down its outer gas while the transport response stiffens.",
      params: function (e) {
        return {
          h: mix(2.2, 4.8, e),
          rOut: mix(42, 32, e),
          diskAmp: mix(128, 176, e),
          gasAmp: mix(132, 20, e),
          bulgeAmp: mix(18, 76, e),
          fGas: mix(0.72, 0.08, e),
          q: mix(0.62, 0.88, e)
        };
      }
    },
    compaction: {
      label: "Bulge compaction",
      note: "A diffuse disk compacts inward while bulge support rises and gas drains away.",
      params: function (e) {
        return {
          h: mix(5.6, 1.25, e),
          rOut: mix(50, 20, e),
          diskAmp: mix(152, 112, e),
          gasAmp: mix(76, 18, e),
          bulgeAmp: mix(10, 220, e),
          fGas: mix(0.42, 0.06, e),
          q: mix(0.86, 0.58, e)
        };
      }
    },
    rebuild: {
      label: "Gas rebuild",
      note: "A compact bulge-heavy system regrows an extended gas disk and relaxes back toward low-load space.",
      params: function (e) {
        return {
          h: mix(1.5, 5.8, e),
          rOut: mix(18, 48, e),
          diskAmp: mix(80, 190, e),
          gasAmp: mix(10, 116, e),
          bulgeAmp: mix(150, 28, e),
          fGas: mix(0.03, 0.58, e),
          q: mix(0.56, 0.96, e)
        };
      }
    }
  };

  var FORGE_PRESETS = {
    lsb: {
      label: "LSB disk",
      stress: "Diffuse disk",
      target: "low-acceleration outer support",
      note: "Extended low-density disk with weak bulge and broad spiral texture.",
      params: { h: 6.4, rOut: 54, diskAmp: 92, gasAmp: 64, bulgeAmp: 6, fGas: 0.48, q: 0.86 },
      jitter: { h: 0.14, rOut: 0.10, diskAmp: 0.16, gasAmp: 0.18, bulgeAmp: 0.60, fGas: 0.16, q: 0.08 },
      visual: { arms: 2, twist: 0.82, scatter: 1.05, gasChance: 0.30, radialScale: 1.42, thickness: 0.030, countScale: 0.90 }
    },
    dwarf: {
      label: "Dwarf irregular",
      stress: "Asymmetric gas",
      target: "clumpy baryon-poor support",
      note: "Small gas-heavy system with lopsided clumps and weak ordered spiral structure.",
      params: { h: 1.7, rOut: 15, diskAmp: 52, gasAmp: 92, bulgeAmp: 0, fGas: 0.76, q: 0.64 },
      jitter: { h: 0.22, rOut: 0.18, diskAmp: 0.20, gasAmp: 0.18, bulgeAmp: 1.00, fGas: 0.08, q: 0.12 },
      visual: { arms: 0, twist: 0.2, scatter: 2.1, gasChance: 0.46, radialScale: 1.12, thickness: 0.070, irregular: 1, countScale: 0.72 }
    },
    "gas-spiral": {
      label: "Gas-rich spiral",
      stress: "Gas dominated",
      target: "outer gas support",
      note: "High-gas late-type spiral with strong arms and extended transport load.",
      params: { h: 4.2, rOut: 45, diskAmp: 150, gasAmp: 124, bulgeAmp: 22, fGas: 0.62, q: 0.72 },
      jitter: { h: 0.12, rOut: 0.10, diskAmp: 0.12, gasAmp: 0.10, bulgeAmp: 0.45, fGas: 0.10, q: 0.08 },
      visual: { arms: 3, twist: 1.45, scatter: 0.52, gasChance: 0.38, radialScale: 1.05, thickness: 0.024, countScale: 1.08 }
    },
    "bulge-ltg": {
      label: "Bulge-dominated LTG",
      stress: "Central concentration",
      target: "inner/outer residual split",
      note: "Late-type disk with a heavy compact bulge and low outer gas fraction.",
      params: { h: 2.5, rOut: 30, diskAmp: 154, gasAmp: 30, bulgeAmp: 174, fGas: 0.10, q: 0.82 },
      jitter: { h: 0.14, rOut: 0.12, diskAmp: 0.12, gasAmp: 0.30, bulgeAmp: 0.16, fGas: 0.22, q: 0.08 },
      visual: { arms: 2, twist: 0.92, scatter: 0.64, gasChance: 0.12, radialScale: 0.86, thickness: 0.040, coreBias: 0.28, countScale: 1.00 }
    },
    "compact-etg": {
      label: "Compact ETG-like",
      stress: "Compact spheroid",
      target: "bulge-first transport limit",
      note: "Short-radius, bulge-heavy synthetic system that visually reads more spheroid than disk.",
      params: { h: 1.15, rOut: 15, diskAmp: 92, gasAmp: 5, bulgeAmp: 226, fGas: 0.02, q: 0.58 },
      jitter: { h: 0.12, rOut: 0.15, diskAmp: 0.16, gasAmp: 0.70, bulgeAmp: 0.10, fGas: 0.80, q: 0.10 },
      visual: { arms: 0, twist: 0.08, scatter: 1.35, gasChance: 0.04, radialScale: 0.64, thickness: 0.130, coreBias: 0.55, countScale: 0.92 }
    },
    "cdc-low": {
      label: "CDC-low analogue",
      stress: "Central deficit analogue",
      target: "observed-mode CDC comparison",
      note: "Baryon-dominated centre with weak gas load; exact CDC sign remains an observed-curve diagnostic.",
      params: { h: 3.4, rOut: 32, diskAmp: 188, gasAmp: 8, bulgeAmp: 92, fGas: 0.02, q: 1.02 },
      jitter: { h: 0.16, rOut: 0.12, diskAmp: 0.12, gasAmp: 0.60, bulgeAmp: 0.22, fGas: 0.80, q: 0.08 },
      visual: { arms: 2, twist: 0.62, scatter: 0.92, gasChance: 0.06, radialScale: 0.95, thickness: 0.050, countScale: 0.96 }
    },
    "outer-infeasible": {
      label: "Outer-infeasible stress",
      stress: "Outer gate stress",
      target: "u_out pressure test",
      note: "Compact high-gas disk with a hard outer gate, designed to force an outer viability failure.",
      params: { h: 0.95, rOut: 8, diskAmp: 74, gasAmp: 140, bulgeAmp: 12, fGas: 0.85, q: 0.62 },
      jitter: { h: 0.05, rOut: 0.00, diskAmp: 0.14, gasAmp: 0.00, bulgeAmp: 0.50, fGas: 0.00, q: 0.04 },
      visual: { arms: 1, twist: 0.40, scatter: 1.45, gasChance: 0.56, radialScale: 1.22, thickness: 0.060, ring: 0.45, countScale: 0.84 }
    },
    "late-load": {
      label: "Late-load pathological",
      stress: "Late crossing",
      target: "single-crossing edge case",
      note: "Extended gas-fed outer disk with compact memory load and a delayed route transition.",
      params: { h: 2.05, rOut: 56, diskAmp: 174, gasAmp: 98, bulgeAmp: 44, fGas: 0.34, q: 0.54 },
      jitter: { h: 0.10, rOut: 0.05, diskAmp: 0.08, gasAmp: 0.10, bulgeAmp: 0.28, fGas: 0.10, q: 0.06 },
      visual: { arms: 3, twist: 1.18, scatter: 0.76, gasChance: 0.32, radialScale: 0.96, thickness: 0.034, ring: 0.20, countScale: 1.06 }
    }
  };

  var ETG_LOCKED = {
    NGC2685: { h: 2.235, rOut: 24.98, r90: 9.030, r85: 7.096, r80: 5.682, sigma80: 0.1341, logy: 5.0086 },
    NGC2824: { h: 1.577, rOut: 7.68, r90: 7.260, r85: 5.678, r80: 4.804, sigma80: 19.464, logy: 7.7130 },
    NGC2859: { h: 1.666, rOut: 14.61, r90: 5.940, r85: 5.231, r80: 4.758, sigma80: 2.599, logy: 7.2560 },
    NGC2974: { h: 3.427, rOut: 11.79, r90: 13.066, r85: 11.383, r80: 10.080, sigma80: 28.073, logy: 7.3670 },
    NGC3522: { h: 2.503, rOut: 10.38, r90: 9.682, r85: 8.316, r80: 7.320, sigma80: 1.413, logy: 4.7000 },
    NGC3626: { h: 2.239, rOut: 13.32, r90: 9.168, r85: 7.600, r80: 6.391, sigma80: 10.923, logy: 7.2810 },
    NGC3838: { h: 1.744, rOut: 16.80, r90: 4.791, r85: 3.688, r80: 3.142, sigma80: 0.4185, logy: 5.3280 },
    NGC3941: { h: 1.312, rOut: 11.72, r90: 4.927, r85: 4.086, r80: 3.543, sigma80: 2.447, logy: 7.0810 },
    NGC3945: { h: 2.867, rOut: 14.37, r90: 13.775, r85: 12.138, r80: 10.626, sigma80: 30.944, logy: 7.5340 },
    NGC3998: { h: 1.461, rOut: 13.42, r90: 5.625, r85: 4.799, r80: 4.231, sigma80: 0.710, logy: 6.6550 },
    NGC4203: { h: 1.899, rOut: 14.46, r90: 7.148, r85: 6.223, r80: 5.606, sigma80: 2.740, logy: 6.8390 },
    NGC4262: { h: 1.249, rOut: 9.66, r90: 4.430, r85: 3.748, r80: 3.285, sigma80: 1.802, logy: 6.4840 },
    NGC4278: { h: 2.553, rOut: 11.20, r90: 9.555, r85: 8.309, r80: 7.369, sigma80: 18.007, logy: 7.2870 },
    NGC5582: { h: 3.876, rOut: 28.61, r90: 16.576, r85: 14.394, r80: 12.330, sigma80: 0.4987, logy: 5.1790 },
    NGC6798: { h: 3.317, rOut: 27.13, r90: 13.121, r85: 11.165, r80: 9.731, sigma80: 0.5183, logy: 5.5970 },
    UGC6176: { h: 1.400, rOut: 11.43, r90: 5.945, r85: null, r80: null, sigma80: 2.408, logy: 6.6920 }
  };

  var PRIORITY_L_STRICT_NAMES = [
    "F579-V1",
    "NGC1705",
    "NGC2403",
    "NGC2841",
    "NGC2998",
    "NGC3953",
    "NGC4183",
    "NGC4214",
    "NGC5371",
    "NGC5907",
    "NGC6674",
    "UGC02259",
    "UGC02885",
    "UGC03580",
    "UGC04325",
    "UGC05721",
    "UGC06786",
    "UGC08490",
    "UGC12506"
  ];
  var PRIORITY_L_CLEAN_NAMES = PRIORITY_L_STRICT_NAMES.filter(function (name) {
    return name !== "UGC03580";
  });
  var PRIORITY_L_TOP5_NAMES = ["NGC2841", "NGC6674", "UGC02885", "UGC06786", "UGC12506"];
  var SUPERCRITICAL_U075_NAMES = ["NGC3953", "UGC04325", "UGC06786"];

  var state = {
    mode: "synthetic",
    seed: 7,
    curve: null,
    observed: null,
    route: null,
    ltgIndex: [],
    ltgBrowser: {
      search: "",
      route: "all",
      sort: "rmse-desc",
      hunt: "all"
    },
    framework: {
      expression: FRAMEWORK_PRESETS.mts,
      compiled: null,
      error: null,
      current: null,
      batch: [],
      batchSummary: null
    },
    comparison: {
      expression: FRAMEWORK_PRESETS.baryon,
      compiled: null,
      error: null,
      current: null,
      preset: "baryon",
      fieldMode: "custom"
    },
    registry: {
      entries: []
    },
    researchCandidate: {
      current: null,
      loadedAt: null
    },
    benchmark: {
      pack: "all",
      rows: [],
      summary: null
    },
    claims: {
      rows: [],
      summary: null
    },
    tournament: {
      queue: "MTS baseline = gamma0 * leff * (1 - exp(-pow(r / leff, q)))\nBaryon only = 0\nSoft radial = gamma0 * leff * (1 - exp(-r / leff))\nOuter gate = gamma0 * leff * pow(max(0, x), 0.75) * (1 - exp(-memory / 2))",
      rows: [],
      summary: null
    },
    routeMap: {
      x: "xCross",
      y: "uOut"
    },
    population: {
      x: "memoryLoad",
      y: "rmse",
      subset: "browser",
      resamples: 200,
      rows: [],
      correlationRows: [],
      summary: null
    },
    importWizard: {
      lastSummary: null,
      lastNormalizedCsv: ""
    },
    capsuleLibrary: {
      entries: [],
      selectedA: "",
      selectedB: "",
      search: "",
      diffRows: [],
      diffSummary: null
    },
    sweep: {
      gammaMin: 0.7,
      gammaMax: 1.3,
      qMin: 0.55,
      qMax: 1.05,
      grid: "13x9",
      rows: [],
      summary: null
    },
    evolution: {
      track: "late-load",
      t: 0,
      playing: false,
      samples: [],
      samplesTrack: null,
      flips: 0,
      lastTick: 0,
      lastUpdate: 0,
      lastParticleRefresh: 0
    },
    forge: {
      preset: "lsb",
      seed: 1007,
      active: null
    },
    view: {
      tilt: 51,
      depth: 1,
      colorMode: "component",
      layers: {
        stars: true,
        gas: true,
        bulge: true,
        guides: true,
        core: true,
        residual: true
      }
    },
    uncertainty: {
      noisePct: 5,
      mlPct: 8,
      trials: 64,
      rows: [],
      summary: null
    },
    scienceQa: {
      provenanceRows: [],
      schemaRows: [],
      auditRows: [],
      stressRows: [],
      summary: null
    },
    particles: [],
    lastFrame: 0,
    canvasScale: 1
  };

  var controls = {};
  var viewControls = {};
  var canvas = document.getElementById("galaxyCanvas");
  var ctx = canvas.getContext("2d", { alpha: false });
  var FRAMEWORK_VARS = [
    "r",
    "x",
    "h",
    "rOut",
    "fGas",
    "fGasOut",
    "leff",
    "memory",
    "q",
    "gamma0",
    "rMax",
    "mlDisk",
    "mlBulge",
    "vGas",
    "vDisk",
    "vBulge",
    "vBar",
    "vObs",
    "uObs",
    "u0",
    "uOut",
    "uMax",
    "u075",
    "xCross",
    "lockedU0",
    "lockedUOut",
    "lockedUMax",
    "lockedU075",
    "lockedXCross",
    "hOverRout",
    "lGapOverH",
    "leffOverH",
    "innerGasShare",
    "midGasShare",
    "outerGasShare",
    "innerDiskShare",
    "midDiskShare",
    "outerDiskShare",
    "innerBulgeShare",
    "midBulgeShare",
    "outerBulgeShare",
    "barInnerOuter",
    "barMidOuter",
    "barCurv",
    "pointDensity",
    "routeLow",
    "routeCdc",
    "routeUpward",
    "routeSingle",
    "routeOuterInfeasible",
    "routeHard",
    "routeNonLow",
    "lockedRouteLow",
    "lockedRouteCdc",
    "lockedRouteUpward",
    "lockedRouteSingle",
    "lockedRouteOuterInfeasible",
    "lockedRouteHard",
    "lockedRouteNonLow",
    "outerViable",
    "outerHeadroom",
    "routeMargin",
    "routeBreakRisk",
    "pi",
    "e"
  ];
  var FRAMEWORK_FUNCS = {
    abs: Math.abs,
    sqrt: Math.sqrt,
    pow: Math.pow,
    exp: Math.exp,
    log: Math.log,
    log10: Math.log10 || function (v) { return Math.log(v) / Math.LN10; },
    min: Math.min,
    max: Math.max,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    tanh: Math.tanh || function (v) {
      var ev = Math.exp(2 * v);
      return (ev - 1) / (ev + 1);
    },
    atan: Math.atan,
    atan2: Math.atan2,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round
  };

  function $(id) {
    return document.getElementById(id);
  }

  function cacheControls() {
    [
      "h",
      "rOut",
      "diskAmp",
      "gasAmp",
      "bulgeAmp",
      "fGas",
      "q",
      "speed",
      "showMtsOnly"
    ].forEach(function (id) {
      controls[id] = $(id);
    });

    [
      "viewTilt",
      "viewDepth",
      "viewColorMode",
      "layerStars",
      "layerGas",
      "layerBulge",
      "layerGuides",
      "layerCore",
      "layerResidual"
    ].forEach(function (id) {
      viewControls[id] = $(id);
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  function fmt(value, digits) {
    if (!Number.isFinite(value)) return "--";
    return Number(value).toFixed(digits);
  }

  function seededRandom() {
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    return state.seed / 4294967296;
  }

  function randomFromSeed(seed) {
    var value = (Number(seed) || 1) >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function readParams() {
    return {
      h: Number(controls.h.value),
      rOut: Number(controls.rOut.value),
      diskAmp: Number(controls.diskAmp.value),
      gasAmp: Number(controls.gasAmp.value),
      bulgeAmp: Number(controls.bulgeAmp.value),
      fGas: Number(controls.fGas.value),
      q: Number(controls.q.value),
      speed: Number(controls.speed.value),
      showMtsOnly: controls.showMtsOnly.checked
    };
  }

  function readView() {
    if (!viewControls.viewTilt || !viewControls.viewDepth || !viewControls.viewColorMode) {
      return state.view;
    }
    var previous = state.view.layers || {};
    state.view = {
      tilt: clamp(Number(viewControls.viewTilt.value) || 51, 18, 78),
      depth: clamp(Number(viewControls.viewDepth.value) || 0, 0, 1.8),
      colorMode: viewControls.viewColorMode.value || "component",
      layers: {
        stars: viewControls.layerStars ? viewControls.layerStars.checked : previous.stars !== false,
        gas: viewControls.layerGas ? viewControls.layerGas.checked : previous.gas !== false,
        bulge: viewControls.layerBulge ? viewControls.layerBulge.checked : previous.bulge !== false,
        guides: viewControls.layerGuides ? viewControls.layerGuides.checked : previous.guides !== false,
        core: viewControls.layerCore ? viewControls.layerCore.checked : previous.core !== false,
        residual: viewControls.layerResidual ? viewControls.layerResidual.checked : previous.residual !== false
      }
    };
    return state.view;
  }

  function updateViewOutputs() {
    var view = readView();
    if ($("viewTiltOut")) $("viewTiltOut").textContent = fmt(view.tilt, 0);
    if ($("viewDepthOut")) $("viewDepthOut").textContent = fmt(view.depth, 2);
  }

  function syncViewLayerControls() {
    var layers = state.view.layers || {};
    if (viewControls.layerStars) viewControls.layerStars.checked = layers.stars !== false;
    if (viewControls.layerGas) viewControls.layerGas.checked = layers.gas !== false;
    if (viewControls.layerBulge) viewControls.layerBulge.checked = layers.bulge !== false;
    if (viewControls.layerGuides) viewControls.layerGuides.checked = layers.guides !== false;
    if (viewControls.layerCore) viewControls.layerCore.checked = layers.core !== false;
    if (viewControls.layerResidual) viewControls.layerResidual.checked = layers.residual !== false;
  }

  function readUncertaintyConfig() {
    var trials = Number($("uncertaintyTrials") ? $("uncertaintyTrials").value : state.uncertainty.trials);
    state.uncertainty.noisePct = clamp(Number($("uncertaintyNoise") ? $("uncertaintyNoise").value : state.uncertainty.noisePct) || 0, 0, 12);
    state.uncertainty.mlPct = clamp(Number($("uncertaintyMl") ? $("uncertaintyMl").value : state.uncertainty.mlPct) || 0, 0, 20);
    state.uncertainty.trials = clamp(Math.round(trials || 64), 8, 256);
    return {
      noisePct: state.uncertainty.noisePct,
      mlPct: state.uncertainty.mlPct,
      trials: state.uncertainty.trials
    };
  }

  function updateUncertaintyOutputs() {
    var config = readUncertaintyConfig();
    if ($("uncertaintyNoiseOut")) $("uncertaintyNoiseOut").textContent = fmt(config.noisePct, 1);
    if ($("uncertaintyMlOut")) $("uncertaintyMlOut").textContent = fmt(config.mlPct, 1);
  }

  function updateOutputs(p) {
    $("hOut").textContent = fmt(p.h, 1);
    $("rOutOut").textContent = fmt(p.rOut, 0);
    $("diskAmpOut").textContent = fmt(p.diskAmp, 0);
    $("gasAmpOut").textContent = fmt(p.gasAmp, 0);
    $("bulgeAmpOut").textContent = fmt(p.bulgeAmp, 0);
    $("fGasOut").textContent = fmt(p.fGas, 2);
    $("qOut").textContent = fmt(p.q, 2);
    $("speedOut").textContent = fmt(p.speed, 1);
  }

  function leffExact(h, rOut, fGasOut) {
    var sMem = (0.9 / Math.PI) * (rOut / h);
    var memoryLoad = (1 - fGasOut) * (rOut / h);
    return 1.8 * h * (1 + sMem * (1 - Math.exp(-memoryLoad / sMem)));
  }

  function leffSat(h, rOut) {
    var sMem = (0.9 / Math.PI) * (rOut / h);
    return 1.8 * h * (1 + sMem);
  }

  function lGap(h, rOut, fGasOut) {
    return leffSat(h, rOut) - leffExact(h, rOut, fGasOut);
  }

  function memoryLoad(h, rOut, fGasOut) {
    return (1 - fGasOut) * (rOut / h);
  }

  function componentVelocities(r, p) {
    var x = Math.max(0.0001, r / p.h);
    var disk = p.diskAmp * (1 - Math.exp(-x / 1.35)) / Math.sqrt(1 + x / 6.2);
    var gas = p.gasAmp * (1 - Math.exp(-x / 3.2)) * (1 + 0.07 * Math.sin(1.8 * x));
    var rb = Math.max(0.18, 0.33 * p.h);
    var bulge = p.bulgeAmp * Math.sqrt(r / (r + rb)) * Math.exp(-r / Math.max(5.5 * rb, 1));
    return {
      vDisk: Math.max(0, disk),
      vGas: Math.max(0, gas),
      vBulge: Math.max(0, bulge)
    };
  }

  function forgeDefinition(key) {
    return FORGE_PRESETS[key] || FORGE_PRESETS.lsb;
  }

  function forgeParam(base, spread, rand) {
    return base * (1 + (rand() * 2 - 1) * (spread || 0));
  }

  function forgeParams(key, seed) {
    var def = forgeDefinition(key);
    var rand = randomFromSeed(seed);
    var p = def.params;
    var j = def.jitter || {};
    return {
      h: clamp(forgeParam(p.h, j.h, rand), 0.8, 8),
      rOut: clamp(forgeParam(p.rOut, j.rOut, rand), 8, 60),
      diskAmp: clamp(forgeParam(p.diskAmp, j.diskAmp, rand), 40, 260),
      gasAmp: clamp(forgeParam(p.gasAmp, j.gasAmp, rand), 0, 140),
      bulgeAmp: clamp(forgeParam(p.bulgeAmp, j.bulgeAmp, rand), 0, 240),
      fGas: clamp(forgeParam(p.fGas, j.fGas, rand), 0, 0.85),
      q: clamp(forgeParam(p.q, j.q, rand), 0.45, 1.2)
    };
  }

  function activeForgeMeta() {
    if (!state.forge.active) return null;
    var def = forgeDefinition(state.forge.active.preset);
    return {
      preset: state.forge.active.preset,
      label: def.label,
      seed: state.forge.active.seed,
      stress: def.stress,
      target: def.target,
      note: def.note
    };
  }

  function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function rawFileChecksum(text) {
    return "raw-" + hashText(String(text || ""));
  }

  function featureChecksum(curve) {
    var points = curve.points || [];
    var samplePoints = [];
    if (points.length) {
      [0, Math.floor(points.length / 2), points.length - 1].forEach(function (index) {
        var p = points[index];
        if (!p) return;
        samplePoints.push({
          r: Number.isFinite(p.r) ? Number(p.r.toFixed(5)) : null,
          vObs: Number.isFinite(p.vObs) ? Number(p.vObs.toFixed(5)) : null,
          vTotal: Number.isFinite(p.vTotal) ? Number(p.vTotal.toFixed(5)) : null,
          u: Number.isFinite(p.u) ? Number(p.u.toFixed(7)) : null,
          errV: Number.isFinite(p.errV) ? Number(p.errV.toFixed(5)) : null
        });
      });
    }
    return "feat-" + hashText(stableStringify({
      kind: curve.kind,
      name: curve.name,
      h: curve.h,
      rOut: curve.rOut,
      fGasOut: curve.fGasOut,
      q: curve.q,
      leff: curve.leff,
      memoryLoad: curve.memoryLoad,
      rmse: curve.rmse,
      pointCount: points.length,
      stage4: curve.stage4 ? {
        r80: curve.stage4.r80,
        r85: curve.stage4.r85,
        r90: curve.stage4.r90,
        sigma80: curve.stage4.sigma80,
        logy: curve.stage4.logy
      } : null,
      samplePoints: samplePoints
    }));
  }

  function defaultScienceProvenance(sourceKind, name, rawText) {
    var sourceName = cleanGalaxyName(name || "active curve");
    var isEtg = sourceKind === "etg";
    var isSynthetic = sourceKind === "synthetic";
    var parserVersion = isSynthetic ? "synthetic-generator-v3" : (isEtg ? "atlas3d-etg-v2" : "rotmod-v4");
    return {
      repoSource: isSynthetic ? "browser/synthetic-galaxy-forge" : "local/mts-galaxy-lab-bundle",
      filePath: isSynthetic ? "generated-from-controls" : ((isEtg ? "data/etg-samples.js::" : "data/samples.js::") + sourceName),
      commitHash: "workspace-no-git",
      retrievalDate: isSynthetic ? "generated-at-runtime" : "2026-05-07",
      parserVersion: parserVersion,
      rawFileChecksum: rawFileChecksum(rawText || sourceName),
      processedFeatureChecksum: null,
      surveyRelease: isEtg ? "ATLAS3D derived local ETG bundle" : (isSynthetic ? "synthetic" : "SPARC-style ROTMOD local bundle"),
      catalogueId: sourceName,
      radiusUnit: "kpc",
      velocityUnit: "km/s",
      luminosityBand: isSynthetic ? "synthetic components" : "surface-brightness table columns",
      redshiftFrame: "not supplied",
      calibrationVersion: "not supplied",
      maskingRules: "not supplied",
      reductionPipeline: isSynthetic ? "browser generator" : "not supplied",
      covarianceMatrix: "not supplied",
      notes: isSynthetic ? "Procedural case; no observational calibration implied." : "Bundled text table parsed in-browser."
    };
  }

  function attachProcessedProvenance(curve, provenance) {
    curve.provenance = Object.assign(defaultScienceProvenance(curve.kind, curve.name, curve.raw || curve.name), provenance || {});
    curve.provenance.processedFeatureChecksum = featureChecksum(curve);
    return curve;
  }

  function buildSyntheticCurveFromParams(p) {
    var leff = leffExact(p.h, p.rOut, p.fGas);
    var mem = memoryLoad(p.h, p.rOut, p.fGas);
    var points = [];
    var count = 260;

    for (var i = 0; i < count; i += 1) {
      var t = i / (count - 1);
      var r = 0.08 + Math.pow(t, 1.25) * (p.rOut - 0.08);
      var c = componentVelocities(r, p);
      var bar2 = c.vGas * c.vGas + CONST.mlDisk * c.vDisk * c.vDisk + CONST.mlBulge * c.vBulge * c.vBulge;
      var mts2 = CONST.gamma0 * leff * (1 - Math.exp(-Math.pow(r / leff, p.q)));
      var total2 = bar2 + mts2;
      var u = (total2 - CONST.mlDisk * c.vDisk * c.vDisk - CONST.mlBulge * c.vBulge * c.vBulge) /
        (CONST.gamma0 * r * CONST.rMax);

      points.push({
        r: r,
        vDisk: c.vDisk,
        vGas: c.vGas,
        vBulge: c.vBulge,
        vBar: Math.sqrt(Math.max(0, bar2)),
        vMts: Math.sqrt(Math.max(0, mts2)),
        vTotal: Math.sqrt(Math.max(0, total2)),
        u: u
      });
    }

    var forge = activeForgeMeta();
    var curve = {
      kind: "synthetic",
      name: forge ? "Forge: " + forge.label + " #" + forge.seed : "Synthetic transport disk",
      h: p.h,
      rOut: p.rOut,
      fGasOut: p.fGas,
      q: p.q,
      leff: leff,
      memoryLoad: mem,
      rmse: null,
      forge: forge,
      points: points
    };
    return attachProcessedProvenance(curve, defaultScienceProvenance("synthetic", curve.name, stableStringify(p)));
  }

  function buildSyntheticCurve() {
    var p = readParams();
    updateOutputs(p);
    state.curve = buildSyntheticCurveFromParams(p);
    state.observed = null;
    state.route = classifyRoute(state.curve.points, state.curve);
    scoreCurrentFramework();
    scoreCurrentComparison();
    updateDiagnostics();
    if (!state.evolution.playing) runScienceQa();
    drawPlots();
  }

  function currentEvolutionTrack() {
    return EVOLUTION_TRACKS[state.evolution.track] || EVOLUTION_TRACKS["late-load"];
  }

  function evolutionPhaseName(t) {
    if (t < 0.34) return "early";
    if (t < 0.68) return "transfer";
    return "late";
  }

  function evolutionParams(trackId, t) {
    var def = EVOLUTION_TRACKS[trackId] || EVOLUTION_TRACKS["late-load"];
    return def.params(smoothStep(clamp(Number(t) || 0, 0, 1)));
  }

  function writeSyntheticControl(id, value, digits) {
    var control = controls[id];
    if (!control) return;
    var min = Number(control.min);
    var max = Number(control.max);
    var next = clamp(value, Number.isFinite(min) ? min : value, Number.isFinite(max) ? max : value);
    control.value = fmt(next, digits);
  }

  function setSyntheticControlsFromParams(p) {
    writeSyntheticControl("h", p.h, 1);
    writeSyntheticControl("rOut", p.rOut, 0);
    writeSyntheticControl("diskAmp", p.diskAmp, 0);
    writeSyntheticControl("gasAmp", p.gasAmp, 0);
    writeSyntheticControl("bulgeAmp", p.bulgeAmp, 0);
    writeSyntheticControl("fGas", p.fGas, 2);
    writeSyntheticControl("q", p.q, 2);
  }

  function syncForgeControls() {
    if (!$("forgePreset")) return;
    $("forgePreset").value = state.forge.preset;
    $("forgeSeed").value = String(state.forge.seed);
  }

  function applyForge() {
    if (state.mode !== "synthetic") setMode("synthetic");
    stopEvolution();
    state.forge.preset = $("forgePreset").value || "lsb";
    state.forge.seed = clamp(Math.round(Number($("forgeSeed").value) || 1), 1, 999999);
    state.forge.active = {
      preset: state.forge.preset,
      seed: state.forge.seed
    };
    setSyntheticControlsFromParams(forgeParams(state.forge.preset, state.forge.seed));
    state.seed = hashName(state.forge.preset + ":" + state.forge.seed);
    buildSyntheticCurve();
    generateParticles();
    updateForgePanel();
  }

  function nextForgeSeed() {
    state.forge.seed = clamp((Math.round(Number($("forgeSeed").value) || state.forge.seed) + 1), 1, 999999);
    $("forgeSeed").value = String(state.forge.seed);
    applyForge();
  }

  function clearForgeActive() {
    state.forge.active = null;
    updateForgePanel();
  }

  function updateForgePanel() {
    if (!$("forgeStatus")) return;
    var meta = activeForgeMeta();
    var route = state.route;
    if (!meta) {
      $("forgeStatus").textContent = "manual synthetic";
      $("forgeMorphology").textContent = "Manual";
      $("forgeSeedMetric").textContent = "--";
      $("forgeStress").textContent = "custom";
      $("forgeRoute").textContent = route ? route.id : "--";
      $("forgeRecipe").textContent = "Move sliders manually or forge a reproducible stress galaxy.";
      if ($("forgeNote")) $("forgeNote").textContent = "Create reproducible synthetic morphology stress tests.";
      return;
    }
    $("forgeStatus").textContent = "forged";
    $("forgeMorphology").textContent = meta.label;
    $("forgeSeedMetric").textContent = String(meta.seed);
    $("forgeStress").textContent = meta.stress;
    $("forgeRoute").textContent = route ? route.id : "--";
    $("forgeRecipe").textContent = meta.note + " Target: " + meta.target + ".";
    if ($("forgeNote")) {
      $("forgeNote").textContent = meta.label + " #" + meta.seed + ". " + meta.note + " Actual route: " + (route ? route.id : "--") + ".";
    }
  }

  function syncEvolutionControls() {
    if (!$("evolutionTime")) return;
    $("evolutionTrack").value = state.evolution.track;
    $("evolutionTime").value = fmt(state.evolution.t, 3);
    $("evolutionTimeOut").textContent = fmt(state.evolution.t, 2);
    $("playEvolution").textContent = state.evolution.playing ? "Pause" : "Play";
  }

  function countRouteFlips(samples) {
    var flips = 0;
    var last = null;
    samples.forEach(function (sample) {
      if (last && sample.route !== last) flips += 1;
      last = sample.route;
    });
    return flips;
  }

  function buildEvolutionSamples(trackId) {
    var samples = [];
    var steps = 48;
    for (var i = 0; i <= steps; i += 1) {
      var t = i / steps;
      var params = evolutionParams(trackId, t);
      var curve = buildSyntheticCurveFromParams(params);
      var route = classifyRoute(curve.points, curve);
      samples.push({
        t: t,
        route: route.id,
        u0: route.u0,
        uOut: route.uOut,
        uMax: route.uMax,
        xCrossNorm: route.xCrossNorm,
        memoryLoad: curve.memoryLoad,
        fGasOut: curve.fGasOut,
        q: curve.q
      });
    }
    return samples;
  }

  function ensureEvolutionSamples() {
    if (state.evolution.samplesTrack === state.evolution.track && state.evolution.samples.length) return;
    state.evolution.samples = buildEvolutionSamples(state.evolution.track);
    state.evolution.samplesTrack = state.evolution.track;
    state.evolution.flips = countRouteFlips(state.evolution.samples);
  }

  function applyEvolutionTime(t, options) {
    options = options || {};
    state.forge.active = null;
    state.evolution.t = clamp(Number(t) || 0, 0, 1);
    setSyntheticControlsFromParams(evolutionParams(state.evolution.track, state.evolution.t));
    buildSyntheticCurve();
    syncEvolutionControls();
    updateEvolutionPanel();
    if (options.refreshParticles) generateParticles();
  }

  function stopEvolution() {
    state.evolution.playing = false;
    state.evolution.lastTick = 0;
    state.evolution.lastUpdate = 0;
    syncEvolutionControls();
    updateEvolutionPanel();
  }

  function toggleEvolutionPlayback() {
    if (state.mode !== "synthetic") setMode("synthetic");
    state.evolution.playing = !state.evolution.playing;
    state.evolution.lastTick = 0;
    state.evolution.lastUpdate = 0;
    syncEvolutionControls();
    updateEvolutionPanel();
  }

  function resetEvolution() {
    state.evolution.playing = false;
    state.evolution.lastParticleRefresh = 0;
    applyEvolutionTime(0, { refreshParticles: true });
  }

  function advanceEvolution(timestamp) {
    if (!state.evolution.playing) return;
    if (state.mode !== "synthetic") {
      stopEvolution();
      return;
    }
    if (!state.evolution.lastTick) state.evolution.lastTick = timestamp;
    var dt = Math.max(0, timestamp - state.evolution.lastTick) / 1000;
    state.evolution.lastTick = timestamp;
    var next = state.evolution.t + dt / 15;
    if (next >= 1) {
      next = 1;
      state.evolution.playing = false;
    }
    if (timestamp - state.evolution.lastUpdate > 90 || next === 1) {
      var refresh = timestamp - state.evolution.lastParticleRefresh > 650 || next === 1;
      state.evolution.lastUpdate = timestamp;
      if (refresh) state.evolution.lastParticleRefresh = timestamp;
      applyEvolutionTime(next, { refreshParticles: refresh });
    }
  }

  function updateEvolutionPanel() {
    if (!$("evolutionStatus")) return;
    ensureEvolutionSamples();
    syncEvolutionControls();
    var def = currentEvolutionTrack();
    var route = state.route;
    var curve = state.curve;
    $("evolutionStatus").textContent = "epoch " + fmt(state.evolution.t, 2) + (state.evolution.playing ? " live" : " paused");
    $("evolutionPhase").textContent = evolutionPhaseName(state.evolution.t);
    $("evolutionGas").textContent = curve ? fmt(curve.fGasOut, 2) : "--";
    $("evolutionQMetric").textContent = curve ? fmt(curve.q, 2) : "--";
    $("evolutionFlips").textContent = state.evolution.flips;
    if ($("evolutionNote")) {
      var first = state.evolution.samples[0];
      var last = state.evolution.samples[state.evolution.samples.length - 1];
      var routeText = first && last ? " Timeline: " + first.route + " to " + last.route + "." : "";
      var currentText = route && curve ? " Now: " + route.id + ", memory " + fmt(curve.memoryLoad, 2) + "." : "";
      $("evolutionNote").textContent = def.note + routeText + currentText;
    }
    drawEvolutionPlot();
  }

  function drawEvolutionPlot() {
    var svg = $("evolutionPlot");
    if (!svg) return;
    var samples = state.evolution.samples || [];
    var width = 420;
    var height = 190;
    var plot = { left: 42, right: width - 16, top: 18, bottom: height - 38 };
    svg.innerHTML = "";
    if (!samples.length) return;

    var maxU = Math.max.apply(null, samples.map(function (sample) { return Math.max(sample.uMax, sample.uOut); }));
    var yMax = Math.max(1.2, Math.ceil(maxU * 4) / 4 + 0.2);
    var xScale = function (t) { return plot.left + t * (plot.right - plot.left); };
    var yScale = function (u) { return plot.bottom - (u / yMax) * (plot.bottom - plot.top); };

    for (var i = 0; i < samples.length - 1; i += 1) {
      var a = samples[i];
      var b = samples[i + 1];
      svg.appendChild(svgEl("rect", {
        class: "evolution-band " + routeClassName(a.route),
        x: xScale(a.t),
        y: plot.top,
        width: Math.max(1, xScale(b.t) - xScale(a.t)),
        height: plot.bottom - plot.top
      }));
    }

    for (var tick = 0; tick <= 4; tick += 1) {
      var tVal = tick / 4;
      var uVal = yMax * tick / 4;
      svg.appendChild(svgEl("line", { class: "plot-grid", x1: xScale(tVal), y1: plot.top, x2: xScale(tVal), y2: plot.bottom }));
      svg.appendChild(svgEl("line", { class: "plot-grid", x1: plot.left, y1: yScale(uVal), x2: plot.right, y2: yScale(uVal) }));
      svg.appendChild(svgEl("text", { class: "plot-label", x: xScale(tVal) - 7, y: height - 14 })).textContent = fmt(tVal, tick === 0 || tick === 4 ? 0 : 2);
      svg.appendChild(svgEl("text", { class: "plot-label", x: 5, y: yScale(uVal) + 3 })).textContent = fmt(uVal, 1);
    }

    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.bottom, x2: plot.right, y2: plot.bottom }));
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.bottom }));
    svg.appendChild(svgEl("line", { class: "threshold-line", x1: plot.left, y1: yScale(1), x2: plot.right, y2: yScale(1) }));
    svg.appendChild(svgEl("path", {
      class: "line-evolution-uout",
      d: makePath(samples, function (sample) { return xScale(sample.t); }, function (sample) { return yScale(sample.uOut); })
    }));
    svg.appendChild(svgEl("path", {
      class: "line-evolution-umax",
      d: makePath(samples, function (sample) { return xScale(sample.t); }, function (sample) { return yScale(sample.uMax); })
    }));

    var nowX = xScale(state.evolution.t);
    svg.appendChild(svgEl("line", { class: "evolution-now", x1: nowX, y1: plot.top, x2: nowX, y2: plot.bottom }));
    if (state.route) {
      svg.appendChild(svgEl("circle", {
        class: "evolution-current " + routeClassName(state.route.id),
        cx: nowX,
        cy: yScale(clamp(state.route.uMax, 0, yMax)),
        r: 4.4
      }));
    }
    svg.appendChild(svgEl("text", { class: "plot-label", x: plot.right - 58, y: 13 })).textContent = "u_max";
    svg.appendChild(svgEl("text", { class: "plot-label", x: plot.right - 58, y: 28 })).textContent = "u_out";
  }

  function buildObservedCurveFromRows(inputRows, name, rawText, provenance, options) {
    options = options || {};
    var rows = inputRows.filter(function (row) {
      return Number.isFinite(row.r) && row.r > 0 && Number.isFinite(row.vObs);
    }).map(function (row) {
      return {
        r: row.r,
        vObs: row.vObs,
        err: Number.isFinite(row.err) ? row.err : NaN,
        vGas: Number.isFinite(row.vGas) ? row.vGas : 0,
        vDisk: Number.isFinite(row.vDisk) ? row.vDisk : 0,
        vBulge: Number.isFinite(row.vBulge) ? row.vBulge : 0,
        sbDisk: Number.isFinite(row.sbDisk) ? row.sbDisk : 0,
        sbBulge: Number.isFinite(row.sbBulge) ? row.sbBulge : 0
      };
    });

    if (options.sort !== false) {
      rows.sort(function (a, b) { return a.r - b.r; });
    }

    if (rows.length < 2) {
      throw new Error("Galaxy text did not contain enough usable radius/velocity rows.");
    }

    var galaxyName = name || "Imported galaxy";
    var h = Number.isFinite(options.hOverride) && options.hOverride > 0 ? options.hOverride : fitScaleLength(rows);
    var rOut = rows[rows.length - 1].r;
    var last = rows[rows.length - 1];
    var vbarOut2 = last.vGas * last.vGas + CONST.mlDisk * last.vDisk * last.vDisk + CONST.mlBulge * last.vBulge * last.vBulge;
    var fGasOut = vbarOut2 > 0 ? clamp((last.vGas * last.vGas) / vbarOut2, 0, 1) : 0;
    var leff = leffExact(h, rOut, fGasOut);
    var mem = memoryLoad(h, rOut, fGasOut);
    var sse = 0;
    var points = rows.map(function (row) {
      var bar2 = row.vGas * row.vGas + CONST.mlDisk * row.vDisk * row.vDisk + CONST.mlBulge * row.vBulge * row.vBulge;
      var mts2 = CONST.gamma0 * leff * (1 - Math.exp(-Math.pow(row.r / leff, CONST.qDefault)));
      var model = Math.sqrt(Math.max(0, bar2 + mts2));
      var u = (row.vObs * row.vObs - CONST.mlDisk * row.vDisk * row.vDisk - CONST.mlBulge * row.vBulge * row.vBulge) /
        (CONST.gamma0 * row.r * CONST.rMax);
      var residual = model - row.vObs;
      sse += residual * residual;

      return {
        r: row.r,
        vDisk: row.vDisk,
        vGas: row.vGas,
        vBulge: row.vBulge,
        vBar: Math.sqrt(Math.max(0, bar2)),
        vMts: Math.sqrt(Math.max(0, mts2)),
        vTotal: model,
        vObs: row.vObs,
        errV: row.err,
        u: u
      };
    });

    var curve = {
      kind: "observed",
      name: cleanGalaxyName(galaxyName),
      h: h,
      rOut: rOut,
      fGasOut: fGasOut,
      q: CONST.qDefault,
      leff: leff,
      memoryLoad: mem,
      rmse: Math.sqrt(sse / rows.length),
      points: points,
      raw: rawText || ""
    };
    if (options.normalization) curve.normalization = options.normalization;
    return attachProcessedProvenance(curve, provenance || defaultScienceProvenance("rotmod", galaxyName, rawText));
  }

  function parseRotmod(text, name, provenance) {
    var rows = [];
    text.split(/\r?\n/).forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed[0] === "#" || trimmed[0] === "!") return;
      var parts = trimmed.split(/\s+/).map(Number);
      if (parts.length >= 6 && parts.every(function (v, idx) { return idx > 7 || Number.isFinite(v); })) {
        rows.push({
          r: parts[0],
          vObs: parts[1],
          err: parts[2],
          vGas: parts[3],
          vDisk: parts[4],
          vBulge: parts[5],
          sbDisk: Number.isFinite(parts[6]) ? parts[6] : 0,
          sbBulge: Number.isFinite(parts[7]) ? parts[7] : 0
        });
      }
    });

    if (rows.length < 2) {
      throw new Error("ROTMOD text did not contain enough numeric rows.");
    }

    var galaxyName = name || "Imported ROTMOD";
    return buildObservedCurveFromRows(rows, galaxyName, text, provenance || defaultScienceProvenance("rotmod", galaxyName, text), { sort: false });
  }

  function splitDataLine(line) {
    return line.indexOf(",") !== -1
      ? line.split(",").map(function (cell) { return cell.trim().replace(/^"|"$/g, ""); })
      : line.trim().split(/\s+/);
  }

  function normalColumnKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function firstFiniteFromObject(row, aliases) {
    var keyed = {};
    Object.keys(row || {}).forEach(function (key) {
      keyed[normalColumnKey(key)] = row[key];
    });
    for (var i = 0; i < aliases.length; i += 1) {
      var key = normalColumnKey(aliases[i]);
      var value = Number(keyed[key]);
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  }

  function flexibleAliases() {
    return {
      r: ["r", "rad", "radius", "radiuskpc", "rkpc", "rarcsec", "arcsec", "x"],
      vObs: ["vobs", "vrot", "velocity", "vcirc", "v", "vobserved", "vlos"],
      err: ["errv", "err", "error", "sigma", "dv", "vobserr", "velocityerror"],
      vGas: ["vgas", "gas", "vhi", "vatomic"],
      vDisk: ["vdisk", "disk", "vstar", "vstellar", "vstars"],
      vBulge: ["vbul", "vbulge", "bulge", "vspheroid"],
      sbDisk: ["sbdisk", "sigmadisk", "surfacedisk", "disklight"],
      sbBulge: ["sbbul", "sbbulge", "sigmabulge", "surfacebulge", "bulgelight"]
    };
  }

  function rowsFromDelimitedText(text) {
    var rawRows = [];
    var header = null;
    text.split(/\r?\n/).forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed[0] === "#" || trimmed[0] === "!") return;
      var cells = splitDataLine(trimmed);
      if (!header && cells.some(function (cell) { return /[A-Za-z]/.test(cell); })) {
        header = cells;
        return;
      }
      if (header) {
        var objectRow = {};
        header.forEach(function (key, index) {
          objectRow[key] = cells[index];
        });
        rawRows.push(objectRow);
      } else {
        var numeric = cells.map(Number);
        if (numeric.length >= 2 && Number.isFinite(numeric[0]) && Number.isFinite(numeric[1])) {
          rawRows.push({
            r: numeric[0],
            vObs: numeric[1],
            err: numeric[2],
            vGas: numeric[3],
            vDisk: numeric[4],
            vBulge: numeric[5],
            sbDisk: numeric[6],
            sbBulge: numeric[7]
          });
        }
      }
    });
    return rawRows;
  }

  function rowsFromFlexibleText(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) return [];
    if (trimmed[0] === "{" || trimmed[0] === "[") {
      var parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      return parsed.rows || parsed.data || parsed.points || [];
    }
    return rowsFromDelimitedText(trimmed);
  }

  function readCustomImportOptions() {
    var radiusUnit = $("customRadiusUnit") ? $("customRadiusUnit").value : "kpc";
    var velocityConvention = $("customVelocityConvention") ? $("customVelocityConvention").value : "deprojected";
    var distanceScale = $("customDistanceScale") ? Number($("customDistanceScale").value) : 1;
    var distanceMpc = $("customDistanceMpc") ? Number($("customDistanceMpc").value) : 10;
    var inclinationDeg = $("customInclinationDeg") ? Number($("customInclinationDeg").value) : 90;
    var hOverride = $("customHOverride") ? Number($("customHOverride").value) : 0;
    return {
      radiusUnit: radiusUnit,
      velocityConvention: velocityConvention,
      distanceScale: Number.isFinite(distanceScale) && distanceScale > 0 ? distanceScale : 1,
      distanceMpc: Number.isFinite(distanceMpc) && distanceMpc > 0 ? distanceMpc : 10,
      inclinationDeg: clamp(Number.isFinite(inclinationDeg) ? inclinationDeg : 90, 1, 90),
      hOverride: Number.isFinite(hOverride) && hOverride > 0 ? hOverride : null
    };
  }

  function normalizeFlexibleRows(rawRows, options) {
    var aliases = flexibleAliases();
    var radiusFactor = options.distanceScale;
    if (options.radiusUnit === "pc") radiusFactor = options.distanceScale / 1000;
    if (options.radiusUnit === "arcsec") radiusFactor = options.distanceScale * options.distanceMpc * 1000 / 206265;
    var sinI = Math.sin(options.inclinationDeg * Math.PI / 180);
    var velocityFactor = options.velocityConvention === "deprojected" ? 1 : (sinI > 0 ? 1 / sinI : 1);
    return rawRows.map(function (raw) {
      var row = Array.isArray(raw)
        ? { r: raw[0], vObs: raw[1], err: raw[2], vGas: raw[3], vDisk: raw[4], vBulge: raw[5], sbDisk: raw[6], sbBulge: raw[7] }
        : raw;
      var vObs = firstFiniteFromObject(row, aliases.vObs);
      var err = firstFiniteFromObject(row, aliases.err);
      var vGas = firstFiniteFromObject(row, aliases.vGas);
      var vDisk = firstFiniteFromObject(row, aliases.vDisk);
      var vBulge = firstFiniteFromObject(row, aliases.vBulge);
      var componentFactor = options.velocityConvention === "los-all" ? velocityFactor : 1;
      return {
        r: firstFiniteFromObject(row, aliases.r) * radiusFactor,
        vObs: vObs * velocityFactor,
        err: Number.isFinite(err) ? err * velocityFactor : NaN,
        vGas: Number.isFinite(vGas) ? vGas * componentFactor : 0,
        vDisk: Number.isFinite(vDisk) ? vDisk * componentFactor : 0,
        vBulge: Number.isFinite(vBulge) ? vBulge * componentFactor : 0,
        sbDisk: firstFiniteFromObject(row, aliases.sbDisk),
        sbBulge: firstFiniteFromObject(row, aliases.sbBulge)
      };
    });
  }

  function parseCustomGalaxyData(text, name, filePath) {
    var options = readCustomImportOptions();
    var rawRows = rowsFromFlexibleText(text);
    var rows = normalizeFlexibleRows(rawRows, options);
    var provenance = defaultScienceProvenance("rotmod", name, text);
    provenance.repoSource = "user/custom-normalized";
    provenance.filePath = filePath || "custom-import";
    provenance.retrievalDate = todayIsoDate();
    provenance.parserVersion = "custom-normalizer-v1";
    provenance.radiusUnit = "kpc";
    provenance.velocityUnit = "km/s";
    provenance.catalogueId = name;
    provenance.reductionPipeline = "MTS browser normalizer";
    provenance.notes = "Input radius unit " + options.radiusUnit + "; distance scale " + options.distanceScale + "; velocity convention " + options.velocityConvention + "; inclination " + fmt(options.inclinationDeg, 1) + " deg.";
    var curve = buildObservedCurveFromRows(rows, name, text, provenance, {
      hOverride: options.hOverride,
      normalization: {
        inputRows: rawRows.length,
        usableRows: rows.filter(function (row) { return Number.isFinite(row.r) && Number.isFinite(row.vObs); }).length,
        radiusUnit: options.radiusUnit,
        distanceScale: options.distanceScale,
        distanceMpc: options.distanceMpc,
        inclinationDeg: options.inclinationDeg,
        velocityConvention: options.velocityConvention,
        hOverride: options.hOverride
      }
    });
    state.importWizard.lastSummary = curve.normalization;
    state.importWizard.lastNormalizedCsv = normalizedCurveCsv(curve);
    return curve;
  }

  function normalizedCurveCsv(curve) {
    var headers = ["galaxy", "point_index", "r_kpc", "v_obs_kms", "err_v_kms", "v_gas_kms", "v_disk_kms", "v_bulge_kms", "v_bar_kms", "u"];
    return rowsToCsv(headers, (curve.points || []).map(function (p, index) {
      return {
        galaxy: curve.name,
        point_index: index,
        r_kpc: p.r,
        v_obs_kms: p.vObs,
        err_v_kms: p.errV,
        v_gas_kms: p.vGas,
        v_disk_kms: p.vDisk,
        v_bulge_kms: p.vBulge,
        v_bar_kms: p.vBar,
        u: p.u
      };
    }));
  }

  function cleanGalaxyName(name) {
    return String(name || "Imported ROTMOD")
      .replace(/^.*[\\/]/, "")
      .replace(/_rotmod\.dat$/i, "");
  }

  function analyzeLtgSample(sample, index) {
    try {
      var curve = parseRotmod(sample.text, sample.name);
      var route = classifyRoute(curve.points, curve);
      return {
        index: index,
        name: curve.name,
        route: route.id,
        rmse: curve.rmse,
        h: curve.h,
        rOut: curve.rOut,
        fGasOut: curve.fGasOut,
        leff: curve.leff,
        leffOverH: curve.h ? curve.leff / curve.h : null,
        memoryLoad: curve.memoryLoad,
        hOverRout: route.hOverRout,
        u0: route.u0,
        uOut: route.uOut,
        uMax: route.uMax,
        xCross: route.xCrossNorm,
        u075: route.u075,
        lGap: route.lGap,
        gScalar: route.gScalar,
        hGuard: route.hGuard,
        priorityL: route.priorityL,
        priorityL3: route.priorityL3,
        lateLoad: route.lateLoad,
        ltgCurvatureA: route.ltgCurvatureA,
        ltgCurvatureLegacyA: route.ltgCurvatureLegacyA,
        supercriticalU075: route.supercriticalU075,
        sLawS: route.innerLaw ? route.innerLaw.s : null,
        sLawPredictedUmax: route.innerLaw ? route.innerLaw.predictedUmax : null,
        sLawResidual: route.innerLaw ? route.innerLaw.residual : null,
        cdc: route.cdc,
        outerViable: route.outerViable
      };
    } catch (error) {
      return {
        index: index,
        name: cleanGalaxyName(sample.name),
        route: "parse-error",
        rmse: NaN,
        error: error.message
      };
    }
  }

  function fitScaleLength(rows) {
    var xs = [];
    var ys = [];
    rows.forEach(function (row) {
      if (row.sbDisk > 0 && row.r > 0) {
        xs.push(row.r);
        ys.push(Math.log(row.sbDisk));
      }
    });

    if (xs.length < 3) {
      return Math.max(0.8, rows[rows.length - 1].r / 3.9);
    }

    var n = xs.length;
    var sx = 0;
    var sy = 0;
    var sxx = 0;
    var sxy = 0;
    for (var i = 0; i < n; i += 1) {
      sx += xs[i];
      sy += ys[i];
      sxx += xs[i] * xs[i];
      sxy += xs[i] * ys[i];
    }

    var denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return Math.max(0.8, rows[rows.length - 1].r / 3.9);
    var slope = (n * sxy - sx * sy) / denom;
    if (slope >= 0) return Math.max(0.8, rows[rows.length - 1].r / 3.9);
    return clamp(-1 / slope, 0.25, rows[rows.length - 1].r * 2);
  }

  function parseComponentTable(text) {
    var rows = [];
    text.split(/\r?\n/).forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed[0] === "!" || trimmed[0] === "#") return;
      var parts = trimmed.split(/\s+/).map(Number);
      if (parts.length >= 3 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && Number.isFinite(parts[2])) {
        rows.push({ r: parts[0], sigma: parts[1], v: parts[2] });
      }
    });
    return rows;
  }

  function interpRows(rows, r, key) {
    if (!rows.length) return 0;
    if (r <= rows[0].r) return rows[0][key];
    if (r >= rows[rows.length - 1].r) return rows[rows.length - 1][key];
    for (var i = 1; i < rows.length; i += 1) {
      if (rows[i].r >= r) {
        var a = rows[i - 1];
        var b = rows[i];
        var t = (r - a.r) / (b.r - a.r);
        return a[key] * (1 - t) + b[key] * t;
      }
    }
    return rows[rows.length - 1][key];
  }

  function fitComponentScaleLength(rows) {
    var xs = [];
    var ys = [];
    rows.forEach(function (row) {
      if (row.sigma > 0 && row.r > 0) {
        xs.push(row.r);
        ys.push(Math.log(row.sigma));
      }
    });
    if (xs.length < 3) return null;

    var n = xs.length;
    var sx = 0;
    var sy = 0;
    var sxx = 0;
    var sxy = 0;
    for (var i = 0; i < n; i += 1) {
      sx += xs[i];
      sy += ys[i];
      sxx += xs[i] * xs[i];
      sxy += xs[i] * ys[i];
    }
    var denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return null;
    var slope = (n * sxy - sx * sy) / denom;
    return slope < 0 ? -1 / slope : null;
  }

  function enclosedRadius(rows, frac) {
    var mass = [];
    var cumul = [];
    var total = 0;
    for (var i = 0; i < rows.length; i += 1) {
      var dr;
      if (i === 0) {
        dr = rows[1].r - rows[0].r;
      } else if (i === rows.length - 1) {
        dr = rows[i].r - rows[i - 1].r;
      } else {
        dr = (rows[i + 1].r - rows[i - 1].r) / 2;
      }
      mass[i] = Math.max(0, rows[i].sigma) * rows[i].r * dr;
      total += mass[i];
      cumul[i] = total;
    }

    var target = total * frac;
    for (var j = 0; j < cumul.length; j += 1) {
      if (cumul[j] >= target) {
        return rows[j].r;
      }
    }
    return rows[rows.length - 1].r;
  }

  function sigmaMeanWindow(rows, rOut, fracLo) {
    var total = 0;
    var n = 1000;
    for (var i = 0; i < n; i += 1) {
      var t = i / (n - 1);
      var r = fracLo * rOut * (1 - t) + rOut * t;
      total += interpRows(rows, r, "sigma");
    }
    return total / n;
  }

  function parseEtgSample(sample) {
    var etgRaw = [sample.rotmod, sample.disk, sample.bulge].join("\n# component-break\n");
    var etgProvenance = defaultScienceProvenance("etg", sample.name, etgRaw);
    etgProvenance.filePath = "data/etg-samples.js::" + sample.name;
    etgProvenance.rawFileChecksum = rawFileChecksum(etgRaw);
    var rot = parseRotmod(sample.rotmod, sample.name + "_rotmod.dat", etgProvenance);
    var disk = parseComponentTable(sample.disk);
    var bulge = parseComponentTable(sample.bulge);
    var locked = ETG_LOCKED[sample.name] || {};
    var h = locked.h || fitComponentScaleLength(disk) || rot.h;
    var rOut = rot.rOut;
    var count = 220;
    var points = [];
    var vdiskOut = interpRows(disk, rOut, "v");
    var sigma80 = locked.sigma80 || sigmaMeanWindow(disk, rOut, 0.8);
    var r80 = locked.r80 || enclosedRadius(disk, 0.8);
    var r85 = locked.r85 == null ? enclosedRadius(disk, 0.85) : locked.r85;
    var r90 = locked.r90 || enclosedRadius(disk, 0.9);
    var logy = locked.logy || Math.log((vdiskOut * vdiskOut) / rOut);
    var stageR80 = 4.313 + 0.808 * Math.log(sigma80) + 1.732 * Math.log(rOut / r80);
    var stageR90 = 4.7556 + 0.8348 * Math.log(sigma80) + 1.7153 * Math.log(rOut / r90);

    for (var i = 0; i < count; i += 1) {
      var t = i / (count - 1);
      var r = rot.points[0].r + Math.pow(t, 1.1) * (rOut - rot.points[0].r);
      var vObs = interpRows(rot.points.map(function (p) { return { r: p.r, v: p.vObs }; }), r, "v");
      var errV = interpRows(rot.points.map(function (p) { return { r: p.r, errV: p.errV }; }), r, "errV");
      var vDisk = interpRows(disk, r, "v");
      var vBulge = interpRows(bulge, r, "v");
      var bar2 = CONST.mlDisk * vDisk * vDisk + CONST.mlBulge * vBulge * vBulge;
      var support2 = Math.max(0, vObs * vObs - bar2);
      var u = (vObs * vObs - CONST.mlDisk * vDisk * vDisk - CONST.mlBulge * vBulge * vBulge) /
        (CONST.gamma0 * r * CONST.rMax);
      points.push({
        r: r,
        vDisk: vDisk,
        vGas: 0,
        vBulge: vBulge,
        vBar: Math.sqrt(Math.max(0, bar2)),
        vMts: Math.sqrt(support2),
        vTotal: vObs,
        vObs: vObs,
        errV: errV,
        u: u
      });
    }

    rot.points.forEach(function (p) {
      p.sourcePoint = true;
    });

    var curve = {
      kind: "etg",
      name: sample.name,
      h: h,
      rOut: rOut,
      fGasOut: 0,
      q: CONST.qDefault,
      leff: null,
      memoryLoad: null,
      rmse: null,
      points: points,
      observedPoints: rot.points,
      stage4: {
        r80: r80,
        r85: r85,
        r90: r90,
        sigma80: sigma80,
        logy: logy,
        stageR80: stageR80,
        stageR90: stageR90,
        residualR80: logy - stageR80,
        residualR90: logy - stageR90,
        rOutOverR80: r80 ? rOut / r80 : null,
        rOutOverR85: r85 ? rOut / r85 : null,
        rOutOverR90: r90 ? rOut / r90 : null,
        r85Preference: "R85 beats R80 in all five v18 guard samples; HL11 minus NGC3998 R85 LOO=0.156",
        vdiskOut: vdiskOut
      },
      raw: sample.rotmod
    };
    return attachProcessedProvenance(curve, etgProvenance);
  }

  function valueAtRadius(points, r, key) {
    if (!points.length) return NaN;
    if (r <= points[0].r) return points[0][key];
    if (r >= points[points.length - 1].r) return points[points.length - 1][key];
    for (var i = 1; i < points.length; i += 1) {
      if (points[i].r >= r) {
        var a = points[i - 1];
        var b = points[i];
        var t = (r - a.r) / (b.r - a.r);
        return a[key] * (1 - t) + b[key] * t;
      }
    }
    return points[points.length - 1][key];
  }

  function valueAtRadiusComputed(points, r, fn) {
    if (!points.length) return NaN;
    if (r <= points[0].r) return fn(points[0]);
    if (r >= points[points.length - 1].r) return fn(points[points.length - 1]);
    for (var i = 1; i < points.length; i += 1) {
      if (points[i].r >= r) {
        var a = points[i - 1];
        var b = points[i];
        var t = (r - a.r) / (b.r - a.r);
        return fn(a) * (1 - t) + fn(b) * t;
      }
    }
    return fn(points[points.length - 1]);
  }

  function pointBar2(point) {
    return point.vGas * point.vGas + CONST.mlDisk * point.vDisk * point.vDisk + CONST.mlBulge * point.vBulge * point.vBulge;
  }

  function computeInnerLaw(curve, uMax) {
    if (!curve || !curve.points || !curve.points.length || !Number.isFinite(curve.h)) return null;
    var firstR = curve.points[0].r;
    var h = curve.h;
    if (h < firstR) return null;
    var vRef = valueAtRadiusComputed(curve.points, h, pointBar2);
    if (!Number.isFinite(vRef) || vRef <= 0) return null;
    var q12 = valueAtRadiusComputed(curve.points, 0.5 * h, pointBar2) / vRef;
    var q14 = valueAtRadiusComputed(curve.points, 0.25 * h, pointBar2) / vRef;
    var delta = 1 - q12;
    if (!Number.isFinite(delta) || delta <= 0) return null;
    var s = q14 / delta;
    if (!Number.isFinite(s) || s <= 0) return null;
    var pred = curve.kind === "etg"
      ? 0.2325 - 0.0578 * Math.log(s)
      : 0.2391 - 0.0697 * Math.log(s);
    return {
      q12: q12,
      q14: q14,
      delta: delta,
      s: s,
      vRef: vRef,
      predictedUmax: pred,
      residual: Number.isFinite(uMax) ? uMax - pred : null,
      law: curve.kind === "etg" ? "ETG S-law" : "LTG strict S-law",
      hGuard: true
    };
  }

  function classifyRoute(points, curve) {
    var u0 = points[0].u;
    var uOut = points[points.length - 1].u;
    var uMax = -Infinity;
    var down = 0;
    var up = 0;
    var xCross = null;

    for (var i = 0; i < points.length; i += 1) {
      uMax = Math.max(uMax, points[i].u);
      if (i > 0) {
        var prev = points[i - 1].u;
        var curr = points[i].u;
        if (prev > 1 && curr <= 1) {
          down += 1;
          var span = prev - curr;
          var t = span !== 0 ? (prev - 1) / span : 0;
          xCross = points[i - 1].r * (1 - t) + points[i].r * t;
        }
        if (prev < 1 && curr >= 1) up += 1;
      }
    }

    var id = "low-load";
    if (u0 < 0 && uOut < 1 && uMax < 1) {
      id = "CDC-low-load";
    } else if (uOut >= 1) {
      id = "outer-infeasible";
    } else if (up > 0) {
      id = "buffered upward-crossing";
    } else if (down > 0) {
      id = "buffered single-crossing";
    }

    var rOut = curve ? curve.rOut : points[points.length - 1].r;
    var h = curve ? curve.h : null;
    var xCrossNorm = xCross == null ? null : xCross / rOut;
    var u075 = valueAtRadius(points, 0.75 * rOut, "u");
    var hOverRout = h ? h / rOut : null;
    var hGuard = h != null ? h >= points[0].r : false;
    var gap = curve && curve.kind !== "etg" ? lGap(curve.h, curve.rOut, curve.fGasOut) : null;
    var mem = curve && curve.memoryLoad != null ? curve.memoryLoad : null;
    var gScalar = mem != null && xCrossNorm != null ? mem * xCrossNorm : null;
    var priorityL = gScalar != null && gap != null ? -10.315 + 8.645 * gScalar + 10.508 * gap : null;
    var priorityL3 = gScalar != null && gap != null && Number.isFinite(u075) ? -28.012 + 6.609 * gScalar + 11.214 * gap + 28.625 * u075 : null;
    var lateLoad = hOverRout != null ? (id === "buffered single-crossing" && hGuard && uOut > 0.64 && hOverRout > 0.095) : false;
    var etgDeltaU = 1 - uOut;
    var c1 = xCrossNorm != null && (1 - xCrossNorm) !== 0 ? -etgDeltaU / (1 - xCrossNorm) : null;
    var innerLaw = curve ? computeInnerLaw(curve, uMax) : null;
    var ltgCurvatureA = Number.isFinite(u075) && u075 > 0 ? -2.671 + 2.735 / Math.sqrt(u075) : null;

    return {
      id: id,
      u0: u0,
      uOut: uOut,
      uMax: uMax,
      downCrossings: down,
      upCrossings: up,
      outerViable: uOut < 1,
      cdc: u0 < 0,
      xCross: xCross,
      xCrossNorm: xCrossNorm,
      u075: u075,
      hOverRout: hOverRout,
      hGuard: hGuard,
      lGap: gap,
      gScalar: gScalar,
      priorityL: priorityL,
      priorityL3: priorityL3,
      lateLoad: lateLoad,
      c1: c1,
      etgCurvatureA: xCrossNorm != null ? -0.015 + 1.029 * (1 - xCrossNorm) : null,
      ltgCurvatureA: ltgCurvatureA,
      ltgCurvatureLegacyA: 2.210 - 2.028 * u075,
      supercriticalU075: Number.isFinite(u075) ? u075 > 1 : false,
      innerLaw: innerLaw
    };
  }

  function routeSafetyFromState(route) {
    var uOut = Number.isFinite(route.uOut) ? route.uOut : 0;
    var uMax = Number.isFinite(route.uMax) ? route.uMax : 0;
    var outerHeadroom = Math.max(0, 1 - uOut);
    var peakHeadroom = Math.max(0, 1 - uMax);
    var routeMargin;
    var routeBreakRisk;
    if (route.id === "outer-infeasible") {
      routeMargin = 1 + Math.max(0, uOut - 1);
      routeBreakRisk = 0;
    } else if (route.id === "buffered single-crossing" || route.id === "buffered upward-crossing") {
      routeMargin = outerHeadroom;
      routeBreakRisk = 1 / (1 + routeMargin / 0.12);
    } else {
      routeMargin = Math.min(outerHeadroom, peakHeadroom);
      routeBreakRisk = 1 / (1 + routeMargin / 0.12);
    }
    return {
      outerHeadroom: outerHeadroom,
      routeMargin: routeMargin,
      routeBreakRisk: routeBreakRisk
    };
  }

  function lockedModelRouteState(curve) {
    if (curve._frameworkLockedRouteState) return curve._frameworkLockedRouteState;
    var leff = Number.isFinite(curve.leff) ? curve.leff : curve.rOut;
    var q = Number.isFinite(curve.q) ? curve.q : CONST.qDefault;
    var points = curve.points.map(function (point) {
      var support2 = CONST.gamma0 * leff * (1 - Math.exp(-Math.pow(point.r / leff, q)));
      var model2 = pointBar2(point) + support2;
      var u = (model2 - CONST.mlDisk * point.vDisk * point.vDisk - CONST.mlBulge * point.vBulge * point.vBulge) /
        (CONST.gamma0 * point.r * CONST.rMax);
      return Object.assign({}, point, { u: u });
    });
    curve._frameworkLockedRouteState = classifyRoute(points, curve);
    return curve._frameworkLockedRouteState;
  }

  function compileFrameworkExpression(expression) {
    var source = String(expression || "").trim();
    if (!source) throw new Error("Framework formula is empty.");
    if (source === V18REVIEW_TOKEN || source === V17STATE_EXACT_TOKEN || V17STATE_LEGACY_TOKENS[source]) {
      return {
        source: source,
        kind: "v17state-exact-cache",
        reviewGate: source === V18REVIEW_TOKEN,
        fn: null
      };
    }
    if (source.length > 65000) throw new Error("Formula is too long for the browser test rig.");
    if (!/^[A-Za-z0-9_+\-*/%().,\s?:<>=!&|]+$/.test(source)) {
      throw new Error("Formula can only use numbers, variables, math/logical operators, parentheses, commas, and decimals.");
    }

    var allowed = {};
    FRAMEWORK_VARS.forEach(function (name) {
      allowed[name] = true;
    });
    Object.keys(FRAMEWORK_FUNCS).forEach(function (name) {
      allowed[name] = true;
    });

    var names = source.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    for (var i = 0; i < names.length; i += 1) {
      if (!allowed[names[i]]) {
        throw new Error("Unknown formula token: " + names[i]);
      }
    }

    var varLines = FRAMEWORK_VARS.map(function (name) {
      return "var " + name + " = vars." + name + ";";
    }).join("");
    var fnLines = Object.keys(FRAMEWORK_FUNCS).map(function (name) {
      return "var " + name + " = fns." + name + ";";
    }).join("");
    return {
      source: source,
      fn: new Function("vars", "fns", '"use strict";' + varLines + fnLines + "return (" + source + ");")
    };
  }

  function canonicalMtsSupport2(curve, point) {
    var leff = Number.isFinite(curve.leff) ? curve.leff : curve.rOut;
    var q = Number.isFinite(curve.q) ? curve.q : CONST.qDefault;
    return CONST.gamma0 * leff * (1 - Math.exp(-Math.pow(point.r / leff, q)));
  }

  function v17ExactCacheEntry(curve, compiled) {
    if (!curve || !curve.name) return null;
    if (compiled && compiled.reviewGate) {
      var v18 = window.MTS_V18_01_REVIEW_CANDIDATE;
      if (v18 && v18.curves && v18.curves[curve.name]) return v18.curves[curve.name];
    }
    var cache = window.MTS_V17_97_SUPPORT_CACHE || window.MTS_V17_96_SUPPORT_CACHE || window.MTS_V17_95_SUPPORT_CACHE || window.MTS_V17_94_SUPPORT_CACHE || window.MTS_V17_93_SUPPORT_CACHE || window.MTS_V17_92_SUPPORT_CACHE || window.MTS_V17_91_SUPPORT_CACHE || window.MTS_V17_90_SUPPORT_CACHE || window.MTS_V17_89_SUPPORT_CACHE || window.MTS_V17_88_SUPPORT_CACHE || window.MTS_V17_87_SUPPORT_CACHE || window.MTS_V17_86_SUPPORT_CACHE || window.MTS_V17_85_SUPPORT_CACHE;
    if (!cache || !cache.curves) return null;
    return cache.curves[curve.name] || null;
  }

  function exactCacheDisplayName(compiled) {
    return compiled && compiled.reviewGate ? "v18.01 review candidate" : "v17.97 exact cache";
  }

  function isV18ReviewActive() {
    return !!(state.framework.compiled && state.framework.compiled.source === V18REVIEW_TOKEN);
  }

  function frameworkProfileBand(curve, xMin, xMax) {
    var out = {
      gas: [],
      disk: [],
      bulge: [],
      bar: []
    };
    if (!curve || !curve.points) return out;
    curve.points.forEach(function (p) {
      var xVal = Number.isFinite(p.x) ? p.x : p.r / Math.max(0.0001, curve.rOut || 1);
      if (xVal < xMin || xVal > xMax) return;
      var gas = Math.pow(p.vGas || 0, 2);
      var disk = CONST.mlDisk * Math.pow(p.vDisk || 0, 2);
      var bulge = CONST.mlBulge * Math.pow(p.vBulge || 0, 2);
      var total = gas + disk + bulge;
      if (total <= 0) return;
      out.gas.push(gas / total);
      out.disk.push(disk / total);
      out.bulge.push(bulge / total);
      out.bar.push(Math.sqrt(total));
    });
    return out;
  }

  function meanList(values) {
    if (!values || !values.length) return 0;
    return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
  }

  function frameworkProfileState(curve) {
    if (curve._frameworkProfileState) return curve._frameworkProfileState;
    var inner = frameworkProfileBand(curve, 0, 0.33);
    var mid = frameworkProfileBand(curve, 0.33, 0.66);
    var outer = frameworkProfileBand(curve, 0.66, 1.01);
    var innerBar = meanList(inner.bar);
    var midBar = meanList(mid.bar);
    var outerBar = meanList(outer.bar) || 1;
    curve._frameworkProfileState = {
      innerGasShare: meanList(inner.gas),
      midGasShare: meanList(mid.gas),
      outerGasShare: meanList(outer.gas),
      innerDiskShare: meanList(inner.disk),
      midDiskShare: meanList(mid.disk),
      outerDiskShare: meanList(outer.disk),
      innerBulgeShare: meanList(inner.bulge),
      midBulgeShare: meanList(mid.bulge),
      outerBulgeShare: meanList(outer.bulge),
      barInnerOuter: innerBar / outerBar,
      barMidOuter: midBar / outerBar,
      barCurv: innerBar - 2 * midBar + outerBar,
      pointDensity: curve.points && curve.rOut ? curve.points.length / Math.max(0.0001, curve.rOut) : 0
    };
    return curve._frameworkProfileState;
  }

  function frameworkVariables(curve, point) {
    var leff = Number.isFinite(curve.leff) ? curve.leff : curve.rOut;
    var h = Number.isFinite(curve.h) ? curve.h : Math.max(0.1, curve.rOut / 3.9);
    var memory = Number.isFinite(curve.memoryLoad) ? curve.memoryLoad : curve.rOut / h;
    var sMem = h ? (0.9 / Math.PI) * (curve.rOut / h) : 0;
    var lSat = h ? 1.8 * h * (1 + sMem) : leff;
    var lGapOverH = h ? (lSat - leff) / h : 0;
    var profile = frameworkProfileState(curve);
    var vObs = Number.isFinite(point.vObs) ? point.vObs : point.vTotal;
    var route = curve._frameworkRouteState;
    if (!route) {
      route = classifyRoute(curve.points, curve);
      curve._frameworkRouteState = route;
    }
    var routeId = route.id || "";
    var lockedRoute = lockedModelRouteState(curve);
    var lockedRouteId = lockedRoute.id || "";
    var safety = routeSafetyFromState(lockedRoute);
    return {
      r: point.r,
      x: point.r / curve.rOut,
      h: h,
      rOut: curve.rOut,
      fGas: Number.isFinite(curve.fGasOut) ? curve.fGasOut : 0,
      fGasOut: Number.isFinite(curve.fGasOut) ? curve.fGasOut : 0,
      leff: leff,
      memory: memory,
      q: Number.isFinite(curve.q) ? curve.q : CONST.qDefault,
      gamma0: CONST.gamma0,
      rMax: CONST.rMax,
      mlDisk: CONST.mlDisk,
      mlBulge: CONST.mlBulge,
      vGas: point.vGas || 0,
      vDisk: point.vDisk || 0,
      vBulge: point.vBulge || 0,
      vBar: point.vBar || 0,
      vObs: vObs,
      uObs: point.u,
      u0: Number.isFinite(route.u0) ? route.u0 : 0,
      uOut: Number.isFinite(route.uOut) ? route.uOut : 0,
      uMax: Number.isFinite(route.uMax) ? route.uMax : 0,
      u075: Number.isFinite(route.u075) ? route.u075 : 0,
      xCross: Number.isFinite(route.xCrossNorm) ? route.xCrossNorm : 0,
      lockedU0: Number.isFinite(lockedRoute.u0) ? lockedRoute.u0 : 0,
      lockedUOut: Number.isFinite(lockedRoute.uOut) ? lockedRoute.uOut : 0,
      lockedUMax: Number.isFinite(lockedRoute.uMax) ? lockedRoute.uMax : 0,
      lockedU075: Number.isFinite(lockedRoute.u075) ? lockedRoute.u075 : 0,
      lockedXCross: Number.isFinite(lockedRoute.xCrossNorm) ? lockedRoute.xCrossNorm : 0,
      hOverRout: Number.isFinite(route.hOverRout) ? route.hOverRout : 0,
      lGapOverH: Number.isFinite(lGapOverH) ? lGapOverH : 0,
      leffOverH: h ? leff / h : 0,
      innerGasShare: profile.innerGasShare,
      midGasShare: profile.midGasShare,
      outerGasShare: profile.outerGasShare,
      innerDiskShare: profile.innerDiskShare,
      midDiskShare: profile.midDiskShare,
      outerDiskShare: profile.outerDiskShare,
      innerBulgeShare: profile.innerBulgeShare,
      midBulgeShare: profile.midBulgeShare,
      outerBulgeShare: profile.outerBulgeShare,
      barInnerOuter: profile.barInnerOuter,
      barMidOuter: profile.barMidOuter,
      barCurv: profile.barCurv,
      pointDensity: profile.pointDensity,
      routeLow: routeId === "low-load" ? 1 : 0,
      routeCdc: routeId === "CDC-low-load" ? 1 : 0,
      routeUpward: routeId === "buffered upward-crossing" ? 1 : 0,
      routeSingle: routeId === "buffered single-crossing" ? 1 : 0,
      routeOuterInfeasible: routeId === "outer-infeasible" ? 1 : 0,
      routeHard: routeId === "buffered single-crossing" || routeId === "outer-infeasible" ? 1 : 0,
      routeNonLow: routeId === "low-load" || routeId === "CDC-low-load" ? 0 : 1,
      lockedRouteLow: lockedRouteId === "low-load" ? 1 : 0,
      lockedRouteCdc: lockedRouteId === "CDC-low-load" ? 1 : 0,
      lockedRouteUpward: lockedRouteId === "buffered upward-crossing" ? 1 : 0,
      lockedRouteSingle: lockedRouteId === "buffered single-crossing" ? 1 : 0,
      lockedRouteOuterInfeasible: lockedRouteId === "outer-infeasible" ? 1 : 0,
      lockedRouteHard: lockedRouteId === "buffered single-crossing" || lockedRouteId === "outer-infeasible" ? 1 : 0,
      lockedRouteNonLow: lockedRouteId === "low-load" || lockedRouteId === "CDC-low-load" ? 0 : 1,
      outerViable: route.outerViable ? 1 : 0,
      outerHeadroom: safety.outerHeadroom,
      routeMargin: safety.routeMargin,
      routeBreakRisk: safety.routeBreakRisk,
      pi: Math.PI,
      e: Math.E
    };
  }

  function scoreFrameworkCurve(curve, compiled) {
    var sse = 0;
    var baselineSse = 0;
    var count = 0;
    var invalid = 0;
    var exactCacheHits = 0;
    var exactCacheFallbacks = 0;
    var exactCacheEntry = compiled && compiled.kind === "v17state-exact-cache" ? v17ExactCacheEntry(curve, compiled) : null;
    var scoredPoints = [];
    var customPoints = [];
    var bands = {
      inner: { sse: 0, count: 0 },
      mid: { sse: 0, count: 0 },
      outer: { sse: 0, count: 0, signed: 0 }
    };
    var worstResidual = 0;
    var worstR = 0;

    curve.points.forEach(function (point, pointIndex) {
      var target = Number.isFinite(point.vObs) ? point.vObs : point.vTotal;
      var support2;
      try {
        if (compiled.kind === "v17state-exact-cache") {
          if (
            exactCacheEntry &&
            Array.isArray(exactCacheEntry.support2) &&
            exactCacheEntry.support2.length === curve.points.length &&
            Number.isFinite(exactCacheEntry.support2[pointIndex])
          ) {
            support2 = exactCacheEntry.support2[pointIndex];
            exactCacheHits += 1;
          } else {
            support2 = canonicalMtsSupport2(curve, point);
            exactCacheFallbacks += 1;
          }
        } else {
          support2 = compiled.fn(frameworkVariables(curve, point), FRAMEWORK_FUNCS);
        }
      } catch (error) {
        invalid += 1;
        support2 = 0;
      }

      if (!Number.isFinite(support2)) {
        invalid += 1;
        support2 = 0;
      }

      support2 = Math.max(0, support2);
      var custom = Math.sqrt(Math.max(0, point.vBar * point.vBar + support2));
      var residual = custom - target;
      var baselineResidual = point.vTotal - target;
      var xNorm = curve.rOut ? point.r / curve.rOut : 0;
      var band = xNorm < 0.33 ? bands.inner : (xNorm < 0.66 ? bands.mid : bands.outer);
      sse += residual * residual;
      baselineSse += baselineResidual * baselineResidual;
      band.sse += residual * residual;
      band.count += 1;
      if (band === bands.outer) bands.outer.signed += residual;
      if (Math.abs(residual) > Math.abs(worstResidual)) {
        worstResidual = residual;
        worstR = point.r;
      }
      count += 1;
      scoredPoints.push({
        r: point.r,
        vCustom: custom,
        residual: residual,
        support2: support2
      });
      customPoints.push({
        r: point.r,
        vDisk: point.vDisk,
        vGas: point.vGas,
        vBulge: point.vBulge,
        vBar: point.vBar,
        vMts: Math.sqrt(support2),
        vTotal: custom,
        vObs: target,
        u: (custom * custom - CONST.mlDisk * point.vDisk * point.vDisk - CONST.mlBulge * point.vBulge * point.vBulge) /
          (CONST.gamma0 * point.r * CONST.rMax)
      });
    });

    var customRmse = count ? Math.sqrt(sse / count) : NaN;
    var baselineRmse = Number.isFinite(curve.rmse) ? curve.rmse : (count ? Math.sqrt(baselineSse / count) : NaN);
    var baselineRoute = classifyRoute(curve.points, curve);
    var customRoute = classifyRoute(customPoints, curve);
    var bandRmse = {
      inner: bands.inner.count ? Math.sqrt(bands.inner.sse / bands.inner.count) : NaN,
      mid: bands.mid.count ? Math.sqrt(bands.mid.sse / bands.mid.count) : NaN,
      outer: bands.outer.count ? Math.sqrt(bands.outer.sse / bands.outer.count) : NaN
    };
    var dominantBand = "inner";
    if (bandRmse.mid > bandRmse[dominantBand]) dominantBand = "mid";
    if (bandRmse.outer > bandRmse[dominantBand]) dominantBand = "outer";
    return {
      curveName: curve.name,
      curveKind: curve.kind,
      expression: compiled.source,
      rmse: customRmse,
      baselineRmse: baselineRmse,
      delta: customRmse - baselineRmse,
      invalidCount: invalid,
      exactCacheHits: exactCacheHits,
      exactCacheFallbacks: exactCacheFallbacks,
      routeId: customRoute.id,
      baselineRouteId: baselineRoute.id,
      routePreserved: customRoute.id === baselineRoute.id,
      xCross: customRoute.xCrossNorm,
      baselineXCross: baselineRoute.xCrossNorm,
      xCrossError: customRoute.xCrossNorm != null && baselineRoute.xCrossNorm != null ? Math.abs(customRoute.xCrossNorm - baselineRoute.xCrossNorm) : null,
      outerRmse: bandRmse.outer,
      innerRmse: bandRmse.inner,
      midRmse: bandRmse.mid,
      dominantBand: dominantBand,
      outerBias: bands.outer.count ? bands.outer.signed / bands.outer.count : NaN,
      worstResidual: worstResidual,
      worstR: worstR,
      points: scoredPoints
    };
  }

  function currentFrameworkScore() {
    var score = state.framework.current;
    if (!score || !state.curve) return null;
    if (score.curveName !== state.curve.name || score.curveKind !== state.curve.kind) return null;
    return score;
  }

  function currentComparisonScore() {
    var score = state.comparison.current;
    if (!score || !state.curve) return null;
    if (score.curveName !== state.curve.name || score.curveKind !== state.curve.kind) return null;
    return score;
  }

  function scoreCurrentFramework() {
    if (!state.framework.compiled || !state.curve) return;
    try {
      state.framework.current = scoreFrameworkCurve(state.curve, state.framework.compiled);
      state.framework.error = null;
    } catch (error) {
      state.framework.current = null;
      state.framework.error = error.message;
    }
  }

  function scoreCurrentComparison() {
    if (!state.comparison.compiled || !state.curve) return;
    try {
      state.comparison.current = scoreFrameworkCurve(state.curve, state.comparison.compiled);
      state.comparison.error = null;
    } catch (error) {
      state.comparison.current = null;
      state.comparison.error = error.message;
    }
  }

  function applyFrameworkExpression() {
    var expression = $("frameworkFormula").value;
    try {
      var previous = state.framework.expression;
      state.framework.compiled = compileFrameworkExpression(expression);
      state.framework.expression = state.framework.compiled.source;
      if (state.framework.expression !== previous) {
        state.framework.batch = [];
        state.framework.batchSummary = null;
        clearBenchmark();
      }
      state.framework.error = null;
      scoreCurrentFramework();
      updateDiagnostics();
      drawPlots();
      updateFrameworkPanel();
    } catch (error) {
      state.framework.error = error.message;
      state.framework.current = null;
      updateFrameworkPanel();
    }
  }

  function applyComparisonExpression() {
    var expression = $("comparisonFormula").value;
    try {
      var previous = state.comparison.expression;
      state.comparison.compiled = compileFrameworkExpression(expression);
      state.comparison.expression = state.comparison.compiled.source;
      if (state.comparison.expression !== previous) {
        clearBenchmark();
      }
      state.comparison.error = null;
      scoreCurrentComparison();
      updateDiagnostics();
      drawPlots();
      updateComparisonPanel();
    } catch (error) {
      state.comparison.error = error.message;
      state.comparison.current = null;
      updateComparisonPanel();
    }
  }

  function comparisonWinnerText(aScore, bScore) {
    if (!aScore || !bScore) return "--";
    if (Math.abs(aScore.rmse - bScore.rmse) < 0.001) return "tie";
    return aScore.rmse < bScore.rmse ? "A" : "B";
  }

  function comparisonRow(label, score) {
    if (!score) {
      return '<div class="comparison-row"><strong>' + label + '</strong><span>--</span><span>--</span><span>--</span></div>';
    }
    return '<div class="comparison-row">' +
      "<strong>" + htmlEscape(label) + "</strong>" +
      "<span>" + fmt(score.rmse, 1) + "</span>" +
      "<span>" + fmt(score.outerRmse, 1) + "</span>" +
      '<span class="' + (score.routePreserved ? "delta-good" : "delta-bad") + '">' + htmlEscape(score.routeId) + "</span>" +
      "</div>";
  }

  function baselineScoreForComparison() {
    var curve = state.curve;
    if (!curve) return null;
    var targetPoints = curve.points;
    var sse = 0;
    var outerSse = 0;
    var outerCount = 0;
    var worstResidual = 0;
    targetPoints.forEach(function (point) {
      var target = Number.isFinite(point.vObs) ? point.vObs : point.vTotal;
      var residual = point.vTotal - target;
      sse += residual * residual;
      if (curve.rOut && point.r / curve.rOut >= 0.66) {
        outerSse += residual * residual;
        outerCount += 1;
      }
      if (Math.abs(residual) > Math.abs(worstResidual)) worstResidual = residual;
    });
    var route = classifyRoute(curve.points, curve);
    return {
      rmse: targetPoints.length ? Math.sqrt(sse / targetPoints.length) : NaN,
      outerRmse: outerCount ? Math.sqrt(outerSse / outerCount) : NaN,
      routeId: route.id,
      routePreserved: true,
      worstResidual: worstResidual
    };
  }

  function updateComparisonPanel() {
    if (!$("comparisonStatus")) return;
    var aScore = currentFrameworkScore();
    var bScore = currentComparisonScore();
    var bError = state.comparison.error;
    var table = $("comparisonTable");
    var note = $("comparisonNote");
    var baseline = baselineScoreForComparison();

    if (bError) {
      $("comparisonStatus").textContent = "B formula error";
      $("comparisonARmse").textContent = aScore ? fmt(aScore.rmse, 2) : "--";
      $("comparisonBRmse").textContent = "--";
      $("comparisonWinner").textContent = "--";
      $("comparisonOuterDelta").textContent = "--";
      if (note) note.textContent = bError;
      table.innerHTML = "";
      return;
    }

    $("comparisonStatus").textContent = bScore ? "A/B ready" : "B not run";
    $("comparisonARmse").textContent = aScore ? fmt(aScore.rmse, 2) : "--";
    $("comparisonBRmse").textContent = bScore ? fmt(bScore.rmse, 2) : "--";
    $("comparisonWinner").textContent = comparisonWinnerText(aScore, bScore);
    var outerDelta = aScore && bScore ? aScore.outerRmse - bScore.outerRmse : NaN;
    $("comparisonOuterDelta").textContent = Number.isFinite(outerDelta) ? (outerDelta >= 0 ? "+" : "") + fmt(outerDelta, 2) : "--";
    $("comparisonOuterDelta").className = Number.isFinite(outerDelta) ? (outerDelta < 0 ? "delta-good" : (outerDelta > 0 ? "delta-bad" : "")) : "";

    if (note) {
      var fieldLabel = $("residualFieldMode") ? $("residualFieldMode").options[$("residualFieldMode").selectedIndex].text : "Off";
      note.textContent = bScore
        ? "A and B are both scored on the active galaxy. Residual field: " + fieldLabel + "."
        : "Comparator B is drawn against the active Test Rig formula A.";
    }
    table.innerHTML =
      comparisonRow("MTS", baseline) +
      comparisonRow("A Test", aScore) +
      comparisonRow("B Compare", bScore);
  }

  function benchmarkPackLabel(pack) {
    return {
      all: "All 175 LTGs",
      late: "Late-load hunt",
      cdc: "CDC-low systems",
      single: "Single-crossing systems",
      infeasible: "Outer-infeasible systems",
      worst: "Worst baseline RMSE",
      best: "Best baseline RMSE"
    }[pack] || "All 175 LTGs";
  }

  function benchmarkCandidates(pack) {
    var rows = state.ltgIndex.slice();
    if (pack === "late") rows = rows.filter(function (row) { return row.lateLoad; });
    if (pack === "cdc") rows = rows.filter(function (row) { return row.cdc; });
    if (pack === "single") rows = rows.filter(function (row) { return row.route === "buffered single-crossing"; });
    if (pack === "infeasible") rows = rows.filter(function (row) { return row.route === "outer-infeasible"; });
    if (pack === "worst" || pack === "best") {
      rows = rows.filter(function (row) { return Number.isFinite(row.rmse); }).sort(function (a, b) {
        return pack === "worst" ? b.rmse - a.rmse : a.rmse - b.rmse;
      }).slice(0, 20);
    }
    return rows;
  }

  function benchmarkWinner(aScore, bScore) {
    if (!aScore || !bScore || !Number.isFinite(aScore.rmse) || !Number.isFinite(bScore.rmse)) return "--";
    if (Math.abs(aScore.rmse - bScore.rmse) < 0.001) return "tie";
    return aScore.rmse < bScore.rmse ? "A" : "B";
  }

  function clearBenchmark() {
    state.benchmark.rows = [];
    state.benchmark.summary = null;
    updateBenchmarkPanel();
  }

  function runBenchmarkSuite() {
    var pack = $("benchmarkPack") ? $("benchmarkPack").value : "all";
    state.benchmark.pack = pack;
    applyFrameworkExpression();
    applyComparisonExpression();
    if (state.framework.error || state.comparison.error || !state.framework.compiled || !state.comparison.compiled) {
      $("benchmarkNote").textContent = "Fix formula A and comparator B before running the suite.";
      updateBenchmarkPanel();
      return;
    }

    var candidates = benchmarkCandidates(pack);
    if (!candidates.length) {
      $("benchmarkNote").textContent = "No LTG curves matched this benchmark pack.";
      state.benchmark.rows = [];
      state.benchmark.summary = null;
      updateBenchmarkPanel();
      return;
    }

    var rows = [];
    candidates.forEach(function (meta) {
      var sample = (window.MTS_SAMPLES || [])[meta.index];
      if (!sample) return;
      try {
        var curve = parseRotmod(sample.text, sample.name);
        var route = classifyRoute(curve.points, curve);
        var aScore = scoreFrameworkCurve(curve, state.framework.compiled);
        var bScore = scoreFrameworkCurve(curve, state.comparison.compiled);
        var winner = benchmarkWinner(aScore, bScore);
        rows.push({
          index: meta.index,
          name: curve.name,
          route: route.id,
          aRmse: aScore.rmse,
          bRmse: bScore.rmse,
          delta: aScore.rmse - bScore.rmse,
          aOuterRmse: aScore.outerRmse,
          bOuterRmse: bScore.outerRmse,
          aRoute: aScore.routeId,
          bRoute: bScore.routeId,
          aRoutePreserved: aScore.routePreserved,
          bRoutePreserved: bScore.routePreserved,
          aInvalid: aScore.invalidCount,
          bInvalid: bScore.invalidCount,
          winner: winner
        });
      } catch (error) {
        rows.push({
          index: meta.index,
          name: meta.name,
          route: meta.route,
          aRmse: NaN,
          bRmse: NaN,
          delta: NaN,
          winner: "error",
          error: error.message
        });
      }
    });

    var valid = rows.filter(function (row) {
      return Number.isFinite(row.aRmse) && Number.isFinite(row.bRmse);
    });
    var aWins = valid.filter(function (row) { return row.winner === "A"; }).length;
    var bWins = valid.filter(function (row) { return row.winner === "B"; }).length;
    var ties = valid.filter(function (row) { return row.winner === "tie"; }).length;
    var summary = {
      pack: pack,
      packLabel: benchmarkPackLabel(pack),
      count: valid.length,
      aWins: aWins,
      bWins: bWins,
      ties: ties,
      winner: aWins === bWins ? "tie" : (aWins > bWins ? "A" : "B"),
      meanA: meanFinite(valid, "aRmse"),
      meanB: meanFinite(valid, "bRmse"),
      meanDelta: meanFinite(valid, "delta"),
      aRouteRate: valid.length ? valid.filter(function (row) { return row.aRoutePreserved; }).length / valid.length : NaN,
      bRouteRate: valid.length ? valid.filter(function (row) { return row.bRoutePreserved; }).length / valid.length : NaN,
      generatedAt: new Date().toISOString(),
      formulaA: state.framework.expression,
      formulaB: state.comparison.expression
    };

    rows.sort(function (a, b) {
      return Math.abs(safeNumber(b.delta, 0)) - Math.abs(safeNumber(a.delta, 0));
    });
    state.benchmark.rows = rows;
    state.benchmark.summary = summary;
    $("benchmarkNote").textContent = "Suite complete: " + valid.length + " curves, winner " + summary.winner + ".";
    updateBenchmarkPanel();
    updateTrustPanel();
  }

  function updateBenchmarkPanel() {
    var status = $("benchmarkStatus");
    var table = $("benchmarkTable");
    if (!status || !table) return;
    var pack = $("benchmarkPack") ? $("benchmarkPack").value : state.benchmark.pack;
    var summary = state.benchmark.summary;
    $("benchmarkPackMetric").textContent = summary ? summary.packLabel : benchmarkPackLabel(pack);
    $("benchmarkWinner").textContent = summary ? summary.winner : "--";
    $("benchmarkAWins").textContent = summary ? summary.aWins + "/" + summary.count : "--";
    $("benchmarkBWins").textContent = summary ? summary.bWins + "/" + summary.count : "--";
    if (!state.benchmark.rows.length || !summary) {
      status.textContent = "not run";
      table.innerHTML = '<div class="benchmark-row"><strong>Suite ready</strong><span>--</span><span>--</span><span>--</span><span>--</span></div>';
      return;
    }
    status.textContent = summary.count + " scored";
    table.innerHTML = "";
    state.benchmark.rows.slice(0, 12).forEach(function (row) {
      var item = document.createElement("div");
      item.className = "benchmark-row";
      var deltaClass = row.delta < 0 ? "delta-good" : (row.delta > 0 ? "delta-bad" : "");
      item.innerHTML =
        "<strong>" + htmlEscape(row.name) + "</strong>" +
        "<span>" + fmt(row.aRmse, 1) + "</span>" +
        "<span>" + fmt(row.bRmse, 1) + "</span>" +
        '<span class="' + deltaClass + '">' + (Number.isFinite(row.delta) ? (row.delta >= 0 ? "+" : "") + fmt(row.delta, 1) : "--") + "</span>" +
        "<span>" + htmlEscape(row.winner) + "</span>";
      table.appendChild(item);
    });
  }

  function benchmarkCsv() {
    var headers = [
      "pack",
      "name",
      "route",
      "a_rmse_kms",
      "b_rmse_kms",
      "a_minus_b_rmse_kms",
      "a_outer_rmse_kms",
      "b_outer_rmse_kms",
      "a_route",
      "b_route",
      "a_route_preserved",
      "b_route_preserved",
      "winner",
      "a_invalid_points",
      "b_invalid_points",
      "error"
    ];
    return rowsToCsv(headers, state.benchmark.rows.map(function (row) {
      return {
        pack: state.benchmark.summary ? state.benchmark.summary.packLabel : benchmarkPackLabel(state.benchmark.pack),
        name: row.name,
        route: row.route,
        a_rmse_kms: row.aRmse,
        b_rmse_kms: row.bRmse,
        a_minus_b_rmse_kms: row.delta,
        a_outer_rmse_kms: row.aOuterRmse,
        b_outer_rmse_kms: row.bOuterRmse,
        a_route: row.aRoute,
        b_route: row.bRoute,
        a_route_preserved: row.aRoutePreserved,
        b_route_preserved: row.bRoutePreserved,
        winner: row.winner,
        a_invalid_points: row.aInvalid,
        b_invalid_points: row.bInvalid,
        error: row.error
      };
    }));
  }

  function exportBenchmarkCsv() {
    if (!state.benchmark.rows.length) runBenchmarkSuite();
    if (!state.benchmark.rows.length) return;
    downloadText("mts-benchmark-suite-" + slugify(state.benchmark.pack) + ".csv", benchmarkCsv(), "text/csv;charset=utf-8");
  }

  function builtInRegistryEntries() {
    return Object.keys(FRAMEWORK_PRESETS).map(function (key) {
      return {
        id: "preset:" + key,
        name: FRAMEWORK_PRESET_LABELS[key] || key,
        expression: FRAMEWORK_PRESETS[key],
        builtIn: true
      };
    });
  }

  function normalizeRegistryEntry(entry, index) {
    var name = String(entry && entry.name || "Formula " + (index + 1)).trim().slice(0, 72);
    var expression = String(entry && entry.expression || "").trim();
    if (!expression) return null;
    return {
      id: String(entry.id || "user:" + slugify(name || "formula") + "-" + hashText(expression)).slice(0, 96),
      name: name || "Formula " + (index + 1),
      expression: expression,
      notes: String(entry.notes || "").slice(0, 240),
      savedAt: entry.savedAt || new Date().toISOString()
    };
  }

  function loadFormulaRegistry() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(REGISTRY_KEY) : "";
      var parsed = raw ? JSON.parse(raw) : [];
      var entries = Array.isArray(parsed) ? parsed : parsed.entries;
      return (entries || []).map(normalizeRegistryEntry).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function persistFormulaRegistry() {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(state.registry.entries));
      }
    } catch (error) {
      if ($("formulaRegistryNote")) $("formulaRegistryNote").textContent = "Saved for this session, but browser storage is unavailable.";
    }
  }

  function registryEntries() {
    return builtInRegistryEntries().concat(state.registry.entries);
  }

  function selectedRegistryEntry() {
    var select = $("formulaRegistrySelect");
    if (!select) return null;
    var id = select.value;
    return registryEntries().filter(function (entry) { return entry.id === id; })[0] || null;
  }

  function updateFormulaRegistryPanel() {
    var select = $("formulaRegistrySelect");
    if (!select) return;
    var previous = select.value;
    select.innerHTML = "";
    registryEntries().forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry.id;
      option.textContent = (entry.builtIn ? "Preset: " : "Saved: ") + entry.name;
      select.appendChild(option);
    });
    if (previous && registryEntries().some(function (entry) { return entry.id === previous; })) {
      select.value = previous;
    }
    if ($("formulaRegistryNote")) {
      $("formulaRegistryNote").textContent = state.registry.entries.length
        ? state.registry.entries.length + " saved law(s) available alongside built-in presets."
        : "Built-ins are always available; saved laws stay in this browser.";
    }
  }

  function saveFormulaA() {
    applyFrameworkExpression();
    if (state.framework.error) {
      $("formulaRegistryNote").textContent = "Formula A was not saved: " + state.framework.error;
      return;
    }
    var name = ($("formulaRegistryName").value || "").trim() || "Support law " + (state.registry.entries.length + 1);
    var expression = state.framework.expression;
    var id = "user:" + slugify(name) + "-" + hashText(expression).slice(0, 6);
    var entry = normalizeRegistryEntry({
      id: id,
      name: name,
      expression: expression,
      savedAt: new Date().toISOString()
    }, state.registry.entries.length);
    var existing = state.registry.entries.findIndex(function (item) {
      return item.id === entry.id || item.name.toLowerCase() === entry.name.toLowerCase();
    });
    if (existing >= 0) {
      state.registry.entries[existing] = entry;
    } else {
      state.registry.entries.push(entry);
    }
    persistFormulaRegistry();
    updateFormulaRegistryPanel();
    $("formulaRegistrySelect").value = entry.id;
    $("formulaRegistryNote").textContent = "Saved " + entry.name + " to the local formula registry.";
  }

  function loadRegistryFormula(target) {
    var entry = selectedRegistryEntry();
    if (!entry) return;
    if (target === "B") {
      $("comparisonFormula").value = entry.expression;
      $("comparisonPreset").value = entry.builtIn && FRAMEWORK_PRESETS[$("formulaRegistrySelect").value.replace("preset:", "")] ? $("formulaRegistrySelect").value.replace("preset:", "") : "baryon";
      applyComparisonExpression();
    } else {
      $("frameworkFormula").value = entry.expression;
      $("frameworkPreset").value = entry.builtIn && FRAMEWORK_PRESETS[$("formulaRegistrySelect").value.replace("preset:", "")] ? $("formulaRegistrySelect").value.replace("preset:", "") : "mts";
      applyFrameworkExpression();
    }
    $("formulaRegistryName").value = entry.name;
    $("formulaRegistryNote").textContent = "Loaded " + entry.name + " into formula " + target + ".";
  }

  function exportFormulaRegistry() {
    var payload = {
      type: "mts-formula-registry",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: state.registry.entries
    };
    downloadText("mts-formula-registry.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }

  function importFormulaRegistryFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var entries = Array.isArray(parsed) ? parsed : parsed.entries;
        var incoming = (entries || []).map(normalizeRegistryEntry).filter(Boolean);
        incoming.forEach(function (entry) {
          var existing = state.registry.entries.findIndex(function (item) {
            return item.id === entry.id || item.name.toLowerCase() === entry.name.toLowerCase();
          });
          if (existing >= 0) {
            state.registry.entries[existing] = entry;
          } else {
            state.registry.entries.push(entry);
          }
        });
        persistFormulaRegistry();
        updateFormulaRegistryPanel();
        $("formulaRegistryNote").textContent = "Imported " + incoming.length + " formula(s).";
      } catch (error) {
        window.alert("Formula registry import failed: " + error.message);
      }
    };
    reader.readAsText(file);
  }

  function normalizeResearchCandidatePayload(payload) {
    if (!payload || payload.type !== "mts-high-rmse-candidate") {
      throw new Error("This is not an MTS high-RMSE candidate capsule.");
    }
    var candidate = payload.candidate || {};
    var validation = payload.validation || {};
    var expression = String(candidate.appExpression || "").trim();
    if (!expression) throw new Error("Candidate capsule is missing a browser app expression.");
    compileFrameworkExpression(expression);
    var claim = String(candidate.claimStatus || validation.claimStatus || payload.claimStatus || "diagnostic");
    var status = String(candidate.status || validation.status || payload.status || claim);
    var tier = String(candidate.selectionTier || validation.selectionTier || payload.selectionTier || "frontier");
    return {
      type: payload.type,
      version: payload.version || 1,
      id: String(candidate.id || "research-candidate"),
      name: String(candidate.name || candidate.id || "Research candidate").slice(0, 96),
      kind: String(candidate.kind || "state-conditioned diagnostic"),
      status: status,
      claimStatus: claim,
      selectionTier: tier,
      expression: expression,
      scienceExpression: String(candidate.expression || ""),
      generatedAt: payload.generatedAt || "",
      split: payload.split || null,
      train: validation.train || null,
      holdout: validation.holdout || null,
      all: validation.all || null,
      guardrails: Array.isArray(validation.guardrails) ? validation.guardrails : [],
      guardrailFailures: Array.isArray(validation.guardrailFailures) ? validation.guardrailFailures : (Array.isArray(payload.guardrailFailures) ? payload.guardrailFailures : []),
      routeBreaks: validation.routeBreaks || payload.routeBreaks || null,
      nearestPassingCandidate: payload.nearestPassingCandidate || null,
      frontierCandidate: payload.frontierCandidate || null,
      raw: payload
    };
  }

  function importResearchCandidateFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var candidate = normalizeResearchCandidatePayload(JSON.parse(String(reader.result)));
        state.researchCandidate.current = candidate;
        state.researchCandidate.loadedAt = new Date().toISOString();
        updateResearchCandidatePanel();
        if ($("researchCandidateNote")) {
          $("researchCandidateNote").textContent = "Loaded " + candidate.id + " as " + candidate.status + " / " + candidate.selectionTier + ". Use Load to A to test it without changing locked MTS.";
        }
      } catch (error) {
        window.alert("Research candidate import failed: " + error.message);
      }
    };
    reader.readAsText(file);
  }

  function researchPct(value) {
    return Number.isFinite(Number(value)) ? fmt(Number(value), 1) + "%" : "--";
  }

  function researchRate(value) {
    return Number.isFinite(Number(value)) ? fmt(Number(value) * 100, 0) + "%" : "--";
  }

  function researchGuardrailActual(row) {
    var value = Number(row.actual);
    if (!Number.isFinite(value)) return "--";
    if (/rate|preservation/i.test(row.label || "")) return researchRate(value);
    if (/improvement/i.test(row.label || "")) return researchPct(value);
    return fmt(value, 2);
  }

  function researchCandidateClass(candidate) {
    if (!candidate) return "";
    if (candidate.claimStatus === "promoted for review" || candidate.status === "promoted for review") return "delta-good";
    if (candidate.status === "frontier" || candidate.selectionTier === "frontier") return "delta-warn";
    if (candidate.status === "rejected" || candidate.claimStatus === "rejected") return "delta-bad";
    return "";
  }

  function updateResearchCandidatePanel() {
    var candidate = state.researchCandidate.current;
    var table = $("researchCandidateTable");
    if (!table) return;
    if (!candidate) {
      $("researchCandidateStatus").textContent = "not loaded";
      $("researchCandidateName").textContent = "--";
      if ($("researchCandidateTier")) $("researchCandidateTier").textContent = "--";
      $("researchCandidateClaim").textContent = "--";
      $("researchCandidateGain").textContent = "--";
      $("researchCandidateRoute").textContent = "--";
      if ($("researchCandidateBreaks")) $("researchCandidateBreaks").textContent = "--";
      table.innerHTML = '<div class="research-row warn"><strong>No candidate</strong><span>--</span><span>import</span><span>json</span></div>';
      return;
    }

    var holdout = candidate.holdout || {};
    var routeBreaks = candidate.routeBreaks && candidate.routeBreaks.holdout ? candidate.routeBreaks.holdout : null;
    var routeBreakCount = routeBreaks && Number.isFinite(Number(routeBreaks.count)) ? Number(routeBreaks.count) : Number(holdout.routeBreakCount);
    $("researchCandidateStatus").textContent = candidate.status;
    $("researchCandidateName").textContent = compactText(candidate.id, "--", 18);
    if ($("researchCandidateTier")) {
      $("researchCandidateTier").textContent = candidate.selectionTier || "--";
      $("researchCandidateTier").className = researchCandidateClass(candidate);
    }
    $("researchCandidateClaim").textContent = candidate.claimStatus || candidate.status;
    $("researchCandidateClaim").className = researchCandidateClass(candidate);
    $("researchCandidateGain").textContent = researchPct(Number(holdout.meanImprovementPct));
    $("researchCandidateRoute").textContent = researchRate(Number(holdout.routePreservationRate));
    if ($("researchCandidateBreaks")) $("researchCandidateBreaks").textContent = Number.isFinite(routeBreakCount) ? String(routeBreakCount) : "--";

    table.innerHTML = "";
    var rows = candidate.guardrails.length ? candidate.guardrails.slice() : [
      { label: "Guardrails", passed: false, actual: NaN, threshold: "missing" }
    ];
    if (Number.isFinite(routeBreakCount)) {
      rows.unshift({
        label: "Route breaks",
        passed: routeBreakCount === 0,
        actual: routeBreakCount,
        threshold: "0 strict"
      });
    }
    rows.slice(0, 10).forEach(function (row) {
      var item = document.createElement("div");
      item.className = "research-row " + (row.passed ? "pass" : "fail");
      item.innerHTML =
        "<strong>" + htmlEscape(row.label || "check") + "</strong>" +
        "<span>" + (row.passed ? "pass" : "fail") + "</span>" +
        "<span>" + htmlEscape(researchGuardrailActual(row)) + "</span>" +
        "<span>" + htmlEscape(row.threshold || "--") + "</span>";
      table.appendChild(item);
    });
  }

  function loadResearchCandidateToA() {
    var candidate = state.researchCandidate.current;
    if (!candidate) {
      if ($("researchCandidateNote")) $("researchCandidateNote").textContent = "Import a candidate JSON before loading it into formula A.";
      return;
    }
    $("frameworkFormula").value = candidate.expression;
    $("frameworkPreset").value = "mts";
    if ($("formulaRegistryName")) $("formulaRegistryName").value = candidate.name;
    applyFrameworkExpression();
    runFrameworkBatch();
    if ($("researchCandidateNote")) {
      $("researchCandidateNote").textContent = "Loaded " + candidate.id + " into A and ran the 175-LTG batch. Claim status remains " + (candidate.claimStatus || candidate.status) + ".";
    }
    updateResearchCandidatePanel();
  }

  function queueResearchCandidate() {
    var candidate = state.researchCandidate.current;
    if (!candidate) {
      if ($("researchCandidateNote")) $("researchCandidateNote").textContent = "Import a candidate JSON before adding it to the tournament queue.";
      return;
    }
    var queue = $("tournamentQueue");
    var line = "Research " + candidate.id + " = " + candidate.expression;
    if (queue.value.indexOf(candidate.expression) === -1) {
      queue.value = queue.value.trim() ? queue.value.trim() + "\n" + line : line;
    }
    runTournament();
    if ($("researchCandidateNote")) {
      $("researchCandidateNote").textContent = "Queued " + candidate.id + " in the tournament. It remains " + (candidate.claimStatus || candidate.status) + " until guardrails pass.";
    }
    updateResearchCandidatePanel();
  }

  function updateFrameworkPanel() {
    if (!$("frameworkStatus")) return;
    var score = currentFrameworkScore();
    var batch = state.framework.batchSummary;
    var error = state.framework.error;
    var note = $("frameworkNote");
    var table = $("frameworkTable");

    if (error) {
      $("frameworkStatus").textContent = "formula error";
      $("frameworkRmse").textContent = "--";
      $("frameworkMtsRmse").textContent = "--";
      $("frameworkDelta").textContent = "--";
      $("frameworkDelta").className = "";
      $("frameworkWins").textContent = batch ? batch.wins + "/" + batch.count : "--";
      note.textContent = error;
      table.innerHTML = "";
      return;
    }

    $("frameworkStatus").textContent = batch ? "batch ready" : "current ready";
    $("frameworkRmse").textContent = score ? fmt(score.rmse, 2) : "--";
    $("frameworkMtsRmse").textContent = score ? fmt(score.baselineRmse, 2) : "--";
    $("frameworkDelta").textContent = score ? fmt(score.delta, 2) : "--";
    $("frameworkDelta").className = score && score.delta < 0 ? "delta-good" : (score && score.delta > 0 ? "delta-bad" : "");
    $("frameworkWins").textContent = batch ? batch.wins + "/" + batch.count : "--";

    if (batch) {
      note.textContent = (state.framework.compiled && state.framework.compiled.kind === "v17state-exact-cache" ? exactCacheDisplayName(state.framework.compiled) + " active. " : "") +
        "Batch complete: " + batch.wins + " / " + batch.count + " LTGs beat baseline. Median delta " + fmt(batch.medianDelta, 2) + " km/s." +
        (batch.exactCacheFallbacks ? " Exact-cache fallback used on " + batch.exactCacheFallbacks + " point(s)." : "");
    } else if (score) {
      if (score.exactCacheHits) {
        note.textContent = exactCacheDisplayName(state.framework.compiled) + " active for this built-in curve. " +
          (score.exactCacheFallbacks ? score.exactCacheFallbacks + " point(s) fell back to locked MTS." : "All active points used the tested support cache.");
      } else {
        note.textContent = "Formula ready. " + (score.invalidCount ? score.invalidCount + " invalid points were clamped." : "All active points evaluated.");
      }
    } else {
      note.textContent = "Use variables like r, h, rOut, leff, memory, vGas, vDisk, vBulge, vBar, vObs, and uObs.";
    }

    if (!state.framework.batch.length) {
      table.innerHTML = '<div class="framework-row"><strong>Batch not run</strong><span>--</span><span>--</span></div>';
      return;
    }

    table.innerHTML = "";
    state.framework.batch.slice(0, 10).forEach(function (row) {
      var item = document.createElement("div");
      item.className = "framework-row";
      item.innerHTML =
        "<strong>" + row.name + "</strong>" +
        "<span>" + fmt(row.customRmse, 1) + "</span>" +
        '<span class="' + (row.delta < 0 ? "delta-good" : (row.delta > 0 ? "delta-bad" : "")) + '">' + fmt(row.delta, 1) + "</span>";
      table.appendChild(item);
    });
  }

  function runFrameworkBatch() {
    applyFrameworkExpression();
    if (state.framework.error || !state.framework.compiled) return;

    var rows = [];
    (window.MTS_SAMPLES || []).forEach(function (sample, index) {
      try {
        var curve = parseRotmod(sample.text, sample.name);
        var route = classifyRoute(curve.points, curve);
        var score = scoreFrameworkCurve(curve, state.framework.compiled);
        rows.push({
          index: index,
          name: curve.name,
          route: route.id,
          customRmse: score.rmse,
          mtsRmse: score.baselineRmse,
          delta: score.delta,
          invalidCount: score.invalidCount,
          outerRmse: score.outerRmse,
          innerRmse: score.innerRmse,
          midRmse: score.midRmse,
          dominantBand: score.dominantBand,
          routePreserved: score.routePreserved,
          customRoute: score.routeId,
          exactCacheHits: score.exactCacheHits,
          exactCacheFallbacks: score.exactCacheFallbacks,
          xCrossError: score.xCrossError,
          worstResidual: score.worstResidual,
          worstR: score.worstR,
          h: curve.h,
          rOut: curve.rOut,
          uOut: route.uOut,
          lateLoad: route.lateLoad,
          cdc: route.cdc,
          outerViable: route.outerViable
        });
      } catch (error) {
        rows.push({
          index: index,
          name: cleanGalaxyName(sample.name),
          route: "error",
          customRmse: NaN,
          mtsRmse: NaN,
          delta: NaN,
          invalidCount: 0,
          error: error.message
        });
      }
    });

    var valid = rows.filter(function (row) {
      return Number.isFinite(row.delta);
    });
    valid.sort(function (a, b) {
      return a.delta - b.delta;
    });
    state.framework.batch = valid.concat(rows.filter(function (row) {
      return !Number.isFinite(row.delta);
    }));

    var wins = valid.filter(function (row) { return row.delta < -0.001; }).length;
    var meanDelta = valid.reduce(function (sum, row) { return sum + row.delta; }, 0) / Math.max(1, valid.length);
    var medianDelta = valid.length ? valid[Math.floor(valid.length / 2)].delta : NaN;
    var exactCacheFallbacks = valid.reduce(function (sum, row) { return sum + (row.exactCacheFallbacks || 0); }, 0);
    state.framework.batchSummary = {
      count: valid.length,
      wins: wins,
      meanDelta: meanDelta,
      medianDelta: medianDelta,
      exactCacheFallbacks: exactCacheFallbacks,
      expression: state.framework.expression
    };
    $("frameworkNote").textContent = (state.framework.compiled && state.framework.compiled.kind === "v17state-exact-cache" ? exactCacheDisplayName(state.framework.compiled) + " active. " : "") +
      "Batch complete: " + wins + " / " + valid.length + " LTGs beat the MTS baseline for this formula.";
    updateFrameworkPanel();
    updateV18ReviewPanel();
  }

  function parseTournamentQueue(text) {
    return String(text || "").split(/\r?\n/).map(function (line, index) {
      var trimmed = line.trim();
      if (!trimmed || trimmed[0] === "#") return null;
      var eq = trimmed.indexOf("=");
      var name = "Formula " + (index + 1);
      var expression = trimmed;
      if (eq > 0) {
        name = trimmed.slice(0, eq).trim() || name;
        expression = trimmed.slice(eq + 1).trim();
      }
      return { name: name.slice(0, 44), expression: expression };
    }).filter(Boolean);
  }

  function meanFinite(rows, key) {
    var values = rows.map(function (row) { return row[key]; }).filter(Number.isFinite);
    if (!values.length) return NaN;
    return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
  }

  function medianFinite(rows, key) {
    var values = rows.map(function (row) { return row[key]; }).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!values.length) return NaN;
    return values[Math.floor(values.length / 2)];
  }

  function runTournament() {
    var formulas = parseTournamentQueue($("tournamentQueue").value);
    if (!formulas.length) {
      $("tournamentNote").textContent = "No tournament formulas found.";
      return;
    }

    var curves = (window.MTS_SAMPLES || []).map(function (sample) {
      return parseRotmod(sample.text, sample.name);
    });
    var rows = [];

    formulas.forEach(function (entry) {
      var compiled;
      try {
        compiled = compileFrameworkExpression(entry.expression);
      } catch (error) {
        rows.push({
          name: entry.name,
          expression: entry.expression,
          meanRmse: NaN,
          medianDelta: NaN,
          wins: 0,
          routeRate: NaN,
          outerRmse: NaN,
          invalid: 0,
          error: error.message,
          count: 0
        });
        return;
      }

      var scores = curves.map(function (curve) {
        return scoreFrameworkCurve(curve, compiled);
      });
      var wins = scores.filter(function (score) { return score.delta < -0.001; }).length;
      var routeHits = scores.filter(function (score) { return score.routePreserved; }).length;
      var invalid = scores.reduce(function (sum, score) { return sum + score.invalidCount; }, 0);
      rows.push({
        name: entry.name,
        expression: compiled.source,
        meanRmse: meanFinite(scores, "rmse"),
        medianRmse: medianFinite(scores, "rmse"),
        meanDelta: meanFinite(scores, "delta"),
        medianDelta: medianFinite(scores, "delta"),
        outerRmse: meanFinite(scores, "outerRmse"),
        wins: wins,
        routeRate: scores.length ? routeHits / scores.length : NaN,
        invalid: invalid,
        count: scores.length
      });
    });

    rows.sort(function (a, b) {
      return safeNumber(a.meanRmse, Infinity) - safeNumber(b.meanRmse, Infinity);
    });
    state.tournament.rows = rows;
    state.tournament.summary = {
      count: rows.length,
      sampleCount: curves.length,
      generatedAt: new Date().toISOString()
    };
    $("tournamentNote").textContent = "Tournament complete: " + rows.length + " frameworks across " + curves.length + " LTGs.";
    updateTournamentPanel();
  }

  function updateTournamentPanel() {
    var status = $("tournamentStatus");
    var table = $("tournamentTable");
    if (!status || !table) return;
    if (!state.tournament.rows.length) {
      status.textContent = "not run";
      table.innerHTML = '<div class="tournament-row"><span class="rank">--</span><strong>Queue ready</strong><span>--</span><span>--</span><span>--</span></div>';
      return;
    }
    status.textContent = state.tournament.rows.length + " ranked";
    table.innerHTML = "";
    state.tournament.rows.slice(0, 12).forEach(function (row, index) {
      var item = document.createElement("div");
      item.className = "tournament-row";
      var deltaClass = row.medianDelta < 0 ? "delta-good" : (row.medianDelta > 0 ? "delta-bad" : "");
      item.innerHTML =
        '<span class="rank">#' + (index + 1) + "</span>" +
        "<strong>" + htmlEscape(row.name) + "</strong>" +
        "<span>" + fmt(row.meanRmse, 1) + "</span>" +
        '<span class="' + deltaClass + '">' + fmt(row.medianDelta, 1) + "</span>" +
        "<span>" + (Number.isFinite(row.routeRate) ? fmt(row.routeRate * 100, 0) + "%" : "--") + "</span>";
      table.appendChild(item);
    });
  }

  function tournamentScoresCsv() {
    var headers = [
      "rank",
      "name",
      "expression",
      "mean_rmse_kms",
      "median_rmse_kms",
      "mean_delta_kms",
      "median_delta_kms",
      "mean_outer_rmse_kms",
      "wins_vs_mts",
      "route_preservation_rate",
      "invalid_points",
      "sample_count",
      "error"
    ];
    return rowsToCsv(headers, state.tournament.rows.map(function (row, index) {
      return {
        rank: index + 1,
        name: row.name,
        expression: row.expression,
        mean_rmse_kms: row.meanRmse,
        median_rmse_kms: row.medianRmse,
        mean_delta_kms: row.meanDelta,
        median_delta_kms: row.medianDelta,
        mean_outer_rmse_kms: row.outerRmse,
        wins_vs_mts: row.wins,
        route_preservation_rate: row.routeRate,
        invalid_points: row.invalid,
        sample_count: row.count,
        error: row.error
      };
    }));
  }

  function exportTournamentCsv() {
    if (!state.tournament.rows.length) runTournament();
    if (!state.tournament.rows.length) return;
    downloadText("mts-framework-tournament.csv", tournamentScoresCsv(), "text/csv;charset=utf-8");
  }

  function readSweepConfig() {
    var grid = $("sweepGrid").value || "13x9";
    var parts = grid.split("x").map(Number);
    var gammaMin = Number($("sweepGammaMin").value);
    var gammaMax = Number($("sweepGammaMax").value);
    var qMin = Number($("sweepQMin").value);
    var qMax = Number($("sweepQMax").value);
    if (!Number.isFinite(gammaMin) || !Number.isFinite(gammaMax) || gammaMin <= 0 || gammaMax <= 0) {
      throw new Error("Gamma sweep bounds must be positive numbers.");
    }
    if (!Number.isFinite(qMin) || !Number.isFinite(qMax) || qMin <= 0 || qMax <= 0) {
      throw new Error("q sweep bounds must be positive numbers.");
    }
    if (gammaMin > gammaMax) {
      var gSwap = gammaMin;
      gammaMin = gammaMax;
      gammaMax = gSwap;
    }
    if (qMin > qMax) {
      var qSwap = qMin;
      qMin = qMax;
      qMax = qSwap;
    }
    return {
      gammaMin: gammaMin,
      gammaMax: gammaMax,
      qMin: qMin,
      qMax: qMax,
      gammaSteps: clamp(parts[0] || 13, 3, 25),
      qSteps: clamp(parts[1] || 9, 3, 19),
      grid: grid
    };
  }

  function sequence(min, max, count) {
    var values = [];
    if (count <= 1) return [min];
    for (var i = 0; i < count; i += 1) {
      values.push(min + (max - min) * i / (count - 1));
    }
    return values;
  }

  function scoreMtsParamCurve(curve, gammaScale, qValue) {
    var sse = 0;
    var outerSse = 0;
    var outerCount = 0;
    var count = 0;
    curve.points.forEach(function (point) {
      var bar2 = point.vBar * point.vBar;
      var support2 = CONST.gamma0 * gammaScale * curve.leff * (1 - Math.exp(-Math.pow(point.r / curve.leff, qValue)));
      var model = Math.sqrt(Math.max(0, bar2 + support2));
      var residual = model - point.vObs;
      sse += residual * residual;
      if (point.r / curve.rOut >= 0.66) {
        outerSse += residual * residual;
        outerCount += 1;
      }
      count += 1;
    });
    return {
      rmse: count ? Math.sqrt(sse / count) : NaN,
      outerRmse: outerCount ? Math.sqrt(outerSse / outerCount) : NaN
    };
  }

  function runParameterSweep() {
    var config;
    try {
      config = readSweepConfig();
    } catch (error) {
      $("sweepNote").textContent = error.message;
      return;
    }

    var curves = [];
    (window.MTS_SAMPLES || []).forEach(function (sample) {
      try {
        curves.push(parseRotmod(sample.text, sample.name));
      } catch (error) {
        // Skip malformed curves in the sweep; parse errors remain visible in the browser index.
      }
    });
    if (!curves.length) {
      $("sweepNote").textContent = "No LTG curves were available for the sweep.";
      return;
    }

    var gammas = sequence(config.gammaMin, config.gammaMax, config.gammaSteps);
    var qs = sequence(config.qMin, config.qMax, config.qSteps);
    var rows = [];
    var best = null;

    qs.forEach(function (qValue, qIndex) {
      gammas.forEach(function (gammaScale, gammaIndex) {
        var rmseSum = 0;
        var outerSum = 0;
        var wins = 0;
        var valid = 0;
        curves.forEach(function (curve) {
          var score = scoreMtsParamCurve(curve, gammaScale, qValue);
          if (Number.isFinite(score.rmse)) {
            rmseSum += score.rmse;
            outerSum += Number.isFinite(score.outerRmse) ? score.outerRmse : score.rmse;
            if (Number.isFinite(curve.rmse) && score.rmse < curve.rmse - 0.001) wins += 1;
            valid += 1;
          }
        });
        var row = {
          gammaScale: gammaScale,
          q: qValue,
          gammaIndex: gammaIndex,
          qIndex: qIndex,
          meanRmse: valid ? rmseSum / valid : NaN,
          meanOuterRmse: valid ? outerSum / valid : NaN,
          wins: wins,
          count: valid
        };
        rows.push(row);
        if (!best || row.meanRmse < best.meanRmse) best = row;
      });
    });

    var robustLimit = best.meanRmse * 1.03;
    var robustCells = rows.filter(function (row) {
      return row.meanRmse <= robustLimit;
    }).length;
    state.sweep = {
      gammaMin: config.gammaMin,
      gammaMax: config.gammaMax,
      qMin: config.qMin,
      qMax: config.qMax,
      gammaSteps: config.gammaSteps,
      qSteps: config.qSteps,
      grid: config.grid,
      rows: rows,
      summary: {
        bestGammaScale: best.gammaScale,
        bestQ: best.q,
        bestMeanRmse: best.meanRmse,
        bestMeanOuterRmse: best.meanOuterRmse,
        bestWins: best.wins,
        robustCells: robustCells,
        robustLimit: robustLimit,
        sampleCount: curves.length,
        generatedAt: new Date().toISOString()
      }
    };
    $("sweepNote").textContent = "Sweep complete: " + rows.length + " cells across " + curves.length + " LTGs.";
    updateSweepPanel();
  }

  function heatColor(t) {
    var clamped = clamp(t, 0, 1);
    var r = Math.round(214 * (1 - clamped) + 255 * clamped);
    var g = Math.round(255 * (1 - clamped) + 114 * clamped);
    var b = Math.round(99 * (1 - clamped) + 111 * clamped);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function updateSweepPanel() {
    var status = $("sweepStatus");
    var svg = $("sweepHeatmap");
    if (!status || !svg) return;
    var rows = state.sweep.rows || [];
    var summary = state.sweep.summary;
    if (!rows.length || !summary) {
      status.textContent = "not run";
      $("sweepBestGamma").textContent = "--";
      $("sweepBestQ").textContent = "--";
      $("sweepBestRmse").textContent = "--";
      $("sweepRobustCells").textContent = "--";
      svg.innerHTML = "";
      svg.appendChild(svgEl("text", { class: "plot-label", x: 150, y: 135 })).textContent = "Run Heatmap";
      return;
    }

    status.textContent = state.sweep.grid + " landscape";
    $("sweepBestGamma").textContent = fmt(summary.bestGammaScale, 3);
    $("sweepBestQ").textContent = fmt(summary.bestQ, 3);
    $("sweepBestRmse").textContent = fmt(summary.bestMeanRmse, 2);
    $("sweepRobustCells").textContent = summary.robustCells + "/" + rows.length;
    drawSweepHeatmap();
  }

  function drawSweepHeatmap() {
    var svg = $("sweepHeatmap");
    var rows = state.sweep.rows || [];
    var summary = state.sweep.summary;
    if (!svg || !rows.length || !summary) return;
    var width = 420;
    var height = 270;
    var plot = { left: 46, right: width - 18, top: 18, bottom: height - 40 };
    var cols = state.sweep.gammaSteps;
    var rowCount = state.sweep.qSteps;
    var cellW = (plot.right - plot.left) / cols;
    var cellH = (plot.bottom - plot.top) / rowCount;
    var minRmse = Math.min.apply(null, rows.map(function (row) { return row.meanRmse; }));
    var maxRmse = Math.max.apply(null, rows.map(function (row) { return row.meanRmse; }));
    if (minRmse === maxRmse) maxRmse = minRmse + 1;
    svg.innerHTML = "";

    rows.forEach(function (row) {
      var x = plot.left + row.gammaIndex * cellW;
      var y = plot.bottom - (row.qIndex + 1) * cellH;
      var t = (row.meanRmse - minRmse) / (maxRmse - minRmse);
      var rect = svgEl("rect", {
        class: "heat-cell" + (Math.abs(row.gammaScale - summary.bestGammaScale) < 1e-9 && Math.abs(row.q - summary.bestQ) < 1e-9 ? " active" : ""),
        x: x,
        y: y,
        width: Math.max(1, cellW - 1),
        height: Math.max(1, cellH - 1),
        fill: heatColor(t)
      });
      rect.appendChild(svgEl("title", {})).textContent = "Gamma " + fmt(row.gammaScale, 3) + " | q " + fmt(row.q, 3) + " | RMSE " + fmt(row.meanRmse, 2);
      rect.addEventListener("click", function () {
        $("frameworkFormula").value = "gamma0 * " + fmt(row.gammaScale, 4) + " * leff * (1 - exp(-pow(r / leff, " + fmt(row.q, 4) + ")))";
        $("frameworkPreset").value = "mts";
        applyFrameworkExpression();
      });
      svg.appendChild(rect);
    });

    var bestCol = rows.find(function (row) {
      return Math.abs(row.gammaScale - summary.bestGammaScale) < 1e-9 && Math.abs(row.q - summary.bestQ) < 1e-9;
    });
    if (bestCol) {
      svg.appendChild(svgEl("rect", {
        class: "heat-best",
        x: plot.left + bestCol.gammaIndex * cellW + 1,
        y: plot.bottom - (bestCol.qIndex + 1) * cellH + 1,
        width: Math.max(1, cellW - 3),
        height: Math.max(1, cellH - 3)
      }));
    }

    for (var i = 0; i <= 4; i += 1) {
      var gx = plot.left + (plot.right - plot.left) * i / 4;
      var gy = plot.bottom - (plot.bottom - plot.top) * i / 4;
      var gammaLabel = state.sweep.gammaMin + (state.sweep.gammaMax - state.sweep.gammaMin) * i / 4;
      var qLabel = state.sweep.qMin + (state.sweep.qMax - state.sweep.qMin) * i / 4;
      svg.appendChild(svgEl("text", { class: "plot-label", x: gx - 10, y: height - 16 })).textContent = fmt(gammaLabel, 2);
      svg.appendChild(svgEl("text", { class: "plot-label", x: 5, y: gy + 3 })).textContent = fmt(qLabel, 2);
    }
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.bottom, x2: plot.right, y2: plot.bottom }));
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.bottom }));
    svg.appendChild(svgEl("text", { class: "plot-label", x: plot.right - 88, y: height - 5 })).textContent = "Gamma0 scale";
    svg.appendChild(svgEl("text", { class: "plot-label", x: 5, y: 12 })).textContent = "q";
  }

  function sweepCsv() {
    var headers = [
      "gamma_scale",
      "gamma0_effective",
      "q",
      "mean_rmse_kms",
      "mean_outer_rmse_kms",
      "wins_vs_locked_mts",
      "sample_count",
      "is_best",
      "within_3pct_best"
    ];
    var summary = state.sweep.summary || {};
    return rowsToCsv(headers, (state.sweep.rows || []).map(function (row) {
      return {
        gamma_scale: row.gammaScale,
        gamma0_effective: row.gammaScale * CONST.gamma0,
        q: row.q,
        mean_rmse_kms: row.meanRmse,
        mean_outer_rmse_kms: row.meanOuterRmse,
        wins_vs_locked_mts: row.wins,
        sample_count: row.count,
        is_best: summary.bestGammaScale === row.gammaScale && summary.bestQ === row.q,
        within_3pct_best: row.meanRmse <= summary.robustLimit
      };
    }));
  }

  function exportSweepCsv() {
    if (!state.sweep.rows.length) runParameterSweep();
    if (!state.sweep.rows.length) return;
    downloadText("mts-parameter-landscape-" + state.sweep.grid + ".csv", sweepCsv(), "text/csv;charset=utf-8");
  }

  function routeMetricInfo(key) {
    var map = {
      xCross: { label: "x_cross" },
      uOut: { label: "u_out" },
      uMax: { label: "u_max" },
      memoryLoad: { label: "memory" },
      hOverRout: { label: "h/r_out" },
      rmse: { label: "RMSE" },
      priorityL: { label: "Priority L" },
      priorityL3: { label: "Priority L3" },
      leffOverH: { label: "L_eff/h" },
      u075: { label: "u_0.75" },
      ltgCurvatureA: { label: "LTG A" },
      sLawS: { label: "S-law S" },
      sLawResidual: { label: "S-law dU" }
    };
    return map[key] || map.uOut;
  }

  function routeClassName(route) {
    if (route === "CDC-low-load") return "route-cdc";
    if (route === "buffered upward-crossing") return "route-up";
    if (route === "buffered single-crossing") return "route-single";
    if (route === "outer-infeasible") return "route-infeasible";
    return "route-low";
  }

  function routeMetricValue(row, key) {
    var value = row[key];
    return Number.isFinite(value) ? value : NaN;
  }

  function drawRouteMap() {
    var svg = $("routeMapPlot");
    if (!svg) return;
    var width = 420;
    var height = 250;
    var plot = { left: 48, right: width - 18, top: 22, bottom: height - 42 };
    svg.innerHTML = "";
    var xKey = state.routeMap.x;
    var yKey = state.routeMap.y;
    var rows = state.ltgIndex.filter(function (row) {
      return Number.isFinite(routeMetricValue(row, xKey)) && Number.isFinite(routeMetricValue(row, yKey));
    });
    $("routeMapCount").textContent = rows.length + " / " + state.ltgIndex.length;
    if (!rows.length) return;

    var xVals = rows.map(function (row) { return routeMetricValue(row, xKey); });
    var yVals = rows.map(function (row) { return routeMetricValue(row, yKey); });
    var xMin = Math.min.apply(null, xVals);
    var xMax = Math.max.apply(null, xVals);
    var yMin = Math.min.apply(null, yVals);
    var yMax = Math.max.apply(null, yVals);
    if (xMin === xMax) xMax = xMin + 1;
    if (yMin === yMax) yMax = yMin + 1;
    var xPad = (xMax - xMin) * 0.08;
    var yPad = (yMax - yMin) * 0.08;
    xMin -= xPad;
    xMax += xPad;
    yMin -= yPad;
    yMax += yPad;

    var xScale = function (v) { return plot.left + ((v - xMin) / (xMax - xMin)) * (plot.right - plot.left); };
    var yScale = function (v) { return plot.bottom - ((v - yMin) / (yMax - yMin)) * (plot.bottom - plot.top); };

    for (var i = 0; i <= 4; i += 1) {
      var xVal = xMin + (xMax - xMin) * i / 4;
      var yVal = yMin + (yMax - yMin) * i / 4;
      var x = xScale(xVal);
      var y = yScale(yVal);
      svg.appendChild(svgEl("line", { class: "plot-grid", x1: x, y1: plot.top, x2: x, y2: plot.bottom }));
      svg.appendChild(svgEl("line", { class: "plot-grid", x1: plot.left, y1: y, x2: plot.right, y2: y }));
      svg.appendChild(svgEl("text", { class: "plot-label", x: x - 8, y: height - 18 })).textContent = fmt(xVal, Math.abs(xVal) < 3 ? 1 : 0);
      svg.appendChild(svgEl("text", { class: "plot-label", x: 5, y: y + 3 })).textContent = fmt(yVal, Math.abs(yVal) < 3 ? 1 : 0);
    }
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.bottom, x2: plot.right, y2: plot.bottom }));
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.bottom }));
    svg.appendChild(svgEl("text", { class: "plot-label", x: plot.right - 64, y: height - 6 })).textContent = routeMetricInfo(xKey).label;
    svg.appendChild(svgEl("text", { class: "plot-label", x: 5, y: 12 })).textContent = routeMetricInfo(yKey).label;

    rows.forEach(function (row) {
      var radius = clamp(2.5 + Math.sqrt(Math.max(0, safeNumber(row.rmse, 0))) * 0.35, 3, 8);
      var point = svgEl("circle", {
        class: "route-point " + routeClassName(row.route) + (state.curve && state.curve.name === row.name ? " active" : ""),
        cx: xScale(routeMetricValue(row, xKey)),
        cy: yScale(routeMetricValue(row, yKey)),
        r: radius
      });
      point.appendChild(svgEl("title", {})).textContent = row.name + " | " + row.route + " | RMSE " + fmt(row.rmse, 1);
      point.addEventListener("click", function () {
        $("sampleSelect").value = String(row.index);
        setMode("observed");
        loadSelectedSample();
      });
      svg.appendChild(point);
    });
  }

  function populationCandidates() {
    var subset = state.population.subset;
    var rows = subset === "browser" ? filteredLtgIndex() : state.ltgIndex.slice();
    if (subset !== "browser" && subset !== "all") {
      rows = rows.filter(function (row) { return row.route === subset; });
    }
    return rows.filter(function (row) {
      return Number.isFinite(routeMetricValue(row, state.population.x)) && Number.isFinite(routeMetricValue(row, state.population.y));
    });
  }

  function meanValue(rows, key) {
    var vals = rows.map(function (row) { return routeMetricValue(row, key); }).filter(Number.isFinite);
    if (!vals.length) return NaN;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  function pearsonRows(rows, xKey, yKey) {
    var pairs = rows.map(function (row) {
      return [routeMetricValue(row, xKey), routeMetricValue(row, yKey)];
    }).filter(function (pair) {
      return Number.isFinite(pair[0]) && Number.isFinite(pair[1]);
    });
    if (pairs.length < 3) return NaN;
    var mx = pairs.reduce(function (sum, p) { return sum + p[0]; }, 0) / pairs.length;
    var my = pairs.reduce(function (sum, p) { return sum + p[1]; }, 0) / pairs.length;
    var num = 0;
    var dx2 = 0;
    var dy2 = 0;
    pairs.forEach(function (p) {
      var dx = p[0] - mx;
      var dy = p[1] - my;
      num += dx * dy;
      dx2 += dx * dx;
      dy2 += dy * dy;
    });
    var denom = Math.sqrt(dx2 * dy2);
    return denom ? num / denom : NaN;
  }

  function quantileValues(values, q) {
    var vals = values.filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!vals.length) return NaN;
    var pos = clamp(q, 0, 1) * (vals.length - 1);
    var lo = Math.floor(pos);
    var hi = Math.ceil(pos);
    if (lo === hi) return vals[lo];
    var t = pos - lo;
    return vals[lo] * (1 - t) + vals[hi] * t;
  }

  function routeCountSummary(rows) {
    var counts = {};
    rows.forEach(function (row) {
      counts[row.route] = (counts[row.route] || 0) + 1;
    });
    var dominant = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || "--";
    return { counts: counts, dominant: dominant };
  }

  function bootstrapCorrelation(rows, xKey, yKey, count) {
    if (rows.length < 4) return { p10: NaN, p50: NaN, p90: NaN };
    var rand = randomFromSeed(hashName(xKey + ":" + yKey + ":" + rows.length + ":" + count));
    var values = [];
    for (var i = 0; i < count; i += 1) {
      var sample = [];
      for (var j = 0; j < rows.length; j += 1) {
        sample.push(rows[Math.floor(rand() * rows.length)]);
      }
      values.push(pearsonRows(sample, xKey, yKey));
    }
    return {
      p10: quantileValues(values, 0.1),
      p50: quantileValues(values, 0.5),
      p90: quantileValues(values, 0.9)
    };
  }

  function jackknifeCorrelation(rows, xKey, yKey) {
    if (rows.length < 4) return { min: NaN, max: NaN };
    var values = rows.map(function (row, index) {
      return pearsonRows(rows.filter(function (_, i) { return i !== index; }), xKey, yKey);
    });
    return {
      min: quantileValues(values, 0),
      max: quantileValues(values, 1)
    };
  }

  function populationCorrelationRows(rows) {
    var keys = ["memoryLoad", "rmse", "u075", "ltgCurvatureA", "sLawS", "uMax", "xCross", "leffOverH"];
    var out = [];
    for (var i = 0; i < keys.length; i += 1) {
      for (var j = i + 1; j < keys.length; j += 1) {
        var r = pearsonRows(rows, keys[i], keys[j]);
        if (Number.isFinite(r)) {
          out.push({
            a: keys[i],
            b: keys[j],
            r: r,
            abs: Math.abs(r),
            label: routeMetricInfo(keys[i]).label + " vs " + routeMetricInfo(keys[j]).label
          });
        }
      }
    }
    out.sort(function (a, b) { return b.abs - a.abs; });
    return out;
  }

  function runPopulationStats() {
    if (!state.ltgIndex.length) return;
    state.population.x = $("populationX") ? $("populationX").value : state.population.x;
    state.population.y = $("populationY") ? $("populationY").value : state.population.y;
    state.population.subset = $("populationSubset") ? $("populationSubset").value : state.population.subset;
    state.population.resamples = $("populationResamples") ? Number($("populationResamples").value) || 200 : state.population.resamples;
    var rows = populationCandidates();
    var corr = pearsonRows(rows, state.population.x, state.population.y);
    var boot = bootstrapCorrelation(rows, state.population.x, state.population.y, state.population.resamples);
    var jack = jackknifeCorrelation(rows, state.population.x, state.population.y);
    var routeCounts = routeCountSummary(rows);
    state.population.rows = rows;
    state.population.correlationRows = populationCorrelationRows(rows);
    state.population.summary = {
      generatedAt: new Date().toISOString(),
      x: state.population.x,
      y: state.population.y,
      subset: state.population.subset,
      resamples: state.population.resamples,
      n: rows.length,
      correlation: corr,
      xMean: meanValue(rows, state.population.x),
      yMean: meanValue(rows, state.population.y),
      bootstrap: boot,
      jackknife: jack,
      routeCounts: routeCounts.counts,
      dominantRoute: routeCounts.dominant
    };
    updatePopulationPanel();
    drawPopulationPlot();
    updateTrustPanel();
  }

  function updatePopulationPanel() {
    var table = $("populationTable");
    if (!table) return;
    var summary = state.population.summary;
    table.innerHTML = "";
    if (!summary || summary.x !== state.population.x || summary.y !== state.population.y || summary.subset !== state.population.subset) {
      $("populationStatus").textContent = "not run";
      $("populationN").textContent = "--";
      $("populationCorr").textContent = "--";
      $("populationBootstrap").textContent = "--";
      $("populationDominantRoute").textContent = "--";
      table.innerHTML = '<div class="population-row"><strong>Run Population</strong><span>--</span><span>--</span><span>--</span></div>';
      if ($("populationNote")) $("populationNote").textContent = "Run correlations, route counts, bootstrap confidence, and jackknife stability on LTG subsets.";
      drawPopulationPlot();
      return;
    }
    $("populationStatus").textContent = routeMetricInfo(summary.x).label + " vs " + routeMetricInfo(summary.y).label;
    $("populationN").textContent = String(summary.n);
    $("populationCorr").textContent = Number.isFinite(summary.correlation) ? fmt(summary.correlation, 3) : "--";
    $("populationBootstrap").textContent = Number.isFinite(summary.bootstrap.p10) ? fmt(summary.bootstrap.p10, 2) + "-" + fmt(summary.bootstrap.p90, 2) : "--";
    $("populationDominantRoute").textContent = summary.dominantRoute;
    state.population.correlationRows.slice(0, 10).forEach(function (row) {
      var item = document.createElement("div");
      item.className = "population-row";
      item.innerHTML =
        "<strong>" + htmlEscape(row.label) + "</strong>" +
        "<span>" + fmt(row.r, 2) + "</span>" +
        "<span>" + rowMetricCount(state.population.rows, row.a, row.b) + "</span>" +
        "<span>" + (row.r >= 0 ? "positive" : "negative") + "</span>";
      table.appendChild(item);
    });
    if ($("populationNote")) {
      $("populationNote").textContent = summary.n + " galaxies; r=" + fmt(summary.correlation, 3) + "; jackknife " + fmt(summary.jackknife.min, 2) + "-" + fmt(summary.jackknife.max, 2) + ".";
    }
  }

  function rowMetricCount(rows, a, b) {
    return rows.filter(function (row) {
      return Number.isFinite(routeMetricValue(row, a)) && Number.isFinite(routeMetricValue(row, b));
    }).length;
  }

  function drawPopulationPlot() {
    var svg = $("populationPlot");
    if (!svg) return;
    var width = 420;
    var height = 250;
    var plot = { left: 48, right: width - 18, top: 22, bottom: height - 42 };
    svg.innerHTML = "";
    var rows = state.population.rows && state.population.rows.length ? state.population.rows : populationCandidates();
    rows = rows.filter(function (row) {
      return Number.isFinite(routeMetricValue(row, state.population.x)) && Number.isFinite(routeMetricValue(row, state.population.y));
    });
    if (!rows.length) return;
    var xVals = rows.map(function (row) { return routeMetricValue(row, state.population.x); });
    var yVals = rows.map(function (row) { return routeMetricValue(row, state.population.y); });
    var xMin = Math.min.apply(null, xVals);
    var xMax = Math.max.apply(null, xVals);
    var yMin = Math.min.apply(null, yVals);
    var yMax = Math.max.apply(null, yVals);
    if (xMin === xMax) xMax = xMin + 1;
    if (yMin === yMax) yMax = yMin + 1;
    var xPad = (xMax - xMin) * 0.08;
    var yPad = (yMax - yMin) * 0.08;
    xMin -= xPad;
    xMax += xPad;
    yMin -= yPad;
    yMax += yPad;
    var xScale = function (v) { return plot.left + ((v - xMin) / (xMax - xMin)) * (plot.right - plot.left); };
    var yScale = function (v) { return plot.bottom - ((v - yMin) / (yMax - yMin)) * (plot.bottom - plot.top); };
    for (var i = 0; i <= 4; i += 1) {
      var xVal = xMin + (xMax - xMin) * i / 4;
      var yVal = yMin + (yMax - yMin) * i / 4;
      var x = xScale(xVal);
      var y = yScale(yVal);
      svg.appendChild(svgEl("line", { class: "plot-grid", x1: x, y1: plot.top, x2: x, y2: plot.bottom }));
      svg.appendChild(svgEl("line", { class: "plot-grid", x1: plot.left, y1: y, x2: plot.right, y2: y }));
      svg.appendChild(svgEl("text", { class: "plot-label", x: x - 8, y: height - 18 })).textContent = fmt(xVal, Math.abs(xVal) < 3 ? 1 : 0);
      svg.appendChild(svgEl("text", { class: "plot-label", x: 5, y: y + 3 })).textContent = fmt(yVal, Math.abs(yVal) < 3 ? 1 : 0);
    }
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.bottom, x2: plot.right, y2: plot.bottom }));
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.bottom }));
    svg.appendChild(svgEl("text", { class: "plot-label", x: plot.right - 70, y: height - 6 })).textContent = routeMetricInfo(state.population.x).label;
    svg.appendChild(svgEl("text", { class: "plot-label", x: 5, y: 12 })).textContent = routeMetricInfo(state.population.y).label;
    rows.forEach(function (row) {
      var point = svgEl("circle", {
        class: "route-point " + routeClassName(row.route),
        cx: xScale(routeMetricValue(row, state.population.x)),
        cy: yScale(routeMetricValue(row, state.population.y)),
        r: 4.2
      });
      point.appendChild(svgEl("title", {})).textContent = row.name + " | " + row.route;
      svg.appendChild(point);
    });
  }

  function populationCsv() {
    var headers = ["name", "route", "subset", "x_metric", "x_value", "y_metric", "y_value", "rmse_kms", "memory_load", "u_075", "ltg_curvature_a", "s_law_s", "summary_correlation", "bootstrap_p10", "bootstrap_p90", "jackknife_min", "jackknife_max"];
    var summary = state.population.summary;
    return rowsToCsv(headers, (state.population.rows || []).map(function (row) {
      return {
        name: row.name,
        route: row.route,
        subset: summary ? summary.subset : state.population.subset,
        x_metric: state.population.x,
        x_value: routeMetricValue(row, state.population.x),
        y_metric: state.population.y,
        y_value: routeMetricValue(row, state.population.y),
        rmse_kms: row.rmse,
        memory_load: row.memoryLoad,
        u_075: row.u075,
        ltg_curvature_a: row.ltgCurvatureA,
        s_law_s: row.sLawS,
        summary_correlation: summary ? summary.correlation : null,
        bootstrap_p10: summary ? summary.bootstrap.p10 : null,
        bootstrap_p90: summary ? summary.bootstrap.p90 : null,
        jackknife_min: summary ? summary.jackknife.min : null,
        jackknife_max: summary ? summary.jackknife.max : null
      };
    }));
  }

  function exportPopulationCsv() {
    if (!state.population.summary) runPopulationStats();
    if (!state.population.summary) return;
    downloadText("mts-population-" + slugify(state.population.subset + "-" + state.population.x + "-vs-" + state.population.y) + ".csv", populationCsv(), "text/csv;charset=utf-8");
    if ($("populationNote")) $("populationNote").textContent = "Prepared population table for " + state.population.summary.n + " galaxies.";
  }

  function updateFailureAnatomy() {
    var grid = $("failureGrid");
    if (!grid) return;
    var score = currentFrameworkScore();
    var route = state.route;
    var curve = state.curve;
    var cards;

    if (score) {
      var routeText = score.routePreserved ? "preserved" : score.baselineRouteId + " -> " + score.routeId;
      var biasText = Number.isFinite(score.outerBias) ? (score.outerBias >= 0 ? "+" : "") + fmt(score.outerBias, 2) + " km/s" : "--";
      cards = [
        ["Worst residual", (score.worstResidual >= 0 ? "+" : "") + fmt(score.worstResidual, 2) + " km/s"],
        ["Worst radius", fmt(score.worstR, 2) + " kpc"],
        ["Dominant band", score.dominantBand],
        ["Outer RMSE", fmt(score.outerRmse, 2) + " km/s"],
        ["Outer bias", biasText],
        ["Route check", routeText],
        ["x_cross error", score.xCrossError == null ? "--" : fmt(score.xCrossError, 3)],
        ["Invalid points", score.invalidCount]
      ];
    } else if (curve && route) {
      var fitRows = fitCorrelationRows();
      if (fitRows.length) {
        var fit = fitCorrelationStats(fitRows);
        var bands = residualBandSummaries(fitRows);
        var worst = worstResidualRows(fitRows, 1)[0];
        var dominant = bands.slice().sort(function (a, b) {
          return safeNumber(b.rmse, -1) - safeNumber(a.rmse, -1);
        })[0];
        cards = [
          ["Worst point", "r " + fmt(worst.r, 2) + " kpc"],
          ["Worst residual", (worst.residual >= 0 ? "+" : "") + fmt(worst.residual, 2) + " km/s"],
          ["Dominant band", dominant && dominant.count ? dominant.label.toLowerCase() : "--"],
          ["Outer RMSE", fmt(bands[2].rmse, 2) + " km/s"],
          ["Mean bias", (fit.bias >= 0 ? "+" : "") + fmt(fit.bias, 2) + " km/s"],
          ["Fit r", fmt(fit.corr, 3)],
          ["Points", String(fit.count)],
          ["Route", route.id]
        ];
      } else {
      cards = [
        ["Route", route.id],
        ["Outer viable", route.outerViable ? "yes" : "no"],
        ["u_out", fmt(route.uOut, 3)],
        ["u_max", fmt(route.uMax, 3)],
        ["x_cross", route.xCrossNorm == null ? "--" : fmt(route.xCrossNorm, 3)],
        ["RMSE", curve.rmse == null ? "--" : fmt(curve.rmse, 2) + " km/s"]
      ];
      }
    } else {
      cards = [["Status", "No active curve"]];
    }

    $("failureStatus").textContent = score ? "custom framework" : "baseline";
    grid.innerHTML = "";
    cards.forEach(function (card) {
      var item = document.createElement("div");
      item.className = "failure-card";
      item.innerHTML = "<span>" + htmlEscape(card[0]) + "</span><strong>" + htmlEscape(card[1]) + "</strong>";
      grid.appendChild(item);
    });
  }

  function updateTrustPanel() {
    if (!$("trustHash") || !state.curve || !state.route) return;
    var capsule = buildCapsule();
    var hash = capsuleHash(capsule);
    $("trustStatus").textContent = "capsule ready";
    $("trustHash").textContent = hash;
    $("trustMode").textContent = state.curve.kind;
    $("trustRoute").textContent = state.route.id;
    $("trustPoints").textContent = state.curve.points.length;
  }

  function etgV18Note(curve) {
    if (!curve || curve.kind !== "etg") return "";
    if (curve.name === "NGC3626") {
      return "NGC3626 is the named v18 sensitivity case: it is the only HL11 jackknife leave-out where R85 preference reverses against R80.";
    }
    if (curve.name === "NGC3998") {
      return "NGC3998 is the clean-HL exclusion that unlocks the strongest Stage-4 row: HL11-noNGC3998 R85 LOO=0.156.";
    }
    if (curve.name === "NGC3838") {
      return "NGC3838 drives the Full16 geometry preference; removing it reverses the full-sample geometry comparison.";
    }
    return "v18 Stage-4 geometry: R85 beats R80 in all five guard samples and is strongest in the HL11-noNGC3998 row.";
  }

  function updateV18Panel() {
    if (!$("v18Status") || !state.curve || !state.route) return;
    var curve = state.curve;
    var route = state.route;
    if (curve.kind === "etg") {
      $("v18Status").textContent = "Stage-4 R85";
      $("v18MetricALabel").textContent = "R85";
      $("v18MetricA").textContent = curve.stage4.r85 == null ? "--" : fmt(curve.stage4.r85, 2);
      $("v18MetricBLabel").textContent = "r_out/R85";
      $("v18MetricB").textContent = curve.stage4.rOutOverR85 == null ? "--" : fmt(curve.stage4.rOutOverR85, 2);
      $("v18MetricCLabel").textContent = "ETG A";
      $("v18MetricC").textContent = route.etgCurvatureA == null ? "--" : fmt(route.etgCurvatureA, 3);
      $("v18MetricDLabel").textContent = "S-law dU";
      $("v18MetricD").textContent = route.innerLaw && route.innerLaw.residual != null ? fmt(route.innerLaw.residual, 3) : "--";
      $("v18Note").textContent = etgV18Note(curve);
      return;
    }

    $("v18Status").textContent = route.supercriticalU075 ? "supercritical u_0.75" : "LTG v18 route";
    $("v18MetricALabel").textContent = "Priority L";
    $("v18MetricA").textContent = route.priorityL == null ? "--" : fmt(route.priorityL, 1);
    $("v18MetricBLabel").textContent = "Diagnostic L3";
    $("v18MetricB").textContent = route.priorityL3 == null ? "--" : fmt(route.priorityL3, 1);
    $("v18MetricCLabel").textContent = "LTG A";
    $("v18MetricC").textContent = route.ltgCurvatureA == null ? "--" : fmt(route.ltgCurvatureA, 3);
    $("v18MetricDLabel").textContent = "S-law dU";
    $("v18MetricD").textContent = route.innerLaw && route.innerLaw.residual != null ? fmt(route.innerLaw.residual, 3) : "--";
    if (route.supercriticalU075) {
      $("v18Note").textContent = "u_0.75 > 1 marks the v18 supercritical late-load sub-population. L3 is diagnostic only; canonical Priority L remains g + L_gap.";
    } else if (route.id === "buffered single-crossing") {
      $("v18Note").textContent = "Canonical v18 Priority L uses -10.315 + 8.645*g + 10.508*L_gap. LTG curvature uses A = -2.671 + 2.735/sqrt(u_0.75).";
    } else {
      $("v18Note").textContent = "S-law and curvature are shown for the active profile; Priority L is primarily a single-crossing outer-error diagnostic.";
    }
  }

  function updateV18ReviewPanel() {
    if (!$("v18ReviewStatus")) return;
    var active = isV18ReviewActive();
    var artifact = window.MTS_V18_01_REVIEW_CANDIDATE || null;
    var gate = (artifact && artifact.metadata && artifact.metadata.reviewGate) || V18_REVIEW_GATE;
    var artifactCount = artifact && artifact.metadata ? artifact.metadata.curveCount : 0;
    $("v18ReviewStatus").textContent = active ? "active" : "ready";
    $("v18ReviewHighGain").textContent = fmt(gate.nominalHighGainPct, 2) + "%";
    $("v18ReviewHoldout").textContent = fmt(gate.holdoutHighGainPct, 2) + "%";
    $("v18ReviewStress").textContent = String(gate.stressAbove20);
    $("v18ReviewNullMargin").textContent = fmt(gate.nullMarginKmS, 2);
    $("v18ReviewProtected").textContent = String(gate.activeProtectedWorseCount);
    $("v18ReviewDiff").textContent = String(gate.nominalDiffVsV1797Count);
    if ($("v18ReviewArtifactCount")) $("v18ReviewArtifactCount").textContent = artifact && artifact.metadata ? String(artifact.metadata.curveCount) : "--";
    if ($("v18ReviewCleanCount")) $("v18ReviewCleanCount").textContent = artifact && artifact.metadata ? String(artifact.metadata.cleanCurveCount) : "--";
    if ($("v18ReviewWeakCount")) $("v18ReviewWeakCount").textContent = artifact && artifact.metadata ? String(artifact.metadata.weakSystematicsExcludedCount) : "--";
    if ($("v18ReviewNote")) {
      $("v18ReviewNote").textContent = active
        ? "Active preset uses the generated v18.01 artifact with " + artifactCount + " cached curves. The v18 review gate adds the baryon-confidence stress guard: no stress cases remain above 20 km/s, active protected worsens stay at 0, and the hardening margin over the best null is " + fmt(gate.nullMarginKmS, 2) + " km/s."
        : "Select MTS v18.01 review candidate in the Test Rig to inspect the generated artifact. Nominal curves remain the v17.97 exact cache; the v18 addition is the stress/quality guard validated by the promotion gate.";
    }
  }

  function sortedNames(values) {
    return values.slice().sort(function (a, b) {
      return String(a).localeCompare(String(b));
    });
  }

  function sameNameSet(actual, expected) {
    var a = sortedNames(actual);
    var e = sortedNames(expected);
    if (a.length !== e.length) return false;
    for (var i = 0; i < a.length; i += 1) {
      if (a[i] !== e[i]) return false;
    }
    return true;
  }

  function claimMismatchNote(actual, expected) {
    var actualSet = {};
    var expectedSet = {};
    actual.forEach(function (name) { actualSet[name] = true; });
    expected.forEach(function (name) { expectedSet[name] = true; });
    var missing = sortedNames(expected.filter(function (name) { return !actualSet[name]; }));
    var extra = sortedNames(actual.filter(function (name) { return !expectedSet[name]; }));
    var parts = [];
    if (missing.length) parts.push("missing " + missing.join(", "));
    if (extra.length) parts.push("extra " + extra.join(", "));
    return parts.length ? parts.join("; ") : "membership matches locked list";
  }

  function claimRow(id, label, expected, actual, pass, note) {
    return {
      id: id,
      label: label,
      expected: expected,
      actual: actual,
      pass: Boolean(pass),
      note: note || ""
    };
  }

  function ltgRouteCounts() {
    var counts = {
      total: state.ltgIndex.length,
      low: 0,
      cdc: 0,
      upward: 0,
      single: 0,
      infeasible: 0,
      late: 0
    };
    state.ltgIndex.forEach(function (row) {
      if (row.route === "low-load") counts.low += 1;
      if (row.route === "CDC-low-load") {
        counts.low += 1;
        counts.cdc += 1;
      }
      if (row.route === "buffered upward-crossing") counts.upward += 1;
      if (row.route === "buffered single-crossing") counts.single += 1;
      if (row.route === "outer-infeasible") counts.infeasible += 1;
      if (row.lateLoad) counts.late += 1;
    });
    return counts;
  }

  function priorityStrictRows() {
    return state.ltgIndex.filter(function (row) {
      return row.route === "buffered single-crossing" && row.hGuard;
    });
  }

  function activeLtgIndexRow() {
    if (!state.curve || state.curve.kind !== "observed") return null;
    return state.ltgIndex.find(function (row) {
      return row.name === state.curve.name;
    }) || null;
  }

  function lockedEtgCount() {
    return Object.keys(ETG_LOCKED).filter(function (name) {
      return ETG_LOCKED[name].r85 != null;
    }).length;
  }

  function buildClaimRows() {
    var counts = ltgRouteCounts();
    var strictRows = priorityStrictRows();
    var strictNames = sortedNames(strictRows.map(function (row) { return row.name; }));
    var cleanNames = sortedNames(strictNames.filter(function (name) { return name !== "UGC03580"; }));
    var supercriticalNames = sortedNames(strictRows.filter(function (row) {
      return row.supercriticalU075;
    }).map(function (row) {
      return row.name;
    }));
    var topFiveNames = strictRows.slice().sort(function (a, b) {
      return safeNumber(b.priorityL, -Infinity) - safeNumber(a.priorityL, -Infinity);
    }).slice(0, 5).map(function (row) {
      return row.name;
    });
    var sLawCount = state.ltgIndex.filter(function (row) {
      return Number.isFinite(row.sLawS) && Number.isFinite(row.sLawResidual);
    }).length;

    return [
      claimRow("ltg-total", "LTG sample count", "175", String(counts.total), counts.total === 175, "Bundled SPARC index should contain all 175 LTGs."),
      claimRow("route-low", "Low incl CDC", "81", String(counts.low), counts.low === 81, "Low-load total includes the CDC-low-load sub-route."),
      claimRow("route-cdc", "CDC-low systems", "17", String(counts.cdc), counts.cdc === 17, "Central-deficit low-load route with u0 < 0."),
      claimRow("route-up", "Upward crossings", "52", String(counts.upward), counts.upward === 52, "Buffered upward-crossing route count."),
      claimRow("route-single", "Single crossings", "25", String(counts.single), counts.single === 25, "Buffered single-crossing route count."),
      claimRow("route-infeasible", "Outer infeasible", "17", String(counts.infeasible), counts.infeasible === 17, "Systems with u_out >= 1."),
      claimRow("priority-strict", "Priority L strict set", "19 names", String(strictNames.length) + " names", sameNameSet(strictNames, PRIORITY_L_STRICT_NAMES), claimMismatchNote(strictNames, PRIORITY_L_STRICT_NAMES)),
      claimRow("priority-clean", "Clean strict set", "18 names", String(cleanNames.length) + " names", sameNameSet(cleanNames, PRIORITY_L_CLEAN_NAMES), claimMismatchNote(cleanNames, PRIORITY_L_CLEAN_NAMES)),
      claimRow("priority-top5", "Priority L top five", PRIORITY_L_TOP5_NAMES.join(", "), topFiveNames.join(", "), sameNameSet(topFiveNames, PRIORITY_L_TOP5_NAMES), claimMismatchNote(topFiveNames, PRIORITY_L_TOP5_NAMES)),
      claimRow("supercritical", "Supercritical u_0.75", SUPERCRITICAL_U075_NAMES.join(", "), supercriticalNames.join(", "), sameNameSet(supercriticalNames, SUPERCRITICAL_U075_NAMES), claimMismatchNote(supercriticalNames, SUPERCRITICAL_U075_NAMES)),
      claimRow("late-load", "Late-load final", "5", String(counts.late), counts.late === 5, "u_out > 0.64 and h/r_out > 0.095 inside the strict single-crossing guard."),
      claimRow("etg-r85", "ETG locked R85 rows", "15", String(lockedEtgCount()), lockedEtgCount() === 15, "UGC6176 remains the no-R85 guard row."),
      claimRow("ngc3626-r85", "NGC3626 R85", "7.600", fmt(ETG_LOCKED.NGC3626.r85, 3), Math.abs(ETG_LOCKED.NGC3626.r85 - 7.600) < 0.0005, "Named v18 sensitivity case."),
      claimRow("ngc3998-r85", "NGC3998 R85", "4.799", fmt(ETG_LOCKED.NGC3998.r85, 3), Math.abs(ETG_LOCKED.NGC3998.r85 - 4.799) < 0.0005, "Clean-HL exclusion row."),
      claimRow("s-law-live", "Inner S-law live", ">=120", String(sLawCount), sLawCount >= 120, "Counts live LTG profiles with valid S and residual diagnostics.")
    ];
  }

  function updateClaimPanel() {
    var table = $("claimTable");
    if (!table) return;
    var rows = state.claims.rows || [];
    table.innerHTML = "";
    if (!rows.length) {
      $("claimStatus").textContent = "not run";
      var empty = document.createElement("div");
      empty.className = "claim-row";
      empty.innerHTML = "<strong>No claim run</strong><span>--</span><span class=\"claim-note\">ready</span>";
      table.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var item = document.createElement("div");
      item.className = "claim-row " + (row.pass ? "pass" : "fail");
      item.title = "Expected: " + row.expected + "\nActual: " + row.actual + (row.note ? "\n" + row.note : "");
      item.innerHTML =
        "<strong>" + htmlEscape(row.label) + "</strong>" +
        "<span>" + (row.pass ? "pass" : "review") + "</span>" +
        "<span class=\"claim-note\">" + htmlEscape(row.actual) + "</span>";
      table.appendChild(item);
    });
    var passed = rows.filter(function (row) { return row.pass; }).length;
    var failed = rows.length - passed;
    $("claimStatus").textContent = passed + "/" + rows.length + " pass";
    if ($("reproduceNote")) {
      $("reproduceNote").textContent = failed
        ? "Claims ran with " + failed + " item(s) marked for review. Hover rows for locked expected values."
        : "Claims reproduce against the bundled LTG and ETG locks.";
    }
  }

  function runPaperChecks() {
    var rows = buildClaimRows();
    var passed = rows.filter(function (row) { return row.pass; }).length;
    state.claims.rows = rows;
    state.claims.summary = {
      generatedAt: new Date().toISOString(),
      total: rows.length,
      passed: passed,
      failed: rows.length - passed
    };
    updateClaimPanel();
    updateTrustPanel();
    updateCasePanel();
  }

  function claimTableHtml() {
    if (!state.claims.rows.length) runPaperChecks();
    return state.claims.rows.map(function (row) {
      return "<tr><td>" + htmlEscape(row.id) + "</td><td>" + htmlEscape(row.label) + "</td><td>" + htmlEscape(row.expected) + "</td><td>" + htmlEscape(row.actual) + "</td><td>" + (row.pass ? "pass" : "review") + "</td><td>" + htmlEscape(row.note) + "</td></tr>";
    }).join("");
  }

  function buildPaperClaimReportHtml() {
    if (!state.claims.rows.length) runPaperChecks();
    var summary = state.claims.summary || {};
    var rows = [
      ["Generated", summary.generatedAt || new Date().toISOString()],
      ["Claim checks", (summary.passed || 0) + " passed / " + (summary.total || 0)],
      ["LTG bundled rows", state.ltgIndex.length],
      ["ETG bundled rows", (window.MTS_ETG_SAMPLES || []).length],
      ["Strict Priority L lock", PRIORITY_L_STRICT_NAMES.join(", ")],
      ["Supercritical lock", SUPERCRITICAL_U075_NAMES.join(", ")]
    ];
    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>MTS paper claim validator</title><style>" + reportCss() + ".claim-pass{color:#246b4a}.claim-review{color:#9b372f}.score-table td:nth-child(5){font-weight:800}</style></head>",
      "<body><main>",
      "<header><div><h1>Paper Claim Validator</h1><p>MTS Galaxy Lab reproducibility report</p><p>Generated " + htmlEscape(summary.generatedAt || new Date().toISOString()) + "</p></div><div class=\"hash\">" + htmlEscape(capsuleHash(buildCapsule())) + "</div></header>",
      "<section class=\"panel\"><h2>Reproduction Summary</h2><table><tbody>" + tableRowsHtml(rows) + "</tbody></table></section>",
      "<section class=\"panel\"><h2>Locked Claim Checks</h2><table class=\"score-table\"><thead><tr><th>ID</th><th>Claim</th><th>Expected</th><th>Actual</th><th>Status</th><th>Note</th></tr></thead><tbody>" + claimTableHtml() + "</tbody></table></section>",
      "<section class=\"plots\">",
      exportPlotPanel("Active Rotation Curve", "curvePlot"),
      exportPlotPanel("Active Residual View", "residualPlot"),
      state.ltgIndex.length ? exportPlotPanel("Route-Space Map", "routeMapPlot") : "",
      "</section>",
      "<footer>Claim rows are computed from the bundled browser data and locked v18 constants in this static app.</footer>",
      "</main></body></html>"
    ].join("");
  }

  function exportPaperReport() {
    runPaperChecks();
    downloadText("mts-paper-claim-validator.html", buildPaperClaimReportHtml(), "text/html;charset=utf-8");
    if ($("reproduceNote")) $("reproduceNote").textContent = "Prepared mts-paper-claim-validator.html";
  }

  function caseMembershipFlags() {
    var curve = state.curve;
    if (!curve) return [];
    var flags = [];
    if (curve.kind === "observed") {
      var row = activeLtgIndexRow();
      var name = curve.name;
      if (PRIORITY_L_STRICT_NAMES.indexOf(name) !== -1) flags.push("Priority L strict");
      if (PRIORITY_L_CLEAN_NAMES.indexOf(name) !== -1) flags.push("clean strict");
      if (PRIORITY_L_TOP5_NAMES.indexOf(name) !== -1) flags.push("top-five");
      if (SUPERCRITICAL_U075_NAMES.indexOf(name) !== -1) flags.push("supercritical");
      if (row && row.lateLoad) flags.push("late-load");
      if (row && row.cdc) flags.push("CDC");
      if (row && row.route === "outer-infeasible") flags.push("outer infeasible");
    }
    if (curve.kind === "etg") {
      if (curve.stage4 && curve.stage4.r85 != null) flags.push("locked R85");
      if (curve.name === "NGC3626") flags.push("R85 sensitivity");
      if (curve.name === "NGC3998") flags.push("clean-HL exclusion");
      if (curve.name === "UGC6176") flags.push("no-R85 guard");
    }
    if (curve.kind === "synthetic") {
      if (curve.forge) flags.push("forge");
      if (state.evolution.t > 0) flags.push("evolution");
    }
    return flags;
  }

  function caseRows() {
    var curve = state.curve;
    var route = state.route;
    if (!curve || !route) return [];
    var frameworkScore = currentFrameworkScore();
    var comparisonScore = currentComparisonScore();
    var flags = caseMembershipFlags();
    var provenance = curveProvenance(curve);
    var rows = [
      ["Galaxy", curve.name],
      ["Mode", curve.kind],
      ["Route", route.id],
      ["Points", curve.points.length],
      ["Capsule hash", capsuleHash(buildCapsule())],
      ["Source", provenance.repoSource],
      ["Parser", provenance.parserVersion],
      ["Raw checksum", provenance.rawFileChecksum],
      ["Feature checksum", provenance.processedFeatureChecksum],
      ["u0", fmt(route.u0, 4)],
      ["u_out", fmt(route.uOut, 4)],
      ["u_max", fmt(route.uMax, 4)],
      ["x_cross", route.xCrossNorm == null ? "--" : fmt(route.xCrossNorm, 4)],
      ["Claim flags", flags.length ? flags.join(", ") : "none"]
    ];

    if (curve.kind !== "synthetic") {
      var fit = fitCorrelationStats();
      var bands = residualBandSummaries();
      rows.push(["Fit correlation r", fmt(fit.corr, 4)]);
      rows.push(["Fit RMSE", fmt(fit.rmse, 4) + " km/s"]);
      rows.push(["Fit bias", (fit.bias >= 0 ? "+" : "") + fmt(fit.bias, 4) + " km/s"]);
      rows.push(["Fit outer RMSE", fmt(fit.outerRmse, 4) + " km/s"]);
      rows.push(["Residual band inner", fmt(bands[0].rmse, 4) + " km/s"]);
      rows.push(["Residual band mid", fmt(bands[1].rmse, 4) + " km/s"]);
      rows.push(["Residual band outer", fmt(bands[2].rmse, 4) + " km/s"]);
    }

    if (curve.kind === "etg") {
      rows.push(["h", fmt(curve.h, 3) + " kpc"]);
      rows.push(["R80", curve.stage4.r80 == null ? "--" : fmt(curve.stage4.r80, 3) + " kpc"]);
      rows.push(["R85", curve.stage4.r85 == null ? "--" : fmt(curve.stage4.r85, 3) + " kpc"]);
      rows.push(["R90", curve.stage4.r90 == null ? "--" : fmt(curve.stage4.r90, 3) + " kpc"]);
      rows.push(["r_out/R85", curve.stage4.rOutOverR85 == null ? "--" : fmt(curve.stage4.rOutOverR85, 4)]);
      rows.push(["logy", fmt(curve.stage4.logy, 4)]);
      rows.push(["ETG curvature A", route.etgCurvatureA == null ? "--" : fmt(route.etgCurvatureA, 4)]);
    } else {
      rows.push(["h", fmt(curve.h, 3) + " kpc"]);
      rows.push(["r_out", fmt(curve.rOut, 3) + " kpc"]);
      rows.push(["f_gas_out", fmt(curve.fGasOut, 4)]);
      rows.push(["L_eff", fmt(curve.leff, 4) + " kpc"]);
      rows.push(["memory load", fmt(curve.memoryLoad, 4)]);
      rows.push(["RMSE", curve.rmse == null ? "--" : fmt(curve.rmse, 4) + " km/s"]);
      rows.push(["Priority L", route.priorityL == null ? "--" : fmt(route.priorityL, 4)]);
      rows.push(["Priority L3", route.priorityL3 == null ? "--" : fmt(route.priorityL3, 4)]);
      rows.push(["u_0.75", Number.isFinite(route.u075) ? fmt(route.u075, 4) : "--"]);
      rows.push(["LTG curvature A", route.ltgCurvatureA == null ? "--" : fmt(route.ltgCurvatureA, 4)]);
      if (curve.kind === "synthetic") {
        rows.push(["Forge preset", curve.forge ? curve.forge.label : "manual"]);
        rows.push(["Evolution track", currentEvolutionTrack().label]);
        rows.push(["Evolution epoch", fmt(state.evolution.t, 4)]);
      }
    }

    if (route.innerLaw) {
      rows.push(["S-law S", fmt(route.innerLaw.s, 4)]);
      rows.push(["S-law predicted Umax", fmt(route.innerLaw.predictedUmax, 4)]);
      rows.push(["S-law residual", fmt(route.innerLaw.residual, 4)]);
    }
    if (frameworkScore) {
      rows.push(["Formula A RMSE", fmt(frameworkScore.rmse, 4) + " km/s"]);
      rows.push(["Formula A route", frameworkScore.routeId]);
    }
    if (comparisonScore) {
      rows.push(["Formula B RMSE", fmt(comparisonScore.rmse, 4) + " km/s"]);
      rows.push(["Formula B route", comparisonScore.routeId]);
      if (frameworkScore) rows.push(["A/B winner", comparisonWinnerText(frameworkScore, comparisonScore)]);
    }
    var uncertainty = currentUncertaintySummary();
    if (uncertainty) {
      rows.push(["Uncertainty trials", uncertainty.trials]);
      rows.push(["Route stability", fmt(uncertainty.routeStability * 100, 1) + "%"]);
      rows.push(["Dominant perturbed route", uncertainty.dominantRoute]);
      rows.push(["Perturbed RMSE p90", fmt(uncertainty.p90Rmse, 4) + " km/s"]);
    }
    var scienceQa = currentScienceQaSummary();
    if (scienceQa) {
      rows.push(["Scientific QA schema", scienceQa.schemaPass + " pass / " + scienceQa.schemaWarn + " warn / " + scienceQa.schemaFail + " fail"]);
      rows.push(["Scientific QA provenance", scienceQa.provenancePass + " pass / " + scienceQa.provenanceWarn + " warn / " + scienceQa.provenanceFail + " fail"]);
      rows.push(["Scientific QA error bars", scienceQa.errorBarCount + "/" + scienceQa.pointCount]);
    }
    return rows;
  }

  function caseNoteText() {
    var curve = state.curve;
    if (!curve) return "Load a galaxy to generate a case file.";
    var flags = caseMembershipFlags();
    if (curve.kind === "observed") {
      return flags.length ? "Paper memberships: " + flags.join(", ") + "." : "Observed LTG with no locked paper-membership flag.";
    }
    if (curve.kind === "etg") {
      return etgV18Note(curve) || "ETG Stage-4 case file using locked outer geometry.";
    }
    if (curve.forge) {
      return "Synthetic forge case: " + curve.forge.label + " stress test, seed " + curve.forge.seed + ".";
    }
    return "Manual synthetic case with current sliders and view state.";
  }

  function updateCasePanel() {
    var grid = $("caseGrid");
    if (!grid) return;
    var rows = caseRows();
    grid.innerHTML = "";
    if (!rows.length) {
      $("caseStatus").textContent = "empty";
      $("caseNote").textContent = "Load a galaxy to generate a case file.";
      return;
    }
    rows.slice(0, 8).forEach(function (row) {
      var item = document.createElement("div");
      item.className = "case-card";
      item.innerHTML = "<span>" + htmlEscape(row[0]) + "</span><strong>" + htmlEscape(row[1]) + "</strong>";
      grid.appendChild(item);
    });
    $("caseStatus").textContent = state.curve.kind + " case";
    $("caseNote").textContent = caseNoteText();
  }

  function gaussianFrom(rand) {
    var u1 = Math.max(0.000001, rand());
    var u2 = Math.max(0.000001, rand());
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
  }

  function finiteValues(rows, key) {
    return rows.map(function (row) { return row[key]; }).filter(Number.isFinite).sort(function (a, b) { return a - b; });
  }

  function quantileFinite(rows, key, q) {
    var values = finiteValues(rows, key);
    if (!values.length) return NaN;
    var pos = clamp(q, 0, 1) * (values.length - 1);
    var lo = Math.floor(pos);
    var hi = Math.ceil(pos);
    if (lo === hi) return values[lo];
    return values[lo] * (hi - pos) + values[hi] * (pos - lo);
  }

  function perturbedCurve(config, trialIndex) {
    var base = state.curve;
    var seedText = base.name + ":" + base.kind + ":" + config.noisePct + ":" + config.mlPct + ":" + trialIndex;
    var rand = randomFromSeed(hashName(seedText));
    var mlDisk = CONST.mlDisk * Math.max(0.05, 1 + gaussianFrom(rand) * config.mlPct / 100);
    var mlBulge = CONST.mlBulge * Math.max(0.05, 1 + gaussianFrom(rand) * config.mlPct / 100);
    var qValue = Number.isFinite(base.q) ? base.q : CONST.qDefault;
    var leff = Number.isFinite(base.leff) ? base.leff : base.rOut;
    var sse = 0;
    var count = 0;
    var points = base.points.map(function (point) {
      var target = Number.isFinite(point.vObs) ? point.vObs : point.vTotal;
      var noise = gaussianFrom(rand) * config.noisePct / 100;
      var vObs = Math.max(0, target * (1 + noise));
      var bar2 = point.vGas * point.vGas + mlDisk * point.vDisk * point.vDisk + mlBulge * point.vBulge * point.vBulge;
      var support2 = base.kind === "etg"
        ? Math.max(0, vObs * vObs - bar2)
        : CONST.gamma0 * leff * (1 - Math.exp(-Math.pow(point.r / leff, qValue)));
      var model = Math.sqrt(Math.max(0, bar2 + support2));
      var residual = model - vObs;
      sse += residual * residual;
      count += 1;
      return {
        r: point.r,
        vDisk: point.vDisk,
        vGas: point.vGas,
        vBulge: point.vBulge,
        vBar: Math.sqrt(Math.max(0, bar2)),
        vMts: Math.sqrt(Math.max(0, support2)),
        vTotal: model,
        vObs: vObs,
        u: (vObs * vObs - mlDisk * point.vDisk * point.vDisk - mlBulge * point.vBulge * point.vBulge) /
          (CONST.gamma0 * point.r * CONST.rMax)
      };
    });
    return {
      kind: base.kind,
      name: base.name,
      h: base.h,
      rOut: base.rOut,
      fGasOut: base.fGasOut,
      q: qValue,
      leff: base.leff,
      memoryLoad: base.memoryLoad,
      rmse: count ? Math.sqrt(sse / count) : NaN,
      points: points,
      stage4: base.stage4 || null,
      forge: base.forge || null
    };
  }

  function currentUncertaintySummary() {
    var summary = state.uncertainty.summary;
    if (!summary || !state.curve) return null;
    if (summary.curveName !== state.curve.name || summary.curveKind !== state.curve.kind) return null;
    if (summary.noisePct !== state.uncertainty.noisePct || summary.mlPct !== state.uncertainty.mlPct || summary.trials !== state.uncertainty.trials) return null;
    return summary;
  }

  function runUncertainty() {
    if (!state.curve || !state.route) return;
    var config = readUncertaintyConfig();
    var baseRoute = state.route.id;
    var rows = [];
    var routeCounts = {};
    for (var i = 0; i < config.trials; i += 1) {
      var curve = perturbedCurve(config, i + 1);
      var route = classifyRoute(curve.points, curve);
      routeCounts[route.id] = (routeCounts[route.id] || 0) + 1;
      rows.push({
        trial: i + 1,
        route: route.id,
        rmse: curve.rmse,
        uOut: route.uOut,
        uMax: route.uMax,
        xCross: route.xCrossNorm,
        priorityL: route.priorityL,
        supercriticalU075: route.supercriticalU075,
        routePreserved: route.id === baseRoute
      });
    }
    var dominantRoute = Object.keys(routeCounts).sort(function (a, b) {
      return routeCounts[b] - routeCounts[a];
    })[0] || "--";
    var preserved = rows.filter(function (row) { return row.routePreserved; }).length;
    var uOutValues = finiteValues(rows, "uOut");
    state.uncertainty.rows = rows;
    state.uncertainty.summary = {
      curveName: state.curve.name,
      curveKind: state.curve.kind,
      generatedAt: new Date().toISOString(),
      noisePct: config.noisePct,
      mlPct: config.mlPct,
      trials: config.trials,
      baseRoute: baseRoute,
      dominantRoute: dominantRoute,
      routeCounts: routeCounts,
      routeStability: rows.length ? preserved / rows.length : NaN,
      medianRmse: quantileFinite(rows, "rmse", 0.5),
      p90Rmse: quantileFinite(rows, "rmse", 0.9),
      uOutMin: uOutValues.length ? uOutValues[0] : NaN,
      uOutMax: uOutValues.length ? uOutValues[uOutValues.length - 1] : NaN,
      xCrossMedian: quantileFinite(rows, "xCross", 0.5)
    };
    updateUncertaintyPanel();
    updateTrustPanel();
    updateCasePanel();
  }

  function updateUncertaintyPanel() {
    var table = $("uncertaintyTable");
    if (!table) return;
    var summary = currentUncertaintySummary();
    table.innerHTML = "";
    if (!summary) {
      $("uncertaintyStatus").textContent = "not run";
      $("uncertaintyRouteRate").textContent = "--";
      $("uncertaintyDominantRoute").textContent = "--";
      $("uncertaintyRmseMedian").textContent = "--";
      $("uncertaintyUoutRange").textContent = "--";
      table.innerHTML = '<div class="uncertainty-row"><span class="rank">--</span><strong>Run active case</strong><span>--</span><span>--</span><span>--</span></div>';
      return;
    }
    $("uncertaintyStatus").textContent = summary.trials + " trials";
    $("uncertaintyRouteRate").textContent = fmt(summary.routeStability * 100, 0) + "%";
    $("uncertaintyDominantRoute").textContent = summary.dominantRoute;
    $("uncertaintyRmseMedian").textContent = fmt(summary.medianRmse, 2);
    $("uncertaintyUoutRange").textContent = fmt(summary.uOutMin, 2) + "-" + fmt(summary.uOutMax, 2);
    state.uncertainty.rows.slice(0, 12).forEach(function (row) {
      var item = document.createElement("div");
      item.className = "uncertainty-row";
      item.innerHTML =
        '<span class="rank">' + row.trial + "</span>" +
        "<strong>" + htmlEscape(row.route) + "</strong>" +
        "<span>" + fmt(row.rmse, 1) + "</span>" +
        "<span>" + fmt(row.uOut, 2) + "</span>" +
        '<span class="' + (row.routePreserved ? "delta-good" : "delta-bad") + '">' + (row.routePreserved ? "same" : "flip") + "</span>";
      table.appendChild(item);
    });
    if ($("uncertaintyNote")) {
      $("uncertaintyNote").textContent = "Route stability " + fmt(summary.routeStability * 100, 0) + "% over " + summary.trials + " trials. Median RMSE " + fmt(summary.medianRmse, 2) + " km/s.";
    }
  }

  function uncertaintyCsv() {
    var headers = [
      "galaxy",
      "mode",
      "noise_pct",
      "ml_jitter_pct",
      "trial",
      "route",
      "route_preserved",
      "rmse_kms",
      "u_out",
      "u_max",
      "x_cross",
      "priority_l",
      "supercritical_u075"
    ];
    var summary = currentUncertaintySummary();
    return rowsToCsv(headers, (state.uncertainty.rows || []).map(function (row) {
      return {
        galaxy: summary ? summary.curveName : "",
        mode: summary ? summary.curveKind : "",
        noise_pct: summary ? summary.noisePct : state.uncertainty.noisePct,
        ml_jitter_pct: summary ? summary.mlPct : state.uncertainty.mlPct,
        trial: row.trial,
        route: row.route,
        route_preserved: row.routePreserved,
        rmse_kms: row.rmse,
        u_out: row.uOut,
        u_max: row.uMax,
        x_cross: row.xCross,
        priority_l: row.priorityL,
        supercritical_u075: row.supercriticalU075
      };
    }));
  }

  function exportUncertaintyCsv() {
    if (!currentUncertaintySummary()) runUncertainty();
    if (!currentUncertaintySummary()) return;
    downloadText("mts-uncertainty-" + slugify(state.curve.name) + ".csv", uncertaintyCsv(), "text/csv;charset=utf-8");
  }

  function scienceQaRow(type, label, status, value, note) {
    return {
      type: type,
      label: label,
      status: status,
      value: value == null ? "--" : String(value),
      note: note || ""
    };
  }

  function scienceQaKnown(value) {
    if (value == null) return false;
    var text = String(value).trim();
    return Boolean(text) && !/^(not supplied|unknown|not available|null|undefined|workspace-no-git)$/i.test(text);
  }

  function scienceQaCounts(rows) {
    return rows.reduce(function (acc, row) {
      acc.total += 1;
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, { total: 0, pass: 0, warn: 0, fail: 0 });
  }

  function curveProvenance(curve) {
    if (!curve) return defaultScienceProvenance("synthetic", "none", "");
    if (!curve.provenance) {
      return attachProcessedProvenance(curve, defaultScienceProvenance(curve.kind, curve.name, curve.raw || curve.name)).provenance;
    }
    if (!curve.provenance.processedFeatureChecksum) {
      curve.provenance.processedFeatureChecksum = featureChecksum(curve);
    }
    return curve.provenance;
  }

  function provenanceCheckRows(curve) {
    var p = curveProvenance(curve);
    return [
      scienceQaRow("provenance", "repo/source", scienceQaKnown(p.repoSource) ? "pass" : "fail", p.repoSource, "Dataset source carried with the active record."),
      scienceQaRow("provenance", "file path", scienceQaKnown(p.filePath) ? "pass" : "fail", p.filePath, "Exact bundle path, generated source, paste slot, or imported filename."),
      scienceQaRow("provenance", "commit hash", /^([a-f0-9]{7,40})$/i.test(String(p.commitHash || "")) ? "pass" : "warn", p.commitHash, "Git is unavailable in this local workspace, so the record is flagged until published with a commit."),
      scienceQaRow("provenance", "retrieval date", scienceQaKnown(p.retrievalDate) ? "pass" : "warn", p.retrievalDate, "Bundled data uses the local package date; pasted/imported data uses the browser load date."),
      scienceQaRow("provenance", "parser version", scienceQaKnown(p.parserVersion) ? "pass" : "fail", p.parserVersion, "Parser identity is included so processed features can be regenerated."),
      scienceQaRow("provenance", "raw checksum", /^raw-[a-f0-9]{8}$/i.test(String(p.rawFileChecksum || "")) ? "pass" : "fail", p.rawFileChecksum, "Checksum of the raw text payload used by this browser run."),
      scienceQaRow("provenance", "feature checksum", /^feat-[a-f0-9]{8}$/i.test(String(p.processedFeatureChecksum || "")) ? "pass" : "fail", p.processedFeatureChecksum, "Checksum of the compact feature vector and sample points."),
      scienceQaRow("provenance", "catalogue/release", scienceQaKnown(p.surveyRelease) ? "pass" : "warn", p.surveyRelease, "Astronomy release or synthetic source label."),
      scienceQaRow("provenance", "calibration", scienceQaKnown(p.calibrationVersion) ? "pass" : "warn", p.calibrationVersion, "Calibration or reduction version should be supplied for observational work.")
    ];
  }

  function errorBarCount(curve) {
    return (curve.points || []).filter(function (p) {
      return Number.isFinite(p.errV) && p.errV > 0;
    }).length;
  }

  function schemaValidationRows(curve) {
    var p = curveProvenance(curve);
    var points = curve.points || [];
    var radiiOk = points.length > 0 && points.every(function (row) { return Number.isFinite(row.r) && row.r > 0; });
    var increasing = points.every(function (row, index) {
      return index === 0 || row.r > points[index - 1].r;
    });
    var velocityOk = points.length > 0 && points.every(function (row) {
      var v = Number.isFinite(row.vObs) ? row.vObs : row.vTotal;
      return Number.isFinite(v) && v >= 0;
    });
    var lastRadius = points.length ? points[points.length - 1].r : NaN;
    var radiusMatches = Number.isFinite(lastRadius) && Number.isFinite(curve.rOut) && Math.abs(lastRadius - curve.rOut) <= Math.max(0.02, curve.rOut * 0.0025);
    var errCount = errorBarCount(curve);
    var observational = curve.kind === "observed" || curve.kind === "etg";
    var errStatus = observational ? (errCount === points.length ? "pass" : (errCount > 0 ? "warn" : "fail")) : "warn";
    var gasStatus = curve.kind === "etg"
      ? "pass"
      : (Number.isFinite(curve.fGasOut) && curve.fGasOut >= 0 && curve.fGasOut <= 1 ? "pass" : "fail");
    var hStatus = Number.isFinite(curve.h) && curve.h > 0 && (curve.kind === "etg" || (Number.isFinite(curve.rOut) && curve.rOut > curve.h)) ? "pass" : "fail";
    var leffStatus = curve.kind === "etg"
      ? (curve.stage4 && Number.isFinite(curve.stage4.r85) ? "pass" : "warn")
      : (Number.isFinite(curve.leff) && curve.leff > 0 ? "pass" : "fail");
    var covarianceKnown = scienceQaKnown(p.covarianceMatrix);
    var redshiftKnown = scienceQaKnown(p.redshiftFrame);
    var reductionKnown = scienceQaKnown(p.reductionPipeline);

    return [
      scienceQaRow("schema", "radius unit", p.radiusUnit === "kpc" ? "pass" : "fail", p.radiusUnit, "Radii must be in kpc or carry a stated conversion."),
      scienceQaRow("schema", "velocity unit", p.velocityUnit === "km/s" ? "pass" : "fail", p.velocityUnit, "Observed/model velocities must be km/s."),
      scienceQaRow("schema", "finite radii", radiiOk ? "pass" : "fail", points.length + " rows", "Every radius is positive and finite."),
      scienceQaRow("schema", "monotone radius", increasing ? "pass" : "fail", increasing ? "strict" : "broken", "Rotation-curve rows must be ordered outward."),
      scienceQaRow("schema", "finite velocity", velocityOk ? "pass" : "fail", velocityOk ? "usable" : "invalid", "Velocity-like columns are non-negative finite values."),
      scienceQaRow("schema", "r_out lock", radiusMatches ? "pass" : "warn", Number.isFinite(lastRadius) ? fmt(lastRadius, 3) + " kpc" : "--", "Outer radius matches the final parsed point."),
      scienceQaRow("schema", "scale h", hStatus, fmt(curve.h, 3) + " kpc", "Disk scale must be finite and below r_out."),
      scienceQaRow("schema", curve.kind === "etg" ? "R85 geometry" : "L_eff", leffStatus, curve.kind === "etg" ? (curve.stage4 && curve.stage4.r85 != null ? fmt(curve.stage4.r85, 3) + " kpc" : "--") : fmt(curve.leff, 3) + " kpc", "Compact support geometry is explicitly derived."),
      scienceQaRow("schema", "gas fraction", gasStatus, curve.kind === "etg" ? "gas-free ETG" : fmt(curve.fGasOut, 4), "Gas fraction must stay in a physical 0-1 range."),
      scienceQaRow("schema", "error bars", errStatus, errCount + "/" + points.length, observational ? "errV is detected and preserved into the point model." : "Synthetic cases have no observational error bars."),
      scienceQaRow("schema", "covariance", covarianceKnown ? "pass" : "warn", p.covarianceMatrix, "Missing covariance is visible instead of silently ignored."),
      scienceQaRow("schema", "redshift/frame", redshiftKnown ? "pass" : "warn", p.redshiftFrame, "Frame corrections should be supplied for observational catalogues."),
      scienceQaRow("schema", "reduction pipeline", reductionKnown ? "pass" : "warn", p.reductionPipeline, "Reduction or generator pipeline is part of the scientific schema.")
    ];
  }

  function routeDecisionText(route) {
    if (!route) return "No route available.";
    if (route.id === "CDC-low-load") return "u0 < 0 while u_out and u_max stay below the outer threshold.";
    if (route.id === "outer-infeasible") return "u_out >= 1, so the outer boundary fails the support gate.";
    if (route.id === "buffered upward-crossing") return "u(r) rises through the support threshold before the outer gate is evaluated.";
    if (route.id === "buffered single-crossing") return "u(r) crosses the threshold once and returns below the outer gate.";
    return "u(r) never requires a buffered threshold crossing.";
  }

  function strongestDriverText(curve, route) {
    var drivers = [
      { name: "u_out", value: route.uOut, score: Math.abs(route.uOut - 1) },
      { name: "u_max", value: route.uMax, score: Math.abs(route.uMax - 1) },
      { name: "u0", value: route.u0, score: Math.abs(route.u0) },
      { name: "memory_load", value: curve.memoryLoad, score: Math.abs(curve.memoryLoad || 0) / 10 },
      { name: "h/r_out", value: route.hOverRout, score: Math.abs(route.hOverRout || 0) }
    ].filter(function (row) { return Number.isFinite(row.score) && Number.isFinite(row.value); });
    drivers.sort(function (a, b) { return b.score - a.score; });
    if (!drivers.length) return "--";
    return drivers[0].name + "=" + fmt(drivers[0].value, 3);
  }

  function featureAuditRows(curve, route) {
    var p = curveProvenance(curve);
    var frameworkScore = currentFrameworkScore();
    var uncertainty = currentUncertaintySummary();
    var rows = [
      scienceQaRow("audit", "route decision", "pass", route.id, routeDecisionText(route)),
      scienceQaRow("audit", "strongest driver", "pass", strongestDriverText(curve, route), "Largest route-adjacent scalar in the compact feature set."),
      scienceQaRow("audit", "missing feature", scienceQaKnown(p.covarianceMatrix) && scienceQaKnown(p.redshiftFrame) ? "pass" : "warn", "covariance/frame", "Missing scientific metadata is named explicitly for reviewers."),
      scienceQaRow("audit", "domain shortcut check", p.repoSource === "local/mts-galaxy-lab-bundle" ? "warn" : "pass", p.repoSource, "Bundled formats can create parser priors; outside tables should be inspected with the same rows."),
      scienceQaRow("audit", "label ambiguity", "warn", "diagnostic class", "Route labels are computed states, not independent morphological truth labels.")
    ];

    if (frameworkScore) {
      rows.push(scienceQaRow("audit", "residual anatomy", frameworkScore.invalidCount ? "fail" : "pass", frameworkScore.dominantBand || "balanced", "Formula A worst residual near " + (frameworkScore.worstR == null ? "--" : fmt(frameworkScore.worstR, 2) + " kpc") + "."));
    } else {
      rows.push(scienceQaRow("audit", "residual anatomy", curve.rmse == null ? "warn" : "pass", curve.rmse == null ? "--" : fmt(curve.rmse, 2) + " km/s", "Baseline residual surface is available for observed curves."));
    }

    if (uncertainty) {
      rows.push(scienceQaRow("audit", "perturbation stability", uncertainty.routeStability >= 0.8 ? "pass" : "warn", fmt(uncertainty.routeStability * 100, 1) + "%", "Monte Carlo route preservation under active uncertainty settings."));
    } else {
      rows.push(scienceQaRow("audit", "perturbation stability", "warn", "not run", "Run Robustness to attach a Monte Carlo stability row."));
    }

    return rows;
  }

  function domainStressRows(curve) {
    return [
      scienceQaRow("stress", "ROTMOD catalogue table", curve.kind === "observed" ? "pass" : "warn", curve.kind, "Native rotational-table pathway with radius/velocity/error columns."),
      scienceQaRow("stress", "FITS-like metadata", "warn", "header required", "The browser validator records the need for WCS, unit, calibration, mask, and frame headers."),
      scienceQaRow("stress", "simulation snapshot", curve.kind === "synthetic" ? "pass" : "warn", curve.kind === "synthetic" ? "active" : "needs reducer", "Particle or cell snapshots must be reduced into the same physical schema before scoring."),
      scienceQaRow("stress", "irregular observation table", "warn", "inspect", "Sparse or mixed-unit tables should fail closed until units and errors are mapped."),
      scienceQaRow("stress", "software/config data", "pass", "reject", "Non-astronomy structural vectors are treated as out-of-domain rather than trusted as galaxy evidence.")
    ];
  }

  function currentScienceQaSummary() {
    var summary = state.scienceQa.summary;
    if (!summary || !state.curve) return null;
    var p = curveProvenance(state.curve);
    if (summary.curveName !== state.curve.name || summary.curveKind !== state.curve.kind) return null;
    if (summary.processedFeatureChecksum !== p.processedFeatureChecksum) return null;
    return summary;
  }

  function runScienceQa() {
    if (!state.curve || !state.route) return;
    var provenanceRows = provenanceCheckRows(state.curve);
    var schemaRows = schemaValidationRows(state.curve);
    var auditRows = featureAuditRows(state.curve, state.route);
    var stressRows = domainStressRows(state.curve);
    var provenanceCounts = scienceQaCounts(provenanceRows);
    var schemaCounts = scienceQaCounts(schemaRows);
    var stressCounts = scienceQaCounts(stressRows);
    var p = curveProvenance(state.curve);
    state.scienceQa.provenanceRows = provenanceRows;
    state.scienceQa.schemaRows = schemaRows;
    state.scienceQa.auditRows = auditRows;
    state.scienceQa.stressRows = stressRows;
    state.scienceQa.summary = {
      curveName: state.curve.name,
      curveKind: state.curve.kind,
      generatedAt: new Date().toISOString(),
      parserVersion: p.parserVersion,
      rawFileChecksum: p.rawFileChecksum,
      processedFeatureChecksum: p.processedFeatureChecksum,
      provenancePass: provenanceCounts.pass,
      provenanceWarn: provenanceCounts.warn,
      provenanceFail: provenanceCounts.fail,
      schemaPass: schemaCounts.pass,
      schemaWarn: schemaCounts.warn,
      schemaFail: schemaCounts.fail,
      stressPass: stressCounts.pass,
      stressWarn: stressCounts.warn,
      stressFail: stressCounts.fail,
      errorBarCount: errorBarCount(state.curve),
      pointCount: state.curve.points.length,
      covariancePresent: scienceQaKnown(p.covarianceMatrix),
      route: state.route.id
    };
    updateScienceQaPanel();
    updateTrustPanel();
    updateCasePanel();
  }

  function updateScienceQaPanel() {
    var table = $("scienceQaTable");
    if (!table) return;
    var summary = currentScienceQaSummary();
    table.innerHTML = "";
    if (!summary) {
      $("scienceQaStatus").textContent = "not run";
      $("scienceQaProvenance").textContent = "--";
      $("scienceQaSchema").textContent = "--";
      $("scienceQaErrors").textContent = "--";
      $("scienceQaStress").textContent = "--";
      table.innerHTML = '<div class="scienceqa-row warn"><strong>Run Scientific QA</strong><span>warn</span><span>--</span><em>Attach provenance, schema, uncertainty, and feature-audit rows.</em></div>';
      if ($("scienceQaNote")) $("scienceQaNote").textContent = "Builds a source-lock, unit/schema validator, stress ledger, and readable feature audit for the active case.";
      return;
    }

    var pStatus = summary.provenanceFail ? "fail" : (summary.provenanceWarn ? "warn" : "locked");
    var sStatus = summary.schemaFail ? "fail" : (summary.schemaWarn ? "warn" : "valid");
    $("scienceQaStatus").textContent = summary.schemaFail || summary.provenanceFail ? "needs review" : "qa locked";
    $("scienceQaProvenance").textContent = pStatus;
    $("scienceQaSchema").textContent = summary.schemaPass + "p/" + summary.schemaWarn + "w/" + summary.schemaFail + "f";
    $("scienceQaErrors").textContent = summary.errorBarCount + "/" + summary.pointCount;
    $("scienceQaStress").textContent = summary.stressPass + "p/" + summary.stressWarn + "w/" + summary.stressFail + "f";

    var displayRows = state.scienceQa.provenanceRows
      .concat(state.scienceQa.schemaRows)
      .concat(state.scienceQa.auditRows)
      .concat(state.scienceQa.stressRows)
      .sort(function (a, b) {
        var order = { fail: 0, warn: 1, pass: 2 };
        return order[a.status] - order[b.status];
      })
      .slice(0, 18);

    displayRows.forEach(function (row) {
      var item = document.createElement("div");
      item.className = "scienceqa-row " + row.status;
      item.innerHTML =
        "<strong>" + htmlEscape(row.label) + "</strong>" +
        "<span>" + htmlEscape(row.status) + "</span>" +
        "<span>" + htmlEscape(row.value) + "</span>" +
        "<em>" + htmlEscape(row.note) + "</em>";
      table.appendChild(item);
    });
    if ($("scienceQaNote")) {
      $("scienceQaNote").textContent = sStatus + " schema; provenance " + pStatus + "; " + summary.errorBarCount + " error rows preserved.";
    }
  }

  function scienceQaCsv() {
    var headers = ["galaxy", "mode", "type", "check", "status", "value", "note", "raw_checksum", "feature_checksum"];
    var summary = currentScienceQaSummary();
    var rows = state.scienceQa.provenanceRows
      .concat(state.scienceQa.schemaRows)
      .concat(state.scienceQa.auditRows)
      .concat(state.scienceQa.stressRows)
      .map(function (row) {
        return {
          galaxy: summary ? summary.curveName : "",
          mode: summary ? summary.curveKind : "",
          type: row.type,
          check: row.label,
          status: row.status,
          value: row.value,
          note: row.note,
          raw_checksum: summary ? summary.rawFileChecksum : "",
          feature_checksum: summary ? summary.processedFeatureChecksum : ""
        };
      });
    return rowsToCsv(headers, rows);
  }

  function scienceQaRowsHtml(rows) {
    return rows.map(function (row) {
      return "<tr><th>" + htmlEscape(row.label) + "</th><td><strong>" + htmlEscape(row.status) + "</strong> " + htmlEscape(row.value) + "<br><small>" + htmlEscape(row.note) + "</small></td></tr>";
    }).join("");
  }

  function buildScienceQaReportHtml() {
    if (!currentScienceQaSummary()) runScienceQa();
    var curve = state.curve;
    var summary = currentScienceQaSummary();
    var metaRows = [
      ["Curve", summary.curveName],
      ["Mode", summary.curveKind],
      ["Route", summary.route],
      ["Parser", summary.parserVersion],
      ["Raw checksum", summary.rawFileChecksum],
      ["Feature checksum", summary.processedFeatureChecksum],
      ["Schema", summary.schemaPass + " pass / " + summary.schemaWarn + " warn / " + summary.schemaFail + " fail"],
      ["Provenance", summary.provenancePass + " pass / " + summary.provenanceWarn + " warn / " + summary.provenanceFail + " fail"],
      ["Error bars", summary.errorBarCount + "/" + summary.pointCount],
      ["Covariance", summary.covariancePresent ? "present" : "missing"]
    ];
    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>MTS scientific QA - " + htmlEscape(curve.name) + "</title><style>" + reportCss() + "</style></head>",
      "<body><main>",
      "<header><div><h1>" + htmlEscape(curve.name) + "</h1><p>Scientific provenance and validation report</p><p>Generated " + htmlEscape(summary.generatedAt) + "</p></div><div class=\"hash\">" + htmlEscape(summary.processedFeatureChecksum) + "</div></header>",
      "<section class=\"grid\"><div class=\"panel\"><h2>QA Summary</h2><table><tbody>" + tableRowsHtml(metaRows) + "</tbody></table></div><div class=\"plots\">",
      exportPlotPanel("Rotation Curve", "curvePlot"),
      exportPlotPanel("Residual View", "residualPlot"),
      "</div></section>",
      "<section class=\"panel\"><h2>Dataset Provenance</h2><table><tbody>" + scienceQaRowsHtml(state.scienceQa.provenanceRows) + "</tbody></table></section>",
      "<section class=\"panel\"><h2>Physical Schema</h2><table><tbody>" + scienceQaRowsHtml(state.scienceQa.schemaRows) + "</tbody></table></section>",
      "<section class=\"panel\"><h2>Feature Audit</h2><table><tbody>" + scienceQaRowsHtml(state.scienceQa.auditRows) + "</tbody></table></section>",
      "<section class=\"panel\"><h2>Out-of-Domain Stress</h2><table><tbody>" + scienceQaRowsHtml(state.scienceQa.stressRows) + "</tbody></table></section>",
      "<details><summary>Diagnostic JSON</summary><pre>" + htmlEscape(JSON.stringify(currentDiagnosticsObject(), null, 2)) + "</pre></details>",
      "<footer>Scientific QA flags missing units, frames, calibration, covariance, and parser/source locks instead of hiding them.</footer>",
      "</main></body></html>"
    ].join("");
  }

  function exportScienceQaReport() {
    if (!state.curve) return;
    if (!currentScienceQaSummary()) runScienceQa();
    if (!currentScienceQaSummary()) return;
    downloadText("mts-scientific-qa-" + slugify(state.curve.name) + ".html", buildScienceQaReportHtml(), "text/html;charset=utf-8");
    if ($("scienceQaNote")) $("scienceQaNote").textContent = "Prepared Scientific QA report for " + state.curve.name + ".";
  }

  function exportScienceQaCsv() {
    if (!state.curve) return;
    if (!currentScienceQaSummary()) runScienceQa();
    if (!currentScienceQaSummary()) return;
    downloadText("mts-scientific-qa-" + slugify(state.curve.name) + ".csv", scienceQaCsv(), "text/csv;charset=utf-8");
    if ($("scienceQaNote")) $("scienceQaNote").textContent = "Prepared Scientific QA CSV for " + state.curve.name + ".";
  }

  function buildCaseFileHtml() {
    var curve = state.curve;
    var rows = caseRows();
    var claimSummary = state.claims.summary
      ? state.claims.summary.passed + "/" + state.claims.summary.total + " claim checks pass"
      : "not run";
    var metaRows = rows.concat([
      ["Claim validator", claimSummary],
      ["Particle view", state.view.tilt + " deg tilt, " + fmt(state.view.depth, 2) + "x depth, " + state.view.colorMode + " colour"]
    ]);
    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>MTS galaxy case file - " + htmlEscape(curve.name) + "</title><style>" + reportCss() + "</style></head>",
      "<body><main>",
      "<header><div><h1>" + htmlEscape(curve.name) + "</h1><p>MTS Galaxy Lab case file</p><p>Generated " + htmlEscape(new Date().toISOString()) + "</p></div><div class=\"hash\">" + htmlEscape(capsuleHash(buildCapsule())) + "</div></header>",
      "<section class=\"grid\"><div class=\"panel\"><h2>Case Diagnostics</h2><table><tbody>" + tableRowsHtml(metaRows) + "</tbody></table></div><div class=\"plots\">",
      exportPlotPanel("Rotation Curve", "curvePlot"),
      exportPlotPanel("u(r) Gate Profile", "uPlot"),
      exportPlotPanel("Residual View", "residualPlot"),
      "</div></section>",
      "<section class=\"panel\"><h2>Case Note</h2><p>" + htmlEscape(caseNoteText()) + "</p></section>",
      "<details><summary>Diagnostic JSON</summary><pre>" + htmlEscape(JSON.stringify(currentDiagnosticsObject(), null, 2)) + "</pre></details>",
      "<footer>Portable case file from the active browser state. For exact replay, export a capsule beside this file.</footer>",
      "</main></body></html>"
    ].join("");
  }

  function exportCaseFile() {
    if (!state.curve) return;
    if (!currentScienceQaSummary()) runScienceQa();
    downloadText("mts-case-file-" + slugify(state.curve.name) + ".html", buildCaseFileHtml(), "text/html;charset=utf-8");
    if ($("reproduceNote")) $("reproduceNote").textContent = "Prepared case file for " + state.curve.name;
  }

  function updateDiagnostics() {
    var curve = state.curve;
    var route = state.route;
    if (!curve || !route) return;

    $("sceneTitle").textContent = curve.kind === "synthetic" ? (curve.forge ? curve.name : "Synthetic transport disk") : curve.name;
    $("sceneSubtitle").textContent = curve.kind === "etg"
      ? "ETG high-res disk/bulge outer-chain and Stage-4 diagnostics"
      : (curve.kind === "observed" ? "LTG ROTMOD overlay using locked MTS memory law" : "Live particles from the computed circular velocity field");
    $("routePill").textContent = route.id;

    if (curve.kind === "etg") {
      $("metricLeffLabel").textContent = "R85";
      $("metricLeff").textContent = curve.stage4.r85 == null ? "--" : fmt(curve.stage4.r85, 2);
      $("metricLeffUnit").textContent = "kpc";
      $("metricMemoryLabel").textContent = "r_out/R85";
      $("metricMemory").textContent = curve.stage4.rOutOverR85 == null ? "--" : fmt(curve.stage4.rOutOverR85, 2);
      $("metricMemoryUnit").textContent = "v18 geometry";
      $("metricUoutLabel").textContent = "u_out";
      $("metricUout").textContent = fmt(route.uOut, 3);
      $("metricUoutUnit").textContent = "outer gate";
      $("metricRmseLabel").textContent = "logy";
      $("metricRmse").textContent = fmt(curve.stage4.logy, 3);
      $("metricRmseUnit").textContent = "ln(Vdisk^2/rout)";
    } else {
      $("metricLeffLabel").textContent = "L_eff";
      $("metricLeff").textContent = fmt(curve.leff, 2);
      $("metricLeffUnit").textContent = "kpc";
      $("metricMemoryLabel").textContent = "Memory load";
      $("metricMemory").textContent = fmt(curve.memoryLoad, 2);
      $("metricMemoryUnit").textContent = "(1-fgas) rout/h";
      $("metricUoutLabel").textContent = "u_out";
      $("metricUout").textContent = fmt(route.uOut, 3);
      $("metricUoutUnit").textContent = "outer gate";
      $("metricRmseLabel").textContent = "RMSE";
      $("metricRmse").textContent = curve.rmse == null ? "--" : fmt(curve.rmse, 2);
      $("metricRmseUnit").textContent = "km/s";
    }

    $("routeCount").textContent = route.downCrossings + " down / " + route.upCrossings + " up";

    var routeRows = curve.kind === "etg"
      ? [
        ["outer viable", route.outerViable ? "yes" : "no", route.outerViable],
        ["max u(r)", fmt(route.uMax, 3), route.uMax >= 1],
        ["u_out", fmt(route.uOut, 3), route.uOut < 1],
        ["route", route.id, true]
      ]
      : [
        ["outer viable", route.outerViable ? "yes" : "no", route.outerViable],
        ["CDC sign", route.cdc ? "u0 < 0" : "u0 >= 0", route.cdc],
        ["u(R0)", fmt(route.u0, 3), route.u0 < 0],
        ["max u(r)", fmt(route.uMax, 3), route.uMax >= 1],
        ["u_out", fmt(route.uOut, 3), route.uOut < 1],
        ["route", route.id, true]
      ];

    if (route.xCrossNorm != null) {
      routeRows.push(["x_cross", fmt(route.xCrossNorm, 3), true]);
      routeRows.push(["u_0.75", fmt(route.u075, 3), route.u075 > 0.64]);
    }

    if (curve.kind === "observed" && route.xCrossNorm != null) {
      routeRows.push(["L_gap", fmt(route.lGap, 2) + " kpc", true]);
      routeRows.push(["g = memory*x", fmt(route.gScalar, 2), true]);
      routeRows.push(["Priority L MAE", fmt(route.priorityL, 1) + " km/s", true]);
      routeRows.push(["Priority L3 diag", route.priorityL3 == null ? "--" : fmt(route.priorityL3, 1) + " km/s", route.supercriticalU075]);
      routeRows.push(["late-load final", route.lateLoad ? "flagged" : "clear", route.lateLoad]);
      routeRows.push(["LTG A inv_sqrt", route.ltgCurvatureA == null ? "--" : fmt(route.ltgCurvatureA, 3), true]);
      routeRows.push(["u_0.75 supercrit", route.supercriticalU075 ? "yes" : "no", route.supercriticalU075]);
    }

    if (curve.kind === "etg") {
      routeRows.push(["h", fmt(curve.h, 3) + " kpc", true]);
      routeRows.push(["R85", curve.stage4.r85 == null ? "--" : fmt(curve.stage4.r85, 2) + " kpc", true]);
      routeRows.push(["R90", fmt(curve.stage4.r90, 2) + " kpc", true]);
      routeRows.push(["Sigma80-100", fmt(curve.stage4.sigma80, 3), true]);
      routeRows.push(["Stage4 R80 pred", fmt(curve.stage4.stageR80, 3), true]);
      routeRows.push(["Stage4 R90 pred", fmt(curve.stage4.stageR90, 3), true]);
      if (route.xCrossNorm != null) {
        routeRows.push(["c1 slope law", fmt(route.c1, 3), true]);
        routeRows.push(["ETG curvature A", fmt(route.etgCurvatureA, 3), true]);
      }
    }

    var stack = $("routeStack");
    stack.innerHTML = "";
    routeRows.forEach(function (row) {
      var item = document.createElement("div");
      item.className = "route-item" + (row[2] ? " active" : "");
      item.innerHTML = '<span class="route-dot"></span><span>' + row[0] + '</span><span class="route-value">' + row[1] + '</span>';
      stack.appendChild(item);
    });

    var frameworkScore = currentFrameworkScore();
    var comparisonScore = currentComparisonScore();
    if (curve.kind === "observed") {
      $("curveLegend").textContent = comparisonScore ? "observed + MTS + A/B" : (frameworkScore ? "observed + MTS + custom" : "observed + model");
      $("residualLegend").textContent = comparisonScore ? "A/B residuals" : (frameworkScore ? "custom - observed" : "model - observed");
    } else if (curve.kind === "etg") {
      $("curveLegend").textContent = comparisonScore ? "obs + support + A/B" : (frameworkScore ? "obs + support + custom" : "obs + baryon + support");
      $("residualLegend").textContent = comparisonScore ? "A/B residuals" : (frameworkScore ? "custom - observed" : "Stage-4 log residual");
    } else {
      $("curveLegend").textContent = comparisonScore ? "MTS + A/B" : (frameworkScore ? "MTS + custom" : "model");
      $("residualLegend").textContent = comparisonScore ? "A/B residuals" : (frameworkScore ? "custom - MTS" : "support share");
    }
    updateEvolutionPanel();
    updateForgePanel();
    updateFrameworkPanel();
    updateComparisonPanel();
    updateFailureAnatomy();
    updateResidualBandsPanel();
    updateBenchmarkPanel();
    updateTrustPanel();
    updateV18Panel();
    updateV18ReviewPanel();
    updateCasePanel();
    updateUncertaintyPanel();
    updateScienceQaPanel();
    updatePopulationPanel();
  }

  function drawPlots() {
    if (!state.curve) return;
    drawCurvePlot();
    drawUPlot();
    drawResidualPlot();
    drawFitCorrelationPlot();
    updateFitCorrelationPanel();
    updateResidualBandsPanel();
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function makePath(points, xFn, yFn) {
    return points.map(function (p, i) {
      return (i === 0 ? "M" : "L") + xFn(p).toFixed(2) + " " + yFn(p).toFixed(2);
    }).join(" ");
  }

  function drawPlotFrame(svg, width, height, xTicks, yTicks, xScale, yScale, xMax, yMin, yMax) {
    svg.innerHTML = "";
    var plot = { left: 42, right: width - 16, top: 18, bottom: height - 34 };
    for (var i = 0; i <= xTicks; i += 1) {
      var xVal = xMax * i / xTicks;
      var x = xScale(xVal);
      svg.appendChild(svgEl("line", { class: "plot-grid", x1: x, y1: plot.top, x2: x, y2: plot.bottom }));
      svg.appendChild(svgEl("text", { class: "plot-label", x: x - 8, y: height - 12 })).textContent = fmt(xVal, 0);
    }
    for (var j = 0; j <= yTicks; j += 1) {
      var yVal = yMin + (yMax - yMin) * j / yTicks;
      var y = yScale(yVal);
      svg.appendChild(svgEl("line", { class: "plot-grid", x1: plot.left, y1: y, x2: plot.right, y2: y }));
      svg.appendChild(svgEl("text", { class: "plot-label", x: 5, y: y + 3 })).textContent = fmt(yVal, yMax - yMin > 4 ? 0 : 1);
    }
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.bottom, x2: plot.right, y2: plot.bottom }));
    svg.appendChild(svgEl("line", { class: "plot-axis", x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.bottom }));
    return plot;
  }

  function drawCurvePlot() {
    var svg = $("curvePlot");
    var width = 420;
    var height = 260;
    var points = state.curve.points;
    var frameworkScore = currentFrameworkScore();
    var comparisonScore = currentComparisonScore();
    var xMax = state.curve.rOut;
    var yMax = 0;
    points.forEach(function (p) {
      yMax = Math.max(yMax, p.vTotal, p.vBar, p.vMts, p.vObs || 0);
    });
    if (frameworkScore) {
      frameworkScore.points.forEach(function (p) {
        yMax = Math.max(yMax, p.vCustom);
      });
    }
    if (comparisonScore) {
      comparisonScore.points.forEach(function (p) {
        yMax = Math.max(yMax, p.vCustom);
      });
    }
    yMax = Math.ceil(yMax / 25) * 25 + 25;
    var plot = {
      left: 42,
      right: width - 16,
      top: 18,
      bottom: height - 34
    };
    var xScale = function (x) { return plot.left + (x / xMax) * (plot.right - plot.left); };
    var yScale = function (y) { return plot.bottom - (y / yMax) * (plot.bottom - plot.top); };
    drawPlotFrame(svg, width, height, 4, 4, xScale, yScale, xMax, 0, yMax);

    svg.appendChild(svgEl("path", { class: "line-bar", d: makePath(points, function (p) { return xScale(p.r); }, function (p) { return yScale(p.vBar); }) }));
    svg.appendChild(svgEl("path", { class: "line-mts", d: makePath(points, function (p) { return xScale(p.r); }, function (p) { return yScale(p.vMts); }) }));
    svg.appendChild(svgEl("path", { class: "line-total", d: makePath(points, function (p) { return xScale(p.r); }, function (p) { return yScale(p.vTotal); }) }));
    if (frameworkScore) {
      svg.appendChild(svgEl("path", { class: "line-custom", d: makePath(frameworkScore.points, function (p) { return xScale(p.r); }, function (p) { return yScale(p.vCustom); }) }));
    }
    if (comparisonScore) {
      svg.appendChild(svgEl("path", { class: "line-compare", d: makePath(comparisonScore.points, function (p) { return xScale(p.r); }, function (p) { return yScale(p.vCustom); }) }));
    }

    if (state.curve.kind === "observed" || state.curve.kind === "etg") {
      svg.appendChild(svgEl("path", { class: "line-obs", d: makePath(points, function (p) { return xScale(p.r); }, function (p) { return yScale(p.vObs); }) }));
      (state.curve.observedPoints || points).forEach(function (p) {
        svg.appendChild(svgEl("circle", { class: "dot-obs", cx: xScale(p.r), cy: yScale(p.vObs), r: 2.6 }));
      });
    }
  }

  function drawUPlot() {
    var svg = $("uPlot");
    var width = 420;
    var height = 230;
    var points = state.curve.points;
    var xMax = state.curve.rOut;
    var minU = Math.min.apply(null, points.map(function (p) { return p.u; }));
    var maxU = Math.max.apply(null, points.map(function (p) { return p.u; }));
    var yMin = Math.floor(Math.min(minU, 0) * 2) / 2 - 0.15;
    var yMax = Math.ceil(Math.max(maxU, 1) * 2) / 2 + 0.15;
    if (yMax - yMin < 1.2) yMax = yMin + 1.2;
    var plot = {
      left: 42,
      right: width - 16,
      top: 18,
      bottom: height - 34
    };
    var xScale = function (x) { return plot.left + (x / xMax) * (plot.right - plot.left); };
    var yScale = function (y) { return plot.bottom - ((y - yMin) / (yMax - yMin)) * (plot.bottom - plot.top); };
    drawPlotFrame(svg, width, height, 4, 4, xScale, yScale, xMax, yMin, yMax);
    svg.appendChild(svgEl("line", { class: "threshold-line", x1: plot.left, y1: yScale(1), x2: plot.right, y2: yScale(1) }));
    svg.appendChild(svgEl("path", { class: "line-u", d: makePath(points, function (p) { return xScale(p.r); }, function (p) { return yScale(p.u); }) }));
  }

  function drawResidualPlot() {
    var svg = $("residualPlot");
    var width = 420;
    var height = 220;
    var curve = state.curve;
    var xMax = curve.rOut;
    var frameworkScore = currentFrameworkScore();
    var comparisonScore = currentComparisonScore();
    var points;
    var comparisonPoints = null;
    var yMin;
    var yMax;

    if (frameworkScore || comparisonScore) {
      var primaryScore = frameworkScore || comparisonScore;
      points = primaryScore.points.map(function (p) {
        return { r: p.r, value: p.residual };
      });
      if (frameworkScore && comparisonScore) {
        comparisonPoints = comparisonScore.points.map(function (p) {
          return { r: p.r, value: p.residual };
        });
      }
      var allResiduals = points.concat(comparisonPoints || []);
      var maxAbs = Math.max.apply(null, allResiduals.map(function (p) { return Math.abs(p.value); }));
      maxAbs = Math.max(5, Math.ceil(maxAbs / 5) * 5);
      yMin = -maxAbs;
      yMax = maxAbs;
    } else if (curve.kind === "observed") {
      points = curve.points.map(function (p) {
        return { r: p.r, value: p.vTotal - p.vObs };
      });
      var obsAbs = Math.max.apply(null, points.map(function (p) { return Math.abs(p.value); }));
      obsAbs = Math.max(5, Math.ceil(obsAbs / 5) * 5);
      yMin = -obsAbs;
      yMax = obsAbs;
    } else if (curve.kind === "etg") {
      points = [
        { r: 0.8 * xMax, value: curve.stage4.residualR80 },
        { r: 0.9 * xMax, value: curve.stage4.residualR90 }
      ];
      var etgAbs = Math.max(Math.abs(curve.stage4.residualR80), Math.abs(curve.stage4.residualR90));
      etgAbs = Math.max(0.2, Math.ceil(etgAbs * 10) / 10);
      yMin = -etgAbs;
      yMax = etgAbs;
    } else {
      points = curve.points.map(function (p) {
        return { r: p.r, value: p.vTotal > 0 ? p.vMts / p.vTotal : 0 };
      });
      yMin = 0;
      yMax = 1;
    }

    var plot = {
      left: 42,
      right: width - 16,
      top: 18,
      bottom: height - 34
    };
    var xScale = function (x) { return plot.left + (x / xMax) * (plot.right - plot.left); };
    var yScale = function (y) { return plot.bottom - ((y - yMin) / (yMax - yMin)) * (plot.bottom - plot.top); };
    drawPlotFrame(svg, width, height, 4, 4, xScale, yScale, xMax, yMin, yMax);

    if (yMin < 0 && yMax > 0) {
      svg.appendChild(svgEl("line", { class: "zero-line", x1: plot.left, y1: yScale(0), x2: plot.right, y2: yScale(0) }));
    }

    svg.appendChild(svgEl("path", { class: "line-residual", d: makePath(points, function (p) { return xScale(p.r); }, function (p) { return yScale(p.value); }) }));
    if (comparisonPoints) {
      svg.appendChild(svgEl("path", { class: "line-compare-residual", d: makePath(comparisonPoints, function (p) { return xScale(p.r); }, function (p) { return yScale(p.value); }) }));
    }
    if (curve.kind !== "synthetic" && points.length <= 90) {
      points.forEach(function (p) {
        svg.appendChild(svgEl("circle", { class: "dot-residual", cx: xScale(p.r), cy: yScale(p.value), r: 2.8 }));
      });
      if (comparisonPoints) {
        comparisonPoints.forEach(function (p) {
          svg.appendChild(svgEl("circle", { class: "dot-compare-residual", cx: xScale(p.r), cy: yScale(p.value), r: 2.3 }));
        });
      }
    }
  }

  function fitCorrelationRows() {
    if (!state.curve || state.curve.kind === "synthetic") return [];
    return state.curve.points.filter(function (point) {
      return Number.isFinite(point.vObs) && Number.isFinite(point.vTotal);
    }).map(function (point) {
      return {
        r: point.r,
        observed: point.vObs,
        model: point.vTotal,
        residual: point.vTotal - point.vObs
      };
    });
  }

  function fitCorrelationStats(rows) {
    rows = rows || fitCorrelationRows();
    if (!rows.length) {
      return {
        count: 0,
        rmse: NaN,
        bias: NaN,
        corr: NaN,
        maxAbs: NaN,
        outerRmse: NaN
      };
    }
    var sumObs = 0;
    var sumModel = 0;
    var sse = 0;
    var bias = 0;
    var maxAbs = 0;
    rows.forEach(function (row) {
      sumObs += row.observed;
      sumModel += row.model;
      sse += row.residual * row.residual;
      bias += row.residual;
      maxAbs = Math.max(maxAbs, Math.abs(row.residual));
    });
    var meanObs = sumObs / rows.length;
    var meanModel = sumModel / rows.length;
    var cov = 0;
    var varObs = 0;
    var varModel = 0;
    rows.forEach(function (row) {
      var dx = row.observed - meanObs;
      var dy = row.model - meanModel;
      cov += dx * dy;
      varObs += dx * dx;
      varModel += dy * dy;
    });
    var outerStart = rows.length > 2 ? Math.floor(rows.length * 0.6) : 0;
    var outer = rows.slice(outerStart);
    var outerSse = 0;
    outer.forEach(function (row) {
      outerSse += row.residual * row.residual;
    });
    return {
      count: rows.length,
      rmse: Math.sqrt(sse / rows.length),
      bias: bias / rows.length,
      corr: varObs > 0 && varModel > 0 ? cov / Math.sqrt(varObs * varModel) : NaN,
      maxAbs: maxAbs,
      outerRmse: outer.length ? Math.sqrt(outerSse / outer.length) : NaN
    };
  }

  function residualBandSummaries(rows) {
    rows = rows || fitCorrelationRows();
    var rOut = state.curve ? state.curve.rOut || 0 : 0;
    var cuts = rOut > 0 ? [rOut / 3, 2 * rOut / 3] : [0, 0];
    var bands = [
      { id: "inner", label: "Inner", rows: [] },
      { id: "mid", label: "Mid", rows: [] },
      { id: "outer", label: "Outer", rows: [] }
    ];
    rows.forEach(function (row) {
      var index = row.r <= cuts[0] ? 0 : (row.r <= cuts[1] ? 1 : 2);
      bands[index].rows.push(row);
    });
    return bands.map(function (band) {
      var sse = 0;
      var bias = 0;
      var maxAbs = 0;
      var maxResidual = NaN;
      var maxR = NaN;
      band.rows.forEach(function (row) {
        var abs = Math.abs(row.residual);
        sse += row.residual * row.residual;
        bias += row.residual;
        if (abs >= maxAbs) {
          maxAbs = abs;
          maxResidual = row.residual;
          maxR = row.r;
        }
      });
      return {
        id: band.id,
        label: band.label,
        count: band.rows.length,
        rmse: band.rows.length ? Math.sqrt(sse / band.rows.length) : NaN,
        bias: band.rows.length ? bias / band.rows.length : NaN,
        maxAbs: band.rows.length ? maxAbs : NaN,
        maxResidual: maxResidual,
        maxR: maxR
      };
    });
  }

  function worstResidualRows(rows, limit) {
    return (rows || fitCorrelationRows()).slice().sort(function (a, b) {
      return Math.abs(b.residual) - Math.abs(a.residual);
    }).slice(0, limit || 6);
  }

  function signedKm(value) {
    return Number.isFinite(value) ? (value >= 0 ? "+" : "") + fmt(value, 2) : "--";
  }

  function updateResidualBandsPanel() {
    var table = $("residualBandTable");
    if (!table) return;
    var rows = fitCorrelationRows();
    var bands = residualBandSummaries(rows);
    var status = $("residualBandStatus");
    if (!rows.length) {
      if (status) status.textContent = "synthetic";
      ["bandInnerRmse", "bandMidRmse", "bandOuterRmse", "bandMaxResidual"].forEach(function (id) {
        if ($(id)) $(id).textContent = "--";
      });
      table.innerHTML = "<div class=\"residual-band-empty\">Observed residual bands appear for ROTMOD or ETG cases.</div>";
      return;
    }

    var worst = worstResidualRows(rows, 5);
    if (status) status.textContent = rows.length + " points";
    if ($("bandInnerRmse")) $("bandInnerRmse").textContent = fmt(bands[0].rmse, 2);
    if ($("bandMidRmse")) $("bandMidRmse").textContent = fmt(bands[1].rmse, 2);
    if ($("bandOuterRmse")) $("bandOuterRmse").textContent = fmt(bands[2].rmse, 2);
    if ($("bandMaxResidual")) $("bandMaxResidual").textContent = signedKm(worst[0] ? worst[0].residual : NaN);

    table.innerHTML = "";
    bands.forEach(function (band) {
      var row = document.createElement("div");
      row.className = "residual-band-row band";
      row.title = band.count
        ? band.label + " worst residual near r " + fmt(band.maxR, 2) + " kpc"
        : band.label + " has no observed points";
      row.innerHTML =
        "<strong>" + htmlEscape(band.label) + "</strong>" +
        "<span>" + (Number.isFinite(band.rmse) ? fmt(band.rmse, 2) : "--") + "</span>" +
        "<span>" + signedKm(band.bias) + "</span>" +
        "<span>n=" + band.count + "</span>";
      table.appendChild(row);
    });

    worst.forEach(function (point) {
      var row = document.createElement("div");
      row.className = "residual-band-row worst";
      row.title = "Observed " + fmt(point.observed, 2) + " km/s, model " + fmt(point.model, 2) + " km/s";
      row.innerHTML =
        "<strong>r " + fmt(point.r, 2) + "</strong>" +
        "<span>" + signedKm(point.residual) + "</span>" +
        "<span>" + fmt(point.observed, 1) + "->" + fmt(point.model, 1) + "</span>" +
        "<span>worst</span>";
      table.appendChild(row);
    });
  }

  function updateFitCorrelationPanel() {
    if (!$("fitStatus")) return;
    var rows = fitCorrelationRows();
    var stats = fitCorrelationStats(rows);
    if (!rows.length) {
      $("fitStatus").textContent = "synthetic";
      $("fitPointCount").textContent = "--";
      $("fitCorrelation").textContent = "--";
      $("fitRmse").textContent = "--";
      $("fitBias").textContent = "--";
      return;
    }
    $("fitStatus").textContent = "observed fit";
    $("fitPointCount").textContent = String(stats.count);
    $("fitCorrelation").textContent = fmt(stats.corr, 3);
    $("fitRmse").textContent = fmt(stats.rmse, 2);
    $("fitBias").textContent = (stats.bias >= 0 ? "+" : "") + fmt(stats.bias, 2);
  }

  function drawFitCorrelationPlot() {
    var svg = $("fitCorrelationPlot");
    if (!svg) return;
    var width = 420;
    var height = 240;
    var rows = fitCorrelationRows();
    svg.innerHTML = "";
    if (!rows.length) {
      svg.appendChild(svgEl("text", { class: "plot-label", x: 36, y: 42 })).textContent = "Observed/model fit appears here for ROTMOD or ETG cases.";
      return;
    }
    var stats = fitCorrelationStats(rows);
    var vmax = 0;
    rows.forEach(function (row) {
      vmax = Math.max(vmax, row.observed, row.model);
    });
    vmax = Math.ceil(vmax / 25) * 25 + 25;
    var plot = {
      left: 46,
      right: width - 18,
      top: 18,
      bottom: height - 36
    };
    var xScale = function (value) { return plot.left + (value / vmax) * (plot.right - plot.left); };
    var yScale = function (value) { return plot.bottom - (value / vmax) * (plot.bottom - plot.top); };
    drawPlotFrame(svg, width, height, 4, 4, xScale, yScale, vmax, 0, vmax);
    svg.appendChild(svgEl("line", { class: "line-fit-one", x1: xScale(0), y1: yScale(0), x2: xScale(vmax), y2: yScale(vmax) }));
    if (Number.isFinite(stats.rmse)) {
      var high = Math.max(0, vmax - stats.rmse);
      var low = Math.min(vmax, stats.rmse);
      svg.appendChild(svgEl("line", { class: "line-fit-band", x1: xScale(0), y1: yScale(stats.rmse), x2: xScale(high), y2: yScale(vmax) }));
      svg.appendChild(svgEl("line", { class: "line-fit-band", x1: xScale(stats.rmse), y1: yScale(0), x2: xScale(vmax), y2: yScale(vmax - stats.rmse) }));
      svg.appendChild(svgEl("text", { class: "plot-label", x: xScale(low) + 5, y: yScale(0) - 8 })).textContent = "+/- RMSE";
    }
    rows.forEach(function (row) {
      var over = row.residual >= 0;
      var point = svgEl("circle", {
        class: over ? "dot-fit-over" : "dot-fit-under",
        cx: xScale(row.observed),
        cy: yScale(row.model),
        r: 3.1
      });
      point.appendChild(svgEl("title", {})).textContent = "r " + fmt(row.r, 2) + " kpc | residual " + fmt(row.residual, 2) + " km/s";
      svg.appendChild(point);
    });
    svg.appendChild(svgEl("text", { class: "plot-label", x: plot.right - 82, y: height - 12 })).textContent = "V_obs";
    svg.appendChild(svgEl("text", { class: "plot-label", x: 8, y: plot.top + 8 })).textContent = "V_model";
  }

  function interpVelocity(r) {
    var curve = state.curve;
    if (!curve || !curve.points.length) return 0;
    var points = curve.points;
    if (r <= points[0].r) return effectiveVelocity(points[0]);
    if (r >= points[points.length - 1].r) return effectiveVelocity(points[points.length - 1]);
    for (var i = 1; i < points.length; i += 1) {
      if (points[i].r >= r) {
        var a = points[i - 1];
        var b = points[i];
        var t = (r - a.r) / (b.r - a.r);
        return effectiveVelocity(a) * (1 - t) + effectiveVelocity(b) * t;
      }
    }
    return effectiveVelocity(points[points.length - 1]);
  }

  function effectiveVelocity(point) {
    var p = readParams();
    if (state.curve && state.curve.kind === "etg") return point.vTotal;
    return p.showMtsOnly ? point.vMts : point.vTotal;
  }

  function generateParticles() {
    if (!state.curve) return;
    state.particles = [];
    var h = state.curve.h || 3;
    var rOut = state.curve.rOut || 25;
    var visual = state.curve.forge ? forgeDefinition(state.curve.forge.preset).visual : {};
    var radialH = h * (visual.radialScale || 1);
    var countScale = visual.countScale || 1;
    var count = Math.min(6600, Math.max(2200, Math.round((1750 + rOut * 95) * countScale)));
    var trunc = 1 - Math.exp(-rOut / radialH);
    var arms = visual.arms == null ? 3 : visual.arms;
    var scatter = visual.scatter == null ? 0.78 : visual.scatter;
    var twist = visual.twist == null ? 1.15 : visual.twist;
    var gasChance = visual.gasChance == null ? 0.18 : visual.gasChance;
    var thickness = visual.thickness || 0.018;
    var bulgeSignal = 0;
    if (state.curve.points && state.curve.points.length) {
      state.curve.points.forEach(function (point) {
        var denom = (point.vDisk || 0) + (point.vGas || 0) + (point.vBulge || 0);
        if (denom > 0) bulgeSignal = Math.max(bulgeSignal, (point.vBulge || 0) / denom);
      });
    }
    for (var i = 0; i < count; i += 1) {
      var isGas = seededRandom() < gasChance;
      var u = seededRandom();
      var r = -radialH * Math.log(Math.max(0.00001, 1 - u * trunc));
      if (visual.coreBias && seededRandom() < visual.coreBias) {
        r = Math.pow(seededRandom(), 1.65) * Math.max(1.2 * h, 0.22 * rOut);
      }
      if (visual.ring && seededRandom() < visual.ring) {
        r = rOut * (0.62 + 0.22 * seededRandom()) + (seededRandom() - 0.5) * 0.9 * h;
      }
      r = clamp(r + (seededRandom() - 0.5) * 0.08 * radialH, 0.06, rOut);
      var theta;
      if (arms > 0) {
        var arm = Math.floor(seededRandom() * arms);
        theta = arm * (Math.PI * 2 / arms) + twist * Math.log(1 + r / Math.max(h, 0.2));
        theta += (seededRandom() - 0.5) * (isGas ? 0.42 : scatter);
      } else {
        theta = seededRandom() * Math.PI * 2 + (seededRandom() - 0.5) * scatter;
      }
      if (visual.irregular) {
        theta += Math.sin(r * 0.7 + seededRandom() * Math.PI) * 0.7;
        r = clamp(r * (0.82 + seededRandom() * 0.44), 0.06, rOut);
      }
      var bulgeChance = clamp(bulgeSignal * Math.exp(-r / Math.max(h * 1.15, 0.2)) * 1.55, 0, 0.72);
      var isBulge = !isGas && seededRandom() < bulgeChance;
      state.particles.push({
        r: r,
        theta: theta,
        phase: seededRandom() * Math.PI * 2,
        drift: (seededRandom() - 0.5) * 0.002,
        gas: isGas,
        bulge: isBulge,
        component: isGas ? "gas" : (isBulge ? "bulge" : "star"),
        alpha: isGas ? 0.58 + seededRandom() * 0.34 : (isBulge ? 0.42 + seededRandom() * 0.42 : 0.34 + seededRandom() * 0.38),
        size: isGas ? 1.15 + seededRandom() * 1.8 : (isBulge ? 1.1 + seededRandom() * 1.9 : 0.7 + seededRandom() * 1.4),
        z: (seededRandom() - seededRandom()) * thickness * rOut * (isBulge ? 3.4 : 1)
      });
    }
  }

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(400, Math.floor(rect.width * dpr));
    canvas.height = Math.max(320, Math.floor(rect.height * dpr));
    state.canvasScale = dpr;
  }

  function residualFieldData() {
    var curve = state.curve;
    var mode = state.comparison.fieldMode;
    if (!curve || mode === "off") return null;

    var values = [];
    if (mode === "baseline") {
      values = curve.points.map(function (point) {
        var target = Number.isFinite(point.vObs) ? point.vObs : point.vTotal;
        return { r: point.r, residual: point.vTotal - target };
      });
    } else if (mode === "custom") {
      var custom = currentFrameworkScore();
      if (!custom) return null;
      values = custom.points.map(function (point) {
        return { r: point.r, residual: point.residual };
      });
    } else if (mode === "comparison") {
      var comparison = currentComparisonScore();
      if (!comparison) return null;
      values = comparison.points.map(function (point) {
        return { r: point.r, residual: point.residual };
      });
    } else if (mode === "difference") {
      var a = currentFrameworkScore();
      var b = currentComparisonScore();
      if (!a || !b) return null;
      values = a.points.map(function (point, index) {
        var other = b.points[index];
        return { r: point.r, residual: other ? point.vCustom - other.vCustom : 0 };
      });
    }

    values = values.filter(function (point) {
      return Number.isFinite(point.r) && Number.isFinite(point.residual);
    });
    if (!values.length) return null;
    var maxAbs = Math.max.apply(null, values.map(function (point) { return Math.abs(point.residual); }));
    if (!Number.isFinite(maxAbs) || maxAbs < 0.05) return null;
    return { values: values, maxAbs: maxAbs };
  }

  function drawResidualField(cx, cy, scale, rOut, dpr, flatten) {
    var data = residualFieldData();
    if (!data) return;
    var bins = 36;
    var sums = [];
    var counts = [];
    for (var i = 0; i < bins; i += 1) {
      sums[i] = 0;
      counts[i] = 0;
    }
    data.values.forEach(function (point) {
      var index = clamp(Math.floor((point.r / rOut) * bins), 0, bins - 1);
      sums[index] += point.residual;
      counts[index] += 1;
    });

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (var j = 0; j < bins; j += 1) {
      if (!counts[j]) continue;
      var residual = sums[j] / counts[j];
      var strength = clamp(Math.abs(residual) / data.maxAbs, 0, 1);
      if (strength < 0.04) continue;
      var inner = Math.max(0, (j / bins) * rOut * scale);
      var outer = ((j + 1) / bins) * rOut * scale;
      var alpha = (0.035 + 0.18 * strength) * (state.curve && state.curve.kind === "synthetic" ? 0.82 : 1);
      ctx.beginPath();
      ctx.ellipse(cx, cy, outer, outer * flatten, 0, 0, Math.PI * 2);
      ctx.ellipse(cx, cy, inner, Math.max(0.1, inner * flatten), 0, 0, Math.PI * 2, true);
      ctx.fillStyle = residual >= 0
        ? "rgba(255, 114, 111, " + alpha.toFixed(3) + ")"
        : "rgba(94, 227, 194, " + alpha.toFixed(3) + ")";
      ctx.fill("evenodd");
    }
    ctx.restore();
  }

  function particleFillStyle(part, velocity, rOut, residualData) {
    var alpha = part.alpha.toFixed(3);
    if (state.view.colorMode === "velocity") {
      var t = clamp((velocity - 35) / 245, 0, 1);
      var r = Math.round(94 * (1 - t) + 255 * t);
      var g = Math.round(227 * (1 - t) + 207 * t);
      var b = Math.round(194 * (1 - t) + 95 * t);
      return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    }
    if (state.view.colorMode === "residual" && residualData) {
      var residual = valueAtRadius(residualData.values, part.r, "residual");
      var strength = clamp(Math.abs(residual) / residualData.maxAbs, 0, 1);
      var residualAlpha = (0.18 + 0.74 * strength) * part.alpha;
      if (residual >= 0) {
        return "rgba(255, 114, 111, " + residualAlpha.toFixed(3) + ")";
      }
      return "rgba(94, 227, 194, " + residualAlpha.toFixed(3) + ")";
    }
    if (part.gas) {
      return "rgba(94, 227, 194, " + alpha + ")";
    }
    if (part.bulge) {
      return "rgba(255, 233, 155, " + alpha + ")";
    }
    var warm = 178 + Math.floor(60 * (1 - part.r / rOut));
    return "rgba(255, " + warm + ", 112, " + alpha + ")";
  }

  function particleLayerVisible(part, layers) {
    if (part.component === "gas") return layers.gas !== false;
    if (part.component === "bulge") return layers.bulge !== false;
    return layers.stars !== false;
  }

  function drawGalaxy(timestamp) {
    if (!state.lastFrame) state.lastFrame = timestamp;
    var dt = Math.min(48, timestamp - state.lastFrame) / 16.667;
    state.lastFrame = timestamp;
    advanceEvolution(timestamp);
    var p = readParams();
    var w = canvas.width;
    var hPx = canvas.height;
    var dpr = state.canvasScale;
    var cx = w * 0.5;
    var cy = hPx * 0.53;
    var rOut = state.curve ? state.curve.rOut : 25;
    var scale = Math.min(w, hPx) * 0.43 / rOut;
    var view = readView();
    var layers = view.layers || {};
    var flatten = Math.cos(view.tilt * Math.PI / 180);
    var residualData = view.colorMode === "residual" ? residualFieldData() : null;

    ctx.fillStyle = "#0e100d";
    ctx.fillRect(0, 0, w, hPx);

    if (layers.guides !== false) drawCanvasGrid(cx, cy, scale, rOut, dpr, flatten);
    if (layers.residual !== false) drawResidualField(cx, cy, scale, rOut, dpr, flatten);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < state.particles.length; i += 1) {
      var part = state.particles[i];
      if (!particleLayerVisible(part, layers)) continue;
      var v = interpVelocity(part.r);
      var omega = (v / Math.max(part.r, 0.4)) * 0.0022 * p.speed;
      part.theta += (omega + part.drift) * dt;
      var wobble = Math.sin(timestamp * 0.0005 + part.phase) * 0.018 * part.r;
      var rr = part.r + wobble;
      var x = cx + Math.cos(part.theta) * rr * scale;
      var y = cy + Math.sin(part.theta) * rr * scale * flatten + (part.z || 0) * scale * view.depth;
      var radius = part.size * dpr;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = particleFillStyle(part, v, rOut, residualData);
      ctx.fill();
    }
    ctx.restore();

    if (layers.core !== false) drawCanvasCore(cx, cy, scale, dpr);
    requestAnimationFrame(drawGalaxy);
  }

  function drawCanvasGrid(cx, cy, scale, rOut, dpr, flatten) {
    ctx.save();
    ctx.strokeStyle = "rgba(238, 241, 232, 0.08)";
    ctx.lineWidth = 1 * dpr;
    for (var i = 1; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, (rOut * i / 4) * scale, (rOut * i / 4) * scale * flatten, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(214, 255, 99, 0.14)";
    ctx.beginPath();
    ctx.moveTo(cx - rOut * scale, cy);
    ctx.lineTo(cx + rOut * scale, cy);
    ctx.stroke();
    ctx.strokeStyle = "rgba(94, 227, 194, 0.10)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - rOut * scale * flatten);
    ctx.lineTo(cx, cy + rOut * scale * flatten);
    ctx.stroke();
    ctx.restore();
  }

  function drawCanvasCore(cx, cy, scale, dpr) {
    var grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28 * dpr);
    grd.addColorStop(0, "rgba(255, 233, 155, 0.92)");
    grd.addColorStop(0.45, "rgba(243, 155, 109, 0.28)");
    grd.addColorStop(1, "rgba(243, 155, 109, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 30 * dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(214, 255, 99, 0.95)";
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode !== "synthetic" && state.evolution.playing) stopEvolution();
    document.querySelectorAll(".mode-button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
    document.querySelectorAll(".synthetic-only").forEach(function (el) {
      el.classList.toggle("hidden", mode !== "synthetic");
    });
    document.querySelectorAll(".observed-only").forEach(function (el) {
      el.classList.toggle("hidden", mode !== "observed");
    });
    document.querySelectorAll(".etg-only").forEach(function (el) {
      el.classList.toggle("hidden", mode !== "etg");
    });
    document.querySelectorAll(".ltg-browser-only").forEach(function (el) {
      el.classList.toggle("hidden", mode !== "observed");
    });
    if (mode === "synthetic") {
      buildSyntheticCurve();
    } else if (mode === "etg") {
      loadSelectedEtg();
    } else {
      loadSelectedSample();
    }
    generateParticles();
    updateLtgBrowser();
    drawRouteMap();
  }

  function loadObservedCurve(curve) {
    state.curve = curve;
    state.observed = curve;
    state.route = classifyRoute(curve.points, curve);
    scoreCurrentFramework();
    scoreCurrentComparison();
    updateDiagnostics();
    runScienceQa();
    drawPlots();
    state.seed = hashName(curve.name);
    generateParticles();
    if (curve.kind === "observed") updateLtgBrowser();
  }

  function updateCustomImportNote(curve) {
    if (!$("customImportNote")) return;
    var summary = curve && curve.normalization ? curve.normalization : state.importWizard.lastSummary;
    if (!summary) {
      $("customImportNote").textContent = "CSV/JSON columns can use r, radius, Vobs, errV, Vgas, Vdisk, Vbulge, SBdisk, and SBbul.";
      return;
    }
    $("customImportNote").textContent = "Normalized " + summary.usableRows + "/" + summary.inputRows + " rows to kpc and km/s; radius " + summary.radiusUnit + ", velocity " + summary.velocityConvention + ", inclination " + fmt(summary.inclinationDeg, 1) + " deg.";
  }

  function loadCustomGalaxyFromText(text, filePath) {
    try {
      var name = $("customGalaxyName") && $("customGalaxyName").value.trim() ? $("customGalaxyName").value.trim() : (filePath || "Custom galaxy");
      var curve = parseCustomGalaxyData(text, name, filePath || "custom-import");
      loadObservedCurve(curve);
      updateCustomImportNote(curve);
      if ($("sampleSelect")) $("sampleSelect").value = "";
    } catch (error) {
      if ($("customImportNote")) $("customImportNote").textContent = "Import failed: " + error.message;
      window.alert(error.message);
    }
  }

  function hashName(name) {
    var hash = 2166136261;
    for (var i = 0; i < name.length; i += 1) {
      hash ^= name.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function setupSamples() {
    var select = $("sampleSelect");
    select.innerHTML = "";
    var samples = window.MTS_SAMPLES || [];
    state.ltgIndex = [];
    if (!samples.length) {
      var option = document.createElement("option");
      option.value = "";
      option.textContent = "No bundled samples";
      select.appendChild(option);
      return;
    }
    samples.forEach(function (sample, index) {
      var meta = analyzeLtgSample(sample, index);
      state.ltgIndex.push(meta);
      var option = document.createElement("option");
      option.value = String(index);
      option.textContent = meta.name;
      select.appendChild(option);
    });
  }

  function filteredLtgIndex() {
    var browser = state.ltgBrowser;
    var search = browser.search.trim().toLowerCase();
    var rows = state.ltgIndex.filter(function (row) {
      if (search && row.name.toLowerCase().indexOf(search) === -1) return false;
      if (browser.route !== "all" && row.route !== browser.route) return false;
      if (browser.hunt === "late" && !row.lateLoad) return false;
      if (browser.hunt === "cdc" && !row.cdc) return false;
      if (browser.hunt === "single" && row.route !== "buffered single-crossing") return false;
      if (browser.hunt === "infeasible" && row.route !== "outer-infeasible") return false;
      if (browser.hunt === "worst" && !Number.isFinite(row.rmse)) return false;
      if (browser.hunt === "best" && !Number.isFinite(row.rmse)) return false;
      return true;
    });

    var sort = browser.hunt === "worst" ? "rmse-desc" : (browser.hunt === "best" ? "rmse-asc" : browser.sort);
    rows.sort(function (a, b) {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "rmse-asc") return safeNumber(a.rmse, Infinity) - safeNumber(b.rmse, Infinity);
      if (sort === "uout-desc") return safeNumber(b.uOut, -Infinity) - safeNumber(a.uOut, -Infinity);
      if (sort === "priority-desc") return safeNumber(b.priorityL, -Infinity) - safeNumber(a.priorityL, -Infinity);
      if (sort === "xcross-desc") return safeNumber(b.xCross, -Infinity) - safeNumber(a.xCross, -Infinity);
      return safeNumber(b.rmse, -Infinity) - safeNumber(a.rmse, -Infinity);
    });

    if (browser.hunt === "worst" || browser.hunt === "best") {
      rows = rows.slice(0, 20);
    }
    return rows;
  }

  function safeNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function updateLtgBrowser() {
    var table = $("galaxyTable");
    if (!table) return;
    var rows = filteredLtgIndex();
    $("ltgBrowserCount").textContent = rows.length + " / " + state.ltgIndex.length;
    updateLtgRouteSummary();
    table.innerHTML = "";

    rows.slice(0, 90).forEach(function (row) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "galaxy-row" + (state.curve && state.curve.name === row.name ? " active" : "");
      button.innerHTML =
        '<span class="galaxy-name">' + row.name + '</span>' +
        '<span class="route-badge">' + row.route + '</span>' +
        '<span class="table-number">' + fmt(row.rmse, 1) + '</span>' +
        '<span class="table-number">' + fmt(row.uOut, 2) + '</span>';
      button.addEventListener("click", function () {
        $("sampleSelect").value = String(row.index);
        setMode("observed");
        loadSelectedSample();
      });
      table.appendChild(button);
    });
    drawRouteMap();
    if (state.population.summary && state.population.summary.subset === "browser") {
      state.population.summary = null;
      state.population.rows = [];
      state.population.correlationRows = [];
    }
    updatePopulationPanel();
  }

  function updateLtgRouteSummary() {
    var summary = $("ltgRouteSummary");
    if (!summary) return;
    var counts = {
      "low-load": 0,
      "buffered upward-crossing": 0,
      "buffered single-crossing": 0,
      "outer-infeasible": 0,
      "CDC-low-load": 0,
      late: 0
    };
    state.ltgIndex.forEach(function (row) {
      if (counts[row.route] != null) counts[row.route] += 1;
      if (row.lateLoad) counts.late += 1;
    });
    var chips = [
      ["Low", counts["low-load"]],
      ["Upward", counts["buffered upward-crossing"]],
      ["Single", counts["buffered single-crossing"]],
      ["Infeasible", counts["outer-infeasible"]],
      ["CDC-low", counts["CDC-low-load"]],
      ["Late flag", counts.late]
    ];
    summary.innerHTML = chips.map(function (chip) {
      return '<div class="summary-chip"><span>' + chip[0] + '</span><strong>' + chip[1] + '</strong></div>';
    }).join("");
  }

  function setupEtgSamples() {
    var select = $("etgSelect");
    select.innerHTML = "";
    var samples = window.MTS_ETG_SAMPLES || [];
    if (!samples.length) {
      var option = document.createElement("option");
      option.value = "";
      option.textContent = "No bundled ETGs";
      select.appendChild(option);
      return;
    }
    samples.forEach(function (sample, index) {
      var option = document.createElement("option");
      option.value = String(index);
      option.textContent = sample.name;
      select.appendChild(option);
    });
  }

  function loadSelectedEtg() {
    var samples = window.MTS_ETG_SAMPLES || [];
    var select = $("etgSelect");
    if (!samples.length) return;
    var index = select.value === "" ? 0 : Number(select.value);
    var sample = samples[index];
    if (sample) {
      loadObservedCurve(parseEtgSample(sample));
    }
  }

  function loadSelectedSample() {
    var samples = window.MTS_SAMPLES || [];
    var select = $("sampleSelect");
    if (!samples.length || !select.value) {
      if (samples.length && select.value === "0") {
        loadObservedCurve(parseRotmod(samples[0].text, samples[0].name));
      }
      return;
    }
    var sample = samples[Number(select.value)];
    if (sample) {
      loadObservedCurve(parseRotmod(sample.text, sample.name));
      $("pasteInput").value = sample.text;
    }
  }

  function slugify(value) {
    return String(value || "mts-galaxy")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "mts-galaxy";
  }

  function exportCell(value) {
    if (value == null) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return Number.isFinite(value) ? String(Number(value.toPrecision(10))) : "";
    return String(value);
  }

  function csvEscape(value) {
    var text = exportCell(value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function rowsToCsv(headers, rows) {
    return [headers.map(csvEscape).join(",")].concat(rows.map(function (row) {
      return headers.map(function (key) {
        return csvEscape(row[key]);
      }).join(",");
    })).join("\r\n");
  }

  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    $("exportNote").textContent = "Prepared " + filename;
  }

  function currentDiagnosticsObject() {
    var curve = state.curve;
    var route = state.route;
    var frameworkScore = currentFrameworkScore();
    var comparisonScore = currentComparisonScore();
    return {
      generatedAt: new Date().toISOString(),
      app: "MTS Galaxy Lab",
      mode: state.mode,
      constants: CONST,
      curve: curve ? {
        kind: curve.kind,
        name: curve.name,
        h: curve.h,
        rOut: curve.rOut,
        fGasOut: curve.fGasOut,
        q: curve.q,
        leff: curve.leff,
        memoryLoad: curve.memoryLoad,
        rmse: curve.rmse,
        pointCount: curve.points.length,
        forge: curve.forge || null,
        stage4: curve.stage4 || null,
        provenance: curve.provenance || null
      } : null,
      route: route ? {
        id: route.id,
        u0: route.u0,
        uOut: route.uOut,
        uMax: route.uMax,
        downCrossings: route.downCrossings,
        upCrossings: route.upCrossings,
        outerViable: route.outerViable,
        cdc: route.cdc,
        xCross: route.xCross,
        xCrossNorm: route.xCrossNorm,
        u075: route.u075,
        hOverRout: route.hOverRout,
        hGuard: route.hGuard,
        lGap: route.lGap,
        gScalar: route.gScalar,
        priorityL: route.priorityL,
        priorityL3: route.priorityL3,
        lateLoad: route.lateLoad,
        c1: route.c1,
        etgCurvatureA: route.etgCurvatureA,
        ltgCurvatureA: route.ltgCurvatureA,
        ltgCurvatureLegacyA: route.ltgCurvatureLegacyA,
        supercriticalU075: route.supercriticalU075,
        innerLaw: route.innerLaw
      } : null,
      ltgBrowser: {
        filters: state.ltgBrowser,
        filteredCount: filteredLtgIndex().length,
        totalCount: state.ltgIndex.length
      },
      claims: {
        summary: state.claims.summary,
        activeMemberships: caseMembershipFlags()
      },
      framework: {
        expression: state.framework.expression,
        error: state.framework.error,
        current: frameworkScore ? {
          rmse: frameworkScore.rmse,
          baselineRmse: frameworkScore.baselineRmse,
          delta: frameworkScore.delta,
          outerRmse: frameworkScore.outerRmse,
          dominantBand: frameworkScore.dominantBand,
          routeId: frameworkScore.routeId,
          routePreserved: frameworkScore.routePreserved,
          xCrossError: frameworkScore.xCrossError,
          worstResidual: frameworkScore.worstResidual,
          worstR: frameworkScore.worstR,
          invalidCount: frameworkScore.invalidCount
        } : null,
        batchSummary: state.framework.batchSummary
      },
      researchCandidate: state.researchCandidate.current ? {
        id: state.researchCandidate.current.id,
        name: state.researchCandidate.current.name,
        kind: state.researchCandidate.current.kind,
        status: state.researchCandidate.current.status,
        expression: state.researchCandidate.current.expression,
        loadedAt: state.researchCandidate.loadedAt,
        split: state.researchCandidate.current.split,
        holdout: state.researchCandidate.current.holdout,
        guardrails: state.researchCandidate.current.guardrails
      } : null,
      comparison: {
        expression: state.comparison.expression,
        preset: state.comparison.preset,
        fieldMode: state.comparison.fieldMode,
        error: state.comparison.error,
        current: comparisonScore ? {
          rmse: comparisonScore.rmse,
          baselineRmse: comparisonScore.baselineRmse,
          delta: comparisonScore.delta,
          outerRmse: comparisonScore.outerRmse,
          dominantBand: comparisonScore.dominantBand,
          routeId: comparisonScore.routeId,
          routePreserved: comparisonScore.routePreserved,
          xCrossError: comparisonScore.xCrossError,
          worstResidual: comparisonScore.worstResidual,
          worstR: comparisonScore.worstR,
          invalidCount: comparisonScore.invalidCount
        } : null,
        aMinusB: frameworkScore && comparisonScore ? {
          rmse: frameworkScore.rmse - comparisonScore.rmse,
          outerRmse: frameworkScore.outerRmse - comparisonScore.outerRmse,
          winner: comparisonWinnerText(frameworkScore, comparisonScore)
        } : null
      },
      view: {
        tilt: state.view.tilt,
        depth: state.view.depth,
        colorMode: state.view.colorMode,
        layers: state.view.layers
      },
      benchmark: {
        pack: state.benchmark.pack,
        summary: state.benchmark.summary,
        rows: state.benchmark.rows
      },
      tournament: {
        queue: $("tournamentQueue") ? $("tournamentQueue").value : state.tournament.queue,
        summary: state.tournament.summary,
        rows: state.tournament.rows
      },
      routeMap: state.routeMap,
      population: {
        x: state.population.x,
        y: state.population.y,
        subset: state.population.subset,
        resamples: state.population.resamples,
        summary: state.population.summary,
        correlationRows: state.population.correlationRows
      },
      importWizard: {
        lastSummary: state.importWizard.lastSummary
      },
      fitCorrelation: fitCorrelationStats(),
      residualBands: residualBandSummaries(),
      worstResiduals: worstResidualRows(null, 5),
      evolution: {
        track: state.evolution.track,
        t: state.evolution.t,
        flips: state.evolution.flips,
        playing: state.evolution.playing
      },
      forge: {
        preset: state.forge.preset,
        seed: state.forge.seed,
        active: activeForgeMeta()
      },
      uncertainty: {
        config: {
          noisePct: state.uncertainty.noisePct,
          mlPct: state.uncertainty.mlPct,
          trials: state.uncertainty.trials
        },
        summary: currentUncertaintySummary()
      },
      scienceQa: {
        summary: currentScienceQaSummary(),
        provenanceRows: currentScienceQaSummary() ? state.scienceQa.provenanceRows : [],
        schemaRows: currentScienceQaSummary() ? state.scienceQa.schemaRows : [],
        auditRows: currentScienceQaSummary() ? state.scienceQa.auditRows : [],
        stressRows: currentScienceQaSummary() ? state.scienceQa.stressRows : []
      },
      sweep: {
        config: {
          gammaMin: state.sweep.gammaMin,
          gammaMax: state.sweep.gammaMax,
          qMin: state.sweep.qMin,
          qMax: state.sweep.qMax,
          grid: state.sweep.grid
        },
        summary: state.sweep.summary
      }
    };
  }

  function currentCurveCsv() {
    var curve = state.curve;
    var route = state.route;
    var frameworkScore = currentFrameworkScore();
    var comparisonScore = currentComparisonScore();
    var forge = curve.forge || null;
    var headers = [
      "galaxy",
      "mode",
      "route",
      "forge_preset",
      "forge_seed",
      "forge_stress",
      "point_index",
      "r_kpc",
      "v_obs_kms",
      "err_v_kms",
      "v_model_kms",
      "v_bar_kms",
      "v_mts_kms",
      "v_gas_kms",
      "v_disk_kms",
      "v_bulge_kms",
      "u",
      "residual_kms",
      "v_custom_kms",
      "custom_residual_kms",
      "v_compare_kms",
      "compare_residual_kms",
      "custom_minus_compare_kms"
    ];
    var rows = curve.points.map(function (p, index) {
      var frameworkPoint = frameworkScore && frameworkScore.points[index] ? frameworkScore.points[index] : null;
      var comparisonPoint = comparisonScore && comparisonScore.points[index] ? comparisonScore.points[index] : null;
      return {
        galaxy: curve.name,
        mode: curve.kind,
        route: route.id,
        forge_preset: forge ? forge.preset : null,
        forge_seed: forge ? forge.seed : null,
        forge_stress: forge ? forge.stress : null,
        point_index: index,
        r_kpc: p.r,
        v_obs_kms: p.vObs,
        err_v_kms: p.errV,
        v_model_kms: p.vTotal,
        v_bar_kms: p.vBar,
        v_mts_kms: p.vMts,
        v_gas_kms: p.vGas,
        v_disk_kms: p.vDisk,
        v_bulge_kms: p.vBulge,
        u: p.u,
        residual_kms: Number.isFinite(p.vObs) ? p.vTotal - p.vObs : null,
        v_custom_kms: frameworkPoint ? frameworkPoint.vCustom : null,
        custom_residual_kms: frameworkPoint ? frameworkPoint.residual : null,
        v_compare_kms: comparisonPoint ? comparisonPoint.vCustom : null,
        compare_residual_kms: comparisonPoint ? comparisonPoint.residual : null,
        custom_minus_compare_kms: frameworkPoint && comparisonPoint ? frameworkPoint.vCustom - comparisonPoint.vCustom : null
      };
    });
    return rowsToCsv(headers, rows);
  }

  function ltgIndexCsv() {
    var headers = [
      "name",
      "route",
      "rmse_kms",
      "h_kpc",
      "r_out_kpc",
      "f_gas_out",
      "l_eff_kpc",
      "l_eff_over_h",
      "memory_load",
      "h_over_rout",
      "u0",
      "u_out",
      "u_max",
      "x_cross",
      "u_075",
      "l_gap_kpc",
      "g_memory_x",
      "priority_l_mae_kms",
      "priority_l3_mae_kms",
      "ltg_curvature_a",
      "ltg_curvature_legacy_a",
      "supercritical_u075",
      "s_law_s",
      "s_law_predicted_umax",
      "s_law_residual",
      "late_load",
      "cdc",
      "outer_viable"
    ];
    return rowsToCsv(headers, filteredLtgIndex().map(function (row) {
      return {
        name: row.name,
        route: row.route,
        rmse_kms: row.rmse,
        h_kpc: row.h,
        r_out_kpc: row.rOut,
        f_gas_out: row.fGasOut,
        l_eff_kpc: row.leff,
        l_eff_over_h: row.leffOverH,
        memory_load: row.memoryLoad,
        h_over_rout: row.hOverRout,
        u0: row.u0,
        u_out: row.uOut,
        u_max: row.uMax,
        x_cross: row.xCross,
        u_075: row.u075,
        l_gap_kpc: row.lGap,
        g_memory_x: row.gScalar,
        priority_l_mae_kms: row.priorityL,
        priority_l3_mae_kms: row.priorityL3,
        ltg_curvature_a: row.ltgCurvatureA,
        ltg_curvature_legacy_a: row.ltgCurvatureLegacyA,
        supercritical_u075: row.supercriticalU075,
        s_law_s: row.sLawS,
        s_law_predicted_umax: row.sLawPredictedUmax,
        s_law_residual: row.sLawResidual,
        late_load: row.lateLoad,
        cdc: row.cdc,
        outer_viable: row.outerViable
      };
    }));
  }

  function frameworkScoresCsv() {
    var headers = [
      "expression",
      "name",
      "route",
      "custom_rmse_kms",
      "mts_rmse_kms",
      "delta_rmse_kms",
      "inner_rmse_kms",
      "mid_rmse_kms",
      "outer_rmse_kms",
      "dominant_band",
      "custom_route",
      "route_preserved",
      "x_cross_error",
      "worst_residual_kms",
      "worst_r_kpc",
      "invalid_points",
      "h_kpc",
      "r_out_kpc",
      "u_out",
      "late_load",
      "cdc",
      "outer_viable"
    ];
    return rowsToCsv(headers, state.framework.batch.map(function (row) {
      return {
        expression: state.framework.expression,
        name: row.name,
        route: row.route,
        custom_rmse_kms: row.customRmse,
        mts_rmse_kms: row.mtsRmse,
        delta_rmse_kms: row.delta,
        inner_rmse_kms: row.innerRmse,
        mid_rmse_kms: row.midRmse,
        outer_rmse_kms: row.outerRmse,
        dominant_band: row.dominantBand,
        custom_route: row.customRoute,
        route_preserved: row.routePreserved,
        x_cross_error: row.xCrossError,
        worst_residual_kms: row.worstResidual,
        worst_r_kpc: row.worstR,
        invalid_points: row.invalidCount,
        h_kpc: row.h,
        r_out_kpc: row.rOut,
        u_out: row.uOut,
        late_load: row.lateLoad,
        cdc: row.cdc,
        outer_viable: row.outerViable
      };
    }));
  }

  function svgExportStyle() {
    return [
      ".plot-axis{stroke:#9ba497;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".plot-grid{stroke:#343b31;stroke-width:1;vector-effect:non-scaling-stroke}",
      ".plot-label{fill:#788171;font-size:10px;font-family:Arial,sans-serif;font-weight:650}",
      ".line-total{fill:none;stroke:#d6ff63;stroke-width:3;vector-effect:non-scaling-stroke}",
      ".line-bar{fill:none;stroke:#5ee3c2;stroke-width:2;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}",
      ".line-mts{fill:none;stroke:#f39b6d;stroke-width:2;vector-effect:non-scaling-stroke}",
      ".line-custom{fill:none;stroke:#ffffff;stroke-width:2.2;stroke-dasharray:2 5;vector-effect:non-scaling-stroke}",
      ".line-compare{fill:none;stroke:#ffcf5f;stroke-width:2.2;stroke-dasharray:8 5;vector-effect:non-scaling-stroke}",
      ".line-obs{fill:none;stroke:#8aa8ff;stroke-width:2.5;vector-effect:non-scaling-stroke}",
      ".dot-obs{fill:#8aa8ff;stroke:#11130f;stroke-width:1}",
      ".line-u{fill:none;stroke:#d6ff63;stroke-width:2.5;vector-effect:non-scaling-stroke}",
      ".threshold-line{stroke:#ff726f;stroke-width:1.5;stroke-dasharray:5 5;vector-effect:non-scaling-stroke}",
      ".line-residual{fill:none;stroke:#8aa8ff;stroke-width:2.4;vector-effect:non-scaling-stroke}",
      ".line-compare-residual{fill:none;stroke:#ffcf5f;stroke-width:2;stroke-dasharray:7 5;vector-effect:non-scaling-stroke}",
      ".zero-line{stroke:#aeb7a8;stroke-width:1;stroke-dasharray:4 5;vector-effect:non-scaling-stroke}",
      ".dot-residual{fill:#8aa8ff;stroke:#11130f;stroke-width:1}",
      ".dot-compare-residual{fill:#ffcf5f;stroke:#11130f;stroke-width:1}",
      ".route-point{stroke:#11130f;stroke-width:1;opacity:.86}.route-low{fill:#d6ff63}.route-cdc{fill:#5ee3c2}.route-up{fill:#8aa8ff}.route-single{fill:#ffcf5f}.route-infeasible{fill:#ff726f}.route-point.active{stroke:#fff;stroke-width:2}"
    ].join("\n");
  }

  function styledSvgMarkup(id) {
    var source = $(id);
    var clone = source.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    var style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = svgExportStyle();
    clone.insertBefore(style, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  }

  function htmlEscape(value) {
    return exportCell(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stableStringify(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) {
      return "[" + value.map(stableStringify).join(",") + "]";
    }
    return "{" + Object.keys(value).sort().filter(function (key) {
      return key !== "generatedAt" && key !== "exportedAt" && key !== "savedAt";
    }).map(function (key) {
      return JSON.stringify(key) + ":" + stableStringify(value[key]);
    }).join(",") + "}";
  }

  function hashText(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
  }

  function capsuleHash(capsule) {
    return "mts-" + hashText(stableStringify(capsule));
  }

  function tableRowsHtml(rows) {
    return rows.map(function (row) {
      return "<tr><th>" + htmlEscape(row[0]) + "</th><td>" + htmlEscape(row[1]) + "</td></tr>";
    }).join("");
  }

  function diagnosticRows() {
    var curve = state.curve;
    var route = state.route;
    var frameworkScore = currentFrameworkScore();
    var comparisonScore = currentComparisonScore();
    var provenance = curveProvenance(curve);
    var rows = [
      ["Name", curve.name],
      ["Mode", curve.kind],
      ["Route", route.id],
      ["h", fmt(curve.h, 3) + " kpc"],
      ["r_out", fmt(curve.rOut, 3) + " kpc"],
      ["u0", fmt(route.u0, 4)],
      ["u_out", fmt(route.uOut, 4)],
      ["u_max", fmt(route.uMax, 4)],
      ["x_cross", route.xCrossNorm == null ? "--" : fmt(route.xCrossNorm, 4)],
      ["Source", provenance.repoSource],
      ["File path", provenance.filePath],
      ["Parser", provenance.parserVersion],
      ["Raw checksum", provenance.rawFileChecksum],
      ["Feature checksum", provenance.processedFeatureChecksum]
    ];

    if (curve.kind === "etg") {
      rows.push(["R80", fmt(curve.stage4.r80, 3) + " kpc"]);
      rows.push(["R85", curve.stage4.r85 == null ? "--" : fmt(curve.stage4.r85, 3) + " kpc"]);
      rows.push(["R90", fmt(curve.stage4.r90, 3) + " kpc"]);
      rows.push(["r_out/R85", curve.stage4.rOutOverR85 == null ? "--" : fmt(curve.stage4.rOutOverR85, 4)]);
      rows.push(["Sigma80-100", fmt(curve.stage4.sigma80, 4)]);
      rows.push(["logy", fmt(curve.stage4.logy, 4)]);
      rows.push(["Stage4 dR80", fmt(curve.stage4.residualR80, 4)]);
      rows.push(["Stage4 dR90", fmt(curve.stage4.residualR90, 4)]);
      rows.push(["Stage4 v18 row", "HL11-noNGC3998 R85 LOO=0.156"]);
      rows.push(["c1 slope law", route.c1 == null ? "--" : fmt(route.c1, 4)]);
      rows.push(["ETG curvature A", route.etgCurvatureA == null ? "--" : fmt(route.etgCurvatureA, 4)]);
      if (route.innerLaw) {
        rows.push(["S-law S", fmt(route.innerLaw.s, 4)]);
        rows.push(["S-law predicted Umax", fmt(route.innerLaw.predictedUmax, 4)]);
        rows.push(["S-law residual", fmt(route.innerLaw.residual, 4)]);
      }
    } else {
      rows.push(["f_gas_out", fmt(curve.fGasOut, 4)]);
      rows.push(["L_eff", fmt(curve.leff, 4) + " kpc"]);
      rows.push(["memory load", fmt(curve.memoryLoad, 4)]);
      rows.push(["RMSE", curve.rmse == null ? "--" : fmt(curve.rmse, 4) + " km/s"]);
      if (curve.kind === "synthetic") {
        if (curve.forge) {
          rows.push(["Forge morphology", curve.forge.label]);
          rows.push(["Forge seed", curve.forge.seed]);
          rows.push(["Forge stress", curve.forge.stress]);
          rows.push(["Forge target", curve.forge.target]);
        }
        rows.push(["Evolution track", currentEvolutionTrack().label]);
        rows.push(["Evolution epoch", fmt(state.evolution.t, 4)]);
        rows.push(["Evolution route flips", state.evolution.flips]);
      }
      rows.push(["L_gap", route.lGap == null ? "--" : fmt(route.lGap, 4) + " kpc"]);
      rows.push(["g = memory*x", route.gScalar == null ? "--" : fmt(route.gScalar, 4)]);
      rows.push(["Priority L MAE", route.priorityL == null ? "--" : fmt(route.priorityL, 4) + " km/s"]);
      rows.push(["Priority L3 diagnostic", route.priorityL3 == null ? "--" : fmt(route.priorityL3, 4) + " km/s"]);
      rows.push(["Late-load final", route.lateLoad ? "flagged" : "clear"]);
      rows.push(["u_0.75 supercritical", route.supercriticalU075 ? "yes" : "no"]);
      rows.push(["LTG curvature A inv_sqrt", route.ltgCurvatureA == null ? "--" : fmt(route.ltgCurvatureA, 4)]);
      if (route.innerLaw) {
        rows.push(["S-law S", fmt(route.innerLaw.s, 4)]);
        rows.push(["S-law predicted Umax", fmt(route.innerLaw.predictedUmax, 4)]);
        rows.push(["S-law residual", fmt(route.innerLaw.residual, 4)]);
      }
    }

    if (frameworkScore) {
      rows.push(["Custom expression", frameworkScore.expression]);
      rows.push(["Custom RMSE", fmt(frameworkScore.rmse, 4) + " km/s"]);
      rows.push(["Baseline RMSE", fmt(frameworkScore.baselineRmse, 4) + " km/s"]);
      rows.push(["Custom delta", fmt(frameworkScore.delta, 4) + " km/s"]);
    }
    if (comparisonScore) {
      rows.push(["Comparator expression", comparisonScore.expression]);
      rows.push(["Comparator RMSE", fmt(comparisonScore.rmse, 4) + " km/s"]);
      rows.push(["Comparator route", comparisonScore.routeId]);
      if (frameworkScore) {
        rows.push(["A/B winner", comparisonWinnerText(frameworkScore, comparisonScore)]);
        rows.push(["A minus B outer RMSE", fmt(frameworkScore.outerRmse - comparisonScore.outerRmse, 4) + " km/s"]);
      }
      rows.push(["Residual field", state.comparison.fieldMode]);
    }

    var uncertainty = currentUncertaintySummary();
    if (uncertainty) {
      rows.push(["Uncertainty route stability", fmt(uncertainty.routeStability * 100, 1) + "%"]);
      rows.push(["Uncertainty dominant route", uncertainty.dominantRoute]);
      rows.push(["Uncertainty RMSE p90", fmt(uncertainty.p90Rmse, 4) + " km/s"]);
    }

    var scienceQa = currentScienceQaSummary();
    if (scienceQa) {
      rows.push(["Scientific QA", scienceQa.schemaPass + " schema pass / " + scienceQa.schemaWarn + " warn / " + scienceQa.schemaFail + " fail"]);
      rows.push(["QA error bars", scienceQa.errorBarCount + "/" + scienceQa.pointCount]);
      rows.push(["QA covariance", scienceQa.covariancePresent ? "present" : "missing"]);
    }

    if (state.population.summary) {
      rows.push(["Population subset", state.population.summary.subset]);
      rows.push(["Population N", state.population.summary.n]);
      rows.push(["Population correlation", fmt(state.population.summary.correlation, 4)]);
      rows.push(["Population bootstrap", fmt(state.population.summary.bootstrap.p10, 3) + " to " + fmt(state.population.summary.bootstrap.p90, 3)]);
    }

    return rows;
  }

  function buildDiagnosticSheetHtml() {
    var curve = state.curve;
    var rows = diagnosticRows().map(function (row) {
      return "<tr><th>" + htmlEscape(row[0]) + "</th><td>" + htmlEscape(row[1]) + "</td></tr>";
    }).join("");
    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head>",
      "<meta charset=\"utf-8\">",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>MTS diagnostic sheet - " + htmlEscape(curve.name) + "</title>",
      "<style>",
      "body{margin:0;background:#f6f7f2;color:#14170d;font-family:Inter,Arial,sans-serif}",
      "main{max-width:980px;margin:0 auto;padding:34px}",
      "header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #14170d;padding-bottom:18px;margin-bottom:24px}",
      "h1{margin:0;font-size:30px;line-height:1}p{margin:6px 0 0;color:#4a5145}",
      ".pill{align-self:flex-start;border:1px solid #14170d;border-radius:6px;padding:8px 10px;font-size:12px;font-weight:800;text-transform:uppercase}",
      "section{margin-top:22px}.grid{display:grid;grid-template-columns:320px 1fr;gap:24px;align-items:start}",
      "table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #c9d0c1;padding:8px;text-align:left;vertical-align:top}th{width:42%;color:#4a5145;font-weight:800}",
      ".plots{display:grid;gap:18px}.plot{border:1px solid #c9d0c1;border-radius:8px;background:white;padding:12px}",
      ".plot h2{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#4a5145}",
      ".plot svg{width:100%;height:auto;display:block}",
      "footer{margin-top:24px;color:#66705f;font-size:12px}",
      "@media print{main{padding:18px}.plot{break-inside:avoid}}",
      "</style>",
      "</head>",
      "<body>",
      "<main>",
      "<header><div><h1>" + htmlEscape(curve.name) + "</h1><p>MTS Galaxy Lab diagnostic sheet</p><p>Generated " + htmlEscape(new Date().toISOString()) + "</p></div><div class=\"pill\">" + htmlEscape(state.route.id) + "</div></header>",
      "<section class=\"grid\"><table><tbody>" + rows + "</tbody></table><div class=\"plots\">",
      "<div class=\"plot\"><h2>Rotation Curve</h2>" + styledSvgMarkup("curvePlot") + "</div>",
      "<div class=\"plot\"><h2>u(r) Gate Profile</h2>" + styledSvgMarkup("uPlot") + "</div>",
      "<div class=\"plot\"><h2>Residual View</h2>" + styledSvgMarkup("residualPlot") + "</div>",
      curve.kind !== "synthetic" ? "<div class=\"plot\"><h2>Fit Correlation</h2>" + styledSvgMarkup("fitCorrelationPlot") + "</div>" : "",
      "</div></section>",
      "<footer>Constants: Gamma0=809.956, Rmax=1.758948, ML_disk=0.5, ML_bulge=0.7, q=0.77 for ROTMOD mode.</footer>",
      "</main>",
      "</body>",
      "</html>"
    ].join("");
  }

  function reportCss() {
    return [
      "body{margin:0;background:#f6f7f2;color:#14170d;font-family:Inter,Arial,sans-serif}",
      "main{max-width:1120px;margin:0 auto;padding:34px}",
      "header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #14170d;padding-bottom:18px;margin-bottom:24px}",
      "h1{margin:0;font-size:30px;line-height:1}h2{margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#4a5145}p{margin:6px 0 0;color:#4a5145}",
      ".hash{align-self:flex-start;border:1px solid #14170d;border-radius:6px;padding:8px 10px;font-size:12px;font-weight:800;text-transform:uppercase}",
      ".grid{display:grid;grid-template-columns:330px 1fr;gap:24px;align-items:start}.plots{display:grid;grid-template-columns:1fr 1fr;gap:16px}",
      "section{margin-top:22px}.plot,.panel{border:1px solid #c9d0c1;border-radius:8px;background:white;padding:12px}",
      "table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #c9d0c1;padding:8px;text-align:left;vertical-align:top}th{width:42%;color:#4a5145;font-weight:800}",
      ".score-table th{width:auto}.plot svg{width:100%;height:auto;display:block}pre{white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.45;background:#fff;border:1px solid #c9d0c1;border-radius:8px;padding:12px}",
      "footer{margin-top:24px;color:#66705f;font-size:12px}",
      "@media(max-width:820px){main{padding:20px}.grid,.plots{grid-template-columns:1fr}header{display:block}.hash{display:inline-block;margin-top:14px}}",
      "@media print{main{padding:18px}.plot,.panel{break-inside:avoid}.plots{grid-template-columns:1fr 1fr}details{display:none}}"
    ].join("");
  }

  function benchmarkSummaryRows() {
    var summary = state.benchmark.summary;
    if (!summary) return [];
    return [
      ["Benchmark pack", summary.packLabel],
      ["Curves", summary.count],
      ["Suite winner", summary.winner],
      ["A wins", summary.aWins],
      ["B wins", summary.bWins],
      ["Ties", summary.ties],
      ["Mean A RMSE", fmt(summary.meanA, 4) + " km/s"],
      ["Mean B RMSE", fmt(summary.meanB, 4) + " km/s"],
      ["A route preservation", fmt(summary.aRouteRate * 100, 1) + "%"],
      ["B route preservation", fmt(summary.bRouteRate * 100, 1) + "%"]
    ];
  }

  function tournamentSummaryRows() {
    if (!state.tournament.rows.length) return [];
    var best = state.tournament.rows[0];
    return [
      ["Tournament frameworks", state.tournament.rows.length],
      ["Tournament samples", state.tournament.summary ? state.tournament.summary.sampleCount : "--"],
      ["Tournament leader", best.name],
      ["Leader mean RMSE", fmt(best.meanRmse, 4) + " km/s"],
      ["Leader route preservation", Number.isFinite(best.routeRate) ? fmt(best.routeRate * 100, 1) + "%" : "--"]
    ];
  }

  function exportPlotPanel(title, id) {
    var source = $(id);
    if (!source) return "";
    return "<div class=\"plot\"><h2>" + htmlEscape(title) + "</h2>" + styledSvgMarkup(id) + "</div>";
  }

  function benchmarkTableHtml(limit) {
    if (!state.benchmark.rows.length) return "";
    var rows = state.benchmark.rows.slice(0, limit || 18).map(function (row) {
      return "<tr><td>" + htmlEscape(row.name) + "</td><td>" + htmlEscape(row.route) + "</td><td>" + fmt(row.aRmse, 3) + "</td><td>" + fmt(row.bRmse, 3) + "</td><td>" + htmlEscape(row.winner) + "</td></tr>";
    }).join("");
    return "<section class=\"panel\"><h2>Benchmark Cases</h2><table class=\"score-table\"><thead><tr><th>Galaxy</th><th>Route</th><th>A RMSE</th><th>B RMSE</th><th>Winner</th></tr></thead><tbody>" + rows + "</tbody></table></section>";
  }

  function buildTrustReportHtml() {
    var curve = state.curve;
    var capsule = buildCapsule();
    var hash = capsuleHash(capsule);
    var rows = diagnosticRows().concat([
      ["Capsule hash", hash],
      ["Particle view", state.view.tilt + " deg tilt, " + fmt(state.view.depth, 2) + "x depth, " + state.view.colorMode + " colour"]
    ]).concat(benchmarkSummaryRows()).concat(tournamentSummaryRows());
    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>MTS trust report - " + htmlEscape(curve.name) + "</title><style>" + reportCss() + "</style></head>",
      "<body><main>",
      "<header><div><h1>" + htmlEscape(curve.name) + "</h1><p>MTS Galaxy Lab trust report</p><p>Generated " + htmlEscape(capsule.generatedAt) + "</p></div><div class=\"hash\">" + htmlEscape(hash) + "</div></header>",
      "<section class=\"grid\"><div class=\"panel\"><h2>Experiment State</h2><table><tbody>" + tableRowsHtml(rows) + "</tbody></table></div><div class=\"plots\">",
      exportPlotPanel("Rotation Curve", "curvePlot"),
      exportPlotPanel("Load Profile", "uPlot"),
      exportPlotPanel("Residual View", "residualPlot"),
      curve.kind !== "synthetic" ? exportPlotPanel("Fit Correlation", "fitCorrelationPlot") : "",
      state.sweep.rows.length ? exportPlotPanel("Parameter Heatmap", "sweepHeatmap") : "",
      state.ltgIndex.length ? exportPlotPanel("Route-Space Map", "routeMapPlot") : "",
      state.population.summary ? exportPlotPanel("Population Correlation", "populationPlot") : "",
      "</div></section>",
      benchmarkTableHtml(20),
      "<details><summary>Experiment capsule JSON</summary><pre>" + htmlEscape(JSON.stringify(capsule, null, 2)) + "</pre></details>",
      "<footer>Hash excludes volatile generated/export timestamps and is intended as a reproducible experiment fingerprint.</footer>",
      "</main></body></html>"
    ].join("");
  }

  function buildFigurePackHtml() {
    var curve = state.curve;
    var rows = [
      ["Galaxy", curve.name],
      ["Mode", curve.kind],
      ["Route", state.route.id],
      ["h", fmt(curve.h, 3) + " kpc"],
      ["r_out", fmt(curve.rOut, 3) + " kpc"],
      ["u_out", fmt(state.route.uOut, 4)],
      ["RMSE", curve.rmse == null ? "--" : fmt(curve.rmse, 4) + " km/s"]
    ];
    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>MTS figure pack - " + htmlEscape(curve.name) + "</title><style>" + reportCss() + ".plots{grid-template-columns:1fr 1fr}.caption{font-size:12px;color:#4a5145;margin-top:8px}</style></head>",
      "<body><main>",
      "<header><div><h1>" + htmlEscape(curve.name) + "</h1><p>Paper figure export</p></div><div class=\"hash\">" + htmlEscape(capsuleHash(buildCapsule())) + "</div></header>",
      "<section class=\"panel\"><h2>Figure Metadata</h2><table><tbody>" + tableRowsHtml(rows) + "</tbody></table></section>",
      "<section class=\"plots\">",
      exportPlotPanel("Figure 1. Rotation Curve", "curvePlot"),
      exportPlotPanel("Figure 2. Gate Profile", "uPlot"),
      exportPlotPanel("Figure 3. Residual Structure", "residualPlot"),
      curve.kind !== "synthetic" ? exportPlotPanel("Figure 4. Fit Correlation", "fitCorrelationPlot") : "",
      state.sweep.rows.length ? exportPlotPanel("Figure 5. Parameter Landscape", "sweepHeatmap") : "",
      state.ltgIndex.length ? exportPlotPanel("Figure 6. Route-Space Projection", "routeMapPlot") : "",
      state.population.summary ? exportPlotPanel("Figure 7. Population Correlation", "populationPlot") : "",
      "</section>",
      "<footer>Exported from MTS Galaxy Lab with locked constants Gamma0=809.956, Rmax=1.758948, ML_disk=0.5, ML_bulge=0.7.</footer>",
      "</main></body></html>"
    ].join("");
  }

  function exportCurrentCsv() {
    if (!state.curve) return;
    downloadText(slugify(state.curve.name) + "-curve.csv", currentCurveCsv(), "text/csv;charset=utf-8");
  }

  function exportNormalizedCsv() {
    if (!state.curve || state.curve.kind !== "observed") return;
    var csv = state.curve.normalization ? normalizedCurveCsv(state.curve) : currentCurveCsv();
    downloadText(slugify(state.curve.name) + "-normalized.csv", csv, "text/csv;charset=utf-8");
    if ($("customImportNote")) $("customImportNote").textContent = "Prepared normalized table for " + state.curve.name + ".";
  }

  function exportFilteredCsv() {
    downloadText("mts-ltg-index-" + slugify(state.ltgBrowser.hunt + "-" + state.ltgBrowser.route) + ".csv", ltgIndexCsv(), "text/csv;charset=utf-8");
  }

  function exportSummaryJson() {
    if (!state.curve) return;
    if (!currentScienceQaSummary()) runScienceQa();
    downloadText(slugify(state.curve.name) + "-summary.json", JSON.stringify(currentDiagnosticsObject(), null, 2), "application/json;charset=utf-8");
  }

  function exportPlotSvg() {
    if (!state.curve) return;
    downloadText(slugify(state.curve.name) + "-rotation-curve.svg", styledSvgMarkup("curvePlot"), "image/svg+xml;charset=utf-8");
  }

  function exportSheetHtml() {
    if (!state.curve) return;
    downloadText(slugify(state.curve.name) + "-diagnostic-sheet.html", buildDiagnosticSheetHtml(), "text/html;charset=utf-8");
  }

  function exportTrustReport() {
    if (!state.curve) return;
    if (!currentScienceQaSummary()) runScienceQa();
    var hash = capsuleHash(buildCapsule());
    downloadText("mts-trust-report-" + slugify(state.curve.name) + "-" + hash + ".html", buildTrustReportHtml(), "text/html;charset=utf-8");
  }

  function exportFigurePack() {
    if (!state.curve) return;
    downloadText("mts-figure-pack-" + slugify(state.curve.name) + ".html", buildFigurePackHtml(), "text/html;charset=utf-8");
  }

  function activeCustomCurvePayload() {
    var curve = state.curve;
    if (!curve || curve.kind !== "observed") return null;
    var select = $("sampleSelect");
    var provenance = curveProvenance(curve);
    var looksUserSupplied = provenance.repoSource && String(provenance.repoSource).indexOf("user/") === 0;
    if (select && select.value && !looksUserSupplied && !curve.normalization) return null;
    return {
      name: curve.name,
      h: curve.h,
      rOut: curve.rOut,
      fGasOut: curve.fGasOut,
      q: curve.q,
      leff: curve.leff,
      memoryLoad: curve.memoryLoad,
      rmse: curve.rmse,
      raw: curve.raw || "",
      normalization: curve.normalization || null,
      provenance: provenance,
      points: curve.points.map(function (point) {
        return {
          r: point.r,
          vObs: point.vObs,
          err: point.errV,
          vGas: point.vGas,
          vDisk: point.vDisk,
          vBulge: point.vBulge
        };
      })
    };
  }

  function curveFromCapsulePayload(payload) {
    var provenance = payload.provenance || defaultScienceProvenance("capsule-custom-curve", payload.name, payload.raw || "");
    var curve = buildObservedCurveFromRows(payload.points || [], payload.name || "Capsule custom galaxy", payload.raw || "", provenance, {
      sort: false,
      hOverride: Number(payload.h),
      normalization: payload.normalization || null
    });
    curve.name = cleanGalaxyName(payload.name || curve.name);
    return curve;
  }


  function buildCapsule() {
    var p = readParams();
    var customCurve = activeCustomCurvePayload();
    return {
      capsuleType: "mts-galaxy-lab-experiment",
      version: 3,
      generatedAt: new Date().toISOString(),
      mode: state.mode,
      activeName: state.curve ? state.curve.name : null,
      selected: {
        ltgIndex: customCurve ? "" : ($("sampleSelect") ? $("sampleSelect").value : ""),
        etgIndex: $("etgSelect") ? $("etgSelect").value : ""
      },
      customCurve: customCurve,
      synthetic: {
        h: p.h,
        rOut: p.rOut,
        diskAmp: p.diskAmp,
        gasAmp: p.gasAmp,
        bulgeAmp: p.bulgeAmp,
        fGas: p.fGas,
        q: p.q,
        speed: p.speed,
        showMtsOnly: p.showMtsOnly
      },
      view: {
        tilt: state.view.tilt,
        depth: state.view.depth,
        colorMode: state.view.colorMode,
        layers: state.view.layers
      },
      forge: {
        preset: state.forge.preset,
        seed: state.forge.seed,
        active: activeForgeMeta()
      },
      framework: {
        preset: $("frameworkPreset") ? $("frameworkPreset").value : "mts",
        expression: $("frameworkFormula") ? $("frameworkFormula").value : state.framework.expression,
        batchSummary: state.framework.batchSummary
      },
      researchCandidate: state.researchCandidate.current ? {
        loadedAt: state.researchCandidate.loadedAt,
        current: state.researchCandidate.current.raw || state.researchCandidate.current
      } : null,
      comparison: {
        preset: $("comparisonPreset") ? $("comparisonPreset").value : state.comparison.preset,
        expression: $("comparisonFormula") ? $("comparisonFormula").value : state.comparison.expression,
        fieldMode: $("residualFieldMode") ? $("residualFieldMode").value : state.comparison.fieldMode
      },
      tournament: {
        queue: $("tournamentQueue") ? $("tournamentQueue").value : state.tournament.queue,
        summary: state.tournament.summary,
        rows: state.tournament.rows
      },
      benchmark: {
        pack: state.benchmark.pack,
        summary: state.benchmark.summary,
        rows: state.benchmark.rows
      },
      claims: {
        summary: state.claims.summary,
        activeMemberships: caseMembershipFlags()
      },
      uncertainty: {
        noisePct: state.uncertainty.noisePct,
        mlPct: state.uncertainty.mlPct,
        trials: state.uncertainty.trials,
        summary: currentUncertaintySummary(),
        rows: currentUncertaintySummary() ? state.uncertainty.rows : []
      },
      scienceQa: {
        summary: currentScienceQaSummary(),
        provenanceRows: currentScienceQaSummary() ? state.scienceQa.provenanceRows : [],
        schemaRows: currentScienceQaSummary() ? state.scienceQa.schemaRows : [],
        auditRows: currentScienceQaSummary() ? state.scienceQa.auditRows : [],
        stressRows: currentScienceQaSummary() ? state.scienceQa.stressRows : []
      },
      ltgBrowser: {
        search: state.ltgBrowser.search,
        route: state.ltgBrowser.route,
        sort: state.ltgBrowser.sort,
        hunt: state.ltgBrowser.hunt
      },
      routeMap: {
        x: state.routeMap.x,
        y: state.routeMap.y
      },
      population: {
        x: state.population.x,
        y: state.population.y,
        subset: state.population.subset,
        resamples: state.population.resamples,
        summary: state.population.summary,
        correlationRows: state.population.correlationRows
      },
      importWizard: {
        lastSummary: state.importWizard.lastSummary
      },
      evolution: {
        track: state.evolution.track,
        t: state.evolution.t,
        flips: state.evolution.flips
      },
      sweep: {
        gammaMin: Number($("sweepGammaMin").value),
        gammaMax: Number($("sweepGammaMax").value),
        qMin: Number($("sweepQMin").value),
        qMax: Number($("sweepQMax").value),
        grid: $("sweepGrid").value,
        summary: state.sweep.summary,
        rows: state.sweep.rows
      },
      diagnostics: currentDiagnosticsObject()
    };
  }

  function exportCapsule() {
    var name = state.curve ? state.curve.name : "synthetic";
    var capsule = buildCapsule();
    downloadText("mts-capsule-" + slugify(name) + "-" + capsuleHash(capsule) + ".json", JSON.stringify(capsule, null, 2), "application/json;charset=utf-8");
  }

  function pathValue(source, keys, fallback) {
    var current = source;
    for (var i = 0; i < keys.length; i += 1) {
      if (current == null) return fallback;
      current = current[keys[i]];
    }
    return current == null ? fallback : current;
  }

  function compactText(value, fallback, limit) {
    if (value == null || value === "") return fallback || "--";
    var text = String(value);
    var max = limit || 28;
    return text.length > max ? text.slice(0, max - 3) + "..." : text;
  }

  function capsuleQaText(summary) {
    if (!summary) return "--";
    return summary.schemaPass + "p/" + summary.schemaWarn + "w/" + summary.schemaFail + "f";
  }

  function capsuleDigest(capsule) {
    var diagnostics = capsule.diagnostics || {};
    var curve = diagnostics.curve || {};
    var route = diagnostics.route || {};
    var uncertainty = capsule.uncertainty ? capsule.uncertainty.summary : null;
    var population = capsule.population ? capsule.population.summary : null;
    return {
      hash: capsuleHash(capsule),
      activeName: capsule.activeName || curve.name || "Experiment",
      mode: capsule.mode || diagnostics.mode || "--",
      route: route.id || pathValue(capsule, ["scienceQa", "summary", "route"], "--"),
      rmse: curve.rmse,
      uOut: route.uOut,
      uMax: route.uMax,
      xCross: route.xCrossNorm,
      memoryLoad: curve.memoryLoad,
      leff: curve.leff,
      points: curve.pointCount,
      frameworkExpression: pathValue(capsule, ["framework", "expression"], pathValue(diagnostics, ["framework", "expression"], "")),
      frameworkRmse: pathValue(diagnostics, ["framework", "current", "rmse"], NaN),
      comparisonExpression: pathValue(capsule, ["comparison", "expression"], pathValue(diagnostics, ["comparison", "expression"], "")),
      comparisonRmse: pathValue(diagnostics, ["comparison", "current", "rmse"], NaN),
      uncertaintyRouteStability: uncertainty ? uncertainty.routeStability : NaN,
      uncertaintyDominantRoute: uncertainty ? uncertainty.dominantRoute : "--",
      scienceSchema: capsuleQaText(capsule.scienceQa ? capsule.scienceQa.summary : null),
      populationCorrelation: population ? population.correlation : NaN,
      populationAxes: population ? population.x + " vs " + population.y : "--",
      generatedAt: capsule.generatedAt || diagnostics.generatedAt || ""
    };
  }

  function normalizeCapsuleLibraryEntry(entry) {
    if (!entry || !entry.capsule || entry.capsule.capsuleType !== "mts-galaxy-lab-experiment") return null;
    var digest = capsuleDigest(entry.capsule);
    var hash = entry.hash || digest.hash;
    var idSeed = [entry.id || "", entry.name || "", entry.savedAt || "", hash].join(":");
    return {
      id: entry.id || ("lib-" + hashText(idSeed)),
      name: compactText(entry.name || digest.activeName || hash, "Experiment", 80),
      savedAt: entry.savedAt || entry.capsule.generatedAt || "",
      hash: hash,
      digest: digest,
      capsule: entry.capsule
    };
  }

  function loadCapsuleLibrary() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(CAPSULE_LIBRARY_KEY) : "";
      var parsed = raw ? JSON.parse(raw) : [];
      var entries = Array.isArray(parsed) ? parsed : parsed.entries;
      return (entries || []).map(normalizeCapsuleLibraryEntry).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function persistCapsuleLibrary() {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(CAPSULE_LIBRARY_KEY, JSON.stringify(state.capsuleLibrary.entries));
      }
    } catch (error) {
      if ($("capsuleLibraryNote")) $("capsuleLibraryNote").textContent = "Library is active for this session, but browser storage is unavailable.";
    }
  }

  function capsuleEntryLabel(entry) {
    if (!entry) return "No snapshots";
    return compactText(entry.name, "Snapshot", 22) + " | " + compactText(entry.digest.activeName, "--", 16) + " | " + compactText(entry.digest.route, "--", 14);
  }

  function selectedCapsuleEntry(id) {
    return state.capsuleLibrary.entries.filter(function (entry) {
      return entry.id === id;
    })[0] || null;
  }

  function filteredCapsuleEntries() {
    var search = state.capsuleLibrary.search.trim().toLowerCase();
    if (!search) return state.capsuleLibrary.entries.slice();
    return state.capsuleLibrary.entries.filter(function (entry) {
      var haystack = [
        entry.name,
        entry.hash,
        entry.digest.activeName,
        entry.digest.route,
        entry.digest.mode,
        entry.digest.frameworkExpression,
        entry.digest.comparisonExpression
      ].join(" ").toLowerCase();
      return haystack.indexOf(search) !== -1;
    });
  }

  function fillCapsuleSelect(select, entries, selectedId) {
    if (!select) return "";
    select.innerHTML = "";
    if (!entries.length) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "No snapshots saved";
      select.appendChild(empty);
      return "";
    }
    entries.forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry.id;
      option.textContent = capsuleEntryLabel(entry);
      select.appendChild(option);
    });
    if (selectedId && entries.some(function (entry) { return entry.id === selectedId; })) {
      select.value = selectedId;
    } else {
      select.value = entries[0].id;
    }
    return select.value;
  }

  function formatCapsuleValue(value, field) {
    if (value == null || value === "") return "--";
    if (field && field.percent) {
      return Number.isFinite(Number(value)) ? fmt(Number(value) * 100, field.digits || 0) + "%" : "--";
    }
    if (field && field.kind === "number") {
      return Number.isFinite(Number(value)) ? fmt(Number(value), field.digits || 2) : "--";
    }
    if (field && field.kind === "expr") return compactText(value, "--", 28);
    return compactText(value, "--", field && field.limit ? field.limit : 18);
  }

  function capsuleDiffRows(entryA, entryB) {
    var a = entryA.digest;
    var b = entryB.digest;
    var fields = [
      { label: "Galaxy", key: "activeName", kind: "text", warnOnChange: true },
      { label: "Mode", key: "mode", kind: "text", warnOnChange: true },
      { label: "Route", key: "route", kind: "text", warnOnChange: true },
      { label: "RMSE", key: "rmse", kind: "number", digits: 2 },
      { label: "u_out", key: "uOut", kind: "number", digits: 3 },
      { label: "u_max", key: "uMax", kind: "number", digits: 3 },
      { label: "x_cross", key: "xCross", kind: "number", digits: 3 },
      { label: "Memory", key: "memoryLoad", kind: "number", digits: 2 },
      { label: "L_eff", key: "leff", kind: "number", digits: 2 },
      { label: "Points", key: "points", kind: "number", digits: 0 },
      { label: "Formula A", key: "frameworkExpression", kind: "expr" },
      { label: "A RMSE", key: "frameworkRmse", kind: "number", digits: 2 },
      { label: "Comparator", key: "comparisonExpression", kind: "expr" },
      { label: "B RMSE", key: "comparisonRmse", kind: "number", digits: 2 },
      { label: "QA schema", key: "scienceSchema", kind: "text" },
      { label: "Uncertain", key: "uncertaintyRouteStability", kind: "number", percent: true, digits: 0 },
      { label: "Pop corr", key: "populationCorrelation", kind: "number", digits: 3 }
    ];

    return fields.map(function (field) {
      var av = a[field.key];
      var bv = b[field.key];
      var same;
      var delta = "--";
      if (field.kind === "number") {
        var an = Number(av);
        var bn = Number(bv);
        same = (!Number.isFinite(an) && !Number.isFinite(bn)) || (Number.isFinite(an) && Number.isFinite(bn) && Math.abs(bn - an) < 1e-9);
        if (Number.isFinite(an) && Number.isFinite(bn)) {
          delta = (bn - an >= 0 ? "+" : "") + fmt(bn - an, field.percent ? 3 : (field.digits || 2));
        }
      } else {
        same = String(av || "") === String(bv || "");
        delta = same ? "same" : "changed";
      }
      return {
        label: field.label,
        a: formatCapsuleValue(av, field),
        b: formatCapsuleValue(bv, field),
        delta: delta,
        status: same ? "same" : (field.warnOnChange ? "warn" : "changed")
      };
    });
  }

  function compareCapsules(entryA, entryB) {
    var rows = capsuleDiffRows(entryA, entryB);
    var changed = rows.filter(function (row) { return row.status !== "same"; }).length;
    return {
      rows: rows,
      summary: {
        a: entryA.name,
        b: entryB.name,
        changed: changed,
        total: rows.length
      }
    };
  }

  function updateCapsuleLibraryPanel() {
    var entries = filteredCapsuleEntries();
    var lib = state.capsuleLibrary;
    lib.selectedA = fillCapsuleSelect($("capsuleSelectA"), entries, lib.selectedA);
    lib.selectedB = fillCapsuleSelect($("capsuleSelectB"), entries, lib.selectedB || (entries[1] ? entries[1].id : ""));
    var entryA = selectedCapsuleEntry(lib.selectedA);
    var entryB = selectedCapsuleEntry(lib.selectedB);
    if ($("capsuleSavedCount")) $("capsuleSavedCount").textContent = String(state.capsuleLibrary.entries.length);
    if ($("capsuleSelectedA")) $("capsuleSelectedA").textContent = entryA ? compactText(entryA.name, "--", 12) : "--";
    if ($("capsuleSelectedB")) $("capsuleSelectedB").textContent = entryB ? compactText(entryB.name, "--", 12) : "--";
    if ($("capsuleDiffCount")) $("capsuleDiffCount").textContent = lib.diffSummary ? lib.diffSummary.changed + "/" + lib.diffSummary.total : "--";
    if ($("capsuleLibraryStatus")) {
      $("capsuleLibraryStatus").textContent = state.capsuleLibrary.entries.length ? state.capsuleLibrary.entries.length + " saved" : "empty";
    }
    var table = $("capsuleDiffTable");
    if (!table) return;
    table.innerHTML = "";
    if (lib.diffRows.length) {
      lib.diffRows.forEach(function (row) {
        var item = document.createElement("div");
        item.className = "capsule-row " + row.status;
        item.innerHTML = "<strong>" + htmlEscape(row.label) + "</strong><span>" + htmlEscape(row.a) + "</span><span>" + htmlEscape(row.b) + "</span><span>" + htmlEscape(row.delta) + "</span>";
        table.appendChild(item);
      });
      if ($("capsuleLibraryNote")) $("capsuleLibraryNote").textContent = "Diff shows B minus A across " + lib.diffSummary.total + " capsule fields.";
      return;
    }
    if (!state.capsuleLibrary.entries.length) {
      table.innerHTML = '<div class="capsule-row warn"><strong>No snapshots</strong><span>--</span><span>--</span><span>save</span></div>';
      if ($("capsuleLibraryNote")) $("capsuleLibraryNote").textContent = "Save active experiment snapshots, compare them, reload them, or publish a report.";
      return;
    }
    entries.slice(0, 8).forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "capsule-row same";
      item.innerHTML =
        "<strong>" + htmlEscape(compactText(entry.name, "Snapshot", 24)) + "</strong>" +
        "<span>" + htmlEscape(compactText(entry.digest.route, "--", 12)) + "</span>" +
        "<span>" + htmlEscape(compactText(entry.digest.mode, "--", 8)) + "</span>" +
        "<span>" + htmlEscape(entry.hash.slice(4, 10)) + "</span>";
      table.appendChild(item);
    });
  }

  function addCapsuleLibraryEntry(capsule, name, options) {
    options = options || {};
    var digest = capsuleDigest(capsule);
    var timestamp = new Date().toISOString();
    var entry = {
      id: "lib-" + hashText(digest.hash + ":" + timestamp + ":" + (name || "")),
      name: compactText(name || digest.activeName || "Experiment", "Experiment", 80),
      savedAt: timestamp,
      hash: digest.hash,
      digest: digest,
      capsule: capsule
    };
    state.capsuleLibrary.entries.unshift(entry);
    state.capsuleLibrary.entries = state.capsuleLibrary.entries.slice(0, 60);
    if (!options.preserveSelection) {
      state.capsuleLibrary.selectedA = entry.id;
      if (!state.capsuleLibrary.selectedB && state.capsuleLibrary.entries[1]) {
        state.capsuleLibrary.selectedB = state.capsuleLibrary.entries[1].id;
      }
    }
    if (!options.preserveDiff) {
      state.capsuleLibrary.diffRows = [];
      state.capsuleLibrary.diffSummary = null;
    }
    persistCapsuleLibrary();
    updateCapsuleLibraryPanel();
    return entry;
  }

  function saveCapsuleSnapshot() {
    if (!state.curve) return;
    if (!currentScienceQaSummary()) runScienceQa();
    var name = $("capsuleSnapshotName") && $("capsuleSnapshotName").value.trim()
      ? $("capsuleSnapshotName").value.trim()
      : ((state.curve ? state.curve.name : "Experiment") + " " + new Date().toLocaleString());
    var entry = addCapsuleLibraryEntry(buildCapsule(), name);
    if ($("capsuleLibraryNote")) $("capsuleLibraryNote").textContent = "Saved " + entry.name + " as " + entry.hash + ".";
  }

  function loadSelectedCapsuleSnapshot() {
    var entry = selectedCapsuleEntry(state.capsuleLibrary.selectedA);
    if (!entry) return;
    applyCapsule(entry.capsule);
    if ($("capsuleLibraryNote")) $("capsuleLibraryNote").textContent = "Loaded " + entry.name + " from the local capsule library.";
  }

  function diffCapsuleSnapshots() {
    var entryA = selectedCapsuleEntry(state.capsuleLibrary.selectedA);
    var entryB = selectedCapsuleEntry(state.capsuleLibrary.selectedB);
    if (!entryA || !entryB) return;
    var diff = compareCapsules(entryA, entryB);
    state.capsuleLibrary.diffRows = diff.rows;
    state.capsuleLibrary.diffSummary = diff.summary;
    updateCapsuleLibraryPanel();
  }

  function deleteSelectedCapsuleSnapshot() {
    var selected = state.capsuleLibrary.selectedA;
    if (!selected) return;
    state.capsuleLibrary.entries = state.capsuleLibrary.entries.filter(function (entry) {
      return entry.id !== selected;
    });
    state.capsuleLibrary.selectedA = "";
    if (state.capsuleLibrary.selectedB === selected) state.capsuleLibrary.selectedB = "";
    state.capsuleLibrary.diffRows = [];
    state.capsuleLibrary.diffSummary = null;
    persistCapsuleLibrary();
    updateCapsuleLibraryPanel();
    if ($("capsuleLibraryNote")) $("capsuleLibraryNote").textContent = "Deleted the selected snapshot from the local library.";
  }

  function exportCapsuleLibrary() {
    downloadText("mts-capsule-library-" + todayIsoDate() + ".json", JSON.stringify({
      exportedAt: new Date().toISOString(),
      app: "MTS Galaxy Lab",
      entries: state.capsuleLibrary.entries
    }, null, 2), "application/json;charset=utf-8");
  }

  function capsuleDiffRowsHtml(rows) {
    if (!rows || !rows.length) return "";
    return "<section class=\"panel\"><h2>Capsule Diff</h2><table class=\"score-table\"><thead><tr><th>Field</th><th>A</th><th>B</th><th>Delta</th></tr></thead><tbody>" + rows.map(function (row) {
      return "<tr><td>" + htmlEscape(row.label) + "</td><td>" + htmlEscape(row.a) + "</td><td>" + htmlEscape(row.b) + "</td><td>" + htmlEscape(row.delta) + "</td></tr>";
    }).join("") + "</tbody></table></section>";
  }

  function buildPublishedExperimentHtml(entry) {
    var curve = state.curve;
    var digest = entry.digest;
    var rows = diagnosticRows().concat([
      ["Library snapshot", entry.name],
      ["Saved at", entry.savedAt],
      ["Capsule hash", entry.hash],
      ["Framework A", compactText(digest.frameworkExpression, "--", 120)],
      ["Comparator B", compactText(digest.comparisonExpression, "--", 120)],
      ["Scientific QA schema", digest.scienceSchema],
      ["Uncertainty route stability", Number.isFinite(digest.uncertaintyRouteStability) ? fmt(digest.uncertaintyRouteStability * 100, 1) + "%" : "--"],
      ["Population correlation", Number.isFinite(digest.populationCorrelation) ? fmt(digest.populationCorrelation, 4) : "--"]
    ]).concat(benchmarkSummaryRows()).concat(tournamentSummaryRows());
    return [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>MTS published experiment - " + htmlEscape(curve.name) + "</title><style>" + reportCss() + "</style></head>",
      "<body><main>",
      "<header><div><h1>" + htmlEscape(curve.name) + "</h1><p>Published MTS Galaxy Lab experiment</p><p>Generated " + htmlEscape(entry.savedAt) + "</p></div><div class=\"hash\">" + htmlEscape(entry.hash) + "</div></header>",
      "<section class=\"grid\"><div class=\"panel\"><h2>Experiment State</h2><table><tbody>" + tableRowsHtml(rows) + "</tbody></table></div><div class=\"plots\">",
      exportPlotPanel("Rotation Curve", "curvePlot"),
      exportPlotPanel("Load Profile", "uPlot"),
      exportPlotPanel("Residual View", "residualPlot"),
      curve.kind !== "synthetic" ? exportPlotPanel("Fit Correlation", "fitCorrelationPlot") : "",
      state.sweep.rows.length ? exportPlotPanel("Parameter Heatmap", "sweepHeatmap") : "",
      state.ltgIndex.length ? exportPlotPanel("Route-Space Map", "routeMapPlot") : "",
      state.population.summary ? exportPlotPanel("Population Correlation", "populationPlot") : "",
      "</div></section>",
      capsuleDiffRowsHtml(state.capsuleLibrary.diffRows),
      benchmarkTableHtml(20),
      "<details><summary>Experiment capsule JSON</summary><pre>" + htmlEscape(JSON.stringify(entry.capsule, null, 2)) + "</pre></details>",
      "<footer>Published from the local Capsule Library. Hash excludes volatile generated/export timestamps.</footer>",
      "</main></body></html>"
    ].join("");
  }

  function publishCapsuleSnapshot() {
    if (!state.curve) return;
    if (!currentScienceQaSummary()) runScienceQa();
    var name = $("capsuleSnapshotName") && $("capsuleSnapshotName").value.trim()
      ? $("capsuleSnapshotName").value.trim()
      : ((state.curve ? state.curve.name : "Experiment") + " published");
    var entry = addCapsuleLibraryEntry(buildCapsule(), name, { preserveSelection: true, preserveDiff: true });
    downloadText("mts-published-experiment-" + slugify(entry.name) + "-" + entry.hash + ".html", buildPublishedExperimentHtml(entry), "text/html;charset=utf-8");
  }

  function applySyntheticCapsule(values) {
    if (!values) return;
    ["h", "rOut", "diskAmp", "gasAmp", "bulgeAmp", "fGas", "q", "speed"].forEach(function (key) {
      if (controls[key] && values[key] != null) controls[key].value = values[key];
    });
    if (controls.showMtsOnly && values.showMtsOnly != null) controls.showMtsOnly.checked = Boolean(values.showMtsOnly);
  }

  function applyLtgBrowserCapsule(browser) {
    if (!browser) return;
    state.ltgBrowser.search = browser.search || "";
    state.ltgBrowser.route = browser.route || "all";
    state.ltgBrowser.sort = browser.sort || "rmse-desc";
    state.ltgBrowser.hunt = browser.hunt || "all";
    $("galaxySearch").value = state.ltgBrowser.search;
    $("routeFilter").value = state.ltgBrowser.route;
    $("sortSelect").value = state.ltgBrowser.sort;
    document.querySelectorAll(".hunt-button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.hunt === state.ltgBrowser.hunt);
    });
  }

  function applyCapsule(capsule) {
    if (!capsule || capsule.capsuleType !== "mts-galaxy-lab-experiment") {
      throw new Error("This is not an MTS Galaxy Lab experiment capsule.");
    }

    applySyntheticCapsule(capsule.synthetic);
    applyLtgBrowserCapsule(capsule.ltgBrowser);

    if (capsule.view) {
      state.view.tilt = clamp(Number(capsule.view.tilt) || 51, 18, 78);
      state.view.depth = clamp(Number(capsule.view.depth) || 0, 0, 1.8);
      state.view.colorMode = capsule.view.colorMode || "component";
      state.view.layers = Object.assign({}, state.view.layers, capsule.view.layers || {});
      if (viewControls.viewTilt) viewControls.viewTilt.value = state.view.tilt;
      if (viewControls.viewDepth) viewControls.viewDepth.value = state.view.depth;
      if (viewControls.viewColorMode) viewControls.viewColorMode.value = state.view.colorMode;
      syncViewLayerControls();
      updateViewOutputs();
    }

    if (capsule.framework) {
      $("frameworkFormula").value = capsule.framework.expression || FRAMEWORK_PRESETS.mts;
      $("frameworkPreset").value = capsule.framework.preset || "mts";
    }
    if (capsule.researchCandidate && capsule.researchCandidate.current) {
      try {
        state.researchCandidate.current = normalizeResearchCandidatePayload(capsule.researchCandidate.current);
        state.researchCandidate.loadedAt = capsule.researchCandidate.loadedAt || new Date().toISOString();
      } catch (error) {
        state.researchCandidate.current = null;
        state.researchCandidate.loadedAt = null;
      }
    }
    if (capsule.comparison) {
      state.comparison.preset = capsule.comparison.preset || "baryon";
      state.comparison.fieldMode = capsule.comparison.fieldMode || "custom";
      $("comparisonFormula").value = capsule.comparison.expression || FRAMEWORK_PRESETS.baryon;
      $("comparisonPreset").value = state.comparison.preset;
      $("residualFieldMode").value = state.comparison.fieldMode;
    }
    if (capsule.forge) {
      state.forge.preset = FORGE_PRESETS[capsule.forge.preset] ? capsule.forge.preset : "lsb";
      state.forge.seed = clamp(Math.round(Number(capsule.forge.seed) || 1007), 1, 999999);
      state.forge.active = capsule.forge.active ? { preset: state.forge.preset, seed: state.forge.seed } : null;
      syncForgeControls();
    }
    if (capsule.tournament) {
      $("tournamentQueue").value = capsule.tournament.queue || state.tournament.queue;
      state.tournament.rows = Array.isArray(capsule.tournament.rows) ? capsule.tournament.rows : [];
      state.tournament.summary = capsule.tournament.summary || null;
    }
    if (capsule.routeMap) {
      state.routeMap.x = capsule.routeMap.x || "xCross";
      state.routeMap.y = capsule.routeMap.y || "uOut";
      $("routeMapX").value = state.routeMap.x;
      $("routeMapY").value = state.routeMap.y;
    }
    if (capsule.population) {
      state.population.x = capsule.population.x || state.population.x;
      state.population.y = capsule.population.y || state.population.y;
      state.population.subset = capsule.population.subset || state.population.subset;
      state.population.resamples = Number(capsule.population.resamples) || state.population.resamples;
      state.population.summary = capsule.population.summary || null;
      state.population.correlationRows = Array.isArray(capsule.population.correlationRows) ? capsule.population.correlationRows : [];
      $("populationX").value = state.population.x;
      $("populationY").value = state.population.y;
      $("populationSubset").value = state.population.subset;
      $("populationResamples").value = String(state.population.resamples);
    }
    if (capsule.evolution) {
      state.evolution.track = EVOLUTION_TRACKS[capsule.evolution.track] ? capsule.evolution.track : "late-load";
      state.evolution.t = clamp(Number(capsule.evolution.t) || 0, 0, 1);
      state.evolution.playing = false;
      state.evolution.samples = [];
      state.evolution.samplesTrack = null;
      $("evolutionTrack").value = state.evolution.track;
      $("evolutionTime").value = state.evolution.t;
      $("evolutionTimeOut").textContent = fmt(state.evolution.t, 2);
    }
    if (capsule.sweep) {
      $("sweepGammaMin").value = capsule.sweep.gammaMin || state.sweep.gammaMin;
      $("sweepGammaMax").value = capsule.sweep.gammaMax || state.sweep.gammaMax;
      $("sweepQMin").value = capsule.sweep.qMin || state.sweep.qMin;
      $("sweepQMax").value = capsule.sweep.qMax || state.sweep.qMax;
      $("sweepGrid").value = capsule.sweep.grid || state.sweep.grid;
      state.sweep.rows = Array.isArray(capsule.sweep.rows) ? capsule.sweep.rows : [];
      state.sweep.summary = capsule.sweep.summary || null;
    }
    if (capsule.uncertainty) {
      state.uncertainty.noisePct = clamp(Number(capsule.uncertainty.noisePct) || state.uncertainty.noisePct, 0, 12);
      state.uncertainty.mlPct = clamp(Number(capsule.uncertainty.mlPct) || state.uncertainty.mlPct, 0, 20);
      state.uncertainty.trials = clamp(Math.round(Number(capsule.uncertainty.trials) || state.uncertainty.trials), 8, 256);
      state.uncertainty.rows = Array.isArray(capsule.uncertainty.rows) ? capsule.uncertainty.rows : [];
      state.uncertainty.summary = capsule.uncertainty.summary || null;
      if ($("uncertaintyNoise")) $("uncertaintyNoise").value = state.uncertainty.noisePct;
      if ($("uncertaintyMl")) $("uncertaintyMl").value = state.uncertainty.mlPct;
      if ($("uncertaintyTrials")) $("uncertaintyTrials").value = String(state.uncertainty.trials);
      updateUncertaintyOutputs();
    }
    if (capsule.selected) {
      if (capsule.selected.ltgIndex != null && $("sampleSelect")) $("sampleSelect").value = String(capsule.selected.ltgIndex);
      if (capsule.selected.etgIndex != null && $("etgSelect")) $("etgSelect").value = String(capsule.selected.etgIndex);
    }

    if (capsule.customCurve && capsule.mode === "observed" && $("sampleSelect")) {
      $("sampleSelect").value = "";
    }
    setMode(capsule.mode === "observed" || capsule.mode === "etg" ? capsule.mode : "synthetic");
    if (capsule.customCurve && state.mode === "observed") {
      loadObservedCurve(curveFromCapsulePayload(capsule.customCurve));
      updateCustomImportNote(state.curve);
      if ($("sampleSelect")) $("sampleSelect").value = "";
    }
    if (capsule.evolution && state.mode === "synthetic") {
      applyEvolutionTime(state.evolution.t, { refreshParticles: true });
    }
    if (capsule.forge && capsule.forge.active && state.mode === "synthetic") {
      state.forge.active = { preset: state.forge.preset, seed: state.forge.seed };
      state.seed = hashName(state.forge.preset + ":" + state.forge.seed);
      buildSyntheticCurve();
      generateParticles();
    }
    applyFrameworkExpression();
    applyComparisonExpression();
    if (capsule.scienceQa) {
      state.scienceQa.summary = capsule.scienceQa.summary || state.scienceQa.summary;
      state.scienceQa.provenanceRows = Array.isArray(capsule.scienceQa.provenanceRows) ? capsule.scienceQa.provenanceRows : state.scienceQa.provenanceRows;
      state.scienceQa.schemaRows = Array.isArray(capsule.scienceQa.schemaRows) ? capsule.scienceQa.schemaRows : state.scienceQa.schemaRows;
      state.scienceQa.auditRows = Array.isArray(capsule.scienceQa.auditRows) ? capsule.scienceQa.auditRows : state.scienceQa.auditRows;
      state.scienceQa.stressRows = Array.isArray(capsule.scienceQa.stressRows) ? capsule.scienceQa.stressRows : state.scienceQa.stressRows;
      updateScienceQaPanel();
    }
    if (capsule.benchmark) {
      state.benchmark.pack = capsule.benchmark.pack || "all";
      state.benchmark.rows = Array.isArray(capsule.benchmark.rows) ? capsule.benchmark.rows : [];
      state.benchmark.summary = capsule.benchmark.summary || null;
      if ($("benchmarkPack")) $("benchmarkPack").value = state.benchmark.pack;
    }
    updateTournamentPanel();
    updateBenchmarkPanel();
    updateLtgBrowser();
    drawRouteMap();
    updatePopulationPanel();
    drawPopulationPlot();
    updateSweepPanel();
    updateUncertaintyPanel();
    updateCapsuleLibraryPanel();
    updateResearchCandidatePanel();
    $("exportNote").textContent = "Loaded capsule from " + (capsule.generatedAt || "unknown time");
  }

  function handleCapsuleFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        applyCapsule(JSON.parse(String(reader.result)));
      } catch (error) {
        window.alert(error.message);
      }
    };
    reader.readAsText(file);
  }

  function exportFrameworkCsv() {
    if (!state.framework.batch.length) {
      runFrameworkBatch();
    }
    if (!state.framework.batch.length || state.framework.error) return;
    downloadText("mts-framework-scores-" + slugify(state.framework.expression).slice(0, 32) + ".csv", frameworkScoresCsv(), "text/csv;charset=utf-8");
  }

  function randomizeSynthetic() {
    stopEvolution();
    clearForgeActive();
    controls.h.value = fmt(1.2 + seededRandom() * 5.5, 1);
    controls.rOut.value = fmt(14 + seededRandom() * 34, 0);
    controls.diskAmp.value = fmt(70 + seededRandom() * 145, 0);
    controls.gasAmp.value = fmt(18 + seededRandom() * 90, 0);
    controls.bulgeAmp.value = fmt(seededRandom() * 155, 0);
    controls.fGas.value = fmt(0.05 + seededRandom() * 0.55, 2);
    controls.q.value = fmt(0.62 + seededRandom() * 0.28, 2);
    buildSyntheticCurve();
    generateParticles();
  }

  function bindEvents() {
    document.querySelectorAll(".mode-button").forEach(function (button) {
      button.addEventListener("click", function () {
        setMode(button.dataset.mode);
      });
    });

    Object.keys(controls).forEach(function (key) {
      controls[key].addEventListener("input", function () {
        if (state.mode === "synthetic") {
          if (state.evolution.playing && key !== "speed" && key !== "showMtsOnly") stopEvolution();
          if (key !== "speed" && key !== "showMtsOnly") clearForgeActive();
          buildSyntheticCurve();
          if (key !== "speed" && key !== "showMtsOnly") generateParticles();
          updateEvolutionPanel();
        }
      });
    });

    Object.keys(viewControls).forEach(function (key) {
      viewControls[key].addEventListener(key === "viewColorMode" ? "change" : "input", function () {
        updateViewOutputs();
        updateTrustPanel();
        updateCasePanel();
      });
    });

    $("randomize").addEventListener("click", randomizeSynthetic);
    $("forgeGalaxy").addEventListener("click", applyForge);
    $("nextForgeSeed").addEventListener("click", nextForgeSeed);
    $("forgePreset").addEventListener("change", function (event) {
      state.forge.preset = event.target.value;
      syncForgeControls();
      updateForgePanel();
    });
    $("forgeSeed").addEventListener("input", function (event) {
      state.forge.seed = clamp(Math.round(Number(event.target.value) || state.forge.seed), 1, 999999);
    });
    $("playEvolution").addEventListener("click", toggleEvolutionPlayback);
    $("resetEvolution").addEventListener("click", resetEvolution);
    $("evolutionTrack").addEventListener("change", function (event) {
      state.evolution.track = event.target.value;
      state.evolution.playing = false;
      state.evolution.samples = [];
      state.evolution.samplesTrack = null;
      applyEvolutionTime(state.evolution.t, { refreshParticles: true });
    });
    $("evolutionTime").addEventListener("input", function (event) {
      state.evolution.playing = false;
      state.evolution.lastTick = 0;
      applyEvolutionTime(Number(event.target.value), { refreshParticles: true });
    });

    $("sampleSelect").addEventListener("change", loadSelectedSample);
    $("etgSelect").addEventListener("change", loadSelectedEtg);
    $("galaxySearch").addEventListener("input", function (event) {
      state.ltgBrowser.search = event.target.value;
      updateLtgBrowser();
    });
    $("routeFilter").addEventListener("change", function (event) {
      state.ltgBrowser.route = event.target.value;
      updateLtgBrowser();
    });
    $("sortSelect").addEventListener("change", function (event) {
      state.ltgBrowser.sort = event.target.value;
      updateLtgBrowser();
    });
    document.querySelectorAll(".hunt-button").forEach(function (button) {
      button.addEventListener("click", function () {
        state.ltgBrowser.hunt = button.dataset.hunt;
        document.querySelectorAll(".hunt-button").forEach(function (other) {
          other.classList.toggle("active", other === button);
        });
        updateLtgBrowser();
      });
    });

    $("loadPasted").addEventListener("click", function () {
      try {
        var pastedText = $("pasteInput").value;
        var pastedProvenance = defaultScienceProvenance("rotmod", "Pasted ROTMOD", pastedText);
        pastedProvenance.repoSource = "user/browser-paste";
        pastedProvenance.filePath = "pasted-rotmod-textarea";
        pastedProvenance.retrievalDate = todayIsoDate();
        pastedProvenance.catalogueId = "Pasted ROTMOD";
        loadObservedCurve(parseRotmod(pastedText, "Pasted ROTMOD", pastedProvenance));
      } catch (error) {
        window.alert(error.message);
      }
    });

    $("fileInput").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var fileText = String(reader.result);
          var fileProvenance = defaultScienceProvenance("rotmod", file.name, fileText);
          fileProvenance.repoSource = "user/local-file";
          fileProvenance.filePath = file.name;
          fileProvenance.retrievalDate = todayIsoDate();
          loadObservedCurve(parseRotmod(fileText, file.name, fileProvenance));
          $("pasteInput").value = String(reader.result);
        } catch (error) {
          window.alert(error.message);
        }
      };
      reader.readAsText(file);
    });

    $("customFileInput").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        $("pasteInput").value = String(reader.result);
        if ($("customGalaxyName") && (!$("customGalaxyName").value || $("customGalaxyName").value === "Custom galaxy")) {
          $("customGalaxyName").value = cleanGalaxyName(file.name);
        }
        loadCustomGalaxyFromText(String(reader.result), file.name);
      };
      reader.readAsText(file);
    });

    $("loadCustomGalaxy").addEventListener("click", function () {
      loadCustomGalaxyFromText($("pasteInput").value, "custom-paste");
    });
    $("exportNormalizedCsv").addEventListener("click", exportNormalizedCsv);

    $("exportCurrentCsv").addEventListener("click", exportCurrentCsv);
    $("exportFilteredCsv").addEventListener("click", exportFilteredCsv);
    $("exportSummaryJson").addEventListener("click", exportSummaryJson);
    $("exportPlotSvg").addEventListener("click", exportPlotSvg);
    $("exportSheetHtml").addEventListener("click", exportSheetHtml);
    $("exportCapsule").addEventListener("click", exportCapsule);
    $("exportTrustReport").addEventListener("click", exportTrustReport);
    $("exportFigurePack").addEventListener("click", exportFigurePack);
    $("saveCapsuleSnapshot").addEventListener("click", saveCapsuleSnapshot);
    $("loadCapsuleSnapshot").addEventListener("click", loadSelectedCapsuleSnapshot);
    $("diffCapsuleSnapshots").addEventListener("click", diffCapsuleSnapshots);
    $("publishCapsuleSnapshot").addEventListener("click", publishCapsuleSnapshot);
    $("exportCapsuleLibrary").addEventListener("click", exportCapsuleLibrary);
    $("deleteCapsuleSnapshot").addEventListener("click", deleteSelectedCapsuleSnapshot);
    $("capsuleSearch").addEventListener("input", function (event) {
      state.capsuleLibrary.search = event.target.value;
      state.capsuleLibrary.diffRows = [];
      state.capsuleLibrary.diffSummary = null;
      updateCapsuleLibraryPanel();
    });
    $("capsuleSelectA").addEventListener("change", function (event) {
      state.capsuleLibrary.selectedA = event.target.value;
      state.capsuleLibrary.diffRows = [];
      state.capsuleLibrary.diffSummary = null;
      updateCapsuleLibraryPanel();
    });
    $("capsuleSelectB").addEventListener("change", function (event) {
      state.capsuleLibrary.selectedB = event.target.value;
      state.capsuleLibrary.diffRows = [];
      state.capsuleLibrary.diffSummary = null;
      updateCapsuleLibraryPanel();
    });
    $("runPaperChecks").addEventListener("click", runPaperChecks);
    $("exportPaperReport").addEventListener("click", exportPaperReport);
    $("exportCaseFile").addEventListener("click", exportCaseFile);
    $("runUncertainty").addEventListener("click", runUncertainty);
    $("exportUncertaintyCsv").addEventListener("click", exportUncertaintyCsv);
    $("runScienceQa").addEventListener("click", runScienceQa);
    $("exportScienceQa").addEventListener("click", exportScienceQaReport);
    $("exportScienceQaCsv").addEventListener("click", exportScienceQaCsv);
    ["uncertaintyNoise", "uncertaintyMl", "uncertaintyTrials"].forEach(function (id) {
      $(id).addEventListener(id === "uncertaintyTrials" ? "change" : "input", function () {
        updateUncertaintyOutputs();
        updateUncertaintyPanel();
      });
    });
    $("applyFramework").addEventListener("click", applyFrameworkExpression);
    $("runFrameworkBatch").addEventListener("click", runFrameworkBatch);
    $("exportFrameworkCsv").addEventListener("click", exportFrameworkCsv);
    $("applyComparison").addEventListener("click", applyComparisonExpression);
    $("runBenchmarkSuite").addEventListener("click", runBenchmarkSuite);
    $("exportBenchmarkCsv").addEventListener("click", exportBenchmarkCsv);
    $("runPopulationStats").addEventListener("click", runPopulationStats);
    $("exportPopulationCsv").addEventListener("click", exportPopulationCsv);
    ["populationX", "populationY", "populationSubset", "populationResamples"].forEach(function (id) {
      $(id).addEventListener("change", function () {
        state.population.x = $("populationX").value;
        state.population.y = $("populationY").value;
        state.population.subset = $("populationSubset").value;
        state.population.resamples = Number($("populationResamples").value) || 200;
        state.population.summary = null;
        state.population.rows = [];
        state.population.correlationRows = [];
        updatePopulationPanel();
      });
    });
    $("runTournament").addEventListener("click", runTournament);
    $("exportTournamentCsv").addEventListener("click", exportTournamentCsv);
    $("runParameterSweep").addEventListener("click", runParameterSweep);
    $("exportSweepCsv").addEventListener("click", exportSweepCsv);
    $("frameworkPreset").addEventListener("change", function (event) {
      var preset = FRAMEWORK_PRESETS[event.target.value] || FRAMEWORK_PRESETS.mts;
      $("frameworkFormula").value = preset;
      applyFrameworkExpression();
    });
    $("comparisonPreset").addEventListener("change", function (event) {
      var preset = FRAMEWORK_PRESETS[event.target.value] || FRAMEWORK_PRESETS.baryon;
      state.comparison.preset = event.target.value;
      $("comparisonFormula").value = preset;
      applyComparisonExpression();
    });
    $("residualFieldMode").addEventListener("change", function (event) {
      state.comparison.fieldMode = event.target.value;
      updateComparisonPanel();
    });
    $("benchmarkPack").addEventListener("change", function (event) {
      state.benchmark.pack = event.target.value;
      if (state.benchmark.summary && state.benchmark.summary.pack !== state.benchmark.pack) {
        state.benchmark.rows = [];
        state.benchmark.summary = null;
      }
      updateBenchmarkPanel();
    });
    $("formulaRegistrySelect").addEventListener("change", function () {
      var entry = selectedRegistryEntry();
      if (entry) $("formulaRegistryName").value = entry.name;
    });
    $("saveFormulaA").addEventListener("click", saveFormulaA);
    $("loadFormulaA").addEventListener("click", function () { loadRegistryFormula("A"); });
    $("loadFormulaB").addEventListener("click", function () { loadRegistryFormula("B"); });
    $("exportFormulaRegistry").addEventListener("click", exportFormulaRegistry);
    $("formulaRegistryInput").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      if (file) importFormulaRegistryFile(file);
    });
    $("researchCandidateInput").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      if (file) importResearchCandidateFile(file);
    });
    $("loadResearchCandidateA").addEventListener("click", loadResearchCandidateToA);
    $("queueResearchCandidate").addEventListener("click", queueResearchCandidate);
    $("routeMapX").addEventListener("change", function (event) {
      state.routeMap.x = event.target.value;
      drawRouteMap();
    });
    $("routeMapY").addEventListener("change", function (event) {
      state.routeMap.y = event.target.value;
      drawRouteMap();
    });
    $("capsuleInput").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      if (file) handleCapsuleFile(file);
    });

    window.addEventListener("resize", resizeCanvas);
  }

  function init() {
    cacheControls();
    setupSamples();
    setupEtgSamples();
    state.registry.entries = loadFormulaRegistry();
    state.capsuleLibrary.entries = loadCapsuleLibrary();
    $("frameworkFormula").value = state.framework.expression;
    $("comparisonFormula").value = state.comparison.expression;
    $("comparisonPreset").value = state.comparison.preset;
    $("residualFieldMode").value = state.comparison.fieldMode;
    if (viewControls.viewTilt) viewControls.viewTilt.value = state.view.tilt;
    if (viewControls.viewDepth) viewControls.viewDepth.value = state.view.depth;
    if (viewControls.viewColorMode) viewControls.viewColorMode.value = state.view.colorMode;
    syncViewLayerControls();
    updateViewOutputs();
    updateUncertaintyOutputs();
    syncForgeControls();
    $("tournamentQueue").value = state.tournament.queue;
    $("routeMapX").value = state.routeMap.x;
    $("routeMapY").value = state.routeMap.y;
    $("populationX").value = state.population.x;
    $("populationY").value = state.population.y;
    $("populationSubset").value = state.population.subset;
    $("populationResamples").value = String(state.population.resamples);
    $("evolutionTrack").value = state.evolution.track;
    $("evolutionTime").value = state.evolution.t;
    $("evolutionTimeOut").textContent = fmt(state.evolution.t, 2);
    $("sweepGammaMin").value = state.sweep.gammaMin;
    $("sweepGammaMax").value = state.sweep.gammaMax;
    $("sweepQMin").value = state.sweep.qMin;
    $("sweepQMax").value = state.sweep.qMax;
    $("sweepGrid").value = state.sweep.grid;
    $("benchmarkPack").value = state.benchmark.pack;
    $("uncertaintyNoise").value = state.uncertainty.noisePct;
    $("uncertaintyMl").value = state.uncertainty.mlPct;
    $("uncertaintyTrials").value = String(state.uncertainty.trials);
    updateUncertaintyOutputs();
    updateFormulaRegistryPanel();
    updateResearchCandidatePanel();
    state.framework.compiled = compileFrameworkExpression(state.framework.expression);
    state.comparison.compiled = compileFrameworkExpression(state.comparison.expression);
    bindEvents();
    resizeCanvas();
    buildSyntheticCurve();
    generateParticles();
    if ((window.MTS_SAMPLES || []).length) {
      $("sampleSelect").value = "0";
    }
    if ((window.MTS_ETG_SAMPLES || []).length) {
      $("etgSelect").value = "0";
    }
    var queryMode = new URLSearchParams(window.location.search).get("mode");
    if (queryMode === "observed" || queryMode === "etg") {
      setMode(queryMode);
    }
    updateLtgBrowser();
    runPaperChecks();
    runScienceQa();
    updateTournamentPanel();
    updateComparisonPanel();
    updateBenchmarkPanel();
    updateForgePanel();
    updateSweepPanel();
    updateCasePanel();
    drawRouteMap();
    updatePopulationPanel();
    updateCapsuleLibraryPanel();
    requestAnimationFrame(drawGalaxy);
  }

  init();
}());
