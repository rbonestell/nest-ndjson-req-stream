/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: ['js', 'json', 'ts'],
	rootDir: './src',
	testRegex: '.*\\.spec\\.ts$',
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	coverageReporters: ['text', 'cobertura'],
	coverageDirectory: '../coverage',
};