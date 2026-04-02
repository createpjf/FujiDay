---
name: generating-fujifilm-recipe
description: Use when the user chose a Fujifilm style or asks for a Fujifilm recipe, preview, or style reconstruction from an image or textual goal.
---

# Generating Fujifilm Recipe

Use FujiDay's runtime and Fujifilm-first reasoning to produce the result.

## Required Sources

Load these before composing the answer:

- `../../style-packs/fujifilm/knowledge/source-hierarchy.md`
- `../../style-packs/fujifilm/knowledge/film-simulation-foundations.md`
- `../../style-packs/fujifilm/knowledge/parameter-grammar.md`
- `../../skills/shared-assets/result-contract.md`

## Required Behavior

- State what the base Film Simulation is doing.
- State what WB, WB shift, highlight, shadow, dynamic range, color, grain, and Color Chrome are doing.
- Use the runtime at `../../runtimes/photo-color-runtime/index.js` when an absolute local image path is available.
- If the user wants to see the effect, set `output_preview=true`.

## Guardrails

- Respect the user's selected Fujifilm style.
- If the style is a weak fit, keep that in `failure_cases`; do not override the user's explicit choice.
- Call the result approximate when previewing.
