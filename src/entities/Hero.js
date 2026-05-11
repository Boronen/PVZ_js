/**
 * Hero.js — Hero base class and three concrete subclasses.
 *
 * Heroes define starting conditions, passive bonuses, and unique upgrade
 * pools for each run. They are commander objects that configure game systems
 * at run start — they do NOT extend Unit.
 *
 * Subclasses:
 *   DemonQueen      — Swarm, aggression, cheap units
 *   NecroKing       — Death synergies, revive mechanics, scaling
 *   HumanCommander  — Balanced, projectile focus, economy bonuses
 */

import { EventBus, EVENTS } from '../core/EventBus.js';

// ─────────────────────────────────────────────────────────────────────────────
// Base Hero Class
// ─────────────────────────────────────────────────────────────────────────────

export class Hero {
  /**
   * @param {object} data - Hero definition from heroes.json
   */
  constructor(data) {
    this.id                     = data.id;
    this.name                   = data.name;
    this.playstyle              = data.playstyle || [];
    this.passiveDescription     = data.passiveDescription || '';
    this.startingGold           = data.startingGold || 100;
    this.startingUnits          = data.startingUnits || [];
    this.tierUnlockCostModifier = data.tierUnlockCostModifier || 1.0;
    this.uniqueUpgradePool      = data.uniqueUpgradePool || [];
    this.portraitIcon           = data.portraitIcon || '🎖️';
    this.portraitKey            = data.portraitKey || null;
    this.themeColor             = data.themeColor || '#ffffff';
    this.baseHp                 = data.baseHp || 1000;
    this.passiveEffects         = data.passiveEffects || {};
    this.startingBonus          = data.startingBonus || '';
    this.units                  = data.units || { tier1: [], tier2: [], tier3: [] };
    this.lore                   = data.lore || '';

    // Bound event listeners (stored for cleanup)
    this._listeners = [];
  }

  /**
   * Apply this hero's passive bonuses to the game systems.
   * Called once at run start. Override in subclasses.
   * @param {object} systems - { economySystem, spawnSystem, unitSystem, combatSystem }
   */
  applyPassive(_systems) {
    // Base no-op — subclasses override
  }

  /**
   * Called every game tick for time-based passive effects.
   * Override in subclasses that need tick-based passives.
   * @param {number} _dt
   * @param {object} _systems
   */
  updatePassive(_dt, _systems) {
    // Base no-op
  }

  /**
   * Clean up all event listeners registered by this hero.
   * Called when the run ends or resets.
   */
  cleanup() {
    for (const { event, fn } of this._listeners) {
      EventBus.off(event, fn);
    }
    this._listeners = [];
  }

  /**
   * Helper to register a listener and track it for cleanup.
   * @param {string} event
   * @param {Function} fn
   */
  _on(event, fn) {
    EventBus.on(event, fn);
    this._listeners.push({ event, fn });
  }

  /**
   * Returns all unit IDs available to this hero up to the given tier.
   * @param {number} maxTier
   * @returns {string[]}
   */
  getAvailableUnitIds(maxTier) {
    const ids = [];
    if (maxTier >= 1) ids.push(...(this.units.tier1 || []));
    if (maxTier >= 2) ids.push(...(this.units.tier2 || []));
    if (maxTier >= 3) ids.push(...(this.units.tier3 || []));
    return ids;
  }

  /**
   * Factory — create the correct Hero subclass from JSON data.
   * @param {object} data
   * @returns {Hero}
   */
  static create(data) {
    switch (data.id) {
      case 'demonQueen':     return new DemonQueen(data);
      case 'necroKing':      return new NecroKing(data);
      case 'humanCommander': return new HumanCommander(data);
      default:
        console.warn(`[Hero] Unknown hero id '${data.id}', using base Hero.`);
        return new Hero(data);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Demon Queen
// ─────────────────────────────────────────────────────────────────────────────

export class DemonQueen extends Hero {
  constructor(data) {
    super(data);
    this._recentSpawnTimes = []; // seconds timestamps of recent player spawns
    this._swarmBuffActive  = false;
    this._swarmBuffTimer   = 0;
    this._systems          = null;
  }

  /**
   * Passive:
   * - All unit costs reduced by 15%
   * - Spawning 3+ units within 5s triggers a 4s attack speed buff (+25%)
   */
  applyPassive(systems) {
    this._systems = systems;
    const { spawnSystem } = systems;

    // 15% cost reduction
    if (spawnSystem) {
      spawnSystem.setCostMultiplier(
        1 - (this.passiveEffects.unitCostReduction || 0.15),
      );
    }

    // Swarm trigger listener
    const spawnFn = ({ owner }) => {
      if (owner !== 'player') return;
      const now = performance.now() / 1000;
      const window = this.passiveEffects.swarmTriggerWindow || 5;
      this._recentSpawnTimes.push(now);
      this._recentSpawnTimes = this._recentSpawnTimes.filter(t => now - t <= window);

      const triggerCount = this.passiveEffects.swarmTriggerCount || 3;
      if (
        this._recentSpawnTimes.length >= triggerCount &&
        !this._swarmBuffActive
      ) {
        this._activateSwarmBuff();
      }
    };
    this._on(EVENTS.UNIT_SPAWNED, spawnFn);
  }

  _activateSwarmBuff() {
    this._swarmBuffActive = true;
    this._swarmBuffTimer  = this.passiveEffects.swarmBuffDuration || 4;
    const bonus = this.passiveEffects.swarmAttackSpeedBonus || 0.25;
    if (this._systems?.unitSystem) {
      for (const unit of this._systems.unitSystem.playerUnits) {
        unit.applyAttackSpeedMultiplier(1 + bonus);
      }
    }
  }

  updatePassive(dt, systems) {
    if (!this._swarmBuffActive) return;
    this._swarmBuffTimer -= dt;
    if (this._swarmBuffTimer <= 0) {
      this._swarmBuffActive = false;
      const bonus = this.passiveEffects.swarmAttackSpeedBonus || 0.25;
      if (systems?.unitSystem) {
        for (const unit of systems.unitSystem.playerUnits) {
          // Revert the multiplier
          unit.applyAttackSpeedMultiplier(1 / (1 + bonus));
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Necro King
// ─────────────────────────────────────────────────────────────────────────────

export class NecroKing extends Hero {
  constructor(data) {
    super(data);
    this._deathCount   = 0;
    this._lastDeadUnit = null;
  }

  /**
   * Passive:
   * - On friendly unit death: gain gold + XP
   * - Every 5th death: free revive of last killed unit at 50% HP
   */
  applyPassive(systems) {
    const { economySystem, spawnSystem } = systems;

    const deathFn = ({ unit, owner }) => {
      if (owner !== 'player') return;

      this._deathCount++;
      this._lastDeadUnit = unit;

      // Gold + XP on death
      const goldBonus = this.passiveEffects.deathGoldBonus || 5;
      const xpBonus   = this.passiveEffects.deathXPBonus   || 1;
      if (economySystem) {
        economySystem.addGold(goldBonus);
        economySystem.addXP(xpBonus);
      }

      // Every 5th death: free revive
      const reviveEvery = this.passiveEffects.freeReviveEvery || 5;
      if (this._deathCount % reviveEvery === 0 && this._lastDeadUnit) {
        const hpPct = this.passiveEffects.freeReviveHpPercent || 0.5;
        // Delay revive slightly so death animation can play
        setTimeout(() => {
          if (this._lastDeadUnit && spawnSystem) {
            spawnSystem.reviveUnit(this._lastDeadUnit, hpPct);
          }
        }, 1500);
      }
    };
    this._on(EVENTS.UNIT_DIED, deathFn);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Human Commander
// ─────────────────────────────────────────────────────────────────────────────

export class HumanCommander extends Hero {
  constructor(data) {
    super(data);
  }

  /**
   * Passive:
   * - Passive gold income +20%
   * - Ranged units fire 10% faster
   * - Each tier unlock grants 75 gold bonus
   */
  applyPassive(systems) {
    const { economySystem, spawnSystem } = systems;

    // +20% passive gold income
    if (economySystem) {
      const mult = this.passiveEffects.passiveIncomeMultiplier || 1.2;
      economySystem.setPassiveIncomeMultiplier(mult);
    }

    // Ranged units fire 10% faster — applied to new spawns via SpawnSystem hook
    if (spawnSystem) {
      const bonus = this.passiveEffects.rangedAttackSpeedBonus || 0.1;
      spawnSystem.addSpawnHook((unit) => {
        if (unit.type === 'ranged') {
          unit.applyAttackSpeedMultiplier(1 + bonus);
        }
      });
    }

    // Gold bonus on tier unlock
    const tierGoldBonus = this.passiveEffects.tierUnlockGoldBonus || 75;
    const tierFn = () => {
      if (economySystem) economySystem.addGold(tierGoldBonus);
    };
    this._on(EVENTS.TIER_UNLOCKED, tierFn);
  }
}
