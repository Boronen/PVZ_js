/**
 * Entity.js — Base class for all game entities (plants and zombies).
 *
 * Provides shared state: position, HP, sprite, alive flag.
 * Subclasses override update() and draw() for specific behaviour.
 */

let _nextId = 1;

export class Entity {
  /**
   * @param {object} opts
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {number} opts.hp
   * @param {HTMLImageElement|null} [opts.sprite]
   * @param {string} [opts.emoji]
   */
  constructor({ x, y, hp, sprite = null, emoji = '?' }) {
    /** @type {string} Unique runtime ID */
    this.id      = `entity_${_nextId++}`;
    this.x       = x;
    this.y       = y;
    this.hp      = hp;
    this.maxHp   = hp;
    this.sprite  = sprite;
    this.emoji   = emoji;
    this.alive   = true;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Apply damage. Marks dead when hp reaches 0.
   * @param {number} amount
   */
  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this._die();
  }

  /**
   * Restore HP up to maxHp.
   * @param {number} amount
   */
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** @returns {boolean} */
  isAlive() { return this.alive; }

  /** @returns {number} 0–1 */
  getHpRatio() { return this.maxHp > 0 ? this.hp / this.maxHp : 0; }

  /**
   * Update logic — override in subclasses.
   * @param {number} _dt
   */
  update(_dt) {}

  /**
   * Draw entity on canvas — override in subclasses.
   * @param {CanvasRenderingContext2D} _ctx
   */
  draw(_ctx) {}

  // ── Protected ────────────────────────────────────────────────

  _die() {
    this.alive = false;
    // Subclasses emit their own death events (Zombie emits ZOMBIE_DIED)
  }

  /**
   * Draw a sprite or emoji fallback centred at (cx, cy).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx  centre x
   * @param {number} cy  centre y
   * @param {number} w   draw width
   * @param {number} h   draw height
   */
  _drawSprite(ctx, cx, cy, w, h) {
    if (this.sprite) {
      ctx.drawImage(this.sprite, cx - w / 2, cy - h / 2, w, h);
    } else {
      ctx.font      = `${Math.min(w, h) * 0.75}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.emoji, cx, cy);
    }
  }

  /**
   * Draw an HP bar below the entity.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx  centre x
   * @param {number} top top y of bar
   * @param {number} w   bar width
   */
  _drawHpBar(ctx, cx, top, w) {
    const h     = 5;
    const ratio = this.getHpRatio();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - w / 2, top, w, h);
    ctx.fillStyle = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(cx - w / 2, top, w * ratio, h);
  }
}
