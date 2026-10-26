# Silent Earth — Build history / changelog (spec, DRAFT for Adam's pin pass)

Requirement (Adam, 2026-10-26, for later): the player — maybe Adam himself
while playtesting — must be able to pull up the most recent change and the
most recent 20 changes, with reasons, etc.

## Views (pinned by the requirement)
- Most recent change: one entry, the latest, shown first.
- Most recent 20 changes: list, newest first, capped at 20.
- Each entry carries, at minimum: what changed, WHY (reason), date, and
  merge/build reference (PR number + short merge SHA). Anything beyond
  that (category tags, scope lists, per-landing breakdowns) is TBD for
  Adam's pin pass — do not invent extra fields as settled.

## Source and maintenance (proposed, NOT pinned — Mass Rattle pattern)
- Entries live in code (Systems-owned data module, UI-owned surface),
  one entry per merge batch, prepended as the last WIP commit before the
  merge — the same drill shape Mass Rattle uses for its build history.
- Backfill entry #1 (draft wording, flagged): Merge #1, PR #1,
  2026-10-26, merge edb7006 — "Redesign + MVP + gaps: 3D world, harvest,
  weather, fire, shelter, loom, umbrella, wrangler" — reason: first
  playable 3D MVP batch, built for the Cloudflare try-out. Wording is
  draft until Adam's pin pass.
- This is deliberately distinct from BioForge's 2026-10-14 call ("git
  history is the changelog", CHANGELOG.md deleted). Silent Earth gets
  player-facing history because Adam asked for a pull-up here; do not
  apply the BioForge deletion rule to this game.

## Surface (TBD)
- In-game pull-up (panel/door — exact door location TBD, UI's call,
  flagged). Systems owns the entries data; UI owns the surface;
  Background owns only the merge-drill prepend step.

## Status
- QUEUED for later. Not in Merge #1 (drill closed at edb7006), not
  interrupting the Cloudflare Deploy / playtest. Build on Adam's word
  when its turn comes.
