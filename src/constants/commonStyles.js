import {StyleSheet} from 'react-native';
import colors from './colors';

/**
 * Các style layout lặp đi lặp lại giữa nhiều màn.
 * Dùng kèm token:  style={[common.center, {padding: spacing.xl}]}
 *
 * Đây là style CHUNG, chỉ chứa phần bố cục không mang tính đặc thù của màn.
 * Style riêng của từng màn vẫn đặt trong StyleSheet.create của màn đó.
 */
export default StyleSheet.create({
  flex1: {flex: 1},

  // Nền trắng (màn nội dung) / nền xám nhạt (màn phụ)
  screen: {flex: 1, backgroundColor: colors.surface},
  screenAlt: {flex: 1, backgroundColor: colors.background},

  // Căn giữa toàn màn
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},

  row: {flexDirection: 'row', alignItems: 'center'},
  rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},

  // Phủ kín cha (loading spinner, error overlay, backdrop...)
  absoluteFill: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
