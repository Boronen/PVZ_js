/**
 * hero_select.cy.js — Tests the hero selection screen.
 *
 * Covers:
 * - Three hero cards are displayed
 * - Clicking a card highlights it
 * - Start button is disabled until a hero is selected
 * - Selecting a hero and clicking Start transitions to gameplay
 */

describe('Hero Select Screen', () => {
  beforeEach(() => {
    cy.visitGame();
    cy.get('[data-cy="btn-play"]').click();
    cy.get('[data-cy="screen-hero-select"]').should('be.visible');
  });

  it('shows exactly three hero cards', () => {
    cy.get('.hero-card').should('have.length', 3);
  });

  it('shows all three hero names', () => {
    cy.get('.hero-card').contains('Demon Queen');
    cy.get('.hero-card').contains('Necro King');
    cy.get('.hero-card').contains('Human Commander');
  });

  it('shows hero playstyle tags on each card', () => {
    cy.get('.hero-tag').should('have.length.greaterThan', 0);
  });

  it('shows passive description on each card', () => {
    cy.get('.hero-passive').should('have.length', 3);
    cy.get('.hero-passive').first().should('not.be.empty');
  });

  it('shows starting bonus on each card', () => {
    cy.get('.hero-starting-bonus').should('have.length', 3);
  });

  it('Start Run button is disabled before selecting a hero', () => {
    cy.get('[data-cy="btn-start-run"]').should('be.disabled');
  });

  it('clicking a hero card highlights it with the selected class', () => {
    cy.get('[data-cy="hero-card-demonQueen"]').click();
    cy.get('[data-cy="hero-card-demonQueen"]').should('have.class', 'selected');
  });

  it('only one hero card is selected at a time', () => {
    cy.get('[data-cy="hero-card-demonQueen"]').click();
    cy.get('[data-cy="hero-card-necroKing"]').click();
    cy.get('.hero-card.selected').should('have.length', 1);
    cy.get('[data-cy="hero-card-necroKing"]').should('have.class', 'selected');
    cy.get('[data-cy="hero-card-demonQueen"]').should('not.have.class', 'selected');
  });

  it('Start Run button becomes enabled after selecting a hero', () => {
    cy.get('[data-cy="hero-card-demonQueen"]').click();
    cy.get('[data-cy="btn-start-run"]').should('not.be.disabled');
  });

  it('shows difficulty selector with three options', () => {
    cy.get('[data-cy="difficulty-selector"]').should('be.visible');
    cy.get('[data-cy="difficulty-easy"]').should('be.visible');
    cy.get('[data-cy="difficulty-normal"]').should('be.visible');
    cy.get('[data-cy="difficulty-hard"]').should('be.visible');
  });

  it('Normal difficulty is selected by default', () => {
    cy.get('[data-cy="difficulty-normal"]').should('have.class', 'active');
  });

  it('clicking a difficulty button activates it', () => {
    cy.get('[data-cy="difficulty-hard"]').click();
    cy.get('[data-cy="difficulty-hard"]').should('have.class', 'active');
    cy.get('[data-cy="difficulty-normal"]').should('not.have.class', 'active');
  });

  it('Back button returns to main menu', () => {
    cy.get('[data-cy="btn-back-to-menu"]').click();
    cy.get('[data-cy="screen-main-menu"]').should('be.visible');
    cy.get('[data-cy="screen-hero-select"]').should('have.class', 'hidden');
  });

  it('selecting a hero and clicking Start transitions to gameplay', () => {
    cy.get('[data-cy="hero-card-demonQueen"]').click();
    cy.get('[data-cy="difficulty-easy"]').click();
    cy.get('[data-cy="btn-start-run"]').click();
    cy.get('[data-cy="screen-hud"]').should('be.visible');
    cy.get('[data-cy="screen-hero-select"]').should('have.class', 'hidden');
  });
});
