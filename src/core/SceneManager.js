/**
 * SceneManager.js — Manages screen transitions and lifecycle.
 *
 * Each screen is identified by a string key matching a DOM element id.
 * SceneManager shows/hides screens and calls optional lifecycle hooks
 * (init, show, hide) on registered screen controller objects.
 */

import { EventBus, EVENTS } from './EventBus.js';

/** @enum {string} All valid scene names */
export const SCENES = {
  MAIN_MENU:      'main-menu',
  HERO_SELECT:    'hero-select',
  GAMEPLAY:       'gameplay',
  UPGRADE_POPUP:  'upgrade-popup',
  END_SCREEN:     'end',
};

export class SceneManager {
  /**
   * @param {object} screens - Map of scene name → screen controller instance
   *   Each controller may optionally implement: init(data), show(data), hide()
   */
  constructor(screens = {}) {
    /** @type {Map<string, object>} */
    this._screens = new Map(Object.entries(screens));

    /** @type {string|null} Currently active scene key */
    this._currentScene = null;

    /** @type {string|null} Previously active scene (for back-navigation) */
    this._previousScene = null;
  }

  /**
   * Register a screen controller after construction.
   * @param {string} name - Scene key (use SCENES constants)
   * @param {object} controller - Screen controller with optional show/hide/init
   */
  register(name, controller) {
    this._screens.set(name, controller);
  }

  /**
   * Transition to a new scene.
   * Hides the current scene, shows the new one.
   * @param {string} sceneName - Target scene key
   * @param {*} [data] - Optional data passed to the new scene's show(data) method
   */
  switchTo(sceneName, data) {
    if (!this._screens.has(sceneName)) {
      console.error(`[SceneManager] Unknown scene: '${sceneName}'`);
      return;
    }

    // Hide current scene
    if (this._currentScene) {
      const current = this._screens.get(this._currentScene);
      this._hideDOM(this._currentScene);
      if (current && typeof current.hide === 'function') {
        current.hide();
      }
      this._previousScene = this._currentScene;
    }

    // Show new scene
    this._currentScene = sceneName;
    this._showDOM(sceneName);
    const next = this._screens.get(sceneName);
    if (next && typeof next.show === 'function') {
      next.show(data);
    }

    EventBus.emit(EVENTS.SCENE_CHANGED, { scene: sceneName, data });
  }

  /**
   * Show the upgrade popup overlay without hiding the gameplay scene.
   * @param {*} [data]
   */
  showOverlay(sceneName, data) {
    if (!this._screens.has(sceneName)) {
      console.error(`[SceneManager] Unknown overlay scene: '${sceneName}'`);
      return;
    }
    this._showDOM(sceneName);
    const controller = this._screens.get(sceneName);
    if (controller && typeof controller.show === 'function') {
      controller.show(data);
    }
  }

  /**
   * Hide an overlay without affecting the underlying scene.
   * @param {string} sceneName
   */
  hideOverlay(sceneName) {
    this._hideDOM(sceneName);
    const controller = this._screens.get(sceneName);
    if (controller && typeof controller.hide === 'function') {
      controller.hide();
    }
  }

  /**
   * Navigate back to the previous scene.
   * @param {*} [data]
   */
  goBack(data) {
    if (this._previousScene) {
      this.switchTo(this._previousScene, data);
    }
  }

  /** @returns {string|null} Current scene name */
  getCurrentScene() {
    return this._currentScene;
  }

  /** @returns {string|null} Previous scene name */
  getPreviousScene() {
    return this._previousScene;
  }

  /**
   * Show a DOM screen element by removing the 'hidden' class.
   * @param {string} sceneName
   */
  _showDOM(sceneName) {
    const el = document.getElementById(`screen-${sceneName}`);
    if (el) {
      el.classList.remove('hidden');
    } else {
      console.warn(`[SceneManager] DOM element not found: #screen-${sceneName}`);
    }
  }

  /**
   * Hide a DOM screen element by adding the 'hidden' class.
   * @param {string} sceneName
   */
  _hideDOM(sceneName) {
    const el = document.getElementById(`screen-${sceneName}`);
    if (el) {
      el.classList.add('hidden');
    }
  }
}
