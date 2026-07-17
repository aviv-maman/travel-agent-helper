---
name: milestone-doc-sync
description: >
  Use this skill whenever a milestone, phase, or step in a project has just been finished (e.g. "M1", "M2", "M2a", "Phase 3", "Step 4") — whether the user says so explicitly or it's clear from context (tests now pass, a task list just got fully checked off, a feature described as the milestone's goal is now working). Keeps README.md, ROADMAP.md, CHANGELOG.md, AGENTS.md, and any relevant files in docs/ in sync with actual project state, flipping checkboxes/status markers, adding changelog entries, and updating feature/status sections. Trigger this proactively after completing a chunk of agentic coding work that corresponds to a defined milestone, not just when the user asks "update the docs."
---

# Milestone Doc Sync

Keep a project's documentation trail (README, ROADMAP, CHANGELOG, AGENTS.md, docs/) truthful and current the moment a milestone/phase/step wraps up — so nobody (human or future Claude session) has to reverse-engineer project state from the code.

## When to run this

- The user explicitly says a milestone is done ("M2 is done", "finished Phase 3", "Step 4 complete").
- It's clearly implied: all tasks under a milestone are now checked off, the tests tied to that milestone pass, or the feature that milestone existed to deliver is now working end-to-end.
- Do NOT run this on a guess. If completion is ambiguous (e.g. only some subtasks done, or you're not sure this chunk of work maps to a named milestone), ask the user in one short question rather than updating docs for something that isn't actually finished.

## Workflow

### 1. Pin down what actually finished

Before touching any file, write down for yourself:
- The milestone identifier and name (e.g. `M2a — CSV import`), pulled from ROADMAP.md/AGENTS.md if it already has a naming scheme. Don't invent a new numbering scheme — match whatever convention the project already uses.
- The concrete, user-visible outcome (what now works that didn't before). Base this only on what you can verify from the conversation/repo — passing tests, committed code, checked-off tasks. Never document something as done that you haven't actually seen finished.

### 2. Find the relevant files

Search the repo root and docs/ for (in this priority order, but update whichever actually exist — don't create files that don't exist without asking first):

1. `ROADMAP.md` (or `ROADMAP` / `roadmap.md`)
2. `CHANGELOG.md`
3. `README.md`
4. `AGENTS.md` (or `CLAUDE.md` if that's what the project uses for agent context)
5. Any `.md` file under `docs/` whose content references the component/feature the milestone touched — grep for the feature name or milestone id, don't blindly open every file in docs/.

If none of these exist yet, ask the user once whether to create a minimal ROADMAP.md/CHANGELOG.md rather than assuming.

### 3. Update each file, matching its existing conventions

**ROADMAP.md**
- Find the entry for this milestone. Flip its status marker to done, using whatever marker style the file already uses:
  - `- [ ] M2: ...` → `- [x] M2: ...`
  - `⬜ M2` → `✅ M2`
  - `Status: In Progress` → `Status: Done`
- If the file tracks dates, add today's date next to the completed entry.
- If sub-steps (M2a, M2b, ...) exist and only some are done, only flip the ones actually finished — leave the parent milestone open until all children are done.
- Don't reorder, renumber, or restructure the roadmap. Only touch the entry that changed.

**CHANGELOG.md**
- Match the file's existing format if it has one (many projects follow Keep a Changelog: `## [Unreleased]` → `### Added/Changed/Fixed`). If unsure, look at the last 2-3 entries and mirror their style exactly.
- Add a concise, factual entry describing the user-visible change — not an internal description of the milestone label. "Added CSV import for bulk contact upload" not "Completed M2a."
- Don't bump a version number or create a release section unless the user's existing pattern does that per-milestone; when in doubt, add under `Unreleased`.

**README.md**
- Only touch this if the milestone changed something README-visible: a features list, a "status/progress" section, a setup/usage instruction, a badge. Don't touch README for purely internal/refactor milestones.
- Update feature lists or status tables in place. Keep the surrounding tone and formatting consistent with the rest of the doc.

**AGENTS.md / CLAUDE.md**
- This is the one most future Claude sessions will read first — keep its "current state" section accurate. Update whatever section describes what's built vs. pending, so a fresh session doesn't re-do finished work or assume unfinished work is done.
- If it has a "known issues" or "next up" list, remove items this milestone resolved and add newly-surfaced follow-ups only if the user actually mentioned them — don't speculate about future work.

**docs/**
- Update only files whose content is now stale or incomplete because of this milestone (an API doc missing the new endpoint, a setup guide missing a new required step, an architecture doc describing the old approach). Skip unrelated docs.

### 4. Don't overwrite, don't invent

- Preserve each file's voice, heading structure, and formatting conventions. This is a sync operation, not a rewrite.
- Never mark something as done that isn't, never describe a feature more expansively than what was actually built, and never fabricate metrics, dates, or version numbers you weren't given.
- If a file's existing content already contradicts what you're about to write (e.g. ROADMAP says M2 depends on something not yet done), flag that to the user instead of silently "fixing" it.

### 5. Summarize

After editing, give the user a short, concrete summary of what changed in each file — not a re-explanation of the milestone. E.g.:

> Updated:
> - `ROADMAP.md` — marked M2a done
> - `CHANGELOG.md` — added entry under Unreleased
> - `AGENTS.md` — updated "current state" section
> - `README.md` — no change needed (internal-only milestone)

Don't ask "should I update the docs?" after the fact — do the update, then report what was done. Only ask beforehand if completion status itself was ambiguous (see step 1).
