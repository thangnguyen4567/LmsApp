/**
 * Thang khoảng cách (padding / margin / gap) theo lưới 4pt.
 * Giá trị khớp các con số đang được dùng nhiều nhất trong app.
 *
 * Lưu ý khi migrate màn cũ: nếu gặp giá trị "lẻ" ngoài thang (vd 5, 6, 10),
 * hãy GIỮ nguyên literal đó hoặc chuẩn hóa có chủ đích — không âm thầm đổi,
 * để tránh lệch pixel so với giao diện hiện tại.
 */
export default {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};
