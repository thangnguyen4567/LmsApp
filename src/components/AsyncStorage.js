import AsyncStorage from '@react-native-async-storage/async-storage';
const saveData = async (key,value) => {
    try {
        await AsyncStorage.setItem(key, value); 
    } catch (error) {
    }
}
const getData = async (key) => {
    try {
        var value = await AsyncStorage.getItem(key);
        return value;
    } catch (error) {
    }
};
const deleteData = async (key) => {
    try {
        await AsyncStorage.removeItem(key);
        return true;
    }
    catch(exception) {
        return false;
    }
}
export {
    saveData,
    getData,
    deleteData
}