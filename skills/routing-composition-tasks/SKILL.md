---
name: routing-composition-tasks
description: Use when an uploaded photo or crop request needs to be classified into composition analysis, guided crop flow, direct crop export, composition comparison, or composition-to-Fujifilm chaining.
---

# Routing Composition Tasks

Classify the request before doing composition work.

## Routes

- `analysis`
  The user wants explanation, learning, diagnosis, or Webb fit.
  Next skill: `analyzing-webb-composition`
- `guided_crop`
  The user wants crop advice but has not chosen `balanced`, `narrative`, or `webb_risky`.
  Next skill: `choosing-crop-mode`
- `direct_crop`
  The user explicitly wants the best crop or already named a crop mode.
  Next skill: `exporting-crops`
- `comparison`
  The user wants two crop directions or compositions compared.
  Next skill: `analyzing-webb-composition`
  Compare the requested directions explicitly instead of inventing a new crop mode.
- `compose_fujifilm`
  The user wants Webb-style cropping chained into a Fujifilm render.
  Next skill: `chaining-composition-to-fujifilm`

## Required References

- `../../style-packs/composition/alex-webb/knowledge/source-hierarchy.md`
- `../../style-packs/composition/alex-webb/knowledge/layering-foundations.md`
