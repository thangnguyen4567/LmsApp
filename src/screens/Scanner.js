import React, {useCallback, useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from 'react-native-vision-camera';
import {colors, fontSizes, spacing, radius, typography} from '../constants';

export default function Scanner({onScanner, onBack, onPress}) {
  const {t} = useTranslation();
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
            {t('scanner.needCamera')}
          </Text>
          <TouchableOpacity
            onPress={() => requestPermission()}
            style={styles.buttonTouchable}>
            <Text style={styles.buttonText}>{t('scanner.allowCamera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBack} style={styles.buttonTouchable}>
            <Text style={styles.buttonText}>{t('common.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.panel}>
        <View style={styles.center}>
          <Text style={styles.messageText}>{t('scanner.noCamera')}</Text>
          <TouchableOpacity onPress={onBack} style={styles.buttonTouchable}>
            <Text style={styles.buttonText}>{t('common.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.hintRow}>
        <Text style={styles.hintText}>{t('scanner.hint')}</Text>
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
          <Text style={styles.backText}>{t('common.goBack')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: colors.surface, // #fff
    overflow: 'hidden',
  },
  hintRow: {
    paddingHorizontal: spacing.lg, // 20
    paddingTop: 50, // lệch thang → giữ literal
    paddingBottom: 0,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  hintText: {
    fontSize: fontSizes.text,
    color: colors.neutral500, // #777
    textAlign: 'center',
    lineHeight: 20,
  },
  cameraMiddle: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg, // 20
    backgroundColor: colors.surface,
  },
  cameraFrame: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    aspectRatio: 3 / 4,
    borderRadius: radius.sm, // 8
    overflow: 'hidden',
    backgroundColor: colors.black, // #000
  },
  footer: {
    paddingHorizontal: spacing.xl, // 24
    paddingTop: spacing.base, // 16
    paddingBottom: 28, // lệch thang → giữ literal
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  backTouchable: {
    paddingVertical: spacing.md, // 12
    paddingHorizontal: spacing.lg, // 20
  },
  backText: {
    fontSize: fontSizes.text,
    color: colors.systemcolor,
    fontWeight: typography.fontWeights.medium, // '500'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl, // 24
  },
  messageText: {
    fontSize: fontSizes.text,
    padding: spacing.base, // 16
    color: colors.textMuted, // #555
    textAlign: 'center',
  },
  buttonText: {
    fontSize: fontSizes.text,
    color: colors.systemcolor,
  },
  buttonTouchable: {
    padding: spacing.base, // 16
  },
});
