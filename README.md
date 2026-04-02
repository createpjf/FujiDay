# FujiDay

FujiDay is a Fujifilm-first agentic grading and composition system for Codex and Claude-style coding agents. It packages a reusable skills library, local photo runtimes, structured style packs, command-line entry points, and regression checks for recipe generation, previews, composition analysis, crop exports, and chained final renders.

It is intentionally conservative about what it claims. FujiDay can analyze an image, guide a user through Fujifilm style selection, generate a structured recipe, render an approximate preview, and export an approximate graded image. It does not claim to reproduce Fujifilm's in-camera JPEG engine exactly.

## How It Works

FujiDay starts from the moment an agent sees an image-based grading request. Instead of jumping straight into a recipe, it routes the task, decides whether the user already chose a style, and only shows a Fujifilm menu when that choice is still missing.

Once a style is selected, FujiDay separates the base Film Simulation from the supporting settings that shape white balance, contrast, saturation, dynamic range, and texture. If a preview is requested, it renders an approximate version of the look. If a file export is requested, it writes an approximate graded JPG or PNG to disk.

The whole system is organized as a bundle: skills drive behavior, the runtimes execute analysis and rendering, and the style packs store Fujifilm-specific grading rules plus composition-specific crop heuristics.

## Installation

FujiDay currently documents three real entry points:

### Codex

Clone the repository, install dependencies, and expose the entire FujiDay bundle to native skill discovery:

```bash
git clone https://github.com/<owner>/FujiDay.git ~/.codex/FujiDay
cd ~/.codex/FujiDay
npm install
mkdir -p ~/.agents/skills
ln -s ~/.codex/FujiDay ~/.agents/skills/fujiday
```

Restart Codex after installation.

Detailed Codex notes: [docs/README.codex.md](./docs/README.codex.md)

### Claude

FujiDay ships a local Claude-facing plugin manifest plus the same shared runtime and skills bundle. Clone the repository, install dependencies, and point your Claude environment at the repository root so it can read:

- `skills/`
- `runtimes/`
- `.claude-plugin/plugin.json`

Detailed Claude notes: [docs/README.claude.md](./docs/README.claude.md)

### Local Development

```bash
git clone https://github.com/<owner>/FujiDay.git
cd FujiDay
npm install
```

## Quick Start

### Agent-style interaction

Typical guided flow:

1. User uploads an image.
2. The agent analyzes the scene briefly.
3. The agent shows Fujifilm options such as `ASTIA / Soft`, `Classic Chrome`, or `ETERNA`.
4. The user chooses one style by name or by menu number.
5. FujiDay returns a recipe and, if requested, a preview or export path.

Typical composition flow:

1. User uploads an image and asks for composition analysis or cropping.
2. FujiDay analyzes Alex Webb fit, layering, and crop candidates.
3. If no crop mode was chosen yet, FujiDay returns `selection_required` with `balanced`, `narrative`, and `webb_risky`.
4. Once the crop mode is selected, FujiDay can export a crop or continue into a Fujifilm render.

### CLI

Show the guided style menu for an image:

```bash
grade-fujifilm --image /absolute/path/to/photo.jpg
```

Generate a recipe directly:

```bash
grade-fujifilm --image /absolute/path/to/photo.jpg --style "Classic Chrome" --preview
```

Export an approximate graded render:

```bash
export-fujifilm --image /absolute/path/to/photo.jpg --style "ETERNA" --output /absolute/path/to/output.jpg
```

Analyze Alex Webb-like composition:

```bash
analyze-composition --image /absolute/path/to/photo.jpg
```

Export a composition crop:

```bash
export-crop --image /absolute/path/to/photo.jpg --mode narrative
```

Show the crop-mode selection step first:

```bash
export-crop --image /absolute/path/to/photo.jpg
```

Chain Webb-style cropping into a Fujifilm final render:

```bash
compose-fujifilm --image /absolute/path/to/photo.jpg --mode balanced --fujifilm-style "Classic Chrome"
```

Show the Fujifilm style-selection step after cropping:

```bash
compose-fujifilm --image /absolute/path/to/photo.jpg --mode balanced
```

### Node Runtime

```js
const fujiday = require('./index.js');

async function run() {
  const result = await fujiday.generate_recipe({
    image_path: '/absolute/path/to/photo.jpg',
    selected_style: 'Classic Chrome',
    output_preview: true
  });

  console.log(result);
}

run();
```

## What's Inside

### Skills

FujiDay ships a multi-skill bundle rather than a single monolithic prompt. The skills cover:

- task routing
- composition routing
- crop-mode selection
- Webb composition analysis
- crop export
- composition-to-Fujifilm chaining
- guided Fujifilm style selection
- Fujifilm workflow selection
- recipe generation
- preview rendering
- export workflows
- look comparison
- debugging and result validation
- style-pack authoring

### Runtime

The runtimes expose these public functions:

- `analyze_image`
- `list_styles`
- `generate_recipe`
- `export_render`
- `compare_styles`
- `execute`
- `analyze_composition`
- `list_crop_modes`
- `recommend_crop`
- `export_crop`
- `compose_fujifilm`

### Style Packs

The bundled Fujifilm style pack currently covers:

- `PROVIA / Standard`
- `Velvia / Vivid`
- `ASTIA / Soft`
- `Classic Chrome`
- `Classic Neg.`
- `ETERNA`
- `ACROS`

The bundled composition family currently covers:

- `alex-webb`

### Commands

FujiDay includes these CLI entry points:

- `grade-fujifilm`
- `compare-fujifilm`
- `export-fujifilm`
- `build-style-pack`
- `analyze-composition`
- `export-crop`
- `compose-fujifilm`

Behavior notes:

- `grade-fujifilm --image ...` returns a style-selection menu when `--style` is omitted.
- `export-crop --image ...` and `compose-fujifilm --image ...` return crop-mode selection when `--mode` is omitted and a VLM-capable provider is available.
- If the active provider is `disabled`, composition analysis still works, but crop export and composition-to-Fujifilm export return `VLM_REQUIRED_FOR_CROP_EXPORT` instead of offering a dead-end selection flow.
- `compare-fujifilm` returns `INPUT_ERROR` when a requested style name is unknown.

### Evals

FujiDay includes fixture and pressure-test scaffolding for:

- runtime contract regressions
- skill bundle coverage
- style-pack validation
- 30-scene eval manifests
- composition-manifest and crop-pressure scaffolding

## Vision Providers

FujiDay supports five image-observation modes:

- `openai`
  Uses OpenAI Chat Completions with image input.
- `openai_compatible`
  Uses an OpenAI-compatible `/v1/chat/completions` endpoint.
- `ollama`
  Uses a local Ollama server through `/api/chat`.
- `minimax`
  Uses MiniMax's official `understand_image` MCP tool. This is intentionally separate from MiniMax's text API, which does not currently accept image input.
- `disabled`
  Skips remote vision and falls back to local heuristic analysis.

If no provider is configured, FujiDay defaults to:

- `openai` when `OPENAI_API_KEY` or `FUJIDAY_VLM_API_KEY` is available
- `minimax` when `MINIMAX_API_KEY` or `FUJIDAY_MINIMAX_API_KEY` is available and no OpenAI or generic FujiDay VLM settings are present
- otherwise `disabled`

MiniMax provider notes:

- `MINIMAX_API_KEY` or `FUJIDAY_MINIMAX_API_KEY` authenticates MiniMax MCP requests.
- `MINIMAX_API_HOST` defaults to `https://api.minimax.io`.
- `FUJIDAY_MINIMAX_MCP_COMMAND` defaults to `uvx`.
- `FUJIDAY_MINIMAX_MCP_ARGS` defaults to `["minimax-coding-plan-mcp", "-y"]`.
- `MINIMAX_MCP_BASE_PATH` defaults to the system temp directory.

`disabled` provider notes:

- `analyze_image` and `analyze_composition` still return heuristic observations.
- `generate_recipe` and `compare_styles` still work in heuristic mode.
- `export-crop` and `compose-fujifilm` require a VLM-capable provider because FujiDay does not fake precise crop coordinates without image understanding.

## Image Handling

FujiDay normalizes EXIF orientation before analysis, crop planning, preview rendering, and file export. This keeps phone images and rotated JPEGs aligned so the model, crop coordinates, and final output all refer to the same upright frame.

If `generate_recipe()` is called with `delete_after: true`, FujiDay only deletes the source image after the recipe path finishes successfully. Failed analysis or preview generation does not remove the original file.

## Current Limitations

FujiDay is deliberately scoped.

- Preview images are approximate simulations.
- Exported renders are approximate simulations.
- FujiDay does not claim exact Fujifilm JPEG reproduction.
- FujiDay v1 is Fujifilm-first and does not yet ship additional brand style packs.
- Composition v1 ships only the `alex-webb` pack.
- FujiDay is a grading workflow and runtime bundle, not a general-purpose photo editor or hosted SaaS.

## Development

```bash
npm install
npm run lint
npm test
npm run eval:fixtures
npm run eval:check
```

Useful references:

- [docs/architecture.md](./docs/architecture.md)
- [evals/README.md](./evals/README.md)
- [docs/README.codex.md](./docs/README.codex.md)
- [docs/README.claude.md](./docs/README.claude.md)

## Contributing

FujiDay is structured as a skills-plus-runtime repository. If you contribute, keep the public claims aligned with the code, keep style-pack logic data-driven, and add tests for any user-facing runtime or skill behavior changes.

For architecture context, start with [docs/architecture.md](./docs/architecture.md).

## License

MIT. See [LICENSE](./LICENSE).
