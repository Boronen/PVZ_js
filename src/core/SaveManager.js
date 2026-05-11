/**
 * SaveManager.js — Handles localStorage persistence.
 *
 * Two storage buckets:
 *  - META save: permanent meta-currency and unlocks (survives permadeath)
 *  - RUN save:  current run state (cleared on permadeath/victory)
 */

const META_KEY = 'pvz_rogue_meta';
const RUN_KEY  = 'pvz_rogue_run';

export class SaveManager {
  constructor() {
    this._metaCache = null;
  }

  // ── Meta Persistence (permanent) ────────────────────────────

  /** @returns {{ seeds: number, unlocks: string[] }} */
  loadMeta() {
    if (this._metaCache) return this._metaCache;
    try {
      const raw = localStorage.getItem(META_KEY);
      this._metaCache = raw ? JSON.parse(raw) : this._defaultMeta();
    } catch {
      this._metaCache = this._defaultMeta();
    }
    return this._metaCache;
  }

  /** @param {{ seeds: number, unlocks: string[] }} meta */
  saveMeta(meta) {
    this._metaCache = meta;
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (err) {
      console.warn('[SaveManager] Could not write meta save:', err);
    }
  }

  /** @param {number} amount */
  addSeeds(amount) {
    const meta = this.loadMeta();
    meta.seeds = (meta.seeds || 0) + amount;
    this.saveMeta(meta);
  }

  /** @param {string} unlockId */
  addUnlock(unlockId) {
    const meta = this.loadMeta();
    if (!meta.unlocks.includes(unlockId)) {
      meta.unlocks.push(unlockId);
      this.saveMeta(meta);
    }
  }

  /** @param {string} unlockId @returns {boolean} */
  hasUnlock(unlockId) {
    return this.loadMeta().unlocks.includes(unlockId);
  }

  // ── Run Persistence (cleared on death/win) ───────────────────

  /** @param {object} runState */
  saveRun(runState) {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(runState));
    } catch (err) {
      console.warn('[SaveManager] Could not write run save:', err);
    }
  }

  /** @returns {object|null} */
  loadRun() {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  hasRun() {
    return localStorage.getItem(RUN_KEY) !== null;
  }

  clearRun() {
    localStorage.removeItem(RUN_KEY);
  }

  // ── Private ──────────────────────────────────────────────────

  _defaultMeta() {
    return { seeds: 0, unlocks: [] };
  }
}
