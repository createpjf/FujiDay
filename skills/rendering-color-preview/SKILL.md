---
name: rendering-color-preview
description: Use when the user wants to preview a Fujifilm look on the image before or alongside recipe delivery.
---

# Rendering Color Preview

Use the runtime to generate an approximate preview.

## Steps

1. Call FujiDay's recipe-generation runtime with `output_preview=true`.
2. Return the preview image data URI if the platform can render it.
3. Always explain that the preview is approximate and not camera-exact.

Use `../../runtimes/photo-color-runtime/index.js` and keep the preview disclaimer explicit.
