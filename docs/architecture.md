# Warlords: Last Siege — Architecture Documentation

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Class Descriptions](#2-class-descriptions)
3. [EventBus Pattern & Event Catalog](#3-eventbus-pattern--event-catalog)
4. [Data-Driven Design](#4-data-driven-design)
5. [Save/Load System](#5-saveload-system)
6. [Upgrade Effect Hook System](#6-upgrade-effect-hook-system)
7. [AI System Design](#7-ai-system-design)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GameManager                             │
│  (init, startRun, pauseGame, resumeGame, endRun, resetRun)     │
└──────────────┬──────────────────────────────────────────────────┘
               │ coordinates via
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          EventBus                               │
│              (global pub/sub singleton)                         │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬───────────┘
   │      │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
Economy  Tier  Spawn Combat  Unit  Upgrade  AI    HUD
System  System System System System System System
```

### Communication Pattern
All systems communicate exclusively through the `EventBus`. No system holds a direct reference to another system (except where injected at initialization for performance-critical paths like `CombatSystem → UnitSystem`).

### Game Loop (requestAnimationFrame)
```
tick(timestamp):
  dt = (timestamp - lastTimestamp) / 1000  // capped at 100ms
  EconomySystem.update(dt)
  TierSystem.update(dt)
  UnitSystem.update(dt)
  CombatSystem.update(dt)
  SpawnSystem.update(dt)
  UpgradeSystem.update(dt, runTimer)
  AISystem.update(dt, runTimer)
  Renderer.render(dt)
  HUD.update(state)
```

### State Machine
```
UNINITIALIZED → MENU → HERO_SELECT → GAMEPLAY ⇄ UPGRADE_POPUP
                  ↑                      ↓
                  └──────── END_SCREEN ──┘
                  ↑              ↓
                  └── PAUSED ────┘
```

---

## 2. Class Descriptions

### Core

#### [`GameManager`](../src/core/GameManager.js)
Central controller. Owns all system instances, runs the RAF loop, manages state transitions, exposes `GameTestAPI` for Cypress tests.

**Key methods:** `init()`, `startRun(heroId, difficulty)`, `pauseGame()`, `resumeGame()`, `endRun(result)`, `resetRun()`

#### [`EventBus`](../src/core/EventBus.js)
Global singleton pub/sub. All inter-system communication flows through here.

**Key methods:** `on(event, cb)`, `off(event, cb)`, `once(event, cb)`, `emit(event, data)`, `clear(event?)`

#### [`SceneManager`](../src/core/SceneManager.js)
Manages DOM screen visibility. Each screen is a controller with `show(data)` and `hide()` lifecycle methods.

**Key methods:** `switchTo(sceneName, data)`, `showOverlay(sceneName, data)`, `hideOverlay(sceneName)`

#### [`SaveManager`](../src/core/SaveManager.js)
Persists run state to `localStorage`. Auto-saves every 30 seconds and on upgrade/tier events.

**Key methods:** `save(state)`, `load()`, `hasSave()`, `clear()`, `startAutoSave()`, `stopAutoSave()`

---

### Entities

#### [`Unit`](../src/entities/Unit.js)
Base class for all combat units. Holds live stats (modified by upgrades at runtime), state machine (`idle/moving/attacking/dead`), status effects, and upgrade hooks.

**Key methods:** `move(dt)`, `attack(target)`, `takeDamage(amount)`, `die()`, `heal(amount)`, `applyStatusEffect(effect)`, `addUpgradeHook(hook)`

**Upgrade hooks:** `onSpawn(unit)`, `onDeath(unit)`, `onKill(unit, target)`, `onAttack(unit, target, damage)`

#### [`Hero`](../src/entities/Hero.js)
Commander base class. Subclassed by `DemonQueen`, `NecroKing`, `HumanCommander`. Applies passive bonuses to systems at run start.

**Key methods:** `applyPassive(systems)`, `updatePassive(dt, systems)`, `getAvailableUnitIds(maxTier)`, `cleanup()`

**Factory:** `Hero.create(data)` returns the correct subclass.

#### [`Base`](../src/entities/Base.js)
Player or enemy base structure. Emits `base:damaged` and `base:destroyed` events.

**Key methods:** `takeDamage(amount)`, `repair(amount)`, `isDestroyed()`, `getHpPercent()`

#### [`Projectile`](../src/entities/Projectile.js)
Ranged attack in flight. Supports piercing, homing, split, splash, and chain effects.

**Key methods:** `update(dt, enemies)`, `onHit(target, nearbyEnemies)`, `isExpired()`, `expire()`

---

### Systems

#### [`EconomySystem`](../src/systems/EconomySystem.js)
Manages gold and XP. Passive income ticks, kill rewards via EventBus, gold cap enforcement.

**Key methods:** `addGold(n)`, `spendGold(n)`, `canAfford(n)`, `addXP(n)`, `spendXP(n)`, `setPassiveIncomeMultiplier(m)`, `addPassiveGoldBonus(n)`, `addKillGoldMultiplier(m)`, `setXPRateMultiplier(m)`

#### [`TierSystem`](../src/systems/TierSystem.js)
Manages tier progression. XP-gated tier unlocks with hero cost modifiers.

**Key methods:** `unlockTier(tier)`, `isTierUnlocked(tier)`, `getUnlockCost(tier)`, `getXpProgress()`, `restoreTier(tier)`

#### [`SpawnSystem`](../src/systems/SpawnSystem.js)
Instantiates `Unit` objects from JSON data. Validates tier, gold, and cooldown before spawning. Handles elite and duplicate spawn upgrades.

**Key methods:** `spawnUnit(unitId, owner, free?)`, `spawnEnemyUnit(unitId)`, `reviveUnit(unit, hpPct)`, `getAdjustedCost(unitId)`, `canSpawn(unitId)`, `getCooldowns()`

#### [`CombatSystem`](../src/systems/CombatSystem.js)
Processes all combat each frame. Finds targets, executes attacks, creates projectiles, resolves hits (splash/chain/pierce/split), handles death explosions.

**Key methods:** `update(dt)`, `setBases(playerBase, enemyBase)`, `getProjectiles()`, `enableDeathExplosion(dmg, radius)`, `enableGlobalPiercing()`, `enableGlobalHoming()`, `enableGlobalSplash(r, pct)`, `enableGlobalChain(pct)`

#### [`UnitSystem`](../src/systems/UnitSystem.js)
Maintains `playerUnits[]` and `enemyUnits[]`. Updates movement, cooldowns, status effects, lane queuing, and death linger timers.

**Key methods:** `addUnit(unit)`, `getLivingUnits(owner)`, `getFrontUnit(owner)`, `getUnitTypeCounts(owner)`, `getUnitsInRadius(pos, r, owner)`, `applyGlobalModifier(type, stat, mult)`, `addSpawnHook(fn)`

#### [`UpgradeSystem`](../src/systems/UpgradeSystem.js)
Manages the roguelike upgrade loop. Weighted random offer generation, effect application via `effectKey` dispatch, active upgrade tracking.

**Key methods:** `update(dt, runTimer)`, `applyUpgrade(upgrade, systems)`, `forcePopup()`, `getActiveUpgradeIds()`, `restoreUpgrades(ids, systems)`

#### [`AISystem`](../src/systems/AISystem.js)
Controls enemy spawning. Parallel economy, decision loop, counter-picking, surge behavior, time-based tier unlocks.

**Key methods:** `update(dt, runTimer)`, `setSpawnSystem(ss)`, `setBase(base)`, `getGold()`, `getTier()`

#### [`Renderer`](../src/systems/Renderer.js)
Canvas rendering pipeline. Draws background, bases, units (with emoji fallback), projectiles, HP bars, status icons.

**Key methods:** `render(dt)`, `setBases(playerBase, enemyBase)`, `setCombatSystem(cs)`, `registerSprite(key, img)`

#### [`AudioManager`](../src/systems/AudioManager.js)
Web Audio API wrapper. Independent SFX/music gain nodes, preloading, graceful fallback for missing files.

**Key methods:** `playSFX(key)`, `playMusic(key, loop?)`, `stopMusic()`, `setSFXVolume(v)`, `setMusicVolume(v)`, `preload(assets)`

---

### UI

#### [`UISystem`](../src/ui/UISystem.js)
Global UI wiring: modals (How to Play, Settings, Credits), volume sliders, keyboard shortcuts (Escape to pause).

#### [`HUD`](../src/ui/HUD.js)
Gameplay HUD. Per-frame updates for gold, XP, HP bars, timer, spawn buttons (with cooldown bars and affordability), tier unlock buttons.

**Key methods:** `init(heroData, unitDataList)`, `setBases(pb, eb)`, `update(state)`, `refreshSpawnButtons(gold)`

#### [`MainMenuScreen`](../src/ui/MainMenuScreen.js)
Main menu controller. Wires Play and Resume buttons.

#### [`HeroSelectScreen`](../src/ui/HeroSelectScreen.js)
Dynamically renders hero cards from JSON data. Manages selection state, difficulty selector, Start Run button.

#### [`UpgradePopup`](../src/ui/UpgradePopup.js)
Renders 3 upgrade cards with rarity styling. Emits `upgrade:selected` on card click.

#### [`EndScreen`](../src/ui/EndScreen.js)
Renders victory/defeat banner and run summary. Wires Play Again and Main Menu buttons.

---

## 3. EventBus Pattern & Event Catalog

### Pattern
```javascript
// Subscribe
EventBus.on('unit:died', (data) => { ... });

// Emit
EventBus.emit('unit:died', { unit, owner, killGold, killXP, position });

// Unsubscribe
EventBus.off('unit:died', myCallback);

// One-time
EventBus.once('run:started', (data) => { ... });
```

### Full Event Catalog

| Event | Emitter | Payload | Listeners |
|-------|---------|---------|-----------|
| `unit:spawned` | SpawnSystem / UnitSystem | `{ unit, owner, id, tier }` | HUD, AISystem, Hero passives |
| `unit:died` | Unit | `{ unit, owner, id, tier, killXP, killGold, position, deathExplosionDamage, deathExplosionRadius }` | EconomySystem, UpgradeSystem, CombatSystem, Hero passives |
| `unit:attacked` | Unit | `{ attacker, target, damage }` | — |
| `unit:damaged` | Unit | `{ unit, damage, source, hp }` | — |
| `unit:healed` | Unit | `{ unit, healed }` | — |
| `unit:statusApplied` | Unit | `{ unit, effect }` | — |
| `base:damaged` | Base | `{ owner, damage, hp, maxHp, attacker }` | HUD, GameManager |
| `base:destroyed` | Base | `{ owner }` | GameManager |
| `base:repaired` | Base | `{ owner, healed, hp, maxHp }` | HUD |
| `gold:changed` | EconomySystem | `{ gold, delta }` | HUD, SpawnSystem |
| `xp:changed` | EconomySystem | `{ xp, delta }` | HUD, TierSystem |
| `tier:unlocked` | TierSystem | `{ tier, cost, currentTier }` | SpawnSystem, HUD, SaveManager, AudioManager, Hero passives |
| `tier:unlockFailed` | TierSystem | `{ tier, cost, xp }` | HUD |
| `upgrade:triggered` | UpgradeSystem | `offers[]` | GameManager |
| `upgrade:selected` | UpgradePopup | `{ upgrade }` | GameManager, UpgradeSystem, SaveManager |
| `upgrade:applied` | UpgradeSystem | `{ upgrade }` | — |
| `game:paused` | GameManager | `{}` | All systems |
| `game:resumed` | GameManager | `{}` | All systems |
| `run:started` | GameManager | `{ heroId, difficulty }` | — |
| `run:won` | GameManager | `{}` | SceneManager, SaveManager |
| `run:lost` | GameManager | `{}` | SceneManager, SaveManager |
| `run:reset` | GameManager | `{}` | SaveManager |
| `scene:changed` | SceneManager | `{ scene, data }` | — |
| `save:written` | SaveManager | `{ timestamp }` | — |
| `save:loaded` | SaveManager | `{ timestamp }` | — |
| `save:cleared` | SaveManager | `{}` | — |
| `ai:surge` | AISystem | `{ count }` | — |
| `ai:tierUnlocked` | AISystem | `{ tier }` | — |
| `audio:playSFX` | CombatSystem, HUD | `{ key }` | AudioManager |
| `audio:playMusic` | GameManager | `{ key, loop }` | AudioManager |
| `audio:stopMusic` | GameManager | `{}` | AudioManager |

---

## 4. Data-Driven Design

All game balance values are externalized into JSON files in [`/src/data/`](../src/data/). No balance values are hardcoded in JavaScript.

### `units.json`
Defines all 27 unit types (9 per hero × 3 heroes) plus static units.

**Key fields:** `id`, `name`, `hero`, `tier`, `type` (melee/ranged/tank), `hp`, `damage`, `speed`, `attackSpeed`, `range`, `cost`, `killXP`, `killGold`, `icon`, `spriteKey`, `animFrames`, `special`, `splashRadius`, `lifestealPercent`, `statusOnHit`, `reviveDelay`, `auraRadius`, `executeThreshold`, `deathExplosionDamage`

### `heroes.json`
Defines the 3 hero commanders.

**Key fields:** `id`, `name`, `playstyle[]`, `passiveDescription`, `startingGold`, `startingUnits[]`, `tierUnlockCostModifier`, `uniqueUpgradePool[]`, `portraitIcon`, `themeColor`, `baseHp`, `passiveEffects{}`, `units{ tier1[], tier2[], tier3[] }`

### `upgrades.json`
Defines all 35+ upgrades with rarity weights and effect keys.

**Key fields:** `id`, `name`, `description`, `rarity`, `weight`, `heroRestriction`, `effectKey`, `effectValue`, `drawback`, `category`, `stackable`

**Rarity weight tables:** `rarityWeights.early/mid/late` — weights shift toward higher rarities as the run progresses.

### `ai_profiles.json`
Defines AI behavior for each difficulty level.

**Key fields:** `difficulty`, `incomeMultiplier`, `decisionIntervalMin/Max`, `tier2/3UnlockTime`, `surgeEnabled`, `surgeChance`, `surgeGoldThreshold`, `counterPickEnabled`, `counterPickWeight`, `unitPreferences{}`

---

## 5. Save/Load System

### Save Key
`localStorage['warlords_save']`

### Save State Schema
```json
{
  "version": 1,
  "timestamp": 1715000000000,
  "heroId": "demonQueen",
  "difficulty": "normal",
  "gold": 340,
  "xp": 87,
  "currentTier": 2,
  "activeUpgrades": ["melee_damage_boost", "pierce_projectile"],
  "playerBaseHp": 800,
  "enemyBaseHp": 650,
  "runTimer": 142.5,
  "units": [
    { "id": "imp", "x": 420, "y": 420, "hp": 80, "owner": "player" }
  ]
}
```

### Save Triggers
1. Auto-save every 30 seconds (`SaveManager.startAutoSave()`)
2. On `upgrade:selected` event
3. On `tier:unlocked` event

### Load Flow
1. `main.js` → `GameManager.init()` → `SaveManager.hasSave()`
2. If save exists: show **Resume Run** button on main menu
3. Player clicks Resume → `GameManager.resumeRun()` → `SaveManager.load()`
4. `GameManager._restoreFromSave(save)` restores: gold, XP, tier, upgrades, base HP, run timer

### Version Compatibility
Saves with a mismatched `version` field are discarded and the player starts fresh.

---

## 6. Upgrade Effect Hook System

### Architecture
Each upgrade in `upgrades.json` has an `effectKey` string that maps to a handler in `UpgradeSystem.applyUpgrade()`. This dispatch table pattern avoids storing function references in JSON.

```javascript
// upgrades.json
{ "effectKey": "meleeDamageBoost", "effectValue": 0.15 }

// UpgradeSystem.applyUpgrade()
case 'meleeDamageBoost':
  unitSystem.applyGlobalModifier('melee', 'damage', 1 + v);
  break;
```

### Unit-Level Hooks
For upgrades that need per-unit behavior (e.g. death explosions, lifesteal), `Unit.addUpgradeHook(hook)` registers an object with optional callbacks:

```javascript
unit.addUpgradeHook({
  id: 'death_explosion',
  onDeath: (unit) => { /* trigger explosion */ },
  onAttack: (unit, target, damage) => { /* lifesteal */ },
});
```

### Global vs Per-Unit Application
- **Global modifiers** (e.g. `meleeDamageBoost`) are applied to all existing units immediately AND stored in `UnitSystem._globalModifiers` for future spawns.
- **Per-unit hooks** are applied to each unit individually via `Unit.addUpgradeHook()`.

---

## 7. AI System Design

### Decision Loop
The AI runs a decision tick every 2–4 seconds (difficulty-dependent). Each tick:

1. **Surge check** — if gold ≥ threshold and random roll passes, spawn 3–5 units at once
2. **Counter-pick** — analyze player unit type counts; if player has many ranged → spawn tanks, etc.
3. **Preference-weighted pick** — select unit type based on `unitPreferences` weights
4. **Spawn** — deduct AI gold, call `SpawnSystem.spawnEnemyUnit(unitId)`

### Counter-Pick Rules (from `ai_profiles.json`)
```
playerRangedDominant → prefer tank
playerTankDominant   → prefer melee
playerMeleeDominant  → prefer ranged
```

### Income Scaling
AI income scales over time: `incomeScale = min(1.5, 1 + 0.05 * minutesElapsed)`

This ensures the AI becomes progressively more threatening as the run continues, creating escalating pressure.

### Difficulty Comparison

| Parameter | Easy | Normal | Hard |
|-----------|------|--------|------|
| Income multiplier | 0.7× | 1.0× | 1.35× |
| Decision interval | 4–7s | 2–4s | 1–2.5s |
| Tier 2 unlock | 150s | 90s | 60s |
| Tier 3 unlock | 300s | 180s | 130s |
| Surge enabled | No | Yes (15%) | Yes (30%) |
| Counter-pick | No | Yes (50%) | Yes (80%) |
