/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  roots: ['<rootDir>/src/tests'],
  setupFiles: ['<rootDir>/src/tests/env.js'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    'src/modules/**/*.js',
    'src/common/**/*.js',
    'src/core/**/*.js',
    '!src/**/index.js',
    '!src/**/*.docs.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 120000,
};
