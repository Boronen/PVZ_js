module.exports = {
  env: {
    browser: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // Code quality
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'warn',

    // OOP / class rules
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'warn',

    // Style
    'indent': ['error', 2, { SwitchCase: 1 }],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'eol-last': ['error', 'always'],
    'no-trailing-spaces': 'error',
    'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'space-infix-ops': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],

    // Best practices
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-return-assign': 'error',
    'no-throw-literal': 'error',
    'prefer-template': 'warn',
    'no-duplicate-imports': 'error',
  },
  globals: {
    // Expose test API only in test/dev environments
    GameTestAPI: 'readonly',
  },
};
