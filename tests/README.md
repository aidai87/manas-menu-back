# Tests

This directory holds three kinds of testing artifacts. They cover the
trio: **unit testing, performance testing, usability testing**.

```
tests/
├── unit/             # vitest — pure logic & parsers (49 tests)
├── integration/      # vitest + supertest — Express routes
├── fixtures/         # canned HTML used by parser unit tests
├── perf/             # JMeter plan + Python analyzer
└── usability/        # OpenAPI spec + 5-developer DX test plan
```

## Quick start

```bash
npm install
npm test               # unit + integration
npm run test:coverage  # adds an HTML coverage report at coverage/
```

## Unit & integration

- `unit/generateId.test.js` — Turkish→ASCII slug behavior, edge cases,
  idempotence, real food names.
- `unit/translateFood.test.js` — exact match, partial match, fallback,
  totality, dictionary immutability, category translations.
- `unit/menuParser.test.js` — parses the canned cafeteria HTML in
  `fixtures/menu.html`. `axios` calls are mocked with `nock` — no
  network is touched. Asserts: date grouping, food deduplication,
  calorie attribution, manifest-driven CDN photo URLs (with fallback),
  removal of internal `_originalUrl` field, empty-document handling,
  upstream HTTP failure propagation.
- `unit/kiraathaneParser.test.js` — same shape against `fixtures/kiraathane.html`.
  Covers canonical category ids, generated ids for unknown categories,
  filtering of empty categories, manifest photo resolution, price parsing.
- `unit/saveJsonFiles.test.js` — orchestration, asserts both JSON files
  are written and surfaces upstream failures. Backs up and restores the
  real `public/menu.json` and `public/buffet.json` so the working tree
  stays clean.
- `integration/server.test.js` — spins the Express app via `createApp()`
  and uses supertest to assert all four endpoints (`/health`, `/menu`,
  `/kiraathane`, unknown-route 404), the cache header, the access-log
  output, and the 503 path when JSON files are missing.

## Performance

See [`perf/README.md`](perf/README.md). Runs JMeter against the local
Express server, writes a `.jtl`, then a Python script joins it with the
server's structured access log to compute per-endpoint percentiles and
plot latency / throughput / server-vs-client gap.

## Usability

See [`usability/dx-test-plan.md`](usability/dx-test-plan.md). The
quantitative side (success rate, time-on-task, error-message clarity) is
collected via a 5-developer moderated session against the artifacts in
this directory plus the OpenAPI spec at
[`usability/openapi.yaml`](usability/openapi.yaml).
