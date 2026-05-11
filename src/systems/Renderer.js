/**
 * Renderer.js — Renders the game lane on the HTML5 Canvas.
 *
 * Renders (in order each frame):
 * 1. Background (gradient sky + ground)
 * 2. Lane ground line
 * 3. Bases (player left, enemy right)
 * 4. Units (sorted by x position, with health bars)
 * 5. Projectiles
 * 6. Status effect icons
 * 7. Death animations (lingering dead units)
 */

import { UNIT_STATE } from '../entities/Unit.js';
import { CANVAS } from '../core/constants.js';

/** Lane Y center */
const LANE_Y = CANVAS.LANE_Y;
/** Unit render height */
const UNIT_H = 56;
/** Unit render width */
const UNIT_W = 40;
/** HP bar height */
const HP_BAR_H = 5;
/** HP bar width */
const HP_BAR_W = 36;

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   * @param {UnitSystem} unitSystem
   * @param {object[]} unitDataList
   */
  constructor(canvas, ctx, unitSystem, unitDataList) {
    this._canvas     = canvas;
    this._ctx        = ctx;
    this._unitSystem = unitSystem;
    this._playerBase = null;
    this._enemyBase  = null;

    /** @type {Map<string, HTMLImageElement>} Loaded sprite images */
    this._sprites = new Map();

    /** @type {Map<string, object>} Unit data by id for icon lookup */
    this._unitDataMap = new Map(unitDataList.map(u => [u.id, u]));

    // Animation frame timer
    this._animTimer = 0;
  }

  /**
   * Inject base references.
   * @param {Base} playerBase
   * @param {Base} enemyBase
   */
  setBases(playerBase, enemyBase) {
    this._playerBase = playerBase;
    this._enemyBase  = enemyBase;
  }

  /**
   * Register a loaded sprite image.
   * @param {string} key
   * @param {HTMLImageElement} img
   */
  registerSprite(key, img) {
    this._sprites.set(key, img);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Render one frame.
   * @param {number} dt
   */
  render(dt) {
    this._animTimer += dt;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);

    this._drawBackground(ctx);
    this._drawLane(ctx);
    this._drawBases(ctx);
    this._drawUnits(ctx, dt);
    this._drawProjectiles(ctx);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Background
  // ─────────────────────────────────────────────────────────────────────────

  _drawBackground(ctx) {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, LANE_Y - 60);
    skyGrad.addColorStop(0, '#0a0a1e');
    skyGrad.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS.WIDTH, LANE_Y - 60);

    // Ground gradient
    const groundGrad = ctx.createLinearGradient(0, LANE_Y - 60, 0, CANVAS.HEIGHT);
    groundGrad.addColorStop(0, '#1a1a2e');
    groundGrad.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, LANE_Y - 60, CANVAS.WIDTH, CANVAS.HEIGHT - (LANE_Y - 60));

    // Atmospheric glow near bases
    this._drawGlow(ctx, 80,               LANE_Y, '#c0392b', 120);
    this._drawGlow(ctx, CANVAS.WIDTH - 80, LANE_Y, '#8e44ad', 120);
  }

  _drawGlow(ctx, x, y, color, radius) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lane
  // ─────────────────────────────────────────────────────────────────────────

  _drawLane(ctx) {
    // Ground line
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, LANE_Y + UNIT_H / 2 + 4);
    ctx.lineTo(CANVAS.WIDTH, LANE_Y + UNIT_H / 2 + 4);
    ctx.stroke();

    // Lane center dashed line
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth   = 1;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(0, LANE_Y);
    ctx.lineTo(CANVAS.WIDTH, LANE_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bases
  // ─────────────────────────────────────────────────────────────────────────

  _drawBases(ctx) {
    if (this._playerBase) this._drawBase(ctx, this._playerBase);
    if (this._enemyBase)  this._drawBase(ctx, this._enemyBase);
  }

  _drawBase(ctx, base) {
    const { x, y } = base.position;
    const w = base.width  || 80;
    const h = base.height || 120;
    const isPlayer = base.owner === 'player';

    // Base body
    const color = isPlayer ? '#2980b9' : '#8e44ad';
    const darkColor = isPlayer ? '#1a5276' : '#5b2c6f';

    ctx.fillStyle = darkColor;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);

    // Battlements (top)
    const merlonW = 12;
    const merlonH = 16;
    const merlonCount = 4;
    const merlonSpacing = w / merlonCount;
    ctx.fillStyle = color;
    for (let i = 0; i < merlonCount; i++) {
      const mx = x - w / 2 + i * merlonSpacing + 4;
      const my = y - h / 2 - merlonH;
      ctx.fillRect(mx, my, merlonW, merlonH);
    }

    // Flag
    ctx.fillStyle = isPlayer ? '#3498db' : '#9b59b6';
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2 - merlonH - 30);
    ctx.lineTo(x + (isPlayer ? 20 : -20), y - h / 2 - merlonH - 20);
    ctx.lineTo(x, y - h / 2 - merlonH - 10);
    ctx.fill();

    // Flag pole
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2 - merlonH);
    ctx.lineTo(x, y - h / 2 - merlonH - 35);
    ctx.stroke();

    // HP bar above base
    this._drawHPBar(ctx, x, y - h / 2 - merlonH - 50, base.getHpPercent(), isPlayer ? '#4caf50' : '#f44336', 60);

    // HP text
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${base.hp}`, x, y - h / 2 - merlonH - 55);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Units
  // ─────────────────────────────────────────────────────────────────────────

  _drawUnits(ctx, dt) {
    const allUnits = [
      ...this._unitSystem.playerUnits,
      ...this._unitSystem.enemyUnits,
    ].sort((a, b) => a.position.x - b.position.x);

    for (const unit of allUnits) {
      this._drawUnit(ctx, unit, dt);
    }
  }

  _drawUnit(ctx, unit, _dt) {
    const { x, y } = unit.position;
    const isPlayer  = unit.owner === 'player';
    const isDead    = unit.state === UNIT_STATE.DEAD;
    const alpha     = isDead ? 0.4 : 1.0;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Flip enemy units to face left
    if (!isPlayer) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }

    // Try to draw sprite, fall back to emoji
    const sprite = unit.spriteKey ? this._sprites.get(unit.spriteKey) : null;
    if (sprite) {
      // Sprite sheet animation
      const frameW = sprite.width / (unit.animFrames[unit.animState] || 4);
      const frameH = sprite.height;
      const srcX   = unit.animFrame * frameW;
      ctx.drawImage(sprite, srcX, 0, frameW, frameH, x - UNIT_W / 2, y - UNIT_H / 2, UNIT_W, UNIT_H);
    } else {
      // Emoji fallback
      ctx.font = `${UNIT_H * 0.7}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Slight bounce animation for moving units
      const bounce = unit.state === UNIT_STATE.MOVING
        ? Math.sin(this._animTimer * 8 + unit.uid) * 2
        : 0;

      ctx.fillText(unit.icon || '⚔️', x, y + bounce);
    }

    ctx.restore();

    // HP bar (only for living units)
    if (!isDead) {
      this._drawHPBar(
        ctx,
        x,
        y - UNIT_H / 2 - 8,
        unit.getHpPercent(),
        isPlayer ? '#4caf50' : '#f44336',
        HP_BAR_W,
      );

      // Elite indicator
      if (unit.isElite) {
        ctx.fillStyle = '#f39c12';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', x, y - UNIT_H / 2 - 14);
      }

      // Status effect icons
      if (unit.statusEffects.length > 0) {
        ctx.font = '12px serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < unit.statusEffects.length; i++) {
          const effect = unit.statusEffects[i];
          const icon = effect.type === 'slow' ? '❄️' : '🔥';
          ctx.fillText(icon, x + (i - 0.5) * 14, y - UNIT_H / 2 - 20);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Projectiles
  // ─────────────────────────────────────────────────────────────────────────

  _drawProjectiles(ctx) {
    // CombatSystem holds projectiles — we need a reference
    if (!this._combatSystem) return;
    for (const proj of this._combatSystem.getProjectiles()) {
      this._drawProjectile(ctx, proj);
    }
  }

  _drawProjectile(ctx, proj) {
    const { x, y } = proj.position;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(proj.rotation);

    const sprite = proj.spriteKey ? this._sprites.get(proj.spriteKey) : null;
    if (sprite) {
      ctx.drawImage(sprite, -8, -4, 16, 8);
    } else {
      // Emoji/dot fallback
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(proj.icon || '•', 0, 0);
    }

    ctx.restore();
  }

  /**
   * Inject CombatSystem for projectile rendering.
   * @param {CombatSystem} combatSystem
   */
  setCombatSystem(combatSystem) {
    this._combatSystem = combatSystem;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HP Bar Helper
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Draw a health bar centered at (x, y).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} fraction - 0.0 to 1.0
   * @param {string} color
   * @param {number} width
   */
  _drawHPBar(ctx, x, y, fraction, color, width) {
    const h = HP_BAR_H;
    const bx = x - width / 2;

    // Background
    ctx.fillStyle = '#333355';
    ctx.fillRect(bx, y, width, h);

    // Fill
    const fillW = Math.max(0, Math.round(width * fraction));
    if (fillW > 0) {
      ctx.fillStyle = color;
      ctx.fillRect(bx, y, fillW, h);
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, y, width, h);
  }
}
