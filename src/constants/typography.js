import fontSizes from './fontSize';

/**
 * Độ đậm font chuẩn — thay cho việc mỗi nơi viết 'bold' / '700' / '600' khác nhau.
 */
export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

/**
 * Preset kiểu chữ — spread thẳng vào style:  style={[typography.textPresets.h1, {...}]}
 * fontSize lấy từ fontSize.js để chỉ có một nguồn kích thước chữ.
 */
export const textPresets = {
  h1: {fontSize: fontSizes.h1, fontWeight: fontWeights.bold},
  h2: {fontSize: fontSizes.h2, fontWeight: fontWeights.semibold},
  h3: {fontSize: fontSizes.h3, fontWeight: fontWeights.semibold},
  body: {fontSize: fontSizes.text, fontWeight: fontWeights.regular},
  caption: {fontSize: fontSizes.h6, fontWeight: fontWeights.regular},
};

export default {fontWeights, textPresets};
