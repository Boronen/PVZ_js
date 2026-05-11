/**
 * RoguelikeManager.js — Manages all roguelike systems.
 *
 * Responsibilities:
 *  - Plant draft: pick 3 from 5 random plants
 *  - Perk pool: draw 3 random perks for the shop
 *  - Perk application: modify game state via perk effects
 *  - Coins: track and spend run currency
 *  - Meta-currency: award seeds, persist via SaveManager
 *  - Permadeath: trigger run end
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, RUN, PERK_EFFECT } from '../core/constants.js';

export class RoguelikeManager {
  /**
   * @param {object[]} plantDefs  - all plants from plants.json
   * @param {object[]} perkDefs   - all perks from perks.json
   * @param {object}   rarityWeights
   * @param {object}   saveManager
   */
  constructor(plantDefs, perkDefs, rarityWeights, saveManager) {
    this._allPlants     = plantDefs;
    this._allPerks      = perkDefs;
    this._rarityWeights = rarityWeights;
    this._saveManager   = saveManager;

    /** Active perk modifiers applied to this run */
    this._perks = {
      sunDiscount:       0,
      plantDamageMult:   1,
      plantHpMult:       1,
      plantCooldownMult: 1,
      zombieSlowMult:    1,
      sunProductionMult: 1,
      coinBonusMult:     1,
    };

    /** @type {object[]} Perks purchased this run */
    this._purchasedPerks = [];

    /** @type {object[]} Plants in the current loadout */
    this._loadout = [];

    this._coins = RUN.STARTING_COINS;
  }

  // ── Public API ───────────────────────────────────────────────

  /** @returns {object} Active perk modifiers */
  getPerks() { return { ...this._perks }; }

  /** @returns {object[]} */
  getPurchasedPerks() { return [...this._purchasedPerks]; }

  /** @returns {number} */
  getCoins() { return this._coins; }

  /** @returns {object[]} Current plant loadout */
  getLoadout() { return [...this._loadout]; }

  /**
   * Generate the full draft pool of available plants.
   * Shows ALL unlocked plants so the player can freely choose.
   * @returns {object[]} All available plant defs
   */
  generateDraftPool() {
    const meta = this._saveManager.loadMeta();
    return this._allPlants.filter(p =>
      p.unlockId === null || meta.unlocks.includes(p.unlockId)
    );
  }

  /**
   * Confirm the player's draft selection.
   * @param {object[]} selectedPlants
   */
  confirmDraft(selectedPlants) {
    this._loadout = selectedPlants.slice(0, RUN.DRAFT_PICK_COUNT);
    EventBus.emit(EVENTS.DRAFT_CONFIRMED, { loadout: this._loadout });
  }

  /**
   * Draw random perks for the shop.
   * @returns {object[]} Array of perk defs (length = SHOP_PERK_COUNT)
   */
  drawShopPerks() {
    const available = this._allPerks.filter(p =>
      !this._purchasedPerks.some(pp => pp.id === p.id)
    );
    return this._drawWeightedPerks(available, RUN.SHOP_PERK_COUNT);
  }

  /**
   * Purchase a perk from the shop.
   * @param {object} perk
   * @returns {boolean} true if purchase succeeded
   */
  purchasePerk(perk) {
    if (this._coins < perk.cost) return false;
    this._coins -= perk.cost;
    this._purchasedPerks.push(perk);
    this._applyPerkEffect(perk);
    EventBus.emit(EVENTS.PERK_PURCHASED, { perk, coins: this._coins });
    EventBus.emit(EVENTS.COINS_CHANGED, { coins: this._coins });
    return true;
  }

  /**
   * Add coins (from zombie kills).
   * @param {number} amount
   */
  addCoins(amount) {
    const bonus = Math.round(amount * this._perks.coinBonusMult);
    this._coins += bonus;
    EventBus.emit(EVENTS.COINS_CHANGED, { coins: this._coins });
  }

  /**
   * Award seeds to meta-currency at run end.
   * @param {number} wavesCleared
   * @param {boolean} won
   */
  awardSeeds(wavesCleared, won) {
    const seeds = wavesCleared * RUN.SEEDS_PER_WAVE + (won ? RUN.SEEDS_BONUS_WIN : 0);
    this._saveManager.addSeeds(seeds);
    return seeds;
  }

  /**
   * Apply a perk immediately (used when loading saved perks).
   * @param {object} perk
   */
  applyPerkDirect(perk) {
    this._applyPerkEffect(perk);
    this._purchasedPerks.push(perk);
  }

  // ── Private — Perk Effects ───────────────────────────────────

  _applyPerkEffect(perk) {
    const { type, value } = perk.effect;
    switch (type) {
      case PERK_EFFECT.SUN_DISCOUNT:
        this._perks.sunDiscount += value;
        if (perk.effect.bonus_sun) {
          EventBus.emit(EVENTS.SUN_CHANGED, { bonusSun: perk.effect.bonus_sun });
        }
        break;
      case PERK_EFFECT.PLANT_DAMAGE_MULT:
        this._perks.plantDamageMult *= value;
        break;
      case PERK_EFFECT.PLANT_HP_MULT:
        this._perks.plantHpMult *= value;
        break;
      case PERK_EFFECT.PLANT_COOLDOWN_MULT:
        this._perks.plantCooldownMult *= value;
        break;
      case PERK_EFFECT.ZOMBIE_SLOW:
        this._perks.zombieSlowMult *= value;
        break;
      case PERK_EFFECT.SUN_PRODUCTION:
        this._perks.sunProductionMult *= value;
        break;
      case PERK_EFFECT.STARTING_SUN:
        EventBus.emit(EVENTS.SUN_CHANGED, { bonusSun: value });
        break;
      case PERK_EFFECT.COIN_BONUS:
        this._perks.coinBonusMult *= value;
        break;
      default:
        break;
    }
    EventBus.emit(EVENTS.PERK_APPLIED, { perk, perks: this._perks });
  }

  // ── Private — Randomisation ──────────────────────────────────

  _sampleWithoutReplacement(arr, n) {
    const copy    = [...arr];
    const result  = [];
    const count   = Math.min(n, copy.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  _drawWeightedPerks(pool, n) {
    const result = [];
    const used   = new Set();
    const weights= this._rarityWeights ?? { common:50, uncommon:30, rare:15, epic:5 };

    for (let i = 0; i < n && pool.length > used.size; i++) {
      const rarity  = this._pickRarity(weights);
      const byRarity= pool.filter(p => p.rarity === rarity && !used.has(p.id));
      const fallback= pool.filter(p => !used.has(p.id));
      const choices = byRarity.length > 0 ? byRarity : fallback;
      if (choices.length === 0) break;
      const pick = choices[Math.floor(Math.random() * choices.length)];
      result.push(pick);
      used.add(pick.id);
    }
    return result;
  }

  _pickRarity(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let   roll  = Math.random() * total;
    for (const [rarity, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) return rarity;
    }
    return 'common';
  }
}
