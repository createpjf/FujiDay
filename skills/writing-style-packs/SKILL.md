---
name: writing-style-packs
description: Use when adding a new style family, extending FujiDay beyond Fujifilm, or editing catalog and adjustment-rule data for a style pack.
---

# Writing Style Packs

Style packs are data-first, not vibe-first.

## Required Files

- `../../style-packs/<family>/catalog.json`
- `../../style-packs/<family>/adjustment-rules.json`
- `../../style-packs/<family>/knowledge/`

## Requirements

- Define stable aliases and default recipes.
- Keep scene adjustments rule-based.
- Add compatibility notes.
- Add tests for ranking, recipe generation, and export behavior.
- Run `build-style-pack` after changes.
