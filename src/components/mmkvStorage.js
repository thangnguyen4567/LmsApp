/**
 * Lần đầu mở app sau cập nhật: copy các key đã lưu AsyncStorage sang MMKV rồi xóa key đó ở AsyncStorage.
 * Sau này có thể import trực tiếp `lmsMMKV` / bỏ facade AsyncStorage.js.
 */

import {createMMKV} from 'react-native-mmkv';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LMS_MMKV_ID = 'lms-app-storage';

export const lmsMMKV = createMMKV({id: LMS_MMKV_ID});

const MIGRATION_FLAG_KEY = '__lms_migrated_from_async_storage_v1';

export const ASYNC_STORAGE_KEYS_TO_MIGRATE = [
  'url',
  'username',
  'password',
  'saas_userdata',
];

let migrationPromise = null;

export function isAsyncStorageMigrationDone() {
  return lmsMMKV.getString(MIGRATION_FLAG_KEY) === '1';
}

/**
 * Đảm bảo dữ liệu AsyncStorage (bản cũ) đã được copy sang MMKV (một lần).
 * Idempotent; gọi trước mọi get/set/delete qua facade AsyncStorage.js.
 */
export async function ensureAsyncStorageMigratedToMmkv() {
    if (isAsyncStorageMigrationDone()) {
        return;
    }
    if (migrationPromise) {
        await migrationPromise;
        return;
    }
    migrationPromise = (async () => {
        for (const key of ASYNC_STORAGE_KEYS_TO_MIGRATE) {
            try {
                const fromAsync = await AsyncStorage.getItem(key);
                if (fromAsync != null && !lmsMMKV.contains(key)) {
                    lmsMMKV.set(key, fromAsync);
                }
            } catch (_e) {
                // tiếp tục các key khác
            }
        }
        lmsMMKV.set(MIGRATION_FLAG_KEY, '1');
        for (const key of ASYNC_STORAGE_KEYS_TO_MIGRATE) {
            try {
                await AsyncStorage.removeItem(key);
            } catch (_e) {
                // ignore
            }
        }
    })();
    try {
        await migrationPromise;
    } catch (e) {
        migrationPromise = null;
        throw e;
    }
}
