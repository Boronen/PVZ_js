/**
 * TierSystem.js — Manages tier progression (T1 → T2 → T3).
 *
 * Tiers are unlocked by spending XP. Once unlocked, all units of that tier
 * become permanently available for the rest of the run.
 *
 * Emits:
 *   tier:unlocked      — when a tier is successfully unlocked
 *   tier:unlockFailed  — when XP is insufficient
 */

import { EventBus, EVENTS } from '../core/EventBus.js';

/** Base XP costs for each tier unlock */
const BASE_TIER_COSTS = {
  2: 100,
  3: 250,
};

export class TierSystem {
  /**
   * @param {object} heroData  - Hero definition (for tierUnlockCostModifier)
   * @param {object} _gameData - Full game data (reserved)
   */
  constructor(heroData, _gameData) {
    /** @type {number} Current highest unlocked tier (1, 2, or 3) */
    this.currentTier = 1;

    /** @type {number} Hero-specific cost modifier */
    this._costModifier = heroData.tierUnlockCostModifier || 1.0;

    /** @type {number} XP refund fraction (set by upgrade) */
    this._xpRefundFraction = 0;

    /** @type {Set<number>} Tiers that have been unlocked */
    this._unlockedTiers = new Set([1]);

    /** Reference to EconomySystem — injected after construction */
    this._economy = null;
  }

  /**
   * Inject the EconomySystem dependency.
   * @param {EconomySystem} economy
   */
  setEconomy(economy) {
    this._economy = economy;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update (called every frame — currently no time-based logic needed)
  // ─────────────────────────────────────────────────────────────────────────

  update(_dt) {
    // Reserved for future time-based tier effects
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tier Unlock
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Attempt to unlock the given tier by spending XP.
   * @param {number} tier - 2 or 3
   * @returns {boolean} True if unlock succeeded
   */
  unlockTier(tier) {
    if (tier <= 1 || tier > 3) return false;
    if (this._unlockedTiers.has(tier)) return false; // already unlocked
    if (!this._economy) {
      console.error('[TierSystem] No EconomySystem injected.');
      return false;
    }

    const cost = this.getUnlockCost(tier);
    if (!this._economy.spendXP(cost)) {
      EventBus.emit(EVENTS.TIER_UNLOCK_FAILED, { tier, cost, xp: this._economy.xp });
      return false;
    }

    // Apply XP refund if upgrade is active
    if (this._xpRefundFraction > 0) {
      const refund = Math.floor(cost * this._xpRefundFraction);
      if (refund > 0) this._economy.addXP(refund);
    }

    this._unlockedTiers.add(tier);
    this.currentTier = Math.max(this.currentTier, tier);

    EventBus.emit(EVENTS.TIER_UNLOCKED, {
      tier,
      cost,
      currentTier: this.currentTier,
    });

    return true;
  }

  /**
   * Restore tier state from a save (no XP cost).
   * @param {number} tier
   */
  restoreTier(tier) {
    for (let t = 2; t <= tier; t++) {
      this._unlockedTiers.add(t);
    }
    this.currentTier = tier;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {number} tier
   * @returns {boolean}
   */
  isTierUnlocked(tier) {
    return this._unlockedTiers.has(tier);
  }

  /**
   * Get the XP cost to unlock a tier (after hero modifier).
   * @param {number} tier
   * @returns {number}
   */
  getUnlockCost(tier) {
    const base = BASE_TIER_COSTS[tier] || 999;
    return Math.round(base * this._costModifier);
  }

  /**
   * Get XP progress toward the next tier unlock as a fraction (0.0–1.0).
   * Returns 1.0 if all tiers are unlocked.
   * @returns {{ fraction: number, nextTier: number|null, cost: number }}
   */
  getXpProgress() {
    if (this.currentTier >= 3) {
      return { fraction: 1.0, nextTier: null, cost: 0 };
    }
    const nextTier = this.currentTier + 1;
    const cost     = this.getUnlockCost(nextTier);
    const xp       = this._economy?.xp ?? 0;
    return {
      fraction: Math.min(1.0, xp / cost),
      nextTier,
      cost,
    };
  }

  /**
   * Get the next tier that can be unlocked, or null if all unlocked.
   * @returns {number|null}
   */
  getNextLockedTier() {
    for (let t = 2; t <= 3; t++) {
      if (!this._unlockedTiers.has(t)) return t;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Upgrade Hooks
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the XP refund fraction (e.g. 0.3 = 30% refund on tier unlock).
   * @param {number} fraction
   */
  setXpRefundFraction(fraction) {
    this._xpRefundFraction = fraction;
  }
}
