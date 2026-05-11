# Warlords: Last Siege — Screen Wireframes (Text Representation)

> ASCII wireframes for all 5 screens.
> Full draw.io wireframes should be created in `/docs/wireframes/` as `.drawio` files.

---

## Screen 1: Main Menu

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    [Dark fantasy background]                        │
│                  Radial glow from center                           │
│                                                                     │
│                         WARLORDS                                    │
│                        LAST SIEGE                                   │
│                                                                     │
│                    ┌─────────────────┐                             │
│                    │      PLAY       │  ← Primary (red)            │
│                    └─────────────────┘                             │
│                    ┌─────────────────┐                             │
│                    │  RESUME RUN     │  ← Secondary (hidden if     │
│                    └─────────────────┘    no save exists)          │
│                    ┌─────────────────┐                             │
│                    │  HOW TO PLAY    │  ← Secondary                │
│                    └─────────────────┘                             │
│                    ┌─────────────────┐                             │
│                    │    SETTINGS     │  ← Secondary                │
│                    └─────────────────┘                             │
│                    ┌─────────────────┐                             │
│                    │    CREDITS      │  ← Secondary                │
│                    └─────────────────┘                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Modals (overlaid):**
- **How to Play** — 4 bullet points explaining gold, XP, upgrades, win condition
- **Settings** — SFX Volume slider + Music Volume slider
- **Credits** — Team member names and roles

---

## Screen 2: Hero Select

```
┌─────────────────────────────────────────────────────────────────────┐
│                   SELECT YOUR COMMANDER                             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   👸         │  │   💀         │  │   🎖️         │             │
│  │              │  │              │  │              │             │
│  │  DEMON QUEEN │  │  NECRO KING  │  │   HUMAN      │             │
│  │              │  │              │  │  COMMANDER   │             │
│  │ [Swarm]      │  │ [Death Syn.] │  │ [Balanced]   │             │
│  │ [Aggression] │  │ [Revive]     │  │ [Economy]    │             │
│  │ [Cheap Units]│  │ [Scaling]    │  │ [Projectile] │             │
│  │              │  │              │  │              │             │
│  │ Passive:     │  │ Passive:     │  │ Passive:     │             │
│  │ -15% costs   │  │ Gold on death│  │ +20% income  │             │
│  │ Swarm buff   │  │ Free revive  │  │ Ranged speed │             │
│  │              │  │              │  │              │             │
│  │ ★ Starts     │  │ ★ Starts     │  │ ★ Starts     │             │
│  │ with 1 Imp   │  │ with Skeleton│  │ with Turret  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│       (hover: gold glow border)                                     │
│       (selected: bright gold border + inner glow)                  │
│                                                                     │
│         Difficulty:  [EASY]  [NORMAL ✓]  [HARD]                   │
│                                                                     │
│              [← BACK]          [START RUN →]                       │
│                              (disabled until hero selected)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Screen 3: Gameplay HUD

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🏰 [████████░░] 800/1000  │  01:23  💰340  ⭐87/100[T1→T2]  │  [░░░░] 650/1000 💀 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Player Base]                                    [Enemy Base]      │
│     🏰                                                💀            │
│     ║                                                ║             │
│     ║  👿→  👿→  🦇→          ←💀  ←🦴              ║             │
│     ║                                                ║             │
│  ───╫────────────────────────────────────────────────╫───          │
│     ║                                                ║             │
│                                                                     │
│                                                         [⏸]        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ │ ┌────────┐ ┌────────┐         │
│  │  👿    │ │  🦇    │ │  👹    │ │ │  😈    │ │  🔥    │  ...    │
│  │  Imp   │ │Hellbat │ │ Brute  │ │ │Succubus│ │Flame   │         │
│  │ 💰 47  │ │ 💰 60  │ │ 💰 68  │ │ │ 💰 130 │ │ 💰 150 │         │
│  │[▓▓▓░░░]│ │[▓▓▓▓▓▓]│ │[▓▓▓▓▓▓]│ │ │[░░░░░░]│ │[░░░░░░]│         │
│  └────────┘ └────────┘ └────────┘ │ └────────┘ └────────┘         │
│                                   │  (locked — T2 not unlocked)    │
│  [Unlock T2: 100 XP]  [Unlock T3: 250 XP]                         │
└─────────────────────────────────────────────────────────────────────┘
```

**HUD Elements:**
- Top bar: Player HP bar (left), Run timer + resources (center), Enemy HP bar (right)
- Canvas: Game lane with units, bases, projectiles
- Bottom panel: Spawn buttons (with cooldown bars), tier unlock buttons
- Pause button (top-right corner)

---

## Screen 4: Upgrade Popup

```
┌─────────────────────────────────────────────────────────────────────┐
│                   [Dimmed game canvas behind]                       │
│                   [Blur backdrop filter]                            │
│                                                                     │
│                  ✨ CHOOSE AN UPGRADE ✨                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ ◆ COMMON     │  │ ◆◆ RARE      │  │ ◆◆◆ EPIC     │             │
│  │ (white)      │  │ (blue)       │  │ (purple)     │             │
│  │              │  │              │  │              │             │
│  │  Bloodlust   │  │ Armor Piercing│  │ Elite Vanguard│            │
│  │              │  │              │  │              │             │
│  │ All melee    │  │ Ranged        │  │ Every 5th    │             │
│  │ units gain   │  │ projectiles   │  │ unit spawned │             │
│  │ +15% damage  │  │ pierce through│  │ is elite with│             │
│  │              │  │ one extra     │  │ doubled stats│             │
│  │              │  │ enemy         │  │              │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│   (hover: scale up 1.06×, lift -4px)                               │
│   (click: close popup, apply effect, resume game)                  │
│                                                                     │
│  [Cursed variant shows red border + ⚠ drawback text at bottom]    │
└─────────────────────────────────────────────────────────────────────┘
```

**Rarity Color Coding:**
- Common: White border `#cccccc`
- Rare: Blue border `#4a9eff`
- Epic: Purple border `#9b59b6`
- Legendary: Gold border `#f39c12`
- Cursed: Red border `#e74c3c`

---

## Screen 5: End Screen

```
┌─────────────────────────────────────────────────────────────────────┐
│                   [Dark overlay, 90% opacity]                       │
│                                                                     │
│              ⚔️  VICTORY  ⚔️          (or: 💀 DEFEAT 💀)           │
│           (gold pulsing glow)          (red static glow)           │
│                                                                     │
│         ┌─────────────────────────────────────────┐               │
│         │  Hero           │  Demon Queen           │               │
│         │  Difficulty     │  Easy                  │               │
│         │  Run Time       │  03:42                 │               │
│         │  Units Spawned  │  47                    │               │
│         │  Enemies Killed │  31                    │               │
│         │  Upgrades       │  4                     │               │
│         └─────────────────────────────────────────┘               │
│                                                                     │
│              ┌──────────────┐  ┌──────────────┐                   │
│              │  PLAY AGAIN  │  │  MAIN MENU   │                   │
│              │  (red/primary)│  │ (secondary)  │                   │
│              └──────────────┘  └──────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Victory vs Defeat:**
- Victory: Gold `#f4c542` pulsing text, "The enemy base has fallen!"
- Defeat: Red `#f44336` static text, "Your base has been destroyed."
- Both show identical run summary grid and navigation buttons
