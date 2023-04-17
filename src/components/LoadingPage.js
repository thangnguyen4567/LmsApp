import React, {Component} from 'react';
import { 
    View, 
    StyleSheet, 
    TouchableOpacity, 
    ActivityIndicator,
    Dimensions
} from 'react-native';

const api = {};
export default class LoadingPage extends Component {
    constructor(props) {
        super(props)
    }
    render() {
        return (
            <View style={{position: 'absolute',top:0,left:0}}>
                    <View style={styles.modal}>
                        <TouchableOpacity activeOpacity={1} style={styles.container} onPress={() => null}>
                            <ActivityIndicator size="large" color={'#33A2F8'} />
                        </TouchableOpacity>
                    </View>
            </View>
        )
    }
}

const { height, width } = Dimensions.get('window');
const styles = StyleSheet.create({
  modal: {
    zIndex: 4,
    position: 'absolute',
    height: height,
    width: width,
    alignSelf: 'flex-end',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
})