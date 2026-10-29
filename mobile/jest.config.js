/**
 * Jest config for mobile smoke tests.
 * Runs in Node.js environment — no React Native runtime needed for pure lib tests.
 * For component testing, use Expo's Maestro E2E or jest-expo in a future phase.
 */

const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  // @thekra/practice-core is TypeScript source with `.js` relative specifiers (see jest.resolver.js).
  resolver: '<rootDir>/jest.resolver.js',
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      { configFile: path.resolve(__dirname, 'jest.babel.config.js') },
    ],
    // ESM .js from node_modules that is not ignored below (@noble/* for the vault).
    '^.+\\.m?js$': [
      'babel-jest',
      { configFile: path.resolve(__dirname, 'jest.babel.config.js') },
    ],
  },
  moduleNameMapper: {
    // Resolve @/* path alias
    '^@/(.*)$': '<rootDir>/src/$1',
    // expo-constants pulls this ESM virtual module
    '^expo/virtual/env$': '<rootDir>/src/__tests__/mocks/expo-env.js',
  },
  // pnpm keeps packages under node_modules/.pnpm/<name>@<v>/node_modules/<name>. @noble/* (used by
  // practice-core's vault) is ESM-only, so it is transformed too.
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm/)?(expo-constants|expo-modules-core|@noble))',
  ],
};
