/**
 * EventBus.js — Global pub/sub event system singleton.
 *
 * All game systems communicate through events rather than direct references.
 * This decouples systems and makes the architecture extensible.
 *
 * Usage:
 *   import { EventBus } from './EventBus.js';
 *   EventBus.on('wave:started', (data) => { ... });
 *   EventBus.emit('wave:started', { waveNumber: 1 });
 *   EventBus.off('wave:started', myCallback);
 */

class EventBusClass {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {boolean} */
    this._debug = false;
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} The callback (for easy off() chaining)
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      console.error(`[EventBus] on('${event}'): callback must be a function`);
      return callback;
    }
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return callback;
  }

  /**
   * Subscribe exactly once — auto-unsubscribes after first call.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} The wrapper
   */
  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    listeners.delete(callback);
    if (listeners.size === 0) this._listeners.delete(event);
  }

  /**
   * Emit an event, calling all registered listeners synchronously.
   * @param {string} event
   * @param {*} [data]
   */
  emit(event, data) {
    if (this._debug) console.warn(`[EventBus] emit: ${event}`, data);
    const listeners = this._listeners.get(event);
    if (!listeners || listeners.size === 0) return;
    for (const cb of [...listeners]) {
      try { cb(data); }
      catch (err) { console.error(`[EventBus] Error in listener for '${event}':`, err); }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events if none specified.
   * @param {string} [event]
   */
  clear(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
  }

  /** @param {boolean} enabled */
  setDebug(enabled) { this._debug = enabled; }

  /** @returns {string[]} */
  getRegisteredEvents() { return [...this._listeners.keys()]; }
}

export const EventBus = new EventBusClass();
