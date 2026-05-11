/**
 * tests/cypress/support/e2e.js
 * Global Cypress support file — runs before every test.
 *
 * - Suppresses known non-critical console errors
 * - Adds custom commands used across test files
 */

// ── Suppress known benign errors ─────────────────────────────────────────────
Cypress.on('uncaught:exception', (err) => {
  // Ignore AudioContext errors (no user gesture in headless tests)
  if (err.message.includes('AudioContext') || err.message.includes('audio')) {
    return false;
  }
  // Ignore fetch errors for missing asset files (sprites/audio not present in CI)
  if (err.message.includes('Failed to fetch') || err.message.includes('404')) {
    return false;
  }
  return true;
});

// ── Custom Commands ───────────────────────────────────────────────────────────

/**
 * Navigate to the game and wait for the main menu to be visible.
 */
Cypress.Commands.add('visitGame', () => {
  cy.visit('/', { timeout: 30000 });
  cy.get('[data-cy="screen-main-menu"]', { timeout: 15000 }).should('be.visible');
});

/**
 * Start a run with a given hero and difficulty via the UI flow.
 * @param {string} heroId - 'demonQueen' | 'necroKing' | 'humanCommander'
 * @param {string} difficulty - 'easy' | 'normal' | 'hard'
 */
Cypress.Commands.add('startRun', (heroId = 'demonQueen', difficulty = 'easy') => {
  cy.get('[data-cy="btn-play"]').click();
  cy.get('[data-cy="screen-hero-select"]').should('be.visible');
  cy.get(`[data-cy="hero-card-${heroId}"]`).click();
  cy.get(`[data-cy="difficulty-${difficulty}"]`).click();
  cy.get('[data-cy="btn-start-run"]').should('not.be.disabled').click();
  cy.get('[data-cy="screen-hud"]').should('be.visible');
});

/**
 * Get the GameTestAPI from the window object.
 * @returns {Cypress.Chainable}
 */
Cypress.Commands.add('gameAPI', () => {
  return cy.window().its('GameTestAPI');
});

/**
 * Wait for the game to reach a specific state.
 * @param {string} state
 */
Cypress.Commands.add('waitForState', (state) => {
  cy.window().its('GameTestAPI').invoke('getGameState').should('eq', state);
});
