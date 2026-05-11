#!/usr/bin/env python3
"""
MTS failure-mode analysis.

This script does not change the MTS Galaxy Lab framework. It reproduces the
current LTG scoring path, ranks high-RMSE galaxies, and tests a small
diagnostic candidate family for lawful, route-state-gated transport changes.
"""

from __future__ import annotations

import json
import math
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLES_JS = ROOT / "data" / "samples.js"

GAMMA0 = 809.956
R_MAX = 1.758948
ML_DISK = 0.5
ML_BULGE = 0.7
Q_DEFAULT = 0.77


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
    return {
        "name": clean_name(sample["name"]),
        "points": points,
        "h": h,
        "rOut": r_out,
        "fGasOut": f_gas_out,
        "leff": leff,
        "memoryLoad": memory,
        **state,
    }


def smooth_gate(value: float, threshold: float) -> float:
    excess = max(0.0, value - threshold)
    return excess / (1 + excess)


def route_gate(curve: dict) -> float:
    return 1.0 if curve["route"] in {"buffered single-crossing", "buffered upward-crossing", "outer-infeasible"} else 0.0


def candidate_amp(curve: dict) -> float:
    """Diagnostic candidate, not accepted framework law."""
    memory_gate = smooth_gate(curve["memoryLoad"], 0.0)
    late_load_gate = smooth_gate(curve["u075"], 0.25)
    return 1 + 4 * memory_gate * late_load_gate * route_gate(curve)


def score_curve(curve: dict, candidate: bool = False) -> dict:
    amp = candidate_amp(curve) if candidate else 1.0
    sse = 0.0
    band = {
        "inner": {"sse": 0.0, "n": 0, "bias": 0.0},
        "mid": {"sse": 0.0, "n": 0, "bias": 0.0},
        "outer": {"sse": 0.0, "n": 0, "bias": 0.0},
    }
    worst = {"r": math.nan, "x": math.nan, "residual": 0.0}
    for point in curve["points"]:
        support2 = GAMMA0 * amp * curve["leff"] * (1 - math.exp(-((point["r"] / curve["leff"]) ** Q_DEFAULT)))
        model = math.sqrt(max(0.0, point["bar2"] + support2))
        residual = model - point["vObs"]
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

    return {
        "rmse": math.sqrt(sse / len(curve["points"])),
        "innerRmse": rmse("inner"),
        "midRmse": rmse("mid"),
        "outerRmse": rmse("outer"),
        "outerBias": bias("outer"),
        "worstR": worst["r"],
        "worstX": worst["x"],
        "worstResidual": worst["residual"],
        "amp": amp,
    }


def mean(values: list[float]) -> float:
    return sum(values) / len(values)


def summarize(curves: list[dict], candidate: bool = False) -> dict:
    scores = [score_curve(curve, candidate) for curve in curves]
    hard_routes = {"buffered single-crossing", "outer-infeasible"}
    hard = [score_curve(curve, candidate)["rmse"] for curve in curves if curve["route"] in hard_routes]
    upward = [score_curve(curve, candidate)["rmse"] for curve in curves if curve["route"] == "buffered upward-crossing"]
    cdc = [score_curve(curve, candidate)["rmse"] for curve in curves if curve["route"] == "CDC-low-load"]
    low = [score_curve(curve, candidate)["rmse"] for curve in curves if curve["route"] == "low-load"]
    return {
        "mean": mean([score["rmse"] for score in scores]),
        "median": statistics.median(score["rmse"] for score in scores),
        "outerMean": mean([score["outerRmse"] for score in scores if math.isfinite(score["outerRmse"])]),
        "hardMean": mean(hard),
        "upwardMean": mean(upward),
        "cdcMean": mean(cdc),
        "lowMean": mean(low),
    }


def fmt(value: float) -> str:
    return f"{value:.2f}" if isinstance(value, float) and math.isfinite(value) else str(value)


def print_summary_table(curves: list[dict]) -> None:
    baseline = summarize(curves, candidate=False)
    candidate = summarize(curves, candidate=True)
    print("SUMMARY")
    print("metric\tbaseline\tcandidate")
    for key in ["mean", "median", "outerMean", "hardMean", "upwardMean", "cdcMean", "lowMean"]:
        print(f"{key}\t{fmt(baseline[key])}\t{fmt(candidate[key])}")


def print_high_rmse_table(curves: list[dict]) -> None:
    rows = []
    for curve in curves:
        base = score_curve(curve, False)
        cand = score_curve(curve, True)
        rows.append((base["rmse"], curve, base, cand))
    print("\nTOP HIGH-RMSE CASES")
    print("name\troute\tamp\tbase\tcandidate\timprove\touter_base\touter_candidate\tu075\tuOut\tmemory\tfGas")
    for _, curve, base, cand in sorted(rows, reverse=True, key=lambda item: item[0])[:25]:
        print(
            "\t".join(
                [
                    curve["name"],
                    curve["route"],
                    fmt(cand["amp"]),
                    fmt(base["rmse"]),
                    fmt(cand["rmse"]),
                    fmt(base["rmse"] - cand["rmse"]),
                    fmt(base["outerRmse"]),
                    fmt(cand["outerRmse"]),
                    fmt(curve["u075"]),
                    fmt(curve["uOut"]),
                    fmt(curve["memoryLoad"]),
                    fmt(curve["fGasOut"]),
                ]
            )
        )


def print_regressions(curves: list[dict]) -> None:
    rows = []
    for curve in curves:
        base = score_curve(curve, False)
        cand = score_curve(curve, True)
        rows.append((base["rmse"] - cand["rmse"], curve, base, cand))
    print("\nREGRESSIONS OVER 2 KM/S")
    print("name\troute\tamp\tbase\tcandidate\tregression\touter_base\touter_candidate\tu075\tuOut\tmemory")
    for improvement, curve, base, cand in sorted(rows, key=lambda item: item[0]):
        if -improvement <= 2:
            continue
        print(
            "\t".join(
                [
                    curve["name"],
                    curve["route"],
                    fmt(cand["amp"]),
                    fmt(base["rmse"]),
                    fmt(cand["rmse"]),
                    fmt(-improvement),
                    fmt(base["outerRmse"]),
                    fmt(cand["outerRmse"]),
                    fmt(curve["u075"]),
                    fmt(curve["uOut"]),
                    fmt(curve["memoryLoad"]),
                ]
            )
        )


def main() -> None:
    curves = [build_curve(sample) for sample in load_samples()]
    print(f"Loaded {len(curves)} LTG curves from {SAMPLES_JS}")
    print(
        "Candidate: S2' = S2_MTS * (1 + 4 * M/(1+M) * max(0,u075-0.25)/(1+max(0,u075-0.25)) * routeGate)"
    )
    print("routeGate = 1 only for buffered single-crossing, buffered upward-crossing, and outer-infeasible routes")
    print_summary_table(curves)
    print_high_rmse_table(curves)
    print_regressions(curves)


if __name__ == "__main__":
    main()
