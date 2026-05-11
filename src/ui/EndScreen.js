/**
 * EndScreen.js — Permadeath / victory summary screen.
 */

export class EndScreen {
  constructor() {
    this._screen    = document.getElementById('screen-end');
    this._banner    = document.getElementById('end-banner');
    this._summary   = document.getElementById('end-summary');
    this._seedsEl   = document.getElementById('end-seeds-earned');
  }

  /**
   * Show the end screen.
   * @param {object} result
   * @param {boolean} result.won
   * @param {number}  result.wavesCleared
   * @param {number}  result.zombiesKilled
   * @param {number}  result.coinsEarned
   * @param {number}  result.seedsEarned
   * @param {object[]} result.perks
   * @param {Function} onPlayAgain
   * @param {Function} onMainMenu
   */
  show(result, onPlayAgain, onMainMenu) {
    this._renderBanner(result.won);
    this._renderSummary(result);
    this._renderSeeds(result.seedsEarned);
    this._screen?.classList.remove('hidden');

    document.getElementById('btn-play-again')
      ?.addEventListener('click', () => { this.hide(); onPlayAgain(); }, { once: true });
    document.getElementById('btn-end-main-menu')
      ?.addEventListener('click', () => { this.hide(); onMainMenu(); }, { once: true });
  }

  hide() {
    this._screen?.classList.add('hidden');
  }

  // ── Private ──────────────────────────────────────────────────

  _renderBanner(won) {
    if (!this._banner) return;
    this._banner.className = `end-banner ${won ? 'victory' : 'defeat'}`;
    this._banner.textContent = won ? '🏆 Victory!' : '💀 Defeated!';
  }

  _renderSummary(result) {
    if (!this._summary) return;
    this._summary.innerHTML = `
      <div class="end-stat">
        <span class="end-stat-label">Waves Cleared</span>
        <span class="end-stat-value">${result.wavesCleared} / 10</span>
      </div>
      <div class="end-stat">
        <span class="end-stat-label">Zombies Killed</span>
        <span class="end-stat-value">${result.zombiesKilled}</span>
      </div>
      <div class="end-stat">
        <span class="end-stat-label">Coins Earned</span>
        <span class="end-stat-value">🪙 ${result.coinsEarned}</span>
      </div>
      <div class="end-stat">
        <span class="end-stat-label">Perks Collected</span>
        <span class="end-stat-value">${result.perks?.map(p => p.icon ?? '⭐').join(' ') || '—'}</span>
      </div>
    `;
  }

  _renderSeeds(seeds) {
    if (!this._seedsEl) return;
    this._seedsEl.innerHTML = `<span>🌰</span> +${seeds} Seeds earned`;
  }
}
