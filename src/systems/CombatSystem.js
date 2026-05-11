/**
 * CombatSystem.js — Manages projectiles and hit detection.
 *
 * Spawns projectiles from plant attack events, moves them,
 * detects zombie hits, applies damage and slow effects,
 * and handles AoE explosions.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, GRID } from '../core/constants.js';
import { Projectile } from '../entities/Projectile.js';

export class CombatSystem {
  constructor() {
    /** @type {Projectile[]} */
    this._projectiles = [];

    this._bindEvents();
  }

  // ── Public API ───────────────────────────────────────────────

  /** @returns {Projectile[]} */
  getProjectiles() { return this._projectiles; }

  /**
   * Update all projectiles and check for hits.
   * @param {number} dt
   * @param {import('../entities/Zombie.js').Zombie[]} zombies
   */
  update(dt, zombies) {
    this._moveProjectiles(dt);
    this._checkHits(zombies);
    this._pruneDeadProjectiles();
  }

  /** Clear all projectiles (new run). */
  reset() { this._projectiles = []; }

  // ── Private — Event Binding ──────────────────────────────────

  _bindEvents() {
    EventBus.on(EVENTS.PROJECTILE_HIT, (data) => {
      if (data.type === 'spawn') this._spawnProjectile(data);
    });
  }

  _spawnProjectile(data) {
    const proj = new Projectile({
      x:            data.x,
      y:            data.y,
      row:          data.row,
      damage:       data.damage,
      slowFactor:   data.slowFactor ?? 1,
      slowDuration: data.slowDuration ?? 0,
      ownerId:      data.ownerId,
      fire:         data.fire ?? false,
    });
    this._projectiles.push(proj);
  }

  // ── Private — Update ─────────────────────────────────────────

  _moveProjectiles(dt) {
    for (const p of this._projectiles) {
      if (p.alive) p.update(dt);
    }
  }

  _checkHits(zombies) {
    for (const proj of this._projectiles) {
      if (!proj.alive) continue;
      if (proj.isOffScreen()) { proj.alive = false; continue; }
      this._checkProjectileVsZombies(proj, zombies);
    }
  }

  _checkProjectileVsZombies(proj, zombies) {
    for (const zombie of zombies) {
      if (!zombie.alive) continue;
      if (zombie.row !== proj.row) continue;
      if (!this._overlaps(proj, zombie)) continue;

      zombie.takeDamage(proj.damage);
      if (proj.slowFactor < 1) {
        zombie.applySlow(proj.slowFactor, proj.slowDuration);
      }
      proj.alive = false;
      return; // stop after first hit
    }
  }

  /**
   * Handle AoE explosion from cherry bomb / potato mine.
   * @param {object} data  { row, col, damage, radius }
   * @param {import('../entities/Zombie.js').Zombie[]} zombies
   */
  applyAoe(data, zombies) {
    const { row, col, damage, radius } = data;
    for (const zombie of zombies) {
      if (!zombie.alive) continue;
      const zRow = zombie.row;
      const zCol = Math.floor((zombie.x - GRID.ORIGIN_X) / GRID.CELL_W);
      if (Math.abs(zRow - row) <= radius && Math.abs(zCol - col) <= radius) {
        zombie.takeDamage(damage);
      }
    }
  }

  // ── Private — Helpers ────────────────────────────────────────

  _overlaps(proj, zombie) {
    // Wider x-range so projectiles hit zombies at exact plant position
    return Math.abs(proj.x - zombie.x) < 36 && Math.abs(proj.y - zombie.y) < 36;
  }

  _pruneDeadProjectiles() {
    this._projectiles = this._projectiles.filter(p => p.alive);
  }
}
