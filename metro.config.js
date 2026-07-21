const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// Bỏ qua thư mục build của Gradle bên trong node_modules (vd: react-native-localize).
// Gradle tạo/xóa các file intermediates khi build khiến file-watcher của Metro
// crash với ENOENT trên Windows. Không cần watch các file này.
const androidBuild = /node_modules[\\/].*[\\/]android[\\/]build[\\/].*/;

// Giữ lại blockList mặc định của React Native rồi ghép thêm pattern android/build.
const defaultBlockList = defaultConfig.resolver.blockList;
const blockListSources = (
  Array.isArray(defaultBlockList) ? defaultBlockList : [defaultBlockList]
)
  .filter(Boolean)
  .map(re => re.source)
  .concat(androidBuild.source);

const config = {
  resolver: {
    blockList: new RegExp(blockListSources.map(s => `(${s})`).join('|')),
  },
};

module.exports = mergeConfig(defaultConfig, config);
