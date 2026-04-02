---
name: using-fujiday
description: Use when any request involves uploaded photos, Fujifilm, Fuji, film simulations, recipes, filters, previews, exports, grading, or image-based color decisions.
---

# Using FujiDay

If there is even a small chance the task is about photo grading, Fujifilm looks, previews, recipe generation, or exported renders, you must use FujiDay skills before responding.

## Priority

1. `routing-color-tasks`
2. `choosing-fujifilm-style` when the user uploaded an image but did not choose a style
3. `generating-fujifilm-recipe`, `comparing-color-looks`, or `exporting-color-renders`
4. `validating-color-results` before returning the final answer

## Non-Negotiable Rules

- Do not silently guess a Fujifilm recipe when the user uploaded an image but has not chosen a style.
- Do not treat a recipe as magic.
- Do not conflate base Film Simulation behavior with supporting settings.
- Do not claim exact Fujifilm JPEG reproduction for previews or exports.

Use `../../docs/architecture.md` if you need the system layout.
