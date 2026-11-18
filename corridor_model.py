"""Corridor: "where will it go next" forecaster.

Task: given seizure history up to week t, predict seizure counts per district
over weeks t+1..t+H. Corridor structure enters as UPSTREAM features: recent
seizures in districts that feed a district along a known pipeline (e.g. Wayanad → Kozhikode).

Usage:
  python corridor_model.py --csv seizures.csv      # real data: columns date,district
  python corridor_model.py --demo                  # synthetic smoke test ONLY
  python corridor_model.py --csv seizures.csv --export-json ../web/data/corridor-backtest.json

Honest framing: this forecasts SEIZURE INTENSITY (a biased proxy for flow).
Checkposts (Muthanga, Walayar) dominate because they are watched, not because they carry all traffic.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_poisson_deviance, mean_absolute_error

DISTRICTS = [
    "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha", "Kottayam",
    "Idukki", "Ernakulam", "Thrissur", "Palakkad", "Malappuram", "Kozhikode",
    "Wayanad", "Kannur", "Kasaragod"
]
D_IDX = {d: i for i, d in enumerate(DISTRICTS)}

# Upstream -> Downstream edges matching the 10 documented Kerala transit pipelines
EDGES = [
    ("Wayanad", "Kozhikode"),      # c01: Bengaluru -> Muthanga -> Wayanad -> Kozhikode
    ("Wayanad", "Malappuram"),     # c01: Wayanad feeder into Malappuram
    ("Palakkad", "Thrissur"),      # c02/c04/c10: Walayar checkpost -> Palakkad -> Thrissur
    ("Palakkad", "Ernakulam"),     # c02/c04/c10: Palakkad trunk -> Kochi commercial hub
    ("Thrissur", "Ernakulam"),     # c02/c08: Thrissur gateway -> Ernakulam
    ("Kasaragod", "Kannur"),       # c03: Mangalore/Thalappady -> Kasaragod -> Kannur
    ("Kannur", "Kozhikode"),       # c03: North coastal transit into Kozhikode
    ("Idukki", "Ernakulam"),       # c06: High Range (Kumily) -> Ernakulam
    ("Idukki", "Kottayam"),        # c06: High Range (Kumily) -> Kottayam
    ("Kozhikode", "Malappuram"),   # c08: North-central distribution feeder
    ("Malappuram", "Thrissur"),    # c08: Malappuram -> Thrissur
    ("Ernakulam", "Alappuzha"),    # c07: South coastal transit
    ("Alappuzha", "Kollam"),       # c07: South coastal transit
    ("Kollam", "Thiruvananthapuram"), # c07/c09: Southern transit into Capital
    ("Kollam", "Pathanamthitta"),  # c09: Aryankavu border feeder
]


def weekly_counts(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "date" in df.columns:
        date_col = "date"
    elif "event_date" in df.columns and "publish_date" in df.columns:
        df["date"] = pd.to_datetime(df["event_date"].fillna(df["publish_date"]), errors="coerce")
        date_col = "date"
    elif "event_date" in df.columns:
        date_col = "event_date"
    elif "publish_date" in df.columns:
        date_col = "publish_date"
    else:
        raise ValueError("CSV must contain a date, event_date, or publish_date column")

    df["date"] = pd.to_datetime(df[date_col], errors="coerce")
    valid = df[df["date"].notna() & df["district"].isin(DISTRICTS)].copy()
    if "classification" in valid.columns:
        valid = valid[valid["classification"] == "seizure"]
    if "review_status" in valid.columns:
        valid = valid[valid["review_status"] != "rejected"]

    valid["week"] = valid["date"].dt.to_period("W").dt.start_time
    wide = valid.groupby(["week", "district"]).size().unstack(fill_value=0)
    weeks = pd.date_range(wide.index.min(), wide.index.max(), freq="W-MON")
    return wide.reindex(index=weeks, columns=DISTRICTS, fill_value=0)


def build_features(C: pd.DataFrame, H: int) -> pd.DataFrame:
    tot4 = C.sum(axis=1).rolling(4).mean()
    rows = []
    for d in DISTRICTS:
        up = [u for u, v in EDGES if v == d]
        U = C[up].sum(axis=1) if up else pd.Series(0, index=C.index)
        f = pd.DataFrame(index=C.index)
        f["district"] = D_IDX[d]
        for l in range(4):
            f[f"own_l{l}"] = C[d].shift(l)
            f[f"up_l{l}"] = U.shift(l)
        f["own_m4"] = C[d].rolling(4).mean()
        f["own_m12"] = C[d].rolling(12).mean()
        f["all_m4"] = tot4
        woy = C.index.isocalendar().week.values
        f["woy_sin"] = np.sin(2 * np.pi * woy / 52)
        f["woy_cos"] = np.cos(2 * np.pi * woy / 52)
        # Seasonal festival flags in Kerala
        f["is_onam_season"] = ((woy >= 33) & (woy <= 37)).astype(int)  # August/September surge
        f["is_tourism_peak"] = ((woy >= 48) | (woy <= 5)).astype(int)  # Dec-Jan holiday peak
        f["y"] = C[d].rolling(H).sum().shift(-H)   # seizures in t+1..t+H
        f["t"] = np.arange(len(C))
        f["name"] = d
        f["week_start"] = C.index.strftime("%Y-%m-%d")
        rows.append(f)
    return pd.concat(rows)


def fit_predict(train: pd.DataFrame, test: pd.DataFrame, cols: list[str]) -> np.ndarray:
    m = HistGradientBoostingRegressor(
        loss="poisson",
        max_depth=3,
        learning_rate=0.05,
        max_iter=150,
        min_samples_leaf=20,
        l2_regularization=1.0,
        categorical_features=[cols.index("district")] if "district" in cols else None,
        random_state=0
    )
    m.fit(train[cols], train["y"])
    return np.clip(m.predict(test[cols]), 1e-3, None)


def fit_predict_intervals(train: pd.DataFrame, test: pd.DataFrame, cols: list[str]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Fit quantile models for honest uncertainty bounds (p10, p50, p90)."""
    preds = {}
    for q in [0.10, 0.50, 0.90]:
        mq = HistGradientBoostingRegressor(
            loss="quantile",
            quantile=q,
            max_depth=3,
            learning_rate=0.05,
            max_iter=100,
            min_samples_leaf=20,
            l2_regularization=1.0,
            categorical_features=[cols.index("district")] if "district" in cols else None,
            random_state=0
        )
        mq.fit(train[cols], train["y"])
        preds[q] = np.clip(mq.predict(test[cols]), 0.0, None)
    return preds[0.10], preds[0.50], preds[0.90]


def hit_at_3(df: pd.DataFrame, pred_col: str) -> tuple[float, int]:
    scores = []
    for _, g in df.groupby("t"):
        if (g["y"] > 0).sum() < 3:
            continue
        a = set(g.nlargest(3, pred_col)["name"])
        b = set(g.nlargest(3, "y")["name"])
        scores.append(len(a & b) / 3)
    return (float(np.mean(scores)), len(scores)) if scores else (0.0, 0)


def compute_corridor_lead_lags(C: pd.DataFrame) -> list[dict]:
    """Empirical cross-correlation to test if upstream checkposts lead downstream seizures."""
    results = []
    for u, v in EDGES:
        s_u = C[u]
        s_v = C[v]
        lags_info = []
        best_lag = 0
        best_corr = -1.0
        for l in range(0, 5):
            if l == 0:
                corr = np.corrcoef(s_u, s_v)[0, 1]
            else:
                corr = np.corrcoef(s_u.iloc[:-l], s_v.shift(-l).dropna())[0, 1]
            corr = 0.0 if np.isnan(corr) else float(corr)
            lags_info.append({"lag_weeks": l, "correlation": round(corr, 3)})
            if corr > best_corr:
                best_corr = corr
                best_lag = l

        # Compute empirical 95% bootstrap confidence interval for the best lag
        boot_corrs = []
        n = len(s_u)
        for _ in range(200):
            idx = np.random.choice(n - best_lag, n - best_lag, replace=True)
            u_samp = s_u.iloc[idx].values
            v_samp = s_v.shift(-best_lag).dropna().iloc[idx].values
            c = np.corrcoef(u_samp, v_samp)[0, 1]
            if not np.isnan(c):
                boot_corrs.append(c)
        ci_lower = float(np.percentile(boot_corrs, 2.5)) if boot_corrs else 0.0
        ci_upper = float(np.percentile(boot_corrs, 97.5)) if boot_corrs else 0.0

        results.append({
            "upstream": u,
            "downstream": v,
            "optimal_lag_weeks": best_lag,
            "optimal_lag_days": f"{best_lag * 7}–{(best_lag + 1) * 7} days",
            "correlation": round(best_corr, 3),
            "ci_95": [round(ci_lower, 3), round(ci_upper, 3)],
            "hypothesis_supported": best_corr > 0.05 and ci_upper > 0.10,
            "interpretation": (
                f"Seizures at {u} lead elevated activity in {v} by {best_lag * 7}–{(best_lag + 1) * 7} days "
                f"(r={best_corr:+.2f}, 95% CI [{ci_lower:+.2f}, {ci_upper:+.2f}])."
                if best_lag > 0 and best_corr > 0.05
                else f"Synchronous co-occurrence or weak directional transit between {u} and {v}."
            ),
            "lags": lags_info
        })
    return results


def explain_district_predictions(row: pd.Series) -> list[str]:
    reasons = []
    if row.get("up_l0", 0) + row.get("up_l1", 0) > 1.5:
        reasons.append(f"Upstream corridor pipeline had active seizures in past 1-2 weeks ({int(row.get('up_l0', 0) + row.get('up_l1', 0))} cases)")
    if row.get("own_l0", 0) > 2:
        reasons.append(f"Local cluster momentum: {int(row.get('own_l0', 0))} seizures observed in previous week")
    if row.get("is_onam_season", 0) == 1:
        reasons.append("Statewide Onam festival period: historical commercial inflow surge")
    if row.get("is_tourism_peak", 0) == 1:
        reasons.append("Coastal/hill-station winter tourism season active")
    if row.get("own_m12", 0) > 1.5:
        reasons.append(f"High baseline enforcement presence ({row.get('own_m12', 0):.1f}/wk historical average)")
    if not reasons:
        reasons.append("Baseline background rate in line with seasonal trends")
    return reasons


def backtest(C: pd.DataFrame, H: int = 2, block: int = 4) -> tuple[pd.DataFrame, dict]:
    F = build_features(C, H).dropna()
    T = len(C)
    base_cols = [
        "district", "own_l0", "own_l1", "own_l2", "own_l3", "own_m4", "own_m12",
        "all_m4", "woy_sin", "woy_cos", "is_onam_season", "is_tourism_peak"
    ]
    full_cols = base_cols + [f"up_l{l}" for l in range(4)]
    out = []

    for cut in range(int(T * 0.6), T - H - 1, block):
        train = F[F["t"] <= cut - H]          # targets fully known by cutoff: strictly no leakage
        test = F[(F["t"] >= cut) & (F["t"] < cut + block)].copy()
        if test.empty:
            continue
        test["p_base"] = test["own_m12"] * H                       # naive rolling-mean baseline
        test["p_own"] = fit_predict(train, test, base_cols)        # model, no corridor info
        test["p_full"] = fit_predict(train, test, full_cols)       # model + upstream corridor feats

        # Uncertainty intervals (p10, p50, p90)
        p10, p50, p90 = fit_predict_intervals(train, test, full_cols)
        test["p_lower"] = p10
        test["p_upper"] = p90

        out.append(test)

    R = pd.concat(out)
    R["p_base"] = np.clip(R["p_base"], 1e-3, None)

    summary = {}
    print(f"\n=======================================================")
    print(f"  CORRIDOR ACCOUNTABLE FORECAST BACKTEST (H={H} WEEKS)")
    print(f"  Framing: SEIZURE INTENSITY (Enforcement Proxy, NOT Total Flow)")
    print(f"=======================================================")
    print(f"Rolling-origin backtest: {R['t'].nunique()} test weeks, horizon={H} weeks")
    print(f"{'model':<30}{'Poisson dev':>12}{'MAE':>8}{'hit@3':>8}")

    for name, col, key in [
        ("rolling-mean baseline", "p_base", "baseline"),
        ("GBM own-history only", "p_own", "own_history"),
        ("GBM + upstream corridors", "p_full", "corridors"),
    ]:
        dev = mean_poisson_deviance(R["y"], R[col])
        mae = float(np.mean(np.abs(R["y"] - R[col])))
        h, n = hit_at_3(R, col)
        print(f"{name:<30}{dev:>12.3f}{mae:>8.3f}{h:>8.2f}")
        summary[key] = {
            "name": name,
            "poisson_deviance": round(float(dev), 3),
            "mae": round(mae, 3),
            "hit_at_3": round(h, 3),
            "n_eval_weeks": n
        }

    # Coverage calibration of uncertainty interval
    calibrated = np.mean((R["y"] >= R["p_lower"]) & (R["y"] <= R["p_upper"]))
    print(f"\nPrediction interval (p10–p90) empirical coverage: {calibrated * 100:.1f}%")
    summary["interval_coverage"] = round(float(calibrated), 3)

    gap_dev = summary["baseline"]["poisson_deviance"] - summary["corridors"]["poisson_deviance"]
    pct_lift = (gap_dev / summary["baseline"]["poisson_deviance"]) * 100
    print(f"Headline corridor lift: -{gap_dev:.3f} Poisson deviance ({pct_lift:+.1f}% improvement over naive baseline)")
    summary["headline_lift_pct"] = round(pct_lift, 1)

    return R, summary


def synthetic(seed: int = 0, weeks: int = 156) -> pd.DataFrame:
    """Planted effect: upstream seizures raise downstream rate 1-2 weeks later."""
    rng = np.random.default_rng(seed)
    base = rng.uniform(0.15, 0.9, 14)
    C = np.zeros((weeks, 14))
    for t in range(weeks):
        for d, name in enumerate(DISTRICTS):
            lam = base[d] * (1 + 0.3 * np.sin(2 * np.pi * t / 52))
            for u, v in EDGES:
                if v == name and t >= 2:
                    lam += 0.35 * (C[t - 1, D_IDX[u]] + 0.5 * C[t - 2, D_IDX[u]])
            C[t, d] = rng.poisson(lam)
    idx = pd.date_range("2023-01-02", periods=weeks, freq="W-MON")
    return pd.DataFrame(C, index=idx, columns=DISTRICTS).astype(int)


def export_backtest_json(R: pd.DataFrame, C: pd.DataFrame, summary: dict, lead_lags: list[dict], out_path: Path):
    """Export complete backtest replay and explanations for web UI demo."""
    # Organize by test week
    test_weeks = sorted(R["t"].unique())
    timeline = []

    for t_val in test_weeks:
        w_df = R[R["t"] == t_val]
        week_label = w_df["week_start"].iloc[0]
        districts_data = []

        for _, r in w_df.iterrows():
            d_name = r["name"]
            obs = float(r["y"])
            p_base = float(r["p_base"])
            p_own = float(r["p_own"])
            p_full = float(r["p_full"])
            p_low = float(r["p_lower"])
            p_high = float(r["p_upper"])

            districts_data.append({
                "district": d_name,
                "observed": round(obs, 1),
                "predicted": round(p_full, 2),
                "predicted_base": round(p_base, 2),
                "predicted_own": round(p_own, 2),
                "interval_low": round(p_low, 2),
                "interval_high": round(p_high, 2),
                "reasons": explain_district_predictions(r)
            })

        # Sort by predicted full descending
        districts_data.sort(key=lambda x: x["predicted"], reverse=True)

        timeline.append({
            "t": int(t_val),
            "week_start": week_label,
            "districts": districts_data
        })

    payload = {
        "metadata": {
            "framing": "Seizure Intensity (Enforcement Proxy, NOT Flow)",
            "description": "2-week rolling-origin forecast comparing naive baseline, own-history GBM, and upstream corridor GBM.",
            "total_incidents": int(C.values.sum()),
            "total_weeks": len(C),
            "backtest_weeks": len(timeline),
            "edges": [{"upstream": u, "downstream": v} for u, v in EDGES]
        },
        "summary": summary,
        "lead_lags": lead_lags,
        "timeline": timeline
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Exported accountable backtest replay to {out_path}")


def main():
    ap = argparse.ArgumentParser(description="Corridor Accountable Seizure Forecaster")
    ap.add_argument("--csv", help="Path to real seizure CSV (columns date, district, etc.)")
    ap.add_argument("--demo", action="store_true", help="Synthetic smoke test ONLY")
    ap.add_argument("--horizon", type=int, default=2, help="Forecast horizon H in weeks (default: 2)")
    ap.add_argument("--export-json", help="Export backtest replay to JSON for UI demo")
    a = ap.parse_args()

    if a.demo:
        print("*** SYNTHETIC DATA: pipeline smoke test, NOT real findings ***")
        C = synthetic()
    elif a.csv:
        print(f"Loading real data from {a.csv}...")
        C = weekly_counts(pd.read_csv(a.csv))
    else:
        ap.error("Must provide either --csv or --demo")

    print(f"{int(C.values.sum())} incidents across {len(C)} weeks ({DISTRICTS[0]}..{DISTRICTS[-1]})")

    # Lead-lag cross correlation test
    print("\nEvaluating empirical corridor transit lead-lags...")
    lead_lags = compute_corridor_lead_lags(C)
    supported_count = sum(1 for item in lead_lags if item["hypothesis_supported"])
    print(f"Supported lead-lag corridor edges: {supported_count} of {len(lead_lags)}")

    # Rolling origin backtest
    R, summary = backtest(C, H=a.horizon)

    if a.export_json:
        export_backtest_json(R, C, summary, lead_lags, Path(a.export_json))


if __name__ == "__main__":
    main()
