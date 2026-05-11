/**
 * Unit.js — Base class for all combat units on the lane.
 *
 * Subclassed per hero faction via data-driven instantiation in SpawnSystem.
 * Upgrade hooks (onSpawn, onDeath, onKill, onAttack) allow UpgradeSystem
 * to modify behavior at runtime without subclassing.
 *
 * Emits (via EventBus):
 *   unit:spawned, unit:died, unit:attacked, unit:damaged, unit:healed, unit:statusApplied
 */

import { EventBus, EVENTS } from '../core/EventBus.js';

/** @enum {string} Unit animation states */
export const UNIT_STATE = {
  IDLE:      'idle',
  MOVING:    'moving',
  ATTACKING: 'attacking',
  DEAD:      'dead',
};

/** @enum {string} Unit types */
export const UNIT_TYPE = {
  MELEE:  'melee',
  RANGED: 'ranged',
  TANK:   'tank',
};

let _nextUnitId = 1;

export class Unit {
  /**
   * @param {object} data - Unit definition from units.json
   * @param {'player'|'enemy'} owner
   * @param {{x:number, y:number}} position
   */
  constructor(data, owner, position) {
    // Unique runtime ID
    this.uid = _nextUnitId++;

    // Identity
    this.id          = data.id;
    this.name        = data.name;
    this.tier        = data.tier;
    this.type        = data.type;
    this.hero        = data.hero;
    this.owner       = owner;
    this.icon        = data.icon || '⚔️';
    this.spriteKey   = data.spriteKey || null;
    this.animFrames  = data.animFrames || { walk: 4, attack: 4, death: 3 };

    // Base stats (from JSON)
    this._baseHp          = data.hp;
    this._baseDamage      = data.damage;
    this._baseSpeed       = data.speed;
    this._baseAttackSpeed = data.attackSpeed;
    this._baseRange       = data.range;

    // Live stats (modified by upgrades at runtime)
    this.maxHp       = data.hp;
    this.hp          = data.hp;
    this.damage      = data.damage;
    this.speed       = data.speed;
    this.attackSpeed = data.attackSpeed; // attacks per second
    this.range       = data.range;
    this.cost        = data.cost;
    this.killXP      = data.killXP  || 1;
    this.killGold    = data.killGold || Math.floor(data.cost * 0.3);

    // Special properties
    this.special             = data.special || null;
    this.splashRadius        = data.splashRadius || 0;
    this.lifestealPercent    = data.lifestealPercent || 0;
    this.statusOnHit         = data.statusOnHit || null;
    this.statusDuration      = data.statusDuration || 0;
    this.reviveDelay         = data.reviveDelay || 0;
    this.auraRadius          = data.auraRadius || 0;
    this.auraEffect          = data.auraEffect || null;
    this.auraValue           = data.auraValue || 0;
    this.executeThreshold    = data.executeThreshold || 0;
    this.executeMultiplier   = data.executeMultiplier || 1;
    this.deathExplosionDamage = data.deathExplosionDamage || 0;
    this.deathExplosionRadius = data.deathExplosionRadius || 0;

    // Position
    this.position = { x: position.x, y: position.y };

    // State machine
    this.state          = UNIT_STATE.MOVING;
    this._attackCooldown = 0; // seconds until next attack
    this._reviveCooldown = 0; // seconds until revive (if revivable)
    this._isReviving     = false;

    // Status effects: [{ type, duration, value }]
    this.statusEffects = [];

    // Applied upgrade hooks: [{ id, onAttack, onDeath, onKill, onSpawn }]
    this.appliedUpgrades = [];

    // Stat multipliers accumulated from upgrades
    this._damageMultiplier      = 1.0;
    this._speedMultiplier       = 1.0;
    this._attackSpeedMultiplier = 1.0;
    this._hpMultiplier          = 1.0;
    this._rangeMultiplier       = 1.0;

    // Flags
    this.isElite    = false;
    this.isPiercing = false;
    this.isHoming   = false;
    this.isSplash   = false;

    // Animation
    this.animState    = 'walk';
    this.animFrame    = 0;
    this.animTimer    = 0;
    this.animSpeed    = 0.12; // seconds per frame
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Movement
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Move toward the enemy base by speed * dt pixels.
   * Player units move right (+x), enemy units move left (-x).
   * @param {number} dt - Delta time in seconds
   */
  move(dt) {
    if (this.state === UNIT_STATE.DEAD || this.special === 'immovable') return;
    const dir = this.owner === 'player' ? 1 : -1;
    this.position.x += this.getEffectiveSpeed() * dir * dt;
    this.state = UNIT_STATE.MOVING;
    this._updateAnim('walk', dt);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Combat
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Attack a target unit or base.
   * @param {Unit|Base} target
   * @returns {number} Actual damage dealt
   */
  attack(target) {
    if (this.state === UNIT_STATE.DEAD) return 0;
    if (this._attackCooldown > 0) return 0;

    let dmg = this.getEffectiveDamage();

    // Execute bonus: double damage on low-HP targets
    if (
      this.executeThreshold > 0 &&
      target.hp / target.maxHp < this.executeThreshold
    ) {
      dmg *= this.executeMultiplier;
    }

    target.takeDamage(dmg, this);

    // Lifesteal
    if (this.lifestealPercent > 0) {
      this.heal(dmg * this.lifestealPercent);
    }

    // Status on hit
    if (this.statusOnHit && target instanceof Unit) {
      target.applyStatusEffect({
        type:     this.statusOnHit,
        duration: this.statusDuration,
        value:    0.3,
      });
    }

    // Reset attack cooldown (1 / attackSpeed = seconds between attacks)
    this._attackCooldown = 1 / this.getEffectiveAttackSpeed();

    this.state = UNIT_STATE.ATTACKING;
    this._updateAnim('attack', 0);

    EventBus.emit(EVENTS.UNIT_ATTACKED, { attacker: this, target, damage: dmg });

    // Fire upgrade hooks
    for (const upgrade of this.appliedUpgrades) {
      if (typeof upgrade.onAttack === 'function') {
        upgrade.onAttack(this, target, dmg);
      }
    }

    // Kill hook
    if (target instanceof Unit && target.hp <= 0) {
      for (const upgrade of this.appliedUpgrades) {
        if (typeof upgrade.onKill === 'function') {
          upgrade.onKill(this, target);
        }
      }
    }

    return dmg;
  }

  /**
   * Apply incoming damage to this unit.
   * @param {number} amount
   * @param {Unit|Base|null} [source]
   */
  takeDamage(amount, source = null) {
    if (this.state === UNIT_STATE.DEAD || amount <= 0) return;

    const actual = Math.min(amount, this.hp);
    this.hp = Math.max(0, this.hp - amount);

    EventBus.emit(EVENTS.UNIT_DAMAGED, {
      unit:   this,
      damage: actual,
      source,
      hp:     this.hp,
    });

    if (this.hp <= 0) {
      this.die();
    }
  }

  /**
   * Heal this unit (capped at maxHp).
   * @param {number} amount
   */
  heal(amount) {
    if (this.state === UNIT_STATE.DEAD || amount <= 0) return;
    const prev = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const healed = this.hp - prev;
    if (healed > 0) {
      EventBus.emit(EVENTS.UNIT_HEALED, { unit: this, healed });
    }
  }

  /**
   * Trigger death: set state, fire hooks, emit event.
   */
  die() {
    if (this.state === UNIT_STATE.DEAD) return;
    this.state = UNIT_STATE.DEAD;
    this.hp    = 0;
    this._updateAnim('death', 0);

    // Death upgrade hooks
    for (const upgrade of this.appliedUpgrades) {
      if (typeof upgrade.onDeath === 'function') {
        upgrade.onDeath(this);
      }
    }

    EventBus.emit(EVENTS.UNIT_DIED, {
      unit:  this,
      owner: this.owner,
      id:    this.id,
      tier:  this.tier,
      killXP:   this.killXP,
      killGold: this.killGold,
      position: { ...this.position },
      deathExplosionDamage: this.deathExplosionDamage,
      deathExplosionRadius: this.deathExplosionRadius,
    });
  }

  /**
   * Revive this unit at a given HP percentage.
   * @param {number} [hpPercent=0.5]
   */
  revive(hpPercent = 0.5) {
    this.state = UNIT_STATE.MOVING;
    this.hp    = Math.floor(this.maxHp * hpPercent);
    this._attackCooldown = 0;
    this._isReviving     = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Status Effects
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply a status effect to this unit.
   * @param {{ type: string, duration: number, value: number }} effect
   */
  applyStatusEffect(effect) {
    // Replace existing effect of same type
    const existing = this.statusEffects.findIndex(e => e.type === effect.type);
    if (existing >= 0) {
      this.statusEffects[existing] = { ...effect };
    } else {
      this.statusEffects.push({ ...effect });
    }
    EventBus.emit(EVENTS.UNIT_STATUS_APPLIED, { unit: this, effect });
  }

  /**
   * Tick down all active status effects.
   * @param {number} dt
   */
  updateStatusEffects(dt) {
    this.statusEffects = this.statusEffects.filter(e => {
      e.duration -= dt;
      return e.duration > 0;
    });
  }

  /**
   * Check if this unit has a specific status effect active.
   * @param {string} type
   * @returns {boolean}
   */
  hasStatus(type) {
    return this.statusEffects.some(e => e.type === type);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Upgrade Hooks
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register an upgrade hook object on this unit.
   * @param {{ id: string, onSpawn?, onDeath?, onKill?, onAttack? }} hook
   */
  addUpgradeHook(hook) {
    this.appliedUpgrades.push(hook);
    if (typeof hook.onSpawn === 'function') {
      hook.onSpawn(this);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stat Modifiers (called by UpgradeSystem)
  // ─────────────────────────────────────────────────────────────────────────

  /** @param {number} multiplier - e.g. 1.15 for +15% */
  applyDamageMultiplier(multiplier) {
    this._damageMultiplier *= multiplier;
    this.damage = Math.round(this._baseHp > 0
      ? this._baseDamage * this._damageMultiplier
      : this.damage * multiplier);
  }

  /** @param {number} multiplier */
  applyHpMultiplier(multiplier) {
    const prevMax = this.maxHp;
    this._hpMultiplier *= multiplier;
    this.maxHp = Math.round(this._baseHp * this._hpMultiplier);
    // Scale current HP proportionally
    this.hp = Math.round(this.hp * (this.maxHp / prevMax));
  }

  /** @param {number} multiplier */
  applySpeedMultiplier(multiplier) {
    this._speedMultiplier *= multiplier;
  }

  /** @param {number} multiplier */
  applyAttackSpeedMultiplier(multiplier) {
    this._attackSpeedMultiplier *= multiplier;
  }

  /** @param {number} multiplier */
  applyRangeMultiplier(multiplier) {
    this._rangeMultiplier *= multiplier;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Effective Stat Getters
  // ─────────────────────────────────────────────────────────────────────────

  getEffectiveDamage() {
    let dmg = this._baseDamage * this._damageMultiplier;
    // Slow status doesn't affect damage, but other effects might
    return Math.max(1, Math.round(dmg));
  }

  getEffectiveSpeed() {
    let spd = this._baseSpeed * this._speedMultiplier;
    if (this.hasStatus('slow')) spd *= 0.5;
    return Math.max(0, spd);
  }

  getEffectiveAttackSpeed() {
    return Math.max(0.1, this._baseAttackSpeed * this._attackSpeedMultiplier);
  }

  getEffectiveRange() {
    return Math.max(20, this._baseRange * this._rangeMultiplier);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if this unit can attack right now.
   * @returns {boolean}
   */
  canAttack() {
    return this._attackCooldown <= 0 && this.state !== UNIT_STATE.DEAD;
  }

  /**
   * Check if a target is within attack range.
   * @param {{position:{x:number,y:number}}} target
   * @returns {boolean}
   */
  isInRange(target) {
    const dx = target.position.x - this.position.x;
    return Math.abs(dx) <= this.getEffectiveRange();
  }

  /**
   * Euclidean distance to another entity.
   * @param {{position:{x:number,y:number}}} other
   * @returns {number}
   */
  distanceTo(other) {
    const dx = other.position.x - this.position.x;
    const dy = other.position.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Tick down the attack cooldown.
   * @param {number} dt
   */
  updateCooldown(dt) {
    if (this._attackCooldown > 0) {
      this._attackCooldown = Math.max(0, this._attackCooldown - dt);
    }
  }

  /**
   * Update animation frame.
   * @param {string} animName
   * @param {number} dt
   */
  _updateAnim(animName, dt) {
    if (this.animState !== animName) {
      this.animState = animName;
      this.animFrame = 0;
      this.animTimer = 0;
    } else {
      this.animTimer += dt;
      if (this.animTimer >= this.animSpeed) {
        this.animTimer = 0;
        const frameCount = this.animFrames[animName] || 4;
        this.animFrame = (this.animFrame + 1) % frameCount;
      }
    }
  }

  /**
   * @returns {number} HP as a fraction of maxHp (0.0 – 1.0)
   */
  getHpPercent() {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  /**
   * Serialize this unit for save state.
   * @returns {object}
   */
  serialize() {
    return {
      id:    this.id,
      owner: this.owner,
      x:     this.position.x,
      y:     this.position.y,
      hp:    this.hp,
    };
  }
}
