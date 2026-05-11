/**
 * HeroSelectScreen.js — Hero selection screen controller.
 *
 * Renders three hero cards dynamically from heroes.json data.
 * Handles hero selection, difficulty selection, and run start.
 */

export class HeroSelectScreen {
  /**
   * @param {GameManager} gameManager
   * @param {object[]} heroesData - All hero definitions from heroes.json
   */
  constructor(gameManager, heroesData) {
    this._gm         = gameManager;
    this._heroesData = heroesData;
    this._selectedHeroId  = null;
    this._selectedDifficulty = 'normal';
    this._bound = false;
  }

  /**
   * Called by SceneManager when this screen becomes active.
   */
  show() {
    if (!this._bound) {
      this._renderHeroCards();
      this._bindButtons();
      this._bound = true;
    }
    // Reset selection state
    this._selectedHeroId = null;
    this._updateStartButton();
    this._clearCardSelection();
  }

  hide() {
    // Nothing to clean up
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Hero Cards
  // ─────────────────────────────────────────────────────────────────────────

  _renderHeroCards() {
    const container = document.getElementById('hero-cards-container') ||
      document.querySelector('[data-cy="hero-cards-container"]');
    if (!container) return;

    container.innerHTML = '';

    for (const hero of this._heroesData) {
      const card = this._buildHeroCard(hero);
      container.appendChild(card);
    }
  }

  /**
   * Build a hero card DOM element.
   * @param {object} hero
   * @returns {HTMLElement}
   */
  _buildHeroCard(hero) {
    const card = document.createElement('div');
    card.className = 'hero-card';
    card.dataset.heroId = hero.id;
    card.dataset.cy = `hero-card-${hero.id}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Select ${hero.name}`);

    // Portrait
    const portrait = document.createElement('div');
    portrait.className = 'hero-portrait';
    portrait.textContent = hero.portraitIcon || '🎖️';
    card.appendChild(portrait);

    // Name
    const name = document.createElement('div');
    name.className = 'hero-name';
    name.textContent = hero.name;
    card.appendChild(name);

    // Playstyle tags
    const tags = document.createElement('div');
    tags.className = 'hero-tags';
    for (const tag of (hero.playstyle || [])) {
      const span = document.createElement('span');
      span.className = 'hero-tag';
      span.textContent = tag;
      tags.appendChild(span);
    }
    card.appendChild(tags);

    // Passive description
    const passive = document.createElement('div');
    passive.className = 'hero-passive';
    passive.textContent = hero.passiveDescription || '';
    card.appendChild(passive);

    // Starting bonus
    const bonus = document.createElement('div');
    bonus.className = 'hero-starting-bonus';
    bonus.textContent = `★ ${hero.startingBonus || ''}`;
    card.appendChild(bonus);

    // Click handler
    card.addEventListener('click', () => this._selectHero(hero.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') this._selectHero(hero.id);
    });

    return card;
  }

  _selectHero(heroId) {
    this._selectedHeroId = heroId;
    this._gm.audioManager?.playSFX('btn_click');

    // Update card visual state
    document.querySelectorAll('.hero-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.heroId === heroId);
    });

    this._updateStartButton();
  }

  _clearCardSelection() {
    document.querySelectorAll('.hero-card').forEach(card => {
      card.classList.remove('selected');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Buttons
  // ─────────────────────────────────────────────────────────────────────────

  _bindButtons() {
    // Back button
    document.getElementById('btn-back-to-menu')?.addEventListener('click', () => {
      this._gm.audioManager?.playSFX('btn_click');
      this._gm.sceneManager.switchTo('main-menu');
    });

    // Start Run button
    document.getElementById('btn-start-run')?.addEventListener('click', () => {
      if (!this._selectedHeroId) return;
      this._gm.audioManager?.playSFX('btn_click');
      this._gm.startRun(this._selectedHeroId, this._selectedDifficulty);
    });

    // Difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._selectedDifficulty = btn.dataset.difficulty || 'normal';
        this._gm.audioManager?.playSFX('btn_click');
        document.querySelectorAll('.difficulty-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
      });
    });
  }

  _updateStartButton() {
    const btn = document.getElementById('btn-start-run');
    if (!btn) return;
    if (this._selectedHeroId) {
      btn.disabled = false;
      btn.classList.remove('disabled');
    } else {
      btn.disabled = true;
      btn.classList.add('disabled');
    }
  }
}
