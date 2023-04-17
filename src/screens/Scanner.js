/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { Component } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors,fontSizes} from '../constants';
import QRCodeScanner from 'react-native-qrcode-scanner';

class Scanner extends Component {
  render() {
    return (
      <QRCodeScanner
      onRead={this.props.onScanner}
      topContent={
        <Text style={styles.centerText}>
          Đưa camera mã QR để lấy URL
        </Text>
      }
      bottomContent={
        <TouchableOpacity onPress={this.props.onBack} style={styles.buttonTouchable}>
          <Text style={styles.buttonText}>Trở về</Text>
        </TouchableOpacity>
      }
      />
    );
  }
}
const styles = StyleSheet.create({
  centerText: {
    flex: 1,
    fontSize: fontSizes.text,
    padding: 32,
    color: '#777'
  },
  textBold: {
    fontWeight: '500',
    color: '#000'
  },
  buttonText: {
    fontSize: fontSizes.text,
    color: colors.systemcolor
  },
  buttonTouchable: {
    padding: 16
  }
});
export default Scanner;
