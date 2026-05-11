/**
 * EconomySystem.js — Manages gold and XP resources.
 *
 * Responsibilities:
 * - Passive gold income tick (+5 gold every 3 seconds, base rate)
 * - Passive XP income tick (+3 XP every 5 seconds, base rate)
 * - Kill rewards (gold + XP) via EventBus unit:died listener
 * - Gold cap enforcement
 * - Emits gold:changed and xp:changed on every mutation
 */

import { EventBus, EVENTS } from '../core/EventBus.js';

export class EconomySystem {
  /**
   * @param {object} heroData - Hero definition (for starting gold + passive modifiers)
   * @param {object} _gameData - Full game data (unused directly, reserved for future)
   */
  constructor(heroData, _gameData) {
    // ── Gold ──────────────────────────────────────────────────────────────
    this.gold    = heroData.startingGold || 100;
    this.goldCap = 999;

    /** Base passive gold per tick */
    this._basePassiveGold         = 5;
    /** Flat bonus added by upgrades */
    this._passiveGoldBonus        = 0;
    /** Multiplier applied to total passive income (hero passive + upgrades) */
    this._passiveIncomeMultiplier = 1.0;
    /** Multiplier applied to kill gold rewards */
    this._killGoldMultiplier      = 1.0;
    /** Seconds between passive gold ticks */
    this._goldTickInterval        = 3.0;
    this._goldTickTimer           = 0;

    // ── XP ────────────────────────────────────────────────────────────────
    this.xp = 0;

    /** Base passive XP per tick */
    this._basePassiveXP    = 3;
    /** XP rate multiplier (upgrades can double this) */
    this._xpRateMultiplier = 1.0;
    /** Seconds between passive XP ticks */
    this._xpTickInterval   = 5.0;
    this._xpTickTimer      = 0;

    // ── Kill reward listener ──────────────────────────────────────────────
    this._killListener = EventBus.on(EVENTS.UNIT_DIED, (data) => {
      this._onUnitDied(data);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update (called every frame)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Passive gold tick
    this._goldTickTimer += dt;
    if (this._goldTickTimer >= this._goldTickInterval) {
      this._goldTickTimer -= this._goldTickInterval;
      const income = Math.round(
        (this._basePassiveGold + this._passiveGoldBonus) * this._passiveIncomeMultiplier,
      );
      this.addGold(income);
    }

    // Passive XP tick
    this._xpTickTimer += dt;
    if (this._xpTickTimer >= this._xpTickInterval) {
      this._xpTickTimer -= this._xpTickInterval;
      const xpIncome = Math.round(this._basePassiveXP * this._xpRateMultiplier);
      this.addXP(xpIncome);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Gold API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add gold (capped at goldCap).
   * @param {number} amount
   */
  addGold(amount) {
    if (amount <= 0) return;
    const prev = this.gold;
    this.gold = Math.min(this.goldCap, this.gold + amount);
    if (this.gold !== prev) {
      EventBus.emit(EVENTS.GOLD_CHANGED, { gold: this.gold, delta: this.gold - prev });
    }
  }

  /**
   * Deduct gold. Returns false if insufficient funds.
   * @param {number} amount
   * @returns {boolean} True if deduction succeeded
   */
  spendGold(amount) {
    if (amount > this.gold) return false;
    const prev = this.gold;
    this.gold = Math.max(0, this.gold - amount);
    EventBus.emit(EVENTS.GOLD_CHANGED, { gold: this.gold, delta: this.gold - prev });
    return true;
  }

  /**
   * Check if the player can afford a cost.
   * @param {number} amount
   * @returns {boolean}
   */
  canAfford(amount) {
    return this.gold >= amount;
  }

  /**
   * Directly set gold (used by save/load and test API).
   * @param {number} value
   */
  setGold(value) {
    this.gold = Math.max(0, Math.min(this.goldCap, value));
    EventBus.emit(EVENTS.GOLD_CHANGED, { gold: this.gold, delta: 0 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // XP API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add XP.
   * @param {number} amount
   */
  addXP(amount) {
    if (amount <= 0) return;
    const prev = this.xp;
    this.xp += Math.round(amount * this._xpRateMultiplier);
    EventBus.emit(EVENTS.XP_CHANGED, { xp: this.xp, delta: this.xp - prev });
  }

  /**
   * Deduct XP. Returns false if insufficient.
   * @param {number} amount
   * @returns {boolean}
   */
  spendXP(amount) {
    if (amount > this.xp) return false;
    const prev = this.xp;
    this.xp = Math.max(0, this.xp - amount);
    EventBus.emit(EVENTS.XP_CHANGED, { xp: this.xp, delta: this.xp - prev });
    return true;
  }

  /**
   * Directly set XP (used by save/load and test API).
   * @param {number} value
   */
  setXP(value) {
    this.xp = Math.max(0, value);
    EventBus.emit(EVENTS.XP_CHANGED, { xp: this.xp, delta: 0 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Modifier API (called by UpgradeSystem and Hero passives)
  // ─────────────────────────────────────────────────────────────────────────

  /** @param {number} multiplier - e.g. 1.2 for +20% */
  setPassiveIncomeMultiplier(multiplier) {
    this._passiveIncomeMultiplier = multiplier;
  }

  /** @param {number} bonus - Flat gold added per tick */
  addPassiveGoldBonus(bonus) {
    this._passiveGoldBonus += bonus;
  }

  /** @param {number} multiplier - e.g. 1.2 for +20% kill gold */
  addKillGoldMultiplier(multiplier) {
    this._killGoldMultiplier *= multiplier;
  }

  /** @param {number} multiplier - e.g. 2.0 to double XP rate */
  setXPRateMultiplier(multiplier) {
    this._xpRateMultiplier = multiplier;
  }

  /** @param {number} increase - Flat increase to gold cap */
  increaseGoldCap(increase) {
    this.goldCap += increase;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handle unit death — award kill gold and XP to the appropriate owner.
   * @param {{ unit, owner, killGold, killXP }} data
   */
  _onUnitDied({ owner, killGold, killXP }) {
    // Only award resources when an ENEMY unit dies (player earns the reward)
    if (owner !== 'enemy') return;

    const gold = Math.round((killGold || 0) * this._killGoldMultiplier);
    const xp   = killXP || 1;

    if (gold > 0) this.addGold(gold);
    if (xp   > 0) this.addXP(xp);
  }

  /**
   * Clean up event listeners.
   */
  destroy() {
    EventBus.off(EVENTS.UNIT_DIED, this._killListener);
  }
}
