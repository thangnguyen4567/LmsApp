import React, {useCallback, useEffect, useRef} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from 'react-native-vision-camera';
import {colors, fontSizes} from '../constants';

export default function Scanner({onScanner, onBack, onPress}) {
  const device = useCameraDevice('back');
  const {hasPermission, requestPermission} = useCameraPermission();
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
    if (typeof onPress === 'function') {
      onPress();
    }
  }, [hasPermission, requestPermission, onPress]);

  const onCodeScanned = useCallback(
    codes => {
      if (scannedRef.current || !codes?.length) {
        return;
      }
      const value = codes[0]?.value;
      if (value) {
        scannedRef.current = true;
        onScanner({data: value});
      }
    },
    [onScanner],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned,
  });

  if (!hasPermission) {
    return (
      <View style={styles.panel}>
        <View style={styles.center}>
          <Text style={styles.messageText}>
            Cần quyền camera để quét mã QR.
          </Text>
          <TouchableOpacity
            onPress={() => requestPermission()}
            style={styles.buttonTouchable}>
            <Text style={styles.buttonText}>Cho phép camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBack} style={styles.buttonTouchable}>
            <Text style={styles.buttonText}>Trở về</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.panel}>
        <View style={styles.center}>
          <Text style={styles.messageText}>Không tìm thấy camera.</Text>
          <TouchableOpacity onPress={onBack} style={styles.buttonTouchable}>
            <Text style={styles.buttonText}>Trở về</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.hintRow}>
        <Text style={styles.hintText}>Đưa camera mã QR để lấy URL</Text>
      </View>
      <View style={styles.cameraMiddle}>
        <View style={styles.cameraFrame}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            codeScanner={codeScanner}
          />
        </View>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity onPress={onBack} style={styles.backTouchable}>
          <Text style={styles.backText}>Trở về</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  hintRow: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 0,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  hintText: {
    fontSize: fontSizes.text,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
  },
  cameraMiddle: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  cameraFrame: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  backTouchable: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backText: {
    fontSize: fontSizes.text,
    color: colors.systemcolor,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  messageText: {
    fontSize: fontSizes.text,
    padding: 16,
    color: '#555',
    textAlign: 'center',
  },
  buttonText: {
    fontSize: fontSizes.text,
    color: colors.systemcolor,
  },
  buttonTouchable: {
    padding: 16,
  },
});
