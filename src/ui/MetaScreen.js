/**
 * MetaScreen.js — Permanent unlock tree UI.
 *
 * Shows all meta-unlockable items with their seed costs.
 * Persists purchases via SaveManager.
 */

export class MetaScreen {
  /**
   * @param {object[]} plantDefs   - all plants (to find locked ones)
   * @param {object}   saveManager
   */
  constructor(plantDefs, saveManager) {
    this._plantDefs   = plantDefs;
    this._saveManager = saveManager;
    this._screen      = document.getElementById('screen-meta');
    this._grid        = document.getElementById('meta-unlock-grid');
    this._seedsEl     = document.getElementById('meta-seeds-available');
    this._backBtn     = document.getElementById('btn-meta-back');
    this._onBack      = null;
  }

  /**
   * Show the meta screen.
   * @param {Function} onBack
   */
  show(onBack) {
    this._onBack = onBack;
    this._render();
    this._screen?.classList.remove('hidden');
    this._backBtn?.addEventListener('click', () => {
      this.hide();
      this._onBack?.();
    }, { once: true });
  }

  hide() {
    this._screen?.classList.add('hidden');
  }

  // ── Private ──────────────────────────────────────────────────

  _render() {
    const meta = this._saveManager.loadMeta();
    if (this._seedsEl) this._seedsEl.textContent = meta.seeds;
    if (!this._grid) return;
    this._grid.innerHTML = '';

    for (const node of this._buildUnlockNodes()) {
      const el = this._buildNodeEl(node, meta);
      this._grid.appendChild(el);
    }
  }

  _buildUnlockNodes() {
    const nodes = [];

    // Locked plants
    for (const plant of this._plantDefs) {
      if (!plant.unlockId) continue;
      nodes.push({
        id:    plant.unlockId,
        name:  plant.id.replace(/_/g, ' '),
        icon:  plant.emoji ?? '🌱',
        cost:  30,
        type:  'plant',
      });
    }

    // Bonus unlocks
    nodes.push({ id: 'starting_sun_bonus', name: '+50 Starting Sun', icon: '☀️', cost: 20, type: 'bonus' });
    nodes.push({ id: 'extra_slot',         name: 'Extra Seed Slot',  icon: '🌿', cost: 50, type: 'bonus' });
    nodes.push({ id: 'coin_rate',          name: '+25% Coin Rate',   icon: '🪙', cost: 40, type: 'bonus' });

    return nodes;
  }

  _buildNodeEl(node, meta) {
    const owned     = meta.unlocks.includes(node.id);
    const canAfford = meta.seeds >= node.cost;

    const el = document.createElement('div');
    el.className = 'meta-unlock-node';
    if (owned)      el.classList.add('owned');
    else if (!canAfford) el.classList.add('cant-afford');

    el.innerHTML = `
      <div class="meta-node-icon">${node.icon}</div>
      <div class="meta-node-name">${node.name}</div>
      ${owned
        ? '<div class="meta-node-owned-badge">✓ Owned</div>'
        : `<div class="meta-node-cost">🌰 ${node.cost} seeds</div>`
      }
    `;

    if (!owned && canAfford) {
      el.addEventListener('click', () => this._purchase(node));
    }
    return el;
  }

  _purchase(node) {
    const meta = this._saveManager.loadMeta();
    if (meta.seeds < node.cost) return;
    meta.seeds -= node.cost;
    this._saveManager.saveMeta(meta);
    this._saveManager.addUnlock(node.id);
    this._render(); // re-render with updated state
  }
}
