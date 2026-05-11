/**
 * SunToken.js — A collectible sun token that falls from the sky
 * or is produced by a Sunflower.
 *
 * Clicking/tapping within collect radius adds sun to the player.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, SUN } from '../core/constants.js';

let _sunId = 1;

export class SunToken {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} value  - sun amount (25 or 50)
   */
  constructor(x, y, value = 25) {
    this.id        = `sun_${_sunId++}`;
    this.x         = x;
    this.y         = y;
    this.value     = value;
    this.alive     = true;
    this._lifetime = SUN.LIFETIME;
    this._fallSpeed= SUN.FALL_SPEED;
    this._targetY  = y + 60 + Math.random() * 40;
    this._falling  = true;
    this._alpha    = 1;
  }

  // ── Update ───────────────────────────────────────────────────

  /** @param {number} dt */
  update(dt) {
    if (!this.alive) return;
    this._tickFall(dt);
    this._tickLifetime(dt);
  }

  // ── Draw ─────────────────────────────────────────────────────

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.globalAlpha = this._alpha;
    ctx.font        = '28px serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText('☀️', this.x, this.y);

    // Value label
    ctx.font      = 'bold 11px sans-serif';
    ctx.fillStyle = '#7a5000';
    ctx.fillText(String(this.value), this.x, this.y + 18);
    ctx.restore();
  }

  // ── Public ───────────────────────────────────────────────────

  /**
   * Attempt to collect this token.
   * @param {number} clickX
   * @param {number} clickY
   * @returns {boolean} true if collected
   */
  tryCollect(clickX, clickY) {
    if (!this.alive) return false;
    const dx   = clickX - this.x;
    const dy   = clickY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= SUN.COLLECT_RADIUS) {
      this._collect();
      return true;
    }
    return false;
  }

  // ── Private ──────────────────────────────────────────────────

  _tickFall(dt) {
    if (!this._falling) return;
    this.y += this._fallSpeed * dt;
    if (this.y >= this._targetY) {
      this.y       = this._targetY;
      this._falling = false;
    }
  }

  _tickLifetime(dt) {
    this._lifetime -= dt;
    if (this._lifetime < 2) {
      this._alpha = Math.max(0, this._lifetime / 2);
    }
    if (this._lifetime <= 0) this.alive = false;
  }

  _collect() {
    this.alive = false;
    EventBus.emit(EVENTS.SUN_COLLECTED, { value: this.value, x: this.x, y: this.y });
  }
}
