module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // Reanimated plugin MUST be last.
      'react-native-reanimated/plugin',
    ],
  };
};
