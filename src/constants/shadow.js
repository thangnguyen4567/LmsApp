import {Platform} from 'react-native';

/**
 * Preset đổ bóng — tự lo khác biệt iOS (shadow*) và Android (elevation),
 * thay cho các khối Platform.select lặp lại trong từng màn.
 *
 * Dùng:  style={[styles.card, shadow.md]}
 */
const make = (ios, elevation) =>
  Platform.select({
    ios,
    android: {elevation},
  });

export default {
  sm: make(
    {shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.08, shadowRadius: 3},
    2,
  ),
  md: make(
    {shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.08, shadowRadius: 6},
    3,
  ),
  lg: make(
    {shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.18, shadowRadius: 14},
    10,
  ),
};
