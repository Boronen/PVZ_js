/**
 * DraftScreen.js — Run-start plant loadout draft UI.
 *
 * Shows DRAFT_POOL_SIZE plant cards; player picks DRAFT_PICK_COUNT.
 * Emits DRAFT_CONFIRMED when confirmed.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, RUN } from '../core/constants.js';

export class DraftScreen {
  /**
   * @param {object} resources - ResourceManager
   */
  constructor(resources) {
    this._resources  = resources;
    this._screen     = document.getElementById('screen-draft');
    this._container  = document.getElementById('draft-cards-container');
    this._slotsEl    = document.getElementById('draft-selected-slots');
    this._confirmBtn = document.getElementById('btn-draft-confirm');
    this._backBtn    = document.getElementById('btn-draft-back');
    this._selected   = [];
    this._onConfirm  = null;
    this._onBack     = null;
  }

  /**
   * Show the draft screen.
   * @param {object[]} plantPool  - pool of plant defs to choose from
   * @param {Function} onConfirm  - called with selected plant defs
   * @param {Function} onBack
   */
  show(plantPool, onConfirm, onBack) {
    this._selected  = [];
    this._onConfirm = onConfirm;
    this._onBack    = onBack;
    this._render(plantPool);
    this._screen?.classList.remove('hidden');
    this._bindButtons();
  }

  /** Hide the draft screen. */
  hide() {
    this._screen?.classList.add('hidden');
  }

  // ── Private ──────────────────────────────────────────────────

  _render(pool) {
    if (!this._container) return;
    this._container.innerHTML = '';
    for (const plant of pool) {
      const card = this._buildCard(plant);
      this._container.appendChild(card);
    }
    this._renderSlots();
    this._updateConfirmBtn();
  }

  _buildCard(plant) {
    const card = document.createElement('div');
    card.className       = 'plant-card';
    card.dataset.plantId = plant.id;

    const sprite = this._resources.getPlantSprite(plant.id);
    if (sprite) {
      const img = document.createElement('img');
      img.src       = sprite.src;
      img.className = 'plant-card-sprite';
      img.alt       = plant.id;
      card.appendChild(img);
    } else {
      const fb = document.createElement('div');
      fb.className  = 'plant-card-sprite-fallback';
      fb.textContent= plant.emoji ?? '🌱';
      card.appendChild(fb);
    }

    card.innerHTML += `
      <div class="plant-card-name">${plant.id.replace(/_/g, ' ')}</div>
      <div class="plant-card-cost">☀ ${plant.sunCost}</div>
      <div class="plant-card-desc">${plant.description ?? ''}</div>
    `;

    card.addEventListener('click', () => this._toggleSelect(plant, card));
    return card;
  }

  _toggleSelect(plant, card) {
    const idx = this._selected.findIndex(p => p.id === plant.id);
    if (idx !== -1) {
      this._selected.splice(idx, 1);
      card.classList.remove('selected');
    } else {
      if (this._selected.length >= RUN.DRAFT_PICK_COUNT) return;
      this._selected.push(plant);
      card.classList.add('selected');
    }
    this._renderSlots();
    this._updateConfirmBtn();
    this._refreshDisabledState();
  }

  _renderSlots() {
    if (!this._slotsEl) return;
    this._slotsEl.innerHTML = '';
    for (let i = 0; i < RUN.DRAFT_PICK_COUNT; i++) {
      const slot = document.createElement('div');
      slot.className = 'draft-slot' + (this._selected[i] ? ' filled' : '');
      slot.textContent = this._selected[i]?.emoji ?? '';
      this._slotsEl.appendChild(slot);
    }
  }

  _updateConfirmBtn() {
    const ready = this._selected.length === RUN.DRAFT_PICK_COUNT;
    if (this._confirmBtn) {
      this._confirmBtn.disabled = !ready;
      this._confirmBtn.classList.toggle('disabled', !ready);
    }
  }

  _refreshDisabledState() {
    const full = this._selected.length >= RUN.DRAFT_PICK_COUNT;
    const cards = this._container?.querySelectorAll('.plant-card') ?? [];
    for (const card of cards) {
      const isSelected = this._selected.some(p => p.id === card.dataset.plantId);
      card.classList.toggle('disabled', full && !isSelected);
    }
  }

  _bindButtons() {
    this._confirmBtn?.addEventListener('click', () => {
      if (this._selected.length < RUN.DRAFT_PICK_COUNT) return;
      this._onConfirm?.(this._selected);
      this.hide();
    }, { once: true });

    this._backBtn?.addEventListener('click', () => {
      this._onBack?.();
      this.hide();
    }, { once: true });
  }
}
