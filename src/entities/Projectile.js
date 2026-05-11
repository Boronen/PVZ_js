/**
 * Projectile.js — A pea/fireball shot by a plant.
 *
 * Travels left-to-right across a grid row.
 * Carries damage, optional slow effect, and owner reference.
 */

import { CANVAS } from '../core/constants.js';

export class Projectile {
  /**
   * @param {object} opts
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {number} opts.row
   * @param {number} opts.damage
   * @param {number} [opts.speed]
   * @param {number} [opts.slowFactor]
   * @param {number} [opts.slowDuration]
   * @param {string} [opts.ownerId]
   * @param {boolean} [opts.fire]
   */
  constructor({ x, y, row, damage, speed = 300, slowFactor = 1,
                slowDuration = 0, ownerId = '', fire = false }) {
    this.x            = x;
    this.y            = y;
    this.row          = row;
    this.damage       = damage;
    this.speed        = speed;
    this.slowFactor   = slowFactor;
    this.slowDuration = slowDuration;
    this.ownerId      = ownerId;
    this.fire         = fire;
    this.alive        = true;
  }

  // ── Update ───────────────────────────────────────────────────

  /** @param {number} dt */
  update(dt) {
    this.x += this.speed * dt;
  }

  /** @returns {boolean} */
  isOffScreen() {
    return this.x > CANVAS.WIDTH + 20;
  }

  // ── Draw ─────────────────────────────────────────────────────

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    if (!this.alive) return;
    const radius = this.fire ? 7 : 5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this._getColor();
    ctx.fill();

    if (this.fire) {
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur  = 10;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }
  }

  // ── Private ──────────────────────────────────────────────────

  _getColor() {
    if (this.fire)              return '#ff6600';
    if (this.slowFactor < 1)    return '#64b5f6';
    return '#4caf50';
  }
}
