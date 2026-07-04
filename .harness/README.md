# The harness

A file-driven build loop for the **simplification programme**: a queue of pre-written
specs in `specs/`, each implemented by a [ **Generator → Evaluator** ] loop where the
stages share state **only through files on disk** and the git branch — never a shared
context window. Each stage is a fresh `claude -p` process, so no single context has
to hold the whole overnight run.

There is **no Planner stage**: the specs were authored up front (from the
simplification audit) and are the fixed input. The driver just works through them.

```
specs/01…07 ──▶ Generator ──branch commits──▶ Evaluator
   (queue)          ▲                             │
                    └────────── findings.md ◀─────┘
                         (loop until PASS, then next spec)
```

## The filesystem contract

| File | Written by | Read by | Meaning |
|------|-----------|---------|---------|
| `specs/*.md`  | **human** (pre-authored) | Generator + Evaluator | What to build, in order |
| `rubric.md`   | **human** | Evaluator | Hard gates + quality bar, applied to every spec |
| _git branch_  | Generator | Evaluator | The actual changes, committed as it goes |
| `findings.md` | Evaluator | Generator | What's broken; `PASS` on line 1 advances the queue |
| `state/*.done`| driver    | driver    | Completed specs (resume markers) |

`state/` also keeps a copy of each spec's final findings for the morning-after review.

## Branching: stacked branches, one PR per spec

Each spec assumes all earlier ones landed — the order encodes real dependencies
(PDF removal before the markdown-thesis change; the batch runner before SSE→polling).
So the branches are **stacked**: spec N's branch is cut from spec N−1's branch, the
first from `main`:

```
main ── harness/01-pdf-export-print-view ── harness/02-markdown-thesis ── … ── harness/07-small-cuts
```

When a spec PASSes, the driver pushes its branch and opens a PR **based on the
previous spec's branch**, so every PR's diff is exactly that one spec's work.
Review and merge in order (01 → 07); after merging 01 into `main`, GitHub
retargets 02's PR automatically (or retarget manually). Push/PR steps are
best-effort — no remote or no `gh` just downgrades to local branches with a
warning, never kills the run.

A spec that exhausts `MAX_PASSES` **aborts the run** by default rather than
stacking later specs on a broken base. Re-running `run.sh` resumes: done specs are
skipped via `state/*.done`, and an in-progress spec's branch is reused.

## How to run

```bash
# prerequisites: claude CLI on PATH, Docker Desktop running, deps installed
./.harness/run.sh          # run the whole queue (safe to leave overnight)
```

Useful knobs (all env, all optional):

```bash
MAX_PASSES=4               # generator↔evaluator iterations cap PER SPEC
BASE_BRANCH=main           # what the first spec branches off
BRANCH_PREFIX=harness/     # branch names: harness/<spec-name>
GEN_MODEL=fable            # generator model (fable one-shots the builds)
EVAL_MODEL=opus            # evaluator model (preserves fable quota for building)
ONLY_SPEC=04-remove-bullmq-redis.md   # run a single spec (stacks on the existing earlier branches)
CONTINUE_ON_FAIL=1         # don't abort the queue on a failed spec (risky — see above)
NO_PR=1                    # skip push + PR creation; local branches only
PERMISSION_MODE=auto       # claude CLI permission mode for every stage
```

Redo a spec: `rm .harness/state/<spec>.done`, delete its branch (and every branch
stacked on top of it — they contain its commits), and re-run. Revert everything:
`git checkout main && git branch -D harness/01-… harness/02-… …` and close the PRs.

## Permissions & effort (per stage)

| Stage | Model | Effort | Why |
|-------|-------|--------|-----|
| Generator | `fable` | `medium` | Fable one-shots the builds; medium effort keeps quota for the whole queue |
| Evaluator | `opus`  | `high`   | Adversarial judgement — reruns the suites, hunts half-removed features — without burning fable quota on verification |

Both run with `--permission-mode auto` — no `--dangerously-skip-permissions`.

## Evaluation environment

The Evaluator verifies by **re-running everything itself**: `tsc --noEmit` (both
packages), `pnpm test`, `pnpm test:integration` (Testcontainers), `cd web && pnpm
test`, and `pnpm test:e2e` (Playwright with `MOCK_AGENT=true`), plus spec-specific
greps and, where the spec touches UI, driving the running app. `run.sh` warms
`docker compose up -d --build` once at start, but the stages own their environment —
`docker-compose.yml` itself changes mid-run (spec 04 removes Redis), so they rebuild
when needed.

## The stop condition

Per spec: loop up to `MAX_PASSES` (default 4), exit the loop the moment
`findings.md` starts with `PASS`. Whole run: every spec done → the branch holds the
complete simplification, ready for your review and merge. Nothing is merged or
pushed automatically.
