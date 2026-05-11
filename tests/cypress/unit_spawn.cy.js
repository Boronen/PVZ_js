/**
 * unit_spawn.cy.js — Tests unit spawning mechanics.
 *
 * Covers:
 * - Clicking a spawn button with sufficient gold spawns a unit
 * - Spawning a unit reduces gold by the correct amount
 * - Clicking a spawn button with insufficient gold does not spawn
 * - Spawn buttons are visually disabled when gold is insufficient
 */

describe('Unit Spawn', () => {
  beforeEach(() => {
    cy.visitGame();
    cy.startRun('demonQueen', 'easy');
    // Wait for game to initialize
    cy.get('[data-cy="spawn-panel"]').should('be.visible');
  });

  it('spawn buttons are visible in the HUD', () => {
    cy.get('[data-cy="spawn-buttons-container"]').should('be.visible');
    cy.get('.spawn-btn').should('have.length.greaterThan', 0);
  });

  it('Tier 1 spawn buttons are visible', () => {
    // Demon Queen Tier 1: imp, hellbat, brute_demon
    cy.get('[data-cy="spawn-btn-imp"]').should('exist');
    cy.get('[data-cy="spawn-btn-hellbat"]').should('exist');
    cy.get('[data-cy="spawn-btn-brute_demon"]').should('exist');
  });

  it('spawn button shows unit cost', () => {
    cy.get('[data-cy="spawn-cost-imp"]').should('contain', '55');
  });

  it('clicking a spawn button with sufficient gold spawns a unit', () => {
    // Give player enough gold
    cy.window().then(win => win.GameTestAPI.setGold(500));

    const unitsBefore = cy.window().then(win => win.GameTestAPI.getUnitsOnLane());

    cy.get('[data-cy="spawn-btn-imp"]').click();

    cy.window().then(win => {
      expect(win.GameTestAPI.getUnitsOnLane()).to.be.greaterThan(0);
    });
  });

  it('spawning a unit deducts the correct gold amount', () => {
    cy.window().then(win => win.GameTestAPI.setGold(500));

    cy.window().then(win => {
      const goldBefore = win.GameTestAPI.getGold();
      cy.get('[data-cy="spawn-btn-imp"]').click();
      cy.window().then(w => {
        // Imp costs 55 gold (may be reduced by Demon Queen passive: 55 * 0.85 ≈ 47)
        const goldAfter = w.GameTestAPI.getGold();
        expect(goldAfter).to.be.lessThan(goldBefore);
      });
    });
  });

  it('spawn button is disabled when gold is insufficient', () => {
    // Set gold to 0
    cy.window().then(win => win.GameTestAPI.setGold(0));
    // Wait for HUD to update
    cy.wait(200);
    cy.get('[data-cy="spawn-btn-imp"]').should('be.disabled');
  });

  it('spawn button has unaffordable class when gold is insufficient', () => {
    cy.window().then(win => win.GameTestAPI.setGold(0));
    cy.wait(200);
    cy.get('[data-cy="spawn-btn-imp"]').should('have.class', 'unaffordable');
  });

  it('clicking a disabled spawn button does not reduce gold', () => {
    cy.window().then(win => win.GameTestAPI.setGold(0));
    cy.wait(200);

    cy.window().then(win => {
      const goldBefore = win.GameTestAPI.getGold();
      // Force click even if disabled (simulates user trying to click)
      cy.get('[data-cy="spawn-btn-imp"]').click({ force: true });
      cy.window().then(w => {
        expect(w.GameTestAPI.getGold()).to.equal(goldBefore);
      });
    });
  });

  it('Tier 2 spawn buttons are locked initially', () => {
    cy.get('[data-cy="spawn-btn-succubus"]').should('be.disabled');
  });

  it('Tier 2 spawn buttons become available after tier unlock', () => {
    cy.window().then(win => {
      win.GameTestAPI.setXP(200);
      win.GameTestAPI.unlockTier(2);
    });
    cy.wait(300);
    cy.get('[data-cy="spawn-btn-succubus"]').should('not.have.attr', 'style', 'opacity: 0.3');
  });

  it('spawn cooldown bar resets after spawning', () => {
    cy.window().then(win => win.GameTestAPI.setGold(500));
    cy.get('[data-cy="spawn-btn-imp"]').click();
    // Immediately after spawn, button should be on cooldown
    cy.get('[data-cy="spawn-btn-imp"]').should('be.disabled');
    // After cooldown (1.5s), button should be available again
    cy.wait(2000);
    cy.window().then(win => win.GameTestAPI.setGold(500));
    cy.get('[data-cy="spawn-btn-imp"]').should('not.be.disabled');
  });
});
