/**
 * GridManager.js — Manages the 5×9 lawn grid.
 *
 * Tracks cell occupancy, validates placement, and converts
 * between canvas coordinates and grid row/col indices.
 */

import { GRID, EVENTS } from '../core/constants.js';
import { EventBus } from '../core/EventBus.js';

export class GridManager {
  constructor() {
    /** @type {Map<string, import('../entities/Plant.js').Plant>} "row,col" → Plant */
    this._cells = new Map();

    /** @type {Map<number, boolean[]>} row → [hasLawnmower, ...] */
    this._lawnmowers = new Map();

    this._initLawnmowers();
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Convert canvas coordinates to grid cell.
   * @param {number} canvasX
   * @param {number} canvasY
   * @returns {{ row: number, col: number }|null}
   */
  canvasToCell(canvasX, canvasY) {
    const col = Math.floor((canvasX - GRID.ORIGIN_X) / GRID.CELL_W);
    const row = Math.floor((canvasY - GRID.ORIGIN_Y) / GRID.CELL_H);
    if (this._isValidCell(row, col)) return { row, col };
    return null;
  }

  /**
   * Get canvas centre coordinates for a cell.
   * @param {number} row
   * @param {number} col
   * @returns {{ x: number, y: number }}
   */
  cellToCanvas(row, col) {
    return {
      x: GRID.ORIGIN_X + col * GRID.CELL_W + GRID.CELL_W / 2,
      y: GRID.ORIGIN_Y + row * GRID.CELL_H + GRID.CELL_H / 2,
    };
  }

  /**
   * Check if a plant can be placed at the given cell.
   * @param {number} row
   * @param {number} col
   * @param {number} sunCost
   * @param {number} currentSun
   * @returns {{ ok: boolean, reason: string }}
   */
  canPlace(row, col, sunCost, currentSun) {
    if (!this._isValidCell(row, col)) return { ok: false, reason: 'Invalid cell' };
    if (this._cells.has(this._key(row, col))) return { ok: false, reason: 'Cell occupied' };
    if (currentSun < sunCost) return { ok: false, reason: 'Not enough sun' };
    return { ok: true, reason: '' };
  }

  /**
   * Place a plant on the grid.
   * @param {import('../entities/Plant.js').Plant} plant
   */
  placePlant(plant) {
    const key = this._key(plant.row, plant.col);
    this._cells.set(key, plant);
    EventBus.emit(EVENTS.PLANT_PLACED, { plant });
  }

  /**
   * Remove a plant from the grid (shovel).
   * @param {number} row
   * @param {number} col
   */
  removePlant(row, col) {
    const key   = this._key(row, col);
    const plant = this._cells.get(key);
    if (!plant) return;
    this._cells.delete(key);
    plant.alive = false;
    EventBus.emit(EVENTS.PLANT_REMOVED, { plant });
  }

  /**
   * Remove dead plants from the grid automatically.
   */
  pruneDeadPlants() {
    for (const [key, plant] of this._cells) {
      if (!plant.alive) this._cells.delete(key);
    }
  }

  /**
   * Get the plant at a cell, or null.
   * @param {number} row
   * @param {number} col
   * @returns {import('../entities/Plant.js').Plant|null}
   */
  getPlant(row, col) {
    return this._cells.get(this._key(row, col)) ?? null;
  }

  /** @returns {import('../entities/Plant.js').Plant[]} */
  getAllPlants() {
    return [...this._cells.values()];
  }

  /**
   * Get all living plants in a specific row.
   * @param {number} row
   * @returns {import('../entities/Plant.js').Plant[]}
   */
  getPlantsInRow(row) {
    return this.getAllPlants().filter(p => p.row === row && p.alive);
  }

  /**
   * Trigger lawnmower for a row. Returns true if one was available.
   * @param {number} row
   * @returns {boolean}
   */
  triggerLawnmower(row) {
    const mowers = this._lawnmowers.get(row) ?? [];
    const idx    = mowers.findIndex(m => m === true);
    if (idx === -1) return false;
    mowers[idx] = false;
    EventBus.emit(EVENTS.LAWNMOWER_TRIGGERED, { row });
    return true;
  }

  /** @param {number} row @returns {number} */
  getLawnmowerCount(row) {
    return (this._lawnmowers.get(row) ?? []).filter(Boolean).length;
  }

  /**
   * Add an extra lawnmower to every row (perk effect).
   */
  addExtraLawnmowers() {
    for (let r = 0; r < GRID.ROWS; r++) {
      const mowers = this._lawnmowers.get(r) ?? [];
      mowers.push(true);
      this._lawnmowers.set(r, mowers);
    }
  }

  /** Clear all plants (new run). */
  reset() {
    this._cells.clear();
    this._initLawnmowers();
  }

  // ── Private ──────────────────────────────────────────────────

  _key(row, col) { return `${row},${col}`; }

  _isValidCell(row, col) {
    return row >= 0 && row < GRID.ROWS && col >= 0 && col < GRID.COLS;
  }

  _initLawnmowers() {
    this._lawnmowers.clear();
    for (let r = 0; r < GRID.ROWS; r++) {
      this._lawnmowers.set(r, [true]);
    }
  }
}
