/**
 * Plant.js — Extends Entity for all plant types.
 *
 * Handles attack timing, projectile creation, and special
 * plant behaviours (producer, wall, bomb, mine, ground).
 */

import { Entity } from './Entity.js';
import { EventBus } from '../core/EventBus.js';
import { EVENTS, GRID } from '../core/constants.js';

export class Plant extends Entity {
  /**
   * @param {object} def   - plant definition from plants.json
   * @param {number} row   - grid row (0–4)
   * @param {number} col   - grid column (0–8)
   * @param {HTMLImageElement|null} sprite
   * @param {object} perks - active perk modifiers
   */
  constructor(def, row, col, sprite, perks = {}) {
    const hpMult = perks.plantHpMult ?? 1;
    super({
      x:      GRID.ORIGIN_X + col * GRID.CELL_W + GRID.CELL_W / 2,
      y:      GRID.ORIGIN_Y + row * GRID.CELL_H + GRID.CELL_H / 2,
      hp:     Math.round(def.hp * hpMult),
      sprite,
      emoji:  def.emoji ?? '🌱',
    });

    this._def            = def;
    this.row             = row;
    this.col             = col;
    this.plantId         = def.id;
    this.type            = def.type;
    this.sunCost         = Math.max(0, (def.sunCost ?? 100) - (perks.sunDiscount ?? 0));
    this.damage          = Math.round((def.damage ?? 0) * (perks.plantDamageMult ?? 1));
    this.attackCooldown  = (def.attackCooldown ?? 1.5) * (perks.plantCooldownMult ?? 1);
    this._attackTimer    = 0;

    // Producer (sunflower)
    this._sunProductionInterval = (def.sunProductionInterval ?? 24) / (perks.sunProductionMult ?? 1);
    this._sunProductionTimer    = 0;
    this._sunProduction         = Math.round((def.sunProduction ?? 0) * (perks.sunProductionMult ?? 1));

    // Mine arm delay
    this._armDelay  = def.armDelay ?? 0;
    this._armTimer  = 0;
    this._armed     = this._armDelay === 0;

    // Slow (snow pea)
    this.slowFactor   = def.slowFactor   ?? 1;
    this.slowDuration = def.slowDuration ?? 0;

    // AoE (cherry bomb)
    this.aoeRadius = def.aoeRadius ?? 0;

    // Bomb / mine — explode on first attack
    this._exploded = false;
  }

  // ── Update ───────────────────────────────────────────────────

  /**
   * @param {number} dt
   * @param {import('./Zombie.js').Zombie[]} zombiesInRow
   * @param {import('./Projectile.js').Projectile[]} projectiles
   * @param {import('./SunToken.js').SunToken[]} sunTokens
   */
  update(dt, zombiesInRow, projectiles, sunTokens) {
    if (!this.alive) return;
    this._tickArmTimer(dt);
    this._tickAttackTimer(dt, zombiesInRow, projectiles);
    this._tickSunProduction(dt, sunTokens);
  }

  // ── Draw ─────────────────────────────────────────────────────

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../systems/AnimationSystem.js').AnimationSystem} [anim]
   */
  draw(ctx, anim) {
    if (!this.alive) return;
    const w     = GRID.CELL_W - 8;
    const h     = GRID.CELL_H - 8;
    const state = anim?.getState(this.id, 'plant');

    ctx.save();
    if (state) state.applyTransform(ctx, this.x, this.y);

    // Mine: dim if not armed
    if (this.type === 'mine' && !this._armed) ctx.globalAlpha *= 0.5;

    this._drawSprite(ctx, this.x, this.y, w, h);
    ctx.restore();

    // HP bar
    if (this.hp < this.maxHp) {
      this._drawHpBar(ctx, this.x, this.y + h / 2 + 2, w);
    }
  }

  // ── Private ──────────────────────────────────────────────────

  _tickArmTimer(dt) {
    if (this._armed) return;
    this._armTimer += dt;
    if (this._armTimer >= this._armDelay) this._armed = true;
  }

  _tickAttackTimer(dt, zombiesInRow, projectiles) {
    if (!this._armed) return;
    this._attackTimer += dt;
    if (this._attackTimer >= this.attackCooldown) {
      this._attackTimer = 0;
      this._tryAttack(zombiesInRow, projectiles);
    }
  }

  _tickSunProduction(dt, sunTokens) {
    if (this.type !== 'producer' || !sunTokens) return;
    this._sunProductionTimer += dt;
    if (this._sunProductionTimer >= this._sunProductionInterval) {
      this._sunProductionTimer = 0;
      this._produceSun(sunTokens);
    }
  }

  _produceSun(sunTokens) {
    EventBus.emit(EVENTS.SUN_DROPPED, {
      x:     this.x,
      y:     this.y - 20,
      value: this._sunProduction,
    });
  }

  _tryAttack(zombiesInRow, projectiles) {
    if (this.damage === 0) return;

    if (this.type === 'shooter') {
      this._shootProjectile(projectiles);
    } else if (this.type === 'bomb' && !this._exploded) {
      this._explode(zombiesInRow);
    } else if (this.type === 'mine' && zombiesInRow.length > 0 && !this._exploded) {
      this._explode(zombiesInRow);
    } else if (this.type === 'ground') {
      this._damageZombiesOnCell(zombiesInRow);
    } else if (this.type === 'melee') {
      this._meleeAttack(zombiesInRow);
    }
  }

  _shootProjectile(projectiles) {
    // Start projectile at right edge of plant cell
    EventBus.emit(EVENTS.PROJECTILE_HIT, {
      type:         'spawn',
      row:          this.row,
      x:            this.x + GRID.CELL_W / 2,
      y:            this.y - 4,
      damage:       this.damage,
      slowFactor:   this.slowFactor,
      slowDuration: this.slowDuration,
      ownerId:      this.id,
    });
    // Notify animation system via event
    EventBus.emit(EVENTS.PLANT_PLACED, { plant: this, animTrigger: 'attack' });
  }

  _explode(zombiesInRow) {
    this._exploded = true;
    EventBus.emit(EVENTS.PROJECTILE_HIT, {
      type:    'aoe',
      row:     this.row,
      col:     this.col,
      damage:  this.damage,
      radius:  this.aoeRadius,
      ownerId: this.id,
    });
    this._die();
  }

  _damageZombiesOnCell(zombiesInRow) {
    for (const z of zombiesInRow) {
      if (Math.abs(z.x - this.x) < GRID.CELL_W) {
        z.takeDamage(this.damage);
      }
    }
  }

  _meleeAttack(zombiesInRow) {
    const target = zombiesInRow.find(z => z.x <= this.x + GRID.CELL_W);
    if (target) target.takeDamage(this.damage);
  }

  _die() {
    super._die();
    EventBus.emit(EVENTS.PLANT_DIED, { plant: this });
  }
}
