import React,{Component} from 'react';
import Icon from 'react-native-vector-icons/FontAwesome5'
import { 
FlatList,
TouchableOpacity,
View,
Text,
StyleSheet
} from 'react-native';

export default class MenuItem extends Component {
    renderItem = ({item}) => {
        return (
            <TouchableOpacity onPress={item.onPress}>
                <View style={style.view}>
                    <Icon            
                        name={item.icon}
                        style={style.icon}
                        size={18}
                    />
                    <Text style={{color:'black'}}>{item.title}</Text>
                </View>
            </TouchableOpacity>
        )
    }
    render() {
        return (
            <FlatList
                data={this.props.dataMenu}
                renderItem={this.renderItem}
            />
        )
    }
}
const style = StyleSheet.create({
    view: {
        padding: 16, 
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth:0.5,
        borderBottomColor:'grey'
    },
    icon: {
        padding:5,
        color:'black'
    }
})