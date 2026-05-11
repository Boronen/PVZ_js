/**
 * Zombie.js — Extends Entity for all zombie types.
 *
 * Handles movement, melee attacking plants/lawnmowers,
 * and elite mutation modifiers.
 */

import { Entity } from './Entity.js';
import { EventBus } from '../core/EventBus.js';
import { EVENTS, GRID, CANVAS } from '../core/constants.js';

export class Zombie extends Entity {
  /**
   * @param {object} def      - zombie definition from zombies.json
   * @param {number} row      - grid row (0–4)
   * @param {object} [mutation] - elite mutation modifiers
   * @param {HTMLImageElement|null} sprite
   * @param {object} perks    - active perk modifiers (zombie_slow)
   */
  constructor(def, row, sprite = null, mutation = null, perks = {}) {
    const hpMult  = mutation?.hpMult    ?? 1;
    const spdMult = (mutation?.speedMult ?? 1) * (perks.zombieSlowMult ?? 1);
    const dmgMult = mutation?.damageMult ?? 1;

    super({
      x:      CANVAS.WIDTH + 60,
      y:      GRID.ORIGIN_Y + row * GRID.CELL_H + GRID.CELL_H / 2,
      hp:     Math.round(def.hp * hpMult),
      sprite,
      emoji:  def.emoji ?? '🧟',
    });

    this._def          = def;
    this.zombieId      = def.id;
    this.row           = row;
    this.speed         = def.speed * spdMult;
    this.damage        = Math.round(def.damage * dmgMult);
    this.attackCooldown= def.attackCooldown ?? 1.0;
    this._attackTimer  = 0;
    this.coinReward    = def.coinReward ?? 10;
    this.mutation      = mutation;

    // Enrage (newspaper zombie)
    this._enraged      = false;
    this._baseSpeed    = this.speed;

    // Vault (pole vaulting zombie)
    this._hasVaulted   = false;
    this._vaults       = def.vaults ?? false;

    // Slow state
    this._slowTimer    = 0;
    this._slowFactor   = 1;

    // Target plant being attacked
    this._targetPlant  = null;
  }

  // ── Update ───────────────────────────────────────────────────

  /**
   * @param {number} dt
   * @param {import('./Plant.js').Plant[]} plantsInRow
   */
  update(dt, plantsInRow) {
    if (!this.alive) return;
    this._tickSlow(dt);
    this._targetPlant = this._findBlockingPlant(plantsInRow);

    if (this._targetPlant) {
      this._tickAttack(dt, this._targetPlant);
    } else {
      this._move(dt);
      this._checkReachedHouse();
    }
  }

  // ── Draw ─────────────────────────────────────────────────────

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../systems/AnimationSystem.js').AnimationSystem} [anim]
   */
  draw(ctx, anim) {
    if (!this.alive) return;
    const w     = GRID.CELL_W - 4;
    const h     = GRID.CELL_H - 4;
    const state = anim?.getState(this.id, 'zombie');

    ctx.save();

    // Apply walk/death animation transform
    if (state) state.applyTransform(ctx, this.x, this.y);

    // Elite glow
    if (this.mutation) {
      ctx.shadowColor = this.mutation.color ?? '#ff0000';
      ctx.shadowBlur  = 14;
    }

    this._drawSprite(ctx, this.x, this.y, w, h);
    ctx.restore();

    // HP bar and elite badge drawn without transform
    this._drawHpBar(ctx, this.x, this.y + h / 2 + 2, w);

    if (this.mutation) {
      ctx.fillStyle    = this.mutation.color ?? '#ff0000';
      ctx.font         = 'bold 9px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`★ ${this.mutation.name}`, this.x, this.y - h / 2 - 2);
    }
  }

  // ── Public ───────────────────────────────────────────────────

  /**
   * Apply a slow effect.
   * @param {number} factor    0–1 speed multiplier
   * @param {number} duration  seconds
   */
  applySlow(factor, duration) {
    this._slowFactor = Math.min(this._slowFactor, factor);
    this._slowTimer  = Math.max(this._slowTimer, duration);
  }

  // ── Private ──────────────────────────────────────────────────

  _move(dt) {
    const effectiveSpeed = this.speed * this._slowFactor;
    this.x -= effectiveSpeed * dt;
  }

  _checkReachedHouse() {
    if (this.x <= GRID.ORIGIN_X - GRID.CELL_W) {
      EventBus.emit(EVENTS.ZOMBIE_REACHED_HOUSE, { zombie: this, row: this.row });
    }
  }

  _findBlockingPlant(plantsInRow) {
    return plantsInRow.find(p =>
      p.alive && p.x >= this.x - 4 && p.x <= this.x + GRID.CELL_W
    ) ?? null;
  }

  _tickAttack(dt, plant) {
    this._attackTimer += dt;
    if (this._attackTimer >= this.attackCooldown) {
      this._attackTimer = 0;
      plant.takeDamage(this.damage);
      EventBus.emit(EVENTS.PROJECTILE_HIT, {
        type: 'melee', zombieId: this.id, plantId: plant.id,
      });
      this._checkEnrage(plant);
    }
  }

  _checkEnrage(plant) {
    if (this._def.enragedSpeed && !this._enraged && !plant.alive) {
      this._enraged = true;
      this.speed    = this._def.enragedSpeed * (this.mutation?.speedMult ?? 1);
    }
  }

  _tickSlow(dt) {
    if (this._slowTimer <= 0) { this._slowFactor = 1; return; }
    this._slowTimer -= dt;
    if (this._slowTimer <= 0) this._slowFactor = 1;
  }

  _die() {
    super._die();
    EventBus.emit(EVENTS.ZOMBIE_DIED, { zombie: this, coinReward: this.coinReward });
  }
}
