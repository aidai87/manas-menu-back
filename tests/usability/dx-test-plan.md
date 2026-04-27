# Developer-experience usability test

Goal: measure whether a working developer can integrate `manas-menu-back`
into a frontend without help, using only the README + OpenAPI spec.

This plan is intentionally short. Run it once before tagging a release;
re-run if the API surface changes.

## Participants

5 developers (the magic number — past 5, you mostly find duplicates of
issues you've already seen). Mix of seniority:

- 1 student / first-year dev
- 2 mid-level frontend devs unfamiliar with the project
- 1 backend dev unfamiliar with the project
- 1 senior generalist

## Setup (per session, ~30 min)

- Quiet room, screen-share or in-person, recording with consent.
- Participant gets: a fresh laptop, a clone of the repo at the tag under
  test, Node.js installed.
- Moderator sits beside but does **not** help except when the participant
  is fully blocked (>5 min).
- "Think aloud" protocol — participant narrates what they're trying to do
  and why.

## Tasks

| # | Task | Success criterion | Target time |
|---|---|---|---|
| 1 | Get the server running locally and hit `/menu` from `curl` once. | 200 response with `foods` key. | ≤ 5 min |
| 2 | List today's foods (Turkish names) in a 10-line Node script. | Script prints today's items. | ≤ 8 min |
| 3 | Build a minimal HTML page that shows today's menu in Russian. | Names render in `ru`. | ≤ 15 min |
| 4 | Render the kiraathane menu grouped by category with prices in KGS. | Shows at least one category with priced items. | ≤ 10 min |
| 5 | Trigger the "menu not yet scraped" error path and explain how to recover. | Participant produces 503, reads the error message, runs `npm run scrape`. | ≤ 5 min |

Do not give the OpenAPI spec link until task 3 — see whether they discover
it from the README first.

## What to record

For each task:

- **Completion** — completed unaided / completed with hint / abandoned.
- **Time-on-task** — wall-clock from "go" to success.
- **Friction events** — every time the participant pauses, re-reads
  something, or expresses confusion. One-line note per event.
- **Direct quotes** — verbatim things the participant said (these are the
  most useful artifact in the report).

## Post-task survey (5 min)

Likert 1–5 (1 = strongly disagree, 5 = strongly agree):

1. The README told me everything I needed to start.
2. The endpoint shapes were predictable.
3. The error message I saw made it clear what to do next.
4. The example responses matched what the server actually returned.
5. I would integrate this API into a real project as-is.

Open question: "If you could change one thing about this API, what would
it be?"

## Report template

For each task, record `% completed unaided`, `median time`, top 3 friction
events with verbatim quotes.

**Decision rule.** Any task with <60% unaided-completion rate, or with the
same friction event from ≥3 of 5 participants, is a release blocker.

## Heuristics that the API itself should pass (automatable)

These complement the human session — run them in CI:

- Every error response has both `error` (machine code) and `message`
  (human). Enforced by route tests in `tests/integration/server.test.js`.
- OpenAPI spec lints clean: `npm run lint:openapi`.
- README quickstart works on a fresh container in <5 min (run via a
  scripted CI job; not yet wired up — recommended next step).
- Every documented endpoint has at least one example response in the
  OpenAPI spec.

## What this test does *not* cover

- Performance under load — see `tests/perf/README.md`.
- End-user (non-developer) UX — there's no end-user UI in this repo. If a
  consuming frontend exists, run usability testing on that frontend, not
  on the API.
