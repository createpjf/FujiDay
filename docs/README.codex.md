# FujiDay for Codex

FujiDay installs into Codex as a local bundle. The full repository is exposed to Codex so the skills can keep using relative references to `docs/`, `style-packs/`, and `runtimes/`.

## Install

1. Clone FujiDay locally:

   ```bash
   git clone https://github.com/<owner>/FujiDay.git ~/.codex/FujiDay
   ```

2. Install dependencies:

   ```bash
   cd ~/.codex/FujiDay
   npm install
   ```

3. Symlink the full FujiDay bundle into Codex discovery:

   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/FujiDay ~/.agents/skills/fujiday
   ```

4. Restart Codex.

## Verify

Ask for a photo-grading task such as:

- "analyze this image and show Fujifilm options"
- "give me a Classic Chrome recipe"
- "compare Classic Chrome and ETERNA"

Codex should discover FujiDay skills automatically from the bundle.

## Update

```bash
cd ~/.codex/FujiDay
git pull
npm install
```
