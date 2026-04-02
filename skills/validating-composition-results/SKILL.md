---
name: validating-composition-results
description: Use before returning any FujiDay composition result to verify mode selection, crop honesty, narrative preservation, and composition result contract completeness.
---

# Validating Composition Results

Review the draft before returning it.

## Checklist

- The chosen composition style is explicit.
- Guided crop flow did not skip crop-mode selection.
- Alex Webb claims are calibrated to the actual source image.
- The crop did not silently erase a key actor or layer without naming the tradeoff.
- `disabled` provider paths do not fake auto-crop precision.
- Export paths are real when export is claimed.
- The response matches `../../skills/shared-assets/composition-result-contract.md`.
