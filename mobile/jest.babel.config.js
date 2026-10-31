/**
 * Babel for Jest only (jest.config.js points babel-jest here). The app build has no babel.config.js on purpose:
 * Expo then uses its own default preset, resolved from `expo`. A project babel.config.js that names
 * 'babel-preset-expo' breaks the release bundle under pnpm (the preset is not a direct dependency of mobile/).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
