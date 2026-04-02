# FujiDay for Claude

FujiDay is structured as a local bundle for Claude-compatible environments that can load repository-backed skills plus a Node runtime.

## Install

1. Clone FujiDay locally:

   ```bash
   git clone https://github.com/<owner>/FujiDay.git
   cd FujiDay
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Point your Claude environment at the repository root so it can read:

   - `skills/`
   - `runtimes/`
   - `style-packs/`
   - `.claude-plugin/plugin.json`

4. Restart or reload your Claude environment if it caches local plugin or skill discovery.

## Included Plugin Metadata

The Claude-facing metadata lives at:

- [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json)

## Verify

Start a fresh Claude session and ask for:

- Fujifilm filter options for an uploaded photo
- a Fujifilm recipe plus preview
- an exported render in a selected style

The agent should route through FujiDay's guided style-selection flow instead of guessing silently.

## Notes

FujiDay does not assume a single Claude marketplace or distribution channel. This repository currently documents the local-bundle shape only.
