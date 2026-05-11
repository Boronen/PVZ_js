import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // Base URL for the local dev server
    baseUrl: 'http://localhost:8080',

    // Test file location
    specPattern: 'tests/cypress/**/*.cy.js',

    // Support file
    supportFile: 'tests/cypress/support/e2e.js',

    // Fixtures folder
    fixturesFolder: 'tests/cypress/fixtures',

    // Screenshots and videos
    screenshotsFolder: 'tests/cypress/screenshots',
    videosFolder: 'tests/cypress/videos',

    // Viewport — matches game's minimum supported resolution
    viewportWidth: 1280,
    viewportHeight: 720,

    // Timeouts
    defaultCommandTimeout: 8000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,

    // Retry failed tests in CI
    retries: {
      runMode: 2,
      openMode: 0,
    },

    // Environment variables
    env: {
      // Set to 'true' to enable GameTestAPI exposure
      TEST_MODE: 'true',
    },

    setupNodeEvents(on, config) {
      // Node event listeners can be added here
      return config;
    },
  },
});
