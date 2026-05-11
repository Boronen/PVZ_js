/**
 * SeedTray.js — Bottom seed packet bar.
 *
 * Renders plant cards for the current loadout, shows cooldown
 * overlays, highlights selected card, and emits selection events.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/constants.js';

export class SeedTray {
  /**
   * @param {object}   resources  - ResourceManager
   */
  constructor(resources) {
    this._resources  = resources;
    this._container  = document.getElementById('seed-tray-inner');
    this._shovelBtn  = document.getElementById('btn-shovel');
    this._loadout     = [];
    this._cooldowns   = new Map(); // plantId → { timer, max }
    this._selectedId  = null;
    this._shovelMode  = false;
    this._sun         = 0;
    this._sunDiscount = 0;

    this._bindShovel();
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Initialise with the run's plant loadout.
   * @param {object[]} loadout - plant defs
   */
  init(loadout) {
    this._loadout = loadout;
    this._cooldowns.clear();
    for (const p of loadout) {
      this._cooldowns.set(p.id, { timer: 0, max: p.cooldown ?? 7.5 });
    }
    this._render();
  }

  /**
   * Update cooldown timers and sun affordability.
   * @param {number} dt
   * @param {number} sun
   * @param {number} [sunDiscount=0]  active perk sun discount
   */
  update(dt, sun, sunDiscount = 0) {
    this._sun         = sun;
    this._sunDiscount = sunDiscount;
    for (const [id, cd] of this._cooldowns) {
      if (cd.timer > 0) cd.timer = Math.max(0, cd.timer - dt);
    }
    this._refreshCards();
  }

  /**
   * Trigger cooldown for a plant after placement.
   * @param {string} plantId
   */
  startCooldown(plantId) {
    const cd = this._cooldowns.get(plantId);
    if (cd) cd.timer = cd.max;
    if (this._selectedId === plantId) this._deselect();
    this._refreshCards();
  }

  /** @returns {string|null} */
  getSelectedPlantId() { return this._selectedId; }

  /** @returns {boolean} */
  isShovelMode() { return this._shovelMode; }

  /** Deselect current plant. */
  deselect() { this._deselect(); }

  // ── Private — Render ─────────────────────────────────────────

  _render() {
    if (!this._container) return;
    this._container.innerHTML = '';
    for (const plant of this._loadout) {
      const card = this._buildCard(plant);
      this._container.appendChild(card);
    }
  }

  _buildCard(plant) {
    const card = document.createElement('div');
    card.className       = 'seed-packet';
    card.dataset.plantId = plant.id;

    const sprite = this._resources.getPlantSprite(plant.id);
    if (sprite) {
      const img = document.createElement('img');
      img.src       = sprite.src;
      img.className = 'seed-packet-sprite';
      img.alt       = plant.id;
      card.appendChild(img);
    } else {
      const fb = document.createElement('div');
      fb.className  = 'seed-packet-sprite-fallback';
      fb.textContent= plant.emoji ?? '🌱';
      card.appendChild(fb);
    }

    const cost = document.createElement('div');
    cost.className       = 'seed-packet-cost';
    cost.dataset.plantId = plant.id;
    cost.textContent     = `☀ ${plant.sunCost}`;
    card.appendChild(cost);

    const cdBar = document.createElement('div');
    cdBar.className       = 'seed-packet-cooldown-bar';
    cdBar.dataset.plantId = plant.id;
    card.appendChild(cdBar);

    const cdOverlay = document.createElement('div');
    cdOverlay.className       = 'seed-packet-cooldown-overlay';
    cdOverlay.dataset.plantId = plant.id;
    cdOverlay.style.display   = 'none';
    card.appendChild(cdOverlay);

    card.addEventListener('click', () => this._onCardClick(plant));
    return card;
  }

  _refreshCards() {
    if (!this._container) return;
    const discount = this._sunDiscount ?? 0;
    for (const plant of this._loadout) {
      const card    = this._container.querySelector(`[data-plant-id="${plant.id}"]`);
      if (!card) continue;
      const cd           = this._cooldowns.get(plant.id);
      const onCd         = cd && cd.timer > 0;
      const adjustedCost = Math.max(0, plant.sunCost - discount);
      const tooExp       = this._sun < adjustedCost;

      // Update displayed cost with discount applied
      const costEl = card.querySelector(`.seed-packet-cost`);
      if (costEl) costEl.textContent = `☀ ${adjustedCost}`;

      card.classList.toggle('on-cooldown',   onCd);
      card.classList.toggle('too-expensive', !onCd && tooExp);
      card.classList.toggle('selected',      this._selectedId === plant.id);

      const overlay = card.querySelector('.seed-packet-cooldown-overlay');
      const bar     = card.querySelector('.seed-packet-cooldown-bar');
      if (overlay && bar) {
        if (onCd) {
          overlay.style.display = 'flex';
          overlay.textContent   = Math.ceil(cd.timer) + 's';
          bar.style.width       = `${((cd.max - cd.timer) / cd.max) * 100}%`;
        } else {
          overlay.style.display = 'none';
          bar.style.width       = '100%';
        }
      }
    }
  }

  _onCardClick(plant) {
    const cd           = this._cooldowns.get(plant.id);
    const onCd         = cd && cd.timer > 0;
    const adjustedCost = Math.max(0, plant.sunCost - (this._sunDiscount ?? 0));
    const tooExp       = this._sun < adjustedCost;
    if (onCd || tooExp) return;

    if (this._shovelMode) this._toggleShovel(false);

    if (this._selectedId === plant.id) {
      this._deselect();
    } else {
      this._selectedId = plant.id;
      EventBus.emit(EVENTS.SEED_SELECTED, { plantId: plant.id });
    }
    this._refreshCards();
  }

  _deselect() {
    this._selectedId = null;
    EventBus.emit(EVENTS.SEED_DESELECTED, {});
    this._refreshCards();
  }

  _bindShovel() {
    this._shovelBtn?.addEventListener('click', () => {
      this._toggleShovel(!this._shovelMode);
    });
  }

  _toggleShovel(active) {
    this._shovelMode = active;
    this._shovelBtn?.classList.toggle('active', active);
    if (active) {
      this._selectedId = null;
      EventBus.emit(EVENTS.SHOVEL_TOGGLED, { active: true });
    } else {
      EventBus.emit(EVENTS.SHOVEL_TOGGLED, { active: false });
    }
    this._refreshCards();
  }
}
