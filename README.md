# 🔥 KiroBurn

> ⚠️ **Beta** — Ce projet est en phase de développement actif. N'hésitez pas à [ouvrir une issue](https://github.com/Marouan-AZR/kiroburn/issues) pour remonter vos retours, bugs ou suggestions !

**See where your Kiro CLI tokens go.**

Interactive TUI dashboard + macOS menu bar for tracking token usage, cost, and activity across your [Kiro CLI](https://kiro.dev/cli/) sessions.

## Why KiroBurn?

[CodeBurn](https://github.com/getagentseal/codeburn) is great for tracking token usage across many AI coding tools, but it **doesn't support Kiro CLI sessions**. It only reads the IDE extension format (`~/Library/Application Support/Kiro/User/globalStorage/`), not the CLI format (`~/.kiro/sessions/cli/`).

KiroBurn fills that gap — purpose-built for Kiro CLI users who want visibility into their token spend.

## Features

- **Cost tracking** — Prices every session using actual model rates (Opus, Sonnet)
- **Model awareness** — Detects `claude-opus-4.6` vs `auto` (Sonnet) and prices accordingly
- **Project breakdown** — See which projects consume the most tokens
- **Activity classification** — Coding, Debugging, Exploration, Testing, Git Ops, etc.
- **Tool usage stats** — Which tools (shell, write, read, grep) you use most
- **Daily chart** — Visual cost trend over time
- **macOS menu bar** — Always-visible cost via SwiftBar plugin
- **Auto-refresh** — Dashboard updates every 30 seconds
- **JSON export** — Pipe data to other tools

## Requirements

- Node.js 20+
- Kiro CLI with session data (`~/.kiro/sessions/cli/`)

## Install

```bash
npm install -g kiroburn
```

Or run directly:

```bash
npx kiroburn
```

## Usage

```bash
kiroburn                        # interactive TUI dashboard (default: 7 days)
kiroburn today                  # today's usage summary
kiroburn status                 # compact one-liner (today + 7 days)
kiroburn report -p 30days       # detailed report
kiroburn report -p all          # all recorded sessions
kiroburn report --format json   # JSON output
```

### Dashboard Controls

| Key | Action |
|-----|--------|
| `←` `→` | Switch period |
| `1` `2` `3` `4` | Today / 7 Days / 30 Days / All |
| `r` | Manual refresh |
| `q` | Quit |

## macOS Menu Bar

Install [SwiftBar](https://github.com/swiftbar/SwiftBar):

```bash
brew install --cask swiftbar
```

Copy the plugin:

```bash
cp menubar/kiroburn.30s.sh "$(defaults read com.ameba.SwiftBar PluginDirectory 2>/dev/null || echo ~/Library/Application\ Support/SwiftBar/plugins)/"
chmod +x ~/Library/Application\ Support/SwiftBar/plugins/kiroburn.30s.sh
```

Shows `🔥 $X.XX` in your menu bar, refreshing every 30 seconds.

## How It Works

KiroBurn reads Kiro CLI session files from `~/.kiro/sessions/cli/`:

- `{session_id}.json` — Session metadata (model, timestamps, turn stats)
- `{session_id}.jsonl` — Conversation log (prompts, responses, tool calls)

Tokens are estimated from content length (~4 chars/token). Cost is calculated per-model:

| Model | Input/1M | Output/1M |
|-------|----------|-----------|
| `claude-opus-4.6` | $15 | $75 |
| `auto` (Sonnet) | $3 | $15 |

## Project Structure

```
src/
  cli.tsx          Commander.js entry point
  dashboard.tsx    Ink TUI (React for terminals)
  parser.ts        Session reader, token estimation
  pricing.ts       Model-aware cost calculation
  classifier.ts   Activity categorization
  types.ts         Type definitions
menubar/
  kiroburn.30s.sh  SwiftBar plugin
```

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push (`git push origin feat/my-feature`)
5. Open a Pull Request

## Credits

Inspired by [CodeBurn](https://github.com/getagentseal/codeburn). Pricing data from [LiteLLM](https://github.com/BerriAI/litellm).

## License

MIT
