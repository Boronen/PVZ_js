/**
 * Base.js — Represents either the player base or enemy base structure.
 *
 * Emits:
 *   base:damaged   — when HP is reduced
 *   base:destroyed — when HP reaches 0
 *   base:repaired  — when HP is restored
 */

import { EventBus, EVENTS } from '../core/EventBus.js';

export class Base {
  /**
   * @param {object} config
   * @param {'player'|'enemy'} config.owner
   * @param {number} config.hp
   * @param {number} config.maxHp
   * @param {{x:number, y:number}} config.position
   */
  constructor({ owner, hp, maxHp, position }) {
    /** @type {'player'|'enemy'} */
    this.owner = owner;

    /** @type {number} Current HP */
    this.hp = hp;

    /** @type {number} Maximum HP */
    this.maxHp = maxHp;

    /** @type {{x:number, y:number}} Center position on the canvas */
    this.position = { ...position };

    /** @type {boolean} Whether the base has been destroyed this run */
    this._destroyed = false;

    // Visual dimensions for rendering
    this.width  = 80;
    this.height = 120;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply damage to this base.
   * @param {number} amount - Raw damage amount (must be > 0)
   * @param {object} [attacker] - The unit or projectile dealing damage
   */
  takeDamage(amount, attacker = null) {
    if (this._destroyed || amount <= 0) return;

    const actual = Math.min(amount, this.hp);
    this.hp = Math.max(0, this.hp - amount);

    EventBus.emit(EVENTS.BASE_DAMAGED, {
      owner:   this.owner,
      damage:  actual,
      hp:      this.hp,
      maxHp:   this.maxHp,
      attacker,
    });

    if (this.hp <= 0) {
      this._destroyed = true;
      EventBus.emit(EVENTS.BASE_DESTROYED, { owner: this.owner });
    }
  }

  /**
   * Restore HP to this base (capped at maxHp).
   * @param {number} amount
   */
  repair(amount) {
    if (this._destroyed || amount <= 0) return;
    const prev = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const healed = this.hp - prev;
    if (healed > 0) {
      EventBus.emit(EVENTS.BASE_REPAIRED, {
        owner:  this.owner,
        healed,
        hp:     this.hp,
        maxHp:  this.maxHp,
      });
    }
  }

  /**
   * Increase the maximum HP of this base.
   * @param {number} amount
   * @param {boolean} [healDifference=false] - Also heal by the added amount
   */
  increaseMaxHp(amount, healDifference = false) {
    this.maxHp += amount;
    if (healDifference) {
      this.hp = Math.min(this.maxHp, this.hp + amount);
    }
  }

  /**
   * @returns {boolean} True if this base has been destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }

  /**
   * @returns {number} HP as a fraction of maxHp (0.0 – 1.0)
   */
  getHpPercent() {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  /**
   * Returns the left edge x-coordinate of this base for collision checks.
   * Player base: right edge faces the lane. Enemy base: left edge faces the lane.
   * @returns {number}
   */
  getFrontEdgeX() {
    if (this.owner === 'player') {
      return this.position.x + this.width / 2;
    }
    return this.position.x - this.width / 2;
  }

  /**
   * Serialize this base for save state.
   * @returns {object}
   */
  serialize() {
    return {
      owner:  this.owner,
      hp:     this.hp,
      maxHp:  this.maxHp,
    };
  }
}
