import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { colors } from '../constants';

/**
 * Màn mặc định khi chưa có URL LMS (chưa quét QR / chưa lưu project).
 */
export default function WelcomePlaceholder(props) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
      keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.iconWrap} onPress={() => props.setScanQRCode(true)}>
        <Icon
          name="qrcode"
          size={40}
          color={colors.systemcolor}
        />
      </TouchableOpacity>

      <Text style={styles.title}>Chào mừng đến với AILearning</Text>

      <Text style={styles.body}>
        Để mở nội dung học tập, vui lòng sử dụng chức năng quét
        mã QR trên thanh header hoặc biểu tượng QR phía trên.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hướng dẫn</Text>
        <Text style={styles.cardBody}>
          Nhấn vào biểu tượng quét mã QR trên header hoặc biểu tượng QR phía trên → Quét mã QR của trang LMS →
          Ứng dụng sẽ tải và hiển thị nội dung học tập cho bạn.
        </Text>
      </View>

      <Text style={styles.footer}>
        Trang này sẽ được thay thế sau khi bạn quét mã QR thành công.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.systemcolor,
    marginBottom: 10,
    textAlign: 'center',
  },
  cardBody: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
