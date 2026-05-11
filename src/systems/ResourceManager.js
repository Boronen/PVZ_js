/**
 * ResourceManager.js — Loads PvZ 2 sprite assets directly as images.
 *
 * The PvZ 2 API (https://pvz-2-api.vercel.app) blocks browser fetch() via CORS,
 * but its /assets/ static files ARE accessible as <img> src URLs.
 *
 * Strategy: construct the image URL directly from the known pattern and
 * load via HTMLImageElement (which is not subject to CORS fetch restrictions).
 *
 * Plant images:  https://pvz-2-api.vercel.app/assets/plants/{imageFile}
 * Zombie images: https://pvz-2-api.vercel.app/assets/zombies/{imageFile}
 *
 * Each plant/zombie def in JSON carries an `imageFile` field with the exact
 * filename as returned by the API (e.g. "Peashooter.png", "basic zombie.png").
 */

import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/constants.js';

const ASSET_BASE   = 'https://pvz-2-api.vercel.app/assets';
const PLANTS_PATH  = `${ASSET_BASE}/plants`;
const ZOMBIES_PATH = `${ASSET_BASE}/zombies`;

export class ResourceManager {
  constructor() {
    /** @type {Map<string, HTMLImageElement>} id → Image */
    this._plantSprites  = new Map();
    /** @type {Map<string, HTMLImageElement>} id → Image */
    this._zombieSprites = new Map();
    /** @type {boolean} */
    this._loaded = false;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Load all plant and zombie sprites directly from the PvZ 2 asset CDN.
   * Uses HTMLImageElement (bypasses CORS fetch restriction).
   * @param {object[]} plantDefs  - from plants.json (need .id and .imageFile)
   * @param {object[]} zombieDefs - from zombies.json (need .id and .imageFile)
   * @returns {Promise<void>}
   */
  async loadAll(plantDefs, zombieDefs) {
    const total  = plantDefs.length + zombieDefs.length;
    let   loaded = 0;

    const onProgress = () => {
      loaded++;
      EventBus.emit(EVENTS.ASSETS_PROGRESS, { loaded, total });
    };

    await Promise.all([
      ...plantDefs.map(def =>
        this._loadImage(`${PLANTS_PATH}/${encodeURIComponent(def.imageFile)}`)
          .then(img => { if (img) this._plantSprites.set(def.id, img); })
          .catch(() => {})
          .finally(onProgress)
      ),
      ...zombieDefs.map(def =>
        this._loadImage(`${ZOMBIES_PATH}/${encodeURIComponent(def.imageFile)}`)
          .then(img => { if (img) this._zombieSprites.set(def.id, img); })
          .catch(() => {})
          .finally(onProgress)
      ),
    ]);

    this._loaded = true;
    EventBus.emit(EVENTS.ASSETS_LOADED, {});
  }

  /**
   * Get a cached plant sprite by plant id.
   * @param {string} id  e.g. "peashooter"
   * @returns {HTMLImageElement|null}
   */
  getPlantSprite(id) {
    return this._plantSprites.get(id) ?? null;
  }

  /**
   * Get a cached zombie sprite by zombie id.
   * @param {string} id  e.g. "basic"
   * @returns {HTMLImageElement|null}
   */
  getZombieSprite(id) {
    return this._zombieSprites.get(id) ?? null;
  }

  /** @returns {boolean} */
  isLoaded() { return this._loaded; }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Load an image from a URL via HTMLImageElement (no CORS restriction).
   * Resolves null on error.
   * @param {string} url
   * @returns {Promise<HTMLImageElement|null>}
   */
  _loadImage(url) {
    return new Promise((resolve) => {
      const img   = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => {
        console.warn(`[ResourceManager] Image failed: ${url}`);
        resolve(null);
      };
      img.src = url;
    });
  }
}
