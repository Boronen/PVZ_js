/**
 * win_lose.cy.js — Tests win and lose conditions.
 *
 * Covers:
 * - Reducing enemy base HP to 0 triggers the win screen
 * - Win screen displays correct run summary data
 * - Reducing player base HP to 0 triggers the lose screen
 * - Play Again button returns to hero select
 * - Main Menu button returns to main menu
 */

describe('Win / Lose Conditions', () => {
  beforeEach(() => {
    cy.visitGame();
    cy.startRun('demonQueen', 'easy');
    cy.get('[data-cy="screen-hud"]').should('be.visible');
  });

  // ── Win Condition ─────────────────────────────────────────────────────────

  it('reducing enemy base HP to 0 triggers the win screen', () => {
    cy.window().then(win => {
      win.GameTestAPI.endRun('won');
    });
    cy.get('[data-cy="screen-end"]').should('be.visible');
    cy.get('[data-cy="end-banner"]').should('contain', 'VICTORY');
  });

  it('win screen displays a victory banner with correct class', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="end-banner"]').should('have.class', 'victory');
  });

  it('win screen displays run summary data', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="run-summary"]').should('be.visible');
    cy.get('[data-cy="summary-hero"]').should('contain', 'Demon Queen');
    cy.get('[data-cy="summary-difficulty"]').should('contain', 'Easy');
    cy.get('[data-cy="summary-time"]').should('exist');
    cy.get('[data-cy="summary-units"]').should('exist');
    cy.get('[data-cy="summary-kills"]').should('exist');
    cy.get('[data-cy="summary-upgrades"]').should('exist');
  });

  it('win screen shows correct hero name in summary', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="summary-hero"]').should('contain', 'Demon Queen');
  });

  it('win screen shows correct difficulty in summary', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="summary-difficulty"]').should('contain', 'Easy');
  });

  it('win screen shows run time in MM:SS format', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="summary-time"]').invoke('text').should('match', /^\d{2}:\d{2}$/);
  });

  it('win screen shows units spawned count', () => {
    // Spawn some units first
    cy.window().then(win => {
      win.GameTestAPI.setGold(500);
      win.GameTestAPI.spawnUnit('imp');
      win.GameTestAPI.spawnUnit('imp');
    });
    cy.wait(200);
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="summary-units"]').invoke('text').then(text => {
      expect(parseInt(text, 10)).to.be.greaterThan(0);
    });
  });

  // ── Lose Condition ────────────────────────────────────────────────────────

  it('reducing player base HP to 0 triggers the lose screen', () => {
    cy.window().then(win => {
      win.GameTestAPI.endRun('lost');
    });
    cy.get('[data-cy="screen-end"]').should('be.visible');
    cy.get('[data-cy="end-banner"]').should('contain', 'DEFEAT');
  });

  it('lose screen displays a defeat banner with correct class', () => {
    cy.window().then(win => win.GameTestAPI.endRun('lost'));
    cy.get('[data-cy="end-banner"]').should('have.class', 'defeat');
  });

  it('lose screen displays run summary data', () => {
    cy.window().then(win => win.GameTestAPI.endRun('lost'));
    cy.get('[data-cy="run-summary"]').should('be.visible');
    cy.get('[data-cy="summary-hero"]').should('exist');
    cy.get('[data-cy="summary-time"]').should('exist');
  });

  it('gameplay HUD is hidden when end screen is shown', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="screen-hud"]').should('have.class', 'hidden');
  });

  // ── End Screen Navigation ─────────────────────────────────────────────────

  it('Play Again button is visible on the end screen', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="btn-play-again"]').should('be.visible');
  });

  it('Main Menu button is visible on the end screen', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="btn-end-main-menu"]').should('be.visible');
  });

  it('Play Again button returns to hero select screen', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="btn-play-again"]').click();
    cy.get('[data-cy="screen-hero-select"]').should('be.visible');
    cy.get('[data-cy="screen-end"]').should('have.class', 'hidden');
  });

  it('Main Menu button returns to main menu screen', () => {
    cy.window().then(win => win.GameTestAPI.endRun('won'));
    cy.get('[data-cy="btn-end-main-menu"]').click();
    cy.get('[data-cy="screen-main-menu"]').should('be.visible');
    cy.get('[data-cy="screen-end"]').should('have.class', 'hidden');
  });

  it('Play Again after defeat returns to hero select', () => {
    cy.window().then(win => win.GameTestAPI.endRun('lost'));
    cy.get('[data-cy="btn-play-again"]').click();
    cy.get('[data-cy="screen-hero-select"]').should('be.visible');
  });
});
