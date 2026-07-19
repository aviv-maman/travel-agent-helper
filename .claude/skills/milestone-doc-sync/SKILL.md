---
name: milestone-doc-sync
description: >
  Use this skill at two moments. (1) BEFORE opening any feature PR: sweep README.md, ROADMAP.md, AGENTS.md, and docs/ for anything the diff makes stale (API contracts, endpoint/feature tables, commands, env vars, runbooks) and fix it in the SAME branch — a code change with a stale doc is an incomplete PR. (2) Whenever a milestone, phase, or step has just been finished (e.g. "M1", "M2a", "Phase 3") — whether the user says so explicitly or it's clear from context (tests now pass, a task list just got fully checked off, the feature the milestone existed to deliver is working). Then sync the milestone RECORD: flip checkboxes/status markers, add changelog entries, record dates/PR numbers/verification results. The skill CREATES missing docs as well as updating existing ones: a new surface with no home doc (an API without a contract doc, a job without a runbook, a repo without ROADMAP/CHANGELOG) gets a minimal one rather than staying undocumented. Trigger both proactively, not just when the user asks "update the docs."
---

# Milestone Doc Sync

Keep a project's documentation trail (README, ROADMAP, CHANGELOG, AGENTS.md, docs/) truthful and current — so nobody (human or future Claude session) has to reverse-engineer project state from the code.

## The two layers — and why they ship at different moments

Docs fall into two layers with different truth conditions, and each belongs in a different place:

1. **Reference docs** describe *what the code does*: API contracts, README endpoint/feature tables, setup and run commands, env-var lists, operations runbooks, architecture notes. The moment a diff changes behavior, these are stale — so they ride **the same PR** as the code. Never let them trail in a follow-up: between the feature merge and a follow-up doc PR, the main branch lies about itself, reviewers can't judge the change against its contract, and (if CI is heavy) the doc-only PR burns a full CI run to change two markdown files.
2. **Record docs** describe *what happened*: roadmap status flips, completion dates, changelog entries, PR numbers, "CI green", "verified live in production", backfill/metric outcomes, cross-repo status files. These are facts that only exist **after** the merge — writing "merged and verified" inside the still-open PR would be documenting the future. They land in a small **post-merge sync** (one commit or one tiny PR per repo; workspace-level files outside any repo are edited directly).

Rule of thumb: if a sentence could be proven wrong by reading the diff, it's reference — write it in the PR. If it could only be proven wrong by watching what happened after the merge, it's record — write it after.

## When to run this

- **Pre-PR (reference layer):** you're about to open a PR that changes behavior — endpoints, schemas, commands, config, workflows, user-visible features.
- **Post-merge (record layer):** the user says a milestone is done ("M2 is done", "finished Phase 3"), or it's clearly implied: all tasks under a milestone are checked off, the tests tied to it pass, or the feature it existed to deliver now works end-to-end — and the PRs are merged.
- Do NOT run the record layer on a guess. If completion is ambiguous (only some subtasks done, or you're not sure this chunk of work maps to a named milestone), ask the user in one short question rather than updating docs for something that isn't actually finished.

## Workflow — pre-PR sweep (reference layer)

Before opening the PR, on the feature branch:

1. List what the diff changed in behavior terms: new/changed endpoints or fields, new commands/jobs, new env vars or settings, changed workflows/schedules, new user-visible features.
2. Grep README.md and docs/ for each of those names/areas. Anything the diff made stale or incomplete gets fixed **in the same branch**: the API-contract doc gains the new endpoint with its real (implemented) shapes, the README's feature/endpoint/command tables gain the new rows, the runbook gains the new job or schedule.
3. **Create what's missing, don't just patch what exists.** If the change introduces a surface with no home doc — a first API without a contract doc, a first scheduled job without a runbook, a new subsystem nothing in docs/ describes — create a minimal, focused doc for it in the same branch. Match the project's existing doc style and location (usually `docs/`); write only what the code actually does, sized to the surface (a one-endpoint contract is a short file, not a template dump). Prefer extending an existing doc over creating a near-duplicate one.
4. Don't write the milestone record here — no status flips, no "verified/merged/deployed" claims, no dates. Those aren't true yet.
5. Treat a missing doc update the way you'd treat a missing test: the PR isn't ready until the sweep is clean.

## Workflow — post-merge sync (record layer)

### 1. Pin down what actually finished

Before touching any file, write down for yourself:
- The milestone identifier and name (e.g. `M2a — CSV import`), pulled from ROADMAP.md/AGENTS.md if it already has a naming scheme. Don't invent a new numbering scheme — match whatever convention the project already uses.
- The concrete, user-visible outcome (what now works that didn't before), plus the record facts worth keeping: PR numbers, merge date, how it was verified (CI conclusion, live checks, key metrics). Base this only on what you can verify — passing tests, merged code, checked-off tasks. Never document something as done that you haven't actually seen finished.

### 2. Find the relevant files

Search the repo root and docs/ for (in this priority order):

1. `ROADMAP.md` (or `ROADMAP` / `roadmap.md`)
2. `CHANGELOG.md`
3. `README.md`
4. `AGENTS.md` (or `CLAUDE.md` if that's what the project uses for agent context)
5. Any `.md` file under `docs/` whose content references the component/feature the milestone touched — grep for the feature name or milestone id, don't blindly open every file in docs/.
6. Any workspace-level status file outside the repo (e.g. a root `PLAN.md` in a multi-repo workspace) — edit it directly; it can't ride any repo's PR.

**Create what's missing.** This applies to every tier above, `docs/` included:

- If the project has milestones but no ROADMAP.md, or shipped changes but no CHANGELOG.md, create a minimal one now and seed it with what you can verify (current milestone state, this milestone's entry) — never a speculative future plan.
- If the milestone shipped a subsystem, contract, or job that nothing under `docs/` describes and the feature PR didn't create its doc, create it now (same rules as the pre-PR sweep: minimal, focused, matching the project's doc style and location, sized to the surface).

Match the project's tone; keep new files small enough that they stay maintained. Only skip creation if the project clearly tracks the same information somewhere else already (a PLAN.md, a docs/roadmap.md) — one home per fact, no duplicates.

If the pre-PR sweep was done, most reference content is already current — the post-merge pass should be mostly status and record. If you find reference docs the feature PR missed (stale *or* absent), fix or create them now and note the miss; next time they belong in the PR.

### 3. Update each file, matching its existing conventions

**ROADMAP.md**
- Find the entry for this milestone. Flip its status marker to done, using whatever marker style the file already uses:
  - `- [ ] M2: ...` → `- [x] M2: ...`
  - `⬜ M2` → `✅ M2`
  - `Status: In Progress` → `Status: Done`
- If the file tracks dates, add today's date next to the completed entry. If the project records PR numbers or verification outcomes in roadmap entries, include them.
- If sub-steps (M2a, M2b, ...) exist and only some are done, only flip the ones actually finished — leave the parent milestone open until all children are done.
- Don't reorder, renumber, or restructure the roadmap. Only touch the entry that changed.

**CHANGELOG.md**
- Match the file's existing format if it has one (many projects follow Keep a Changelog: `## [Unreleased]` → `### Added/Changed/Fixed`). If unsure, look at the last 2-3 entries and mirror their style exactly.
- Add a concise, factual entry describing the user-visible change — not an internal description of the milestone label. "Added CSV import for bulk contact upload" not "Completed M2a."
- Don't bump a version number or create a release section unless the user's existing pattern does that per-milestone; when in doubt, add under `Unreleased`.

**README.md**
- Only touch this if the milestone changed something README-visible that the feature PR didn't already cover: a "status/progress" section, a badge. (Feature lists and endpoint/command tables should already be current from the pre-PR sweep.) Don't touch README for purely internal/refactor milestones.
- Update in place. Keep the surrounding tone and formatting consistent with the rest of the doc.

**AGENTS.md / CLAUDE.md**
- This is the one most future Claude sessions will read first — keep its "current state" section accurate. Update whatever section describes what's built vs. pending, so a fresh session doesn't re-do finished work or assume unfinished work is done.
- If it has a "known issues" or "next up" list, remove items this milestone resolved and add newly-surfaced follow-ups only if the user actually mentioned them — don't speculate about future work.

**docs/**
- Update files whose content is now stale or incomplete because of this milestone and wasn't handled in the feature PR; create the missing doc when the milestone's surface has no home there (see "Create what's missing" above). Skip unrelated docs.

### 4. Ship it small

- One commit (or one tiny PR, if the project's rules require PRs) per repo, doc-only, clearly labeled (e.g. `docs: M2a sync`). Don't bundle unrelated edits into it.
- If the project's CI runs expensive suites on every PR, prefer folding reference docs into feature PRs (the pre-PR sweep does this) and keep the post-merge sync as small and rare as possible — or suggest a CI paths filter for doc-only changes, once, if the user hasn't decided that themselves.

### 5. Don't overwrite, don't invent

- Preserve each file's voice, heading structure, and formatting conventions. This is a sync operation, not a rewrite.
- Never mark something as done that isn't, never describe a feature more expansively than what was actually built, and never fabricate metrics, dates, or version numbers you weren't given.
- If a file's existing content already contradicts what you're about to write (e.g. ROADMAP says M2 depends on something not yet done), flag that to the user instead of silently "fixing" it.

### 6. Summarize

After editing, give the user a short, concrete summary of what changed in each file — not a re-explanation of the milestone. E.g.:

> Updated:
> - `ROADMAP.md` — marked M2a done
> - `CHANGELOG.md` — added entry under Unreleased
> - `AGENTS.md` — updated "current state" section
> - `README.md` — no change needed (internal-only milestone)

Don't ask "should I update the docs?" after the fact — do the update, then report what was done. Only ask beforehand if completion status itself was ambiguous (see step 1).
