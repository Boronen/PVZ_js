/**
 * main.js — PvZ Roguelike entry point.
 *
 * 1. Load all JSON data files in parallel
 * 2. Instantiate GameManager with the loaded data
 * 3. Call init() to fetch API assets and show the main menu
 */

import { GameManager } from './core/GameManager.js';

/**
 * Load a JSON file from src/data/.
 * @param {string} filename
 * @returns {Promise<object>}
 */
async function loadJSON(filename) {
  const res = await fetch(`src/data/${filename}`);
  if (!res.ok) throw new Error(`Failed to load ${filename} (HTTP ${res.status})`);
  return res.json();
}

/**
 * Bootstrap the game:
 *  - Load all data JSON files in parallel
 *  - Build the gameData object
 *  - Create and initialise GameManager
 */
async function bootstrap() {
  try {
    const [plantsData, zombiesData, perksData, wavesData] = await Promise.all([
      loadJSON('plants.json'),
      loadJSON('zombies.json'),
      loadJSON('perks.json'),
      loadJSON('waves.json'),
    ]);

    const gameData = {
      plants:         plantsData.plants,
      zombies:        zombiesData.zombies,
      perks:          perksData.perks,
      rarityWeights:  perksData.rarityWeights,
      waves:          wavesData.waves,
      eliteMutations: wavesData.eliteMutations,
    };

    const game = new GameManager(gameData);
    await game.init();

    // Expose test API on localhost / ?testMode=true
    if (_isTestEnv()) {
      window.game = game;
      window.GameTestAPI = _buildTestAPI(game);
    }

  } catch (err) {
    console.error('[PvZ] Fatal bootstrap error:', err);
    _showFatalError(err.message);
  }
}

/** @returns {boolean} */
function _isTestEnv() {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    new URLSearchParams(window.location.search).get('testMode') === 'true'
  );
}

/**
 * Build a minimal test API for Cypress / manual testing.
 * @param {GameManager} game
 */
function _buildTestAPI(game) {
  return {
    getState:        () => game.getState(),
    getSun:          () => game.sun?.getSun()   ?? 0,
    getCoins:        () => game.roguelike?.getCoins() ?? 0,
    getWave:         () => game.waves?.getCurrentWave() ?? 0,
    getZombies:      () => game.waves?.getActiveZombies().length ?? 0,
    getPlants:       () => game.grid?.getAllPlants().length ?? 0,
    getPerks:        () => game.roguelike?.getPurchasedPerks() ?? [],
    getMetaSeeds:    () => game.saveManager.loadMeta().seeds,
    addSun:          (n) => game.sun?.addSun(n),
    beginDraft:      ()  => game.beginDraft(),
  };
}

/** Render a fatal error message when bootstrap fails. */
function _showFatalError(message) {
  document.body.innerHTML = `
    <div style="
      display:flex; align-items:center; justify-content:center;
      height:100vh; background:#0d1f0d; color:#e8f5e9;
      font-family:sans-serif; text-align:center; padding:40px;
    ">
      <div>
        <div style="font-size:64px; margin-bottom:16px;">🌻</div>
        <h1 style="color:#f9c74f; margin-bottom:16px;">Failed to Load Game</h1>
        <p style="color:#81c784; margin-bottom:8px;">
          Could not load required game data. Please ensure you are running
          through a local web server (not directly from the file system).
        </p>
        <p style="color:#4a7a4a; font-size:0.85rem;">
          Run: <code style="color:#f9c74f;">npm run dev</code>
          then open <code style="color:#f9c74f;">http://localhost:8080</code>
        </p>
        <p style="color:#2d4a2d; font-size:0.75rem; margin-top:16px;">
          Error: ${message}
        </p>
      </div>
    </div>
  `;
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
