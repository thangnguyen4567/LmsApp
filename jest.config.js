module.exports = {
  preset: 'react-native',
  // react-native-url-polyfill phát hành dưới dạng ESM và không nằm trong danh
  // sách mặc định của preset react-native -> jest không transform, gặp `import`
  // là văng "Cannot use import statement outside a module".
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|react-native-url-polyfill)/)',
  ],
};
