/**
 * Babel config for the Chingu Speak Expo app.
 *
 * IMPORTANT — Why this file is critical:
 *   • react-native-reanimated 4.x is built on top of react-native-worklets.
 *   • In v4+, the babel plugin moved from 'react-native-reanimated/plugin'
 *     to 'react-native-worklets/plugin'.
 *   • Without this plugin registered (and listed LAST), Hermes crashes
 *     instantly at app startup when it tries to register reanimated worklets.
 *     This was the cause of the "Chingu Speak keeps stopping" native crash.
 *   • The worklets plugin MUST be the last entry in the plugins array.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxRuntime: 'automatic' }],
    ],
    plugins: [
      // 👇 MUST stay last — this transforms worklet directives into the
      //    native bytecode that reanimated 4 / worklets 0.5 expect.
      'react-native-worklets/plugin',
    ],
  };
};
