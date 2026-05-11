/**
 * constants.js — All shared game constants for PvZ Roguelike.
 * Import from here; never hardcode magic numbers in classes.
 */

/** Canvas logical resolution */
export const CANVAS = {
  WIDTH:  1280,
  HEIGHT: 720,
};

/** Grid layout constants */
export const GRID = {
  ROWS:        5,
  COLS:        9,
  CELL_W:      80,
  CELL_H:      80,
  ORIGIN_X:    220,   // left edge of grid on canvas
  ORIGIN_Y:    120,   // top edge of grid on canvas
  LAWNMOWER_X: 180,   // x position of lawnmowers
};

/** HUD layout heights */
export const HUD_LAYOUT = {
  TOP_BAR_H:   56,
  SEED_TRAY_H: 100,
};

/** Sun economy */
export const SUN = {
  STARTING:      150,
  SKY_DROP_MIN:  25,
  SKY_DROP_MAX:  50,
  SKY_INTERVAL:  10,   // seconds between sky sun drops
  FALL_SPEED:    60,   // px/s
  COLLECT_RADIUS:30,
  LIFETIME:      10,   // seconds before disappearing
};

/** Zombie spawn side */
export const SPAWN = {
  ZOMBIE_START_X: CANVAS.WIDTH + 60,
};

/** Roguelike run config */
export const RUN = {
  TOTAL_WAVES:      10,
  LAWNMOWERS_PER_ROW: 1,
  STARTING_COINS:   0,
  SEEDS_PER_WAVE:   5,
  SEEDS_BONUS_WIN:  20,
  DRAFT_POOL_SIZE:  5,
  DRAFT_PICK_COUNT: 3,
  SHOP_PERK_COUNT:  3,
  ELITE_EVERY_N_WAVES: 3,
};

/** @enum {string} All valid game states */
export const GAME_STATE = {
  LOADING:     'loading',
  MAIN_MENU:   'main_menu',
  DRAFT:       'draft',
  GAMEPLAY:    'gameplay',
  WAVE_CLEAR:  'wave_clear',
  SHOP:        'shop',
  PAUSED:      'paused',
  PERMADEATH:  'permadeath',
  VICTORY:     'victory',
  META:        'meta',
};

/** @enum {string} All EventBus event names */
export const EVENTS = {
  // Asset loading
  ASSETS_LOADED:        'assets:loaded',
  ASSETS_PROGRESS:      'assets:progress',

  // Game state
  GAME_STATE_CHANGED:   'game:stateChanged',
  RUN_STARTED:          'run:started',
  RUN_ENDED:            'run:ended',
  GAME_PAUSED:          'game:paused',
  GAME_RESUMED:         'game:resumed',

  // Wave
  WAVE_STARTED:         'wave:started',
  WAVE_CLEARED:         'wave:cleared',
  ZOMBIE_SPAWNED:       'zombie:spawned',
  ALL_WAVES_DONE:       'wave:allDone',

  // Plants
  PLANT_PLACED:         'plant:placed',
  PLANT_DIED:           'plant:died',
  PLANT_REMOVED:        'plant:removed',

  // Zombies
  ZOMBIE_DIED:          'zombie:died',
  ZOMBIE_REACHED_HOUSE: 'zombie:reachedHouse',

  // Projectiles
  PROJECTILE_HIT:       'projectile:hit',

  // Sun
  SUN_DROPPED:          'sun:dropped',
  SUN_COLLECTED:        'sun:collected',
  SUN_CHANGED:          'sun:changed',

  // Coins
  COINS_CHANGED:        'coins:changed',

  // Lawnmower
  LAWNMOWER_TRIGGERED:  'lawnmower:triggered',

  // Roguelike
  DRAFT_CONFIRMED:      'draft:confirmed',
  PERK_PURCHASED:       'perk:purchased',
  PERK_APPLIED:         'perk:applied',
  META_UNLOCK_BOUGHT:   'meta:unlockBought',

  // UI
  SEED_SELECTED:        'seed:selected',
  SEED_DESELECTED:      'seed:deselected',
  SHOVEL_TOGGLED:       'shovel:toggled',
  CELL_CLICKED:         'cell:clicked',
};

/** Perk effect type identifiers */
export const PERK_EFFECT = {
  SUN_DISCOUNT:       'sun_discount',
  PLANT_DAMAGE_MULT:  'plant_damage_mult',
  PLANT_HP_MULT:      'plant_hp_mult',
  PLANT_COOLDOWN_MULT:'plant_cooldown_mult',
  ZOMBIE_SLOW:        'zombie_slow',
  EXTRA_SEED_SLOT:    'extra_seed_slot',
  SUN_PRODUCTION:     'sun_production',
  STARTING_SUN:       'starting_sun',
  COIN_BONUS:         'coin_bonus',
  LAWNMOWER_EXTRA:    'lawnmower_extra',
};

/** Meta unlock type identifiers */
export const META_UNLOCK = {
  PLANT_UNLOCK:   'plant_unlock',
  STARTING_SUN:   'starting_sun_bonus',
  EXTRA_SLOT:     'extra_slot',
  COIN_RATE:      'coin_rate',
};
