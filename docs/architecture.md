# FujiDay Architecture

FujiDay has four layers:

1. `skills/`
   Drives agent behavior, routing, selection gating, validation, and authoring rules.
2. `runtimes/photo-color-runtime/`
   Executes image validation, multi-provider vision analysis, local heuristic fallback, recipe generation, preview rendering, export rendering, and comparisons.
3. `style-packs/fujifilm/`
   Stores structured style definitions, adjustment rules, and knowledge summaries.
4. `evals/` and `tests/`
   Provide regression checks for contracts, skill coverage, style behavior, and fixture-based evals.

The runtime is intentionally data-driven where possible:

- catalog data defines style defaults and preview presets
- adjustment rules define scene-driven modifications
- command wrappers orchestrate guided flow for users and agents

The observation layer supports four provider modes:

- `openai`
- `openai_compatible`
- `ollama`
- `disabled`

`disabled` uses local heuristics so FujiDay can still route and grade images without a remote VLM.

The v1 product line is Fujifilm-first, but the style-pack boundary is designed so other brand families can be added later without rewriting the runtime contract.
