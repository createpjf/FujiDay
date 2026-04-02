# FujiDay

FujiDay is a Fujifilm-first agentic grading system for Codex and Claude-style coding agents. It packages a reusable skills library, a local photo-color runtime, a structured Fujifilm style pack, command-line entry points, and regression checks for recipe generation, previews, and exports.

It is intentionally conservative about what it claims. FujiDay can analyze an image, guide a user through Fujifilm style selection, generate a structured recipe, render an approximate preview, and export an approximate graded image. It does not claim to reproduce Fujifilm's in-camera JPEG engine exactly.

## How It Works

FujiDay starts from the moment an agent sees an image-based grading request. Instead of jumping straight into a recipe, it routes the task, decides whether the user already chose a style, and only shows a Fujifilm menu when that choice is still missing.

Once a style is selected, FujiDay separates the base Film Simulation from the supporting settings that shape white balance, contrast, saturation, dynamic range, and texture. If a preview is requested, it renders an approximate version of the look. If a file export is requested, it writes an approximate graded JPG or PNG to disk.

The whole system is organized as a bundle: skills drive behavior, the runtime executes analysis and rendering, and the style pack stores Fujifilm-specific definitions and scene adjustment rules.

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
4. The user chooses one style.
5. FujiDay returns a recipe and, if requested, a preview or export path.

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
- guided Fujifilm style selection
- recipe generation
- preview rendering
- export workflows
- look comparison
- debugging and result validation
- style-pack authoring

### Runtime

The photo-color runtime exposes these public functions:

- `analyze_image`
- `list_styles`
- `generate_recipe`
- `export_render`
- `compare_styles`
- `execute`

### Style Pack

The bundled Fujifilm style pack currently covers:

- `PROVIA / Standard`
- `Velvia / Vivid`
- `ASTIA / Soft`
- `Classic Chrome`
- `Classic Neg.`
- `ETERNA`
- `ACROS`

### Commands

FujiDay includes these CLI entry points:

- `grade-fujifilm`
- `compare-fujifilm`
- `export-fujifilm`
- `build-style-pack`

### Evals

FujiDay includes fixture and pressure-test scaffolding for:

- runtime contract regressions
- skill bundle coverage
- style-pack validation
- 30-scene eval manifests

## Vision Providers

FujiDay supports four image-observation modes:

- `openai`
  Uses OpenAI Chat Completions with image input.
- `openai_compatible`
  Uses an OpenAI-compatible `/v1/chat/completions` endpoint.
- `ollama`
  Uses a local Ollama server through `/api/chat`.
- `disabled`
  Skips remote vision and falls back to local heuristic analysis.

If no provider is configured, FujiDay defaults to:

- `openai` when `OPENAI_API_KEY` or `FUJIDAY_VLM_API_KEY` is available
- otherwise `disabled`

## Current Limitations

FujiDay is deliberately scoped.

- Preview images are approximate simulations.
- Exported renders are approximate simulations.
- FujiDay does not claim exact Fujifilm JPEG reproduction.
- FujiDay v1 is Fujifilm-first and does not yet ship additional brand style packs.
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
