import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

const defaultConfig = {
	extends: compat.extends(
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	),
	plugins: {
		'@typescript-eslint': typescriptEslintEslintPlugin,
	},
	languageOptions: {
		globals: {
			...globals.node,
		},
		parser: tsParser,
		ecmaVersion: 5,
		sourceType: 'module',
		parserOptions: {
			project: 'tsconfig.json',
		},
	},
	rules: {
		'@typescript-eslint/interface-name-prefix': 'off',
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-unused-vars': [
			'error',
			{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
		],
		indent: ['error', 'tab'],
	},
};

export default defineConfig([
	globalIgnores(['**/.eslintrc.js', 'dist']),
	defaultConfig,
	{
		...defaultConfig,
		files: ['**/*.spec.ts'],
		rules: {
			...defaultConfig.rules,
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
]);