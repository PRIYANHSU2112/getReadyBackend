/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@getready/storage$': '<rootDir>/packages/storage/src/index.js',
    '^@getready/(.*)$': '<rootDir>/packages/$1',
  },
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    'services/**/*.js',
    'packages/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 120000,
};
