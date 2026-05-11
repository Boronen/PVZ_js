/**
 * AISystem.js — Controls the enemy base and spawns enemy units.
 *
 * Responsibilities:
 * - Run a decision loop every 2–4 seconds (difficulty-dependent)
 * - Manage AI gold and XP economy in parallel to the player
 * - Select units based on counter-picking logic
 * - Execute surge behavior (mass spawn when gold threshold is met)
 * - Unlock AI tiers at fixed time thresholds
 * - Scale income and aggression over time
 */

import { EventBus, EVENTS } from '../core/EventBus.js';

export class AISystem {
  /**
   * @param {object}        profile     - AI difficulty profile from ai_profiles.json
   * @param {object}        gameData    - Full game data (units, counterPickRules, scalingRules)
   * @param {UnitSystem}    unitSystem
   * @param {EconomySystem} _playerEconomy - Player economy (unused directly, reserved)
   */
  constructor(profile, gameData, unitSystem, _playerEconomy) {
    this._profile     = profile;
    this._gameData    = gameData;
    this._unitSystem  = unitSystem;
    this._spawnSystem = null;
    this._enemyBase   = null;

    // AI economy
    this._gold = profile.startingGold || 100;
    this._xp   = 0;

    // Passive income timers
    this._goldTickTimer  = 0;
    this._goldTickInterval = profile.passiveGoldTickInterval || 3;
    this._xpTickTimer    = 0;
    this._xpTickInterval = profile.passiveXpTickInterval || 5;

    // Decision loop
    this._decisionTimer           = 0;
    this._nextDecisionInterval    = this._rollDecisionInterval();

    // Tier state
    this._currentTier = 1;

    // Run time tracking (for scaling)
    this._runTime = 0;
    this._scalingRules = gameData.scalingRules || {};

    // Build unit pools by tier
    this._unitPool = {
      1: gameData.units.filter(u => u.tier === 1),
      2: gameData.units.filter(u => u.tier === 2),
      3: gameData.units.filter(u => u.tier === 3),
    };

    this._counterPickRules = gameData.counterPickRules || [];
  }

  /** @param {SpawnSystem} spawnSystem */
  setSpawnSystem(spawnSystem) {
    this._spawnSystem = spawnSystem;
  }

  /** @param {Base} base */
  setBase(base) {
    this._enemyBase = base;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {number} dt
   * @param {number} runTimer
   */
  update(dt, runTimer) {
    this._runTime = runTimer;
    this._updateEconomy(dt, runTimer);
    this._checkTierUnlocks(runTimer);

    this._decisionTimer += dt;
    if (this._decisionTimer >= this._nextDecisionInterval) {
      this._decisionTimer = 0;
      this._nextDecisionInterval = this._rollDecisionInterval();
      this._makeDecision();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Economy
  // ─────────────────────────────────────────────────────────────────────────

  _updateEconomy(dt, runTimer) {
    const incomeScale = this._getIncomeScale(runTimer);

    this._goldTickTimer += dt;
    if (this._goldTickTimer >= this._goldTickInterval) {
      this._goldTickTimer -= this._goldTickInterval;
      const income = Math.round(
        (this._profile.passiveGoldPerTick || 5) *
        (this._profile.incomeMultiplier || 1) *
        incomeScale,
      );
      this._gold += income;
    }

    this._xpTickTimer += dt;
    if (this._xpTickTimer >= this._xpTickInterval) {
      this._xpTickTimer -= this._xpTickInterval;
      this._xp += Math.round(
        (this._profile.passiveXpPerTick || 3) *
        (this._profile.xpMultiplier || 1),
      );
    }
  }

  _getIncomeScale(runTimer) {
    const scalePerMin = this._scalingRules.incomeScalePerMinute || 0.05;
    const maxScale    = this._scalingRules.maxIncomeScaleMultiplier || 1.5;
    return Math.min(maxScale, 1 + scalePerMin * (runTimer / 60));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tier Unlocks
  // ─────────────────────────────────────────────────────────────────────────

  _checkTierUnlocks(runTimer) {
    if (this._currentTier < 2 && runTimer >= (this._profile.tier2UnlockTime || 90)) {
      this._currentTier = 2;
      EventBus.emit(EVENTS.AI_TIER_UNLOCKED, { tier: 2 });
    }
    if (this._currentTier < 3 && runTimer >= (this._profile.tier3UnlockTime || 180)) {
      this._currentTier = 3;
      EventBus.emit(EVENTS.AI_TIER_UNLOCKED, { tier: 3 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Decision Loop
  // ─────────────────────────────────────────────────────────────────────────

  _makeDecision() {
    if (!this._spawnSystem) return;

    // Surge check
    if (
      this._profile.surgeEnabled &&
      this._gold >= (this._profile.surgeGoldThreshold || 200) &&
      Math.random() < this._getSurgeChance()
    ) {
      this._executeSurge();
      return;
    }

    // Normal: spawn one unit
    const unitId = this._selectUnit();
    if (!unitId) return;

    const unitData = this._gameData.units.find(u => u.id === unitId);
    if (!unitData || this._gold < unitData.cost) return;

    this._gold -= unitData.cost;
    this._spawnSystem.spawnEnemyUnit(unitId);
  }

  _executeSurge() {
    const count = this._profile.surgeUnitCount || 3;
    EventBus.emit(EVENTS.AI_SURGE, { count });

    for (let i = 0; i < count; i++) {
      const unitId = this._selectUnit();
      if (!unitId) continue;
      const unitData = this._gameData.units.find(u => u.id === unitId);
      if (!unitData || this._gold < unitData.cost) continue;
      this._gold -= unitData.cost;
      this._spawnSystem.spawnEnemyUnit(unitId);
    }
  }

  _selectUnit() {
    const available = this._getAvailableUnits();
    if (available.length === 0) return null;

    // Counter-pick
    if (
      this._profile.counterPickEnabled &&
      Math.random() < (this._profile.counterPickWeight || 0.5)
    ) {
      const counter = this._getCounterUnit(available);
      if (counter) return counter.id;
    }

    return this._preferenceWeightedPick(available)?.id || null;
  }

  _getAvailableUnits() {
    const units = [];
    for (let t = 1; t <= this._currentTier; t++) {
      units.push(...(this._unitPool[t] || []));
    }
    return units.filter(u => u.cost <= this._gold);
  }

  _getCounterUnit(available) {
    const { melee, ranged, tank } = this._unitSystem.getUnitTypeCounts('player');

    for (const rule of this._counterPickRules) {
      let met = false;
      switch (rule.condition) {
        case 'playerRangedDominant': met = ranged > (melee + tank) * rule.threshold; break;
        case 'playerTankDominant':   met = tank   > ranged * rule.threshold; break;
        case 'playerMeleeDominant':  met = melee  > ranged * rule.threshold; break;
      }
      if (met) {
        const preferred = available.filter(u => u.type === rule.preferredType);
        if (preferred.length > 0) {
          return preferred[Math.floor(Math.random() * preferred.length)];
        }
      }
    }
    return null;
  }

  _preferenceWeightedPick(available) {
    const prefs = this._profile.unitPreferences || { melee: 0.4, ranged: 0.35, tank: 0.25 };
    const weighted = [];
    for (const unit of available) {
      const w = Math.round((prefs[unit.type] || 0.33) * 10);
      for (let i = 0; i < w; i++) weighted.push(unit);
    }
    if (weighted.length === 0) return available[0] || null;
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  _rollDecisionInterval() {
    const min = this._profile.decisionIntervalMin || 2;
    const max = this._profile.decisionIntervalMax || 4;
    return min + Math.random() * (max - min);
  }

  _getSurgeChance() {
    const base       = this._profile.surgeChance || 0.15;
    const scalePerMin = this._scalingRules.surgeChanceScalePerMinute || 0.02;
    const maxChance  = this._scalingRules.maxSurgeChance || 0.5;
    return Math.min(maxChance, base + scalePerMin * (this._runTime / 60));
  }

  /** @returns {number} Current AI gold (for test API) */
  getGold() { return this._gold; }

  /** @returns {number} Current AI tier */
  getTier() { return this._currentTier; }
}
