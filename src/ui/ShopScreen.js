/**
 * ShopScreen.js — Between-wave perk shop UI.
 *
 * Shows 3 random perk cards. Player spends coins to buy one.
 * Emits PERK_PURCHASED via RoguelikeManager.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/constants.js';

export class ShopScreen {
  constructor() {
    this._screen    = document.getElementById('screen-shop');
    this._container = document.getElementById('shop-cards-container');
    this._coinsEl   = document.getElementById('shop-coins-value');
    this._skipBtn   = document.getElementById('btn-shop-skip');
    this._onSkip    = null;
  }

  /**
   * Show the shop with given perks and current coins.
   * @param {object[]} perks
   * @param {number}   coins
   * @param {Function} onPurchase  called with (perk)
   * @param {Function} onSkip
   */
  show(perks, coins, onPurchase, onSkip) {
    this._onSkip = onSkip;
    this._render(perks, coins, onPurchase);
    this._screen?.classList.remove('hidden');
    this._skipBtn?.addEventListener('click', this._handleSkip.bind(this), { once: true });
  }

  /** Hide the shop. */
  hide() {
    this._screen?.classList.add('hidden');
    if (this._container) this._container.innerHTML = '';
  }

  // ── Private ──────────────────────────────────────────────────

  _render(perks, coins, onPurchase) {
    if (!this._container) return;
    this._container.innerHTML = '';
    this._updateCoins(coins);

    for (const perk of perks) {
      const card = this._buildPerkCard(perk, coins, onPurchase);
      this._container.appendChild(card);
    }
  }

  _buildPerkCard(perk, coins, onPurchase) {
    const card = document.createElement('div');
    card.className = `perk-card rarity-${perk.rarity}`;
    if (coins < perk.cost) card.classList.add('cant-afford');

    card.innerHTML = `
      <div class="perk-rarity-badge">${perk.rarity}</div>
      <div class="perk-card-icon">${perk.icon ?? '⭐'}</div>
      <div class="perk-card-name">${perk.name}</div>
      <div class="perk-card-desc">${perk.description}</div>
      <div class="perk-card-cost"><span>🪙</span>${perk.cost}</div>
    `;

    if (coins >= perk.cost) {
      card.addEventListener('click', () => {
        onPurchase(perk);
        this.hide();
      });
    }
    return card;
  }

  _updateCoins(coins) {
    if (this._coinsEl) this._coinsEl.textContent = coins;
  }

  _handleSkip() {
    this.hide();
    this._onSkip?.();
  }
}
