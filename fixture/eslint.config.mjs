/**
 * Flat ESLint config for the lintscope demo fixture. Pure rules — no plugins —
 * so the demo runs against any installed ESLint version without extra deps.
 */
export default [
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'error',
      eqeqeq: 'error',
      'prefer-const': 'warn',
      'no-unreachable': 'error',
      'no-undef': 'error',
      'no-var': 'warn',
    },
  },
];
