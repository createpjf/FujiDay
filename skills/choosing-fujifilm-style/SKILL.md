---
name: choosing-fujifilm-style
description: Use when the user uploaded an image and needs a Fujifilm style menu before recipe generation.
---

# Choosing Fujifilm Style

This skill handles the mandatory gate in FujiDay's default interaction.

## Steps

1. Briefly summarize the image in terms of subject, light, contrast risk, skin-tone importance, and whether monochrome is plausible.
2. Load `../../skills/shared-assets/filter-selection-template.md`.
3. Present the Fujifilm menu.
4. Ask the user to choose one style by name or number.

## Hard Stop

Do not generate a recipe until the user explicitly chooses one style.
