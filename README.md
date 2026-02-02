# Roguelike

```
  |
  |
  + \
  \.G_.*=.
   `(#'/.\ |
    .>' (_--.
 _=/d   ,^\
~~ \)-'   '
   / |   rlc
  '  '

╔═════════════════════════════╗
║    Welcome to Roguelike     ║
╚═════════════════════════════╝
```

Turn your Obsidian vault into an RPG adventure! Roguelike is a gamified goal tracking plugin that transforms task management into an engaging game with XP, levels, achievements, loot drops, and AI-powered planning.

## Demo

https://github.com/creative-ventures/obsidian-roguelike/assets/29356955/2eed70c9-ce82-4861-84e1-ef05efc94342

## Features

### Gamification System
- **XP & Levels** — Earn experience points for completing goals, watch your character level up
- **Achievements** — Unlock 15+ achievements for milestones (first task, streaks, boss defeats, etc.)
- **Loot Drops** — Find items of various rarities (Common → Legendary) when completing goals
- **Boss Goals** — Mark important milestones as "bosses" for 3x XP rewards
- **Streaks** — Track daily completion streaks for bonus motivation

### AI-Powered Planning
- **Goal Generation** — Describe your project, AI creates a structured task breakdown
- **Smart Maps** — Generate ASCII dungeon maps visualizing your goal structure
- **Charts & Diagrams** — Create ASCII schemas for any concept
- **Content Assistant** — AI helps fill notes with relevant content
- **Auto Headers** — Generate titles and rename files based on content

### Flexible Structure
- Goals are folders with companion `.md` notes containing metadata
- Works anywhere in your vault — no dedicated folder required
- Inline fields (Dataview-compatible) for status, deadline, boss, XP, blockers
- Hierarchical nesting with parent-child relationships

### 11 Themes
Choose your adventure style:
- Default (Productivity)
- Fantasy RPG
- Space Opera
- Star Wars
- Cyberpunk
- Pirates
- Wild West
- Warhammer 40K
- Ninja/Samurai
- Crusader
- Dark Souls

## Installation

### From Community Plugins (Recommended)
1. Open **Settings → Community plugins**
2. Click **Browse** and search for "Roguelike"
3. Click **Install**, then **Enable**

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/creative-ventures/obsidian-roguelike/releases)
2. Create folder: `<vault>/.obsidian/plugins/roguelike/`
3. Copy the downloaded files into the folder
4. Enable the plugin in **Settings → Community plugins**

## Hotkeys

The plugin does **not** set default hotkeys (to avoid conflicts). You can assign **recommended** shortcuts in **Settings → Hotkeys** (search for "Roguelike"):

| Recommended shortcut | Command | Description |
|----------------------|---------|-------------|
| **Mac:** `Cmd+Shift+G` / **Win:** `Ctrl+Alt+Cmd+G` | Create goal with AI | Describe a goal, AI generates task structure |
| **Mac:** `Cmd+Shift+D` / **Win:** `Ctrl+Alt+Cmd+D` | Toggle done/undone | Mark goal complete or revert completion |
| **Mac:** `Cmd+Shift+B` / **Win:** `Ctrl+Alt+Cmd+B` | Toggle boss | Mark/unmark as boss goal (3x XP) |
| **Mac:** `Cmd+Shift+M` / **Win:** `Ctrl+Alt+Cmd+M` | Generate map | AI creates ASCII dungeon map of goal structure |
| **Mac:** `Cmd+Shift+C` / **Win:** `Ctrl+Alt+Cmd+C` | Generate chart | AI creates ASCII diagram from prompt |
| **Mac:** `Cmd+Shift+J` / **Win:** `Ctrl+Alt+Cmd+J` | Journal | Update welcome note with current stats and task overview |
| **Mac:** `Cmd+Shift+P` / **Win:** `Ctrl+Alt+Cmd+P` | Prompt | AI updates/adds content to current note |
| **Mac:** `Cmd+Shift+H` / **Win:** `Ctrl+Alt+Cmd+H` | Generate header | AI generates H1 title and renames file |

**How to assign:** Open **Settings → Hotkeys**, type "Roguelike" in the search box, click the pencil next to a command, then press your desired key combination.

## How It Works

### Goal Structure

Each goal is a folder with a companion Markdown note:

```
My Project/
├── My Project.md          # Goal metadata
├── Research Phase/
│   ├── Research Phase.md
│   └── Gather Sources/
│       └── Gather Sources.md
└── [BOSS] Launch Day/     # Boss goals have [BOSS] prefix
    └── [BOSS] Launch Day.md
```

### Goal Note Format

```markdown
status:: open
boss:: false
xp:: 20
deadline:: 2026-02-15
author:: [[Your Name]]
blocker:: [[Other Task]]
created:: 2026-01-30

Short description of what needs to be done.
```

### XP System

| Action | XP |
|--------|-----|
| Complete goal | 10 base |
| Nested goal bonus | +5 per depth level |
| Boss goal | 3x multiplier |

### Achievements

Unlock achievements as you progress:
- **First Blood** — Complete your first task
- **On Fire** — 3-day streak
- **Boss Slayer** — Defeat a boss
- **Centurion** — Complete 100 tasks
- And 10+ more!

## Settings

| Setting | Description |
|---------|-------------|
| **Theme** | Visual theme for messages and item names |
| **Provider** | AI provider for goals, maps, content, and headers |
| **Model** | Model to use (depends on selected provider) |
| **API key** | API key for the selected provider (get it from the provider’s console) |

### AI providers and models

| Provider | Models | API key / docs |
|----------|--------|----------------|
| **Anthropic (Claude)** | Claude sonnet 4, Claude opus 4, Claude 3.5 sonnet | [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI (GPT)** | GPT-4o, GPT-4o mini, GPT-4 turbo, GPT-4o (Nov 2024), O1, O1 mini | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Google (Gemini)** | Gemini 1.5 pro, Gemini 1.5 flash, Gemini 1.0 pro | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **xAI (Grok)** | Grok 2, Grok 2 mini | [console.x.ai](https://console.x.ai) |

## Welcome Note

On first run, the plugin creates a `Welcome to Roguelike.md` note in your vault root containing:
- Your profile (level, XP, streak)
- Statistics (tasks completed, bosses defeated)
- Achievements gallery
- Inventory of collected loot
- Journal with task overview (overdue, upcoming, blocked)
- Help and hotkey reference

Assign a hotkey for **Journal** in **Settings → Hotkeys** (e.g. `Cmd+Shift+J` / `Ctrl+Alt+Cmd+J`) to update this note anytime.

## Development

```bash
# Clone the repository
git clone https://github.com/creative-ventures/obsidian-roguelike.git
cd obsidian-roguelike

# Install dependencies
npm install

# Development build (with watch)
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

## Links

- [GitHub Repository](https://github.com/creative-ventures/obsidian-roguelike)
- [Report Issues](https://github.com/creative-ventures/obsidian-roguelike/issues)
- [RLC Project](https://www.rlc.rocks)
- [Creative Ventures](https://www.cv.rocks)

## License

MIT License — see [LICENSE](LICENSE) for details.

## Credits

Created by [Creative Ventures](https://www.cv.rocks).

Inspired by roguelike games and the desire to make productivity feel like an adventure.
