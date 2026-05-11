/**
 * UISystem.js — Base UI controller.
 *
 * Wires up global UI interactions that span multiple screens:
 * - Settings modal (SFX/music volume sliders)
 * - How to Play modal
 * - Credits modal
 * - Pause button during gameplay
 * - Keyboard shortcuts (Escape to pause)
 */

import { EventBus, EVENTS } from '../core/EventBus.js';
import { GAME_STATE } from '../core/constants.js';

export class UISystem {
  /**
   * @param {GameManager} gameManager
   */
  constructor(gameManager) {
    this._gm = gameManager;
    this._bindModals();
    this._bindSettings();
    this._bindKeyboard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Modals
  // ─────────────────────────────────────────────────────────────────────────

  _bindModals() {
    // How to Play
    document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
      document.getElementById('modal-how-to-play')?.classList.remove('hidden');
      this._gm.audioManager?.playSFX('btn_click');
    });

    // Settings
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      document.getElementById('modal-settings')?.classList.remove('hidden');
      this._gm.audioManager?.playSFX('btn_click');
    });

    // Credits
    document.getElementById('btn-credits')?.addEventListener('click', () => {
      document.getElementById('modal-credits')?.classList.remove('hidden');
      this._gm.audioManager?.playSFX('btn_click');
    });

    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        this._gm.audioManager?.playSFX('btn_click');
      });
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────────────────

  _bindSettings() {
    const sfxSlider   = document.getElementById('sfx-volume');
    const musicSlider = document.getElementById('music-volume');
    const sfxDisplay  = document.getElementById('sfx-volume-display');
    const musicDisplay = document.getElementById('music-volume-display');

    sfxSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (sfxDisplay) sfxDisplay.textContent = `${val}%`;
      this._gm.audioManager?.setSFXVolume(val / 100);
    });

    musicSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (musicDisplay) musicDisplay.textContent = `${val}%`;
      this._gm.audioManager?.setMusicVolume(val / 100);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard
  // ─────────────────────────────────────────────────────────────────────────

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close any open modal first
        const openModal = document.querySelector('.modal:not(.hidden)');
        if (openModal) {
          openModal.classList.add('hidden');
          return;
        }
        // Pause/resume gameplay using GAME_STATE constants
        if (this._gm.getState() === GAME_STATE.GAMEPLAY) {
          this._gm.pauseGame();
        } else if (this._gm.getState() === GAME_STATE.PAUSED) {
          this._gm.resumeGame();
        }
      }
    });
  }
}
