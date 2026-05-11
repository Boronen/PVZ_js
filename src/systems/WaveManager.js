/**
 * WaveManager.js — Handles procedural zombie wave generation and spawning.
 *
 * Reads wave templates from waves.json, applies difficulty scaling,
 * mutates elite zombies, and schedules individual zombie spawns.
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, GRID, RUN } from '../core/constants.js';
import { Zombie } from '../entities/Zombie.js';

export class WaveManager {
  /**
   * @param {object[]} waveDefs      - from waves.json
   * @param {object[]} eliteMutations- from waves.json
   * @param {object[]} zombieDefs    - from zombies.json
   * @param {object}   resources     - ResourceManager instance
   * @param {object}   perks         - active perk modifiers
   */
  constructor(waveDefs, eliteMutations, zombieDefs, resources, perks = {}) {
    this._waveDefs       = waveDefs;
    this._eliteMutations = eliteMutations;
    this._zombieDefMap   = new Map(zombieDefs.map(z => [z.id, z]));
    this._resources      = resources;
    this._perks          = perks;

    this._currentWave    = 0;
    this._spawnQueue     = [];   // { zombieDef, row, mutation, delay }
    this._spawnTimer     = 0;
    this._waveActive     = false;
    this._allZombiesDead = false;

    /** @type {import('../entities/Zombie.js').Zombie[]} */
    this._activeZombies  = [];
  }

  // ── Public API ───────────────────────────────────────────────

  /** @returns {number} */
  getCurrentWave() { return this._currentWave; }

  /** @returns {boolean} */
  isWaveActive() { return this._waveActive; }

  /** @returns {import('../entities/Zombie.js').Zombie[]} */
  getActiveZombies() { return this._activeZombies; }

  /**
   * Start the next wave. Returns false if all waves done.
   * @returns {boolean}
   */
  startNextWave() {
    this._currentWave++;
    if (this._currentWave > RUN.TOTAL_WAVES) {
      EventBus.emit(EVENTS.ALL_WAVES_DONE, {});
      return false;
    }
    const waveDef = this._waveDefs.find(w => w.wave === this._currentWave)
      ?? this._generateFallbackWave();

    this._spawnQueue  = this._buildSpawnQueue(waveDef);
    this._spawnTimer  = 0;
    this._waveActive  = true;
    EventBus.emit(EVENTS.WAVE_STARTED, { wave: this._currentWave });
    return true;
  }

  /**
   * Update — advance spawn timer and spawn queued zombies.
   * @param {number} dt
   */
  update(dt) {
    if (!this._waveActive) return;
    this._tickSpawnQueue(dt);
    this._pruneDeadZombies();
    this._checkWaveCleared();
  }

  /**
   * Get all living zombies in a specific row.
   * @param {number} row
   * @returns {Zombie[]}
   */
  getZombiesInRow(row) {
    return this._activeZombies.filter(z => z.alive && z.row === row);
  }

  // ── Private — Spawn Queue ────────────────────────────────────

  _buildSpawnQueue(waveDef) {
    const queue     = [];
    let   cumDelay  = 0;
    const eliteDef  = waveDef.hasElite ? this._pickEliteMutation() : null;
    let   eliteAdded= false;

    for (const entry of waveDef.zombies) {
      const def = this._zombieDefMap.get(entry.id);
      if (!def) continue;

      for (let i = 0; i < entry.count; i++) {
        const row      = Math.floor(Math.random() * GRID.ROWS);
        const isElite  = !eliteAdded && eliteDef && i === 0 && entry === waveDef.zombies[0];
        const mutation = isElite ? eliteDef : null;
        if (isElite) eliteAdded = true;

        queue.push({ def, row, mutation, delay: cumDelay });
        cumDelay += entry.spawnInterval + (Math.random() * 0.5 - 0.25);
      }
    }
    return queue;
  }

  _tickSpawnQueue(dt) {
    if (this._spawnQueue.length === 0) return;
    this._spawnTimer += dt;

    while (this._spawnQueue.length > 0 &&
           this._spawnTimer >= this._spawnQueue[0].delay) {
      const entry = this._spawnQueue.shift();
      this._spawnZombie(entry.def, entry.row, entry.mutation);
    }
  }

  _spawnZombie(def, row, mutation) {
    const sprite  = this._resources.getZombieSprite(def.id);
    const zombie  = new Zombie(def, row, sprite, mutation, this._perks);
    this._activeZombies.push(zombie);
    EventBus.emit(EVENTS.ZOMBIE_SPAWNED, { zombie });
  }

  _pruneDeadZombies() {
    this._activeZombies = this._activeZombies.filter(z => z.alive);
  }

  _checkWaveCleared() {
    if (this._spawnQueue.length > 0) return;
    if (this._activeZombies.some(z => z.alive)) return;
    this._waveActive = false;
    EventBus.emit(EVENTS.WAVE_CLEARED, { wave: this._currentWave });
  }

  // ── Private — Elite Mutation ─────────────────────────────────

  _pickEliteMutation() {
    if (!this._eliteMutations?.length) return null;
    const idx = Math.floor(Math.random() * this._eliteMutations.length);
    return this._eliteMutations[idx];
  }

  // ── Private — Fallback Wave ──────────────────────────────────

  _generateFallbackWave() {
    const count = 3 + this._currentWave * 2;
    return {
      wave:    this._currentWave,
      zombies: [{ id: 'basic', count, spawnInterval: 2.5 }],
      hasElite: this._currentWave % RUN.ELITE_EVERY_N_WAVES === 0,
    };
  }
}
