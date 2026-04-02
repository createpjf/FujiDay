---
name: routing-color-tasks
description: Use when a Fujifilm or photo-grading request needs to be classified into guided image flow, direct recipe flow, comparison, mutation, workflow selection, or export.
---

# Routing Color Tasks

Classify the request before doing any grading work.

## Routes

- `guided_image_flow`
  User uploaded an image but did not choose a Fujifilm style yet.
- `direct_recipe_flow`
  User already named a Fujifilm style or requested a direct recipe.
- `comparison`
  User wants multiple looks compared or ranked.
- `mutation`
  User wants small recipe changes for new lighting or subject needs.
- `workflow_selection`
  User wants to know whether to use bracketing, custom settings, or X RAW STUDIO.
- `export`
  User wants a rendered JPG or PNG, not just a recipe.

## Required Reference

Load `../../style-packs/fujifilm/knowledge/source-hierarchy.md` before reasoning about Fujifilm semantics.
