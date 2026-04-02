# FujiDay Architecture

FujiDay has four layers:

1. `skills/`
   Drives agent behavior, routing, selection gating, validation, and authoring rules for both composition and color flows.
2. `runtimes/photo-color-runtime/` and `runtimes/photo-composition-runtime/`
   Execute image validation, multi-provider vision analysis, local heuristic fallback, recipe generation, preview rendering, export rendering, crop recommendation, crop export, and composition-to-color chaining.
3. `style-packs/fujifilm/` and `style-packs/composition/alex-webb/`
   Store structured grading definitions, composition rules, adjustment data, crop mode metadata, and knowledge summaries.
4. `evals/` and `tests/`
   Provide regression checks for contracts, skill coverage, style behavior, crop behavior, and fixture-based evals.

The runtime is intentionally data-driven where possible:

- catalog data defines style defaults and preview presets
- adjustment rules define scene-driven modifications
- crop mode data defines recommendation behavior and default aspect ratios
- command wrappers orchestrate guided flow for users and agents

The observation layer supports five provider modes:

- `openai`
- `openai_compatible`
- `ollama`
- `minimax`
- `disabled`

`disabled` uses local heuristics so FujiDay can still route and grade images without a remote VLM.

`minimax` is implemented through the official MiniMax MCP `understand_image` tool rather than the text-completions API, because the current text API is text-only.

The v1 product line is Fujifilm-first, and composition v1 is Alex Webb-first, but the style-pack boundary is designed so other brand families and composition families can be added later without rewriting the runtime contract.
