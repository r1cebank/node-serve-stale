module.exports = {
  env: {
    'es6': true,
    'node': true,
  },
  extends: [
    'google',
  ],
  globals: {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    'ecmaVersion': 2018,
    'sourceType': 'module',
    'ecmaFeatures': {
      'modules': true
    }
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    'comma-dangle': ['error', 'never'],
    'indent': ['error', 2],
    'object-curly-spacing': ['error', 'always']
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': [2, { args: 'none' }]
      }
    }
  ]
};
