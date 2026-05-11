/**
 * UpgradePopup.js — Upgrade selection overlay controller.
 *
 * Displays 3 upgrade cards with rarity styling.
 * Clicking a card emits upgrade:selected and closes the popup.
 */

import { EventBus, EVENTS } from '../core/EventBus.js';

export class UpgradePopup {
  /**
   * @param {GameManager} gameManager
   */
  constructor(gameManager) {
    this._gm = gameManager;
  }

  /**
   * Called by SceneManager when the upgrade popup becomes visible.
   * @param {object[]} offers - Array of upgrade definition objects
   */
  show(offers) {
    this._renderCards(offers || []);
  }

  hide() {
    const container = document.getElementById('upgrade-cards-container');
    if (container) container.innerHTML = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Card Rendering
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Render upgrade cards into the popup container.
   * @param {object[]} offers
   */
  _renderCards(offers) {
    const container = document.getElementById('upgrade-cards-container');
    if (!container) return;
    container.innerHTML = '';

    for (const upgrade of offers) {
      const card = this._buildCard(upgrade);
      container.appendChild(card);
    }
  }

  /**
   * Build a single upgrade card element.
   * @param {object} upgrade
   * @returns {HTMLElement}
   */
  _buildCard(upgrade) {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.dataset.rarity   = upgrade.rarity;
    card.dataset.upgradeId = upgrade.id;
    card.dataset.cy       = `upgrade-card-${upgrade.id}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Select upgrade: ${upgrade.name}`);

    // Rarity label
    const rarityLabel = document.createElement('span');
    rarityLabel.className = 'upgrade-rarity-label';
    rarityLabel.textContent = this._formatRarity(upgrade.rarity);
    card.appendChild(rarityLabel);

    // Name
    const name = document.createElement('div');
    name.className = 'upgrade-name';
    name.textContent = upgrade.name;
    card.appendChild(name);

    // Description
    const desc = document.createElement('div');
    desc.className = 'upgrade-description';
    desc.textContent = upgrade.description;
    card.appendChild(desc);

    // Drawback (cursed upgrades)
    if (upgrade.drawback) {
      const drawback = document.createElement('div');
      drawback.className = 'upgrade-drawback';
      drawback.textContent = `⚠ ${upgrade.drawback}`;
      card.appendChild(drawback);
    }

    // Click / keyboard handler
    const select = () => {
      this._gm.audioManager?.playSFX('upgrade_select');
      EventBus.emit(EVENTS.UPGRADE_SELECTED, { upgrade });
    };
    card.addEventListener('click', select);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') select();
    });

    return card;
  }

  /**
   * Format rarity string for display.
   * @param {string} rarity
   * @returns {string}
   */
  _formatRarity(rarity) {
    const labels = {
      common:    '◆ Common',
      rare:      '◆◆ Rare',
      epic:      '◆◆◆ Epic',
      legendary: '★ Legendary',
      cursed:    '☠ Cursed',
    };
    return labels[rarity] || rarity;
  }
}
