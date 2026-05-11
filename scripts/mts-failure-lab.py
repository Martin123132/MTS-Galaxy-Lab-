#!/usr/bin/env python3
"""
MTS high-RMSE research harness.

The canonical MTS baseline is locked. This script searches only a constrained
family of invariant-gated diagnostic candidates, validates them on a
route-stratified holdout split, and writes review artifacts that the browser
app can import without silently replacing MTS.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import math
import random
import re
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

ROOT = Path(__file__).resolve().parents[1]
SAMPLES_JS = ROOT / "data" / "samples.js"
DEFAULT_OUT = ROOT / "research-output" / "high-rmse"

GAMMA0 = 809.956
R_MAX = 1.758948
ML_DISK = 0.5
ML_BULGE = 0.7
Q_DEFAULT = 0.77
SPLIT_SEED = 20260511
HOLDOUT_FRACTION = 0.33

HARD_ROUTES = {"buffered single-crossing", "outer-infeasible"}
GATED_ROUTES = {"buffered single-crossing", "buffered upward-crossing", "outer-infeasible"}
STRICT_ROUTE_PRESERVATION = 0.95


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def clean_name(name: str) -> str:
    return re.sub(r"_rotmod\.dat$", "", re.sub(r"^.*[\\/]", "", name), flags=re.I)


def load_samples() -> list[dict]:
    text = SAMPLES_JS.read_text(encoding="utf-8")
    match = re.search(r"window\.MTS_SAMPLES\s*=\s*(\[.*\]);\s*$", text, re.S)
    if not match:
        raise RuntimeError(f"Could not parse {SAMPLES_JS}")
    return json.loads(match.group(1))


def parse_rotmod(text: str) -> list[dict]:
    rows = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped[0] in "#!":
            continue
        try:
            parts = [float(part) for part in stripped.split()]
        except ValueError:
            continue
        if len(parts) < 6:
            continue
        rows.append(
            {
                "r": parts[0],
                "vObs": parts[1],
                "err": parts[2],
                "vGas": parts[3],
                "vDisk": parts[4],
                "vBulge": parts[5],
                "sbDisk": parts[6] if len(parts) > 6 else 0.0,
                "sbBulge": parts[7] if len(parts) > 7 else 0.0,
            }
        )
    if len(rows) < 2:
        raise RuntimeError("ROTMOD sample has fewer than two usable rows")
    return rows


def fit_scale_length(rows: list[dict]) -> float:
    xy = [(row["r"], math.log(row["sbDisk"])) for row in rows if row["r"] > 0 and row["sbDisk"] > 0]
    fallback = max(0.8, rows[-1]["r"] / 3.9)
    if len(xy) < 3:
        return fallback
    n = len(xy)
    sx = sum(x for x, _ in xy)
    sy = sum(y for _, y in xy)
    sxx = sum(x * x for x, _ in xy)
    sxy = sum(x * y for x, y in xy)
    denom = n * sxx - sx * sx
    if abs(denom) < 1e-9:
        return fallback
    slope = (n * sxy - sx * sy) / denom
    if slope >= 0:
        return fallback
    return clamp(-1 / slope, 0.25, rows[-1]["r"] * 2)


def leff_exact(h: float, r_out: float, f_gas_out: float) -> float:
    s_mem = (0.9 / math.pi) * (r_out / h)
    memory_load = (1 - f_gas_out) * (r_out / h)
    return 1.8 * h * (1 + s_mem * (1 - math.exp(-memory_load / s_mem)))


def value_at(points: list[dict], radius: float, key: str) -> float:
    if radius <= points[0]["r"]:
        return points[0][key]
    if radius >= points[-1]["r"]:
        return points[-1][key]
    for index in range(1, len(points)):
        if points[index]["r"] >= radius:
            a = points[index - 1]
            b = points[index]
            t = (radius - a["r"]) / (b["r"] - a["r"])
            return a[key] * (1 - t) + b[key] * t
    return points[-1][key]


def route_state(points: list[dict], r_out: float) -> dict:
    u0 = points[0]["u"]
    u_out = points[-1]["u"]
    u_max = max(point["u"] for point in points)
    down = 0
    up = 0
    x_cross = math.nan
    for index in range(1, len(points)):
        prev = points[index - 1]["u"]
        curr = points[index]["u"]
        if prev > 1 and curr <= 1:
            down += 1
            t = (prev - 1) / (prev - curr) if prev != curr else 0
            x_cross = (points[index - 1]["r"] * (1 - t) + points[index]["r"] * t) / r_out
        if prev < 1 and curr >= 1:
            up += 1

    route = "low-load"
    if u0 < 0 and u_out < 1 and u_max < 1:
        route = "CDC-low-load"
    elif u_out >= 1:
        route = "outer-infeasible"
    elif up > 0:
        route = "buffered upward-crossing"
    elif down > 0:
        route = "buffered single-crossing"

    return {
        "route": route,
        "u0": u0,
        "uOut": u_out,
        "uMax": u_max,
        "u075": value_at(points, 0.75 * r_out, "u"),
        "xCross": x_cross,
        "downCrossings": down,
        "upCrossings": up,
    }


def route_safety(state: dict) -> dict:
    outer_headroom = max(0.0, 1.0 - state["uOut"])
    peak_headroom = max(0.0, 1.0 - state["uMax"])
    if state["route"] == "outer-infeasible":
        route_margin = 1.0 + max(0.0, state["uOut"] - 1.0)
        route_break_risk = 0.0
    elif state["route"] in {"buffered single-crossing", "buffered upward-crossing"}:
        route_margin = outer_headroom
        route_break_risk = 1.0 / (1.0 + route_margin / 0.12)
    else:
        route_margin = min(outer_headroom, peak_headroom)
        route_break_risk = 1.0 / (1.0 + route_margin / 0.12)
    return {
        "outerHeadroom": outer_headroom,
        "routeMargin": route_margin,
        "routeBreakRisk": route_break_risk,
    }


def build_curve(sample: dict) -> dict:
    rows = parse_rotmod(sample["text"])
    h = fit_scale_length(rows)
    r_out = rows[-1]["r"]
    last = rows[-1]
    vbar_out2 = last["vGas"] ** 2 + ML_DISK * last["vDisk"] ** 2 + ML_BULGE * last["vBulge"] ** 2
    f_gas_out = clamp(last["vGas"] ** 2 / vbar_out2 if vbar_out2 > 0 else 0, 0, 1)
    leff = leff_exact(h, r_out, f_gas_out)
    memory = (1 - f_gas_out) * (r_out / h)

    points = []
    for row in rows:
        bar2 = row["vGas"] ** 2 + ML_DISK * row["vDisk"] ** 2 + ML_BULGE * row["vBulge"] ** 2
        u = (row["vObs"] ** 2 - ML_DISK * row["vDisk"] ** 2 - ML_BULGE * row["vBulge"] ** 2) / (
            GAMMA0 * row["r"] * R_MAX
        )
        points.append({**row, "bar2": bar2, "x": row["r"] / r_out, "u": u})

    state = route_state(points, r_out)
    locked_points = []
    for point in points:
        support2 = GAMMA0 * leff * (1 - math.exp(-((point["r"] / leff) ** Q_DEFAULT)))
        model2 = point["bar2"] + support2
        u = (model2 - ML_DISK * point["vDisk"] ** 2 - ML_BULGE * point["vBulge"] ** 2) / (
            GAMMA0 * point["r"] * R_MAX
        )
        locked_points.append({**point, "u": u})
    locked_state = route_state(locked_points, r_out)
    safety = route_safety(locked_state)
    return {
        "name": clean_name(sample["name"]),
        "points": points,
        "h": h,
        "rOut": r_out,
        "fGasOut": f_gas_out,
        "leff": leff,
        "leffOverH": leff / h if h else math.nan,
        "memoryLoad": memory,
        "lockedModelRoute": locked_state["route"],
        "lockedModelU0": locked_state["u0"],
        "lockedModelUOut": locked_state["uOut"],
        "lockedModelUMax": locked_state["uMax"],
        "lockedModelU075": locked_state["u075"],
        "lockedModelXCross": locked_state["xCross"],
        "lockedModelDownCrossings": locked_state["downCrossings"],
        "lockedModelUpCrossings": locked_state["upCrossings"],
        **safety,
        **state,
    }


def smooth_gate(value: float, threshold: float) -> float:
    excess = max(0.0, value - threshold)
    return excess / (1 + excess)


def gate_expr(name: str, threshold: float) -> str:
    value = f"{threshold:.4g}"
    return f"(max(0, {name} - {value}) / (1 + max(0, {name} - {value})))"


def fmt_num(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.4g}"


def route_gate_from_route(route: str, upward_weight: float) -> float:
    if route in {"buffered single-crossing", "outer-infeasible"}:
        return 1.0
    if route == "buffered upward-crossing":
        return upward_weight
    return 0.0


def route_gate_value(curve: dict, upward_weight: float, route_basis: str = "observed") -> float:
    route = curve["lockedModelRoute"] if route_basis == "locked" else curve["route"]
    return route_gate_from_route(route, upward_weight)


def route_gate_expr(upward_weight: float, route_basis: str = "observed") -> str:
    if route_basis == "locked":
        return f"max(lockedRouteSingle, lockedRouteOuterInfeasible, {fmt_num(upward_weight)} * lockedRouteUpward)"
    return f"max(routeSingle, routeOuterInfeasible, {fmt_num(upward_weight)} * routeUpward)"


def damping_value(curve: dict, mode: str, scale: float) -> float:
    if mode == "none":
        return 1.0
    if curve["lockedModelRoute"] == "outer-infeasible":
        return 1.0
    denom = max(1e-9, scale)
    if mode == "outer-headroom":
        return curve["outerHeadroom"] / (curve["outerHeadroom"] + denom)
    if mode == "route-margin":
        return curve["routeMargin"] / (curve["routeMargin"] + denom)
    raise ValueError(f"Unknown damping mode: {mode}")


def damping_expr(mode: str, scale: float) -> str:
    if mode == "none":
        return "1"
    scale_text = fmt_num(max(1e-9, scale))
    if mode == "outer-headroom":
        return f"max(lockedRouteOuterInfeasible, outerHeadroom / (outerHeadroom + {scale_text}))"
    if mode == "route-margin":
        return f"max(lockedRouteOuterInfeasible, routeMargin / (routeMargin + {scale_text}))"
    raise ValueError(f"Unknown damping mode: {mode}")


@dataclass(frozen=True)
class Candidate:
    id: str
    name: str
    alpha: float
    memory_threshold: float
    u075_threshold: float
    uout_threshold: float
    load_mode: str
    upward_weight: float
    source: str = "registry"
    route_basis: str = "observed"
    damping_mode: str = "none"
    damping_scale: float = 0.0

    @property
    def kind(self) -> str:
        return "state-conditioned diagnostic"

    @property
    def description(self) -> str:
        return (
            "MTS support multiplied by a smooth route-state gate using memory, "
            "u_0.75, u_out, crossing class, and route-safety headroom only."
        )

    @property
    def allowed_variables(self) -> list[str]:
        return [
            "memory",
            "u075",
            "uOut",
            "lockedU075",
            "lockedUOut",
            "routeSingle",
            "routeUpward",
            "routeOuterInfeasible",
            "lockedRouteSingle",
            "lockedRouteUpward",
            "lockedRouteOuterInfeasible",
            "outerHeadroom",
            "routeMargin",
            "routeBreakRisk",
            "leff",
            "r",
            "q",
            "gamma0",
        ]

    def feature_values(self, curve: dict) -> dict:
        if self.route_basis == "locked":
            return {
                "u075": curve["lockedModelU075"],
                "uOut": curve["lockedModelUOut"],
                "route": curve["lockedModelRoute"],
            }
        return {
            "u075": curve["u075"],
            "uOut": curve["uOut"],
            "route": curve["route"],
        }

    def load_gate(self, curve: dict) -> float:
        features = self.feature_values(curve)
        g075 = smooth_gate(features["u075"], self.u075_threshold)
        gout = smooth_gate(features["uOut"], self.uout_threshold)
        if self.load_mode == "u075":
            return g075
        if self.load_mode == "min-u075-uout":
            return min(g075, gout)
        if self.load_mode == "mean-u075-uout":
            return 0.65 * g075 + 0.35 * gout
        raise ValueError(f"Unknown load mode: {self.load_mode}")

    def amp(self, curve: dict) -> float:
        memory = smooth_gate(curve["memoryLoad"], self.memory_threshold)
        route = route_gate_value(curve, self.upward_weight, self.route_basis)
        damping = damping_value(curve, self.damping_mode, self.damping_scale)
        return 1 + self.alpha * memory * self.load_gate(curve) * route * damping

    def app_expression(self) -> str:
        base = "gamma0 * leff * (1 - exp(-pow(r / leff, q)))"
        memory = gate_expr("memory", self.memory_threshold)
        u075_name = "lockedU075" if self.route_basis == "locked" else "u075"
        uout_name = "lockedUOut" if self.route_basis == "locked" else "uOut"
        g075 = gate_expr(u075_name, self.u075_threshold)
        gout = gate_expr(uout_name, self.uout_threshold)
        if self.load_mode == "u075":
            load = g075
        elif self.load_mode == "min-u075-uout":
            load = f"min({g075}, {gout})"
        else:
            load = f"(0.65 * {g075} + 0.35 * {gout})"
        route = route_gate_expr(self.upward_weight, self.route_basis)
        damping = damping_expr(self.damping_mode, self.damping_scale)
        return f"{base} * (1 + {fmt_num(self.alpha)} * {memory} * {load} * {route} * {damping})"

    def science_expression(self) -> str:
        return (
            "S_base * (1 + "
            f"{fmt_num(self.alpha)} * gate(memory>{fmt_num(self.memory_threshold)})"
            f" * gate_load({self.load_mode}, u075>{fmt_num(self.u075_threshold)}, uOut>{fmt_num(self.uout_threshold)})"
            f" * route_gate({self.route_basis}, single/outer=1, upward={fmt_num(self.upward_weight)})"
            f" * route_damping({self.damping_mode}, scale={fmt_num(self.damping_scale)}))"
        )

    def to_json(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "source": self.source,
            "description": self.description,
            "expression": self.science_expression(),
            "appExpression": self.app_expression(),
            "alpha": self.alpha,
            "memoryThreshold": self.memory_threshold,
            "u075Threshold": self.u075_threshold,
            "uOutThreshold": self.uout_threshold,
            "loadMode": self.load_mode,
            "upwardWeight": self.upward_weight,
            "routeBasis": self.route_basis,
            "dampingMode": self.damping_mode,
            "dampingScale": self.damping_scale,
            "allowedVariables": self.allowed_variables,
            "forbiddenShortcuts": ["galaxy name", "raw RMSE", "residual sign", "per-galaxy lookup"],
        }


def candidate_id(
    alpha: float,
    mem: float,
    u075: float,
    uout: float,
    mode: str,
    up: float,
    route_basis: str = "observed",
    damping_mode: str = "none",
    damping_scale: float = 0.0,
) -> str:
    token = f"a{fmt_num(alpha)}-m{fmt_num(mem)}-u75{fmt_num(u075)}-uo{fmt_num(uout)}-{mode}-up{fmt_num(up)}"
    if route_basis != "observed" or damping_mode != "none":
        token += f"-{route_basis}-d{damping_mode}-ds{fmt_num(damping_scale)}"
    return "mts-state-" + re.sub(r"[^a-zA-Z0-9]+", "-", token).strip("-").lower()


def candidate_registry() -> list[Candidate]:
    candidates: dict[str, Candidate] = {}

    def add(candidate: Candidate) -> None:
        candidates[candidate.id] = candidate

    add(
        Candidate(
            id="route-u075-v1",
            name="Route-gated u075 v1",
            alpha=4.0,
            memory_threshold=0.0,
            u075_threshold=0.25,
            uout_threshold=0.0,
            load_mode="u075",
            upward_weight=1.0,
            source="seed",
        )
    )

    for mode in ["u075", "min-u075-uout", "mean-u075-uout"]:
        uout_values = [0.0] if mode == "u075" else [0.25, 0.35, 0.45, 0.55]
        for alpha in [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5]:
            for mem in [0.0, 1.5, 3.0]:
                for u075 in [0.15, 0.25, 0.35, 0.45]:
                    for uout in uout_values:
                        for up in [0.0, 0.35, 0.55, 0.75, 1.0]:
                            ident = candidate_id(alpha, mem, u075, uout, mode, up)
                            add(
                                Candidate(
                                    id=ident,
                                    name=ident.replace("mts-state-", "").replace("-", " "),
                                    alpha=alpha,
                                    memory_threshold=mem,
                                    u075_threshold=u075,
                                    uout_threshold=uout,
                                    load_mode=mode,
                                    upward_weight=up,
                                )
                            )

    for mode in ["u075", "mean-u075-uout"]:
        uout_values = [0.0] if mode == "u075" else [0.35, 0.5]
        for alpha in [2.0, 3.0, 4.0, 5.0, 6.0]:
            for mem in [0.0, 1.5, 3.0]:
                for u075 in [0.15, 0.25, 0.35]:
                    for uout in uout_values:
                        for up in [0.0, 0.35, 0.55]:
                            for damping_mode in ["outer-headroom", "route-margin"]:
                                for damping_scale in [0.08, 0.16, 0.28]:
                                    ident = candidate_id(
                                        alpha,
                                        mem,
                                        u075,
                                        uout,
                                        mode,
                                        up,
                                        route_basis="locked",
                                        damping_mode=damping_mode,
                                        damping_scale=damping_scale,
                                    )
                                    add(
                                        Candidate(
                                            id=ident,
                                            name=ident.replace("mts-state-", "").replace("-", " "),
                                            alpha=alpha,
                                            memory_threshold=mem,
                                            u075_threshold=u075,
                                            uout_threshold=uout,
                                            load_mode=mode,
                                            upward_weight=up,
                                            route_basis="locked",
                                            damping_mode=damping_mode,
                                            damping_scale=damping_scale,
                                        )
                                    )
    return list(candidates.values())


def stratified_split(curves: list[dict], seed: int, holdout_fraction: float) -> dict:
    rng = random.Random(seed)
    by_route: dict[str, list[dict]] = {}
    for curve in curves:
        by_route.setdefault(curve["route"], []).append(curve)

    train: list[dict] = []
    holdout: list[dict] = []
    for route, rows in sorted(by_route.items()):
        shuffled = rows[:]
        rng.shuffle(shuffled)
        holdout_count = max(1, int(round(len(shuffled) * holdout_fraction))) if len(shuffled) > 2 else 1
        holdout.extend(shuffled[:holdout_count])
        train.extend(shuffled[holdout_count:])

    train_names = {curve["name"] for curve in train}
    holdout_names = {curve["name"] for curve in holdout}
    return {
        "seed": seed,
        "holdoutFraction": holdout_fraction,
        "train": train,
        "holdout": holdout,
        "trainNames": train_names,
        "holdoutNames": holdout_names,
        "routeCounts": {
            route: {
                "total": len(rows),
                "train": sum(1 for curve in rows if curve["name"] in train_names),
                "holdout": sum(1 for curve in rows if curve["name"] in holdout_names),
            }
            for route, rows in sorted(by_route.items())
        },
    }


def score_curve(curve: dict, candidate: Candidate | None = None) -> dict:
    amp = candidate.amp(curve) if candidate else 1.0
    sse = 0.0
    band = {
        "inner": {"sse": 0.0, "n": 0, "bias": 0.0},
        "mid": {"sse": 0.0, "n": 0, "bias": 0.0},
        "outer": {"sse": 0.0, "n": 0, "bias": 0.0},
    }
    worst = {"r": math.nan, "x": math.nan, "residual": 0.0}
    custom_points = []
    for point in curve["points"]:
        support2 = GAMMA0 * curve["leff"] * (1 - math.exp(-((point["r"] / curve["leff"]) ** Q_DEFAULT))) * amp
        model2 = point["bar2"] + support2
        model = math.sqrt(max(0.0, model2))
        residual = model - point["vObs"]
        u = (model2 - ML_DISK * point["vDisk"] ** 2 - ML_BULGE * point["vBulge"] ** 2) / (
            GAMMA0 * point["r"] * R_MAX
        )
        custom_points.append({**point, "u": u})
        sse += residual * residual
        key = "inner" if point["x"] < 0.33 else ("mid" if point["x"] < 0.66 else "outer")
        band[key]["sse"] += residual * residual
        band[key]["bias"] += residual
        band[key]["n"] += 1
        if abs(residual) > abs(worst["residual"]):
            worst = {"r": point["r"], "x": point["x"], "residual": residual}

    def rmse(key: str) -> float:
        return math.sqrt(band[key]["sse"] / band[key]["n"]) if band[key]["n"] else math.nan

    def bias(key: str) -> float:
        return band[key]["bias"] / band[key]["n"] if band[key]["n"] else math.nan

    candidate_route = route_state(custom_points, curve["rOut"])
    return {
        "rmse": math.sqrt(sse / len(curve["points"])),
        "innerRmse": rmse("inner"),
        "midRmse": rmse("mid"),
        "outerRmse": rmse("outer"),
        "innerBias": bias("inner"),
        "midBias": bias("mid"),
        "outerBias": bias("outer"),
        "worstR": worst["r"],
        "worstX": worst["x"],
        "worstResidual": worst["residual"],
        "amp": amp,
        "candidateRoute": candidate_route["route"],
        "candidateU0": candidate_route["u0"],
        "candidateUOut": candidate_route["uOut"],
        "candidateUMax": candidate_route["uMax"],
        "candidateU075": candidate_route["u075"],
        "candidateXCross": candidate_route["xCross"],
        "candidateDownCrossings": candidate_route["downCrossings"],
        "candidateUpCrossings": candidate_route["upCrossings"],
        "routePreserved": candidate_route["route"] == curve["route"],
    }


def route_break_reason(base: dict, cand: dict) -> str:
    if cand["candidateRoute"] == base["candidateRoute"]:
        return ""
    reasons = []
    if base["candidateUOut"] < 1 <= cand["candidateUOut"]:
        reasons.append("u_out crossed 1")
    if base["candidateUMax"] < 1 <= cand["candidateUMax"]:
        reasons.append("u_max crossed 1")
    if (base["candidateU0"] < 0) != (cand["candidateU0"] < 0):
        reasons.append("CDC sign changed")
    if base["candidateDownCrossings"] != cand["candidateDownCrossings"] or base["candidateUpCrossings"] != cand["candidateUpCrossings"]:
        reasons.append("crossing count changed")
    return "; ".join(reasons) if reasons else "route id changed"


def score_rows(curves: list[dict], candidate: Candidate) -> list[dict]:
    rows = []
    for curve in curves:
        base = score_curve(curve)
        cand = score_curve(curve, candidate)
        locked_route_preserved = cand["candidateRoute"] == base["candidateRoute"]
        rows.append(
            {
                "name": curve["name"],
                "route": curve["route"],
                "baselineModelRoute": base["candidateRoute"],
                "candidateRoute": cand["candidateRoute"],
                "routePreserved": locked_route_preserved,
                "routeTransition": "" if locked_route_preserved else f"{base['candidateRoute']} -> {cand['candidateRoute']}",
                "routeBreakReason": route_break_reason(base, cand),
                "baselineRmse": base["rmse"],
                "candidateRmse": cand["rmse"],
                "delta": cand["rmse"] - base["rmse"],
                "improvement": base["rmse"] - cand["rmse"],
                "baselineInnerRmse": base["innerRmse"],
                "candidateInnerRmse": cand["innerRmse"],
                "baselineMidRmse": base["midRmse"],
                "candidateMidRmse": cand["midRmse"],
                "baselineOuterRmse": base["outerRmse"],
                "candidateOuterRmse": cand["outerRmse"],
                "outerBias": cand["outerBias"],
                "worstResidual": cand["worstResidual"],
                "worstR": cand["worstR"],
                "amp": cand["amp"],
                "h": curve["h"],
                "rOut": curve["rOut"],
                "leff": curve["leff"],
                "leffOverH": curve["leffOverH"],
                "memoryLoad": curve["memoryLoad"],
                "fGasOut": curve["fGasOut"],
                "u0": curve["u0"],
                "uOut": curve["uOut"],
                "uMax": curve["uMax"],
                "u075": curve["u075"],
                "xCross": curve["xCross"],
                "downCrossings": curve["downCrossings"],
                "upCrossings": curve["upCrossings"],
                "baselineModelU0": base["candidateU0"],
                "baselineModelUOut": base["candidateUOut"],
                "baselineModelUMax": base["candidateUMax"],
                "baselineModelU075": base["candidateU075"],
                "baselineModelXCross": base["candidateXCross"],
                "baselineModelDownCrossings": base["candidateDownCrossings"],
                "baselineModelUpCrossings": base["candidateUpCrossings"],
                "candidateModelU0": cand["candidateU0"],
                "candidateModelUOut": cand["candidateUOut"],
                "candidateModelUMax": cand["candidateUMax"],
                "candidateModelU075": cand["candidateU075"],
                "candidateModelXCross": cand["candidateXCross"],
                "candidateModelDownCrossings": cand["candidateDownCrossings"],
                "candidateModelUpCrossings": cand["candidateUpCrossings"],
                "outerHeadroom": curve["outerHeadroom"],
                "routeMargin": curve["routeMargin"],
                "routeBreakRisk": curve["routeBreakRisk"],
            }
        )
    return rows


def safe_mean(values: Iterable[float]) -> float:
    clean = [value for value in values if isinstance(value, (int, float)) and math.isfinite(value)]
    return sum(clean) / len(clean) if clean else math.nan


def pct_improvement(base: float, candidate: float) -> float:
    return ((base - candidate) / base) * 100 if math.isfinite(base) and base > 0 and math.isfinite(candidate) else math.nan


def summarize_rows(rows: list[dict]) -> dict:
    routes = {route for route in [row["route"] for row in rows]}

    def route_mean(route_filter: Callable[[dict], bool], key: str) -> float:
        return safe_mean(row[key] for row in rows if route_filter(row))

    base_mean = safe_mean(row["baselineRmse"] for row in rows)
    cand_mean = safe_mean(row["candidateRmse"] for row in rows)
    hard_base = route_mean(lambda row: row["route"] in HARD_ROUTES, "baselineRmse")
    hard_cand = route_mean(lambda row: row["route"] in HARD_ROUTES, "candidateRmse")
    low_base = route_mean(lambda row: row["route"] == "low-load", "baselineRmse")
    low_cand = route_mean(lambda row: row["route"] == "low-load", "candidateRmse")
    cdc_base = route_mean(lambda row: row["route"] == "CDC-low-load", "baselineRmse")
    cdc_cand = route_mean(lambda row: row["route"] == "CDC-low-load", "candidateRmse")
    regressions = [row for row in rows if row["candidateRmse"] - row["baselineRmse"] > 2]
    max_regression = max([row["candidateRmse"] - row["baselineRmse"] for row in rows] or [math.nan])
    route_breaks = [row for row in rows if not row["routePreserved"]]
    return {
        "count": len(rows),
        "routes": sorted(routes),
        "baselineMean": base_mean,
        "candidateMean": cand_mean,
        "meanImprovementPct": pct_improvement(base_mean, cand_mean),
        "baselineMedian": statistics.median(row["baselineRmse"] for row in rows) if rows else math.nan,
        "candidateMedian": statistics.median(row["candidateRmse"] for row in rows) if rows else math.nan,
        "baselineOuterMean": safe_mean(row["baselineOuterRmse"] for row in rows),
        "candidateOuterMean": safe_mean(row["candidateOuterRmse"] for row in rows),
        "outerImprovementPct": pct_improvement(
            safe_mean(row["baselineOuterRmse"] for row in rows),
            safe_mean(row["candidateOuterRmse"] for row in rows),
        ),
        "midImprovementPct": pct_improvement(
            safe_mean(row["baselineMidRmse"] for row in rows),
            safe_mean(row["candidateMidRmse"] for row in rows),
        ),
        "innerImprovementPct": pct_improvement(
            safe_mean(row["baselineInnerRmse"] for row in rows),
            safe_mean(row["candidateInnerRmse"] for row in rows),
        ),
        "hardBaselineMean": hard_base,
        "hardCandidateMean": hard_cand,
        "hardImprovementPct": pct_improvement(hard_base, hard_cand),
        "lowBaselineMean": low_base,
        "lowCandidateMean": low_cand,
        "lowWorsening": low_cand - low_base if math.isfinite(low_base) and math.isfinite(low_cand) else math.nan,
        "cdcBaselineMean": cdc_base,
        "cdcCandidateMean": cdc_cand,
        "cdcWorsening": cdc_cand - cdc_base if math.isfinite(cdc_base) and math.isfinite(cdc_cand) else math.nan,
        "routePreservationRate": safe_mean(1.0 if row["routePreserved"] else 0.0 for row in rows),
        "routeBreakCount": len(route_breaks),
        "regressionOver2Count": len(regressions),
        "regressionOver2Rate": len(regressions) / len(rows) if rows else math.nan,
        "maxRegression": max_regression,
        "wins": sum(1 for row in rows if row["delta"] < -0.001),
    }


def guardrail(label: str, actual: float, threshold: str, passed: bool) -> dict:
    return {"label": label, "actual": actual, "threshold": threshold, "passed": bool(passed)}


def evaluate_guardrails(summary: dict) -> list[dict]:
    return [
        guardrail("Holdout mean RMSE improvement", summary["meanImprovementPct"], ">= 15%", summary["meanImprovementPct"] >= 15),
        guardrail("Hard-route RMSE improvement", summary["hardImprovementPct"], ">= 25%", summary["hardImprovementPct"] >= 25),
        guardrail("Low-load worsening", summary["lowWorsening"], "<= 1 km/s", summary["lowWorsening"] <= 1),
        guardrail("CDC worsening", summary["cdcWorsening"], "<= 1 km/s", summary["cdcWorsening"] <= 1),
        guardrail("Route preservation", summary["routePreservationRate"], ">= 95%", summary["routePreservationRate"] >= 0.95),
        guardrail("Regression rate > 2 km/s", summary["regressionOver2Rate"], "< 5%", summary["regressionOver2Rate"] < 0.05),
        guardrail("Maximum single regression", summary["maxRegression"], "<= 8 km/s", summary["maxRegression"] <= 8),
        guardrail(
            "Residual bands not central-only",
            max(summary["outerImprovementPct"], summary["midImprovementPct"]),
            "outer or mid >= 10%",
            max(summary["outerImprovementPct"], summary["midImprovementPct"]) >= 10,
        ),
    ]


def claim_status(guardrails: list[dict]) -> str:
    return "promoted for review" if all(row["passed"] for row in guardrails) else "rejected"


def selection_tier(summary: dict) -> str:
    return "strict" if summary["routePreservationRate"] >= STRICT_ROUTE_PRESERVATION else "frontier"


def discovery_score(summary: dict) -> float:
    regression_penalty = 80 * max(0.0, summary["regressionOver2Rate"] - 0.02)
    max_penalty = max(0.0, summary["maxRegression"] - 6)
    route_penalty = 40 * max(0.0, 0.98 - summary["routePreservationRate"])
    low_penalty = 5 * max(0.0, summary["lowWorsening"])
    cdc_penalty = 5 * max(0.0, summary["cdcWorsening"])
    return (
        summary["meanImprovementPct"]
        + 0.7 * summary["hardImprovementPct"]
        + 0.25 * summary["outerImprovementPct"]
        - regression_penalty
        - max_penalty
        - route_penalty
        - low_penalty
        - cdc_penalty
    )


def strict_score(summary: dict) -> float:
    if summary["routePreservationRate"] < STRICT_ROUTE_PRESERVATION:
        return -1_000_000 + 100 * summary["routePreservationRate"] + summary["meanImprovementPct"]
    return discovery_score(summary)


def discovery_sort_key(item: dict, score_key: str) -> tuple:
    summary = item["summary"]
    return (
        item[score_key],
        summary["routePreservationRate"],
        summary["meanImprovementPct"],
        summary["hardImprovementPct"],
        -summary["maxRegression"],
        item["candidate"].id,
    )


def nearest_strict_near_miss(records: list[dict]) -> dict | None:
    near = [item for item in records if item["selectionTier"] == "frontier"]
    if not near:
        return records[0] if records else None
    near.sort(
        key=lambda item: (
            item["summary"]["routePreservationRate"],
            item["summary"]["meanImprovementPct"],
            item["summary"]["hardImprovementPct"],
            -item["summary"]["maxRegression"],
            item["candidate"].id,
        ),
        reverse=True,
    )
    return near[0]


def discover_candidates(train_curves: list[dict]) -> dict:
    records = []
    for candidate in candidate_registry():
        rows = score_rows(train_curves, candidate)
        summary = summarize_rows(rows)
        records.append(
            {
                "candidate": candidate,
                "summary": summary,
                "score": discovery_score(summary),
                "strictScore": strict_score(summary),
                "selectionTier": selection_tier(summary),
            }
        )
    strict_ranked = [item for item in records if item["selectionTier"] == "strict"]
    strict_ranked.sort(key=lambda item: discovery_sort_key(item, "strictScore"), reverse=True)
    frontier_ranked = [item for item in records if item["selectionTier"] == "frontier"]
    frontier_ranked.sort(key=lambda item: discovery_sort_key(item, "score"), reverse=True)
    all_ranked = records[:]
    all_ranked.sort(key=lambda item: discovery_sort_key(item, "score"), reverse=True)
    return {
        "strict": strict_ranked,
        "frontier": frontier_ranked,
        "all": all_ranked,
        "nearestStrictNearMiss": nearest_strict_near_miss(records),
    }


def baseline_summary(curves: list[dict]) -> dict:
    rows = []
    for curve in curves:
        base = score_curve(curve)
        rows.append(
            {
                "route": curve["route"],
                "baselineRmse": base["rmse"],
                "candidateRmse": base["rmse"],
                "baselineOuterRmse": base["outerRmse"],
                "candidateOuterRmse": base["outerRmse"],
                "baselineMidRmse": base["midRmse"],
                "candidateMidRmse": base["midRmse"],
                "baselineInnerRmse": base["innerRmse"],
                "candidateInnerRmse": base["innerRmse"],
                "routePreserved": True,
                "delta": 0.0,
            }
        )
    return summarize_rows(rows)


def fmt(value: float, digits: int = 2) -> str:
    return f"{value:.{digits}f}" if isinstance(value, (int, float)) and math.isfinite(value) else "--"


def print_summary_table(label: str, summary: dict) -> None:
    print(label)
    for key in [
        "count",
        "baselineMean",
        "candidateMean",
        "meanImprovementPct",
        "hardImprovementPct",
        "outerImprovementPct",
        "routePreservationRate",
        "regressionOver2Rate",
        "maxRegression",
    ]:
        value = summary.get(key)
        digits = 3 if "Rate" in key else 2
        print(f"{key}\t{fmt(value, digits) if isinstance(value, float) else value}")


def top_rows(rows: list[dict], key: str, reverse: bool = True, limit: int = 12) -> list[dict]:
    return sorted(rows, key=lambda row: row[key], reverse=reverse)[:limit]


def split_label(curve: dict, split: dict) -> str:
    return "holdout" if curve["name"] in split["holdoutNames"] else "train"


def all_scored_rows(curves: list[dict], candidate: Candidate, split: dict) -> list[dict]:
    rows = score_rows(curves, candidate)
    for row in rows:
        row["split"] = "holdout" if row["name"] in split["holdoutNames"] else "train"
        row["candidateId"] = candidate.id
    return rows


def json_clean(value):
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: json_clean(val) for key, val in value.items()}
    if isinstance(value, list):
        return [json_clean(item) for item in value]
    if isinstance(value, tuple):
        return [json_clean(item) for item in value]
    return value


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    headers = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in headers})


def route_break_summary(rows: list[dict]) -> dict:
    broken = [row for row in rows if not row["routePreserved"]]
    transitions: dict[str, int] = {}
    reasons: dict[str, int] = {}
    galaxies = []
    for row in broken:
        transition = row["routeTransition"] or "unknown"
        reason = row["routeBreakReason"] or "unknown"
        transitions[transition] = transitions.get(transition, 0) + 1
        for item in reason.split("; "):
            reasons[item] = reasons.get(item, 0) + 1
        galaxies.append(
            {
                "name": row["name"],
                "split": row.get("split", ""),
                "observedRoute": row["route"],
                "from": row["baselineModelRoute"],
                "to": row["candidateRoute"],
                "reason": reason,
                "uOutBefore": row["baselineModelUOut"],
                "uOutAfter": row["candidateModelUOut"],
                "uMaxBefore": row["baselineModelUMax"],
                "uMaxAfter": row["candidateModelUMax"],
                "downCrossingsBefore": row["baselineModelDownCrossings"],
                "downCrossingsAfter": row["candidateModelDownCrossings"],
                "upCrossingsBefore": row["baselineModelUpCrossings"],
                "upCrossingsAfter": row["candidateModelUpCrossings"],
            }
        )
    return {
        "count": len(broken),
        "rate": len(broken) / len(rows) if rows else math.nan,
        "transitions": dict(sorted(transitions.items())),
        "reasons": dict(sorted(reasons.items())),
        "galaxies": galaxies,
    }


def discovery_item_json(item: dict | None) -> dict | None:
    if not item:
        return None
    summary = item["summary"]
    return {
        "candidate": item["candidate"].to_json(),
        "selectionTier": item["selectionTier"],
        "score": item["score"],
        "strictScore": item["strictScore"],
        "summary": {
            "count": summary["count"],
            "meanImprovementPct": summary["meanImprovementPct"],
            "hardImprovementPct": summary["hardImprovementPct"],
            "outerImprovementPct": summary["outerImprovementPct"],
            "routePreservationRate": summary["routePreservationRate"],
            "routeBreakCount": summary["routeBreakCount"],
            "regressionOver2Rate": summary["regressionOver2Rate"],
            "maxRegression": summary["maxRegression"],
        },
    }


def candidate_capsule(
    candidate: Candidate,
    split: dict,
    train_summary: dict,
    holdout_summary: dict,
    all_summary: dict,
    guardrails: list[dict],
    route_breaks: dict,
    nearest_passing_candidate: dict | None,
    frontier_candidate: dict | None,
) -> dict:
    claim = claim_status(guardrails)
    tier = selection_tier(holdout_summary)
    status = claim if claim == "promoted for review" else ("frontier" if tier == "frontier" else "rejected")
    guardrail_failures = [row for row in guardrails if not row["passed"]]
    return {
        "type": "mts-high-rmse-candidate",
        "version": 2,
        "generatedAt": dt.datetime.now(dt.UTC).isoformat(),
        "sourceScript": "scripts/mts-failure-lab.py",
        "selectionTier": tier,
        "claimStatus": claim,
        "status": status,
        "constants": {
            "gamma0": GAMMA0,
            "rMax": R_MAX,
            "mlDisk": ML_DISK,
            "mlBulge": ML_BULGE,
            "qDefault": Q_DEFAULT,
        },
        "split": {
            "seed": split["seed"],
            "holdoutFraction": split["holdoutFraction"],
            "trainCount": len(split["train"]),
            "holdoutCount": len(split["holdout"]),
            "routeCounts": split["routeCounts"],
        },
        "candidate": {
            **candidate.to_json(),
            "status": status,
            "claimStatus": claim,
            "selectionTier": tier,
        },
        "validation": {
            "train": train_summary,
            "holdout": holdout_summary,
            "all": all_summary,
            "guardrails": guardrails,
            "guardrailFailures": guardrail_failures,
            "routeBreaks": route_breaks,
            "claimStatus": claim,
            "status": status,
            "selectionTier": tier,
        },
        "routeBreaks": route_breaks,
        "guardrailFailures": guardrail_failures,
        "nearestPassingCandidate": nearest_passing_candidate,
        "frontierCandidate": frontier_candidate,
    }


def markdown_report(capsule: dict, rows: list[dict]) -> str:
    candidate = capsule["candidate"]
    validation = capsule["validation"]
    guardrails = validation["guardrails"]
    holdout = validation["holdout"]
    all_summary = validation["all"]
    route_breaks = validation["routeBreaks"]
    improvements = top_rows(rows, "improvement", True, 12)
    regressions = [row for row in top_rows(rows, "delta", True, 12) if row["delta"] > 0]
    lines = [
        "# MTS High-RMSE Candidate Report",
        "",
        f"Candidate: `{candidate['id']}`",
        f"Selection tier: `{validation['selectionTier']}`",
        f"Candidate status: `{validation['status']}`",
        f"Status: `{candidate['claimStatus']}`",
        f"Kind: `{candidate['kind']}`",
        "",
        "## Formula",
        "",
        "Canonical baseline remains locked:",
        "",
        "`S_base = Gamma0 * L_eff * (1 - exp(-(r / L_eff)^q))`",
        "",
        "Diagnostic candidate:",
        "",
        f"`{candidate['expression']}`",
        "",
        "Browser expression:",
        "",
        f"`{candidate['appExpression']}`",
        "",
        "## Summary",
        "",
        "| Metric | Holdout | All 175 |",
        "| --- | ---: | ---: |",
        f"| Mean improvement | {fmt(holdout['meanImprovementPct'])}% | {fmt(all_summary['meanImprovementPct'])}% |",
        f"| Hard-route improvement | {fmt(holdout['hardImprovementPct'])}% | {fmt(all_summary['hardImprovementPct'])}% |",
        f"| Outer-band improvement | {fmt(holdout['outerImprovementPct'])}% | {fmt(all_summary['outerImprovementPct'])}% |",
        f"| Route preservation | {fmt(holdout['routePreservationRate'] * 100)}% | {fmt(all_summary['routePreservationRate'] * 100)}% |",
        f"| Route breaks | {holdout['routeBreakCount']} | {all_summary['routeBreakCount']} |",
        f"| Regression rate >2 km/s | {fmt(holdout['regressionOver2Rate'] * 100)}% | {fmt(all_summary['regressionOver2Rate'] * 100)}% |",
        "",
        "## Guardrails",
        "",
        "| Check | Actual | Threshold | Status |",
        "| --- | ---: | --- | --- |",
    ]
    for row in guardrails:
        actual = row["actual"]
        if row["label"] in {"Route preservation", "Regression rate > 2 km/s"} and isinstance(actual, (int, float)):
            actual_text = f"{fmt(actual * 100)}%"
        elif "improvement" in row["label"].lower() and isinstance(actual, (int, float)):
            actual_text = f"{fmt(actual)}%"
        else:
            actual_text = fmt(actual)
        lines.append(f"| {row['label']} | {actual_text} | {row['threshold']} | {'pass' if row['passed'] else 'fail'} |")

    if validation["selectionTier"] == "strict" and validation["claimStatus"] != "promoted for review":
        failures = ", ".join(row["label"] for row in validation.get("guardrailFailures", [])) or "holdout guardrails"
        lines.extend(
            [
                "",
                "## Strict Track",
                "",
                "A route-preserving strict candidate exists, but it is not review-ready because the holdout guardrails did not all pass.",
                f"Failed checks: {failures}.",
            ]
        )
    elif validation["selectionTier"] != "strict":
        nearest = capsule.get("nearestPassingCandidate")
        strict_message = (
            f"No strict candidate reached the `{fmt(STRICT_ROUTE_PRESERVATION * 100, 0)}%` route-preservation tier in discovery. "
            if not validation.get("strictCandidateExists")
            else "A strict candidate exists in discovery, but this selected candidate is frontier-tier. "
        )
        lines.extend(
            [
                "",
                "## Strict Track",
                "",
                strict_message
                + "The selected candidate is kept as frontier evidence and remains rejected unless every holdout guardrail passes.",
            ]
        )
        if nearest:
            nearest_summary = nearest["summary"]
            nearest_label = "Best strict candidate" if validation.get("strictCandidateExists") else "Nearest strict near-miss"
            lines.append(
                f"{nearest_label}: `{nearest['candidate']['id']}` with route preservation "
                f"{fmt(nearest_summary['routePreservationRate'] * 100)}% and mean improvement {fmt(nearest_summary['meanImprovementPct'])}% on train."
            )

    lines.extend(["", "## Route-Break Anatomy", ""])
    for split_name in ["holdout", "all"]:
        summary = route_breaks[split_name]
        lines.extend(
            [
                f"### {split_name.title()}",
                "",
                f"Route breaks: {summary['count']} ({fmt(summary['rate'] * 100)}%)",
                "",
                "| Transition | Count |",
                "| --- | ---: |",
            ]
        )
        if summary["transitions"]:
            for transition, count in summary["transitions"].items():
                lines.append(f"| {transition} | {count} |")
        else:
            lines.append("| none | 0 |")
        lines.extend(["", "| Cause | Count |", "| --- | ---: |"])
        if summary["reasons"]:
            for reason, count in summary["reasons"].items():
                lines.append(f"| {reason} | {count} |")
        else:
            lines.append("| none | 0 |")

    lines.extend(["", "## Top Improvements", "", "| Galaxy | Split | Route | Baseline | Candidate | Improvement |", "| --- | --- | --- | ---: | ---: | ---: |"])
    for row in improvements:
        lines.append(
            f"| {row['name']} | {row['split']} | {row['route']} | {fmt(row['baselineRmse'])} | {fmt(row['candidateRmse'])} | {fmt(row['improvement'])} |"
        )

    lines.extend(["", "## Worst Regressions", "", "| Galaxy | Split | Route | Baseline | Candidate | Regression |", "| --- | --- | --- | ---: | ---: | ---: |"])
    if regressions:
        for row in regressions:
            lines.append(
                f"| {row['name']} | {row['split']} | {row['route']} | {fmt(row['baselineRmse'])} | {fmt(row['candidateRmse'])} | {fmt(row['delta'])} |"
            )
    else:
        lines.append("| none | -- | -- | -- | -- | -- |")

    lines.extend(
        [
            "",
            "## Failure Anatomy Policy",
            "",
            "This report rejects per-galaxy lookup rules, raw-RMSE terms, residual-sign terms, and galaxy-name shortcuts. "
            "The candidate is a state-conditioned diagnostic until promoted by holdout guardrails.",
            "",
        ]
    )
    return "\n".join(lines)


def html_report(markdown: str, capsule: dict) -> str:
    escaped = html.escape(markdown)
    status = html.escape(capsule["candidate"]["claimStatus"])
    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        "<title>MTS High-RMSE Candidate Report</title>"
        "<style>body{font:15px/1.5 system-ui;background:#11130f;color:#eef1e8;margin:0;padding:28px}"
        "main{max-width:980px;margin:auto}pre{white-space:pre-wrap;background:#191c16;border:1px solid #343b31;"
        "border-radius:8px;padding:18px}strong{color:#d6ff63}.status{display:inline-block;padding:6px 10px;"
        "border-radius:6px;background:#20241d;border:1px solid #343b31}</style></head><body><main>"
        f"<p class=\"status\"><strong>Status:</strong> {status}</p><pre>{escaped}</pre>"
        "</main></body></html>"
    )


def write_validation_artifacts(
    out_dir: Path,
    candidate: Candidate,
    split: dict,
    curves: list[dict],
    include_html: bool,
    discovery: dict | None = None,
) -> dict:
    rows = all_scored_rows(curves, candidate, split)
    train_rows = [row for row in rows if row["split"] == "train"]
    holdout_rows = [row for row in rows if row["split"] == "holdout"]
    train_summary = summarize_rows(train_rows)
    holdout_summary = summarize_rows(holdout_rows)
    all_summary = summarize_rows(rows)
    guardrails = evaluate_guardrails(holdout_summary)
    route_breaks = {
        "train": route_break_summary(train_rows),
        "holdout": route_break_summary(holdout_rows),
        "all": route_break_summary(rows),
    }
    nearest = discovery_item_json(discovery["strict"][0]) if discovery and discovery["strict"] else None
    if nearest is None and discovery:
        nearest = discovery_item_json(discovery["nearestStrictNearMiss"])
    frontier = discovery_item_json(discovery["frontier"][0]) if discovery and discovery["frontier"] else None
    capsule = candidate_capsule(
        candidate,
        split,
        train_summary,
        holdout_summary,
        all_summary,
        guardrails,
        route_breaks,
        nearest,
        frontier,
    )
    strict_exists = bool(discovery and discovery["strict"])
    capsule["strictCandidateExists"] = strict_exists
    capsule["validation"]["strictCandidateExists"] = strict_exists
    report = markdown_report(capsule, rows)

    out_dir.mkdir(parents=True, exist_ok=True)
    write_csv(out_dir / "mts-high-rmse-scores.csv", rows)
    (out_dir / "mts-high-rmse-report.md").write_text(report, encoding="utf-8")
    (out_dir / "mts-high-rmse-candidate.json").write_text(json.dumps(json_clean(capsule), indent=2), encoding="utf-8")
    if include_html:
        (out_dir / "mts-high-rmse-report.html").write_text(html_report(report, capsule), encoding="utf-8")
    return capsule


def write_ranked_discovery(path: Path, ranked: list[dict], track: str) -> None:
    rows = []
    for rank, item in enumerate(ranked, start=1):
        candidate = item["candidate"]
        summary = item["summary"]
        rows.append(
            {
                "rank": rank,
                "track": track,
                "selection_tier": item["selectionTier"],
                "candidate_id": candidate.id,
                "name": candidate.name,
                "score": item["score"],
                "strict_score": item["strictScore"],
                "mean_improvement_pct": summary["meanImprovementPct"],
                "hard_improvement_pct": summary["hardImprovementPct"],
                "outer_improvement_pct": summary["outerImprovementPct"],
                "route_preservation_rate": summary["routePreservationRate"],
                "route_break_count": summary["routeBreakCount"],
                "regression_over_2_rate": summary["regressionOver2Rate"],
                "max_regression": summary["maxRegression"],
                "route_basis": candidate.route_basis,
                "damping_mode": candidate.damping_mode,
                "damping_scale": candidate.damping_scale,
                "app_expression": candidate.app_expression(),
            }
        )
    write_csv(path, rows)


def write_discovery(out_dir: Path, discovery: dict) -> None:
    combined = discovery["strict"] + discovery["frontier"]
    write_ranked_discovery(out_dir / "mts-high-rmse-discovery.csv", combined, "combined")
    write_ranked_discovery(out_dir / "mts-high-rmse-discovery-strict.csv", discovery["strict"], "strict")
    write_ranked_discovery(out_dir / "mts-high-rmse-discovery-frontier.csv", discovery["frontier"], "frontier")


def select_candidate(discovery: dict, candidate_id: str | None) -> Candidate:
    ranked = discovery["all"]
    if candidate_id:
        for item in ranked:
            if item["candidate"].id == candidate_id:
                return item["candidate"]
        raise SystemExit(f"Candidate id not found: {candidate_id}")
    if discovery["strict"]:
        return discovery["strict"][0]["candidate"]
    if discovery["frontier"]:
        return discovery["frontier"][0]["candidate"]
    raise SystemExit("No candidates were generated")


def build_curves() -> list[dict]:
    return [build_curve(sample) for sample in load_samples()]


def cmd_baseline(args: argparse.Namespace) -> None:
    curves = build_curves()
    summary = baseline_summary(curves)
    print(f"Loaded {len(curves)} LTG curves from {SAMPLES_JS}")
    print("Locked baseline: S_base = Gamma0 * L_eff * (1 - exp(-(r / L_eff)^q))")
    print_summary_table("BASELINE", summary)


def cmd_discover(args: argparse.Namespace) -> None:
    curves = build_curves()
    split = stratified_split(curves, args.seed, args.holdout_fraction)
    discovery = discover_candidates(split["train"])
    if args.out:
        write_discovery(Path(args.out), discovery)
    print(f"Loaded {len(curves)} LTG curves; train={len(split['train'])}, holdout={len(split['holdout'])}, seed={args.seed}")
    print(f"Strict candidates: {len(discovery['strict'])}; frontier candidates: {len(discovery['frontier'])}")
    if not discovery["strict"]:
        print("No strict candidate reached the 95% route-preservation tier in discovery.")
    for track in ["strict", "frontier"]:
        print(f"{track.upper()} DISCOVERY RANKING (train split only)")
        print("rank\tcandidate\tscore\tmean%\thard%\touter%\troute_keep%\tregress>2%\tmax_reg")
        for rank, item in enumerate(discovery[track][:10], start=1):
            s = item["summary"]
            print(
                "\t".join(
                    [
                        str(rank),
                        item["candidate"].id,
                        fmt(item["strictScore"] if track == "strict" else item["score"]),
                        fmt(s["meanImprovementPct"]),
                        fmt(s["hardImprovementPct"]),
                        fmt(s["outerImprovementPct"]),
                        fmt(s["routePreservationRate"] * 100),
                        fmt(s["regressionOver2Rate"] * 100),
                        fmt(s["maxRegression"]),
                    ]
                )
            )


def cmd_validate(args: argparse.Namespace, include_html: bool) -> None:
    curves = build_curves()
    split = stratified_split(curves, args.seed, args.holdout_fraction)
    discovery = discover_candidates(split["train"])
    candidate = select_candidate(discovery, args.candidate_id)
    capsule = write_validation_artifacts(Path(args.out), candidate, split, curves, include_html, discovery)
    print(f"Loaded {len(curves)} LTG curves; train={len(split['train'])}, holdout={len(split['holdout'])}, seed={args.seed}")
    print(f"Candidate: {candidate.id}")
    print(f"Selection tier: {capsule['validation']['selectionTier']}")
    print(f"Candidate status: {capsule['validation']['status']}")
    print(f"Claim status: {capsule['validation']['claimStatus']}")
    print_summary_table("TRAIN", capsule["validation"]["train"])
    print_summary_table("HOLDOUT", capsule["validation"]["holdout"])
    print(f"Wrote reports to {Path(args.out).resolve()}")


def cmd_list_candidates() -> None:
    print("candidate_id\tname\tkind")
    for candidate in candidate_registry():
        print(f"{candidate.id}\t{candidate.name}\t{candidate.kind}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="MTS high-RMSE research harness")
    parser.add_argument("--mode", choices=["baseline", "discover", "validate", "report"], default="baseline")
    parser.add_argument("--seed", type=int, default=SPLIT_SEED)
    parser.add_argument("--holdout-fraction", type=float, default=HOLDOUT_FRACTION)
    parser.add_argument("--candidate-id", default="")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--list-candidates", action="store_true")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.holdout_fraction = clamp(args.holdout_fraction, 0.1, 0.5)
    args.candidate_id = args.candidate_id or None
    if args.list_candidates:
        cmd_list_candidates()
        return
    if args.mode == "baseline":
        cmd_baseline(args)
    elif args.mode == "discover":
        cmd_discover(args)
    elif args.mode == "validate":
        cmd_validate(args, include_html=False)
    elif args.mode == "report":
        cmd_validate(args, include_html=True)


if __name__ == "__main__":
    main()
