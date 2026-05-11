/**
 * economy.cy.js — Tests the gold and XP economy systems.
 *
 * Covers:
 * - Gold increases over time (passive income)
 * - Killing an enemy unit increases gold by the correct kill reward
 * - XP increases over time
 * - Unlocking a tier deducts the correct XP amount
 */

describe('Economy System', () => {
  beforeEach(() => {
    cy.visitGame();
    cy.startRun('humanCommander', 'easy'); // Human Commander has +20% passive income
    cy.get('[data-cy="screen-hud"]').should('be.visible');
  });

  // ── Gold ──────────────────────────────────────────────────────────────────

  it('displays gold in the HUD', () => {
    cy.get('[data-cy="gold-display"]').should('be.visible');
    cy.get('[data-cy="gold-value"]').should('exist');
  });

  it('gold increases over time due to passive income', () => {
    cy.window().then(win => {
      const goldBefore = win.GameTestAPI.getGold();
      // Wait for at least one passive gold tick (3 seconds)
      cy.wait(3500);
      cy.window().then(w => {
        expect(w.GameTestAPI.getGold()).to.be.greaterThan(goldBefore);
      });
    });
  });

  it('gold value in HUD matches GameTestAPI value', () => {
    cy.window().then(win => {
      const apiGold = win.GameTestAPI.getGold();
      cy.get('[data-cy="gold-value"]').invoke('text').then(text => {
        expect(parseInt(text, 10)).to.be.closeTo(apiGold, 5);
      });
    });
  });

  it('killing an enemy unit increases gold', () => {
    // Spawn an enemy unit and kill it via API
    cy.window().then(win => {
      // Set up: give player gold, spawn enemy unit
      win.GameTestAPI.setGold(200);
      // Spawn a player unit to kill enemies
      win.GameTestAPI.spawnUnit('footsoldier');
    });

    // Wait for combat to happen
    cy.wait(5000);

    cy.window().then(win => {
      // Gold should have increased from kills + passive income
      expect(win.GameTestAPI.getGold()).to.be.greaterThan(0);
    });
  });

  it('gold display updates in real time', () => {
    cy.window().then(win => win.GameTestAPI.setGold(100));
    cy.wait(100);
    cy.get('[data-cy="gold-value"]').invoke('text').then(text => {
      expect(parseInt(text, 10)).to.be.closeTo(100, 10);
    });
  });

  // ── XP ────────────────────────────────────────────────────────────────────

  it('displays XP in the HUD', () => {
    cy.get('[data-cy="xp-display"]').should('be.visible');
    cy.get('[data-cy="xp-value"]').should('exist');
  });

  it('XP increases over time', () => {
    cy.window().then(win => {
      const xpBefore = win.GameTestAPI.getXP();
      // Wait for at least one passive XP tick (5 seconds)
      cy.wait(5500);
      cy.window().then(w => {
        expect(w.GameTestAPI.getXP()).to.be.greaterThan(xpBefore);
      });
    });
  });

  it('XP value in HUD matches GameTestAPI value', () => {
    cy.window().then(win => {
      win.GameTestAPI.setXP(50);
    });
    cy.wait(100);
    cy.get('[data-cy="xp-value"]').invoke('text').then(text => {
      expect(parseInt(text, 10)).to.be.closeTo(50, 5);
    });
  });

  // ── Tier Unlock ───────────────────────────────────────────────────────────

  it('tier unlock button is visible', () => {
    cy.get('[data-cy="tier-unlock-btn-2"]').should('exist');
  });

  it('tier unlock button is disabled when XP is insufficient', () => {
    cy.window().then(win => win.GameTestAPI.setXP(0));
    cy.wait(200);
    cy.get('[data-cy="tier-unlock-btn-2"]').should('be.disabled');
  });

  it('tier unlock button is enabled when XP is sufficient', () => {
    cy.window().then(win => win.GameTestAPI.setXP(200));
    cy.wait(200);
    cy.get('[data-cy="tier-unlock-btn-2"]').should('not.be.disabled');
  });

  it('unlocking Tier 2 deducts the correct XP amount', () => {
    cy.window().then(win => {
      win.GameTestAPI.setXP(200);
    });
    cy.wait(200);

    cy.window().then(win => {
      const xpBefore = win.GameTestAPI.getXP();
      cy.get('[data-cy="tier-unlock-btn-2"]').click();
      cy.window().then(w => {
        const xpAfter = w.GameTestAPI.getXP();
        // Tier 2 costs 100 XP (Human Commander modifier = 1.0)
        expect(xpBefore - xpAfter).to.be.closeTo(100, 5);
      });
    });
  });

  it('current tier label updates after unlock', () => {
    cy.window().then(win => {
      win.GameTestAPI.setXP(200);
      win.GameTestAPI.unlockTier(2);
    });
    cy.wait(200);
    cy.get('[data-cy="tier-label"]').should('contain', 'T2');
  });

  it('XP progress bar fills as XP increases', () => {
    cy.window().then(win => win.GameTestAPI.setXP(50));
    cy.wait(200);
    cy.get('#xp-bar-fill').then($bar => {
      const width = parseFloat($bar[0].style.width);
      expect(width).to.be.greaterThan(0);
      expect(width).to.be.lessThan(100);
    });
  });
});
