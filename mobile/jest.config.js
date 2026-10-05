/**
 * Jest config for mobile smoke tests.
 * Runs in Node.js environment — no React Native runtime needed for pure lib tests.
 * For component testing, use Expo's Maestro E2E or jest-expo in a future phase.
 */

const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      { configFile: path.resolve(__dirname, 'babel.config.js') },
    ],
  },
  moduleNameMapper: {
    // Resolve @/* path alias
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
};
