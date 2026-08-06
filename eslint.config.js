import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/**
 * ESLint — deliberately NARROW. It exists for one job.
 *
 * WHY THIS FILE EXISTS. On 2026-08-05 the clinic Billing page was found to have
 * been crashing on EVERY visit since 2026-08-01 — a `useState` declared beside
 * the markup that used it, which put it below an `if (loading)` early return.
 * The loading render called one fewer hook than the loaded render, so React
 * threw #310 and the error boundary ate the page. `CreatePartnershipPage` had
 * the identical defect. Both type-checked at zero errors the entire time:
 * **a hooks-order violation is a runtime contract that `tsc` cannot see.**
 *
 * `react-hooks/rules-of-hooks` finds this whole class in one pass.
 *
 * SCOPE. Only the hooks rules are on. This repo has never had a linter, so
 * enabling a general recommended set would produce thousands of pre-existing
 * warnings, and a signal nobody reads is not a signal. `rules-of-hooks` is an
 * ERROR (it means a component is broken at runtime); `exhaustive-deps` is a
 * WARN (usually a stale-closure smell, not always a bug). Add more rules later
 * if you are willing to fix the backlog they surface.
 *
 * Run: `npm run lint` — or `npm run lint:fix` for the auto-fixable subset.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      // BUILT OUTPUT — must be `**/dist`, not `dist`. Linting a minified bundle
      // produces dozens of bogus "hook called in a function that is neither a
      // component nor a custom hook" errors (minified names are not PascalCase)
      // and can OOM the linter.
      '**/dist/**',
      // Leftover agent worktrees are full COPIES of this repo, stale bundle and
      // all. Linting them double-reports every finding against dead code.
      '.claude/**',
      'examples/**',
      'public/**',
      '*.config.js',
      '*.config.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    // The TS plugin is registered but its rules are NOT enabled. Existing
    // `// eslint-disable-next-line @typescript-eslint/...` comments in the code
    // would otherwise be hard ERRORS ("definition for rule was not found").
    plugins: { 'react-hooks': reactHooks, '@typescript-eslint': tsPlugin },
    rules: {
      // A component that breaks this is broken AT RUNTIME. Never downgrade it
      // to a warning — that is exactly how Billing stayed broken for four days.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
