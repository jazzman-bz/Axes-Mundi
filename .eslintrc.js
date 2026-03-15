module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'airbnb',
    'airbnb-typescript',
    'airbnb/hooks',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'jsx-a11y',
    'react',
    'react-hooks',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-use-before-define': 'warn',
    '@typescript-eslint/no-dupe-class-members': 'warn',
    
    // Import rules
    'import/extensions': 'off',
    'import/prefer-default-export': 'off',
    'import/no-unresolved': 'off', // Disable import resolution errors
    'import/no-cycle': 'off', // Disable circular dependency detection
    'import/no-extraneous-dependencies': 'off', // Disable dependency validation
    'import/no-duplicates': 'off', // Disable duplicate import detection
    'import/order': 'off', // Disable import order validation
    'import/no-self-import': 'off', // Disable self-import detection
    'import/no-relative-packages': 'off', // Disable relative package detection
    'import/no-useless-path-segments': 'off', // Disable path segment validation
    'import/no-named-as-default': 'off', // Disable named-as-default validation
    
    // General rules
    'no-console': 'off',
    'no-debugger': 'warn',
    'no-unused-vars': 'off', // Use TypeScript version instead
    'prefer-const': 'error',
    'no-var': 'warn', // Changed from error to warn
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': 'error',
    'no-duplicate-imports': 'error',
    'no-useless-rename': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-dangle': ['warn', 'always-multiline'], // Changed from error to warn
    'quotes': ['warn', 'single'], // Changed from error to warn
    'semi': ['warn', 'always'], // Changed from error to warn
    'indent': ['warn', 2], // Changed from error to warn
    'max-len': ['warn', { code: 120 }],
    
    // Loosen some strict rules
    'no-plusplus': 'warn', // Changed from error to warn
    'no-param-reassign': 'warn', // Changed from error to warn
    'no-lonely-if': 'warn', // Changed from error to warn
    'class-methods-use-this': 'warn', // Changed from error to warn
    'no-restricted-syntax': 'warn', // Changed from error to warn
    'no-await-in-loop': 'warn', // Changed from error to warn
    'vars-on-top': 'warn', // Changed from error to warn
    'no-promise-executor-return': 'warn', // Changed from error to warn
    'default-case': 'warn', // Changed from error to warn
    'max-classes-per-file': 'warn', // Changed from error to warn
    'no-mixed-operators': 'warn', // Changed from error to warn
    'no-new': 'warn', // Changed from error to warn
    'no-alert': 'warn', // Changed from error to warn
    'no-restricted-globals': 'warn', // Changed from error to warn
    'function-paren-newline': 'warn', // Changed from error to warn
    'function-call-argument-newline': 'warn', // Changed from error to warn
    'no-multiple-empty-lines': 'warn', // Changed from error to warn
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        // TypeScript specific overrides
        '@typescript-eslint/no-explicit-any': 'off', // Allow any in TypeScript files
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js',
    '*.jsx',
    '*.min.js',
    '*.bundle.js',
    '*.chunk.js',
    'app/generated/version.ts',
    'vite.config.ts', // Exclude vite config from linting
    'vitest.config.ts',
  ],
};
