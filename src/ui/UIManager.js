/**
 * UIManager.js — Orchestrates all UI screens and DOM panels.
 *
 * Single entry point for showing/hiding screens.
 * Wires up canvas interaction (cell clicks, sun collection).
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS, GRID } from '../core/constants.js';
import { HUD }            from './HUD.js';
import { SeedTray }       from './SeedTray.js';
import { ShopScreen }     from './ShopScreen.js';
import { DraftScreen }    from './DraftScreen.js';
import { MetaScreen }     from './MetaScreen.js';
import { MainMenuScreen } from './MainMenuScreen.js';
import { EndScreen }      from './EndScreen.js';

export class UIManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} resources   - ResourceManager
   * @param {object} saveManager - SaveManager
   * @param {object[]} plantDefs
   */
  constructor(canvas, resources, saveManager, plantDefs) {
    this._canvas      = canvas;
    this._resources   = resources;
    this._saveManager = saveManager;

    this.hud       = new HUD();
    this.seedTray  = new SeedTray(resources);
    this.shop      = new ShopScreen();
    this.draft     = new DraftScreen(resources);
    this.meta      = new MetaScreen(plantDefs, saveManager);
    this.endScreen = new EndScreen();

    this._loadingBar  = document.getElementById('loading-bar-fill');
    this._loadingText = document.getElementById('loading-text');

    this._onCellClick = null;
    this._onSunClick  = null;

    this._bindCanvasEvents();
    this._bindPauseEvents();
  }

  // ── Screen Management ────────────────────────────────────────

  showLoading() {
    document.getElementById('screen-loading')?.classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('screen-loading')?.classList.add('hidden');
  }

  /** @param {number} progress 0–1 */
  setLoadingProgress(progress, text = '') {
    if (this._loadingBar)  this._loadingBar.style.width = `${progress * 100}%`;
    if (this._loadingText && text) this._loadingText.textContent = text;
  }

  showMainMenu(mainMenuScreen) {
    this._hideAllScreens();
    mainMenuScreen.show();
  }

  showHowToPlay() {
    document.getElementById('modal-how-to-play')?.classList.remove('hidden');
  }

  showGameplay() {
    this._hideAllScreens();
    document.getElementById('screen-gameplay')?.classList.remove('hidden');
  }

  hideGameplay() {
    document.getElementById('screen-gameplay')?.classList.add('hidden');
  }

  showPause() {
    document.getElementById('screen-pause')?.classList.remove('hidden');
  }

  hidePause() {
    document.getElementById('screen-pause')?.classList.add('hidden');
  }

  // ── Canvas Cursor ────────────────────────────────────────────

  setPlacingCursor(active) {
    this._canvas.classList.toggle('placing', active);
  }

  setShovelCursor(active) {
    this._canvas.classList.toggle('shoveling', active);
  }

  // ── Callbacks ────────────────────────────────────────────────

  /** @param {Function} fn  called with { row, col } */
  onCellClick(fn) { this._onCellClick = fn; }

  /** @param {Function} fn  called with { canvasX, canvasY } */
  onSunClick(fn)  { this._onSunClick  = fn; }

  // ── Private — Canvas Events ──────────────────────────────────

  _bindCanvasEvents() {
    this._canvas.addEventListener('click', (e) => {
      const { x, y } = this._canvasCoords(e);
      // Try sun collection first
      if (this._onSunClick) {
        const collected = this._onSunClick({ canvasX: x, canvasY: y });
        if (collected) return;
      }
      // Then cell click
      const cell = this._coordsToCell(x, y);
      if (cell && this._onCellClick) {
        this._onCellClick(cell);
      }
    });
  }

  _bindPauseEvents() {
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      EventBus.emit(EVENTS.GAME_PAUSED, {});
    });
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      EventBus.emit(EVENTS.GAME_RESUMED, {});
    });
  }

  // ── Private — Helpers ────────────────────────────────────────

  _canvasCoords(event) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top)  * scaleY,
    };
  }

  _coordsToCell(x, y) {
    const col = Math.floor((x - GRID.ORIGIN_X) / GRID.CELL_W);
    const row = Math.floor((y - GRID.ORIGIN_Y) / GRID.CELL_H);
    if (row >= 0 && row < GRID.ROWS && col >= 0 && col < GRID.COLS) {
      return { row, col };
    }
    return null;
  }

  _hideAllScreens() {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.add('hidden'));
  }
}
