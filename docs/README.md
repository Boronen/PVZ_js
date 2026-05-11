# Warlords: Last Siege

> A browser-based 2D singleplayer lane-battler roguelike strategy game.

![Game Banner](docs/wireframes/gameplay.png)

---

## 🎮 About the Game

**Warlords: Last Siege** blends the lane-combat loop of *Age of War*, the run-based upgrade variety of *Vampire Survivors*, and the chaotic synergy-building of *The Binding of Isaac*.

Each run is unique: select a hero commander, spawn and upgrade units across three tiers, collect roguelike upgrades that stack and interact in unexpected ways, and push to destroy the AI-controlled enemy base before your own falls.

### Core Design Values
- **Replayability** — no two runs feel identical due to roguelike upgrade variance
- **Strategic depth** — unit composition, resource management, and upgrade synergies matter
- **Accessibility** — fully playable in a browser, no installation required

---

## 👥 Team

| Member | Role |
|--------|------|
| **Marcell** | UI/Art & Gameplay Systems |
| **Tomi** | Gameplay Design, Balancing & Logic |
| **Kevin** | Lead Programmer, Architecture & AI Integration |

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 Canvas | Game rendering |
| CSS3 | UI styling and animations |
| JavaScript (ES2022 modules) | Game logic, OOP architecture |
| Web Audio API | Sound effects and music |
| Cypress | End-to-end testing |
| GitHub Actions | CI/CD automation |
| GitHub Pages | Deployment |

---

## 🚀 How to Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A modern browser (Chrome, Firefox, Edge, Safari)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/warlords-last-siege.git
cd warlords-last-siege

# 2. Install dependencies
npm install

# 3. Start the local development server
npm run dev

# 4. Open in browser
# Navigate to http://localhost:8080
```

> ⚠️ **Important:** The game must be served through a web server (not opened directly from the file system) because it uses ES modules and `fetch()` to load JSON data files.

---

## 🧪 How to Run Cypress Tests

```bash
# Install dependencies (if not already done)
npm install

# Start the dev server in one terminal
npm run dev

# Run tests in interactive mode (another terminal)
npm run test:open

# Run tests headlessly (CI mode)
npm run test
```

### Test Files

| File | Coverage |
|------|---------|
| [`page_load.cy.js`](tests/cypress/page_load.cy.js) | Main menu loads, title visible, Play button present |
| [`hero_select.cy.js`](tests/cypress/hero_select.cy.js) | 3 hero cards, selection, start button, difficulty |
| [`unit_spawn.cy.js`](tests/cypress/unit_spawn.cy.js) | Gold deduction, spawn validation, cooldowns |
| [`economy.cy.js`](tests/cypress/economy.cy.js) | Passive income, kill rewards, XP, tier unlock |
| [`upgrade_select.cy.js`](tests/cypress/upgrade_select.cy.js) | Popup trigger, 3 cards, selection, resume |
| [`win_lose.cy.js`](tests/cypress/win_lose.cy.js) | Win/lose screens, run summary, navigation |

---

## 🌐 Live Demo

🔗 **[Play Now on GitHub Pages](https://your-org.github.io/warlords-last-siege/)**

> *(Link will be active after deployment — see [Deployment](#deployment))*

---

## 🎯 Features

### Heroes
| Hero | Playstyle | Passive |
|------|-----------|---------|
| 👸 **Demon Queen** | Swarm, Aggression | -15% unit costs; swarm speed buff |
| 💀 **Necro King** | Death Synergies, Revive | Gold/XP on death; 5th-death free revive |
| 🎖️ **Human Commander** | Balanced, Economy | +20% passive income; ranged fire rate bonus |

### Unit Tiers
- **Tier 1** — Affordable, always available, useful throughout the run
- **Tier 2** — Unlocked with 100 XP, noticeably stronger with special properties
- **Tier 3** — Unlocked with 250 XP, powerful run-defining units

### Roguelike Upgrades
- **35+ upgrades** across 5 rarities: Common, Rare, Epic, Legendary, Cursed
- Upgrades stack and interact — synergies emerge naturally
- Rarity weights scale over time, making late-game offers more powerful

### AI System
- 3 difficulty levels: Easy, Normal, Hard
- Counter-picks based on player unit composition
- Surge behavior: mass-spawns when gold threshold is met
- Income and aggression scale over time

### Save System
- Auto-saves every 30 seconds and on upgrade selection / tier unlock
- Resume a run in progress from the main menu

---

## 📁 Project Structure

```
/src
  /core          — GameManager, EventBus, SceneManager, SaveManager
  /entities      — Unit, Hero, Base, Projectile
  /systems       — EconomySystem, TierSystem, SpawnSystem, CombatSystem,
                   UnitSystem, UpgradeSystem, AISystem, Renderer, AudioManager
  /ui            — UISystem, HUD, MainMenuScreen, HeroSelectScreen,
                   UpgradePopup, EndScreen
  /data          — units.json, heroes.json, upgrades.json, ai_profiles.json
  /styles        — main.css
/assets
  /sprites       — Unit sprite sheets, base sprites, icons
  /audio         — SFX and music tracks
/tests/cypress   — Cypress E2E test suite
/docs            — README, architecture.md, wireframes, UML diagrams
```

---

## 📸 Screenshots

> *(Screenshots will be added after visual assets are finalized)*

| Screen | Preview |
|--------|---------|
| Main Menu | `docs/wireframes/main_menu.png` |
| Hero Select | `docs/wireframes/hero_select.png` |
| Gameplay | `docs/wireframes/gameplay.png` |
| Upgrade Popup | `docs/wireframes/upgrade_popup.png` |
| End Screen | `docs/wireframes/end_screen.png` |

---

## 🎬 Demo Video

> *(1–2 minute gameplay demo will be linked here after Week 3)*

🎥 **[Watch Demo](https://youtu.be/placeholder)**

---

## 🚢 Deployment

The game is deployed to GitHub Pages from the `main` branch root.

```bash
# After merging dev → main, GitHub Actions automatically deploys.
# Manual deployment: push to main branch.
```

**Live URL:** `https://<your-org>.github.io/warlords-last-siege/`

---

## 📋 GitHub Workflow

- `main` — production branch (receives merges from `dev` only)
- `dev` — integration branch (all feature branches merge here)
- Feature branches: `feature/unit-system`, `feature/upgrade-system`, etc.

### Commit Convention
- `feat:` new features
- `fix:` bug fixes
- `balance:` stat/balance changes
- `style:` visual/CSS changes
- `test:` test additions
- `docs:` documentation
- `refactor:` code restructuring

---

## 📄 Documentation

- [`docs/architecture.md`](docs/architecture.md) — System architecture, class descriptions, EventBus events
- [`docs/wireframes/`](docs/wireframes/) — Screen wireframes (draw.io exports)
- [`docs/uml/`](docs/uml/) — UML class and sequence diagrams
- [`plans/warlords-last-siege-plan.md`](plans/warlords-last-siege-plan.md) — Full implementation plan

---

## 📅 Milestones

| Week | Goal | Status |
|------|------|--------|
| Week 1 | Playable Prototype | 🔄 In Progress |
| Week 2 | Feature-Complete Alpha | ⏳ Planned |
| Week 3 | Final Polished Version | ⏳ Planned |

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.
