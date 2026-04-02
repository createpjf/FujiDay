# Installing FujiDay for Codex

Enable FujiDay via native skill discovery using the full FujiDay bundle.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/<owner>/FujiDay.git ~/.codex/FujiDay
   ```

2. Install dependencies:

   ```bash
   cd ~/.codex/FujiDay
   npm install
   ```

3. Create the bundle symlink:

   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/FujiDay ~/.agents/skills/fujiday
   ```

4. Restart Codex.

## Verify

```bash
ls -la ~/.agents/skills/fujiday
```

It should point to your local FujiDay repository checkout.
