import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Last: turns off the stylistic rules Prettier owns.
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // The route table declares lazy route components but exports only the
    // router itself, which react-refresh reads as a component module with a
    // non-component export. Fast Refresh does not apply to a route table —
    // editing it remounts the tree either way — so the rule has nothing to
    // protect here.
    files: ['src/routes/router.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
