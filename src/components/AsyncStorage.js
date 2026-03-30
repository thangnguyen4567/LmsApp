import {
    lmsMMKV,
    ensureAsyncStorageMigratedToMmkv,
} from './mmkvStorage';

const saveData = async (key, value) => {
    try {
        await ensureAsyncStorageMigratedToMmkv();
        if (value === undefined || value === null) {
            lmsMMKV.remove(key);
        } else {
            lmsMMKV.set(key, String(value));
        }
    } catch (error) {
        console.log(error);
    }
};

const getData = async key => {
    try {
        await ensureAsyncStorageMigratedToMmkv();
        const value = lmsMMKV.getString(key);
        return value === undefined ? null : value;
    } catch (error) {
        console.log(error);
    }
};

const deleteData = async key => {
    try {
        await ensureAsyncStorageMigratedToMmkv();
        lmsMMKV.remove(key);
        return true;
    } catch (exception) {
        console.log(exception);
        return false;
    }
};

export {saveData, getData, deleteData};
