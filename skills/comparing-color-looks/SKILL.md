---
name: comparing-color-looks
description: Use when the user wants Fujifilm looks compared, ranked, reconstructed from a mood description, or lightly mutated for new scene conditions.
---

# Comparing Color Looks

Use this skill for comparison, reconstruction, and small mutations.

## What To Compare

- contrast skeleton
- color bias
- best use cases
- failure cases
- compatibility conditions

## Required Behavior

- Prefer top-3 plausible directions when the user gives only a mood description.
- Keep mutation requests small: one or two variable changes.
- If a local image path exists, use `compare_styles()` from `../../runtimes/photo-color-runtime/index.js`.

Load:

- `../../style-packs/fujifilm/knowledge/film-simulation-foundations.md`
- `../../style-packs/fujifilm/knowledge/community-case-patterns.md`
