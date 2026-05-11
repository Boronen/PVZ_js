/**
 * AudioManager.js — Web Audio API stubs.
 *
 * Provides a clean interface for playing SFX and music.
 * Currently silent stubs — extend with actual audio files as needed.
 */

export class AudioManager {
  constructor() {
    this._musicVolume = 0.5;
    this._sfxVolume   = 0.8;
    this._currentMusic= null;
  }

  /** @param {string} _trackId */
  playMusic(_trackId) {
    // Stub: wire up AudioContext + fetch audio files here
  }

  stopMusic() {
    // Stub
  }

  /** @param {string} _sfxId */
  playSFX(_sfxId) {
    // Stub: play short sound effect
  }

  /** @param {number} v 0–1 */
  setMusicVolume(v) { this._musicVolume = Math.max(0, Math.min(1, v)); }

  /** @param {number} v 0–1 */
  setSFXVolume(v) { this._sfxVolume = Math.max(0, Math.min(1, v)); }
}
