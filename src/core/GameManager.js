/**
 * GameManager.js — Singleton controller for PvZ Roguelike.
 *
 * Responsibilities:
 *  - Bootstrap all systems with loaded data
 *  - Own the requestAnimationFrame game loop
 *  - Drive the state machine (loading → menu → draft → gameplay → shop → end)
 *  - Coordinate inter-system communication via EventBus
 *  - Render the canvas each frame
 */

import { EventBus }         from './EventBus.js';
import { EVENTS, GAME_STATE, GRID, CANVAS, RUN, SUN } from './constants.js';
import { SaveManager }      from './SaveManager.js';
import { ResourceManager }  from '../systems/ResourceManager.js';
import { GridManager }      from '../systems/GridManager.js';
import { WaveManager }      from '../systems/WaveManager.js';
import { RoguelikeManager } from '../systems/RoguelikeManager.js';
import { CombatSystem }     from '../systems/CombatSystem.js';
import { SunSystem }        from '../systems/SunSystem.js';
import { AnimationSystem }  from '../systems/AnimationSystem.js';
import { AudioManager }     from '../systems/AudioManager.js';
import { Plant }            from '../entities/Plant.js';
import { UIManager }        from '../ui/UIManager.js';
import { MainMenuScreen }   from '../ui/MainMenuScreen.js';

export class GameManager {
  /** @param {object} gameData - all JSON loaded by main.js */
  constructor(gameData) {
    this._data   = gameData;
    this._state  = GAME_STATE.LOADING;
    this._rafId  = null;
    this._lastTs = 0;

    // Core
    this.saveManager   = new SaveManager();
    this.resources     = new ResourceManager();
    this.audio         = new AudioManager();

    // Run-scoped systems (null until startRun)
    this.grid      = null;
    this.waves     = null;
    this.roguelike = null;
    this.combat    = null;
    this.sun       = null;
    this.anim      = null;

    // UI
    this.ui         = null;
    this.mainMenu   = null;

    // Canvas
    this._canvas = null;
    this._ctx    = null;

    // Run stats
    this._runStats = { zombiesKilled: 0, coinsEarned: 0, wavesCleared: 0 };
  }

  // ── Bootstrap ────────────────────────────────────────────────

  async init() {
    this._setupCanvas();
    this._setupUI();
    this._setupMainMenu();
    this._bindGlobalEvents();

    // Show loading screen while assets fetch
    this.ui.showLoading();
    EventBus.on(EVENTS.ASSETS_PROGRESS, ({ loaded, total }) => {
      this.ui.setLoadingProgress(loaded / total, `Loading sprites… ${loaded}/${total}`);
    });

    await this.resources.loadAll(this._data.plants, this._data.zombies);

    this.ui.hideLoading();
    this._setState(GAME_STATE.MAIN_MENU);
    this.ui.showMainMenu(this.mainMenu);
  }

  // ── Run Lifecycle ────────────────────────────────────────────

  /** Begin the draft phase for a new run. */
  beginDraft() {
    this._resetRunStats();

    // Fix A: hide main menu BEFORE showing draft
    this.mainMenu.hide();

    const roguelike = new RoguelikeManager(
      this._data.plants,
      this._data.perks,
      this._data.rarityWeights,
      this.saveManager,
    );
    const pool = roguelike.generateDraftPool();

    this._setState(GAME_STATE.DRAFT);
    this.ui.draft.show(
      pool,
      (selected) => this._startRun(selected, roguelike),
      () => {
        this._setState(GAME_STATE.MAIN_MENU);
        this.ui.showMainMenu(this.mainMenu);
      },
    );
  }

  /**
   * Start the run with the drafted loadout.
   * @param {object[]} loadout
   * @param {RoguelikeManager} roguelike
   */
  _startRun(loadout, roguelike) {
    this.roguelike = roguelike;
    this.roguelike.confirmDraft(loadout);

    const perks = this.roguelike.getPerks();
    const startSun = SUN.STARTING + (this.saveManager.hasUnlock('starting_sun_bonus') ? 50 : 0);

    this.grid   = new GridManager();
    this.combat = new CombatSystem();
    this.sun    = new SunSystem(startSun);
    this.anim   = new AnimationSystem();
    this.waves  = new WaveManager(
      this._data.waves,
      this._data.eliteMutations,
      this._data.zombies,
      this.resources,
      perks,
    );

    this.ui.seedTray.init(loadout);
    this._setState(GAME_STATE.GAMEPLAY);
    this.ui.showGameplay();

    EventBus.emit(EVENTS.RUN_STARTED, {});
    this.waves.startNextWave();
    this._startLoop();
  }

  // ── Game Loop ────────────────────────────────────────────────

  _startLoop() {
    this._lastTs = performance.now();
    const tick = (ts) => {
      if (this._state !== GAME_STATE.GAMEPLAY) return;
      const dt = Math.min((ts - this._lastTs) / 1000, 0.1);
      this._lastTs = ts;
      this._update(dt);
      this._render();
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ── Update ───────────────────────────────────────────────────

  _update(dt) {
    const perks   = this.roguelike.getPerks();
    const zombies = this.waves.getActiveZombies();
    const allPlants = this.grid.getAllPlants();

    // Update animation system
    this.anim.update(dt);

    // Update sun tokens
    this.sun.update(dt);

    // Update waves / zombie spawning
    this.waves.update(dt);

    // Update each zombie
    for (const zombie of zombies) {
      const plantsInRow = this.grid.getPlantsInRow(zombie.row);
      zombie.update(dt, plantsInRow);
    }

    // Update each plant
    for (const plant of allPlants) {
      if (!plant.alive) continue;
      const zombiesInRow = this.waves.getZombiesInRow(plant.row);
      plant.update(dt, zombiesInRow, [], this.sun.getTokens());
    }

    // Handle AoE events queued from plant attacks
    this._processAoeQueue(zombies);

    // Update projectiles
    this.combat.update(dt, zombies);

    // Prune dead plants from grid
    this.grid.pruneDeadPlants();

    // Update seed tray cooldowns — pass perk sun discount for correct display
    const sunDiscount = this.roguelike.getPerks().sunDiscount ?? 0;
    this.ui.seedTray.update(dt, this.sun.getSun(), sunDiscount);

    // Update HUD
    this._updateHUD();
  }

  _processAoeQueue(zombies) {
    // AoE events are emitted by Plant._explode via PROJECTILE_HIT type:'aoe'
    // We handle them here synchronously via a queued list
    for (const evt of this._aoeQueue ?? []) {
      this.combat.applyAoe(evt, zombies);
    }
    this._aoeQueue = [];
  }

  // ── Render ───────────────────────────────────────────────────

  _render() {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);

    this._drawBackground(ctx);
    this._drawGrid(ctx);
    this._drawLawnmowers(ctx);
    this._drawPlants(ctx);
    this._drawZombies(ctx);
    this._drawProjectiles(ctx);
    this._drawSunTokens(ctx);
    this._drawGridHighlight(ctx);
  }

  _drawBackground(ctx) {
    // Gradient lawn background
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS.HEIGHT);
    grad.addColorStop(0,    '#1a3a1a');
    grad.addColorStop(0.15, '#2d6a2d');
    grad.addColorStop(1,    '#1a3a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);

    // Alternating row tints
    for (let r = 0; r < GRID.ROWS; r++) {
      ctx.fillStyle = r % 2 === 0
        ? 'rgba(76,175,80,0.15)'
        : 'rgba(56,142,60,0.10)';
      ctx.fillRect(
        GRID.ORIGIN_X, GRID.ORIGIN_Y + r * GRID.CELL_H,
        GRID.COLS * GRID.CELL_W, GRID.CELL_H,
      );
    }
  }

  _drawGrid(ctx) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    for (let r = 0; r <= GRID.ROWS; r++) {
      const y = GRID.ORIGIN_Y + r * GRID.CELL_H;
      ctx.beginPath();
      ctx.moveTo(GRID.ORIGIN_X, y);
      ctx.lineTo(GRID.ORIGIN_X + GRID.COLS * GRID.CELL_W, y);
      ctx.stroke();
    }
    for (let c = 0; c <= GRID.COLS; c++) {
      const x = GRID.ORIGIN_X + c * GRID.CELL_W;
      ctx.beginPath();
      ctx.moveTo(x, GRID.ORIGIN_Y);
      ctx.lineTo(x, GRID.ORIGIN_Y + GRID.ROWS * GRID.CELL_H);
      ctx.stroke();
    }
  }

  _drawLawnmowers(ctx) {
    for (let r = 0; r < GRID.ROWS; r++) {
      const count = this.grid.getLawnmowerCount(r);
      if (count === 0) continue;
      const x = GRID.LAWNMOWER_X;
      const y = GRID.ORIGIN_Y + r * GRID.CELL_H + GRID.CELL_H / 2;
      ctx.font         = '28px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚜', x, y);
    }
  }

  _drawPlants(ctx) {
    for (const plant of this.grid.getAllPlants()) {
      plant.draw(ctx, this.anim);
    }
  }

  _drawZombies(ctx) {
    for (const zombie of this.waves.getActiveZombies()) {
      zombie.draw(ctx, this.anim);
    }
  }

  _drawProjectiles(ctx) {
    for (const proj of this.combat.getProjectiles()) {
      proj.draw(ctx);
    }
  }

  _drawSunTokens(ctx) {
    for (const token of this.sun.getTokens()) {
      token.draw(ctx);
    }
  }

  _drawGridHighlight(ctx) {
    const selectedId = this.ui.seedTray.getSelectedPlantId();
    if (!selectedId) return;
    const def = this._data.plants.find(p => p.id === selectedId);
    if (!def) return;

    // Use perk-adjusted sun cost for highlight accuracy
    const perks   = this.roguelike.getPerks();
    const sunCost = Math.max(0, def.sunCost - (perks.sunDiscount ?? 0));

    // Highlight valid cells
    for (let r = 0; r < GRID.ROWS; r++) {
      for (let c = 0; c < GRID.COLS; c++) {
        const { ok } = this.grid.canPlace(r, c, sunCost, this.sun.getSun());
        ctx.fillStyle = ok
          ? 'rgba(76,175,80,0.25)'
          : 'rgba(244,67,54,0.15)';
        ctx.fillRect(
          GRID.ORIGIN_X + c * GRID.CELL_W + 1,
          GRID.ORIGIN_Y + r * GRID.CELL_H + 1,
          GRID.CELL_W - 2, GRID.CELL_H - 2,
        );
      }
    }
  }

  // ── HUD Update ───────────────────────────────────────────────

  _updateHUD() {
    let totalMowers = 0;
    for (let r = 0; r < GRID.ROWS; r++) {
      totalMowers += this.grid.getLawnmowerCount(r);
    }
    this.ui.hud.update({
      sun:         this.sun.getSun(),
      wave:        this.waves.getCurrentWave(),
      totalWaves:  RUN.TOTAL_WAVES,
      lawnmowers:  totalMowers,
      coins:       this.roguelike.getCoins(),
      activePerks: this.roguelike.getPurchasedPerks(),
    });
  }

  // ── Event Bindings ───────────────────────────────────────────

  _bindGlobalEvents() {
    // Zombie died → award coins + trigger death animation
    EventBus.on(EVENTS.ZOMBIE_DIED, ({ zombie, coinReward }) => {
      this._runStats.zombiesKilled++;
      this._runStats.coinsEarned += coinReward;
      this.roguelike?.addCoins(coinReward);
      this.anim?.getState(zombie.id, 'zombie')?.triggerDeath();
    });

    // Plant attack animation trigger
    EventBus.on(EVENTS.PLANT_PLACED, ({ plant, animTrigger }) => {
      if (animTrigger === 'attack' && plant) {
        this.anim?.getState(plant.id, 'plant')?.triggerAttack();
      }
    });

    // Plant died → trigger death animation
    EventBus.on(EVENTS.PLANT_DIED, ({ plant }) => {
      this.anim?.getState(plant?.id, 'plant')?.triggerDeath();
    });

    // Zombie reached house → trigger lawnmower or permadeath
    EventBus.on(EVENTS.ZOMBIE_REACHED_HOUSE, ({ zombie, row }) => {
      this._handleZombieAtHouse(zombie, row);
    });

    // Wave cleared → show shop
    EventBus.on(EVENTS.WAVE_CLEARED, ({ wave }) => {
      this._runStats.wavesCleared = wave;
      this._onWaveCleared(wave);
    });

    // All waves done → victory
    EventBus.on(EVENTS.ALL_WAVES_DONE, () => {
      this._endRun(true);
    });

    // Pause / resume / quit
    EventBus.on(EVENTS.GAME_PAUSED,  () => this._pauseGame());
    EventBus.on(EVENTS.GAME_RESUMED, () => this._resumeGame());

    // Quit Run button (in pause screen)
    document.getElementById('btn-quit-run')
      ?.addEventListener('click', () => this._quitRun());

    // Sun collection via canvas click
    this.ui.onSunClick(({ canvasX, canvasY }) => {
      return this.sun?.handleClick(canvasX, canvasY) ?? false;
    });

    // Cell click → place or shovel plant
    this.ui.onCellClick(({ row, col }) => {
      this._handleCellClick(row, col);
    });

    // Perk applied → handle side-effects on existing entities
    EventBus.on(EVENTS.PERK_APPLIED, ({ perk, perks }) => {
      this._applyZombieSlowPerk(perks);
      this._retroactivelyUpdatePlants(perks);
      if (perk?.effect?.type === 'lawnmower_extra') {
        this.grid?.addExtraLawnmowers();
      }
      // STARTING_SUN perk: add sun directly
      if (perk?.effect?.type === 'starting_sun') {
        this.sun?.addSun(perk.effect.value ?? 0);
      }
    });

    // AoE events from plant explosions
    EventBus.on(EVENTS.PROJECTILE_HIT, (data) => {
      if (data.type === 'aoe') {
        this._aoeQueue = this._aoeQueue ?? [];
        this._aoeQueue.push(data);
      }
    });
  }

  _handleZombieAtHouse(zombie, row) {
    zombie.alive = false;
    const hadMower = this.grid.triggerLawnmower(row);
    if (hadMower) {
      // Lawnmower kills all zombies in that row
      for (const z of this.waves.getZombiesInRow(row)) {
        z.takeDamage(99999);
      }
      return;
    }
    // No lawnmower left → permadeath
    this._endRun(false);
  }

  _handleCellClick(row, col) {
    if (this.ui.seedTray.isShovelMode()) {
      this.grid.removePlant(row, col);
      return;
    }
    const plantId = this.ui.seedTray.getSelectedPlantId();
    if (!plantId) return;

    const def = this._data.plants.find(p => p.id === plantId);
    if (!def) return;

    const perks    = this.roguelike.getPerks();
    const sunCost  = Math.max(0, def.sunCost - perks.sunDiscount);
    const { ok }   = this.grid.canPlace(row, col, sunCost, this.sun.getSun());
    if (!ok) return;

    this.sun.spendSun(sunCost);
    const sprite = this.resources.getPlantSprite(def.id);
    const plant  = new Plant(def, row, col, sprite, perks);
    this.grid.placePlant(plant);
    this.ui.seedTray.startCooldown(plantId);
  }

  _applyZombieSlowPerk(perks) {
    if (!this.waves) return;
    for (const z of this.waves.getActiveZombies()) {
      z.speed = z._def.speed * (perks.zombieSlowMult ?? 1);
    }
  }

  /**
   * Retroactively apply perk multipliers to all plants already on the grid.
   * Called whenever a perk is purchased so existing plants benefit immediately.
   * @param {object} perks
   */
  _retroactivelyUpdatePlants(perks) {
    if (!this.grid) return;
    for (const plant of this.grid.getAllPlants()) {
      if (!plant.alive) continue;
      const def = this._data.plants.find(p => p.id === plant.plantId);
      if (!def) continue;
      plant.damage         = Math.round((def.damage ?? 0) * (perks.plantDamageMult ?? 1));
      plant.attackCooldown = (def.attackCooldown ?? 1.5) * (perks.plantCooldownMult ?? 1);
      plant.maxHp          = Math.round(def.hp * (perks.plantHpMult ?? 1));
      // Sunflower production boost
      if (plant.type === 'producer') {
        plant._sunProductionInterval = (def.sunProductionInterval ?? 8) / (perks.sunProductionMult ?? 1);
        plant._sunProduction = Math.round((def.sunProduction ?? 25) * (perks.sunProductionMult ?? 1));
      }
    }
  }

  // ── Wave Clear / Shop ────────────────────────────────────────

  _onWaveCleared(wave) {
    this._stopLoop();
    this._setState(GAME_STATE.WAVE_CLEAR);

    if (wave >= RUN.TOTAL_WAVES) return; // victory handled by ALL_WAVES_DONE

    const perks = this.roguelike.drawShopPerks();
    const coins = this.roguelike.getCoins();

    this._setState(GAME_STATE.SHOP);
    this.ui.shop.show(
      perks,
      coins,
      (perk) => this._onPerkPurchased(perk),
      ()     => this._startNextWave(),
    );
  }

  _onPerkPurchased(perk) {
    this.roguelike.purchasePerk(perk);
    this._startNextWave();
  }

  _startNextWave() {
    this._setState(GAME_STATE.GAMEPLAY);
    this.waves.startNextWave();
    this._startLoop();
  }

  // ── Run End ──────────────────────────────────────────────────

  _endRun(won) {
    // Fix C: guard against re-entry (multiple zombies reaching house simultaneously)
    if (this._state === GAME_STATE.VICTORY || this._state === GAME_STATE.PERMADEATH) return;

    this._stopLoop();
    const seeds = this.roguelike.awardSeeds(this._runStats.wavesCleared, won);
    this._setState(won ? GAME_STATE.VICTORY : GAME_STATE.PERMADEATH);

    // Hide all gameplay UI cleanly
    this.ui.hideGameplay();
    this.ui.hidePause();
    this.ui.shop.hide();

    // Small delay so the last frame renders before showing end screen
    setTimeout(() => {
      this.ui.endScreen.show(
        {
          won,
          wavesCleared:  this._runStats.wavesCleared,
          zombiesKilled: this._runStats.zombiesKilled,
          coinsEarned:   this._runStats.coinsEarned,
          seedsEarned:   seeds,
          perks:         this.roguelike.getPurchasedPerks(),
        },
        () => this.beginDraft(),
        () => { this._setState(GAME_STATE.MAIN_MENU); this.ui.showMainMenu(this.mainMenu); },
      );
    }, 100);
  }

  // ── Pause ────────────────────────────────────────────────────

  _pauseGame() {
    if (this._state !== GAME_STATE.GAMEPLAY) return;
    this._stopLoop();
    this._setState(GAME_STATE.PAUSED);
    this.ui.showPause();
  }

  _resumeGame() {
    if (this._state !== GAME_STATE.PAUSED) return;
    this.ui.hidePause();
    this._setState(GAME_STATE.GAMEPLAY);
    this._startLoop();
  }

  _quitRun() {
    this._stopLoop();
    this.ui.hidePause();
    this.ui.hideGameplay();
    this._setState(GAME_STATE.MAIN_MENU);
    this.ui.showMainMenu(this.mainMenu);
  }

  // ── Setup Helpers ────────────────────────────────────────────

  _setupCanvas() {
    this._canvas        = document.getElementById('game-canvas');
    this._ctx           = this._canvas.getContext('2d');
    this._canvas.width  = CANVAS.WIDTH;
    this._canvas.height = CANVAS.HEIGHT;
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _resizeCanvas() {
    const scaleX = window.innerWidth  / CANVAS.WIDTH;
    const scaleY = window.innerHeight / CANVAS.HEIGHT;
    const scale  = Math.min(scaleX, scaleY);
    this._canvas.style.width  = `${CANVAS.WIDTH  * scale}px`;
    this._canvas.style.height = `${CANVAS.HEIGHT * scale}px`;
  }

  _setupUI() {
    this.ui = new UIManager(
      this._canvas,
      this.resources,
      this.saveManager,
      this._data.plants,
    );
  }

  _setupMainMenu() {
    this.mainMenu = new MainMenuScreen(
      () => this.beginDraft(),
      () => {
        this._setState(GAME_STATE.META);
        this.mainMenu.hide();
        this.ui.meta.show(() => {
          this._setState(GAME_STATE.MAIN_MENU);
          this.ui.showMainMenu(this.mainMenu);
        });
      },
      () => this.ui.showHowToPlay(),
      this.saveManager,
    );
  }

  _setState(state) { this._state = state; }

  _resetRunStats() {
    this._runStats = { zombiesKilled: 0, coinsEarned: 0, wavesCleared: 0 };
    this._aoeQueue = [];
  }

  /** @returns {string} */
  getState() { return this._state; }
}
