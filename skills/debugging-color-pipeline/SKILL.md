---
name: debugging-color-pipeline
description: Use when FujiDay preview generation, export rendering, image analysis, path handling, or Fujifilm result quality appears broken or inconsistent.
---

# Debugging Color Pipeline

When FujiDay fails, debug in this order:

1. input validation
2. image metadata readability
3. OpenAI vision observation errors
4. preview or export rendering failures
5. style normalization and rule application

## Required Checks

- Confirm `image_path` is absolute and readable.
- Confirm the selected style is a supported Fujifilm style.
- Distinguish `VLM_TIMEOUT`, `VLM_HTTP_ERROR`, `PREVIEW_RENDER_ERROR`, and `EXPORT_RENDER_ERROR`.
- If the result quality is wrong rather than crashing, compare the observation flags against the style-adjustment rules.
