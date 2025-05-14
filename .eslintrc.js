module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  globals: {
    define: 'readonly',
    globalThis: 'readonly'
  },
  rules: {
    'no-unused-expressions': 'off',
    'no-undef': 'warn',
    'no-restricted-globals': 'off'
  }
};
