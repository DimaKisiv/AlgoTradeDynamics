import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            '.next/**',
            'public/**',
        ],
    },

    // JavaScript recommended rules
    js.configs.recommended,

    {
        files: ['**/*.{js,jsx}'],

        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',

            globals: {
                ...globals.browser,
                ...globals.node,
            },

            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },

        plugins: {
            'react-hooks': reactHooks,
        },

        rules: {
            // =========================
            // React Hooks
            // =========================

            'react-hooks/rules-of-hooks': 'error',

            'react-hooks/exhaustive-deps': 'warn',

            // =========================
            // JavaScript
            // =========================

            'no-unused-vars': [
                'warn',
                {
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none',
                },
            ],

            'no-var': 'error',

            'prefer-const': 'error',

            // `value == null` is an intentional concise nullish check that
            // matches both null and undefined. Other loose comparisons remain
            // errors.
            'eqeqeq': ['error', 'always', { null: 'ignore' }],

            'curly': ['error', 'all'],

            'no-duplicate-imports': 'error',

            'no-unreachable': 'error',

            'no-debugger': 'warn',

            // =========================
            // Console
            // =========================

            'no-console': [
                'warn',
                {
                    allow: ['warn', 'error'],
                },
            ],

            // =========================
            // Code Style
            // =========================

            'no-multiple-empty-lines': [
                'error',
                {
                    max: 1,
                    maxEOF: 0,
                },
            ],

            'no-trailing-spaces': 'error',

            'eol-last': ['error', 'always'],
        },
    },
    {
        files: ['src/tests/**/*.{js,jsx,cjs}'],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
];
