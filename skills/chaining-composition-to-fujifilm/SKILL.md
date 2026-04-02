---
name: chaining-composition-to-fujifilm
description: Use when the user wants Alex Webb-style cropping chained into a Fujifilm recommendation or final Fujifilm export.
---

# Chaining Composition to Fujifilm

This skill runs a two-stage chain:

1. composition analysis and crop selection
2. cropped-image Fujifilm recommendation or export

## Rules

- Fujifilm recommendations must be based on the cropped image, not the original frame.
- If the user did not choose a Fujifilm style, return the recommended Fujifilm options and wait for confirmation.
- If the user already named a Fujifilm style, go straight to final export.
- Keep the composition result and grading result distinct in the final response.
