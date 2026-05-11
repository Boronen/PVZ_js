/**
 * MainMenuScreen.js — Title screen UI.
 */

export class MainMenuScreen {
  /**
   * @param {Function} onNewRun
   * @param {Function} onUnlocks
   * @param {Function} onHowToPlay
   * @param {object}   saveManager
   */
  constructor(onNewRun, onUnlocks, onHowToPlay, saveManager) {
    this._screen      = document.getElementById('screen-main-menu');
    this._seedsEl     = document.getElementById('meta-seeds-display');
    this._saveManager = saveManager;

    document.getElementById('btn-new-run')
      ?.addEventListener('click', onNewRun);
    document.getElementById('btn-unlocks')
      ?.addEventListener('click', onUnlocks);
    document.getElementById('btn-how-to-play')
      ?.addEventListener('click', onHowToPlay);

    // How to Play modal close
    document.getElementById('btn-close-how-to-play')
      ?.addEventListener('click', () => {
        document.getElementById('modal-how-to-play')?.classList.add('hidden');
      });
  }

  /** Show the main menu and refresh seed count. */
  show() {
    this._screen?.classList.remove('hidden');
    this._refreshSeeds();
  }

  hide() {
    this._screen?.classList.add('hidden');
  }

  // ── Private ──────────────────────────────────────────────────

  _refreshSeeds() {
    const meta = this._saveManager.loadMeta();
    if (this._seedsEl) this._seedsEl.textContent = meta.seeds ?? 0;
  }
}
