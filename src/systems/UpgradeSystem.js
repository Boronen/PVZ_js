/**
 * UpgradeSystem.js — Manages the roguelike upgrade system.
 *
 * Responsibilities:
 * - Track elapsed time and kill count to trigger upgrade popups
 * - Build weighted random offers from the upgrade pool
 * - Apply selected upgrades to game systems via effect hooks
 * - Track all active upgrades for save/load and HUD display
 * - Support rarity weight scaling over time
 */

import { EventBus, EVENTS } from '../core/EventBus.js';

/** Seconds between upgrade popup triggers */
const UPGRADE_INTERVAL = 30;
/** Kill count between upgrade popup triggers */
const KILL_MILESTONE = 10;

export class UpgradeSystem {
  /**
   * @param {object[]} upgradesData     - All upgrade definitions from upgrades.json
   * @param {object}   rarityWeights    - { early, mid, late } weight tables
   * @param {object}   rarityThresholds - { earlyMaxTime, midMaxTime }
   * @param {object}   heroData         - Hero definition (for unique upgrade pool)
   */
  constructor(upgradesData, rarityWeights, rarityThresholds, heroData) {
    this._allUpgrades      = upgradesData;
    this._rarityWeights    = rarityWeights;
    this._rarityThresholds = rarityThresholds;
    this._heroId           = heroData.id;
    this._uniquePool       = heroData.uniqueUpgradePool || [];

    /** @type {object[]} All upgrades selected this run */
    this._activeUpgrades = [];

    /** @type {Set<string>} IDs of upgrades already selected (for non-stackable) */
    this._selectedIds = new Set();

    // Trigger tracking
    this._timeSinceLastUpgrade = 0;
    this._killsSinceLastUpgrade = 0;
    this._totalKills = 0;

    // Kill listener
    this._killListener = EventBus.on(EVENTS.UNIT_DIED, ({ owner }) => {
      if (owner === 'enemy') {
        this._killsSinceLastUpgrade++;
        this._totalKills++;
      }
    });

    // Popup already showing guard
    this._popupActive = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {number} dt
   * @param {number} runTimer - Total elapsed run time in seconds
   */
  update(dt, runTimer) {
    if (this._popupActive) return;

    this._timeSinceLastUpgrade += dt;

    const timeTriggered = this._timeSinceLastUpgrade >= UPGRADE_INTERVAL;
    const killTriggered = this._killsSinceLastUpgrade >= KILL_MILESTONE;

    if (timeTriggered || killTriggered) {
      this._timeSinceLastUpgrade  = 0;
      this._killsSinceLastUpgrade = 0;
      this._triggerPopup(runTimer);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Popup Trigger
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build 3 upgrade offers and emit the trigger event.
   * @param {number} runTimer
   */
  _triggerPopup(runTimer) {
    const offers = this._buildOffers(3, runTimer);
    if (offers.length === 0) return;

    this._popupActive = true;
    EventBus.emit(EVENTS.UPGRADE_TRIGGERED, offers);
  }

  /**
   * Force a popup (used by test API).
   */
  forcePopup() {
    this._triggerPopup(0);
  }

  /**
   * Mark popup as closed (called after upgrade selection).
   */
  closePopup() {
    this._popupActive = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Offer Building
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build N distinct upgrade offers using weighted random rarity selection.
   * @param {number} count
   * @param {number} runTimer
   * @returns {object[]}
   */
  _buildOffers(count, runTimer) {
    const weights = this._getWeightsForTime(runTimer);
    const pool    = this._buildPool();

    if (pool.length === 0) return [];

    const offers = [];
    const usedIds = new Set();

    let attempts = 0;
    while (offers.length < count && attempts < 100) {
      attempts++;
      const rarity  = this._weightedRarityPick(weights);
      const candidates = pool.filter(u =>
        u.rarity === rarity &&
        !usedIds.has(u.id) &&
        (u.stackable || !this._selectedIds.has(u.id)),
      );

      if (candidates.length === 0) continue;

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      usedIds.add(pick.id);
      offers.push(pick);
    }

    // Fallback: fill remaining slots from any available upgrade
    if (offers.length < count) {
      const remaining = pool.filter(u =>
        !usedIds.has(u.id) &&
        (u.stackable || !this._selectedIds.has(u.id)),
      );
      for (const u of remaining) {
        if (offers.length >= count) break;
        offers.push(u);
      }
    }

    return offers;
  }

  /**
   * Build the eligible upgrade pool for this hero.
   * Includes universal upgrades + hero-specific upgrades.
   * @returns {object[]}
   */
  _buildPool() {
    return this._allUpgrades.filter(u => {
      // Include if no hero restriction, or matches this hero
      const heroOk = !u.heroRestriction || u.heroRestriction === this._heroId;
      return heroOk;
    });
  }

  /**
   * Get rarity weights for the current run time phase.
   * @param {number} runTimer
   * @returns {object}
   */
  _getWeightsForTime(runTimer) {
    const { earlyMaxTime = 90, midMaxTime = 210 } = this._rarityThresholds || {};
    if (runTimer <= earlyMaxTime) return this._rarityWeights.early;
    if (runTimer <= midMaxTime)   return this._rarityWeights.mid;
    return this._rarityWeights.late;
  }

  /**
   * Pick a rarity using weighted random selection.
   * @param {object} weights - { common, rare, epic, legendary, cursed }
   * @returns {string}
   */
  _weightedRarityPick(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [rarity, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) return rarity;
    }
    return 'common';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Apply Upgrade
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply a selected upgrade to the game systems.
   * @param {object} upgrade - The upgrade definition
   * @param {object} systems - { unitSystem, economySystem, spawnSystem, combatSystem, playerBase }
   */
  applyUpgrade(upgrade, systems) {
    this._activeUpgrades.push(upgrade);
    this._selectedIds.add(upgrade.id);
    this._popupActive = false;

    const { unitSystem, economySystem, spawnSystem, combatSystem, playerBase } = systems;
    const v = upgrade.effectValue;

    switch (upgrade.effectKey) {
      // ── Unit Modifiers ──────────────────────────────────────────────────
      case 'meleeDamageBoost':
        unitSystem?.applyGlobalModifier('melee', 'damage', 1 + v);
        break;
      case 'rangedAttackSpeedBoost':
        unitSystem?.applyGlobalModifier('ranged', 'attackSpeed', 1 + v);
        break;
      case 'tankHpBoost':
        unitSystem?.applyGlobalModifier('tank', 'hp', 1 + v);
        break;
      case 'allDamageBoost':
        unitSystem?.applyGlobalModifier('all', 'damage', 1 + v);
        break;
      case 'allSpeedBoost':
        unitSystem?.applyGlobalModifier('all', 'speed', 1 + v);
        break;
      case 'meleeHpBoost':
        unitSystem?.applyGlobalModifier('melee', 'hp', 1 + v);
        break;
      case 'rangedRangeBoost':
        unitSystem?.applyGlobalModifier('ranged', 'range', 1 + v);
        break;
      case 'eliteEveryFifth':
        spawnSystem?.setEliteInterval(v.interval);
        break;
      case 'duplicateSpawn':
        spawnSystem?.enableDuplicateSpawn('all');
        break;
      case 'spawnCooldownReduction':
        spawnSystem?.setCooldownMultiplier(1 - v);
        break;

      // ── Economy ─────────────────────────────────────────────────────────
      case 'passiveGoldIncrease':
        economySystem?.addPassiveGoldBonus(v);
        break;
      case 'killGoldMultiplier':
        economySystem?.addKillGoldMultiplier(1 + v);
        break;
      case 'instantGold':
        economySystem?.addGold(v);
        break;
      case 'xpRateMultiplier':
        economySystem?.setXPRateMultiplier(v);
        break;
      case 'tierUnlockXpRefund':
        systems.tierSystem?.setXpRefundFraction(v);
        break;
      case 'goldCapIncrease':
        economySystem?.increaseGoldCap(v);
        break;
      case 'allGoldMultiplier':
        economySystem?.addKillGoldMultiplier(1 + v);
        economySystem?.setPassiveIncomeMultiplier(
          (economySystem._passiveIncomeMultiplier || 1) * (1 + v),
        );
        break;
      case 'baseHpBoost':
        playerBase?.increaseMaxHp(v.maxHpIncrease, false);
        playerBase?.repair(v.healAmount);
        break;

      // ── Projectile ──────────────────────────────────────────────────────
      case 'projectilePierce':
        combatSystem?.enableGlobalPiercing();
        break;
      case 'homingProjectiles':
        combatSystem?.enableGlobalHoming();
        break;
      case 'projectileSplit':
        combatSystem?.enableGlobalSplit();
        break;
      case 'splashProjectiles':
        combatSystem?.enableGlobalSplash(v.splashRadius, v.splashPercent);
        break;
      case 'chainProjectile':
        combatSystem?.enableGlobalChain(v.damagePercent);
        break;

      // ── Death / Revive ───────────────────────────────────────────────────
      case 'deathExplosion':
        combatSystem?.enableDeathExplosion(v.damage, v.radius);
        break;
      case 'chainExplosion':
        combatSystem?.enableChainExplosion(v.chainChance);
        break;
      case 'reviveChance':
        this._enableReviveChance(v.chance, v.hpPercent, unitSystem);
        break;
      case 'deathDamageStack':
        this._enableDeathDamageStack(v, unitSystem);
        break;
      case 'raiseFallenEnemy':
        this._enableRaiseFallenEnemy(v.duration, unitSystem, spawnSystem);
        break;

      // ── Swarm ────────────────────────────────────────────────────────────
      case 'swarmAttackBuff':
        // Handled by DemonQueen passive — just store the config
        break;
      case 'deathSpawnChance':
        this._enableDeathSpawnChance(v, spawnSystem, unitSystem);
        break;
      case 'massSpawnTrigger':
        // Immediately spawn N free Tier 1 units
        if (spawnSystem && unitSystem) {
          const heroUnits = unitSystem.getLivingUnits('player');
          const tier1Ids  = heroUnits.filter(u => u.tier === 1).map(u => u.id);
          const spawnId   = tier1Ids[0] || 'imp';
          for (let i = 0; i < (v.count || 3); i++) {
            spawnSystem.spawnUnit(spawnId, 'player', true);
          }
        }
        break;

      // ── Cursed ───────────────────────────────────────────────────────────
      case 'cursedDamageCost':
        unitSystem?.applyGlobalModifier('all', 'damage', 1 + v.damageBonus);
        spawnSystem?.setCostMultiplier(
          (spawnSystem._costMultiplier || 1) * (1 + v.costIncrease),
        );
        break;
      case 'cursedIncomeHp':
        unitSystem?.applyGlobalModifier('all', 'hp', 1 + v.hpBonus);
        economySystem?.setPassiveIncomeMultiplier(
          (economySystem._passiveIncomeMultiplier || 1) * v.incomeMultiplier,
        );
        break;
      case 'cursedEnemySpeed':
        unitSystem?.applyGlobalModifier('all', 'damage', 1 + v.playerDamageBonus);
        // Apply speed buff to all enemy units
        if (unitSystem) {
          for (const u of unitSystem.enemyUnits) {
            u.applySpeedMultiplier(1 + v.enemySpeedIncrease);
          }
          // Store for future enemy spawns
          unitSystem.applyGlobalModifier('all', 'speed', 1 + v.enemySpeedIncrease);
        }
        break;
      case 'cursedGlassCannon':
        unitSystem?.applyGlobalModifier('all', 'damage', 1 + v.damageBonus);
        unitSystem?.applyGlobalModifier('all', 'hp', 1 - v.hpPenalty);
        break;

      default:
        console.warn(`[UpgradeSystem] Unknown effectKey: ${upgrade.effectKey}`);
    }

    EventBus.emit(EVENTS.UPGRADE_APPLIED, { upgrade });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Complex Upgrade Helpers
  // ─────────────────────────────────────────────────────────────────────────

  _enableReviveChance(chance, hpPercent, unitSystem) {
    EventBus.on(EVENTS.UNIT_DIED, ({ unit, owner }) => {
      if (owner !== 'player') return;
      if (Math.random() < chance) {
        setTimeout(() => unit.revive(hpPercent), 1500);
      }
    });
  }

  _enableDeathDamageStack(stackValue, unitSystem) {
    EventBus.on(EVENTS.UNIT_DIED, ({ owner }) => {
      if (owner !== 'player') return;
      // Apply tiny damage boost to all living player units
      if (unitSystem) {
        for (const u of unitSystem.playerUnits) {
          u.applyDamageMultiplier(1 + stackValue);
        }
        // Also store for future spawns
        unitSystem.applyGlobalModifier('all', 'damage', 1 + stackValue);
      }
    });
  }

  _enableRaiseFallenEnemy(duration, unitSystem, spawnSystem) {
    let lastEnemyDead = null;
    EventBus.on(EVENTS.UNIT_DIED, ({ unit, owner }) => {
      if (owner === 'enemy') lastEnemyDead = unit;
    });
    // Every 30 seconds, raise the last fallen enemy
    setInterval(() => {
      if (lastEnemyDead && spawnSystem) {
        const raised = spawnSystem.spawnUnit(lastEnemyDead.id, 'player', true);
        if (raised) {
          setTimeout(() => raised.die(), duration * 1000);
        }
        lastEnemyDead = null;
      }
    }, 30_000);
  }

  _enableDeathSpawnChance(chance, spawnSystem, unitSystem) {
    EventBus.on(EVENTS.UNIT_DIED, ({ owner }) => {
      if (owner !== 'player') return;
      if (Math.random() < chance && spawnSystem) {
        // Spawn a random tier 1 unit for free
        const tier1Units = [...spawnSystem._unitDataMap.values()].filter(
          u => u.tier === 1 && u.hero === unitSystem?.playerUnits[0]?.hero,
        );
        if (tier1Units.length > 0) {
          const pick = tier1Units[Math.floor(Math.random() * tier1Units.length)];
          spawnSystem.spawnUnit(pick.id, 'player', true);
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query API
  // ─────────────────────────────────────────────────────────────────────────

  /** @returns {string[]} IDs of all active upgrades */
  getActiveUpgradeIds() {
    return this._activeUpgrades.map(u => u.id);
  }

  /** @returns {object[]} All active upgrade objects */
  getActiveUpgrades() {
    return [...this._activeUpgrades];
  }

  /**
   * Restore upgrades from a save state (re-applies all effects).
   * @param {string[]} upgradeIds
   * @param {object} systems
   */
  restoreUpgrades(upgradeIds, systems) {
    for (const id of upgradeIds) {
      const upgrade = this._allUpgrades.find(u => u.id === id);
      if (upgrade) this.applyUpgrade(upgrade, systems);
    }
  }

  /**
   * Clean up listeners.
   */
  destroy() {
    EventBus.off(EVENTS.UNIT_DIED, this._killListener);
  }
}
