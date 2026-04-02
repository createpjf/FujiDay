---
name: exporting-color-renders
description: Use when the user wants FujiDay to write an approximate graded JPG or PNG render to disk.
---

# Exporting Color Renders

Use FujiDay's export path when the user wants a file, not just a recipe.

## Steps

1. Confirm the user chose a Fujifilm style.
2. Call `export_render()` from `../../runtimes/photo-color-runtime/index.js`.
3. Return the exported file path plus the recipe summary that produced it.
4. Remind the user that the exported render is an approximate simulation.

Default export naming should follow the runtime's built-in `<original>.<style-slug>.<ext>` rule unless the user gives an explicit output path.
