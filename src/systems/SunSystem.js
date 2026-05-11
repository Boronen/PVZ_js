/**
 * SunSystem.js — Manages sun economy.
 *
 * Handles:
 *  - Sky sun drops on a timer
 *  - Sun tokens produced by sunflowers (via EventBus)
 *  - Click-to-collect sun tokens
 *  - Sun balance tracking
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, SUN, GRID } from '../core/constants.js';
import { SunToken } from '../entities/SunToken.js';

export class SunSystem {
  /**
   * @param {number} startingSun
   */
  constructor(startingSun = SUN.STARTING) {
    this._sun      = startingSun;
    this._tokens   = [];
    this._skyTimer = SUN.SKY_INTERVAL * 0.5; // first drop sooner
    this._listening = false;
    this._bindEvents();
  }

  // ── Public API ───────────────────────────────────────────────

  /** @returns {number} */
  getSun() { return this._sun; }

  /**
   * Spend sun. Returns false if insufficient.
   * @param {number} amount
   * @returns {boolean}
   */
  spendSun(amount) {
    if (this._sun < amount) return false;
    this._sun -= amount;
    EventBus.emit(EVENTS.SUN_CHANGED, { sun: this._sun });
    return true;
  }

  /** @returns {SunToken[]} */
  getTokens() { return this._tokens; }

  /**
   * Update sky drops and token lifetimes.
   * @param {number} dt
   */
  update(dt) {
    this._tickSkyDrop(dt);
    this._updateTokens(dt);
  }

  /**
   * Handle a canvas click — try to collect a sun token.
   * @param {number} canvasX
   * @param {number} canvasY
   * @returns {boolean}
   */
  handleClick(canvasX, canvasY) {
    for (const token of this._tokens) {
      if (token.tryCollect(canvasX, canvasY)) return true;
    }
    return false;
  }

  /**
   * Add sun directly (perk bonus).
   * @param {number} amount
   */
  addSun(amount) {
    this._sun += amount;
    EventBus.emit(EVENTS.SUN_CHANGED, { sun: this._sun });
  }

  /** Reset for new run. */
  reset(startingSun = SUN.STARTING) {
    this._sun      = startingSun;
    this._tokens   = [];
    this._skyTimer = SUN.SKY_INTERVAL * 0.5;
  }

  // ── Private ──────────────────────────────────────────────────

  _bindEvents() {
    // Sunflower production drops a token at its position
    EventBus.on(EVENTS.SUN_DROPPED, (data) => {
      this._spawnToken(data.x, data.y, data.value);
    });

    // Token collected → add to balance
    EventBus.on(EVENTS.SUN_COLLECTED, (data) => {
      this._sun += data.value;
    });

    // Perk bonus sun (bonusSun field only — avoids re-emit loop)
    EventBus.on(EVENTS.SUN_CHANGED, (data) => {
      if (data.bonusSun) {
        this._sun += data.bonusSun;
      }
    });
  }

  _tickSkyDrop(dt) {
    this._skyTimer -= dt;
    if (this._skyTimer <= 0) {
      this._skyTimer = SUN.SKY_INTERVAL + (Math.random() * 4 - 2);
      this._dropSkySun();
    }
  }

  _dropSkySun() {
    const gridLeft  = GRID.ORIGIN_X;
    const gridRight = GRID.ORIGIN_X + GRID.COLS * GRID.CELL_W;
    const x         = gridLeft + Math.random() * (gridRight - gridLeft);
    const y         = GRID.ORIGIN_Y - 40;
    const value     = Math.random() < 0.5 ? SUN.SKY_DROP_MIN : SUN.SKY_DROP_MAX;
    this._spawnToken(x, y, value);
  }

  _spawnToken(x, y, value) {
    this._tokens.push(new SunToken(x, y, value));
  }

  _updateTokens(dt) {
    for (const t of this._tokens) t.update(dt);
    this._tokens = this._tokens.filter(t => t.alive);
  }
}
