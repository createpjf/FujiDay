---
name: exporting-crops
description: Use when the user wants an actual cropped image file exported from FujiDay using balanced, narrative, or webb_risky composition modes.
---

# Exporting Crops

This skill is runtime-backed.

## Steps

1. Confirm the image has an absolute local path.
2. Confirm the crop mode:
   - `balanced`
   - `narrative`
   - `webb_risky`
3. Call the composition runtime export path.
4. Return the real exported file path.

## Hard Stops

- If there is no absolute local image path, do not pretend an export happened.
- If the provider is `disabled`, do not fake precise crop output.
