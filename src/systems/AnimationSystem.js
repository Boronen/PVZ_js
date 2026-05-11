/**
 * AnimationSystem.js — Drives sprite animations for plants and zombies.
 *
 * Since the PvZ 2 API only provides static PNGs (no spritesheets),
 * we simulate animations using canvas transforms:
 *
 * Plants:
 *  - Idle bob: gentle vertical sine wave (amplitude 3px, ~1Hz)
 *  - Attack flash: brief scale pulse when attacking
 *  - Death: fade out + shrink
 *
 * Zombies:
 *  - Walk: horizontal lean oscillation (±8°) + vertical bounce
 *  - Attack: forward lunge
 *  - Death: fall + fade
 *
 * Each entity gets an AnimState object updated every frame.
 */

export class AnimationSystem {
  constructor() {
    /** @type {Map<string, AnimState>} entityId → state */
    this._states = new Map();
    this._time   = 0;
  }

  // ── Public API ───────────────────────────────────────────────

  /** @param {number} dt */
  update(dt) {
    this._time += dt;
    for (const state of this._states.values()) {
      state.update(dt);
    }
  }

  /**
   * Get or create animation state for an entity.
   * @param {string} id
   * @param {'plant'|'zombie'} type
   * @returns {AnimState}
   */
  getState(id, type) {
    if (!this._states.has(id)) {
      this._states.set(id, new AnimState(type, this._time));
    }
    return this._states.get(id);
  }

  /** Remove state for a dead entity. */
  remove(id) {
    this._states.delete(id);
  }

  /** @returns {number} global time in seconds */
  getTime() { return this._time; }

  /** Clear all states (new run). */
  reset() {
    this._states.clear();
    this._time = 0;
  }
}

// ── AnimState ────────────────────────────────────────────────

export class AnimState {
  /**
   * @param {'plant'|'zombie'} type
   * @param {number} startTime  global time offset for phase variation
   */
  constructor(type, startTime) {
    this._type      = type;
    this._phase     = startTime + Math.random() * Math.PI * 2; // random phase offset
    this._time      = 0;

    // Attack flash
    this._attacking = false;
    this._attackTimer = 0;

    // Death
    this.dying      = false;
    this._deathTimer= 0;
    this.alpha      = 1;
  }

  /** @param {number} dt */
  update(dt) {
    this._time += dt;

    if (this._attacking) {
      this._attackTimer -= dt;
      if (this._attackTimer <= 0) this._attacking = false;
    }

    if (this.dying) {
      this._deathTimer += dt;
      this.alpha = Math.max(0, 1 - this._deathTimer / 0.6);
    }
  }

  /** Trigger attack animation. */
  triggerAttack() {
    this._attacking   = true;
    this._attackTimer = 0.15;
  }

  /** Trigger death animation. */
  triggerDeath() {
    this.dying = true;
    this._deathTimer = 0;
  }

  /**
   * Apply canvas transform for this entity's current animation frame.
   * Call ctx.save() before and ctx.restore() after drawing.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx  centre x
   * @param {number} cy  centre y
   */
  applyTransform(ctx, cx, cy) {
    ctx.globalAlpha = this.alpha;
    if (this._type === 'plant') {
      this._applyPlantTransform(ctx, cx, cy);
    } else {
      this._applyZombieTransform(ctx, cx, cy);
    }
  }

  // ── Private — Plant Transform ────────────────────────────────

  _applyPlantTransform(ctx, cx, cy) {
    const t = this._time + this._phase;

    // Idle bob: gentle vertical sine
    const bobY  = Math.sin(t * 1.8) * 3;

    // Attack pulse: scale up briefly
    const scale = this._attacking
      ? 1 + Math.sin(this._attackTimer / 0.15 * Math.PI) * 0.15
      : 1;

    // Death: shrink down
    const deathScale = this.dying
      ? Math.max(0.05, 1 - this._deathTimer / 0.6)
      : 1;

    ctx.translate(cx, cy + bobY);
    ctx.scale(scale * deathScale, scale * deathScale);
    ctx.translate(-cx, -(cy + bobY));
  }

  // ── Private — Zombie Transform ───────────────────────────────

  _applyZombieTransform(ctx, cx, cy) {
    const t = this._time + this._phase;

    // Walk: lean oscillation + vertical bounce
    const lean   = Math.sin(t * 3.5) * 0.12;   // radians
    const bounceY= Math.abs(Math.sin(t * 3.5)) * 4;

    // Attack lunge: lean forward
    const attackLean = this._attacking ? 0.25 : 0;

    // Death: fall sideways
    if (this.dying) {
      const fallAngle = Math.min(Math.PI / 2, this._deathTimer * 3);
      ctx.translate(cx, cy);
      ctx.rotate(fallAngle);
      ctx.translate(-cx, -cy);
      return;
    }

    ctx.translate(cx, cy - bounceY);
    ctx.rotate(lean + attackLean);
    ctx.translate(-cx, -(cy - bounceY));
  }
}
