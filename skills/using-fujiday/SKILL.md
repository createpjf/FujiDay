---
name: using-fujiday
description: Use when any request involves uploaded photos, Fujifilm, Fuji, film simulations, recipes, filters, previews, exports, grading, or image-based color decisions.
---

# Using FujiDay

If there is even a small chance the task is about photo grading, Fujifilm looks, previews, exported renders, composition analysis, Alex Webb, layering, crop recommendations, crop exports, or composition-to-Fujifilm handoff, you must use FujiDay skills before responding.

## Priority

1. `routing-color-tasks` or `routing-composition-tasks`
2. `choosing-crop-mode` when the user uploaded an image and needs composition-mode selection
3. `choosing-fujifilm-style` or `choosing-fujifilm-workflow` when the user needs a mandatory selection gate
4. `analyzing-webb-composition`, `exporting-crops`, `chaining-composition-to-fujifilm`, `generating-fujifilm-recipe`, `comparing-color-looks`, or `exporting-color-renders`
5. `validating-composition-results` or `validating-color-results` before returning the final answer

## Non-Negotiable Rules

- Do not silently guess a Fujifilm recipe when the user uploaded an image but has not chosen a style.
- Do not silently guess a crop mode in guided composition flow.
- Do not treat a recipe as magic.
- Do not claim an Alex Webb-like result if the source image lacks layered depth, light tension, or narrative density.
- Do not conflate base Film Simulation behavior with supporting settings.
- Do not claim exact Fujifilm JPEG reproduction for previews or exports.
- Do not fake precise auto-crop output when the provider is `disabled`.

Use `../../docs/architecture.md` if you need the system layout.
