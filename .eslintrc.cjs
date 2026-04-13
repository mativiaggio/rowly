module.exports = {
  root: true,
  ignorePatterns: ['dist', 'dist-electron', 'release', '.eslintrc.cjs'],
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['./tsconfig.renderer.json', './tsconfig.electron.json'],
        tsconfigRootDir: __dirname,
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
      ],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
      },
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      env: {
        browser: true,
        es2020: true,
      },
      extends: ['plugin:react-hooks/recommended'],
      plugins: ['react-refresh'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'electron',
                message: 'Use the typed window.rowly bridge instead of importing Electron in the renderer.',
              },
            ],
            patterns: [
              {
                group: ['../electron/*', '../../electron/*', '../../../electron/*'],
                message: 'Renderer code must not import Electron process modules directly.',
              },
            ],
          },
        ],
        'no-restricted-properties': [
          'error',
          {
            object: 'window',
            property: 'ipcRenderer',
            message: 'Use window.rowly instead of window.ipcRenderer.',
          },
        ],
        'react-refresh/only-export-components': [
          'warn',
          { allowConstantExport: true },
        ],
      },
    },
    {
      files: ['electron/**/*.ts'],
      env: {
        node: true,
        es2020: true,
      },
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@app/*', '@components/*', '@features/*', '@hooks/*', '@lib/*', '@/*'],
                message: 'Electron main and preload must not depend on renderer modules.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['vite.config.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: __dirname,
      },
      env: {
        node: true,
        es2020: true,
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
      ],
    },
  ],
}
