/**
 * UnitSystem.js — Manages all active units on the lane.
 *
 * Responsibilities:
 * - Maintain playerUnits[] and enemyUnits[] arrays
 * - Update each unit every frame (movement, cooldowns, status effects)
 * - Lane queuing: units stop if a friendly unit is directly ahead
 * - Remove dead units after death animation completes
 * - Provide query methods used by CombatSystem and AISystem
 */

import { EventBus, EVENTS } from '../core/EventBus.js';
import { UNIT_STATE } from '../entities/Unit.js';
import { CANVAS } from '../core/constants.js';

/** Minimum gap between same-owner units (pixels) */
const UNIT_QUEUE_GAP = 10;
/** Width of a unit for collision purposes */
const UNIT_WIDTH = 40;
/** How long (seconds) a dead unit stays visible before removal */
const DEATH_LINGER_TIME = 1.2;

export class UnitSystem {
  /**
   * @param {object[]} unitDataList - All unit definitions from units.json
   */
  constructor(unitDataList) {
    /** @type {Unit[]} Active player units */
    this.playerUnits = [];

    /** @type {Unit[]} Active enemy units */
    this.enemyUnits  = [];

    /** @type {Map<string, object>} Unit data by id */
    this._unitDataMap = new Map(unitDataList.map(u => [u.id, u]));

    /** @type {Map<number, number>} uid → death linger timer */
    this._deathTimers = new Map();

    // Global stat multipliers applied to all newly spawned units
    this._globalModifiers = {
      melee:  { damage: 1, hp: 1, speed: 1, attackSpeed: 1, range: 1 },
      ranged: { damage: 1, hp: 1, speed: 1, attackSpeed: 1, range: 1 },
      tank:   { damage: 1, hp: 1, speed: 1, attackSpeed: 1, range: 1 },
      all:    { damage: 1, hp: 1, speed: 1, attackSpeed: 1, range: 1 },
    };

    // Spawn hooks registered by Hero passives or upgrades
    this._spawnHooks = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {number} dt
   */
  update(dt) {
    this._updateUnits(this.playerUnits, this.enemyUnits, dt);
    this._updateUnits(this.enemyUnits, this.playerUnits, dt);
    this._removeExpiredDeadUnits(dt);
  }

  /**
   * Update a set of units, applying movement and status effects.
   * @param {Unit[]} units - The units to update
   * @param {Unit[]} opponents - The opposing units (for queuing logic)
   * @param {number} dt
   */
  _updateUnits(units, _opponents, dt) {
    for (const unit of units) {
      if (unit.state === UNIT_STATE.DEAD) continue;

      // Tick cooldowns and status effects
      unit.updateCooldown(dt);
      unit.updateStatusEffects(dt);

      // Movement — only if not in combat (CombatSystem sets state to ATTACKING)
      if (unit.state !== UNIT_STATE.ATTACKING) {
        if (!this._isBlockedByFriendly(unit, units)) {
          unit.move(dt);
        } else {
          unit.state = UNIT_STATE.IDLE;
        }
      }

      // Clamp position to lane bounds
      unit.position.x = Math.max(60, Math.min(CANVAS.WIDTH - 60, unit.position.x));
    }
  }

  /**
   * Check if a unit is blocked by a friendly unit directly ahead.
   * @param {Unit} unit
   * @param {Unit[]} friendlies
   * @returns {boolean}
   */
  _isBlockedByFriendly(unit, friendlies) {
    const dir = unit.owner === 'player' ? 1 : -1;
    const frontEdge = unit.position.x + dir * (UNIT_WIDTH / 2 + UNIT_QUEUE_GAP);

    for (const other of friendlies) {
      if (other === unit || other.state === UNIT_STATE.DEAD) continue;
      if (other.special === 'immovable') {
        // Immovable units block from any direction
        const gap = Math.abs(other.position.x - unit.position.x);
        if (gap < UNIT_WIDTH + UNIT_QUEUE_GAP) return true;
        continue;
      }
      // Check if 'other' is directly ahead of 'unit'
      const isAhead = dir === 1
        ? other.position.x > unit.position.x
        : other.position.x < unit.position.x;
      if (!isAhead) continue;

      const dist = Math.abs(other.position.x - unit.position.x);
      if (dist < UNIT_WIDTH + UNIT_QUEUE_GAP) return true;
    }
    return false;
  }

  /**
   * Tick death linger timers and remove units whose timer has expired.
   * @param {number} dt
   */
  _removeExpiredDeadUnits(dt) {
    for (const [uid, timer] of this._deathTimers) {
      const newTimer = timer - dt;
      if (newTimer <= 0) {
        this._deathTimers.delete(uid);
        this.playerUnits = this.playerUnits.filter(u => u.uid !== uid);
        this.enemyUnits  = this.enemyUnits.filter(u => u.uid !== uid);
      } else {
        this._deathTimers.set(uid, newTimer);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Unit Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add a unit to the appropriate array and apply global modifiers.
   * @param {Unit} unit
   */
  addUnit(unit) {
    this._applyGlobalModifiers(unit);

    // Run spawn hooks (hero passives, upgrades)
    for (const hook of this._spawnHooks) {
      hook(unit);
    }

    if (unit.owner === 'player') {
      this.playerUnits.push(unit);
    } else {
      this.enemyUnits.push(unit);
    }

    // Register death listener to start linger timer
    const deathFn = ({ unit: deadUnit }) => {
      if (deadUnit.uid === unit.uid) {
        this._deathTimers.set(unit.uid, DEATH_LINGER_TIME);
        EventBus.off(EVENTS.UNIT_DIED, deathFn);
      }
    };
    EventBus.on(EVENTS.UNIT_DIED, deathFn);

    EventBus.emit(EVENTS.UNIT_SPAWNED, {
      unit,
      owner: unit.owner,
      id:    unit.id,
      tier:  unit.tier,
    });
  }

  /**
   * Apply accumulated global stat modifiers to a newly spawned unit.
   * @param {Unit} unit
   */
  _applyGlobalModifiers(unit) {
    const typeKey = unit.type; // 'melee' | 'ranged' | 'tank'
    const typeMod = this._globalModifiers[typeKey] || {};
    const allMod  = this._globalModifiers.all || {};

    const dmgMult  = (typeMod.damage      || 1) * (allMod.damage      || 1);
    const hpMult   = (typeMod.hp          || 1) * (allMod.hp          || 1);
    const spdMult  = (typeMod.speed       || 1) * (allMod.speed       || 1);
    const atkMult  = (typeMod.attackSpeed || 1) * (allMod.attackSpeed || 1);
    const rngMult  = (typeMod.range       || 1) * (allMod.range       || 1);

    if (dmgMult !== 1) unit.applyDamageMultiplier(dmgMult);
    if (hpMult  !== 1) unit.applyHpMultiplier(hpMult);
    if (spdMult !== 1) unit.applySpeedMultiplier(spdMult);
    if (atkMult !== 1) unit.applyAttackSpeedMultiplier(atkMult);
    if (rngMult !== 1) unit.applyRangeMultiplier(rngMult);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Global Modifier API (called by UpgradeSystem)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply a stat multiplier to all existing units of a type AND future spawns.
   * @param {'melee'|'ranged'|'tank'|'all'} unitType
   * @param {'damage'|'hp'|'speed'|'attackSpeed'|'range'} stat
   * @param {number} multiplier
   */
  applyGlobalModifier(unitType, stat, multiplier) {
    // Store for future spawns
    if (!this._globalModifiers[unitType]) this._globalModifiers[unitType] = {};
    this._globalModifiers[unitType][stat] = (this._globalModifiers[unitType][stat] || 1) * multiplier;

    // Apply to all currently living units of that type
    const targets = unitType === 'all'
      ? [...this.playerUnits, ...this.enemyUnits]
      : [...this.playerUnits, ...this.enemyUnits].filter(u => u.type === unitType);

    for (const unit of targets) {
      if (unit.state === UNIT_STATE.DEAD) continue;
      switch (stat) {
        case 'damage':      unit.applyDamageMultiplier(multiplier); break;
        case 'hp':          unit.applyHpMultiplier(multiplier); break;
        case 'speed':       unit.applySpeedMultiplier(multiplier); break;
        case 'attackSpeed': unit.applyAttackSpeedMultiplier(multiplier); break;
        case 'range':       unit.applyRangeMultiplier(multiplier); break;
      }
    }
  }

  /**
   * Register a spawn hook (called on every new unit after modifiers are applied).
   * @param {Function} hook - (unit: Unit) => void
   */
  addSpawnHook(hook) {
    this._spawnHooks.push(hook);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all living units (both sides).
   * @returns {Unit[]}
   */
  getAllUnits() {
    return [...this.playerUnits, ...this.enemyUnits].filter(
      u => u.state !== UNIT_STATE.DEAD,
    );
  }

  /**
   * Get all living units for a given owner.
   * @param {'player'|'enemy'} owner
   * @returns {Unit[]}
   */
  getLivingUnits(owner) {
    const arr = owner === 'player' ? this.playerUnits : this.enemyUnits;
    return arr.filter(u => u.state !== UNIT_STATE.DEAD);
  }

  /**
   * Get the frontmost living unit for a given owner.
   * Player: highest x. Enemy: lowest x.
   * @param {'player'|'enemy'} owner
   * @returns {Unit|null}
   */
  getFrontUnit(owner) {
    const units = this.getLivingUnits(owner);
    if (units.length === 0) return null;
    return owner === 'player'
      ? units.reduce((a, b) => a.position.x > b.position.x ? a : b)
      : units.reduce((a, b) => a.position.x < b.position.x ? a : b);
  }

  /**
   * Count living units by type for a given owner.
   * @param {'player'|'enemy'} owner
   * @returns {{ melee: number, ranged: number, tank: number }}
   */
  getUnitTypeCounts(owner) {
    const units = this.getLivingUnits(owner);
    return {
      melee:  units.filter(u => u.type === 'melee').length,
      ranged: units.filter(u => u.type === 'ranged').length,
      tank:   units.filter(u => u.type === 'tank').length,
    };
  }

  /**
   * Find all units within a radius of a position.
   * @param {{x:number,y:number}} pos
   * @param {number} radius
   * @param {'player'|'enemy'|'all'} [owner='all']
   * @returns {Unit[]}
   */
  getUnitsInRadius(pos, radius, owner = 'all') {
    let candidates;
    if (owner === 'all')    candidates = this.getAllUnits();
    else                    candidates = this.getLivingUnits(owner);

    return candidates.filter(u => {
      const dx = u.position.x - pos.x;
      const dy = u.position.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  /**
   * Get unit definition data by id.
   * @param {string} id
   * @returns {object|undefined}
   */
  getUnitData(id) {
    return this._unitDataMap.get(id);
  }
}
