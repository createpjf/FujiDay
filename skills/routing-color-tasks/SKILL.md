---
name: routing-color-tasks
description: Use when a Fujifilm or photo-grading request needs to be classified into guided image flow, direct recipe flow, comparison, mutation, workflow selection, or export.
---

# Routing Color Tasks

Classify the request before doing any grading work.

## Routes

- `guided_image_flow`
  User uploaded an image but did not choose a Fujifilm style yet.
  Next skill: `choosing-fujifilm-style`
- `direct_recipe_flow`
  User already named a Fujifilm style or requested a direct recipe.
  Next skill: `generating-fujifilm-recipe`
- `comparison`
  User wants multiple looks compared or ranked.
  Next skill: `comparing-color-looks`
- `mutation`
  User wants small recipe changes for new lighting or subject needs.
  Next skill: `generating-fujifilm-recipe`
  Keep the user's chosen style fixed and mutate only the settings the request actually calls for.
- `workflow_selection`
  User wants to know whether to use bracketing, custom settings, or X RAW STUDIO.
  Next skill: `choosing-fujifilm-workflow`
- `export`
  User wants a rendered JPG or PNG, not just a recipe.
  Next skill: `exporting-color-renders`

## Required Reference

Load `../../style-packs/fujifilm/knowledge/source-hierarchy.md` before reasoning about Fujifilm semantics.
