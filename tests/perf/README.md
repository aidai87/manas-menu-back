# Performance testing

Load-test the local Express server (`npm start`) with JMeter, then analyze
the results plus the server's structured access log with `analyze.py`.

The plan loads three endpoints with realistic mix:

| Endpoint | Share | Assertion |
|---|---|---|
| `GET /menu` | 70% | status 200, body contains `"foods"` |
| `GET /kiraathane` | 25% | status 200, body contains `"categories"` |
| `GET /health` | 5% | status 200 |

## Prerequisites

- Apache JMeter 5.6+ (`brew install jmeter` on macOS, or download from
  <https://jmeter.apache.org>).
- Python 3.10+ for `analyze.py`.
- The scrape must have run at least once so `public/menu.json` and
  `public/buffet.json` exist:

  ```bash
  npm run scrape
  ```

## Running a load test

In one terminal — start the server with access logging to a file:

```bash
npm start | tee tests/perf/access.log
```

In another terminal — run JMeter against it:

```bash
cd tests/perf
jmeter -n -t load.jmx -l results.jtl \
  -Jbase_url=http://localhost:3000 \
  -Jthreads=50 -Jramp=30 -Jduration=120
```

### Load profiles

| Profile | Args |
|---|---|
| Smoke | `-Jthreads=1 -Jramp=1 -Jduration=10` |
| Load | `-Jthreads=50 -Jramp=30 -Jduration=120` |
| Stress | `-Jthreads=200 -Jramp=60 -Jduration=300` |
| Soak | `-Jthreads=20 -Jramp=10 -Jduration=3600` |

Run JMeter on a **separate machine** from the server for any profile larger
than smoke; otherwise the load generator and the server will fight for CPU
and the numbers are misleading.

## Analyzing results

```bash
cd tests/perf
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python analyze.py --jtl results.jtl --access-log access.log --out report
```

Outputs `report/`:

- `summary.csv` — per-endpoint count, error rate, p50/p95/p99, max, rps.
- `latency_over_time.png` — 5-second rolling p95 per endpoint.
- `throughput_over_time.png` — req/s per endpoint.
- `server_vs_client.png` — JMeter-side latency vs. server-side handler
  duration. The gap is network + queue time; if it's large, you're
  bottlenecked on something other than the handler.
- `report.md` — human-readable summary.

## What to look for

- **Knee of the latency curve.** Increase `-Jthreads` in steps (10, 25, 50,
  100, 200). The thread count where p95 starts climbing sharply is your
  capacity ceiling.
- **Error rate spikes.** A drop in latency that came from an increase in
  5xx responses is not a win.
- **Server-vs-client gap.** If JMeter sees 80 ms but the access log says
  the handler took 5 ms, you're losing 75 ms in TCP/queue/keep-alive — fix
  that before optimizing handler code.
- **Memory leaks.** Run the soak profile and watch RSS. A flat handler
  latency with growing memory means cleanup is broken somewhere.

## Caveats

- The Express server reads `menu.json` from disk on every `/menu` request.
  Under load, OS page cache makes this effectively free, but a slow disk on
  cold cache will dominate the latency budget. Add an in-memory cache with
  a TTL if this becomes a real bottleneck.
- This plan **does not** load-test the upstream cafeteria site. The
  scraper runs once via `npm run scrape` (or the GitHub Actions cron); the
  server only serves the cached JSON.
