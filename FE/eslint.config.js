import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
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
            react,
            'react-hooks': reactHooks,
        },

        settings: {
            react: {
                version: 'detect',
            },
        },

        rules: {
            // =========================
            // React
            // =========================

            'react/prop-types': 'off',

            // React 17+ / new JSX transform
            'react/react-in-jsx-scope': 'off',

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

            'eqeqeq': ['error', 'always'],

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
];
