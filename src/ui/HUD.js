/**
 * HUD.js — Top bar HUD: sun, wave, health, coins, active perks.
 * Updates DOM elements every frame from GameManager state.
 */

export class HUD {
  constructor() {
    this._sunEl      = document.getElementById('hud-sun-value');
    this._waveEl     = document.getElementById('hud-wave-value');
    this._healthFill = document.getElementById('hud-health-fill');
    this._healthText = document.getElementById('hud-health-text');
    this._coinsEl    = document.getElementById('hud-coins-value');
    this._perksEl    = document.getElementById('hud-perks');
  }

  /**
   * Refresh all HUD values.
   * @param {object} state
   * @param {number} state.sun
   * @param {number} state.wave
   * @param {number} state.totalWaves
   * @param {number} state.lawnmowers   total lawnmowers remaining
   * @param {number} state.coins
   * @param {object[]} state.activePerks
   */
  update({ sun, wave, totalWaves, lawnmowers, coins, activePerks }) {
    this._setSun(sun);
    this._setWave(wave, totalWaves);
    this._setHealth(lawnmowers);
    this._setCoins(coins);
    this._setPerks(activePerks);
  }

  // ── Private ──────────────────────────────────────────────────

  _setSun(sun) {
    if (this._sunEl) this._sunEl.textContent = sun;
  }

  _setWave(wave, total) {
    if (this._waveEl) this._waveEl.textContent = `${wave} / ${total}`;
  }

  _setHealth(lawnmowers) {
    const max   = 5; // GRID.ROWS
    const ratio = Math.max(0, Math.min(1, lawnmowers / max));
    if (this._healthFill) this._healthFill.style.width = `${ratio * 100}%`;
    if (this._healthText) this._healthText.textContent = `${lawnmowers} / ${max}`;
  }

  _setCoins(coins) {
    if (this._coinsEl) this._coinsEl.textContent = coins;
  }

  _setPerks(perks) {
    if (!this._perksEl) return;
    this._perksEl.innerHTML = '';
    for (const perk of perks) {
      const badge = document.createElement('div');
      badge.className       = 'perk-icon-badge';
      badge.textContent     = perk.icon ?? '⭐';
      badge.dataset.tooltip = perk.name;
      this._perksEl.appendChild(badge);
    }
  }
}
