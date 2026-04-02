---
name: writing-composition-style-packs
description: Use when adding a new composition family, extending FujiDay beyond Alex Webb, or editing composition catalog, crop-mode, scoring, and guardrail data.
---

# Writing Composition Style Packs

Composition packs are data-first and rubric-first.

## Required Files

- `../../style-packs/composition/<style>/catalog.json`
- `../../style-packs/composition/<style>/crop-modes.json`
- `../../style-packs/composition/<style>/scoring-rules.json`
- `../../style-packs/composition/<style>/knowledge/`

## Requirements

- Define stable aliases and supported crop modes.
- Keep mode ranking and recommendation logic rule-based.
- Separate definition-layer knowledge from crop heuristics.
- Add tests for mode ranking, crop recommendation, and export behavior.
