"""
Analyze JMeter .jtl results and the server's structured access log.

Usage:
    python analyze.py --jtl results.jtl [--access-log access.log] [--out report]

What it does:
  1. Loads the JMeter JTL (CSV with header) into a DataFrame.
  2. Computes throughput, error rate, and p50/p95/p99 per endpoint label.
  3. Optionally cross-checks with the server-side access log (JSONL) to compare
     network latency vs. server-side handler duration.
  4. Writes:
        <out>/summary.csv        — per-endpoint percentiles & error rate
        <out>/latency_over_time.png
        <out>/throughput_over_time.png
        <out>/server_vs_client.png  (only if --access-log is supplied)
        <out>/report.md          — human-readable summary

The JTL produced by tests/perf/load.jmx records, per request:
    timeStamp, elapsed, label, responseCode, success, bytes, threadName, ...

The Express access log produced by public/middleware/accessLog.js is JSON
Lines, one object per request: {ts, method, path, status, durationMs, bytes}.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def load_jtl(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "timeStamp" not in df.columns:
        sys.exit(f"{path}: not a JMeter JTL — missing 'timeStamp' column")
    df["ts"] = pd.to_datetime(df["timeStamp"], unit="ms", utc=True)
    df["success"] = df["success"].astype(bool)
    df["elapsed"] = df["elapsed"].astype(float)
    return df


def load_access_log(path: Path) -> pd.DataFrame:
    rows = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    return df


def per_endpoint_summary(df: pd.DataFrame) -> pd.DataFrame:
    g = df.groupby("label")
    out = pd.DataFrame(
        {
            "count": g.size(),
            "errors": g["success"].apply(lambda s: (~s).sum()),
            "error_rate_pct": g["success"].apply(lambda s: (~s).mean() * 100),
            "p50_ms": g["elapsed"].quantile(0.50),
            "p95_ms": g["elapsed"].quantile(0.95),
            "p99_ms": g["elapsed"].quantile(0.99),
            "max_ms": g["elapsed"].max(),
            "rps": g.apply(
                lambda gdf: len(gdf)
                / max((gdf["ts"].max() - gdf["ts"].min()).total_seconds(), 1)
            ),
        }
    )
    return out.round(2)


def plot_latency_over_time(df: pd.DataFrame, out_dir: Path) -> Path:
    fig, ax = plt.subplots(figsize=(11, 5))
    for label, gdf in df.groupby("label"):
        gdf_sorted = gdf.sort_values("ts").set_index("ts")
        # 5-second rolling p95
        rolling = (
            gdf_sorted["elapsed"].rolling("5s").quantile(0.95).dropna()
        )
        ax.plot(rolling.index, rolling.values, label=f"{label} p95")
    ax.set_title("Latency over time (5s rolling p95)")
    ax.set_xlabel("Time")
    ax.set_ylabel("Latency (ms)")
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.tight_layout()
    out = out_dir / "latency_over_time.png"
    fig.savefig(out, dpi=120)
    plt.close(fig)
    return out


def plot_throughput_over_time(df: pd.DataFrame, out_dir: Path) -> Path:
    fig, ax = plt.subplots(figsize=(11, 5))
    df = df.set_index("ts").sort_index()
    rps = df.groupby("label").resample("1s").size().unstack(level=0).fillna(0)
    rps.plot(ax=ax)
    ax.set_title("Throughput per second")
    ax.set_xlabel("Time")
    ax.set_ylabel("Requests / sec")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    out = out_dir / "throughput_over_time.png"
    fig.savefig(out, dpi=120)
    plt.close(fig)
    return out


def plot_server_vs_client(
    jtl: pd.DataFrame, log: pd.DataFrame, out_dir: Path
) -> Path | None:
    if log.empty:
        return None
    # Aggregate p95 per endpoint from each side
    client = jtl.groupby("label")["elapsed"].quantile(0.95).rename("client_p95_ms")
    server = log.groupby("path")["durationMs"].quantile(0.95).rename("server_p95_ms")
    # Best-effort label/path alignment: map "GET /menu" -> "/menu"
    client.index = client.index.map(
        lambda s: s.replace("GET ", "").strip() if isinstance(s, str) else s
    )
    df = pd.concat([client, server], axis=1).dropna()
    if df.empty:
        return None
    fig, ax = plt.subplots(figsize=(8, 5))
    df.plot(kind="bar", ax=ax)
    ax.set_title("p95 latency: JMeter (client) vs. Express (server)")
    ax.set_ylabel("ms")
    ax.set_xlabel("endpoint")
    ax.grid(True, alpha=0.3, axis="y")
    fig.tight_layout()
    out = out_dir / "server_vs_client.png"
    fig.savefig(out, dpi=120)
    plt.close(fig)
    return out


def write_report(
    jtl: pd.DataFrame,
    summary: pd.DataFrame,
    plots: list[Path],
    out_dir: Path,
) -> Path:
    total = len(jtl)
    duration_s = (jtl["ts"].max() - jtl["ts"].min()).total_seconds()
    overall_error_pct = (~jtl["success"]).mean() * 100
    lines = [
        "# Load test report",
        "",
        f"- Total requests: **{total}**",
        f"- Test duration: **{duration_s:.1f} s**",
        f"- Overall throughput: **{total / max(duration_s, 1):.2f} req/s**",
        f"- Overall error rate: **{overall_error_pct:.2f}%**",
        "",
        "## Per-endpoint summary",
        "",
        summary.to_markdown(),
        "",
        "## Plots",
        "",
        *[f"![{p.stem}]({p.name})" for p in plots if p],
        "",
    ]
    out = out_dir / "report.md"
    out.write_text("\n".join(lines))
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--jtl", type=Path, required=True)
    p.add_argument("--access-log", type=Path, default=None)
    p.add_argument("--out", type=Path, default=Path("report"))
    args = p.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    jtl = load_jtl(args.jtl)
    summary = per_endpoint_summary(jtl)
    summary.to_csv(args.out / "summary.csv")
    plots = [
        plot_latency_over_time(jtl, args.out),
        plot_throughput_over_time(jtl, args.out),
    ]
    if args.access_log:
        log = load_access_log(args.access_log)
        plots.append(plot_server_vs_client(jtl, log, args.out))
    report = write_report(jtl, summary, plots, args.out)
    print(f"Wrote {report}")
    print(summary.to_string())


if __name__ == "__main__":
    main()
