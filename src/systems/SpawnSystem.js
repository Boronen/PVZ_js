/**
 * SpawnSystem.js — Handles unit spawning for both player and AI.
 *
 * Responsibilities:
 * - Validate affordability and tier availability before spawning
 * - Instantiate Unit objects from JSON data
 * - Apply cost multipliers (hero passive, upgrades)
 * - Manage per-unit-type spawn cooldowns
 * - Handle elite spawn (every 5th unit doubled stats)
 * - Handle duplicate spawn (2 for cost of 1)
 * - Revive dead units (Necro King passive)
 */

import { Unit } from '../entities/Unit.js';
import { CANVAS } from '../core/constants.js';

/** Spawn cooldown in seconds per unit type (prevents instant re-spam) */
const DEFAULT_SPAWN_COOLDOWN = 1.5;

/** X position where player units spawn (just right of player base) */
const PLAYER_SPAWN_X = 130;
/** X position where enemy units spawn (just left of enemy base) */
const ENEMY_SPAWN_X  = CANVAS.WIDTH - 130;

export class SpawnSystem {
  /**
   * @param {object}      heroData    - Hero definition
   * @param {object[]}    unitDataList - All unit definitions from units.json
   * @param {UnitSystem}  unitSystem  - For adding spawned units
   * @param {EconomySystem} economySystem - For deducting gold
   */
  constructor(heroData, unitDataList, unitSystem, economySystem) {
    this._heroData      = heroData;
    this._unitSystem    = unitSystem;
    this._economy       = economySystem;

    /** @type {Map<string, object>} Unit data by id */
    this._unitDataMap = new Map(unitDataList.map(u => [u.id, u]));

    /** @type {Map<string, number>} unitId → remaining cooldown (seconds) */
    this._cooldowns = new Map();

    /** Cost multiplier (hero passive: Demon Queen -15%) */
    this._costMultiplier = 1.0;

    /** Cooldown reduction multiplier (upgrades) */
    this._cooldownMultiplier = 1.0;

    /** Spawn hooks: called on every spawned unit after construction */
    this._spawnHooks = [];

    /** Total player spawns this run (for elite every-5th logic) */
    this._totalPlayerSpawns = 0;

    /** Elite spawn: every Nth unit is elite (doubled stats) */
    this._eliteInterval = 0; // 0 = disabled

    /** Duplicate spawn: unitId → true (spawn 2 for cost of 1) */
    this._duplicateIds = new Set();

    /** TierSystem reference — injected after construction */
    this._tierSystem = null;
  }

  /**
   * Inject TierSystem dependency.
   * @param {TierSystem} tierSystem
   */
  setTierSystem(tierSystem) {
    this._tierSystem = tierSystem;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tick down all spawn cooldowns.
   * @param {number} dt
   */
  update(dt) {
    for (const [id, cd] of this._cooldowns) {
      const next = cd - dt;
      if (next <= 0) {
        this._cooldowns.delete(id);
      } else {
        this._cooldowns.set(id, next);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Spawn API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Attempt to spawn a unit for the player.
   * Validates gold, tier, and cooldown before spawning.
   * @param {string} unitId
   * @param {'player'|'enemy'} owner
   * @param {boolean} [free=false] - Skip gold deduction (starting units, revives)
   * @returns {Unit|null} The spawned unit, or null if spawn failed
   */
  spawnUnit(unitId, owner = 'player', free = false) {
    const data = this._unitDataMap.get(unitId);
    if (!data) {
      console.warn(`[SpawnSystem] Unknown unit id: ${unitId}`);
      return null;
    }

    // Tier check (player only)
    if (owner === 'player' && this._tierSystem) {
      if (!this._tierSystem.isTierUnlocked(data.tier)) {
        return null; // Tier not yet unlocked
      }
    }

    // Cooldown check (player only)
    if (owner === 'player' && this._cooldowns.has(unitId)) {
      return null; // Still on cooldown
    }

    // Gold check (player only, non-free)
    const cost = this.getAdjustedCost(unitId);
    if (owner === 'player' && !free) {
      if (!this._economy.canAfford(cost)) return null;
      this._economy.spendGold(cost);
    }

    // Spawn the unit (and duplicate if applicable)
    const unit = this._createUnit(data, owner);
    this._unitSystem.addUnit(unit);

    // Duplicate spawn: spawn a second unit for free
    if (owner === 'player' && this._duplicateIds.has(unitId)) {
      const twin = this._createUnit(data, owner);
      this._unitSystem.addUnit(twin);
    }

    // Start cooldown (player only)
    if (owner === 'player') {
      const cd = DEFAULT_SPAWN_COOLDOWN * this._cooldownMultiplier;
      this._cooldowns.set(unitId, cd);
      this._totalPlayerSpawns++;
    }

    return unit;
  }

  /**
   * Spawn a unit for the AI (no gold check, no cooldown).
   * @param {string} unitId
   * @returns {Unit|null}
   */
  spawnEnemyUnit(unitId) {
    return this.spawnUnit(unitId, 'enemy', true);
  }

  /**
   * Revive a dead unit at a given HP percentage.
   * @param {Unit} unit
   * @param {number} [hpPercent=0.5]
   * @returns {Unit|null}
   */
  reviveUnit(unit, hpPercent = 0.5) {
    if (!unit) return null;
    unit.revive(hpPercent);
    // Re-add to UnitSystem if it was removed
    const inPlayer = this._unitSystem.playerUnits.includes(unit);
    const inEnemy  = this._unitSystem.enemyUnits.includes(unit);
    if (!inPlayer && !inEnemy) {
      this._unitSystem.addUnit(unit);
    }
    return unit;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Unit Construction
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Construct a Unit instance from data.
   * @param {object} data
   * @param {'player'|'enemy'} owner
   * @returns {Unit}
   */
  _createUnit(data, owner) {
    const spawnX = owner === 'player' ? PLAYER_SPAWN_X : ENEMY_SPAWN_X;
    const unit = new Unit(data, owner, { x: spawnX, y: CANVAS.LANE_Y });

    // Elite spawn: every Nth player unit gets doubled stats
    if (
      owner === 'player' &&
      this._eliteInterval > 0 &&
      this._totalPlayerSpawns > 0 &&
      (this._totalPlayerSpawns + 1) % this._eliteInterval === 0
    ) {
      unit.isElite = true;
      unit.applyDamageMultiplier(2.0);
      unit.applyHpMultiplier(2.0);
    }

    // Run spawn hooks
    for (const hook of this._spawnHooks) {
      hook(unit);
    }

    return unit;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the adjusted cost for a unit (after hero and upgrade multipliers).
   * @param {string} unitId
   * @returns {number}
   */
  getAdjustedCost(unitId) {
    const data = this._unitDataMap.get(unitId);
    if (!data) return 0;
    return Math.max(1, Math.round(data.cost * this._costMultiplier));
  }

  /**
   * Check if a unit can be spawned right now (tier unlocked, not on cooldown).
   * @param {string} unitId
   * @returns {boolean}
   */
  canSpawn(unitId) {
    const data = this._unitDataMap.get(unitId);
    if (!data) return false;
    if (this._tierSystem && !this._tierSystem.isTierUnlocked(data.tier)) return false;
    if (this._cooldowns.has(unitId)) return false;
    return true;
  }

  /**
   * Get remaining cooldown for a unit type (0 if ready).
   * @param {string} unitId
   * @returns {number}
   */
  getCooldown(unitId) {
    return this._cooldowns.get(unitId) || 0;
  }

  /**
   * Get all cooldowns as a Map<unitId, seconds>.
   * @returns {Map<string, number>}
   */
  getCooldowns() {
    return new Map(this._cooldowns);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Modifier API (called by Hero passives and UpgradeSystem)
  // ─────────────────────────────────────────────────────────────────────────

  /** @param {number} multiplier - e.g. 0.85 for 15% cost reduction */
  setCostMultiplier(multiplier) {
    this._costMultiplier = multiplier;
  }

  /** @param {number} multiplier - e.g. 0.85 for 15% cooldown reduction */
  setCooldownMultiplier(multiplier) {
    this._cooldownMultiplier = multiplier;
  }

  /**
   * Enable elite spawn every N units.
   * @param {number} interval
   */
  setEliteInterval(interval) {
    this._eliteInterval = interval;
  }

  /**
   * Enable duplicate spawn for a specific unit type.
   * @param {string} unitId - or 'all' for all units
   */
  enableDuplicateSpawn(unitId) {
    if (unitId === 'all') {
      for (const id of this._unitDataMap.keys()) {
        this._duplicateIds.add(id);
      }
    } else {
      this._duplicateIds.add(unitId);
    }
  }

  /**
   * Register a spawn hook called on every new unit.
   * @param {Function} hook - (unit: Unit) => void
   */
  addSpawnHook(hook) {
    this._spawnHooks.push(hook);
  }
}
