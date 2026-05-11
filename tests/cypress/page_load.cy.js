/**
 * page_load.cy.js — Tests that the game loads correctly.
 *
 * Covers:
 * - Main menu loads without errors
 * - Game title is visible
 * - Play button is present and clickable
 */

describe('Page Load', () => {
  beforeEach(() => {
    cy.visitGame();
  });

  it('loads the main menu without errors', () => {
    cy.get('[data-cy="screen-main-menu"]').should('be.visible');
  });

  it('displays the game title', () => {
    cy.get('[data-cy="game-title"]').should('be.visible');
    cy.get('[data-cy="game-title"]').contains('WARLORDS');
    cy.get('[data-cy="game-title"]').contains('LAST SIEGE');
  });

  it('shows the Play button', () => {
    cy.get('[data-cy="btn-play"]').should('be.visible');
    cy.get('[data-cy="btn-play"]').should('not.be.disabled');
  });

  it('shows How to Play, Settings, and Credits buttons', () => {
    cy.get('[data-cy="btn-how-to-play"]').should('be.visible');
    cy.get('[data-cy="btn-settings"]').should('be.visible');
    cy.get('[data-cy="btn-credits"]').should('be.visible');
  });

  it('does not show the Resume button when no save exists', () => {
    // Clear any existing save
    cy.window().then(win => win.localStorage.removeItem('warlords_save'));
    cy.reload();
    cy.get('[data-cy="screen-main-menu"]').should('be.visible');
    cy.get('[data-cy="btn-resume"]').should('have.class', 'hidden');
  });

  it('clicking Play navigates to hero select', () => {
    cy.get('[data-cy="btn-play"]').click();
    cy.get('[data-cy="screen-hero-select"]').should('be.visible');
    cy.get('[data-cy="screen-main-menu"]').should('have.class', 'hidden');
  });

  it('opens How to Play modal', () => {
    cy.get('[data-cy="btn-how-to-play"]').click();
    cy.get('[data-cy="modal-how-to-play"]').should('be.visible');
    cy.get('[data-cy="btn-close-how-to-play"]').click();
    cy.get('[data-cy="modal-how-to-play"]').should('have.class', 'hidden');
  });

  it('opens Settings modal', () => {
    cy.get('[data-cy="btn-settings"]').click();
    cy.get('[data-cy="modal-settings"]').should('be.visible');
    cy.get('[data-cy="sfx-volume"]').should('exist');
    cy.get('[data-cy="music-volume"]').should('exist');
    cy.get('[data-cy="btn-close-settings"]').click();
    cy.get('[data-cy="modal-settings"]').should('have.class', 'hidden');
  });

  it('renders the game canvas', () => {
    cy.get('#game-canvas').should('exist');
    cy.get('#game-canvas').should('have.attr', 'width', '1280');
    cy.get('#game-canvas').should('have.attr', 'height', '720');
  });
});
