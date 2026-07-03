#!/usr/bin/env bash
#
# The harness driver: for each spec in .harness/specs/ (lexical order), loop
# [ Generator → Evaluator ] until the Evaluator writes PASS or MAX_PASSES is hit.
# Each stage is a fresh `claude -p` process. Stages share state only via files
# (the spec, findings.md) and the git branch. There is no Planner — the specs
# are pre-written.
#
# Branching model: STACKED. Each spec gets its own branch, based on the previous
# spec's branch (the first on BASE_BRANCH):
#
#   main ── harness/01-… ── harness/02-… ── … ── harness/07-…
#
# When a spec PASSes, its branch is pushed and a PR is opened whose base is the
# PREVIOUS spec's branch — so every PR's diff is exactly that one spec's work.
# Review/merge order: 01 first, then retarget or let GitHub auto-retarget the rest.
#
# Specs are CUMULATIVE and ORDERED: each assumes all earlier specs have landed.
# A completed spec leaves a marker in .harness/state/, so re-running this script
# resumes where it left off. A failed spec aborts the run by default
# (CONTINUE_ON_FAIL=1 to override — later specs would build on a broken base).
#
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Keep the Mac awake for the whole run; ties caffeinate's lifetime to this PID.
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -dimsu -w "$$" &
fi

# ── Config (all overridable via env) ─────────────────────────────────────────
MAX_PASSES="${MAX_PASSES:-4}"          # generator↔evaluator iterations cap PER SPEC
BASE_BRANCH="${BASE_BRANCH:-main}"     # the first spec branches off this
BRANCH_PREFIX="${BRANCH_PREFIX:-harness/}"
MODEL="${MODEL:-}"                     # e.g. claude-opus-4-8 ; empty = CLI default
CONTINUE_ON_FAIL="${CONTINUE_ON_FAIL:-0}"
PERMISSION_MODE="${PERMISSION_MODE:-auto}"
ONLY_SPEC="${ONLY_SPEC:-}"             # run a single spec by filename, e.g. 04-remove-bullmq-redis.md
NO_PR="${NO_PR:-0}"                    # 1 = skip push + PR creation (local branches only)

SPECS_DIR="$HARNESS_DIR/specs"
STATE_DIR="$HARNESS_DIR/state"
FINDINGS="$HARNESS_DIR/findings.md"
mkdir -p "$STATE_DIR"

CLAUDE_FLAGS=(--permission-mode "$PERMISSION_MODE")
[ -n "$MODEL" ] && CLAUDE_FLAGS+=(--model "$MODEL")

RUN_START=$(date +%s)
ts() { date +%H:%M:%S; }
fmt_dur() { printf '%dm %02ds' $(( $1 / 60 )) $(( $1 % 60 )); }
say() { printf '\n\033[1m[%s] === %s ===\033[0m\n' "$(ts)" "$*"; }
warn() { printf '\033[33m[%s] WARN: %s\033[0m\n' "$(ts)" "$*"; }

run_timed() {
  local label="$1"; shift
  say "$label"
  local t0 rc=0
  t0=$(date +%s)
  "$@" || rc=$?
  printf '\033[1m[%s] └─ %s took %s\033[0m\n' "$(ts)" "$label" "$(fmt_dur $(( $(date +%s) - t0 )))"
  return "$rc"
}

print_total() { printf '\n\033[1m[%s] total elapsed: %s\033[0m\n' "$(ts)" "$(fmt_dur $(( $(date +%s) - RUN_START )))"; }
trap 'print_total' EXIT
trap 'exit 130' INT TERM

# ── Preflight ─────────────────────────────────────────────────────────────────
git rev-parse --verify "$BASE_BRANCH" >/dev/null 2>&1 \
  || { echo "Base branch '$BASE_BRANCH' not found — aborting."; exit 1; }

if [ "$NO_PR" != "1" ]; then
  if ! git remote get-url origin >/dev/null 2>&1; then
    warn "no 'origin' remote — PRs can't be created. Continuing with local branches only (set NO_PR=1 to silence)."
    NO_PR=1
  elif ! command -v gh >/dev/null 2>&1; then
    warn "'gh' CLI not found — PRs can't be created. Continuing with local branches only."
    NO_PR=1
  fi
fi

# ── Environment: Docker services for integration/e2e evaluation ──────────────
# Best-effort. The Generator/Evaluator manage their own servers (they have full
# bash) — this just warms the common case. docker-compose.yml changes mid-run
# (spec 04 removes Redis), so the roles re-run `docker compose up -d --build`
# themselves whenever it matters.
if command -v docker >/dev/null 2>&1; then
  say "docker compose up -d --build (best-effort warm-up)"
  docker compose up -d --build || echo "docker compose failed — the roles will handle it per-pass"
fi

# ── Push + PR (best-effort: never fails the run) ─────────────────────────────
open_pr() {
  local branch="$1" base="$2" spec_file="$3"
  local name title
  name="$(basename "$spec_file" .md)"
  title="$(grep -m1 '^# ' "$spec_file" | sed 's/^# *//')"
  [ -n "$title" ] || title="$name"

  [ "$NO_PR" = "1" ] && { echo "NO_PR=1 — skipping push/PR for $branch"; return 0; }

  git push -u origin "$branch" || { warn "push failed for $branch — PR skipped (push manually later)"; return 0; }

  # Idempotent: don't open a second PR for the same head branch on re-runs.
  if [ -n "$(gh pr list --head "$branch" --state all --json number --jq '.[].number' 2>/dev/null)" ]; then
    echo "PR already exists for $branch — skipping creation."
    return 0
  fi

  local body
  body="$(printf '%s\n' \
    "Implements \`.harness/specs/$(basename "$spec_file")\` — part of the automated simplification programme." \
    "" \
    "**Stacked PR:** based on \`$base\` — review/merge in spec order (01 → 07). This diff contains only this spec's changes." \
    "" \
    "Evaluator verdict (final pass):" \
    '```' \
    "$(head -20 "$STATE_DIR/$name.findings.md" 2>/dev/null || echo "see .harness/state/$name.findings.md")" \
    '```' \
    "" \
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)")"

  gh pr create --head "$branch" --base "$base" --title "$title" --body "$body" \
    || warn "gh pr create failed for $branch — create it manually (base: $base)"
}

# ── The spec loop ─────────────────────────────────────────────────────────────
shopt -s nullglob
SPECS=("$SPECS_DIR"/*.md)
[ ${#SPECS[@]} -gt 0 ] || { echo "No specs in $SPECS_DIR — nothing to do."; exit 1; }

prev_branch="$BASE_BRANCH"

for spec in "${SPECS[@]}"; do
  name="$(basename "$spec" .md)"
  branch="${BRANCH_PREFIX}${name}"
  done_marker="$STATE_DIR/$name.done"

  # ONLY_SPEC still needs the earlier branches as the stack's base — skip the
  # work but keep threading prev_branch through completed specs.
  if [ -n "$ONLY_SPEC" ] && [ "$(basename "$spec")" != "$ONLY_SPEC" ]; then
    git rev-parse --verify "$branch" >/dev/null 2>&1 && prev_branch="$branch"
    continue
  fi

  if [ -f "$done_marker" ]; then
    say "SPEC $name — already done (rm $done_marker to redo)"
    git rev-parse --verify "$branch" >/dev/null 2>&1 \
      && prev_branch="$branch" \
      || warn "$branch missing despite done marker — next spec will stack on '$prev_branch'"
    continue
  fi

  say "SPEC $name — starting on branch $branch (stacked on $prev_branch)"
  # Resume-friendly: reuse the branch if an earlier attempt created it,
  # otherwise cut it fresh from the previous spec's branch.
  if git rev-parse --verify "$branch" >/dev/null 2>&1; then
    git checkout "$branch"
  else
    git checkout -b "$branch" "$prev_branch"
  fi

  rm -f "$FINDINGS"
  spec_ok=0

  for pass in $(seq 1 "$MAX_PASSES"); do
    run_timed "GENERATOR  ($name, pass $pass/$MAX_PASSES)" \
      claude -p "$(cat "$HARNESS_DIR/generator.md")

---
The spec for this run is: \`$spec\` — read it now." \
      --effort medium \
      "${CLAUDE_FLAGS[@]}"

    run_timed "EVALUATOR  ($name, pass $pass/$MAX_PASSES)" \
      claude -p "$(cat "$HARNESS_DIR/evaluator.md")

---
The spec for this run is: \`$spec\` — read it now." \
      --effort high \
      "${CLAUDE_FLAGS[@]}"

    if [ -f "$FINDINGS" ] && head -1 "$FINDINGS" | grep -q '^PASS'; then
      say "SPEC $name — PASS on pass $pass"
      date -u +"%Y-%m-%dT%H:%M:%SZ" > "$done_marker"
      cp "$FINDINGS" "$STATE_DIR/$name.findings.md" 2>/dev/null || true
      spec_ok=1
      break
    fi
    say "SPEC $name — pass $pass produced findings, looping back to the Generator"
  done

  if [ "$spec_ok" = "1" ]; then
    run_timed "PR  ($branch → $prev_branch)" open_pr "$branch" "$prev_branch" "$spec"
    prev_branch="$branch"
  else
    cp "$FINDINGS" "$STATE_DIR/$name.FAILED.findings.md" 2>/dev/null || true
    say "SPEC $name — hit MAX_PASSES ($MAX_PASSES) without a PASS"
    if [ "$CONTINUE_ON_FAIL" = "1" ]; then
      warn "CONTINUE_ON_FAIL=1 — stacking the next spec on this UNVERIFIED branch"
      prev_branch="$branch"
    else
      echo "Aborting: later specs stack on this one. Review $FINDINGS and branch '$branch',"
      echo "then re-run — completed specs are skipped via $STATE_DIR/*.done markers."
      exit 1
    fi
  fi
done

say "All specs complete. Stacked PRs are open (or branches ready) — review in order 01 → 07."
